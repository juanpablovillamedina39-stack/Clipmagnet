"""Configuración de CLIPMAGNET leída desde variables de entorno.

Todas las variables empiezan por ``CM_`` y tienen valores por defecto seguros
para uso personal en tu computadora. Para un servidor público revisa
``.env.example`` y la guía de despliegue del README.
"""
from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

VERSION = "1.0.0"


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "si", "sí", "on"}


def _list(name: str, default: str) -> list[str]:
    raw = os.environ.get(name, default)
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    # Orígenes web que pueden usar la API (CORS). Si sirves la web desde el
    # mismo servidor no necesitas tocarlo. Para GitHub Pages añade
    # https://TU-USUARIO.github.io
    allowed_origins: list[str] = field(
        default_factory=lambda: _list(
            "CM_ALLOWED_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000"
        )
    )
    # Límites para proteger el servidor
    max_duration: int = _int("CM_MAX_DURATION", 3 * 60 * 60)  # segundos
    max_filesize_mb: int = _int("CM_MAX_FILESIZE_MB", 4096)
    max_height: int = _int("CM_MAX_HEIGHT", 4320)  # 4320 = 8K
    max_concurrent: int = max(1, _int("CM_MAX_CONCURRENT", 2))
    max_queue: int = max(1, _int("CM_MAX_QUEUE", 20))
    rate_limit_per_minute: int = _int("CM_RATE_LIMIT", 30)
    file_ttl: int = max(60, _int("CM_FILE_TTL", 15 * 60))  # segundos
    allow_convert: bool = _bool("CM_ALLOW_CONVERT", True)
    # Red
    proxy: str | None = os.environ.get("CM_PROXY") or None
    cookies_file: str | None = os.environ.get("CM_COOKIES_FILE") or None
    trust_proxy_headers: bool = _bool("CM_TRUST_PROXY_HEADERS", False)
    # Carpeta temporal de trabajo
    download_dir: Path = Path(
        os.environ.get("CM_DOWNLOAD_DIR")
        or Path(tempfile.gettempdir()) / "clipmagnet"
    )
    # Carpeta de la web estática (se sirve en "/")
    web_dir: Path = Path(
        os.environ.get("CM_WEB_DIR")
        or Path(__file__).resolve().parents[2] / "web"
    )
    # Cabecera Content-Security-Policy adicional (p. ej. dominios de anuncios)
    csp_extra_script: str = os.environ.get("CM_CSP_EXTRA_SCRIPT", "")
    csp_extra_frame: str = os.environ.get("CM_CSP_EXTRA_FRAME", "")


settings = Settings()
