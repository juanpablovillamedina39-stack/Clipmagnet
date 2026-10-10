/* =========================================================================
   CLIPMAGNET · cristal líquido
   Genera un mapa de desplazamiento por panel para que el borde del cristal
   refracte (curve) lo que hay detrás, como una lente. Solo Chrome/Edge
   soportan filtros SVG en backdrop-filter; el resto usa el desenfoque CSS.
   ========================================================================= */
(function () {
  const brands = navigator.userAgentData && navigator.userAgentData.brands;
  const chromium = !!(brands && brands.some((b) => /Chromium|Google Chrome|Microsoft Edge|Opera|Brave/i.test(b.brand)));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!chromium || reduced) return;

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  document.body.appendChild(svg);

  let counter = 0;

  /* Mapa de desplazamiento: en la franja del borde ("bisel") los píxeles se
     desplazan hacia el centro con un perfil convexo, como el canto de una lente. */
  function displacementMap(w, h, radius, bezel) {
    const scale = 0.5; // se calcula a media resolución y el filtro lo estira
    const cw = Math.max(2, Math.round(w * scale));
    const ch = Math.max(2, Math.round(h * scale));
    const r = Math.min(radius, w / 2, h / 2) * scale;
    const bz = bezel * scale;
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(cw, ch);
    const hx = cw / 2, hy = ch / 2;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const px = x + 0.5 - hx, py = y + 0.5 - hy;
        const qx = Math.abs(px) - (hx - r), qy = Math.abs(py) - (hy - r);
        const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
        const dist = -(Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r); // >0 dentro
        let nx = 0, ny = 0, mag = 0;
        if (dist > 0 && dist < bz) {
          if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; nx = (qx / l) * Math.sign(px); ny = (qy / l) * Math.sign(py); }
          else if (qx > qy) nx = Math.sign(px); else ny = Math.sign(py);
          const tEdge = 1 - dist / bz;
          mag = tEdge * tEdge * (3 - 2 * tEdge); // suavizado
        }
        const i = (y * cw + x) * 4;
        img.data[i] = 128 - nx * mag * 127;
        img.data[i + 1] = 128 - ny * mag * 127;
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }

  function attach(host, { bezel = 26, strength = 46, blur = 3 } = {}) {
    const id = `cm-glass-${++counter}`;
    /* El filtro va en una capa vacía ("lente") y no en el panel: si el
       elemento filtrado tiene sombras propias o de sus hijos, Chrome desplaza
       el mapa de refracción. La lente no tiene sombras, así que encaja exacto. */
    const el = document.createElement("span");
    el.className = "lg-lens";
    el.setAttribute("aria-hidden", "true");
    host.prepend(el);
    const filter = document.createElementNS(NS, "filter");
    filter.setAttribute("id", id);
    // Ojo: no fijar x/y/width/height en <filter>; en backdrop-filter Chrome
    // desalinea el mapa si la región del filtro usa userSpaceOnUse.
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const image = document.createElementNS(NS, "feImage");
    image.setAttribute("result", "map");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("preserveAspectRatio", "none");
    const blurEl = document.createElementNS(NS, "feGaussianBlur");
    blurEl.setAttribute("in", "SourceGraphic");
    blurEl.setAttribute("stdDeviation", String(blur));
    blurEl.setAttribute("result", "soft");
    const disp = document.createElementNS(NS, "feDisplacementMap");
    disp.setAttribute("in", "soft");
    disp.setAttribute("in2", "map");
    disp.setAttribute("scale", String(strength));
    disp.setAttribute("xChannelSelector", "R");
    disp.setAttribute("yChannelSelector", "G");
    const sat = document.createElementNS(NS, "feColorMatrix");
    sat.setAttribute("type", "saturate");
    sat.setAttribute("values", "1.6");
    filter.append(image, blurEl, disp, sat);
    svg.appendChild(filter);

    let last = "";
    function update() {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (!w || !h) return;
      const radius = parseFloat(getComputedStyle(host).borderTopLeftRadius) || 0;
      const key = `${w}x${h}x${radius}`;
      if (key === last) return;
      last = key;
      image.setAttribute("width", w); image.setAttribute("height", h);
      image.setAttribute("href", displacementMap(w, h, radius, Math.min(bezel, h / 2.5)));
      el.style.backdropFilter = `url(#${id})`;
      el.style.webkitBackdropFilter = `url(#${id})`;
      host.classList.add("refract");
    }
    let raf = 0;
    new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }).observe(el);
    update();
  }

  function init() {
    document.querySelectorAll(".lg").forEach((el) => {
      const isNav = el.classList.contains("nav");
      attach(el, isNav ? { bezel: 18, strength: 30, blur: 5 } : { bezel: 34, strength: 60, blur: 7 });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
