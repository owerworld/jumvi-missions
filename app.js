/*!
 * JUMVI Missions — qr.jumvi.co
 * Copyright © 2026 JUMVI / SAY23 LLC. All rights reserved.
 * Unauthorized copying, modification, or redistribution of this
 * interface, missions, or structure is strictly prohibited.
 */
/* ── Silent-fallback recorder ────────────────────────────────────────────────
 * A fallback that activates without surfacing anything is indistinguishable
 * from working code — Coach Leo shipped as a procedural blob once because of
 * exactly that. Every degrade path calls __jumviFallback(): it warns with a
 * distinct prefix AND records into window.__jumviFallbacks, so a real device
 * can be opened and asked "did anything degrade?".
 *
 *   > __jumviFallbacks.counts      // { leo_model_failed: 1, ... }
 *   > __jumviFallbacks.list        // [{ name, detail, at }, ...]
 *
 * Local only: no network, no analytics, nothing persisted. COPPA unchanged.
 * Each distinct name warns once per session (the record still counts them all)
 * so a per-frame path can't flood the console.
 * ---------------------------------------------------------------------------*/
window.__jumviFallbacks = { list: [], counts: {} };
window.__jumviFallback = function (name, detail) {
  try {
    var F = window.__jumviFallbacks;
    var first = !F.counts[name];
    F.counts[name] = (F.counts[name] || 0) + 1;
    if (F.list.length < 100) {
      F.list.push({ name: name, detail: detail == null ? null : String(detail).slice(0, 200), at: new Date().toISOString() });
    }
    if (first) console.warn("[JUMVI fallback] " + name, detail == null ? "" : detail);
  } catch (_) { }
};

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
  // A failed write means progress is NOT being saved — the most consequential
  // silent degrade in the app (private mode / quota / blocked storage).
  try{ localStorage.setItem(key, value); }catch(e){ window.__jumviFallback("storage_write_failed", key + ": " + (e && e.name)); }
};
const storageAvailable = (()=>{
  try{
    const k = "__jumvi_test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  }catch(_){
    window.__jumviFallback("storage_unavailable", "progress will not persist this session");
    return false;
  }
})();

/* ===== Privacy-friendly analytics helper =====
 * DORMANT — and verified still dormant (QA pass, 2026-08-15). Plausible was
 * removed in Faz 0 (privacy): no script tag loads it anywhere, _headers' CSP
 * script-src would not permit it, window.plausible is only ever READ and never
 * assigned, no caller uses the return value, and no test depends on it. So all
 * 48 trackEvent() call sites in this file — plus the hub's track() bridge —
 * are no-ops today.
 *
 * They are left in place ON PURPOSE, as markers of what was once measured.
 * Do NOT wire this to the beacon below: the beacon ships a deliberately small,
 * server-enforced allowlist (23 events as of this writing, see src/worker.js),
 * and routing ~48 legacy names into it would blow past that on day one and
 * burn WAE's cardinality budget. The count in this note was stale ("exactly
 * five events") and is corrected here; the dormant-marker decision is not. */
function trackEvent(name, props){
  try{
    if(typeof window.plausible === "function"){
      props ? window.plausible(name, { props }) : window.plausible(name);
    }
  }catch(_){}
}

/* ═══════════════════════════════════════════════════════════════════════════
 * BEACON — Faz 1, Görev 1.2 (5 events) + Faz 2, Görev 2.1 (16 more)
 *
 * Twenty-one events. The allowlist here is mirrored by a stricter one in
 * src/worker.js, which is what actually protects the dataset. This copy
 * exists to avoid pointless network calls, not as the security boundary.
 *
 * FAZ 1 — the funnel:
 *   app_open                      once per session
 *   mission_start     { id }      once per mission per session
 *   mission_complete  { id }
 *   help_open         { reason }  fixed 6-value legacy enum, never free text
 *   player_count      { n }       2 | 3 | 4, once per session
 *
 * FAZ 2 — content and features:
 *   pack_view         { pack }    6-value enum, once per pack per session
 *   pack_complete     { pack }
 *   daily_pick_tap                once per session
 *   badge_earned      { badge }   11-value enum
 *   certificate_made              once per session
 *   share_tap         { channel } whatsapp | native | copy
 *   speak_on                      once per session, on ENABLE only
 *   timer_start       { id }      mission id, once per mission per session
 *   score_saved
 *   dashboard_open                once per session
 *   missionbook_get
 *   profile_add                   the EVENT only — never a name, age, avatar
 *   progress_reset
 *   hub3d             { step }    7-value enum, once per step per session
 *
 * FAZ 2 — reach and retention. app_open counts sessions, which is not the
 * same question as "how many devices ever arrived" or "how many came back".
 * Both of these keep their counter ON THE DEVICE and send only the fact that
 * a threshold was crossed. No id is minted, stored, or transmitted:
 *   app_first_open                once per device, forever (jumvi_seen)
 *   return_visit      { n }       only on visit 2, 3, 5, 10 (jumvi_visits)
 *
 * ACTIVATION FUNNEL + QUICK PLAY
 *   welcome_complete              once per device, forever. Closes the gap
 *                                 between app_first_open ("a device arrived")
 *                                 and timer_start ("play actually began") —
 *                                 without it, a family who bounced off the
 *                                 welcome screen is indistinguishable from one
 *                                 who never scanned. De-duped on the SAME
 *                                 jumvi_onboarded_v2 flag the overlay already
 *                                 uses, so no new key and no new identifier.
 *                                 The age band chosen on that screen is
 *                                 deliberately NOT sent.
 *   quickplay_start   { mode }    9-value enum, on every real activity start.
 *                                 Emitted from the Quick Play runtime, which
 *                                 writes no mission progress — deliberately a
 *                                 separate funnel from mission_start.
 *
 * READING app_first_open: it is an approximate activation INDICATOR, not a
 * count of physical units in use. One box can be opened on several phones,
 * one phone can be cleared and look new. Never divide it by units sold and
 * present the result as an activation rate.
 *
 * NEVER add a user id, device id, or anything fingerprint-shaped to props.
 * Fire-and-forget: failures are swallowed. A metric must never break play.
 * ═══════════════════════════════════════════════════════════════════════════ */
const BEACON_ENDPOINT = "/api/beacon";
const BEACON_EVENTS = new Set([
  "app_open", "mission_start", "mission_complete", "help_open", "player_count",
  "pack_view", "pack_complete", "daily_pick_tap", "badge_earned",
  "certificate_made", "share_tap", "speak_on", "timer_start", "score_saved",
  "dashboard_open", "missionbook_get", "profile_add", "progress_reset",
  "hub3d", "app_first_open", "return_visit",
  "welcome_complete", "quickplay_start",
]);
const HELP_REASONS = [
  "ball_stuck", "ball_hard_to_remove", "strap_uncomfortable",
  "need_more_space", "instructions_unclear", "mission_too_hard",
];

function beacon(name, props){
  try{
    if(!BEACON_EVENTS.has(name)) return;
    const body = JSON.stringify(Object.assign({ e: name }, props || {}));
    // sendBeacon survives the page being backgrounded mid-mission, which is
    // exactly when a kid puts the phone down to go play.
    if(navigator.sendBeacon &&
       navigator.sendBeacon(BEACON_ENDPOINT, new Blob([body], { type: "application/json" }))){
      return;
    }
    fetch(BEACON_ENDPOINT, {
      method: "POST", body, keepalive: true,
      headers: { "Content-Type": "application/json" },
    }).catch(()=>{});
  }catch(_){}
}

/* Session-scoped de-dupe. sessionStorage (not localStorage) so "once per
 * session" means one browser session, and so a cleared-storage device simply
 * loses de-duping rather than silently dropping every event. */
function beaconOnce(key, name, props){
  try{
    const k = "jumvi_beacon_" + key;
    if(sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
  }catch(_){
    // Private mode / storage disabled: send anyway. Slight over-count beats
    // a blind spot for exactly the users most likely to be privacy-minded.
  }
  beacon(name, props);
}

/* ═══ Reach and retention — Faz 2, Görev 2.1 ═════════════════════════════
 *
 * The honest framing, and the reason these two exist: app_open counts
 * SESSIONS. Read as "how many people", it lies in both directions — the same
 * household coming back on Tuesday counts twice, two kids sharing one phone
 * count once. Rather than pretend one number answers everything, three
 * different numbers answer three different questions:
 *
 *   app_first_open  how many devices ever arrived   → reach
 *   app_open        how many sessions happened      → usage
 *   return_visit    how many devices came back      → retention
 *
 * WHAT IS AND IS NOT STORED. The counter lives in localStorage and never
 * leaves the device. No id, no uuid, no fingerprint is minted here — the
 * server learns "some device reached its 3rd visit", never WHICH device, and
 * cannot tie two visits together. Nothing is sent between thresholds, so the
 * 4th, 6th and 7th visits are invisible by design.
 *
 * app_first_open is still an ESTIMATE, not a headcount: clearing browser data
 * makes a device new again, and a household with two phones counts twice.
 * That caveat has to travel with the number wherever it is shown.
 */
const SEEN_KEY   = "jumvi_seen";
const VISITS_KEY = "jumvi_visits";

/** Visits that produce an event. Between them, nothing is sent. */
const RETURN_VISIT_STEPS = new Set([2, 3, 5, 10]);

function beaconReachAndRetention(){
  // A "visit" is a session, not a page load — same rule app_open follows, or
  // a kid reloading twice would look like a returning household.
  try{
    if(sessionStorage.getItem("jumvi_beacon_visit")) return;
    sessionStorage.setItem("jumvi_beacon_visit", "1");
  }catch(_){
    // No sessionStorage: fall through. A reload may over-count by one, which
    // is the same trade beaconOnce() already makes.
  }

  let visits;
  try{
    const first = !localStorage.getItem(SEEN_KEY);
    if(first) localStorage.setItem(SEEN_KEY, "1");

    visits = (parseInt(localStorage.getItem(VISITS_KEY), 10) || 0) + 1;
    localStorage.setItem(VISITS_KEY, String(visits));

    if(first) beacon("app_first_open");
  }catch(_){
    // Storage unavailable: every session would look like a first visit, which
    // would inflate reach and fake retention. Send neither — a gap is honest,
    // a wrong number is not.
    return;
  }
  if(RETURN_VISIT_STEPS.has(visits)) beacon("return_visit", { n: visits });
}

const _lsDebounceTimers = new Map();
function lsSetDebounced(key, value, delay=500){
  if(!storageAvailable) return;
  if(_lsDebounceTimers.has(key)) clearTimeout(_lsDebounceTimers.get(key));
  const t = setTimeout(()=>{ lsSet(key, value); }, delay);
  _lsDebounceTimers.set(key, t);
}

/** =======================
 * Disable zoom — kapsamlı (iOS + Android + desktop)
 * Kazara pinch/double-tap/Cmd+scroll zoom = kullanıcı kaybı
 * ======================= */
(function disableZoom(){
  // 1. Double-tap zoom (iOS)
  let lastTouchEnd = 0;
  document.addEventListener("touchend", function(e){
    const now = Date.now();
    if(now - lastTouchEnd <= 300){ e.preventDefault(); }
    lastTouchEnd = now;
  }, { passive:false });

  // 2. Pinch zoom (iOS gestureXxx)
  ["gesturestart","gesturechange","gestureend"].forEach(evt => {
    document.addEventListener(evt, function(e){ e.preventDefault(); }, { passive:false });
  });

  // 3. Multi-touch zoom (Android Chrome)
  document.addEventListener("touchstart", function(e){
    if(e.touches && e.touches.length > 1){
      e.preventDefault();
    }
  }, { passive:false });

  // 4. Wheel zoom (desktop Cmd/Ctrl + scroll)
  document.addEventListener("wheel", function(e){
    if(e.ctrlKey || e.metaKey){ e.preventDefault(); }
  }, { passive:false });
})();

/** =======================
 * Selection / context menu disable
 * Kazara metin secimi, copy menu, drag'i engelle
 * ======================= */
(function lockInteractions(){
  // Sag tik / long-press menusu — sadece input/textarea harici
  document.addEventListener("contextmenu", function(e){
    const tag = (e.target && e.target.tagName) || "";
    if(tag === "INPUT" || tag === "TEXTAREA") return;
    e.preventDefault();
  });
  // Selection start engelleme — sadece input/textarea harici
  document.addEventListener("selectstart", function(e){
    const tag = (e.target && e.target.tagName) || "";
    if(tag === "INPUT" || tag === "TEXTAREA") return;
    e.preventDefault();
  });
  // Drag start — image / link draglarini engelle
  document.addEventListener("dragstart", function(e){
    const tag = (e.target && e.target.tagName) || "";
    if(tag === "IMG" || tag === "A"){ e.preventDefault(); }
  });
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

let _lastClickSoundAt = 0;
function clickSound(type="click"){
  if(!soundOn) return;
  const ctx = ensureAudio();
  if(!ctx) return;
  // Rapid taps (browsing, toggling) used to STACK piercing ticks — user
  // feedback: "buton sesleri çok kafa ütülüyor". Coalesce anything closer
  // than 120ms into one sound; success cues always play.
  const now = performance.now();
  if(type !== "success"){
    if(now - _lastClickSoundAt < 120) return;
  }
  _lastClickSoundAt = now;
  const t0 = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Barely-there UI tap: pure sine (no harsh harmonics), mid-low pitch,
  // half the old volume, faster decay. Reads as felt-pad "tup", not "TIK".
  osc.type = "sine";
  osc.frequency.setValueAtTime(type==="success" ? 740 : 560, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(type==="success" ? 0.055 : 0.028, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (type==="success" ? 0.09 : 0.045));

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t0);
  osc.stop(t0 + 0.1);
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

  // Fallback: tiny brand-color burst (no OS emoji glyphs)
  const root = document.createElement("div");
  root.className = "fxBurst";
  for(let i=0;i<18;i++){
    const s = document.createElement("div");
    s.className = "fxStar";
    s.textContent = "";
    s.setAttribute("aria-hidden", "true");
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
 * Background music + sonic reward cues
 * (jumvi-world-ambience.js / jumvi-music-scheduler.js / jumvi-sonic-cues.js)
 * ======================= */
let jumviScheduler = null;
let jumviCues = null;
let _jumviMusicStarted = false;

// jumviScheduler.start() replaces .ctx with a fresh AudioContext each time it
// restarts (e.g. after Mission 2 pauses it), so cues must be rebuilt against
// whichever context is current rather than cached once.
function jumviCueFor(){
  if(!jumviScheduler || !jumviScheduler.ctx) return null;
  if(!jumviCues || jumviCues.ctx !== jumviScheduler.ctx){
    jumviCues = new JumviSonicCues(jumviScheduler.ctx, jumviScheduler.musicBus, jumviScheduler);
  }
  return jumviCues;
}

function startJumviMusicOnce(){
  if(_jumviMusicStarted || !soundOn) return;
  if(typeof JumviMusicScheduler === "undefined") return;
  _jumviMusicStarted = true;
  jumviScheduler = new JumviMusicScheduler({
    fragments: [
      { id: "A", url: "assets/audio/music/JUMVI_FRAGMAN_A_mobil.opus", fallback: "assets/audio/music/JUMVI_FRAGMAN_A_mobil_EQ.mp3" },
      { id: "B-alt", url: "assets/audio/music/JUMVI_FRAGMAN_B-alt_mobil.opus", fallback: "assets/audio/music/JUMVI_FRAGMAN_B-alt_mobil_EQ.mp3" },
    ],
  });
  jumviScheduler.start();
  jumviCueFor();
}
window.addEventListener("pointerdown", startJumviMusicOnce, { passive:true });
window.addEventListener("touchstart", startJumviMusicOnce, { passive:true });

// Bridge other files (coach-leo-audio.js, jumvi-redlight.js) call into
// without needing to know whether the scheduler has started yet.
window.JumviMusic = {
  duck(){ jumviScheduler?.duck(); },
  unduck(){ jumviScheduler?.unduck(); },
  duckForSfx(ms){ jumviScheduler?.duckForSfx(ms); },
  cue(name){ const c = jumviCueFor(); if(c && typeof c[name] === "function") c[name](); },
  pauseForMinigame(){ jumviScheduler?.stop(); },
  resumeAfterMinigame(){ if(soundOn) jumviScheduler?.start(); },
  setEnabled(on){
    if(!jumviScheduler){ if(on) startJumviMusicOnce(); return; }
    if(on) jumviScheduler.start(); else jumviScheduler.stop();
  }
};

/** =======================
 * Certificate helpers
 * (Note: CERT_ID_KEY and CERT_NAME_KEY are declared in the profile-aware
 *  constants block below — per-profile keys.)
 * ======================= */

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
// FIX: ISO date for filenames — avoids commas/spaces from getToday() that break some OSes
function getTodayISO(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const CERT_TEMPLATE_SOURCES = ["certificate-template.webp"];
const CERT_NAME_COLOR = "#1d4ed8";
const CERT_META_COLOR = "#475569";
const CERT_NAME_FONT = "700 64px 'Poppins', 'Helvetica Neue', Arial, sans-serif";
const CERT_META_FONT = "600 20px 'Poppins', 'Helvetica Neue', Arial, sans-serif";

// FIX: crossOrigin prevents canvas tainting when template served from CDN/different origin
function loadImage(src){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = ()=> resolve(img);
    img.onerror = ()=> reject(new Error("img_load_failed"));
    img.src = src;
  });
}

// FIX: Shared iOS/iPadOS detection — modern iPads show "Macintosh" UA
function isIosDevice(){
  return (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) &&
         !window.MSStream;
}
async function loadImageWithFallback(sources){
  for(const src of sources){
    try{
      const img = await loadImage(src);
      return img;
    }catch(_){ window.__jumviFallback("image_source_failed", src); }
  }
  window.__jumviFallback("image_all_sources_failed", (sources||[]).join(", "));
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
    const width = img.naturalWidth || 1376;
    const height = img.naturalHeight || 768;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Draw template
    ctx.drawImage(img, 0, 0, width, height);

    // Name (centered, on the dotted line area)
    // FIX: New 1376x768 template — dotted line sits at ~57.5% from top
    const nameX = width * 0.5;
    const nameY = height * 0.575;
    const maxNameWidth = width * 0.55;
    const baseNameSize = Math.round(width * 0.06);
    const nameSize = fitText(ctx, name, maxNameWidth, baseNameSize, "'Poppins', 'Helvetica Neue', Arial, sans-serif");
    ctx.fillStyle = CERT_NAME_COLOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${nameSize}px 'Poppins', 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillText(name, nameX, nameY);

    // Meta strip — date + cert ID combined into one subtle line above footer
    // (top-right is now occupied by stars/wifi decoration in the new template)
    const metaSize = Math.max(11, Math.round(width * 0.013));
    ctx.font = `600 ${metaSize}px 'Poppins', 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillStyle = CERT_META_COLOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Awarded ${dateText}  ·  ID: ${certId}`, width * 0.5, height * 0.935);

    // Footer branding
    const footerY = height * 0.975;
    const footerSize = Math.max(11, Math.round(width * 0.015));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${footerSize}px 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillStyle = "rgba(80,80,100,0.55)";
    ctx.fillText("JUMVI Toss & Catch Paddle Set • qr.jumvi.co", width * 0.5, footerY);

    return await new Promise(res=>canvas.toBlob(res, "image/png", 1.0));
  }catch(_){
    return null;
  }
}


/** =======================
 * Multi-Profile System
 * ======================= */
const PROFILES_KEY        = "jumvi_profiles_v1";
const ACTIVE_PROFILE_KEY  = "jumvi_active_profile_v1";

/** =======================
 * 3D Hub — opt-in experimental view (off by default for everyone)
 * ======================= */
const HUB3D_FLAG_KEY = "jumvi_3d_hub_enabled";
const HUB_INTRO_KEY = "jumvi_hub_intro_done_v1"; // one-time Coach Leo greeting (Task 3)
const HUB_STARS_KEY = "jumvi_hub_stars";        // collected hub stars, comma-separated ids (bonus only — never gates progress)
function isHub3DEnabled(){
  return lsGet(HUB3D_FLAG_KEY, "0") === "1";
}
// Dev/test convenience only — ?hub3d=1 in the URL flips the opt-in flag on so
// it can be shared as a direct link instead of setting localStorage by hand.
// Not a real feature; the flag itself still defaults to off for everyone else.
try {
  if(new URLSearchParams(window.location.search).get("hub3d") === "1"){
    lsSet(HUB3D_FLAG_KEY, "1");
  }
}catch(_){}
const PROFILE_AVATARS = window.JUMVI_ART ? [...window.JUMVI_ART.AVATAR_IDS] : ["monkey"];

function getProfiles(){
  const profiles = lsGetJSON(PROFILES_KEY, []);
  if(!Array.isArray(profiles)) return [];
  return profiles.map(p => ({
    ...p,
    avatar: window.JUMVI_ART ? window.JUMVI_ART.avatarId(p && p.avatar) : (p && p.avatar) || "monkey"
  }));
}
function getActiveProfileId(){
  return lsGet(ACTIVE_PROFILE_KEY, "p1");
}
function getActiveProfile(){
  const id = getActiveProfileId();
  return getProfiles().find(p => p.id === id) || null;
}
function saveProfiles(arr){
  try { lsSet(PROFILES_KEY, JSON.stringify(arr)); } catch(_){}
}
function nextProfileId(){
  const ps = getProfiles();
  let n = 1;
  while(ps.find(p => p.id === ("p"+n))) n++;
  return "p"+n;
}

/* Migration: tek kullanıcı → "Default" profile */
(function migrateToProfiles(){
  if(!storageAvailable) return;
  if(lsGet(PROFILES_KEY, null) !== null) return; // zaten migrate edildi

  const oldKeys = [
    "missions_done_v3","streak_count_v1","streak_best_v1","streak_last_v1",
    "daily_date_v1","daily_id_v1","daily_n_v1",
    "attempts_v1","skips_v1","badges_unlocked_v1",
    "age_v2","cert_name_v1","cert_id_v1","avatar_v1"
  ];
  oldKeys.forEach(k => {
    const oldKey = "jumvi_" + k;
    const val = lsGet(oldKey, null);
    if(val !== null){
      try { lsSet("jumvi_p1_" + k, val); } catch(_){}
    }
  });

  const oldAvatarIdx = Number(lsGet("jumvi_avatar_v1", "0")) || 0;
  const defaultAvatar = PROFILE_AVATARS[oldAvatarIdx] || "monkey";

  const profiles = [{
    id: "p1",
    name: "Player",
    avatar: defaultAvatar,
    createdAt: new Date().toISOString()
  }];
  saveProfiles(profiles);
  lsSet(ACTIVE_PROFILE_KEY, "p1");
})();

/* Tek profil bile yoksa (yeni cihaz) — boş bir başlangıç profili oluştur */
(function ensureAtLeastOneProfile(){
  if(!storageAvailable) return;
  const ps = getProfiles();
  if(ps.length === 0){
    const p = { id:"p1", name:"Player", avatar:"monkey", createdAt: new Date().toISOString() };
    saveProfiles([p]);
    lsSet(ACTIVE_PROFILE_KEY, "p1");
  }
})();

const _PP = "jumvi_" + getActiveProfileId() + "_"; // profile prefix

/** =======================
 * State
 * ======================= */
const LS_KEY = _PP + "missions_done_v3";
const ONLY_KEY = "jumvi_only_unfinished_v1";

/* UI + persistence (per-profile) */
const STREAK_COUNT_KEY  = _PP + "streak_count_v1";
const STREAK_BEST_KEY   = _PP + "streak_best_v1";
const STREAK_LAST_KEY   = _PP + "streak_last_v1";
const DAILY_DATE_KEY    = _PP + "daily_date_v1";
const DAILY_ID_KEY      = _PP + "daily_id_v1";
const DAILY_N_KEY       = _PP + "daily_n_v1";
const AGE_KEY           = _PP + "age_v2";
const ATTEMPTS_KEY      = _PP + "attempts_v1";
const SKIPS_KEY         = _PP + "skips_v1";
const BADGES_UNLOCKED_KEY = _PP + "badges_unlocked_v1";
const AVATAR_KEY        = _PP + "avatar_v1";
const CERT_ID_KEY       = _PP + "cert_id_v1";
const CERT_NAME_KEY     = _PP + "cert_name_v1";

/* Global (UI/UX prefs — paylaşılan) */
const PACK_KEY          = "jumvi_current_pack_v1";
const SOLIDBG_KEY       = "jumvi_solid_bg_v1";
const KIDSMODE_KEY      = "jumvi_kids_mode_v1";
const A2HS_DISMISS_KEY  = "jumvi_a2hs_dismiss_v1";
const ONBOARD_KEY       = "jumvi_onboarded_v2";
const AUTO_DONE_KEY     = "jumvi_auto_done_v1";
const THEME_KEY         = "jumvi_theme_v1";
const TUTORIAL_KEY      = "jumvi_tutorial_done_v1";
const HIGH_SCORES_KEY   = _PP + "high_scores_v1";

const CATEGORY_OPTIONS = ["all","Reflex","Aim","Focus","Team","Indoor"];
const PLAYERS_OPTIONS = ["all","Solo","2","3+"];
const DIFFICULTY_OPTIONS = ["all","Easy","Medium"];
const AVATARS = PROFILE_AVATARS.slice(0, 8);

const state = {
  done: new Set(lsGetJSON(LS_KEY, [])),
  unlockedBefore: false,
  onlyUnfinished: (lsGet(ONLY_KEY, "0")) === "1",
  currentPack: lsGet(PACK_KEY, "all"),
  currentCategory: "all",
  currentPlayers: "all",
  // §1.1 fix — restore the onboarding age ceiling on EVERY boot. The welcome
  // screen is suppressed on return visits (jumvi_onboarded_v2), so without
  // reading AGE_KEY here the age gate would be single-session only and
  // currentDifficulty would silently fall back to "all". AGE_KEY holds the
  // band's difficulty ceiling ("Easy" / "all").
  currentDifficulty: lsGet(AGE_KEY, "all"),
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
  themeMode: lsGet(THEME_KEY, "light")
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

// §1.1 — cumulative age ceiling, shared by the welcome count AND the daily pick
// so Today's Mission (the endpoint of the 2-tap flow) respects the age gate.
// Data has 2 tiers (17 easy + 19 medium); add a "Hard" entry if a 3rd is added.
const AGE_DIFF_CEIL = { Easy: 1, Medium: 2, all: Infinity };
function ageCeiling(){
  const c = AGE_DIFF_CEIL[currentDifficulty];
  return (c != null) ? c : Infinity;
}
function ageEligibleMissions(){
  const c = ageCeiling();
  const pool = missions.filter(x => x.difficulty <= c);
  return pool.length ? pool : missions; // never empty
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

let _missionBackgroundRestore = null;
let _missionReturnFocus = null;
const MISSION_BACKGROUND_SELECTORS = [
  "#app-wrapper > .sticky",
  "#app-wrapper > .wrap",
  "#offlineBanner",
  "#undoBar",
  "#bottomNav",
  "#soundToggle"
];
function setMissionBackgroundIsolation(active){
  if(active){
    if(_missionBackgroundRestore) return;
    const seen = new Set();
    _missionBackgroundRestore = MISSION_BACKGROUND_SELECTORS
      .map(sel => document.querySelector(sel))
      .filter(el => el && !seen.has(el) && seen.add(el))
      .map(el => ({
        el,
        inert: !!el.inert,
        hadInert: el.hasAttribute("inert"),
        ariaHidden: el.getAttribute("aria-hidden")
      }));
    _missionBackgroundRestore.forEach(state => {
      state.el.inert = true;
      state.el.setAttribute("inert", "");
      state.el.setAttribute("aria-hidden", "true");
    });
    return;
  }
  if(!_missionBackgroundRestore) return;
  _missionBackgroundRestore.forEach(state => {
    state.el.inert = state.inert;
    if(state.hadInert) state.el.setAttribute("inert", "");
    else state.el.removeAttribute("inert");
    if(state.ariaHidden == null) state.el.removeAttribute("aria-hidden");
    else state.el.setAttribute("aria-hidden", state.ariaHidden);
  });
  _missionBackgroundRestore = null;
}
function dialogFocusable(container){
  if(!container) return [];
  return Array.from(container.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(el => !el.hidden && el.getClientRects().length && el.getAttribute("aria-hidden") !== "true");
}
function handleDialogKeys(event, container, closeDialog){
  if(event.key === "Escape"){
    event.preventDefault();
    closeDialog();
    return;
  }
  if(event.key !== "Tab") return;
  const focusable = dialogFocusable(container);
  if(!focusable.length){ event.preventDefault(); return; }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if(event.shiftKey && document.activeElement === first){
    event.preventDefault();
    last.focus();
  }else if(!event.shiftKey && document.activeElement === last){
    event.preventDefault();
    first.focus();
  }
}

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
const btnDailyReplay = document.getElementById("btnDailyReplay");
const btnDailyNew = document.getElementById("btnDailyNew");
// Mission the Picked-for-You card's primary action leads to once the featured
// mission is done (0 = the card is still offering the featured mission).
let _dailyNextId = 0;

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
// certMetaLine removed — date + cert ID are now baked into the cert image itself
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
    saveImg.style.display = "none"; // FIX: hide image on close (was "block")
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

    // Prefer clear local voices without artificially forcing a child persona.
    if(name.includes("female")) s += 2;
    if(name.includes("child") || name.includes("kid")) s += 1;
    if(name.includes("male")) s -= 1;
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
  if(!("speechSynthesis" in window)){ btnSpeak.style.display = "none"; window.__jumviFallback("tts_unsupported", "read-aloud hidden; §3.1 auto-read disabled"); }
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

/* ===== XP + Levels — derived from unique mission completions ==============
 * There is deliberately NO XP localStorage key.
 * `done` is already per-profile and is the source of truth, so:
 *   - existing families receive the correct XP immediately after this update,
 *   - replaying a completed mission cannot farm XP,
 *   - Undo / Mark as Not Done removes the XP automatically,
 *   - backup/restore and progress reset need no new migration path.
 * Quick Play remains repeatable and does NOT award Mission XP.
 */
const XP_BY_DIFFICULTY = Object.freeze({ 1: 10, 2: 20, 3: 30 });
const XP_LEVELS = Object.freeze([
  { level:1, min:0,   en:"Rookie Player",    tr:"Yeni Oyuncu" },
  { level:2, min:80,  en:"Quick Catcher",    tr:"Hızlı Yakalayıcı" },
  { level:3, min:170, en:"Rally Builder",    tr:"Seri Ustası" },
  { level:4, min:270, en:"Skill Star",       tr:"Beceri Yıldızı" },
  { level:5, min:370, en:"All-Star",         tr:"Süper Yıldız" },
  { level:6, min:470, en:"JUMVI Pro",        tr:"JUMVI Pro" },
  { level:7, min:550, en:"JUMVI Champion",   tr:"JUMVI Şampiyonu" }
]);
const XP_MAX = XP_LEVELS[XP_LEVELS.length - 1].min;

function missionXp(ms){
  if(!ms) return 0;
  return XP_BY_DIFFICULTY[Number(ms.difficulty)] || 0;
}
function xpFromDoneSet(doneSet){
  let total = 0;
  if(!doneSet || typeof doneSet[Symbol.iterator] !== "function") return 0;
  for(const id of doneSet){
    total += missionXp(missions.find(m => m.id === Number(id)));
  }
  return Math.min(XP_MAX, total);
}
function xpLevelInfo(xpValue){
  const xp = Math.max(0, Math.min(XP_MAX, Number(xpValue) || 0));
  let index = 0;
  for(let i=0; i<XP_LEVELS.length; i++){
    if(xp >= XP_LEVELS[i].min) index = i;
    else break;
  }
  const current = XP_LEVELS[index];
  const next = XP_LEVELS[index + 1] || current;
  const isMax = index === XP_LEVELS.length - 1;
  const span = Math.max(1, next.min - current.min);
  const pct = isMax ? 100 : Math.max(0, Math.min(100, Math.round(((xp - current.min) / span) * 100)));
  return { xp, current, next, isMax, pct };
}
function isTurkishUI(){
  return window.__JUMVI_LOCALE === "tr-TR" || document.documentElement.lang === "tr";
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

/* Skill packs — yeni dile uygun, tam 6 kategori, pack-renk eşleşmeli */
// Order MUST match PACKS (data.js) and ZONE_THEMES (jumvi-hub-app.js): drives
// the 2D path view + "Pack N of 6" numbering. Reflex Rush is last so the walk
// (and the list) starts on the bright Aim zone, not the dark Reflex energy one.
/* pack_view — Faz 2, Görev 2.1.
 *
 * The obvious hook, the pack filter chips in renderFilters(), is dead UI:
 * #filters is display:none in index.html and nothing ever un-hides it. An
 * event wired there would have read zero forever while looking healthy.
 *
 * The Mission Path is how a pack is actually browsed today — a vertical run
 * of pack sections the child scrolls through. "Viewed" means the pack's
 * HEADER came properly into view. Watching the whole section instead would
 * look more natural and be quietly broken: a six-mission section is taller
 * than a phone screen, so a 0.5 threshold on it can never be satisfied. The
 * header is short, so the threshold means what it says.
 *
 * Once per pack per session, like every other browsing signal here. */
let _packViewObserver = null;
function packViewObserver(){
  if(_packViewObserver) return _packViewObserver;
  if(typeof IntersectionObserver !== "function"){
    // No observer (very old browser): lose the signal rather than guess.
    _packViewObserver = { observe(){}, disconnect(){} };
    return _packViewObserver;
  }
  _packViewObserver = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      const key = entry.target.dataset.packKey;
      if(key) beaconOnce("pack_view_" + key, "pack_view", { pack: key });
      // One report per pack is all we want; stop watching it either way.
      _packViewObserver.unobserve(entry.target);
    });
  }, { threshold: 0.5 });
  return _packViewObserver;
}

const SKILL_PACKS = [
  { key:"Aim Master",     label:"Bullseye!",       color:"#4FB3FF" },
  { key:"Focus Control",  label:"Zen Mode",        color:"#22c55e" },
  { key:"Team Duo",       label:"Team Up",         color:"#A855F7" },
  { key:"Indoor Compact", label:"Indoor Fun",      color:"#06B6D4" },
  { key:"Beach/Park",     label:"Outdoor",         color:"#FFAB00" },
  { key:"Reflex Rush",    label:"Lightning Hands", color:"#FF6A00" }
];

function renderParentDashboard(){
  if(!dashBars || !dashReport) return;
  const counts = {};
  const frag = document.createDocumentFragment();
  SKILL_PACKS.forEach(p=>{
    const doneCount = missions.filter(m=>m.pack===p.key && done.has(m.id)).length;
    const total = missions.filter(m=>m.pack===p.key).length || 6;
    counts[p.label] = doneCount;
    const pct = Math.round((doneCount / total) * 100);
    const row = document.createElement("div");
    row.className = "dashRow" + (doneCount >= total ? " dashRowComplete" : (doneCount > 0 ? " dashRowActive" : ""));
    row.style.setProperty("--skill-color", p.color);
    const icon = document.createElement("div");
    icon.className = "dashIcon";
    icon.innerHTML = doneCount >= total
      ? '<i class="jic jic-circle-check" aria-hidden="true"></i>'
      : JUMVI_ART.img(JUMVI_ART.pack(p.key), "packArt", "", true);
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
    count.textContent = `${doneCount}/${total}`;
    row.appendChild(icon);
    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(count);
    frag.appendChild(row);
  });
  dashBars.replaceChildren(frag);
  dashReport.textContent = getMilestoneLine(counts);

  // Dinamik alt başlık — hangi skill en çok tamamlandıysa
  const dynSub = document.getElementById("dashDynSub");
  if(dynSub){
    const topSkill = getTopSkill(counts);
    const topSkillPack = topSkill ? SKILL_PACKS.find(p=>p.label===topSkill) : null;
    if(topSkillPack && counts[topSkill] > 0){
      dynSub.textContent = `Building ${topSkillPack.label} skills`;
    } else {
      dynSub.textContent = "Keep playing to see your child's skills grow!";
    }
  }

  // Stats row
  const statsEl = document.getElementById("dashStats");
  if(statsEl){
    const mins = getEstimatedPlayMinutes();
    const topSkill = getTopSkill(counts);
    const topSkillPack = topSkill ? SKILL_PACKS.find(p=>p.label===topSkill) : null;
    statsEl.innerHTML = `
      <div class="dashStatItem"><span class="dashStatVal">${mins}</span><span class="dashStatLbl">min total play</span></div>
      <div class="dashStatItem"><span class="dashStatVal">${streakCount}</span><span class="dashStatLbl">day streak</span></div>
      ${topSkillPack ? `<div class="dashStatItem"><span class="dashStatVal dashStatArt">${JUMVI_ART.img(JUMVI_ART.pack(topSkillPack.key), "packArt", "", true)}</span><span class="dashStatLbl">top: ${escapeHtml(topSkillPack.label)}</span></div>` : ""}
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
    const icons = { dark: '<i class="jic jic-moon" aria-hidden="true"></i>', light: '<i class="jic jic-sun" aria-hidden="true"></i>', system: '<i class="jic jic-moon-stars" aria-hidden="true"></i>' };
    themeToggle.innerHTML = icons[mode] || '<i class="jic jic-moon-stars" aria-hidden="true"></i>';
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

/* ===== Streak Freeze (haftada 1 koruma) ===== */
const STREAK_FREEZE_KEY = _PP + "streak_freeze_v1";
// State: { available:bool, lastReplenishIso:"YYYY-MM-DD", lastUsedIso:"YYYY-MM-DD" }

function getFreezeState(){
  const s = lsGetJSON(STREAK_FREEZE_KEY, null);
  if(s && typeof s.available === "boolean") return s;
  // İlk kez — bir freeze ile başla
  const fresh = { available: true, lastReplenishIso: isoLocalDate(), lastUsedIso: "" };
  lsSet(STREAK_FREEZE_KEY, JSON.stringify(fresh));
  return fresh;
}
function saveFreezeState(s){
  try { lsSet(STREAK_FREEZE_KEY, JSON.stringify(s)); } catch(_){}
}
/* Pazartesi sıfırla — haftada 1 freeze yenilenir */
function refreshFreezeIfWeekChanged(){
  const s = getFreezeState();
  const today = new Date();
  // ISO week monday: Pazartesi 1, Pazar 0
  const dayOfWeek = today.getDay(); // 0=Sun..6=Sat
  // Bu haftanın Pazartesi'sini bul
  const monday = new Date(today);
  const offset = (dayOfWeek + 6) % 7; // Pzt=0, Sal=1...
  monday.setDate(today.getDate() - offset);
  monday.setHours(0,0,0,0);
  const mondayIso = isoLocalDate(monday);

  if(s.lastReplenishIso < mondayIso){
    s.available = true;
    s.lastReplenishIso = mondayIso;
    saveFreezeState(s);
  }
}

function recordActivityToday(){
  const today = isoLocalDate();
  if(lastActiveIso === today) return false; // already counted today

  refreshFreezeIfWeekChanged();
  const yesterday = yesterdayIso(today);

  if(lastActiveIso === yesterday){
    // Normal devam
    streakCount = setState("streakCount", Math.max(0, streakCount) + 1);
  } else if(lastActiveIso && streakCount > 0){
    // 1+ gün geçti, streak kırılma riski → freeze varsa kullan
    const freeze = getFreezeState();
    // Sadece 2 günlük gap için freeze geçerli (1 gün kaçırma)
    const dayBeforeYesterday = yesterdayIso(yesterday);
    if(freeze.available && lastActiveIso === dayBeforeYesterday){
      // Freeze kullan — streak korunur, +1 ekle
      freeze.available = false;
      freeze.lastUsedIso = today;
      saveFreezeState(freeze);
      streakCount = setState("streakCount", Math.max(0, streakCount) + 1);
      // UI'da bildiri (delay ile, completion toast ezmesin)
      setTimeout(()=>{
        showToast("Streak Freeze used! Your streak is safe.");
        if(!prefersReducedMotion) fireConfetti(800);
      }, 2800);
      trackEvent("Streak Freeze Used");
    } else {
      // Freeze yok veya çok gün geçti — streak sıfırla
      streakCount = setState("streakCount", 1);
    }
  } else {
    streakCount = setState("streakCount", 1);
  }

  bestStreak = setState("bestStreak", Math.max(bestStreak, streakCount));
  lastActiveIso = setState("lastActiveIso", today);
  persistStreak();
  return true;
}

/* Public helper: freeze durumunu UI için */
function getStreakFreezeStatus(){
  refreshFreezeIfWeekChanged();
  const s = getFreezeState();
  return {
    available: s.available,
    lastUsedIso: s.lastUsedIso || "",
    nextReplenishDays: (function(){
      const today = new Date();
      const dayOfWeek = today.getDay();
      // Sonraki Pazartesi'ye kalan gün
      return (dayOfWeek === 0) ? 1 : (8 - dayOfWeek);
    })()
  };
}
function renderStreakUI(animate=false){
  if(!streakPill) return;
  const sc = streakCount || 0;
  // Seviye bazli emoji + label (Duolingo style)
  let icon = "";
  let label;
  if(sc === 0){
    icon = '<i class="jic jic-star" aria-hidden="true"></i>';
    label = "Start your streak!";
    streakPill.style.opacity = "0.6";
  } else if(sc >= 30){
    icon = '<i class="jic jic-flame" aria-hidden="true"></i>';
    label = `${sc} day legend!`;
    streakPill.style.opacity = "";
  } else if(sc >= 14){
    icon = '<i class="jic jic-flame" aria-hidden="true"></i>';
    label = `${sc} days on fire!`;
    streakPill.style.opacity = "";
  } else if(sc >= 7){
    icon = '<i class="jic jic-flame" aria-hidden="true"></i>';
    label = `${sc} day streak!`;
    streakPill.style.opacity = "";
  } else if(sc >= 3){
    icon = '<i class="jic jic-flame" aria-hidden="true"></i>';
    label = `${sc} day streak`;
    streakPill.style.opacity = "";
  } else {
    icon = '<i class="jic jic-flame" aria-hidden="true"></i>';
    label = `${sc} day${sc === 1 ? "" : "s"}`;
    streakPill.style.opacity = "";
  }
  streakPill.innerHTML = `<span class="streakIcon">${icon}</span><span class="streakLabel">${label}</span>`;

  // Seviye class — CSS bunu kullanip gradient/glow uygulayacak
  streakPill.classList.remove("streak-warm","streak-hot","streak-mega","streak-legendary","streak-zero");
  if(sc === 0) streakPill.classList.add("streak-zero");
  else if(sc >= 30) streakPill.classList.add("streak-legendary");
  else if(sc >= 14) streakPill.classList.add("streak-mega");
  else if(sc >= 7) streakPill.classList.add("streak-hot");
  else if(sc >= 3) streakPill.classList.add("streak-warm");

  if(animate && streakCount > 0){
    streakPill.classList.remove("pulse");
    void streakPill.offsetWidth;
    streakPill.classList.add("pulse");
    setTimeout(()=> streakPill.classList.remove("pulse"), 600);
  }
}

function checkStreakWarning(){
  if(streakCount <= 0) return;
  const today = isoLocalDate();
  if(lastActiveIso === today) return; // bugün zaten oynadı
  // Streak kırılma riski — dün oynadıysa uyar
  const yesterday = yesterdayIso(today);
  if(lastActiveIso === yesterday){
    setTimeout(()=> showToast("Coach Leo misses you! Play today to keep your streak going!"), 2000);
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
  // §1.1 — draw only from the age-eligible pool so Today's Mission never hands
  // a 3–5 kid a mission above their tier. Deterministic per (day, ceiling).
  const list = ageEligibleMissions();
  const h = hashFNV1a(`${iso}|${n}|JUMVI`);
  return list[h % list.length].id;
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
  // Re-pick if the stored mission is missing OR now sits above the age ceiling
  // (e.g. the age band was chosen after today's pick was first computed).
  const cur = missions.find(x=>x.id===dailyIdStored);
  if(!dailyIdStored || !cur || cur.difficulty > ageCeiling()){
    dailyIdStored = setState("dailyIdStored", pickDailyId(today, dailyN||0));
    persistDaily();
  }
}
function renderDailyUI(){
  ensureDailyMission();
  const ms = missions.find(x=>x.id===dailyIdStored);
  if(!ms) return;
  const doneToday = done.has(ms.id);

  if(dailyIcon) dailyIcon.innerHTML = doneToday
    ? '<i class="jic jic-circle-check" aria-hidden="true"></i>'
    : JUMVI_ART.img(JUMVI_ART.mission(ms.id), "missionArt", ms.title, true);
  if(dailyName) dailyName.textContent = ms.title;
  if(dailyMeta){
    dailyMeta.innerHTML = `
      <span class="tag pack">${escapeHtml(getPackName(ms.pack))}</span>
      <span class="tag diff">${diffLabel(ms.difficulty)} • ${escapeHtml(ms.time)}</span>
      <span class="tag"><i class="jic jic-users" aria-hidden="true"></i> ${escapeHtml(ms.players)}</span>
      <span class="tag xpTag">+${missionXp(ms)} XP</span>
    `;
  }
  /* Completion hierarchy. A finished mission used to leave "Play Again" as the
   * single, full-width, high-contrast action — so the obvious next tap was to
   * repeat the game the family just played, and the other 35 stayed invisible.
   * Replay is still one tap away; it is just no longer the loudest thing on the
   * screen. Reads existing state only — nothing here writes progress. */
  const nextPick = doneToday ? getNextRecommendedMission(ms.id) : null;
  _dailyNextId = nextPick ? nextPick.id : 0;
  if(btnDailyPlay){
    // Label only — see index.html for why this button carries no aria-label.
    if(nextPick){
      btnDailyPlay.innerHTML = `<i class="jic jic-arrow-right" aria-hidden="true"></i> <span class="dailyPlayLabel">Next: ${escapeHtml(nextPick.title)}</span>`;
    }else if(doneToday){
      // Every mission is done — replay is genuinely the only thing left.
      btnDailyPlay.innerHTML = '<i class="jic jic-loop" aria-hidden="true"></i> Play Again';
    }else{
      btnDailyPlay.innerHTML = '<i class="jic jic-play" aria-hidden="true"></i> Start Mission';
    }
  }
  if(btnDailyReplay) btnDailyReplay.style.display = nextPick ? "" : "none";
  // States this mission's own status in words, not just the green check icon.
  // The running "N of 36 missions complete" count deliberately stays in the
  // progress strip directly below rather than being repeated here.
  const doneNote = document.getElementById("dailyDoneNote");
  if(doneNote) doneNote.style.display = doneToday ? "" : "none";
}

/* The mission to offer after this one is finished. Deliberately reuses the
 * existing recommendation engine (getCoachPick: least-finished pack first, an
 * Easy mission within it, deterministic per day) instead of introducing a
 * second, competing notion of "next". Read-only. */
function getNextRecommendedMission(afterId){
  const pick = getCoachPick();
  if(pick && pick.mission && pick.mission.id !== afterId) return pick.mission;
  const pool = ageEligibleMissions().filter(m => !done.has(m.id) && m.id !== afterId);
  return pool.length ? pool[0] : null;
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
  donePill.setAttribute("aria-label", "Mission completed");
  donePill.setAttribute("title", "Done");
  donePill.innerHTML = '<span aria-hidden="true">✓</span>';

  c.appendChild(icon);
  c.appendChild(main);
  c.appendChild(donePill);

  c._refs = { icon, title, packTag, diffTag, playersTag, teaser };
  return c;
}

function updateMissionCard(card, ms, isDone){
  const r = card._refs;
  if(r){
    r.icon.innerHTML = JUMVI_ART.img(JUMVI_ART.mission(ms.id), "missionArt", ms.title);
    r.title.textContent = ms.title;
    r.packTag.textContent = getPackName(ms.pack);
    r.diffTag.textContent = `${diffLabel(ms.difficulty)} • ${ms.time}`;
    r.playersTag.innerHTML = `<i class="jic jic-users" aria-hidden="true"></i> ${escapeHtml(ms.players)}`;
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
  // Browse is path-only now. Do not build 36 hidden legacy cards during the
  // QR first impression; that network burst can starve the visible welcome
  // art on budget phones. Keep this function as a compatibility refresh hook.
  if(!listEl || getComputedStyle(listEl).display === "none"){
    if(listEl) listEl.replaceChildren();
    updateProgress({ deferStats: done.size === 0 });
    return;
  }
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

function showBadgeUnlockModal(badge){
  const modal = document.getElementById("badgeUnlockModal");
  if(!modal) return;
  // The badge id is a frozen 11-value enum (BADGES in data.js), never a name.
  beacon("badge_earned", { badge: badge.id });
  window.JumviMusic?.cue("playBadge");
  const emojiEl = document.getElementById("badgeUnlockEmoji");
  const nameEl  = document.getElementById("badgeUnlockName");
  const reqEl   = document.getElementById("badgeUnlockReq");
  const closeBtn = document.getElementById("badgeUnlockClose");
  const returnFocus = document.activeElement;
  const missionState = backdrop && backdrop.classList.contains("show") ? {
    inert: !!backdrop.inert,
    hadInert: backdrop.hasAttribute("inert"),
    ariaHidden: backdrop.getAttribute("aria-hidden")
  } : null;
  if(emojiEl) emojiEl.innerHTML = JUMVI_ART.img(JUMVI_ART.badge(badge.id) || JUMVI_ART.badge("unlocked"), "badgeArt", badge.name, true);
  if(nameEl)  nameEl.textContent  = badge.name;
  if(reqEl)   reqEl.textContent   = badge.req;
  modal.hidden = false;
  modal.inert = false;
  modal.removeAttribute("inert");
  modal.setAttribute("aria-hidden", "false");
  if(missionState){
    backdrop.inert = true;
    backdrop.setAttribute("inert", "");
    backdrop.setAttribute("aria-hidden", "true");
  }
  requestAnimationFrame(()=> modal.classList.add("show"));
  requestAnimationFrame(()=>{ try{ closeBtn?.focus({ preventScroll:true }); }catch(_){ closeBtn?.focus(); } });
  if(!prefersReducedMotion) fireConfetti(2000);
  clickSound("success");
  const dismiss = ()=>{
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    modal.inert = true;
    modal.setAttribute("inert", "");
    if(missionState){
      backdrop.inert = missionState.inert;
      if(missionState.hadInert) backdrop.setAttribute("inert", "");
      else backdrop.removeAttribute("inert");
      if(missionState.ariaHidden == null) backdrop.removeAttribute("aria-hidden");
      else backdrop.setAttribute("aria-hidden", missionState.ariaHidden);
    }
    setTimeout(()=>{ if(!modal.classList.contains("show")) modal.hidden = true; }, 300);
    requestAnimationFrame(()=>{
      if(returnFocus && returnFocus.isConnected && returnFocus.getClientRects().length){
        try{ returnFocus.focus({ preventScroll:true }); }catch(_){ returnFocus.focus(); }
      }
    });
  };
  if(closeBtn){ closeBtn.onclick = dismiss; }
  modal.onclick = (e)=>{ if(e.target===modal) dismiss(); };
  modal.onkeydown = (e)=> handleDialogKeys(e, modal, dismiss);
}

function updateBadges(){
  badgesRow.innerHTML = "";
  const badgeCtx = { streakCount, bestStreak };
  const prevUnlocked = new Set(lsGetJSON(BADGES_UNLOCKED_KEY, []));
  const nowUnlocked  = new Set();
  const newlyUnlocked = [];

  BADGES.forEach(b=>{
    const ok = !!b.check(done, badgeCtx);
    if(ok){
      nowUnlocked.add(b.id);
      if(!prevUnlocked.has(b.id)) newlyUnlocked.push(b);
    }
    // Pack badge'i için ilerleme detayı (3/6 gibi)
    let progressText = "";
    if(b.category === "pack" && b.pack){
      const total = missions.filter(m=>m.pack===b.pack).length || 6;
      const doneInPack = missions.filter(m=>m.pack===b.pack && done.has(m.id)).length;
      progressText = `${doneInPack}/${total}`;
    } else if(b.category === "streak"){
      const target = (b.id === "streak7") ? 7 : 3;
      const cur = Math.min(streakCount || 0, target);
      progressText = `${cur}/${target}`;
    } else if(b.id === "first"){
      progressText = `${Math.min(done.size, 1)}/1`;
    } else if(b.id === "champ"){
      progressText = `${done.size}/36`;
    }

    const el = document.createElement("div");
    el.className = "badge" + (ok ? " unlocked" : "");
    if(b.pack){
      const slug = "pack--" + b.pack.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
      el.classList.add(slug);
    }
    el.innerHTML = `
      <div class="badgeIcon">${JUMVI_ART.img(JUMVI_ART.badge(b.id), "badgeArt", b.name)}</div>
      <div class="badgeName">${escapeHtml(b.name)}</div>
      <div class="badgeReq">${escapeHtml(b.req)}</div>
      ${progressText ? `<div class="badgeProgress">${ok ? '<i class="jic jic-circle-check" aria-hidden="true"></i> Earned' : progressText}</div>` : ""}
    `;
    badgesRow.appendChild(el);
  });

  // Yeni kazanılan badge'leri kaydet
  if(nowUnlocked.size > 0){
    lsSet(BADGES_UNLOCKED_KEY, JSON.stringify([...nowUnlocked]));
  }

  // Badges modal — 2 kolonlu grid (her badge için DOĞRU progress)
  badgesList.innerHTML = BADGES.map(b=>{
    const ok = !!b.check(done, badgeCtx);
    let toGo = "";
    if(!ok){
      if(b.category === "pack" && b.pack){
        const total = missions.filter(m=>m.pack===b.pack).length || 6;
        const doneInPack = missions.filter(m=>m.pack===b.pack && done.has(m.id)).length;
        const left = Math.max(0, total - doneInPack);
        toGo = `${doneInPack}/${total} · ${left} to go`;
      } else if(b.category === "streak"){
        const target = (b.id === "streak7") ? 7 : 3;
        const cur = Math.min(streakCount || 0, target);
        const left = Math.max(0, target - cur);
        toGo = `${cur}/${target} · ${left} day${left===1?"":"s"} to go`;
      } else if(b.id === "first"){
        toGo = "Start your first mission!";
      } else if(b.id === "champ"){
        const left = Math.max(0, 36 - done.size);
        toGo = `${done.size}/36 · ${left} more to go`;
      } else {
        toGo = '<i class="jic jic-lock" aria-hidden="true"></i> Locked';
      }
    }
    let extraClass = "";
    if(b.pack){
      const slug = "pack--" + b.pack.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
      extraClass = " " + slug;
    }
    return `
      <div class="badgesListItem ${ok ? "badge-earned" : "badge-locked"}${extraClass}">
        <div class="badgesListIcon">${JUMVI_ART.img(JUMVI_ART.badge(b.id), "badgeArt", b.name)}</div>
        <div class="badgesListName">${escapeHtml(b.name)}</div>
        <div class="badgesListReq">${escapeHtml(b.req)}</div>
        <div class="badgesListStatus">${ok ? '<i class="jic jic-circle-check" aria-hidden="true"></i> Earned' : toGo}</div>
      </div>
    `;
  }).join("");

  // Certificate unlock + progress bar
  const total = missions.length;
  const completed = done.size;
  const unlockedAll = completed >= total;
  const certFill = document.getElementById("certProgressFill");
  if(certFill) certFill.style.width = Math.round((completed/total)*100) + "%";

  if(unlockedAll){
    certBtn.classList.add("unlocked");
    certBtn.classList.remove("locked");
    certBtn.textContent = "Open";
    certBtn.setAttribute("aria-disabled","false");
    certSub.textContent = "Unlocked! Open and save your certificate.";
  }else{
    certBtn.classList.remove("unlocked");
    certBtn.classList.add("locked");
    certBtn.textContent = "Locked";
    certBtn.setAttribute("aria-disabled","true");
    const left = total - completed;
    certSub.textContent = `${completed} / ${total} done — ${left} more to go!`;
  }

  // Sertifika kutlaması (tüm mission tamamlandığında)
  if(unlockedAll && !unlockedBefore){
    unlockedBefore = setState("unlockedBefore", true);
    const box = document.getElementById("certBox");
    if(box){ box.classList.add("unlockedPulse"); setTimeout(()=> box.classList.remove("unlockedPulse"), 1150); }
    clickSound("success");
    fireConfetti();
    showToast("Unlocked! Open your certificate.");
  }
  if(!unlockedAll && unlockedBefore){
    unlockedBefore = setState("unlockedBefore", false);
  }

  // Yeni badge kutlaması (sadece gerçekten yeni unlock'larda)
  if(newlyUnlocked.length > 0 && done.size > 0){
    // Birden fazla unlock varsa en son kazanılanı göster
    setTimeout(()=> showBadgeUnlockModal(newlyUnlocked[newlyUnlocked.length - 1]), 800);
  }
}


function renderXpUI(){
  const card = document.getElementById("xpProgressCard");
  if(!card) return;

  const info = xpLevelInfo(xpFromDoneSet(done));
  const tr = isTurkishUI();

  const levelLabel = document.getElementById("xpLevelLabel");
  const levelName = document.getElementById("xpLevelName");
  const xpValue = document.getElementById("xpValue");
  const xpBar = document.getElementById("xpBar");
  const xpFill = document.getElementById("xpBarFill");
  const badgeCount = document.getElementById("xpBadgeCount");

  card.dataset.level = String(info.current.level);

  if(levelLabel) levelLabel.textContent = `${tr ? "Seviye" : "Level"} ${info.current.level}`;
  if(levelName) levelName.textContent = tr ? info.current.tr : info.current.en;
  if(xpValue) xpValue.textContent = `${info.xp} / ${info.isMax ? XP_MAX : info.next.min} XP`;

  if(xpFill) xpFill.style.width = info.pct + "%";
  if(xpBar){
    xpBar.setAttribute("aria-valuemin", String(info.current.min));
    xpBar.setAttribute("aria-valuenow", String(info.xp));
    xpBar.setAttribute("aria-valuemax", String(info.isMax ? XP_MAX : info.next.min));
    xpBar.setAttribute("aria-valuetext",
      `${tr ? "Seviye" : "Level"} ${info.current.level}, ${info.xp} XP`);
  }

  const ctx = { streakCount, bestStreak };
  const earnable = BADGES.filter(b => b.id !== "zippy");
  const earned = earnable.filter(b => {
    try { return !!b.check(done, ctx); } catch(_) { return false; }
  }).length;
  if(badgeCount) badgeCount.textContent = `${earned} / ${earnable.length}`;
}

function updateProgress(options = {}){
  const deferStats = !!options.deferStats;
  const total = missions.length;
  const completed = done.size;
  progressText.textContent = `${completed} of ${total} missions complete`;
  const pct = Math.round((completed/total)*100);
  progressFill.style.width = pct + "%";
  document.querySelector(".bar").setAttribute("aria-valuenow", String(completed));
  renderXpUI();

  if(completed>=total){
    progressSub.textContent = "All missions completed! Certificate unlocked.";
  } else if(completed === 0){
    progressSub.textContent = "Pick a mission, read the steps, and go play.";
  } else if(completed <= 3){
    progressSub.textContent = `Great start! Keep going — ${total - completed} missions to go.`;
  } else {
    const remaining = total - completed;
    progressSub.textContent = `${remaining} mission${remaining===1?"":"s"} left to unlock your certificate.`;
  }

  renderStreakUI();
  renderDailyUI();
  if(!deferStats) updateBadges();
  if(document.body.classList.contains("tab-stats")) renderParentDashboard();

  // 0 progress'te boş kartları gizle (yeni kullanıcı için temiz arayüz)
  const isFresh = done.size === 0;
  const dash = document.getElementById("parentDashboard");
  if(dash) dash.style.display = isFresh ? "none" : "";
  // Sertifika sadece ≥3 görev tamamlanınca göster (motivasyon için)
  const cert = document.getElementById("certBox");
  if(cert) cert.style.display = done.size >= 3 ? "" : "none";
  // Where to Play sadece progress varsa (artık kart gizli zaten - geriye uyum)
  const seasonal = document.getElementById("seasonalCard");
  if(seasonal && seasonal.dataset.deprecated !== "1"){ seasonal.style.display = isFresh ? "none" : ""; }
  // Badges section bütünüyle (heading dahil)
  const badgesSection = document.querySelector(".statsBadgesSection");
  if(badgesSection) badgesSection.style.display = isFresh ? "none" : "";
  // Stats tab empty state — yeni kullanıcı için davet
  const emptyState = document.getElementById("statsEmptyState");
  if(emptyState) emptyState.style.display = isFresh ? "" : "none";
  // The 3D island is a bonus after physical play, never a gate before it.
  const islandCard = document.getElementById("advModeCard");
  if(islandCard && lsGet(HUB3D_UNSUPPORTED_KEY, "0") !== "1"){
    islandCard.style.display = isFresh ? "none" : "";
  }
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
  badgeEl.textContent = topBadge ? topBadge.name : "";
}

/** =======================
 * Modal
 * ======================= */
let timerInterval = null;

/* "Go play" screen wake lock — while a mission timer runs, the phone is on
 * the floor coaching the kid; letting the screen sleep mid-mission kills the
 * timer/caller. Acquired on timer start, released on end/reset/close. No-op
 * on browsers without the API. */
let _wakeLock = null;
async function requestWakeLock(){
  try{
    if("wakeLock" in navigator){ _wakeLock = await navigator.wakeLock.request("screen"); }
  }catch(_){ }
}
function releaseWakeLock(){
  try{ if(_wakeLock){ _wakeLock.release(); _wakeLock = null; } }catch(_){ }
}
let timerState = "idle";   // "idle" | "running" | "paused"
let timerTotal = 0;
let timerLeft = 0;
let timerEndAt = 0;
let timerHoldResetArmed = false;
let timerHoldResetT = null;
let missionOpenedAt = 0;
let timerCountdownInterval = null;
let timerCountdownTimeout = null;
let timerCountdownToken = 0;

function cancelTimerCountdown(){
  timerCountdownToken++;
  if(timerCountdownInterval) clearInterval(timerCountdownInterval);
  if(timerCountdownTimeout) clearTimeout(timerCountdownTimeout);
  timerCountdownInterval = null;
  timerCountdownTimeout = null;
  const countdown = document.getElementById("timerCountdown");
  countdown?.classList.remove("show");
  countdown?.setAttribute("aria-hidden", "true");
}
const timerCountdownOverlay = document.getElementById("timerCountdown");
if(timerCountdownOverlay){
  const cancelFromOverlay = ()=>{
    cancelTimerCountdown();
    if(timerState === "idle") setTimerButtonLabel();
    btnStartTimer.focus({preventScroll:true});
  };
  timerCountdownOverlay.addEventListener("click", cancelFromOverlay);
  timerCountdownOverlay.addEventListener("keydown", event=>{
    if(event.key === "Enter" || event.key === " "){
      event.preventDefault();
      cancelFromOverlay();
    }
  });
}

function setTimerButtonLabel(){
  btnStartTimer.disabled = false;
  if(timerState === "running"){
    btnStartTimer.innerHTML = '<i class="jic jic-pause" aria-hidden="true"></i> Pause';
    btnStartTimer.setAttribute("aria-label", "Pause timer");
  }else if(timerState === "paused"){
    btnStartTimer.innerHTML = '<i class="jic jic-play" aria-hidden="true"></i> Resume';
    btnStartTimer.setAttribute("aria-label", "Resume timer");
  }else{
    btnStartTimer.innerHTML = '<i class="jic jic-play" aria-hidden="true"></i> Start';
    btnStartTimer.setAttribute("aria-label", "Start timer");
  }
}

function resetTimerUI() {
  cancelTimerCountdown();
  if(timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  releaseWakeLock();
  timerState = "idle";
  timerTotal = 0;
  timerLeft = 0;
  timerEndAt = 0;
  _missionCoachFired = new Set();

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
    timerDisplay.classList.remove("timerUrgent");
    if(timerFill) timerFill.classList.remove("timerUrgent");
    setTimerButtonLabel();
    releaseWakeLock();
    // Hub flow: soft "come back" whistle from the hub's toy-like sound
    // palette (the hub registers this hook only while the 3D flag is on).
    try{ if(window._hubMissionFlow && window._hub3dComeBack) window._hub3dComeBack(); }catch(_){ }
    // Coach: time's up announcement
    if(_openMissionId !== 13){
      if(_currentScore > 0){
        coachSpeak(`Time's up! You got ${_currentScore}!`);
      } else {
        coachSpeak("Time's up! Great job!");
      }
    }
    if(autoDoneOnEnd && lastOpenedId != null && !done.has(lastOpenedId)){
      markMissionDone(lastOpenedId, "auto");
    }else if(lastOpenedId != null && !done.has(lastOpenedId)){
      incAttempt(lastOpenedId);
    }
    return;
  }

  // Voice Coach repeats only a real rule from the open mission. No generic
  // praise, no invented copy, and never during the phone-driven/silent games.
  if(_missionCoachEnabled && !document.hidden && timerTotal > 0 && _openMissionId){
    const ms = missions.find(x=>x.id === _openMissionId);
    const elapsedFraction = (timerTotal - secLeft) / timerTotal;
    _missionCoachReminders.forEach((reminder, index)=>{
      if(_missionCoachFired.has(index) || elapsedFraction < Number(reminder.fraction || 1)) return;
      _missionCoachFired.add(index); // mark before speaking so pause/resume cannot repeat it
      const line = resolveMissionCoachReminder(ms, reminder);
      if(line) coachSpeak(line, { rate: 0.96, pitch: 1.02 });
    });
  }

  // Son 3 saniye: kırmızı pulse + ses
  if(secLeft <= 3 && secLeft > 0){
    if(!timerDisplay.classList.contains("timerUrgent")){
      timerDisplay.classList.add("timerUrgent");
      if(timerFill) timerFill.classList.add("timerUrgent");
    }
    // Saniye değiştiğinde tik sesi
    const lastDisplay = timerDisplay.textContent;
    const newText = secLeft + "s";
    if(lastDisplay !== newText){
      if(_openMissionId !== 13) clickSound("click");
    }
  } else {
    if(timerDisplay.classList.contains("timerUrgent")){
      timerDisplay.classList.remove("timerUrgent");
      if(timerFill) timerFill.classList.remove("timerUrgent");
    }
  }

  timerDisplay.textContent = secLeft + "s";
}

/* =======================
 * Voice Coaching helpers
 * ======================= */
function coachSpeak(text, opts={}){
  if(!soundOn) return;
  if(!("speechSynthesis" in window)) return;
  try{
    window.speechSynthesis.cancel();
    window.JumviMusic?.unduck(); // cancel() above may orphan a previous utterance's onend
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = opts.rate || 0.96;
    u.pitch = opts.pitch || 1.02;
    u.volume = 1;
    if(typeof kidVoice !== "undefined" && kidVoice) u.voice = kidVoice;
    u.onstart = ()=> window.JumviMusic?.duck();
    u.onend = ()=> window.JumviMusic?.unduck();
    u.onerror = ()=> window.JumviMusic?.unduck();
    window.speechSynthesis.speak(u);
  }catch(_){}
}

// §3.1 — auto read-aloud for the 3–5 band (they can't read the steps). Device
// setting jumvi_tts_auto (default on); parents can turn it off in Profile.
const TTS_AUTO_KEY = "jumvi_tts_auto";
const MISSION_COACH_RUN_KEY = _PP + "mission_coach_runs_v1";
let _missionCoachEnabled = false;
let _missionCoachReminders = [];
let _missionCoachFired = new Set();
let _missionNarrationPending = false;
let _missionNarratedId = 0;
let _missionNarrationToken = 0;
let _missionNarrationWatchdog = null;

function missionCoachingFor(ms){
  return (window.JUMVI_MISSION_COACHING && ms) ? window.JUMVI_MISSION_COACHING[ms.id] || null : null;
}
function missionCoachRuns(){
  const raw = lsGetJSON(MISSION_COACH_RUN_KEY, {});
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}
function markMissionCoachRun(ms){
  if(!ms) return;
  const runs = missionCoachRuns();
  runs[ms.id] = Math.min(99, Number(runs[ms.id] || 0) + 1);
  try{ lsSet(MISSION_COACH_RUN_KEY, JSON.stringify(runs)); }catch(_){ }
}
function stripSpeechText(value){
  return String(value || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\uFE0F]/gu, "")
    .replace(/\s+/g, " ").trim();
}
function missionCoachParts(ms, fullRead=false){
  const meta = missionCoachingFor(ms);
  const runs = missionCoachRuns();
  const firstRun = Number(runs[ms.id] || 0) === 0;
  let indexes = (ms.steps || []).map((_, i)=>i);
  if(!fullRead && !firstRun && meta && meta.replay !== "full"){
    indexes = Array.isArray(meta.quickStepIndexes) && meta.quickStepIndexes.length
      ? meta.quickStepIndexes
      : indexes.slice(0, meta.replay === "quick" ? 1 : 2);
  }
  const parts = [`Mission: ${stripSpeechText(ms.title)}.`];
  indexes.forEach(i=>{
    if(ms.steps && ms.steps[i]) parts.push(`Step ${i+1} — ${stripSpeechText(ms.steps[i])}`);
  });
  if(ms.win) parts.push(`How to win — ${stripSpeechText(ms.win)}`);
  return parts;
}
function stopMissionCoach(){
  if(_missionNarrationWatchdog) clearTimeout(_missionNarrationWatchdog);
  _missionNarrationWatchdog = null;
  _missionCoachEnabled = false;
  _missionCoachReminders = [];
  _missionCoachFired = new Set();
  _missionNarrationPending = false;
  _missionNarratedId = 0;
  _missionNarrationToken++;
  if(window.CoachLeoAudio) window.CoachLeoAudio.stop();
}
function prepareMissionCoach(ms){
  if(_missionNarrationWatchdog) clearTimeout(_missionNarrationWatchdog);
  _missionNarrationWatchdog = null;
  _missionNarrationToken++;
  if("speechSynthesis" in window) window.speechSynthesis.cancel();
  if(window.CoachLeoAudio) window.CoachLeoAudio.stop();
  const meta = missionCoachingFor(ms);
  _missionCoachEnabled = !!(soundOn && ttsAuto() && meta && ms.id !== 2 && ms.id !== 13);
  _missionCoachReminders = meta && Array.isArray(meta.reminders) ? meta.reminders : [];
  _missionCoachFired = new Set();
  _missionNarrationPending = false;
  _missionNarratedId = 0;
  // Warm the on-demand cache for this mission's prerecorded clip (English
  // only; no-op on /tr and for mission 13, which has no file).
  if(window.CoachLeoAudio) window.CoachLeoAudio.preload(ms.id);
}
function resolveMissionCoachReminder(ms, reminder){
  if(!ms || !reminder) return "";
  if(reminder.source === "safety") return stripSpeechText(ms.safety || getSafetyText(ms));
  if(reminder.source === "step" && ms.steps && ms.steps[reminder.index]) return stripSpeechText(ms.steps[reminder.index]);
  return "";
}
function playMissionNarration(ms, onDone){
  if(!ms || !soundOn || !ttsAuto() || !("speechSynthesis" in window)){
    onDone();
    return false;
  }
  const parts = missionCoachParts(ms, false);
  const text = parts.join(" ");
  if(!text){ onDone(); return false; }
  _missionNarrationPending = true;
  _missionNarratedId = ms.id;
  const token = ++_missionNarrationToken;
  let finished = false;
  const doneOnce = (heardNaturally=false)=>{
    if(finished || token !== _missionNarrationToken) return;
    finished = true;
    _missionNarrationPending = false;
    _missionNarratedId = ms.id;
    if(heardNaturally) markMissionCoachRun(ms);
    btnStartTimer.disabled = true;
    btnStartTimer.innerHTML = '<i class="jic jic-play" aria-hidden="true"></i> Get ready…';
    onDone();
  };
  const speakWithTts = ()=>{
    if(_missionNarrationWatchdog) clearTimeout(_missionNarrationWatchdog);
    _missionNarrationWatchdog = setTimeout(doneOnce, Math.min(26000, Math.max(10000, text.length * 75)));
    try{
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      utter.rate = 0.96;
      utter.pitch = 1.02;
      utter.volume = 1;
      if(kidVoice) utter.voice = kidVoice;
      utter.onend = ()=>{ clearTimeout(_missionNarrationWatchdog); _missionNarrationWatchdog = null; doneOnce(true); };
      utter.onerror = ()=>{ clearTimeout(_missionNarrationWatchdog); _missionNarrationWatchdog = null; doneOnce(false); };
      window.speechSynthesis.speak(utter);
    }catch(_){ clearTimeout(_missionNarrationWatchdog); _missionNarrationWatchdog = null; doneOnce(false); }
  };
  // Prerecorded Coach Leo only substitutes the FULL narration (first run, or
  // a mission whose coaching metadata always replays "full") — a quick/recap
  // replay intentionally stays on the shorter TTS path. English-only; /tr
  // never sees hasMission() true (CoachLeoAudio is locale-gated), so the
  // Turkish speechSynthesis path below is completely unaffected.
  const meta = missionCoachingFor(ms);
  const runs = missionCoachRuns();
  const firstRun = Number(runs[ms.id] || 0) === 0;
  const isFullNarration = firstRun || !meta || meta.replay === "full";
  const useMp3 = isFullNarration && window.CoachLeoAudio && window.CoachLeoAudio.hasMission(ms.id);
  if(useMp3){
    _missionNarrationWatchdog = setTimeout(doneOnce, 26000);
    const started = window.CoachLeoAudio.playMission(ms.id, {
      onEnd: ()=>{ clearTimeout(_missionNarrationWatchdog); _missionNarrationWatchdog = null; doneOnce(true); },
      onError: ()=> speakWithTts()
    });
    if(!started) speakWithTts();
  } else {
    speakWithTts();
  }
  return true;
}

function markMissionNarrationHeard(ms){
  if(!ms) return;
  _missionNarratedId = ms.id;
  markMissionCoachRun(ms);
}
function ttsAuto(){ try{ return lsGet(TTS_AUTO_KEY, "1") === "1"; }catch(_){ return true; } }
function autoReadMission(ms){
  // Reads the mission name + first step, once, when a 3–5 mission opens. Must be
  // called INSIDE the tap handler (openMission) so iOS allows speechSynthesis.
  if(!soundOn) return;                       // shares the global mute guard
  if(!("speechSynthesis" in window)) return;
  const first = (ms.steps && ms.steps[0]) ? stripSpeechText(ms.steps[0]) : "";
  const text = first ? `${stripSpeechText(ms.title)}. Step 1 — ${first}` : stripSpeechText(ms.title);
  if(text) coachSpeak(text, { rate: 1.0 });
}

// ---- Spoken steps (Task 4c): tap Leo by the STEPS header → he reads the
// steps in order, then the win condition. Second tap stops. No autoplay;
// same mute guard as every other sound (soundOn). ----
const LEO_SPEAK_HINT_KEY = "jumvi_leo_speak_hint_v1";
let _leoStepsSpeaking = false;
function stopLeoSpeakSteps(){
  _leoStepsSpeaking = false;
  const btn = document.getElementById("leoSpeakBtn");
  if(btn) btn.classList.remove("speaking");
  if("speechSynthesis" in window) window.speechSynthesis.cancel();
  if(window.CoachLeoAudio) window.CoachLeoAudio.stop();
}
function speakLeoStepsWithTts(ms){
  try{
    window.speechSynthesis.cancel();
    const parts = missionCoachParts(ms, true).slice(1);
    parts.forEach((text, i)=>{
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US"; u.rate = 0.96; u.pitch = 1.02; u.volume = 1;
      if(typeof kidVoice !== "undefined" && kidVoice) u.voice = kidVoice;
      if(i === parts.length - 1) u.onend = ()=>{ markMissionNarrationHeard(ms); stopLeoSpeakSteps(); };
      window.speechSynthesis.speak(u); // queued → natural pause between parts
    });
  }catch(_){ stopLeoSpeakSteps(); }
}
function toggleLeoSpeakSteps(ms){
  if(_leoStepsSpeaking){ stopLeoSpeakSteps(); return; }
  if(!soundOn){ showToast("Sound is off — turn it on in Settings."); return; }
  if(!("speechSynthesis" in window)) { showToast("This device can't read aloud."); return; }
  _leoStepsSpeaking = true;
  const btn = document.getElementById("leoSpeakBtn");
  if(btn) btn.classList.add("speaking");
  trackEvent("Leo Steps Spoken", { missionId: ms.id });
  // Manual "Hear the steps" is always the full read — prefer the prerecorded
  // clip (English only; mission 13 has none, so it silently keeps whatever
  // the existing TTS path already does for it) with TTS as the fallback.
  if(window.CoachLeoAudio && window.CoachLeoAudio.hasMission(ms.id)){
    const started = window.CoachLeoAudio.playMission(ms.id, {
      onEnd: ()=>{ markMissionNarrationHeard(ms); stopLeoSpeakSteps(); },
      onError: ()=> speakLeoStepsWithTts(ms)
    });
    if(!started) speakLeoStepsWithTts(ms);
  } else {
    speakLeoStepsWithTts(ms);
  }
}
// One-time tooltip so parents discover the feature (first mission open only).
function maybeShowLeoSpeakHint(btn){
  if(!btn) return;
  if(lsGet(LEO_SPEAK_HINT_KEY, "0") === "1") return;
  lsSet(LEO_SPEAK_HINT_KEY, "1");
  const tip = document.createElement("div");
  tip.className = "leoSpeakTip";
  tip.textContent = "Tap Leo to hear the steps!";
  btn.parentElement.appendChild(tip);
  setTimeout(()=>{ tip.classList.add("fade"); setTimeout(()=> tip.remove(), 400); }, 4200);
}

let _midplayAnnounced = false; // retained for state compatibility; no generic praise is spoken

/* One spoken step of the 3-2-1-GO start sequence.
 *
 * This used to be a bare coachSpeak() call, i.e. speechSynthesis with the
 * device's built-in en-US voice, unconditionally. Every other English Coach
 * Leo line moved to the prerecorded set months ago, so the real-device
 * experience was: Leo reads the mission in his recorded voice, then a
 * completely different robotic voice counts the kid in. That mismatch is the
 * "old voice on the countdown" report — nothing was failing over, the
 * countdown simply never asked CoachLeoAudio in the first place.
 *
 * Routing, deliberately asymmetric:
 *   • English  → CoachLeoAudio only. If a prerecorded countdown clip is not
 *     mapped (it isn't yet), the sequence stays SILENT and keeps the visual
 *     count + the tick below. Falling back to speechSynthesis here would
 *     re-introduce exactly the voice this change removes, so it is not a
 *     fallback — it is the bug.
 *   • Turkish  → unchanged. CoachLeoAudio.isAvailable() is false on /tr, and
 *     tr/i18n.js re-speaks every utterance in tr-TR, so speechSynthesis is
 *     the intended path there and stays wired up.
 * The global speechSynthesis system is untouched everywhere else. */
function speakCountdownStep(value){
  // Same mute guard every other voice path uses — coachSpeak() checked soundOn
  // itself, so the check has to move up here now that it is not always the one
  // doing the talking.
  if(!soundOn) return;
  const leo = window.CoachLeoAudio;
  if(leo && leo.isAvailable()){
    const key = value === "GO!" ? "go" : String(value);
    if(leo.hasCountdown(key)) leo.playCountdown(key);
    return;
  }
  coachSpeak(value === "GO!" ? "Go!" : String(value), { rate: 1.1, pitch: 1.3 });
}

/* Visual countdown 3-2-1-GO before timer starts */
function showCountdownThenStart(durationSeconds){
  cancelTimerCountdown();
  const countdownToken = timerCountdownToken;
  const countdownMissionId = _openMissionId;
  const overlay = document.getElementById("timerCountdown");
  if(!overlay){
    // Yedek: overlay yoksa direkt başlat
    if(countdownMissionId === _openMissionId) startTimer(durationSeconds);
    return;
  }
  btnStartTimer.disabled = true;
  btnStartTimer.innerHTML = '<i class="jic jic-play" aria-hidden="true"></i> Get ready…';
  btnStartTimer.setAttribute("aria-label", "Countdown in progress");
  let n = 3;
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
  overlay.focus({preventScroll:true});
  const display = overlay.querySelector(".timerCountdownNum");
  const announce = (val)=>{
    if(display) display.textContent = val;
    if(display){
      display.classList.remove("pop");
      void display.offsetWidth;
      display.classList.add("pop");
    }
    if(countdownMissionId !== 13){
      speakCountdownStep(val);
      clickSound("click");
    }
  };
  announce(n);
  timerCountdownInterval = setInterval(()=>{
    if(countdownToken !== timerCountdownToken || countdownMissionId !== _openMissionId){
      cancelTimerCountdown();
      return;
    }
    n--;
    if(n > 0){
      announce(String(n));
    } else {
      announce("GO!");
      clearInterval(timerCountdownInterval);
      timerCountdownInterval = null;
      timerCountdownTimeout = setTimeout(()=>{
        timerCountdownTimeout = null;
        if(countdownToken !== timerCountdownToken || countdownMissionId !== _openMissionId || !backdrop.classList.contains("show")) return;
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        startTimer(durationSeconds);
      }, 600);
    }
  }, 800);
}

function startTimer(durationSeconds) {
  if(!_openMissionId || !backdrop.classList.contains("show") || document.hidden) return;
  if(timerInterval) clearInterval(timerInterval);

  timerUI.style.display = "block";

  // Once per mission per session: restarting the timer on the same mission is
  // the same kid on the same task, not a second use of the feature.
  if(_openMissionId){
    beaconOnce("timer_start_" + _openMissionId, "timer_start", { id: _openMissionId });
  }

  timerTotal = durationSeconds;
  timerLeft = durationSeconds;
  timerState = "running";
  btnStartTimer.disabled = false;
  _midplayAnnounced = false;
  _missionCoachFired = new Set();
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

  if(_openMissionId !== 13) clickSound("click");
  requestWakeLock(); // keep the screen on while the kid plays (released on end/reset/close)

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
  releaseWakeLock();
  if("speechSynthesis" in window) window.speechSynthesis.cancel();
  setTimerButtonLabel();

  // Freeze bar where it is now
  const pct = timerTotal > 0 ? (msLeft / (timerTotal * 1000)) * 100 : 0;
  timerFill.style.transition = "none";
  timerFill.style.width = Math.max(0, Math.min(100, pct)) + "%";

  timerDisplay.textContent = timerLeft + "s";
  if(_openMissionId !== 13) clickSound("click");
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

  if(_openMissionId !== 13) clickSound("click");
  requestWakeLock();

  timerInterval = setInterval(updateTimerTick, 200);
}

function toggleTimer(durationSeconds){
  if(timerState === "idle"){
    // İlk başlatmada countdown göster — sesli koçluk için
    showCountdownThenStart(durationSeconds);
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
    showToast("Timer reset.");
  }, 650);
}
function disarmHoldToReset(){
  if(timerHoldResetT) clearTimeout(timerHoldResetT);
  timerHoldResetT = null;
  setTimeout(()=>{ timerHoldResetArmed = false; }, 80);
}

/* Tints the full-page mission view to the badge/zone the kid walked into,
 * when it was opened from the 3D hub (window._hubMissionFlow.themeColor, a
 * "#rrggbb" string handed over by the hub). A colored top accent bar + a
 * matching title colour + soft glow — just enough to say "this belongs to
 * the Energy Zone / Target Range / …". Normal Missions-tab opens pass no
 * theme, so everything is reset to the default look. */
function applyHubMissionTheme(){
  const sheetEl = document.getElementById("sheet");
  const titleEl = document.getElementById("mTitle");
  if(!sheetEl) return;
  const color = (window._hubMissionFlow && window._hubMissionFlow.themeColor) || null;
  // The sheet's border-top and the title colour both carry `!important` in
  // style.css, so plain inline styles get overridden — set them with the
  // 'important' priority (and remove the same way) so the theme actually wins.
  if(color){
    sheetEl.style.setProperty("border-top", "5px solid " + color, "important");
    sheetEl.style.setProperty("box-shadow", "0 -2px 26px " + color + "66", "important");
    if(titleEl) titleEl.style.setProperty("color", color, "important");
  } else {
    sheetEl.style.removeProperty("border-top");
    sheetEl.style.removeProperty("box-shadow");
    if(titleEl) titleEl.style.removeProperty("color");
  }
}

let _firstMissionStartTracked = false;

/* The mission the sheet is currently showing. startTimer() is reached through
 * a countdown callback that carries only a duration, so without this the
 * timer_start beacon would have no idea which mission it belongs to. */
let _openMissionId = 0;
function openMission(id){
  const ms = missions.find(x=>x.id===id);
  if(!ms) return;
  const missionWasOpen = backdrop.classList.contains("show");
  if(!missionWasOpen){
    _missionReturnFocus = document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : btnDailyPlay;
  }
  // Opening a new mission invalidates narration/countdown callbacks owned by
  // the previous sheet before the new mission id becomes current.
  stopMissionCoach();
  stopLeoSpeakSteps();
  cancelTimerCountdown();
  _openMissionId = id;
  // first_mission_start — once per session, the moment any mission view opens,
  // tagged with where it came from (hub vs 2D). Parity with the audit's A/B
  // funnel (2D had it implicitly, 3D had nothing).
  if(!_firstMissionStartTracked){
    _firstMissionStartTracked = true;
    trackEvent("first_mission_start", { source: window._hubMissionFlow ? "hub" : "2d" });
  }
  // Beacon 2/5 — de-duped per mission per session. Opening the sheet is the
  // only reliable "started" signal: the timer is optional and plenty of kids
  // just read the steps and go play. Re-opening the same mission to re-read
  // it must not count as a second start, or the completion ratio is noise.
  beaconOnce("mission_start_" + id, "mission_start", { id: id });

  // A returning player already told us their party size last session; count it
  // once here rather than making them re-tap, so player_count stays readable
  // against app_opens. Still session-de-duped.
  try{
    const savedN = Number(lsGet(PLAYER_COUNT_KEY, ""));
    if(savedN >= 2 && savedN <= 4) beaconOnce("player_count", "player_count", { n: savedN });
  }catch(_){}

  // Collapse the help panel between missions — a tip about the previous
  // mission being too hard should not greet the next one.
  const helpPanel = document.getElementById("missionHelpPanel");
  const helpTip   = document.getElementById("missionHelpTip");
  const helpBtn   = document.getElementById("btnMissionHelp");
  if(helpPanel) helpPanel.hidden = true;
  if(helpTip){ helpTip.hidden = true; helpTip.textContent = ""; }
  if(helpBtn) helpBtn.setAttribute("aria-expanded", "false");
  document.querySelectorAll(".missionHelpOpt.active").forEach(o=> o.classList.remove("active"));
  // If the Red Light / Green Light caller is running (mission 2) and the user
  // taps Next/Random/another mission, tear it down so the new mission isn't
  // hidden behind the green/red overlay.
  try{ if(window.JumviRedLight) window.JumviRedLight.stop(); }catch(_){ }
  lastOpenedId = setState("lastOpenedId", id);
  missionOpenedAt = Date.now();
  // "Continue where you left off" için kaydet
  try { lsSet(LAST_OPENED_KEY, String(id)); } catch(_){}

  // Stamp pack slug on #sheet so dark-mode chip CSS can target it
  const sheetEl = document.getElementById("sheet");
  if(sheetEl){
    sheetEl.className = sheetEl.className.replace(/\bpack--[\w-]+\b/g,"").trim();
    const slug = "pack--" + (ms.pack||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    sheetEl.classList.add(slug);
  }

  resetTimerUI(); // Ensure timer is reset when opening
  prepareMissionCoach(ms);

  // Story banner — pack temasından hayal katmanı
  // Görev kurallarını DEĞIŞTIRMEZ; sadece sahneyi kurar
  const storyBanner = document.getElementById("storyBanner");
  const theme = (typeof PACK_THEMES !== "undefined") ? PACK_THEMES[ms.pack] : null;
  if(storyBanner && theme){
    const inner = storyBanner.querySelector(".storyBannerInner");
    if(inner) inner.style.setProperty("--story-color", theme.color || "#4FB3FF");
    const eEl = document.getElementById("storyEmoji");
    const tEl = document.getElementById("storyTitle");
    const lEl = document.getElementById("storyTagline");
    if(eEl) eEl.innerHTML = JUMVI_ART.img(JUMVI_ART.pack(ms.pack), "packArt", "", true);
    if(tEl) tEl.textContent = theme.name;
    if(lEl) lEl.textContent = theme.tagline;
    storyBanner.style.display = "";
  } else if(storyBanner){
    storyBanner.style.display = "none";
  }

  // Mission detail uses the instructional motion diagram. Soft-Play mission
  // art remains on discovery surfaces (cards, Daily Mission, path and lists).
  const iconWrap = document.getElementById("missionIconWrap");
  if(iconWrap){
    const markup = (window.MISSION_ICONS && window.MISSION_ICONS[ms.id]) || "";
    iconWrap.innerHTML = markup;
    iconWrap.style.display = markup ? "" : "none";
  }

  mTitle.textContent = ms.title;
  mMeta.innerHTML = `
    <span class="tag diff">${diffLabel(ms.difficulty)} • ${escapeHtml(ms.time)}</span>
    <span class="tag"><i class="jic jic-users" aria-hidden="true"></i> ${escapeHtml(ms.players)}</span>
    <span class="tag">Ages ${escapeHtml(ms.age)}</span>
    <span class="tag xpTag">+${missionXp(ms)} XP</span>
  `;

  const steps = Array.isArray(ms.steps) && ms.steps.length ? ms.steps : ["Steps are coming soon. Please try another mission."];
  // Guide Leo beside the STEPS header (Task 4b/c): decorative pointing pose,
  // but the 44px button wrapping him is tappable → speaks the steps aloud.
  mSteps.innerHTML = `<div class="stepsHeadRow"><b>Steps</b>
    <button type="button" class="leoSpeakBtn" id="leoSpeakBtn" aria-label="Hear the steps read aloud">
      <picture>
        <source srcset="assets/leo/leo-guide-256.webp?v=20260717-1" type="image/webp">
        <img src="assets/leo/leo-guide-256.png?v=20260717-1" alt="" width="256" height="256" decoding="async">
      </picture>
    </button>
  </div><ol class="missionStepsList">
    ${steps.map(s=>`<li>${escapeHtml(s)}</li>`).join("")}
  </ol>`;
  const leoSpeakBtn = document.getElementById("leoSpeakBtn");
  if(leoSpeakBtn) leoSpeakBtn.onclick = ()=> toggleLeoSpeakSteps(ms);
  maybeShowLeoSpeakHint(leoSpeakBtn);

  // Narration begins from the explicit Start or Leo button, so the child does
  // not hear the first rule twice and the timer never runs under speech.

  const winText = ms.win ? String(ms.win) : "Win condition is coming soon.";
  mWin.innerHTML = `<b><i class="jic jic-award" aria-hidden="true"></i> Win</b><br/><div style="margin-top:8px">${escapeHtml(winText)}</div>`;
  mTip.innerHTML = `<b><i class="jic jic-users" aria-hidden="true"></i> Parent Tip</b><br/><div style="margin-top:8px">${escapeHtml(ms.tip)}</div>`;
  if(mKidsTip){
    mKidsTip.innerHTML = `<b><i class="jic jic-star" aria-hidden="true"></i> Kids Challenge</b><br/><div style="margin-top:8px">${escapeHtml(getKidsTip(ms))}</div>`;
  }
  mSafety.innerHTML = `<b><i class="jic jic-shield" aria-hidden="true"></i> Safety</b><br/><div style="margin-top:8px">${escapeHtml(getSafetyText(ms))}</div>`;
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
  btnToggleDone.innerHTML = isDone ? '<i class="jic jic-arrow-back-up" aria-hidden="true"></i> Mark as Not Done' : '<i class="jic jic-circle-check" aria-hidden="true"></i> We Finished!';
  btnToggleDone.setAttribute("aria-label", isDone ? "Mark mission as not done" : "We finished this mission");
  btnToggleDone.classList.toggle("btnDone", isDone);
  // After completing: promote "Next" as the clear CTA
  btnNext.innerHTML = isDone ? '<i class="jic jic-arrow-right" aria-hidden="true"></i> Next Mission!' : '<i class="jic jic-arrow-right" aria-hidden="true"></i> Next';
  btnNext.classList.toggle("btnNextHighlight", isDone);
  if(btnRandomPack) btnRandomPack.innerHTML = `<i class="jic jic-dice" aria-hidden="true"></i> Random from ${escapeHtml(getPackName(ms.pack))}`;

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

  // Mission 2 (Red Light, Green Light) — phone acts as the caller via the
  // JumviRedLight overlay module. Hijack the Start button for this mission
  // only: random GREEN/RED switches + speech + countdown replace the plain
  // timer (which doesn't fit RL/GL gameplay).
  const isRedLightMission = (ms.id === 2 && typeof window.JumviRedLight !== "undefined");
  const callerHintEl = document.getElementById("callerHint");
  if(isRedLightMission){
    btnStartTimer.innerHTML = '<i class="jic jic-play" aria-hidden="true"></i> Start Caller';
    btnStartTimer.setAttribute("aria-label", "Start Red Light Green Light caller");
    btnStartTimer.classList.add("btnStartCaller");
    if(callerHintEl){
      callerHintEl.style.display = "";
      callerHintEl.setAttribute("aria-hidden", "false");
    }
    btnStartTimer.onclick = () => {
      if(timerHoldResetArmed) return;
      try{ clickSound("click"); }catch(_){}
      trackEvent("RedLight Caller Started", { mission: ms.id, duration: seconds });
      window.JumviRedLight.start({
        duration: seconds,
        speed: "normal",
        sound: !!soundOn,
        onEnd: ()=>{ trackEvent("RedLight Caller Ended", { mission: ms.id }); }
      });
    };
  } else {
    btnStartTimer.innerHTML = '<i class="jic jic-play" aria-hidden="true"></i> Start';
    btnStartTimer.setAttribute("aria-label", "Start timer");
    btnStartTimer.classList.remove("btnStartCaller");
    if(callerHintEl){
      callerHintEl.style.display = "none";
      callerHintEl.setAttribute("aria-hidden", "true");
    }
    btnStartTimer.onclick = () => {
      if(timerHoldResetArmed) return; // ignore click right after a hold-reset
      // iOS Safari only allows playback that a gesture started. The countdown's
      // "2", "1" and "GO!" fire from setInterval, well outside this tap, so
      // claim permission now — same trick jumvi-redlight.js uses for its caller
      // cues. Gated on a clip actually being mapped so nothing is fetched for a
      // countdown that is currently silent (and it is a no-op on /tr anyway).
      if(timerState === "idle" && soundOn && window.CoachLeoAudio && window.CoachLeoAudio.hasCountdown("go")){
        try{
          window.CoachLeoAudio.unlock();
          window.CoachLeoAudio.preloadCountdown();
        }catch(_){ }
      }
      if(timerState === "idle" && _missionNarrationPending){
        if(_missionNarrationWatchdog) clearTimeout(_missionNarrationWatchdog);
        _missionNarrationWatchdog = null;
        _missionNarrationPending = false;
        _missionNarrationToken++;
        if("speechSynthesis" in window) window.speechSynthesis.cancel();
        if(window.CoachLeoAudio) window.CoachLeoAudio.stop();
        btnStartTimer.disabled = true;
        btnStartTimer.innerHTML = '<i class="jic jic-play" aria-hidden="true"></i> Get ready…';
        showCountdownThenStart(seconds);
        return;
      }
      if(timerState === "idle" && _missionCoachEnabled && _missionNarratedId !== ms.id){
        const narrationStarted = playMissionNarration(ms, ()=>showCountdownThenStart(seconds));
        if(narrationStarted){
          btnStartTimer.innerHTML = '<i class="jic jic-play" aria-hidden="true"></i> Skip & Play';
          btnStartTimer.setAttribute("aria-label", "Skip narration and start timer");
        }
        return;
      }
      toggleTimer(seconds); // tap: start / pause / resume
    };
  }

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
  btnSpeak.innerHTML = isSpeaking ? '<i class="jic jic-pause" aria-hidden="true"></i>' : '<i class="jic jic-speakerphone" aria-hidden="true"></i>';
  btnSpeak.setAttribute("title", isSpeaking ? "Stop reading" : "Read aloud");
  btnSpeak.setAttribute("aria-label", isSpeaking ? "Playing… Tap to stop" : "Read mission aloud");
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

  backdrop.inert = false;
  backdrop.removeAttribute("inert");
  backdrop.setAttribute("aria-hidden", "false");
  setMissionBackgroundIsolation(true);
  backdrop.classList.add("show");
  document.body.classList.add("modalOpen");
  if(window._hubMissionFlow) setHubDialogIsolation(true);
  applyHubMissionTheme();
  sheet.scrollTop = 0;
  const _sb = document.getElementById("sheetBody");
  if(_sb) _sb.scrollTop = 0;
  // Score tracker reset & best değer güncelle
  toggleScoreTracker(false);
  resetScore();
  renderScoreTracker();
  // Lock background scroll while modal is open
  const _aw = document.getElementById("app-wrapper");
  if(_aw) _aw.style.overflowY = "hidden";
  requestAnimationFrame(()=>{ try{ btnClose.focus({ preventScroll:true }); }catch(_){ btnClose.focus(); } });
}

function closeMission(){
  // Hub flow ends when the mission view closes — the hub tab is still the
  // active tab underneath, so the user lands right back on the island.
  const wasHubMission = !!window._hubMissionFlow;
  const hubMissionCompleted = lastOpenedId != null && done.has(lastOpenedId);
  window._hubMissionFlow = null;
  releaseWakeLock();
  if(lastOpenedId != null && !done.has(lastOpenedId)){
    const openFor = Date.now() - (missionOpenedAt || 0);
    if(openFor >= 20000){
      incAttempt(lastOpenedId);
      // Task 5 — mission abandoned midway (real engagement, then left without
      // finishing): a gentle, no-pressure Leo. Deferred so it lands after the
      // modal has closed, not on top of it.
    }
  }
  resetTimerUI(); // Stop + reset timer on close
  stopLeoSpeakSteps(); // clears the speaking state + cancels speech
  stopMissionCoach();
  if('speechSynthesis' in window) window.speechSynthesis.cancel(); // Stop talking on close
  if(window.CoachLeoAudio) window.CoachLeoAudio.stop(); // Stop prerecorded clip on close
  // Score tracker temizle
  toggleScoreTracker(false);
  // Tear down Red Light / Green Light caller overlay if it was running (mission 2)
  try{ if(window.JumviRedLight) window.JumviRedLight.stop(); }catch(_){ }
  backdrop.classList.remove("show");
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.inert = true;
  backdrop.setAttribute("inert", "");
  _openMissionId = 0;
  document.body.classList.remove("modalOpen");
  if(wasHubMission){
    setHubDialogIsolation(false);
    if(_hub3dInstance && typeof _hub3dInstance.onMissionClosed === "function"){
      _hub3dInstance.onMissionClosed(hubMissionCompleted);
    }
  }
  // Restore background scroll
  const _aw = document.getElementById("app-wrapper");
  if(_aw) _aw.style.overflowY = "";
  setMissionBackgroundIsolation(false);
  const returnFocus = _missionReturnFocus;
  _missionReturnFocus = null;
  const focusTarget = returnFocus && returnFocus.isConnected && returnFocus.getClientRects().length
    ? returnFocus
    : btnDailyPlay;
  if(!wasHubMission && focusTarget && focusTarget.isConnected && focusTarget.getClientRects().length){
    requestAnimationFrame(()=>{ try{ focusTarget.focus({ preventScroll:true }); }catch(_){ focusTarget.focus(); } });
  }
  // Continue hint güncelle (last opened değişti)
  renderContinueHint();
  // Browse tab'daysak path'i de yenile — done state guncel olsun
  if(document.body.classList.contains("tab-browse") && typeof renderMissionPath === "function"){
    try { renderMissionPath(); } catch(_){}
  }
}


/** =======================
 * Certificate modal
 * ======================= */
let certPreviewUrl = "";
let certPreviewTimer = null;

async function updateCertificatePreview(){
  if(!certPreviewImg) return;
  // FIX: dim preview while generating — instant loading feedback
  certPreviewImg.style.opacity = "0.35";
  certPreviewImg.style.transition = "opacity 0.25s";
  const blob = await renderSimpleCertificateBlob();
  if(!blob){ certPreviewImg.style.opacity = "1"; return; }
  const url = URL.createObjectURL(blob);
  if(certPreviewUrl){
    try{ URL.revokeObjectURL(certPreviewUrl); }catch(_){}
  }
  certPreviewUrl = url;
  certPreviewImg.onload = ()=>{ certPreviewImg.style.opacity = "1"; };
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
  // certMetaLine removed — date + cert ID are now baked into the cert image itself
  scheduleCertificatePreview();
}

function openCertificate(){
  if(!certBackdrop) return;
  // Hooked here, not in buildCertificate(): that one also runs on every
  // keystroke in the name field and on profile restore. The sheet opening is
  // the moment a certificate actually exists for the child.
  beaconOnce("certificate_made", "certificate_made");
  window.JumviMusic?.cue("playCertificate");
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
  // §6.3 — the certificate PDF (a child's physical reward) must not depend on a
  // reachable CDN. Local copy first; CDNs stay as a fallback only.
  const cdns = [
    "vendor/pdf-lib.min.js",
    "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"
  ];
  for(const src of cdns){
    try{
      await _loadScriptOnce(src);
      if(window.PDFLib) return true;
    }catch(_){ }
  }
  if(!window.PDFLib) window.__jumviFallback("pdf_lib_unavailable", "certificate PDF export disabled");
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
  const isiOS = isIosDevice();
  const filename = `JUMVI-Certificate-${getTodayISO()}.png`;

  // FIX: loading state on BOTH iOS + Android (prevents double-tap, gives feedback)
  const origHTML = btnCertSavePng ? btnCertSavePng.innerHTML : "";
  if(btnCertSavePng){
    btnCertSavePng.disabled = true;
    btnCertSavePng.textContent = "Preparing…";
  }
  if(isiOS){
    try{ showSaveOverlay("", "Preparing certificate… please wait."); }catch(_){}
    try{ showToast("Preparing certificate…"); }catch(_){}
  }

  try{
    const blob = await renderSimpleCertificateBlob();
    if(!blob){
      hideSaveOverlay();
      showFallbackModal();
      return;
    }

    if(isiOS){
      // iOS/iPadOS: prefer Share Sheet with file attachment
      const file = new File([blob], filename, {type:"image/png"});
      const canShareFile = !!(window.isSecureContext && navigator.share &&
                              navigator.canShare && navigator.canShare({files:[file]}));
      if(canShareFile){
        try{
          await navigator.share({files:[file], title:"JUMVI Certificate",
                                 text:"My JUMVI Champion Certificate!"});
          hideSaveOverlay();
          if(!auto) showToast("Saved to Photos!");
          return;
        }catch(e){
          if(e.name === "AbortError"){ hideSaveOverlay(); return; }
          // fall through to long-press overlay
        }
      }
      // Fallback: open in new tab + long-press hint
      const url = URL.createObjectURL(blob);
      openImageForSave(url);
      showSaveOverlay(url, "Tap and hold the image → Save to Photos");
      return;
    }

    // Android / Desktop: direct download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){} }, 3000);
    if(!auto) showToast("Certificate saved!");

  }catch(err){
    hideSaveOverlay();
    showFallbackModal();
  }finally{
    // FIX: restore original button HTML (not hardcoded old text)
    if(btnCertSavePng){
      btnCertSavePng.disabled = false;
      btnCertSavePng.innerHTML = origHTML || '<i class="jic jic-download" aria-hidden="true"></i> Save to Photos';
    }
  }
}


async function shareCertificate(){
  clickSound("click");
  const filename = `JUMVI-Certificate-${getTodayISO()}.png`;
  // FIX: correct mission count (36) + always try image file first.
  // §6.3 — include qr.jumvi.co so the share is an organic growth channel.
  const shareText = "Completed all 36 JUMVI Toss & Catch missions! Play along: qr.jumvi.co";
  try{
    const blob = await renderSimpleCertificateBlob();
    if(!blob){ showToast("Couldn't generate certificate."); return; }
    const file = new File([blob], filename, {type:"image/png"});
    if(window.isSecureContext && navigator.share && navigator.canShare &&
       navigator.canShare({files:[file]})){
      // Best path: share actual image file (iOS + Android Chrome)
      await navigator.share({files:[file], title:"JUMVI Champion Certificate",
                             text: shareText});
    }else if(navigator.share){
      // Fallback: share URL with text (no file support)
      await navigator.share({title:"JUMVI Champion Certificate",
                             text: shareText, url: location.href});
    }else{
      // Desktop: download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){} }, 3000);
      showToast("Certificate saved!");
    }
  }catch(e){
    if(e.name !== "AbortError") showToast("Share failed. Try Save to Photos.");
  }
}

async function shareCertificateWhatsApp(){
  clickSound("click");
  // Faz 0 Denetim 2 bulgusu: shareText buraya certNameInput'tan çocuğun adını
  // taşıyordu; Web Share dosya desteği olmayan tarayıcılarda bu metin wa.me
  // URL'sine gömülüp isim URL üzerinden WhatsApp'a gidiyordu (aşağıdaki
  // fallback, satır ~2994). Mesaj generic — sertifika görselindeki isim
  // (renderSimpleCertificateBlob, canvas üzerinde) buna dokunulmadan kalıyor.
  const shareText = `🏆 Completed all 36 JUMVI Toss & Catch missions! 🎾\nCertificate: ${location.href}`;

  // FIX: try Web Share API with image file first (works on iOS + Android Chrome)
  // — this opens WhatsApp natively if the user picks it from the share sheet
  try{
    const filename = `JUMVI-Certificate-${getTodayISO()}.png`;
    const blob = await renderSimpleCertificateBlob();
    if(blob){
      const file = new File([blob], filename, {type:"image/png"});
      if(window.isSecureContext && navigator.share && navigator.canShare &&
         navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title:"JUMVI Certificate", text: shareText});
        return;
      }
    }
  }catch(e){
    if(e.name === "AbortError") return;
    // fall through to wa.me deep link
  }

  // Fallback: wa.me deep link (opens WhatsApp with pre-filled text + link)
  window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener");
}

async function downloadCertificatePDF(){
  const isiOS = isIosDevice(); // FIX: use shared helper (catches modern iPad)
  const filename = `JUMVI-Certificate-${getTodayISO()}.pdf`;
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
      // FIX: PDF-appropriate instruction (not "save image")
      showSaveOverlay(url, "Tap 'Open in…' → Save to Files or AirPrint");
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){} }, 3000);
    showToast("PDF saved!");
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
if(btnCertShare){
  btnCertShare.onclick = ()=>{ buildCertificate(); shareCertificate(); };
}

// Open certificate (only if unlocked)
if(certBtn){
  certBtn.onclick = ()=>{
    clickSound("click");
    const unlocked = done.size >= missions.length;
    if(unlocked){
      openCertificate();
    }else{
      showToast("Finish all 36 missions to unlock.");
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
backdrop.addEventListener("keydown",(e)=> handleDialogKeys(e, backdrop, closeMission));

// §3.2 — 5-second Undo bar shown after an interactive completion. Reverts the
// done state (the accidental-tap net that replaced hold-to-finish). Streak/daily
// counters aren't rewound — a rare edge for an undo inside 5s; flagged in report.
let _undoTimer = null;
function showUndoBar(id){
  const bar = document.getElementById("undoBar");
  const btn = document.getElementById("undoBtn");
  if(!bar || !btn) return;
  bar.hidden = false;
  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(()=>{ bar.hidden = true; }, 5000);
  btn.onclick = ()=>{
    clearTimeout(_undoTimer);
    bar.hidden = true;
    if(done.has(id)){
      done.delete(id);
      bumpDoneVersion();
      persist();
      renderList();
      if(typeof renderMissionPath === "function"){ try{ renderMissionPath(); }catch(_){} }
      clickSound("click");
      if(lastOpenedId === id) openMission(id);
      showToast("Marked as not done");
      trackEvent("Mission Undone", { id: id });
    }
  };
}

function markMissionDone(id, source="manual"){
  if(id==null || done.has(id)) return;
  // Pack milestone hesabı için ÖN bilgi
  const ms = missions.find(x=>x.id===id);
  const packKey = ms ? ms.pack : null;
  const packBefore = packKey ? missions.filter(m=>m.pack===packKey && done.has(m.id)).length : 0;

  done.add(id);
  bumpDoneVersion();

  // Beacon 3/5 — no de-dupe needed: the guard at the top of this function
  // already returns early for a mission that is already done.
  beacon("mission_complete", { id: id });

  // Hub3D Mission Completed — only for runs the kid launched from inside the hub
  // (window._hubMissionFlow is set by openMissionFromHub, cleared on hub exit).
  if(window._hubMissionFlow && packKey){
    trackEvent("Hub3D Mission Completed", { pack: packKey });
    beaconOnce("hub3d_mission", "hub3d", { step: "mission" });
  }

  // Path tree tile animasyonu işareti — render'da kullanılır
  window._justDoneMissionId = id;

  const changed = recordActivityToday();

  persist();
  renderList();
  // Path tree'yi anında yenile — done state ✓ rozet gözüksün
  if(typeof renderMissionPath === "function"){
    try { renderMissionPath(); } catch(_){}
  }
  clickSound("success");
  celebrate();
  window.JumviMusic?.cue("playMissionComplete");
  fireDoneBurst(document.getElementById("btnToggleDone"));
  // §3.2 — offer a 5s Undo for interactive completions (not bulk/programmatic)
  if(source === "manual" || source === "auto") showUndoBar(id);
  // Score özeti — eğer tracker açıksa ve skor varsa
  if(_scoreTrackerOpen && _currentScore > 0){
    showScoreSummary(id);
  }
  // Plausible event
  trackEvent("Mission Completed", {
    pack: ms ? ms.pack : "?",
    source: source,
    total: done.size
  });
  if(done.size === missions.length){
    trackEvent("All Missions Completed");
  }

  // Pack milestone — 3/6 halfway veya 6/6 complete
  if(packKey){
    const packAfter = packBefore + 1;
    const packTotal = missions.filter(m=>m.pack===packKey).length || 6;
    const packLabel = (typeof getPackName === "function") ? getPackName(packKey) : packKey;
    if(packAfter === Math.ceil(packTotal/2)){
      // Halfway hint
      setTimeout(()=>{
        showToast(`Halfway through ${packLabel}! Keep going!`);
        if(navigator.vibrate) try { navigator.vibrate([40, 60, 40]); } catch(_){}
        pathSound("milestone");
      }, 1800);
    } else if(packAfter === packTotal){
      // Pack complete — büyük kutlama
      setTimeout(()=> showPackCompleteCelebration(packKey, packLabel), 1800);
    }
  }

  if(source === "auto"){
    showToast("Mission complete!");
  } else {
    // First ever completion — Coach Leo special moment
    const remaining = missions.length - done.size;
    if(done.size === 1){
      setTimeout(()=>{ fireConfetti(2000); showToast("High-five, paddle pro! Your first mission is done!"); }, 400);
    } else if(done.size === 5){
      setTimeout(()=>{ fireConfetti(1500); showToast("5 down! You're on fire — Coach Leo is proud!"); }, 400);
    } else if(done.size === 18){
      setTimeout(()=>{ fireConfetti(2000); showToast("Halfway there! 18 missions crushed!"); }, 400);
    } else if(remaining > 0){
      const cheers = ["Awesome!", "Nailed it!", "Boom!", "You got this!", "Amazing!"];
      const cheer = cheers[Math.floor(Math.random()*cheers.length)];
      showToast(`${cheer} ${remaining} mission${remaining===1?"":"s"} to go!`);
    }
    if(changed) renderStreakUI(false);
  }
  // Hub flow: instead of staying on this mission (old behavior), let the kid
  // see the done-confirmation beat (checkmark burst + score summary, both
  // already fired above) for a moment, then auto-close so the 3D hub can
  // show what just grew — camera pans to the new decor piece — and either
  // auto-opens the next undone mission in this pack or (pack just finished)
  // leaves the player in the hub for the medal ceremony. See
  // window._hub3dAdvance in jumvi-hub-app.js. Normal (Missions tab) flow is
  // untouched — it still just refreshes this same mission view.
  const hubFlow = window._hubMissionFlow;
  if(hubFlow && hubFlow.packKey){
    const packKey = hubFlow.packKey;
    setTimeout(()=>{
      // bail if the kid already closed/navigated away manually in the meantime
      if(!backdrop.classList.contains("show") || lastOpenedId !== id) return;
      closeMission();
      if(window._hub3dAdvance) window._hub3dAdvance(packKey);
    }, 1100);
  } else {
    openMission(id);
  }
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
      <div class="seasonalMissionArt">${JUMVI_ART.img(JUMVI_ART.mission(ms.id), "missionArt", ms.title)}</div>
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

function pickSmartNextMission(currentId){
  // Mevcut mission tamamlandıysa: en az tamamlanan pack'ten yeni mission öner (çeşitlilik)
  const current = missions.find(x=>x.id===currentId);
  if(!current) return null;
  if(!done.has(currentId)) return null; // sadece tamamlanmışsa akıllı öneri
  // Same key order as PACKS/SKILL_PACKS so ties (e.g. a fresh user) resolve to
  // the new first pack (Aim Master), matching the 3D spawn zone.
  const packs = ["Aim Master","Focus Control","Team Duo","Indoor Compact","Beach/Park","Reflex Rush"];
  const packCounts = packs.map(p=>({
    pack:p,
    doneCount: missions.filter(m=>m.pack===p && done.has(m.id)).length,
    pending: missions.filter(m=>m.pack===p && !done.has(m.id))
  })).filter(x=>x.pending.length>0);
  if(!packCounts.length) return null;
  // En az tamamlanan pack
  packCounts.sort((a,b)=>a.doneCount - b.doneCount);
  const targetPack = packCounts[0];
  // Pack içinden rastgele tamamlanmamış mission
  const pick = targetPack.pending[Math.floor(Math.random()*targetPack.pending.length)];
  return pick ? pick.id : null;
}

btnNext.onclick = ()=>{
  if(lastOpenedId==null) return;
  clickSound("click");
  // Hub flow: Next stays INSIDE the current zone's pack — the smart picker
  // below deliberately hops across packs for variety, which is exactly wrong
  // when the kid walked into a themed zone. Only ever active while the 3D
  // hub opened this view (window._hubMissionFlow is set by the hub module);
  // the normal Missions tab path below is untouched.
  const hubFlow = window._hubMissionFlow;
  if(hubFlow && hubFlow.packKey){
    const packList = missions.filter(m=>m.pack===hubFlow.packKey);
    if(packList.length && packList.every(m=>done.has(m.id))){
      showToast("Zone Complete!");
      trackEvent("Hub Zone Complete Close");
      closeMission();
      return;
    }
    const i = packList.findIndex(m=>m.id===lastOpenedId);
    for(let k=1;k<=packList.length;k++){
      const cand = packList[(i+k) % packList.length];
      if(!done.has(cand.id)){
        trackEvent("Mission Next Hub Pack");
        openMission(cand.id);
        return;
      }
    }
    openMission(packList[(i+1) % packList.length].id);
    return;
  }
  // Akıllı öneri (mevcut mission tamamlandıysa)
  const smartId = pickSmartNextMission(lastOpenedId);
  if(smartId){
    trackEvent("Mission Next Smart");
    openMission(smartId);
    return;
  }
  // Fallback: görünür listede sıradaki
  const list = getVisibleMissions();
  const idx = list.findIndex(x=>x.id===lastOpenedId);
  const next = list[(idx+1) % list.length];
  if(!done.has(lastOpenedId)) incSkip(lastOpenedId);
  trackEvent("Mission Next Linear");
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

// §3.2 — destructive reset now requires a deliberate press-and-hold (the guard
// that left the reward moment lands here instead of a confirm() dialog). A plain
// tap just hints. NOTE: there are two elements with id="btnReset" in the markup
// (a dup-id bug — flagged in the report); bind both so neither is a live reset
// without the hold.
(function bindHoldToReset(){
  // (btnReset = Profile quick-link; btnResetBottom = footer — both reset, one id each)
  const btns = document.querySelectorAll('#btnReset, #btnResetBottom');
  const HOLD_MS = 1200;
  function doReset(){
    setDoneFromArray([]);
    unlockedBefore = setState("unlockedBefore", false);
    persist();
    renderList();
    closeMission();
    closeCertificate();
    showToast("Progress reset");
    trackEvent("Progress Reset");
    beacon("progress_reset");
  }
  btns.forEach(btn=>{
    if(!btn) return;
    btn.classList.add("holdConfirm");
    const fill = document.createElement("span");
    fill.className = "holdFill";
    btn.appendChild(fill);
    let t=null, raf=null, start=0, fired=false;
    function tick(){
      const p = Math.min(1, (Date.now()-start)/HOLD_MS);
      fill.style.width = (p*100)+"%";
      if(p<1) raf = requestAnimationFrame(tick);
    }
    function begin(e){
      if(e && e.button) return;            // primary pointer only
      fired=false; start=Date.now();
      raf = requestAnimationFrame(tick);
      t = setTimeout(()=>{ fired=true; fill.style.width="100%"; clickSound("success"); doReset(); clearHold(); }, HOLD_MS);
    }
    function clearHold(){ clearTimeout(t); cancelAnimationFrame(raf); fill.style.width="0%"; }
    function cancel(){ if(!fired) clearHold(); }
    btn.addEventListener("pointerdown", begin);
    btn.addEventListener("pointerup", cancel);
    btn.addEventListener("pointerleave", cancel);
    btn.addEventListener("pointercancel", cancel);
    btn.addEventListener("click", (e)=>{ e.preventDefault(); if(!fired) showToast("Hold to reset progress"); });
  });
})();

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

// Privacy & Safety modal — parent-facing, opened from the footer link.
const privacyBackdrop = document.getElementById("privacyBackdrop");
const privacyLink = document.getElementById("privacyLink");
const btnPrivacyClose = document.getElementById("btnPrivacyClose");
if(privacyLink && privacyBackdrop){
  privacyLink.addEventListener("click",(e)=>{ e.preventDefault(); clickSound("click"); privacyBackdrop.classList.add("show"); });
}
if(btnPrivacyClose){
  btnPrivacyClose.onclick = ()=>{ clickSound("click"); privacyBackdrop.classList.remove("show"); };
}
if(privacyBackdrop){
  privacyBackdrop.addEventListener("click",(e)=>{ if(e.target===privacyBackdrop){ clickSound("click"); privacyBackdrop.classList.remove("show"); } });
}
if(btnSeasonalIndoor){
  btnSeasonalIndoor.onclick = ()=>{ clickSound("click"); renderSeasonalList("indoor"); };
}
if(btnSeasonalOutdoor){
  btnSeasonalOutdoor.onclick = ()=>{ clickSound("click"); renderSeasonalList("outdoor"); };
}

// Parent Dashboard — Print Report
/* Stats tab — Aile ile paylas (eski Print Weekly Report yerine) */
function buildFamilyShareText(){
  const ap = (typeof getActiveProfile === "function") ? getActiveProfile() : null;
  const name = ap && ap.name && ap.name !== "Player" ? ap.name : "Our paddle pro";
  const total = done.size;
  const sc = streakCount || 0;
  // Top skill — en cok tamamlanan pack
  let topPackLabel = null;
  let topCount = 0;
  if(typeof SKILL_PACKS !== "undefined"){
    SKILL_PACKS.forEach(p => {
      const n = missions.filter(m => m.pack === p.key && done.has(m.id)).length;
      if(n > topCount){ topCount = n; topPackLabel = p.label; }
    });
  }
  let text = `${name}'s JUMVI progress this week:\n`;
  text += `${total}/36 missions completed\n`;
  if(sc > 0) text += `${sc}-day streak\n`;
  if(topPackLabel) text += `Top skill: ${topPackLabel}\n`;
  text += `\nPlay along: https://qr.jumvi.co`;
  return text;
}

const btnDashShareWA = document.getElementById("btnDashShareWA");
if(btnDashShareWA){
  btnDashShareWA.onclick = ()=>{
    clickSound("click");
    // Faz 0 Denetim 2 bulgusu: bu buton buildFamilyShareText() (çocuğun profil
    // adını içerir) her tıklamada koşulsuz olarak wa.me URL'sine gönderiyordu —
    // isim URL üzerinden üçüncü tarafa (WhatsApp) gidiyordu. Buton kendi generic
    // metnini kullanıyor; buildFamilyShareText() paylaşılan bir fonksiyon
    // olduğundan (btnDashShareCopy da kullanıyor) ona dokunulmadı.
    const text = "🏓 Great progress on JUMVI! Play along: https://qr.jumvi.co";
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
    trackEvent("Dashboard Share WhatsApp");
    beacon("share_tap", { channel: "whatsapp" });
  };
}
const btnDashShareCopy = document.getElementById("btnDashShareCopy");
if(btnDashShareCopy){
  btnDashShareCopy.onclick = async ()=>{
    clickSound("click");
    const text = buildFamilyShareText();
    try{
      if(navigator.share){
        await navigator.share({ title: "JUMVI Progress", text, url: "https://qr.jumvi.co" });
        trackEvent("Dashboard Share Native");
        beacon("share_tap", { channel: "native" });
      } else {
        await navigator.clipboard.writeText(text);
        showToast("Copied! Share with family.");
        trackEvent("Dashboard Share Copy");
        beacon("share_tap", { channel: "copy" });
      }
    }catch(_){}
  };
}

const btnDashPrint = document.getElementById("btnDashPrint");
if(btnDashPrint){
  btnDashPrint.onclick = ()=>{
    clickSound("click");
    const packs = [
      { key:"Reflex Rush", label:"Reflex" },
      { key:"Aim Master", label:"Aim" },
      { key:"Focus Control", label:"Focus" },
      { key:"Team Duo", label:"Team" },
      { key:"Indoor Compact", label:"Indoor" }
    ];
    const rows = packs.map(p=>{
      const n = missions.filter(m=>m.pack===p.key && done.has(m.id)).length;
      return `<tr><td>${p.label}</td><td>${n} of 6 complete</td><td>${n}/6</td></tr>`;
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
<h1>JUMVI Missions — Parent Report</h1>
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
  const badgePart = topBadge ? `Top badge: ${topBadge.name}\n` : "";
  const text = `We completed ${done.size}/36 JUMVI missions!\n${badgePart}Try it: ${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
};
document.getElementById("btnShareCopy").onclick = async ()=>{
  clickSound("click");
  const url = location.href;
  let topBadge = null;
  for(const b of BADGES){ if(b.check(done)) topBadge = b; }
  const badgePart = topBadge ? ` | Badge: ${topBadge.name}` : "";
  const text = `${done.size}/36 JUMVI missions completed${badgePart} — ${url}`;
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
    btnToggleFilters.innerHTML = filtersOpen ? '<i class="jic jic-x" aria-hidden="true"></i> Filters' : '<i class="jic jic-settings" aria-hidden="true"></i> Filters';
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
    // Once the featured mission is done this button leads onward instead of
    // replaying; renderDailyUI() is what decided that, and it stored the id.
    if(_dailyNextId && done.has(dailyIdStored)){
      openMission(_dailyNextId);
      return;
    }
    openMission(dailyIdStored);
  };
}
if(btnDailyReplay){
  btnDailyReplay.onclick = ()=>{
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
    showToast("Another mission is ready.");
  };
}

/* Profile pill render — avatar + isim + chevron */
function renderAvatar(){
    const ap = getActiveProfile();
    const avatarEl = document.getElementById("profilePillAvatar");
    const nameEl   = document.getElementById("profilePillName");
    if(ap){
      if(avatarEl) avatarEl.innerHTML = JUMVI_ART.img(JUMVI_ART.avatar(ap.avatar), "avatarArt", "", true);
      if(nameEl)   nameEl.textContent   = ap.name   || "Player";
    } else {
      if(avatarEl) avatarEl.innerHTML = JUMVI_ART.img(JUMVI_ART.avatar(AVATARS[currentAvatarIdx] || "monkey"), "avatarArt", "", true);
      if(nameEl)   nameEl.textContent   = "Player";
    }
}
if(avatarBtn){
  avatarBtn.onclick = () => {
    clickSound("click");
    openProfileSheet();
  };
}

/* =======================
 * Profile Sheet (multi-child)
 * ======================= */
let _profileSelectedAvatar = "monkey";

function openProfileSheet(){
  const bk = document.getElementById("profileBackdrop");
  if(!bk) return;
  closeProfileEdit(); // edit paneli kapalı başlasın
  renderProfileList();
  renderProfileAvatarPicker();
  renderSettingsRows();
  const nameInput = document.getElementById("profileNewName");
  if(nameInput) nameInput.value = "";
  bk.classList.add("show");
  trackEvent("Profile Sheet Opened");
}

function renderSettingsRows(){
  // Theme row
  const themeIcon = document.getElementById("profileThemeIcon");
  const themeVal  = document.getElementById("profileThemeValue");
  if(themeIcon && themeVal){
    const labels = { dark:"Dark", light:"Light", system:"System" };
    const icons  = { dark:'<i class="jic jic-moon" aria-hidden="true"></i>', light:'<i class="jic jic-sun" aria-hidden="true"></i>', system:'<i class="jic jic-moon-stars" aria-hidden="true"></i>' };
    const mode = (typeof themeMode !== "undefined") ? themeMode : "system";
    themeIcon.innerHTML = icons[mode] || '<i class="jic jic-moon-stars" aria-hidden="true"></i>';
    themeVal.textContent  = labels[mode] || "System";
  }
  // Sound row
  const soundIcon = document.getElementById("profileSoundIcon");
  const soundVal  = document.getElementById("profileSoundValue");
  if(soundIcon && soundVal){
    soundIcon.innerHTML = soundOn ? '<i class="jic jic-volume" aria-hidden="true"></i>' : '<i class="jic jic-volume-off" aria-hidden="true"></i>';
    soundVal.textContent  = soundOn ? "On" : "Off";
  }
  // §3.1 — Read-aloud row
  const ttsVal = document.getElementById("profileTtsValue");
  if(ttsVal) ttsVal.textContent = ttsAuto() ? "On" : "Off";
}
function closeProfileSheet(){
  const bk = document.getElementById("profileBackdrop");
  if(!bk) return;
  bk.classList.remove("show");
}
function renderProfileList(){
  const list = document.getElementById("profileList");
  if(!list) return;
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  list.innerHTML = "";
  profiles.forEach(p => {
    const isActive = p.id === activeId;
    const doneRaw = lsGetJSON("jumvi_" + p.id + "_missions_done_v3", []);
    const doneCount = Array.isArray(doneRaw) ? doneRaw.length : 0;
    const streak = Number(lsGet("jumvi_" + p.id + "_streak_count_v1", "0")) || 0;
    const item = document.createElement("div");
    item.className = "profileItem" + (isActive ? " active" : "");
    item.innerHTML = `
      <div class="profileItemAvatar">${JUMVI_ART.img(JUMVI_ART.avatar(p.avatar), "avatarArt", "", true)}</div>
      <div class="profileItemBody">
        <div class="profileItemName">${escapeHtml(p.name || "Player")}</div>
        <div class="profileItemMeta">${doneCount}/36 missions · <i class="jic jic-flame" aria-hidden="true"></i> ${streak} day${streak===1?"":"s"}</div>
      </div>
      <button class="profileEditPencil" data-pid="${p.id}" aria-label="Edit profile" type="button"><i class="jic jic-pencil" aria-hidden="true"></i></button>
      ${isActive ? '<div class="profileItemActive"><i class="jic jic-circle-check" aria-hidden="true"></i></div>' : ""}
    `;
    // Edit pencil click — opens edit panel
    const pencil = item.querySelector(".profileEditPencil");
    if(pencil){
      pencil.onclick = (e)=>{
        e.stopPropagation();
        clickSound("click");
        openProfileEdit(p.id);
      };
    }
    item.onclick = ()=>{
      if(isActive){ closeProfileSheet(); return; }
      switchProfile(p.id);
    };
    list.appendChild(item);
  });
}

/* Profil düzenleme paneli */
let _profileEditingId = null;
let _profileEditingAvatar = "monkey";
let _deleteConfirmTimer = null;

function openProfileEdit(id){
  const p = getProfiles().find(x => x.id === id);
  if(!p) return;
  _profileEditingId = id;
  _profileEditingAvatar = JUMVI_ART.avatarId(p.avatar || "monkey");

  const editSection = document.getElementById("profileEditSection");
  const addSection  = document.getElementById("profileAddSection");
  const titleEl = document.getElementById("profileEditTitle");
  const nameEl  = document.getElementById("profileEditName");
  const deleteBtn = document.getElementById("btnProfileDelete");
  if(editSection) editSection.style.display = "";
  if(addSection)  addSection.style.display  = "none";
  if(titleEl) titleEl.innerHTML = '<i class="jic jic-pencil" aria-hidden="true"></i> Edit ' + escapeHtml(p.name || "Player");
  if(nameEl){ nameEl.value = p.name || ""; nameEl.focus(); }

  // Delete butonu: tek profil varsa devre dışı
  const profiles = getProfiles();
  if(deleteBtn){
    deleteBtn.disabled = profiles.length <= 1;
    deleteBtn.classList.remove("confirming");
    deleteBtn.innerHTML = profiles.length <= 1
      ? '<i class="jic jic-trash" aria-hidden="true"></i> Delete (need at least 1 profile)'
      : '<i class="jic jic-trash" aria-hidden="true"></i> Delete this profile';
    deleteBtn.style.opacity = profiles.length <= 1 ? "0.4" : "1";
  }

  renderProfileEditAvatarPicker();
}
function closeProfileEdit(){
  _profileEditingId = null;
  const editSection = document.getElementById("profileEditSection");
  const addSection  = document.getElementById("profileAddSection");
  if(editSection) editSection.style.display = "none";
  if(addSection)  addSection.style.display  = "";
}
function renderProfileEditAvatarPicker(){
  const picker = document.getElementById("profileEditAvatarPicker");
  if(!picker) return;
  picker.innerHTML = "";
  PROFILE_AVATARS.forEach(em => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "profileAvatarOption" + (em === _profileEditingAvatar ? " selected" : "");
    btn.innerHTML = JUMVI_ART.img(JUMVI_ART.avatar(em), "avatarArt", "", true);
    btn.setAttribute("aria-label", `Choose ${em} avatar`);
    btn.onclick = ()=>{
      clickSound("click");
      _profileEditingAvatar = em;
      renderProfileEditAvatarPicker();
    };
    picker.appendChild(btn);
  });
}
function saveProfileEdit(){
  if(!_profileEditingId) return;
  const nameEl = document.getElementById("profileEditName");
  const newName = (nameEl && nameEl.value || "").trim().slice(0, 20);
  if(!newName){
    showToast("Please enter a name.");
    if(nameEl) nameEl.focus();
    return;
  }
  const profiles = getProfiles();
  const idx = profiles.findIndex(x => x.id === _profileEditingId);
  if(idx === -1) return;
  profiles[idx].name = newName;
  profiles[idx].avatar = _profileEditingAvatar;
  saveProfiles(profiles);
  trackEvent("Profile Edited");
  closeProfileEdit();
  renderProfileList();
  // Aktif profil düzenlendiyse header avatarını da yenile
  if(_profileEditingId === getActiveProfileId()){
    renderAvatar();
  }
  showToast("Profile updated.");
}
function deleteProfile(){
  const id = _profileEditingId;
  if(!id) return;
  const profiles = getProfiles();
  if(profiles.length <= 1){
    showToast("Cannot delete the only profile.");
    return;
  }
  // Tüm profile-specific veriyi sil
  const keysToRemove = [
    "missions_done_v3","streak_count_v1","streak_best_v1","streak_last_v1",
    "daily_date_v1","daily_id_v1","daily_n_v1",
    "attempts_v1","skips_v1","badges_unlocked_v1",
    "age_v2","cert_name_v1","cert_id_v1","avatar_v1"
  ];
  keysToRemove.forEach(k => {
    try { localStorage.removeItem("jumvi_" + id + "_" + k); } catch(_){}
  });
  // Profile listesinden çıkar
  const filtered = profiles.filter(p => p.id !== id);
  saveProfiles(filtered);
  trackEvent("Profile Deleted");
  // Eğer aktif profil silindiyse, ilk kalan profile geç (reload tetiklenir)
  if(getActiveProfileId() === id){
    lsSet(ACTIVE_PROFILE_KEY, filtered[0].id);
    showToast("Profile deleted. Switching...");
    setTimeout(()=>{ location.reload(); }, 600);
    return;
  }
  closeProfileEdit();
  renderProfileList();
  showToast("Profile deleted.");
}

// Edit panel buton handler'ları (DOM ready'de bağlanır)
document.addEventListener("DOMContentLoaded", ()=>{
  const cancelBtn = document.getElementById("btnProfileEditCancel");
  if(cancelBtn) cancelBtn.onclick = ()=>{ clickSound("click"); closeProfileEdit(); };
  const saveBtn = document.getElementById("btnProfileEditSave");
  if(saveBtn) saveBtn.onclick = ()=>{ clickSound("click"); saveProfileEdit(); };
  const deleteBtn = document.getElementById("btnProfileDelete");
  if(deleteBtn){
    deleteBtn.onclick = ()=>{
      if(deleteBtn.disabled) return;
      clickSound("click");
      // 2-step confirm
      if(deleteBtn.classList.contains("confirming")){
        deleteProfile();
        if(_deleteConfirmTimer){ clearTimeout(_deleteConfirmTimer); _deleteConfirmTimer = null; }
      } else {
        deleteBtn.classList.add("confirming");
        deleteBtn.innerHTML = 'Tap again to confirm <i class="jic jic-trash" aria-hidden="true"></i>';
        if(_deleteConfirmTimer) clearTimeout(_deleteConfirmTimer);
        _deleteConfirmTimer = setTimeout(()=>{
          deleteBtn.classList.remove("confirming");
          deleteBtn.innerHTML = '<i class="jic jic-trash" aria-hidden="true"></i> Delete this profile';
          _deleteConfirmTimer = null;
        }, 3500);
      }
    };
  }
});
function renderProfileAvatarPicker(){
  const picker = document.getElementById("profileAvatarPicker");
  if(!picker) return;
  if(!_profileSelectedAvatar) _profileSelectedAvatar = PROFILE_AVATARS[0];
  picker.innerHTML = "";
  PROFILE_AVATARS.forEach(em => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "profileAvatarOption" + (em === _profileSelectedAvatar ? " selected" : "");
    btn.innerHTML = JUMVI_ART.img(JUMVI_ART.avatar(em), "avatarArt", "", true);
    btn.setAttribute("aria-label", `Choose ${em} avatar`);
    btn.onclick = ()=>{
      clickSound("click");
      _profileSelectedAvatar = em;
      renderProfileAvatarPicker();
    };
    picker.appendChild(btn);
  });
}
function switchProfile(id){
  if(!id) return;
  clickSound("success");
  lsSet(ACTIVE_PROFILE_KEY, id);
  trackEvent("Profile Switched");
  // Sayfa yenile — tüm state yeni profilden okunur
  showToast("Switching player...");
  setTimeout(()=>{ location.reload(); }, 350);
}
function addNewChildProfile(){
  const nameInput = document.getElementById("profileNewName");
  if(!nameInput) return;
  const name = (nameInput.value || "").trim().slice(0, 20);
  if(!name){
    showToast("Please enter a name first.");
    nameInput.focus();
    return;
  }
  const profiles = getProfiles();
  if(profiles.length >= 6){
    showToast("Maximum 6 children supported.");
    return;
  }
  const newProfile = {
    id: nextProfileId(),
    name: name,
    avatar: _profileSelectedAvatar || "monkey",
    createdAt: new Date().toISOString()
  };
  profiles.push(newProfile);
  saveProfiles(profiles);
  // The event only. Never the child's name, age or avatar — this answers
  // "is the multi-child feature alive", nothing else.
  trackEvent("Profile Added");
  beacon("profile_add");
  showToast(`Hi ${name}! Let's play!`);
  // Yeni profile geç (page reload)
  switchProfile(newProfile.id);
}

// Profile sheet event handlers
// First-visit stamp for D1/D7 retention cohorting (audit): written once, the
// first time the app ever loads on this device. Never overwritten, so later
// sessions can compute "days since first visit" for the A/B retention read.
document.addEventListener("DOMContentLoaded", ()=>{
  try{
    if(storageAvailable && !lsGet("jumvi_first_visit_v1", "")){
      lsSet("jumvi_first_visit_v1", new Date().toISOString().slice(0,10));
      trackEvent("first_visit");
    }
  }catch(_){}
  // Beacon 1/5 — top of the funnel. Once per session, not per page load, so a
  // returning tab does not inflate the denominator every other event is read
  // against in the weekly snapshot.
  beaconOnce("app_open", "app_open");
  // Faz 2 — the same moment, two different questions: is this device new, and
  // has it come back. Neither sends anything that identifies it.
  beaconReachAndRetention();

  // The Mission Book is a plain PDF link in two places (profile quick-link and
  // the parent panel). Both are real <a href> navigations — bind, don't
  // intercept: sendBeacon is built to survive the page going away.
  try{
    document.querySelectorAll('a[href="mission-book.pdf"]').forEach(a=>{
      a.addEventListener("click", ()=>{ beacon("missionbook_get"); });
    });
  }catch(_){}
});

/* ═══ Beacons 4/5 and 5/5 — mission sheet controls ═══════════════════════ */

const PLAYER_COUNT_KEY = "jumvi_player_count_v1";

/* Every reason answers the kid immediately. If a tip here ever goes stale,
 * fix the tip — do not remove the option: the six reasons are a frozen enum
 * shared with src/worker.js and the weekly snapshot. */
const HELP_TIPS = {
  ball_stuck:          "Peel the ball slowly from one edge instead of pulling straight up.",
  ball_hard_to_remove: "Peel it slowly from one edge. Younger players may need a grown-up's help — don't yank or twist the paddle.",
  strap_uncomfortable: "Loosen it first, slide your hand under the strap, then make it snug — not tight. The strap is for hands only.",
  need_more_space:     "Clear breakables, stand closer, and use soft underhand tosses below face level.",
  instructions_unclear:"Tap the speaker icon to hear the steps read aloud, or open “More tips & safety”.",
  mission_too_hard:    "Move to 3–4 ft apart and use slow underhand tosses toward the center. Get one easy catch, then take one small step back.",
};
const HELP_ONLY_TIPS = {
  ball_wont_stick: "Use the blue catching face. Remove visible lint, grass, or sand with a soft, dry brush; let every piece dry fully; then move closer and aim a soft toss at the center.",
};

function setPlayerCountUI(n){
  document.querySelectorAll(".playerCountBtn").forEach(b=>{
    const on = b.dataset.n === String(n);
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

document.addEventListener("DOMContentLoaded", ()=>{
  const saved = lsGet(PLAYER_COUNT_KEY, "");
  if(saved) setPlayerCountUI(saved);

  document.querySelectorAll(".playerCountBtn").forEach(b=>{
    if(!b.hasAttribute("aria-pressed")) b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", ()=>{
      const n = Number(b.dataset.n);
      setPlayerCountUI(n);
      lsSet(PLAYER_COUNT_KEY, String(n));
      clickSound("click");
      // Beacon 5/5 — one per session. The weekly snapshot reads player_count
      // against app_opens 1:1, so a second tap must not double-count.
      beaconOnce("player_count", "player_count", { n: n });
    });
  });

  const trigger = document.getElementById("btnMissionHelp");
  const panel   = document.getElementById("missionHelpPanel");
  const tip     = document.getElementById("missionHelpTip");
  if(trigger && panel){
    trigger.addEventListener("click", ()=>{
      const open = panel.hidden;
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      clickSound("click");
      // Opening the panel is NOT the event — only picking a reason is, so an
      // idle tap never lands in the dataset as a phantom problem report.
    });
  }
  document.querySelectorAll(".missionHelpOpt").forEach(b=>{
    b.addEventListener("click", ()=>{
      const reason = b.dataset.reason;
      const helpOnly = b.dataset.helpOnly;
      if(!HELP_REASONS.includes(reason) && !HELP_ONLY_TIPS[helpOnly]) return;
      if(tip){
        tip.textContent = HELP_ONLY_TIPS[helpOnly] || HELP_TIPS[reason] || "";
        tip.hidden = false;
      }
      document.querySelectorAll(".missionHelpOpt").forEach(o=> o.classList.toggle("active", o === b));
      clickSound("click");
      // Beacon 4/5 — fires per pick, not de-duped: a kid hitting the same
      // problem in three different missions is exactly the signal we want.
      if(HELP_REASONS.includes(reason)) beacon("help_open", { reason: reason });
    });
  });
});

document.addEventListener("DOMContentLoaded", ()=>{
  const closeBtn = document.getElementById("btnProfileClose");
  if(closeBtn) closeBtn.onclick = ()=>{ clickSound("click"); closeProfileSheet(); };
  const bk = document.getElementById("profileBackdrop");
  if(bk) bk.addEventListener("click", (e)=>{ if(e.target === bk){ clickSound("click"); closeProfileSheet(); } });
  const addBtn = document.getElementById("btnProfileAdd");
  if(addBtn) addBtn.onclick = ()=>{ clickSound("click"); addNewChildProfile(); };

  // Settings: theme cycle
  const themeBtn = document.getElementById("profileThemeBtn");
  if(themeBtn){
    themeBtn.onclick = ()=>{
      clickSound("click");
      cycleTheme();
      renderSettingsRows();
      trackEvent("Theme Toggled");
    };
  }
  // Settings: sound toggle
  const soundBtn = document.getElementById("profileSoundBtn");
  if(soundBtn){
    soundBtn.onclick = ()=>{
      soundOn = !soundOn;
      lsSet(SOUND_KEY, soundOn ? "1" : "0");
      renderSoundToggle();
      renderSettingsRows();
      if(soundOn){ ensureAudio(); clickSound("click"); }
      else if(window.CoachLeoAudio) window.CoachLeoAudio.stop();
      window.JumviMusic?.setEnabled(soundOn);
      trackEvent("Sound Toggled");
    };
  }
  // §3.1 — Read missions aloud toggle
  const ttsBtn = document.getElementById("profileTtsBtn");
  if(ttsBtn){
    ttsBtn.onclick = ()=>{
      const next = ttsAuto() ? "0" : "1";
      lsSet(TTS_AUTO_KEY, next);
      renderSettingsRows();
      if(soundOn) clickSound("click");
      trackEvent("Read Aloud Toggled", { on: next });
      // Enable only: a toggle-off is not a use of the feature.
      if(next) beaconOnce("speak_on", "speak_on");
    };
  }
});


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
// K3 — single source of truth for the mission total. Do NOT hardcode the
// number anywhere else; format the welcome count through renderMissionCount.
const TOTAL_MISSIONS = 36;
function renderMissionCount(bandLabel, n){
  // Every mission stays available; the selected band only tunes the first pick.
  if(n >= TOTAL_MISSIONS){
    return `All ${TOTAL_MISSIONS} missions available`;
  }
  return `${n} matched missions · all ${TOTAL_MISSIONS} always available`;
}
function showWelcomeOverlay(){
  const overlay = document.getElementById("welcomeOverlay");
  if(!overlay) return;
  const appShell = document.getElementById("app-wrapper");
  const isolateWelcome = (active)=>{
    if(!appShell) return;
    if(active){
      document.body.classList.add("welcomeActive");
      appShell.setAttribute("inert", "");
      appShell.setAttribute("aria-hidden", "true");
    }else{
      document.body.classList.remove("welcomeActive");
      appShell.removeAttribute("inert");
      appShell.removeAttribute("aria-hidden");
    }
  };
  // Already onboarded — hide immediately without animation
  if(lsGet(ONBOARD_KEY, "0") === "1"){
    overlay.style.display = "none";
    overlay.setAttribute("aria-hidden", "true");
    isolateWelcome(false);
    return;
  }
  isolateWelcome(true);
  // Default: first age group selected
  let selectedDiff = "Easy";
  let selectedBand = "just-starting";
  const ageBtns = overlay.querySelectorAll(".ageBtn");
  const countEl  = document.getElementById("welcomeMissionCount");

  // §1.1 — CUMULATIVE ceiling (shared AGE_DIFF_CEIL, module scope): a kid sees
  // every mission up to AND including their tier, so the count is monotonically
  // non-decreasing with age.
  function getMissionCount(diff){
    const ceil = AGE_DIFF_CEIL[diff] != null ? AGE_DIFF_CEIL[diff] : Infinity;
    return missions.filter(x => x.difficulty <= ceil).length;
  }
  function updateCount(diff, bandLabel){
    if(!countEl) return;
    countEl.textContent = renderMissionCount(bandLabel, getMissionCount(diff));
  }

  ageBtns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      clickSound("click");
      ageBtns.forEach(b=>b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedDiff = btn.dataset.diff || "all";
      selectedBand = btn.dataset.band || "just-starting";
      updateCount(selectedDiff, selectedBand);
    });
  });
  if(ageBtns[0]){
    ageBtns[0].classList.add("selected");
    selectedDiff = ageBtns[0].dataset.diff || "Easy";
    selectedBand = ageBtns[0].dataset.band || "just-starting";
    requestAnimationFrame(()=> ageBtns[0].focus());
  }
  updateCount(selectedDiff, selectedBand);

  const startBtn = document.getElementById("btnWelcomeStart");
  if(startBtn){
    startBtn.addEventListener("click", ()=>{
      const firstMissionId = pickFirstMissionForNewUser(selectedDiff);
      // Close first so the mission hand-off feels immediate and never stacks.
      clickSound("success");
      // Persist selection. Read the flag BEFORE writing it so welcome_complete
      // can fire exactly once per device: this overlay early-returns when the
      // flag is already "1", and a double tap before it hides sees the flag
      // it just set. Same shape as app_first_open — no new storage key, no id.
      let firstOnboard = false;
      try { firstOnboard = lsGet(ONBOARD_KEY, "0") !== "1"; lsSet(ONBOARD_KEY, "1"); } catch(e){}
      try { lsSet(AGE_KEY, selectedDiff); } catch(e){}
      // Apply the cumulative age ceiling app-wide (§1.1). ALWAYS set it (even
      // for the "all" bands) so a re-onboard can't leave a stale narrower
      // filter. This drives the surfaces that read currentDifficulty — Surprise
      // me + "Next" — so they stay consistent with the welcome count.
      try {
        currentDifficulty = setState("currentDifficulty", selectedDiff);
        renderFilterGroups();
        updateProgress({ deferStats: true });
        // Make the selected first mission the home-card pick too, so closing the
        // sheet never lands on a different recommendation.
        if(firstMissionId){
          dailyIso = setState("dailyIso", isoLocalDate());
          dailyN = setState("dailyN", 0);
          dailyIdStored = setState("dailyIdStored", firstMissionId);
          persistDaily();
        }
        if(typeof renderDailyUI === "function") renderDailyUI();
      } catch(e){ console.warn("Welcome filter:", e); }
      try { lsSet(TUTORIAL_KEY, "1"); } catch(_){}
      // Keep the mission open in the original tap stack so iOS permits the
      // automatic read-aloud for the just-starting level.
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      isolateWelcome(false);
      // Onboarding is genuinely finished at this point — level chosen, overlay
      // gone. Fired here rather than on render, so it means "the family got
      // through the welcome screen", not "the welcome screen was drawn".
      if(firstOnboard) beacon("welcome_complete");
      if(firstMissionId) openMission(firstMissionId);
    });
  }
  // §1.3 — the sibling line is now STATIC helper text (a <p>), not a control:
  // it was a false affordance (looked tappable, only started the app). Siblings
  // are added any time from Profile's existing "Switch Player or Add Child".
  // Nothing to wire, nothing persisted.
}

/** =======================
 * Bottom Navigation — Tab Switching (2026 redesign)
 * ======================= */
const NAV_TAB_KEY = "jumvi_active_tab_v1";

/* 3D Hub — lazy loader. Three.js + jumvi-hub-app.js are only fetched the
 * first time the user actually opens the hub3d tab; nothing here runs on
 * normal page load. */
let _hub3dInstance = null;
let _hub3dLoadPromise = null;
let _hub3dLoadStage = "three"; // last import stage started — read on failure
// Warming three.js first (its own module) lets us show a real staged progress
// bar: three import → hub-module import → initHub3D() → first painted frame.
// The hub module's internal `import ... from "three"` then resolves from cache.
// §4.6 — local three.js (was jsdelivr). This explicit warm-import bypasses the
// importmap (it's a full URL, not the bare "three" specifier), so it must point
// at the vendored copy too, or the hub still hits the CDN.
const THREE_MODULE_URL = "./vendor/three.module.min.js";

function ensureHub3DLoaded(onProgress){
  if(_hub3dLoadPromise) return _hub3dLoadPromise;
  const step = (frac, stage) => { if(stage) _hub3dLoadStage = stage; if(onProgress) onProgress(frac, stage); };
  _hub3dLoadPromise = (async () => {
    _hub3dLoadStage = "three";
    step(0.12, "three");
    await import(THREE_MODULE_URL);                          // milestone 1: three.js
    step(0.45, "hub_module");
    const mod = await import("./jumvi-hub-app.js?v=20260813-9"); // play-first mobile hub UX + deployed Leo model
    step(0.72, "init");
    const container = document.getElementById("hub3dOverlay");
    _hub3dInstance = mod.initHub3D({
      // milestone 4: dismiss the loading overlay on the first PAINTED frame
      // (decorative GLBs may keep streaming after this — we don't block on them)
      onFirstFrame(){
        step(1, "frame");
        beaconOnce("hub3d_ready", "hub3d", { step: "ready" });
      },
      // Task 3 — one-time Coach Leo greeting. The hub owns the bubbles (anchored
      // to Leo, tied to the first walk); app.js only lends the Web Speech util
      // and the persisted intro flag (via lsGet/lsSet).
      coachSpeak,
      hubIntroDone(){ return lsGet(HUB_INTRO_KEY, "0") === "1"; },
      markHubIntroDone(){ lsSet(HUB_INTRO_KEY, "1"); },
      // Hub stars: the hub owns the gameplay, app.js owns the key — same split
      // as the intro flag, so every localStorage name still lives in one file.
      hubStarsGet(){ return lsGet(HUB_STARS_KEY, ""); },
      hubStarsSet(csv){ lsSet(HUB_STARS_KEY, csv); },
      // The chosen age band is not persisted anywhere — only the difficulty it
      // maps to is. "Easy" is the 3-5 band; the obstacle course reads this to
      // stay out of the youngest band's way. See the note in jumvi-hub-app.js.
      hubAgeDifficulty(){ return currentDifficulty; },
      PACKS, missions, done, openMission, container,
      // Bridges into EXISTING app flows — the hub triggers them, never
      // reimplements them: the real certificate modal, the real daily pick,
      // and the single app-wide sound setting (no second mute concept).
      openCertificate,
      getDailyMissionId(){ return dailyIdStored; },
      isSoundOn(){ return soundOn; },
      setSoundOn(v){
        soundOn = !!v;
        lsSet(SOUND_KEY, soundOn ? "1" : "0");
        if(!soundOn && window.CoachLeoAudio) window.CoachLeoAudio.stop();
        window.JumviMusic?.setEnabled(soundOn);
      },
      // In-hub menu bridges — the hub menu opens the app's REAL panels
      // (it never reimplements them). navigate() leaves the hub for a normal
      // tab; openBadges() pops the existing badges modal on top of the hub.
      navigate(tab){ switchTab(tab); },
      openBadges(){ if(typeof updateBadges === "function") updateBadges(); badgesBackdrop.classList.add("show"); },
      // Analytics bridge — the hub had ZERO Plausible events (audit Bulgu #20),
      // so the default-homepage A/B couldn't be read. The hub fires its own
      // events (3d_load_ms, 3d_first_mission_start, 3d_fallback_triggered)
      // through this; app.js owns the actual trackEvent() call.
      track(name, props){
        trackEvent(name, props);
        // The hub reports its own first completed walk; that is "moved" — proof
        // the child understood the controls, not just that the scene loaded.
        if(name === "Hub3D First Walk") beaconOnce("hub3d_moved", "hub3d", { step: "moved" });
      },
      // Soft FPS fallback (audit Bulgu #5): the hub already walks down its
      // quality ladder automatically. Keep that adaptation silent — a vague
      // "running slow" toast interrupts the child's first task without giving
      // them a useful action, while the always-visible Menu remains the escape
      // hatch to the lightweight mission list.
      onLowFps: (fps) => {
        if(window.__hub3dLowFpsNudged) return;
        window.__hub3dLowFpsNudged = true;
        trackEvent("Hub3D Low FPS", { fps: String(fps || 0), response: "silent_quality_fallback" });
      }
    });
    step(0.85, "init"); // milestone 3: initHub3D() built the scene; first frame paints after resume()
  })();
  return _hub3dLoadPromise;
}

// WebGL feature-detect only (Task 1). Slow-but-capable devices aren't blocked
// here — the load overlay + the in-hub FPS nudge handle them at runtime.
function hub3dWebGLOk(){
  try{
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  }catch(_){ return false; }
}
const HUB3D_UNSUPPORTED_KEY = "jumvi_hub3d_unsupported_v1";
// Once a device is known to lack WebGL, hide BOTH hub entry points for good.
function applyHub3dUnsupported(){
  const card = document.getElementById("advModeCard");
  if(card) card.style.display = "none";
}
let _hub3dEntrySource = "nav_tab"; // set by the entry handlers before switchTab("hub3d")

// Task 5 — "rest" Leo after 45s idle inside the hub (Silent Mode screen does
// not exist in this build, so idle is the only trigger). Any input re-arms the
// 45s timer; rest fires once per idle stretch (no nagging), low-opacity + silent.
let _hubIdleTimer = null;
function _hubIdleReset(){
  if(_hubIdleTimer) clearTimeout(_hubIdleTimer);
  _hubIdleTimer = setTimeout(()=>{
    if(document.body.classList.contains("tab-hub3d") && !document.hidden){
      showLeoReaction("rest", "", { corner: "right" });
    }
  }, 45000);
}
function startHubIdleWatch(){
  stopHubIdleWatch();
  ["pointerdown","keydown","touchstart"].forEach(ev=> document.addEventListener(ev, _hubIdleReset, true));
  _hubIdleReset();
}
function stopHubIdleWatch(){
  if(_hubIdleTimer){ clearTimeout(_hubIdleTimer); _hubIdleTimer = null; }
  ["pointerdown","keydown","touchstart"].forEach(ev=> document.removeEventListener(ev, _hubIdleReset, true));
}

// ---- Coach Leo 2D expression sprites (assets/leo/*) ----
// Served via <picture>: WebP source + PNG fallback. 256px file for corners/
// inline/bubbles, 512px for large/modal. `px` picks the FILE; `display` is the
// on-screen CSS width (never upscaled beyond native).
const LEO_ASSET_V = "20260717-1";
function leoPictureHTML(expr, px, display, alt, extraStyle){
  const base = `assets/leo/leo-${expr}-${px}`;
  const w = display || (px === 512 ? 120 : 84);
  const style = `width:${w}px;height:auto;display:block;${extraStyle||""}`;
  return '<picture>' +
    `<source srcset="${base}.webp?v=${LEO_ASSET_V}" type="image/webp">` +
    `<img src="${base}.png?v=${LEO_ASSET_V}" alt="${alt||""}" width="${px}" height="${px}" style="${style}" decoding="async">` +
    '</picture>';
}

// ---- Coach Leo 2D expression reactions (Task 5) ----
// One reusable, NON-BLOCKING corner mascot. Rules:
//  • Never two at once. "celebrate" preempts anything; any other expression is
//    dropped while a reaction (of equal-or-higher priority) is already showing.
//  • The sprite layer is pointer-events:none, so it NEVER eats a gameplay tap.
//  • "Skippable by tap": a document-level pointerdown dismisses the current
//    reaction — the tap still passes through the layer to whatever's beneath.
//  • prefers-reduced-motion → fade only, no pop/slide.
//  • Visual-only: coachSpeak is used ONLY if opts.speak is explicitly set
//    (Task 3 greeting owns speech; Task 5 reactions are silent by default).
const LEO_REACTION_MS = { celebrate: 3400, encourage: 2200, guide: 3800, gentle: 3200, rest: 4200 };
function _leoPriority(expr){ return expr === "celebrate" ? 2 : 1; }
let _leoReactionEl = null, _leoReactionExpr = null, _leoReactionTimer = null, _leoDismissHandler = null;

function dismissLeoReaction(){
  if(_leoReactionTimer){ clearTimeout(_leoReactionTimer); _leoReactionTimer = null; }
  if(_leoDismissHandler){ document.removeEventListener("pointerdown", _leoDismissHandler, true); _leoDismissHandler = null; }
  const el = _leoReactionEl; _leoReactionEl = null; _leoReactionExpr = null;
  if(!el) return;
  el.style.opacity = "0";
  el.style.transform = el.dataset.reduced === "1" ? "none" : "translateY(10px)";
  setTimeout(()=>{ if(el && el.parentNode) el.parentNode.removeChild(el); }, 320);
}

function showLeoReaction(expression, message, opts){
  opts = opts || {};
  if(["celebrate","encourage","guide","gentle","rest"].indexOf(expression) < 0) return;
  // Never two at once. Celebrate preempts a lower/equal reaction; otherwise the
  // newcomer is simply dropped (one-shot, must never queue up and nag).
  if(_leoReactionEl){
    if(_leoPriority(expression) <= _leoPriority(_leoReactionExpr)) return;
    dismissLeoReaction();
  }
  const reduced = !!prefersReducedMotion;
  const px = opts.size === 512 ? 512 : 256;
  const display = opts.display || (px === 512 ? 124 : 92);
  const corner = opts.corner === "right" ? "right" : "left"; // left clears the top-right profile pill
  const lowOpacity = expression === "rest";

  const layer = document.createElement("div");
  layer.className = "leoReactionLayer";
  layer.dataset.reduced = reduced ? "1" : "0";
  layer.style.cssText =
    "position:fixed;z-index:2147482000;pointer-events:none;" +
    (corner === "right" ? "right:14px;align-items:flex-end;" : "left:14px;align-items:flex-start;") +
    // sits ABOVE the 2D bottom nav / hub bottom bar so Leo never overlaps them
    "bottom:calc(78px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:8px;" +
    "opacity:0;transition:opacity 300ms ease,transform 300ms cubic-bezier(.34,1.56,.64,1);" +
    "transform:" + (reduced ? "none" : "translateY(12px)") + ";";

  if(message){
    const bubble = document.createElement("div");
    bubble.style.cssText = "max-width:210px;background:#fff;border:1px solid rgba(120,150,180,0.18);" +
      "box-shadow:0 8px 22px rgba(18,38,66,0.22);border-radius:16px;padding:9px 13px;font-size:14px;" +
      "font-weight:800;color:#2c3a4d;line-height:1.3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
    bubble.textContent = message;
    layer.appendChild(bubble);
  }
  const spriteWrap = document.createElement("div");
  spriteWrap.style.cssText = "filter:drop-shadow(0 6px 12px rgba(20,60,90,0.22));" +
    (lowOpacity ? "opacity:0.82;" : "") + (reduced ? "" : "animation:leoReactPop 480ms cubic-bezier(.34,1.56,.64,1);");
  spriteWrap.innerHTML = leoPictureHTML(expression, px, display, "Coach Leo");
  layer.appendChild(spriteWrap);
  document.body.appendChild(layer);

  if(!document.getElementById("leoReactStyle")){
    const s = document.createElement("style");
    s.id = "leoReactStyle";
    s.textContent = "@keyframes leoReactPop{0%{transform:scale(.6)}60%{transform:scale(1.08)}100%{transform:scale(1)}}" +
      "@media (prefers-reduced-motion: reduce){.leoReactionLayer *{animation:none !important}}";
    document.head.appendChild(s);
  }
  void layer.offsetWidth; // reflow → animate in
  layer.style.opacity = "1";
  layer.style.transform = "none";

  _leoReactionEl = layer; _leoReactionExpr = expression;
  if(message && opts.speak && typeof coachSpeak === "function"){ try { coachSpeak(message); } catch(_){} }
  trackEvent("Leo Reaction Shown", { expression });

  _leoReactionTimer = setTimeout(dismissLeoReaction, opts.ms || LEO_REACTION_MS[expression] || 3000);
  // Bind the tap-to-skip on the NEXT frame so the very tap that triggered this
  // reaction (e.g. "Mark as Done") doesn't instantly dismiss it.
  setTimeout(()=>{
    if(_leoReactionEl !== layer) return;
    _leoDismissHandler = ()=> dismissLeoReaction();
    document.addEventListener("pointerdown", _leoDismissHandler, true);
  }, 400);
}
window.showLeoReaction = showLeoReaction; // the hub module bridges into this

// ---- Hub loading overlay (pure DOM; shown synchronously before any import) ----
let _hubLoadingEl = null, _hubLoadingLine2Timer = null, _hubLoaderDelayTimer = null;
function buildHubLoadingOverlay(container){
  if(_hubLoadingEl) return _hubLoadingEl;
  const el = document.createElement("div");
  el.id = "hub3dLoading";
  el.style.cssText = "position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;background:linear-gradient(180deg,#bfe3ff,#eaf7ff);transition:opacity 300ms ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
  el.innerHTML =
    // §4.2 — escape hatch: leave the wait and go back to the missions. The load
    // keeps running (cached), so re-entry is instant.
    '<button id="hub3dLoadEscape" type="button" aria-label="Back to missions" style="position:absolute;top:calc(12px + env(safe-area-inset-top));left:calc(12px + env(safe-area-inset-left));min-height:44px;padding:9px 15px;border:none;border-radius:16px;background:rgba(255,255,255,0.9);color:#2a5a7a;font-size:14px;font-weight:900;cursor:pointer;box-shadow:0 3px 10px rgba(20,60,90,0.2);z-index:2;">← Missions</button>' +
    '<div style="filter:drop-shadow(0 6px 12px rgba(20,60,90,0.22));animation:hub3dLeoFloat 2.2s ease-in-out infinite;">' +
      leoPictureHTML("encourage", 256, 96, "Coach Leo") +
    '</div>' +
    '<div style="font-size:20px;font-weight:900;color:#2a5a7a;">Opening the first play zone…</div>' +
    '<div id="hub3dLoadLine2" style="font-size:14px;font-weight:700;color:#4a7a9a;max-width:280px;opacity:0;transition:opacity 400ms ease;">Taking longer? Missions are always ready from the button above.</div>' +
    '<div style="width:min(72%,260px);height:10px;background:rgba(255,255,255,0.6);border-radius:6px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.12);">' +
      '<div id="hub3dLoadBar" style="width:8%;height:100%;background:linear-gradient(90deg,#4fc46a,#35a04e);border-radius:6px;transition:width 350ms ease;"></div>' +
    '</div>';
  if(!document.getElementById("hub3dLeoFloatStyle")){
    const s = document.createElement("style");
    s.id = "hub3dLeoFloatStyle";
    s.textContent = "@keyframes hub3dLeoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}" +
      "@media (prefers-reduced-motion: reduce){[style*='hub3dLeoFloat']{animation:none !important}}";
    document.head.appendChild(s);
  }
  container.appendChild(el);
  _hubLoadingEl = el;
  // §4.2 — escape ✕ → leave the wait for the missions (load continues in bg).
  const esc = document.getElementById("hub3dLoadEscape");
  if(esc) esc.onclick = ()=>{ trackEvent("Hub3D Load Escaped", { stage: _hub3dLoadStage }); beaconOnce("hub3d_escaped", "hub3d", { step: "escaped" }); dismissHubLoadingOverlay(); switchTab("today"); };
  // Line 2 only appears if we're still loading after 3s (fast loads never show it).
  _hubLoadingLine2Timer = setTimeout(()=>{ const l2 = document.getElementById("hub3dLoadLine2"); if(l2) l2.style.opacity = "1"; }, 3000);
  return el;
}
function setHubLoadingProgress(frac){
  const bar = document.getElementById("hub3dLoadBar");
  if(bar) bar.style.width = Math.max(8, Math.round(frac*100)) + "%";
}
function dismissHubLoadingOverlay(){
  if(_hubLoaderDelayTimer){ clearTimeout(_hubLoaderDelayTimer); _hubLoaderDelayTimer = null; }
  if(_hubLoadingLine2Timer){ clearTimeout(_hubLoadingLine2Timer); _hubLoadingLine2Timer = null; }
  const el = _hubLoadingEl; _hubLoadingEl = null;
  if(!el) return;
  el.style.opacity = "0";
  setTimeout(()=>{ el.remove(); }, 320);
}
function showHubLoadingFailure(container, stage){
  trackEvent("Hub3D Load Failed", { stage: stage || "import" });
  beaconOnce("hub3d_failed", "hub3d", { step: "failed" });
  if(_hubLoaderDelayTimer){ clearTimeout(_hubLoaderDelayTimer); _hubLoaderDelayTimer = null; }
  if(_hubLoadingLine2Timer){ clearTimeout(_hubLoadingLine2Timer); _hubLoadingLine2Timer = null; }
  const el = _hubLoadingEl || buildHubLoadingOverlay(container);
  el.style.opacity = "1";
  el.innerHTML =
    '<div style="filter:drop-shadow(0 6px 12px rgba(20,60,90,0.22));">' +
      leoPictureHTML("gentle", 256, 92, "Coach Leo") +
    '</div>' +
    '<div style="font-size:20px;font-weight:900;color:#2a5a7a;">The island got lost!</div>' +
    '<div style="font-size:14px;font-weight:700;color:#4a7a9a;max-width:260px;">Check your connection and try again.</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px;">' +
      '<button id="hub3dRetryBtn" style="border:none;border-radius:14px;background:linear-gradient(180deg,#4fc46a,#35a04e);color:#fff;font-size:15px;font-weight:900;padding:11px 18px;cursor:pointer;box-shadow:0 3px 0 #27793a;">Try again</button>' +
      '<button id="hub3dBackBtn" style="border:none;border-radius:14px;background:rgba(255,255,255,0.85);color:#2a5a7a;font-size:15px;font-weight:800;padding:11px 18px;cursor:pointer;">Back to missions</button>' +
    '</div>';
  const retry = document.getElementById("hub3dRetryBtn");
  if(retry) retry.onclick = ()=>{ _hub3dLoadPromise = null; if(_hubLoadingEl){ _hubLoadingEl.remove(); _hubLoadingEl = null; } showHub3D(); };
  const back = document.getElementById("hub3dBackBtn");
  if(back) back.onclick = ()=>{ if(_hubLoadingEl){ _hubLoadingEl.remove(); _hubLoadingEl = null; } switchTab("today"); };
}

// The hub lives inside #app-wrapper so it can out-stack the app's modals, which
// means aria-hiding the wrapper itself would also hide the hub. Isolate only the
// page chrome/content behind it and leave the real mission/badge/certificate
// dialogs available — those are intentionally opened from inside the island.
let _hubBackgroundRestore = null;
let _hubReturnFocus = null;
const HUB_BACKGROUND_SELECTORS = [
  "#app-wrapper > .sticky",
  "#app-wrapper > .wrap",
  "#offlineBanner",
  "#undoBar",
  "#seasonalBackdrop",
  "#privacyBackdrop",
  "#profileBackdrop",
  "#tutorialOverlay",
  "#bottomNav",
  "#soundToggle",
  "#saveOverlay",
  "#fallbackBackdrop"
];
function setHubBackgroundIsolation(active){
  const overlay = document.getElementById("hub3dOverlay");
  if(active){
    if(!_hubBackgroundRestore){
      _hubReturnFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
      const seen = new Set();
      _hubBackgroundRestore = HUB_BACKGROUND_SELECTORS
        .map(sel => document.querySelector(sel))
        .filter(el => el && !seen.has(el) && seen.add(el))
        .map(el => ({
          el,
          inert: !!el.inert,
          hadInert: el.hasAttribute("inert"),
          ariaHidden: el.getAttribute("aria-hidden")
        }));
      _hubBackgroundRestore.forEach(state => {
        state.el.inert = true;
        state.el.setAttribute("inert", "");
        state.el.setAttribute("aria-hidden", "true");
      });
    }
    if(overlay){
      overlay.setAttribute("aria-hidden", "false");
      requestAnimationFrame(()=>{ try{ overlay.focus({ preventScroll:true }); }catch(_){ overlay.focus(); } });
    }
    return;
  }

  if(overlay) overlay.setAttribute("aria-hidden", "true");
  if(_hubBackgroundRestore){
    _hubBackgroundRestore.forEach(state => {
      state.el.inert = state.inert;
      if(state.hadInert) state.el.setAttribute("inert", "");
      else state.el.removeAttribute("inert");
      if(state.ariaHidden == null) state.el.removeAttribute("aria-hidden");
      else state.el.setAttribute("aria-hidden", state.ariaHidden);
    });
    _hubBackgroundRestore = null;
  }
  const returnFocus = _hubReturnFocus;
  _hubReturnFocus = null;
  if(returnFocus && returnFocus.isConnected && returnFocus.getClientRects().length){
    try{ returnFocus.focus({ preventScroll:true }); }catch(_){ }
  }
}

function setHubDialogIsolation(open){
  const overlay = document.getElementById("hub3dOverlay");
  if(!overlay) return;
  overlay.inert = !!open;
  if(open){
    overlay.setAttribute("inert", "");
    overlay.setAttribute("aria-hidden", "true");
  }else{
    overlay.removeAttribute("inert");
    overlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(()=>{ try{ overlay.focus({ preventScroll:true }); }catch(_){ } });
  }
}

function showHub3D(){
  const overlay = document.getElementById("hub3dOverlay");
  // WebGL gate (Task 1): no WebGL → this device can't run the hub. Mark it
  // unsupported, hide both entry points, stay in the 2D list.
  if(!hub3dWebGLOk()){
    lsSet(HUB3D_UNSUPPORTED_KEY, "1");
    applyHub3dUnsupported();
    showToast("Adventure Mode needs a newer device — missions still work great!");
    switchTab("today");
    return;
  }
  window.__hub3dLoadStart = performance.now();
  window.__hub3dSessionStart = performance.now();
  trackEvent("Hub3D Entered", { source: _hub3dEntrySource });
  // Step 2 of 7. "shown" fired earlier, when the entry point was offered —
  // the gap between them is how many kids see the hub and never tap it.
  beaconOnce("hub3d_entered", "hub3d", { step: "entered" });
  _hub3dEntrySource = "nav_tab"; // reset default for the next open (deep link etc.)
  if(overlay) overlay.style.display = "";
  setHubBackgroundIsolation(true);
  const sticky = document.querySelector(".sticky");
  if(sticky) sticky.style.display = "none";
  const bottomNav = document.getElementById("bottomNav");
  if(bottomNav) bottomNav.style.display = "none";
  // §4.2 — loading overlay, but delayed 300ms so a fast connection never flashes
  // it. If the hub finishes (or is already cached) within 300ms, the timer is
  // cleared and the loader never appears. Re-opens (cached instance) skip it.
  if(!_hub3dInstance && overlay){
    _hubLoaderDelayTimer = setTimeout(()=>{
      _hubLoaderDelayTimer = null;
      if(!_hub3dInstance) buildHubLoadingOverlay(overlay);
    }, 300);
  }
  // Safety net: if no first frame ever paints (stuck, not a reject), show the
  // friendly failure UI rather than an endless progress bar. A hidden tab
  // (locked phone, app switch) legitimately stops requestAnimationFrame — no
  // frames is NORMAL there, so re-arm instead of firing a false failure.
  const _openedAt = performance.now();
  const _frameCheck = ()=>{
    if(!(_hubLoadingEl && overlay && overlay.style.display !== "none")) return;
    if(document.hidden){ setTimeout(_frameCheck, 5000); return; }
    const painted = window.__hub3dLastFrameAt && window.__hub3dLastFrameAt >= _openedAt;
    if(!painted) showHubLoadingFailure(overlay, "frame_timeout");
  };
  setTimeout(_frameCheck, 15000);
  ensureHub3DLoaded((frac)=>{
    setHubLoadingProgress(frac);
    if(frac >= 1) dismissHubLoadingOverlay();
  }).then(() => {
    // Loading is async — only start rendering if hub3d is still the visible tab.
    if(_hub3dInstance && overlay && overlay.style.display !== "none"){
      _hub3dInstance.resume();
      startHubIdleWatch(); // Task 5 — begin the 45s idle → "rest" Leo watch
    }
  }).catch(e => {
    console.warn("3D Hub failed to load:", e);
    _hub3dLoadPromise = null; // let "Try again" re-run the import
    if(overlay) showHubLoadingFailure(overlay, _hub3dLoadStage);
  });
}

function hideHub3D(){
  const overlay = document.getElementById("hub3dOverlay");
  if(overlay) overlay.style.display = "none";
  setHubBackgroundIsolation(false);
  const sticky = document.querySelector(".sticky");
  if(sticky) sticky.style.display = "";
  const bottomNav = document.getElementById("bottomNav");
  if(bottomNav) bottomNav.style.display = ""; // restore global nav on leaving the hub
  fireHub3DExited();
  if(_hub3dInstance) _hub3dInstance.pause();
}

// "Hub3D Exited" — how long the kid spent in the hub this visit, bucketed.
// Fires once per session (nulls the stopwatch) from both hideHub3D (tab switch
// away) and pagehide (closing/backgrounding while still in the hub).
function fireHub3DExited(){
  if(!window.__hub3dSessionStart) return;
  const secs = Math.round((performance.now() - window.__hub3dSessionStart) / 1000);
  window.__hub3dSessionStart = null;
  trackEvent("Hub3D Exited", { duration: secs < 30 ? "<30s" : secs < 120 ? "30-120s" : secs < 300 ? "2-5m" : "5m+" });
}
window.addEventListener("pagehide", fireHub3DExited);
document.addEventListener("visibilitychange", ()=>{
  if(document.hidden){
    cancelTimerCountdown();
    if(_missionNarrationWatchdog) clearTimeout(_missionNarrationWatchdog);
    _missionNarrationWatchdog = null;
    _missionNarrationToken++;
    _missionNarrationPending = false;
    _missionNarratedId = 0;
    if(_modeNarrationWatchdog) clearTimeout(_modeNarrationWatchdog);
    _modeNarrationWatchdog = null;
    _modeNarrationToken++;
    _modeNarrationPending = false;
    updateModeStartLabel();
    if(timerState === "idle") setTimerButtonLabel();
    if(timerState === "running") pauseTimer();
    if(_modeTimerState === "running") pauseModeTimer();
    try{
      if(window.JumviRedLight && typeof window.JumviRedLight.isActive === "function" && window.JumviRedLight.isActive()){
        window.JumviRedLight.stop();
      }
    }catch(_){ }
    if("speechSynthesis" in window) window.speechSynthesis.cancel();
    if(window.CoachLeoAudio) window.CoachLeoAudio.stop();
  }
});

function switchTab(tabName){
  if(!tabName) tabName = "today";
  const validTabs = ["today","browse","modes","stats","profile"];
  if(isHub3DEnabled()) validTabs.push("hub3d");
  if(!validTabs.includes(tabName)) tabName = "today";

  // Tab panel görünürlüğü
  document.querySelectorAll(".tabPanel").forEach(p => {
    p.style.display = (p.dataset.tab === tabName) ? "" : "none";
  });

  // Bottom nav aktif state
  document.querySelectorAll(".navTab").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });

  // The dashboard lives in the "stats" tab — the parent-facing view.
  if(tabName === "stats") beaconOnce("dashboard_open", "dashboard_open");

  // 3D Hub — opt-in deneysel görünüm; diğer tab'lar bu satırdan etkilenmez
  if(tabName === "hub3d") showHub3D(); else hideHub3D();

  // Body class — mission list ve footer görünürlüğü için
  document.body.classList.remove("tab-today","tab-browse","tab-modes","tab-stats","tab-profile","tab-hub3d");
  document.body.classList.add("tab-" + tabName);

  // Tab içine özel render'lar (defensive — herhangi bir hata sayfayı bozmasın)
  try {
    if(tabName === "profile") renderProfileTab();
    if(tabName === "today") {
      renderContinueHint();
      renderDailyChallenge();
      renderCoachPick();
    }
    if(tabName === "stats") {
      // Badge, dashboard and progress render only when this tab is opened.
      if(typeof updateProgress === "function") updateProgress();
      if(typeof renderFamilyInsights === "function") renderFamilyInsights();
    }
    if(tabName === "browse") {
      // Path her zaman renderlanir (her tab acilis'ta done state guncel olsun)
      if(typeof renderMissionPath === "function"){
        renderMissionPath();
      }
    }
    if(tabName === "modes" && typeof renderPlayModes === "function") renderPlayModes();
  } catch(e) {
    console.warn("Tab render error:", e);
  }

  // Tab değişince scroll'u en üste al
  try {
    const wrap = document.getElementById("app-wrapper");
    if(wrap) wrap.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "auto" });
  } catch(_){}

  // The island is a temporary bonus view, never the QR return destination.
  try { lsSet(NAV_TAB_KEY, tabName === "hub3d" ? "today" : tabName); } catch(_){}

  trackEvent("Tab Switched", { tab: tabName });
}

function renderProfileTab(){
  const ap = getActiveProfile();
  if(!ap) return;
  const avatarEl = document.getElementById("profileCardAvatar");
  const nameEl   = document.getElementById("profileCardName");
  const statsEl  = document.getElementById("profileCardStats");
  if(avatarEl) avatarEl.innerHTML = JUMVI_ART.img(JUMVI_ART.avatar(ap.avatar), "avatarArt", "", true);
  if(nameEl)   nameEl.textContent   = ap.name   || "Player";
  if(statsEl){
    const total = done.size;
    statsEl.textContent = `${total} mission${total===1?"":"s"} complete`;
  }
  // Daily reminder kaldirildi
}

/** =======================
 * Repeatable Play Modes
 * Separate data, separate dialog, and intentionally no writes to `done`,
 * badges, streaks, certificates, or the mission analytics funnel.
 * ======================= */
let _playModeGroup = "solo";
let _openPlayMode = null;
let _modeReturnFocus = null;
let _modeTimerInterval = null;
let _modeTimerState = "idle";
let _modeTimerLeft = 0;
let _modeTimerEndAt = 0;
let _modeCoachOn = true;
let _modeCueFired = new Set();
let _modeNarrationPending = false;
let _modeNarrationToken = 0;
let _modeNarrationWatchdog = null;

function playModeLocale(){ return window.__JUMVI_LOCALE === "tr-TR" ? "tr" : "en"; }
function modeText(value){
  if(value == null) return "";
  if(typeof value === "string") return value;
  const locale = playModeLocale();
  return value[locale] || value.en || value.tr || "";
}
function getPlayModes(group=_playModeGroup){
  const all = Array.isArray(window.JUMVI_PLAY_MODES) ? window.JUMVI_PLAY_MODES : [];
  return all.filter(mode=>mode && mode.group === group);
}
function renderPlayModes(){
  const grid = document.getElementById("modeGrid");
  if(!grid) return;
  document.querySelectorAll(".modeFilter").forEach(btn=>{
    const active = btn.dataset.modeGroup === _playModeGroup;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
  const modes = getPlayModes();
  grid.innerHTML = modes.map(mode=>`
    <button class="modeCard" type="button" data-mode-id="${escapeHtml(mode.id)}" aria-label="${escapeHtml(modeText(mode.title))}">
      <span class="modeCardVisual jmv" aria-hidden="true">${modeIcon(mode.id)}</span>
      <span class="modeCardBody">
        <span class="modeCardKicker">REPEAT ANYTIME</span>
        <span class="modeCardTitle">${escapeHtml(modeText(mode.title))}</span>
        <span class="modeCardMeta">${escapeHtml(modeText(mode.players.label))} · ${escapeHtml(modeGearLabel(mode))} · ${escapeHtml(modeDurationLabel(mode.seconds))}</span>
        <span class="modeCardGoal">${escapeHtml(modeText(mode.goal))}</span>
      </span>
      <span class="modeCardArrow" aria-hidden="true">›</span>
    </button>`).join("");
  grid.querySelectorAll(".modeCard").forEach(card=>{
    card.addEventListener("click", ()=>{
      const mode = (window.JUMVI_PLAY_MODES || []).find(x=>x.id === card.dataset.modeId);
      if(mode){ clickSound("click"); openPlayMode(mode, card); }
    });
  });
}

/* Every Play Mode card and sheet used to show the same two product photos, so
 * nine different games looked identical. These are the per-mode motion
 * diagrams from play-mode-icons.js, drawn in the same language as the mission
 * diagrams. Returns "" when the file is absent so the card degrades to text
 * rather than breaking. */
function modeIcon(id){
  return (window.JUMVI_PLAY_MODE_ICONS && window.JUMVI_PLAY_MODE_ICONS[id]) || "";
}
function modeGearLabel(mode){
  if(mode.gear && mode.gear.label) return modeText(mode.gear.label);
  const p = Number(mode.gear && mode.gear.paddles || 0);
  const b = Number(mode.gear && mode.gear.balls || 0);
  if(playModeLocale() === "tr") return `${p} paddle + ${b} top`;
  return `${p} paddle${p===1?"":"s"} + ${b} ball${b===1?"":"s"}`;
}
function modeDurationLabel(seconds){ return playModeLocale() === "tr" ? `${seconds}sn` : `${seconds}s`; }
function updateModeStartLabel(){
  const btn = document.getElementById("btnModeStart");
  if(!btn) return;
  const icon = _modeTimerState === "running" ? "jic-pause" : "jic-play";
  const label = _modeTimerState === "running" ? "Pause" : (_modeTimerState === "paused" ? "Resume" : "Start");
  btn.innerHTML = `<i class="jic ${icon}" aria-hidden="true"></i> ${label}`;
}
function cancelModeTimer({reset=true}={}){
  if(_modeNarrationWatchdog) clearTimeout(_modeNarrationWatchdog);
  _modeNarrationWatchdog = null;
  if(_modeTimerInterval) clearInterval(_modeTimerInterval);
  _modeTimerInterval = null;
  _modeNarrationPending = false;
  _modeNarrationToken++;
  releaseWakeLock();
  if(reset){
    _modeTimerState = "idle";
    _modeTimerLeft = _openPlayMode ? _openPlayMode.seconds : 0;
    _modeTimerEndAt = 0;
    _modeCueFired = new Set();
    const timer = document.getElementById("modeTimer");
    const display = document.getElementById("modeTimerDisplay");
    const fill = document.getElementById("modeTimerFill");
    if(timer) timer.hidden = true;
    if(display) display.textContent = modeDurationLabel(_modeTimerLeft || 0);
    if(fill){ fill.style.transition = "none"; fill.style.width = "100%"; }
  }
  updateModeStartLabel();
}
function speakModeCue(value){
  const text = modeText(value);
  if(_modeCoachOn && text && !document.hidden) coachSpeak(text, { rate:0.96, pitch:1.02 });
}
function modeElapsedSeconds(mode){ return Math.max(0, mode.seconds - _modeTimerLeft); }
function tickModeTimer(){
  if(_modeTimerState !== "running" || !_openPlayMode) return;
  const mode = _openPlayMode;
  _modeTimerLeft = Math.max(0, Math.ceil((_modeTimerEndAt - Date.now()) / 1000));
  const display = document.getElementById("modeTimerDisplay");
  if(display) display.textContent = _modeTimerLeft > 0 ? modeDurationLabel(_modeTimerLeft) : (playModeLocale() === "tr" ? "Süre doldu!" : "Time's up!");
  const elapsed = modeElapsedSeconds(mode);
  const voice = mode.voice || {};
  const cues = [];
  if(voice.mid && Number.isFinite(Number(voice.mid.at))) cues.push({ key:"mid", at:Number(voice.mid.at), text:voice.mid.text });
  if(voice.final && Number.isFinite(Number(voice.final.remaining))) cues.push({ key:"final", at:mode.seconds - Number(voice.final.remaining), text:voice.final.text });
  (voice.orchestratedCues || []).forEach((cue,index)=>cues.push({ key:`cue-${index}`, at:Number(cue.at), text:cue.text }));
  cues.sort((a,b)=>a.at-b.at).forEach(cue=>{
    if(_modeCueFired.has(cue.key) || elapsed < cue.at) return;
    _modeCueFired.add(cue.key);
    speakModeCue(cue.text);
  });
  if(_modeTimerLeft <= 0){
    if(_modeTimerInterval) clearInterval(_modeTimerInterval);
    _modeTimerInterval = null;
    _modeTimerState = "idle";
    releaseWakeLock();
    updateModeStartLabel();
  }
}
function startModeTimer(){
  const modeBackdropEl = document.getElementById("modeBackdrop");
  if(!_openPlayMode || !modeBackdropEl?.classList.contains("show") || document.hidden) return;
  const mode = _openPlayMode;
  const timer = document.getElementById("modeTimer");
  const fill = document.getElementById("modeTimerFill");
  if(timer) timer.hidden = false;
  _modeTimerState = "running";
  _modeNarrationPending = false;
  _modeTimerLeft = mode.seconds;
  _modeTimerEndAt = Date.now() + mode.seconds * 1000;
  _modeCueFired = new Set();
  if(fill){
    fill.style.transition = "none";
    fill.style.width = "100%";
    void fill.offsetWidth;
    fill.style.transition = `width ${mode.seconds}s linear`;
    fill.style.width = "0%";
  }
  updateModeStartLabel();
  requestWakeLock();
  // The single point where a Quick Play activity actually begins. Pause and
  // Resume have their own functions, and the Start handler only reaches
  // narrateModeThenStart() while the timer is idle — so one real start emits
  // one event, and a double tap during narration lands on the skip branch,
  // which calls this once. Records the mode id only; nothing here touches
  // `done`, badges, streaks or the certificate, and check-play-modes.mjs
  // keeps it that way.
  beacon("quickplay_start", { mode: mode.id });
  _modeTimerInterval = setInterval(tickModeTimer, 200);
}
function narrateModeThenStart(mode){
  const intro = modeText(mode && mode.voice && mode.voice.intro);
  if(!_modeCoachOn || !soundOn || !intro || !("speechSynthesis" in window)){
    startModeTimer();
    return;
  }
  const btn = document.getElementById("btnModeStart");
  if(btn) btn.innerHTML = '<i class="jic jic-play" aria-hidden="true"></i> Skip & Play';
  _modeNarrationPending = true;
  const token = ++_modeNarrationToken;
  let finished = false;
  const doneOnce = ()=>{
    if(finished || token !== _modeNarrationToken) return;
    finished = true;
    _modeNarrationPending = false;
    startModeTimer();
  };
  _modeNarrationWatchdog = setTimeout(doneOnce, Math.min(18000, Math.max(8000, intro.length * 75)));
  try{
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(intro);
    utter.lang = "en-US"; utter.rate = 0.96; utter.pitch = 1.02; utter.volume = 1;
    if(kidVoice) utter.voice = kidVoice;
    utter.onend = ()=>{ clearTimeout(_modeNarrationWatchdog); _modeNarrationWatchdog = null; doneOnce(); };
    utter.onerror = ()=>{ clearTimeout(_modeNarrationWatchdog); _modeNarrationWatchdog = null; doneOnce(); };
    window.speechSynthesis.speak(utter);
  }catch(_){ clearTimeout(_modeNarrationWatchdog); _modeNarrationWatchdog = null; doneOnce(); }
}
function pauseModeTimer(){
  if(_modeTimerState !== "running") return;
  _modeTimerLeft = Math.max(0, Math.ceil((_modeTimerEndAt - Date.now()) / 1000));
  if(_modeTimerInterval) clearInterval(_modeTimerInterval);
  _modeTimerInterval = null;
  _modeTimerState = "paused";
  releaseWakeLock();
  if("speechSynthesis" in window) window.speechSynthesis.cancel();
  const fill = document.getElementById("modeTimerFill");
  if(fill && _openPlayMode){
    fill.style.transition = "none";
    fill.style.width = `${Math.max(0,(_modeTimerLeft/_openPlayMode.seconds)*100)}%`;
  }
  updateModeStartLabel();
}
function resumeModeTimer(){
  if(_modeTimerState !== "paused" || !_openPlayMode) return;
  _modeTimerState = "running";
  _modeTimerEndAt = Date.now() + _modeTimerLeft * 1000;
  const fill = document.getElementById("modeTimerFill");
  if(fill){
    fill.style.transition = "none";
    fill.style.width = `${Math.max(0,(_modeTimerLeft/_openPlayMode.seconds)*100)}%`;
    void fill.offsetWidth;
    fill.style.transition = `width ${_modeTimerLeft}s linear`;
    fill.style.width = "0%";
  }
  updateModeStartLabel();
  requestWakeLock();
  _modeTimerInterval = setInterval(tickModeTimer, 200);
}
function openPlayMode(mode, returnFocus){
  const backdropEl = document.getElementById("modeBackdrop");
  if(!backdropEl || !mode) return;
  _openPlayMode = mode;
  _modeReturnFocus = returnFocus || document.activeElement;
  _modeCoachOn = !!soundOn;
  const modeHero = document.getElementById("modeDiagram");
  if(modeHero){
    const art = modeIcon(mode.id);
    modeHero.innerHTML = art;
    modeHero.style.display = art ? "" : "none";
  }
  document.getElementById("modeTitle").textContent = modeText(mode.title);
  document.getElementById("modeMeta").innerHTML = `<span class="tag">${escapeHtml(modeText(mode.players.label))}</span><span class="tag">${escapeHtml(modeText(mode.difficulty))}</span><span class="tag">${escapeHtml(modeDurationLabel(mode.seconds))}</span>`;
  document.getElementById("modeGearLine").innerHTML = `<span class="modeGearChip">${escapeHtml(modeGearLabel(mode))}</span><span class="modeGearChip">${escapeHtml(modeText(mode.space))}</span>`;
  document.getElementById("modeSteps").innerHTML = (mode.steps || []).map(step=>`<li>${escapeHtml(modeText(step))}</li>`).join("");
  document.getElementById("modeGoal").textContent = modeText(mode.goal);
  document.getElementById("modeSafety").textContent = modeText(mode.safety);
  const listen = document.getElementById("btnModeListen");
  if(listen){ listen.classList.toggle("active", _modeCoachOn); listen.setAttribute("aria-pressed", _modeCoachOn ? "true" : "false"); }
  cancelModeTimer({reset:true});
  backdropEl.inert = false;
  backdropEl.removeAttribute("inert");
  backdropEl.setAttribute("aria-hidden","false");
  backdropEl.classList.add("show");
  document.body.classList.add("modalOpen");
  setMissionBackgroundIsolation(true);
  requestAnimationFrame(()=>document.getElementById("btnModeClose")?.focus({preventScroll:true}));
}
function closePlayMode(){
  const backdropEl = document.getElementById("modeBackdrop");
  cancelModeTimer({reset:true});
  if("speechSynthesis" in window) window.speechSynthesis.cancel();
  if(backdropEl){
    backdropEl.classList.remove("show");
    backdropEl.setAttribute("aria-hidden","true");
    backdropEl.inert = true;
    backdropEl.setAttribute("inert","");
  }
  document.body.classList.remove("modalOpen");
  setMissionBackgroundIsolation(false);
  _openPlayMode = null;
  const focus = _modeReturnFocus;
  _modeReturnFocus = null;
  if(focus && focus.isConnected) requestAnimationFrame(()=>focus.focus({preventScroll:true}));
}

document.addEventListener("DOMContentLoaded", ()=>{
  document.querySelectorAll(".modeFilter").forEach(btn=>btn.addEventListener("click", ()=>{
    _playModeGroup = btn.dataset.modeGroup || "solo";
    clickSound("click");
    renderPlayModes();
  }));
  document.getElementById("btnModeClose")?.addEventListener("click", ()=>{ clickSound("click"); closePlayMode(); });
  document.getElementById("modeBackdrop")?.addEventListener("click", event=>{ if(event.target === event.currentTarget) closePlayMode(); });
  document.getElementById("btnModeListen")?.addEventListener("click", ()=>{
    if(!soundOn){
      _modeCoachOn = false;
      const btn = document.getElementById("btnModeListen");
      btn.classList.remove("active");
      btn.setAttribute("aria-pressed", "false");
      showToast("Sound is off — turn it on in Settings.");
      return;
    }
    _modeCoachOn = !_modeCoachOn;
    const btn = document.getElementById("btnModeListen");
    btn.classList.toggle("active", _modeCoachOn);
    btn.setAttribute("aria-pressed", _modeCoachOn ? "true" : "false");
    // This control enables or disables coaching. The short intro belongs to
    // Start, so a child never hears the same directions twice in succession.
    if(!_modeCoachOn && "speechSynthesis" in window) window.speechSynthesis.cancel();
  });
  document.getElementById("btnModeStart")?.addEventListener("click", ()=>{
    clickSound("click");
    if(_modeNarrationPending){
      _modeNarrationPending = false;
      _modeNarrationToken++;
      if("speechSynthesis" in window) window.speechSynthesis.cancel();
      startModeTimer();
      return;
    }
    if(_modeTimerState === "idle") narrateModeThenStart(_openPlayMode);
    else if(_modeTimerState === "running") pauseModeTimer();
    else resumeModeTimer();
  });
  document.getElementById("btnModeAnother")?.addEventListener("click", ()=>{ clickSound("click"); closePlayMode(); });
  document.getElementById("modeBackdrop")?.addEventListener("keydown", event=>handleDialogKeys(event, document.getElementById("modeBackdrop"), closePlayMode));
  document.getElementById("btnMoreProductHelp")?.addEventListener("click", event=>{
    event.preventDefault();
    closeMission();
    switchTab("profile");
    const care = document.querySelector("#tabProfile .productCareSection");
    if(care){ care.open = true; setTimeout(()=>care.scrollIntoView({block:"start",behavior:"smooth"}), 80); }
  });
});


/** =======================
 * Family Insights — Stats tab'da çoklu profil özeti
 * ======================= */
function renderFamilyInsights(){
  const wrap = document.getElementById("familyInsights");
  const grid = document.getElementById("familyInsightsGrid");
  const fStreakEl = document.getElementById("familyStreak");
  if(!wrap || !grid) return;

  const profiles = getProfiles();
  // Sadece 2+ profil varsa göster (tek profilde anlamı yok)
  if(profiles.length < 2){
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "";

  // Her profil için done count + streak topla
  const items = profiles.map(p => {
    const doneRaw = lsGetJSON("jumvi_" + p.id + "_missions_done_v3", []);
    const doneCount = Array.isArray(doneRaw) ? doneRaw.length : 0;
    const streak = Number(lsGet("jumvi_" + p.id + "_streak_count_v1", "0")) || 0;
    const lastIso = lsGet("jumvi_" + p.id + "_streak_last_v1", "") || "";
    return { p, doneCount, streak, lastIso };
  });

  // Render her profil için mini kart
  grid.innerHTML = "";
  items.forEach(it => {
    const card = document.createElement("div");
    card.className = "familyMember";
    card.innerHTML = `
      <div class="familyMemberAvatar">${JUMVI_ART.img(JUMVI_ART.avatar(it.p.avatar), "avatarArt", "", true)}</div>
      <div class="familyMemberInfo">
        <div class="familyMemberName">${escapeHtml(it.p.name || "Player")}</div>
        <div class="familyMemberStats">
          <span class="familyMemberMissions">${it.doneCount}/36</span>
          <span class="familyMemberStreak"><i class="jic jic-flame" aria-hidden="true"></i> ${it.streak}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Family streak: en az 1 profil her gün oynamış olduğu ardışık gün sayısı
  // Tüm profillerin lastActiveIso'larını al, her ISO'da en az 1 oynama varsa say
  const today = isoLocalDate();
  const yesterday = yesterdayIso(today);
  let familyStreakCount = 0;

  // En son birinin oynadığı tarih = en yakın aktif tarih
  const allLastIsos = items.map(x => x.lastIso).filter(Boolean);
  if(allLastIsos.length > 0){
    const mostRecent = allLastIsos.sort().reverse()[0];
    if(mostRecent === today || mostRecent === yesterday){
      // Family streak hesapla: her gün geriye giderek "o gün en az 1 profil oynadı mı" kontrol
      let cursor = mostRecent;
      familyStreakCount = 1;
      // En fazla 30 gün geriye git (fazlasi anlamsiz)
      for(let i = 0; i < 30; i++){
        const prev = yesterdayIso(cursor);
        const anyPlayed = items.some(x => x.lastIso === prev);
        if(anyPlayed){
          familyStreakCount++;
          cursor = prev;
        } else {
          break;
        }
      }
    }
  }

  if(fStreakEl){
    if(familyStreakCount > 0){
      fStreakEl.innerHTML = `<i class="jic jic-flame" aria-hidden="true"></i> <b>Family streak:</b> ${familyStreakCount} day${familyStreakCount===1?"":"s"} together`;
      fStreakEl.classList.remove("dim");
    } else {
      fStreakEl.innerHTML = `<i class="jic jic-star" aria-hidden="true"></i> Start a family streak today!`;
      fStreakEl.classList.add("dim");
    }
  }
}

function initBottomNav(){
  // 3D Hub nav button stays hidden unless the user has the opt-in flag set —
  // default state of the bottom nav is unchanged for everyone else. If a prior
  // visit found the device unsupported (no WebGL), keep BOTH entry points hidden.
  if(lsGet(HUB3D_UNSUPPORTED_KEY, "0") === "1"){
    applyHub3dUnsupported();
  } else {
    // Step 1 of 7. The hub funnel starts here, not at "entered": without a
    // "was it even offered" number, a low entry count cannot be told apart
    // from a device that was never shown the door.
    beaconOnce("hub3d_shown", "hub3d", { step: "shown" });
  }

  // Adventure Mode entry card stays the one clear path into the optional 3D
  // island. It no longer adds a sixth navigation tab on small phones.
  const advCard = document.getElementById("advModeCard");
  if(advCard){
    advCard.onclick = ()=>{
      // §5.3 — the island is a 9.4 MB download; offline it can't load. Don't
      // dump the user into a dead 3D tab — nudge them and keep them on Today.
      if(!navigator.onLine){
        clickSound("click");
        const b = document.getElementById("offlineBanner");
        if(b){ b.hidden = false; b.classList.add("flash"); setTimeout(()=>b.classList.remove("flash"), 900); }
        return;
      }
      clickSound("click");
      lsSet(HUB3D_FLAG_KEY, "1");
      _hub3dEntrySource = "adv_card";
      switchTab("hub3d");
    };
  }

  // §5.3 — offline awareness. The SW keeps the app open offline; this tells the
  // user (banner) and marks the island card inert. No new state, no analytics.
  (function initOfflineStatus(){
    const banner = document.getElementById("offlineBanner");
    const island = document.getElementById("advModeCard");
    function sync(){
      const off = !navigator.onLine;
      if(banner) banner.hidden = !off;
      if(island) island.classList.toggle("is-offline", off);
    }
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    sync();
  })();

  const navBtns = document.querySelectorAll(".navTab");
  navBtns.forEach(btn => {
    btn.addEventListener("click", ()=>{
      clickSound("click");
      const tab = btn.dataset.tab;
      if(tab === "hub3d") _hub3dEntrySource = "nav_tab";
      switchTab(tab);
    });
  });

  // [data-go-tab="X"] olan butonlar — örn empty state'teki "Go to Today" butonu
  document.querySelectorAll("[data-go-tab]").forEach(el => {
    el.addEventListener("click", (e)=>{
      e.preventDefault();
      const tab = el.dataset.goTab;
      if(tab){
        clickSound("click");
        switchTab(tab);
      }
    });
  });

  // İlk yükleme: kayıtlı tab veya "today"
  const saved = lsGet(NAV_TAB_KEY, "today");
  switchTab(saved === "hub3d" ? "today" : saved);

  // Profil tab'ından profile sheet aç
  const openFromTab = document.getElementById("btnOpenProfileFromTab");
  if(openFromTab){
    openFromTab.addEventListener("click", ()=>{
      clickSound("click");
      openProfileSheet();
    });
  }

  // Daily reminder kaldirildi (calismiyor + alakasiz)

  // Continue where you left off
  const btnContinue = document.getElementById("btnContinue");
  if(btnContinue){
    btnContinue.addEventListener("click", ()=>{
      clickSound("click");
      const lastId = Number(lsGet("jumvi_last_opened_id_v1", "0"));
      if(lastId){
        const ms = missions.find(x=>x.id===lastId);
        if(ms) openMission(lastId);
      }
    });
  }

  // Browse tab Path-only — toggle kaldirildi
  applyBrowseView();

  // Search toggle (Browse tab)
  const searchToggle = document.getElementById("searchToggleBtn");
  const searchBox = document.getElementById("searchBox");
  if(searchToggle && searchBox){
    searchToggle.addEventListener("click", ()=>{
      clickSound("click");
      const isOpen = searchBox.style.display !== "none";
      searchBox.style.display = isOpen ? "none" : "";
      if(!isOpen){
        const inp = document.getElementById("searchInput");
        if(inp) setTimeout(()=> inp.focus(), 60);
      }
    });
  }
}

/** =======================
 * Daily Mini-Challenge — bugün 1 mission tamamla = one daily point
 * ======================= */
const DAILY_CHALLENGE_KEY = _PP + "daily_challenge_v1"; // { iso, count, reward }

function getDailyChallengeState(){
  const today = isoLocalDate();
  let state = lsGetJSON(DAILY_CHALLENGE_KEY, null);
  if(!state || state.iso !== today){
    state = { iso: today, count: 0, claimed: false };
    lsSet(DAILY_CHALLENGE_KEY, JSON.stringify(state));
  }
  return state;
}

function bumpDailyChallenge(){
  const state = getDailyChallengeState();
  state.count++;
  lsSet(DAILY_CHALLENGE_KEY, JSON.stringify(state));
  renderDailyChallenge();
  // 1 mission tamamlandı = daily point earned
  if(state.count === 1 && !state.claimed){
    state.claimed = true;
    lsSet(DAILY_CHALLENGE_KEY, JSON.stringify(state));
    setTimeout(()=>{
      showToast("Daily Champion! Goal completed!");
      if(!prefersReducedMotion) fireConfetti(1500);
    }, 1200);
  }
}

function renderDailyChallenge(){
  const state = getDailyChallengeState();
  const goal = 1;
  const card = document.getElementById("dailyChallenge");
  const status = document.getElementById("dailyChallengeStatus");
  const fill = document.getElementById("dailyChallengeFill");
  const reward = document.getElementById("dailyChallengeReward");
  if(card){
    const completed = state.count >= goal;
    card.classList.toggle("completed", completed);
    if(status) status.textContent = `${Math.min(state.count, goal)} / ${goal}`;
    if(fill) fill.style.width = (Math.min(state.count, goal) / goal * 100) + "%";
    if(reward){
      reward.innerHTML = completed
        ? '<i class="jic jic-star" aria-hidden="true"></i> Completed! See you tomorrow for a new goal!'
        : "Play 1 mission today → earn the Daily Champion star";
    }
  }
  // Compact stats içindeki todayGoalBadge'i güncelle
  const badge = document.getElementById("todayGoalBadge");
  if(badge){
    const completed = state.count >= goal;
    badge.innerHTML = completed
      ? '<i class="jic jic-star" aria-hidden="true"></i> Goal done!'
      : `<i class="jic jic-star" aria-hidden="true"></i> ${state.count}/${goal} today`;
    badge.classList.toggle("completed", completed);
  }
}

/** =======================
 * Continue where you left off
 * ======================= */
const LAST_OPENED_KEY = "jumvi_last_opened_id_v1";

function renderContinueHint(){
  const hint = document.getElementById("continueHint");
  const nameEl = document.getElementById("continueHintName");
  if(!hint) return;
  const lastId = Number(lsGet(LAST_OPENED_KEY, "0"));
  if(!lastId){ hint.style.display = "none"; return; }
  // The main card already carries this mission; never show the same choice twice.
  if(lastId === dailyIdStored){ hint.style.display = "none"; return; }
  const ms = missions.find(x=>x.id===lastId);
  if(!ms){ hint.style.display = "none"; return; }
  // A COMPLETED mission is not something to "continue" — right after finishing
  // one, this card used to still offer "Resume" on it, which read as a bug.
  if(done.has(lastId)){ hint.style.display = "none"; return; }
  hint.style.display = "";
  if(nameEl) nameEl.textContent = ms.title;
}

/** =======================
 * Mission Path Tree (Duolingo-inspired)
 * Browse tab artik PATH-ONLY (list kaldirildi)
 * ======================= */

function applyBrowseView(){
  // Path view varsayilan ve tek view
  const pathEl = document.getElementById("missionPath");
  const listEl = document.getElementById("list");
  if(pathEl) pathEl.style.display = "";
  if(listEl) listEl.style.display = "none";
  renderMissionPath();
}

/* Geriye uyumluluk — eski JS bağlantıları için boş stub'lar */
function getActiveBrowseView(){ return "path"; }
function setActiveBrowseView(){ applyBrowseView(); }

const PACK_TAGLINES = {
  "Reflex Rush":    "Lightning fast hands",
  "Aim Master":     "Hit the bullseye",
  "Focus Control":  "Calm body, sharp mind",
  "Team Duo":       "Work together",
  "Indoor Compact": "Small space, big fun",
  "Beach/Park":     "Outdoor adventures"
};

/* ============================================
 * Path Sound Effects
 * ============================================ */
function pathSound(type){
  if(!soundOn) return;
  const ctx = ensureAudio();
  if(!ctx) return;
  const t0 = ctx.currentTime;
  const make = (freq, dur, gain=0.06, wave="triangle")=>{
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  };
  const makeAt = (freq, delay, dur, gain=0.06, wave="triangle")=>{
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0 + delay);
    g.gain.setValueAtTime(0.0001, t0 + delay);
    g.gain.exponentialRampToValueAtTime(gain, t0 + delay + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t0 + delay); osc.stop(t0 + delay + dur + 0.05);
  };
  switch(type){
    case "tap":     make(560, 0.05, 0.028, "sine"); break; // matches the softened clickSound
    case "done":    makeAt(740,0,0.08,0.06); makeAt(1100,0.04,0.10,0.05); break;
    case "next":    makeAt(660,0,0.06,0.06); makeAt(880,0.06,0.08,0.05); break;
    case "preview": make(540, 0.10, 0.04, "sine"); break;
    case "milestone":
      makeAt(660,0,0.08,0.06);
      makeAt(880,0.10,0.08,0.06);
      makeAt(1100,0.20,0.12,0.06);
      break;
    case "trophy":
      makeAt(660,0,0.10,0.07);
      makeAt(880,0.12,0.10,0.07);
      makeAt(1100,0.24,0.12,0.07);
      makeAt(1320,0.36,0.18,0.07);
      break;
    default:        make(620, 0.06, 0.04);
  }
}

/* Pack complete — full celebration */
function showPackCompleteCelebration(packKey, packLabel){
  // Konfeti yağmuru
  if(!prefersReducedMotion){
    if(window.confetti){
      try{
        const fire = (delay)=> setTimeout(()=>{
          window.confetti({
            particleCount: 80, spread: 90,
            origin: { x: Math.random(), y: 0.3 + Math.random()*0.2 }
          });
        }, delay);
        fire(0); fire(250); fire(500); fire(750);
      }catch(_){}
    } else {
      fireConfetti(2400);
    }
  }
  pathSound("trophy");
  window.JumviMusic?.cue("playZoneComplete");
  showToast(`${packLabel} mastered! Pack complete!`);
  trackEvent("Pack Completed", { pack: packKey });
  beacon("pack_complete", { pack: packKey });
  if(navigator.vibrate) try { navigator.vibrate([60, 80, 60, 80, 100]); } catch(_){}
}


/* "Next" mission tespiti — kullanicinin journey'sindeki bir sonraki tamamlanmamis */
function findNextMissionForUser(){
  // Pack siralamasi takibi: ilk tamamlanmamis pack'in ilk tamamlanmamis mission'i
  for(const pack of SKILL_PACKS){
    const packMissions = missions.filter(m => m.pack === pack.key);
    const firstUndone = packMissions.find(m => !done.has(m.id));
    if(firstUndone) return firstUndone.id;
  }
  return null;
}

/* ============================================
 * Mission Path — Vertical Linear (Duolingo "the path" style, 2026)
 * iPhone SE → iPhone Pro Max + tüm Android'lerde sorunsuz çalışır
 * Standart CSS only (no color-mix, no :has, no experimental)
 * ============================================ */
function renderMissionPath(){
  const container = document.getElementById("missionPath");
  if(!container || typeof SKILL_PACKS === "undefined") return;
  container.innerHTML = "";

  ensureDailyMission();
  const dailyId = dailyIdStored;
  const nextId = findNextMissionForUser();

  SKILL_PACKS.forEach(pack => {
    const packMissions = missions.filter(m => m.pack === pack.key);
    if(packMissions.length === 0) return;
    const doneCount = packMissions.filter(m => done.has(m.id)).length;
    const total = packMissions.length;
    const allDone = doneCount >= total;

    const section = document.createElement("div");
    section.className = "pathSection";
    if(allDone) section.classList.add("allDone");
    section.style.setProperty("--pack-color", pack.color);
    const slug = "pack--" + pack.key.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    section.classList.add(slug);

    // Pack header
    const header = document.createElement("div");
    header.className = "pathSectionHeader";
    header.innerHTML =
      '<div class="pathSectionIcon">' + JUMVI_ART.img(JUMVI_ART.pack(pack.key), "packArt", "", true) + '</div>' +
      '<div class="pathSectionInfo">' +
        '<div class="pathSectionName">' + escapeHtml(pack.label) + '</div>' +
        '<div class="pathSectionMeta">Pack ' + (SKILL_PACKS.indexOf(pack)+1) + ' of ' + SKILL_PACKS.length + ' · ' + doneCount + '/' + total + '</div>' +
      '</div>' +
      '<div class="pathSectionProgress">' + doneCount + '/' + total + '</div>';
    header.dataset.packKey = pack.key;
    packViewObserver().observe(header);
    section.appendChild(header);

    // Vertical steps container
    const track = document.createElement("div");
    track.className = "pathSteps";

    packMissions.forEach((m, i) => {
      const isDone = done.has(m.id);
      const isDaily = m.id === dailyId;
      const isNext = m.id === nextId;

      const step = document.createElement("div");
      step.className = "pathStep";
      if(i > 0){
        step.classList.add("hasLineAbove");
        if(packMissions[i-1] && done.has(packMissions[i-1].id)){
          step.classList.add("lineSolid");
        }
      }
      if(isDone) step.classList.add("done");
      if(isNext && !isDone) step.classList.add("next");
      if(isDaily && !isDone) step.classList.add("daily");

      const node = document.createElement("button");
      node.type = "button";
      node.className = "pathStepNode";
      const nodeState = isDone ? "completed" : (isDaily ? "today's pick" : (isNext ? "next mission" : ""));
      node.setAttribute("aria-label", m.title + " — " + pack.label + (nodeState ? " (" + nodeState + ")" : ""));
      node.setAttribute("data-mission-id", m.id);
      if(isNext) node.id = "pathNodeNext";
      node.innerHTML = '<span class="pathStepIcon">' + JUMVI_ART.img(JUMVI_ART.mission(m.id), "missionArt", m.title) + '</span>';
      if(isDone){
        const doneMark = document.createElement("span");
        doneMark.className = "pathStepDoneMark";
        doneMark.setAttribute("aria-hidden", "true");
        doneMark.textContent = "✓";
        node.appendChild(doneMark);
      }

      node.addEventListener("click", function(){
        try{ clickSound(isDone ? "success" : "click"); }catch(_){}
        if(navigator.vibrate){ try{ navigator.vibrate(8); }catch(_){} }
        trackEvent("Path Step Tapped", { mission: m.id, pack: pack.key, isDone: isDone });
        openMission(m.id);
      });

      const label = document.createElement("div");
      label.className = "pathStepLabel";
      label.textContent = m.title;

      step.appendChild(node);
      step.appendChild(label);
      if(!isDone && (isDaily || isNext)){
        const status = document.createElement("span");
        status.className = "pathStepStatus " + (isDaily ? "pathStepStatusDaily" : "pathStepStatusNext");
        status.setAttribute("aria-hidden", "true");
        status.textContent = isDaily ? "TODAY" : "NEXT";
        step.appendChild(status);
      }

      // Just-done celebration
      if(window._justDoneMissionId === m.id){
        step.classList.add("justDone");
        setTimeout(function(){ step.classList.remove("justDone"); }, 1500);
        window._justDoneMissionId = null;
      }

      track.appendChild(step);
    });

    section.appendChild(track);
    container.appendChild(section);
  });

  // Sadece ilk renderda NEXT'e auto-scroll
  if(!_pathScrolledOnce){
    _pathScrolledOnce = true;
    setTimeout(function(){
      if(!prefersReducedMotion){
        var nextNode = document.getElementById("pathNodeNext");
        if(nextNode){
          try{ nextNode.scrollIntoView({ behavior: "smooth", block: "center" }); }catch(_){
            try{ nextNode.scrollIntoView(); }catch(_){}
          }
        }
      }
    }, 400);
  }
}

/* Path render flag — sadece ilk renderda auto-scroll yap */
let _pathScrolledOnce = false;


/** =======================
 * Coach Leo's Smart Pick (returning users)
 * En az tamamlanmış pack'ten + yaş uyumlu öneri
 * ======================= */
function getCoachPick(){
  const todayDone = lsGetJSON(_PP + "today_done_ids_v1", []);
  const todayIso = isoLocalDate();
  // Bugün açılan/oynanmış ama tamamlanmamış olabilir, tüm undone'lardan pick
  const undone = missions.filter(m => !done.has(m.id));
  if(undone.length === 0) return null;

  const packKeys = ["Aim Master","Focus Control","Team Duo","Indoor Compact","Beach/Park","Reflex Rush"];
  const packStats = packKeys.map(p => ({
    key: p,
    doneCount: missions.filter(m => m.pack === p && done.has(m.id)).length,
    pending: missions.filter(m => m.pack === p && !done.has(m.id))
  })).filter(x => x.pending.length > 0);

  if(packStats.length === 0) return null;

  // Sırala: en az tamamlanmış pack başa, ama hiç başlanmamışlar daha öncelikli
  packStats.sort((a,b) => {
    // Hiç başlanmamış (0) öncelikli
    if(a.doneCount === 0 && b.doneCount > 0) return -1;
    if(b.doneCount === 0 && a.doneCount > 0) return 1;
    return a.doneCount - b.doneCount;
  });

  const pickPack = packStats[0];
  // Pack içinden Easy varsa Easy seç, yoksa medium
  const easyPending = pickPack.pending.filter(m => m.difficulty === 1);
  const pool = easyPending.length > 0 ? easyPending : pickPack.pending;
  // Deterministic: günün hash'ine göre seç (her gün aynı pick)
  const hash = hashFNV1a(todayIso + "|" + getActiveProfileId() + "|coachpick");
  const pick = pool[hash % pool.length];
  return { mission: pick, pack: pickPack };
}

function buildCoachReason(packStats, pick){
  const packLabel = getPackName(pick.pack);
  const doneCount = packStats.doneCount;
  const total = 6;
  if(doneCount === 0){
    return `New pack to try: ${packLabel}!`;
  }
  if(doneCount === total - 1){
    return `Finish ${packLabel} — only 1 left!`;
  }
  if(doneCount >= 4){
    return `Almost there in ${packLabel}!`;
  }
  return `Keep building ${packLabel} skills!`;
}

function renderCoachPick(){
  const card = document.getElementById("coachPick");
  if(!card) return;
  // Bugün daily zaten ne ise — coach pick'i ondan farklı seç
  ensureDailyMission();
  const pick = getCoachPick();
  if(!pick || !pick.mission){
    card.style.display = "none";
    return;
  }
  // Daily ile aynı mission'sa coach pick gizle (dublication önleme)
  if(pick.mission.id === dailyIdStored){
    // Alternatif: ikinci en iyi adayı seç
    const alt = (function(){
      const undone = missions.filter(m => !done.has(m.id) && m.id !== dailyIdStored);
      if(undone.length === 0) return null;
      // Aynı pack'ten bir alternatif veya farklı pack'ten
      const sameOrOther = undone.filter(m => m.difficulty === 1);
      const pool = sameOrOther.length > 0 ? sameOrOther : undone;
      const hash = hashFNV1a(isoLocalDate() + "|alt|" + getActiveProfileId());
      return pool[hash % pool.length];
    })();
    if(!alt){ card.style.display = "none"; return; }
    pick.mission = alt;
    pick.pack = { key: alt.pack, doneCount: missions.filter(m => m.pack === alt.pack && done.has(m.id)).length };
  }

  const ms = pick.mission;
  const iconEl   = document.getElementById("coachPickIcon");
  const nameEl   = document.getElementById("coachPickName");
  const metaEl   = document.getElementById("coachPickMeta");
  const reasonEl = document.getElementById("coachPickReason");
  if(iconEl) iconEl.innerHTML = JUMVI_ART.img(JUMVI_ART.mission(ms.id), "missionArt", ms.title, true);
  if(nameEl) nameEl.textContent = ms.title;
  if(metaEl) metaEl.innerHTML = `${escapeHtml(getPackName(ms.pack))} · ${escapeHtml(ms.time)} · <i class="jic jic-users" aria-hidden="true"></i> ${escapeHtml(ms.players)}`;
  if(reasonEl) reasonEl.textContent = buildCoachReason(pick.pack, ms);

  // Click handler
  const cardBtn = document.getElementById("coachPickCard");
  if(cardBtn){
    cardBtn.onclick = ()=>{
      clickSound("click");
      trackEvent("Coach Pick Tapped");
      beaconOnce("daily_pick_tap", "daily_pick_tap");
      openMission(ms.id);
    };
  }
  card.style.display = "";

  // Daily card içindeki alt-suggestion link satırı (CSS ile coachPick gizlendi)
  const alt = document.getElementById("dailyAltSuggestion");
  const altName = document.getElementById("dailyAltName");
  if(alt && altName){
    altName.textContent = ms.title;
    alt.style.display = "";
    alt.onclick = ()=>{
      clickSound("click");
      trackEvent("Coach Pick Tapped");
      beaconOnce("daily_pick_tap", "daily_pick_tap");
      openMission(ms.id);
    };
  }
}

/** =======================
 * Yeni kullanıcı için ilk mission önerisi
 * Kolay, kısa, beğenilen klasik bir mission seç
 * ======================= */
function pickFirstMissionForNewUser(selectedDiff){
  // Önerilen ilk mission'lar (yaşa göre): kolay + güzel deneyim
  const recommendations = {
    "Easy":   [18, 25, 1, 6, 11, 31],   // Count to 10, Chill Catch, Speed Demon, Number Echo, Sky Floater, Cloud Chaser
    "Medium": [10, 7, 4, 17, 28, 33],   // Power Step, Rainbow Throws, Switcharoo, Mirror Mode, Mind Reader, How Far
    "all":    [1, 18, 25, 31, 7, 10]    // Genel yaş için karışık
  };
  const list = recommendations[selectedDiff] || recommendations["all"];
  // İlk tamamlanmamış öneriyi al
  for(const id of list){
    if(!done.has(id)){
      const ms = missions.find(x=>x.id===id);
      if(ms) return id;
    }
  }
  return null;
}

/** =======================
 * Score Tracker (kişisel rekor)
 * ======================= */
let _currentScore = 0;
let _scoreTrackerOpen = false;

function getHighScores(){
  return lsGetJSON(HIGH_SCORES_KEY, {}) || {};
}
function getMissionBest(missionId){
  const scores = getHighScores();
  return Number(scores[missionId] || 0);
}
function setMissionBest(missionId, score){
  const scores = getHighScores();
  const current = Number(scores[missionId] || 0);
  if(score > current){
    scores[missionId] = score;
    lsSet(HIGH_SCORES_KEY, JSON.stringify(scores));
    return true; // yeni rekor
  }
  return false;
}

function renderScoreTracker(){
  const numEl = document.getElementById("scoreTrackerNumber");
  const bestEl = document.getElementById("scoreTrackerBest");
  if(numEl) numEl.textContent = _currentScore;
  if(bestEl){
    const best = lastOpenedId ? getMissionBest(lastOpenedId) : 0;
    bestEl.textContent = `Best: ${best}`;
  }
}

function bumpScore(){
  _currentScore++;
  const numEl = document.getElementById("scoreTrackerNumber");
  if(numEl){
    numEl.textContent = _currentScore;
    if(!prefersReducedMotion){
      numEl.classList.remove("bump");
      void numEl.offsetWidth;
      numEl.classList.add("bump");
      setTimeout(()=> numEl.classList.remove("bump"), 360);
    }
  }
  // Hafif tap sesi
  clickSound("click");
}

function resetScore(){
  _currentScore = 0;
  renderScoreTracker();
  const summary = document.getElementById("scoreTrackerSummary");
  if(summary){ summary.style.display = "none"; summary.classList.remove("newRecord"); }
}

function showScoreSummary(missionId){
  if(_currentScore === 0) return;
  const summary = document.getElementById("scoreTrackerSummary");
  if(!summary) return;
  const wasRecord = setMissionBest(missionId, _currentScore);
  const best = getMissionBest(missionId);
  summary.style.display = "";
  if(wasRecord){
    summary.classList.add("newRecord");
    summary.innerHTML = `<span class="summaryEmoji summaryBadgeArt">${JUMVI_ART.img(JUMVI_ART.badge("champ"), "badgeArt", "", true)}</span><b>NEW RECORD!</b> ${_currentScore} catches!`;
    if(!prefersReducedMotion) fireConfetti(1200);
    trackEvent("Score New Record", { mission: missionId, score: _currentScore });
  } else {
    summary.classList.remove("newRecord");
    const diff = best - _currentScore;
    summary.innerHTML = `<span class="summaryEmoji"><i class="jic jic-star" aria-hidden="true"></i></span>You scored <b>${_currentScore}</b> · Best: ${best} (${diff} more to beat!)`;
    trackEvent("Score Recorded", { mission: missionId, score: _currentScore });
    beacon("score_saved");
  }
  // Best değerini header'da yenile
  renderScoreTracker();
}

function toggleScoreTracker(force){
  const tracker = document.getElementById("scoreTracker");
  const btn = document.getElementById("btnScoreToggle");
  if(!tracker || !btn) return;
  const next = (typeof force === "boolean") ? force : !_scoreTrackerOpen;
  _scoreTrackerOpen = next;
  tracker.style.display = next ? "" : "none";
  btn.classList.toggle("active", next);
  btn.setAttribute("aria-pressed", next ? "true" : "false");
  btn.setAttribute("title", next ? "Tracking score (tap to hide)" : "Track score");
  if(next){
    resetScore();
    trackEvent("Score Tracker Opened");
    setTimeout(()=> tracker.scrollIntoView({ behavior: "smooth", block: "center" }), 40);
  }
}


// Score tracker DOM event handlers
document.addEventListener("DOMContentLoaded", ()=>{
  const toggleBtn = document.getElementById("btnScoreToggle");
  if(toggleBtn) toggleBtn.onclick = ()=>{ clickSound("click"); toggleScoreTracker(); };
  const tapBtn = document.getElementById("scoreTrackerTap");
  if(tapBtn){
    tapBtn.addEventListener("click", (e)=>{ e.preventDefault(); bumpScore(); });
    // Touch için ekstra hızlı yanıt
    tapBtn.addEventListener("touchstart", (e)=>{ e.preventDefault(); bumpScore(); }, { passive: false });
  }
  const resetBtn = document.getElementById("scoreTrackerReset");
  if(resetBtn) resetBtn.onclick = ()=>{ clickSound("click"); resetScore(); };
  // Story banner toggle — sadece mevcut görev için gizle (sonraki görevde tekrar gelir)
  const storyToggle = document.getElementById("storyToggle");
  if(storyToggle){
    storyToggle.onclick = ()=>{
      clickSound("click");
      const banner = document.getElementById("storyBanner");
      if(banner) banner.style.display = "none";
      trackEvent("Story Banner Dismissed");
    };
  }
});

/** =======================
 * First-time Guided Tutorial (3-step spotlight)
 * ======================= */
function showTutorial(){
  if(lsGet(TUTORIAL_KEY, "0") === "1") return;
  const overlay   = document.getElementById("tutorialOverlay");
  const spotlight = document.getElementById("tutorialSpotlight");
  const card      = document.getElementById("tutorialCard");
  const stepEl    = document.getElementById("tutorialStep");
  const titleEl   = document.getElementById("tutorialTitle");
  const descEl    = document.getElementById("tutorialDesc");
  const btnNextEl = document.getElementById("tutorialNext");
  const btnSkipEl = document.getElementById("tutorialSkip");
  if(!overlay || !spotlight || !card) return;

  const steps = [
    { selector: "#btnDailyPlay",
      title: '<i class="jic jic-play" aria-hidden="true"></i> Today\'s Mission',
      desc: "A fresh mission is picked for you each day. Tap here to start playing!" },
    { selector: "#streakPill",
      title: '<i class="jic jic-flame" aria-hidden="true"></i> Build Your Streak',
      desc: "Play one mission every day to keep your streak alive. The longer it grows, the hotter it gets!" },
    { selector: '.navTab[data-tab="stats"]',
      title: '<i class="jic jic-chart-bar" aria-hidden="true"></i> Track Progress',
      desc: "Tap Stats anytime to see weekly progress, badges earned, and the Champion Certificate." }
  ];

  let idx = 0;
  const finish = (action)=>{
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden","true");
    lsSet(TUTORIAL_KEY, "1");
    trackEvent("Tutorial " + (action||"completed"));
  };

  const positionSpotlight = ()=>{
    const step = steps[idx];
    const el = document.querySelector(step.selector);
    if(!el){ next(); return; }
    // Scroll target into view
    try{ el.scrollIntoView({ behavior:"smooth", block:"center" }); }catch(_){}
    setTimeout(()=>{
      const r = el.getBoundingClientRect();
      const pad = 8;
      spotlight.style.left   = `${r.left - pad}px`;
      spotlight.style.top    = `${r.top - pad}px`;
      spotlight.style.width  = `${r.width + pad*2}px`;
      spotlight.style.height = `${r.height + pad*2}px`;

      // Card position: alta yer varsa altta, yoksa üstte
      const vh = window.innerHeight;
      const cardH = 160; // tahmin
      const below = (r.bottom + 16 + cardH) < vh;
      card.style.left = "16px";
      card.style.right = "16px";
      card.style.maxWidth = "320px";
      card.style.margin = "0 auto";
      if(below){
        card.style.top = `${r.bottom + 14}px`;
        card.style.bottom = "auto";
      }else{
        card.style.bottom = `${vh - r.top + 14}px`;
        card.style.top = "auto";
      }
    }, 360);

    stepEl.textContent  = `Step ${idx+1} of ${steps.length}`;
    titleEl.innerHTML = step.title;
    descEl.textContent  = step.desc;
    btnNextEl.innerHTML = idx === steps.length-1
      ? '<i class="jic jic-circle-check" aria-hidden="true"></i> Got it!'
      : 'Next <i class="jic jic-arrow-right" aria-hidden="true"></i>';
  };

  const next = ()=>{
    idx++;
    if(idx >= steps.length){ finish("completed"); return; }
    positionSpotlight();
  };

  btnNextEl.onclick = ()=>{ clickSound("click"); next(); };
  btnSkipEl.onclick = ()=>{ clickSound("click"); finish("skipped"); };

  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden","false");
  trackEvent("Tutorial Started");
  positionSpotlight();
}

/** =======================
 * Mikro-kutlamalar
 * ======================= */
function fireDoneBurst(btn){
  if(!btn || prefersReducedMotion) return;
  btn.classList.add("btnDoneBurst","firing");
  setTimeout(()=> btn.classList.remove("firing"), 650);
}

function fireStreakBurst(){
  if(prefersReducedMotion) return;
  const pill = document.getElementById("streakPill");
  if(!pill) return;
  const r = pill.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top + r.height/2;
  for(let i=0;i<5;i++){
    const el = document.createElement("div");
    el.className = "streakFireBurst";
    el.innerHTML = '<i class="jic jic-flame" aria-hidden="true"></i>';
    el.style.left = `${cx - 16}px`;
    el.style.top  = `${cy - 16}px`;
    el.style.setProperty("--dx", `${(Math.random()-0.5)*120}px`);
    el.style.fontSize = `${24 + Math.random()*16}px`;
    el.style.animationDelay = `${i*60}ms`;
    document.body.appendChild(el);
    setTimeout(()=> el.remove(), 1400);
  }
}

/** =======================
 * Sound toggle
 * ======================= */
function renderSoundToggle(){
  soundToggle.classList.toggle("muted", !soundOn);
  soundToggle.innerHTML = soundOn ? '<i class="jic jic-volume" aria-hidden="true"></i>' : '<i class="jic jic-volume-off" aria-hidden="true"></i>';
}
soundToggle.onclick = ()=>{
  soundOn = !soundOn;
  lsSet(SOUND_KEY, soundOn ? "1" : "0");
  renderSoundToggle();
  // If turning on, try to unlock audio on tap
  if(soundOn){
    ensureAudio();
    clickSound("click");
  } else if(window.CoachLeoAudio){
    window.CoachLeoAudio.stop();
  }
  window.JumviMusic?.setEnabled(soundOn);
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
  updateProgress({ deferStats: true });

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
  const btnPlayToday = document.getElementById("btnPlayToday");
  if(btnPlayToday){
    btnPlayToday.onclick = ()=>{
      clickSound("click");
      trackEvent("Play Today Clicked");
      ensureDailyMission();
      if(dailyIdStored){ openMission(dailyIdStored); }
    };
  }

  // Modal paylaşım butonları
  const btnModalWA = document.getElementById("btnModalShareWhatsApp");
  if(btnModalWA){
    btnModalWA.onclick = ()=>{
      clickSound("click");
      const url = location.href;
      let topBadge = null;
      for(const b of BADGES){ if(b.check(done)) topBadge = b; }
      const badgePart = topBadge ? `Top badge: ${topBadge.name}\n` : "";
      const msDone = lastOpenedId ? missions.find(x=>x.id===lastOpenedId) : null;
      const missionPart = msDone ? `Just completed: ${msDone.title}\n` : "";
      const text = `${missionPart}${badgePart}${done.size}/36 JUMVI missions done! Try it: ${url}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    };
  }
  const btnModalCopy = document.getElementById("btnModalShareCopy");
  if(btnModalCopy){
    btnModalCopy.onclick = async ()=>{
      clickSound("click");
      const url = location.href;
      let topBadge = null;
      for(const b of BADGES){ if(b.check(done)) topBadge = b; }
      const badgePart = topBadge ? ` | Badge: ${topBadge.name}` : "";
      const text = `${done.size}/36 JUMVI missions completed${badgePart} — ${url}`;
      try{
        if(navigator.share){ await navigator.share({ title:"JUMVI Missions", text, url }); }
        else{ await navigator.clipboard.writeText(text); showToast("Copied to clipboard!"); }
      }catch(e){}
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
  // Bottom nav + Today-first UI elementleri
  initBottomNav();
  renderDailyChallenge();
  renderContinueHint();
  renderCoachPick();
  // Tutorial spotlight kaldırıldı — yeni today-first UI self-explanatory.
  // Var olan kullanıcılar için TUTORIAL_KEY işaretle ki bir daha çıkmasın
  try { lsSet(TUTORIAL_KEY, "1"); } catch(_){}
  // Delay A2HS banner — don't interrupt the first impression
  setTimeout(maybeShowA2HS, 60000);
  checkOptionalDownloads();

  // restore certificate name (optional)
  if(certNameInput){
    // Cert name: önce kayıtlı, yoksa aktif profile adı, yoksa boş
    const savedCertName = lsGet(CERT_NAME_KEY);
    const ap = getActiveProfile();
    certNameInput.value = savedCertName || (ap && ap.name && ap.name !== "Player" ? ap.name : "");
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
