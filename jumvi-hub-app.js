// 3D Hub — lazy-loaded only when the user opens the "hub3d" tab (see app.js
// showHub3D()/hideHub3D()). Builds a Three.js island scene with one gate per
// real mission pack; walking up to a gate opens the real mission panel via
// the openMission() reference passed in from app.js. No mission/app logic is
// reimplemented here — PACKS/missions/done/openMission are the real ones.
//
// Imports Three.js as an ES module (via the "three" import map in index.html)
// instead of relying on a global from a classic <script> — this is what lets
// jumvi-leo.js's optional GLTF model path use the real GLTFLoader, which only
// ships as an ES module. Same version (0.160.0) as before, just a different
// build/packaging — every existing THREE.Xxx call below is unaffected.
import * as THREE from 'three';
import { createCoachLeo } from './jumvi-leo.js?v=20260524-56';

export function initHub3D(opts) {
  var PACKS = opts.PACKS;
  var missions = opts.missions;
  var done = opts.done;
  var openMission = opts.openMission;
  var container = opts.container;

  // ---------- HUB UI TEXTS (hub'ın tek dil kaynağı) ----------
  // Ana uygulamada i18n sistemi yok (tüm app metinleri hardcoded İngilizce);
  // hub'ın KENDİ arayüz metinleri buradan gelir — çeviri/dil değişimi tek
  // noktadan yapılır. Görev VERİSİ (başlık/adımlar/win) ana uygulamadan
  // olduğu gibi gelir ve bilinçli olarak kendi dilinde bırakılır.
  var HUB_TEXTS = {
    zoneComplete: 'Bölge Tamamlandı! 🎉',
    hint: 'Zemine dokun, Leo yürüsün — parlayan kapıya ulaşınca görev açılır!',
    tapToWalk: '👆 Dokun ve yürü!',
    sound: 'Sesi aç/kapat',
    close: 'Kapat',
    missionsLeft: function (n) { return n + ' görev kaldı'; },
    zoneDoneLabel: 'tamamlandı! 🏆',
    steps: 'ADIMLAR',
    win: 'KAZANMAK İÇİN',
    stepsSoon: 'Adımlar yakında eklenecek.',
    winSoon: 'Kazanma koşulu yakında eklenecek.',
    start: '▶ BAŞLA!',
    running: function (s) { return '⏱ ' + s + ' sn — Oyna!'; },
    timeUp: '⏰ Süre doldu — Başardın mı?',
    didIt: '✅ Tamamladım',
    doneUndo: '✔ Tamamlandı — geri almak için dokun',
    prev: '← Önceki',
    next: 'Sonraki →',
    mission: 'Görev',
    zoneDoneBtn: 'Bölge Tamamlandı! 🏆',
    reward: function (zone, item) { return 'Bravo! ' + zone + ' yeni bir ' + item + ' kazandı 🎉'; },
    surprise: 'sürpriz'
  };

  // ---------- HUD: built into the container — no markup needed in index.html ----------
  var hudTop = document.createElement('div');
  hudTop.style.cssText = 'position:absolute;top:0;left:0;right:0;padding:16px;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;z-index:10;';
  var badgesEl = document.createElement('div');
  badgesEl.style.cssText = 'display:flex;gap:8px;background:rgba(255,255,255,0.88);padding:8px 12px;border-radius:20px;';
  hudTop.appendChild(badgesEl);

  // Small pill under the badges row showing how many missions are left in
  // whichever zone Leo is currently standing in (real done Set, not a guess) —
  // purely a read of existing state, no new progress concept.
  var progressLabelEl = document.createElement('div');
  progressLabelEl.style.cssText = 'background:rgba(255,255,255,0.85);padding:4px 14px;border-radius:14px;font-size:12px;font-weight:700;color:#3a2a1a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  hudTop.appendChild(progressLabelEl);
  container.appendChild(hudTop);

  // Center-screen "zone complete" celebration card — pure DOM overlay (not a
  // 3D object), hidden via opacity:0 until showZoneCompleteCelebration() plays
  // its one-shot animation (see updateZoneLocks() below for the trigger).
  var celebrationCardEl = document.createElement('div');
  celebrationCardEl.style.cssText = 'position:absolute;top:38%;left:50%;transform:translate(-50%,-50%);z-index:15;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;background:rgba(255,255,255,0.94);padding:18px 30px;border-radius:20px;box-shadow:0 8px 24px rgba(0,0,0,0.25);opacity:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  var celebrationTitleEl = document.createElement('div');
  celebrationTitleEl.style.cssText = 'font-size:20px;font-weight:900;color:#3a2a1a;white-space:nowrap;';
  celebrationTitleEl.textContent = HUB_TEXTS.zoneComplete;
  var celebrationSubtitleEl = document.createElement('div');
  celebrationSubtitleEl.style.cssText = 'font-size:15px;font-weight:700;color:#7a5a3a;white-space:nowrap;';
  celebrationCardEl.appendChild(celebrationTitleEl);
  celebrationCardEl.appendChild(celebrationSubtitleEl);
  container.appendChild(celebrationCardEl);

  if (!document.getElementById('hub3dCelebrationStyle')) {
    var celebrationStyle = document.createElement('style');
    celebrationStyle.id = 'hub3dCelebrationStyle';
    celebrationStyle.textContent =
      '@keyframes hub3dZoneCelebrate{' +
      '0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}' +
      '15%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}' +
      '25%{transform:translate(-50%,-50%) scale(1)}' +
      '80%{opacity:1;transform:translate(-50%,-50%) scale(1)}' +
      '100%{opacity:0;transform:translate(-50%,-50%) scale(.92)}' +
      '}';
    document.head.appendChild(celebrationStyle);
  }

  // Resets+replays the animation from scratch every call (the style.animation
  // reset + reflow trick) so back-to-back completions each get their own
  // full play instead of being silently skipped by an already-running one.
  function showZoneCompleteCelebration(packCfg) {
    celebrationSubtitleEl.textContent = packCfg.icon + ' ' + packCfg.name;
    celebrationCardEl.style.animation = 'none';
    void celebrationCardEl.offsetWidth;
    celebrationCardEl.style.animation = 'hub3dZoneCelebrate 1900ms ease-out forwards';
  }

  // Zone-entry name card — same reset-and-replay pattern as the celebration
  // card above, but shorter (1.5s) and higher up so the two never collide
  // visually if a completion and a zone entry happen back to back.
  var zoneCardEl = document.createElement('div');
  zoneCardEl.style.cssText = 'position:absolute;top:22%;left:50%;transform:translate(-50%,-50%);z-index:14;pointer-events:none;background:rgba(255,255,255,0.92);padding:12px 26px;border-radius:18px;box-shadow:0 6px 18px rgba(0,0,0,0.22);opacity:0;font-size:18px;font-weight:900;color:#3a2a1a;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  container.appendChild(zoneCardEl);
  if (!document.getElementById('hub3dZoneCardStyle')) {
    var zoneCardStyle = document.createElement('style');
    zoneCardStyle.id = 'hub3dZoneCardStyle';
    zoneCardStyle.textContent =
      '@keyframes hub3dZoneCardIn{' +
      '0%{opacity:0;transform:translate(-50%,-50%) scale(.7)}' +
      '18%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}' +
      '28%{transform:translate(-50%,-50%) scale(1)}' +
      '78%{opacity:1;transform:translate(-50%,-50%) scale(1)}' +
      '100%{opacity:0;transform:translate(-50%,-50%) scale(.94)}' +
      '}';
    document.head.appendChild(zoneCardStyle);
  }
  function showZoneCard(theme) {
    zoneCardEl.textContent = theme.cardTitle;
    zoneCardEl.style.animation = 'none';
    void zoneCardEl.offsetWidth;
    zoneCardEl.style.animation = 'hub3dZoneCardIn 1500ms ease-out forwards';
  }

  var hintEl = document.createElement('div');
  hintEl.textContent = HUB_TEXTS.hint;
  hintEl.style.cssText = 'position:absolute;bottom:14px;right:14px;background:rgba(255,255,255,0.85);padding:7px 13px;border-radius:11px;font-size:11px;color:#555;z-index:10;max-width:220px;text-align:right;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  container.appendChild(hintEl);

  // First-tap coach bubble — the small hint above is parent-facing; a 3-year-
  // old pre-reader needs the 👆 itself. Bounces center-screen until the very
  // first touch/keypress, then fades for the rest of the session.
  var coachBubbleEl = document.createElement('div');
  coachBubbleEl.textContent = HUB_TEXTS.tapToWalk;
  coachBubbleEl.style.cssText = 'position:absolute;bottom:26%;left:50%;transform:translateX(-50%);background:rgba(255,255,255,0.94);padding:12px 22px;border-radius:20px;font-size:19px;font-weight:900;color:#3a2a1a;z-index:12;pointer-events:none;box-shadow:0 6px 16px rgba(0,0,0,0.25);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;transition:opacity 400ms ease;animation:hub3dCoachBounce 1.3s ease-in-out infinite;';
  container.appendChild(coachBubbleEl);
  if (!document.getElementById('hub3dCoachStyle')) {
    var coachStyle = document.createElement('style');
    coachStyle.id = 'hub3dCoachStyle';
    coachStyle.textContent = '@keyframes hub3dCoachBounce{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-9px)}}';
    document.head.appendChild(coachStyle);
  }
  var coachBubbleDismissed = false;
  function dismissCoachBubble() {
    if (coachBubbleDismissed) return;
    coachBubbleDismissed = true;
    coachBubbleEl.style.opacity = '0';
    setTimeout(function () { coachBubbleEl.remove(); }, 450);
  }

  // ---------- AUDIO (synthesized via Web Audio API — no asset files) ----------
  // Every sound below is one or two oscillator+gain nodes with a short
  // exponential-decay envelope; nothing is fetched/decoded, so there's no
  // load time and no extra network/asset weight. Kept deliberately quiet
  // (it's a kids' app) and fully silenceable via the mute button.
  var AudioCtor = window.AudioContext || window.webkitAudioContext;
  var audioCtx = null;
  var masterGain = null;
  if (AudioCtor) {
    try {
      audioCtx = new AudioCtor();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.32; // overall ceiling — individual sounds below stay well under this too
      masterGain.connect(audioCtx.destination);
    } catch (e) {
      audioCtx = null; // synthesis unavailable in this browser — playTone() below becomes a no-op
    }
  }
  var audioMuted = false;

  // Autoplay policies block sound before a user gesture; the context starts
  // "suspended" and every real interaction entry point (keydown, tap-to-move
  // touch, the mute button itself) calls this — cheap/safe to call
  // repeatedly once it's already running.
  function resumeAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
  }

  // type: 'sine'|'triangle'|'square'; freq in Hz; duration in seconds;
  // peakGain is pre-master (actual loudness = peakGain * masterGain.gain).
  function playTone(freq, duration, type, peakGain, delaySec) {
    if (!audioCtx || audioMuted) return;
    var t0 = audioCtx.currentTime + (delaySec || 0);
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // Soft, low "pat" — short triangle thump, randomized a few Hz each time so
  // a run of footsteps doesn't sound like a robotic loop. Triggered from
  // updateMovement()'s own step cadence (see stepTimer below).
  function playStep() {
    playTone(150 + Math.random() * 40, 0.09, 'triangle', 0.05, 0);
  }

  // Two-note ascending chime — the "you've reached a gate" cue, played once
  // per arrival (checkGateProximity already dedupes via lastTriggeredGate,
  // so this fires exactly once per gate, not every frame in range).
  function playChime() {
    playTone(880, 0.18, 'sine', 0.07, 0);
    playTone(1318.5, 0.22, 'sine', 0.06, 0.07);
  }

  // Three-note ascending arpeggio — the zone-complete "success" cue, fired
  // the same frame as the celebration card (see updateZoneLocks()).
  function playSuccess() {
    playTone(523.25, 0.16, 'triangle', 0.09, 0);
    playTone(659.25, 0.16, 'triangle', 0.09, 0.1);
    playTone(783.99, 0.26, 'triangle', 0.1, 0.2);
  }

  // Top-right mute toggle — parent-facing, independent of every other HUD
  // element above (own absolute position, not nested in hudTop's
  // pointer-events:none column).
  var muteBtn = document.createElement('button');
  muteBtn.type = 'button';
  muteBtn.setAttribute('aria-label', HUB_TEXTS.sound);
  muteBtn.style.cssText = 'position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.85);border:none;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:11;padding:0;';
  muteBtn.textContent = '🔊';
  muteBtn.addEventListener('click', function () {
    audioMuted = !audioMuted;
    muteBtn.textContent = audioMuted ? '🔇' : '🔊';
    resumeAudio();
  });
  container.appendChild(muteBtn);

  // ---------- PATH/CORRIDOR (zigzag forest path — replaces the old circular island) ----------
  // Each zone is one mission pack, ZONE_LENGTH apart along -Z. The corridor's
  // centerline snakes left/right (ZIGZAG_AMPLITUDE) so consecutive zones sit on
  // alternating sides, and the walkable width itself wobbles a bit
  // (CORRIDOR_WOBBLE_*) so the path edges read as organic, not ruler-straight.
  var ZONE_LENGTH = 16;
  var ZIGZAG_AMPLITUDE = 4;
  var CORRIDOR_HALF_WIDTH = 3.5; // ~7 units of walkable width (spec: 6-8)
  var CORRIDOR_WOBBLE_AMPLITUDE = 1.0;
  var CORRIDOR_WOBBLE_FREQ = 0.05;
  var START_BOUNDARY_Z = 4; // can't wander back past spawn

  // River/bridge footprint — declared up here (not down in ENVIRONMENT DECOR
  // where the river mesh itself is built) because pathCenterX/
  // corridorHalfWidthAt below need them: the bridge deck is a single flat,
  // non-curving object, but the zigzag curve's slope is nonzero at RIVER_Z,
  // so without this, the curve would shift up to ~1.3 units sideways across
  // the deck's own depth — Leo's movement clamp would then drag him off the
  // physical deck (built from one frozen pathCenterX(RIVER_Z) snapshot) and
  // around it instead of straight across. See createBridge()/river mesh in
  // ENVIRONMENT DECOR for the geometry that this has to stay consistent with.
  var RIVER_Z = -3;
  var RIVER_DEPTH = 3;
  var RIVER_HALF_SPAN = RIVER_DEPTH / 2 + 0.3; // deck's z half-extent + a hair of margin

  function zoneCenterZ(i) {
    return -(i + 0.5) * ZONE_LENGTH;
  }
  function pathCenterXCurve(z) {
    return Math.sin((z / ZONE_LENGTH) * Math.PI) * ZIGZAG_AMPLITUDE;
  }
  function corridorHalfWidthAtCurve(z) {
    return CORRIDOR_HALF_WIDTH + CORRIDOR_WOBBLE_AMPLITUDE * Math.sin(z * CORRIDOR_WOBBLE_FREQ + 1.7);
  }
  // Flat (non-curving) across the bridge's exact footprint, curved everywhere
  // else — these two wrappers are what both the movement clamp AND every
  // piece of decor (ground/treeline/gates/fog walls) read, so freezing the
  // curve here keeps the corridor's visual centerline and Leo's actual
  // walkable region in agreement at the one spot where the geometry can't
  // bend to follow it.
  function pathCenterX(z) {
    if (Math.abs(z - RIVER_Z) <= RIVER_HALF_SPAN) return pathCenterXCurve(RIVER_Z);
    return pathCenterXCurve(z);
  }
  function corridorHalfWidthAt(z) {
    if (Math.abs(z - RIVER_Z) <= RIVER_HALF_SPAN) return corridorHalfWidthAtCurve(RIVER_Z);
    return corridorHalfWidthAtCurve(z);
  }
  // z of the fog wall guarding the entrance to zone i (i = 1..N-1) — the
  // midpoint between zone i-1's and zone i's gates.
  function zoneBoundaryZ(i) {
    return -i * ZONE_LENGTH;
  }

  // ---------- GATE CONFIG (derived from real PACKS) ----------
  var realPacks = PACKS.filter(function (p) { return p.key !== 'all'; });

  function splitIconAndLabel(name) {
    var parts = name.split(' ');
    return { icon: parts[0], label: parts.slice(1).join(' ') };
  }

  var gateConfig = realPacks.map(function (pack, i) {
    var parsed = splitIconAndLabel(pack.name);
    var z = zoneCenterZ(i);
    return {
      id: i + 1,
      packKey: pack.key,
      name: parsed.label,
      icon: parsed.icon,
      x: pathCenterX(z),
      z: z,
      zoneIndex: i
    };
  });

  // Per-pack mission lists, computed ONCE. Several per-frame functions
  // (getPackCompletion / visibleSlotsForPack / updateProgressLabel) used to
  // rescan the whole missions array via filter() every frame per gate —
  // pointless work, since the mission→pack mapping never changes at runtime
  // (only the done Set does, and that's checked per item anyway).
  var missionsByPack = {};
  missions.forEach(function (m) {
    (missionsByPack[m.pack] = missionsByPack[m.pack] || []).push(m);
  });
  function packMissionList(packKey) {
    return missionsByPack[packKey] || [];
  }

  // Pack's first not-yet-completed mission; if the whole pack is done, reopen
  // its first mission (the panel renders the "completed" state).
  function getNextMissionIdForPack(packKey) {
    var packMissions = packMissionList(packKey);
    var next = packMissions.find(function (m) { return !done.has(m.id); });
    return next ? next.id : (packMissions[0] && packMissions[0].id);
  }

  var badgeSlots = {};
  gateConfig.forEach(function (cfg) {
    var slot = document.createElement('div');
    slot.style.cssText = 'width:30px;height:30px;border-radius:50%;background:#E5E2D8;border:2px solid #C5C1B0;display:flex;align-items:center;justify-content:center;font-size:15px;transition:opacity 240ms ease;';
    slot.textContent = cfg.icon;
    slot.title = cfg.name;
    slot.style.opacity = isZoneUnlocked(cfg.zoneIndex) ? '1' : '0.35';
    badgesEl.appendChild(slot);
    badgeSlots[cfg.id] = slot;
  });

  // ---------- ZONE THEMES (one per pack — sky/fog/ground/light/decor identity) ----------
  // Order matches gateConfig/realPacks order (zone 0 = first pack). Every
  // color-ish scene property (background, fog, hemisphere+sun light, badge
  // tint) lerps toward the current zone's palette each frame (~2s blend, see
  // updateZoneTheme in tick), so crossing a boundary is a soft wash, not a
  // hard cut. `makers` are the decor builders scattered along that zone's
  // corridor edges (function declarations below — hoisted, so forward
  // references from this table are safe).
  var ZONE_THEMES = [
    { key: 'energy', cardTitle: '⚡ Enerji Bölgesi', gateColor: 0xFFD23F, sky: 0x2a2d52, ground: 0x4a4d7a, hemiSky: 0x8a8fd0, hemiGround: 0x50538a, sun: 0xaab4ff, sunIntensity: 1.25, badgeBg: '#b9bdf0', makers: function () { return [makeElectricPole, makeElectricPole, makeLightningBolt]; }, growth: function () { return [{ make: makeElectricPole, name: 'elektrik direği' }, { make: makeElectricPole, name: 'elektrik direği' }, { make: makeLightningBolt, name: 'şimşek' }, { make: makeElectricPole, name: 'elektrik direği' }, { make: makeLightningBolt, name: 'şimşek' }, { make: makeLightningBolt, name: 'şimşek' }]; }, championName: 'enerji topu' },
    { key: 'target', cardTitle: '🎯 Hedef Sahası', gateColor: 0xFF5A5A, sky: 0xc8e6f5, ground: 0x7ab648, hemiSky: 0xeaf6ff, hemiGround: 0x7ab648, sun: 0xffffff, sunIntensity: 1.75, badgeBg: '#cfe9f8', makers: function () { return [makeTargetBoard, makeTree, makeTargetBoard]; }, growth: function () { return [{ make: makeTargetBoard, name: 'hedef tahtası' }, { make: makeTargetBoard, name: 'hedef tahtası' }, { make: makePlayFlag, name: 'bayrak' }, { make: makeTargetBoard, name: 'hedef tahtası' }, { make: makePlayFlag, name: 'bayrak' }, { make: makeTargetBoard, name: 'hedef tahtası' }]; }, championName: 'altın hedef' },
    { key: 'zen', cardTitle: '🍃 Zen Bahçesi', gateColor: 0x6FC48A, sky: 0xf5e6d3, ground: 0x4a7c6a, hemiSky: 0xffe9c9, hemiGround: 0x4a7c6a, sun: 0xffd9a0, sunIntensity: 1.15, badgeBg: '#f3e2c8', makers: function () { return [makeBamboo, makeStoneLantern, makeLotusPool, makeBamboo]; }, growth: function () { return [{ make: makeBamboo, name: 'bambu' }, { make: makeStoneLantern, name: 'taş fener' }, { make: makeLotusPool, name: 'lotus havuzu' }, { make: makeBamboo, name: 'bambu' }, { make: makeStoneLantern, name: 'taş fener' }, { make: makeLotusPool, name: 'lotus havuzu' }]; }, championName: 'altın fener' },
    { key: 'play', cardTitle: '👥 Oyun Alanı', gateColor: 0xFFB347, sky: 0x87ceeb, ground: 0xc46a20, hemiSky: 0xbfe8ff, hemiGround: 0xc46a20, sun: 0xffffff, sunIntensity: 1.8, badgeBg: '#bfe4f7', makers: function () { return [makeBench, makePlayFlag, makeSlide, makePlayFlag]; }, growth: function () { return [{ make: makePlayFlag, name: 'bayrak' }, { make: makeBench, name: 'bank' }, { make: makeSlide, name: 'kaydırak' }, { make: makePlayFlag, name: 'bayrak' }, { make: makeBench, name: 'bank' }, { make: makePlayFlag, name: 'bayrak' }]; }, championName: 'şampiyon bayrağı' },
    { key: 'home', cardTitle: '🏠 Ev Bahçesi', gateColor: 0xE8A23A, sky: 0xffe0a0, ground: 0x8FBF5A, hemiSky: 0xffd9a0, hemiGround: 0x8fbf5a, sun: 0xffb066, sunIntensity: 1.5, badgeBg: '#ffe7b8', makers: function () { return [makeFencePanel, makeGardenSwing, makeFlowerBed, makeMailbox]; }, growth: function () { return [{ make: makeFencePanel, name: 'çit' }, { make: makeFlowerBed, name: 'çiçek tarhı' }, { make: makeGardenSwing, name: 'salıncak' }, { make: makeFencePanel, name: 'çit' }, { make: makeMailbox, name: 'posta kutusu' }, { make: makeFlowerBed, name: 'çiçek tarhı' }]; }, championName: 'çiçek tacı' },
    { key: 'beach', cardTitle: '🏖️ Plaj', gateColor: 0xFFD98A, sky: 0x7ec8e3, ground: 0xf0dca0, hemiSky: 0xd8f1fb, hemiGround: 0xf0dca0, sun: 0xfff6e0, sunIntensity: 1.85, badgeBg: '#ffeccb', makers: function () { return [makePalmTree, makeBeachUmbrella, makePalmTree, makeSeashell]; }, growth: function () { return [{ make: makePalmTree, name: 'palmiye' }, { make: makeBeachUmbrella, name: 'güneş şemsiyesi' }, { make: makeSandcastle, name: 'kumdan kale' }, { make: makeSeashell, name: 'deniz kabuğu' }, { make: makePalmTree, name: 'palmiye' }, { make: makeSeashell, name: 'deniz kabuğu' }]; }, championName: 'altın güneş' }
  ];
  function themeForZone(i) {
    return ZONE_THEMES[THREE.MathUtils.clamp(i, 0, ZONE_THEMES.length - 1)];
  }

  // ---------- SCENE ----------
  var scene = new THREE.Scene();
  // Starts on zone 0's palette; updateZoneTheme() lerps everything from here.
  scene.background = new THREE.Color(ZONE_THEMES[0].sky);
  scene.fog = new THREE.Fog(ZONE_THEMES[0].sky, 18, 38);

  // ---------- THIRD-PERSON CHASE CAMERA (Subway Surfers / Temple Run style) ----------
  // Positioned behind + above Leo along his actual facing direction (not a
  // fixed world-space offset like the old side/top-down view), so it swings
  // around naturally as he turns instead of always looking down -Z.
  var CAM_DISTANCE_BACK = 6;
  var CAM_HEIGHT = 4;
  var CAM_LOOKAHEAD_DIST = 2;
  var CAM_LOOKAHEAD_HEIGHT = 0.8;
  var CAM_LAG_MOVING = 4.5;
  var CAM_LAG_IDLE = 3;

  var camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
  // Idle default assumes Leo is oriented toward -Z (the forest/gates) even
  // though his rig's own internal facing only updates once he actually moves
  // — this is purely the camera's own starting assumption, so the very first
  // frame already looks into the path instead of back at the spawn point.
  camera.position.set(0, CAM_HEIGHT, CAM_DISTANCE_BACK);
  camera.lookAt(0, CAM_LOOKAHEAD_HEIGHT, -CAM_LOOKAHEAD_DIST);

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  var hemiLight = new THREE.HemisphereLight(ZONE_THEMES[0].hemiSky, ZONE_THEMES[0].hemiGround, 1.1);
  scene.add(hemiLight);
  var sun = new THREE.DirectionalLight(ZONE_THEMES[0].sun, ZONE_THEMES[0].sunIntensity);
  sun.position.set(10, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 50;
  scene.add(sun);
  // The shadow camera is a ±20-unit box around the light's TARGET — with the
  // default target fixed at the origin, every shadow silently vanished once
  // Leo walked past z≈-20 (zones run to -96). Light + target now ride along
  // with Leo every frame (see updateMovement), so shadows keep the same
  // quality in every zone.
  scene.add(sun.target);

  // ---------- FOREST GROUND (long strip covering all zones — replaces the island) ----------
  var pathTotalLength = ZONE_LENGTH * realPacks.length + START_BOUNDARY_Z + 10;
  // Must cover the corridor's full lateral travel, not just its width: the
  // centerline itself swings ±ZIGZAG_AMPLITUDE, and treeline trees sit up to
  // (corridorHalfWidthAt + 0.8 + 1.2 random jitter) past THAT — leaving
  // ZIGZAG_AMPLITUDE out of this formula let worst-case treeline trees land
  // past the ground plane's edge (floating with no visible terrain under
  // them). +12 is a margin on top of the true worst case (~21), not the
  // worst case itself.
  var groundWidth = (ZIGZAG_AMPLITUDE + CORRIDOR_HALF_WIDTH + CORRIDOR_WOBBLE_AMPLITUDE) * 2 + 12;
  // One strip per zone (plus a spawn apron in front and a tail behind the
  // last zone), each in its zone's theme ground color — this is what makes
  // each zone read as its own place even before the decor registers. Still
  // `ground` as a single Group so the tap-to-move raycast has one target.
  // 6 shared materials for 8 strips; strips butt exactly at zone boundaries.
  var ground = new THREE.Group();
  var groundMats = ZONE_THEMES.map(function (t) {
    return new THREE.MeshStandardMaterial({ color: t.ground, flatShading: true });
  });
  function addGroundStrip(zFront, zBack, themeIdx) {
    var depth = zFront - zBack;
    var strip = new THREE.Mesh(new THREE.PlaneGeometry(groundWidth, depth, 1, 1), groundMats[themeIdx]);
    strip.rotation.x = -Math.PI / 2;
    strip.position.z = (zFront + zBack) / 2;
    strip.receiveShadow = true;
    ground.add(strip);
  }
  addGroundStrip(START_BOUNDARY_Z + 6, 0, 0); // spawn apron, zone 0's color
  for (var gsi = 0; gsi < realPacks.length; gsi++) {
    addGroundStrip(-gsi * ZONE_LENGTH, -(gsi + 1) * ZONE_LENGTH, THREE.MathUtils.clamp(gsi, 0, ZONE_THEMES.length - 1));
  }
  addGroundStrip(-realPacks.length * ZONE_LENGTH, -pathTotalLength + START_BOUNDARY_Z, ZONE_THEMES.length - 1); // tail
  scene.add(ground);

  function makeTree(x, z, scale) {
    var group = new THREE.Group();
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x8B5E34, flatShading: true })
    );
    trunk.position.y = 0.6;
    trunk.castShadow = true;
    group.add(trunk);

    // Fluffy, rounded canopy — a cluster of overlapping spheres instead of a
    // single sharp cone, for a softer storybook silhouette.
    var canopyMat = new THREE.MeshStandardMaterial({ color: 0x6FA84A, flatShading: true });
    var puffs = [
      { x: 0, y: 1.55, z: 0, r: 0.75 },
      { x: 0.28, y: 2.05, z: 0.12, r: 0.55 },
      { x: -0.3, y: 1.95, z: -0.08, r: 0.52 }
    ];
    puffs.forEach(function (p) {
      var puff = new THREE.Mesh(new THREE.SphereGeometry(p.r, 8, 8), canopyMat);
      puff.position.set(p.x, p.y, p.z);
      puff.castShadow = true;
      group.add(puff);
    });

    group.position.set(x, 0, z);
    group.scale.setScalar(scale || 1);
    return group;
  }

  // ---------- THEME DECOR BUILDERS ----------
  // One builder per prop; all share module-level materials (declared here,
  // reused across every instance) so 6 zones of decor stay draw-call-cheap.
  // Signature is uniformly (x, z) → Object3D positioned at ground level.
  var woodMat = new THREE.MeshStandardMaterial({ color: 0x8B5E34, flatShading: true });
  var darkPoleMat = new THREE.MeshStandardMaterial({ color: 0x3a3d66, flatShading: true });
  var energyOrbMat = new THREE.MeshStandardMaterial({ color: 0xFFE23F, flatShading: true, emissive: 0xFFD700, emissiveIntensity: 0.9 });
  var boltMat = new THREE.MeshStandardMaterial({ color: 0xFFE23F, flatShading: true, emissive: 0xFFD700, emissiveIntensity: 0.7 });
  var targetRedMat = new THREE.MeshStandardMaterial({ color: 0xE23B3B, flatShading: true, side: THREE.DoubleSide });
  var targetWhiteMat = new THREE.MeshStandardMaterial({ color: 0xF5F1E6, flatShading: true, side: THREE.DoubleSide });
  var bambooMat = new THREE.MeshStandardMaterial({ color: 0x7FA84E, flatShading: true });
  var stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a9a92, flatShading: true });
  var lanternGlowMat = new THREE.MeshStandardMaterial({ color: 0xFFE8B0, flatShading: true, emissive: 0xFFC860, emissiveIntensity: 0.5 });
  var poolMat = new THREE.MeshStandardMaterial({ color: 0x4FB8C4, flatShading: true, transparent: true, opacity: 0.85 });
  var lotusMat = new THREE.MeshStandardMaterial({ color: 0xF08CB4, flatShading: true });
  var benchMat = new THREE.MeshStandardMaterial({ color: 0xE85D3A, flatShading: true });
  var slideMat = new THREE.MeshStandardMaterial({ color: 0x4FA3E0, flatShading: true });
  var flagPoleMat = new THREE.MeshStandardMaterial({ color: 0xB0B0A8, flatShading: true });
  var flagMats = [
    new THREE.MeshStandardMaterial({ color: 0xE84040, flatShading: true, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: 0x40B0E8, flatShading: true, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: 0xFFD23F, flatShading: true, side: THREE.DoubleSide })
  ];
  var fenceMat = new THREE.MeshStandardMaterial({ color: 0xC49A6C, flatShading: true });
  var mailboxMat = new THREE.MeshStandardMaterial({ color: 0xD05050, flatShading: true });
  var palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0xA07850, flatShading: true });
  var palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x4FA84E, flatShading: true, side: THREE.DoubleSide });
  var umbrellaMat = new THREE.MeshStandardMaterial({ color: 0xFF6B6B, flatShading: true, side: THREE.DoubleSide });
  var shellMat = new THREE.MeshStandardMaterial({ color: 0xFFF0DC, flatShading: true });

  function makeElectricPole(x, z) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.4, 6), darkPoleMat);
    pole.position.y = 1.2;
    pole.castShadow = true;
    g.add(pole);
    var arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), darkPoleMat);
    arm.position.y = 2.25;
    g.add(arm);
    var orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), energyOrbMat);
    orb.position.y = 2.52;
    g.add(orb);
    g.position.set(x, 0, z);
    return g;
  }
  function makeLightningBolt(x, z) {
    // Three thin angled boxes forming a Z — reads as a bolt from any side.
    var g = new THREE.Group();
    var segs = [
      { y: 1.7, rz: -0.5 }, { y: 1.25, rz: 0.55 }, { y: 0.8, rz: -0.5 }
    ];
    segs.forEach(function (s) {
      var seg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.12), boltMat);
      seg.position.y = s.y;
      seg.rotation.z = s.rz;
      g.add(seg);
    });
    g.position.set(x, 0, z);
    return g;
  }
  function makeTargetBoard(x, z) {
    var g = new THREE.Group();
    [-0.22, 0.22].forEach(function (lx) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), woodMat);
      leg.position.set(lx, 0.5, 0);
      leg.rotation.x = lx < 0 ? 0.16 : -0.16;
      g.add(leg);
    });
    var rings = [
      { r: 0.55, mat: targetRedMat, zOff: 0 },
      { r: 0.38, mat: targetWhiteMat, zOff: 0.012 },
      { r: 0.2, mat: targetRedMat, zOff: 0.024 }
    ];
    rings.forEach(function (rDef) {
      var disc = new THREE.Mesh(new THREE.CircleGeometry(rDef.r, 20), rDef.mat);
      disc.position.set(0, 1.35, rDef.zOff);
      g.add(disc);
    });
    g.position.set(x, 0, z);
    // Face the corridor: boards on the left edge look right, and vice versa.
    g.rotation.y = x < pathCenterX(z) ? Math.PI / 2 : -Math.PI / 2;
    return g;
  }
  function makeBamboo(x, z) {
    var g = new THREE.Group();
    for (var i = 0; i < 3; i++) {
      var h = 1.8 + Math.random() * 0.9;
      var cane = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h, 5), bambooMat);
      cane.position.set((Math.random() - 0.5) * 0.5, h / 2, (Math.random() - 0.5) * 0.5);
      cane.rotation.z = (Math.random() - 0.5) * 0.12;
      cane.castShadow = true;
      g.add(cane);
    }
    g.position.set(x, 0, z);
    return g;
  }
  function makeStoneLantern(x, z) {
    var g = new THREE.Group();
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), stoneMat);
    base.position.y = 0.11;
    g.add(base);
    var column = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.55, 6), stoneMat);
    column.position.y = 0.5;
    g.add(column);
    var glow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), lanternGlowMat);
    glow.position.y = 0.9;
    g.add(glow);
    var cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.24, 4), stoneMat);
    cap.position.y = 1.15;
    cap.rotation.y = Math.PI / 4;
    cap.castShadow = true;
    g.add(cap);
    g.position.set(x, 0, z);
    return g;
  }
  function makeLotusPool(x, z) {
    var g = new THREE.Group();
    var pool = new THREE.Mesh(new THREE.CircleGeometry(0.7, 14), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.02;
    g.add(pool);
    var lotus = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), lotusMat);
    lotus.position.set(0.2, 0.08, -0.15);
    lotus.scale.y = 0.6;
    g.add(lotus);
    g.position.set(x, 0, z);
    return g;
  }
  function makeBench(x, z) {
    var g = new THREE.Group();
    var seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.09, 0.4), benchMat);
    seat.position.y = 0.42;
    seat.castShadow = true;
    g.add(seat);
    var back = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.34, 0.07), benchMat);
    back.position.set(0, 0.68, -0.17);
    g.add(back);
    [-0.45, 0.45].forEach(function (lx) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.34), woodMat);
      leg.position.set(lx, 0.21, 0);
      g.add(leg);
    });
    g.position.set(x, 0, z);
    g.rotation.y = x < pathCenterX(z) ? Math.PI / 2 : -Math.PI / 2;
    return g;
  }
  function makeSlide(x, z) {
    var g = new THREE.Group();
    var ramp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.7), slideMat);
    ramp.position.set(0, 0.62, 0);
    ramp.rotation.x = 0.62;
    ramp.castShadow = true;
    g.add(ramp);
    [-0.2, 0.2].forEach(function (lx) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 6), flagPoleMat);
      post.position.set(lx, 0.575, -0.72);
      g.add(post);
    });
    var platform = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.45), slideMat);
    platform.position.set(0, 1.12, -0.72);
    g.add(platform);
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    return g;
  }
  function makePlayFlag(x, z) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.7, 5), flagPoleMat);
    pole.position.y = 0.85;
    g.add(pole);
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.32), flagMats[Math.floor(Math.random() * flagMats.length)]);
    flag.position.set(0.3, 1.5, 0);
    g.add(flag);
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    return g;
  }
  function makeFencePanel(x, z) {
    var g = new THREE.Group();
    for (var i = -1; i <= 1; i++) {
      var slat = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.85, 0.05), fenceMat);
      slat.position.set(i * 0.32, 0.43, 0);
      slat.castShadow = true;
      g.add(slat);
    }
    [0.28, 0.6].forEach(function (ry) {
      var rail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.04), fenceMat);
      rail.position.set(0, ry, 0.045);
      g.add(rail);
    });
    g.position.set(x, 0, z);
    g.rotation.y = x < pathCenterX(z) ? Math.PI / 2 : -Math.PI / 2;
    return g;
  }
  function makeGardenSwing(x, z) {
    var g = new THREE.Group();
    [-0.5, 0.5].forEach(function (lx) {
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 6), woodMat);
      post.position.set(lx, 0.75, 0);
      post.castShadow = true;
      g.add(post);
    });
    var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), woodMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 1.5;
    g.add(bar);
    [-0.18, 0.18].forEach(function (lx) {
      var rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.95, 4), fenceMat);
      rope.position.set(lx, 1.0, 0);
      g.add(rope);
    });
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.22), fenceMat);
    seat.position.y = 0.52;
    g.add(seat);
    g.position.set(x, 0, z);
    g.rotation.y = x < pathCenterX(z) ? Math.PI / 2 : -Math.PI / 2;
    return g;
  }
  function makeFlowerBed(x, z) {
    var g = new THREE.Group();
    var border = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 0.6), woodMat);
    border.position.y = 0.07;
    g.add(border);
    var cluster = makeFlowerCluster(0, 0);
    cluster.position.y = 0.14;
    g.add(cluster);
    g.position.set(x, 0, z);
    return g;
  }
  function makeMailbox(x, z) {
    var g = new THREE.Group();
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.95, 5), woodMat);
    post.position.y = 0.475;
    g.add(post);
    var box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.24), mailboxMat);
    box.position.y = 1.05;
    box.castShadow = true;
    g.add(box);
    g.position.set(x, 0, z);
    g.rotation.y = x < pathCenterX(z) ? Math.PI / 2 : -Math.PI / 2;
    return g;
  }
  function makePalmTree(x, z) {
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.1, 6), palmTrunkMat);
    trunk.position.set(0.18, 1.0, 0);
    trunk.rotation.z = -0.18;
    trunk.castShadow = true;
    g.add(trunk);
    // Each leaf hinges at the trunk top: geometry translated so its inner
    // edge sits at the pivot, pivot yaws around the crown, leaf droops in
    // its own local frame — reads as a proper palm crown instead of loose
    // planes floating across the trunk.
    var topX = 0.42, topY = 2.05;
    var leafGeo = new THREE.PlaneGeometry(0.85, 0.24);
    leafGeo.translate(0.425, 0, 0);
    for (var i = 0; i < 5; i++) {
      var pivot = new THREE.Group();
      pivot.position.set(topX, topY, 0);
      pivot.rotation.y = -(i / 5) * Math.PI * 2;
      var leaf = new THREE.Mesh(leafGeo, palmLeafMat);
      leaf.rotation.z = -0.5;
      pivot.add(leaf);
      g.add(pivot);
    }
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    return g;
  }
  function makeBeachUmbrella(x, z) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 5), flagPoleMat);
    pole.position.y = 0.8;
    pole.rotation.z = 0.12;
    g.add(pole);
    var canopy = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.4, 8), umbrellaMat);
    canopy.position.set(0.18, 1.65, 0);
    canopy.castShadow = true;
    g.add(canopy);
    g.position.set(x, 0, z);
    return g;
  }
  function makeSeashell(x, z) {
    var shell = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), shellMat);
    shell.position.set(x, 0.06, z);
    shell.scale.set(1.3, 0.5, 1.1);
    return shell;
  }
  var sandMat = new THREE.MeshStandardMaterial({ color: 0xE8CC8A, flatShading: true });
  function makeSandcastle(x, z) {
    var g = new THREE.Group();
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.7), sandMat);
    base.position.y = 0.2;
    base.castShadow = true;
    g.add(base);
    [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].forEach(function (c) {
      var tower = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.35, 6), sandMat);
      tower.position.set(c[0], 0.55, c[1]);
      g.add(tower);
      var roof = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.16, 6), sandMat);
      roof.position.set(c[0], 0.8, c[1]);
      g.add(roof);
    });
    g.position.set(x, 0, z);
    return g;
  }

  // Champion prop — the "%100 complete" trophy floating above a zone's gate,
  // one theme-specific shape each, all sharing the gold emissive material so
  // they read as the same reward tier across zones. Slowly spun in tick()
  // alongside the existing sparkle ring.
  var championGoldMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, flatShading: true, emissive: 0xFFB300, emissiveIntensity: 0.75 });
  function makeChampionProp(themeKey) {
    var g = new THREE.Group();
    if (themeKey === 'energy') {
      var ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), championGoldMat);
      g.add(ball);
    } else if (themeKey === 'target') {
      var disc = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.1, 8, 18), championGoldMat);
      g.add(disc);
    } else if (themeKey === 'zen') {
      var lantern = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), championGoldMat);
      g.add(lantern);
      var cap = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.26, 4), championGoldMat);
      cap.position.y = 0.32;
      cap.rotation.y = Math.PI / 4;
      g.add(cap);
    } else if (themeKey === 'play') {
      for (var i = 0; i < 3; i++) {
        var flag = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 4), championGoldMat);
        var a = (i / 3) * Math.PI * 2;
        flag.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
        flag.rotation.z = Math.PI;
        g.add(flag);
      }
    } else if (themeKey === 'home') {
      var wreath = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.09, 8, 16), championGoldMat);
      g.add(wreath);
      for (var fi = 0; fi < 4; fi++) {
        var bud = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), lotusMat);
        var fa = (fi / 4) * Math.PI * 2;
        bud.position.set(Math.cos(fa) * 0.34, Math.sin(fa) * 0.34, 0);
        g.add(bud);
      }
    } else {
      var sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), championGoldMat);
      g.add(sunBall);
    }
    return g;
  }
  // Edge decor lining both sides of the corridor — the ground itself is a
  // plain rectangle; this boundary (following the zigzag + wobble) is what
  // makes the path read as organic/curvy instead of a straight lane. Each
  // zone draws from its own theme's prop builders (ZONE_THEMES.makers), so
  // walking into a new zone visibly changes the scenery, not just the colors.
  //
  // DECOR_CLEARANCE is the guaranteed gap between any decor object and the
  // corridor's walkable edge. Critically, the corridor edge must be evaluated
  // at the object's FINAL z — the old code computed the edge at the loop's tz
  // but then jittered the placed z by ±1, and near the bridge's frozen-curve
  // band that mismatch let trees land inside the walkable area (Leo visibly
  // walked into a bush at the bridge entrance in device testing).
  var DECOR_CLEARANCE = 0.8;
  var edgeDecorCounter = 0;
  for (var tz = START_BOUNDARY_Z - 2; tz > -pathTotalLength + START_BOUNDARY_Z; tz -= 4.5) {
    for (var side = -1; side <= 1; side += 2) {
      var propZ = tz + (Math.random() - 0.5) * 2;
      var zoneIdx = THREE.MathUtils.clamp(Math.floor(-propZ / ZONE_LENGTH), 0, ZONE_THEMES.length - 1);
      var zoneMakers = themeForZone(zoneIdx).makers();
      var maker = zoneMakers[edgeDecorCounter++ % zoneMakers.length];
      var propEdge = corridorHalfWidthAt(propZ) + DECOR_CLEARANCE + Math.random() * 1.2;
      var propX = pathCenterX(propZ) + side * propEdge;
      // makeTree keeps its (x, z, scale) signature; every themed builder is (x, z).
      scene.add(maker === makeTree ? makeTree(propX, propZ, 0.8 + Math.random() * 0.5) : maker(propX, propZ));
    }
  }

  function makeBush(x, z) {
    var bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x5BB85B, flatShading: true })
    );
    bush.position.set(x, 0.3, z);
    bush.scale.set(1.2, 0.8, 1.1);
    bush.castShadow = true;
    return bush;
  }

  function makeFlowerCluster(x, z) {
    var group = new THREE.Group();
    var colors = [0xFF6B9D, 0xFFD23F, 0xFF8C42];
    for (var i = 0; i < 3; i++) {
      var petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length], flatShading: true })
      );
      var angle = (i / 3) * Math.PI * 2;
      petal.position.set(Math.cos(angle) * 0.18, 0.15, Math.sin(angle) * 0.18);
      group.add(petal);
    }
    group.position.set(x, 0, z);
    return group;
  }

  // Slowly-rotating gold sparkle ring shown only once a pack is 100% complete.
  function makeChampionSparkle() {
    var count = 8;
    var radius = 1.3;
    var positions = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2;
      positions[i * 3] = Math.cos(a) * radius;
      positions[i * 3 + 1] = 1.8 + Math.sin(a * 2) * 0.15;
      positions[i * 3 + 2] = Math.sin(a) * radius;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var mat = new THREE.PointsMaterial({ color: 0xFFD700, size: 0.18, transparent: true, opacity: 0.9, depthWrite: false });
    return new THREE.Points(geo, mat);
  }

  // ---------- ENVIRONMENT DECOR (river + bridge + butterflies + birds) ----------
  // Pure atmosphere — none of this touches the corridor clamp, lock state, or
  // gate/panel logic. Placed in zone 0 (always unlocked) so every player sees
  // it regardless of progress. RIVER_Z/RIVER_DEPTH live up in PATH/CORRIDOR
  // now (pathCenterX/corridorHalfWidthAt need them) — kept here only as the
  // mesh-building code that has to stay geometrically consistent with them.
  var riverHalfWidth = corridorHalfWidthAtCurve(RIVER_Z) + 5; // runs out past the treeline on both sides

  var riverSegX = 14, riverSegZ = 4;
  var riverGeo = new THREE.PlaneGeometry(riverHalfWidth * 2, RIVER_DEPTH, riverSegX, riverSegZ);
  var riverMat = new THREE.MeshStandardMaterial({ color: 0x4FB8C4, flatShading: true, transparent: true, opacity: 0.88 });
  var river = new THREE.Mesh(riverGeo, riverMat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(pathCenterX(RIVER_Z), 0.02, RIVER_Z);
  scene.add(river);
  // Baseline vertex positions (flat) — each frame's wave displacement is
  // computed fresh from these, not accumulated, so it never drifts.
  var riverBasePositions = riverGeo.attributes.position.array.slice();

  function updateRiver(elapsedTime) {
    var posAttr = riverGeo.attributes.position;
    var arr = posAttr.array;
    for (var i = 0; i < arr.length; i += 3) {
      var lx = riverBasePositions[i];
      var ly = riverBasePositions[i + 1];
      arr[i + 2] = Math.sin(lx * 1.5 + elapsedTime * 2) * 0.05 + Math.sin(ly * 2 + elapsedTime * 1.3) * 0.03;
    }
    posAttr.needsUpdate = true;
  }

  // Bridge deck spans exactly the corridor's existing walkable width at
  // RIVER_Z (corridorHalfWidthAt() — the same formula updateMovement() already
  // clamps Leo's X to at every Z), so the unmodified movement clamp already
  // guarantees Leo can't step off the deck into the river — no clamp changes
  // needed anywhere.
  function createBridge() {
    var group = new THREE.Group();
    var bridgeHalfWidth = corridorHalfWidthAt(RIVER_Z);
    var plankMat = new THREE.MeshStandardMaterial({ color: 0x9C7144, flatShading: true });
    var plankCount = 7;
    var plankWidth = (bridgeHalfWidth * 2) / plankCount;
    for (var i = 0; i < plankCount; i++) {
      var plank = new THREE.Mesh(
        new THREE.BoxGeometry(plankWidth * 0.92, 0.12, RIVER_DEPTH + 0.6),
        plankMat
      );
      plank.position.set(-bridgeHalfWidth + plankWidth * (i + 0.5), 0.06, 0);
      plank.castShadow = true;
      plank.receiveShadow = true;
      group.add(plank);
    }
    var postMat = new THREE.MeshStandardMaterial({ color: 0x6F4E2C, flatShading: true });
    [-1, 1].forEach(function (side) {
      var rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, bridgeHalfWidth * 2 + 0.4, 6),
        postMat
      );
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 0.55, side * (RIVER_DEPTH / 2 + 0.2));
      group.add(rail);
      [-1, 0, 1].forEach(function (p) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 6), postMat);
        post.position.set(p * bridgeHalfWidth * 0.9, 0.27, side * (RIVER_DEPTH / 2 + 0.2));
        group.add(post);
      });
    });
    group.position.set(pathCenterX(RIVER_Z), 0, RIVER_Z);
    return group;
  }
  scene.add(createBridge());

  // Butterflies — wandering loosely around a random anchor point spread
  // across the whole corridor length, so they're visible no matter how far
  // the player has progressed. Each wing's geometry is translated so its
  // hinge edge sits at local x=0 — rotating the mesh on Y then opens/closes
  // it like a book, which is the flap motion.
  function makeWing(colorHex, mirrored) {
    var geo = new THREE.PlaneGeometry(0.26, 0.18);
    geo.translate(mirrored ? -0.13 : 0.13, 0, 0);
    var mat = new THREE.MeshStandardMaterial({ color: colorHex, flatShading: true, side: THREE.DoubleSide });
    return new THREE.Mesh(geo, mat);
  }
  function makeButterfly(colorHex) {
    var group = new THREE.Group();
    var wingL = makeWing(colorHex, true);
    var wingR = makeWing(colorHex, false);
    group.add(wingL, wingR);
    group.userData.wingL = wingL;
    group.userData.wingR = wingR;
    return group;
  }

  var butterflies = [];
  var BUTTERFLY_COLORS = [0xFF6B9D, 0xFFD23F, 0xFF8C42, 0xB686E0];
  var BUTTERFLY_COUNT = 4;
  for (var bi = 0; bi < BUTTERFLY_COUNT; bi++) {
    var butterfly = makeButterfly(BUTTERFLY_COLORS[bi % BUTTERFLY_COLORS.length]);
    var bAnchorZ = START_BOUNDARY_Z - 4 - Math.random() * (pathTotalLength - 14);
    var bAnchorX = pathCenterX(bAnchorZ) + (Math.random() - 0.5) * (corridorHalfWidthAt(bAnchorZ) * 2 + 3);
    butterfly.userData.anchorX = bAnchorX;
    butterfly.userData.anchorZ = bAnchorZ;
    butterfly.userData.anchorY = 1.1 + Math.random() * 0.6;
    butterfly.userData.phase = Math.random() * Math.PI * 2;
    butterfly.userData.speed = 0.6 + Math.random() * 0.4;
    butterfly.userData.flapSpeed = 9 + Math.random() * 3;
    scene.add(butterfly);
    butterflies.push(butterfly);
  }

  function updateButterflies(elapsedTime) {
    butterflies.forEach(function (b) {
      var t = elapsedTime * b.userData.speed + b.userData.phase;
      b.position.x = b.userData.anchorX + Math.sin(t) * 1.4;
      b.position.z = b.userData.anchorZ + Math.cos(t * 0.7) * 1.4;
      b.position.y = b.userData.anchorY + Math.sin(t * 1.8) * 0.25;
      b.rotation.y = t;
      var flap = 0.25 + Math.abs(Math.sin(elapsedTime * b.userData.flapSpeed)) * 0.85;
      b.userData.wingL.rotation.y = flap;
      b.userData.wingR.rotation.y = -flap;
    });
  }

  // Birds — slow, high-altitude back-and-forth glide across the whole
  // corridor length, with a baked-in "V" wing dihedral plus a small flap on
  // top so they read instantly as birds even at a glance from the ground.
  function makeBird() {
    var group = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, flatShading: true, side: THREE.DoubleSide });
    var wingGeo = new THREE.PlaneGeometry(0.7, 0.22);
    wingGeo.translate(0.35, 0, 0);
    var wingL = new THREE.Mesh(wingGeo, mat);
    var wingR = new THREE.Mesh(wingGeo, mat);
    wingR.scale.x = -1;
    group.add(wingL, wingR);
    group.userData.wingL = wingL;
    group.userData.wingR = wingR;
    return group;
  }

  var birds = [];
  var BIRD_COUNT = 3;
  for (var bd = 0; bd < BIRD_COUNT; bd++) {
    var bird = makeBird();
    bird.userData.phase = Math.random() * Math.PI * 2;
    bird.userData.speed = 0.08 + Math.random() * 0.04;
    bird.userData.laneX = (Math.random() - 0.5) * 10;
    bird.userData.altitude = 9 + Math.random() * 3;
    bird.userData.flapSpeed = 1.6 + Math.random() * 0.6;
    scene.add(bird);
    birds.push(bird);
  }

  function updateBirds(elapsedTime) {
    var loopLen = pathTotalLength + 20;
    birds.forEach(function (bird) {
      var t = (elapsedTime * bird.userData.speed + bird.userData.phase) % (Math.PI * 2);
      var travel = Math.sin(t) * 0.5 + 0.5;
      bird.position.z = START_BOUNDARY_Z + 6 - travel * loopLen;
      bird.position.x = bird.userData.laneX + Math.sin(t * 2) * 2;
      bird.position.y = bird.userData.altitude + Math.sin(t * 3) * 0.4;
      bird.rotation.y = Math.cos(t) >= 0 ? 0 : Math.PI;
      var flap = Math.sin(elapsedTime * bird.userData.flapSpeed) * 0.3;
      bird.userData.wingL.rotation.z = 0.5 + flap;
      bird.userData.wingR.rotation.z = -0.5 - flap;
    });
  }

  // ---------- GATE MARKERS (one per real mission pack) ----------
  var gateMeshes = {};

  // Growth decor flanking each gate along BOTH sides of the corridor, always
  // outside the walkable width (pathCenterX ± corridorHalfWidthAt, plus
  // DECOR_CLEARANCE) — the old circular ring (radius 2.0 around the gate,
  // which itself sits ON the corridor centerline) put bushes/trees inside
  // Leo's walk area, so he visibly clipped through them on device. Slots are
  // created once (hidden) and revealed cumulatively as the pack's real
  // completion % crosses each threshold — see updateGateDecor().
  // side: which corridor edge; dz: z offset from the gate; push: extra
  // outward offset past the clearance so the six don't form a straight line.
  // Slot i holds the zone theme's growth item i (ZONE_THEMES[].growth) — one
  // slot is revealed per completed mission, so with the standard 6-mission
  // packs the zone fills up exactly in step with real progress (2 items ≈
  // 33%, 4 ≈ 66%, all 6 + champion prop at 100%).
  var DECOR_SLOT_DEFS = [
    { side: -1, dz: -2.2, push: 0.2 },
    { side: 1, dz: -2.2, push: 0.5 },
    { side: -1, dz: 0, push: 0.4 },
    { side: 1, dz: 0, push: 0.2 },
    { side: -1, dz: 2.2, push: 0.5 },
    { side: 1, dz: 2.2, push: 0.3 }
  ];

  function getPackCompletion(packKey) {
    var packMissions = packMissionList(packKey);
    if (packMissions.length === 0) return 0;
    var doneCount = packMissions.filter(function (m) { return done.has(m.id); }).length;
    return doneCount / packMissions.length;
  }

  // How many of a gate's 6 growth slots should be visible — one per done
  // mission, scaled if a pack ever has ≠6 missions, and never "full" before
  // the pack really is 100% (the champion moment stays exclusive to done).
  function visibleSlotsForPack(packKey) {
    var frac = getPackCompletion(packKey);
    if (frac >= 1) return DECOR_SLOT_DEFS.length;
    return Math.min(DECOR_SLOT_DEFS.length - 1, Math.floor(frac * DECOR_SLOT_DEFS.length + 1e-6));
  }

  // Which zone Leo is physically standing in right now, purely from his world
  // Z (zone i spans roughly [-(i+1)*ZONE_LENGTH, -i*ZONE_LENGTH]) — used only
  // for the progress label below, never for lock/clamp logic.
  function currentZoneIndex() {
    var idx = Math.floor(-leo.group.position.z / ZONE_LENGTH);
    return THREE.MathUtils.clamp(idx, 0, gateConfig.length - 1);
  }

  // Updates the "N missions left in this zone" pill from the real done Set —
  // guarded so the DOM text is only touched when the zone or count actually
  // changes, not every frame.
  var lastProgressCacheKey = null;
  function updateProgressLabel() {
    var idx = currentZoneIndex();
    var cfg = gateConfig[idx];
    var packMissions = packMissionList(cfg.packKey);
    var doneCount = packMissions.filter(function (m) { return done.has(m.id); }).length;
    var remaining = packMissions.length - doneCount;
    var cacheKey = idx + ':' + remaining;
    if (cacheKey === lastProgressCacheKey) return;
    lastProgressCacheKey = cacheKey;
    progressLabelEl.textContent = remaining > 0
      ? (cfg.icon + ' ' + cfg.name + ' — ' + HUB_TEXTS.missionsLeft(remaining))
      : (cfg.icon + ' ' + cfg.name + ' ' + HUB_TEXTS.zoneDoneLabel);
  }

  // ---------- ZONE THEME TRANSITIONS ----------
  // Watches which zone Leo is standing in; on a change it (a) shows the zone
  // name card, (b) tints the active badge slot, and (c) retargets the color
  // set below — the actual scene colors then chase those targets with an
  // exponential lerp (~2s to visually settle), so crossing a boundary reads
  // as the light changing around you rather than a scene swap.
  var themeTargets = {
    sky: new THREE.Color(ZONE_THEMES[0].sky),
    hemiSky: new THREE.Color(ZONE_THEMES[0].hemiSky),
    hemiGround: new THREE.Color(ZONE_THEMES[0].hemiGround),
    sun: new THREE.Color(ZONE_THEMES[0].sun),
    sunIntensity: ZONE_THEMES[0].sunIntensity
  };
  var themedZoneIdx = -1;
  function updateZoneTheme(delta) {
    var idx = currentZoneIndex();
    if (idx !== themedZoneIdx) {
      var isFirstApply = themedZoneIdx === -1;
      themedZoneIdx = idx;
      var th = themeForZone(idx);
      // Soft two-note "you've arrived somewhere new" cue — skipped on the
      // initial theme apply at load, which isn't an arrival.
      if (!isFirstApply) {
        playTone(659.25, 0.14, 'sine', 0.05, 0);
        playTone(987.77, 0.18, 'sine', 0.04, 0.09);
      }
      themeTargets.sky.setHex(th.sky);
      themeTargets.hemiSky.setHex(th.hemiSky);
      themeTargets.hemiGround.setHex(th.hemiGround);
      themeTargets.sun.setHex(th.sun);
      themeTargets.sunIntensity = th.sunIntensity;
      showZoneCard(th);
      gateConfig.forEach(function (cfg) {
        badgeSlots[cfg.id].style.background = cfg.zoneIndex === idx ? th.badgeBg : '#E5E2D8';
      });
    }
    // time-constant 0.55s → ~97% settled after 2s, frame-rate independent
    var k = 1 - Math.exp(-delta / 0.55);
    scene.background.lerp(themeTargets.sky, k);
    scene.fog.color.copy(scene.background);
    hemiLight.color.lerp(themeTargets.hemiSky, k);
    hemiLight.groundColor.lerp(themeTargets.hemiGround, k);
    sun.color.lerp(themeTargets.sun, k);
    sun.intensity += (themeTargets.sunIntensity - sun.intensity) * k;
    // Undissolved fog walls keep matching the sky so they still read as mist
    // (they were hard-coded to the old single cream palette).
    for (var fwi = 0; fwi < fogWalls.length; fwi++) {
      if (!fogWalls[fwi].dissolved) fogWalls[fwi].wall.material.color.copy(scene.background);
    }
  }

  // Floating name label above each gate — a canvas-texture Sprite, not CSS3D/DOM:
  // Sprites always billboard toward the camera and scale with perspective for
  // free, so it stays readable from a distance with zero added per-frame cost.
  function createLabelSprite(text) {
    var fontSize = 30;
    var paddingX = 24, paddingY = 16;
    var font = '600 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    var measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = font;
    var textWidth = measureCtx.measureText(text).width;

    var w = Math.ceil(textWidth + paddingX * 2);
    var h = fontSize + paddingY * 2;
    var supersample = 2;
    var canvas = document.createElement('canvas');
    canvas.width = w * supersample;
    canvas.height = h * supersample;
    var ctx = canvas.getContext('2d');
    ctx.scale(supersample, supersample);
    ctx.font = font;

    var r = h / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(w, 0, w, h, r);
    ctx.arcTo(w, h, 0, h, r);
    ctx.arcTo(0, h, 0, 0, r);
    ctx.arcTo(0, 0, w, 0, r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#3a2a1a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 1);

    var texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    var material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    var sprite = new THREE.Sprite(material);
    var worldHeight = 0.85;
    sprite.scale.set(worldHeight * (w / h), worldHeight, 1);
    return sprite;
  }

  function createGateMesh(cfg) {
    var group = new THREE.Group();

    // Ring tinted with the zone's own theme color so each gate visually
    // belongs to its zone (they were all the same gold before).
    var gateColor = themeForZone(cfg.zoneIndex).gateColor;
    var ringGeo = new THREE.TorusGeometry(0.9, 0.12, 8, 24);
    var ringMat = new THREE.MeshStandardMaterial({
      color: gateColor, flatShading: true,
      emissive: gateColor, emissiveIntensity: 0.35
    });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 1.1;
    ring.castShadow = true;
    ring.userData.baseY = 1.1;
    // each gate bobs/breathes slightly out of phase so they don't all move in lockstep
    ring.userData.phase = cfg.id * 1.7;
    group.add(ring);

    // Fixed-height name label — intentionally does NOT bob with the ring, so the
    // text stays steady/readable even while the ring is bobbing/breathing.
    var label = createLabelSprite(cfg.icon + ' ' + cfg.name);
    label.position.set(0, ring.userData.baseY + 1.25, 0);
    group.add(label);

    var poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.1, 8);
    var poleMat = new THREE.MeshStandardMaterial({ color: 0x888780, flatShading: true });
    var poleL = new THREE.Mesh(poleGeo, poleMat);
    poleL.position.set(-0.9, 0.55, 0);
    group.add(poleL);
    var poleR = poleL.clone();
    poleR.position.x = 0.9;
    group.add(poleR);

    var baseGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.15, 16);
    var baseMat = new THREE.MeshStandardMaterial({ color: 0xE8E4D8, flatShading: true });
    var base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.075;
    base.receiveShadow = true;
    group.add(base);

    // Growth decor — created hidden; updateGateDecor() reveals these one per
    // completed mission (see visibleSlotsForPack). Items come from the zone
    // theme's growth list, so an energy zone grows poles/bolts while the
    // beach grows palms/sandcastles. World-positioned (added to the scene,
    // not this group): the group below is rotated by lookAt(), so
    // corridor-relative offsets computed here would get skewed if parented
    // to it — and these positions MUST track the corridor math exactly to
    // guarantee the walkable-area clearance.
    var growthItems = themeForZone(cfg.zoneIndex).growth();
    var decorSlots = DECOR_SLOT_DEFS.map(function (def, i) {
      var slotZ = cfg.z + def.dz;
      var slotX = pathCenterX(slotZ) + def.side * (corridorHalfWidthAt(slotZ) + DECOR_CLEARANCE + def.push);
      var item = growthItems[i % growthItems.length];
      var obj = item.make(slotX, slotZ);
      obj.visible = false;
      obj.userData.rewardName = item.name;
      scene.add(obj);
      return obj;
    });
    var champion = makeChampionSparkle();
    champion.visible = false;
    group.add(champion);
    // Theme trophy floating above the ring — only shown at 100% (champion).
    var championProp = makeChampionProp(themeForZone(cfg.zoneIndex).key);
    championProp.position.y = 2.9;
    championProp.visible = false;
    group.add(championProp);

    group.position.set(cfg.x, 0, cfg.z);
    group.lookAt(0, 0, 0);
    group.userData.ring = ring;
    group.userData.decorSlots = decorSlots;
    group.userData.champion = champion;
    group.userData.championProp = championProp;
    group.userData.visibleSlots = -1; // force the first updateGateDecor() call to apply
    return group;
  }
  gateConfig.forEach(function (cfg) {
    var mesh = createGateMesh(cfg);
    scene.add(mesh);
    gateMeshes[cfg.id] = mesh;
  });

  // ---------- FOG WALLS (one per locked zone entrance — dissolves on unlock) ----------
  // Same fade + retreat + reveal-trees technique as the fog wall in
  // prototypes/jumvi-forest-mini-example.html's growForest()/animateFog() —
  // ported to run off the shared tick() clock instead of its own
  // requestAnimationFrame loop (see updateFogDissolves() below).
  function createFogWall(zoneIndex) {
    var z = zoneBoundaryZ(zoneIndex);
    var x = pathCenterX(z);
    var width = corridorHalfWidthAt(z) * 2 + 6;

    var wall = new THREE.Mesh(
      new THREE.PlaneGeometry(width, 7),
      new THREE.MeshBasicMaterial({ color: 0xFFE8C4, transparent: true, opacity: 0.92, side: THREE.DoubleSide })
    );
    wall.position.set(x, 3, z);
    scene.add(wall);

    var particles = new THREE.Group();
    for (var i = 0; i < 18; i++) {
      var dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.25 + Math.random() * 0.3, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
      );
      dot.position.set(x + (Math.random() - 0.5) * width * 0.9, 1 + Math.random() * 5, z + (Math.random() - 0.5) * 0.2);
      particles.add(dot);
    }
    scene.add(particles);

    return { zoneIndex: zoneIndex, wall: wall, particles: particles, baseZ: z, baseX: x, dissolving: null, dissolved: false };
  }

  var fogWalls = [];
  for (var fwIdx = 1; fwIdx < gateConfig.length; fwIdx++) {
    fogWalls.push(createFogWall(fwIdx));
  }

  // ---------- COACH LEO (from shared module — no character code duplicated here) ----------
  // Real GLTF model approved by user comparison — replaces the procedural
  // rig as Leo's visible representation (rig is still built as the fallback
  // inside createCoachLeo() if the model fails to load).
  var USE_LEO_MODEL = true;
  var leo = createCoachLeo(THREE, { useModel: USE_LEO_MODEL, modelUrl: './prototypes/textured_mesh_optimized.glb' });
  scene.add(leo.group);

  // ---------- INPUT: KEYBOARD ----------
  var keys = { f: false, b: false, l: false, r: false };
  function onKeyDown(e) {
    resumeAudio(); // first real keypress is as good a "user gesture" as any
    dismissCoachBubble();
    if (e.key === 'w' || e.key === 'ArrowUp') keys.f = true;
    if (e.key === 's' || e.key === 'ArrowDown') keys.b = true;
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.l = true;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.r = true;
  }
  function onKeyUp(e) {
    if (e.key === 'w' || e.key === 'ArrowUp') keys.f = false;
    if (e.key === 's' || e.key === 'ArrowDown') keys.b = false;
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.l = false;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.r = false;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // ---------- INPUT: MOBILE TAP-TO-MOVE ----------
  // Replaces the joystick as the primary mobile control — testers found
  // holding/rotating a stick overly twitchy and unnatural. Tapping anywhere
  // on the 3D view raycasts against the ground plane; Leo then walks toward
  // that world point on its own, even after the finger lifts, until it
  // arrives or a new tap retargets it. Taps on other HUD elements (badges,
  // hint text, mute button, mission panel) never reach this listener since
  // those are separate DOM nodes stacked above the canvas — only touches
  // that land on the canvas itself trigger a retarget.
  var raycaster = new THREE.Raycaster();
  var moveTargetActive = false;
  var moveTarget = { x: 0, z: 0 };
  var MOVE_ARRIVE_DIST = 0.45; // close enough to the target to stop walking
  // Tightened from 2.2: with the old radius every tap shorter than ~2 units
  // spent its WHOLE trip inside the slow-down zone, so short hops crawled —
  // a big part of why the control read as "heavy". 1.2 keeps the gentle stop
  // but lets Leo actually hit stride on medium taps.
  var MOVE_SLOW_RADIUS = 1.2;

  // Target ring — a small flat ring lying on the ground where the player
  // tapped. Scales in on each new tap, fades out once Leo arrives (or the
  // target is cancelled by WASD). One reusable mesh, never re-created.
  var targetRing = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.position.y = 0.03; // just above the ground plane, below Leo
  targetRing.visible = false;
  scene.add(targetRing);
  // Dark rim just under/around the white ring — pure white alone disappears
  // on the light beach-sand and backyard-grass grounds; the rim keeps the
  // marker visible on every zone's ground color. Child of the ring so it
  // inherits position/scale/visibility automatically.
  var targetRingRim = new THREE.Mesh(
    new THREE.RingGeometry(0.24, 0.46, 24),
    new THREE.MeshBasicMaterial({ color: 0x33291c, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  targetRingRim.position.z = -0.005; // hair *behind* the ring in its local plane (renders below)
  targetRing.add(targetRingRim);
  var targetRingAnim = null; // { mode: 'in' | 'out', startTime }

  function showTargetRing(x, z) {
    targetRing.position.x = x;
    targetRing.position.z = z;
    targetRing.visible = true;
    targetRingAnim = { mode: 'in', startTime: performance.now() };
  }
  function fadeOutTargetRing() {
    if (targetRing.visible && (!targetRingAnim || targetRingAnim.mode !== 'out')) {
      targetRingAnim = { mode: 'out', startTime: performance.now() };
    }
  }
  function updateTargetRing() {
    if (!targetRingAnim) return;
    var elapsed = performance.now() - targetRingAnim.startTime;
    if (targetRingAnim.mode === 'in') {
      var t = Math.min(elapsed / 220, 1);
      targetRing.material.opacity = 0.85 * t;
      targetRingRim.material.opacity = 0.45 * t;
      var s = 1.5 - 0.5 * t; // shrinks from wide to snug — reads as "locking on"
      targetRing.scale.set(s, s, 1);
      if (t >= 1) targetRingAnim = null;
    } else {
      var t2 = Math.min(elapsed / 260, 1);
      targetRing.material.opacity = 0.85 * (1 - t2);
      targetRingRim.material.opacity = 0.45 * (1 - t2);
      if (t2 >= 1) { targetRing.visible = false; targetRingAnim = null; }
    }
  }

  // isDrag: touchmove retarget while the finger is held down — updates the
  // destination (and slides the ring along) without replaying the ring's
  // lock-on animation every frame.
  function setMoveTargetFromClient(clientX, clientY, isDrag) {
    if (panelOpen) return; // controls off while the mission sheet is up
    var rect = renderer.domElement.getBoundingClientRect();
    var ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    var ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    var hit = raycaster.intersectObject(ground, true)[0];
    if (!hit) return;
    resumeAudio(); // a tap is a real user gesture too
    // Clamp the target into the actually-walkable corridor (same clamp
    // updateMovement applies to Leo himself) — otherwise a tap on the trees
    // or past a fog wall would leave Leo marching against the boundary
    // forever, never getting within MOVE_ARRIVE_DIST.
    var farLimit = null;
    for (var fwi = 0; fwi < fogWalls.length; fwi++) {
      if (!fogWalls[fwi].dissolved) { farLimit = fogWalls[fwi].baseZ + 1.5; break; }
    }
    if (farLimit === null) farLimit = zoneCenterZ(gateConfig.length - 1) - 6;
    var tz = THREE.MathUtils.clamp(hit.point.z, farLimit, START_BOUNDARY_Z);
    var tCenter = pathCenterX(tz);
    var tHalf = corridorHalfWidthAt(tz);
    moveTarget.x = THREE.MathUtils.clamp(hit.point.x, tCenter - tHalf, tCenter + tHalf);
    moveTarget.z = tz;
    moveTargetActive = true;
    if (isDrag) {
      targetRing.position.x = moveTarget.x;
      targetRing.position.z = moveTarget.z;
    } else {
      showTargetRing(moveTarget.x, moveTarget.z);
    }
  }
  // Touch-follow steering: touchstart picks the destination, and holding the
  // finger down keeps re-picking it every touchmove — so dragging steers Leo
  // continuously (the "follow my finger" scheme every mobile ARPG uses)
  // while a plain tap still behaves as before. touchFollowing gates the move
  // handler so stray touchmoves that didn't start on the canvas are ignored.
  var touchFollowing = false;
  renderer.domElement.addEventListener('touchstart', function (e) {
    touchFollowing = true;
    dismissCoachBubble();
    var t = e.changedTouches[0];
    setMoveTargetFromClient(t.clientX, t.clientY, false);
  }, { passive: true });
  renderer.domElement.addEventListener('touchmove', function (e) {
    if (!touchFollowing) return;
    var t = e.changedTouches[0];
    setMoveTargetFromClient(t.clientX, t.clientY, true);
  }, { passive: true });
  renderer.domElement.addEventListener('touchend', function () { touchFollowing = false; }, { passive: true });
  renderer.domElement.addEventListener('touchcancel', function () { touchFollowing = false; }, { passive: true });

  // ---------- MOVEMENT (momentum-based; world position only — visuals owned by leo module) ----------
  var velocity = new THREE.Vector3();
  var facing = 0;
  // maxSpeed stays at the "slow enough to notice the scenery" 4.2 from
  // device testing; accel back up to 22 so reaching that speed feels snappy
  // instead of mushy — top speed and stopping behavior are unchanged.
  var maxSpeed = 4.2, accel = 22, friction = 14;
  var stepTimer = 0; // footstep sound cadence — see updateMovement()
  // Camera's own facing — separate from Leo's (see updateMovement()), starts
  // at PI to match the idle camera setup above (looking toward -Z).
  var cameraFacing = Math.PI;

  function updateMovement(delta) {
    var ix = 0, iz = 0;
    if (!panelOpen) {
      if (keys.f) iz -= 1;
      if (keys.b) iz += 1;
      if (keys.l) ix -= 1;
      if (keys.r) ix += 1;
    }
    if (keys.f || keys.b || keys.l || keys.r) {
      if (moveTargetActive) fadeOutTargetRing();
      moveTargetActive = false; // WASD takes over from an in-progress tap-to-move walk
    }

    // Tap-to-move steering: world-space direction straight toward the tapped
    // ground point (not camera-relative — there's no "stick angle" to
    // reinterpret here, just a destination). Only kicks in when WASD isn't
    // already driving ix/iz above.
    var tapSlowFactor = 1;
    if (ix === 0 && iz === 0 && moveTargetActive) {
      var dxT = moveTarget.x - leo.group.position.x;
      var dzT = moveTarget.z - leo.group.position.z;
      var distT = Math.sqrt(dxT * dxT + dzT * dzT);
      if (distT < MOVE_ARRIVE_DIST) {
        moveTargetActive = false;
        fadeOutTargetRing();
      } else {
        ix = dxT / distT;
        iz = dzT / distT;
        tapSlowFactor = Math.min(1, distT / MOVE_SLOW_RADIUS);
      }
    }

    var len = Math.sqrt(ix * ix + iz * iz);
    var moving = len > 0.05;
    var targetFacing = facing;

    if (moving) {
      ix /= len; iz /= len;
      velocity.x += ix * accel * delta;
      velocity.z += iz * accel * delta;
      var speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
      var speedCap = maxSpeed * tapSlowFactor; // eases toward 0 as Leo nears a tap target; always 1 for WASD
      if (speed > speedCap) {
        velocity.x = (velocity.x / speed) * speedCap;
        velocity.z = (velocity.z / speed) * speedCap;
      }
      targetFacing = Math.atan2(ix, iz);
    } else {
      var decay = Math.max(0, 1 - friction * delta);
      velocity.x *= decay; velocity.z *= decay;
    }

    var nextX = leo.group.position.x + velocity.x * delta;
    var nextZ = leo.group.position.z + velocity.z * delta;

    // Corridor clamp (replaces the old circular island clamp). The walkable
    // width follows the zigzag centerline + organic wobble; the far edge is
    // hard-capped at the next LOCKED zone's fog wall — this is the lock
    // mechanic's actual physical enforcement. checkGateProximity() never
    // needs to know about lock state because a locked gate is simply
    // unreachable: Leo physically cannot walk past its fog wall.
    var farLimit = null;
    for (var fwi = 0; fwi < fogWalls.length; fwi++) {
      if (!fogWalls[fwi].dissolved) { farLimit = fogWalls[fwi].baseZ + 1.5; break; }
    }
    if (farLimit === null) farLimit = zoneCenterZ(gateConfig.length - 1) - 6; // all zones unlocked — roam to the end

    nextZ = THREE.MathUtils.clamp(nextZ, farLimit, START_BOUNDARY_Z);
    var corridorCenterX = pathCenterX(nextZ);
    var corridorHalf = corridorHalfWidthAt(nextZ);
    if (nextX < corridorCenterX - corridorHalf || nextX > corridorCenterX + corridorHalf) {
      velocity.x *= 0.3;
    }
    nextX = THREE.MathUtils.clamp(nextX, corridorCenterX - corridorHalf, corridorCenterX + corridorHalf);
    if (nextZ === farLimit || nextZ === START_BOUNDARY_Z) {
      velocity.z *= 0.3;
    }

    leo.group.position.x = nextX;
    leo.group.position.z = nextZ;
    facing = leo.getFacing();

    // Keep the sun (and its ±20-unit shadow box) centered on Leo — see the
    // comment at the light's creation.
    sun.position.set(nextX + 10, 16, nextZ + 8);
    sun.target.position.set(nextX, 0, nextZ);

    var speedNow = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    leo.update(delta, { moving: moving, speed: speedNow, maxSpeed: maxSpeed, targetFacing: targetFacing });

    // Footstep cadence — faster steps at higher speed, silent the instant
    // Leo stops (reset to 0 so the very next step after a pause starts
    // clean instead of firing immediately from a stale leftover timer).
    if (moving) {
      var stepInterval = THREE.MathUtils.lerp(0.42, 0.2, speedNow / maxSpeed);
      stepTimer += delta;
      if (stepTimer >= stepInterval) {
        stepTimer -= stepInterval;
        playStep();
      }
    } else {
      stepTimer = 0;
    }

    // ---------- THIRD-PERSON CHASE CAMERA ----------
    // cameraFacing trails the real facing with its own (slower) lag, on top
    // of the turn-smoothing already applied to `facing` itself inside
    // leo.update() — two layers of smoothing is what keeps the camera from
    // snapping or jittering when Leo changes direction quickly.
    //
    // Only chased WHILE MOVING: Leo's rig facing starts at 0 (looking back
    // at the camera — a nice idle pose) and never updates until he walks,
    // so an idle chase would slowly spin the opening camera 180° away from
    // the forest toward the empty spawn area, and the kid's first "up" tap
    // would then walk Leo toward the screen. Standing still now simply
    // leaves the camera where it was.
    var camLagFactor = moving ? CAM_LAG_MOVING : CAM_LAG_IDLE;
    if (moving) {
      var facingDiff = facing - cameraFacing;
      while (facingDiff > Math.PI) facingDiff -= Math.PI * 2;
      while (facingDiff < -Math.PI) facingDiff += Math.PI * 2;
      cameraFacing += facingDiff * Math.min(delta * camLagFactor, 1);
    }

    var forwardX = Math.sin(cameraFacing), forwardZ = Math.cos(cameraFacing);
    var targetCamX = leo.group.position.x - forwardX * CAM_DISTANCE_BACK;
    var targetCamZ = leo.group.position.z - forwardZ * CAM_DISTANCE_BACK;

    camera.position.x += (targetCamX - camera.position.x) * Math.min(delta * camLagFactor, 1);
    camera.position.z += (targetCamZ - camera.position.z) * Math.min(delta * camLagFactor, 1);
    camera.position.y += (CAM_HEIGHT - camera.position.y) * Math.min(delta * camLagFactor, 1);

    var lookAtX = leo.group.position.x + forwardX * CAM_LOOKAHEAD_DIST;
    var lookAtZ = leo.group.position.z + forwardZ * CAM_LOOKAHEAD_DIST;
    camera.lookAt(lookAtX, CAM_LOOKAHEAD_HEIGHT, lookAtZ);
  }

  // ---------- HUB MISSION PANEL (hub-native bottom sheet) ----------
  // Replaces the shared #backdrop/#sheet flow entirely FOR THE HUB: the app's
  // own mission panel + its Next/smart-pick logic are never invoked from here
  // anymore (that logic deliberately hops across packs for variety, which is
  // exactly wrong inside a themed zone). This panel renders the SAME mission
  // data (missions/done/MISSION_ICONS — nothing re-authored) in a cozy
  // storybook bottom sheet, themed per zone, and its navigation is locked to
  // the current pack. Done/undo route through the real app flow via
  // opts.markMissionDone / opts.undoMissionDone, so badges/streak/persist all
  // behave exactly as if the tap happened in the Missions tab.
  var markMissionDoneFn = opts.markMissionDone;
  var undoMissionDoneFn = opts.undoMissionDone;

  // Per-zone panel palette (spec'd): bg gradient + accent + readable text.
  var PANEL_THEMES = {
    energy: { bg1: '#3b3066', bg2: '#282250', accent: '#FFD23F', text: '#FFF4DC', boxBg: 'rgba(255,255,255,0.10)', onAccent: '#3a2a00' },
    target: { bg1: '#3f7fc4', bg2: '#2c5f9e', accent: '#FF5A5A', text: '#FFFFFF', boxBg: 'rgba(255,255,255,0.14)', onAccent: '#FFFFFF' },
    zen: { bg1: '#f7ecd9', bg2: '#efdfc2', accent: '#4a8c5f', text: '#3a2a1a', boxBg: 'rgba(74,124,106,0.12)', onAccent: '#FFFFFF' },
    play: { bg1: '#ef8b33', bg2: '#d96f1e', accent: '#FFD23F', text: '#FFFFFF', boxBg: 'rgba(255,255,255,0.16)', onAccent: '#4a3000' },
    home: { bg1: '#f5c07a', bg2: '#e29b52', accent: '#6F4E2C', text: '#3a2a1a', boxBg: 'rgba(255,255,255,0.28)', onAccent: '#FFF4DC' },
    beach: { bg1: '#59bfd6', bg2: '#3da4bd', accent: '#F0DCA0', text: '#FFFFFF', boxBg: 'rgba(255,255,255,0.16)', onAccent: '#4a3a10' }
  };

  if (!document.getElementById('hub3dPanelStyle')) {
    var panelStyle = document.createElement('style');
    panelStyle.id = 'hub3dPanelStyle';
    panelStyle.textContent = [
      // Sheet shell: wooden frame (same layered-gradient technique as the old
      // shared-sheet skin) wrapping a theme-coloured scrollable inner column.
      // Height is driven by the REAL dynamic viewport (dvh — iOS Safari's vh
      // ignores the collapsing address bar and overflows), minus room for the
      // top HUD; the plain-vh line right before it is the fallback for older
      // browsers and gets overridden wherever dvh is supported.
      // bottom offset clears the app's #bottomNav tab bar (61px + iOS home
      // indicator inset) — without it the sheet's footer buttons slid in
      // BEHIND the tab bar and were untappable on device.
      '.hub3dSheet{position:absolute;left:0;right:0;z-index:20;',
      'bottom:calc(61px + env(safe-area-inset-bottom, 0px));',
      'max-height:calc(100vh - 200px);',
      'max-height:calc(100dvh - 200px - env(safe-area-inset-top, 0px));',
      'transform:translateY(108%);transition:transform 460ms cubic-bezier(.34,1.56,.64,1);',
      'border-radius:24px 24px 0 0;padding:9px 9px 0;box-sizing:border-box;',
      'background:',
      'repeating-linear-gradient(90deg,transparent 0 5px,rgba(255,255,255,.05) 5px 6px),',
      'repeating-linear-gradient(180deg,transparent 0 64px,rgba(0,0,0,.28) 64px 66px),',
      'linear-gradient(168deg,#5b3f29,#3f2817);',
      'box-shadow:0 -14px 30px rgba(0,0,0,.35),inset 0 2px 0 rgba(255,255,255,.12);',
      'display:flex;flex-direction:column;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}',
      '.hub3dSheet.open{transform:translateY(0);}',
      // Inner column: scrollable body + always-visible footer. Only the BODY
      // scrolls — START / prev-next / progress live in the footer and can
      // never be pushed off-screen by long step lists.
      '.hub3dSheetInner{background:linear-gradient(175deg,var(--hp-bg1),var(--hp-bg2));color:var(--hp-text);',
      'border-radius:17px 17px 0 0;display:flex;flex-direction:column;overflow:hidden;flex:1;min-height:0;}',
      '.hub3dSheetBody{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;',
      'flex:1;min-height:0;padding:14px 16px 8px;}',
      // (safe-area inset is already accounted for in .hub3dSheet's bottom offset)
      '.hub3dSheetFooter{flex:none;padding:10px 16px 12px;',
      'background:linear-gradient(0deg,var(--hp-bg2),var(--hp-bg2));box-shadow:0 -6px 14px rgba(0,0,0,.14);}',
      '.hub3dSheetTopRow{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}',
      '.hub3dSheetBtnRound{width:38px;height:38px;border-radius:50%;border:none;font-size:17px;cursor:pointer;',
      'background:var(--hp-box);color:var(--hp-text);display:flex;align-items:center;justify-content:center;padding:0;}',
      '.hub3dBadgeChip{display:flex;align-items:center;gap:8px;margin-bottom:6px;}',
      '.hub3dBadgeChip .chip{background:var(--hp-accent);color:var(--hp-on-accent);font-weight:900;font-size:13px;',
      'padding:5px 12px;border-radius:12px;letter-spacing:.3px;}',
      '.hub3dMissionTitle{font-size:22px;line-height:1.2;font-weight:900;margin:2px 0 8px;',
      'animation:hub3dTitlePop 480ms cubic-bezier(.34,1.56,.64,1);}',
      '@keyframes hub3dTitlePop{0%{opacity:0;transform:translateY(10px) scale(.94)}100%{opacity:1;transform:none}}',
      '.hub3dMetaRow{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;}',
      '.hub3dMetaRow span{background:var(--hp-box);border-radius:10px;padding:4px 10px;font-size:12px;font-weight:700;}',
      // Mission motion-diagram card. Always a LIGHT surface regardless of the
      // zone theme: the .jmv icon system draws with CSS-variable strokes tuned
      // for the app's light/dark surfaces, so a fixed white card + explicitly
      // re-pinned light tokens (below) is the only way the diagrams stay
      // readable on every themed background — including when the OS/app is in
      // dark mode, whose .jmv token flip would otherwise wash them out.
      '.hub3dIconWrap{background:#ffffff;border-radius:14px;padding:12px;margin-bottom:10px;display:flex;justify-content:center;min-height:100px;align-items:center;}',
      '.hub3dIconWrap:empty{display:none;}',
      '.hub3dSheet .hub3dIconWrap.jmv, html.theme--dark .hub3dSheet .hub3dIconWrap.jmv{',
      '--color-text-primary:#1f2430;--color-text-secondary:#5b6573;--color-text-tertiary:#9aa1ac;',
      '--color-border-secondary:#cdd2d8;--color-border-tertiary:#e6e8ec;',
      '--color-background-primary:#ffffff;--color-background-secondary:#f4f6f8;',
      '--s:#5b6573;--b:#cdd2d8;--bg2:#f4f6f8;--p:#1f2430;--t:#9aa1ac;color:#5b6573;}',
      '.hub3dIconWrap svg{max-width:100%;height:auto;min-width:200px;}',
      '.hub3dSection{background:var(--hp-box);border-radius:14px;padding:12px 14px;margin-bottom:10px;}',
      '.hub3dSectionHead{font-size:13px;font-weight:900;letter-spacing:.5px;margin-bottom:8px;opacity:.95;}',
      '.hub3dSteps{margin:0;padding:0;list-style:none;}',
      '.hub3dSteps li{display:flex;gap:9px;align-items:flex-start;font-size:15px;font-weight:600;line-height:1.35;margin-bottom:8px;}',
      '.hub3dSteps li:last-child{margin-bottom:0;}',
      '.hub3dStepNum{flex:none;width:22px;height:22px;border-radius:50%;background:var(--hp-accent);color:var(--hp-on-accent);',
      'font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;margin-top:1px;}',
      '.hub3dWinText{font-size:15px;font-weight:700;line-height:1.35;}',
      '.hub3dStartBtn{display:block;width:100%;border:none;border-radius:16px;background:linear-gradient(180deg,#4fc46a,#35a04e);',
      'color:#fff;font-size:19px;font-weight:900;padding:15px 0;cursor:pointer;box-shadow:0 4px 0 #27793a;',
      'margin:0 0 8px;animation:hub3dStartBounce 1.6s ease-in-out infinite;font-family:inherit;}',
      '@keyframes hub3dStartBounce{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}',
      '.hub3dStartBtn.running{animation:none;background:linear-gradient(180deg,#3f92c4,#2d6f9e);box-shadow:0 4px 0 #1d4a6e;}',
      '.hub3dDoneBtn{display:block;width:100%;border:2px solid var(--hp-accent);border-radius:14px;background:transparent;',
      'color:var(--hp-text);font-size:15px;font-weight:800;padding:11px 0;cursor:pointer;margin-bottom:8px;font-family:inherit;}',
      '.hub3dDoneBtn.isDone{background:var(--hp-accent);color:var(--hp-on-accent);}',
      '.hub3dZoneDoneBtn{display:block;width:100%;border:none;border-radius:16px;background:linear-gradient(180deg,#FFD23F,#E8A23A);',
      'color:#4a3000;font-size:18px;font-weight:900;padding:15px 0;cursor:pointer;box-shadow:0 4px 0 #b07716;margin:0 0 8px;font-family:inherit;}',
      '.hub3dNavRow{display:flex;gap:8px;margin-bottom:8px;}',
      '.hub3dNavRow button{flex:1;border:none;border-radius:12px;background:var(--hp-box);color:var(--hp-text);',
      'font-size:14px;font-weight:800;padding:10px 0;cursor:pointer;font-family:inherit;}',
      '.hub3dNavRow button:disabled{opacity:.35;cursor:default;}',
      '.hub3dProgressRow{text-align:center;font-size:13px;font-weight:800;opacity:.95;}',
      '.hub3dProgressDots{letter-spacing:3px;font-size:15px;margin-top:2px;}',
      // Mission motion-diagram markup (from jumvi-mission-icons.js) is styled
      // for the app's .jmv token wrapper — keep it readable on themed bgs.
      '.hub3dIconWrap .jmv{max-width:100%;}'
    ].join('');
    document.head.appendChild(panelStyle);
  }

  var hubSheet = document.createElement('div');
  hubSheet.className = 'hub3dSheet';
  var hubSheetInner = document.createElement('div');
  hubSheetInner.className = 'hub3dSheetInner';
  var hubSheetBody = document.createElement('div');
  hubSheetBody.className = 'hub3dSheetBody';
  var hubSheetFooter = document.createElement('div');
  hubSheetFooter.className = 'hub3dSheetFooter';
  hubSheetInner.appendChild(hubSheetBody);
  hubSheetInner.appendChild(hubSheetFooter);
  hubSheet.appendChild(hubSheetInner);
  container.appendChild(hubSheet);

  var panelOpen = false;
  var panelPackKey = null;
  var panelMissionId = null;
  var panelTimerId = null;

  function stopPanelTimer() {
    if (panelTimerId != null) { clearInterval(panelTimerId); panelTimerId = null; }
  }

  function closeHubPanel() {
    panelOpen = false;
    stopPanelTimer();
    hubSheet.classList.remove('open');
  }

  function escapeText(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // Renders one mission into the sheet. Everything shown is the REAL mission
  // record (title/steps/win/meta/icon) — only the presentation is new. The
  // scrollable body carries the content; START/nav/progress go into the
  // fixed footer so they are ALWAYS on screen no matter how long the steps
  // list is or how short the phone is.
  function renderHubMission(ms) {
    stopPanelTimer();
    var cfg = gateConfig.filter(function (c) { return c.packKey === ms.pack; })[0];
    var theme = themeForZone(cfg ? cfg.zoneIndex : 0);
    var pt = PANEL_THEMES[theme.key] || PANEL_THEMES.zen;
    hubSheetInner.style.setProperty('--hp-bg1', pt.bg1);
    hubSheetInner.style.setProperty('--hp-bg2', pt.bg2);
    hubSheetInner.style.setProperty('--hp-accent', pt.accent);
    hubSheetInner.style.setProperty('--hp-text', pt.text);
    hubSheetInner.style.setProperty('--hp-box', pt.boxBg);
    hubSheetInner.style.setProperty('--hp-on-accent', pt.onAccent);

    var list = packMissionList(ms.pack);
    var idx = list.findIndex(function (m) { return m.id === ms.id; });
    var doneInPack = list.filter(function (m) { return done.has(m.id); }).length;
    var packDone = doneInPack === list.length && list.length > 0;
    var isDone = done.has(ms.id);
    var steps = Array.isArray(ms.steps) && ms.steps.length ? ms.steps : [HUB_TEXTS.stepsSoon];
    var iconMarkup = (window.MISSION_ICONS && window.MISSION_ICONS[ms.id]) || '';
    var dots = list.map(function (m, i) {
      return done.has(m.id) ? '●' : (i === idx ? '◉' : '○');
    }).join('');

    hubSheetBody.innerHTML =
      '<div class="hub3dSheetTopRow">' +
        '<button class="hub3dSheetBtnRound" data-act="close" aria-label="' + HUB_TEXTS.close + '">✕</button>' +
        '<button class="hub3dSheetBtnRound" data-act="mute" aria-label="' + HUB_TEXTS.sound + '">' + (audioMuted ? '🔇' : '🔊') + '</button>' +
      '</div>' +
      '<div class="hub3dBadgeChip"><span style="font-size:26px">' + escapeText(ms.icon) + '</span>' +
        '<span class="chip">' + escapeText(theme.cardTitle) + '</span></div>' +
      '<div class="hub3dMissionTitle">' + escapeText(ms.title) + '</div>' +
      '<div class="hub3dMetaRow"><span>⏱ ' + escapeText(ms.time) + '</span><span>👥 ' + escapeText(ms.players) + '</span><span>🎂 ' + escapeText(ms.age) + '</span></div>' +
      // "jmv" class is REQUIRED: every diagram draws with .jmv's CSS-variable
      // strokes; without the class the vars are undefined and the drawings
      // silently render blank (the exact bug seen on device).
      '<div class="hub3dIconWrap jmv">' + iconMarkup + '</div>' +
      '<div class="hub3dSection"><div class="hub3dSectionHead">📋 ' + HUB_TEXTS.steps + '</div><ul class="hub3dSteps">' +
        steps.map(function (s, i) {
          return '<li><span class="hub3dStepNum">' + (i + 1) + '</span><span>' + escapeText(s) + '</span></li>';
        }).join('') +
      '</ul></div>' +
      '<div class="hub3dSection"><div class="hub3dSectionHead">🏆 ' + HUB_TEXTS.win + '</div>' +
        '<div class="hub3dWinText">' + escapeText(ms.win || HUB_TEXTS.winSoon) + '</div></div>';

    hubSheetFooter.innerHTML =
      (packDone
        ? '<button class="hub3dZoneDoneBtn" data-act="zonedone">' + HUB_TEXTS.zoneDoneBtn + '</button>'
        : '<button class="hub3dStartBtn" data-act="start">' + HUB_TEXTS.start + '</button>') +
      '<button class="hub3dDoneBtn' + (isDone ? ' isDone' : '') + '" data-act="toggledone">' +
        (isDone ? HUB_TEXTS.doneUndo : HUB_TEXTS.didIt) + '</button>' +
      '<div class="hub3dNavRow">' +
        '<button data-act="prev"' + (idx <= 0 ? ' disabled' : '') + '>' + HUB_TEXTS.prev + '</button>' +
        '<button data-act="next"' + (idx >= list.length - 1 ? ' disabled' : '') + '>' + HUB_TEXTS.next + '</button>' +
      '</div>' +
      '<div class="hub3dProgressRow">' + HUB_TEXTS.mission + ' ' + (idx + 1) + '/' + list.length +
        '<div class="hub3dProgressDots">' + dots + '</div></div>';

    hubSheetBody.scrollTop = 0;
  }

  function openHubPanel(packKey, missionId) {
    var ms = missions.filter(function (m) { return m.id === missionId; })[0];
    if (!ms) return;
    panelOpen = true;
    panelPackKey = packKey;
    panelMissionId = missionId;
    moveTargetActive = false; // panel takes over — stop any in-progress walk
    fadeOutTargetRing();
    renderHubMission(ms);
    // double rAF so the closed transform is committed before .open animates
    requestAnimationFrame(function () { requestAnimationFrame(function () { hubSheet.classList.add('open'); }); });
    playChime();
  }

  // One delegated click handler for the whole sheet — survives every rerender.
  hubSheetInner.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var list = packMissionList(panelPackKey);
    var idx = list.findIndex(function (m) { return m.id === panelMissionId; });
    resumeAudio();

    if (act === 'close' || act === 'zonedone') {
      closeHubPanel();
    } else if (act === 'mute') {
      audioMuted = !audioMuted;
      btn.textContent = audioMuted ? '🔇' : '🔊';
      muteBtn.textContent = audioMuted ? '🔇' : '🔊';
    } else if (act === 'prev' && idx > 0) {
      playTone(660, 0.08, 'sine', 0.05, 0);
      panelMissionId = list[idx - 1].id;
      renderHubMission(list[idx - 1]);
    } else if (act === 'next' && idx < list.length - 1) {
      playTone(740, 0.08, 'sine', 0.05, 0);
      panelMissionId = list[idx + 1].id;
      renderHubMission(list[idx + 1]);
    } else if (act === 'toggledone') {
      var ms = list[idx];
      if (!ms) return;
      if (done.has(ms.id)) {
        if (undoMissionDoneFn) undoMissionDoneFn(ms.id);
      } else if (markMissionDoneFn) {
        markMissionDoneFn(ms.id, 'hub3d');
      }
      renderHubMission(ms); // re-render: done state, dots, zone-done button
    } else if (act === 'start') {
      // Simple play countdown from the mission's own time — the kid puts the
      // phone down and plays; the chime marks time-up, then they self-report.
      var msNow = list[idx];
      var seconds = 60;
      if (msNow && msNow.time && String(msNow.time).indexOf('s') !== -1) seconds = parseInt(msNow.time, 10) || 60;
      var remaining = seconds;
      btn.classList.add('running');
      btn.textContent = HUB_TEXTS.running(remaining);
      stopPanelTimer();
      panelTimerId = setInterval(function () {
        remaining--;
        if (remaining <= 0) {
          stopPanelTimer();
          btn.classList.remove('running');
          btn.textContent = HUB_TEXTS.timeUp;
          playSuccess();
        } else {
          btn.textContent = HUB_TEXTS.running(remaining);
          if (remaining <= 3) playTone(880, 0.07, 'sine', 0.04, 0);
        }
      }, 1000);
      playTone(523.25, 0.1, 'triangle', 0.06, 0);
    }
  });

  // ---------- GATE PROXIMITY: opens the REAL mission panel ----------
  var TRIGGER_RADIUS = 1.8;
  var AWARENESS_RADIUS = 3.2; // bigger than TRIGGER_RADIUS — "getting close" glow before the gate actually fires
  var GATE_REACT_MS = 150;
  var lastTriggeredGate = null;
  var pendingGate = null; // { cfg, ring, startTime } — brief "arrived" reaction before the panel opens

  // Distance-based "getting close" boost applied to every gate each frame, except
  // the one currently mid-reaction (that one's pulse takes over in updateGateReaction).
  function updateGateAwareness() {
    gateConfig.forEach(function (cfg) {
      if (pendingGate && pendingGate.cfg.id === cfg.id) return;
      var ring = gateMeshes[cfg.id].userData.ring;
      var dx = leo.group.position.x - cfg.x;
      var dz = leo.group.position.z - cfg.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var closeness = THREE.MathUtils.clamp(1 - (dist - TRIGGER_RADIUS) / (AWARENESS_RADIUS - TRIGGER_RADIUS), 0, 1);
      ring.userData.awareness = closeness;
    });
  }

  function checkGateProximity() {
    if (panelOpen) return; // no re-trigger while the mission sheet is up
    var nearestGate = null, nearestDist = Infinity;
    gateConfig.forEach(function (cfg) {
      var dx = leo.group.position.x - cfg.x;
      var dz = leo.group.position.z - cfg.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < TRIGGER_RADIUS && dist < nearestDist) { nearestDist = dist; nearestGate = cfg; }
    });

    if (nearestGate) {
      if (lastTriggeredGate !== nearestGate.id && !pendingGate) {
        lastTriggeredGate = nearestGate.id;
        pendingGate = { cfg: nearestGate, ring: gateMeshes[nearestGate.id].userData.ring, startTime: performance.now() };
        playChime();
      }
    } else if (!pendingGate) {
      lastTriggeredGate = null;
    }
  }

  // Plays the gate-reached reaction (ring pulse + Leo hop) for GATE_REACT_MS, then
  // opens the real mission panel — same openMission() call as before, just delayed
  // by one short beat instead of firing the instant the trigger radius is entered.
  function updateGateReaction() {
    if (!pendingGate) return;
    var elapsed = performance.now() - pendingGate.startTime;
    var t = Math.min(elapsed / GATE_REACT_MS, 1);
    var pulse = 1 + 0.25 * Math.sin(t * Math.PI);
    pendingGate.ring.scale.setScalar(pulse);
    leo.group.position.y = Math.sin(t * Math.PI) * 0.18;

    if (elapsed >= GATE_REACT_MS) {
      pendingGate.ring.scale.setScalar(1);
      var gatePackKey = pendingGate.cfg.packKey;
      var missionId = getNextMissionIdForPack(gatePackKey);
      pendingGate = null;
      if (missionId != null) {
        openHubPanel(gatePackKey, missionId);
      }
    }
  }

  // ---------- LIVING WORLD: per-mission growth + instant reward ----------
  // Center-screen "Bravo!" card for the instant reward moment — own element
  // (not the zone card) so a zone entry and a reward can't clobber each other.
  var rewardCardEl = document.createElement('div');
  rewardCardEl.style.cssText = 'position:absolute;top:30%;left:50%;transform:translate(-50%,-50%);z-index:16;pointer-events:none;background:rgba(255,255,255,0.94);padding:12px 24px;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,0.22);opacity:0;font-size:15px;font-weight:800;color:#3a2a1a;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  container.appendChild(rewardCardEl);
  function showRewardCard(text) {
    rewardCardEl.textContent = text;
    rewardCardEl.style.animation = 'none';
    void rewardCardEl.offsetWidth;
    // zone-card keyframes, stretched to 2s — same pop in/out shape
    rewardCardEl.style.animation = 'hub3dZoneCardIn 2000ms ease-out forwards';
  }

  // Newly revealed props pop in over ~0.5s (scale overshoot + settle) instead
  // of just appearing — the "your mission grew the world" beat.
  var growAnims = [];
  function startGrowAnim(obj) {
    obj.visible = true;
    obj.scale.setScalar(0.01);
    growAnims.push({ obj: obj, startTime: performance.now() });
  }
  function updateGrowAnims() {
    for (var i = growAnims.length - 1; i >= 0; i--) {
      var ga = growAnims[i];
      var t = Math.min((performance.now() - ga.startTime) / 500, 1);
      // ease-out-back: overshoots to ~1.1 around t=0.7, settles at 1
      var s = 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
      ga.obj.scale.setScalar(Math.max(0.01, s));
      if (t >= 1) {
        ga.obj.scale.setScalar(1);
        growAnims.splice(i, 1);
      }
    }
  }

  // Reveals decor slots one per completed mission, straight from the real
  // done Set every frame (cheap: 6 gates × a tiny filter) and guarded so
  // meshes/DOM are only touched when a count actually changes. The very
  // first pass (visibleSlots === -1) applies state silently — reward
  // fanfare is reserved for completions that happen while the hub is live.
  function updateGateDecor() {
    gateConfig.forEach(function (cfg) {
      var group = gateMeshes[cfg.id];
      var count = visibleSlotsForPack(cfg.packKey);
      var prev = group.userData.visibleSlots;
      if (prev === count) return;
      group.userData.visibleSlots = count;
      var isInitial = prev === -1;

      group.userData.decorSlots.forEach(function (slot, i) {
        if (i < count) {
          if (!slot.visible && !isInitial) {
            startGrowAnim(slot);
          } else {
            slot.visible = true;
          }
        } else {
          slot.visible = false;
        }
      });

      var isChampion = getPackCompletion(cfg.packKey) >= 1;
      group.userData.champion.visible = isChampion;
      group.userData.championProp.visible = isChampion;
      group.userData.ring.userData.champion = isChampion;

      if (!isInitial && count > prev) {
        var theme = themeForZone(cfg.zoneIndex);
        var newest = group.userData.decorSlots[Math.min(count, group.userData.decorSlots.length) - 1];
        var itemName = isChampion ? theme.championName : (newest && newest.userData.rewardName) || HUB_TEXTS.surprise;
        showRewardCard(HUB_TEXTS.reward(theme.cardTitle, itemName));
        playChime();
        leoCelebrating = { startTime: performance.now(), baseFacingY: leo.group.rotation.y };
      }
    });
  }

  // ---------- ZONE LOCKS (computed live from the real `done` Set — no separate state) ----------
  // This lock is purely a 3D-hub concept: it never touches `done`, never adds
  // any other state, and the Browse/Today tabs are completely unaware of it —
  // they keep reading `done` exactly as before.
  function isZoneUnlocked(zoneIndex) {
    if (zoneIndex === 0) return true;
    return getPackCompletion(gateConfig[zoneIndex - 1].packKey) >= 1;
  }

  var celebratingRing = null; // { ring, startTime } — brief pulse when a zone unlocks
  var CELEBRATION_MS = 700;
  var leoCelebrating = null; // { startTime, baseFacingY } — Leo's joy hop, see updateLeoCelebration()
  var LEO_CELEBRATE_MS = 900;

  // Detects locked→unlocked transitions and kicks off the fog dissolve +
  // reward trees + a short celebration pulse on the newly-opened zone's ring.
  function updateZoneLocks() {
    fogWalls.forEach(function (fw) {
      if (fw.dissolved || fw.dissolving) return;
      if (!isZoneUnlocked(fw.zoneIndex)) return;

      fw.dissolving = { startTime: performance.now(), startOpacity: fw.wall.material.opacity };

      // Reward trees just inside the newly opened entrance — same idea as
      // growForest()'s reward trees in the mini-example prototype.
      var rewardZ = fw.baseZ - 3;
      var rewardZ2 = rewardZ - 2;
      scene.add(makeTree(pathCenterX(rewardZ) - corridorHalfWidthAt(rewardZ) - 0.9, rewardZ, 1.0));
      scene.add(makeTree(pathCenterX(rewardZ2) + corridorHalfWidthAt(rewardZ2) + 0.9, rewardZ2, 0.95));

      celebratingRing = { ring: gateMeshes[fw.zoneIndex + 1].userData.ring, startTime: performance.now() };

      // The pack that just got completed (NOT the newly-opened next zone the
      // ring pulse above belongs to) — named explicitly in the card + tied to
      // its own gate's already-existing champion sparkle (updateGateDecor),
      // so it's unambiguous which zone finished vs. which one just opened.
      var completedCfg = gateConfig[fw.zoneIndex - 1];
      showZoneCompleteCelebration(completedCfg);
      playSuccess();
      leoCelebrating = { startTime: performance.now(), baseFacingY: leo.group.rotation.y };

      var badge = badgeSlots[fw.zoneIndex + 1];
      if (badge) badge.style.opacity = '1';
    });
  }

  // Leo's brief joy hop (two quick bounces + a small happy wag, decaying to
  // nothing) when a zone completes — overrides leo.group.position.y/rotation.y
  // for this short window only, same pattern as the existing gate-arrival
  // reaction in updateGateReaction(); leo.update() resumes full control the
  // instant the window ends.
  function updateLeoCelebration() {
    if (!leoCelebrating) return;
    var elapsed = performance.now() - leoCelebrating.startTime;
    var t = Math.min(elapsed / LEO_CELEBRATE_MS, 1);
    var bounce = Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t * 0.4);
    leo.group.position.y = bounce * 0.32;
    leo.group.rotation.y = leoCelebrating.baseFacingY + Math.sin(t * Math.PI * 4) * 0.28 * (1 - t);
    if (elapsed >= LEO_CELEBRATE_MS) {
      leoCelebrating = null;
    }
  }

  // Fades + retreats the fog wall over 1400ms — the exact technique from
  // growForest()/animateFog() in jumvi-forest-mini-example.html, just driven
  // by tick()'s elapsed time instead of its own requestAnimationFrame loop.
  function updateFogDissolves() {
    fogWalls.forEach(function (fw) {
      if (!fw.dissolving) return;
      var elapsed = performance.now() - fw.dissolving.startTime;
      var t = Math.min(elapsed / 1400, 1);
      fw.wall.material.opacity = fw.dissolving.startOpacity * (1 - t);
      fw.particles.children.forEach(function (p, i) {
        p.material.opacity = 0.5 * (1 - t);
        p.position.y += 0.01 * (1 + (i % 3));
      });
      fw.wall.position.z = fw.baseZ - t * 4;
      if (t >= 1) {
        fw.wall.visible = false;
        fw.particles.visible = false;
        fw.dissolving = null;
        fw.dissolved = true;
      }
    });
  }

  function updateCelebration() {
    if (!celebratingRing) return;
    var elapsed = performance.now() - celebratingRing.startTime;
    var t = Math.min(elapsed / CELEBRATION_MS, 1);
    celebratingRing.ring.scale.setScalar(1 + 0.5 * Math.sin(t * Math.PI));
    if (t >= 1) {
      celebratingRing.ring.scale.setScalar(1);
      celebratingRing = null;
    }
  }

  var elapsedTime = 0;

  function tick(delta) {
    updateMovement(delta);
    checkGateProximity();
    updateGateAwareness();
    updateGateReaction();
    updateGateDecor();
    updateZoneLocks();
    updateFogDissolves();
    updateCelebration();
    updateLeoCelebration();
    updateProgressLabel();
    updateZoneTheme(delta);
    updateTargetRing();
    updateGrowAnims();
    elapsedTime += delta;

    updateRiver(elapsedTime);
    updateButterflies(elapsedTime);
    updateBirds(elapsedTime);

    gateConfig.forEach(function (cfg) {
      var meshGroup = gateMeshes[cfg.id];
      var ring = meshGroup.userData.ring;
      ring.rotation.z += delta * 0.6;

      // gentle up/down bob, out of phase per gate so they don't move in lockstep
      var bob = Math.sin(elapsedTime * 1.6 + ring.userData.phase) * 0.08;
      ring.position.y = ring.userData.baseY + bob;

      // slow breathing glow — a fully-completed pack's gate glows a bit brighter
      var champBoost = ring.userData.champion ? 0.25 : 0;
      ring.material.emissiveIntensity = 0.35 + champBoost + 0.18 * Math.sin(elapsedTime * 1.2 + ring.userData.phase);

      // "getting close" scale boost — skipped for the gate currently mid-reaction
      // or mid-celebration, each of which owns ring scale for its own brief window
      var isPending = pendingGate && pendingGate.cfg.id === cfg.id;
      var isCelebrating = celebratingRing && celebratingRing.ring === ring;
      if (!isPending && !isCelebrating) {
        ring.scale.setScalar(1 + (ring.userData.awareness || 0) * 0.12);
      }

      if (meshGroup.userData.champion.visible) {
        meshGroup.userData.champion.rotation.y += delta * 0.5;
      }
      if (meshGroup.userData.championProp.visible) {
        meshGroup.userData.championProp.rotation.y += delta * 0.9;
        meshGroup.userData.championProp.position.y = 2.9 + Math.sin(elapsedTime * 1.4 + ring.userData.phase) * 0.12;
      }
    });

    renderer.render(scene, camera);
  }

  // ---------- LOOP (pause/resume-able — see hideHub3D()/showHub3D() in app.js) ----------
  var clock = new THREE.Clock();
  var running = false;
  var rafId = null;

  function animate() {
    rafId = requestAnimationFrame(animate);
    var delta = Math.min(clock.getDelta(), 0.1);
    tick(delta);
  }

  function onResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', onResize);

  function resume() {
    if (running) return;
    running = true;
    clock.getDelta(); // discard time elapsed while paused, avoid a huge first delta
    animate();
  }
  function pause() {
    if (!running) return;
    running = false;
    closeHubPanel(); // leaving the tab also dismisses the mission sheet
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Intentionally NOT auto-started — the caller (app.js) decides when to call
  // resume(), and re-checks that the hub is still the active tab before doing
  // so (loading is async; the user may navigate away before it finishes).
  return { pause: pause, resume: resume };
}
