"""Pruebas de la API sin salir a internet (yt-dlp se simula)."""
import shutil
import subprocess
import time

import pytest
from fastapi.testclient import TestClient

from app import downloader
from app.main import app

FAKE_INFO = {
    "id": "abc",
    "title": "Mi video de prueba / con: caracteres*raros",
    "uploader": "Creador",
    "duration": 4,
    "width": 1920,
    "height": 1080,
    "thumbnail": "https://i.ytimg.com/vi/abc/maxresdefault.jpg",
    "formats": [
        {"format_id": "137", "vcodec": "avc1.640028", "acodec": "none", "width": 1920, "height": 1080, "fps": 30, "tbr": 4000},
        {"format_id": "248", "vcodec": "vp9", "acodec": "none", "width": 1920, "height": 1080, "fps": 30, "tbr": 3000},
        {"format_id": "313", "vcodec": "vp9", "acodec": "none", "width": 3840, "height": 2160, "fps": 60, "tbr": 20000, "dynamic_range": "SDR"},
        {"format_id": "22", "vcodec": "avc1", "acodec": "mp4a.40.2", "width": 1280, "height": 720, "fps": 30, "tbr": 1500},
        {"format_id": "140", "vcodec": "none", "acodec": "mp4a.40.2", "abr": 129, "tbr": 129},
        {"format_id": "sb0", "vcodec": "none", "acodec": "none", "ext": "mhtml", "format_note": "storyboard"},
    ],
}

TIKTOK_INFO = {
    "id": "tt",
    "title": "tiktok",
    "duration": 10,
    "formats": [
        {"format_id": "download", "vcodec": "h264", "acodec": "aac", "width": 1080, "height": 1920, "format_note": "watermarked", "tbr": 2000},
        {"format_id": "h264_540p", "vcodec": "h264", "acodec": "aac", "width": 576, "height": 1024, "tbr": 1000},
    ],
}

needs_ffmpeg = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg no instalado")


class FakeYDL:
    info = FAKE_INFO

    def __init__(self, opts):
        self.opts = opts

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def extract_info(self, url, download=False):
        return dict(self.info)


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(downloader.yt_dlp, "YoutubeDL", FakeYDL)
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["name"] == "CLIPMAGNET"
    assert r.headers["x-content-type-options"] == "nosniff"


def test_info_lists_qualities(client):
    r = client.post("/api/info", json={"url": "https://youtu.be/abc"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["platform"] == "youtube"
    assert [q["value"] for q in data["qualities"]] == [2160, 1080, 720]
    q4k = data["qualities"][0]
    assert q4k["tier"] == "4K" and q4k["fps"] == 60 and q4k["h264"] is False
    assert data["qualities"][1]["h264"] is True
    assert data["audio"]["abr"] == 129
    assert data["thumbnail"].startswith("/api/thumb/")


def test_tiktok_hides_watermarked_formats(client, monkeypatch):
    monkeypatch.setattr(FakeYDL, "info", TIKTOK_INFO)
    data = client.post("/api/info", json={"url": "https://www.tiktok.com/@a/video/1"}).json()
    assert data["watermark_free"] is True
    assert [q["value"] for q in data["qualities"]] == [576]
    assert data["vertical"] is False or data["vertical"] is True


def test_rejects_foreign_urls(client):
    for url in ["https://example.com/a.mp4", "http://127.0.0.1/", "file:///etc/passwd"]:
        r = client.post("/api/info", json={"url": url})
        assert r.status_code == 400
        assert r.json()["error"] in {"unsupported_platform", "invalid_url"}


def test_unknown_job_is_404(client):
    assert client.get("/api/jobs/doesnotexist000000").status_code == 404
    assert client.get("/api/jobs/../../etc/passwd").status_code == 404


@needs_ffmpeg
def test_job_flow_serves_verified_media(client, monkeypatch, tmp_path):
    sample = tmp_path / "sample.mp4"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25", "-f", "lavfi", "-i", "sine",
         "-t", "1", "-c:v", "libx264", "-c:a", "aac", "-shortest", str(sample)],
        check=True,
    )

    def fake_download(self, job, logger):
        job.title = "Prueba: final/1"
        job.directory.mkdir(parents=True, exist_ok=True)
        shutil.copy(sample, job.directory / "media.mp4")

    monkeypatch.setattr(downloader.JobManager, "_download", fake_download)
    r = client.post("/api/jobs", json={"url": "https://youtu.be/abc", "mode": "video", "quality": 1080})
    assert r.status_code == 201, r.text
    job_id = r.json()["id"]
    for _ in range(100):
        status = client.get(f"/api/jobs/{job_id}").json()
        if status["status"] in {"done", "error"}:
            break
        time.sleep(0.05)
    assert status["status"] == "done", status
    assert status["codecs"] == "H.264 + AAC"
    f = client.get(status["file"])
    assert f.status_code == 200
    assert f.headers["content-type"] == "video/mp4"
    assert "attachment" in f.headers["content-disposition"]
    assert "/" not in f.headers["content-disposition"].split("filename")[1]


@needs_ffmpeg
def test_fake_media_is_rejected(client, monkeypatch):
    def fake_download(self, job, logger):
        job.directory.mkdir(parents=True, exist_ok=True)
        (job.directory / "media.mp4").write_bytes(b"MZ\x90\x00 esto no es un video")

    monkeypatch.setattr(downloader.JobManager, "_download", fake_download)
    job_id = client.post("/api/jobs", json={"url": "https://youtu.be/abc"}).json()["id"]
    for _ in range(100):
        status = client.get(f"/api/jobs/{job_id}").json()
        if status["status"] in {"done", "error"}:
            break
        time.sleep(0.05)
    assert status["status"] == "error"
    assert status["error"] == "invalid_media"
    assert client.get(f"/api/jobs/{job_id}/file").status_code == 409
