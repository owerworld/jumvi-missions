// Safe localStorage helpers (avoid crashes in private/offline modes)
const lsGet = (key, fallback = null) => {
  try{
    const val = localStorage.getItem(key);
    return val ?? fallback;
  }catch(_){
    return fallback;
  }
};
const lsGetJSON = (key, fallback) => {
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(_){
    return fallback;
  }
};
const lsSet = (key, value) => {
  try{ localStorage.setItem(key, value); }catch(_){ }
};
const storageAvailable = (()=>{
  try{
    const k = "__jumvi_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  }catch(_){
    return false;
  }
})();

const _lsDebounceTimers = new Map();
function lsSetDebounced(key, value, delay=500){
  if(!storageAvailable) return;
  if(_lsDebounceTimers.has(key)) clearTimeout(_lsDebounceTimers.get(key));
  const t = setTimeout(()=>{ lsSet(key, value); }, delay);
  _lsDebounceTimers.set(key, t);
}

/** =======================
 * Disable zoom (modern, less aggressive)
 * ======================= */
(function disableZoom(){
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if(!isIOS) return;
  let lastTouchEnd = 0;
  document.addEventListener("touchend", function(e){
    const now = Date.now();
    if(now - lastTouchEnd <= 300){ e.preventDefault(); }
    lastTouchEnd = now;
  }, { passive:false });
})();

/** =======================
 * Sound (Web Audio) — works on iOS after first user tap
 * ======================= */
const SOUND_KEY = "jumvi_sound_on_v1";
let soundOn = (lsGet(SOUND_KEY, "1")) === "1";
let audioCtx = null;

function ensureAudio(){
  if(!soundOn) return null;
  if(!audioCtx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    audioCtx = new AC();
  }
  if(audioCtx.state === "suspended"){
    // will resume on user gesture
    audioCtx.resume().catch(()=>{});
  }
  return audioCtx;
}

function clickSound(type="click"){
  if(!soundOn) return;
  const ctx = ensureAudio();
  if(!ctx) return;
  const t0 = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // short, soft UI click
  osc.type = "triangle";
  osc.frequency.setValueAtTime(type==="success" ? 820 : 1050, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(type==="success" ? 0.08 : 0.06, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t0);
  osc.stop(t0 + 0.07);
}

const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** =======================
 * Toast (small notification)
 * ======================= */
let toastTimer = null;
function showToast(msg){
  const el = document.getElementById("toast");
  const live = document.getElementById("statusLive");
  if(!el) return;
  el.textContent = msg;
  if(live) live.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.remove("show"), 1800);
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function withTimeout(promise, ms){
  let t;
  const timeout = new Promise((_, rej)=>{ t = setTimeout(()=>rej(new Error("timeout")), ms); });
  return Promise.race([promise, timeout]).finally(()=> clearTimeout(t));
}
async function waitForImages(root, timeoutMs=3000){
  try{
    const imgs = Array.from(root.querySelectorAll("img"));
    if(!imgs.length) return true;
    const waits = imgs.map(img=>{
      if(img.complete && img.naturalWidth > 0) return Promise.resolve(true);
      return new Promise(resolve=>{
        const done = ()=>{ img.removeEventListener("load", done); img.removeEventListener("error", done); resolve(true); };
        img.addEventListener("load", done, { once:true });
        img.addEventListener("error", done, { once:true });
      });
    });
    await withTimeout(Promise.all(waits), timeoutMs);
    return true;
  }catch(_){ return false; }
}

function celebrate(){
  if(prefersReducedMotion) return;
  try{
    // Prefer canvas-confetti when available
    if(window.confetti){
      const origin = { x: 0.5, y: 0.75 };
      window.confetti({ particleCount: 70, spread: 70, origin });
      window.confetti({ particleCount: 40, spread: 110, origin, startVelocity: 35 });
      return;
    }
  }catch(_){}

  // Fallback: tiny star burst
  const root = document.createElement("div");
  root.className = "fxBurst";
  const stars = ["⭐","✨","🌟","💫","🎉"];
  for(let i=0;i<18;i++){
    const s = document.createElement("div");
    s.className = "fxStar";
    s.textContent = stars[i % stars.length];
    const cx = window.innerWidth * (0.25 + Math.random()*0.5);
    const cy = window.innerHeight * (0.35 + Math.random()*0.35);
    const dx = (Math.random()*2-1) * 140;
    const dy = (Math.random()*2-1) * 180;
    s.style.left = cx + "px";
    s.style.top  = cy + "px";
    s.style.setProperty("--x0", "0px");
    s.style.setProperty("--y0", "0px");
    s.style.setProperty("--x1", dx + "px");
    s.style.setProperty("--y1", dy + "px");
    root.appendChild(s);
  }
  document.body.appendChild(root);
  setTimeout(()=>{ try{ root.remove(); }catch(_){} }, 950);
}

/** =======================
 * Confetti (tiny, no library)
 * ======================= */
function fireConfetti(durationMs=1100){
  if(prefersReducedMotion) return;
  const canvas = document.getElementById("confettiCanvas");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const resize = ()=>{
    canvas.width  = Math.floor(window.innerWidth * DPR);
    canvas.height = Math.floor(window.innerHeight * DPR);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(DPR,0,0,DPR,0,0);
  };
  resize();
  canvas.style.display = "block";

  const colors = ["#4FB3FF","#97D700","#FF6A00","#EAF2FF"];
  const parts = [];
  const n = 130;

  for(let i=0;i<n;i++){
    parts.push({
      x: Math.random()*window.innerWidth,
      y: -20 - Math.random()*window.innerHeight*0.4,
      r: 3 + Math.random()*4,
      vx: -2.5 + Math.random()*5,
      vy: 2 + Math.random()*5,
      rot: Math.random()*Math.PI,
      vr: -0.2 + Math.random()*0.4,
      c: colors[Math.floor(Math.random()*colors.length)],
      a: 0.9
    });
  }

  const tStart = performance.now();
  function step(t){
    const elapsed = t - tStart;
    ctx.clearRect(0,0,window.innerWidth, window.innerHeight);

    parts.forEach(p=>{
      p.vy += 0.045; // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.a = Math.max(0, 0.9 - elapsed/(durationMs*1.15));

      ctx.save();
      ctx.globalAlpha = p.a;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r, -p.r, p.r*2.2, p.r*1.2);
      ctx.restore();
    });

    if(elapsed < durationMs){
      requestAnimationFrame(step);
    }else{
      canvas.style.display = "none";
      ctx.clearRect(0,0,window.innerWidth, window.innerHeight);
    }
  }
  requestAnimationFrame(step);
}

/** =======================
 * Ensure iOS audio works (resume on first tap)
 * ======================= */
let audioUnlocked = false;
function unlockAudioOnce(){
  if(audioUnlocked || !soundOn) return;
  const ctx = ensureAudio();
  if(ctx){
    ctx.resume().then(()=>{ audioUnlocked = true; }).catch(()=>{});
  }
}
window.addEventListener("pointerdown", unlockAudioOnce, { passive:true });
window.addEventListener("touchstart", unlockAudioOnce, { passive:true });

/** =======================
 * Certificate helpers
 * ======================= */
const CERT_ID_KEY   = "jumvi_cert_id_v1";
const CERT_NAME_KEY = "jumvi_cert_name_v1";

function getCertId(){
  let id = lsGet(CERT_ID_KEY);
  if(id) return id;
  // simple readable id: JUMVI-XXXX-XXXX
  const rand = ()=> Math.random().toString(16).slice(2,6).toUpperCase();
  id = `JUMVI-${rand()}-${rand()}`;
  lsSet(CERT_ID_KEY, id);
  return id;
}
function getToday(){
  try{
    return new Date().toLocaleDateString("en-US", { year:"numeric", month:"short", day:"2-digit" });
  }catch(e){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
}

const CERT_TEMPLATE_SOURCES = ["certificate-template.webp", "certificate-template.png"];
const CERT_NAME_COLOR = "#1d4ed8";
const CERT_META_COLOR = "#475569";
const CERT_NAME_FONT = "700 64px 'Poppins', 'Helvetica Neue', Arial, sans-serif";
const CERT_META_FONT = "600 20px 'Poppins', 'Helvetica Neue', Arial, sans-serif";

function loadImage(src){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=> resolve(img);
    img.onerror = ()=> reject(new Error("img_load_failed"));
    img.src = src;
  });
}
async function loadImageWithFallback(sources){
  for(const src of sources){
    try{
      const img = await loadImage(src);
      return img;
    }catch(_){}
  }
  throw new Error("img_load_failed");
}
function fitText(ctx, text, maxWidth, startSize, fontFamily){
  let size = startSize;
  while(size > 22){
    ctx.font = `700 ${size}px ${fontFamily}`;
    if(ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return size;
}

async function renderSimpleCertificateBlob(){
  try{
    const name = (certNameInput && certNameInput.value || "JUMVI Champion").trim() || "JUMVI Champion";
    const dateText = getToday();
    const certId = getCertId();

    const img = await loadImageWithFallback(CERT_TEMPLATE_SOURCES);
    const width = img.naturalWidth || 1600;
    const height = img.naturalHeight || 1200;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Draw template
    ctx.drawImage(img, 0, 0, width, height);

    // Name (centered, on the dotted line area)
    const nameX = width * 0.5;
    const nameY = height * 0.555;
    const maxNameWidth = width * 0.62;
    const baseNameSize = Math.round(width * 0.055);
    const nameSize = fitText(ctx, name, maxNameWidth, baseNameSize, "'Poppins', 'Helvetica Neue', Arial, sans-serif");
    ctx.fillStyle = CERT_NAME_COLOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${nameSize}px 'Poppins', 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillText(name, nameX, nameY);

  // Meta (top-right) - draw directly on template (no box)
  const metaX = width * 0.93;
  const metaY = height * 0.105;
  const lineGap = height * 0.028;
  const m1 = `Completed on: ${dateText}`;
  const m2 = `Certificate ID: ${certId}`;
  ctx.fillStyle = CERT_META_COLOR;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.font = CERT_META_FONT;
  ctx.fillText(m1, metaX, metaY);
  ctx.fillText(m2, metaX, metaY + lineGap);

    // Footer branding
    const footerY = height * 0.965;
    const footerSize = Math.round(width * 0.018);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${footerSize}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillStyle = "rgba(80,80,100,0.55)";
    ctx.fillText("🎾 JUMVI Toss & Catch Paddle Set • Available on Amazon", width * 0.5, footerY);

    return await new Promise(res=>canvas.toBlob(res, "image/png", 1.0));
  }catch(_){
    return null;
  }
}


/** =======================
 * State
 * ======================= */
const LS_KEY = "jumvi_missions_done_v3";
const ONLY_KEY = "jumvi_only_unfinished_v1";

/* UI + persistence */
const PACK_KEY          = "jumvi_current_pack_v1";
const SOLIDBG_KEY       = "jumvi_solid_bg_v1";
const KIDSMODE_KEY      = "jumvi_kids_mode_v1";
const STREAK_COUNT_KEY  = "jumvi_streak_count_v1";
const STREAK_BEST_KEY   = "jumvi_streak_best_v1";
const STREAK_LAST_KEY   = "jumvi_streak_last_v1";
const DAILY_DATE_KEY    = "jumvi_daily_date_v1";
const DAILY_ID_KEY      = "jumvi_daily_id_v1";
const DAILY_N_KEY       = "jumvi_daily_n_v1";
const A2HS_DISMISS_KEY  = "jumvi_a2hs_dismiss_v1";
const ONBOARD_KEY       = "jumvi_onboarded_v2";
const AGE_KEY           = "jumvi_age_v2";
const AVATAR_KEY        = "jumvi_avatar_v1";
const AUTO_DONE_KEY     = "jumvi_auto_done_v1";
const ATTEMPTS_KEY      = "jumvi_attempts_v1";
const SKIPS_KEY         = "jumvi_skips_v1";
const THEME_KEY         = "jumvi_theme_v1";

const CATEGORY_OPTIONS = ["all","Reflex","Aim","Focus","Team","Indoor"];
const PLAYERS_OPTIONS = ["all","Solo","2","3+"];
const DIFFICULTY_OPTIONS = ["all","Easy","Medium"];
const AVATARS = ["🦁","🐶","🦕","🦄","👽","🤖","🦊","🐼"];

const state = {
  done: new Set(lsGetJSON(LS_KEY, [])),
  unlockedBefore: false,
  onlyUnfinished: (lsGet(ONLY_KEY, "0")) === "1",
  currentPack: lsGet(PACK_KEY, "all"),
  currentCategory: "all",
  currentPlayers: "all",
  currentDifficulty: "all",
  searchQuery: "",
  lastOpenedId: null,
  solidBg: (lsGet(SOLIDBG_KEY, "0")) === "1",
  kidsMode: (lsGet(KIDSMODE_KEY, "0")) === "1",
  streakCount: Number(lsGet(STREAK_COUNT_KEY, "0")),
  bestStreak: Number(lsGet(STREAK_BEST_KEY, "0")),
  lastActiveIso: lsGet(STREAK_LAST_KEY, ""),
  dailyIso: lsGet(DAILY_DATE_KEY, ""),
  dailyIdStored: Number(lsGet(DAILY_ID_KEY, "0")),
  dailyN: Number(lsGet(DAILY_N_KEY, "0")),
  currentAvatarIdx: Number(lsGet(AVATAR_KEY, "0")),
  autoDoneOnEnd: (lsGet(AUTO_DONE_KEY, "0")) === "1",
  attempts: lsGetJSON(ATTEMPTS_KEY, {}),
  skips: lsGetJSON(SKIPS_KEY, {}),
  themeMode: lsGet(THEME_KEY, "system")
};
if(isNaN(state.currentAvatarIdx) || state.currentAvatarIdx < 0) state.currentAvatarIdx = 0;
state.unlockedBefore = state.done.size >= missions.length;

const done = state.done;
let unlockedBefore = state.unlockedBefore;
let onlyUnfinished = state.onlyUnfinished;
let currentPack = state.currentPack;
let currentCategory = state.currentCategory;
let currentPlayers = state.currentPlayers;
let currentDifficulty = state.currentDifficulty;
let searchQuery = state.searchQuery;
let lastOpenedId = state.lastOpenedId;
let solidBg = state.solidBg;
let kidsMode = state.kidsMode;
let streakCount = state.streakCount;
let bestStreak  = state.bestStreak;
let lastActiveIso = state.lastActiveIso;
let dailyIso = state.dailyIso;
let dailyIdStored = state.dailyIdStored;
let dailyN = state.dailyN;
let currentAvatarIdx = state.currentAvatarIdx;
let autoDoneOnEnd = state.autoDoneOnEnd;
let attempts = state.attempts;
let skips = state.skips;
let themeMode = state.themeMode;

function setState(key, value){
  state[key] = value;
  return value;
}

/** =======================
 * Refs
 * ======================= */
const listEl = document.getElementById("list");
const filtersEl = document.getElementById("filters");
const filterCategoryEl = document.getElementById("filterCategory");
const filterPlayersEl = document.getElementById("filterPlayers");
const filterDifficultyEl = document.getElementById("filterDifficulty");
const progressText = document.getElementById("progressText");
const progressSub = document.getElementById("progressSub");
const progressFill = document.getElementById("progressBarFill");
const certBtn = document.getElementById("certBtn");
const certSub = document.getElementById("certSub");
const badgesRow = document.getElementById("badgesRow");

const backdrop = document.getElementById("backdrop");
const btnClose = document.getElementById("btnClose");
const sheet = document.getElementById("sheet");

const mTitle = document.getElementById("mTitle");
const mMeta  = document.getElementById("mMeta");
const mSteps = document.getElementById("mSteps");
const mWin   = document.getElementById("mWin");
const mTip   = document.getElementById("mTip");
const mKidsTip = document.getElementById("mKidsTip");
const mSafety= document.getElementById("mSafety");
const mHint = document.getElementById("mHint");
const holdHint = document.getElementById("holdHint");
const dashReport = document.getElementById("dashReport");
const dashBars = document.getElementById("dashBars");
const seasonalBackdrop = document.getElementById("seasonalBackdrop");
const seasonalList = document.getElementById("seasonalList");
const seasonalSub = document.getElementById("seasonalSub");
const btnSeasonalClose = document.getElementById("btnSeasonalClose");
const btnSeasonalIndoor = document.getElementById("btnSeasonalIndoor");
const btnSeasonalOutdoor = document.getElementById("btnSeasonalOutdoor");
const themeToggle = document.getElementById("themeToggle");
const btnHeaderPlay = document.getElementById("btnHeaderPlay");
const mSmall = document.getElementById("mSmall");

const btnToggleDone = document.getElementById("btnToggleDone");
const btnNext = document.getElementById("btnNext");
const btnRandomPack = document.getElementById("btnRandomPack");

const badgesBackdrop = document.getElementById("badgesBackdrop");
const btnBadgesClose = document.getElementById("btnBadgesClose");
const badgesList = document.getElementById("badgesList");

const searchInput = document.getElementById("searchInput");
const btnOnlyUnfinished = document.getElementById("btnOnlyUnfinished");
const soundToggle = document.getElementById("soundToggle");

const btnSolidBg = document.getElementById("btnSolidBg");
const btnKidsMode = document.getElementById("btnKidsMode");
const btnBackup = document.getElementById("btnBackup");

const streakPill = document.getElementById("streakPill");

const dailyBox = document.getElementById("dailyBox");
const dailyIcon = document.getElementById("dailyIcon");
const dailyName = document.getElementById("dailyName");
const dailyMeta = document.getElementById("dailyMeta");
const btnDailyPlay = document.getElementById("btnDailyPlay");
const btnDailyNew = document.getElementById("btnDailyNew");

const a2hsBanner = document.getElementById("a2hsBanner");
const a2hsHint = document.getElementById("a2hsHint");
const btnA2hsClose = document.getElementById("btnA2hsClose");

const backupBackdrop = document.getElementById("backupBackdrop");
const btnBackupClose = document.getElementById("btnBackupClose");
const backupCode = document.getElementById("backupCode");
const restoreInput = document.getElementById("restoreInput");
const btnBackupCopy = document.getElementById("btnBackupCopy");
const btnBackupRefresh = document.getElementById("btnBackupRefresh");
const btnRestore = document.getElementById("btnRestore");


const certBackdrop = document.getElementById("certBackdrop");
const btnCertClose = document.getElementById("btnCertClose");
const certNameInput = document.getElementById("certNameInput");
const certMetaLine  = document.getElementById("certMetaLine");
const certPreviewImg = document.getElementById("certPreviewImg");
const btnCertSavePng = document.getElementById("btnCertSavePng");
const btnCertSavePdf = document.getElementById("btnCertSavePdf");

/* Save Overlay Refs (iOS long-press fallback) */
const saveOverlay = document.getElementById("saveOverlay");
const saveOverlayClose = document.getElementById("saveOverlayClose");
const saveOpenBtn = document.getElementById("saveOpenBtn");
const saveImg = document.getElementById("saveImg");
const saveSub = document.getElementById("saveSub");
const fallbackBackdrop = document.getElementById("fallbackBackdrop");
const fallbackCloseBtn = document.getElementById("fallbackCloseBtn");

function showSaveOverlay(imgUrl, subText){
  if(!saveOverlay) return;
  if(saveSub && typeof subText === "string") saveSub.textContent = subText;
  saveOverlay.dataset.url = imgUrl || "";
  if(saveImg){
    if(imgUrl){
      saveImg.style.display = "block";
      saveImg.src = imgUrl;
    }else{
      saveImg.style.display = "none";
      saveImg.src = "";
    }
  }
  saveOverlay.classList.add("show");
  saveOverlay.setAttribute("aria-hidden","false");
}
function hideSaveOverlay(){
  if(!saveOverlay) return;
  const url = saveOverlay.dataset.url;
  if(url) try{ URL.revokeObjectURL(url); }catch(_){}
  saveOverlay.dataset.url = "";
  if(saveImg){
    saveImg.src = "";
    saveImg.style.display = "block";
  }
  if(saveSub){
    saveSub.textContent = "Tap and hold the image → Save Image";
  }
  saveOverlay.classList.remove("show");
  saveOverlay.setAttribute("aria-hidden","true");
}
if(saveOverlayClose) saveOverlayClose.onclick = hideSaveOverlay;
if(saveOpenBtn) saveOpenBtn.onclick = ()=>{ const url = saveOverlay?.dataset?.url || ""; if(url) openImageForSave(url); };
if(saveOverlay){
  saveOverlay.addEventListener("click",(e)=>{ if(e.target===saveOverlay) hideSaveOverlay(); });
}

function showFallbackModal(){
  if(fallbackBackdrop) fallbackBackdrop.classList.add("show");
}
function hideFallbackModal(){
  if(fallbackBackdrop) fallbackBackdrop.classList.remove("show");
}
if(fallbackCloseBtn){
  fallbackCloseBtn.onclick = ()=>{ try{ clickSound("click"); }catch(_){ } hideFallbackModal(); };
}
if(fallbackBackdrop){
  fallbackBackdrop.addEventListener("click",(e)=>{ if(e.target===fallbackBackdrop) hideFallbackModal(); });
}

/* New Feature Refs */
const avatarBtn = document.getElementById("avatarBtn");
const btnSpeak = document.getElementById("btnSpeak");
const btnStartTimer = document.getElementById("btnStartTimer");
const timerUI = document.getElementById("timerUI");
const timerDisplay = document.getElementById("timerDisplay");
const timerFill = document.getElementById("timerFill");
const autoDoneToggle = document.getElementById("autoDoneToggle");


/* ===== Kid-friendly Voice (TTS) ===== */
let kidVoice = null;

function pickKidVoice(voices){
  const list = (voices || []).filter(v => (v.lang || "").toLowerCase().startsWith("en"));
  if(!list.length) return null;

  const prefer = [
    "Samantha","Karen","Tessa","Serena","Jenny","Aria","Zira",
    "Google US English","Google UK English Female","Microsoft Aria"
  ];

  function score(v){
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase();
    let s = 0;

    if(lang.startsWith("en-us")) s += 4;
    if(lang.startsWith("en-gb")) s += 2;
    if(v.localService) s += 1;

    // Prefer bright/friendly voices (heuristic)
    if(name.includes("female")) s += 4;
    if(name.includes("child") || name.includes("kid")) s += 6;
    if(name.includes("male")) s -= 4;
    if(name.includes("fred")) s -= 6;

    for(const p of prefer){
      if(name.includes(p.toLowerCase())) s += 6;
    }
    return s;
  }

  return list.sort((a,b)=>score(b)-score(a))[0] || null;
}

function loadKidVoice(){
  try{
    const voices = window.speechSynthesis.getVoices();
    kidVoice = pickKidVoice(voices);
  }catch(e){
    kidVoice = null;
  }
}

if("speechSynthesis" in window){
  loadKidVoice();
  window.speechSynthesis.onvoiceschanged = loadKidVoice;
}


/** =======================
 * Helpers
 * ======================= */
function hideReadToMeIfUnsupported(){
  if(!btnSpeak) return;
  if(!("speechSynthesis" in window)) btnSpeak.style.display = "none";
}

function persist(){
  lsSetDebounced(LS_KEY, JSON.stringify([...done]), 500);
}
function persistOnly(){
  lsSetDebounced(ONLY_KEY, onlyUnfinished ? "1" : "0", 500);
}
function persistAttempts(){
  lsSetDebounced(ATTEMPTS_KEY, JSON.stringify(attempts), 500);
}
function persistSkips(){
  lsSetDebounced(SKIPS_KEY, JSON.stringify(skips), 500);
}
function getAttemptCount(id){
  return Number(attempts?.[id] || 0);
}
function incAttempt(id){
  if(id==null) return;
  attempts[id] = getAttemptCount(id) + 1;
  persistAttempts();
}
function incSkip(id){
  if(id==null) return;
  const cur = Number(skips?.[id] || 0);
  skips[id] = cur + 1;
  persistSkips();
}

function topSkippedText(){
  const entries = Object.entries(skips || {})
    .map(([id,count])=>({ id:Number(id), count:Number(count)||0 }))
    .filter(x=>x.count>0)
    .sort((a,b)=>b.count - a.count)
    .slice(0,3);
  if(!entries.length) return "";
  const names = entries
    .map(e=>missions.find(m=>m.id===e.id)?.title)
    .filter(Boolean);
  if(!names.length) return "";
  return `Top skipped missions: ${names.join(", ")}`;
}
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function diffLabel(d){
  if(d===1) return "Easy";
  if(d===2) return "Medium";
  return "Hard";
}

function pickByKey(key, list){
  if(!list || list.length === 0) return "";
  const h = hashFNV1a(String(key));
  return list[h % list.length];
}

function getSafetyText(ms){
  const basePool = [
    "Throw softly below face level. Stay 1–3 m apart. Adult supervision required.",
    "Adult supervision required. Keep throws gentle and below face level. Stay 1–3 m apart.",
    "Soft tosses only. Keep 1–3 m distance and aim below face level. Play with an adult nearby.",
    "Stay 1–3 m apart. Throw gently and below face level. An adult should be nearby.",
    "Keep it gentle: soft throws, below face level, 1–3 m apart, adult supervision."
  ];

  const packPool = {
    "Reflex Rush": [
      "Focus on control: soft throws below face level, 1–3 m apart, adult nearby.",
      "Quick does not mean hard: gentle throws below face level, 1–3 m apart, adult supervision."
    ],
    "Aim Master": [
      "Aim first, then throw soft: below face level, 1–3 m apart, adult nearby.",
      "Keep targets close: 1–3 m apart, soft throws below face level, adult supervision."
    ],
    "Focus Control": [
      "Slow and steady: soft throws below face level, 1–3 m apart, adult nearby.",
      "Stay calm and safe: gentle throws below face level, 1–3 m apart, adult supervision."
    ],
    "Team Duo": [
      "Give each player space: 1–3 m apart, soft throws below face level, adult supervision.",
      "Team safety: gentle throws, below face level, 1–3 m apart, adult nearby."
    ],
    "Indoor Compact": [
      "Indoor safe play: soft throws below face level, 1–3 m apart, adult supervision. Clear area from breakables.",
      "Small space rules: gentle throws below face level, 1–3 m apart, adult nearby. Clear area from breakables."
    ]
  };

  const packList = packPool[ms.pack] || [];
  const base = packList.length ? pickByKey(`${ms.id}|${ms.pack}|${ms.difficulty}`, packList) : pickByKey(`${ms.id}|base`, basePool);
  const extra = String(ms.safety || "").trim();
  const genericSafetyRe = /(below face level|1–3|1-3|soft|gentle|adult)/i;
  if(extra && !genericSafetyRe.test(extra) && !base.toLowerCase().includes(extra.toLowerCase())) return `${base} ${extra}`;
  return base;
}

function getKidsTip(ms){
  const tipsByPack = {
    "Reflex Rush": [
      "Try a small step back only after 3 clean catches.",
      "Keep your elbows close to your body.",
      "Watch the ball all the way into your hands."
    ],
    "Aim Master": [
      "Point your belly button at the target.",
      "Use two hands to aim, then one to throw.",
      "Say “target” out loud before you throw."
    ],
    "Focus Control": [
      "Breathe slowly and count in your head.",
      "Freeze your feet like statues before each throw.",
      "Use a quiet voice to stay calm."
    ],
    "Team Duo": [
      "Call your partner’s name before you throw.",
      "Take turns and cheer for each other.",
      "If someone drops, give a friendly high‑five."
    ],
    "Indoor Compact": [
      "Use short, easy throws in small spaces.",
      "Stand on a small floor mark to stay steady.",
      "Keep throws low and slow indoors."
    ]
  };

  const list = tipsByPack[ms.pack] || [];
  const base = list.length ? pickByKey(`${ms.id}|${ms.pack}|${ms.difficulty}`, list) : "Watch the ball and use two hands if needed.";
  return base;
}

function buildSoftHints(ms){
  const hints = [
    "Try standing a little closer.",
    "Use two hands to catch for extra control.",
    "Slow the throws down and focus on clean catches."
  ];
  if(String(ms.players).includes("1")) hints.push("Short, gentle tosses are best for solo play.");
  if(ms.pack === "Indoor Compact") hints.push("Keep throws low and soft indoors.");
  return hints;
}

function getWeekKey(d = new Date()){
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}

function parseTimeSecs(timeStr){
  if(!timeStr) return 60;
  const m = String(timeStr).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 60;
}

function getEstimatedPlayMinutes(){
  let total = 0;
  for(const id of done){
    const ms = missions.find(x=>x.id===id);
    if(ms) total += parseTimeSecs(ms.time);
  }
  return Math.round(total / 60);
}

function getTopSkill(counts){
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).filter(([,v])=>v>0);
  return top.length ? top[0][0] : null;
}

function getMilestoneLine(counts){
  const top = Object.entries(counts)
    .sort((a,b)=>b[1]-a[1])
    .filter(([,v])=>v>0)
    .slice(0,2)
    .map(([k])=>k);
  if(!top.length){
    return "This week supported steady focus and coordination.";
  }
  if(top.length === 1){
    return `Nice progress in ${top[0].toLowerCase()} this week.`;
  }
  return `Great progress in ${top[0].toLowerCase()} and ${top[1].toLowerCase()} this week.`;
}

function renderParentDashboard(){
  if(!dashBars || !dashReport) return;
  const packs = [
    { key:"Reflex Rush", label:"Reflex", icon:"⚡" },
    { key:"Aim Master", label:"Aim", icon:"🎯" },
    { key:"Focus Control", label:"Focus", icon:"🧘" },
    { key:"Team Duo", label:"Team", icon:"👥" },
    { key:"Indoor Compact", label:"Indoor", icon:"🏠" }
  ];
  const counts = {};
  const frag = document.createDocumentFragment();
  packs.forEach(p=>{
    const doneCount = missions.filter(m=>m.pack===p.key && done.has(m.id)).length;
    counts[p.label] = doneCount;
    const pct = Math.round((doneCount / 6) * 100);
    const row = document.createElement("div");
    row.className = "dashRow";
    const icon = document.createElement("div");
    icon.className = "dashIcon";
    icon.textContent = p.icon;
    const label = document.createElement("div");
    label.className = "dashLabel";
    label.textContent = p.label;
    const bar = document.createElement("div");
    bar.className = "dashBar";
    const fill = document.createElement("div");
    fill.className = "dashFill";
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    const count = document.createElement("div");
    count.className = "dashCount";
    count.textContent = `${doneCount}/6`;
    row.appendChild(icon);
    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(count);
    frag.appendChild(row);
  });
  dashBars.replaceChildren(frag);
  dashReport.textContent = getMilestoneLine(counts);

  // Stats row
  const statsEl = document.getElementById("dashStats");
  if(statsEl){
    const mins = getEstimatedPlayMinutes();
    const topSkill = getTopSkill(counts);
    const topSkillPack = topSkill ? [
      { key:"Reflex Rush", label:"Reflex", icon:"⚡" },
      { key:"Aim Master", label:"Aim", icon:"🎯" },
      { key:"Focus Control", label:"Focus", icon:"🧘" },
      { key:"Team Duo", label:"Team", icon:"👥" },
      { key:"Indoor Compact", label:"Indoor", icon:"🏠" }
    ].find(p=>p.label===topSkill) : null;
    statsEl.innerHTML = `
      <div class="dashStatItem"><span class="dashStatVal">${mins}</span><span class="dashStatLbl">min total play</span></div>
      <div class="dashStatItem"><span class="dashStatVal">${streakCount}</span><span class="dashStatLbl">day streak</span></div>
      ${topSkillPack ? `<div class="dashStatItem"><span class="dashStatVal">${topSkillPack.icon}</span><span class="dashStatLbl">top skill: ${topSkillPack.label}</span></div>` : ""}
    `;
  }
}

function applyTheme(){
  const root = document.documentElement;
  const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  let mode = themeMode;
  if(mode !== "dark" && mode !== "light") mode = "system";
  if(mode === "system"){
    root.classList.remove("theme--light","theme--dark");
    root.classList.add(systemDark ? "theme--dark" : "theme--light");
  }else{
    root.classList.remove("theme--light","theme--dark");
    root.classList.add(mode === "dark" ? "theme--dark" : "theme--light");
  }
  if(themeToggle){
    const label = mode === "system" ? "System" : (mode === "dark" ? "Dark" : "Light");
    const icons = { dark: "🌙", light: "☀️", system: "🌓" };
    themeToggle.textContent = icons[mode] || "🌓";
    themeToggle.setAttribute("aria-label", `Theme: ${label}`);
  }
}

function cycleTheme(){
  const order = ["system", "light", "dark"];
  const idx = order.indexOf(themeMode);
  themeMode = setState("themeMode", order[(idx + 1) % order.length]);
  lsSet(THEME_KEY, themeMode);
  applyTheme();
  try{ window.dispatchEvent(new Event("themechange")); }catch(_){ }
}

function mapPackToCategory(pack){
  if(pack === "Reflex Rush") return "Reflex";
  if(pack === "Aim Master") return "Aim";
  if(pack === "Focus Control") return "Focus";
  if(pack === "Team Duo") return "Team";
  if(pack === "Indoor Compact") return "Indoor";
  return "Other";
}
function normalizePlayers(str){
  const s = String(str || "");
  if(/1/.test(s) && !/2|3|4|5|6/.test(s)) return "Solo";
  if(/2/.test(s) && !/3|4|5|6|\+/.test(s)) return "2";
  return "3+";
}


/* ===== Local date (streak + daily) ===== */
function isoLocalDate(d=new Date()){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function isoToDate(iso){
  const parts = String(iso||"").split("-");
  if(parts.length!==3) return new Date();
  const y = Number(parts[0]), m = Number(parts[1]), d = Number(parts[2]);
  return new Date(y, (m||1)-1, d||1);
}
function yesterdayIso(isoToday){
  const dt = isoToDate(isoToday);
  dt.setDate(dt.getDate()-1);
  return isoLocalDate(dt);
}

/* ===== Modes ===== */
function applyBodyClasses(){
  document.body.classList.toggle("solidBg", !!solidBg);
  document.body.classList.toggle("kidsMode", !!kidsMode);
}
function renderModeChips(){
  if(btnSolidBg) btnSolidBg.classList.toggle("active", !!solidBg);
  if(btnKidsMode) btnKidsMode.classList.toggle("active", !!kidsMode);
}

/* ===== Streak ===== */
function persistStreak(){
  lsSetDebounced(STREAK_COUNT_KEY, String(streakCount), 500);
  lsSetDebounced(STREAK_BEST_KEY, String(bestStreak), 500);
  lsSetDebounced(STREAK_LAST_KEY, String(lastActiveIso||""), 500);
}
function recordActivityToday(){
  const today = isoLocalDate();
  if(lastActiveIso === today) return false; // already counted today
  if(lastActiveIso === yesterdayIso(today)){
    streakCount = setState("streakCount", Math.max(0, streakCount) + 1);
  }else{
    streakCount = setState("streakCount", 1);
  }
  bestStreak = setState("bestStreak", Math.max(bestStreak, streakCount));
  lastActiveIso = setState("lastActiveIso", today);
  persistStreak();
  return true;
}
function renderStreakUI(animate=false){
  if(!streakPill) return;
  const sc = streakCount || 0;
  if(sc === 0){
    streakPill.textContent = `🔥 Start your streak!`;
    streakPill.style.opacity = "0.55";
  } else {
    streakPill.textContent = `🔥 ${sc} day${sc === 1 ? "" : "s"} streak`;
    streakPill.style.opacity = "";
  }
  if(animate && streakCount > 0){
    streakPill.classList.remove("pulse");
    void streakPill.offsetWidth; // reflow to restart animation
    streakPill.classList.add("pulse");
    setTimeout(()=> streakPill.classList.remove("pulse"), 600);
  }
}

/* ===== Daily mission ===== */
function hashFNV1a(str){
  let h = 0x811c9dc5;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h + ((h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24))) >>> 0;
  }
  return h >>> 0;
}
function pickDailyId(iso, n){
  const h = hashFNV1a(`${iso}|${n}|JUMVI`);
  const idx = h % missions.length;
  return missions[idx].id;
}
function persistDaily(){
  lsSetDebounced(DAILY_DATE_KEY, String(dailyIso||""), 500);
  lsSetDebounced(DAILY_ID_KEY, String(dailyIdStored||0), 500);
  lsSetDebounced(DAILY_N_KEY, String(dailyN||0), 500);
}
function ensureDailyMission(){
  const today = isoLocalDate();
  if(dailyIso !== today){
    dailyIso = setState("dailyIso", today);
    dailyN = setState("dailyN", 0);
    dailyIdStored = setState("dailyIdStored", pickDailyId(today, dailyN));
    persistDaily();
  }
  if(!dailyIdStored || !missions.find(x=>x.id===dailyIdStored)){
    dailyIdStored = setState("dailyIdStored", pickDailyId(today, dailyN||0));
    persistDaily();
  }
}
function renderDailyUI(){
  ensureDailyMission();
  const ms = missions.find(x=>x.id===dailyIdStored);
  if(!ms) return;
  const doneToday = done.has(ms.id);

  if(dailyIcon) dailyIcon.textContent = doneToday ? "✅" : ms.icon;
  if(dailyName) dailyName.textContent = ms.title;
  if(dailyMeta){
    const contextHints = ["Great for first-time players!","Fun warm-up for today!","A quick favorite — try it!","Perfect for 5 minutes of play.","Challenge yourselves today!"];
    const hint = contextHints[ms.id % contextHints.length];
    dailyMeta.innerHTML = `
      <span class="tag pack">${escapeHtml(ms.pack)}</span>
      <span class="tag diff">${diffLabel(ms.difficulty)} • ${escapeHtml(ms.time)}</span>
      <span class="tag">👥 ${escapeHtml(ms.players)}</span>
      <span class="dailyHint">${hint}</span>
    `;
  }
  if(btnDailyPlay){
    btnDailyPlay.textContent = doneToday ? "✅ View" : "▶︎ Play";
  }
}

/* ===== A2HS helper ===== */
function isIOSWeb(){
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua);
  return isIOS && isSafari;
}
function isStandalone(){
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone;
}

// Android Add to Home Screen prompt
let deferredInstallPrompt = null;
const btnA2hsInstall = document.getElementById("btnA2hsInstall");
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  // Delay Android A2HS banner too — same 30s rule
  setTimeout(()=>{
    if(a2hsBanner && !isStandalone()) {
      if(a2hsHint) a2hsHint.textContent = "Install JUMVI for quick access.";
      const steps = document.getElementById("a2hsSteps");
      if(steps) steps.textContent = "Tap Install";
      a2hsBanner.style.display = "flex";
    }
  }, 30000);
});
if(btnA2hsInstall){
  btnA2hsInstall.onclick = async ()=>{
    if(!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try{ await deferredInstallPrompt.userChoice; }catch(_){ }
    deferredInstallPrompt = null;
    if(a2hsBanner) a2hsBanner.style.display = "none";
  };
}

function maybeShowA2HS(){
  if(!a2hsBanner) return;
  if(!isIOSWeb()) return;
  const dismissed = (lsGet(A2HS_DISMISS_KEY, "0")) === "1";
  if(dismissed || isStandalone()) return;
  if(a2hsHint) a2hsHint.textContent = "Full screen + offline support";
  const steps = document.getElementById("a2hsSteps");
  if(steps) steps.innerHTML = "Tap <b>Share</b> → <b>Add to Home Screen</b>";
  // Hide the Install button on iOS (beforeinstallprompt doesn't fire on iOS Safari)
  if(btnA2hsInstall) btnA2hsInstall.style.display = "none";
  a2hsBanner.style.display = "flex";
}

/* ===== Optional downloads ===== */
function disableOptionalLink(el, label){
  if(!el) return;
  el.classList.add("disabled");
  el.setAttribute("aria-disabled", "true");
  if(label) el.textContent = label;
  el.removeAttribute("href");
  el.removeAttribute("target");
  el.removeAttribute("rel");
}
async function checkOptionalDownloads(){
  const links = Array.from(document.querySelectorAll("[data-optional-file]"));
  if(!links.length) return;
  for(const link of links){
    const file = link.getAttribute("data-optional-file");
    if(!file) continue;
    try{
      const res = await fetch(file, { method: "HEAD", cache: "no-store" });
      if(res.ok) continue;
      if(res.status === 404 || res.status === 403){
        disableOptionalLink(link, "Coming soon");
      }
    }catch(_){
      // Offline: keep existing UI
    }
  }
}


/* ===== Backup / Restore ===== */
function b64UrlEncode(str){
  return str.replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function b64UrlDecode(str){
  const s = str.replace(/-/g,"+").replace(/_/g,"/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return s + pad;
}
function b64EncodeUnicode(s){
  return btoa(encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_,p)=>String.fromCharCode(parseInt(p,16))));
}
function b64DecodeUnicode(b64){
  return decodeURIComponent(Array.prototype.map.call(atob(b64), c => "%" + ("00"+c.charCodeAt(0).toString(16)).slice(-2)).join(""));
}
function buildBackupPayload(){
  return {
    v: 1,
    ts: Date.now(),
    done: [...done],
    onlyUnfinished,
    currentPack,
    soundOn,
    solidBg,
    kidsMode,
    streak: { c: streakCount||0, b: bestStreak||0, l: lastActiveIso||"" },
    daily:  { d: dailyIso||"", id: dailyIdStored||0, n: dailyN||0 },
    cert:   { name: lsGet(CERT_NAME_KEY) || "" },
    avatar: currentAvatarIdx
  };
}
function makeBackupCode(){
  const payload = JSON.stringify(buildBackupPayload());
  const b64 = b64EncodeUnicode(payload);
  return "JUMVI1." + b64UrlEncode(b64);
}
function applyBackupPayload(p){
  if(!p || p.v!==1) throw new Error("bad_version");

  // done
  setDoneFromArray(Array.isArray(p.done) ? p.done : []);
  persist();

  // toggles
  onlyUnfinished = setState("onlyUnfinished", !!p.onlyUnfinished);
  persistOnly();

  currentPack = setState("currentPack", String(p.currentPack || "all"));
  lsSet(PACK_KEY, currentPack);

  soundOn = !!p.soundOn;
  lsSet(SOUND_KEY, soundOn ? "1" : "0");

  solidBg = setState("solidBg", !!p.solidBg);
  lsSet(SOLIDBG_KEY, solidBg ? "1" : "0");

  kidsMode = setState("kidsMode", !!p.kidsMode);
  lsSet(KIDSMODE_KEY, kidsMode ? "1" : "0");

  // streak
  streakCount = setState("streakCount", Number(p.streak?.c || 0));
  bestStreak  = setState("bestStreak", Number(p.streak?.b || 0));
  lastActiveIso = setState("lastActiveIso", String(p.streak?.l || ""));
  persistStreak();

  // daily
  dailyIso = setState("dailyIso", String(p.daily?.d || ""));
  dailyIdStored = setState("dailyIdStored", Number(p.daily?.id || 0));
  dailyN = setState("dailyN", Number(p.daily?.n || 0));
  persistDaily();
  
  // Avatar
  if(typeof p.avatar === "number") {
    currentAvatarIdx = setState("currentAvatarIdx", p.avatar);
    lsSet(AVATAR_KEY, currentAvatarIdx);
    renderAvatar();
  }

  // certificate name (optional)
  if(p.cert && typeof p.cert.name === "string"){
    lsSet(CERT_NAME_KEY, p.cert.name);
    if(certNameInput) certNameInput.value = p.cert.name;
    buildCertificate();
  }

  // refresh UI
  btnOnlyUnfinished.classList.toggle("active", onlyUnfinished);
  applyBodyClasses();
  renderModeChips();
  renderSoundToggle();
  renderFilters();
  renderFilterGroups();
  renderList();
  renderStreakUI();
  renderDailyUI();
}

/** =======================
 * Rendering
 * ======================= */
let _visibleCacheKey = "";
let _visibleCacheList = [];
let _doneVersion = 0;

function bumpDoneVersion(){
  _doneVersion += 1;
  _visibleCacheKey = "";
}

function setDoneFromArray(arr){
  done.clear();
  (arr || []).forEach(id=> done.add(id));
  bumpDoneVersion();
}

function renderFilterGroups(){
  if(filterCategoryEl){
    filterCategoryEl.innerHTML = "";
    CATEGORY_OPTIONS.forEach(opt=>{
      const b = document.createElement("button");
      b.className = "chip" + (opt===currentCategory ? " active" : "");
      b.textContent = opt === "all" ? "All" : opt;
      b.onclick = ()=>{
        clickSound("click");
        currentCategory = setState("currentCategory", opt);
        renderFilterGroups();
        renderList();
      };
      filterCategoryEl.appendChild(b);
    });
  }
  if(filterPlayersEl){
    filterPlayersEl.innerHTML = "";
    PLAYERS_OPTIONS.forEach(opt=>{
      const b = document.createElement("button");
      b.className = "chip" + (opt===currentPlayers ? " active" : "");
      b.textContent = opt === "all" ? "All" : opt;
      b.onclick = ()=>{
        clickSound("click");
        currentPlayers = setState("currentPlayers", opt);
        renderFilterGroups();
        renderList();
      };
      filterPlayersEl.appendChild(b);
    });
  }
  if(filterDifficultyEl){
    filterDifficultyEl.innerHTML = "";
    DIFFICULTY_OPTIONS.forEach(opt=>{
      const b = document.createElement("button");
      b.className = "chip" + (opt===currentDifficulty ? " active" : "");
      b.textContent = opt === "all" ? "All" : opt;
      b.onclick = ()=>{
        clickSound("click");
        currentDifficulty = setState("currentDifficulty", opt);
        renderFilterGroups();
        renderList();
      };
      filterDifficultyEl.appendChild(b);
    });
  }
}

function renderFilters(){
  filtersEl.innerHTML = "";
  PACKS.forEach(p=>{
    const b = document.createElement("button");
    b.className = "chip" + (p.key===currentPack ? " active" : "");
    b.textContent = p.name;
    b.onclick = ()=>{
      clickSound("click");
      currentPack = setState("currentPack", p.key);
      lsSet(PACK_KEY, currentPack);
      renderFilters();
      renderList();
    };
    filtersEl.appendChild(b);
  });
}

function getVisibleMissions(){
  const key = [
    currentPack,
    currentCategory,
    currentPlayers,
    currentDifficulty,
    onlyUnfinished ? "1" : "0",
    searchQuery || "",
    String(_doneVersion)
  ].join("|");
  if(key === _visibleCacheKey) return _visibleCacheList;

  let list = missions;

  if(currentPack !== "all"){
    list = list.filter(x=>x.pack===currentPack);
  }

  if(currentCategory !== "all"){
    list = list.filter(x=>mapPackToCategory(x.pack) === currentCategory);
  }

  if(currentPlayers !== "all"){
    list = list.filter(x=>normalizePlayers(x.players) === currentPlayers);
  }

  if(currentDifficulty !== "all"){
    list = list.filter(x=>diffLabel(x.difficulty) === currentDifficulty);
  }

  if(onlyUnfinished){
    list = list.filter(x=>!done.has(x.id));
  }

  if(searchQuery){
    const q = searchQuery.toLowerCase();
    list = list.filter(x=>
      x.title.toLowerCase().includes(q) ||
      x.pack.toLowerCase().includes(q) ||
      x.steps.join(" ").toLowerCase().includes(q)
    );
  }

  list = list.slice().sort((a,b)=>
    (a.difficulty - b.difficulty) ||
    a.pack.localeCompare(b.pack) ||
    (a.id - b.id)
  );

  _visibleCacheKey = key;
  _visibleCacheList = list;
  return list;
}

const listItemCache = new Map();

function createMissionCard(ms){
  const c = document.createElement("div");
  // Add pack-slug class for color accent (e.g. pack--reflex-rush)
  const packSlug = "pack--" + (ms.pack || "").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  c.className = "card " + packSlug;
  c._packSlug = packSlug;
  c.dataset.id = String(ms.id);

  const icon = document.createElement("div");
  icon.className = "mIcon";

  const main = document.createElement("div");
  main.className = "mMain";

  const title = document.createElement("div");
  title.className = "mTitle";

  const meta = document.createElement("div");
  meta.className = "mMeta";

  const packTag = document.createElement("span");
  packTag.className = "tag pack";
  const diffTag = document.createElement("span");
  diffTag.className = "tag diff";
  const playersTag = document.createElement("span");
  playersTag.className = "tag";

  // Teaser: first step trimmed to 55 chars
  const teaser = document.createElement("div");
  teaser.className = "cardTeaser";

  meta.appendChild(packTag);
  meta.appendChild(diffTag);
  meta.appendChild(playersTag);

  main.appendChild(title);
  main.appendChild(meta);
  main.appendChild(teaser);

  const donePill = document.createElement("div");
  donePill.className = "donePill";
  donePill.textContent = "Done ✓";

  c.appendChild(icon);
  c.appendChild(main);
  c.appendChild(donePill);

  c._refs = { icon, title, packTag, diffTag, playersTag, teaser };
  return c;
}

function updateMissionCard(card, ms, isDone){
  const r = card._refs;
  if(r){
    r.icon.textContent = ms.icon;
    r.title.textContent = ms.title;
    r.packTag.textContent = ms.pack;
    r.diffTag.textContent = `${diffLabel(ms.difficulty)} • ${ms.time}`;
    r.playersTag.textContent = `👥 ${ms.players}`;
    // Teaser: first step, max 58 chars
    if(r.teaser){
      const first = (ms.steps && ms.steps[0]) || "";
      r.teaser.textContent = first.length > 58 ? first.slice(0,55) + "…" : first;
    }
  }
  card.classList.toggle("done", isDone);
  card.onclick = ()=>{ clickSound("click"); openMission(ms.id); };
}

function renderList(){
  const list = getVisibleMissions();

  if(list.length === 0){
    const empty = document.createElement("div");
    empty.className = "kv";
    empty.innerHTML = "<b>No missions found.</b><br/>Try a different pack or clear search.";
    listEl.replaceChildren(empty);
    updateProgress();
    return;
  }

  const frag = document.createDocumentFragment();
  for(const ms of list){
    let card = listItemCache.get(ms.id);
    if(!card){
      card = createMissionCard(ms);
      listItemCache.set(ms.id, card);
    }
    updateMissionCard(card, ms, done.has(ms.id));
    frag.appendChild(card);
  }
  listEl.replaceChildren(frag);
  updateProgress();
}

function remainingMissions(){
  return Math.max(0, missions.length - done.size);
}
function remainingText(){
  const remaining = remainingMissions();
  if(remaining <= 0) return "";
  const done = missions.length - remaining;
  if(done === 0) return "Complete all 36 missions to unlock.";
  return `${done} / ${missions.length} done — keep going!`;
}

function updateBadges(){
  badgesRow.innerHTML = "";
  const unlocked = new Set();
  const badgeCtx = { streakCount, bestStreak };
  BADGES.forEach(b=>{
    const ok = !!b.check(done, badgeCtx);
    if(ok) unlocked.add(b.id);
    const el = document.createElement("div");
    el.className = "badge" + (ok ? " unlocked" : "");
    el.innerHTML = `
      <div class="badgeIcon">${b.icon}</div>
      <div class="badgeName">${escapeHtml(b.name)}</div>
      <div class="badgeReq">${escapeHtml(b.req)}</div>
    `;
    badgesRow.appendChild(el);
  });

  // badges modal list (pretty)
  badgesList.innerHTML = BADGES.map(b=>{
    const ok = !!b.check(done, badgeCtx);
    return `
      <div class="badgesListItem">
        <div style="font-size:22px; width:34px">${b.icon}</div>
        <div style="flex:1">
          <div class="badgesListName">${escapeHtml(b.name)} ${ok ? "✅" : "🔒"}</div>
          <div class="badgesListReq">${escapeHtml(b.req)}</div>
        </div>
      </div>
    `;
  }).join("");

  // certificate unlock
  const unlockedAll = done.size >= missions.length;
  if(unlockedAll){
    certBtn.classList.add("unlocked");
    certBtn.classList.remove("locked");
    certBtn.textContent = "Open";
    certBtn.setAttribute("aria-disabled","false");
    certSub.textContent = "Unlocked! Open and save your printable certificate.";
  }else{
    certBtn.classList.remove("unlocked");
    certBtn.classList.add("locked");
    certBtn.textContent = "Locked";
    certBtn.setAttribute("aria-disabled","true");
    certSub.textContent = remainingText();
  }

  // unlock celebration (only when crossing 30/30)
  if(unlockedAll && !unlockedBefore){
    unlockedBefore = setState("unlockedBefore", true);
    const box = document.getElementById("certBox");
    if(box){
      box.classList.add("unlockedPulse");
      setTimeout(()=> box.classList.remove("unlockedPulse"), 1150);
    }
    clickSound("success");
    fireConfetti();
    showToast("🏆 Unlocked! Open your certificate.");
  }
  if(!unlockedAll && unlockedBefore){
    unlockedBefore = setState("unlockedBefore", false);
  }
}

function updateProgress(){
  const total = missions.length;
  const completed = done.size;
  progressText.textContent = `${completed} / ${total} missions done`;
  const pct = Math.round((completed/total)*100);
  progressFill.style.width = pct + "%";
  document.querySelector(".bar").setAttribute("aria-valuenow", String(completed));

  if(completed>=total){
    progressSub.textContent = "All missions completed! Certificate unlocked 🏆";
  } else if(completed === 0){
    progressSub.textContent = "Pick 1 mission today → build your streak → unlock your certificate.";
  } else if(completed <= 3){
    progressSub.textContent = `Great start! 🎉 Keep going — ${total - completed} missions to go.`;
  } else {
    const remaining = total - completed;
    progressSub.textContent = `${remaining} mission${remaining===1?"":"s"} left to unlock your certificate.`;
  }

  renderStreakUI();
  renderDailyUI();
  updateBadges();
  renderParentDashboard();
  const dash = document.getElementById("parentDashboard");
  if(dash) dash.style.display = done.size === 0 ? "none" : "";
  renderShareCard();
}

function renderShareCard(){
  const card = document.getElementById("shareScoreCard");
  if(!card) return;
  if(done.size === 0){ card.style.display = "none"; return; }
  card.style.display = "";
  document.getElementById("shareScoreNum").textContent = done.size;
  // Pick best unlocked badge (last in priority order)
  let topBadge = null;
  for(const b of BADGES){
    if(b.check(done)) topBadge = b;
  }
  const badgeEl = document.getElementById("shareScoreBadge");
  badgeEl.textContent = topBadge ? `${topBadge.icon} ${topBadge.name}` : "";
}

/** =======================
 * Modal
 * ======================= */
let timerInterval = null;
let timerState = "idle";   // "idle" | "running" | "paused"
let timerTotal = 0;
let timerLeft = 0;
let timerEndAt = 0;
let timerHoldResetArmed = false;
let timerHoldResetT = null;
let missionOpenedAt = 0;

function setTimerButtonLabel(){
  if(timerState === "running"){
    btnStartTimer.textContent = "⏸️ Pause Timer";
  }else if(timerState === "paused"){
    btnStartTimer.textContent = "▶️ Resume Timer";
  }else{
    btnStartTimer.textContent = "⏱️ Start Timer";
  }
}

function resetTimerUI() {
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timerState = "idle";
  timerTotal = 0;
  timerLeft = 0;
  timerEndAt = 0;

  timerUI.style.display = "none";
  timerFill.style.transition = "none";
  timerFill.style.width = "0%";
  timerDisplay.textContent = "60s";
  setTimerButtonLabel();
}

function updateTimerTick(){
  if(timerState !== "running") return;

  const now = Date.now();
  const msLeft = Math.max(0, timerEndAt - now);
  const secLeft = Math.ceil(msLeft / 1000);

  timerLeft = secLeft;

  if(secLeft <= 0){
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = null;

    timerState = "idle";
    timerDisplay.textContent = "Time's Up!";
    setTimerButtonLabel();
    if(autoDoneOnEnd && lastOpenedId != null && !done.has(lastOpenedId)){
      markMissionDone(lastOpenedId, "auto");
    }else if(lastOpenedId != null && !done.has(lastOpenedId)){
      incAttempt(lastOpenedId);
    }
    return;
  }

  timerDisplay.textContent = secLeft + "s";
}

function startTimer(durationSeconds) {
  if(timerInterval) clearInterval(timerInterval);

  timerUI.style.display = "block";

  timerTotal = durationSeconds;
  timerLeft = durationSeconds;
  timerState = "running";
  setTimerButtonLabel();

  // UI baseline
  timerDisplay.textContent = timerLeft + "s";

  // Progress bar animation (100% -> 0%)
  timerFill.style.transition = "none";
  timerFill.style.width = "100%";
  void timerFill.offsetWidth; // reflow
  timerFill.style.transition = `width ${timerLeft}s linear`;
  timerFill.style.width = "0%";

  timerEndAt = Date.now() + (timerLeft * 1000);

  clickSound("click");

  // Update text smoothly (and accurate if tab is throttled)
  timerInterval = setInterval(updateTimerTick, 200);
}

function pauseTimer(){
  if(timerState !== "running") return;

  const now = Date.now();
  const msLeft = Math.max(0, timerEndAt - now);
  timerLeft = Math.ceil(msLeft / 1000);

  if(timerInterval) clearInterval(timerInterval);
  timerInterval = null;

  timerState = "paused";
  setTimerButtonLabel();

  // Freeze bar where it is now
  const pct = timerTotal > 0 ? (msLeft / (timerTotal * 1000)) * 100 : 0;
  timerFill.style.transition = "none";
  timerFill.style.width = Math.max(0, Math.min(100, pct)) + "%";

  timerDisplay.textContent = timerLeft + "s";
  clickSound("click");
}

function resumeTimer(){
  if(timerState !== "paused") return;
  if(timerLeft <= 0){
    resetTimerUI();
    return;
  }

  timerState = "running";
  setTimerButtonLabel();

  // Animate bar from current % to 0% in remaining seconds
  const pct = timerTotal > 0 ? (timerLeft / timerTotal) * 100 : 0;
  timerFill.style.transition = "none";
  timerFill.style.width = Math.max(0, Math.min(100, pct)) + "%";
  void timerFill.offsetWidth;
  timerFill.style.transition = `width ${timerLeft}s linear`;
  timerFill.style.width = "0%";

  timerEndAt = Date.now() + (timerLeft * 1000);

  clickSound("click");

  timerInterval = setInterval(updateTimerTick, 200);
}

function toggleTimer(durationSeconds){
  if(timerState === "idle"){
    startTimer(durationSeconds);
  }else if(timerState === "running"){
    pauseTimer();
  }else{
    resumeTimer();
  }
}

// Hold-to-reset (works on mobile)
function armHoldToReset(){
  if(timerHoldResetT) clearTimeout(timerHoldResetT);
  timerHoldResetT = setTimeout(()=>{
    timerHoldResetArmed = true;
    resetTimerUI();
    showToast("Timer reset ✅");
  }, 650);
}
function disarmHoldToReset(){
  if(timerHoldResetT) clearTimeout(timerHoldResetT);
  timerHoldResetT = null;
  setTimeout(()=>{ timerHoldResetArmed = false; }, 80);
}

function openMission(id){
  const ms = missions.find(x=>x.id===id);
  if(!ms) return;
  lastOpenedId = setState("lastOpenedId", id);
  missionOpenedAt = Date.now();

  // Stamp pack slug on #sheet so dark-mode chip CSS can target it
  const sheetEl = document.getElementById("sheet");
  if(sheetEl){
    sheetEl.className = sheetEl.className.replace(/\bpack--[\w-]+\b/g,"").trim();
    const slug = "pack--" + (ms.pack||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    sheetEl.classList.add(slug);
  }

  resetTimerUI(); // Ensure timer is reset when opening

  mTitle.textContent = `${ms.icon} ${ms.title}`;
  mMeta.innerHTML = `
    <span class="tag pack">${escapeHtml(ms.pack)}</span>
    <span class="tag diff">${diffLabel(ms.difficulty)} • ${escapeHtml(ms.time)}</span>
    <span class="tag">👥 ${escapeHtml(ms.players)}</span>
    <span class="tag">Ages ${escapeHtml(ms.age)}</span>
  `;

  const steps = Array.isArray(ms.steps) && ms.steps.length ? ms.steps : ["Steps are coming soon. Please try another mission."];
  mSteps.innerHTML = `<b>Steps</b><br/><ol style="margin:10px 0 0; padding-left:18px">
    ${steps.map(s=>`<li>${escapeHtml(s)}</li>`).join("")}
  </ol>`;

  const winText = ms.win ? String(ms.win) : "Win condition is coming soon.";
  mWin.innerHTML = `<b>Win</b><br/><div style="margin-top:8px">${escapeHtml(winText)}</div>`;
  mTip.innerHTML = `<b>👨‍👩‍👧 Parent Tip</b><br/><div style="margin-top:8px">${escapeHtml(ms.tip)}</div>`;
  if(mKidsTip){
    mKidsTip.innerHTML = `<b>🧒 Kids Challenge</b><br/><div style="margin-top:8px">${escapeHtml(getKidsTip(ms))}</div>`;
  }
  mSafety.innerHTML = `<b>Safety</b><br/><div style="margin-top:8px">${escapeHtml(getSafetyText(ms))}</div>`;
  if(mHint){
    const attemptsCount = getAttemptCount(ms.id);
    if(attemptsCount >= 3){
      const hints = buildSoftHints(ms).slice(0,3);
      mHint.style.display = "block";
      mHint.innerHTML = `<b>Try an easier version</b><br/><ul style="margin:8px 0 0; padding-left:18px">
        ${hints.map(h=>`<li>${escapeHtml(h)}</li>`).join("")}
      </ul>`;
    }else{
      mHint.style.display = "none";
      mHint.innerHTML = "";
    }
  }

  const isDone = done.has(ms.id);
  btnToggleDone.textContent = isDone ? "↩️ Mark as Not Done" : "✅ Mark as Done";
  btnToggleDone.classList.toggle("btnDone", isDone);
  // After completing: promote "Next" as the clear CTA
  btnNext.textContent = isDone ? "▶ Next Mission!" : "➡️ Next";
  btnNext.classList.toggle("btnNextHighlight", isDone);
  btnRandomPack.textContent = `🎲 Random from ${ms.pack}`;
  // Auto-scroll sheet body to bottom when done so actions are visible
  if(isDone){
    setTimeout(()=>{
      const sb = document.getElementById("sheetBody");
      if(sb) sb.scrollTo({ top: sb.scrollHeight, behavior: "smooth" });
    }, 80);
  }
  if(holdHint){
    holdHint.style.display = "none";
  }

  mSmall.textContent = "Progress is saved on this device automatically.";

  // Timer Setup
  let seconds = 60; // default
  if(ms.time.includes("s")) seconds = parseInt(ms.time) || 60;
  
  btnStartTimer.onclick = () => {
    if(timerHoldResetArmed) return; // ignore click right after a hold-reset
    toggleTimer(seconds); // tap: start / pause / resume
};

// Tip: hold the timer button to reset (kid-friendly, no extra buttons)
if(!btnStartTimer.dataset.holdBound){
    btnStartTimer.dataset.holdBound = "1";
    btnStartTimer.addEventListener("pointerdown", armHoldToReset);
    btnStartTimer.addEventListener("pointerup", disarmHoldToReset);
    btnStartTimer.addEventListener("pointercancel", disarmHoldToReset);
    btnStartTimer.addEventListener("pointerleave", disarmHoldToReset);
}
  
  // TTS Setup (kid-friendly voice)
let isSpeaking = false;
function updateSpeakButton(){
  if(!btnSpeak) return;
  btnSpeak.classList.toggle("speaking", isSpeaking);
  btnSpeak.textContent = isSpeaking ? "■ Stop" : "🗣️ Read to Me";
  btnSpeak.setAttribute("aria-label", isSpeaking ? "Playing… Tap to stop" : "Read to Me");
}

if(btnSpeak){
  btnSpeak.onclick = () => {
    clickSound("click");
    if(!("speechSynthesis" in window)){
      showToast("Not supported on this device.");
      return;
    }

    if(isSpeaking){
      window.speechSynthesis.cancel();
      isSpeaking = false;
      updateSpeakButton();
      return;
    }

    window.speechSynthesis.cancel(); // stop previous
    const text =
      `Mission: ${ms.title}. ` +
      `Steps: ${ms.steps.join(". ")}. ` +
      `Win: ${ms.win}.`;

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 1.0;
    utter.pitch = 1.15;
    if(kidVoice) utter.voice = kidVoice;
    utter.onend = ()=>{ isSpeaking = false; updateSpeakButton(); };
    utter.onerror = ()=>{ isSpeaking = false; updateSpeakButton(); };

    isSpeaking = true;
    updateSpeakButton();
    window.speechSynthesis.speak(utter);
  };
}

  backdrop.classList.add("show");
  sheet.scrollTop = 0;
  // Lock background scroll while modal is open
  const _aw = document.getElementById("app-wrapper");
  if(_aw) _aw.style.overflowY = "hidden";
}

function closeMission(){
  if(lastOpenedId != null && !done.has(lastOpenedId)){
    const openFor = Date.now() - (missionOpenedAt || 0);
    if(openFor >= 20000){
      incAttempt(lastOpenedId);
    }
  }
  resetTimerUI(); // Stop + reset timer on close
  if('speechSynthesis' in window) window.speechSynthesis.cancel(); // Stop talking on close
  backdrop.classList.remove("show");
  // Restore background scroll
  const _aw = document.getElementById("app-wrapper");
  if(_aw) _aw.style.overflowY = "";
}


/** =======================
 * Certificate modal
 * ======================= */
let certPreviewUrl = "";
let certPreviewTimer = null;

async function updateCertificatePreview(){
  if(!certPreviewImg) return;
  const blob = await renderSimpleCertificateBlob();
  if(!blob) return;
  const url = URL.createObjectURL(blob);
  if(certPreviewUrl){
    try{ URL.revokeObjectURL(certPreviewUrl); }catch(_){}
  }
  certPreviewUrl = url;
  certPreviewImg.src = url;
}

function scheduleCertificatePreview(){
  if(certPreviewTimer) clearTimeout(certPreviewTimer);
  certPreviewTimer = setTimeout(()=>{ updateCertificatePreview(); }, 120);
}

function buildCertificate(){
  if(!certNameInput) return;
  const raw = (certNameInput.value || "").trim();
  lsSet(CERT_NAME_KEY, raw);
  if(certMetaLine){
    certMetaLine.textContent = "Completed on: " + getToday() + " • Certificate ID: " + getCertId();
  }
  scheduleCertificatePreview();
}

function openCertificate(){
  if(!certBackdrop) return;
  buildCertificate();
  certBackdrop.classList.add("show");
  const sheet = document.getElementById("certSheet");
  if(sheet) sheet.scrollTop = 0;
  // NOTE: "Open" should only open. Saving is done via the Save button inside the sheet.
}

function closeCertificate(){
  if(!certBackdrop) return;
  certBackdrop.classList.remove("show");
  if(certPreviewUrl){
    try{ URL.revokeObjectURL(certPreviewUrl); }catch(_){}
    certPreviewUrl = "";
  }
  if(certPreviewImg) certPreviewImg.src = "";
}

// Close handlers
if(btnCertClose){
  btnCertClose.onclick = ()=>{ clickSound("click"); closeCertificate(); };
}
if(certBackdrop){
  certBackdrop.addEventListener("click",(e)=>{
    if(e.target===certBackdrop){ clickSound("click"); closeCertificate(); }
  });
}
if(certNameInput){
  certNameInput.addEventListener("input", ()=>{ buildCertificate(); });
}

// Save certificate (PNG download)
let _certAutoDownloaded = false;

// ---- Certificate export helpers (iOS-safe) ----
function _loadScriptOnce(src){
  return new Promise((resolve, reject)=>{
    // If already present, resolve
    for(const s of Array.from(document.scripts||[])){
      if(s.src && s.src.indexOf(src) !== -1) return resolve();
    }
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = ()=> resolve();
    el.onerror = ()=> reject(new Error("script load failed: "+src));
    document.head.appendChild(el);
  });
}
async function ensurePdfLib(){
  if(window.PDFLib) return true;
  const cdns = [
    "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"
  ];
  for(const src of cdns){
    try{
      await _loadScriptOnce(src);
      if(window.PDFLib) return true;
    }catch(_){ }
  }
  return !!window.PDFLib;
}
// iOS fallback: open image in a new tab (works even when downloads are blocked)
function openImageForSave(url){
  try{
    const win = window.open(url, "_blank", "noopener");
    if(win) return true;
  }catch(_){ }
  try{
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }catch(_){
    try{ window.location.href = url; }catch(_){}
    return false;
  }
}

async function downloadCertificatePNG({auto=true}={}){
  // iOS Safari/Chrome (WebKit) restricts programmatic downloads.
  // Reliable iPhone flow:
  // - Prefer a simple canvas renderer for iOS reliability
  // - Use Share Sheet when file sharing is supported
  // - Otherwise open the PNG in a new tab + show long-press save hint
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const filename = `JUMVI-Certificate-${getToday().replaceAll("/","-")}.png`;

  // iPhone: give instant feedback (avoid "nothing happened" feeling)
  if(isiOS){
    try{ showSaveOverlay("", "Preparing certificate… please wait."); }catch(_){ }
    try{ showToast("Preparing certificate…"); }catch(_){ }
    if(btnCertSavePng){
      btnCertSavePng.disabled = true;
      btnCertSavePng.dataset.prevText = btnCertSavePng.textContent || "";
      btnCertSavePng.textContent = "⏳ Preparing…";
    }
  }

  try{
    // Single source of truth: template-based render
    const blob = await renderSimpleCertificateBlob();
    if(!blob){
      hideSaveOverlay();
      showFallbackModal();
      return;
    }

    if(isiOS){
      // Prefer Share Sheet with files
      const file = new File([blob], filename, {type:"image/png"});
      const canShareFile = !!(window.isSecureContext && navigator.share && navigator.canShare && navigator.canShare({files:[file]}));
      if(canShareFile){
        try{
          await navigator.share({files:[file], title:"JUMVI Certificate"});
          hideSaveOverlay();
          if(!auto) showToast("Share sheet opened");
          return;
        }catch(_){
          // fall through to long-press save
        }
      }

      const url = URL.createObjectURL(blob);
      openImageForSave(url);
      showSaveOverlay(url, "Tap and hold the image → Save Image");
      return;
    }

    // Non‑iOS: direct download from blob
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){ } }, 3000);
    if(!auto) showToast("Saved ✅");

  }catch(err){
    hideSaveOverlay();
    showFallbackModal();
  }finally{
    if(isiOS && btnCertSavePng){
      btnCertSavePng.disabled = false;
      btnCertSavePng.textContent = btnCertSavePng.dataset.prevText || "Save as Image (PNG)";
      delete btnCertSavePng.dataset.prevText;
    }
  }
}


async function shareCertificate(){
  clickSound("click");
  const filename = `JUMVI-Certificate-${getToday().replaceAll("/","-")}.png`;
  try{
    const blob = await renderSimpleCertificateBlob();
    if(!blob){ showToast("Couldn't generate certificate."); return; }
    const file = new File([blob], filename, {type:"image/png"});
    if(window.isSecureContext && navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title:"JUMVI Champion Certificate", text:"🏆 Completed all 30 JUMVI missions!"});
    }else if(navigator.share){
      const url = URL.createObjectURL(blob);
      await navigator.share({title:"JUMVI Champion Certificate", text:"🏆 Completed all 30 JUMVI missions!", url: location.href});
      setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){ } }, 3000);
    }else{
      // Desktop: trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){ } }, 3000);
      showToast("Certificate saved!");
    }
  }catch(e){
    if(e.name !== "AbortError") showToast("Share failed. Try Save as Image.");
  }
}

async function shareCertificateWhatsApp(){
  clickSound("click");
  const name = (certNameInput && certNameInput.value || "").trim();
  const namePart = name ? ` ${name}` : "";
  const text = `🏆${namePart} completed all 30 JUMVI Toss & Catch missions! 🎾\nCertificate: ${location.href}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

async function downloadCertificatePDF(){
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const filename = `JUMVI-Certificate-${getToday().replaceAll("/","-")}.pdf`;
  try{
    const ok = await ensurePdfLib();
    if(!ok){
      showToast("PDF export needs internet.");
      return;
    }

    const pngBlob = await renderSimpleCertificateBlob();
    if(!pngBlob){
      showToast("Couldn’t generate image for PDF.");
      return;
    }

    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const pngBytes = await pngBlob.arrayBuffer();
    const pngImage = await pdfDoc.embedPng(pngBytes);

    // A4 landscape in points: 842 x 595
    const page = pdfDoc.addPage([842, 595]);
    const { width, height } = page.getSize();
    const imgWidth = pngImage.width;
    const imgHeight = pngImage.height;
    const scale = Math.min(width / imgWidth, height / imgHeight);
    const w = imgWidth * scale;
    const h = imgHeight * scale;
    const x = (width - w) / 2;
    const y = (height - h) / 2;
    page.drawImage(pngImage, { x, y, width: w, height: h });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: "application/pdf" });

    if(isiOS){
      const file = new File([blob], filename, {type:"application/pdf"});
      const canShareFile = !!(window.isSecureContext && navigator.share && navigator.canShare && navigator.canShare({files:[file]}));
      if(canShareFile){
        try{
          await navigator.share({files:[file], title:"JUMVI Certificate"});
          return;
        }catch(_){ }
      }
      const url = URL.createObjectURL(blob);
      openImageForSave(url);
      showSaveOverlay(url, "Tap and hold the image → Save Image");
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){ } }, 3000);
  }catch(_){
    showToast("PDF export failed. Try again.");
  }
}

// Wire up the single control button
if(btnCertSavePng){
  btnCertSavePng.onclick = ()=>{
    try{ clickSound("click"); }catch(_){ }
    buildCertificate();
    downloadCertificatePNG({auto:false});
  };
}
if(btnCertSavePdf){
  btnCertSavePdf.onclick = ()=>{
    try{ clickSound("click"); }catch(_){ }
    buildCertificate();
    downloadCertificatePDF();
  };
}

const btnCertShare = document.getElementById("btnCertShare");
const btnCertWhatsApp = document.getElementById("btnCertWhatsApp");
if(btnCertShare){
  btnCertShare.onclick = ()=>{ buildCertificate(); shareCertificate(); };
}
if(btnCertWhatsApp){
  btnCertWhatsApp.onclick = ()=>{ shareCertificateWhatsApp(); };
}

// Open certificate (only if unlocked)
if(certBtn){
  certBtn.onclick = ()=>{
    clickSound("click");
    const unlocked = done.size >= missions.length;
    if(unlocked){
      openCertificate();
    }else{
      showToast("Finish all 30 missions to unlock.");
    }
  };
}
const certBox = document.getElementById("certBox");
if(certBox){
  certBox.addEventListener("click", ()=>{
    const unlocked = done.size >= missions.length;
    if(unlocked){
      clickSound("click");
      openCertificate();
    }
  });
}

btnClose.onclick = ()=>{ clickSound("click"); closeMission(); };
backdrop.addEventListener("click",(e)=>{ if(e.target===backdrop){ clickSound("click"); closeMission(); } });

function markMissionDone(id, source="manual"){
  if(id==null || done.has(id)) return;
  done.add(id);
  bumpDoneVersion();

  const changed = recordActivityToday();

  persist();
  renderList();
  clickSound("success");
  celebrate();

  if(source === "auto"){
    showToast("✅ Mission marked done.");
  } else {
    // First ever completion — special moment
    const remaining = missions.length - done.size;
    if(done.size === 1){
      setTimeout(()=>{ fireConfetti(1800); showToast("🎉 First mission done! Your streak has started!"); }, 400);
    } else if(remaining > 0){
      showToast(`⭐ Great job! ${remaining} mission${remaining===1?"":"s"} left!`);
    }
    // Streak milestones — delayed so they don't overwrite the completion toast
    if(changed){
      const delay = 2100;
      if(streakCount === 7){
        setTimeout(()=>{ fireConfetti(2200); renderStreakUI(true); showToast("🔥 Week Champion! 7-day streak!"); }, delay);
      } else if(streakCount === 3){
        setTimeout(()=>{ celebrate(); renderStreakUI(true); showToast("🎖️ 3-Day Streak! Keep it up!"); }, delay);
      } else if(streakCount > 1){
        setTimeout(()=>{ renderStreakUI(true); showToast(`🔥 ${streakCount} day${streakCount===1?"":"s"} streak!`); }, delay);
      } else {
        setTimeout(()=> renderStreakUI(true), 300);
      }
    }
  }
  openMission(id);
}

function renderSeasonalList(type){
  if(!seasonalList || !seasonalBackdrop) return;
  const seasonal = {
    indoor: {
      title: "Indoor/Home Edition",
      ids: [25, 26, 27, 28, 29, 18]
    },
    outdoor: {
      title: "Beach/Park Edition",
      ids: [1, 7, 9, 19, 20, 24]
    }
  };
  const cfg = seasonal[type];
  if(!cfg) return;
  if(seasonalSub) seasonalSub.textContent = cfg.title;
  const list = cfg.ids.map(id=>missions.find(m=>m.id===id)).filter(Boolean);
  seasonalList.innerHTML = "";
  list.forEach(ms=>{
    const row = document.createElement("div");
    row.className = "seasonalItem";
    row.innerHTML = `
      <div style="font-size:18px; width:26px; text-align:center">${ms.icon}</div>
      <div style="flex:1">
        <div class="seasonalItemTitle">${escapeHtml(ms.title)}</div>
        <div style="margin-top:4px; display:flex; gap:6px; flex-wrap:wrap">
          <span class="tag pack">${escapeHtml(ms.pack)}</span>
          <span class="tag diff">${diffLabel(ms.difficulty)} • ${escapeHtml(ms.time)}</span>
        </div>
      </div>
    `;
    row.onclick = ()=>{
      clickSound("click");
      seasonalBackdrop.classList.remove("show");
      openMission(ms.id);
    };
    seasonalList.appendChild(row);
  });
  seasonalBackdrop.classList.add("show");
}

// click to mark done (no hold)
if(btnToggleDone){
  btnToggleDone.onclick = ()=>{
    if(lastOpenedId==null) return;
    const wasDone = done.has(lastOpenedId);
    if(wasDone){
      done.delete(lastOpenedId);
      bumpDoneVersion();
      persist();
      renderList();
      clickSound("click");
      openMission(lastOpenedId);
      return;
    }
    markMissionDone(lastOpenedId, "manual");
  };
}

btnNext.onclick = ()=>{
  if(lastOpenedId==null) return;
  const list = getVisibleMissions();
  const idx = list.findIndex(x=>x.id===lastOpenedId);
  const next = list[(idx+1) % list.length];
  if(!done.has(lastOpenedId)) incSkip(lastOpenedId);
  clickSound("click");
  openMission(next.id);
};

btnRandomPack.onclick = ()=>{
  if(lastOpenedId==null) return;
  const ms = missions.find(x=>x.id===lastOpenedId);
  const list = missions.filter(x=>x.pack===ms.pack);
  const pick = list[Math.floor(Math.random()*list.length)];
  if(!done.has(lastOpenedId)) incSkip(lastOpenedId);
  clickSound("click");
  openMission(pick.id);
};

/** =======================
 * Actions
 * ======================= */
document.getElementById("btnRandomAll").onclick = ()=>{
  clickSound("click");
  const list = getVisibleMissions();
  const pick = list[Math.floor(Math.random()*list.length)];
  if(!pick){ showToast("No missions match the filters."); return; }
  openMission(pick.id);
};

document.getElementById("btnReset").onclick = ()=>{
  clickSound("click");
  if(!confirm("Reset progress on this phone?")) return;
  setDoneFromArray([]);
  unlockedBefore = setState("unlockedBefore", false);
  persist();
  renderList();
  closeMission();
  closeCertificate();
};

document.getElementById("btnBadges").onclick = ()=>{
  clickSound("click");
  badgesBackdrop.classList.add("show");
};

btnBadgesClose.onclick = ()=>{ clickSound("click"); badgesBackdrop.classList.remove("show"); };
badgesBackdrop.addEventListener("click",(e)=>{ if(e.target===badgesBackdrop){ clickSound("click"); badgesBackdrop.classList.remove("show"); } });

if(btnSeasonalClose){
  btnSeasonalClose.onclick = ()=>{ clickSound("click"); seasonalBackdrop.classList.remove("show"); };
}
if(seasonalBackdrop){
  seasonalBackdrop.addEventListener("click",(e)=>{ if(e.target===seasonalBackdrop){ clickSound("click"); seasonalBackdrop.classList.remove("show"); } });
}
if(btnSeasonalIndoor){
  btnSeasonalIndoor.onclick = ()=>{ clickSound("click"); renderSeasonalList("indoor"); };
}
if(btnSeasonalOutdoor){
  btnSeasonalOutdoor.onclick = ()=>{ clickSound("click"); renderSeasonalList("outdoor"); };
}

// Parent Dashboard — Print Report
const btnDashPrint = document.getElementById("btnDashPrint");
if(btnDashPrint){
  btnDashPrint.onclick = ()=>{
    clickSound("click");
    const packs = [
      { key:"Reflex Rush", label:"Reflex", icon:"⚡" },
      { key:"Aim Master", label:"Aim", icon:"🎯" },
      { key:"Focus Control", label:"Focus", icon:"🧘" },
      { key:"Team Duo", label:"Team", icon:"👥" },
      { key:"Indoor Compact", label:"Indoor", icon:"🏠" }
    ];
    const rows = packs.map(p=>{
      const n = missions.filter(m=>m.pack===p.key && done.has(m.id)).length;
      const bar = "█".repeat(n) + "░".repeat(6-n);
      return `<tr><td>${p.icon} ${p.label}</td><td style="font-family:monospace;letter-spacing:1px">${bar}</td><td>${n}/6</td></tr>`;
    }).join("");
    const mins = getEstimatedPlayMinutes();
    const dateStr = getToday();
    const html = `<!doctype html><html><head><meta charset="utf-8">
<title>JUMVI Weekly Report</title>
<style>
  body{font-family:-apple-system,Arial,sans-serif;max-width:520px;margin:40px auto;padding:20px;color:#0f172a;}
  h1{font-size:22px;margin-bottom:4px;}
  .sub{color:#64748b;font-size:13px;margin-bottom:24px;}
  table{width:100%;border-collapse:collapse;margin-bottom:20px;}
  td{padding:8px 6px;font-size:14px;border-bottom:1px solid #e5e7eb;}
  td:last-child{text-align:right;font-weight:700;}
  .stats{display:flex;gap:24px;margin-bottom:20px;}
  .stat{text-align:center;}
  .statVal{font-size:28px;font-weight:900;color:#4FB3FF;}
  .statLbl{font-size:12px;color:#64748b;font-weight:600;}
  .footer{margin-top:32px;font-size:11px;color:#94a3b8;border-top:1px solid #e5e7eb;padding-top:12px;}
  @media print{body{margin:20px;}}
</style></head><body>
<h1>🎾 JUMVI Missions — Parent Report</h1>
<div class="sub">Generated: ${dateStr}</div>
<div class="stats">
  <div class="stat"><div class="statVal">${done.size}</div><div class="statLbl">missions done</div></div>
  <div class="stat"><div class="statVal">${mins}</div><div class="statLbl">min total play</div></div>
  <div class="stat"><div class="statVal">${streakCount}</div><div class="statLbl">day streak</div></div>
</div>
<table>${rows}</table>
<div class="footer">JUMVI Toss &amp; Catch Paddle Set • jumvi.co • Progress saved on device</div>
</body></html>`;
    const win = window.open("", "_blank", "width=580,height=680");
    if(win){
      win.document.write(html);
      win.document.close();
      setTimeout(()=>{ try{ win.print(); }catch(_){ } }, 400);
    }
  };
}

// Share Score Card buttons
document.getElementById("btnShareWhatsApp").onclick = ()=>{
  clickSound("click");
  const url = location.href;
  let topBadge = null;
  for(const b of BADGES){ if(b.check(done)) topBadge = b; }
  const badgePart = topBadge ? `Top badge: ${topBadge.icon} ${topBadge.name}\n` : "";
  const text = `🎯 We completed ${done.size}/30 JUMVI missions!\n${badgePart}Try it: ${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
};
document.getElementById("btnShareCopy").onclick = async ()=>{
  clickSound("click");
  const url = location.href;
  let topBadge = null;
  for(const b of BADGES){ if(b.check(done)) topBadge = b; }
  const badgePart = topBadge ? ` | Badge: ${topBadge.icon} ${topBadge.name}` : "";
  const text = `🎯 ${done.size}/30 JUMVI missions completed${badgePart} → ${url}`;
  try{
    if(navigator.share){
      await navigator.share({ title:"JUMVI Missions", text, url });
    }else{
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard!");
    }
  }catch(e){}
};

document.getElementById("btnShare").onclick = async ()=>{
  clickSound("click");
  const url = location.href;
  const diag = topSkippedText();
  const text = `JUMVI Missions progress: ${done.size}/${missions.length}${diag ? `\n${diag}` : ""}`;
  try{
    if(navigator.share){
      await navigator.share({ title:"JUMVI Missions", text, url });
    }else{
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    }
  }catch(e){}
};

// btnChoosePack removed from UI — pack filter row handles this directly

searchInput.addEventListener("input", ()=>{
  searchQuery = setState("searchQuery", searchInput.value || "");
  renderList();
});

btnOnlyUnfinished.onclick = ()=>{
  clickSound("click");
  onlyUnfinished = setState("onlyUnfinished", !onlyUnfinished);
  btnOnlyUnfinished.classList.toggle("active", onlyUnfinished);
  persistOnly();
  renderList();
};

// Filters toggle (Players + Difficulty collapsed by default)
const btnToggleFilters = document.getElementById("btnToggleFilters");
const filterGroupsEl = document.getElementById("filterGroups");
let filtersOpen = false;
if(btnToggleFilters && filterGroupsEl){
  btnToggleFilters.addEventListener("click", ()=>{
    clickSound("click");
    filtersOpen = !filtersOpen;
    filterGroupsEl.style.display = filtersOpen ? "" : "none";
    btnToggleFilters.classList.toggle("active", filtersOpen);
    btnToggleFilters.textContent = filtersOpen ? "✕ Filters" : "⚙️ Filters";
  });
}

/** =======================
 * New UI buttons
 * ======================= */
if(btnSolidBg){
  btnSolidBg.onclick = ()=>{
    clickSound("click");
    solidBg = setState("solidBg", !solidBg);
    lsSet(SOLIDBG_KEY, solidBg ? "1" : "0");
    applyBodyClasses();
    renderModeChips();
    showToast(solidBg ? "Solid background ON" : "Solid background OFF");
  };
}
if(btnKidsMode){
  btnKidsMode.onclick = ()=>{
    clickSound("click");
    kidsMode = setState("kidsMode", !kidsMode);
    lsSet(KIDSMODE_KEY, kidsMode ? "1" : "0");
    applyBodyClasses();
    renderModeChips();
    showToast(kidsMode ? "Kids Mode ON" : "Kids Mode OFF");
  };
}

/* Daily mission buttons */
if(btnDailyPlay){
  btnDailyPlay.onclick = ()=>{
    clickSound("click");
    ensureDailyMission();
    openMission(dailyIdStored);
  };
}
if(btnDailyNew){
  btnDailyNew.onclick = ()=>{
    clickSound("click");
    ensureDailyMission();
    dailyN = setState("dailyN", (dailyN || 0) + 1);
    dailyIdStored = setState("dailyIdStored", pickDailyId(dailyIso || isoLocalDate(), dailyN));
    persistDaily();
    renderDailyUI();
    showToast("New daily mission selected!");
  };
}

/* Avatar Feature */
function renderAvatar(){
    avatarBtn.textContent = AVATARS[currentAvatarIdx];
}
avatarBtn.onclick = () => {
    clickSound("click");
    currentAvatarIdx = setState("currentAvatarIdx", (currentAvatarIdx + 1) % AVATARS.length);
    lsSet(AVATAR_KEY, currentAvatarIdx);
    renderAvatar();
    fireConfetti(500); // small confetti for fun
}


/* Backup modal */
function openBackup(){
  if(!backupBackdrop) return;
  if(backupCode) backupCode.value = makeBackupCode();
  if(restoreInput) restoreInput.value = "";
  backupBackdrop.classList.add("show");
}
function closeBackup(){
  if(!backupBackdrop) return;
  backupBackdrop.classList.remove("show");
}
if(btnBackup){
  btnBackup.onclick = ()=>{ clickSound("click"); openBackup(); };
}
if(btnBackupClose){
  btnBackupClose.onclick = ()=>{ clickSound("click"); closeBackup(); };
}
if(backupBackdrop){
  backupBackdrop.addEventListener("click",(e)=>{ if(e.target===backupBackdrop){ clickSound("click"); closeBackup(); } });
}
if(btnBackupRefresh){
  btnBackupRefresh.onclick = ()=>{ clickSound("click"); if(backupCode) backupCode.value = makeBackupCode(); showToast("Backup code refreshed."); };
}
if(btnBackupCopy){
  btnBackupCopy.onclick = async ()=>{
    clickSound("click");
    const code = backupCode ? backupCode.value : makeBackupCode();
    try{
      if(navigator.clipboard){
        await navigator.clipboard.writeText(code);
        showToast("Copied!");
      }else{
        if(backupCode){ backupCode.focus(); backupCode.select(); }
        document.execCommand("copy");
        showToast("Copied!");
      }
    }catch(e){
      showToast("Copy failed. Select and copy manually.");
    }
  };
}
if(btnRestore){
  btnRestore.onclick = ()=>{
    clickSound("click");
    const raw = (restoreInput?.value || "").trim();
    if(!raw) return showToast("Paste a backup code first.");
    if(!raw.startsWith("JUMVI1.")) return showToast("Invalid code.");
    if(!confirm("Restore progress on this phone? This will replace current progress.")) return;
    try{
      const part = raw.split("JUMVI1.")[1] || "";
      const json = b64DecodeUnicode(b64UrlDecode(part));
      const payload = JSON.parse(json);
      applyBackupPayload(payload);
      closeBackup();
      showToast("Restored!");
    }catch(e){
      showToast("Restore failed. Check the code.");
    }
  };
}

/* A2HS banner */
if(btnA2hsClose){
  btnA2hsClose.onclick = ()=>{
    clickSound("click");
    lsSet(A2HS_DISMISS_KEY, "1");
    if(a2hsBanner) a2hsBanner.style.display = "none";
  };
}

/** =======================
 * Welcome Overlay (first-time onboarding)
 * ======================= */
function showWelcomeOverlay(){
  const overlay = document.getElementById("welcomeOverlay");
  if(!overlay) return;
  // Already onboarded — hide immediately without animation
  if(lsGet(ONBOARD_KEY, "0") === "1"){
    overlay.style.display = "none";
    return;
  }
  // Default: first age group selected
  let selectedDiff = "Easy";
  const ageBtns = overlay.querySelectorAll(".ageBtn");
  const countEl  = document.getElementById("welcomeMissionCount");

  function getMissionCount(diff){
    if(diff === "all") return missions.length;
    if(diff === "Easy")   return missions.filter(x=>x.difficulty===1).length;
    if(diff === "Medium") return missions.filter(x=>x.difficulty===2).length;
    return missions.length;
  }
  const welcomeLabels = {
    "Easy":   (n) => `${n} beginner-friendly missions 🐣`,
    "all":    (n) => `All ${n} missions unlocked 🚀`,
    "Medium": (n) => `${n} missions — good challenge ⚡`,
  };
  function updateCount(diff){
    if(!countEl) return;
    const n = getMissionCount(diff);
    const fn = welcomeLabels[diff] || ((n)=> `${n} missions`);
    countEl.textContent = fn(n);
  }

  ageBtns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      clickSound("click");
      ageBtns.forEach(b=>b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedDiff = btn.dataset.diff || "all";
      updateCount(selectedDiff);
    });
  });
  if(ageBtns[0]) ageBtns[0].classList.add("selected");
  updateCount(selectedDiff);

  const startBtn = document.getElementById("btnWelcomeStart");
  if(startBtn){
    startBtn.addEventListener("click", ()=>{
      // Always close overlay first — nothing should block this
      overlay.classList.add("hiding");
      setTimeout(()=>{ overlay.style.display = "none"; }, 380);
      clickSound("click");
      // Persist selection
      try { lsSet(ONBOARD_KEY, "1"); } catch(e){}
      try { lsSet(AGE_KEY, selectedDiff); } catch(e){}
      // Apply difficulty filter after overlay starts closing
      try {
        if(selectedDiff !== "all"){
          currentDifficulty = setState("currentDifficulty", selectedDiff);
          renderFilterGroups();
          renderList();
        }
      } catch(e){ console.warn("Welcome filter:", e); }
    });
  }
}

/** =======================
 * Sound toggle
 * ======================= */
function renderSoundToggle(){
  soundToggle.classList.toggle("muted", !soundOn);
  soundToggle.textContent = soundOn ? "🔊" : "🔇";
}
soundToggle.onclick = ()=>{
  soundOn = !soundOn;
  lsSet(SOUND_KEY, soundOn ? "1" : "0");
  renderSoundToggle();
  // If turning on, try to unlock audio on tap
  if(soundOn){
    ensureAudio();
    clickSound("click");
  }
};

/** =======================
 * Init
 * ======================= */
function init(){
  btnOnlyUnfinished.classList.toggle("active", onlyUnfinished);

  applyBodyClasses();
  renderModeChips();
  applyTheme();

  // Low-end perf hint — disable backdrop-filter on Android + low-RAM devices
  try{
    const dm = navigator.deviceMemory || 0;
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isLowRAM = dm > 0 && dm <= 4;
    if(isAndroid || isLowRAM) document.documentElement.classList.add("perf-low");
  }catch(_){}

  if(autoDoneToggle){
    autoDoneToggle.checked = !!autoDoneOnEnd;
    autoDoneToggle.onchange = ()=>{
      autoDoneOnEnd = setState("autoDoneOnEnd", !!autoDoneToggle.checked);
      lsSet(AUTO_DONE_KEY, autoDoneOnEnd ? "1" : "0");
    };
  }

  renderSoundToggle();
  renderFilters();
  renderFilterGroups();
  const _dash = document.getElementById("parentDashboard");
  if(_dash) _dash.style.display = done.size === 0 ? "none" : "";
  renderList();

  renderStreakUI();
  renderDailyUI();
  renderAvatar();

  if(themeToggle){
    themeToggle.onclick = ()=>{ clickSound("click"); cycleTheme(); };
  }
  if(btnHeaderPlay){
    btnHeaderPlay.onclick = ()=>{
      clickSound("click");
      ensureDailyMission();
      if(dailyIdStored){ openMission(dailyIdStored); }
    };
  }

  if(window.matchMedia){
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if(mq && mq.addEventListener){
      mq.addEventListener("change", ()=>{ if(themeMode === "system") applyTheme(); });
    }else if(mq && mq.addListener){
      mq.addListener(()=>{ if(themeMode === "system") applyTheme(); });
    }
  }

  hideReadToMeIfUnsupported();
  if(!storageAvailable){ showToast("Storage is unavailable. Progress will only stay in this session."); }
  showWelcomeOverlay();
  // Delay A2HS banner — don't interrupt the first impression
  setTimeout(maybeShowA2HS, 30000);
  checkOptionalDownloads();

  // restore certificate name (optional)
  if(certNameInput){
    certNameInput.value = lsGet(CERT_NAME_KEY) || "";
    buildCertificate();
  }
}

// Hide header on scroll down (iOS Safari friendly)
(function hideHeaderOnScroll(){
  const wrap = document.getElementById("app-wrapper");
  const sticky = document.querySelector(".sticky");
  if(!wrap || !sticky) return;
  let last = 0;
  let ticking = false;
  const onScroll = ()=>{
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(()=>{
      const y = wrap.scrollTop;
      const goingDown = y > last && y > 8;
      sticky.classList.toggle("hidden", goingDown);
      last = y;
      ticking = false;
    });
  };
  wrap.addEventListener("scroll", onScroll, { passive:true });
})();

init();
