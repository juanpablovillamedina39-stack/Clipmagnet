# Seguridad en CLIPMAGNET

La mayoría de las webs de descarga se financian con ventanas emergentes, botones falsos y "instaladores" que esconden malware. CLIPMAGNET está construido para que eso sea imposible por diseño, no por promesa.

## Lo que garantiza el código

**Nunca entrega ejecutables.** El servidor solo puede devolver archivos con estas extensiones: `mp4`, `webm`, `mkv`, `m4a`, `mp3`, `wav`, `opus` (lista blanca en `server/app/security.py`). Antes de entregar cualquier archivo, **FFprobe lo abre y confirma que contiene audio o video real**; si no, se descarta (`invalid_media`). Hay una prueba automática que intenta colar un archivo falso y comprueba que se rechaza.

**Solo habla con 4 plataformas.** Los enlaces se validan contra una lista blanca de dominios (TikTok, Instagram, Facebook, YouTube). Se rechazan IP directas, `localhost`, puertos raros, credenciales embebidas y esquemas como `file://`. Además, en yt-dlp solo están activados los extractores de esas plataformas; el extractor "genérico", que podría visitar cualquier web, está desactivado. Esto evita que alguien use tu servidor para atacar otros sitios (SSRF).

**Nombres de archivo inofensivos.** El título del video se limpia de rutas (`../`), caracteres reservados y nombres prohibidos de Windows antes de usarse como nombre de descarga.

**Nada se queda guardado.** Cada descarga vive en su propia carpeta temporal con un identificador aleatorio imposible de adivinar, y se borra a los 15 minutos (`CM_FILE_TTL`). Al reiniciar, se limpian los restos. No hay base de datos, cuentas ni cookies de seguimiento, y los enlaces no se escriben en los registros.

**Navegador blindado.** La web envía cabeceras de seguridad: `Content-Security-Policy` estricta (sin scripts de terceros, sin scripts en línea), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` y `Permissions-Policy`. Las miniaturas pasan por el servidor para que tu navegador no se conecte a terceros. Las tipografías están incluidas en el proyecto (sin Google Fonts).

**Protección contra abuso.** Límite de peticiones por minuto por IP, cola máxima, descargas simultáneas limitadas, duración y tamaño máximos configurables.

**Contenedor sin privilegios.** La imagen Docker corre con un usuario sin permisos de administrador; `docker-compose.yml` además monta el sistema en solo lectura y elimina todas las capacidades del sistema.

## Lo que vigila GitHub por ti

- **Pruebas automáticas** en cada cambio (`.github/workflows/ci.yml`), incluidas las de seguridad.
- **pip-audit** revisa cada semana si alguna dependencia tiene vulnerabilidades conocidas.
- **CodeQL** analiza el código Python y JavaScript en busca de fallos de seguridad.
- **Dependabot** propone actualizar yt-dlp y el resto de dependencias.

Activa también en tu repositorio: **Settings → Code security → Secret scanning** y **Dependabot alerts**.

## Buenas prácticas al publicarlo

- No subas nunca a GitHub un archivo de cookies ni el `.env` (ya están en `.gitignore`).
- Si usas cookies para YouTube, que sean de una cuenta secundaria.
- Si añades anuncios, evita redes con ventanas emergentes o redirecciones: rompen la promesa principal de la herramienta. Cualquier dominio nuevo debe añadirse explícitamente a la CSP (`CM_CSP_EXTRA_SCRIPT`).
- Publica siempre desde el código del repositorio (Docker o el lanzador), nunca distribuyas un `.exe` que no hayas compilado tú.

## Reportar un problema

Si encuentras una vulnerabilidad, no abras un issue público: usa **Security → Report a vulnerability** en el repositorio de GitHub.
