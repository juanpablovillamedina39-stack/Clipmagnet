# Cómo ganar dinero con CLIPMAGNET

Una herramienta gratuita y útil atrae justo al público que más te interesa si eres creador o editor: gente que descarga clips **para editarlos**. La mejor forma de monetizarla no es llenarla de anuncios, sino usarla como puerta de entrada a lo que ya vendes o puedes vender.

> No soy abogado ni asesor financiero: esto es información para que tomes tus propias decisiones.

---

## Antes de empezar: dos realidades

**1. Google AdSense no es una opción.** Las políticas para editores de Google prohíben anuncios en páginas que *"ayudan o permiten a los usuarios descargar videos en streaming si el proveedor del contenido lo prohíbe"* (sección *Enabling dishonest behavior*), y YouTube lo prohíbe en sus términos. Las redes que sí aceptan descargadores suelen vivir de ventanas emergentes y redirecciones: exactamente lo que hace que la gente crea que estas webs "dan virus".

**2. Una web pública y monetizada llama más la atención.** Las plataformas restringen en sus términos la descarga de contenido de terceros. Posiciona CLIPMAGNET como herramienta para creadores (descargar su propio contenido o material con permiso), añade una página de términos y un correo para solicitudes de retiro, y empieza con límites prudentes. La versión local (en tu computadora) tiene mucho menos exposición.

---

## 1. Embudo hacia tu curso, mentoría o servicio (lo más rentable)

La herramienta ya trae un espacio pensado para esto: cuando termina una descarga aparece un mensaje con tu oferta. Es el momento de mayor atención: la persona acaba de conseguir el clip que quiere editar.

**Cómo activarlo** en `web/assets/js/config.js`:

```js
promo: {
  enabled: true,
  url: "https://tu-pagina-de-venta.com/?utm_source=clipmagnet&utm_medium=promo",
  title: { es: "¿Ya tienes el clip? Aprende a editarlo como un profesional", en: "…" },
  text:  { es: "Mi curso te lleva de cero a editar videos que retienen.", en: "…" },
  cta:   { es: "Ver el curso", en: "See the course" },
},
```

Los parámetros `utm_` te permiten ver en Hotmart, Google Analytics o tu plataforma cuántas ventas vienen de CLIPMAGNET.

**Mejor aún: un regalo a cambio del correo.** En lugar de mandar directo a la venta, ofrece algo gratis y relacionado (un pack de transiciones, LUTs, presets de subtítulos o una mini clase) a cambio del correo. Así construyes una lista a la que luego le vendes con calma.

**Ejemplo de números** (supuestos ilustrativos, no una predicción): 5.000 descargas al mes × 3 % que hace clic en tu mensaje = 150 visitas a tu página. Si el 2 % compra un curso de 97 USD, son 3 ventas ≈ 290 USD al mes. Con una lista de correo, la conversión a largo plazo suele ser mayor.

**Contenido que se alimenta solo:** graba reels mostrando CLIPMAGNET ("cómo bajar un TikTok sin marca de agua para editarlo en Premiere"). Te trae tráfico a la herramienta y seguidores a tu marca a la vez.

---

## 2. Versión PRO

Deja la web pública gratis con límites razonables y vende una versión con más potencia:

| Gratis (web) | PRO |
|---|---|
| Hasta 1080p (`CM_MAX_HEIGHT=1080`) | 4K y 8K con conversión a H.264 |
| Una descarga a la vez | Descargas en lote y listas completas* |
| | Subtítulos y miniaturas* |
| | Instalador, actualizaciones y soporte |

\* Funciones que habría que desarrollar; el motor (yt-dlp) ya las soporta.

**Dónde cobrar desde Colombia:**
- **Hotmart:** muy usado en Latinoamérica, permite pagos únicos y suscripciones, y cobra en moneda local.
- **Lemon Squeezy:** actúa como *merchant of record* (se encarga de los impuestos de ventas internacionales) y admite pagos a cuentas bancarias en Colombia.

**Ojo con la licencia:** el código está publicado con licencia MIT, así que alguien con conocimientos técnicos podría usar la versión completa gratis. Lo que vendes es comodidad (instalador, soporte, presets). Si quieres funciones PRO exclusivas, mantenlas en un repositorio privado.

---

## 3. Donaciones

Activa el botón de apoyo del pie de página en `config.js`:

```js
donate: { enabled: true, url: "https://ko-fi.com/tu-usuario", label: { es: "Apoya el proyecto", en: "Support the project" } },
```

- **GitHub Sponsors** acepta creadores que residen en Colombia y aparece directamente en tu repositorio (crea `.github/FUNDING.yml`).
- **Ko-fi** o **Buy Me a Coffee** para pagos sueltos.

Suele ser un ingreso pequeño, pero suma y no molesta a nadie.

---

## 4. Afiliados para creadores

Recomienda lo que tú usas: bibliotecas de música y efectos, bancos de video, plugins, micrófonos, luces. Puedes rotarlos en el mismo espacio de `promo` o crear una sección "Recursos recomendados". Indica siempre que son enlaces de afiliado (el enlace ya lleva `rel="sponsored"`).

---

## 5. Servicio de edición

Un botón "¿No quieres editarlo tú? Te lo edito" que lleve a tu WhatsApp o a un formulario. Pocas ventas, pero de ticket alto.

---

## 6. Si aun así quieres anuncios

Solo banners estáticos: nada de *popunders*, redirecciones ni notificaciones push.

1. En `config.js` pon `ads: { enabled: true }`.
2. Pega el código del anuncio dentro de `<aside id="ad-slot-hero">` en `web/index.html`.
3. Añade el dominio de la red publicitaria a la política de seguridad: en el servidor con `CM_CSP_EXTRA_SCRIPT` y `CM_CSP_EXTRA_FRAME`, y en la etiqueta `<meta http-equiv="Content-Security-Policy">` de `index.html`.
4. Prueba la página sin bloqueador de anuncios y pásala por VirusTotal. Si aparece una sola ventana emergente, cambia de red.

---

## Lo que cuesta mantener la web pública

- **Ancho de banda:** cada descarga pasa dos veces por tu servidor (entra desde la plataforma y sale hacia el usuario). Un video 4K de 1 GB son 2 GB de tráfico. Por eso conviene limitar la web gratuita a 1080p.
- **CPU:** la conversión a H.264 es pesada. Desactívala en planes pequeños (`CM_ALLOW_CONVERT=false`) o déjala solo para la versión PRO.
- **YouTube:** desde servidores en la nube a menudo exige verificación. Un proxy residencial lo resuelve, pero se paga por GB.

---

## Plan sugerido

1. **Ahora:** usa CLIPMAGNET en tu computadora y graba contenido mostrándolo.
2. **Cuando tengas audiencia:** publica la web con límite de 1080p, activa `promo` (con tu regalo a cambio del correo) y `donate`.
3. **Mide** los clics con los parámetros `utm_`. Si la herramienta trae ventas, invierte en la versión PRO y en un mejor servidor.

---

**Fuentes:** [Políticas para editores de Google](https://support.google.com/publisherpolicies/answer/10502938?hl=es) · [Países admitidos en GitHub Sponsors](https://docs.github.com/es/sponsors/getting-started-with-github-sponsors/about-github-sponsors) · [Países admitidos en Lemon Squeezy](https://docs.lemonsqueezy.com/help/getting-started/supported-countries)
