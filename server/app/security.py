"""Capa de seguridad: validación de enlaces, límite de peticiones y nombres de archivo.

La regla de oro: CLIPMAGNET solo habla con TikTok, Instagram, Facebook y
YouTube, y solo entrega archivos de audio o video verificados.
"""
from __future__ import annotations

import ipaddress
import re
import threading
import time
import unicodedata
from collections import defaultdict, deque
from urllib.parse import urlsplit

# Dominios permitidos por plataforma (se aceptan subdominios: www., m., vm., …)
PLATFORM_DOMAINS: dict[str, tuple[str, ...]] = {
    "tiktok": ("tiktok.com",),
    "instagram": ("instagram.com", "instagr.am"),
    "facebook": ("facebook.com", "fb.watch", "fb.com"),
    "youtube": ("youtube.com", "youtu.be", "youtube-nocookie.com"),
}

# Extractores de yt-dlp habilitados. Todo lo demás (incluido el extractor
# "genérico", que podría visitar cualquier web) queda desactivado.
ALLOWED_EXTRACTORS: list[str] = [
    "youtube",
    "youtube:clip",
    "YoutubeYtBe",
    "TikTok",
    "vm.tiktok",
    "Instagram",
    "InstagramIOS",
    "facebook",
    "facebook:reel",
    "FacebookPluginsVideo",
]

# Únicos formatos que el servidor entregará jamás.
MEDIA_TYPES: dict[str, str] = {
    "mp4": "video/mp4",
    "webm": "video/webm",
    "mkv": "video/x-matroska",
    "m4a": "audio/mp4",
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "opus": "audio/ogg",
}

MAX_URL_LENGTH = 2048


class InvalidURL(ValueError):
    """El enlace no es válido o no es de una plataforma soportada."""


def detect_platform(url: str) -> str:
    """Valida el enlace y devuelve la plataforma.

    Rechaza esquemas que no sean http/https, credenciales embebidas, puertos
    raros, direcciones IP y cualquier dominio fuera de la lista blanca.
    """
    if not isinstance(url, str):
        raise InvalidURL("invalid_url")
    url = url.strip()
    if not url or len(url) > MAX_URL_LENGTH or any(ord(c) < 32 for c in url):
        raise InvalidURL("invalid_url")
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError as exc:
        raise InvalidURL("invalid_url") from exc
    if parts.scheme.lower() not in {"http", "https"}:
        raise InvalidURL("invalid_url")
    if parts.username or parts.password:
        raise InvalidURL("invalid_url")
    if port not in (None, 80, 443):
        raise InvalidURL("invalid_url")
    host = (parts.hostname or "").lower().rstrip(".")
    if not host:
        raise InvalidURL("invalid_url")
    try:
        ipaddress.ip_address(host)
        raise InvalidURL("unsupported_platform")
    except ValueError:
        pass
    for platform, domains in PLATFORM_DOMAINS.items():
        for domain in domains:
            if host == domain or host.endswith("." + domain):
                return platform
    raise InvalidURL("unsupported_platform")


def normalize_url(url: str) -> str:
    url = url.strip()
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    return url


def safe_filename(title: str | None, fallback: str = "clipmagnet") -> str:
    """Convierte el título del video en un nombre de archivo inofensivo."""
    text = unicodedata.normalize("NFKC", title or "")
    text = re.sub(r"[\x00-\x1f\x7f]", "", text)
    text = re.sub(r'[\\/:*?"<>|#%{}$!`@=+^~\[\]]', " ", text)
    text = re.sub(r"https?\S+", "", text)
    text = re.sub(r"\s+", " ", text).strip(" .-_")
    # Evita nombres reservados de Windows
    if text.upper() in {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(10)), *(f"LPT{i}" for i in range(10))}:
        text = ""
    text = text[:90].rstrip(" .")
    return text or fallback


class RateLimiter:
    """Ventana deslizante en memoria: N peticiones por minuto por IP."""

    def __init__(self, per_minute: int) -> None:
        self.per_minute = per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        if self.per_minute <= 0:
            return True
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > 60:
                hits.popleft()
            if len(hits) >= self.per_minute:
                return False
            hits.append(now)
            if len(self._hits) > 10_000:  # evita crecer sin límite
                for k in [k for k, v in self._hits.items() if not v][:5000]:
                    self._hits.pop(k, None)
            return True
