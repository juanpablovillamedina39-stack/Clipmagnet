/* =========================================================================
   CLIPMAGNET · lógica de la interfaz
   ========================================================================= */
(function () {
  "use strict";

  const cfg = window.CLIPMAGNET_CONFIG || {};
  const I = window.CMI18N;
  const t = (k, v) => I.t(k, v);
  const $ = (id) => document.getElementById(id);
  const API_BASE = String(cfg.apiBase || "").replace(/\/+$/, "");

  const el = {
    form: $("grab-form"), url: $("url"), paste: $("paste-btn"), analyze: $("analyze-btn"), glyph: $("glyph"),
    platforms: $("platforms"), alert: $("alert"), panel: $("magnet-target"),
    result: $("result"), thumb: $("thumb"), thumbImg: $("thumb-img"), duration: $("r-duration"),
    rPlatform: $("r-platform"), rTitle: $("r-title"), rAuthor: $("r-author"), items: $("items"), itemChips: $("item-chips"),
    seg: document.querySelector(".seg"), tabVideo: $("tab-video"), tabAudio: $("tab-audio"),
    optsVideo: $("opts-video"), optsAudio: $("opts-audio"), qGrid: $("q-grid"), aGrid: $("a-grid"),
    h264Row: $("h264-row"), h264: $("h264"), h264Hint: $("h264-hint"),
    action: $("action"), download: $("download-btn"), downloadLabel: $("download-label"),
    progress: $("progress"), bar: $("bar"), barFill: $("bar-fill"), pStage: $("p-stage"), pNum: $("p-num"), pSpeed: $("p-speed"), cancel: $("cancel-btn"),
    done: $("done"), doneFile: $("done-file"), doneNote: $("done-note"), save: $("save-link"), again: $("again-btn"),
    promo: $("promo"), promoTitle: $("promo-title"), promoText: $("promo-text"), promoCta: $("promo-cta"),
    engine: $("engine"), engineText: $("engine-text"),
    recent: $("recent"), recentList: $("recent-list"), clearHistory: $("clear-history"),
    lang: $("lang-btn"), repo: $("repo-link"), donate: $("donate-link"), adHero: $("ad-slot-hero"),
  };

  const state = {
    info: null, url: "", item: 1, mode: "video", quality: null,
    job: null, poll: 0, lastAlert: null, engine: "checking", ttl: 15,
  };

  const PLATFORM_NAMES = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", youtube: "YouTube" };
  const PLATFORM_GLYPHS = { tiktok: "TT", instagram: "IG", facebook: "FB", youtube: "YT" };
  const DOMAINS = {
    tiktok: ["tiktok.com"], instagram: ["instagram.com", "instagr.am"],
    facebook: ["facebook.com", "fb.watch", "fb.com"], youtube: ["youtube.com", "youtu.be", "youtube-nocookie.com"],
  };

  /* ---------------------------------------------------------------------- */
  /*  Utilidades                                                            */
  /* ---------------------------------------------------------------------- */
  function detectPlatform(raw) {
    let s = (raw || "").trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    try {
      const host = new URL(s).hostname.toLowerCase().replace(/\.$/, "");
      for (const [p, list] of Object.entries(DOMAINS)) {
        if (list.some((d) => host === d || host.endsWith("." + d))) return p;
      }
    } catch (_) { /* enlace inválido */ }
    return null;
  }

  function extractUrl(text) {
    const m = (text || "").match(/https?:\/\/[^\s"'<>]+/i);
    return m ? m[0] : (text || "").trim();
  }

  function fmtBytes(n) {
    if (!n && n !== 0) return "";
    const u = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)} ${u[i]}`;
  }

  function fmtTime(sec) {
    if (sec == null || !isFinite(sec)) return "";
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }

  function timeAgo(ts) {
    const min = Math.round((Date.now() - ts) / 60000);
    if (min < 1) return t("time.now");
    if (min < 60) return t("time.min", { n: min });
    const h = Math.round(min / 60);
    if (h < 24) return t("time.h", { n: h });
    return t("time.d", { n: Math.round(h / 24) });
  }

  function localized(v) {
    if (!v) return "";
    if (typeof v === "string") return v;
    return v[I.lang] || v.es || Object.values(v)[0] || "";
  }

  function safeHttpUrl(u) {
    try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (_) { return null; }
  }

  /* ---------------------------------------------------------------------- */
  /*  API                                                                   */
  /* ---------------------------------------------------------------------- */
  class ApiError extends Error { constructor(code) { super(code); this.code = code; } }

  async function request(path, { method = "GET", body } = {}) {
    let res;
    try {
      res = await fetch(API_BASE + path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: "omit",
        cache: "no-store",
      });
    } catch (_) {
      throw new ApiError("server_offline");
    }
    let data = null;
    try { data = await res.json(); } catch (_) { /* sin cuerpo */ }
    // Si la respuesta no trae el formato de CLIPMAGNET (p. ej. un 404/405 de
    // GitHub Pages), es que no hay motor detrás de esta dirección.
    if (!data || typeof data !== "object") throw new ApiError("server_offline");
    if (!res.ok) throw new ApiError(data.error || (res.status === 404 ? "not_found" : "failed"));
    return data;
  }

  const realApi = {
    health: () => request("/api/health"),
    info: (url, item) => request("/api/info", { method: "POST", body: { url, item } }),
    createJob: (body) => request("/api/jobs", { method: "POST", body }),
    job: (id) => request(`/api/jobs/${encodeURIComponent(id)}`),
    cancel: (id) => request(`/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE" }),
    asset: (path) => (path ? API_BASE + path : ""),
  };
  const api = cfg.demo && window.CMDemoAPI ? window.CMDemoAPI : realApi;

  /* ---------------------------------------------------------------------- */
  /*  Avisos                                                                */
  /* ---------------------------------------------------------------------- */
  function showAlert(code, kind) {
    state.lastAlert = code ? { code, kind } : null;
    if (!code) { el.alert.hidden = true; return; }
    el.alert.textContent = t(`err.${code}`) !== `err.${code}` ? t(`err.${code}`) : t("err.failed");
    el.alert.className = "alert" + (kind === "info" ? " info" : "");
    el.alert.hidden = false;
  }

  /* ---------------------------------------------------------------------- */
  /*  Motor                                                                 */
  /* ---------------------------------------------------------------------- */
  async function checkEngine() {
    try {
      const h = await api.health();
      state.engine = cfg.demo ? "demo" : h.js_runtime ? "ok" : "noJs";
      state.ttl = Math.round((h.limits && h.limits.file_ttl ? h.limits.file_ttl : 900) / 60);
      el.engine.title = h.ytdlp ? `yt-dlp ${h.ytdlp}` : "";
    } catch (_) {
      state.engine = "off";
    }
    renderEngine();
  }

  function renderEngine() {
    el.engine.classList.toggle("ok", ["ok", "noJs", "demo"].includes(state.engine));
    el.engine.classList.toggle("off", state.engine === "off");
    el.engineText.textContent = t(`engine.${state.engine === "checking" ? "checking" : state.engine}`);
  }

  /* ---------------------------------------------------------------------- */
  /*  Entrada                                                               */
  /* ---------------------------------------------------------------------- */
  function updatePlatformHint() {
    const p = detectPlatform(el.url.value);
    el.platforms.querySelectorAll("li").forEach((li) => li.classList.toggle("on", li.dataset.p === p));
    if (p) {
      el.glyph.textContent = PLATFORM_GLYPHS[p];
      el.glyph.classList.add("has-platform");
    } else if (el.glyph.classList.contains("has-platform")) {
      el.glyph.classList.remove("has-platform");
      el.glyph.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    }
    return p;
  }

  el.url.addEventListener("input", () => { updatePlatformHint(); if (state.lastAlert) showAlert(null); });
  el.url.addEventListener("paste", () => {
    setTimeout(() => {
      el.url.value = extractUrl(el.url.value);
      if (updatePlatformHint()) analyze();
    }, 0);
  });

  el.paste.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      el.url.value = extractUrl(text);
      if (updatePlatformHint()) analyze(); else el.url.focus();
    } catch (_) {
      el.url.focus();
      el.url.select();
    }
  });

  el.form.addEventListener("submit", (e) => { e.preventDefault(); analyze(); });

  /* ---------------------------------------------------------------------- */
  /*  Analizar                                                              */
  /* ---------------------------------------------------------------------- */
  let analyzing = false;
  async function analyze(item) {
    if (analyzing) return;
    const url = extractUrl(el.url.value);
    if (!url) { showAlert("empty", "info"); el.url.focus(); return; }
    if (!detectPlatform(url)) { showAlert(/^(https?:\/\/)?[^\s/]+\.[^\s]+/.test(url) ? "unsupported_platform" : "invalid_url"); return; }
    if (state.job && !["done", "error", "cancelled"].includes(state.job.status)) return;
    if (state.engine === "off") {
      await checkEngine();
      if (state.engine === "off") { showAlert("server_offline"); return; }
    }

    analyzing = true;
    showAlert(null);
    el.analyze.classList.add("is-loading");
    el.analyze.setAttribute("aria-busy", "true");
    window.CMField && window.CMField.setMode("seeking");
    try {
      const info = await api.info(url, item || 1);
      state.info = info; state.url = url; state.item = item || 1;
      renderResult();
    } catch (err) {
      showAlert(err.code || "failed");
      if (!item) el.result.hidden = true;
    } finally {
      analyzing = false;
      el.analyze.classList.remove("is-loading");
      el.analyze.removeAttribute("aria-busy");
      window.CMField && window.CMField.setMode("idle");
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Resultado                                                             */
  /* ---------------------------------------------------------------------- */
  function renderResult() {
    const info = state.info;
    el.result.hidden = false;
    el.progress.hidden = true;
    el.done.hidden = true;
    el.action.hidden = false;

    el.rPlatform.textContent = PLATFORM_NAMES[info.platform] || "";
    el.rTitle.textContent = info.title || PLATFORM_NAMES[info.platform] || "";
    el.rAuthor.textContent = info.uploader || "";
    el.rAuthor.hidden = !info.uploader;
    el.duration.textContent = info.duration ? fmtTime(info.duration) : "";
    el.thumb.classList.toggle("vertical", !!info.vertical);
    const thumb = api.asset(info.thumbnail);
    if (thumb) { el.thumbImg.src = thumb; el.thumbImg.hidden = false; }
    else { el.thumbImg.removeAttribute("src"); }
    el.thumbImg.onerror = () => { el.thumbImg.removeAttribute("src"); };

    // Carruseles
    if (info.items_count > 1) {
      el.items.hidden = false;
      el.itemChips.replaceChildren(...Array.from({ length: Math.min(info.items_count, 20) }, (_, i) => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = String(i + 1);
        b.setAttribute("aria-pressed", String(i + 1 === state.item));
        b.addEventListener("click", () => { if (i + 1 !== state.item) analyze(i + 1); });
        return b;
      }));
    } else {
      el.items.hidden = true;
    }

    renderQualities();
    setMode(state.mode);
    window.CMField && window.CMField.relayout();
    if (window.matchMedia("(max-width: 640px)").matches) {
      el.result.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderQualities() {
    const qs = state.info.qualities || [];
    const tiles = [];
    if (!qs.length) {
      tiles.push(qualityTile({ value: "", label: t("result.bestAvailable"), tier: null, fps: null, size: null, h264: true, codecs: [] }, true, true));
    } else {
      qs.forEach((q, i) => tiles.push(qualityTile(q, i === 0, i === 0)));
    }
    el.qGrid.replaceChildren(...tiles);
    const first = qs[0];
    state.quality = first ? first.value : null;
    updateH264Row();
    updateDownloadLabel();
  }

  function qualityTile(q, checked, best) {
    const label = document.createElement("label");
    label.className = "q";
    const input = document.createElement("input");
    input.type = "radio"; input.name = "quality"; input.value = q.value; input.checked = checked;
    input.addEventListener("change", () => {
      state.quality = q.value === "" ? null : Number(q.value);
      updateH264Row(); updateDownloadLabel();
    });
    const body = document.createElement("span"); body.className = "q-body";
    const res = document.createElement("span"); res.className = "q-res"; res.textContent = q.label;
    const line = document.createElement("span"); line.className = "q-line";
    if (q.tier) { const tag = document.createElement("span"); tag.className = "q-tag"; tag.textContent = q.tier; line.append(tag); }
    if (q.fps && q.fps > 30) { const f = document.createElement("span"); f.className = "q-fps"; f.textContent = `${q.fps} fps`; line.append(f); }
    if (q.hdr) { const f = document.createElement("span"); f.className = "q-fps"; f.textContent = "HDR"; line.append(f); }
    const note = document.createElement("span"); note.className = "q-note";
    note.textContent = q.size ? `≈ ${fmtBytes(q.size)}` : (q.value === "" ? t("result.auto") : "");
    body.append(res, line, note);
    if (best && q.value !== "") { const b = document.createElement("span"); b.className = "q-best"; b.textContent = t("result.best"); body.append(b); }
    label.append(input, body);
    return label;
  }

  function selectedQuality() {
    const qs = (state.info && state.info.qualities) || [];
    return qs.find((q) => q.value === state.quality) || null;
  }

  function updateH264Row() {
    const q = selectedQuality();
    const canConvert = state.info && state.info.limits && state.info.limits.convert;
    const needs = !!(q && !q.h264 && canConvert);
    el.h264Row.hidden = !needs;
    if (!needs) el.h264.checked = false;
    if (needs) {
      const codecs = (q.codecs || []).filter((c) => c !== "H.264");
      el.h264Hint.textContent = codecs.length ? t("h264.hint", { codec: codecs.join(" / ") }) : t("h264.hintTikTok");
    }
  }

  function audioChoice() {
    const v = (el.aGrid.querySelector("input:checked") || {}).value || "mp3:320";
    const [format, quality] = v.split(":");
    return { format, quality };
  }

  function updateDownloadLabel() {
    if (state.mode === "audio") {
      const a = audioChoice();
      el.downloadLabel.textContent = t("download.audio", { f: a.format.toUpperCase() });
    } else {
      const q = selectedQuality();
      el.downloadLabel.textContent = q ? t("download.video", { q: q.label }) : t("download.videoBest");
    }
  }
  el.aGrid.addEventListener("change", updateDownloadLabel);

  function setMode(mode) {
    state.mode = mode;
    el.seg.dataset.mode = mode;
    el.tabVideo.setAttribute("aria-selected", String(mode === "video"));
    el.tabAudio.setAttribute("aria-selected", String(mode === "audio"));
    el.tabVideo.tabIndex = mode === "video" ? 0 : -1;
    el.tabAudio.tabIndex = mode === "audio" ? 0 : -1;
    el.optsVideo.hidden = mode !== "video";
    el.optsAudio.hidden = mode !== "audio";
    updateDownloadLabel();
  }
  [el.tabVideo, el.tabAudio].forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const next = state.mode === "video" ? "audio" : "video";
        setMode(next);
        (next === "video" ? el.tabVideo : el.tabAudio).focus();
        e.preventDefault();
      }
    });
  });

  /* ---------------------------------------------------------------------- */
  /*  Descarga                                                              */
  /* ---------------------------------------------------------------------- */
  el.download.addEventListener("click", startDownload);

  async function startDownload() {
    if (!state.info) return;
    showAlert(null);
    const body = { url: state.url, item: state.item, mode: state.mode };
    if (state.mode === "video") {
      if (state.quality) body.quality = state.quality;
      body.h264 = !!el.h264.checked && !el.h264Row.hidden;
    } else {
      const a = audioChoice();
      body.audio_format = a.format;
      if (a.format === "mp3") body.audio_quality = a.quality;
    }
    el.download.disabled = true;
    try {
      const job = await api.createJob(body);
      state.job = job;
      state.jobMeta = { ...body, label: state.mode === "video" ? ((selectedQuality() || {}).label || "") : body.audio_format.toUpperCase() };
      el.action.hidden = true;
      el.progress.hidden = false;
      el.progress.focus({ preventScroll: true });
      el.panel.classList.add("is-pulling");
      setTabsDisabled(true);
      renderProgress(job);
      pollJob();
    } catch (err) {
      showAlert(err.code || "failed");
    } finally {
      el.download.disabled = false;
    }
  }

  function setTabsDisabled(disabled) {
    [el.tabVideo, el.tabAudio, el.paste].forEach((b) => { b.disabled = disabled; });
    el.analyze.setAttribute("aria-disabled", String(disabled));
    el.result.querySelectorAll(".q input, #h264, .item-chips button").forEach((i) => { i.disabled = disabled; });
  }

  function pollJob() {
    clearTimeout(state.poll);
    state.poll = setTimeout(async () => {
      if (!state.job) return;
      try {
        const job = await api.job(state.job.id);
        state.job = job;
        renderProgress(job);
        if (job.status === "done") return finishJob(job);
        if (job.status === "error") return failJob(job.error || "failed");
        if (job.status === "cancelled") return failJob("cancelled", "info");
      } catch (err) {
        if (err.code === "not_found") return failJob("not_found");
        // fallo de red puntual: reintenta
      }
      pollJob();
    }, 650);
  }

  function renderProgress(job) {
    const pct = Math.round((job.progress || 0) * 100);
    el.barFill.style.width = `${Math.max(pct, 2)}%`;
    el.bar.setAttribute("aria-valuenow", String(pct));
    el.pNum.textContent = `${pct}%`;
    el.pStage.textContent = t(`stage.${job.stage}`) !== `stage.${job.stage}` ? t(`stage.${job.stage}`) : t("stage.preparing");
    if (job.speed) {
      el.pSpeed.textContent = job.eta != null
        ? t("progress.speed", { speed: fmtBytes(job.speed), eta: fmtTime(job.eta) })
        : t("progress.speedOnly", { speed: fmtBytes(job.speed) });
    } else {
      el.pSpeed.textContent = job.total ? `${fmtBytes(job.downloaded)} / ${fmtBytes(job.total)}` : "";
    }
    window.CMField && window.CMField.setMode("pulling", job.progress || 0);
  }

  function finishJob(job) {
    el.panel.classList.remove("is-pulling");
    setTabsDisabled(false);
    el.progress.hidden = true;
    el.done.hidden = false;
    window.CMField && window.CMField.setMode("done");

    const parts = [job.filename, job.codecs, job.size ? fmtBytes(job.size) : ""].filter(Boolean);
    el.doneFile.textContent = parts.join("  ·  ");
    const fileUrl = job.file ? api.asset(job.file) : "";
    if (fileUrl) {
      el.save.href = fileUrl;
      el.save.setAttribute("download", job.filename || "");
      el.save.removeAttribute("aria-disabled");
      triggerDownload(fileUrl, job.filename);
      const mins = job.expires_in ? Math.max(1, Math.round(job.expires_in / 60)) : state.ttl;
      el.doneNote.textContent = t("done.note", { min: mins });
      el.doneNote.classList.remove("warn");
    } else {
      el.save.removeAttribute("href");
      el.save.setAttribute("aria-disabled", "true");
      el.doneNote.textContent = t("done.demo");
    }
    if (job.watermark) {
      el.doneNote.textContent = t("done.watermark") + " " + el.doneNote.textContent;
      el.doneNote.classList.add("warn");
    }
    renderPromo();
    el.done.focus({ preventScroll: true });
    addHistory({
      url: state.url, item: state.item, title: job.title || (state.info && state.info.title) || "",
      platform: state.info && state.info.platform, label: (state.jobMeta && state.jobMeta.label) || "", ts: Date.now(),
    });
  }

  function triggerDownload(href, filename) {
    const a = document.createElement("a");
    a.href = href;
    if (filename) a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function failJob(code, kind) {
    el.panel.classList.remove("is-pulling");
    setTabsDisabled(false);
    el.progress.hidden = true;
    el.action.hidden = false;
    state.job = null;
    showAlert(code, kind);
    window.CMField && window.CMField.setMode("idle");
  }

  el.cancel.addEventListener("click", async () => {
    if (!state.job) return;
    try { await api.cancel(state.job.id); } catch (_) { /* ya terminó */ }
  });

  el.again.addEventListener("click", () => {
    state.job = null; state.info = null;
    el.result.hidden = true;
    el.url.value = "";
    updatePlatformHint();
    showAlert(null);
    window.CMField && window.CMField.setMode("idle");
    el.url.focus();
  });

  /* ---------------------------------------------------------------------- */
  /*  Monetización configurable                                             */
  /* ---------------------------------------------------------------------- */
  function renderPromo() {
    const p = cfg.promo;
    const url = p && p.enabled ? safeHttpUrl(p.url) : null;
    if (!url) { el.promo.hidden = true; return; }
    el.promoTitle.textContent = localized(p.title);
    el.promoText.textContent = localized(p.text);
    el.promoCta.textContent = localized(p.cta);
    el.promoCta.href = url;
    el.promo.hidden = false;
  }

  function renderStatic() {
    const repo = safeHttpUrl(cfg.repoUrl);
    if (repo) el.repo.href = repo;
    const d = cfg.donate;
    const durl = d && d.enabled ? safeHttpUrl(d.url) : null;
    if (durl) { el.donate.href = durl; el.donate.textContent = localized(d.label); el.donate.hidden = false; }
    el.adHero.hidden = !(cfg.ads && cfg.ads.enabled);
  }

  /* ---------------------------------------------------------------------- */
  /*  Historial (solo en este navegador)                                    */
  /* ---------------------------------------------------------------------- */
  const HKEY = "clipmagnet.history";
  function readHistory() {
    try { const v = JSON.parse(localStorage.getItem(HKEY) || "[]"); return Array.isArray(v) ? v : []; } catch (_) { return []; }
  }
  function writeHistory(list) {
    try { localStorage.setItem(HKEY, JSON.stringify(list.slice(0, 6))); } catch (_) { /* no disponible */ }
  }
  function addHistory(entry) {
    if (!entry.url) return;
    const list = readHistory().filter((h) => !(h.url === entry.url && h.label === entry.label));
    list.unshift(entry);
    writeHistory(list);
    renderHistory();
  }
  function renderHistory() {
    const list = readHistory();
    el.recent.hidden = !list.length;
    el.recentList.replaceChildren(...list.map((h) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      const title = document.createElement("span"); title.className = "recent-title";
      title.textContent = h.title || h.url;
      const meta = document.createElement("span"); meta.className = "recent-meta";
      meta.textContent = [PLATFORM_NAMES[h.platform], h.label, timeAgo(h.ts)].filter(Boolean).join("  ·  ");
      b.append(title, meta);
      b.addEventListener("click", () => {
        el.url.value = h.url; updatePlatformHint(); analyze(h.item || 1);
        el.url.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      li.append(b);
      return li;
    }));
  }
  el.clearHistory.addEventListener("click", () => { writeHistory([]); renderHistory(); });

  /* ---------------------------------------------------------------------- */
  /*  Idioma                                                                */
  /* ---------------------------------------------------------------------- */
  el.lang.addEventListener("click", () => I.set(I.lang === "es" ? "en" : "es"));
  document.addEventListener("cm:lang", () => {
    renderEngine();
    renderHistory();
    if (state.lastAlert) showAlert(state.lastAlert.code, state.lastAlert.kind);
    if (state.info) {
      const checked = state.quality;
      renderQualities();
      if (checked != null) {
        const input = el.qGrid.querySelector(`input[value="${checked}"]`);
        if (input) { input.checked = true; state.quality = checked; updateH264Row(); }
      }
      updateDownloadLabel();
    }
    if (state.job && !el.progress.hidden) renderProgress(state.job);
    if (!el.done.hidden) renderPromo();
  });

  /* ---------------------------------------------------------------------- */
  /*  Arranque                                                              */
  /* ---------------------------------------------------------------------- */
  I.init(cfg.defaultLang);
  renderStatic();
  renderHistory();
  checkEngine();

  // Permite abrir CLIPMAGNET con ?url=... (útil para atajos y compartir)
  try {
    const shared = new URLSearchParams(location.search).get("url");
    if (shared && detectPlatform(shared)) { el.url.value = shared; updatePlatformHint(); analyze(); }
  } catch (_) { /* nada */ }
})();
