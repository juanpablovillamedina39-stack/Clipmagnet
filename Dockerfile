# CLIPMAGNET · imagen para servidor (Render, Railway, Fly.io, VPS…)
# Deno: motor JavaScript que yt-dlp necesita para YouTube (versión 2.3 o superior)
FROM denoland/deno:bin-2.9.7 AS deno

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    CM_DOWNLOAD_DIR=/tmp/clipmagnet \
    DENO_DIR=/tmp/deno \
    XDG_CACHE_HOME=/tmp/.cache \
    PORT=8000

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY --from=deno /deno /usr/local/bin/deno

WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install -r server/requirements.txt

COPY server server
COPY web web

# Usuario sin privilegios: aunque algo fallara, no puede tocar el sistema
RUN useradd --create-home --uid 10001 clipmagnet \
 && mkdir -p /tmp/clipmagnet && chown clipmagnet /tmp/clipmagnet
USER clipmagnet

WORKDIR /app/server
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/api/health',timeout=4)"
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
