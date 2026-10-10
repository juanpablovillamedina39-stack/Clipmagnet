/* CLIPMAGNET · textos en español e inglés */
(function () {
  const dict = {
    es: {
      "skip": "Ir al descargador",
      "nav.how": "Cómo funciona", "nav.platforms": "Plataformas", "nav.security": "Seguridad", "nav.faq": "Preguntas",
      "hero.title": "Pega el enlace.<br>Llévate el video.",
      "hero.sub": "Descarga de TikTok sin marca de agua, Instagram, Facebook y YouTube en la mejor calidad disponible, o quédate solo con el audio.",
      "form.label": "Enlace del video", "form.placeholder": "Pega aquí el enlace del video", "form.paste": "Pegar", "form.submit": "Ver calidades",
      "result.items": "Video de la publicación", "result.video": "Video", "result.audio": "Solo audio",
      "result.quality": "Calidad", "result.format": "Formato", "result.h264": "Convertir a H.264",
      "result.best": "Máxima", "result.bestAvailable": "Mejor disponible", "result.auto": "Automática",
      "h264.hint": "Esta calidad viene en {codec}. Actívalo si tu editor no la abre (Premiere, CapCut, iPhone). Tarda más.",
      "h264.hintTikTok": "Actívalo si tu editor no abre el archivo. Tarda un poco más.",
      "audio.mp3": "El más compatible", "audio.mp3light": "Más liviano", "audio.original": "Original", "audio.m4a": "Sin recomprimir",
      "audio.wavtag": "Sin pérdida", "audio.wav": "Para editar",
      "download.video": "Descargar {q}", "download.videoBest": "Descargar video", "download.audio": "Descargar {f}",
      "progress.cancel": "Cancelar",
      "stage.queued": "En cola…", "stage.preparing": "Preparando…", "stage.downloading": "Descargando video",
      "stage.downloading_audio": "Descargando audio", "stage.merging": "Uniendo audio y video",
      "stage.extracting_audio": "Extrayendo el audio", "stage.converting": "Convirtiendo a H.264",
      "stage.verifying": "Verificando el archivo", "stage.done": "Listo",
      "progress.speed": "{speed}/s · quedan {eta}", "progress.speedOnly": "{speed}/s",
      "done.title": "Tu archivo está listo", "done.save": "Guardar archivo", "done.again": "Descargar otro",
      "done.note": "Si la descarga no empezó sola, toca Guardar archivo. Se borra del servidor en {min} min.",
      "done.watermark": "Esta publicación de TikTok solo estaba disponible con marca de agua.",
      "done.demo": "Vista previa del diseño: en este modo no se descarga ningún archivo.",
      "recent.title": "Recientes", "recent.clear": "Borrar",
      "engine.checking": "Conectando con el motor…", "engine.ok": "Motor listo", "engine.off": "Motor desconectado",
      "engine.noJs": "Motor listo (instala Deno para YouTube)", "engine.demo": "Modo demostración",
      "how.title": "Tres pasos, sin registro",
      "how.s1": "Copia el enlace", "how.s1p": "En la app, toca Compartir y luego Copiar enlace.",
      "how.s2": "Elige calidad o audio", "how.s2p": "Verás todas las resoluciones disponibles, de 360p hasta 8K, con su peso aproximado.",
      "how.s3": "Descarga", "how.s3p": "El archivo llega a tu carpeta de descargas, listo para editar o publicar.",
      "plat.title": "Dónde funciona", "plat.upto": "hasta",
      "plat.tiktok": "Videos sin marca de agua, en la resolución original del creador.",
      "plat.instagram": "Reels y videos de publicaciones públicas, incluidos los carruseles.",
      "plat.facebook": "Videos y reels públicos, en HD cuando la publicación lo tiene.",
      "plat.youtube": "Videos y Shorts hasta 8K y 60 fps, con conversión a H.264 si tu editor la necesita.",
      "sec.title": "Seguro por diseño",
      "sec.intro": "Las páginas de descarga suelen estar llenas de anuncios engañosos y archivos sospechosos. CLIPMAGNET está construido al revés.",
      "sec.1": "Solo audio y video", "sec.1p": "Cada archivo se revisa con FFprobe antes de entregarse. Si no es un MP4, M4A, MP3 o WAV real, se descarta.",
      "sec.2": "Cero ventanas emergentes", "sec.2p": "Sin redirecciones, sin botones falsos de descarga y sin extensiones que instalar.",
      "sec.3": "Nada se queda guardado", "sec.3p": "Los archivos se borran del servidor a los 15 minutos. No pedimos cuenta ni guardamos tus enlaces.",
      "sec.4": "Solo plataformas conocidas", "sec.4p": "El motor únicamente se conecta a TikTok, Instagram, Facebook y YouTube. Cualquier otro enlace se rechaza.",
      "sec.5": "Código abierto", "sec.5p": "Todo el código está publicado en GitHub para que cualquiera pueda revisarlo.",
      "faq.title": "Preguntas frecuentes",
      "faq.q1": "¿Cuesta algo?", "faq.a1": "No. Descargar es gratis y no necesitas crear una cuenta.",
      "faq.q2": "¿Por qué un video de YouTube en 4K no abre en mi editor?",
      "faq.a2": "YouTube entrega 1440p, 4K y 8K en VP9 o AV1, formatos que algunos editores no leen. Activa Convertir a H.264 antes de descargar y obtendrás un MP4 compatible con Premiere, CapCut, Final Cut y iPhone.",
      "faq.q3": "¿Cómo sale TikTok sin marca de agua?",
      "faq.a3": "No se borra nada: se descarga la versión que TikTok usa para reproducir el video, que no lleva marca. Si una publicación solo existe con marca, te avisamos.",
      "faq.q4": "¿Puedo descargar videos privados?", "faq.a4": "No. CLIPMAGNET solo ve lo que vería cualquier visitante sin iniciar sesión.",
      "faq.q5": "¿Qué formato de audio elijo?",
      "faq.a5": "M4A conserva el audio original sin recomprimir. MP3 a 320 kbps es el que abre en cualquier parte. WAV es ideal para editar sin pérdida adicional.",
      "faq.q6": "¿Puedo usar cualquier video que descargue?",
      "faq.a6": "Descarga solo contenido tuyo, con licencia o con permiso de su autor. Los derechos siguen siendo de quien lo creó.",
      "footer.legal": "CLIPMAGNET es una herramienta independiente, sin relación con TikTok, Instagram, Facebook ni YouTube. Úsala solo con contenido que tengas derecho a descargar.",
      "footer.code": "Código en GitHub", "footer.credits": "Funciona con yt-dlp y FFmpeg",
      "time.now": "ahora", "time.min": "hace {n} min", "time.h": "hace {n} h", "time.d": "hace {n} d",
      "err.empty": "Pega primero el enlace de un video.",
      "err.invalid_url": "Ese enlace no parece válido. Cópialo completo desde el botón Compartir de la app.",
      "err.unsupported_platform": "Por ahora CLIPMAGNET funciona con TikTok, Instagram, Facebook y YouTube.",
      "err.private": "El video es privado. Solo se pueden descargar publicaciones públicas.",
      "err.login_required": "La plataforma pidió iniciar sesión para ver este contenido. Prueba con otra publicación pública o inténtalo en unos minutos.",
      "err.bot_check": "YouTube frenó temporalmente al servidor. Inténtalo en unos minutos o usa CLIPMAGNET en tu computadora.",
      "err.age_restricted": "El video tiene restricción de edad y no se puede descargar sin iniciar sesión.",
      "err.geo_blocked": "El video no está disponible en la región del servidor.",
      "err.live": "Las transmisiones en vivo no se pueden descargar mientras están al aire.",
      "err.too_long": "El video supera la duración máxima permitida en este servidor.",
      "err.too_large": "El archivo supera el tamaño máximo permitido en este servidor. Prueba una calidad menor.",
      "err.no_media": "No encontramos un video en esa publicación.",
      "err.unavailable": "El video ya no está disponible o fue eliminado.",
      "err.network": "No pudimos conectar con la plataforma. Revisa tu conexión e inténtalo de nuevo.",
      "err.rate_limited": "Hiciste muchas solicitudes seguidas. Espera un minuto e inténtalo de nuevo.",
      "err.busy": "El servidor está ocupado ahora mismo. Inténtalo en un momento.",
      "err.ffmpeg_missing": "Falta FFmpeg en el servidor. Revisa la guía de instalación del README.",
      "err.convert_failed": "No se pudo convertir a H.264. Descarga sin convertir o prueba otra calidad.",
      "err.invalid_media": "El archivo descargado no pasó la verificación y se descartó por seguridad.",
      "err.not_found": "Esa descarga ya expiró. Vuelve a buscar el video.",
      "err.server_offline": "No hay conexión con el motor de descarga. Si usas CLIPMAGNET en tu computadora, ábrelo con el lanzador.",
      "err.failed": "No se pudo descargar. Inténtalo de nuevo o prueba otra calidad.",
      "err.cancelled": "Descarga cancelada.",
    },
    en: {
      "skip": "Skip to downloader",
      "nav.how": "How it works", "nav.platforms": "Platforms", "nav.security": "Security", "nav.faq": "FAQ",
      "hero.title": "Paste the link.<br>Keep the video.",
      "hero.sub": "Download TikTok without watermark, Instagram, Facebook and YouTube in the best available quality, or keep just the audio.",
      "form.label": "Video link", "form.placeholder": "Paste the video link here", "form.paste": "Paste", "form.submit": "See qualities",
      "result.items": "Video in this post", "result.video": "Video", "result.audio": "Audio only",
      "result.quality": "Quality", "result.format": "Format", "result.h264": "Convert to H.264",
      "result.best": "Highest", "result.bestAvailable": "Best available", "result.auto": "Automatic",
      "h264.hint": "This quality comes as {codec}. Turn this on if your editor can't open it (Premiere, CapCut, iPhone). Takes longer.",
      "h264.hintTikTok": "Turn this on if your editor can't open the file. Takes a bit longer.",
      "audio.mp3": "Plays everywhere", "audio.mp3light": "Smaller file", "audio.original": "Original", "audio.m4a": "No re-encoding",
      "audio.wavtag": "Lossless", "audio.wav": "For editing",
      "download.video": "Download {q}", "download.videoBest": "Download video", "download.audio": "Download {f}",
      "progress.cancel": "Cancel",
      "stage.queued": "Queued…", "stage.preparing": "Getting ready…", "stage.downloading": "Downloading video",
      "stage.downloading_audio": "Downloading audio", "stage.merging": "Merging audio and video",
      "stage.extracting_audio": "Extracting audio", "stage.converting": "Converting to H.264",
      "stage.verifying": "Checking the file", "stage.done": "Done",
      "progress.speed": "{speed}/s · {eta} left", "progress.speedOnly": "{speed}/s",
      "done.title": "Your file is ready", "done.save": "Save file", "done.again": "Download another",
      "done.note": "If the download didn't start, tap Save file. It's deleted from the server in {min} min.",
      "done.watermark": "This TikTok post was only available with a watermark.",
      "done.demo": "Design preview: no file is downloaded in this mode.",
      "recent.title": "Recent", "recent.clear": "Clear",
      "engine.checking": "Connecting to the engine…", "engine.ok": "Engine ready", "engine.off": "Engine offline",
      "engine.noJs": "Engine ready (install Deno for YouTube)", "engine.demo": "Demo mode",
      "how.title": "Three steps, no sign-up",
      "how.s1": "Copy the link", "how.s1p": "In the app, tap Share, then Copy link.",
      "how.s2": "Pick quality or audio", "how.s2p": "You'll see every available resolution, from 360p up to 8K, with its approximate size.",
      "how.s3": "Download", "how.s3p": "The file lands in your downloads folder, ready to edit or post.",
      "plat.title": "Where it works", "plat.upto": "up to",
      "plat.tiktok": "Videos without watermark, at the creator's original resolution.",
      "plat.instagram": "Reels and videos from public posts, carousels included.",
      "plat.facebook": "Public videos and reels, in HD when the post has it.",
      "plat.youtube": "Videos and Shorts up to 8K and 60 fps, with H.264 conversion if your editor needs it.",
      "sec.title": "Safe by design",
      "sec.intro": "Download sites are usually full of misleading ads and suspicious files. CLIPMAGNET is built the other way around.",
      "sec.1": "Audio and video only", "sec.1p": "Every file is checked with FFprobe before it's delivered. If it isn't a real MP4, M4A, MP3 or WAV, it's discarded.",
      "sec.2": "Zero pop-ups", "sec.2p": "No redirects, no fake download buttons and no extensions to install.",
      "sec.3": "Nothing is kept", "sec.3p": "Files are deleted from the server after 15 minutes. No account, and your links aren't stored.",
      "sec.4": "Known platforms only", "sec.4p": "The engine only connects to TikTok, Instagram, Facebook and YouTube. Any other link is rejected.",
      "sec.5": "Open source", "sec.5p": "All the code is on GitHub so anyone can review it.",
      "faq.title": "Questions",
      "faq.q1": "Does it cost anything?", "faq.a1": "No. Downloading is free and you don't need an account.",
      "faq.q2": "Why won't a 4K YouTube video open in my editor?",
      "faq.a2": "YouTube serves 1440p, 4K and 8K as VP9 or AV1, which some editors can't read. Turn on Convert to H.264 before downloading to get an MP4 that works in Premiere, CapCut, Final Cut and on iPhone.",
      "faq.q3": "How does TikTok come out without a watermark?",
      "faq.a3": "Nothing is erased: you get the version TikTok uses for playback, which has no watermark. If a post only exists with one, we'll tell you.",
      "faq.q4": "Can I download private videos?", "faq.a4": "No. CLIPMAGNET only sees what any logged-out visitor would see.",
      "faq.q5": "Which audio format should I pick?",
      "faq.a5": "M4A keeps the original audio without re-encoding. 320 kbps MP3 opens anywhere. WAV is best for editing without further loss.",
      "faq.q6": "Can I use any video I download?",
      "faq.a6": "Only download content that's yours, licensed, or that you have the creator's permission to use. The rights stay with whoever made it.",
      "footer.legal": "CLIPMAGNET is an independent tool, not affiliated with TikTok, Instagram, Facebook or YouTube. Only use it with content you have the right to download.",
      "footer.code": "Code on GitHub", "footer.credits": "Powered by yt-dlp and FFmpeg",
      "time.now": "now", "time.min": "{n} min ago", "time.h": "{n} h ago", "time.d": "{n} d ago",
      "err.empty": "Paste a video link first.",
      "err.invalid_url": "That link doesn't look right. Copy the full link from the app's Share button.",
      "err.unsupported_platform": "CLIPMAGNET works with TikTok, Instagram, Facebook and YouTube for now.",
      "err.private": "This video is private. Only public posts can be downloaded.",
      "err.login_required": "The platform asked to log in to see this content. Try another public post or try again in a few minutes.",
      "err.bot_check": "YouTube is temporarily throttling the server. Try again in a few minutes or run CLIPMAGNET on your computer.",
      "err.age_restricted": "This video is age-restricted and can't be downloaded without logging in.",
      "err.geo_blocked": "This video isn't available in the server's region.",
      "err.live": "Live streams can't be downloaded while they're on air.",
      "err.too_long": "This video is longer than this server allows.",
      "err.too_large": "This file is larger than this server allows. Try a lower quality.",
      "err.no_media": "We couldn't find a video in that post.",
      "err.unavailable": "This video is no longer available or was removed.",
      "err.network": "We couldn't reach the platform. Check your connection and try again.",
      "err.rate_limited": "Too many requests in a row. Wait a minute and try again.",
      "err.busy": "The server is busy right now. Try again in a moment.",
      "err.ffmpeg_missing": "FFmpeg is missing on the server. Check the setup guide in the README.",
      "err.convert_failed": "Couldn't convert to H.264. Download without converting or try another quality.",
      "err.invalid_media": "The downloaded file failed verification and was discarded for safety.",
      "err.not_found": "That download has expired. Search for the video again.",
      "err.server_offline": "Can't reach the download engine. If you run CLIPMAGNET on your computer, open it with the launcher.",
      "err.failed": "The download failed. Try again or pick another quality.",
      "err.cancelled": "Download cancelled.",
    },
  };

  let lang = "es";

  function t(key, vars) {
    let s = (dict[lang] && dict[lang][key]) ?? dict.es[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  }

  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      // Solo se permite <br> en estas cadenas (fijas, escritas por nosotros)
      const parts = t(el.dataset.i18nHtml).split("<br>");
      el.replaceChildren(...parts.flatMap((p, i) => (i ? [document.createElement("br"), p] : [p])));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    const btn = document.getElementById("lang-btn");
    if (btn) {
      btn.textContent = lang === "es" ? "EN" : "ES";
      btn.setAttribute("aria-label", lang === "es" ? "Change language to English" : "Cambiar idioma a español");
    }
    document.dispatchEvent(new CustomEvent("cm:lang", { detail: lang }));
  }

  function set(next) {
    lang = dict[next] ? next : "es";
    try { localStorage.setItem("clipmagnet.lang", lang); } catch (_) { /* almacenamiento no disponible */ }
    apply();
  }

  function init(fallback) {
    let saved = null;
    try { saved = localStorage.getItem("clipmagnet.lang"); } catch (_) { /* nada */ }
    const nav = (navigator.language || "").slice(0, 2);
    lang = saved || (dict[nav] ? nav : fallback || "es");
    apply();
  }

  window.CMI18N = { t, set, init, get lang() { return lang; } };
})();
