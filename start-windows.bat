@echo off
REM =====================================================================
REM  CLIPMAGNET - lanzador para Windows (doble clic)
REM =====================================================================
chcp 65001 >nul
title CLIPMAGNET
cd /d "%~dp0"
set PORT=8000
echo.
echo   CLIPMAGNET
echo   ----------

REM 1) Python
set PY=
where py >nul 2>nul && set PY=py -3
if not defined PY (where python >nul 2>nul && set PY=python)
if not defined PY (
  echo   X Falta Python 3. Descargalo de https://www.python.org/downloads/
  echo     Durante la instalacion marca "Add python.exe to PATH".
  pause & exit /b 1
)

REM 2) FFmpeg y Deno con winget (incluido en Windows 10/11)
set NEED_RESTART=
where ffmpeg >nul 2>nul || (
  echo   ^> Instalando FFmpeg ^(solo la primera vez^)...
  winget install --id Gyan.FFmpeg -e --silent --accept-source-agreements --accept-package-agreements
  set NEED_RESTART=1
)
where deno >nul 2>nul || (
  echo   ^> Instalando Deno ^(solo la primera vez^)...
  winget install --id DenoLand.Deno -e --silent --accept-source-agreements --accept-package-agreements
  set NEED_RESTART=1
)
if defined NEED_RESTART (
  echo.
  echo   Listo. Cierra esta ventana y vuelve a abrir start-windows.bat
  pause & exit /b 0
)

REM 3) Entorno aislado de Python
if not exist .venv (
  echo   ^> Preparando el entorno ^(solo la primera vez^)...
  %PY% -m venv .venv || (pause & exit /b 1)
)
call .venv\Scripts\activate.bat
echo   ^> Buscando actualizaciones del motor de descarga...
python -m pip install --quiet --disable-pip-version-check --upgrade -r server\requirements.txt || (pause & exit /b 1)

REM 4) Arranque (solo accesible desde esta computadora)
echo   OK. Abriendo http://127.0.0.1:%PORT%
echo   Deja esta ventana abierta mientras uses CLIPMAGNET.
echo.
start "" cmd /c "timeout /t 3 >nul & start http://127.0.0.1:%PORT%"
cd server
python -m uvicorn app.main:app --host 127.0.0.1 --port %PORT% --log-level warning
pause
