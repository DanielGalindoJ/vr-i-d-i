// ================================================================
//  CyberVR SOC · Mundo 3D en primera persona (Three.js)
// ================================================================
import * as THREE from 'three';
import { MISSIONS, EXTRAS, TOTAL_XP, rankFor } from './missions.js';
import { audio, mountAudioWidget } from './audio.js';

const $ = (s) => document.querySelector(s);
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

// ---------- Estado / progreso ----------
const STORE_KEY = 'cybervr-soc-v1';
const defaultState = () => ({ name: '', done: [], xp: 0, examScore: 0, certId: '', certDate: '' });
let state = loadState();

function loadState() {
  try {
    return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY)) || {});
  } catch {
    return defaultState();
  }
}
function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch { /* sin almacenamiento */ }
}

const ALL_STATIONS = [...MISSIONS, ...EXTRAS];
const getMission = (id) => ALL_STATIONS.find((m) => m.id === id);
const isExtra = (id) => EXTRAS.some((m) => m.id === id);
const missionIndex = (id) => MISSIONS.findIndex((m) => m.id === id);
const isDone = (id) => state.done.includes(id);
const isUnlocked = (id) => {
  if (isDone(id)) return true; // partidas antiguas: lo ya hecho nunca se bloquea
  if (isExtra(id)) return isDone('induccion');
  const i = missionIndex(id);
  return i === 0 || isDone(MISSIONS[i - 1].id);
};
const nextMission = () => MISSIONS.find((m) => !isDone(m.id));

// ---------- Renderer / escena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('#app').appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04070d);
scene.fog = new THREE.Fog(0x04070d, 16, 45);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 120);
camera.rotation.order = 'YXZ';
const PLAYER_H = 1.7;
camera.position.set(0, PLAYER_H, 22);
let yaw = 0;
let pitch = 0;

// ---------- Luces ----------
scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x10121a, 0.7));
scene.add(new THREE.AmbientLight(0xffffff, 0.15));
function pointLight(color, intensity, x, y, z, dist = 18) {
  const l = new THREE.PointLight(color, intensity, dist, 1);
  l.position.set(x, y, z);
  scene.add(l);
  return l;
}
pointLight(0xffe2b8, 14, 0, 3.6, 18);
pointLight(0xffe2b8, 8, 0, 3.6, 12.5);
pointLight(0x3aa0ff, 10, -7, 3.6, -4);
pointLight(0x3aa0ff, 10, 7, 3.6, -4);
pointLight(0x00e5ff, 8, 0, 3.6, 4);
pointLight(0x00e5ff, 12, 0, 3, -11);
pointLight(0xfff0d0, 14, -20, 3.6, -5);
pointLight(0xfff0d0, 14, -20, 3.6, 5);

// ---------- Materiales ----------
const M = {
  lobbyFloor: new THREE.MeshStandardMaterial({ color: 0x3a3f4b, roughness: 0.55, metalness: 0.1 }),
  socFloor: new THREE.MeshStandardMaterial({ color: 0x0a0f1a, roughness: 0.4, metalness: 0.4 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 0.8 }),
  lobbyWall: new THREE.MeshStandardMaterial({ color: 0x4a5163, roughness: 0.9 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0x0d1118, roughness: 1, side: THREE.DoubleSide }),
  desk: new THREE.MeshStandardMaterial({ color: 0x222a38, roughness: 0.5, metalness: 0.3 }),
  deskTop: new THREE.MeshStandardMaterial({ color: 0x3b4558, roughness: 0.4, metalness: 0.2 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.3, metalness: 0.6 }),
  accent: new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.2 }),
  door: new THREE.MeshStandardMaterial({ color: 0x2b3a55, metalness: 0.6, roughness: 0.3, emissive: 0x001a33 }),
  light: new THREE.MeshBasicMaterial({ color: 0xfff4e0 }),
  plant: new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.8 }),
  pot: new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 }),
  sofa: new THREE.MeshStandardMaterial({ color: 0x24456e, roughness: 0.9 }),
};

// ---------- Helpers de geometría ----------
const colliders = [];
function box(w, h, d, mat, x, y, z, collide = false, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  if (collide) colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  return m;
}
function plane(w, d, mat, x, y, z, rx) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = rx;
  m.position.set(x, y, z);
  scene.add(m);
  return m;
}
function wall(x1, z1, x2, z2, mat = M.wall, h = 4) {
  const t = 0.3;
  const w = Math.abs(x2 - x1) || t;
  const d = Math.abs(z2 - z1) || t;
  return box(w, h, d, mat, (x1 + x2) / 2, h / 2, (z1 + z2) / 2, true);
}
function blocked(x, z) {
  const r = 0.35;
  for (const b of colliders) {
    if (b.disabled) continue;
    if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
  }
  return false;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Etiqueta flotante (sprite con canvas)
function makeLabel(title, sub = '', color = '#00e5ff', width = 2.6) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(width, width / 4, 1);
  sp.userData.draw = (t, s, col) => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 128);
    g.fillStyle = 'rgba(5,10,20,0.85)';
    roundRect(g, 4, 4, 504, 120, 18);
    g.fill();
    g.strokeStyle = col;
    g.lineWidth = 4;
    g.stroke();
    g.textAlign = 'center';
    let size = 46;
    do {
      g.font = `bold ${size}px "Segoe UI", sans-serif`;
      size -= 2;
    } while (g.measureText(t).width > 470 && size > 20);
    g.fillStyle = col;
    g.fillText(t, 256, s ? 62 : 80);
    if (s) {
      g.fillStyle = '#cfe3ff';
      g.font = '28px "Segoe UI", sans-serif';
      g.fillText(s, 256, 104);
    }
    tex.needsUpdate = true;
  };
  sp.userData.draw(title, sub, color);
  return sp;
}

// Póster en pared (canvas)
function makePoster(lines, x, y, z, rotY, w = 2.2, h = 1.4) {
  const c = document.createElement('canvas');
  c.width = 660;
  c.height = 420;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 660, 420);
  grd.addColorStop(0, '#0b1e3a');
  grd.addColorStop(1, '#06101f');
  g.fillStyle = grd;
  g.fillRect(0, 0, 660, 420);
  g.strokeStyle = '#00e5ff';
  g.lineWidth = 6;
  g.strokeRect(10, 10, 640, 400);
  g.textAlign = 'center';
  lines.forEach(([txt, size, col], i) => {
    g.fillStyle = col || '#dce8ff';
    g.font = `bold ${size}px "Segoe UI", sans-serif`;
    g.fillText(txt, 330, 90 + i * 70);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  scene.add(m);
}

// NPC sencillo
function makeNPC(shirt) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc99a77, roughness: 0.7 });
  const cloth = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.6 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x1b1f2a });
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.85, 16), pants);
  legs.position.y = 0.425;
  g.add(legs);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.72, 16), cloth);
  body.position.y = 1.2;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), skin);
  head.position.y = 1.74;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), pants);
  hair.position.y = 1.77;
  g.add(hair);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.66, 10), cloth);
    arm.position.set(s * 0.37, 1.15, 0);
    arm.rotation.z = s * 0.12;
    g.add(arm);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    eye.position.set(s * 0.07, 1.77, 0.18);
    g.add(eye);
  }
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.02), M.accent);
  badge.position.set(0.14, 1.32, 0.28);
  g.add(badge);
  return g;
}

// ---------- Interactuables ----------
const interactables = []; // { root, mid, stand }
const labels = {};
function registerInteract(root, mid, stand) {
  root.traverse((o) => (o.userData.mid = mid));
  interactables.push({ root, mid, stand });
}

// ================================================================
//  LOBBY (z: 10 → 24)
// ================================================================
plane(16, 14, M.lobbyFloor, 0, 0, 17, -Math.PI / 2);
plane(16, 14, M.ceiling, 0, 4, 17, Math.PI / 2);
wall(-8, 10, -8, 24, M.lobbyWall);
wall(8, 10, 8, 24, M.lobbyWall);
wall(-8, 24, 8, 24, M.lobbyWall);

// Lámparas de techo
[[0, 18], [0, 13], [-4, 20], [4, 20]].forEach(([x, z]) => box(1.6, 0.05, 0.6, M.light, x, 3.97, z));

// Recepción
box(4, 1.1, 0.8, M.desk, 0, 0.55, 14.5, true);
box(4.2, 0.06, 1, M.deskTop, 0, 1.13, 14.5);
box(4.05, 0.08, 0.05, M.accent, 0, 0.9, 14.93);
const lobbySign = makeLabel('CyberCorp S.A.S.', 'Recepción · Bienvenido/a', '#00e5ff', 4);
lobbySign.position.set(0, 3.2, 13);
scene.add(lobbySign);

// Sofás y plantas
box(2.4, 0.5, 0.9, M.sofa, -6.3, 0.25, 19, true);
box(2.4, 0.6, 0.25, M.sofa, -6.3, 0.75, 19.4);
box(2.4, 0.5, 0.9, M.sofa, 6.3, 0.25, 19, true);
box(2.4, 0.6, 0.25, M.sofa, 6.3, 0.75, 19.4);
[[-7.2, 11], [7.2, 11], [-7.2, 23.2], [7.2, 23.2]].forEach(([x, z]) => {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.5, 14), M.pot);
  pot.position.set(x, 0.25, z);
  scene.add(pot);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), M.plant);
  leaf.position.set(x, 0.95, z);
  scene.add(leaf);
  colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
});

// Pósters educativos
makePoster(
  [['TRÍADA CIA', 52, '#00e5ff'], ['Confidencialidad', 40], ['Integridad', 40], ['Disponibilidad', 40], ['Protegemos los tres', 30, '#ffc04d']],
  -7.84, 2.1, 16, Math.PI / 2
);
makePoster(
  [['¿CORREO RARO?', 50, '#ff3b5c'], ['Piensa antes de', 40], ['hacer clic', 40], ['Repórtalo al SOC', 40, '#22ff88'], ['ext. 4444', 30, '#8494b3']],
  7.84, 2.1, 16, -Math.PI / 2
);

// Mentora Laura
const mentor = makeNPC(0x8e44ad);
mentor.position.set(2.8, 0, 17.2);
scene.add(mentor);
const mentorLabel = makeLabel('Laura · Mentora', 'Inducción', '#ffc04d', 2.4);
mentorLabel.position.set(0, 2.35, 0);
mentor.add(mentorLabel);
labels.induccion = mentorLabel;
registerInteract(mentor, 'induccion', { x: 2.8, z: 18.6 });
colliders.push({ minX: 2.5, maxX: 3.1, minZ: 16.9, maxZ: 17.5 });

// ================================================================
//  Separación + puerta del SOC (z = 10)
// ================================================================
wall(-12, 10, -1.5, 10);
wall(1.5, 10, 12, 10);
box(3, 1, 0.3, M.wall, 0, 3.5, 10);
const doorMesh = box(3, 3, 0.15, M.door, 0, 1.5, 10);
const doorCol = { minX: -1.5, maxX: 1.5, minZ: 9.85, maxZ: 10.15, disabled: false };
colliders.push(doorCol);
const doorStripMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
box(3.1, 0.06, 0.34, doorStripMat, 0, 3.02, 10);
const doorSign = makeLabel('SOC', 'Acceso restringido', '#ff3b5c', 2.4);
doorSign.position.set(0, 3.55, 10.4);
scene.add(doorSign);
let doorTargetY = 1.5;

// ================================================================
//  SOC (x: -12 → 12, z: -14 → 10)
// ================================================================
plane(24, 24, M.socFloor, 0, 0, -2, -Math.PI / 2);
plane(24, 24, M.ceiling, 0, 4, -2, Math.PI / 2);
const grid = new THREE.GridHelper(24, 24, 0x00e5ff, 0x0b3a4a);
grid.position.set(0, 0.01, -2);
grid.material.transparent = true;
grid.material.opacity = 0.3;
scene.add(grid);
wall(-12, -14, -12, 2); // pared oeste, con puerta hacia el laboratorio
wall(-12, 5, -12, 10);
box(0.3, 1, 3, M.wall, -12, 3.5, 3.5);
wall(12, -14, 12, 10);
wall(-12, -14, 12, -14);
// Franjas de luz en paredes del SOC
box(0.05, 0.06, 24, M.accent, -11.83, 3.2, -2);
box(0.05, 0.06, 24, M.accent, 11.83, 3.2, -2);

// ================================================================
//  LABORATORIO DE REDES (x: -28 → -12, z: -12 → 10)
// ================================================================
plane(16, 22, M.lobbyFloor, -20, 0, -1, -Math.PI / 2);
plane(16, 22, M.ceiling, -20, 4, -1, Math.PI / 2);
wall(-28, -12, -28, 10);
wall(-28, -12, -12, -12);
wall(-28, 10, -12, 10);
[[-20, -5], [-20, 5]].forEach(([x, z]) => box(3, 0.05, 0.8, M.light, x, 3.97, z));
const labSign = makeLabel('Laboratorio de Redes', 'Manos a la obra', '#22ff88', 3.6);
labSign.position.set(-11.6, 3.35, 3.5);
scene.add(labSign);
const labSignIn = makeLabel('← Volver al SOC', '', '#00e5ff', 2.4);
labSignIn.position.set(-12.4, 3.35, 3.5);
scene.add(labSignIn);

// Rack con LED parpadeantes
const rackLeds = [];
function makeRack(x, z) {
  box(1, 2.4, 0.9, M.frame, x, 1.2, z, true);
  const greens = new THREE.MeshBasicMaterial({ color: 0x22ff88 });
  const ambers = new THREE.MeshBasicMaterial({ color: 0xffc04d });
  for (let u = 0; u < 7; u++) {
    const y = 0.35 + u * 0.3;
    box(0.02, 0.22, 0.86, M.desk, x + 0.51, y, z);
    for (let i = 0; i < 6; i++) {
      const led = box(0.015, 0.035, 0.05, Math.random() < 0.75 ? greens : ambers, x + 0.525, y, z - 0.3 + i * 0.12);
      led.userData.phase = Math.random() * 6;
      led.userData.rate = 1 + Math.random() * 7;
      rackLeds.push(led);
    }
  }
}
makeRack(-27.2, 3);
makeRack(-27.2, 1.6);
makeRack(-27.2, 0.2);

// Rollos de cable sobre la mesa de cableado
[[0x2a7bd8, -18.5], [0xd86a2a, -17.9], [0x35b56a, -17.3]].forEach(([c, x]) => {
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 18), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
  spool.rotation.x = Math.PI / 2;
  spool.position.set(x, 0.95, -2.1);
  scene.add(spool);
});
makePoster(
  [['T568B', 52, '#22ff88'], ['1 Bl-Nar · 2 Nar', 38], ['3 Bl-Ver · 4 Azul', 38], ['5 Bl-Azul · 6 Ver', 38], ['7 Bl-Café · 8 Café', 38]],
  -27.84, 2.1, -6, Math.PI / 2
);
makePoster(
  [['DIAGNÓSTICO', 50, '#ffc04d'], ['1 ¿Enlace físico?', 38], ['2 ¿IP correcta?', 38], ['3 ¿Puerta de enlace?', 38], ['4 ¿Internet? 5 ¿DNS?', 36]],
  -21, 2.1, -11.84, 0
);

// Estaciones
const stationScreens = {};
const STATIONS = {
  redes: [-7, -1],
  phishing: [0, -1],
  siem: [7, -1],
  firewall: [7, -7],
  hunting: [0, -7],
  ir: [-7, -7],
  cableado: [-17.9, -2.5],
  armado: [-24, -2.5],
  completo: [-24, -9],
  diagnostico: [-17.9, -9],
  sandbox: [-20, 7.8],
};
function makeStation(mid, x, z) {
  const m = getMission(mid);
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  box(2, 0.75, 0.9, M.desk, 0, 0.375, 0, false, g);
  box(2.1, 0.05, 1, M.deskTop, 0, 0.77, 0, false, g);
  box(0.6, 0.02, 0.2, M.frame, 0, 0.8, 0.2, false, g);
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x00e5ff, emissiveIntensity: 0.9 });
  [-0.62, 0, 0.62].forEach((ox) => {
    const mon = new THREE.Group();
    mon.position.set(ox, 1.12, -0.28);
    mon.rotation.y = -ox * 0.5;
    box(0.58, 0.38, 0.04, M.frame, 0, 0, 0, false, mon);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.53, 0.33), screenMat);
    scr.position.z = 0.022;
    mon.add(scr);
    box(0.05, 0.3, 0.05, M.frame, 0, -0.2, -0.02, false, mon);
    g.add(mon);
  });
  const lbl = makeLabel(m.short, '', '#00e5ff', 2.4);
  lbl.position.set(0, 2.05, 0);
  g.add(lbl);
  scene.add(g);
  colliders.push({ minX: x - 1.05, maxX: x + 1.05, minZ: z - 0.5, maxZ: z + 0.5 });
  stationScreens[mid] = screenMat;
  labels[mid] = lbl;
  registerInteract(g, mid, { x, z: z + 1.4 });
}
Object.entries(STATIONS).forEach(([mid, [x, z]]) => makeStation(mid, x, z));

// Director + podio
const director = makeNPC(0x1f3b5c);
director.position.set(0, 0, -11.3);
scene.add(director);
const podium = box(1.2, 1.1, 0.6, M.desk, 0, 0.55, -10.5, true);
box(1.25, 0.05, 0.65, M.accent, 0, 1.12, -10.5);
const dirLabel = makeLabel('Director del SOC', 'Examen final', '#ffc04d', 2.4);
dirLabel.position.set(0, 2.4, 0);
director.add(dirLabel);
labels.examen = dirLabel;
registerInteract(director, 'examen', { x: 0, z: -9.3 });
podium.userData.mid = 'examen';
interactables.push({ root: podium, mid: 'examen', stand: { x: 0, z: -9.3 } });
colliders.push({ minX: -0.3, maxX: 0.3, minZ: -11.6, maxZ: -11 });

// ---------- Video wall ----------
const VW_W = 1600;
const VW_H = 420;
const vwC = document.createElement('canvas');
vwC.width = VW_W;
vwC.height = VW_H;
const vg = vwC.getContext('2d');
const vwTex = new THREE.CanvasTexture(vwC);
vwTex.colorSpace = THREE.SRGBColorSpace;
const vw = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.4), new THREE.MeshBasicMaterial({ map: vwTex }));
vw.position.set(0, 2.15, -13.82);
scene.add(vw);
box(13.3, 3.7, 0.1, M.frame, 0, 2.15, -13.9);

const mapNodes = Array.from({ length: 46 }, () => ({ x: 50 + Math.random() * 880, y: 90 + Math.random() * 290 }));
const HQ = { x: 560, y: 250 };
const attacks = [];
const feed = [];
const counters = { blocked: 12840, alerts: 37, incidents: 2 };
const ALERTS = [
  ['Fuerza bruta SSH', 'ALTA'], ['Phishing en correo', 'MEDIA'], ['Escaneo de puertos', 'BAJA'],
  ['Beacon C2 detectado', 'CRÍTICA'], ['Intento de SQL Injection', 'ALTA'], ['Pico de tráfico DDoS', 'ALTA'],
  ['Login desde país inusual', 'MEDIA'], ['Ransomware bloqueado', 'CRÍTICA'], ['Macro maliciosa .docm', 'MEDIA'],
];
const SEVCOL = { BAJA: '#4dd0ff', MEDIA: '#ffc04d', ALTA: '#ff7a3d', CRÍTICA: '#ff3b5c' };
let spawnAcc = 0;

function drawWall(dt, t) {
  spawnAcc += dt;
  if (spawnAcc > 0.7) {
    spawnAcc = 0;
    const a = ALERTS[rnd(0, ALERTS.length - 1)];
    attacks.push({ from: mapNodes[rnd(0, mapNodes.length - 1)], t: 0, col: SEVCOL[a[1]] });
    feed.unshift({
      time: new Date().toLocaleTimeString('es-CO', { hour12: false }),
      txt: a[0],
      sev: a[1],
      ip: `${rnd(1, 223)}.${rnd(0, 255)}.${rnd(0, 255)}.${rnd(1, 254)}`,
    });
    if (feed.length > 8) feed.length = 8;
    counters.blocked += rnd(1, 5);
    if (Math.random() < 0.3) counters.alerts++;
  }
  const g = vg;
  g.fillStyle = '#030914';
  g.fillRect(0, 0, VW_W, VW_H);
  g.textAlign = 'left';
  g.fillStyle = '#00e5ff';
  g.font = 'bold 30px "Segoe UI", sans-serif';
  g.fillText('CYBERCORP SOC · MONITOREO 24/7', 30, 44);
  g.textAlign = 'right';
  g.fillStyle = '#22ff88';
  g.font = '22px Consolas, monospace';
  g.fillText('● EN VIVO  ' + new Date().toLocaleTimeString('es-CO', { hour12: false }), VW_W - 30, 44);

  // Panel mapa
  g.strokeStyle = 'rgba(0,229,255,0.3)';
  g.lineWidth = 2;
  g.strokeRect(20, 64, 960, 336);
  g.strokeStyle = 'rgba(0,229,255,0.07)';
  for (let x = 20; x < 980; x += 40) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x, 400); g.stroke(); }
  for (let y = 64; y < 400; y += 40) { g.beginPath(); g.moveTo(20, y); g.lineTo(980, y); g.stroke(); }
  g.fillStyle = 'rgba(120,170,255,0.45)';
  mapNodes.forEach((n) => { g.beginPath(); g.arc(n.x, n.y, 3, 0, Math.PI * 2); g.fill(); });
  const pr = 10 + Math.sin(t * 4) * 4;
  g.fillStyle = '#22ff88';
  g.beginPath(); g.arc(HQ.x, HQ.y, 7, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(34,255,136,0.6)';
  g.beginPath(); g.arc(HQ.x, HQ.y, pr + 6, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#22ff88';
  g.textAlign = 'left';
  g.font = '16px Consolas, monospace';
  g.fillText('HQ CyberCorp', HQ.x + 16, HQ.y + 5);

  for (let i = attacks.length - 1; i >= 0; i--) {
    const a = attacks[i];
    a.t += dt * 0.55;
    const cx = (a.from.x + HQ.x) / 2;
    const cy = Math.min(a.from.y, HQ.y) - 90;
    g.strokeStyle = a.col;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(a.from.x, a.from.y);
    const end = Math.min(a.t, 1);
    for (let s = 0; s <= end; s += 0.03) {
      const x = (1 - s) * (1 - s) * a.from.x + 2 * (1 - s) * s * cx + s * s * HQ.x;
      const y = (1 - s) * (1 - s) * a.from.y + 2 * (1 - s) * s * cy + s * s * HQ.y;
      g.lineTo(x, y);
    }
    g.stroke();
    if (a.t >= 1) {
      g.strokeStyle = a.col;
      g.beginPath();
      g.arc(HQ.x, HQ.y, (a.t - 1) * 120, 0, Math.PI * 2);
      g.stroke();
    }
    if (a.t > 1.3) attacks.splice(i, 1);
  }

  // Feed de alertas
  g.strokeStyle = 'rgba(0,229,255,0.3)';
  g.strokeRect(1000, 64, 580, 250);
  g.fillStyle = '#8494b3';
  g.font = '18px "Segoe UI", sans-serif';
  g.fillText('ALERTAS EN TIEMPO REAL', 1016, 92);
  feed.forEach((f, i) => {
    const y = 124 + i * 23;
    g.font = '17px Consolas, monospace';
    g.fillStyle = '#8494b3';
    g.fillText(f.time, 1016, y);
    g.fillStyle = SEVCOL[f.sev];
    g.fillText(f.sev.padEnd(8), 1110, y);
    g.fillStyle = '#dce8ff';
    g.fillText(f.txt, 1210, y);
    g.fillStyle = '#5c6b88';
    g.textAlign = 'right';
    g.fillText(f.ip, 1568, y);
    g.textAlign = 'left';
  });

  // Contadores
  const tiles = [
    ['BLOQUEADOS HOY', counters.blocked.toLocaleString('es-CO'), '#22ff88'],
    ['ALERTAS ABIERTAS', counters.alerts, '#ffc04d'],
    ['INCIDENTES', counters.incidents, '#ff3b5c'],
  ];
  tiles.forEach(([lab, val, col], i) => {
    const x = 1000 + i * 197;
    g.strokeStyle = 'rgba(0,229,255,0.3)';
    g.strokeRect(x, 326, 186, 74);
    g.fillStyle = '#8494b3';
    g.font = '14px "Segoe UI", sans-serif';
    g.fillText(lab, x + 12, 348);
    g.fillStyle = col;
    g.font = 'bold 32px Consolas, monospace';
    g.fillText(String(val), x + 12, 388);
  });
  vwTex.needsUpdate = true;
}

// ---------- Baliza de objetivo ----------
const beacon = new THREE.Group();
const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 40), ringMat);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.03;
beacon.add(ring);
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.04, 0.04, 3, 8, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.25 })
);
beam.position.y = 1.5;
beacon.add(beam);
scene.add(beacon);

// ================================================================
//  Sincronizar mundo + HUD con el progreso
// ================================================================
function refreshWorld() {
  // Puerta
  if (isDone('induccion')) {
    doorTargetY = 4.6;
    doorCol.disabled = true;
    doorStripMat.color.set(0x22ff88);
    doorSign.userData.draw('SOC', 'Acceso autorizado', '#22ff88');
  }
  // Estaciones y etiquetas
  ALL_STATIONS.forEach((m) => {
    const lbl = labels[m.id];
    const scr = stationScreens[m.id];
    if (isDone(m.id)) {
      lbl?.userData.draw(m.short, 'COMPLETADA', '#22ff88');
      scr?.emissive.set(0x22ff88);
      if (scr) scr.emissiveIntensity = 0.7;
    } else if (isUnlocked(m.id)) {
      lbl?.userData.draw(m.short, isExtra(m.id) ? 'SIEMPRE ABIERTO · [E]' : 'DISPONIBLE · [E]', isExtra(m.id) ? '#22ff88' : '#00e5ff');
      scr?.emissive.set(0x00e5ff);
      if (scr) scr.emissiveIntensity = 1.1;
    } else {
      lbl?.userData.draw(m.short, 'BLOQUEADA', '#ff3b5c');
      scr?.emissive.set(0xff2244);
      if (scr) scr.emissiveIntensity = 0.25;
    }
  });
  // Baliza
  const n = nextMission();
  const it = n && interactables.find((i) => i.mid === n.id);
  beacon.visible = !!it;
  if (it) beacon.position.set(it.stand.x, 0, it.stand.z);
  refreshHUD();
}

function refreshHUD() {
  $('#hud-name').textContent = state.name || 'Estudiante';
  $('#hud-rank').textContent = rankFor(state.done.length);
  $('#xp-fill').style.width = Math.round((state.xp / TOTAL_XP) * 100) + '%';
  $('#hud-xp').textContent = `${state.xp} / ${TOTAL_XP} XP`;
  const n = nextMission();
  $('#hud-objective').textContent = n ? n.objective : '¡Formación completa! Habla con el Director para ver tu certificado.';
  $('#hud-steps').innerHTML = MISSIONS.map(
    (m) => `<span class="${isDone(m.id) ? 'done' : n && n.id === m.id ? 'current' : ''}" title="${m.title}"></span>`
  ).join('');
}

function toast(msg) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.innerHTML = msg;
  $('#toasts').appendChild(d);
  setTimeout(() => d.classList.add('out'), 4500);
  setTimeout(() => d.remove(), 5100);
}

// ================================================================
//  Controles (pointer lock + teclado)
// ================================================================
const keys = {};
let locked = false;
let started = false;
let modalOpen = false;
let certOpen = false;

function lock() {
  if (!started || modalOpen || certOpen) return;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch { /* navegador sin soporte */ }
}
function unlock() {
  if (document.pointerLockElement) document.exitPointerLock();
}
function updatePause() {
  $('#pause').classList.toggle('hidden', locked || !started || modalOpen || certOpen);
}

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  for (const k in keys) keys[k] = false;
  updatePause();
});
canvas.addEventListener('click', lock);
$('#pause').addEventListener('click', lock);

document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  yaw -= e.movementX * 0.0022;
  pitch -= e.movementY * 0.0022;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
});

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyE' && locked) tryInteract();
  if (e.code === 'Escape' && modalOpen) closeModal();
  // Música: no se activa mientras se escribe en un campo de texto.
  if (!/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
    if (e.code === 'KeyM') {
      audio.start();
      audio.toggleMusic();
      toast(audio.prefs.music ? `🎵 Música: <b>${audio.label()}</b>` : '🔇 Música silenciada');
    }
    if (e.code === 'KeyN') {
      audio.start();
      audio.nextTrack();
      toast(`🎵 ${audio.prefs.track === 'auto' ? 'Auto según la sala' : audio.label()}`);
    }
  }
});
window.addEventListener('keyup', (e) => (keys[e.code] = false));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Raycast de interacción ----------
const ray = new THREE.Raycaster();
ray.far = 3.4;
const center = new THREE.Vector2(0, 0);
const interactRoots = interactables.map((i) => i.root);
let focused = null;
let lastPromptKey = '';

function updatePrompt() {
  focused = null;
  if (locked) {
    ray.setFromCamera(center, camera);
    const hit = ray.intersectObjects(interactRoots, true)[0];
    if (hit) focused = hit.object.userData.mid || null;
  }
  const key = focused ? focused + (isUnlocked(focused) ? 'u' : 'l') + (isDone(focused) ? 'd' : '') : '';
  if (key === lastPromptKey) return;
  lastPromptKey = key;
  const p = $('#prompt');
  if (!focused) {
    p.className = 'hidden';
    return;
  }
  const m = getMission(focused);
  if (!isUnlocked(focused)) {
    const prev = isExtra(focused) ? getMission('induccion') : MISSIONS[missionIndex(focused) - 1];
    p.className = 'locked';
    p.innerHTML = `🔒 <b>${m.station}</b> — primero completa: ${prev.title}`;
  } else {
    p.className = '';
    p.innerHTML = `<kbd>E</kbd> ${m.action} · <b>${m.station}</b>${isDone(focused) && !isExtra(focused) ? ' <span class="done">✔ completada (modo práctica)</span>' : ''}`;
  }
}

function tryInteract() {
  if (!focused || modalOpen) return;
  if (!isUnlocked(focused)) {
    toast('🔒 Esta estación aún está bloqueada.');
    return;
  }
  openMission(focused);
}

// ================================================================
//  Modal de misión
// ================================================================
function openMission(id) {
  const m = getMission(id);
  modalOpen = true;
  unlock();
  updatePause();
  audio.setFocus(true);
  audio.sfx('click');
  document.querySelector('.modal-panel').classList.toggle('wide', !!m.wide);
  $('#modal-station').textContent = `${m.code} · ${m.station}`;
  $('#modal-title').textContent = m.title;
  const body = $('#modal-body');
  const certBtn = id === 'examen' && isDone('examen') ? '<button class="btn ghost" id="btn-see-cert">Ver mi certificado</button>' : '';
  body.innerHTML = `
    <div class="brief">
      <p>${m.brief}</p>
      <ul class="learn">${m.learn.map((l) => `<li>${l}</li>`).join('')}</ul>
      ${m.xp ? `<div class="reward">Recompensa: <b>+${m.xp} XP</b>${isDone(id) ? ' (ya obtenida · modo práctica)' : ''}</div>` : '<div class="reward">Práctica libre: no afecta tu XP.</div>'}
      <div class="row"><button class="btn primary" id="btn-begin">Comenzar</button>${certBtn}</div>
    </div>`;
  $('#modal').classList.remove('hidden');
  $('#btn-begin').addEventListener('click', () => {
    body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'mission';
    body.appendChild(wrap);
    m.render(wrap, { complete: (score) => completeMission(m, score), toast });
  });
  $('#btn-see-cert')?.addEventListener('click', () => {
    closeModal();
    showCert();
  });
}

function completeMission(m, score = 100) {
  const first = !isDone(m.id);
  if (first) {
    state.done.push(m.id);
    state.xp += m.xp;
  }
  if (m.id === 'examen') {
    state.examScore = Math.max(state.examScore || 0, score);
    if (!state.certId) state.certId = 'CVR-' + Date.now().toString(36).toUpperCase().slice(-6) + '-' + rnd(100, 999);
    if (!state.certDate) state.certDate = new Date().toISOString();
  }
  saveState();
  refreshWorld();
  audio.sfx(m.id === 'induccion' && first ? 'door' : 'win');
  if (first && m.unlockMsg) toast(m.unlockMsg);
  if (first) toast(`⭐ +${m.xp} XP · Rango: <b>${rankFor(state.done.length)}</b>`);

  const n = nextMission();
  $('#modal-body').innerHTML = `
    <div class="success">
      <div class="big-check">✔</div>
      <h3>Misión completada${m.id === 'examen' ? ` · ${score}%` : ''}</h3>
      <p class="explain">${m.debrief}</p>
      ${first ? `<p class="xp-gain">+${m.xp} XP</p>` : '<p class="explain">Práctica completada (sin XP extra).</p>'}
      <p>Rango actual: <b>${rankFor(state.done.length)}</b></p>
      ${n ? `<p class="next">Siguiente: ${n.objective}</p>` : ''}
      <button class="btn primary" id="btn-continue">${m.id === 'examen' ? 'Ver mi certificado' : 'Volver al SOC'}</button>
    </div>`;
  $('#btn-continue').addEventListener('click', () => {
    closeModal();
    if (m.id === 'examen') showCert();
    else lock();
  });
}

function closeModal() {
  modalOpen = false;
  audio.setFocus(false);
  $('#modal').classList.add('hidden');
  updatePause();
}
$('#modal-close').addEventListener('click', () => {
  closeModal();
  lock();
});

// ================================================================
//  Certificado
// ================================================================
function showCert() {
  certOpen = true;
  unlock();
  updatePause();
  $('#cert-name').textContent = state.name || 'Estudiante';
  $('#cert-score').textContent = (state.examScore || 0) + '%';
  $('#cert-date').textContent = new Date(state.certDate || Date.now()).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  $('#cert-id').textContent = state.certId || '—';
  $('#cert-modules').innerHTML = MISSIONS.filter((m) => m.id !== 'examen').map((m) => `<span>${m.title}</span>`).join('');
  $('#cert').classList.remove('hidden');
}
$('#btn-print').addEventListener('click', () => window.print());
$('#btn-cert-close').addEventListener('click', () => {
  certOpen = false;
  $('#cert').classList.add('hidden');
  updatePause();
  lock();
});

// ================================================================
//  Pantalla inicial
// ================================================================
const nameInput = $('#player-name');
nameInput.value = state.name || '';
if (state.done.length) $('#btn-start').textContent = `Continuar formación (${state.done.length}/${MISSIONS.length})`;

mountAudioWidget($('#audio-widget'));
// El navegador solo permite iniciar audio tras un gesto del usuario.
window.addEventListener('pointerdown', () => audio.start(), { once: true });

$('#btn-start').addEventListener('click', () => {
  audio.start();
  const n = nameInput.value.trim();
  if (!n) {
    nameInput.classList.remove('error');
    void nameInput.offsetWidth;
    nameInput.classList.add('error');
    nameInput.focus();
    return;
  }
  state.name = n;
  saveState();
  started = true;
  $('#intro').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  const fade = $('#vr-fade');
  fade.classList.remove('on');
  void fade.offsetWidth;
  fade.classList.add('on');
  refreshWorld();
  lock();
  setTimeout(() => {
    if (!state.done.length) toast(`👋 Bienvenido/a a CyberCorp, <b>${state.name}</b>. Habla con Laura, la mentora, en la recepción.`);
    else toast(`Bienvenido/a de nuevo, <b>${state.name}</b>. Sigue la baliza azul.`);
  }, 900);
});
nameInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') $('#btn-start').click();
});

let resetArmed = false;
$('#btn-reset').addEventListener('click', (e) => {
  if (!resetArmed) {
    resetArmed = true;
    e.target.textContent = '¿Seguro? Clic otra vez';
    setTimeout(() => {
      resetArmed = false;
      e.target.textContent = 'Reiniciar progreso';
    }, 3000);
    return;
  }
  state = defaultState();
  saveState();
  Object.keys(localStorage).filter((k) => k.startsWith('cybervr-lab-') || k.startsWith('cybervr-sbx-')).forEach((k) => localStorage.removeItem(k));
  location.reload();
});

// ================================================================
//  Bucle principal
// ================================================================
const clock = new THREE.Clock();
let bobT = 0;
let wallAcc = 0;
let renderAcc = 0;
const npcs = [mentor, director];

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (locked) {
    const speed = keys.ShiftLeft || keys.ShiftRight ? 6 : 3.4;
    let f = 0;
    let s = 0;
    if (keys.KeyW || keys.ArrowUp) f += 1;
    if (keys.KeyS || keys.ArrowDown) f -= 1;
    if (keys.KeyD || keys.ArrowRight) s += 1;
    if (keys.KeyA || keys.ArrowLeft) s -= 1;
    if (f || s) {
      const len = Math.hypot(f, s);
      f /= len;
      s /= len;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const dx = (-sin * f + cos * s) * speed * dt;
      const dz = (-cos * f - sin * s) * speed * dt;
      const nx = camera.position.x + dx;
      if (!blocked(nx, camera.position.z)) camera.position.x = nx;
      const nz = camera.position.z + dz;
      if (!blocked(camera.position.x, nz)) camera.position.z = nz;
      bobT += dt * speed * 2.2;
    }
  }
  camera.position.y = PLAYER_H + Math.sin(bobT) * 0.035;
  camera.rotation.set(pitch, yaw, 0);

  // Puerta
  doorMesh.position.y += (doorTargetY - doorMesh.position.y) * Math.min(1, dt * 2);

  // NPCs miran al jugador
  npcs.forEach((n, i) => {
    n.rotation.y = Math.atan2(camera.position.x - n.position.x, camera.position.z - n.position.z);
    n.children[1].scale.y = 1 + Math.sin(t * 2 + i) * 0.015;
  });

  // Música según la sala
  audio.setZone(camera.position.x < -12 ? 'lab' : camera.position.z > 10 ? 'lobby' : 'soc');

  // LED de los racks
  for (const led of rackLeds) led.visible = Math.sin(t * led.userData.rate + led.userData.phase) > -0.35;

  // Baliza
  ring.scale.setScalar(1 + Math.sin(t * 3) * 0.15);
  ringMat.opacity = 0.55 + Math.sin(t * 3) * 0.3;

  // Video wall (10 fps)
  wallAcc += dt;
  if (wallAcc > 0.1) {
    drawWall(wallAcc, t);
    wallAcc = 0;
  }

  updatePrompt();
  // Con un laboratorio abierto el 3D es solo fondo: 10 fps bastan y la interfaz responde mejor.
  renderAcc += dt;
  if (modalOpen && renderAcc < 0.1) return;
  renderAcc = 0;
  renderer.render(scene, camera);
}

refreshWorld();
renderer.setAnimationLoop(animate);