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
  var pawColor = options.pawColor != null ? options.pawColor : 0x6B4423;

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
  var bodyScaleBase = new THREE.Vector3(1, 1.05, 0.95);

  (function buildLeo() {
    // Body — deliberately smaller than the head: big-head cartoon-mascot
    // proportions (per reference), not a 1:1 realistic ratio.
    bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), toonMat(skinColor));
    bodyMesh.scale.copy(bodyScaleBase);
    bodyMesh.position.y = 0.44;
    bodyMesh.castShadow = true;
    addOutline(bodyMesh, 0.05);
    group.add(bodyMesh);

    var belly = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 14), toonMat(bellyColor));
    belly.position.set(0, 0.38, 0.22);
    belly.scale.set(1, 1.1, 0.7);
    group.add(belly);

    // Head — large, dominant proportion vs. body (the single biggest change
    // from the old rig, where head and body were nearly the same size).
    var headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 20), toonMat(skinColor));
    headMesh.position.set(0, 0.90, 0.04);
    headMesh.castShadow = true;
    addOutline(headMesh, 0.05);
    group.add(headMesh);
    var headY = headMesh.position.y;

    // Snout/muzzle
    var snout = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 14), toonMat(bellyColor));
    snout.position.set(0, headY - 0.10, 0.34);
    snout.scale.set(1, 0.8, 0.85);
    group.add(snout);

    // Nose — small, dark brown, slightly heart/triangle-shaped (flattened +
    // tapered sphere rather than a plain round dot).
    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), new THREE.MeshBasicMaterial({ color: 0x3A2A1A }));
    nose.position.set(0, headY - 0.06, 0.535);
    nose.scale.set(1.2, 0.9, 0.75);
    group.add(nose);

    // Cheek puffs — round, lighter patches either side of the snout, giving
    // the wide-grin "chubby cheeks" look from the reference image.
    function makeCheek(xPos) {
      var cheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), toonMat(bellyColor));
      cheek.position.set(xPos, headY - 0.13, 0.40);
      cheek.scale.set(1, 0.85, 0.6);
      group.add(cheek);
    }
    makeCheek(-0.21);
    makeCheek(0.21);

    // Mouth — wide open smile (half-ring arc) with a big pink tongue filling
    // it, instead of no mouth at all.
    var mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.135, 0.045, 8, 12, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x2A1A12 })
    );
    mouth.position.set(0, headY - 0.18, 0.50);
    mouth.rotation.x = Math.PI / 2;
    mouth.rotation.z = Math.PI;
    group.add(mouth);

    var tongue = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xE8849A })
    );
    tongue.position.set(0, headY - 0.225, 0.495);
    tongue.scale.set(1, 0.55, 0.85);
    group.add(tongue);

    // eyes — large, glossy, brown, with a white specular highlight dot and a
    // thick brow above each one (spec critical: big expressive eyes, not blue)
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0x3A2A1A });
    var eyeWhiteMat = toonMat(0xffffff);
    var browMat = new THREE.MeshBasicMaterial({ color: 0x3A2A1A });
    // eyeZ is chosen so the eye spheres clearly protrude past the head's own
    // curved surface at this latitude (head radius 0.42, eyes offset ±0.155
    // in x and +0.05 in y from head center) — otherwise they render embedded
    ///occluded by the head mesh itself instead of reading as eyes.
    var eyeY = headY + 0.05;
    var eyeZ = 0.40;
    function makeEye(xPos) {
      var white = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 12), eyeWhiteMat);
      white.position.set(xPos, eyeY, eyeZ);
      group.add(white);

      var pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), eyeMat);
      pupil.position.set(xPos, eyeY, eyeZ + 0.07);
      group.add(pupil);

      // The -0.035 offset is constant (not mirrored per eye) — a single
      // light source puts the specular highlight on the same side of both
      // pupils, not symmetrically outward on each.
      var highlight = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      highlight.position.set(xPos - 0.035, eyeY + 0.045, eyeZ + 0.11);
      group.add(highlight);

      // Arched brow — a partial torus ring lying in the XY plane (facing the
      // camera, like the eyes), not a straight bar, to match the curved
      // "comma" eyebrow shape in the reference art.
      var browArc = Math.PI * 0.55;
      var brow = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.026, 8, 12, browArc), browMat);
      brow.position.set(xPos, eyeY + 0.165, eyeZ + 0.05);
      brow.rotation.z = Math.PI / 2 - browArc / 2 + (xPos < 0 ? 0.15 : -0.15);
      group.add(brow);
    }
    makeEye(-0.155);
    makeEye(0.155);

    function makeEar(xPos) {
      var ear = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 10), toonMat(skinColor));
      ear.position.set(xPos, headY + 0.30, -0.03);
      ear.scale.set(0.8, 1, 0.5);
      ear.castShadow = true;
      addOutline(ear, 0.05);
      group.add(ear);
      // ear inner — cream, distinct from the skin tone
      var earInner = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), toonMat(bellyColor));
      earInner.position.set(xPos, headY + 0.29, 0.04);
      earInner.scale.set(0.7, 0.9, 0.4);
      group.add(earInner);
    }
    makeEar(-0.27);
    makeEar(0.27);

    var bandana = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 16, Math.PI * 1.3), toonMat(bandanaColor));
    bandana.position.set(0, headY - 0.04, -0.02);
    bandana.rotation.x = Math.PI / 2.1;
    bandana.rotation.z = 0.3;
    addOutline(bandana, 0.05);
    group.add(bandana);
    var bandanaTailL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), toonMat(bandanaColor));
    bandanaTailL.position.set(-0.2, headY - 0.24, -0.2);
    bandanaTailL.rotation.x = 0.6;
    group.add(bandanaTailL);

    // Hands/feet — a distinct darker-brown tone from the skin, not a bare
    // capsule tip.
    function makeLimb(isArm) {
      var pivot = new THREE.Group();
      var length = isArm ? 0.28 : 0.30;
      var radius = isArm ? 0.08 : 0.105;
      var limb = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), toonMat(skinColor));
      limb.position.y = -length / 2 - radius;
      limb.castShadow = true;
      addOutline(limb, 0.05);
      pivot.add(limb);

      var paw = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.05, 8, 8), toonMat(pawColor));
      paw.position.y = -length - radius * 1.25;
      paw.scale.set(1, 0.6, 1.15);
      pivot.add(paw);

      return pivot;
    }

    armPivotL = makeLimb(true);
    armPivotL.position.set(-0.34, 0.56, 0.04);
    group.add(armPivotL);
    armPivotR = makeLimb(true);
    armPivotR.position.set(0.34, 0.56, 0.04);
    group.add(armPivotR);

    legPivotL = makeLimb(false);
    legPivotL.position.set(-0.16, 0.30, 0);
    group.add(legPivotL);
    legPivotR = makeLimb(false);
    legPivotR.position.set(0.16, 0.30, 0);
    group.add(legPivotR);

    // Tail — two graduated spheres curving up and out to one side, clearly
    // separated from the body silhouette rather than a single blob tucked
    // directly behind it.
    // Tail — three graduated, slightly flattened spheres curving up and out
    // to one side, sized closer to the reference's big comma-shaped tail
    // rather than a small blob tucked behind the body.
    var tailMat = toonMat(skinColor);
    var tailSegments = [
      { pos: [0.20, 0.40, -0.34], radius: 0.135 },
      { pos: [0.38, 0.50, -0.32], radius: 0.115 },
      { pos: [0.53, 0.64, -0.24], radius: 0.085 }
    ];
    tailSegments.forEach(function (seg) {
      var part = new THREE.Mesh(new THREE.SphereGeometry(seg.radius, 10, 10), tailMat);
      part.position.set(seg.pos[0], seg.pos[1], seg.pos[2]);
      part.scale.set(1, 1, 0.75);
      part.castShadow = true;
      addOutline(part, 0.05);
      group.add(part);
    });
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
