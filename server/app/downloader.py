"""Motor de descarga de CLIPMAGNET (yt-dlp + FFmpeg).

Flujo de un trabajo:
  1. Se valida el enlace contra la lista blanca de plataformas.
  2. yt-dlp obtiene la información y elige el mejor formato para la calidad pedida.
  3. Se descarga a una carpeta temporal aislada (una por trabajo).
  4. FFmpeg une audio+video, extrae el audio o convierte a H.264 si se pidió.
  5. FFprobe verifica que el resultado sea audio/video real antes de entregarlo.
  6. La carpeta se borra automáticamente pasado el tiempo de vida (CM_FILE_TTL).
"""
from __future__ import annotations

import json
import logging
import os
import re
import secrets
import shutil
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

import yt_dlp
from yt_dlp.utils import DownloadError, ExtractorError

from .config import settings
from .security import ALLOWED_EXTRACTORS, MEDIA_TYPES, detect_platform, normalize_url, safe_filename

log = logging.getLogger("clipmagnet")

JOB_ID_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
TIERS = {4320: "8K", 2160: "4K", 1440: "2K", 1080: "Full HD", 720: "HD"}
CODEC_NAMES = (
    (("avc", "h264"), "H.264"),
    (("hev", "hvc", "h265", "bytevc1"), "H.265"),
    (("vp09", "vp9"), "VP9"),
    (("av01", "av1"), "AV1"),
    (("vp8",), "VP8"),
)


# --------------------------------------------------------------------------- #
#  Herramientas externas
# --------------------------------------------------------------------------- #
def _which(name: str, env: str) -> str | None:
    custom = os.environ.get(env)
    if custom and Path(custom).exists():
        return custom
    return shutil.which(name)


FFMPEG = _which("ffmpeg", "CM_FFMPEG")
FFPROBE = _which("ffprobe", "CM_FFPROBE")


def _detect_js_runtime() -> tuple[str | None, dict[str, dict]]:
    """YouTube necesita un motor JavaScript (Deno recomendado) para sus firmas."""
    for name in ("deno", "node", "bun"):
        path = shutil.which(name)
        if path:
            return name, {name: {"path": path}}
    return None, {}


JS_RUNTIME, JS_RUNTIMES = _detect_js_runtime()


def tools_status() -> dict[str, Any]:
    return {
        "ytdlp": yt_dlp.version.__version__,
        "ffmpeg": bool(FFMPEG),
        "ffprobe": bool(FFPROBE),
        "js_runtime": JS_RUNTIME,
    }


# --------------------------------------------------------------------------- #
#  Errores comprensibles
# --------------------------------------------------------------------------- #
class ClipError(Exception):
    def __init__(self, code: str, detail: str = "", status: int = 400) -> None:
        super().__init__(code)
        self.code = code
        self.detail = detail[:300]
        self.status = status


class Cancelled(Exception):
    pass


_ERROR_PATTERNS: list[tuple[str, str]] = [
    (r"sign in to confirm|confirm you.?re not a bot|not a bot", "bot_check"),
    (r"private video|this video is private|account is private|private account", "private"),
    (r"login required|log in|requested content is not available|rate-limit reached|cookies", "login_required"),
    (r"age.?restricted|inappropriate for some users|confirm your age", "age_restricted"),
    (r"not available in your country|geo.?restrict|blocked it in your country", "geo_blocked"),
    (r"live event|is_live|live stream|premieres in", "live"),
    (r"larger than max-filesize|max_filesize|file is larger", "too_large"),
    (r"unsupported url|no suitable extractor", "unsupported_platform"),
    (r"no video formats found|no video could be found|there is no video in this post|requested format is not available", "no_media"),
    (r"video unavailable|has been removed|not available|does not exist|404", "unavailable"),
    (r"timed out|timeout|temporary failure|connection|network is unreachable|getaddrinfo", "network"),
    (r"ffmpeg|ffprobe", "ffmpeg_missing"),
]


def classify_error(message: str) -> str:
    text = (message or "").lower()
    for pattern, code in _ERROR_PATTERNS:
        if re.search(pattern, text):
            if code == "ffmpeg_missing" and FFMPEG:
                continue
            return code
    return "failed"


class _QuietLogger:
    """Registra solo lo necesario y guarda el último error para clasificarlo."""

    def __init__(self) -> None:
        self.messages: list[str] = []

    def debug(self, msg: str) -> None:
        pass

    def info(self, msg: str) -> None:
        pass

    def warning(self, msg: str) -> None:
        self.messages.append(msg)

    def error(self, msg: str) -> None:
        self.messages.append(msg)


# --------------------------------------------------------------------------- #
#  Opciones de yt-dlp
# --------------------------------------------------------------------------- #
def base_options(logger: _QuietLogger | None = None) -> dict[str, Any]:
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "noplaylist": True,
        "allowed_extractors": ALLOWED_EXTRACTORS,
        "socket_timeout": 20,
        "retries": 3,
        "fragment_retries": 3,
        "extractor_retries": 2,
        "concurrent_fragment_downloads": 4,
        "check_formats": False,
        "windowsfilenames": True,
        "overwrites": True,
        "cachedir": False,
        "max_filesize": settings.max_filesize_mb * 1024 * 1024,
        "logger": logger or _QuietLogger(),
        "js_runtimes": JS_RUNTIMES,
    }
    if FFMPEG:
        opts["ffmpeg_location"] = str(Path(FFMPEG).parent)
    if settings.proxy:
        opts["proxy"] = settings.proxy
    if settings.cookies_file and Path(settings.cookies_file).is_file():
        opts["cookiefile"] = settings.cookies_file
    return opts


def _codec_name(vcodec: str | None) -> str | None:
    if not vcodec or vcodec == "none":
        return None
    v = vcodec.lower()
    for keys, name in CODEC_NAMES:
        if v.startswith(keys) or any(k in v for k in keys):
            return name
    return vcodec.split(".")[0].upper()


def _is_watermarked(fmt: dict) -> bool:
    note = f"{fmt.get('format_note') or ''} {fmt.get('format_id') or ''}".lower()
    return "watermark" in note


def _short_side(fmt: dict) -> int | None:
    w, h = fmt.get("width"), fmt.get("height")
    if w and h:
        return int(min(w, h))
    return int(h or w) if (h or w) else None


def _estimate_size(fmt: dict, duration: float | None) -> int | None:
    size = fmt.get("filesize") or fmt.get("filesize_approx")
    if not size and fmt.get("tbr") and duration:
        size = fmt["tbr"] * 1000 / 8 * duration
    return int(size) if size else None


def _pick_entry(info: dict, item: int) -> tuple[dict, int]:
    """Algunas publicaciones (carruseles de Instagram) traen varios videos."""
    if info.get("_type") in ("playlist", "multi_video"):
        entries = [e for e in (info.get("entries") or []) if e]
        if not entries:
            raise ClipError("no_media")
        index = min(max(item, 1), len(entries))
        return entries[index - 1], len(entries)
    return info, 1


# --------------------------------------------------------------------------- #
#  Análisis del enlace (sin descargar)
# --------------------------------------------------------------------------- #
_thumbs: dict[str, tuple[str, float]] = {}
_thumbs_lock = threading.Lock()
_info_slots = threading.BoundedSemaphore(4)


def _register_thumb(url: str | None) -> str | None:
    if not url or not url.startswith("https://"):
        return None
    token = secrets.token_urlsafe(16)
    with _thumbs_lock:
        now = time.time()
        for k in [k for k, (_, exp) in _thumbs.items() if exp < now]:
            _thumbs.pop(k, None)
        _thumbs[token] = (url, now + settings.file_ttl)
    return token


def fetch_thumbnail(token: str) -> tuple[bytes, str]:
    with _thumbs_lock:
        entry = _thumbs.get(token)
    if not entry or entry[1] < time.time():
        raise ClipError("not_found", status=404)
    with yt_dlp.YoutubeDL(base_options()) as ydl:
        try:
            resp = ydl.urlopen(entry[0])
        except Exception as exc:  # noqa: BLE001
            raise ClipError("not_found", str(exc), status=404) from exc
        ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype not in {"image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"}:
            raise ClipError("not_found", status=404)
        data = resp.read(5 * 1024 * 1024 + 1)
        if len(data) > 5 * 1024 * 1024:
            raise ClipError("not_found", status=404)
    return data, ctype


def analyze(url: str, item: int = 1) -> dict[str, Any]:
    platform = detect_platform(url)
    url = normalize_url(url)
    logger = _QuietLogger()
    opts = base_options(logger)
    opts["playlist_items"] = str(item) if item > 1 else None
    if not _info_slots.acquire(timeout=30):
        raise ClipError("busy", status=503)
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except (DownloadError, ExtractorError) as exc:
        raise ClipError(classify_error(str(exc)), str(exc)) from exc
    finally:
        _info_slots.release()
    if not info:
        raise ClipError(classify_error(" ".join(logger.messages)))

    items_count = 1
    if info.get("_type") in ("playlist", "multi_video"):
        items_count = info.get("playlist_count") or len(info.get("entries") or [])
        entry, _ = _pick_entry(info, 1)
    else:
        entry = info
    if entry.get("is_live"):
        raise ClipError("live")

    duration = entry.get("duration")
    formats = entry.get("formats") or [entry]
    videos: dict[int, dict[str, Any]] = {}
    best_audio: dict | None = None
    watermark_free: bool | None = None if platform != "tiktok" else False

    for f in formats:
        if f.get("has_drm") or (f.get("format_note") or "").lower() == "storyboard" or f.get("ext") == "mhtml":
            continue
        vcodec, acodec = f.get("vcodec"), f.get("acodec")
        is_video = vcodec != "none" and (f.get("height") or f.get("width"))
        is_audio_only = vcodec == "none" and acodec not in (None, "none")
        if is_audio_only:
            if not best_audio or (f.get("abr") or 0) > (best_audio.get("abr") or 0):
                best_audio = f
            continue
        if not is_video:
            continue
        if platform == "tiktok":
            if _is_watermarked(f):
                continue
            watermark_free = True
        side = _short_side(f)
        if not side or side > settings.max_height:
            continue
        q = videos.setdefault(side, {"value": side, "fps": 0, "codecs": set(), "hdr": False, "size": None, "has_audio": False, "_tbr": -1})
        q["fps"] = max(q["fps"], int(round(f.get("fps") or 0)))
        codec = _codec_name(vcodec)
        if codec:
            q["codecs"].add(codec)
        if (f.get("dynamic_range") or "SDR") != "SDR":
            q["hdr"] = True
        if acodec not in (None, "none"):
            q["has_audio"] = True
        tbr = f.get("tbr") or 0
        if tbr > q["_tbr"]:
            q["_tbr"] = tbr
            q["size"] = _estimate_size(f, duration)

    audio_size = _estimate_size(best_audio, duration) if best_audio else None
    qualities = []
    for side in sorted(videos, reverse=True):
        q = videos[side]
        size = q["size"]
        if size and audio_size and not q["has_audio"]:
            size += audio_size
        codecs = sorted(q["codecs"])
        qualities.append({
            "value": side,
            "label": f"{side}p",
            "tier": TIERS.get(side),
            "fps": q["fps"] or None,
            "codecs": codecs,
            "h264": "H.264" in codecs,
            "hdr": q["hdr"],
            "size": size,
        })

    width, height = entry.get("width"), entry.get("height")
    thumb = entry.get("thumbnail")
    if not thumb and entry.get("thumbnails"):
        thumb = entry["thumbnails"][-1].get("url")
    token = _register_thumb(thumb)

    return {
        "platform": platform,
        "title": (entry.get("title") or entry.get("description") or "").strip()[:300] or None,
        "uploader": entry.get("uploader") or entry.get("channel") or entry.get("creator"),
        "duration": duration,
        "thumbnail": f"/api/thumb/{token}" if token else None,
        "vertical": bool(width and height and height > width),
        "qualities": qualities,
        "audio": {
            "abr": round(best_audio.get("abr")) if best_audio and best_audio.get("abr") else None,
            "codec": (best_audio.get("acodec") or "").split(".")[0] if best_audio else None,
            "size": audio_size,
        },
        "items_count": items_count,
        "item": item,
        "watermark_free": watermark_free,
        "limits": {"max_duration": settings.max_duration, "convert": settings.allow_convert and bool(FFMPEG)},
    }


# --------------------------------------------------------------------------- #
#  Trabajos de descarga
# --------------------------------------------------------------------------- #
@dataclass
class Job:
    url: str
    platform: str
    mode: str
    quality: int | None
    audio_format: str
    audio_quality: str
    h264: bool
    item: int
    id: str = field(default_factory=lambda: secrets.token_urlsafe(18))
    status: str = "queued"
    stage: str = "queued"
    progress: float = 0.0
    speed: float | None = None
    eta: int | None = None
    downloaded: int = 0
    total: int | None = None
    error: str | None = None
    detail: str | None = None
    title: str | None = None
    file_path: Path | None = None
    download_name: str | None = None
    media_type: str | None = None
    size: int | None = None
    codecs: str | None = None
    watermark: bool | None = None
    created: float = field(default_factory=time.time)
    finished: float | None = None
    cancel_event: threading.Event = field(default_factory=threading.Event)
    # contadores internos de partes (video + audio)
    _parts: int = 1
    _part_index: int = 0
    _seen: set = field(default_factory=set)
    _download_weight: float = 0.92

    @property
    def directory(self) -> Path:
        return settings.download_dir / self.id

    def public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "status": self.status,
            "stage": self.stage,
            "progress": round(min(max(self.progress, 0.0), 1.0), 4),
            "speed": self.speed,
            "eta": self.eta,
            "downloaded": self.downloaded,
            "total": self.total,
            "error": self.error,
            "title": self.title,
            "filename": self.download_name,
            "size": self.size,
            "codecs": self.codecs,
            "watermark": self.watermark,
            "file": f"/api/jobs/{self.id}/file" if self.status == "done" else None,
            "expires_in": max(0, int(self.finished + settings.file_ttl - time.time())) if self.finished and self.status == "done" else None,
        }


class JobManager:
    def __init__(self) -> None:
        self.jobs: dict[str, Job] = {}
        self.lock = threading.Lock()
        self.pool = ThreadPoolExecutor(max_workers=settings.max_concurrent, thread_name_prefix="clipmagnet")
        settings.download_dir.mkdir(parents=True, exist_ok=True)
        self._purge_orphans()
        threading.Thread(target=self._janitor, daemon=True, name="clipmagnet-janitor").start()

    # ---- ciclo de vida --------------------------------------------------- #
    def create(self, **kwargs: Any) -> Job:
        with self.lock:
            active = sum(1 for j in self.jobs.values() if j.status in ("queued", "running"))
            if active >= settings.max_queue:
                raise ClipError("busy", status=503)
            job = Job(**kwargs)
            self.jobs[job.id] = job
        self.pool.submit(self._run, job)
        return job

    def get(self, job_id: str) -> Job:
        if not JOB_ID_RE.match(job_id or ""):
            raise ClipError("not_found", status=404)
        with self.lock:
            job = self.jobs.get(job_id)
        if not job:
            raise ClipError("not_found", status=404)
        return job

    def cancel(self, job_id: str) -> Job:
        job = self.get(job_id)
        job.cancel_event.set()
        if job.status == "queued":
            self._finish(job, "cancelled")
        return job

    def _finish(self, job: Job, status: str, error: str | None = None, detail: str | None = None) -> None:
        job.status = status
        job.stage = status
        job.error = error
        job.detail = detail
        job.finished = time.time()
        if status != "done":
            shutil.rmtree(job.directory, ignore_errors=True)

    def _janitor(self) -> None:
        while True:
            time.sleep(30)
            now = time.time()
            with self.lock:
                expired = [j for j in self.jobs.values() if j.finished and now - j.finished > settings.file_ttl]
                for job in expired:
                    self.jobs.pop(job.id, None)
            for job in expired:
                shutil.rmtree(job.directory, ignore_errors=True)

    def _purge_orphans(self) -> None:
        """Al arrancar, borra restos de ejecuciones anteriores (solo carpetas propias)."""
        for child in settings.download_dir.iterdir():
            if child.is_dir() and JOB_ID_RE.match(child.name):
                shutil.rmtree(child, ignore_errors=True)

    # ---- ejecución ------------------------------------------------------- #
    def _run(self, job: Job) -> None:
        if job.cancel_event.is_set():
            return
        job.status = "running"
        job.stage = "preparing"
        logger = _QuietLogger()
        try:
            job.directory.mkdir(parents=True, exist_ok=True)
            self._download(job, logger)
            if job.cancel_event.is_set():
                raise Cancelled()
            self._postprocess(job)
            self._finish(job, "done")
        except Cancelled:
            self._finish(job, "cancelled")
        except ClipError as exc:
            if job.cancel_event.is_set():
                self._finish(job, "cancelled")
            else:
                self._finish(job, "error", exc.code, exc.detail)
        except Exception as exc:  # noqa: BLE001
            if job.cancel_event.is_set():
                self._finish(job, "cancelled")
            else:
                message = f"{exc} {' '.join(logger.messages[-3:])}"
                log.warning("job %s failed: %s", job.id, message[:300])
                self._finish(job, "error", classify_error(message), message)

    def _options_for(self, job: Job, logger: _QuietLogger) -> dict[str, Any]:
        opts = base_options(logger)
        opts.update({
            "paths": {"home": str(job.directory), "temp": str(job.directory)},
            "outtmpl": {"default": "media.%(ext)s"},
            "progress_hooks": [lambda d: self._on_progress(job, d)],
            "postprocessor_hooks": [lambda d: self._on_postprocess(job, d)],
        })
        if job.item > 1:
            opts["playlist_items"] = str(job.item)
        wm = "[format_note!*=?watermark]" if job.platform == "tiktok" else ""
        if job.mode == "audio":
            codec = job.audio_format
            opts["format"] = "ba[acodec^=mp4a]/ba/b" if codec == "m4a" else f"ba/b{wm}/b"
            opts["format_sort"] = ["acodec:aac"] if codec == "m4a" else []
            pp: list[dict[str, Any]] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": codec,
                "preferredquality": job.audio_quality if codec == "mp3" else "256",
            }]
            if codec in ("mp3", "m4a"):
                pp.append({"key": "FFmpegMetadata", "add_metadata": True})
            opts["postprocessors"] = pp
        else:
            q = job.quality or settings.max_height
            q = min(q, settings.max_height)
            opts["format"] = f"bv*{wm}+ba[acodec^=mp4a]/bv*{wm}+ba/b{wm}/bv*+ba/b"
            # Resolución primero; a igual resolución prefiere H.264 + AAC (compatibles con todo)
            opts["format_sort"] = [f"res:{q}", "fps", "vcodec:h264", "acodec:aac"]
            opts["merge_output_format"] = "mp4"
            # Entrega siempre .mp4 (cambia el contenedor sin recomprimir: cero pérdida)
            opts["postprocessors"] = [{"key": "FFmpegVideoRemuxer", "preferedformat": "mp4"}]
        return opts

    def _download(self, job: Job, logger: _QuietLogger) -> None:
        opts = self._options_for(job, logger)
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(job.url, download=False)
                if not info:
                    raise ClipError(classify_error(" ".join(logger.messages)))
                entry, _ = _pick_entry(info, 1)
                if entry.get("is_live"):
                    raise ClipError("live")
                duration = entry.get("duration") or 0
                if duration and duration > settings.max_duration:
                    raise ClipError("too_long")
                job.title = (entry.get("title") or "").strip()[:200] or None
                requested = entry.get("requested_formats") or [entry]
                job._parts = max(1, len(requested))
                job.watermark = any(_is_watermarked(f) for f in requested) if job.platform == "tiktok" else None
                estimate = sum(_estimate_size(f, duration) or 0 for f in requested)
                if estimate > settings.max_filesize_mb * 1024 * 1024 * 1.1:
                    raise ClipError("too_large")
                vcodec = next((f.get("vcodec") for f in requested if f.get("vcodec") not in (None, "none")), None)
                job._download_weight = 0.55 if (job.mode == "video" and job.h264 and _codec_name(vcodec) != "H.264" and settings.allow_convert) else 0.92
                job.stage = "downloading"
                ydl.process_ie_result(entry, download=True)
        except (DownloadError, ExtractorError) as exc:
            if job.cancel_event.is_set():
                raise Cancelled() from exc
            raise ClipError(classify_error(f"{exc} {' '.join(logger.messages[-3:])}"), str(exc)) from exc

        if not self._find_output(job):
            msg = " ".join(logger.messages[-5:])
            raise ClipError(classify_error(msg) if msg else "failed", msg)

    # ---- progreso -------------------------------------------------------- #
    def _on_progress(self, job: Job, d: dict) -> None:
        if job.cancel_event.is_set():
            raise Cancelled()
        name = d.get("filename") or d.get("tmpfilename") or ""
        if name and name not in job._seen:
            job._seen.add(name)
            job._part_index = len(job._seen) - 1
        if d.get("status") == "downloading":
            done = d.get("downloaded_bytes") or 0
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            frac = (done / total) if total else 0.0
            if not total and d.get("fragment_count"):
                frac = (d.get("fragment_index") or 0) / d["fragment_count"]
            overall = (min(job._part_index, job._parts - 1) + min(frac, 1.0)) / job._parts
            job.progress = overall * job._download_weight
            job.downloaded = int(done)
            job.total = int(total) if total else None
            job.speed = d.get("speed")
            job.eta = d.get("eta")
            job.stage = "downloading_audio" if (job._parts > 1 and job._part_index >= 1) or job.mode == "audio" else "downloading"
        elif d.get("status") == "finished":
            job.progress = ((min(job._part_index, job._parts - 1) + 1) / job._parts) * job._download_weight

    def _on_postprocess(self, job: Job, d: dict) -> None:
        if job.cancel_event.is_set():
            raise Cancelled()
        if d.get("status") != "started":
            return
        name = d.get("postprocessor") or ""
        if name == "Merger":
            job.stage = "merging"
        elif name == "ExtractAudio":
            job.stage = "extracting_audio"
        job.speed = None
        job.eta = None

    # ---- posproceso propio: H.264 + verificación ------------------------- #
    def _find_output(self, job: Job) -> Path | None:
        candidates = [
            p for p in job.directory.iterdir()
            if p.is_file() and p.suffix.lower().lstrip(".") in MEDIA_TYPES and not p.name.endswith((".part", ".ytdl", ".temp"))
            and ".temp." not in p.name and not re.search(r"\.f\d+\.", p.name)
        ] if job.directory.exists() else []
        if not candidates:
            return None
        job.file_path = max(candidates, key=lambda p: p.stat().st_size)
        return job.file_path

    def _postprocess(self, job: Job) -> None:
        path = self._find_output(job)
        if not path:
            raise ClipError("failed")
        probe = probe_media(path)
        if job.mode == "video" and job.h264 and settings.allow_convert and probe.get("video") != "h264":
            job.stage = "converting"
            path = convert_to_h264(path, probe, job, lambda frac: setattr(job, "progress", job._download_weight + frac * (0.97 - job._download_weight)))
            job.file_path = path
            probe = probe_media(path)

        job.stage = "verifying"
        job.progress = max(job.progress, 0.97)
        ext = path.suffix.lower().lstrip(".")
        if ext not in MEDIA_TYPES:
            raise ClipError("invalid_media")
        if job.mode == "video" and not probe.get("video"):
            raise ClipError("invalid_media")
        if job.mode == "audio" and not probe.get("audio"):
            raise ClipError("invalid_media")

        pretty = {"h264": "H.264", "hevc": "H.265", "vp9": "VP9", "av1": "AV1", "aac": "AAC", "opus": "Opus", "mp3": "MP3", "pcm_s16le": "WAV"}
        parts = [pretty.get(probe.get("video") or "", probe.get("video")), pretty.get(probe.get("audio") or "", probe.get("audio"))]
        job.codecs = " + ".join(p for p in parts if p) or None
        suffix = ""
        if job.mode == "video" and probe.get("height"):
            suffix = f" ({probe['height']}p)"
        job.download_name = f"{safe_filename(job.title)}{suffix}.{ext}"
        job.media_type = MEDIA_TYPES[ext]
        job.size = path.stat().st_size
        job.speed = None
        job.eta = None
        job.progress = 1.0


def probe_media(path: Path) -> dict[str, Any]:
    """Usa FFprobe para confirmar que el archivo es audio/video real."""
    if not FFPROBE:
        raise ClipError("ffmpeg_missing", status=500)
    try:
        out = subprocess.run(
            [FFPROBE, "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height:format=duration,format_name", "-of", "json", str(path)],
            capture_output=True, text=True, timeout=60, check=True,
        ).stdout
        data = json.loads(out or "{}")
    except (subprocess.SubprocessError, json.JSONDecodeError) as exc:
        raise ClipError("invalid_media", str(exc)) from exc
    result: dict[str, Any] = {"video": None, "audio": None, "height": None, "duration": None}
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video" and stream.get("codec_name") not in ("mjpeg", "png") and not result["video"]:
            result["video"] = stream.get("codec_name")
            w, h = stream.get("width"), stream.get("height")
            result["height"] = min(w, h) if w and h else h
        elif stream.get("codec_type") == "audio" and not result["audio"]:
            result["audio"] = stream.get("codec_name")
    try:
        result["duration"] = float(data.get("format", {}).get("duration") or 0) or None
    except ValueError:
        pass
    if not result["video"] and not result["audio"]:
        raise ClipError("invalid_media")
    return result


def convert_to_h264(src: Path, probe: dict, job: Job, on_progress: Callable[[float], None]) -> Path:
    """Convierte VP9/AV1/H.265 a H.264 + AAC para Premiere, CapCut, iPhone, etc."""
    if not FFMPEG:
        raise ClipError("ffmpeg_missing", status=500)
    dst = src.with_name("media.h264.mp4")
    audio = ["-c:a", "copy"] if probe.get("audio") == "aac" else ["-c:a", "aac", "-b:a", "256k"]
    cmd = [
        FFMPEG, "-hide_banner", "-nostdin", "-y", "-i", str(src),
        "-map", "0:v:0", "-map", "0:a:0?",
        "-c:v", "libx264", "-preset", os.environ.get("CM_X264_PRESET", "veryfast"), "-crf", "18",
        "-pix_fmt", "yuv420p", *audio, "-movflags", "+faststart",
        "-progress", "pipe:1", "-nostats", str(dst),
    ]
    duration = probe.get("duration") or 0
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        assert proc.stdout is not None
        for line in proc.stdout:
            if job.cancel_event.is_set():
                proc.kill()
                raise Cancelled()
            if line.startswith("out_time_us=") and duration:
                try:
                    on_progress(min(int(line.split("=", 1)[1]) / 1_000_000 / duration, 1.0))
                except ValueError:
                    pass
        proc.wait(timeout=30)
    finally:
        if proc.poll() is None:
            proc.kill()
    if proc.returncode != 0 or not dst.exists():
        raise ClipError("convert_failed")
    src.unlink(missing_ok=True)
    return dst


manager: JobManager | None = None


def get_manager() -> JobManager:
    global manager
    if manager is None:
        manager = JobManager()
    return manager
