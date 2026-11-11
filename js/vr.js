// ================================================================
//  CyberVR SOC · Soporte WebXR (gafas VR / Immersive Web Emulator)
// ================================================================
//  - Entra y sale de la sesión immersive-vr.
//  - Controles: stick izquierdo = caminar, stick derecho = giro por pasos,
//    grip o botón A/X = correr, gatillo = interactuar.
//  - Rayo láser desde el control derecho (o el que se haya usado).
//  - Paneles 3D pegados a la vista para el aviso de interacción y los toasts,
//    porque el DOM no se ve dentro de las gafas.
// ================================================================
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const RAY_LEN = 3.4;
const SNAP_ANGLE = Math.PI / 6; // 30°
const DEADZONE = 0.2;

export function createVR({ renderer, camera, rig, blocked, onSelect, onStart, onEnd }) {
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');

  let supported = false;
  let session = null;
  let activeCtrl = null;
  let turnArmed = true;

  // ---------- Controles ----------
  const modelFactory = new XRControllerModelFactory();
  const rayMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85 });
  const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);

  const controllers = [0, 1].map((i) => {
    const ctrl = renderer.xr.getController(i);
    ctrl.userData.handedness = '';
    ctrl.addEventListener('connected', (e) => {
      ctrl.userData.handedness = e.data.handedness;
      if (!activeCtrl || e.data.handedness === 'right') activeCtrl = ctrl;
    });
    ctrl.addEventListener('disconnected', () => {
      ctrl.userData.handedness = '';
      if (activeCtrl === ctrl) activeCtrl = controllers.find((c) => c !== ctrl && c.userData.handedness) || null;
    });
    ctrl.addEventListener('selectstart', () => {
      activeCtrl = ctrl;
      onSelect?.();
    });
    const line = new THREE.Line(rayGeo, rayMat);
    line.scale.z = RAY_LEN;
    ctrl.userData.line = line;
    ctrl.add(line);
    rig.add(ctrl);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(modelFactory.createControllerModel(grip));
    rig.add(grip);
    return ctrl;
  });

  // ---------- Paneles 3D (aviso + toast) ----------
  function wrap(g, text, maxW) {
    const words = text.split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (g.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 3);
  }

  function makePanel(w, h, y) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = Math.round(1024 * (h / w));
    const g = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false })
    );
    mesh.renderOrder = 999;
    mesh.position.set(0, y, -1.2);
    mesh.visible = false;
    let last = '';
    mesh.userData.draw = (text, color = '#00e5ff') => {
      const key = text + color;
      if (key === last) return;
      last = key;
      mesh.visible = !!text;
      if (!text) return;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(4,10,20,0.88)';
      g.strokeStyle = color;
      g.lineWidth = 6;
      g.beginPath();
      g.roundRect(4, 4, c.width - 8, c.height - 8, 28);
      g.fill();
      g.stroke();
      g.fillStyle = '#e6f6ff';
      g.font = '600 46px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const lines = wrap(g, text, c.width - 80);
      const lh = 56;
      const y0 = c.height / 2 - ((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => g.fillText(l, c.width / 2, y0 + i * lh));
      tex.needsUpdate = true;
    };
    camera.add(mesh);
    return mesh;
  }

  const promptPanel = makePanel(0.9, 0.2, -0.32);
  const toastPanel = makePanel(0.9, 0.2, 0.3);
  let toastTimer = 0;

  const clean = (html) =>
    String(html)
      .replace(/<kbd>E<\/kbd>/g, '[Gatillo]')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // ---------- Botón "Entrar en VR" ----------
  const btn = document.createElement('button');
  btn.textContent = '🥽 Entrar en VR';
  btn.className = 'btn primary';
  Object.assign(btn.style, {
    position: 'fixed', right: '20px', bottom: '20px', zIndex: '60', display: 'none',
  });
  btn.addEventListener('click', () => enter());
  document.body.appendChild(btn);

  if (navigator.xr?.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
      supported = ok;
      api.refreshButton();
    }).catch(() => {});
  }

  // ---------- Sesión ----------
  async function enter() {
    if (!supported || session) return;
    try {
      const s = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor'],
      });
      session = s;
      s.addEventListener('end', handleEnd);
      await renderer.xr.setSession(s);
      onStart?.();
      api.refreshButton();
    } catch (err) {
      console.warn('[VR] No se pudo iniciar la sesión:', err);
      session = null;
    }
  }

  function exit() {
    session?.end();
  }

  function handleEnd() {
    session = null;
    promptPanel.userData.draw('');
    toastPanel.userData.draw('');
    onEnd?.();
    api.refreshButton();
  }

  // ---------- Locomoción ----------
  const v = new THREE.Vector3();
  const head = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function readSticks() {
    const out = { mx: 0, my: 0, turn: 0, run: false };
    if (!session) return out;
    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (!gp) continue;
      const x = gp.axes[2] ?? gp.axes[0] ?? 0;
      const y = gp.axes[3] ?? gp.axes[1] ?? 0;
      const run = !!(gp.buttons[1]?.pressed || gp.buttons[4]?.pressed); // grip o A/X
      if (src.handedness === 'left') {
        out.mx = x;
        out.my = y;
        out.run ||= run;
      } else {
        out.turn = x;
        out.run ||= run;
      }
    }
    return out;
  }

  function update(dt) {
    if (!session) return;
    const { mx, my, turn, run } = readSticks();

    // Caminar en la dirección hacia donde mira la cabeza
    if (Math.hypot(mx, my) > DEADZONE) {
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      const rx = -fwd.z;
      const rz = fwd.x;
      const speed = run ? 4.5 : 2.2;
      const dx = (fwd.x * -my + rx * mx) * speed * dt;
      const dz = (fwd.z * -my + rz * mx) * speed * dt;
      camera.getWorldPosition(head);
      if (!blocked(head.x + dx, head.z)) rig.position.x += dx;
      if (!blocked(head.x, head.z + dz)) rig.position.z += dz;
    }

    // Giro por pasos alrededor de la cabeza (evita mareo)
    if (Math.abs(turn) > 0.6 && turnArmed) {
      turnArmed = false;
      const a = turn > 0 ? -SNAP_ANGLE : SNAP_ANGLE;
      camera.getWorldPosition(head);
      v.copy(rig.position).sub(head).applyAxisAngle(UP, a);
      rig.position.copy(head).add(v);
      rig.rotation.y += a;
    } else if (Math.abs(turn) < 0.3) turnArmed = true;

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastPanel.userData.draw('');
    }
  }

  // ---------- Rayo ----------
  const rotM = new THREE.Matrix4();
  function setRaycaster(ray) {
    const c = activeCtrl || controllers[0];
    ray.camera = camera; // los letreros (Sprite) lo necesitan para el raycast
    rotM.identity().extractRotation(c.matrixWorld);
    ray.ray.origin.setFromMatrixPosition(c.matrixWorld);
    ray.ray.direction.set(0, 0, -1).applyMatrix4(rotM);
    controllers.forEach((k) => (k.userData.line.visible = k === c));
  }
  function setRayHit(dist, ok) {
    const c = activeCtrl || controllers[0];
    c.userData.line.scale.z = dist ?? RAY_LEN;
    rayMat.color.set(dist == null ? 0x00e5ff : ok ? 0x22ff88 : 0xff3b5c);
  }

  const api = {
    get presenting() {
      return !!session;
    },
    get supported() {
      return supported;
    },
    enter,
    exit,
    update,
    setRaycaster,
    setRayHit,
    setPrompt(html, locked) {
      if (!session) html = '';
      promptPanel.userData.draw(html ? clean(html) : '', locked ? '#ff3b5c' : '#00e5ff');
    },
    toast(html) {
      if (!session) return;
      toastPanel.userData.draw(clean(html), '#22ff88');
      toastTimer = 4.5;
    },
    // El botón flotante se muestra solo durante el recorrido y fuera de VR.
    showButton: false,
    refreshButton() {
      btn.style.display = supported && api.showButton && !session ? 'block' : 'none';
    },
  };
  return api;
}
