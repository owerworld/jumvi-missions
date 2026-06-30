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
import { createCoachLeo } from './jumvi-leo.js?v=20260524-27';

export function initHub3D(opts) {
  var PACKS = opts.PACKS;
  var missions = opts.missions;
  var done = opts.done;
  var openMission = opts.openMission;
  var container = opts.container;

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
  celebrationTitleEl.textContent = 'Bölge Tamamlandı! 🎉';
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

  var hintEl = document.createElement('div');
  hintEl.textContent = 'WASD ile hareket et — gate’e yaklaş, mission paneli açılır';
  hintEl.style.cssText = 'position:absolute;bottom:14px;right:14px;background:rgba(255,255,255,0.85);padding:7px 13px;border-radius:11px;font-size:11px;color:#555;z-index:10;max-width:220px;text-align:right;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
  container.appendChild(hintEl);

  var joystickZone = document.createElement('div');
  joystickZone.style.cssText = 'position:absolute;bottom:0;left:0;width:50%;height:45%;z-index:5;';
  var joystickBase = document.createElement('div');
  joystickBase.style.cssText = 'position:absolute;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.32);border:2px solid rgba(255,255,255,0.6);display:none;';
  var joystickStick = document.createElement('div');
  joystickStick.style.cssText = 'position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.88);left:28px;top:28px;';
  joystickBase.appendChild(joystickStick);
  joystickZone.appendChild(joystickBase);
  container.appendChild(joystickZone);

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
  // "suspended" and every real interaction entry point (keydown, joystick
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
  muteBtn.setAttribute('aria-label', 'Sesi kapat/aç');
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

  // Pack's first not-yet-completed mission; if the whole pack is done, reopen
  // its first mission (openMission already renders the "completed" state).
  function getNextMissionIdForPack(packKey) {
    var packMissions = missions.filter(function (m) { return m.pack === packKey; });
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

  // ---------- SCENE ----------
  var scene = new THREE.Scene();
  // Cozy storybook sunset palette — warm cream sky/fog instead of cool blue.
  scene.background = new THREE.Color(0xFFE8C4);
  scene.fog = new THREE.Fog(0xFFE8C4, 18, 38);

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

  scene.add(new THREE.HemisphereLight(0xFFD9A0, 0x8FBF5A, 1.1));
  var sun = new THREE.DirectionalLight(0xFFD9A0, 1.6);
  sun.position.set(10, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 50;
  scene.add(sun);

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
  var groundGeo = new THREE.PlaneGeometry(groundWidth, pathTotalLength, 1, 1);
  var groundMat = new THREE.MeshStandardMaterial({ color: 0x8FBF5A, flatShading: true });
  var ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -(pathTotalLength / 2) + START_BOUNDARY_Z;
  ground.receiveShadow = true;
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
  // Treeline hugging both sides of the corridor — the ground itself is a plain
  // rectangle; this foliage boundary (following the zigzag + wobble) is what
  // makes the path read as organic/curvy instead of a straight lane.
  for (var tz = START_BOUNDARY_Z - 2; tz > -pathTotalLength + START_BOUNDARY_Z; tz -= 4.5) {
    var edgeHalfWidth = corridorHalfWidthAt(tz) + 0.8 + Math.random() * 1.2;
    var centerXAtZ = pathCenterX(tz);
    scene.add(makeTree(centerXAtZ - edgeHalfWidth, tz + (Math.random() - 0.5) * 2, 0.8 + Math.random() * 0.5));
    scene.add(makeTree(centerXAtZ + edgeHalfWidth, tz + (Math.random() - 0.5) * 2, 0.8 + Math.random() * 0.5));
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

  // Growth decor placed in a ring around each gate, outside the base/poles (radius
  // ~1.3) and the trigger radius (1.8) so it never overlaps gameplay geometry.
  // Slots are created once (hidden) and revealed cumulatively as the pack's real
  // completion % crosses each threshold — see updateGateDecor().
  var DECOR_RADIUS = 2.0;
  var DECOR_SLOT_DEFS = [
    { angleDeg: 30, type: 'bush' },
    { angleDeg: 90, type: 'bush' },
    { angleDeg: 150, type: 'tree' },
    { angleDeg: 210, type: 'tree' },
    { angleDeg: 270, type: 'flower' },
    { angleDeg: 330, type: 'flower' }
  ];
  // index = tier (0..4) → how many of the 6 decor slots above are visible at that tier
  var SLOTS_VISIBLE_AT_TIER = [0, 2, 4, 6, 6];

  function getPackCompletion(packKey) {
    var packMissions = missions.filter(function (m) { return m.pack === packKey; });
    if (packMissions.length === 0) return 0;
    var doneCount = packMissions.filter(function (m) { return done.has(m.id); }).length;
    return doneCount / packMissions.length;
  }

  function tierForCompletion(frac) {
    if (frac >= 1) return 4;
    if (frac >= 0.75) return 3;
    if (frac >= 0.5) return 2;
    if (frac >= 0.25) return 1;
    return 0;
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
    var packMissions = missions.filter(function (m) { return m.pack === cfg.packKey; });
    var doneCount = packMissions.filter(function (m) { return done.has(m.id); }).length;
    var remaining = packMissions.length - doneCount;
    var cacheKey = idx + ':' + remaining;
    if (cacheKey === lastProgressCacheKey) return;
    lastProgressCacheKey = cacheKey;
    progressLabelEl.textContent = remaining > 0
      ? (cfg.icon + ' ' + cfg.name + ' — ' + remaining + ' görev kaldı')
      : (cfg.icon + ' ' + cfg.name + ' tamamlandı! 🏆');
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

    var ringGeo = new THREE.TorusGeometry(0.9, 0.12, 8, 24);
    var ringMat = new THREE.MeshStandardMaterial({
      color: 0xE8A23A, flatShading: true,
      emissive: 0xE8A23A, emissiveIntensity: 0.35
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

    // Growth decor — created hidden; updateGateDecor() reveals these cumulatively
    // as the pack's real completion % rises (see getPackCompletion/tierForCompletion).
    var decorSlots = DECOR_SLOT_DEFS.map(function (def) {
      var rad = def.angleDeg * Math.PI / 180;
      var dx = Math.cos(rad) * DECOR_RADIUS;
      var dz = Math.sin(rad) * DECOR_RADIUS;
      var obj;
      if (def.type === 'bush') obj = makeBush(dx, dz);
      else if (def.type === 'tree') obj = makeTree(dx, dz, 0.55);
      else obj = makeFlowerCluster(dx, dz);
      obj.visible = false;
      group.add(obj);
      return obj;
    });
    var champion = makeChampionSparkle();
    champion.visible = false;
    group.add(champion);

    group.position.set(cfg.x, 0, cfg.z);
    group.lookAt(0, 0, 0);
    group.userData.ring = ring;
    group.userData.decorSlots = decorSlots;
    group.userData.champion = champion;
    group.userData.decorTier = -1; // force the first updateGateDecor() call to apply
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

  // ---------- INPUT: MOBILE JOYSTICK ----------
  var joyActive = false, joyOrigin = { x: 0, y: 0 }, joyVector = { x: 0, y: 0 };
  var MAX_JOY_DIST = 45;

  function joyStart(cx, cy) {
    resumeAudio(); // first touch on the joystick is a real user gesture too
    joyActive = true; joyOrigin.x = cx; joyOrigin.y = cy;
    joystickBase.style.left = (cx - 50) + 'px';
    joystickBase.style.top = (cy - 50) + 'px';
    joystickBase.style.display = 'block';
  }
  function joyMove(cx, cy) {
    if (!joyActive) return;
    var dx = cx - joyOrigin.x, dy = cy - joyOrigin.y;
    var dist = Math.min(Math.sqrt(dx * dx + dy * dy), MAX_JOY_DIST);
    var angle = Math.atan2(dy, dx);
    var sx = Math.cos(angle) * dist, sy = Math.sin(angle) * dist;
    joystickStick.style.left = (28 + sx) + 'px';
    joystickStick.style.top = (28 + sy) + 'px';
    joyVector.x = sx / MAX_JOY_DIST; joyVector.y = sy / MAX_JOY_DIST;
  }
  function joyEnd() {
    joyActive = false; joystickBase.style.display = 'none';
    joystickStick.style.left = '28px'; joystickStick.style.top = '28px';
    joyVector.x = 0; joyVector.y = 0;
  }
  joystickZone.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; joyStart(t.clientX, t.clientY); }, { passive: true });
  joystickZone.addEventListener('touchmove', function (e) { var t = e.changedTouches[0]; joyMove(t.clientX, t.clientY); }, { passive: true });
  joystickZone.addEventListener('touchend', joyEnd, { passive: true });
  joystickZone.addEventListener('touchcancel', joyEnd, { passive: true });

  // ---------- MOVEMENT (momentum-based; world position only — visuals owned by leo module) ----------
  var velocity = new THREE.Vector3();
  var facing = 0;
  var maxSpeed = 6.5, accel = 22, friction = 14;
  var stepTimer = 0; // footstep sound cadence — see updateMovement()
  // Camera's own facing — separate from Leo's (see updateMovement()), starts
  // at PI to match the idle camera setup above (looking toward -Z).
  var cameraFacing = Math.PI;

  function updateMovement(delta) {
    var ix = 0, iz = 0;
    if (keys.f) iz -= 1;
    if (keys.b) iz += 1;
    if (keys.l) ix -= 1;
    if (keys.r) ix += 1;
    if (joyVector.x !== 0 || joyVector.y !== 0) { ix = joyVector.x; iz = joyVector.y; }

    var len = Math.sqrt(ix * ix + iz * iz);
    var moving = len > 0.05;
    var targetFacing = facing;

    if (moving) {
      ix /= len; iz /= len;
      velocity.x += ix * accel * delta;
      velocity.z += iz * accel * delta;
      var speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
      if (speed > maxSpeed) {
        velocity.x = (velocity.x / speed) * maxSpeed;
        velocity.z = (velocity.z / speed) * maxSpeed;
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
    var camLagFactor = moving ? CAM_LAG_MOVING : CAM_LAG_IDLE;
    var facingDiff = facing - cameraFacing;
    while (facingDiff > Math.PI) facingDiff -= Math.PI * 2;
    while (facingDiff < -Math.PI) facingDiff += Math.PI * 2;
    cameraFacing += facingDiff * Math.min(delta * camLagFactor, 1);

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

  // ---------- ENTRANCE ANIMATION + WOODEN PANEL SHELL (scoped to hub3d only) ----------
  // The real mission panel (#backdrop/#sheet) is SHARED with the Missions tab. We
  // touch neither that shared CSS nor openMission()/the panel's inner content; we
  // only inject a one-off <style> that applies exclusively while body has
  // "hub3dEntrance" (added in resume()/before openMission, removed in pause()).
  // Since this whole block lives inside initHub3D() — which only loads when the
  // hub3d flag is on — the normal app never even sees these rules.
  //
  // The shell = a warm wooden frame (grain + plank seams + corner studs via
  // layered CSS gradients, no image asset) drawn purely as the panel's
  // background/border, plus a springy ease-out-back open. Wood tone is
  // theme-aware so the panel's existing (untouched) text colour stays readable:
  // dark walnut behind the dark theme's light text, honey pine behind light
  // theme's dark text. Corner studs use the default background-attachment
  // (scroll = pinned to the border box), so they stay put while content scrolls.
  if (!document.getElementById('hub3dEntranceStyle')) {
    var entranceStyle = document.createElement('style');
    entranceStyle.id = 'hub3dEntranceStyle';
    entranceStyle.textContent = [
      '@keyframes hub3dBackdropIn{from{opacity:0}to{opacity:1}}',
      '@keyframes hub3dSheetIn{from{transform:translateY(48px) scale(.96);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}',

      // dark theme (default) → rich walnut, complements the light panel text
      'body.hub3dEntrance{',
      '--hub3d-wood-1:#5b3f29;--hub3d-wood-2:#3f2817;--hub3d-wood-edge:#2c1c10;',
      '--hub3d-wood-seam:rgba(0,0,0,.28);--hub3d-wood-grain:rgba(255,255,255,.05);',
      '--hub3d-stud:#caa85a;--hub3d-stud-rim:rgba(0,0,0,.5);',
      '--hub3d-backdrop:rgba(46,30,16,.42);',
      '}',
      // light theme → honey pine, keeps the light theme's dark panel text readable
      'html.theme--light body.hub3dEntrance{',
      '--hub3d-wood-1:#ecd6ab;--hub3d-wood-2:#d8b67e;--hub3d-wood-edge:#b18a52;',
      '--hub3d-wood-seam:rgba(120,80,40,.22);--hub3d-wood-grain:rgba(120,80,40,.06);',
      '--hub3d-stud:#9a743c;--hub3d-stud-rim:rgba(255,255,255,.55);',
      '--hub3d-backdrop:rgba(120,86,46,.34);',
      '}',

      // warm dim instead of the shared blue backdrop
      'body.hub3dEntrance #backdrop.show{',
      'background:var(--hub3d-backdrop)!important;',
      'animation:hub3dBackdropIn 260ms ease;',
      '}',

      // the wooden panel itself
      'body.hub3dEntrance #backdrop.show #sheet{',
      'background:',
      'radial-gradient(circle at 17px 17px,var(--hub3d-stud) 0 3.5px,var(--hub3d-stud-rim) 3.5px 4.5px,transparent 5px),',
      'radial-gradient(circle at calc(100% - 17px) 17px,var(--hub3d-stud) 0 3.5px,var(--hub3d-stud-rim) 3.5px 4.5px,transparent 5px),',
      'radial-gradient(circle at 17px calc(100% - 17px),var(--hub3d-stud) 0 3.5px,var(--hub3d-stud-rim) 3.5px 4.5px,transparent 5px),',
      'radial-gradient(circle at calc(100% - 17px) calc(100% - 17px),var(--hub3d-stud) 0 3.5px,var(--hub3d-stud-rim) 3.5px 4.5px,transparent 5px),',
      'repeating-linear-gradient(90deg,transparent 0 5px,var(--hub3d-wood-grain) 5px 6px),',
      'repeating-linear-gradient(180deg,transparent 0 64px,var(--hub3d-wood-seam) 64px 66px),',
      'linear-gradient(168deg,var(--hub3d-wood-1),var(--hub3d-wood-2))!important;',
      'border:5px solid var(--hub3d-wood-edge)!important;border-bottom:none!important;',
      'box-shadow:0 -14px 30px rgba(0,0,0,.30),inset 0 2px 0 rgba(255,255,255,.12),inset 0 0 0 1px rgba(0,0,0,.18)!important;',
      'animation:hub3dSheetIn 440ms cubic-bezier(.34,1.56,.64,1);',
      '}'
    ].join('');
    document.head.appendChild(entranceStyle);
  }

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
      var missionId = getNextMissionIdForPack(pendingGate.cfg.packKey);
      pendingGate = null;
      if (missionId != null) {
        document.body.classList.add('hub3dEntrance');
        openMission(missionId);
      }
    }
  }

  // Reveals/hides decor slots when a gate's pack crosses a completion tier.
  // Cheap (6 gates × a tiny array filter) and guarded so meshes are only
  // touched on an actual tier change, not every frame.
  function updateGateDecor() {
    gateConfig.forEach(function (cfg) {
      var group = gateMeshes[cfg.id];
      var tier = tierForCompletion(getPackCompletion(cfg.packKey));
      if (group.userData.decorTier === tier) return;
      group.userData.decorTier = tier;

      var visibleCount = SLOTS_VISIBLE_AT_TIER[tier];
      group.userData.decorSlots.forEach(function (slot, i) {
        slot.visible = i < visibleCount;
      });

      var isChampion = tier === 4;
      group.userData.champion.visible = isChampion;
      group.userData.ring.userData.champion = isChampion;
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
      scene.add(makeTree(fw.baseX - corridorHalfWidthAt(rewardZ) - 0.5, rewardZ, 1.0));
      scene.add(makeTree(fw.baseX + corridorHalfWidthAt(rewardZ) + 0.5, rewardZ - 2, 0.95));

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
    document.body.classList.add('hub3dEntrance');
    clock.getDelta(); // discard time elapsed while paused, avoid a huge first delta
    animate();
  }
  function pause() {
    if (!running) return;
    running = false;
    document.body.classList.remove('hub3dEntrance');
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Intentionally NOT auto-started — the caller (app.js) decides when to call
  // resume(), and re-checks that the hub is still the active tab before doing
  // so (loading is async; the user may navigate away before it finishes).
  return { pause: pause, resume: resume };
}
