import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = id => document.getElementById(id);
const viewport = $('viewport');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const state = { character: 'both', action: 'idle', view: 'front', background: 'garden', paused: reduceMotion.matches, loaded: false };
const characters = [];
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e7ecdd');
const camera = new THREE.PerspectiveCamera(32, 1, .05, 60);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = new RoomEnvironment();
const envMap = pmrem.fromScene(environment, .04);
scene.environment = envMap.texture;
environment.dispose();
pmrem.dispose();
scene.add(new THREE.HemisphereLight('#fff8ed', '#b3a89c', 1.4));
const keyLight = new THREE.DirectionalLight('#fff6e9', 2.4);
keyLight.position.set(-3.5, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
Object.assign(keyLight.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 20 });
keyLight.shadow.normalBias = .018;
keyLight.shadow.bias = -.00012;
keyLight.shadow.radius = 3;
scene.add(keyLight);
const rim = new THREE.DirectionalLight('#fffdf5', 1.3);
rim.position.set(3, 4, -3);
scene.add(rim);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .09;
controls.enablePan = false;
controls.minDistance = 2.0;
controls.maxDistance = 15;
controls.minPolarAngle = .24;
controls.maxPolarAngle = Math.PI / 2 + .035;
controls.autoRotateSpeed = .7;
controls.target.set(0, 1.4, 0);
camera.position.set(.4, 2.7, 8.7);
controls.update();

function mat(color, roughness = .85) { return new THREE.MeshStandardMaterial({ color, roughness }); }
function shape(geometry, material, position, parent = scene) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function ball(parent, position, scale, material) {
  const m = shape(new THREE.SphereGeometry(1, 12, 8), material, position, parent);
  m.scale.set(...scale);
  return m;
}
function combineStatic(root) {
  root.updateWorldMatrix(true, true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert(), bins = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const bin = bins.get(o.material) || [];
    bin.push(o); bins.set(o.material, bin);
  });
  for (const [material, list] of bins) {
    if (list.length < 2) continue;
    const geometries = list.map(m => m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld)));
    const geometry = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (!geometry) continue;
    const merged = new THREE.Mesh(geometry, material);
    merged.castShadow = true; merged.receiveShadow = true;
    list.forEach(m => { m.removeFromParent(); m.geometry.dispose(); });
    root.add(merged);
  }
}
const floorMat = new THREE.MeshBasicMaterial({ color: '#e7ecdd', toneMapped: false });
const floor = shape(new THREE.PlaneGeometry(200, 200), floorMat, [0, -.14, 0]);
floor.rotation.x = -Math.PI / 2;
floor.castShadow = false;
const floorShadow = shape(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: .12 }), [0, -.138, 0]);
floorShadow.rotation.x = -Math.PI / 2;
floorShadow.castShadow = false;
const baseMat = mat('#b1c28d');
const base = shape(new THREE.CylinderGeometry(2.15, 2.12, .15, 96), baseMat, [0, -.075, 0]);
const garden = new THREE.Group();
scene.add(garden);
const green = mat('#94ab70'), darkGreen = mat('#698957'), stemMat = mat('#7c945a');
const petal = mat('#fff7df'), pollen = mat('#d8b35e');
const pebble = mat('#c2bca7');
function flower(parent, x, z, height, size = 1) {
  const f = new THREE.Group();
  f.position.set(x, 0, z); f.scale.setScalar(size); parent.add(f);
  shape(new THREE.CylinderGeometry(.014, .017, height, 7), stemMat, [0, height / 2, 0], f);
  for (const side of [-1, 1]) {
    const leaf = ball(f, [side * .055, height * .4, 0], [.09, .018, .035], green);
    leaf.rotation.z = side * .4;
  }
  const top = new THREE.Group(); top.position.y = height; top.rotation.x = .25; f.add(top);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const p = ball(top, [Math.cos(a) * .068, 0, Math.sin(a) * .068], [.064, .019, .031], petal);
    p.rotation.y = -a;
  }
  ball(top, [0, .013, 0], [.041, .022, .041], pollen);
  return f;
}
for (const side of [-1, 1]) {
  for (let i = 0; i < 3; i++) {
    const x = side * (1.55 + (i % 2) * .13), z = -.3 + i * .31;
    ball(garden, [x, .05, z], [.18, .07, .15], green);
    flower(garden, x, z, .19 + i * .07, .85);
  }
  for (let i = 0; i < 3; i++) {
    ball(garden, [side * (1.3 + i * .16), .03, .81 - i * .13], [.065, .041, .048], pebble);
  }
  // Low rounded shrubs behind the figures; keep the silhouettes unobstructed.
  for (let i = 0; i < 3; i++) ball(garden, [side * (1.17 + i * .14), .10 + i * .02, -.93], [.23, .18, .20], i % 2 ? green : darkGreen);
}
const waterPlants = new THREE.Group();
waterPlants.visible = false;
scene.add(waterPlants);
const flowers = [];
for (const x of [-.72, .72]) {
  const f = new THREE.Group(); f.position.set(x, 0, 1.02); waterPlants.add(f);
  const soil = shape(new THREE.CylinderGeometry(.26, .27, .026, 24), mat('#ab8b67'), [0, .012, 0], f);
  soil.castShadow = false;
  flower(f, -.07, -.03, .33); flower(f, .08, .04, .23, .8); flowers.push(f);
  combineStatic(f);
}
combineStatic(garden);

// All meshes below attach to the exported hand bone, so the prop follows the
// wrist during pouring. Transform is derived from the rest hand, not its name.
function wateringCan(color) {
  const g = new THREE.Group(), paint = mat(color, .67), edge = mat('#c9aa8e', .6);
  shape(new THREE.CylinderGeometry(.106, .12, .235, 24), paint, [0, 0, 0], g);
  const opening = shape(new THREE.CylinderGeometry(.089, .089, .008, 24), mat('#756a59'), [0, .12, 0], g);
  opening.castShadow = false;
  const rim = shape(new THREE.TorusGeometry(.101, .012, 8, 32), edge, [0, .119, 0], g); rim.rotation.x = Math.PI / 2;
  const h = shape(new THREE.TorusGeometry(.12, .015, 8, 24, Math.PI * 1.5), paint, [0, .01, -.13], g); h.rotation.y = Math.PI / 2;
  const pipe = shape(new THREE.CylinderGeometry(.027, .035, .25, 12), paint, [0, .03, .20], g); pipe.rotation.x = Math.PI / 3;
  const rose = shape(new THREE.CylinderGeometry(.066, .045, .045, 16), paint, [0, .093, .31], g); rose.rotation.x = Math.PI / 3;
  const spout = new THREE.Object3D(); spout.position.set(0, .11, .335); g.add(spout);
  combineStatic(g);
  return { object: g, spout };
}
const dropGeo = new THREE.SphereGeometry(.016, 6, 5);
const dropsMat = new THREE.MeshStandardMaterial({ color: '#a5d1d3', roughness: .25, transparent: true, opacity: .78 });
const droplets = new THREE.InstancedMesh(dropGeo, dropsMat, 28);
droplets.visible = false; droplets.frustumCulled = false; scene.add(droplets);
const dummy = new THREE.Object3D(), spoutWorld = new THREE.Vector3();
const AXIS_X = new THREE.Vector3(1, 0, 0), AXIS_Y = new THREE.Vector3(0, 1, 0), AXIS_Z = new THREE.Vector3(0, 0, 1);
const offsetQuat = new THREE.Quaternion();
const parentQuat = new THREE.Quaternion(), rootQuat = new THREE.Quaternion(), frameQuat = new THREE.Quaternion();
const deltaQuat = new THREE.Quaternion(), inverseFrame = new THREE.Quaternion();
let cameraTween = null, actionTime = 0, toastTimer;

function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2400);
}
function selected(group, value) {
  document.querySelectorAll(`[data-group="${group}"] button`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === value)));
}
function fitView(view = state.view, immediate = false) {
  state.view = view; selected('view', view);
  const both = state.character === 'both';
  const close = view === 'face';
  const height = close ? 1.78 : (viewport.clientWidth < 340 ? 4.15 : 3.75);
  const width = both ? (close ? 3.0 : 3.55) : (close ? 1.6 : 1.78);
  const distance = Math.max(height, width / camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const target = new THREE.Vector3(0, close ? 2.35 : 1.48, 0);
  const position = target.clone().add(new THREE.Vector3(view === 'back' ? -.10 : .055, close ? .04 : .13, view === 'back' ? -1 : 1).normalize().multiplyScalar(distance));
  if (immediate || reduceMotion.matches) { camera.position.copy(position); controls.target.copy(target); controls.update(); cameraTween = null; }
  else {
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const to = new THREE.Spherical().setFromVector3(position.clone().sub(target));
    while (to.theta - from.theta > Math.PI) to.theta -= Math.PI * 2;
    while (to.theta - from.theta < -Math.PI) to.theta += Math.PI * 2;
    cameraTween = { start: performance.now(), from, to, fromTarget: controls.target.clone(), toTarget: target };
  }
}
function chooseCharacter(value) {
  state.character = value; selected('character', value);
  characters.forEach((c, i) => {
    c.root.visible = value === 'both' || value === c.key;
    c.root.position.x = value === 'both' ? (i ? .72 : -.72) : 0;
    c.root.rotation.y = value === 'both' ? (i ? -.08 : .08) : 0;
    flowers[i].visible = c.root.visible;
    flowers[i].position.x = c.root.position.x;
  });
  $('scene-label').textContent = value === 'both' ? '學與綾 · 雙人造型' : value === 'syue' ? '學 · 黑髮與藍外套' : '綾 · 漁夫帽與小花';
  fitView();
}
function chooseAction(value) {
  state.action = value; actionTime = 0; selected('action', value);
  waterPlants.visible = value === 'water';
  droplets.visible = value === 'water';
  characters.forEach(c => c.can.object.visible = value === 'water');
  if (state.paused) { state.paused = false; updatePause(); }
}
function updatePause() {
  $('pause').setAttribute('aria-pressed', String(state.paused));
  $('pause').querySelector('span').textContent = state.paused ? '繼續動作' : '暫停動作';
}
function pose(c, name, x = 0, y = 0, z = 0) {
  const b = c.bones[name]; if (!b) return;
  // Blender's limb bone axes differ from the spine. Express posing in the
  // character's coordinates and convert to the parent's frame, rather than
  // assuming every imported bone has the same local X / Z directions.
  b.parent.updateWorldMatrix(true, false);
  b.parent.getWorldQuaternion(parentQuat);
  c.root.getWorldQuaternion(rootQuat);
  frameQuat.copy(parentQuat).invert().multiply(rootQuat);
  deltaQuat.identity();
  if (x) deltaQuat.multiply(offsetQuat.setFromAxisAngle(AXIS_X, x));
  if (y) deltaQuat.multiply(offsetQuat.setFromAxisAngle(AXIS_Y, y));
  if (z) deltaQuat.multiply(offsetQuat.setFromAxisAngle(AXIS_Z, z));
  inverseFrame.copy(frameQuat).invert();
  deltaQuat.premultiply(frameQuat).multiply(inverseFrame);
  b.quaternion.copy(b.userData.rest);
  b.quaternion.premultiply(deltaQuat);
}
function animateCharacter(c, t, index) {
  for (const b of Object.values(c.bones)) b.quaternion.copy(b.userData.rest);
  const phase = t + index * .65;
  c.root.position.y = 0;
  pose(c, 'spine', Math.sin(phase * 1.5) * .012);
  pose(c, 'head', 0, Math.sin(phase * .7) * .025, Math.sin(phase * .85) * .018);
  if (state.action === 'walk') {
    const a = Math.sin(t * 5.4 + index * .5), b = Math.cos(t * 5.4 + index * .5);
    pose(c, 'thigh_L', a * .33); pose(c, 'thigh_R', -a * .33);
    pose(c, 'shin_L', .12 + Math.max(0, -a) * .31); pose(c, 'shin_R', .12 + Math.max(0, a) * .31);
    pose(c, 'upperarm_L', -a * .27, 0, -.04); pose(c, 'upperarm_R', a * .27, 0, .04);
    pose(c, 'forearm_L', .11); pose(c, 'forearm_R', .11);
    pose(c, 'spine', 0, b * .025); c.root.position.y = .025 + Math.abs(b) * .025;
  } else if (state.action === 'water') {
    pose(c, 'spine', .08);
    pose(c, 'head', .11, -.055, -.04);
    pose(c, 'upperarm_R', -.72, 0, -.23);
    pose(c, 'forearm_R', -.45, 0, -.08);
    pose(c, 'hand_R', .42 + Math.sin(t * 1.7) * .035);
    pose(c, 'upperarm_L', -.18, 0, -.08);
    pose(c, 'forearm_L', -.13);
    c.bones.hand_R.updateWorldMatrix(true, false);
    c.bones.hand_R.getWorldQuaternion(parentQuat);
    c.root.getWorldQuaternion(rootQuat);
    c.can.object.quaternion.copy(parentQuat).invert().multiply(rootQuat).multiply(offsetQuat.setFromAxisAngle(AXIS_X, .42 + Math.sin(t * 1.7) * .04));
  } else if (state.action === 'wave') {
    const side = index ? 'R' : 'L', sign = index ? 1 : -1;
    pose(c, 'upperarm_' + side, -.1, 0, sign * .90);
    pose(c, 'forearm_' + side, -.15, 0, sign * (1.40 + Math.sin(t * 5.5) * .16));
    pose(c, 'hand_' + side, .04, 0, Math.sin(t * 5.5) * .10);
    pose(c, 'head', -.025, 0, sign * .06);
  } else {
    pose(c, 'upperarm_L', Math.sin(phase) * .018, 0, -.035);
    pose(c, 'upperarm_R', -Math.sin(phase) * .018, 0, .035);
  }
}
function updateWater(t) {
  let n = 0;
  for (const c of characters) {
    if (!c.root.visible) continue;
    c.can.spout.getWorldPosition(spoutWorld);
    const flowerIndex = c.key === 'syue' ? 0 : 1;
    flowers[flowerIndex].position.set(spoutWorld.x, 0, spoutWorld.z + .18);
    for (let i = 0; i < 14; i++) {
      const p = ((t * .75 + i / 14) % 1);
      dummy.position.copy(spoutWorld);
      dummy.position.y = THREE.MathUtils.lerp(spoutWorld.y, .16, p * p);
      dummy.position.z += .18 * p;
      dummy.position.x += Math.sin(i * 5.2) * .035 * p;
      dummy.scale.set(.65, 1.3, .65); dummy.updateMatrix();
      droplets.setMatrixAt(n++, dummy.matrix);
    }
  }
  droplets.count = n; droplets.instanceMatrix.needsUpdate = true;
}
function resize() {
  const { width, height } = viewport.getBoundingClientRect();
  if (!width || !height) return;
  camera.aspect = width / height; camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  fitView(state.view, true);
}
new ResizeObserver(resize).observe(viewport);
controls.addEventListener('start', () => { cameraTween = null; controls.autoRotate = false; $('auto-rotate').setAttribute('aria-pressed', 'false'); });
viewport.addEventListener('keydown', e => {
  if (!['ArrowLeft', 'ArrowRight', '+', '-', '='].includes(e.key)) return;
  e.preventDefault(); cameraTween = null;
  if (e.key.startsWith('Arrow')) {
    const offset = camera.position.clone().sub(controls.target);
    offset.applyAxisAngle(AXIS_Y, e.key === 'ArrowLeft' ? -.2 : .2);
    camera.position.copy(controls.target).add(offset);
  } else zoom(e.key === '-' ? 1.15 : .87);
});
function zoom(factor) {
  cameraTween = null;
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(offset); controls.update();
}
document.querySelectorAll('[data-group] button').forEach(button => {
  button.addEventListener('click', () => {
    const group = button.parentElement.dataset.group, value = button.dataset.value;
    if (group === 'character') chooseCharacter(value);
    if (group === 'action') chooseAction(value);
    if (group === 'view') fitView(value);
    if (group === 'background') {
      state.background = value; selected(group, value);
      const color = value === 'garden' ? '#e7ecdd' : '#f1ecdf';
      scene.background.set(color); floorMat.color.set(color);
      baseMat.color.set(value === 'garden' ? '#b1c28d' : '#e6ddcb');
      garden.visible = value === 'garden';
    }
  });
});
$('zoom-in').onclick = () => zoom(.85);
$('zoom-out').onclick = () => zoom(1.17);
$('reset').onclick = () => { controls.autoRotate = false; $('auto-rotate').setAttribute('aria-pressed', 'false'); fitView('front'); };
$('auto-rotate').onclick = () => { cameraTween = null; controls.autoRotate = !controls.autoRotate; $('auto-rotate').setAttribute('aria-pressed', String(controls.autoRotate)); };
$('pause').onclick = () => { state.paused = !state.paused; updatePause(); };
$('snapshot').onclick = () => {
  renderer.render(scene, camera);
  renderer.domElement.toBlob(blob => {
    if (!blob) { toast('這次沒有拍到，再試一次。'); return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `小花園-${state.character}-${state.action}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('已拍下這個角度');
  }, 'image/png');
};
renderer.domElement.addEventListener('webglcontextlost', e => {
  e.preventDefault(); $('loading').hidden = true; $('load-error').hidden = false;
  $('error-message').textContent = '畫面暫時中斷，重新載入就能再看看人物。';
});
// Disable model interactions while loading. Failures always expose a retry.
const modelButtons = [...document.querySelectorAll('.panel button, .view-tools button')];
modelButtons.forEach(b => b.disabled = true);
try {
  const gltf = await new GLTFLoader().loadAsync('../assets/games/garden/characters/garden-characters.glb?v=1', e => {
    $('load-progress').textContent = e.total ? `正在載入 ${Math.round(e.loaded / e.total * 100)}%` : '正在載入人物細節…';
  });
  scene.add(gltf.scene);
  for (const [index, key] of ['syue', 'ling'].entries()) {
    const root = gltf.scene.getObjectByName(key);
    if (!root) throw new Error(`Missing character: ${key}`);
    const bones = {};
    root.traverse(o => {
      if (o.isBone) { const name = o.name.replace(/(?:_\d+|\.\d+)$/, ''); bones[name] = o; o.userData.rest = o.quaternion.clone(); }
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        o.frustumCulled = false; // animated arms can exceed the rest-pose bounds
        o.material.envMapIntensity = .34;
      }
    });
    if (!bones.hand_R || !bones.head) throw new Error(`Incomplete character rig: ${key}`);
    root.scale.setScalar(index ? .96 : 1);
    const can = wateringCan(index ? '#d8a9a0' : '#9bb9c4');
    // Attach in world coordinates first, preserving a natural resting grip.
    root.updateWorldMatrix(true, true);
    bones.hand_R.getWorldPosition(spoutWorld);
    can.object.position.copy(spoutWorld).add(new THREE.Vector3(0, -.12, .10));
    scene.add(can.object); bones.hand_R.attach(can.object);
    can.object.visible = false;
    characters.push({ key, root, bones, can });
  }
  chooseCharacter('both'); resize(); updatePause();
  state.loaded = true; modelButtons.forEach(b => b.disabled = false);
  $('loading').hidden = true;
} catch (error) {
  console.error('Character preview:', error);
  $('loading').hidden = true; $('load-error').hidden = false;
}
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .05);
  if (document.hidden) return;
  if (!state.paused) actionTime += dt;
  for (let i = 0; i < characters.length; i++) animateCharacter(characters[i], actionTime, i);
  if (state.action === 'water') { scene.updateMatrixWorld(true); updateWater(actionTime); }
  if (cameraTween) {
    const t = Math.min(1, (performance.now() - cameraTween.start) / 650), k = 1 - Math.pow(1 - t, 3);
    controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, k);
    const a = cameraTween.from, b = cameraTween.to;
    camera.position.setFromSphericalCoords(THREE.MathUtils.lerp(a.radius, b.radius, k), THREE.MathUtils.lerp(a.phi, b.phi, k), THREE.MathUtils.lerp(a.theta, b.theta, k)).add(controls.target);
    if (t === 1) cameraTween = null;
  }
  controls.update(); renderer.render(scene, camera);
});
// A read-only inspection surface for the browser smoke test; no garden data,
// user identity, persistence, or remote writes are used in this preview.
window.characterPreview = { state, scene, camera, controls, renderer, characters };
