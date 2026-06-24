// Coach Leo character module — geometry, toon material, limb pivots, walk animation.
// Extracted from jumvi-forest-advanced-prototype.html. Pure visual/animation module:
// it owns the character's local pose (bob, lean, limb swing, facing) but NOT world
// position (x/z) or physics — the caller is responsible for placing leo.group in the
// scene and driving world movement; this module only animates the rig given motion state.
//
// Usage:
//   import { createCoachLeo } from './jumvi-leo.js';
//   const leo = createCoachLeo(THREE);
//   scene.add(leo.group);
//   // each frame:
//   leo.update(delta, { moving: true, speed: 4.2, maxSpeed: 6.2, targetFacing: Math.PI / 4 });

export function createCoachLeo(THREE, options) {
  options = options || {};
  var skinColor = options.skinColor != null ? options.skinColor : 0xCFA06B;
  var bellyColor = options.bellyColor != null ? options.bellyColor : 0xF5E7CC;
  var bandanaColor = options.bandanaColor != null ? options.bandanaColor : 0x2FB6E8;

  // ---------- TOON MATERIAL HELPER ----------
  // Three-tone gradient map for cel-shaded look.
  var gradientMap = (function () {
    var canvas = document.createElement('canvas');
    canvas.width = 4; canvas.height = 1;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(1, 0, 1, 1);
    ctx.fillStyle = '#cfcfcf'; ctx.fillRect(2, 0, 1, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(3, 0, 1, 1);
    var tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    return tex;
  })();

  function toonMat(color) {
    return new THREE.MeshToonMaterial({ color: color, gradientMap: gradientMap });
  }

  // Adds a thin black outline to a mesh using the backface-expanded clone technique.
  function addOutline(mesh, thickness) {
    var outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1410, side: THREE.BackSide });
    var outline = new THREE.Mesh(mesh.geometry, outlineMat);
    outline.scale.multiplyScalar(1 + (thickness || 0.06));
    outline.renderOrder = -1;
    mesh.add(outline);
    return outline;
  }

  // ---------- BUILD RIG ----------
  var group = new THREE.Group();
  var bodyMesh, legPivotL, legPivotR, armPivotL, armPivotR;
  var bodyScaleBase = new THREE.Vector3(1, 1.1, 0.95);

  (function buildLeo() {
    bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), toonMat(skinColor));
    bodyMesh.scale.copy(bodyScaleBase);
    bodyMesh.position.y = 0.58;
    bodyMesh.castShadow = true;
    addOutline(bodyMesh, 0.05);
    group.add(bodyMesh);

    var belly = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 14), toonMat(bellyColor));
    belly.position.set(0, 0.48, 0.3);
    belly.scale.set(1, 1.1, 0.7);
    group.add(belly);

    var headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.33, 18, 18), toonMat(skinColor));
    headMesh.position.set(0, 1.08, 0.06);
    headMesh.castShadow = true;
    addOutline(headMesh, 0.05);
    group.add(headMesh);

    var snout = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), toonMat(bellyColor));
    snout.position.set(0, 0.98, 0.32);
    snout.scale.set(1, 0.85, 0.9);
    group.add(snout);

    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0x3A2A1A }));
    nose.position.set(0, 1.0, 0.46);
    group.add(nose);

    // eyes - brown (spec critical: not blue)
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0x3A2A1A });
    var eyeWhiteMat = toonMat(0xffffff);
    function makeEye(xPos) {
      var white = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), eyeWhiteMat);
      white.position.set(xPos, 1.13, 0.27);
      group.add(white);
      var pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
      pupil.position.set(xPos, 1.13, 0.33);
      group.add(pupil);
    }
    makeEye(-0.13);
    makeEye(0.13);

    function makeEar(xPos) {
      var ear = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), toonMat(skinColor));
      ear.position.set(xPos, 1.32, -0.02);
      ear.scale.set(0.8, 1, 0.5);
      ear.castShadow = true;
      addOutline(ear, 0.05);
      group.add(ear);
      var earInner = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), toonMat(bellyColor));
      earInner.position.set(xPos, 1.31, 0.04);
      earInner.scale.set(0.7, 0.9, 0.4);
      group.add(earInner);
    }
    makeEar(-0.24);
    makeEar(0.24);

    var bandana = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 8, 16, Math.PI * 1.3), toonMat(bandanaColor));
    bandana.position.set(0, 0.96, -0.02);
    bandana.rotation.x = Math.PI / 2.1;
    bandana.rotation.z = 0.3;
    addOutline(bandana, 0.05);
    group.add(bandana);
    var bandanaTailL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), toonMat(bandanaColor));
    bandanaTailL.position.set(-0.18, 0.78, -0.18);
    bandanaTailL.rotation.x = 0.6;
    group.add(bandanaTailL);

    function makeLimb(isArm) {
      var pivot = new THREE.Group();
      var length = isArm ? 0.32 : 0.34;
      var radius = isArm ? 0.09 : 0.12;
      var limb = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), toonMat(skinColor));
      limb.position.y = -length / 2 - radius;
      limb.castShadow = true;
      addOutline(limb, 0.05);
      pivot.add(limb);
      return pivot;
    }

    armPivotL = makeLimb(true);
    armPivotL.position.set(-0.38, 0.7, 0.05);
    group.add(armPivotL);
    armPivotR = makeLimb(true);
    armPivotR.position.set(0.38, 0.7, 0.05);
    group.add(armPivotR);

    legPivotL = makeLimb(false);
    legPivotL.position.set(-0.18, 0.32, 0);
    group.add(legPivotL);
    legPivotR = makeLimb(false);
    legPivotR.position.set(0.18, 0.32, 0);
    group.add(legPivotR);

    var tail = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), toonMat(skinColor));
    tail.position.set(0, 0.55, -0.4);
    tail.castShadow = true;
    addOutline(tail, 0.05);
    group.add(tail);
  })();

  // ---------- ANIMATION STATE ----------
  var facing = 0;
  var walkPhase = 0;
  var walkSpeedAnim = 0;

  // moveState: { moving: bool, speed: number, maxSpeed: number, targetFacing: number }
  function update(delta, moveState) {
    moveState = moveState || {};
    var moving = !!moveState.moving;

    if (moving) {
      var speed = moveState.speed || 0;
      var maxSpeed = moveState.maxSpeed || 1;
      var targetFacing = moveState.targetFacing != null ? moveState.targetFacing : facing;

      var diff = targetFacing - facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facing += diff * Math.min(delta * 10, 1);
      group.rotation.y = facing;
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, -THREE.MathUtils.clamp(diff * 1.2, -0.28, 0.28), Math.min(delta * 8, 1));

      walkSpeedAnim = THREE.MathUtils.lerp(walkSpeedAnim, 8 + (speed / maxSpeed) * 7, Math.min(delta * 6, 1));
      walkPhase += delta * walkSpeedAnim;

      var hop = Math.abs(Math.sin(walkPhase));
      group.position.y = hop * 0.16;
      var stretch = 1 + hop * 0.1, squash = 1 - hop * 0.07;
      bodyMesh.scale.set(bodyScaleBase.x * squash, bodyScaleBase.y * stretch, bodyScaleBase.z * squash);

      var swing = Math.sin(walkPhase) * 0.6;
      legPivotL.rotation.x = swing;
      legPivotR.rotation.x = -swing;
      armPivotL.rotation.x = -swing * 0.8;
      armPivotR.rotation.x = swing * 0.8;
    } else {
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, 0, Math.min(delta * 6, 1));
      walkSpeedAnim = THREE.MathUtils.lerp(walkSpeedAnim, 0, Math.min(delta * 4, 1));
      group.position.y = THREE.MathUtils.lerp(group.position.y, 0, Math.min(delta * 10, 1));
      bodyMesh.scale.lerp(bodyScaleBase, Math.min(delta * 8, 1));
      legPivotL.rotation.x = THREE.MathUtils.lerp(legPivotL.rotation.x, 0, Math.min(delta * 8, 1));
      legPivotR.rotation.x = THREE.MathUtils.lerp(legPivotR.rotation.x, 0, Math.min(delta * 8, 1));
      armPivotL.rotation.x = THREE.MathUtils.lerp(armPivotL.rotation.x, 0, Math.min(delta * 8, 1));
      armPivotR.rotation.x = THREE.MathUtils.lerp(armPivotR.rotation.x, 0, Math.min(delta * 8, 1));
    }
  }

  function getFacing() {
    return facing;
  }

  return {
    group: group,
    update: update,
    getFacing: getFacing
  };
}
