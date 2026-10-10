#!/usr/bin/env bash
# CLIPMAGNET · lanzador para Linux   →   bash start-linux.sh
cd "$(dirname "$0")" || exit 1
PORT="${CM_PORT:-8000}"
command -v python3 >/dev/null || { echo "Falta Python 3 (sudo apt install python3 python3-venv)"; exit 1; }
command -v ffmpeg  >/dev/null || { echo "Falta FFmpeg (sudo apt install ffmpeg)"; exit 1; }
command -v deno >/dev/null || command -v node >/dev/null || echo "Aviso: instala Deno (https://deno.com) para descargar de YouTube."
[ -d .venv ] || python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --quiet --disable-pip-version-check --upgrade -r server/requirements.txt
( sleep 2; xdg-open "http://127.0.0.1:${PORT}" >/dev/null 2>&1 ) &
cd server && exec python -m uvicorn app.main:app --host 127.0.0.1 --port "${PORT}" --log-level warning
