(async () => {
// === Data source (Google Sheet first, fallback to data.js) ===
async function __fetchJsonWithTimeout(url, ms=5000){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try{
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function __toStr(v){ return (v==null) ? "" : String(v).trim(); }
function __toNum(v){
  if(v==null) return null;
  const s = String(v).trim();
  if(!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Default categories (used if data.js not present)
function __ensureCategories(){
  if (Array.isArray(window.CATEGORIES) && window.CATEGORIES.length) return;
  window.CATEGORIES = [
    { id:"latest", name:"الأحدث", image:"ringtones/images/cat-latest.webp" },
    { id:"popular", name:"الأكثر تحميلا", image:"ringtones/images/cat-popular.webp" },
    { id:"duas", name:"أدعية", image:"ringtones/images/cat-duas.webp" },
    { id:"nasheeds", name:"أناشيد", image:"ringtones/images/cat-nasheeds.webp" },
    { id:"songs", name:"أغاني", image:"ringtones/images/cat-songs.webp" },
    { id:"zawamel", name:"زوامل", image:"ringtones/images/cat-zawamel.webp" },
    { id:"name_replies", name:"رد على الاسم", image:"ringtones/images/cat-name.webp" },
    { id:"sports", name:"رياضية", image:"ringtones/images/cat-sports.webp" },
    { id:"misc", name:"متنوع", image:"ringtones/images/cat-misc.webp" }
  ];
}

async function __maybeLoadFromSheet(){
  try{
    const cfg = window.SHEET_CONFIG || {};
    if(!cfg.enabled) return false;

    const baseUrl = cfg.baseUrl || "https://opensheet.elk.sh";
    const sheetId = cfg.sheetId;
    const tab = cfg.tab || "ringtones";
    if(!sheetId) return false;

    const url = `${baseUrl.replace(/\/$/,'')}/${encodeURIComponent(sheetId)}/${encodeURIComponent(tab)}`;
    const rows = await __fetchJsonWithTimeout(url, cfg.timeoutMs || 6000);

    if(!Array.isArray(rows) || rows.length === 0) return false;

    // Map sheet rows -> ringtone objects the app expects
    const mapped = rows.map(r => {
      const obj = {
        id: __toStr(r.id) || __toStr(r.source_id),
        source_id: __toStr(r.source_id) || __toStr(r.id),
        title: __toStr(r.title),
        categories: __toStr(r.categories),
        audio: __toStr(r.audio),
        image: __toStr(r.image),
        code_yemen: __toStr(r.code_yemen),
        code_sabafon: __toStr(r.code_sabafon),
        code_you: __toStr(r.code_you),
        created_at: __toStr(r.created_at) || __toStr(r.createdAt),
        is_active: __toStr(r.is_active) || "1",
        // ranks
        rank_latest: __toNum(r.rank_latest),
        rank_popular: __toNum(r.rank_popular),
        rank_duas: __toNum(r.rank_duas),
        rank_nasheeds: __toNum(r.rank_nasheeds),
        rank_songs: __toNum(r.rank_songs),
        rank_zawamel: __toNum(r.rank_zawamel),
        rank_name_duas: __toNum(r.rank_name_duas),
        rank_name_replies: __toNum(r.rank_name_replies),
        rank_sports: __toNum(r.rank_sports),
        rank_misc: __toNum(r.rank_misc),
      };
      // Keep any extra fields as-is (safe)
      for (const k in r){
        if (!(k in obj)) obj[k] = r[k];
      }
      return obj;
    }).filter(x => x.id);

    window.RINGTONES = mapped;
    window.__DATA_SOURCE = "sheet";
    return true;
  }catch(e){
    // Fallback to data.js
    window.__DATA_SOURCE = "data";
    return false;
  }
}

__ensureCategories();
// If sheet is enabled, try it first; otherwise use existing window.RINGTONES (from data.js).
await __maybeLoadFromSheet();
if (!Array.isArray(window.RINGTONES)) window.RINGTONES = window.RINGTONES || [];
// === End data source bootstrap ===


// === Icon helpers (avoid colored emoji on Android) ===
const LAST_PLAYED_KEY = "alooh:lastPlayedId";


// List scroll restore (when returning from details)
  const LIST_SCROLL_KEY = "unicell_list_scroll_v1";
  const LIST_LAST_ID_KEY = "unicell_list_last_id_v1";

  function saveListScroll(ringtoneId) {
    try {
      const pad = document.querySelector("#viewList .pad");
      const listGrid = document.getElementById("listGrid");
      const payload = {
        winY: window.scrollY || 0,
        padY: pad ? pad.scrollTop : 0,
        gridY: listGrid ? listGrid.scrollTop : 0,
        catId: selectedCategory || null
      };
      sessionStorage.setItem(LIST_SCROLL_KEY, JSON.stringify(payload));
      if (ringtoneId != null) sessionStorage.setItem(LIST_LAST_ID_KEY, String(ringtoneId));
    } catch (e) {}
  }

  function restoreListScroll() {
    try {
      // Prefer centering on the last opened ringtone card (more stable than raw scroll values)
      const lastId = sessionStorage.getItem(LIST_LAST_ID_KEY);
      if (lastId) {
        const btn = document.querySelector(`[data-play="${CSS.escape(lastId)}"]`);
        const card = btn ? btn.closest(".tone") : null;
        if (card && card.scrollIntoView) {
          card.scrollIntoView({ block: "center", behavior: "auto" });
          return;
        }
      }

      // Fallback: use stored scroll positions if the card is not found
      const raw = sessionStorage.getItem(LIST_SCROLL_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw) || {};
      const pad = document.querySelector("#viewList .pad");
      const listGrid = document.getElementById("listGrid");

      if (pad && typeof payload.padY === "number") pad.scrollTop = payload.padY;
      if (listGrid && typeof payload.gridY === "number") listGrid.scrollTop = payload.gridY;
      const y = (typeof payload.winY === "number") ? payload.winY : 0;
      try { window.scrollTo({ top: y, left: 0, behavior: "auto" }); } catch (_) { window.scrollTo(0, y); }
    } catch (e) {}
  }
const CLICK_GUARD_MS = 250;

function setPlayIcon(btn) {
  btn.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>`;
  btn.setAttribute("aria-label", "تشغيل");
}
function setPauseIcon(btn) {
  btn.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>`;
  btn.setAttribute("aria-label", "إيقاف مؤقت");
}
  const $ = (id) => document.getElementById(id);

  const headerTitle = $("headerTitle");
  const backBtn = $("backBtn");
  const headerLogo = $("headerLogo");

  const views = {
    cats: $("viewCategories"),
    list: $("viewList"),
    details: $("viewDetails"),
  };

  const categoriesGrid = $("categoriesGrid");
  const listGrid = $("listGrid");
  const searchBtn = $("searchBtn");
  const searchBar = $("searchBar");
  const searchInput = $("searchInput");
  const searchClear = $("searchClear");

  const detailsImage = $("detailsImage");
  const detailsName = $("detailsName");
  const subsGrid = $("subsGrid");
  const toast = $("toast");
  const offlineHint = $("offlineHint");

  // Audio preview (LIST ONLY)
  const previewAudio = new Audio();
  // Compatibility defaults (safe; no UI impact)
  previewAudio.preload = "none";
  try { previewAudio.setAttribute("playsinline", ""); } catch(e) {}
  try { previewAudio.setAttribute("webkit-playsinline", ""); } catch(e) {}
  let currentPlayingId = null;
  let isStoppingPreview = false;


  

  // Prevent overlapping play requests when user taps quickly
  let playToken = 0;

  async function safeStop(token) {
    if (!previewAudio || (!previewAudio.src && previewAudio.currentSrc === "")) {
      currentPlayingId = null;
      return;
    }

    // Fade-out quickly to avoid "pop/click"
    try { fadeTo(previewAudio, 0, 90); } catch(e) {}

    // Give the browser a moment to apply volume ramp
    await new Promise(r => setTimeout(r, 100));

    if (token !== playToken) return;

    try { previewAudio.pause(); } catch(e) {}
    try { previewAudio.currentTime = 0; } catch(e) {}

    // Fully detach src to stop any buffered audio from bleeding
    try { previewAudio.removeAttribute("src"); } catch(e) {}
    try { previewAudio.load(); } catch(e) {}

    currentPlayingId = null;

    // Reset all play buttons to "play" icon
    document.querySelectorAll("[data-play]").forEach(b => {
      try { setPlayIcon(b); } catch(e) {}
    });
  }
// Smooth audio fade to reduce "click/pop" when switching tones (especially on Android)
  function fadeTo(audioEl, targetVolume, durationMs) {
    try {
      const start = (audioEl && typeof audioEl.volume === "number") ? audioEl.volume : 1;
      const end = Math.max(0, Math.min(1, Number(targetVolume)));
      const dur = Math.max(0, Number(durationMs) || 0);
      if (!dur) { try { audioEl.volume = end; } catch(e) {} return; }

      const t0 = (window.performance && performance.now) ? performance.now() : Date.now();
      const step = (t) => {
        const now = (typeof t === "number") ? t : ((window.performance && performance.now) ? performance.now() : Date.now());
        const p = Math.min(1, (now - t0) / dur);
        try { audioEl.volume = start + (end - start) * p; } catch(e) {}
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } catch(e) {}
  }

  let currentView = "categories"; // categories | list | details
  let selectedCategory = null;     // category id
  let selectedRingtoneId = null;
  let currentQuery = "";

  // Cleanup controller for list button listeners (prevents leaks on re-render)
  let listAbort = new AbortController();

  // Auto-generated images for "بالاسم" content
  const generatedImageCache = new Map();

  // Lazily generate "بالاسم" thumbnails only when they become visible.
  let byNameThumbObserver = null;
  function ensureByNameThumbObserver() {
    if (byNameThumbObserver) return byNameThumbObserver;
    if (!("IntersectionObserver" in window)) return null;

    byNameThumbObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        byNameThumbObserver.unobserve(img);

        const rid = img?.dataset?.rid;
        const title = img?.dataset?.title || "";
        if (!rid) return;

        if (generatedImageCache.has(rid)) {
          if (img.isConnected) img.src = generatedImageCache.get(rid);
          return;
        }

        const doWork = () => {
          try {
            const url = makeNameImageDataUrl(extractNameOnly(title));
            generatedImageCache.set(rid, url);
            if (img.isConnected) img.src = url;
          } catch (e) {}
        };

        if ("requestIdleCallback" in window) {
          requestIdleCallback(doWork, { timeout: 1200 });
        } else {
          setTimeout(doWork, 0);
        }
      });
    }, { root: null, threshold: 0.1 });

    return byNameThumbObserver;
  }

  function isByNameRingtone(r) {
    return ((r?.categories || []).some(n => String(n || "").includes("بالاسم")));
  }

  function extractNameOnly(title) {
    const t = String(title || "").trim();
    // Remove common prefixes like: دعاء / رد / رد آلي
    const cleaned = t
      .replace(/^\s*(دعاء)\s+/u, "")
      .replace(/^\s*(رد\s*آلي|رد)\s+/u, "")
      .trim();
    return cleaned || t;
  }

  function makeNameImageDataUrl(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");

    // Subtle dark background (keeps site palette)
    const g = ctx.createLinearGradient(0, 0, 600, 600);
    g.addColorStop(0, "#0b1620");
    g.addColorStop(1, "#111c27");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 600, 600);

    // Very subtle music note pattern
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#ffffff";
    const notes = ["♪", "♫", "♩", "♬"];
    ctx.font = "48px sans-serif";
    for (let y = 80; y < 600; y += 140) {
      for (let x = 60; x < 600; x += 140) {
        ctx.fillText(notes[(x + y) % notes.length], x, y);
      }
    }
    ctx.globalAlpha = 1;

    // Main name text
    const name = String(text || "").trim();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Fit text to canvas
    let fontSize = 92;
    const maxWidth = 520;
    while (fontSize > 44) {
      ctx.font = `800 ${fontSize}px system-ui, -apple-system, Segoe UI, Arial`;
      if (ctx.measureText(name).width <= maxWidth) break;
      fontSize -= 4;
    }

    // Soft shadow for readability
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillText(name, 300, 300);
    ctx.shadowBlur = 0;

    return canvas.toDataURL("image/png");
  }

  function getDisplayImage(r, opts = {}) {
    if (!r) return "";
    const byName = isByNameRingtone(r);
    if (!byName) return r.image || "";

    // By-name images can be expensive to generate (canvas -> dataURL).
    // Default behavior: return a lightweight fallback, and generate lazily for visible items.
    const fallback =
      r.image ||
      ((r?.categories || []).some(n => String(n || "").includes("أدعية")) ? "ringtones/images/cat-name-duas.jpg" : "ringtones/images/cat-name-replies.jpg");

    const generate = !!opts.generate;
    if (!generate) return fallback;

    if (generatedImageCache.has(r.id)) return generatedImageCache.get(r.id);
    const nameOnly = extractNameOnly(r.title);
    const url = makeNameImageDataUrl(nameOnly);
    generatedImageCache.set(r.id, url);
    return url;
  }

  function normalizeRingtone(r) {
    // Defensive normalization (prevents crashes from unexpected/missing fields)
    const obj = (r && typeof r === "object") ? r : {};
    const id = obj.id ?? obj._id ?? obj.uuid ?? String(Math.random());
    const title = String(obj.title ?? obj.name ?? "").trim();

    // audio/image may come as just a filename from the Sheet
    let audio = String(obj.audio ?? obj.audioUrl ?? obj.url ?? "").trim();
    let image = String(obj.image ?? obj.img ?? obj.cover ?? "").trim();

    // Normalize categories:
    // - From data.js: could be an array
    // - From Sheet: often a string like "popular|zawamel"
    let categories = [];
    if (Array.isArray(obj.categories)) {
      categories = obj.categories.filter(Boolean).map(v => String(v).trim()).filter(Boolean);
    } else if (typeof obj.categories === "string") {
      categories = obj.categories
        .split(/[|,]/g)
        .map(s => s.trim())
        .filter(Boolean);
    }

    // Build rank object from either obj.rank or rank_* columns
    const rank = (obj.rank && typeof obj.rank === "object") ? { ...obj.rank } : {};
    const rankKeys = [
      "latest","popular","duas","nasheeds","songs","zawamel","name_duas","name_replies","sports","misc"
    ];
    for (const k of rankKeys) {
      const col = "rank_" + k;
      if (rank[k] == null && obj[col] != null && obj[col] !== "") {
        const n = Number(obj[col]);
        if (!Number.isNaN(n)) rank[k] = n;
      }
    }

    // If audio is just "file.mp3" (no slash), prefix it to the real folder
    // (Your files live in: ringtones/audio/ and ringtones/images/)
    const isUrl = (v) => /^https?:\/\//i.test(v);
    if (audio && !isUrl(audio) && !audio.includes("/")) {
      audio = "ringtones/audio/" + audio;
    }
    // Some sheets have image="AUTO" or empty, keep it as-is (the UI will generate a fallback)
    if (image && image !== "AUTO" && !isUrl(image) && !image.includes("/")) {
      image = "ringtones/images/" + image;
    }

    return {
      ...obj,
      id,
      title,
      // cached lowercase title for fast search/filter
      _titleLC: title.toLowerCase(),
      audio,
      image,
      categories,
      rank
    };
  }

  // === Data caches (performance) ===
  // Normalize RINGTONES once, and cache per-category filtered/sorted lists.
  let __allNormalized = null;
  const __catCache = new Map();

  // If you edit data.js while the page is open, cached lists won't update.
  // We clear caches when navigating into a category to reflect latest data.
  function invalidateRingtoneCaches() {
    __allNormalized = null;
    __catCache.clear();
  }

  function getAllNormalizedRingtones() {
    if (__allNormalized) return __allNormalized;
    __allNormalized = (window.RINGTONES || []).map(normalizeRingtone);
    return __allNormalized;
  }

  function getCachedCategory(catId, builder) {
    if (__catCache.has(catId)) return __catCache.get(catId);
    const value = builder();
    __catCache.set(catId, value);
    return value;
  }

  function showView(name) {
    Object.values(views).forEach(v => v.classList.add("hidden"));
    views[name].classList.remove("hidden");
    currentView = name === "cats" ? "categories" : (name === "list" ? "list" : "details");
  }

  function setHeader(title, showBack) {
    headerTitle.textContent = title || "خصّص رنينك بضغطة زر";
    backBtn.classList.toggle("hidden", !showBack);
    headerLogo.classList.toggle("hidden", !!showBack); // مثل القالب الأصلي: يظهر الشعار فقط في الرئيسية
  }

  function toastMsg(msg) {
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 1800);
  }

  function stopPreview() {
    if (isStoppingPreview) return;
    isStoppingPreview = true;
    const token = ++playToken;
    safeStop(token).finally(() => { isStoppingPreview = false; });
  }

  function playToggle(id, audioUrl, btn) {
    const token = ++playToken;

    // Guard against double taps / rapid clicks on mobile
    if (btn?.dataset?.busy === "1") return;
    if (btn) {
      btn.dataset.busy = "1";
      setTimeout(() => { try { btn.dataset.busy = "0"; } catch(e) {} }, CLICK_GUARD_MS);
    }

    // If user taps the same tone -> stop
    if (currentPlayingId === id) {
      safeStop(token);
      return;
    }

    // Stop any previous tone smoothly
    safeStop(token).then(() => {
      if (token !== playToken) return;

      // Start muted then fade-in to avoid click/pop on start/switch
      try { previewAudio.volume = 0; } catch(e) {}
      try { previewAudio.currentTime = 0; } catch(e) {}

      previewAudio.src = audioUrl;

      const onStarted = () => {
        if (token !== playToken) return;
        fadeTo(previewAudio, 1, 160);
        currentPlayingId = id;
        try { localStorage.setItem(LAST_PLAYED_KEY, String(id)); } catch (e) {}
        if (btn) setPauseIcon(btn);
      };

      const onFailed = () => {
        try { if (btn) { setPlayIcon(btn); btn.dataset.busy = "0"; } } catch(e) {}
        toastMsg("تعذر تشغيل الصوت");
      };

      const p = previewAudio.play();
      if (p && typeof p.then === "function") {
        p.then(onStarted).catch(() => {
          // Retry once (mobile autoplay / decode quirks)
          try {
            if (!previewAudio._retry) previewAudio._retry = 0;
            if (previewAudio._retry < 1) {
              previewAudio._retry += 1;
              try { previewAudio.currentTime = 0; } catch(e) {}
              const p2 = previewAudio.play();
              if (p2 && typeof p2.then === "function") {
                p2.then(onStarted).catch(onFailed);
              } else {
                onStarted();
              }
              return;
            }
          } catch(e) {}
          onFailed();
        });
      } else {
        // Older browsers
        onStarted();
      }
    });
  }
  previewAudio.addEventListener("ended", stopPreview);
  // Robust state recovery (no UI change)
  ["error","abort","stalled"].forEach(ev => {
    previewAudio.addEventListener(ev, () => {
      // If something goes wrong mid-play, ensure icons/state reset
      if (currentPlayingId != null) stopPreview();
    });
  });
  previewAudio.addEventListener("pause", () => {
    // Some browsers pause audio when switching apps; keep UI consistent
    if (!isStoppingPreview && currentPlayingId != null) stopPreview();
  });

  // Stop audio when the page is hidden (prevents stuck playback on mobile)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPreview();
  });

  function ringtonesForCategory(catId) {
    // Heavy work (normalization + sorting) is cached per category.
    return getCachedCategory(catId, () => {
      const catObj = (window.CATEGORIES || []).find(c => c.id === catId);
      const catName = catObj ? catObj.name : "";

      const all = getAllNormalizedRingtones();

    const hasCat = (r, name) => (r.categories || []).includes(name);

    const sortByRankOrDate = (items, name) => {
      return items.slice().sort((a, b) => {
        const ra = a.rank?.[name];
        const rb = b.rank?.[name];
        const hasRa = Number.isFinite(ra);
        const hasRb = Number.isFinite(rb);
        if (hasRa && hasRb) return ra - rb;
        if (hasRa) return -1;
        if (hasRb) return 1;

        const da = Date.parse(a.createdAt || "") || 0;
        const db = Date.parse(b.createdAt || "") || 0;
        return db - da; // newer first
      });
    };

      if (catId === "latest") {
      // "الأحدث" يعرض كل النغمات من كل الأقسام
      // مع استثناء أي نغمة تنتمي لأي قسم يحتوي اسمه على كلمة "بالاسم"
      const filtered = all.filter(r => !((r.categories || []).some(n => String(n || "").includes("بالاسم"))));
        return filtered.slice().sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0));
      }

      if (catId === "popular") {
      // "الأكثر تحميلًا" بحسب ترتيب rank إن وجد
      const popularName = ((window.CATEGORIES || []).find(c => c.id === "popular") || {}).name || "الأكثر تحميلًا";
      const filtered = all.filter(r => hasCat(r, popularName));
        return sortByRankOrDate(filtered, popularName);
      }

    // باقي الأقسام
      const filtered = catName ? all.filter(r => hasCat(r, catName)) : all;
      return catName ? sortByRankOrDate(filtered, catName) : filtered;
    });
  }

  function renderList(catId, query, opts = {}) {
    // Cleanup old listeners from previous render
    try { listAbort.abort(); } catch(e) {}
    listAbort = new AbortController();

    const q = (query || "").trim().toLowerCase();
    const allItems = ringtonesForCategory(catId).filter(r => {
      if (!q) return true;
      return (r._titleLC || String(r.title || "").toLowerCase()).includes(q);
    });

    const PAGE_SIZE = q ? allItems.length : (opts.pageSize || 20);
    let page = 0;

    let loadingMore = false;
    listGrid.innerHTML = "";

    const observer = ensureByNameThumbObserver();

    function renderPage() {
      const start = page * PAGE_SIZE;
      const end = Math.min(allItems.length, start + PAGE_SIZE);
      const items = allItems.slice(start, end);

      items.forEach((r) => {
        const row = document.createElement("div");
        row.className = "tone";

        const img = document.createElement("img");
        img.className = "thumb";

        const isByName = isByNameRingtone(r);
        if (isByName) {
          // Lightweight fallback first, then generate on visibility
          img.src = getDisplayImage(r, { generate: false });
          img.dataset.rid = r.id;
          img.dataset.title = r.title || "";
          img.loading = "lazy";
          if (observer) observer.observe(img);
        } else {
          img.src = getDisplayImage(r);
          img.loading = "lazy";
        }

        img.alt = r.title || "";
        img.onerror = () => { img.onerror = null; img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Y7u8AAAAASUVORK5CYII="; };

        const name = document.createElement("div");
        name.className = "tone-name";
        name.textContent = r.title || "";

        const play = document.createElement("button");
        play.className = "btn play";
        play.dataset.play = r.id;
        setPlayIcon(play);
        play.addEventListener("click", (e) => {
          e.stopPropagation();
          playToggle(r.id, r.audio, play);
        }, { signal: listAbort.signal });

        const actions = document.createElement("div");
        actions.className = "tone-actions";

        const subscribe = document.createElement("button");
        subscribe.className = "btn primary subscribe";
        subscribe.textContent = "تفاصيل";
        subscribe.addEventListener("click", (e) => {
          e.stopPropagation();
          openDetails(r.id);
        }, { signal: listAbort.signal });
        actions.append(play, subscribe);
        row.append(img, name, actions);
        listGrid.appendChild(row);
      });

      // Update / add "Load more" button
      const existingBtn = document.getElementById("loadMoreBtn");
      if (existingBtn) existingBtn.remove();
      const existingSentinel = document.getElementById("loadMoreSentinel");
      if (existingSentinel) existingSentinel.remove();

      // Infinite scroll: append a sentinel that loads the next page when it enters view
      if (end < allItems.length) {
        const sentinel = document.createElement("div");
        sentinel.id = "loadMoreSentinel";
        sentinel.className = "load-more-sentinel";
        sentinel.innerHTML = `
          <div class="spinner" aria-hidden="true"></div>
          <div class="load-more-text">جاري تحميل المزيد...</div>
        `;
        listGrid.appendChild(sentinel);

        const io = new IntersectionObserver((entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            io.disconnect();
            if (loadingMore) return;
            loadingMore = true;
            page += 1;
            requestAnimationFrame(() => {
              loadingMore = false;
              renderPage();
            });
            break;
          }
        }, { root: null, rootMargin: "300px 0px", threshold: 0.01 });

        io.observe(sentinel);
        listAbort.signal.addEventListener("abort", () => io.disconnect(), { once: true });
      }
    }

    if (allItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "لا توجد نتائج.";
      listGrid.appendChild(empty);
      return;
    }

    renderPage();
  }


  function renderCategories() {
    categoriesGrid.innerHTML = "";
    window.CATEGORIES.forEach((cat, index) => {
      const btn = document.createElement("button");
      btn.className = "cat-card";
      btn.style.animationDelay = `${index * 80}ms`;

      const bg = document.createElement("div");
      bg.className = "cat-bg";
      bg.style.backgroundImage = `url('${cat.image || ""}')`;

      const overlay = document.createElement("div");
      overlay.className = "cat-overlay";

      const shine = document.createElement("div");
      shine.className = "cat-shine";

      const name = document.createElement("div");
      name.className = "cat-name";
      name.textContent = cat.name;

      btn.append(bg, overlay, shine, name);
      btn.onclick = () => openList(cat.id);
      categoriesGrid.appendChild(btn);
    });
  }

  function scrollListToTop() {
    // Ensure the list view starts from the beginning when entering/switching categories
    const pad = document.querySelector("#viewList .pad");
    if (pad) pad.scrollTop = 0;

    const listGrid = document.getElementById("listGrid");
    if (listGrid) listGrid.scrollTop = 0;

    // Also reset page scroll (mobile browsers may scroll the whole page)
    try { window.scrollTo({ top: 0, left: 0, behavior: "auto" }); } catch (_) { window.scrollTo(0, 0); }
  }


  function openList(catId, opts = {}) {
    const __push = opts.push !== false;
    const __prevView = currentView;
    stopPreview();
    invalidateRingtoneCaches();
    selectedCategory = catId;
    selectedRingtoneId = null;

    const cat = window.CATEGORIES.find(c => c.id === catId);
    setHeader(cat ? cat.name : "النغمات", true);

    // Search UI
    currentQuery = "";
    if (searchInput) searchInput.value = "";
    if (searchBar) searchBar.classList.add("hidden");
    if (searchBtn) searchBtn.classList.remove("hidden");

    showView("list");
    // When returning from details, render enough items so the same card exists in DOM
    let __restoreSize = 0;
    if (opts.restoreScroll) {
      try {
        const lastId = sessionStorage.getItem(LIST_LAST_ID_KEY);
        if (lastId) {
          const items = ringtonesForCategory(catId);
          const idx = items.findIndex(r => String(r.id) === String(lastId));
          if (idx >= 0) __restoreSize = Math.max(20, idx + 1);
        }
      } catch (e) {}
    }
    renderList(catId, currentQuery, __restoreSize ? { pageSize: __restoreSize } : undefined);
// Start list from top unless we are returning from details
    if (opts.restoreScroll) {
      requestAnimationFrame(() => restoreListScroll());
    } else {
      requestAnimationFrame(scrollListToTop);
    }

    if (__push) {
      const __state = { view: "list", catId };
      const __url = `#list-${encodeURIComponent(catId)}`;
      // If we are already in a list and user is just switching categories, don't stack history entries.
      if (__prevView === "list") history.replaceState(__state, "", __url);
      else history.pushState(__state, "", __url);
    }
  }

  function makeSmsLink(number, body) {
    const encoded = encodeURIComponent(body || "");
    return `sms:${number}?&body=${encoded}`;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    }
  }

  function openDetails(ringtoneId, opts = {}) {
    const __push = opts.push !== false;
    stopPreview();
    if (searchBtn) searchBtn.classList.add("hidden");
    if (searchBar) searchBar.classList.add("hidden");
    selectedRingtoneId = ringtoneId;
    const raw = (window.RINGTONES || []).find(x => x.id === ringtoneId);
    if (!raw) return;
    const r = normalizeRingtone(raw);

    setHeader(r.title, true);
    // Remember where we were in the list
    saveListScroll(ringtoneId);
    showView("details");

    detailsImage.src = getDisplayImage(r, { generate: true });
    detailsImage.alt = r.title;
    detailsImage.onerror = () => { detailsImage.onerror = null; detailsImage.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Y7u8AAAAASUVORK5CYII="; };
    detailsName.textContent = r.title;

    subsGrid.innerHTML = "";
    window.CARRIERS.forEach((c) => {
      const code = (r.codes?.[c.key]?.code || r.codes?.[(c.key === "yemen" ? "yemenMobile" : c.key)]?.code || "");
      const box = document.createElement("div");
      box.className = "sub-card";

      const left = document.createElement("div");
      left.className = "sub-left";

      const logo = document.createElement("img");
      logo.className = "carrier";
      logo.src = c.logo;
      logo.alt = c.name;

      const meta = document.createElement("div");
      meta.className = "sub-meta";
      meta.innerHTML = `
        <div class="cname">${c.name}</div>
        <div class="cnum">رقم الخدمة: ${c.number || "-"}</div>
        <div class="ccode">الكود: ${code || "-"}</div>
      `;

      left.append(logo, meta);

      const btn = document.createElement("button");
      btn.className = "btn primary";
      btn.textContent = "اشتراك";
      btn.onclick = async () => {
        if (!c.number || !code) {
          toastMsg("لا يوجد كود لهذه الشركة");
          return;
        }
        window.location.href = makeSmsLink(c.number, code);
        setTimeout(async () => {
          const ok = await copyToClipboard(code);
          toastMsg(ok ? `تم نسخ الكود: ${code}` : "تعذر نسخ الكود");
        }, 600);
      };

      box.append(left, btn);
      subsGrid.appendChild(box);
    });

    if (__push) history.pushState({ view: "details", ringtoneId }, "", `#details-${encodeURIComponent(ringtoneId)}`);
  }

  function goBack() {
    if (currentView === "details") {
      // back to list
      if (selectedCategory) {
        openList(selectedCategory, { push: false, restoreScroll: true });
        // Keep URL/state consistent (avoid staying on #details-...)
        try { history.replaceState({ view: "list", catId: selectedCategory }, "", `#list-${encodeURIComponent(selectedCategory)}`); } catch (e) {}
      } else {
        openHome({ push: false });
      }
      return;
    }
    if (currentView === "list") {
      openHome();
      return;
    }
    openHome();
  }

  function openHome(opts = {}) {
    const __push = opts.push !== false;
    stopPreview();
    selectedCategory = null;
    selectedRingtoneId = null;
    setHeader("خصّص رنينك بضغطة زر", false);
    if (searchBtn) searchBtn.classList.add("hidden");
    if (searchBar) searchBar.classList.add("hidden");
    showView("cats");
    if (__push) history.pushState({ view: "categories" }, "", "#");
  }

  backBtn.addEventListener("click", goBack);

  // Search controls (List view)
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      if (!searchBar) return;
      const willShow = searchBar.classList.contains("hidden");
      searchBar.classList.toggle("hidden", !willShow);
      if (willShow && searchInput) searchInput.focus();
      if (!willShow) {
        currentQuery = "";
        if (searchInput) searchInput.value = "";
        if (selectedCategory) renderList(selectedCategory, currentQuery);
      }
    });
  }

  // Debounced search (keeps typing smooth on weaker phones)
  let __searchT = null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentQuery = searchInput.value || "";
      if (__searchT) clearTimeout(__searchT);
      __searchT = setTimeout(() => {
        if (selectedCategory) renderList(selectedCategory, currentQuery);
      }, 140);
    });
  }

  if (searchClear) {
    searchClear.addEventListener("click", () => {
      currentQuery = "";
      if (searchInput) {
        searchInput.value = "";
        searchInput.focus();
      }
      if (selectedCategory) renderList(selectedCategory, currentQuery);
    });
  }

  window.addEventListener("popstate", (e) => {
    const st = (e && e.state) ? e.state : (history.state || {});
    const h = location.hash || "";

    const getFromHash = (prefix) => {
      if (!h.startsWith(prefix)) return null;
      try { return decodeURIComponent(h.slice(prefix.length)); } catch { return h.slice(prefix.length); }
    };

    if ((st && st.view === "details") || h.startsWith("#details-")) {
      const id = (st && st.ringtoneId) || getFromHash("#details-");
      if (id) openDetails(id, { push: false });
      else openHome({ push: false });
      return;
    }

    if ((st && st.view === "list") || h.startsWith("#list-")) {
      const catId = (st && st.catId) || getFromHash("#list-");
      if (catId) openList(catId, { push: false, restoreScroll: true });
      else openHome({ push: false });
      return;
    }

    openHome({ push: false });
  });


  // Offline hint
  function updateOnline() {
    offlineHint.classList.toggle("hidden", navigator.onLine);
  }
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
  updateOnline();

  // Contact footer
  function renderContact() {
    const links = $("contactLinks");
    const social = $("socialLinks");
    if (!links || !social) return;

    const c = window.CONTACT || {};
    links.innerHTML = "";
    social.innerHTML = "";

    const phone = c.phone ? String(c.phone).trim() : "";
    const whatsapp = c.whatsapp ? String(c.whatsapp).trim() : "";
    const email = c.email ? String(c.email).trim() : "";

    const ICON = {
      phone: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8c1.6 3 3.6 5 6.6 6.6l2.2-2.2c.3-.3.8-.4 1.2-.2 1 .4 2.2.7 3.3.7.7 0 1.1.4 1.1 1.1V20c0 .6-.5 1.1-1.1 1.1C10.3 21.1 2.9 13.7 2.9 4.1 2.9 3.5 3.4 3 4.1 3h3.3c.6 0 1.1.5 1.1 1.1 0 1.1.2 2.2.7 3.3.1.4 0 .9-.3 1.2l-2.3 2.2z"/></svg>`,
      whatsapp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>`,
      email: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z"/></svg>`
    };

    const makeCard = (label, value, href, iconSvg, color, extraClass) => {
      if (!value) return;
      const a = document.createElement("a");
      a.className = "contact-card" + (extraClass ? (" " + extraClass) : "");
      a.href = href || "#";
      a.target = "_blank";
      a.rel = "noopener";

      const ic = document.createElement("div");
      ic.className = "contact-ic";
      if (color) ic.style.color = color;
      ic.innerHTML = iconSvg;

      const meta = document.createElement("div");
      meta.className = "contact-meta";

      const l = document.createElement("div");
      l.className = "contact-label";
      l.textContent = label;

      const v = document.createElement("div");
      v.className = "contact-value";
      v.textContent = value;

      meta.append(l, v);
      a.append(ic, meta);
      links.appendChild(a);
    };

    makeCard("اتصال", phone, phone ? `tel:${phone}` : "", ICON.phone, "#7dd3fc");
    makeCard("واتساب", whatsapp, whatsapp ? `https://wa.me/${String(whatsapp).replace(/\D/g, "")}` : "", ICON.whatsapp, "#25D366");
    makeCard("ايميل", email, email ? `mailto:${email}` : "", ICON.email, "#a78bfa", "is-email");

    // Social icons (circular, one row)
    const s = (c.social || {});
    const SICON = {
      instagram: { label:"Instagram", color:"#E1306C", svg:`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 4.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2zm0 2A1.8 1.8 0 1 0 13.8 12 1.8 1.8 0 0 0 12 10.2zM17.2 6.9a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z"/></svg>`},
      telegram: { label:"Telegram", color:"#2AABEE", svg:`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.8 4.6c.2-.8-.6-1.4-1.3-1.1L2.7 10.4c-.9.4-.8 1.7.1 2l4.6 1.5 1.8 5.7c.2.7 1.1.9 1.6.4l2.6-2.5 5.1 3.8c.6.4 1.4.1 1.6-.7l3-15zM9.6 14.2l8.8-7.6-6.9 9.1-.3 3.7-1.8-5.2z"/></svg>`},
      x: { label:"X", color:"#ffffff", svg:`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.9 7.9L23 22h-6.7l-5.2-6.7L5.2 22H2l7.4-8.5L1 2h6.7l4.7 6.1L18.9 2zm-1.1 18h1.7L6.2 4H4.4l13.4 16z"/></svg>`},
      youtube: { label:"YouTube", color:"#FF0000", svg:`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.9 4.6 12 4.6 12 4.6s-5.9 0-7.5.5A3 3 0 0 0 2.4 7.2 31 31 0 0 0 2 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.6.5 7.5.5 7.5.5s5.9 0 7.5-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z"/></svg>`},
      facebook: { label:"Facebook", color:"#1877F2", svg:`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 22v-8h2.7l.4-3H13.5V9.2c0-.9.2-1.5 1.5-1.5h1.6V5.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V11H8v3h2.2v8h3.3z"/></svg>`}
    };

    const addSocial = (key, url) => {
      if (!url) return;
      const meta = SICON[key];
      if (!meta) return;
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", meta.label);
      a.title = meta.label;
      a.style.color = meta.color;
      a.innerHTML = meta.svg;
      social.appendChild(a);
    };

    addSocial("instagram", s.instagram);
    addSocial("telegram", s.telegram);
    addSocial("x", s.x);
    addSocial("youtube", s.youtube);
    addSocial("facebook", s.facebook);
  }

  // PWA install prompt

  const isStandalone = () =>
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;

  let deferredPrompt = null;
  let installTimeoutId = null;

  const installBar = $("installBar");
  const installBtn = $("installBtn");
  const installLater = $("installLater");

  const DISMISS_KEY = "pwa_install_dismissed_at";
  // "لاحقًا" يخفي البطاقة لمدة 24 ساعة فقط
  const DISMISS_MS = 24 * 60 * 60 * 1000;

  const wasDismissedRecently = () => {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (!ts) return false;
    return Date.now() - ts < DISMISS_MS;
  };

  const maybeShowInstallBar = () => {
    if (!deferredPrompt) return;
    if (isStandalone()) return;
    if (wasDismissedRecently()) return;
    installBar.classList.remove("hidden");
    installBar.style.display = "flex";
  };

  window.addEventListener("beforeinstallprompt", (e) => {
    // Chrome/Edge فقط: نخزّن الحدث ونمنع ظهور نافذة التثبيت التلقائي
    e.preventDefault();
    deferredPrompt = e;

    // لا نظهر شريط التثبيت مباشرة: ننتظر 20 ثانية
    if (installTimeoutId) clearTimeout(installTimeoutId);
    installTimeoutId = setTimeout(maybeShowInstallBar, 20000);
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    if (installTimeoutId) clearTimeout(installTimeoutId);
    installBar.classList.add("hidden");
    installBar.style.display = "none";
    localStorage.removeItem(DISMISS_KEY);
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    // prompt() لازم يكون داخل تفاعل المستخدم (click)
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
      installBar.classList.add("hidden");
      installBar.style.display = "none";
    }
  });

  installLater.addEventListener("click", () => {
    installBar.classList.add("hidden");
    installBar.style.display = "none";
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  });

  // init
  renderCategories();
  renderContact();

  // On initial load (including pull-to-refresh), restore the view from URL hash/state
  // instead of forcing Home every time.
  (function restoreInitialRoute(){
    const st = (history && history.state) ? history.state : {};
    const h = location.hash || "";

    const getFromHash = (prefix) => {
      if (!h.startsWith(prefix)) return null;
      try { return decodeURIComponent(h.slice(prefix.length)); } catch { return h.slice(prefix.length); }
    };

    if ((st && st.view === "details") || h.startsWith("#details-")) {
      const id = (st && st.ringtoneId) || getFromHash("#details-");
      if (id) openDetails(id, { push: false });
      else openHome({ push: false });
      return;
    }

    if ((st && st.view === "list") || h.startsWith("#list-")) {
      const catId = (st && st.catId) || getFromHash("#list-");
      if (catId) openList(catId, { push: false, restoreScroll: true });
      else openHome({ push: false });
      return;
    }

    openHome({ push: false });
  })();
})();
