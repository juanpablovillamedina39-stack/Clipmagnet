/* =========================================================================
   CLIPMAGNET · configuración
   Este es el ÚNICO archivo que necesitas editar para personalizar la web.
   ========================================================================= */
window.CLIPMAGNET_CONFIG = {
  /* Dirección del motor de descarga (la API).
     ""  → la web y el motor están en el mismo servidor (uso local o Docker).
     Si publicas la web en GitHub Pages, pon aquí la URL de tu servidor, p. ej.:
     "https://clipmagnet-api.onrender.com" */
  apiBase: "https://clipmagnet.onrender.com/",

  /* Enlace al repositorio (aparece en el pie de página) */
       repoUrl: "https://github.com/juanpablovillamedina39-stack/Clipmagnet",

  /* Idioma por defecto si el navegador no es español ni inglés */
  defaultLang: "es",

  /* ---------- Monetización (ver MONETIZACION.md) ---------- */

  /* Mensaje que aparece cuando la descarga termina: el mejor momento para
     ofrecer tu curso, mentoría, plantillas o servicio de edición. */
  promo: {
    enabled: false,
    url: "https://tu-sitio.com/curso",
    title: {
      es: "¿Ya tienes el clip? Aprende a editarlo como un profesional",
      en: "Got the clip? Learn to edit it like a pro",
    },
    text: {
      es: "Mi curso te lleva de cero a editar videos que retienen, en Premiere y CapCut.",
      en: "My course takes you from zero to editing videos that keep people watching.",
    },
    cta: { es: "Ver el curso", en: "See the course" },
  },

  /* Botón de apoyo en el pie de página (Ko-fi, Buy Me a Coffee, PayPal…) */
  donate: {
    enabled: false,
    url: "https://ko-fi.com/tu-usuario",
    label: { es: "Apoya el proyecto", en: "Support the project" },
  },

  /* Espacios publicitarios. Muestra el contenedor #ad-slot-hero cuando es true.
     Pega el código de tu red de anuncios dentro de ese <aside> en index.html
     y añade su dominio a la Content-Security-Policy. */
  ads: { enabled: false },

  /* Modo demostración: simula el motor sin descargar nada (solo para previsualizar el diseño) */
  demo: false,
};
