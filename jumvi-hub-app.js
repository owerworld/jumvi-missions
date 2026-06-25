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

  // ---------- GATE CONFIG (derived from real PACKS) ----------
  var realPacks = PACKS.filter(function (p) { return p.key !== 'all'; });

  function splitIconAndLabel(name) {
    var parts = name.split(' ');
    return { icon: parts[0], label: parts.slice(1).join(' ') };
  }

  var islandRadius = 13;
  var gateRadius = 9;
  var gateConfig = realPacks.map(function (pack, i) {
    var parsed = splitIconAndLabel(pack.name);
    var angle = (i / realPacks.length) * Math.PI * 2;
    return {
      id: i + 1,
      packKey: pack.key,
      name: parsed.label,
      icon: parsed.icon,
      x: Math.sin(angle) * gateRadius,
      z: Math.cos(angle) * gateRadius
    };
  });

  // Pack's first not-yet-completed mission; if the whole pack is done, reopen
  // its first mission (openMission already renders the "completed" state).
  function getNextMissionIdForPack(packKey) {
    var packMissions = missions.filter(function (m) { return m.pack === packKey; });
    var next = packMissions.find(function (m) { return !done.has(m.id); });
    return next ? next.id : (packMissions[0] && packMissions[0].id);
  }

  gateConfig.forEach(function (cfg) {
    var slot = document.createElement('div');
    slot.style.cssText = 'width:30px;height:30px;border-radius:50%;background:#E5E2D8;border:2px solid #C5C1B0;display:flex;align-items:center;justify-content:center;font-size:15px;';
    slot.textContent = cfg.icon;
    slot.title = cfg.name;
    badgesEl.appendChild(slot);
  });

  // ---------- SCENE ----------
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xBEE3F5);
  scene.fog = new THREE.Fog(0xBEE3F5, 18, 38);

  var camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 9, 11);

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xBEE3F5, 0x6DBE45, 1.1));
  var sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(10, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 50;
  scene.add(sun);

  // ---------- ISLAND GROUND ----------
  var groundGeo = new THREE.CircleGeometry(islandRadius, 48);
  var groundMat = new THREE.MeshStandardMaterial({ color: 0x6DBE45, flatShading: true });
  var ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  var sandGeo = new THREE.RingGeometry(islandRadius - 0.6, islandRadius + 1.2, 48);
  var sandMat = new THREE.MeshStandardMaterial({ color: 0xF0DDA0, flatShading: true });
  var sand = new THREE.Mesh(sandGeo, sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.05;
  scene.add(sand);

  var waterGeo = new THREE.CircleGeometry(40, 32);
  var waterMat = new THREE.MeshStandardMaterial({ color: 0x4A9FD4, flatShading: true, transparent: true, opacity: 0.85 });
  var water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.6;
  scene.add(water);

  function makeTree(x, z, scale) {
    var group = new THREE.Group();
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x8B5E34, flatShading: true })
    );
    trunk.position.y = 0.6;
    trunk.castShadow = true;
    group.add(trunk);
    var leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 1.6, 7),
      new THREE.MeshStandardMaterial({ color: 0x4A9F4A, flatShading: true })
    );
    leaf.position.y = 1.7;
    leaf.castShadow = true;
    group.add(leaf);
    group.position.set(x, 0, z);
    group.scale.setScalar(scale || 1);
    return group;
  }
  [[-10, -10, 1.1], [10, -10, 0.9], [-11, 8, 1.2], [11, 9, 1.0], [0, -11, 0.8], [0, 11, 0.9]]
    .forEach(function (p) { scene.add(makeTree(p[0], p[1], p[2])); });

  // ---------- GATE MARKERS (one per real mission pack) ----------
  var gateMeshes = {};
  function createGateMesh(cfg) {
    var group = new THREE.Group();

    var ringGeo = new THREE.TorusGeometry(0.9, 0.12, 8, 24);
    var ringMat = new THREE.MeshStandardMaterial({ color: 0xBA7517, flatShading: true });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 1.1;
    ring.castShadow = true;
    group.add(ring);

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

    group.position.set(cfg.x, 0, cfg.z);
    group.lookAt(0, 0, 0);
    group.userData.ring = ring;
    return group;
  }
  gateConfig.forEach(function (cfg) {
    var mesh = createGateMesh(cfg);
    scene.add(mesh);
    gateMeshes[cfg.id] = mesh;
  });

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

    var distFromCenter = Math.sqrt(nextX * nextX + nextZ * nextZ);
    var maxDist = islandRadius - 0.8;
    if (distFromCenter > maxDist) {
      var scale = maxDist / distFromCenter;
      nextX *= scale; nextZ *= scale;
      velocity.x *= 0.3; velocity.z *= 0.3;
    }

    leo.group.position.x = nextX;
    leo.group.position.z = nextZ;
    facing = leo.getFacing();

    var speedNow = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    leo.update(delta, { moving: moving, speed: speedNow, maxSpeed: maxSpeed, targetFacing: targetFacing });

    var camDistance = 11, camHeight = 9;
    var camLagFactor = moving ? 2.2 : 3.5;
    camera.position.x += (leo.group.position.x - camera.position.x) * Math.min(delta * camLagFactor, 1);
    camera.position.z += (leo.group.position.z + camDistance - camera.position.z) * Math.min(delta * camLagFactor, 1);
    camera.position.y = camHeight;
    var lookAheadX = leo.group.position.x + velocity.x * 0.15;
    var lookAheadZ = leo.group.position.z + velocity.z * 0.15;
    camera.lookAt(lookAheadX, 0.6, lookAheadZ);
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
  var GATE_REACT_MS = 150;
  var lastTriggeredGate = null;
  var pendingGate = null; // { cfg, ring, startTime } — brief "arrived" reaction before the panel opens

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

  function tick(delta) {
    updateMovement(delta);
    checkGateProximity();
    updateGateReaction();
    gateConfig.forEach(function (cfg) {
      gateMeshes[cfg.id].userData.ring.rotation.z += delta * 0.6;
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
