/* =========================================================================
   CLIPMAGNET · modo demostración
   Simula el motor para previsualizar el diseño sin servidor. No descarga nada.
   Se activa con  demo: true  en config.js y cargando este archivo antes de app.js.
   ========================================================================= */
(function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const jobs = {};

  function platformOf(url) {
    const u = url.toLowerCase();
    if (u.includes("tiktok")) return "tiktok";
    if (u.includes("instagram") || u.includes("instagr.am")) return "instagram";
    if (u.includes("facebook") || u.includes("fb.")) return "facebook";
    return "youtube";
  }

  function thumb(vertical) {
    const w = vertical ? 360 : 640, h = vertical ? 640 : 360;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
      <defs><radialGradient id='g' cx='50%' cy='110%' r='80%'><stop offset='0' stop-color='#ffb21a'/><stop offset='.35' stop-color='#7a3d00'/><stop offset='1' stop-color='#070400'/></radialGradient></defs>
      <rect width='100%' height='100%' fill='url(#g)'/>
      <circle cx='${w * 0.5}' cy='${h * 0.46}' r='${Math.min(w, h) * 0.13}' fill='none' stroke='#ffe39a' stroke-width='3' opacity='.85'/>
      <path d='M${w * 0.47} ${h * 0.4} L${w * 0.47} ${h * 0.52} L${w * 0.56} ${h * 0.46} Z' fill='#ffe39a'/></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  const SAMPLES = {
    youtube: {
      title: "Cómo editar un reel que retiene hasta el final: ritmo, cortes y sonido",
      uploader: "Estudio Dorado", duration: 754, vertical: false,
      qualities: [
        { value: 2160, label: "2160p", tier: "4K", fps: 60, codecs: ["AV1", "VP9"], h264: false, hdr: false, size: 1.21e9 },
        { value: 1440, label: "1440p", tier: "2K", fps: 60, codecs: ["AV1", "VP9"], h264: false, hdr: false, size: 6.3e8 },
        { value: 1080, label: "1080p", tier: "Full HD", fps: 60, codecs: ["AV1", "H.264", "VP9"], h264: true, hdr: false, size: 2.9e8 },
        { value: 720, label: "720p", tier: "HD", fps: 60, codecs: ["AV1", "H.264", "VP9"], h264: true, hdr: false, size: 1.5e8 },
        { value: 480, label: "480p", tier: null, fps: 30, codecs: ["H.264", "VP9"], h264: true, hdr: false, size: 6.1e7 },
        { value: 360, label: "360p", tier: null, fps: 30, codecs: ["H.264", "VP9"], h264: true, hdr: false, size: 3.4e7 },
      ],
      audio: { abr: 129, codec: "opus", size: 1.2e7 },
    },
    tiktok: {
      title: "3 transiciones que puedes hacer con el celular",
      uploader: "@estudiodorado", duration: 27, vertical: true, watermark_free: true,
      qualities: [
        { value: 1080, label: "1080p", tier: "Full HD", fps: 30, codecs: ["H.264", "H.265"], h264: true, hdr: false, size: 9.4e6 },
        { value: 720, label: "720p", tier: "HD", fps: 30, codecs: ["H.264"], h264: true, hdr: false, size: 5.1e6 },
        { value: 540, label: "540p", tier: null, fps: 30, codecs: ["H.264"], h264: true, hdr: false, size: 3.2e6 },
      ],
      audio: { abr: 128, codec: "aac", size: 4.3e5 },
    },
    instagram: {
      title: "Antes y después del color en un día nublado",
      uploader: "estudio.dorado", duration: 41, vertical: true, items_count: 3,
      qualities: [
        { value: 1080, label: "1080p", tier: "Full HD", fps: 30, codecs: ["H.264"], h264: true, hdr: false, size: 1.4e7 },
        { value: 720, label: "720p", tier: "HD", fps: 30, codecs: ["H.264"], h264: true, hdr: false, size: 7.9e6 },
      ],
      audio: { abr: 128, codec: "aac", size: 6.5e5 },
    },
    facebook: {
      title: "Detrás de cámaras: rodaje del comercial",
      uploader: "Estudio Dorado", duration: 132, vertical: false,
      qualities: [
        { value: 1080, label: "1080p", tier: "Full HD", fps: 30, codecs: ["H.264"], h264: true, hdr: false, size: 4.6e7 },
        { value: 720, label: "720p", tier: "HD", fps: 30, codecs: ["H.264"], h264: true, hdr: false, size: 2.4e7 },
        { value: 360, label: "360p", tier: null, fps: 30, codecs: ["H.264"], h264: true, hdr: false, size: 8.1e6 },
      ],
      audio: { abr: 128, codec: "aac", size: 2.1e6 },
    },
  };

  window.CMDemoAPI = {
    async health() { await wait(250); return { ok: true, js_runtime: "deno", ytdlp: "demo", limits: { file_ttl: 900 } }; },
    async info(url, item) {
      await wait(1100);
      const p = platformOf(url);
      const s = SAMPLES[p];
      return {
        platform: p, title: s.title, uploader: s.uploader, duration: s.duration, thumbnail: thumb(s.vertical), vertical: s.vertical,
        qualities: s.qualities, audio: s.audio, items_count: s.items_count || 1, item: item || 1,
        watermark_free: s.watermark_free ?? null, limits: { max_duration: 10800, convert: true },
      };
    },
    async createJob(body) {
      await wait(300);
      const id = "demo" + Math.random().toString(36).slice(2, 14);
      const p = platformOf(body.url);
      const s = SAMPLES[p];
      const q = s.qualities.find((x) => x.value === body.quality) || s.qualities[0];
      const size = body.mode === "audio" ? s.audio.size * (body.audio_format === "wav" ? 6 : 1.4) : q.size;
      const convert = body.mode === "video" && body.h264 && !q.h264;
      jobs[id] = { start: Date.now(), body, size, convert, title: s.title, q };
      return { id, status: "queued", stage: "queued", progress: 0 };
    },
    async job(id) {
      await wait(60);
      const j = jobs[id];
      if (!j) throw Object.assign(new Error("not_found"), { code: "not_found" });
      if (j.cancelled) return { id, status: "cancelled", stage: "cancelled", progress: 0 };
      const el = (Date.now() - j.start) / 1000;
      const audio = j.body.mode === "audio";
      const plan = audio
        ? [["preparing", 0.6], ["downloading_audio", 3.2], ["extracting_audio", 1.2], ["verifying", 0.5]]
        : j.convert
          ? [["preparing", 0.6], ["downloading", 3.2], ["downloading_audio", 0.8], ["merging", 0.6], ["converting", 2.8], ["verifying", 0.5]]
          : [["preparing", 0.6], ["downloading", 3.6], ["downloading_audio", 0.9], ["merging", 0.7], ["verifying", 0.5]];
      const total = plan.reduce((a, [, d]) => a + d, 0);
      if (el >= total) {
        const ext = audio ? j.body.audio_format : "mp4";
        const codecs = audio ? { mp3: "MP3", m4a: "AAC", wav: "WAV" }[ext] : (j.convert || j.q.h264 ? "H.264 + AAC" : "VP9 + AAC");
        return {
          id, status: "done", stage: "done", progress: 1, title: j.title,
          filename: `${j.title}${audio ? "" : ` (${j.q.value}p)`}.${ext}`, size: Math.round(j.size), codecs, file: null, expires_in: 900,
        };
      }
      let acc = 0, stage = "preparing";
      for (const [s, d] of plan) { if (el < acc + d) { stage = s; break; } acc += d; }
      const progress = Math.min(0.99, el / total);
      const downloading = stage.startsWith("downloading");
      const speed = downloading ? 8.2e6 + Math.sin(el * 3) * 1.6e6 : null;
      return {
        id, status: "running", stage, progress, speed, eta: downloading ? Math.max(0, Math.round(total - el)) : null,
        downloaded: Math.round(j.size * progress), total: Math.round(j.size),
      };
    },
    async cancel(id) { if (jobs[id]) jobs[id].cancelled = true; return { id, status: "cancelled" }; },
    asset(path) { return path || ""; },
  };
})();
