#!/bin/bash
# =====================================================================
#  CLIPMAGNET · lanzador para macOS
#  Doble clic para abrir. Si macOS lo bloquea: clic derecho → Abrir.
#  (o en Terminal:  bash start-mac.command)
# =====================================================================
cd "$(dirname "$0")" || exit 1
PORT="${CM_PORT:-8000}"

echo ""
echo "  CLIPMAGNET"
echo "  ──────────"

pause_exit() { echo ""; read -r -p "  Presiona Enter para cerrar…" _; exit 1; }

# 1) Python 3.10+
if ! command -v python3 >/dev/null 2>&1; then
  echo "  ✗ Falta Python 3. Descárgalo de https://www.python.org/downloads/ y vuelve a abrir este archivo."
  pause_exit
fi

# 2) FFmpeg y motor JavaScript (Deno) con Homebrew
missing=()
command -v ffmpeg >/dev/null 2>&1 || missing+=(ffmpeg)
command -v deno   >/dev/null 2>&1 || missing+=(deno)
if [ ${#missing[@]} -gt 0 ]; then
  if command -v brew >/dev/null 2>&1; then
    echo "  → Instalando ${missing[*]} con Homebrew (solo la primera vez)…"
    brew install "${missing[@]}" || pause_exit
  else
    echo "  ✗ Faltan: ${missing[*]}"
    echo "    1. Instala Homebrew desde https://brew.sh"
    echo "    2. En Terminal ejecuta:  brew install ${missing[*]}"
    echo "    3. Vuelve a abrir este archivo."
    pause_exit
  fi
fi

# 3) Entorno aislado de Python (no toca el resto de tu Mac)
if [ ! -d .venv ]; then
  echo "  → Preparando el entorno (solo la primera vez)…"
  python3 -m venv .venv || pause_exit
fi
# shellcheck disable=SC1091
source .venv/bin/activate
echo "  → Buscando actualizaciones del motor de descarga…"
python -m pip install --quiet --disable-pip-version-check --upgrade pip >/dev/null 2>&1
python -m pip install --quiet --disable-pip-version-check --upgrade -r server/requirements.txt || pause_exit

# 4) Arranque (solo accesible desde esta computadora)
echo "  ✓ Listo. Abriendo http://127.0.0.1:${PORT}"
echo "    Deja esta ventana abierta mientras uses CLIPMAGNET. Ciérrala para apagarlo."
echo ""
( sleep 2; open "http://127.0.0.1:${PORT}" ) &
cd server && exec python -m uvicorn app.main:app --host 127.0.0.1 --port "${PORT}" --log-level warning
