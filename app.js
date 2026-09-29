// 鹈鹕骑自行车 · 3D —— Three.js 程序化场景
// 能力覆盖: 程序化几何建模 / 实时骨架动画 / 程序化环境光照(RoomEnvironment) /
//           PCFSoft 阴影 / ACES 色调映射 / CanvasTexture 渐变天空 /
//           相机轨道控制 / GUI 控制面板 / FPS 计数器 / 响应式 / WebGL 容错

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (id) => document.getElementById(id);

function fail(msg) {
  const e = $('err');
  e.style.display = 'flex';
  e.innerHTML = '⚠️ 无法初始化 3D 场景<br><br>' + msg +
    '<br><br>建议：使用较新的 Chrome / Edge / Firefox，并确认能访问 cdn.jsdelivr.net';
  const l = $('loader'); if (l) l.style.opacity = '0';
}

// ---------- 全局状态 ----------
const STATE = {
  speed: 1.2,
  autoRotate: true,
  flap: true,
  night: false,
  perf: false,
};

// ---------- 渲染器 ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: $('scene'),
    antialias: true,
    powerPreference: 'high-performance',
  });
} catch (e) {
  fail('WebGL 上下文创建失败：' + e.message);
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ---------- 场景 / 相机 ----------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9ec6f0, 22, 70);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(6.5, 4.2, 8.5);

// 程序化环境光照 (RoomEnvironment -> PMREM) 提供真实反射
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// ---------- 渐变天空 (CanvasTexture) ----------
function makeSky(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad; g.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
let sky;
function applySky() {
  const top = STATE.night ? '#0a1230' : '#7fb4ff';
  const bottom = STATE.night ? '#1b2a52' : '#dff0ff';
  sky = makeSky(top, bottom);
  scene.background = sky;
  scene.fog.color.set(STATE.night ? 0x16213f : 0x9ec6f0);
}
applySky();

// ---------- 灯光 ----------
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a6b3a, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d6, 2.4);
sun.position.set(8, 12, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 40;
sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(sun.target);

const rim = new THREE.DirectionalLight(0xffd9a0, 0.6);
rim.position.set(-6, 5, -7);
scene.add(rim);

// ---------- 地面 ----------
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(60, 64),
  new THREE.MeshStandardMaterial({ color: 0x6f8f4f, roughness: 0.95, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 路面 + 流动标线 (表现速度感)
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 120),
  new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.85 })
);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.01;
road.receiveShadow = true;
scene.add(road);

const dashMat = new THREE.MeshStandardMaterial({ color: 0xffcf4d, emissive: 0x3a2a00, roughness: 0.6 });
const dashes = [];
for (let i = 0; i < 14; i++) {
  const d = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 1.6), dashMat);
  d.position.set(0, 0.02, -i * 4 + 6);
  d.receiveShadow = true;
  scene.add(d);
  dashes.push(d);
}

// ---------- 材质工具 ----------
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial(
  Object.assign({ color, roughness: 0.6, metalness: 0.1 }, opts)
);

// 把若干网格打包为一个可投/接收阴影的组
function group(shadow = true) {
  const g = new THREE.Group();
  g.traverse((o) => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = shadow; } });
  return g;
}

// =====================================================================
//  自行车 (程序化几何)
// =====================================================================
function buildBike() {
  const bike = group();
  const frameMat = mat(0xe8453c, { roughness: 0.35, metalness: 0.35 });
  const darkMat = mat(0x222831, { roughness: 0.5, metalness: 0.4 });
  const tireMat = mat(0x14171c, { roughness: 0.9 });
  const rimMat = mat(0xcfd6e0, { roughness: 0.3, metalness: 0.8 });
  const saddleMat = mat(0x1a1a1a, { roughness: 0.8 });

  const R = 0.95;          // 轮半径
  const tube = (a, b, r, m) => {
    const len = a.distanceTo(b);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), m);
    cyl.position.copy(a).add(b).multiplyScalar(0.5);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return cyl;
  };

  // 车轮 (轮圈 + 轮胎 + 辐条)
  function wheel(pos) {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(R, 0.10, 16, 48), tireMat);
    w.add(tire);
    const rimM = new THREE.Mesh(new THREE.TorusGeometry(R - 0.12, 0.035, 12, 48), rimMat);
    w.add(rimM);
    // 辐条
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, (R - 0.12) * 2, 6),
        rimMat
      );
      spoke.rotation.z = a;
      w.add(spoke);
    }
    // 轮毂
    w.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 16).rotateX(Math.PI / 2), darkMat));
    w.position.copy(pos);
    w.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return w;
  }

  const rear = new THREE.Vector3(-1.15, R, 0);
  const front = new THREE.Vector3(1.15, R, 0);
  const wb = wheel(rear), wf = wheel(front);
  bike.add(wb, wf);

  // 车架主三角
  const bb = new THREE.Vector3(0, R, 0);          // 五通(脚踏轴)
  const seat = new THREE.Vector3(-0.95, R + 1.15, 0);
  const head = new THREE.Vector3(0.95, R + 1.05, 0);
  bike.add(tube(bb, seat, 0.05, frameMat));
  bike.add(tube(seat, head, 0.05, frameMat));
  bike.add(tube(bb, head, 0.05, frameMat));
  bike.add(tube(bb, rear, 0.045, frameMat));      // 后下叉
  bike.add(tube(seat, rear, 0.04, frameMat));     // 后上叉
  // 前叉 + 车把
  const forkTop = new THREE.Vector3(0.95, R + 1.05, 0);
  bike.add(tube(forkTop, front, 0.045, frameMat));
  bike.add(tube(forkTop, head.clone().add(new THREE.Vector3(0, 0.35, 0)), 0.04, darkMat)); // 把立
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 12), darkMat);
  bar.rotation.x = Math.PI / 2;
  bar.position.copy(head.clone().add(new THREE.Vector3(0, 0.35, 0)));
  bike.add(bar);
  // 座垫
  const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), saddleMat);
  saddle.scale.set(1.3, 0.5, 0.8);
  saddle.position.copy(seat).add(new THREE.Vector3(0, 0.07, 0));
  saddle.rotation.x = -0.15;
  bike.add(saddle);

  // 脚踏曲柄 (左右，相位差 180°)
  const crankPivot = bb.clone();
  const crankMat = mat(0x9aa3ad, { metalness: 0.7, roughness: 0.3 });
  function crank(side) {
    const c = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.03), crankMat);
    arm.position.y = -0.22;
    c.add(arm);
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.12), darkMat);
    pedal.position.y = -0.44;
    c.add(pedal);
    c.position.copy(crankPivot);
    c.position.z = side * 0.13;
    bike.add(c);
    return c;
  }
  const crankL = crank(1), crankR = crank(-1);

  return { bike, wb, wf, crankL, crankR, R, bb };
}

// =====================================================================
//  鹈鹕 (程序化几何，含可动翅膀/头部)
// =====================================================================
function buildPelican() {
  const pel = group();
  const bodyMat = mat(0xf3f4f6, { roughness: 0.55 });
  const wingMat = mat(0xe3e6ec, { roughness: 0.6 });
  const beakMat = mat(0xffae2b, { roughness: 0.45 });
  const beakTip = mat(0xe8901a, { roughness: 0.5 });
  const legMat = mat(0xffb43d, { roughness: 0.5 });
  const eyeMat = mat(0x111418, { roughness: 0.3 });

  // 身体 (纺锤)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 28, 22), bodyMat);
  body.scale.set(1.0, 1.05, 1.6);
  body.position.y = 0.1;
  pel.add(body);

  // 尾羽
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 16), wingMat);
  tail.rotation.x = Math.PI / 2.1;
  tail.position.set(0, 0.05, -1.0);
  pel.add(tail);

  // 颈部 + 头 (可俯仰)
  const neck = new THREE.Group();
  neck.position.set(0, 0.45, 0.85);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.9, 18), bodyMat);
  neckMesh.position.y = 0.4;
  neckMesh.rotation.x = -0.25;
  neck.add(neckMesh);

  const head = new THREE.Group();
  head.position.set(0, 0.8, 0.18);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.27, 22, 18), bodyMat);
  head.add(skull);
  // 上喙 + 喉囊
  const upper = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.0, 18), beakMat);
  upper.rotation.x = Math.PI / 2;
  upper.position.set(0, 0.02, 0.62);
  head.add(upper);
  const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), beakTip);
  pouch.scale.set(1, 1.4, 2.2);
  pouch.position.set(0, -0.12, 0.55);
  head.add(pouch);
  // 眼睛
  const eyeGeo = new THREE.SphereGeometry(0.045, 12, 12);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(0.12, 0.08, 0.2);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(-0.12, 0.08, 0.2);
  head.add(eyeL, eyeR);

  neck.add(head);
  pel.add(neck);

  // 翅膀 (可扇动) —— 用挤压/缩放的扁平体表现羽翼
  function wing(side) {
    const root = new THREE.Group();
    root.position.set(side * 0.5, 0.35, 0.1);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.3, 0.55, 1.1, 0.7);
    shape.quadraticCurveTo(1.5, 0.2, 1.7, -0.25);
    shape.quadraticCurveTo(0.9, -0.1, 0, -0.05);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    geo.center();
    const w = new THREE.Mesh(geo, wingMat);
    w.scale.set(side, 1, 1);
    root.add(w);
    root.rotation.z = side * 0.5;
    pel.add(root);
    return root;
  }
  const wingL = wing(1), wingR = wing(-1);

  // 腿 (连到踏板，做踩踏相位)
  function leg(side) {
    const g = new THREE.Group();
    g.position.set(side * 0.22, -0.35, 0.1);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.55, 12), legMat);
    thigh.position.y = -0.27;
    g.add(thigh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.12), legMat);
    foot.position.y = -0.55;
    g.add(foot);
    pel.add(g);
    return { g, foot };
  }
  const legL = leg(1), legR = leg(-1);

  return { pel, neck, head, wingL, wingR, legL, legR };
}

// =====================================================================
//  组装 "鹈鹕 + 自行车"
// =====================================================================
const bikeObj = buildBike();
const pelObj = buildPelican();

const rider = new THREE.Group();
rider.add(bikeObj.bike);

// 把鹈鹕放到车座上方
pelObj.pel.position.set(-0.15, bikeObj.R + 1.15 + 0.55, 0);
pelObj.pel.rotation.y = Math.PI; // 朝向 -Z 行进方向
rider.add(pelObj.pel);

scene.add(rider);

// 把"脚"贴到踏板：用世界坐标链逐级转回鹈鹕本地空间，避免手算偏移
const _pedal = new THREE.Vector3();
function updateLeg(legGroup, crank) {
  // 踏板在曲柄本地坐标 (曲柄绕 Z 旋转, 脚踏在臂末端 y=-0.44)
  _pedal.set(0, -0.44, 0).applyEuler(crank.rotation).add(crank.position); // bike 本地
  bikeObj.bike.localToWorld(_pedal);   // -> 世界
  rider.worldToLocal(_pedal);          // -> rider 本地
  pelObj.pel.worldToLocal(_pedal);     // -> 鹈鹕本地
  // 腿组原点在鹈鹕空间, 脚在其下方 0.55 处; 令脚 = 踏板
  legGroup.position.set(_pedal.x, _pedal.y + 0.55, _pedal.z);
}

// =====================================================================
//  控制器 / 灯光 / 性能
// =====================================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1.6, 0);
controls.minDistance = 4;
controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI * 0.49;
controls.autoRotateSpeed = 0.8;

// ---------- UI 绑定 ----------
$('speed').addEventListener('input', (e) => STATE.speed = parseFloat(e.target.value));
$('bRotate').addEventListener('click', (e) => {
  STATE.autoRotate = !STATE.autoRotate; e.target.classList.toggle('on', STATE.autoRotate);
});
$('bFlap').addEventListener('click', (e) => {
  STATE.flap = !STATE.flap; e.target.classList.toggle('on', STATE.flap);
});
$('bNight').addEventListener('click', () => {
  STATE.night = !STATE.night; applySky();
  sun.intensity = STATE.night ? 0.6 : 2.4;
  hemi.intensity = STATE.night ? 0.2 : 0.55;
  rim.intensity = STATE.night ? 1.4 : 0.6;
  if ('environmentIntensity' in scene) scene.environmentIntensity = STATE.night ? 0.35 : 1.0;
});
$('bPerf').addEventListener('click', (e) => {
  STATE.perf = !STATE.perf; e.target.classList.toggle('on', STATE.perf);
  renderer.setPixelRatio(STATE.perf ? 1 : Math.min(window.devicePixelRatio, 2));
  sun.shadow.mapSize.set(STATE.perf ? 1024 : 2048, STATE.perf ? 1024 : 2048);
  sun.shadow.map?.dispose(); sun.shadow.map = null;
});

// ---------- 响应式 ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- FPS ----------
let frames = 0, fpsAcc = 0, fps = 0;
const fpsEl = $('fps');

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let crankAngle = 0;
let dashOffset = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const v = STATE.speed;

  // 车轮旋转 (角速度 = v / R)
  const wAng = (v / bikeObj.R) * dt;
  bikeObj.wb.rotation.z -= wAng;
  bikeObj.wf.rotation.z -= wAng;

  // 曲柄旋转
  crankAngle += wAng;
  bikeObj.crankL.rotation.z = crankAngle;
  bikeObj.crankR.rotation.z = crankAngle + Math.PI;

  // 脚贴踏板 (先刷新世界矩阵, 避免一帧延迟抖动)
  rider.updateWorldMatrix(true, true);
  updateLeg(pelObj.legL.g, bikeObj.crankL);
  updateLeg(pelObj.legR.g, bikeObj.crankR);

  // 身体随踏频轻微起伏 + 车把转向微抖
  rider.position.y = Math.sin(crankAngle * 2) * 0.015 * (v > 0.01 ? 1 : 0);
  pelObj.head.rotation.x = -0.1 + Math.sin(t * 1.6) * 0.05;
  pelObj.neck.rotation.x = Math.sin(t * 1.2) * 0.04;

  // 扇翅膀
  if (STATE.flap) {
    const f = Math.sin(t * (4 + v * 2)) * 0.6;
    pelObj.wingL.rotation.z = 0.5 + f;
    pelObj.wingR.rotation.z = -0.5 - f;
  } else {
    pelObj.wingL.rotation.z += (0.5 - pelObj.wingL.rotation.z) * 0.1;
    pelObj.wingR.rotation.z += (-0.5 - pelObj.wingR.rotation.z) * 0.1;
  }

  // 路面标线流动 (速度感)
  dashOffset = (dashOffset + v * dt * 4) % 4;
  for (const d of dashes) {
    d.position.z -= v * dt * 4;
    if (d.position.z < -28) d.position.z += 56;
  }

  // 自动环绕
  controls.autoRotate = STATE.autoRotate;
  controls.update();

  renderer.render(scene, camera);

  // FPS
  frames++; fpsAcc += dt;
  if (fpsAcc >= 0.5) { fps = Math.round(frames / fpsAcc); frames = 0; fpsAcc = 0;
    fpsEl.textContent = `FPS ${fps} · 速度 ${v.toFixed(2)}× · ${STATE.night ? '夜' : '昼'}`;
  }
}

// 隐藏 loader 并启动
requestAnimationFrame(() => {
  const l = $('loader');
  if (l) { l.style.opacity = '0'; setTimeout(() => l.remove(), 700); }
  animate();
});
