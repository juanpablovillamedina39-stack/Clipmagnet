"""API web de CLIPMAGNET.

Arranque local:   python -m uvicorn app.main:app --port 8000   (desde /server)
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError
from starlette.concurrency import run_in_threadpool

from .config import VERSION, settings
from .downloader import ClipError, analyze, fetch_thumbnail, get_manager, tools_status
from .security import InvalidURL, RateLimiter, detect_platform, normalize_url

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")



@asynccontextmanager
async def lifespan(_: FastAPI):
    get_manager()
    status = tools_status()
    logging.getLogger("clipmagnet").info(
        "CLIPMAGNET %s listo · yt-dlp %s · ffmpeg %s · motor JS %s",
        VERSION, status["ytdlp"], "sí" if status["ffmpeg"] else "NO", status["js_runtime"] or "NINGUNO",
    )
    yield


app = FastAPI(title="CLIPMAGNET", version=VERSION, docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
limiter = RateLimiter(settings.rate_limit_per_minute)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
    expose_headers=["Content-Disposition", "Content-Length"],
    max_age=600,
)


def _csp() -> str:
    script = " ".join(filter(None, ["'self'", settings.csp_extra_script]))
    frame = " ".join(filter(None, ["'none'" if not settings.csp_extra_frame else "", settings.csp_extra_frame]))
    return (
        "default-src 'self'; "
        f"script-src {script}; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob: https:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "media-src 'self' blob:; "
        f"frame-src {frame}; "
        "object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    )


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    else:
        response.headers.setdefault("Content-Security-Policy", _csp())
    return response


@app.exception_handler(ClipError)
async def clip_error_handler(_: Request, exc: ClipError):
    return JSONResponse({"error": exc.code}, status_code=exc.status)


@app.exception_handler(InvalidURL)
async def invalid_url_handler(_: Request, exc: InvalidURL):
    return JSONResponse({"error": str(exc)}, status_code=400)


@app.exception_handler(RequestValidationError)
@app.exception_handler(ValidationError)
async def validation_handler(_: Request, __: Exception):
    return JSONResponse({"error": "invalid_request"}, status_code=422)


def _client_ip(request: Request) -> str:
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate(request: Request) -> None:
    if not limiter.allow(_client_ip(request)):
        raise ClipError("rate_limited", status=429)


class InfoRequest(BaseModel):
    url: str = Field(min_length=4, max_length=2048)
    item: int = Field(1, ge=1, le=50)


class JobRequest(BaseModel):
    url: str = Field(min_length=4, max_length=2048)
    item: int = Field(1, ge=1, le=50)
    mode: Literal["video", "audio"] = "video"
    quality: int | None = Field(None, ge=100, le=4320)
    audio_format: Literal["mp3", "m4a", "wav"] = "mp3"
    audio_quality: Literal["320", "192", "128"] = "320"
    h264: bool = False


@app.get("/api/health")
def health():
    return {"ok": True, "name": "CLIPMAGNET", "version": VERSION, **tools_status(),
            "limits": {"max_duration": settings.max_duration, "max_height": settings.max_height,
                       "file_ttl": settings.file_ttl, "convert": settings.allow_convert}}


@app.post("/api/info")
async def info(body: InfoRequest, request: Request):
    _check_rate(request)
    detect_platform(body.url)
    data = await run_in_threadpool(analyze, body.url, body.item)
    return data


@app.post("/api/jobs", status_code=201)
async def create_job(body: JobRequest, request: Request):
    _check_rate(request)
    platform = detect_platform(body.url)
    job = get_manager().create(
        url=normalize_url(body.url), platform=platform, mode=body.mode, quality=body.quality,
        audio_format=body.audio_format, audio_quality=body.audio_quality, h264=body.h264, item=body.item,
    )
    return job.public()


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str):
    return get_manager().get(job_id).public()


@app.delete("/api/jobs/{job_id}")
def cancel_job(job_id: str):
    return get_manager().cancel(job_id).public()


@app.get("/api/jobs/{job_id}/file")
def job_file(job_id: str):
    job = get_manager().get(job_id)
    if job.status != "done" or not job.file_path or not job.file_path.exists():
        raise ClipError("not_ready", status=409)
    return FileResponse(
        job.file_path,
        media_type=job.media_type or "application/octet-stream",
        filename=job.download_name or job.file_path.name,
        content_disposition_type="attachment",
    )


@app.get("/api/thumb/{token}")
async def thumbnail(token: str):
    if not token.replace("-", "").replace("_", "").isalnum() or len(token) > 64:
        raise ClipError("not_found", status=404)
    data, ctype = await run_in_threadpool(fetch_thumbnail, token)
    return Response(content=data, media_type=ctype, headers={"Cache-Control": "private, max-age=600"})


# La web estática se sirve en "/" (debe montarse al final, después de la API)
if settings.web_dir.is_dir():
    app.mount("/", StaticFiles(directory=settings.web_dir, html=True), name="web")
