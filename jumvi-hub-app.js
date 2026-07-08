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
import { createCoachLeo } from './jumvi-leo.js?v=20260524-101';

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
    zoneComplete: 'Zone Complete! 🎉',
    hint: 'Tap the ground to walk — reach a glowing gate to get a mission!',
    tapToWalk: '👆 Tap to walk!',
    sound: 'Sound on/off',
    close: 'Close',
    missionsLeft: function (n) { return n + (n === 1 ? ' mission to go!' : ' missions to go!'); },
    zoneDoneLabel: 'complete! 🏆',
    steps: 'STEPS',
    win: 'HOW TO WIN',
    stepsSoon: 'Steps are coming soon.',
    winSoon: 'Win condition is coming soon.',
    start: '▶ START!',
    running: function (s) { return '⏱ ' + s + 's — Go play!'; },
    timeUp: "⏰ Time's up — did you do it?",
    didIt: '✅ I Did It!',
    doneUndo: '✔ Done — tap to undo',
    prev: '← Back',
    next: 'Next →',
    mission: 'Mission',
    zoneDoneBtn: 'Zone Complete! 🏆',
    // Short on purpose — the camera is now zoomed in on the actual object
    // (see growthFocus), so the caption's only job is to name it, not
    // narrate it. The old full sentence ("Woohoo! The Energy Zone just grew
    // a new power pole 🎉") ran off a narrow phone screen with nowrap CSS.
    reward: function (zone, item) { return '🌱 New: ' + item + '!'; },
    surprise: 'surprise',
    help: 'How to play',
    helpLines: ['👆 Tap the ground — Leo walks there!', '🚪 Reach a glowing gate to open a mission', '🌱 Finish missions to grow each zone!'],
    gotIt: 'Got it!',
    todaysMission: "🎯 Today's Mission",
    certTitle: 'CHAMPION! 🏆',
    certBody: function (n) { return 'You did ALL ' + n + ' missions!'; },
    certBtn: 'Get your Champion Certificate!',
    photo: 'Island photo',
    menu: 'Menu',
    menuTitle: 'JUMVI',
    menuItems: [
      { icon: '📅', label: 'Today', tab: 'today' },
      { icon: '🎯', label: 'Browse Missions', tab: 'browse' },
      { icon: '📊', label: 'Stats', tab: 'stats' },
      { icon: '🦁', label: 'Profile', tab: 'profile' },
      { icon: '🏅', label: 'Badges', action: 'badges' }
    ],
    menuClose: 'Close menu'
  };

  // ---------- DEMO MODE (?demo=1 — Amazon listing video capture) ----------
  // Visual-only override: every zone unlocked, every growth prop shown, no
  // ceremonies/invites. NEVER writes to the done Set or any storage — a page
  // reload without the param is a normal user session again.
  var demoMode = false;
  try { demoMode = new URLSearchParams(window.location.search).get('demo') === '1'; } catch (e) {}

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
  // ONE sound setting for the whole product: the hub mirrors the app's own
  // "🔊 Sound On" toggle (Settings) instead of keeping a second mute concept
  // that would confuse parents. Reads live through opts so a change in
  // Settings applies to the very next hub sound; the hub's mute button
  // writes back through the app's own setter.
  var isSoundOnFn = opts.isSoundOn || function () { return true; };
  var setSoundOnFn = opts.setSoundOn || function () {};
  function isMuted() { return !isSoundOnFn(); }

  // Autoplay policies block sound before a user gesture; the context starts
  // "suspended" and every real interaction entry point (keydown, tap-to-move
  // touch, the mute button itself) calls this — cheap/safe to call
  // repeatedly once it's already running.
  function resumeAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
  }

  // ---- Toy-like sound palette ----
  // Everything below aims for "wooden xylophone in a picture book": pure
  // sine partials, high pitch, VERY short, low gain. The old palette's low
  // triangle thumps (especially the footstep drone) tested as unsettling
  // for small kids — nothing here sits below ~500Hz anymore.
  //
  // playNote = tiny marimba hit: fundamental + a quiet 4x partial that decays
  // twice as fast, which is what reads as "mallet on wood" instead of "beep".
  function playNote(freq, duration, peakGain, delaySec) {
    if (!audioCtx || isMuted()) return;
    var t0 = audioCtx.currentTime + (delaySec || 0);
    [[freq, peakGain, duration], [freq * 4, peakGain * 0.18, duration * 0.5]].forEach(function (p) {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p[0], t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(p[1], t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + p[2]);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + p[2] + 0.02);
    });
  }
  // kept as the generic primitive for the few non-percussive cues
  function playTone(freq, duration, type, peakGain, delaySec) {
    if (!audioCtx || isMuted()) return;
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

  // Footstep → barely-there "plip", high and quiet (the old low 150Hz thump
  // repeating forever was the single scariest sound in the test).
  function playStep() {
    playNote(1150 + Math.random() * 180, 0.05, 0.016, 0);
  }

  // Gate arrival — two bright marimba taps, once per arrival (deduped by
  // lastTriggeredGate in checkGateProximity).
  function playChime() {
    playNote(1046.5, 0.12, 0.05, 0);
    playNote(1568, 0.16, 0.045, 0.09);
  }

  // Zone-complete — quick joyful mallet run up a major chord.
  function playSuccess() {
    playNote(1046.5, 0.12, 0.055, 0);
    playNote(1318.5, 0.12, 0.055, 0.09);
    playNote(1568, 0.12, 0.055, 0.18);
    playNote(2093, 0.22, 0.06, 0.27);
  }

  // "Come back to the island" whistle — timer's up in the mission view; a
  // gentle two-note up-slide, exposed for app.js's timer-end hook.
  function playComeBack() {
    playNote(1318.5, 0.2, 0.055, 0);
    playNote(1760, 0.3, 0.05, 0.16);
  }
  window._hub3dComeBack = playComeBack;

  // Top-right mute toggle — parent-facing, independent of every other HUD
  // element above (own absolute position, not nested in hudTop's
  // pointer-events:none column).
  var muteBtn = document.createElement('button');
  muteBtn.type = 'button';
  muteBtn.setAttribute('aria-label', HUB_TEXTS.sound);
  muteBtn.style.cssText = 'position:absolute;top:14px;right:14px;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.85);border:none;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:11;padding:0;';
  muteBtn.textContent = isMuted() ? '🔇' : '🔊';
  muteBtn.addEventListener('click', function () {
    setSoundOnFn(isMuted()); // flip the app-wide setting
    muteBtn.textContent = isMuted() ? '🔇' : '🔊';
    resumeAudio();
  });
  container.appendChild(muteBtn);

  // "How to play" — a ❓ under the mute button reopening a tiny 3-line card.
  // The one-time coach bubble covers the very first launch, but a pre-reader
  // who missed it (or a parent joining later) needs a way back to the rules.
  var helpBtn = document.createElement('button');
  helpBtn.type = 'button';
  helpBtn.setAttribute('aria-label', HUB_TEXTS.help);
  helpBtn.style.cssText = 'position:absolute;top:58px;right:14px;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.85);border:none;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:11;padding:0;';
  helpBtn.textContent = '❓';
  container.appendChild(helpBtn);

  var helpCardEl = document.createElement('div');
  helpCardEl.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:22;background:rgba(255,255,255,0.97);padding:20px 22px;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,0.35);display:none;flex-direction:column;gap:10px;max-width:300px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  helpCardEl.innerHTML =
    '<div style="font-size:17px;font-weight:900;color:#3a2a1a;text-align:center;">' + HUB_TEXTS.help + '</div>' +
    HUB_TEXTS.helpLines.map(function (l) {
      return '<div style="font-size:14px;font-weight:700;color:#5a4632;line-height:1.35;">' + l + '</div>';
    }).join('') +
    '<button type="button" style="border:none;border-radius:12px;background:linear-gradient(180deg,#4fc46a,#35a04e);color:#fff;font-size:15px;font-weight:900;padding:10px 0;cursor:pointer;box-shadow:0 3px 0 #27793a;font-family:inherit;">' + HUB_TEXTS.gotIt + '</button>';
  container.appendChild(helpCardEl);
  helpBtn.addEventListener('click', function () {
    resumeAudio();
    playChime();
    helpCardEl.style.display = 'flex';
  });
  helpCardEl.querySelector('button').addEventListener('click', function () {
    helpCardEl.style.display = 'none';
  });

  // ---------- IN-HUB MENU (☰) ----------
  // The hub is heading toward being the whole site's front door, so it carries
  // its own menu: a ☰ button top-left opens a slide-in panel that routes to
  // the app's REAL Today/Browse/Stats/Profile tabs + the Badges modal (via the
  // navigate()/openBadges() opts bridged from app.js). The bottom tab bar stays
  // as-is underneath — this is additive, nothing is removed.
  var navigateFn = opts.navigate || function () {};
  var openBadgesFn = opts.openBadges || function () {};

  var menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.setAttribute('aria-label', HUB_TEXTS.menu);
  menuBtn.textContent = '☰';
  menuBtn.style.cssText = 'position:absolute;top:14px;left:14px;width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,0.88);border:none;font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:13;padding:0;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
  container.appendChild(menuBtn);

  var menuScrim = document.createElement('div');
  menuScrim.style.cssText = 'position:absolute;inset:0;background:rgba(10,12,24,0.45);z-index:23;opacity:0;pointer-events:none;transition:opacity 220ms ease;';
  container.appendChild(menuScrim);

  var menuPanel = document.createElement('div');
  menuPanel.style.cssText = 'position:absolute;top:0;left:0;bottom:0;width:74%;max-width:300px;background:linear-gradient(160deg,#20305a,#101830);z-index:24;transform:translateX(-102%);transition:transform 260ms cubic-bezier(.4,0,.2,1);box-shadow:6px 0 24px rgba(0,0,0,0.4);display:flex;flex-direction:column;padding:24px 0 16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  var menuHtml = '<div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:2px;padding:6px 22px 4px;">' + HUB_TEXTS.menuTitle + '</div>' +
    '<div style="font-size:12px;font-weight:700;color:#8fa0d0;padding:0 22px 18px;">Adventure Hub</div>';
  HUB_TEXTS.menuItems.forEach(function (it, idx) {
    menuHtml += '<button type="button" data-mi="' + idx + '" style="display:flex;align-items:center;gap:14px;background:none;border:none;color:#eaf0ff;font-size:16px;font-weight:700;padding:14px 22px;cursor:pointer;text-align:left;font-family:inherit;width:100%;">' +
      '<span style="font-size:20px;width:26px;text-align:center;">' + it.icon + '</span>' + it.label + '</button>';
  });
  menuHtml += '<div style="flex:1;"></div>' +
    '<button type="button" data-mi="close" style="display:flex;align-items:center;gap:14px;background:none;border:none;color:#8fa0d0;font-size:14px;font-weight:700;padding:14px 22px;cursor:pointer;text-align:left;font-family:inherit;width:100%;">' +
    '<span style="font-size:18px;width:26px;text-align:center;">✕</span>' + HUB_TEXTS.menuClose + '</button>';
  menuPanel.innerHTML = menuHtml;
  container.appendChild(menuPanel);

  function openMenu() {
    resumeAudio(); playChime();
    menuPanel.style.transform = 'translateX(0)';
    menuScrim.style.opacity = '1';
    menuScrim.style.pointerEvents = 'auto';
  }
  function closeMenu() {
    menuPanel.style.transform = 'translateX(-102%)';
    menuScrim.style.opacity = '0';
    menuScrim.style.pointerEvents = 'none';
  }
  menuBtn.addEventListener('click', openMenu);
  menuScrim.addEventListener('click', closeMenu);
  menuPanel.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-mi]');
    if (!btn) return;
    var mi = btn.getAttribute('data-mi');
    closeMenu();
    if (mi === 'close') return;
    var item = HUB_TEXTS.menuItems[+mi];
    if (!item) return;
    if (item.action === 'badges') { openBadgesFn(); return; }
    if (item.tab) navigateFn(item.tab); // leaves the hub for that real tab
  });

  // ---------- "TODAY'S MISSION" AUTO-WALK (screen→play bridge) ----------
  // One tap and Leo walks himself along the trail to the right gate — a
  // 3-year-old needs zero navigation skill. Uses the app's real daily pick;
  // if that zone is still fog-locked, falls back to the first not-done
  // mission in an unlocked zone. Waypoints follow pathCenterX so he visibly
  // walks THE TRAIL, with a line of glow dots showing where he's headed.
  var dailyBtn = document.createElement('button');
  dailyBtn.type = 'button';
  dailyBtn.textContent = HUB_TEXTS.todaysMission;
  // bottom offset includes the notch/home-indicator safe area so it never sits
  // under the iOS home bar now that the global nav is hidden beneath the hub.
  dailyBtn.style.cssText = 'position:absolute;bottom:calc(16px + env(safe-area-inset-bottom));left:14px;z-index:11;border:none;border-radius:16px;background:linear-gradient(180deg,#4fc46a,#35a04e);color:#fff;font-size:13px;font-weight:900;padding:11px 15px;cursor:pointer;box-shadow:0 3px 0 #27793a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  container.appendChild(dailyBtn);

  var autoWalk = null; // { points: [{x,z}], i }
  // Trail dots are created lazily on first use: this HUD block runs before
  // the THREE scene exists, and the dots aren't needed until the first tap
  // on the Today's Mission button anyway.
  var trailDots = [];
  function ensureTrailDots() {
    if (trailDots.length) return;
    var trailDotMat = new THREE.MeshBasicMaterial({ color: 0xFFE9A0, transparent: true, opacity: 0.9, depthWrite: false });
    for (var tdi = 0; tdi < 10; tdi++) {
      var dot = new THREE.Mesh(new THREE.CircleGeometry(0.14, 10), trailDotMat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.y = 0.03;
      dot.visible = false;
      scene.add(dot);
      trailDots.push(dot);
    }
  }
  function showTrail(points) {
    ensureTrailDots();
    for (var i = 0; i < trailDots.length; i++) {
      var pi = Math.floor((i / trailDots.length) * points.length);
      var pt = points[Math.min(pi, points.length - 1)];
      trailDots[i].position.x = pt.x;
      trailDots[i].position.z = pt.z;
      trailDots[i].visible = true;
    }
  }
  function hideTrail() {
    for (var i = 0; i < trailDots.length; i++) trailDots[i].visible = false;
  }
  function cancelAutoWalk() {
    if (autoWalk) { autoWalk = null; hideTrail(); }
  }
  function startAutoWalkToMission() {
    resumeAudio();
    dismissCoachBubble();
    var id = opts.getDailyMissionId ? opts.getDailyMissionId() : null;
    var ms = id != null ? missions.filter(function (m) { return m.id === id; })[0] : null;
    var cfg = ms ? gateConfig.filter(function (c) { return c.packKey === ms.pack; })[0] : null;
    if (!cfg || !isZoneUnlocked(cfg.zoneIndex)) {
      cfg = null;
      for (var gi = 0; gi < gateConfig.length; gi++) {
        if (!isZoneUnlocked(gateConfig[gi].zoneIndex)) break;
        var undone = packMissionList(gateConfig[gi].packKey).filter(function (m) { return !done.has(m.id); })[0];
        if (undone) { cfg = gateConfig[gi]; break; }
      }
      if (!cfg) cfg = gateConfig[0];
    }
    var pts = [];
    var z0 = leo.group.position.z;
    var z1 = cfg.z + 1.0; // just inside the gate's trigger radius
    var step = z1 < z0 ? -3 : 3;
    for (var z = z0 + step; (step < 0 ? z > z1 : z < z1); z += step) {
      pts.push({ x: pathCenterX(z), z: z });
    }
    pts.push({ x: cfg.x, z: z1 });
    autoWalk = { points: pts, i: 0 };
    moveTargetActive = false; // next frame picks up the first waypoint
    showTrail(pts);
    playChime();
  }
  dailyBtn.addEventListener('click', startAutoWalkToMission);

  // ---------- ISLAND PHOTO (share/download a snapshot) ----------
  var photoBtn = document.createElement('button');
  photoBtn.type = 'button';
  photoBtn.setAttribute('aria-label', HUB_TEXTS.photo);
  photoBtn.textContent = '📷';
  photoBtn.style.cssText = 'position:absolute;top:102px;right:14px;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.85);border:none;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:11;padding:0;';
  container.appendChild(photoBtn);
  photoBtn.addEventListener('click', function () {
    resumeAudio();
    playChime();
    // fresh render in this same task so toDataURL sees pixels without
    // needing preserveDrawingBuffer (which costs memory every frame)
    renderer.render(scene, camera);
    var src = renderer.domElement;
    var out = document.createElement('canvas');
    out.width = src.width; out.height = src.height;
    var octx = out.getContext('2d');
    octx.drawImage(src, 0, 0);
    var bh = Math.max(40, Math.round(out.height * 0.065));
    var pad = Math.round(bh * 0.4);
    octx.fillStyle = 'rgba(255,255,255,0.92)';
    octx.fillRect(0, out.height - bh, out.width, bh);
    octx.fillStyle = '#3a2a1a';
    octx.textBaseline = 'middle';
    octx.font = '900 ' + Math.round(bh * 0.46) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    octx.fillText('JUMVI', pad, out.height - bh / 2);
    octx.textAlign = 'right';
    octx.font = '700 ' + Math.round(bh * 0.4) + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    octx.fillText(themeForZone(currentZoneIndex()).cardTitle, out.width - pad, out.height - bh / 2);
    octx.textAlign = 'left';
    out.toBlob(function (blob) {
      if (!blob) return;
      var file = null;
      try { file = new File([blob], 'jumvi-island.png', { type: 'image/png' }); } catch (e) {}
      if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'JUMVI Island' }).catch(function () {});
      } else {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'jumvi-island.png';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
      }
    }, 'image/png');
  });

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
    // growth() now points at the real-model factories (makePowerPoleDecor
    // etc., defined below near MODEL_SOURCES) instead of the procedural
    // make* functions — makers() (scattered edge dressing along the whole
    // corridor) is untouched and still procedural, that's a different,
    // much-higher-instance-count use of these same function names.
    { key: 'energy', cardTitle: '⚡ Energy Zone', gateColor: 0xFFD23F, sky: 0x2a2d52, ground: 0x4a4d7a, hemiSky: 0x8a8fd0, hemiGround: 0x50538a, sun: 0xaab4ff, sunIntensity: 1.25, badgeBg: '#b9bdf0', makers: function () { return [makeElectricPole, makeElectricPole, makeLightningBolt]; }, growth: function () { return [{ make: makePowerPoleDecor, name: 'power pole' }, { make: makePowerPoleDecor, name: 'power pole' }, { make: makeLightningBoltDecor, name: 'lightning bolt' }, { make: makePowerPoleDecor, name: 'power pole' }, { make: makeLightningBoltDecor, name: 'lightning bolt' }, { make: makeLightningBoltDecor, name: 'lightning bolt' }]; }, championName: 'energy orb' },
    { key: 'target', cardTitle: '🎯 Target Range', gateColor: 0xFF5A5A, sky: 0xc8e6f5, ground: 0x7ab648, hemiSky: 0xeaf6ff, hemiGround: 0x7ab648, sun: 0xffffff, sunIntensity: 1.75, badgeBg: '#cfe9f8', makers: function () { return [makeTargetBoard, makeTree, makeTargetBoard]; }, growth: function () { return [{ make: makeTargetBoardDecor, name: 'target board' }, { make: makeTargetBoardDecor, name: 'target board' }, { make: makeFlagDecor, name: 'flag' }, { make: makeTargetBoardDecor, name: 'target board' }, { make: makeFlagDecor, name: 'flag' }, { make: makeTargetBoardDecor, name: 'target board' }]; }, championName: 'golden target' },
    { key: 'zen', cardTitle: '🍃 Zen Garden', gateColor: 0x6FC48A, sky: 0xf5e6d3, ground: 0x4a7c6a, hemiSky: 0xffe9c9, hemiGround: 0x4a7c6a, sun: 0xffd9a0, sunIntensity: 1.15, badgeBg: '#f3e2c8', makers: function () { return [makeBamboo, makeStoneLantern, makeLotusPool, makeBamboo]; }, growth: function () { return [{ make: makeBambooDecor, name: 'bamboo' }, { make: makeStoneLanternDecor, name: 'stone lantern' }, { make: makeLotusPondDecor, name: 'lotus pond' }, { make: makeBambooDecor, name: 'bamboo' }, { make: makeStoneLanternDecor, name: 'stone lantern' }, { make: makeLotusPondDecor, name: 'lotus pond' }]; }, championName: 'golden lantern' },
    { key: 'play', cardTitle: '👥 Playground', gateColor: 0xFFB347, sky: 0x87ceeb, ground: 0xc46a20, hemiSky: 0xbfe8ff, hemiGround: 0xc46a20, sun: 0xffffff, sunIntensity: 1.8, badgeBg: '#bfe4f7', makers: function () { return [makeBench, makePlayFlag, makeSlide, makePlayFlag]; }, growth: function () { return [{ make: makeTeamFlagDecor, name: 'flag' }, { make: makeBenchDecor, name: 'bench' }, { make: makeSlideDecor, name: 'slide' }, { make: makeTeamFlagDecor, name: 'flag' }, { make: makeBenchDecor, name: 'bench' }, { make: makeTeamFlagDecor, name: 'flag' }]; }, championName: 'champion flag' },
    { key: 'home', cardTitle: '🏠 Backyard', gateColor: 0xE8A23A, sky: 0xffe0a0, ground: 0x8FBF5A, hemiSky: 0xffd9a0, hemiGround: 0x8fbf5a, sun: 0xffb066, sunIntensity: 1.5, badgeBg: '#ffe7b8', makers: function () { return [makeFencePanel, makeGardenSwing, makeFlowerBed, makeMailbox]; }, growth: function () { return [{ make: makeFenceDecor, name: 'fence' }, { make: makeFlowerBedDecor, name: 'flower bed' }, { make: makeSwingDecor, name: 'swing' }, { make: makeFenceDecor, name: 'fence' }, { make: makeMailboxDecor, name: 'mailbox' }, { make: makeFlowerBedDecor, name: 'flower bed' }]; }, championName: 'flower crown' },
    { key: 'beach', cardTitle: '🏖️ Beach', gateColor: 0xFFD98A, sky: 0x7ec8e3, ground: 0xf0dca0, hemiSky: 0xd8f1fb, hemiGround: 0xf0dca0, sun: 0xfff6e0, sunIntensity: 1.85, badgeBg: '#ffeccb', makers: function () { return [makePalmTree, makeBeachUmbrella, makePalmTree, makeSeashell]; }, growth: function () { return [{ make: makePalmTreeDecor, name: 'palm tree' }, { make: makeBeachUmbrellaDecor, name: 'beach umbrella' }, { make: makeSandcastleDecor, name: 'sandcastle' }, { make: makeSeashellDecor, name: 'seashell' }, { make: makePalmTreeDecor, name: 'palm tree' }, { make: makeSeashellDecor, name: 'seashell' }]; }, championName: 'golden sun' }
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
  // Lowered + pulled in from the old (6 back, 4 up) near-top-down rig to a
  // proper behind-the-back third-person view: the camera now sits just over
  // Leo's shoulder, looking slightly down at his body rather than at the
  // ground far ahead. This reads as "following the mascot" and, as a
  // side-effect, hides most of the wide empty ground the high angle exposed.
  var CAM_DISTANCE_BACK = 5.2;
  var CAM_HEIGHT = 2.7;
  var CAM_LOOKAHEAD_DIST = 2.4;
  var CAM_LOOKAHEAD_HEIGHT = 1.2;
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
  // Margin trimmed from +12 to +5: the worst-case treeline tree lands about
  // (ZIGZAG_AMPLITUDE + corridorHalfWidth-max + DECOR_CLEARANCE + jitter) ≈ 10.5
  // from world center, so ~21 total width covers it; the old +12 left a wide
  // ring of empty terrain past the last props that read as dead space.
  var groundWidth = (ZIGZAG_AMPLITUDE + CORRIDOR_HALF_WIDTH + CORRIDOR_WOBBLE_AMPLITUDE) * 2 + 5;
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
  // Soft color blend across each zone boundary — a slim vertex-colored strip
  // laid just above the seam, fading previous ground color into the next, so
  // crossing zones reads as terrain transitioning instead of a hard cut line.
  for (var gbi = 1; gbi < realPacks.length && gbi < ZONE_THEMES.length; gbi++) {
    var blendGeo = new THREE.PlaneGeometry(groundWidth, 2.4, 1, 1);
    var nearCol = new THREE.Color(ZONE_THEMES[gbi - 1].ground);
    var farCol = new THREE.Color(ZONE_THEMES[gbi].ground);
    var colArr = new Float32Array(4 * 3);
    // plane verts: y>0 pair maps to -Z (far side) after the -90° X rotation
    var posArr = blendGeo.attributes.position;
    for (var vi = 0; vi < 4; vi++) {
      var c = posArr.getY(vi) > 0 ? farCol : nearCol;
      colArr[vi * 3] = c.r; colArr[vi * 3 + 1] = c.g; colArr[vi * 3 + 2] = c.b;
    }
    blendGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    var blendStrip = new THREE.Mesh(blendGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false }));
    blendStrip.rotation.x = -Math.PI / 2;
    blendStrip.position.set(0, 0.006, -gbi * ZONE_LENGTH);
    blendStrip.receiveShadow = true;
    ground.add(blendStrip);
  }
  scene.add(ground);

  // Night stars over the energy zone — its dark navy sky read as flat/empty
  // next to the daytime zones. A static Points cloud above the spawn + zone
  // 0 stretch is a one-draw-call fix that sells "electric night".
  (function () {
    var STAR_COUNT = 70;
    var starPos = new Float32Array(STAR_COUNT * 3);
    for (var si = 0; si < STAR_COUNT; si++) {
      starPos[si * 3] = (Math.random() - 0.5) * 60;
      starPos[si * 3 + 1] = 9 + Math.random() * 14;
      starPos[si * 3 + 2] = START_BOUNDARY_Z + 8 - Math.random() * (ZONE_LENGTH + 18);
    }
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xFFF6D8, size: 0.16, transparent: true, opacity: 0.85, depthWrite: false }));
    scene.add(stars);
  })();

  // ---------- VISIBLE PATH (dirt trail gate-to-gate along the zigzag) ----------
  // A ribbon of triangles following pathCenterX with an organically wobbling
  // width — the "walk HERE" affordance the corridor never had. It runs the
  // whole island (one draw call) and simply continues under the locked-zone
  // fog walls, so the trail visibly disappears INTO the mist ("the road goes
  // on — what's up there?").
  // Two stacked ribbons for a clearly-readable path: a wider darker "shoulder"
  // underneath and a brighter sandy centre on top. The old single thin dirt
  // strip barely registered against the zone ground colours; this reads as a
  // real walkway with edges from any angle and pops on both the dark energy
  // ground and the bright grass zones.
  function buildRibbon(halfWidthBase, y, color) {
    var verts = [], idx = [], i = 0;
    for (var z = START_BOUNDARY_Z + 1.5; z >= -pathTotalLength + START_BOUNDARY_Z + 6; z -= 1.5) {
      var c = pathCenterX(z);
      var w = halfWidthBase + Math.sin(z * 0.9) * 0.18 + Math.sin(z * 2.3) * 0.08;
      verts.push(c - w, y, z, c + w, y, z);
      if (i > 0) {
        var a = (i - 1) * 2, b = a + 1, d = i * 2, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
      i++;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color, flatShading: true }));
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  buildRibbon(1.85, 0.014, 0x8f6f45); // darker shoulder / border
  buildRibbon(1.45, 0.022, 0xE3CE9E); // bright sandy walkway on top

  // ---------- ISLAND: SEA + SHORE + HORIZON ----------
  // The world used to end in flat void past the ground strips. Now it reads
  // as an actual island: a sand apron under the ground plane's edges, a huge
  // slow-waving sea plane below that, two silhouette islands far out in the
  // fog, and a few drifting clouds. All cheap: one 20x20-segment sea plane
  // with the same reuse-base-positions wave trick as the river, and the rest
  // is static or transform-only.
  var seaGeo = new THREE.PlaneGeometry(320, 320, 20, 20);
  var sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x4FB8C4, flatShading: true }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.24, -(pathTotalLength / 2) + START_BOUNDARY_Z);
  scene.add(sea);
  var seaBasePositions = seaGeo.attributes.position.array.slice();
  function updateSea(elapsedTime) {
    var arr = seaGeo.attributes.position.array;
    for (var i = 0; i < arr.length; i += 3) {
      arr[i + 2] = Math.sin(seaBasePositions[i] * 0.25 + elapsedTime * 1.1) * 0.09 +
        Math.sin(seaBasePositions[i + 1] * 0.3 + elapsedTime * 0.8) * 0.07;
    }
    seaGeo.attributes.position.needsUpdate = true;
  }

  var shore = new THREE.Mesh(
    new THREE.PlaneGeometry(groundWidth + 9, pathTotalLength + 12, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xEFDCA6, flatShading: true })
  );
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(0, -0.12, -(pathTotalLength / 2) + START_BOUNDARY_Z);
  scene.add(shore);

  var farIslandMat = new THREE.MeshStandardMaterial({ color: 0x6f8f77, flatShading: true });
  [[-62, -60, 7, 2.4], [58, -25, 5, 1.8]].forEach(function (isl) {
    var mound = new THREE.Mesh(new THREE.ConeGeometry(isl[2], isl[3], 7), farIslandMat);
    mound.position.set(isl[0], -0.2 + isl[3] / 2 - 0.4, isl[1]);
    scene.add(mound);
  });

  // ---------- THEMED SIDE HORIZON (fills the flat empty sides per zone) ----------
  // The wide ground sides used to read as dead flat colour out to the sea. For
  // each zone we now line both sides with a low rolling ridge of mounds tinted
  // a shade of THAT zone's own ground colour, sitting just past the ground
  // edge — so a kid glancing left/right sees the zone's world continue into
  // rolling hills instead of a blank plane. All flat-shaded low-poly cones,
  // batched into one merged-ish group; cheap and static.
  var sideBaseX = groundWidth / 2 + 1.5;
  gateConfig.forEach(function (cfg) {
    var theme = themeForZone(cfg.zoneIndex);
    var hillCol = new THREE.Color(theme.ground).offsetHSL(0, -0.05, -0.08);
    var hillMat = new THREE.MeshStandardMaterial({ color: hillCol, flatShading: true });
    [-1, 1].forEach(function (side) {
      for (var h = 0; h < 3; h++) {
        var hz = cfg.z + (h - 1) * 5.2 + (Math.random() - 0.5) * 2;
        var hx = side * (sideBaseX + Math.random() * 5);
        var r = 4.5 + Math.random() * 3.5;
        var ht = 2.2 + Math.random() * 2.6;
        var hill = new THREE.Mesh(new THREE.ConeGeometry(r, ht, 6), hillMat);
        hill.position.set(hx, -0.3 + ht / 2 - 0.5, hz);
        hill.rotation.y = Math.random() * Math.PI;
        scene.add(hill);
      }
    });
  });

  var cloudMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, flatShading: true, transparent: true, opacity: 0.85 });
  var clouds = [];
  for (var ci = 0; ci < 4; ci++) {
    var cloud = new THREE.Group();
    [[0, 0, 0, 1.4], [1.2, 0.25, 0.3, 1.0], [-1.1, 0.15, -0.2, 0.9]].forEach(function (p) {
      var puff = new THREE.Mesh(new THREE.SphereGeometry(p[3], 7, 6), cloudMat);
      puff.position.set(p[0], p[1], p[2]);
      puff.scale.y = 0.55;
      cloud.add(puff);
    });
    cloud.position.set(-30 + Math.random() * 60, 13 + Math.random() * 5, START_BOUNDARY_Z - 10 - Math.random() * (pathTotalLength - 20));
    cloud.userData.speed = 0.25 + Math.random() * 0.25;
    scene.add(cloud);
    clouds.push(cloud);
  }
  function updateClouds(delta) {
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      c.position.x += c.userData.speed * delta;
      if (c.position.x > 45) c.position.x = -45;
    }
  }

  // ---------- LIVING WORLD: wind sway registry ----------
  // Vegetal props (trees/bamboo/palms/flowers) register here at build time;
  // updateSway() gives each a tiny phase-offset rotation wobble. Pure
  // transform animation — no vertex work, no per-frame allocation.
  var swayList = [];
  function registerSway(obj, amp) {
    swayList.push({ obj: obj, phase: Math.random() * Math.PI * 2, amp: amp, speed: 0.7 + Math.random() * 0.6 });
    return obj;
  }
  function updateSway(elapsedTime) {
    for (var i = 0; i < swayList.length; i++) {
      var it = swayList[i];
      it.obj.rotation.z = Math.sin(elapsedTime * it.speed + it.phase) * it.amp;
    }
  }

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
    return registerSway(group, 0.022);
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

  // ---------- REAL 3D MODELS for growth decor + champion trophies ----------
  // The scattered background dressing lining the corridor (ZONE_THEMES.makers,
  // used a few lines below) stays procedural — dozens of instances, cheap
  // primitives are the right call there. This is specifically for the 6
  // grow-in decor slots per zone plus the 1 champion trophy: real (Draco +
  // WebP compressed, ~9MB total for all 24) glTF models, one fetch per
  // unique file no matter how many slots reuse it.
  //
  // Async by nature (network fetch), but every call site here already treats
  // its return value as an opaque Object3D handle it can position/show/hide
  // immediately — so makeDecorFromModel() returns a placeholder Group on the
  // spot, and the real model quietly drops into it whenever the load
  // finishes (in practice: within a second or two of the hub tab opening,
  // long before a kid finishes enough missions to reveal any of these).
  var MODEL_BASE = './assets/hub3d/';
  // size = target world-space size (meters) for the model's LARGEST
  // dimension after fitModel() uniformly rescales it — tuned by eye against
  // the existing procedural props and Leo's ~1.3-unit height, not the
  // asset's own arbitrary source scale.
  var MODEL_SOURCES = {
    power_pole: { path: 'energy/power_pole.glb', size: 2.6 },
    lightning_bolt: { path: 'energy/lightning_bolt.glb', size: 1.3 },
    energy_orb: { path: 'energy/energy_orb.glb', size: 0.7 },
    target_board: { path: 'target/target_board.glb', size: 2.1 },
    flag: { path: 'target/flag.glb', size: 1.7 },
    golden_target: { path: 'target/golden_target.glb', size: 0.85 },
    bamboo: { path: 'zen/bamboo.glb', size: 2.3 },
    stone_lantern: { path: 'zen/stone_lantern.glb', size: 1.2 },
    lotus_pond: { path: 'zen/lotus_pond.glb', size: 1.5 },
    golden_lantern: { path: 'zen/golden_lantern.glb', size: 1.4 },
    bench: { path: 'play/bench.glb', size: 1.3 },
    slide: { path: 'play/slide.glb', size: 2.4 },
    champion_flag: { path: 'play/champion_flag.glb', size: 0.85 },
    fence: { path: 'home/fence.glb', size: 1.4 },
    flower_bed: { path: 'home/flower_bed.glb', size: 1.1 },
    swing: { path: 'home/swing.glb', size: 2.2 },
    mailbox: { path: 'home/mailbox.glb', size: 1.1 },
    flower_crown: { path: 'home/flower_crown.glb', size: 0.65 },
    palm_tree: { path: 'beach/palm_tree.glb', size: 2.6 },
    beach_umbrella: { path: 'beach/beach_umbrella.glb', size: 1.8 },
    sandcastle: { path: 'beach/sandcastle.glb', size: 1.2 },
    seashell: { path: 'beach/seashell.glb', size: 0.5 },
    golden_sun: { path: 'beach/golden_sun.glb', size: 0.75 }
  };

  var gltfLoaderPromise = null;
  function getGLTFLoader() {
    if (!gltfLoaderPromise) {
      // The compression pass on every hub3d asset (115MB -> 9.2MB) used
      // Draco geometry compression, so GLTFLoader needs a DRACOLoader
      // wired in to decode it — without this every model fails to parse
      // with "No DRACOLoader instance provided" and the slot just stays
      // an empty holder forever.
      gltfLoaderPromise = Promise.all([
        import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'),
        import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js')
      ]).then(function (mods) {
        var dracoLoader = new mods[1].DRACOLoader();
        dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
        var loader = new mods[0].GLTFLoader();
        loader.setDRACOLoader(dracoLoader);
        return loader;
      });
    }
    return gltfLoaderPromise;
  }
  // SkeletonUtils.clone (not Object3D.clone) — a couple of these assets carry
  // a skeleton/rig even though nothing here animates them (static decor), and
  // plain .clone(true) does not correctly rebind a SkinnedMesh's skeleton.
  var skeletonUtilsPromise = null;
  function getSkeletonUtils() {
    if (!skeletonUtilsPromise) {
      skeletonUtilsPromise = import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js');
    }
    return skeletonUtilsPromise;
  }

  // Scales the model uniformly so its largest dimension equals targetSize,
  // then re-centers it on X/Z and drops it so its base sits exactly on y=0 —
  // every source file has its own arbitrary scale/pivot (phone scans, AI
  // generations, marketplace downloads), so without this every decor slot
  // would be a different, wrong size and possibly floating or sunk into the
  // ground.
  function fitModel(model, targetSize) {
    var box = new THREE.Box3().setFromObject(model);
    var size = new THREE.Vector3();
    box.getSize(size);
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(targetSize / maxDim);
    var fitted = new THREE.Box3().setFromObject(model);
    var center = new THREE.Vector3();
    fitted.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= fitted.min.y;
  }

  // One shared "template" load per unique model key, cached — every slot
  // that uses the same key (e.g. energy's growth list uses power_pole three
  // times) triggers exactly one network fetch, then clones the fitted result.
  var modelTemplateCache = {};
  function loadDecorTemplate(key) {
    if (modelTemplateCache[key]) return modelTemplateCache[key];
    var def = MODEL_SOURCES[key];
    modelTemplateCache[key] = Promise.all([getGLTFLoader(), getSkeletonUtils()]).then(function (res) {
      var loader = res[0];
      return new Promise(function (resolve, reject) {
        loader.load(MODEL_BASE + def.path, function (gltf) {
          var model = gltf.scene;
          model.traverse(function (node) {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;
              // Flat cartoon lighting here has no environment map for PBR
              // metal reflections — an unset metalnessFactor (defaults to 1
              // per the glTF spec) renders almost black, same fix as Leo's
              // optional model in jumvi-leo.js.
              if (node.material) node.material.metalness = 0;
            }
          });
          fitModel(model, def.size);
          resolve(model);
        }, undefined, reject);
      });
    });
    return modelTemplateCache[key];
  }

  // Returns a (x, z) factory — drop-in replacement for the procedural
  // make*(x, z) functions used in ZONE_THEMES.growth() below. The holder
  // Group is real and positioned immediately; the actual mesh fades in
  // (growAnim's scale pop-in already treats the holder's visibility/scale as
  // the whole object, so this is invisible to every existing caller).
  function makeDecorFromModel(key) {
    return function (x, z) {
      var holder = new THREE.Group();
      holder.position.set(x || 0, 0, z || 0);
      // Known up-front from MODEL_SOURCES, independent of load/animation
      // timing — startGrowthFocus() reads this for camera framing instead of
      // measuring a live bounding box, which would be wrong both while the
      // model hasn't loaded yet (empty holder) and mid grow-in pop (holder's
      // own scale is briefly ~0.01, see startGrowAnim).
      holder.userData.decorSize = MODEL_SOURCES[key].size;
      Promise.all([loadDecorTemplate(key), getSkeletonUtils()]).then(function (res) {
        var template = res[0], SkeletonUtils = res[1];
        var inst = SkeletonUtils.clone(template);
        holder.add(inst);
      }).catch(function (err) {
        console.warn('Hub3D: decor model "' + key + '" failed to load:', err);
      });
      return holder;
    };
  }

  var makePowerPoleDecor = makeDecorFromModel('power_pole');
  var makeLightningBoltDecor = makeDecorFromModel('lightning_bolt');
  var makeEnergyOrbDecor = makeDecorFromModel('energy_orb');
  var makeTargetBoardDecor = makeDecorFromModel('target_board');
  var makeFlagDecor = makeDecorFromModel('flag');
  var makeGoldenTargetDecor = makeDecorFromModel('golden_target');
  var makeBambooDecor = makeDecorFromModel('bamboo');
  var makeStoneLanternDecor = makeDecorFromModel('stone_lantern');
  var makeLotusPondDecor = makeDecorFromModel('lotus_pond');
  var makeGoldenLanternDecor = makeDecorFromModel('golden_lantern');
  // team_flag.glb was a byte-identical copy of target/flag.glb — deduped to
  // the single 'flag' source so both zones share one fetch + one cache entry.
  var makeTeamFlagDecor = makeDecorFromModel('flag');
  var makeBenchDecor = makeDecorFromModel('bench');
  var makeSlideDecor = makeDecorFromModel('slide');
  var makeChampionFlagDecor = makeDecorFromModel('champion_flag');
  // fence.glb is a zero-thickness flat plane (bbox X=0) — it renders as a
  // paper-thin sliver that vanishes edge-on. The procedural picket fence reads
  // as a proper 3D fence from every angle, so use it here too. (proceduralDecor
  // is defined just below; hoisted function refs make the forward use fine.)
  var makeFenceDecor = function (x, z) { return proceduralDecor(makeFencePanel, 1.2)(x, z); };
  var makeFlowerBedDecor = makeDecorFromModel('flower_bed');
  var makeSwingDecor = makeDecorFromModel('swing');
  // mailbox + beach umbrella are the ONLY two skinned/rigged source models —
  // SkeletonUtils.clone of their broken bind pose threw giant stretched
  // triangles across the scene (the "mailbox turns everything red" bug). They
  // don't animate here anyway, so they use the clean procedural builders
  // instead; a tiny decorSize stamp keeps the growth-reveal camera framing
  // working the same as the model-backed slots. (No decor loads a skinned
  // model anymore.)
  function proceduralDecor(builder, size) {
    return function (x, z) { var o = builder(x, z); o.userData.decorSize = size; return o; };
  }
  var makeMailboxDecor = proceduralDecor(makeMailbox, 1.1);
  var makeFlowerCrownDecor = makeDecorFromModel('flower_crown');
  var makePalmTreeDecor = makeDecorFromModel('palm_tree');
  var makeBeachUmbrellaDecor = proceduralDecor(makeBeachUmbrella, 1.8);
  var makeSandcastleDecor = makeDecorFromModel('sandcastle');
  var makeSeashellDecor = makeDecorFromModel('seashell');
  var makeGoldenSunDecor = makeDecorFromModel('golden_sun');

  // themeKey -> champion model factory, matching each ZONE_THEMES entry's
  // championName 1:1 (energy orb, golden target, golden lantern, champion
  // flag, flower crown, golden sun).
  var CHAMPION_MODEL_BY_THEME = {
    energy: makeEnergyOrbDecor,
    target: makeGoldenTargetDecor,
    zen: makeGoldenLanternDecor,
    play: makeChampionFlagDecor,
    home: makeFlowerCrownDecor,
    beach: makeGoldenSunDecor
  };

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
    return registerSway(g, 0.03);
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
    return registerSway(g, 0.028);
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
    var modelFactory = CHAMPION_MODEL_BY_THEME[themeKey];
    if (modelFactory) return modelFactory();
    // Fallback only reached if a theme key doesn't match any real model
    // (shouldn't happen — kept so a future new zone without art yet still
    // gets a visible trophy instead of nothing).
    var g = new THREE.Group();
    var sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), championGoldMat);
    g.add(sunBall);
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
  var DECOR_CLEARANCE = 1.0;
  // Growth decor lives in a ~7-unit window around each gate (DECOR_SLOT_DEFS
  // spans dz -3 .. +4.2); keep the procedural edge dressing OUT of that window
  // so the two decor systems never pile into the same radial band around a
  // gate. Pushed a bit further out too (+1.6 base vs +1.2) so background trees
  // sit clearly behind the foreground growth props.
  function nearAnyGate(z) {
    for (var gi = 0; gi < gateConfig.length; gi++) {
      if (Math.abs(z - gateConfig[gi].z) < 6) return true;
    }
    return false;
  }
  var edgeDecorCounter = 0;
  for (var tz = START_BOUNDARY_Z - 2; tz > -pathTotalLength + START_BOUNDARY_Z; tz -= 4.5) {
    for (var side = -1; side <= 1; side += 2) {
      var propZ = tz + (Math.random() - 0.5) * 2;
      if (nearAnyGate(propZ)) continue; // leave the gate's growth window clear
      var zoneIdx = THREE.MathUtils.clamp(Math.floor(-propZ / ZONE_LENGTH), 0, ZONE_THEMES.length - 1);
      var zoneMakers = themeForZone(zoneIdx).makers();
      var maker = zoneMakers[edgeDecorCounter++ % zoneMakers.length];
      var propEdge = corridorHalfWidthAt(propZ) + DECOR_CLEARANCE + 1.6 + Math.random() * 1.2;
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
    return registerSway(group, 0.06);
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

  // (River + bridge removed by design decision: the bridge cluttered the
  // Lightning Hands zone and the crossing added nothing to the toss-and-catch
  // theme. The RIVER_Z path-flattening constants above are kept — the trail
  // math still references them harmlessly.)
  function updateRiver() {}

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
  // Spread wider along Z (±3.6 instead of ±2.2) with a staggered outward push
  // so no two objects sit dip-dibe: the old ±2.2 spacing put same-side props
  // only 2.2 apart, and a 2.4-2.6-deep model (slide, palm) then clipped its
  // same-side neighbour. Now same-side props are 3.6 apart (≥1 unit gap even
  // for the biggest), and the alternating push zig-zags them outward so they
  // never line up in a flat row. Reveal order fans left/right outward from
  // the gate, so each completed mission grows the zone a step further out.
  var DECOR_SLOT_DEFS = [
    { side: -1, dz: 0.6, push: 0.3 },
    { side: 1, dz: 0.6, push: 0.8 },
    { side: -1, dz: -3.0, push: 0.9 },
    { side: 1, dz: -3.0, push: 0.4 },
    { side: -1, dz: 4.2, push: 0.6 },
    { side: 1, dz: 4.2, push: 1.1 }
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
    if (demoMode) return DECOR_SLOT_DEFS.length;
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

    // Gate = a giant 3D JUMVI paddle standing on its handle, rim tinted with
    // the zone's theme color. The paddle FACE is the zone's progress meter:
    // one pie slice per completed mission fills the face (wired in
    // updateGateDecor), so a kid reads "how full is my paddle?" at a glance.
    // No floating name label anymore — zone naming lives on the entrance
    // signposts only (they doubled up before).
    var gateColor = themeForZone(cfg.zoneIndex).gateColor;
    var paddle = new THREE.Group();
    var faceMat = new THREE.MeshStandardMaterial({ color: 0xF7EFD9, flatShading: true });
    var face = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.12, 24), faceMat);
    face.rotation.x = Math.PI / 2;
    face.castShadow = true;
    paddle.add(face);
    var rimMat = new THREE.MeshStandardMaterial({
      color: gateColor, flatShading: true,
      emissive: gateColor, emissiveIntensity: 0.35
    });
    var rim = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.1, 8, 28), rimMat);
    rim.castShadow = true;
    paddle.add(rim);
    var handleMat = new THREE.MeshStandardMaterial({ color: 0x9C7144, flatShading: true });
    var handle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.15), handleMat);
    handle.position.y = -1.35;
    handle.castShadow = true;
    paddle.add(handle);
    var knob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), handleMat);
    knob.position.y = -1.82;
    paddle.add(knob);
    // progress pie slices on the face — hidden until missions complete
    var sliceMat = new THREE.MeshStandardMaterial({ color: gateColor, flatShading: true, emissive: gateColor, emissiveIntensity: 0.22, side: THREE.DoubleSide });
    var fillSlices = [];
    for (var si = 0; si < DECOR_SLOT_DEFS.length; si++) {
      var slice = new THREE.Mesh(
        new THREE.CircleGeometry(0.9, 10, Math.PI / 2 + si * (Math.PI * 2 / DECOR_SLOT_DEFS.length), Math.PI * 2 / DECOR_SLOT_DEFS.length),
        sliceMat
      );
      slice.position.z = 0.08;
      slice.visible = false;
      paddle.add(slice);
      fillSlices.push(slice);
    }
    // gold center star, revealed at 100% together with the champion trophy
    var faceStar = new THREE.Mesh(new THREE.CircleGeometry(0.3, 5), championGoldMat);
    faceStar.position.z = 0.1;
    faceStar.visible = false;
    paddle.add(faceStar);
    paddle.position.y = 1.95;
    paddle.userData.baseY = 1.95;
    // each gate bobs/breathes slightly out of phase so they don't all move in lockstep
    paddle.userData.phase = cfg.id * 1.7;
    group.add(paddle);

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
    // Theme trophy — only shown at 100% (champion). Grounded on the paddle's
    // base platform, off to one side of the handle, instead of the old
    // floating-in-the-air placement: the real champion models read as dark
    // objects floating with a gap above the paddle ("flying icon"), so
    // resting the trophy on the pedestal reads far better and the paddle's
    // own full-gold face + center star already carry the "complete" beat.
    var championProp = makeChampionProp(themeForZone(cfg.zoneIndex).key);
    championProp.position.set(0.55, 0.15, 0);
    championProp.visible = false;
    group.add(championProp);

    group.position.set(cfg.x, 0, cfg.z);
    group.lookAt(0, 0, 0);
    // "ring" stays the animation handle's name everywhere (awareness, bob,
    // scale pulses) but now points at the whole paddle; the rim's material
    // is what glows, exposed separately for the tick's breathing-glow line.
    group.userData.ring = paddle;
    group.userData.glowMat = rimMat;
    group.userData.fillSlices = fillSlices;
    group.userData.faceStar = faceStar;
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
  if (demoMode) {
    fogWalls.forEach(function (fw) { fw.dissolved = true; fw.wall.visible = false; fw.particles.visible = false; });
  }

  // ---------- ZONE LANDMARKS + ENTRANCE SIGNPOSTS ----------
  // One BIG instantly-readable icon structure per zone (the small edge props
  // set the texture, the landmark sets the identity: "this is the target
  // range") plus a wooden signpost with the zone's name at each entrance.
  var toriiMat = new THREE.MeshStandardMaterial({ color: 0xC6423B, flatShading: true });
  var houseWallMat = new THREE.MeshStandardMaterial({ color: 0xF2E2C4, flatShading: true });
  var lighthouseWhiteMat = new THREE.MeshStandardMaterial({ color: 0xF7F3E8, flatShading: true });
  function makeLandmark(themeKey) {
    var g = new THREE.Group();
    if (themeKey === 'energy') {
      var tower = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 3.4, 6), darkPoleMat);
      tower.position.y = 1.7; tower.castShadow = true; g.add(tower);
      var coil = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 14), energyOrbMat);
      coil.rotation.x = Math.PI / 2; coil.position.y = 3.0; g.add(coil);
      var orb = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 10), energyOrbMat);
      orb.position.y = 3.9; g.add(orb);
    } else if (themeKey === 'target') {
      [-0.55, 0.55].forEach(function (lx) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 2.4, 6), woodMat);
        leg.position.set(lx, 1.2, 0); leg.rotation.x = lx < 0 ? 0.14 : -0.14; leg.castShadow = true; g.add(leg);
      });
      [[1.4, 0], [1.0, 0.02], [0.6, 0.04], [0.24, 0.06]].forEach(function (r, ri) {
        var disc = new THREE.Mesh(new THREE.CircleGeometry(r[0], 24), ri % 2 ? targetWhiteMat : targetRedMat);
        disc.position.set(0, 2.6, r[1]); g.add(disc);
      });
    } else if (themeKey === 'zen') {
      [-1.1, 1.1].forEach(function (lx) {
        var pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 2.6, 7), toriiMat);
        pillar.position.set(lx, 1.3, 0); pillar.castShadow = true; g.add(pillar);
      });
      var beamTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.24, 0.3), toriiMat);
      beamTop.position.y = 2.72; beamTop.castShadow = true; g.add(beamTop);
      var beamMid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.24), toriiMat);
      beamMid.position.y = 2.2; g.add(beamMid);
      var pond = new THREE.Mesh(new THREE.CircleGeometry(1.0, 16), poolMat);
      pond.rotation.x = -Math.PI / 2; pond.position.set(1.9, 0.02, 0.6); g.add(pond);
    } else if (themeKey === 'play') {
      var ramp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 3.2), slideMat);
      ramp.position.y = 1.15; ramp.rotation.x = 0.68; ramp.castShadow = true; g.add(ramp);
      [-0.35, 0.35].forEach(function (lx) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), flagPoleMat);
        post.position.set(lx, 1.1, -1.35); g.add(post);
      });
      var deck = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.8), slideMat);
      deck.position.set(0, 2.15, -1.35); g.add(deck);
      var arch = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.1, 8, 12, Math.PI), benchMat);
      arch.position.set(0, 2.3, -1.35); g.add(arch);
    } else if (themeKey === 'home') {
      var walls = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 1.8), houseWallMat);
      walls.position.y = 0.85; walls.castShadow = true; g.add(walls);
      var roof = new THREE.Mesh(new THREE.ConeGeometry(1.85, 1.2, 4), toriiMat);
      roof.position.y = 2.3; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
      var door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.06), woodMat);
      door.position.set(0, 0.45, 0.92); g.add(door);
      var win = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.06), poolMat);
      win.position.set(0.65, 1.05, 0.92); g.add(win);
    } else {
      // beach lighthouse: striped stack + glowing lamp
      for (var li = 0; li < 4; li++) {
        var band = new THREE.Mesh(new THREE.CylinderGeometry(0.42 - li * 0.05, 0.46 - li * 0.05, 0.8, 8), li % 2 ? toriiMat : lighthouseWhiteMat);
        band.position.y = 0.4 + li * 0.8; band.castShadow = true; g.add(band);
      }
      var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), energyOrbMat);
      lamp.position.y = 3.5; g.add(lamp);
      var cap = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.4, 8), toriiMat);
      cap.position.y = 3.95; g.add(cap);
    }
    return g;
  }
  gateConfig.forEach(function (cfg, i) {
    var lz = cfg.z + 2.6;
    var side = (i % 2 === 0) ? 1 : -1;
    var lx = pathCenterX(lz) + side * (corridorHalfWidthAt(lz) + 3.2);
    var lm = makeLandmark(themeForZone(cfg.zoneIndex).key);
    lm.position.set(lx, 0, lz);
    lm.lookAt(pathCenterX(lz), 0, lz);
    scene.add(lm);

    // entrance signpost: wooden post + a small billboarded zone-name plaque.
    // Pushed further off the path (was +0.9) and the label shrunk to ~0.45×
    // its default: at full size the long "⚡ Energy Zone" sprite filled the
    // whole screen when you stood near it. It's a little world sign now, not a
    // banner — the HUD chip up top is the primary zone read anyway.
    var sz = (cfg.zoneIndex === 0 ? START_BOUNDARY_Z - 2.5 : zoneBoundaryZ(cfg.zoneIndex) - 1.6);
    var sx = pathCenterX(sz) + (corridorHalfWidthAt(sz) + 2.2) * (i % 2 === 0 ? -1 : 1);
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.2, 6), woodMat);
    post.position.set(sx, 0.6, sz);
    post.castShadow = true;
    scene.add(post);
    var signLabel = createLabelSprite(themeForZone(cfg.zoneIndex).cardTitle);
    signLabel.scale.multiplyScalar(0.46);
    signLabel.position.set(sx, 1.42, sz);
    scene.add(signLabel);
  });

  // ---------- DRIFTING LEAVES (occasional, forest feel) ----------
  var leafMat = new THREE.MeshStandardMaterial({ color: 0xD9A44A, flatShading: true, side: THREE.DoubleSide });
  var leaves = [];
  for (var lfi = 0; lfi < 6; lfi++) {
    var leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.11), leafMat);
    var anchorZ = -2 - Math.random() * 30;
    leaf.userData = {
      ax: pathCenterX(anchorZ) + (Math.random() - 0.5) * 8,
      az: anchorZ,
      phase: Math.random() * Math.PI * 2,
      fall: 0.09 + Math.random() * 0.06,
      y0: 4.5 + Math.random() * 2
    };
    scene.add(leaf);
    leaves.push(leaf);
  }
  // ---------- THEMED TRAIL DECALS (the path itself tells the zone's story) ----------
  // Flat decorative shapes ON the dirt trail, themed per zone: lightning
  // bolts through the energy zone, target rings in the range, leaves in the
  // zen garden, confetti dots in the playground, stepping stones in the
  // backyard, starfish on the beach. Static meshes, y-offset above the
  // trail, skipped near each gate so the paddle area stays clean.
  (function buildTrailDecals() {
    var decalY = 0.028;
    var zenLeafMat = new THREE.MeshStandardMaterial({ color: 0x7FA96B, flatShading: true, side: THREE.DoubleSide });
    var stoneMat = new THREE.MeshStandardMaterial({ color: 0xD8CBB4, flatShading: true });
    var starMat = new THREE.MeshStandardMaterial({ color: 0xF2C14E, flatShading: true, side: THREE.DoubleSide });
    var dotMats = [0xF2789F, 0x54A8E8, 0xF2A54A].map(function (c) {
      return new THREE.MeshStandardMaterial({ color: c, flatShading: true });
    });
    function boltShape() {
      var sh = new THREE.Shape();
      sh.moveTo(0.02, 0.3); sh.lineTo(0.14, 0.3); sh.lineTo(0.05, 0.05);
      sh.lineTo(0.13, 0.05); sh.lineTo(-0.06, -0.3); sh.lineTo(0.0, -0.02);
      sh.lineTo(-0.08, -0.02); sh.closePath();
      return sh;
    }
    function starShape() {
      var sh = new THREE.Shape();
      for (var k = 0; k < 10; k++) {
        var r = (k % 2 === 0) ? 0.2 : 0.085;
        var a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        if (k === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      sh.closePath();
      return sh;
    }
    function makeDecal(themeKey) {
      var g = new THREE.Group();
      if (themeKey === 'energy') {
        g.add(new THREE.Mesh(new THREE.ShapeGeometry(boltShape()), boltMat));
      } else if (themeKey === 'target') {
        var ring1 = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 16), targetRedMat);
        var ring2 = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), targetWhiteMat);
        var dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), targetRedMat);
        ring2.position.z = -0.001; dot.position.z = 0.001;
        g.add(ring1); g.add(ring2); g.add(dot);
      } else if (themeKey === 'zen') {
        var leaf = new THREE.Mesh(new THREE.CircleGeometry(0.17, 8), zenLeafMat);
        leaf.scale.y = 0.55;
        g.add(leaf);
      } else if (themeKey === 'play') {
        dotMats.forEach(function (dm, di) {
          var d = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8), dm);
          d.position.set((di - 1) * 0.24, (di % 2 ? -0.08 : 0.08), 0);
          g.add(d);
        });
      } else if (themeKey === 'home') {
        g.add(new THREE.Mesh(new THREE.CircleGeometry(0.2, 6), stoneMat));
      } else {
        g.add(new THREE.Mesh(new THREE.ShapeGeometry(starShape()), starMat));
      }
      return g;
    }
    gateConfig.forEach(function (cfg) {
      var themeKey = themeForZone(cfg.zoneIndex).key;
      var zTop = -cfg.zoneIndex * ZONE_LENGTH - 1.2;
      var zBottom = -(cfg.zoneIndex + 1) * ZONE_LENGTH + 1.2;
      var flip = 1;
      for (var z = zTop; z > zBottom; z -= 2.1) {
        if (Math.abs(z - cfg.z) < 1.8) continue; // keep the paddle-gate area clean
        var decal = makeDecal(themeKey);
        decal.rotation.x = -Math.PI / 2;
        decal.rotation.z = (Math.random() - 0.5) * 0.8;
        flip = -flip;
        decal.position.set(pathCenterX(z) + flip * 0.42 + (Math.random() - 0.5) * 0.3, decalY, z);
        scene.add(decal);
      }
    });
  })();

  function updateLeaves(elapsedTime) {
    for (var i = 0; i < leaves.length; i++) {
      var lf = leaves[i], u = lf.userData;
      var cycle = (elapsedTime * u.fall + u.phase) % 1.0;
      lf.position.set(
        u.ax + Math.sin(elapsedTime * 1.3 + u.phase) * 0.9,
        u.y0 * (1 - cycle),
        u.az + Math.cos(elapsedTime * 0.9 + u.phase) * 0.6
      );
      lf.rotation.set(elapsedTime * 1.7 + u.phase, elapsedTime * 1.1, 0);
    }
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
    if (isMissionViewOpen()) return; // controls off while the mission view is up
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
    if (!isDrag) cancelAutoWalk(); // a fresh manual tap overrides the guided walk
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
  // 0..1 blend between the chase camera and an active focus target, eased in
  // when a growth reveal / medal ceremony starts and out when it ends (see
  // the chase-camera block) so focus enter/exit glides instead of snapping.
  var focusBlend = 0;

  function updateMovement(delta) {
    var ix = 0, iz = 0;
    if (!isMissionViewOpen()) {
      if (keys.f) iz -= 1;
      if (keys.b) iz += 1;
      if (keys.l) ix -= 1;
      if (keys.r) ix += 1;
    }
    if (keys.f || keys.b || keys.l || keys.r) {
      if (moveTargetActive) fadeOutTargetRing();
      moveTargetActive = false; // WASD takes over from an in-progress tap-to-move walk
      cancelAutoWalk();
    }

    // Auto-walk waypoint feed: when the current leg is finished, hand the
    // movement system the next point on the trail. Intermediate waypoints
    // are pass-through (no slow-down, generous arrive radius) so the walk
    // reads as one continuous stroll, not stop-and-go.
    if (autoWalk && !moveTargetActive && ix === 0 && iz === 0 && !isMissionViewOpen()) {
      if (autoWalk.i < autoWalk.points.length) {
        var wp = autoWalk.points[autoWalk.i++];
        moveTarget.x = wp.x;
        moveTarget.z = wp.z;
        moveTargetActive = true;
        if (autoWalk.i === autoWalk.points.length) showTargetRing(wp.x, wp.z);
      } else {
        autoWalk = null;
        hideTrail();
      }
    }

    // Tap-to-move steering: world-space direction straight toward the tapped
    // ground point (not camera-relative — there's no "stick angle" to
    // reinterpret here, just a destination). Only kicks in when WASD isn't
    // already driving ix/iz above.
    var tapSlowFactor = 1;
    if (ix === 0 && iz === 0 && moveTargetActive) {
      var isThroughPoint = autoWalk && autoWalk.i < autoWalk.points.length;
      var arriveDist = isThroughPoint ? 1.1 : MOVE_ARRIVE_DIST;
      var dxT = moveTarget.x - leo.group.position.x;
      var dzT = moveTarget.z - leo.group.position.z;
      var distT = Math.sqrt(dxT * dxT + dzT * dzT);
      if (distT < arriveDist) {
        moveTargetActive = false;
        fadeOutTargetRing();
      } else {
        ix = dxT / distT;
        iz = dzT / distT;
        if (!isThroughPoint) tapSlowFactor = Math.min(1, distT / MOVE_SLOW_RADIUS);
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
    // The default (chase) camera + look-at target. A focus event (growth
    // reveal / medal ceremony) computes its OWN target below, then we blend
    // between the two by focusBlend so entering and leaving a focus is a
    // smooth glide, not the hard snap the old instant-switch produced.
    var chaseCamX = leo.group.position.x - forwardX * CAM_DISTANCE_BACK;
    var chaseCamZ = leo.group.position.z - forwardZ * CAM_DISTANCE_BACK;
    var chaseCamY = CAM_HEIGHT;
    var chaseLookX = leo.group.position.x + forwardX * CAM_LOOKAHEAD_DIST;
    var chaseLookY = CAM_LOOKAHEAD_HEIGHT;
    var chaseLookZ = leo.group.position.z + forwardZ * CAM_LOOKAHEAD_DIST;

    // Whichever focus is active supplies the focus target; focusBlend eases
    // toward 1 while a focus is active and back toward 0 when it clears.
    var focusActive = !!(ceremonyFocus || growthFocus);
    var focusCamX = chaseCamX, focusCamZ = chaseCamZ, focusCamY = chaseCamY;
    var focusLookX = chaseLookX, focusLookY = chaseLookY, focusLookZ = chaseLookZ;
    if (ceremonyFocus) {
      var gc = ceremonyFocus.cfg;
      focusCamX = gc.x; focusCamZ = gc.z + 4.6; focusCamY = 2.6;
      focusLookX = gc.x; focusLookY = 1.3; focusLookZ = gc.z;
    } else if (growthFocus) {
      // Distance/height scale with the object's own size (radius) instead of
      // a fixed offset — a seashell gets pulled in close, the giraffe slide
      // gets backed off enough to see the whole thing.
      var gobj = growthFocus.obj;
      var gr = growthFocus.radius;
      focusCamX = gobj.position.x - gr * 1.3;
      focusCamZ = gobj.position.z + gr * 1.8 + 0.6;
      focusCamY = gobj.position.y + gr * 0.9 + 0.5;
      focusLookX = gobj.position.x; focusLookY = gobj.position.y + gr * 0.5; focusLookZ = gobj.position.z;
    }
    // Ease focusBlend in/out (~0.75s each way). smoothstep is applied at use
    // so both ends are gentle; the raw blend just ramps linearly here. Longer
    // than the object-reveal itself on purpose — spreads the camera travel out
    // so re-acquiring the chase view is a slow glide, not a fast whip-back.
    var blendRate = delta / 0.75;
    focusBlend += (focusActive ? blendRate : -blendRate);
    focusBlend = Math.max(0, Math.min(1, focusBlend));
    var fb = focusBlend * focusBlend * (3 - 2 * focusBlend); // smoothstep

    var targetCamX = chaseCamX + (focusCamX - chaseCamX) * fb;
    var targetCamZ = chaseCamZ + (focusCamZ - chaseCamZ) * fb;
    var targetCamY = chaseCamY + (focusCamY - chaseCamY) * fb;
    var lookAtX = chaseLookX + (focusLookX - chaseLookX) * fb;
    var lookAtY = chaseLookY + (focusLookY - chaseLookY) * fb;
    var lookAtZ = chaseLookZ + (focusLookZ - chaseLookZ) * fb;

    camera.position.x += (targetCamX - camera.position.x) * Math.min(delta * camLagFactor, 1);
    camera.position.z += (targetCamZ - camera.position.z) * Math.min(delta * camLagFactor, 1);
    camera.position.y += (targetCamY - camera.position.y) * Math.min(delta * camLagFactor, 1);

    camera.lookAt(lookAtX, lookAtY, lookAtZ);
  }

  // ---------- MISSION VIEW BRIDGE (opens the app's FULL mission modal) ----------
  // The hub's earlier custom bottom sheet is gone: gates now open the app's
  // own full mission view (timer, caller, score, hold-to-done, tips&safety —
  // everything, bit-identical to the Missions tab). The two historical bugs
  // stay fixed by different means: cross-pack "smart next" is bypassed via
  // window._hubMissionFlow (btnNext in app.js goes pack-scoped while it's
  // set, and shows "Zone Complete!" when the pack is done), and
  // markMissionDone's source guard is simply irrelevant now because the app
  // view re-rendering itself on done is exactly what we want. Closing the
  // modal lands back on the hub because the hub tab never stopped being the
  // active tab underneath. window._hubMissionFlow is cleared by the app's
  // closeMission().
  var appBackdropEl = document.getElementById('backdrop');
  function isMissionViewOpen() {
    return !!(appBackdropEl && appBackdropEl.classList.contains('show'));
  }
  function openMissionFromHub(packKey, missionId) {
    // Hand the zone's theme colour to app.js so the full-page mission view can
    // tint itself to the badge the kid walked into (see applyHubMissionTheme
    // there). '#rrggbb' string so app.js needs no THREE dependency.
    var cfg = gateConfig.filter(function (c) { return c.packKey === packKey; })[0];
    var themeHex = cfg ? '#' + new THREE.Color(themeForZone(cfg.zoneIndex).gateColor).getHexString() : null;
    window._hubMissionFlow = { packKey: packKey, themeColor: themeHex };
    openMission(missionId);
  }

  // Called by app.js's markMissionDone once it auto-closes the mission view
  // (see the hub-flow branch there): decides what happens next now that the
  // kid is looking at the hub again. If the pack still has an undone
  // mission, wait for the growth reveal below to play out, then walk
  // straight into it — same one-tap-per-mission rhythm as arriving fresh at
  // the gate. If the pack just finished, do nothing here; the medal
  // ceremony below (updateGateDecor's isChampion branch) is the payoff.
  window._hub3dAdvance = function (packKey) {
    var packMissions = packMissionList(packKey);
    var nextUndone = packMissions.find(function (m) { return !done.has(m.id); });
    if (!nextUndone) return;
    var start = performance.now();
    // Single-overlay rule (audit Bulgu #12): after the growth reveal plays,
    // do NOT pop the next mission card on top of a reward overlay. If the
    // badge-unlock modal (or a still-open mission view) is up, wait for it to
    // be dismissed first — so the kid sees growth → badge → next, one at a
    // time. Hard 20s cap so a left-open modal can never wedge the flow.
    function tryOpen() {
      var badge = document.getElementById('badgeUnlockModal');
      var overlayUp = (badge && badge.classList.contains('show')) || isMissionViewOpen();
      if (overlayUp && performance.now() - start < 20000) {
        setTimeout(tryOpen, 300);
        return;
      }
      openMissionFromHub(packKey, nextUndone.id);
    }
    setTimeout(tryOpen, GROWTH_FOCUS_MS + 250);
  };

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
    if (isMissionViewOpen()) return; // no re-trigger while the mission view is up
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
        openMissionFromHub(gatePackKey, missionId);
      }
    }
  }

  // ---------- LIVING WORLD: per-mission growth + instant reward ----------
  // Center-screen "Bravo!" card for the instant reward moment — own element
  // (not the zone card) so a zone entry and a reward can't clobber each other.
  var rewardCardEl = document.createElement('div');
  // max-width + text-align (no more white-space:nowrap) so a long item name
  // wraps inside the card on a narrow phone instead of running off-screen —
  // the previous nowrap forced a single line that could overflow the viewport.
  rewardCardEl.style.cssText = 'position:absolute;top:30%;left:50%;transform:translate(-50%,-50%);z-index:16;pointer-events:none;background:rgba(255,255,255,0.94);padding:12px 22px;border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,0.22);opacity:0;font-size:15px;font-weight:800;color:#3a2a1a;text-align:center;max-width:82vw;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
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
  // ---------- MEDAL CEREMONY (pack hits 100% while the hub is live) ----------
  // Reward theater in four beats: soft camera zoom to the gate, a BIG gold
  // medal with the pack's icon pops center-screen with confetti, the medal
  // flies into its slot in the HUD badge bar (the "it joined my collection"
  // link), and the badge slot pulses gold. Fog dissolve / next-zone opening
  // then continues through the existing updateZoneLocks flow untouched.
  var ceremonyFocus = null; // { cfg, start, dur } — camera override window

  // ---------- GROWTH REVEAL (single mission done, pack not yet finished) ----------
  // The camera borrows itself for a moment to approach whatever decor piece
  // just popped in — the "come see what you grew" beat between missions.
  // Smaller/shorter than the medal ceremony below (that one owns the finale).
  var GROWTH_FOCUS_MS = 1700;
  var growthFocus = null; // { obj, start, dur, radius } — camera override window
  function startGrowthFocus(obj) {
    // Real models vary wildly in size (a seashell vs. the giraffe slide) —
    // frame each one by its own known size (userData.decorSize, stamped in
    // makeDecorFromModel) instead of a fixed camera offset, so small props
    // aren't lost in the distance and big ones don't fill the whole screen.
    var radius = (obj.userData.decorSize || 1.2) / 2;
    growthFocus = { obj: obj, start: performance.now(), dur: GROWTH_FOCUS_MS, radius: radius };
  }
  function updateGrowthFocus() {
    if (growthFocus && performance.now() - growthFocus.start > growthFocus.dur) growthFocus = null;
  }

  function startMedalCeremony(cfg) {
    ceremonyFocus = { cfg: cfg, start: performance.now(), dur: 2600 };
    playSuccess();
    try {
      if (window.confetti) {
        window.confetti({ particleCount: 90, spread: 85, origin: { x: 0.5, y: 0.35 } });
        setTimeout(function () { window.confetti({ particleCount: 60, spread: 70, origin: { x: 0.5, y: 0.3 } }); }, 400);
      }
    } catch (e) {}
    var medal = document.createElement('div');
    medal.style.cssText = 'position:absolute;top:44%;left:50%;transform:translate(-50%,-50%) scale(.3);z-index:24;width:110px;height:110px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:52px;background:radial-gradient(circle at 35% 30%,#ffe9a8,#f3b93c 58%,#c98a1e);box-shadow:0 8px 26px rgba(0,0,0,.4),inset 0 3px 8px rgba(255,255,255,.6);border:4px solid #a8741a;transition:transform 480ms cubic-bezier(.34,1.56,.64,1),opacity 300ms ease;opacity:0;pointer-events:none;';
    medal.textContent = cfg.icon;
    container.appendChild(medal);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      medal.style.opacity = '1';
      medal.style.transform = 'translate(-50%,-50%) scale(1)';
    }); });
    setTimeout(function () {
      var slot = badgeSlots[cfg.id];
      if (!slot) { medal.remove(); return; }
      var mRect = medal.getBoundingClientRect();
      var sRect = slot.getBoundingClientRect();
      var dx = (sRect.left + sRect.width / 2) - (mRect.left + mRect.width / 2);
      var dy = (sRect.top + sRect.height / 2) - (mRect.top + mRect.height / 2);
      medal.style.transition = 'transform 700ms cubic-bezier(.5,.05,.4,1),opacity 700ms ease';
      medal.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(0.27)';
      medal.style.opacity = '0.92';
      setTimeout(function () {
        medal.remove();
        playChime();
        slot.style.transition = 'transform 260ms cubic-bezier(.34,1.56,.64,1)';
        slot.style.transform = 'scale(1.45)';
        slot.style.background = '#FFD23F';
        setTimeout(function () { slot.style.transform = 'scale(1)'; }, 300);
      }, 700);
    }, 1500);
  }
  function updateMedalCeremony() {
    if (ceremonyFocus && performance.now() - ceremonyFocus.start > ceremonyFocus.dur) ceremonyFocus = null;
  }

  // ---------- CHAMPION CERTIFICATE INVITE (all missions done) ----------
  // The certificate modal itself already exists in the app (name, Save to
  // Photos, PDF) — the hub only detects the 36/36 moment, throws the big
  // finale, and hands off to the app's own openCertificate().
  // (returning champions who were already 36/36 before this session don't
  // get the finale replayed every visit — the invite is for the MOMENT)
  var certInviteShown = missions.length > 0 && done.size >= missions.length;
  var certInviteEl = document.createElement('div');
  certInviteEl.style.cssText = 'position:absolute;top:42%;left:50%;transform:translate(-50%,-50%);z-index:25;background:rgba(255,255,255,0.97);padding:22px 24px;border-radius:22px;box-shadow:0 12px 34px rgba(0,0,0,0.4);display:none;flex-direction:column;gap:10px;max-width:310px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  container.appendChild(certInviteEl);
  function updateCertificateInvite() {
    if (certInviteShown || demoMode) return;
    if (!missions.length || done.size < missions.length) return;
    certInviteShown = true;
    certInviteEl.innerHTML =
      '<div style="font-size:44px;line-height:1;">🏆</div>' +
      '<div style="font-size:20px;font-weight:900;color:#3a2a1a;">' + HUB_TEXTS.certTitle + '</div>' +
      '<div style="font-size:14px;font-weight:700;color:#5a4632;">' + HUB_TEXTS.certBody(missions.length) + '</div>' +
      '<button type="button" style="border:none;border-radius:14px;background:linear-gradient(180deg,#FFD23F,#E8A23A);color:#4a3000;font-size:15px;font-weight:900;padding:12px 0;cursor:pointer;box-shadow:0 4px 0 #b07716;font-family:inherit;">' + HUB_TEXTS.certBtn + '</button>';
    certInviteEl.style.display = 'flex';
    certInviteEl.querySelector('button').addEventListener('click', function () {
      certInviteEl.style.display = 'none';
      if (opts.openCertificate) opts.openCertificate();
    });
    playSuccess();
    leoCelebrating = { startTime: performance.now(), baseFacingY: leo.group.rotation.y };
    try {
      if (window.confetti) {
        [0, 300, 700, 1100].forEach(function (d) {
          setTimeout(function () { window.confetti({ particleCount: 80, spread: 100, origin: { x: Math.random(), y: 0.3 } }); }, d);
        });
      }
    } catch (e) {}
  }

  // Perf guard: everything below only depends on the done Set, so skip the
  // whole pass unless its size actually changed since last frame (demoMode's
  // full-visible override is constant, so it settles on the first pass too).
  var lastDecorDoneSize = -1;
  function updateGateDecor() {
    // Defer the whole reveal while the mission view covers the hub — the
    // done Set already changed underneath it, but popping the decor in and
    // panning the camera to it would be invisible (and wasted) behind the
    // full-page modal. The instant it closes, this catches up on the very
    // next frame, so the reveal is the first thing the kid sees back in 3D.
    if (isMissionViewOpen()) return;
    if (done.size === lastDecorDoneSize) return;
    lastDecorDoneSize = done.size;
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

      var isChampion = getPackCompletion(cfg.packKey) >= 1 || demoMode;
      group.userData.champion.visible = isChampion;
      group.userData.championProp.visible = isChampion;
      group.userData.ring.userData.champion = isChampion;
      group.userData.faceStar.visible = isChampion;
      // paddle face fills one pie slice per completed mission
      group.userData.fillSlices.forEach(function (slice, si) {
        slice.visible = si < count;
      });

      if (!isInitial && count > prev) {
        var theme = themeForZone(cfg.zoneIndex);
        var newest = group.userData.decorSlots[Math.min(count, group.userData.decorSlots.length) - 1];
        var itemName = isChampion ? theme.championName : (newest && newest.userData.rewardName) || HUB_TEXTS.surprise;
        showRewardCard(HUB_TEXTS.reward(theme.cardTitle, itemName));
        playChime();
        leoCelebrating = { startTime: performance.now(), baseFacingY: leo.group.rotation.y };
        // Pack just hit 100% while the hub is live → full medal ceremony
        // (covers the LAST zone too, which has no fog wall to unlock).
        // Otherwise: an ordinary single-mission reveal gets the camera's
        // attention on whatever just grew.
        if (isChampion && !demoMode) startMedalCeremony(cfg);
        else if (!demoMode && newest) startGrowthFocus(newest);
      }
    });
  }

  // ---------- ZONE LOCKS (computed live from the real `done` Set — no separate state) ----------
  // This lock is purely a 3D-hub concept: it never touches `done`, never adds
  // any other state, and the Browse/Today tabs are completely unaware of it —
  // they keep reading `done` exactly as before.
  function isZoneUnlocked(zoneIndex) {
    if (demoMode) return true;
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
    updateGrowthFocus();
    updateMedalCeremony();
    updateCertificateInvite();
    elapsedTime += delta;

    updateRiver(elapsedTime);
    updateSea(elapsedTime);
    updateClouds(delta);
    updateSway(elapsedTime);
    updateLeaves(elapsedTime);
    updateButterflies(elapsedTime);
    updateBirds(elapsedTime);

    gateConfig.forEach(function (cfg) {
      var meshGroup = gateMeshes[cfg.id];
      var ring = meshGroup.userData.ring;
      // gentle up/down bob, out of phase per gate so they don't move in lockstep
      var bob = Math.sin(elapsedTime * 1.6 + ring.userData.phase) * 0.08;
      ring.position.y = ring.userData.baseY + bob;

      // slow breathing glow — a fully-completed pack's gate glows a bit brighter
      var champBoost = ring.userData.champion ? 0.25 : 0;
      meshGroup.userData.glowMat.emissiveIntensity = 0.35 + champBoost + 0.18 * Math.sin(elapsedTime * 1.2 + ring.userData.phase);

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
        // Slow spin in place on the pedestal — no more vertical bob now that
        // it's grounded on the platform rather than floating.
        meshGroup.userData.championProp.rotation.y += delta * 0.6;
      }
    });

    renderer.render(scene, camera);
  }

  // ---------- LOOP (pause/resume-able — see hideHub3D()/showHub3D() in app.js) ----------
  var clock = new THREE.Clock();
  var running = false;
  var rafId = null;

  // While the full-screen mission card is up, the 3D scene is completely
  // covered and its movement/gate logic already no-ops — but the render call
  // kept firing ~60fps, burning battery/heat for nothing (audit Bulgu #19).
  // Throttle the loop to ~4fps in that state; full speed resumes the instant
  // the card closes (the growth reveal / camera focus all run after that).
  var _missionViewLastTick = 0;
  function animate() {
    rafId = requestAnimationFrame(animate);
    var delta = Math.min(clock.getDelta(), 0.1);
    if (isMissionViewOpen()) {
      var now = performance.now();
      if (now - _missionViewLastTick < 240) return;
      _missionViewLastTick = now;
    }
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
    muteBtn.textContent = isMuted() ? '🔇' : '🔊'; // Settings may have changed while away
    clock.getDelta(); // discard time elapsed while paused, avoid a huge first delta
    animate();
  }
  function pause() {
    if (!running) return;
    running = false;

    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Intentionally NOT auto-started — the caller (app.js) decides when to call
  // resume(), and re-checks that the hub is still the active tab before doing
  // so (loading is async; the user may navigate away before it finishes).
  return { pause: pause, resume: resume };
}
