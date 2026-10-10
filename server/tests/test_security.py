import pytest

from app.downloader import classify_error
from app.security import InvalidURL, RateLimiter, detect_platform, safe_filename


@pytest.mark.parametrize(
    "url,platform",
    [
        ("https://www.tiktok.com/@user/video/7300000000000000000", "tiktok"),
        ("https://vm.tiktok.com/ZMabc123/", "tiktok"),
        ("tiktok.com/@user/video/1", "tiktok"),
        ("https://www.instagram.com/reel/Cabc123/", "instagram"),
        ("https://www.facebook.com/watch/?v=123", "facebook"),
        ("https://fb.watch/abc/", "facebook"),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"),
        ("https://youtu.be/dQw4w9WgXcQ", "youtube"),
        ("https://m.youtube.com/shorts/abc", "youtube"),
    ],
)
def test_supported_platforms(url, platform):
    assert detect_platform(url) == platform


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://youtube.com/video",
        "javascript:alert(1)",
        "http://127.0.0.1:8000/api/health",
        "http://169.254.169.254/latest/meta-data",
        "http://[::1]/",
        "https://evil.com/?q=youtube.com",
        "https://youtube.com.evil.com/watch?v=1",
        "https://notyoutube.com/watch?v=1",
        "https://user:pass@youtube.com/watch?v=1",
        "https://youtube.com:8443/watch?v=1",
        "https://example.com/video.mp4",
        "",
        "https://youtube.com/\x00watch",
        "https://youtube.com/" + "a" * 3000,
    ],
)
def test_rejected_urls(url):
    with pytest.raises(InvalidURL):
        detect_platform(url)


def test_safe_filename_strips_dangerous_characters():
    assert safe_filename("../../etc/passwd") == "etc passwd"
    assert safe_filename('a<b>c:d"e|f?g*h') == "a b c d e f g h"
    assert safe_filename("CON") == "clipmagnet"
    assert safe_filename("") == "clipmagnet"
    assert safe_filename(None) == "clipmagnet"
    assert len(safe_filename("x" * 500)) <= 90
    assert safe_filename("Mi video 🎬 #viral") == "Mi video 🎬 viral"


def test_rate_limiter():
    limiter = RateLimiter(3)
    assert all(limiter.allow("ip") for _ in range(3))
    assert not limiter.allow("ip")
    assert limiter.allow("other-ip")


@pytest.mark.parametrize(
    "message,code",
    [
        ("ERROR: [youtube] abc: Sign in to confirm you're not a bot", "bot_check"),
        ("ERROR: [Instagram] abc: Requested content is not available, rate-limit reached or login required", "login_required"),
        ("ERROR: [youtube] abc: Private video. Sign in if you've been granted access", "private"),
        ("ERROR: [youtube] abc: Video unavailable", "unavailable"),
        ("ERROR: Unsupported URL: https://x", "unsupported_platform"),
        ("something odd", "failed"),
    ],
)
def test_error_classification(message, code):
    assert classify_error(message) == code


def test_invalid_request_does_not_echo_input():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        r = c.post("/api/jobs", json={"url": "https://youtu.be/x", "mode": "<script>"})
        assert r.status_code == 422
        assert r.json() == {"error": "invalid_request"}
