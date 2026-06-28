// 3D Hub — lazy-loaded only when the user opens the "hub3d" tab (see app.js
// showHub3D()/hideHub3D()). Builds a Three.js island scene with one gate per
// real mission pack; walking up to a gate opens the real mission panel via
// the openMission() reference passed in from app.js. No mission/app logic is
// reimplemented here — PACKS/missions/done/openMission are the real ones.
import { createCoachLeo } from './jumvi-leo.js';

export function initHub3D(opts) {
  var PACKS = opts.PACKS;
  var missions = opts.missions;
  var done = opts.done;
  var openMission = opts.openMission;
  var container = opts.container;

  // ---------- HUD: built into the container — no markup needed in index.html ----------
  var hudTop = document.createElement('div');
  hudTop.style.cssText = 'position:absolute;top:0;left:0;right:0;padding:16px;display:flex;justify-content:center;pointer-events:none;z-index:10;';
  var badgesEl = document.createElement('div');
  badgesEl.style.cssText = 'display:flex;gap:8px;background:rgba(255,255,255,0.88);padding:8px 12px;border-radius:20px;';
  hudTop.appendChild(badgesEl);
  container.appendChild(hudTop);

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

  function zoneCenterZ(i) {
    return -(i + 0.5) * ZONE_LENGTH;
  }
  function pathCenterX(z) {
    return Math.sin((z / ZONE_LENGTH) * Math.PI) * ZIGZAG_AMPLITUDE;
  }
  function corridorHalfWidthAt(z) {
    return CORRIDOR_HALF_WIDTH + CORRIDOR_WOBBLE_AMPLITUDE * Math.sin(z * CORRIDOR_WOBBLE_FREQ + 1.7);
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
  var groundWidth = (CORRIDOR_HALF_WIDTH + CORRIDOR_WOBBLE_AMPLITUDE) * 2 + 10; // walkable width + treeline margin
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
  var leo = createCoachLeo(THREE);
  scene.add(leo.group);

  // ---------- INPUT: KEYBOARD ----------
  var keys = { f: false, b: false, l: false, r: false };
  function onKeyDown(e) {
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

  // ---------- ENTRANCE ANIMATION (scoped to hub3d only — see resume()/pause()) ----------
  // The real mission panel (#backdrop/#sheet) has no CSS transition anywhere in the
  // app — it's a hard display:none/flex toggle, same in the Missions tab. We don't
  // touch that shared CSS or openMission() itself; instead we inject a one-off
  // <style> that only applies while body has "hub3dEntrance" (toggled below), using
  // @keyframes (not `transition`) since a transition can't animate from display:none.
  if (!document.getElementById('hub3dEntranceStyle')) {
    var entranceStyle = document.createElement('style');
    entranceStyle.id = 'hub3dEntranceStyle';
    entranceStyle.textContent =
      '@keyframes hub3dBackdropIn{from{opacity:0}to{opacity:1}}' +
      '@keyframes hub3dSheetIn{from{transform:translateY(36px);opacity:0}to{transform:translateY(0);opacity:1}}' +
      'body.hub3dEntrance #backdrop.show{animation:hub3dBackdropIn 220ms ease}' +
      'body.hub3dEntrance #backdrop.show #sheet{animation:hub3dSheetIn 280ms cubic-bezier(.22,1,.36,1)}';
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

      var badge = badgeSlots[fw.zoneIndex + 1];
      if (badge) badge.style.opacity = '1';
    });
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
    elapsedTime += delta;

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
