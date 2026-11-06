// ================================================================
//  CyberVR SOC · Laboratorios prácticos de redes
// ================================================================
import { quiz } from './missions.js';
import { audio } from './audio.js';
import {
  createNet, addDevice, addLink, removeLink, removeDevice, portInUse, linkState, setHostIp, setPower,
  saveConfig, ping, resolveName, webGet, dhcpRenew, validateHostAddress, ipToInt, isHost, hostLinkUp,
} from './netsim.js';
import { createShell } from './netcli.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffled = (a) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};
function loadSave(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}
function writeSave(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* sin almacenamiento */ }
}
const dropSave = (key) => {
  try {
    localStorage.removeItem(key);
  } catch { /* sin almacenamiento */ }
};

// ================================================================
//  L1 · Taller de cableado
// ================================================================
const WIRES = {
  wo: { name: 'blanco-naranja', css: 'stripe-o' },
  o: { name: 'naranja', css: 'solid-o' },
  wg: { name: 'blanco-verde', css: 'stripe-g' },
  g: { name: 'verde', css: 'solid-g' },
  wbl: { name: 'blanco-azul', css: 'stripe-bl' },
  bl: { name: 'azul', css: 'solid-bl' },
  wbr: { name: 'blanco-café', css: 'stripe-br' },
  br: { name: 'café', css: 'solid-br' },
};
const T568B = ['wo', 'o', 'wg', 'bl', 'wbl', 'g', 'wbr', 'br'];
const T568A = ['wg', 'g', 'wo', 'bl', 'wbl', 'o', 'wbr', 'br'];
const wireBar = (id, extra = '') => `<span class="wire ${WIRES[id].css} ${extra}" title="${WIRES[id].name}"></span>`;
const refTable = (std, name) => `
  <details class="tip"><summary>📋 Ver tabla ${name}</summary>
    <div class="pin-ref">${std.map((w, i) => `<div><b>${i + 1}</b>${wireBar(w)}<small>${WIRES[w].name}</small></div>`).join('')}</div>
  </details>`;

const Q_CABLE = [
  {
    q: '¿Qué cable usas para conectar un PC a un switch?',
    o: ['Directo (mismo estándar en ambos extremos)', 'Cruzado (T568A en un extremo y T568B en el otro)', 'De consola', 'Coaxial'],
    a: 0,
    e: 'Equipos de distinto tipo (PC ↔ switch, router ↔ switch) usan cable directo. Los del mismo tipo usan cruzado, aunque muchos equipos actuales lo corrigen solos con Auto-MDIX.',
  },
  {
    q: '¿Por qué no debes destrenzar los pares más de lo necesario?',
    o: [
      'Porque el trenzado reduce la diafonía y las interferencias',
      'Porque el cable pierde color',
      'Porque así el conector pesa menos',
      'Porque el trenzado solo es decorativo',
    ],
    a: 0,
    e: 'El trenzado cancela interferencias entre pares. Como referencia, destrenza 13 mm como máximo en Cat5e/Cat6.',
  },
  {
    q: 'El tester muestra continuidad 1-1 hasta 8-8, pero ambos extremos usan un orden inventado. ¿Qué pasa?',
    o: [
      'Hay pares divididos: "pasa" el tester simple, pero fallará con errores y baja velocidad',
      'Funciona perfecto: la continuidad es lo único que importa',
      'Solo sirve para telefonía',
      'El cable se convierte en cruzado',
    ],
    a: 0,
    e: 'Los pines 1-2, 3-6, 4-5 y 7-8 deben ir en un mismo par trenzado. Si no, aparece diafonía aunque la continuidad sea correcta.',
  },
  {
    q: 'Al usar la herramienta de impacto en un patch panel, la cuchilla debe quedar:',
    o: ['Hacia el lado del sobrante del cable', 'Hacia el lado que entra al panel', 'Da igual', 'No se usa cuchilla'],
    a: 0,
    e: 'La cuchilla corta el sobrante. Si la pones al revés cortas el conductor que acabas de conectar.',
  },
];

export function cableLab(el, ctx) {
  const cable = { A: null, B: null, std: 'B', errors: 0 };
  const orient = { A: true, B: true };
  let queue = [];

  const header = (title, body) => `
    <div class="q-progress"><span>Paso ${cursor + 1} / ${queue.length}</span><div class="bar"><div style="width:${((cursor + 1) / queue.length) * 100}%"></div></div></div>
    <h3 class="q-text">${title}</h3><div class="instr">${body}</div>`;

  const seq = () => {
    const end = (e, std, name) => [
      () => orderStep(e, std, name),
      () => trimStep(e),
      () => plugStep(e),
      () => crimpStep(e),
    ];
    return [
      toolsStep,
      stripStep,
      ...end('A', T568B, 'T568B'),
      stripStepB,
      ...end('B', T568B, 'T568B'),
      () => testerStep('direct'),
      crossIntro,
      () => orderStep('B', T568A, 'T568A'),
      () => crimpStep('B'),
      () => testerStep('cross'),
      punchStep,
      finishQuiz,
    ];
  };
  let cursor = 0;
  const next = () => {
    cursor++;
    queue[cursor]();
  };
  const start = () => {
    queue = seq();
    cursor = 0;
    queue[0]();
  };
  // Vuelve a repetir un extremo concreto cuando el tester encuentra un error.
  const redoEnd = (e, std, name, then) => {
    const steps = [() => orderStep(e, std, name), () => trimStep(e), () => plugStep(e), () => crimpStep(e), then];
    let k = 0;
    const realNext = () => {
      k++;
      steps[k]();
    };
    redo.next = realNext;
    steps[0]();
  };
  const redo = { next: null };
  const advance = () => {
    if (redo.next) return redo.next();
    next();
  };

  // ---------- Herramientas ----------
  function toolsStep() {
    const items = shuffled([
      ['🧵', 'Cable UTP Cat6', true],
      ['🔌', 'Conectores RJ45 (x2)', true],
      ['🗜️', 'Ponchadora / crimpadora', true],
      ['✂️', 'Pelacables', true],
      ['📟', 'Tester de cable', true],
      ['📞', 'Conector RJ11 (telefonía)', false],
      ['📺', 'Cable coaxial', false],
      ['🔥', 'Cautín de soldar', false],
    ]);
    const need = items.filter((i) => i[2]).length;
    let got = 0;
    el.innerHTML = header('Prepara tu mesa de trabajo', `Vamos a ponchar un cable de red <b>directo T568B</b>. Selecciona las ${need} herramientas que necesitas.`)
      + `<div class="tool-grid">${items.map((it, k) => `<button class="tool-card" data-k="${k}"><span>${it[0]}</span>${it[1]}</button>`).join('')}</div><p class="explain" id="c-msg"></p>`;
    el.querySelectorAll('.tool-card').forEach((b) => b.addEventListener('click', () => {
      const it = items[+b.dataset.k];
      if (it[2]) {
        if (b.classList.contains('picked')) return;
        b.classList.add('picked');
        audio.sfx('click');
        got++;
        if (got === need) {
          audio.sfx('ok');
          setTimeout(advance, 350);
        }
      } else {
        audio.sfx('error');
        b.classList.add('shake', 'wrong');
        el.querySelector('#c-msg').innerHTML = `<span class="bad">✘ ${it[1]}: no se usa para un cable de datos UTP con RJ45.</span>`;
        setTimeout(() => b.classList.remove('shake'), 400);
      }
    }));
  }

  // ---------- Pelar ----------
  function stripBase(title, body) {
    el.innerHTML = header(title, body) + `
      <div class="bench">
        <div class="utp"><div class="jacket" id="c-jacket"></div><div class="exposed" id="c-exposed"></div></div>
        <label class="slider-label">Longitud a pelar: <b id="c-val">10 mm</b>
          <input type="range" id="c-range" min="5" max="70" value="10"></label>
        <button class="btn primary" id="c-do">✂️ Pelar la chaqueta</button>
        <p class="explain" id="c-msg"></p>
      </div>`;
    const range = el.querySelector('#c-range');
    const paint = () => {
      const v = +range.value;
      el.querySelector('#c-val').textContent = v + ' mm';
      el.querySelector('#c-exposed').style.width = v * 3 + 'px';
    };
    range.addEventListener('input', paint);
    paint();
    el.querySelector('#c-do').addEventListener('click', () => {
      const v = +range.value;
      const msg = el.querySelector('#c-msg');
      if (v < 20) {
        audio.sfx('error');
        msg.innerHTML = '<span class="bad">✘ Muy poco: no te queda cable para ordenar los hilos con comodidad.</span>';
      } else if (v > 40) {
        audio.sfx('error');
        msg.innerHTML = '<span class="bad">✘ Demasiado: quedaría mucho par destrenzado. Corta y vuelve a pelar.</span>';
      } else {
        audio.sfx('crimp');
        advance();
      }
    });
  }
  function stripStep() {
    stripBase('Pela la chaqueta (extremo A)', 'Quita la chaqueta exterior sin cortar los hilos. Déjala un poco larga para trabajar; luego recortarás al largo exacto. <b>Entre 20 y 40 mm</b> está bien.');
  }
  function stripStepB() {
    stripBase('Pela la chaqueta (extremo B)', 'El extremo A quedó listo. Repite en el otro extremo: <b>entre 20 y 40 mm</b>.');
  }

  // ---------- Ordenar ----------
  function orderStep(e, std, name) {
    const pool = shuffled(std);
    const slots = Array(8).fill(null);
    el.innerHTML = header(`Ordena los hilos (extremo ${e} · ${name})`, 'Con el clip hacia abajo y los contactos dorados hacia ti, el <b>pin 1 queda a la izquierda</b>. Toca un hilo para colocarlo en el siguiente pin libre; toca un pin ocupado para sacarlo.')
      + refTable(std, name) + `
      <div class="bench">
        <div class="wire-slots" id="c-slots"></div>
        <div class="wire-pool" id="c-pool"></div>
        <button class="btn primary" id="c-do" disabled>Listo</button>
      </div>`;
    const draw = () => {
      el.querySelector('#c-slots').innerHTML = slots.map((w, i) => `<button class="slot ${w ? 'full' : ''}" data-i="${i}"><b>${i + 1}</b>${w ? wireBar(w) : ''}</button>`).join('');
      el.querySelector('#c-pool').innerHTML = pool.map((w, i) => `<button class="pool-w" data-i="${i}">${wireBar(w)}<small>${WIRES[w].name}</small></button>`).join('');
      el.querySelector('#c-do').disabled = slots.some((x) => !x);
      el.querySelectorAll('.slot').forEach((b) => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        if (!slots[i]) return;
        pool.push(slots[i]);
        slots[i] = null;
        audio.sfx('click');
        draw();
      }));
      el.querySelectorAll('.pool-w').forEach((b) => b.addEventListener('click', () => {
        const free = slots.indexOf(null);
        if (free < 0) return;
        slots[free] = pool.splice(+b.dataset.i, 1)[0];
        audio.sfx('click');
        draw();
      }));
    };
    draw();
    el.querySelector('#c-do').addEventListener('click', () => {
      cable[e] = [...slots];
      advance();
    });
  }

  // ---------- Recortar ----------
  function trimStep(e) {
    el.innerHTML = header(`Recorta los hilos (extremo ${e})`, 'Corta parejo para que los hilos lleguen hasta el fondo del conector y la chaqueta quede <b>dentro</b> del RJ45, apretada por la traba.') + `
      <div class="bench">
        <div class="trim-view"><div class="trim-wires" id="c-tw"></div><div class="trim-mark"></div></div>
        <label class="slider-label">Longitud de los hilos: <b id="c-val">25 mm</b>
          <input type="range" id="c-range" min="5" max="25" value="25"></label>
        <button class="btn primary" id="c-do">✂️ Recortar parejo</button>
        <p class="explain" id="c-msg"></p>
      </div>`;
    const range = el.querySelector('#c-range');
    const paint = () => {
      el.querySelector('#c-val').textContent = range.value + ' mm';
      el.querySelector('#c-tw').style.width = +range.value * 10 + 'px';
    };
    range.addEventListener('input', paint);
    paint();
    el.querySelector('#c-do').addEventListener('click', () => {
      const v = +range.value;
      const msg = el.querySelector('#c-msg');
      if (v > 14) {
        audio.sfx('error');
        msg.innerHTML = '<span class="bad">✘ Muy largo: la chaqueta no entraría al conector, el cable quedaría flojo y destrenzado de más.</span>';
      } else if (v < 11) {
        audio.sfx('error');
        msg.innerHTML = '<span class="bad">✘ Muy corto: los hilos no alcanzarían los contactos dorados. Súbelo a 12-13 mm.</span>';
      } else {
        audio.sfx('crimp');
        advance();
      }
    });
  }

  // ---------- Insertar ----------
  function plugStep(e) {
    el.innerHTML = header(`Inserta en el RJ45 (extremo ${e})`, '¿Cómo debes sostener el conector para que los hilos queden en el orden que armaste (pin 1 a la izquierda)?') + `
      <div class="options">
        <button class="opt" data-v="1">Clip hacia abajo, contactos dorados hacia arriba, mirando hacia mí</button>
        <button class="opt" data-v="0">Clip hacia arriba, contactos dorados hacia abajo</button>
      </div><p class="explain" id="c-msg"></p>`;
    el.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
      // Permite equivocarse: el tester revelará el cable invertido más adelante.
      orient[e] = b.dataset.v === '1';
      audio.sfx('plug');
      advance();
    }));
  }

  // ---------- Ponchar ----------
  function crimpStep(e) {
    el.innerHTML = header(`Poncha el conector (extremo ${e})`, 'Mantén presionada la ponchadora hasta el final: los contactos deben perforar el aislante y la traba debe sujetar la chaqueta. Si sueltas antes, no queda bien.') + `
      <div class="bench center">
        <div class="crimp-meter"><div id="c-fill"></div></div>
        <button class="btn primary crimp-btn" id="c-do">🗜️ Mantén presionado</button>
        <p class="explain" id="c-msg"></p>
      </div>`;
    const btn = el.querySelector('#c-do');
    const fill = el.querySelector('#c-fill');
    let t0 = 0;
    let raf = 0;
    let finished = false;
    const HOLD_MS = 1100;
    const finish = () => {
      finished = true;
      cancelAnimationFrame(raf);
      fill.style.width = '100%';
      audio.sfx('crimp');
      setTimeout(advance, 280);
    };
    const loop = () => {
      const p = Math.min(1, (performance.now() - t0) / HOLD_MS);
      fill.style.width = p * 100 + '%';
      if (p >= 1) return finish();
      raf = requestAnimationFrame(loop);
    };
    btn.addEventListener('pointerdown', () => {
      if (finished) return;
      t0 = performance.now();
      raf = requestAnimationFrame(loop);
    });
    const release = () => {
      if (finished || !t0) return;
      // Se mide por tiempo real: en equipos lentos la animación puede ir atrasada.
      if (performance.now() - t0 >= HOLD_MS) return finish();
      cancelAnimationFrame(raf);
      t0 = 0;
      fill.style.width = '0';
      audio.sfx('error');
      el.querySelector('#c-msg').innerHTML = '<span class="bad">✘ Soltaste antes de tiempo: los contactos no perforaron todos los hilos. Inténtalo otra vez.</span>';
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
  }

  // ---------- Tester ----------
  function evaluate(mode) {
    const a = orient.A ? cable.A : [...cable.A].reverse();
    const b = orient.B ? cable.B : [...cable.B].reverse();
    const map = a.map((w) => b.indexOf(w) + 1);
    if (mode === 'direct') {
      const issues = [];
      if (!orient.A || !orient.B) issues.push('Un conector se insertó al revés: el orden quedó invertido.');
      if (cable.A.join() !== T568B.join()) issues.push('El extremo A no sigue T568B.');
      if (cable.B.join() !== T568B.join()) issues.push('El extremo B no sigue T568B.');
      return { map, ok: !issues.length, issues, expect: [1, 2, 3, 4, 5, 6, 7, 8] };
    }
    const issues = [];
    if (cable.B.join() !== T568A.join()) issues.push('El extremo B no sigue T568A.');
    return { map, ok: !issues.length, issues, expect: [3, 6, 1, 4, 5, 2, 7, 8] };
  }
  function testerStep(mode) {
    const res = evaluate(mode);
    const isCross = mode === 'cross';
    el.innerHTML = header(`Prueba con el tester · cable ${isCross ? 'cruzado' : 'directo'}`, 'Conecta los dos extremos al tester y observa cómo se encienden los LED, pin por pin.') + `
      <div class="tester">
        <div class="tester-row"><span>PRINCIPAL</span>${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<i id="m${n}">${n}</i>`).join('')}</div>
        <div class="tester-row"><span>REMOTO</span>${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<i id="r${n}">${n}</i>`).join('')}</div>
      </div>
      <div id="c-res" class="explain"></div>`;
    let n = 0;
    const tick = () => {
      if (!el.isConnected) return;
      el.querySelectorAll('.tester i').forEach((x) => x.classList.remove('on', 'badled'));
      if (n >= 8) return done();
      const m = el.querySelector('#m' + (n + 1));
      const r = el.querySelector('#r' + res.map[n]);
      const good = res.map[n] === res.expect[n];
      m?.classList.add('on');
      r?.classList.add(good ? 'on' : 'badled');
      audio.sfx(good ? 'click' : 'error');
      n++;
      setTimeout(tick, 280);
    };
    const done = () => {
      const box = el.querySelector('#c-res');
      if (res.ok) {
        audio.sfx('ok');
        box.innerHTML = `<p class="good">✔ Cable ${isCross ? 'cruzado: 1→3, 2→6, 3→1, 6→2, los demás directos' : 'directo: 1→1 hasta 8→8'}. ¡Perfecto!</p><button class="btn primary" id="c-do">Continuar →</button>`;
        box.querySelector('#c-do').addEventListener('click', advance);
        return;
      }
      cable.errors++;
      audio.sfx('error');
      box.innerHTML = `<p class="bad">✘ El cable falla. En una instalación real lo cortas y vuelves a ponchar.</p>
        <ul class="hints">${res.issues.map((x) => `<li>${x}</li>`).join('')}</ul>
        <button class="btn primary" id="c-do">✂️ Cortar y repetir el conector</button>`;
      box.querySelector('#c-do').addEventListener('click', () => {
        const std = isCross ? T568A : T568B;
        const name = isCross ? 'T568A' : 'T568B';
        const aBad = !isCross && (cable.A.join() !== T568B.join() || !orient.A);
        const e = aBad ? 'A' : 'B';
        const back = () => {
          redo.next = null;
          testerStep(mode);
        };
        redoEnd(e, std, name, back);
      });
    };
    setTimeout(tick, 300);
  }

  // ---------- Cable cruzado ----------
  function crossIntro() {
    el.innerHTML = header('Ahora: un cable cruzado', 'Debes enlazar dos switches antiguos sin Auto-MDIX, y para eso se usa un cable <b>cruzado</b>. El extremo A se queda en T568B: corta el extremo B y ponle <b>T568A</b>.') + `
      <button class="btn primary" id="c-do">✂️ Cortar el extremo B</button>`;
    el.querySelector('#c-do').addEventListener('click', () => {
      audio.sfx('crimp');
      advance();
    });
  }

  // ---------- Patch panel ----------
  function punchStep() {
    const order = T568B;
    const placed = Array(8).fill(false);
    let held = null;
    el.innerHTML = header('Poncha en el patch panel', 'El cable que viene de la pared termina en un patch panel. Toma un hilo y llévalo a la posición de su color: la <b>herramienta de impacto 110</b> lo fija y corta el sobrante.') + `
      <div class="bench">
        <div class="wire-slots idc" id="c-slots"></div>
        <div class="wire-pool" id="c-pool"></div>
        <p class="explain" id="c-msg">Selecciona un hilo.</p>
      </div>`;
    const pool = shuffled(order);
    const draw = () => {
      el.querySelector('#c-slots').innerHTML = order.map((w, i) => `<button class="slot idc-slot ${placed[i] ? 'full' : ''}" data-i="${i}"><b>${i + 1}</b><span class="idc-label ${WIRES[w].css}"></span>${placed[i] ? wireBar(w) : ''}</button>`).join('');
      el.querySelector('#c-pool').innerHTML = pool.map((w) => `<button class="pool-w ${held === w ? 'held' : ''}" data-w="${w}">${wireBar(w)}<small>${WIRES[w].name}</small></button>`).join('');
      el.querySelectorAll('.pool-w').forEach((b) => b.addEventListener('click', () => {
        held = b.dataset.w;
        audio.sfx('click');
        draw();
      }));
      el.querySelectorAll('.idc-slot').forEach((b) => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        const msg = el.querySelector('#c-msg');
        if (!held || placed[i]) return;
        if (order[i] !== held) {
          audio.sfx('error');
          msg.innerHTML = `<span class="bad">✘ La posición ${i + 1} tiene etiqueta ${WIRES[order[i]].name}, y llevas el hilo ${WIRES[held].name}.</span>`;
          return;
        }
        placed[i] = true;
        pool.splice(pool.indexOf(held), 1);
        held = null;
        audio.sfx('punch');
        msg.textContent = `Hilo fijado en la posición ${i + 1}.`;
        draw();
        if (placed.every(Boolean)) {
          audio.sfx('ok');
          msg.innerHTML = '<span class="good">✔ Patch panel terminado. Prueba de continuidad correcta.</span>';
          setTimeout(advance, 800);
        }
      }));
    };
    draw();
  }

  function finishQuiz() {
    el.innerHTML = '';
    quiz(Q_CABLE, { pass: 0.75, title: 'Cierre del taller' })(el, ctx);
  }

  start();
}

// ================================================================
//  Mesa de trabajo: topología + consola + objetivos
// ================================================================
const ICONS = { pc: '🖥️', server: '🗄️', printer: '🖨️', switch: '🔀', router: '📡', isp: '☁️' };
const TYPE_LABEL = { pc: 'PC', server: 'Servidor', printer: 'Impresora', switch: 'Switch', router: 'Router', isp: 'ISP / Internet' };
const CABLES = {
  straight: { name: 'Directo', icon: '➖' },
  cross: { name: 'Cruzado', icon: '✖️' },
  console: { name: 'Consola', icon: '🟦' },
};
const STATE_TEXT = {
  up: 'Enlace activo',
  admin: 'Puerto apagado o sin activar',
  power: 'Un equipo está apagado',
  cable: 'Tipo de cable incorrecto',
  fault: 'Cable dañado',
  console: 'Cable de consola conectado',
};

function workbench(el, opts) {
  const net = opts.net;
  const terms = {};
  let selected = opts.initialDevice && net.devices[opts.initialDevice] ? opts.initialDevice : null;
  let tab = 'term';
  let tool = 'select';
  let pending = null; // primer extremo del cable que se está tendiendo
  let allDoneFired = false;

  el.innerHTML = `
    <div class="wb">
      <div class="wb-left">
        <div class="wb-tools">
          <button data-tool="select" class="tool-btn">🖱️ Seleccionar</button>
          ${Object.entries(CABLES).map(([k, c]) => `<button data-tool="${k}" class="tool-btn">${c.icon} ${c.name}</button>`).join('')}
          <button data-tool="remove" class="tool-btn">✂️ Quitar cable</button>
          <span class="wb-spacer"></span>
          ${opts.extraTools || ''}
        </div>
        ${opts.editable ? `<div class="wb-tools add-tools"><span class="muted">Agregar:</span>${Object.entries(TYPE_LABEL).map(([k, v]) => `<button class="tool-btn" data-add="${k}">${ICONS[k]} ${v}</button>`).join('')}
          <label class="mdix"><input type="checkbox" id="wb-mdix" ${net.autoMdix ? 'checked' : ''}> Auto-MDIX</label></div>` : ''}
        <div class="wb-topo" id="wb-topo">
          <svg id="wb-svg" viewBox="0 0 800 440" preserveAspectRatio="xMidYMid meet"></svg>
          <div id="wb-pop" class="wb-pop hidden"></div>
          <div id="wb-note" class="wb-note"></div>
        </div>
        ${opts.objectives ? '<div class="wb-obj" id="wb-obj"></div>' : ''}
      </div>
      <div class="wb-right" id="wb-right"></div>
    </div>`;

  const svg = el.querySelector('#wb-svg');
  const pop = el.querySelector('#wb-pop');
  const note = el.querySelector('#wb-note');
  const right = el.querySelector('#wb-right');

  const say = (msg, kind = '') => {
    note.innerHTML = msg;
    note.className = 'wb-note ' + kind;
  };

  // ---------- Dibujar topología ----------
  function drawTopo() {
    const parts = [];
    for (const l of net.links) {
      const a = net.devices[l.a.dev];
      const b = net.devices[l.b.dev];
      if (!a || !b) continue;
      const st = linkState(net, l);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      parts.push(`<g class="lk" data-link="${l.id}">
        <line class="lk-hit" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>
        <line class="lk-line st-${st} c-${l.cable}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>
        <circle class="lk-led st-${st}" cx="${mx}" cy="${my}" r="5"><title>${esc(STATE_TEXT[st])}</title></circle>
        <text class="lk-port" x="${a.x * 0.72 + b.x * 0.28}" y="${a.y * 0.72 + b.y * 0.28 - 6}">${esc(l.a.port)}</text>
        <text class="lk-port" x="${a.x * 0.28 + b.x * 0.72}" y="${a.y * 0.28 + b.y * 0.72 - 6}">${esc(l.b.port)}</text>
      </g>`);
    }
    for (const d of Object.values(net.devices)) {
      const addr = d.ifaces?.eth0?.ip || (d.type === 'router' ? d.ifaces['g0/0']?.ip : '') || (d.type === 'isp' ? 'Internet' : '');
      const cls = ['dv', selected === d.id ? 'sel' : '', d.powered ? '' : 'off', pending?.dev === d.id ? 'pending' : ''].join(' ');
      parts.push(`<g class="${cls}" data-dev="${d.id}" transform="translate(${d.x},${d.y})">
        <rect x="-42" y="-30" width="84" height="60" rx="10"/>
        <text class="dv-ic" y="-4">${ICONS[d.type]}</text>
        <text class="dv-name" y="16">${esc(d.name)}</text>
        <text class="dv-ip" y="27">${esc(addr || '')}</text>
        <circle class="dv-pw" cx="33" cy="-21" r="4"/>
      </g>`);
    }
    svg.innerHTML = parts.join('');
  }

  // ---------- Selección de puerto ----------
  function openPorts(d, onPick) {
    const isConsole = tool === 'console';
    const ports = d.ports.filter((p) => (isConsole ? p === 'console' || p === 'com1' : p !== 'console' && p !== 'com1'));
    if (!ports.length) {
      audio.sfx('error');
      say(isConsole
        ? `✘ ${esc(d.name)} no tiene puerto serial ni de consola. El cable de consola va del <b>COM1 de un PC</b> al puerto <b>console</b> de un router o switch.`
        : `✘ ${esc(d.name)} no tiene puertos Ethernet libres.`, 'bad');
      return;
    }
    pop.innerHTML = `<div class="pop-title">${esc(d.name)}: elige puerto</div>` + ports.map((p) => {
      const used = portInUse(net, d.id, p);
      return `<button data-port="${p}" ${used ? 'disabled' : ''}>${p}${used ? ' · ocupado' : ''}</button>`;
    }).join('');
    pop.classList.remove('hidden');
    // Ubica el menú junto al equipo, sin salirse del área del diagrama.
    const area = pop.parentElement.getBoundingClientRect();
    const r = svg.getBoundingClientRect();
    const scale = Math.min(r.width / 800, r.height / 440);
    const left = r.left - area.left + (r.width - 800 * scale) / 2 + d.x * scale;
    const top = r.top - area.top + (r.height - 440 * scale) / 2 + d.y * scale;
    const halfW = pop.offsetWidth / 2 + 4;
    pop.style.left = Math.max(halfW, Math.min(area.width - halfW, left)) + 'px';
    pop.style.top = Math.max(4, Math.min(area.height - pop.offsetHeight - 18, top)) + 'px';
    pop.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      pop.classList.add('hidden');
      onPick(b.dataset.port);
    }));
  }
  function clickDeviceWithCable(d) {
    if (!pending) {
      openPorts(d, (port) => {
        pending = { dev: d.id, port };
        audio.sfx('plug');
        say(`Cable conectado en <b>${esc(d.name)} ${port}</b>. Ahora toca el otro equipo.`);
        drawTopo();
      });
      return;
    }
    if (pending.dev === d.id) {
      pending = null;
      say('Cable cancelado.');
      drawTopo();
      return;
    }
    openPorts(d, (port) => {
      const lk = addLink(net, pending.dev, pending.port, d.id, port, tool);
      pending = null;
      audio.sfx('plug');
      const st = linkState(net, lk);
      const a = net.devices[lk.a.dev];
      if (st === 'cable') {
        audio.sfx('error');
        say(`⚠ El LED de <b>${esc(a.name)} ↔ ${esc(d.name)}</b> no prende: ese tipo de cable no sirve para este par de equipos.`, 'bad');
      } else {
        say(`Enlace <b>${esc(a.name)} ${esc(lk.a.port)} ↔ ${esc(d.name)} ${esc(port)}</b>: ${esc(STATE_TEXT[st]).toLowerCase()}.`, st === 'up' || st === 'console' ? 'good' : '');
      }
      changed();
    });
  }

  // ---------- Panel derecho ----------
  function terminalFor(d) {
    if (terms[d.id]) return terms[d.id];
    const t = { lines: [], history: [], hi: 0, shell: null };
    t.print = (txt, cls = '') => {
      t.lines.push([txt, cls]);
      if (t.lines.length > 500) t.lines.shift();
      if (selected === d.id && tab === 'term') paintTerminal(t);
    };
    t.shell = createShell(net, d.id, {
      print: t.print,
      clear: () => {
        t.lines = [];
        if (selected === d.id && tab === 'term') paintTerminal(t);
      },
      changed,
    });
    t.lines.push([t.shell.banner(), 'muted-line']);
    terms[d.id] = t;
    return t;
  }
  function paintTerminal(t) {
    const out = right.querySelector('#t-out');
    if (!out) return;
    out.textContent = '';
    for (const [txt, cls] of t.lines) {
      const s = document.createElement('span');
      if (cls) s.className = cls;
      s.textContent = txt + '\n';
      out.appendChild(s);
    }
    out.scrollTop = out.scrollHeight;
    const p = right.querySelector('#t-prompt');
    if (p) p.textContent = t.shell.prompt();
  }

  const consoleAccess = (d) => {
    if (!opts.consoleFrom || isHost(d)) return true;
    return net.links.some((l) => l.cable === 'console'
      && ((l.a.dev === d.id && l.b.dev === opts.consoleFrom) || (l.b.dev === d.id && l.a.dev === opts.consoleFrom)));
  };

  function drawRight() {
    const d = selected && net.devices[selected];
    if (!d) {
      right.innerHTML = `<div class="wb-empty"><p>👆 Toca un equipo en el diagrama para abrir su consola y configurarlo.</p>
        <div class="legend">
          <div><i class="led st-up"></i> Enlace activo</div>
          <div><i class="led st-admin"></i> Puerto apagado</div>
          <div><i class="led st-cable"></i> Cable incorrecto</div>
          <div><i class="led st-console"></i> Consola</div>
        </div>${opts.notes || ''}</div>`;
      return;
    }
    const tabs = isHost(d) ? [['term', 'Consola'], ['net', 'Red'], ['web', 'Navegador']] : d.type === 'isp' ? [['info', 'Información']] : [['term', 'Consola']];
    if (!tabs.some(([k]) => k === tab)) tab = tabs[0][0];
    right.innerHTML = `
      <div class="wb-head">
        <div><b>${ICONS[d.type]} ${esc(d.name)}</b><small>${TYPE_LABEL[d.type]}</small></div>
        <div class="wb-tabs">${tabs.map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${v}</button>`).join('')}</div>
        ${d.type !== 'isp' ? `<button class="tool-btn pw ${d.powered ? 'on' : ''}" id="wb-power" title="Encender o apagar">⏻</button>` : ''}
        ${opts.editable ? '<button class="tool-btn" id="wb-del" title="Eliminar equipo">🗑️</button>' : ''}
      </div>
      <div class="wb-panel" id="wb-panel"></div>`;
    right.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.tab;
      drawRight();
    }));
    right.querySelector('#wb-power')?.addEventListener('click', () => {
      const wasOn = d.powered;
      if (wasOn && d.dirty) say(`⚠ ${esc(d.name)} tenía cambios sin guardar: al apagar se pierden.`, 'bad');
      setPower(d, !wasOn);
      delete terms[d.id];
      audio.sfx(wasOn ? 'shutdown' : 'power');
      changed();
      drawRight();
    });
    right.querySelector('#wb-del')?.addEventListener('click', () => {
      removeDevice(net, d.id);
      delete terms[d.id];
      selected = null;
      changed();
      drawRight();
    });
    const panel = right.querySelector('#wb-panel');
    if (!d.powered) {
      panel.innerHTML = '<div class="wb-off">⏻ Equipo apagado. Enciéndelo con el botón de arriba.</div>';
      return;
    }
    if (tab === 'term') drawTermPanel(d, panel);
    else if (tab === 'net') drawNetPanel(d, panel);
    else if (tab === 'web') drawWebPanel(d, panel);
    else panel.innerHTML = `<div class="wb-off"><p>Equipo del proveedor. No se administra desde aquí.</p>
      <p>IP del proveedor: <code>${esc(d.ifaces.wan.ip)}</code> /30<br>Tu router debe usar <code>200.10.20.2</code> /30 en el enlace.</p></div>`;
  }

  function drawTermPanel(d, panel) {
    if (!consoleAccess(d)) {
      const from = net.devices[opts.consoleFrom];
      panel.innerHTML = `<div class="wb-off">🔌 Sin sesión de consola.<br><br>Un equipo nuevo no tiene red ni IP de administración:
        conéctale un <b>cable de consola</b> desde el <b>COM1</b> de ${esc(from?.name || 'tu PC')} hasta su puerto <b>console</b>.</div>`;
      return;
    }
    panel.innerHTML = `
      <div class="term wb-term">
        <div class="term-bar">${isHost(d) ? 'Símbolo del sistema' : `Sesión serial 9600 8N1 → ${esc(d.name)}`}</div>
        <div class="term-out" id="t-out"></div>
        <div class="term-in"><span id="t-prompt"></span><input id="t-in" autocomplete="off" spellcheck="false" aria-label="Línea de comandos"></div>
      </div>`;
    const t = terminalFor(d);
    paintTerminal(t);
    const input = panel.querySelector('#t-in');
    setTimeout(() => input.focus(), 30);
    panel.querySelector('.term').addEventListener('click', () => {
      if (!String(window.getSelection())) input.focus();
    });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const raw = input.value;
        input.value = '';
        t.print(t.shell.prompt() + raw, 'cmd');
        if (raw.trim()) {
          t.history.push(raw);
          t.hi = t.history.length;
        }
        t.shell.exec(raw);
        paintTerminal(t);
        drawTopo();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (t.hi > 0) input.value = t.history[--t.hi];
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        t.hi = Math.min(t.history.length, t.hi + 1);
        input.value = t.history[t.hi] || '';
      } else if (e.key === 'Tab') {
        e.preventDefault();
        input.value = t.shell.complete(input.value);
        paintTerminal(t);
      }
    });
  }

  function drawNetPanel(d, panel) {
    const i = d.ifaces.eth0;
    panel.innerHTML = `
      <form class="net-form" id="wb-form">
        <h4>Propiedades de Ethernet · IPv4</h4>
        <div class="linkstat ${hostLinkUp(net, d) ? 'up' : 'down'}">${d.nicDisabled ? 'Adaptador deshabilitado en BIOS' : hostLinkUp(net, d) ? '● Cable conectado · enlace activo' : '○ Sin enlace (revisa cable, tipo y puerto)'}</div>
        <label class="radio"><input type="radio" name="mode" value="dhcp" ${d.dhcp ? 'checked' : ''}> Obtener IP automáticamente (DHCP)</label>
        <label class="radio"><input type="radio" name="mode" value="static" ${d.dhcp ? '' : 'checked'}> Usar esta dirección IP:</label>
        <div class="net-fields">
          <label>Dirección IP<input name="ip" value="${esc(i.ip)}" autocomplete="off" placeholder="192.168.10.10"></label>
          <label>Máscara de subred<input name="mask" value="${esc(i.mask)}" autocomplete="off" placeholder="255.255.255.0"></label>
          <label>Puerta de enlace<input name="gw" value="${esc(d.gw)}" autocomplete="off" placeholder="192.168.10.1"></label>
          <label>DNS<input name="dns" value="${esc(d.dns)}" autocomplete="off" placeholder="8.8.8.8"></label>
        </div>
        <button class="btn primary">Aceptar</button>
        <p class="explain" id="wb-netmsg"></p>
      </form>`;
    const f = panel.querySelector('#wb-form');
    const fields = ['ip', 'mask', 'gw', 'dns'].map((n) => f.elements[n]);
    const syncDisabled = () => fields.forEach((x) => (x.disabled = f.elements.mode.value === 'dhcp'));
    f.querySelectorAll('[name=mode]').forEach((r) => r.addEventListener('change', syncDisabled));
    syncDisabled();
    f.addEventListener('keydown', (e) => e.stopPropagation());
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = f.querySelector('#wb-netmsg');
      if (f.elements.mode.value === 'dhcp') {
        const r = dhcpRenew(net, d);
        changed();
        audio.sfx(r.ok ? 'ok' : 'error');
        if (r.ok) {
          drawRight();
          right.querySelector('#wb-netmsg').innerHTML = `<span class="good">✔ DHCP entregó ${esc(r.ip)}.</span>`;
        } else {
          drawRight();
          right.querySelector('#wb-netmsg').innerHTML = r.apipa
            ? `<span class="bad">✘ Ningún servidor DHCP respondió. Se autoasignó APIPA (${esc(d.ifaces.eth0.ip)}).</span>`
            : '<span class="bad">✘ Sin enlace: no se puede pedir IP. Revisa el cable.</span>';
        }
        return;
      }
      const ip = f.elements.ip.value.trim();
      const mask = f.elements.mask.value.trim();
      const gw = f.elements.gw.value.trim();
      const dns = f.elements.dns.value.trim();
      const err = validateHostAddress(ip, mask)
        || (gw && ipToInt(gw) === null ? `Puerta de enlace no válida: ${gw}` : null)
        || (dns && ipToInt(dns) === null ? `DNS no válido: ${dns}` : null);
      if (err) {
        audio.sfx('error');
        msg.innerHTML = `<span class="bad">✘ ${esc(err)}</span>`;
        return;
      }
      setHostIp(d, ip, mask, gw, dns);
      audio.sfx('ok');
      changed();
      msg.innerHTML = '<span class="good">✔ Configuración aplicada. Compruébala con ipconfig y ping.</span>';
    });
  }

  function drawWebPanel(d, panel) {
    panel.innerHTML = `
      <div class="browser">
        <form class="browser-bar" id="wb-url">
          <input name="u" placeholder="escribe una dirección, ej: example.com" autocomplete="off" aria-label="Dirección web">
          <button class="tool-btn">Ir</button>
        </form>
        <div class="browser-page" id="wb-page"><p class="muted">Prueba example.com o www.cybercorp.co</p></div>
      </div>`;
    const f = panel.querySelector('#wb-url');
    f.addEventListener('keydown', (e) => e.stopPropagation());
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const r = webGet(net, d.id, f.elements.u.value);
      const page = panel.querySelector('#wb-page');
      if (r.ok) {
        audio.sfx('ok');
        page.innerHTML = `<h3>${esc(r.title)}</h3><p>${esc(r.body)}</p><small class="muted">Servido por ${esc(r.ip)}</small>`;
      } else {
        audio.sfx('error');
        page.innerHTML = `<h3>😕 No se puede acceder a este sitio</h3><p><code>${esc(r.msg)}</code></p>${r.hint ? `<p>💡 ${esc(r.hint)}</p>` : ''}`;
      }
      changed();
    });
  }

  // ---------- Objetivos ----------
  function drawObjectives() {
    const box = el.querySelector('#wb-obj');
    if (!box) return;
    box.innerHTML = opts.objectives.map((g, gi) => `
      <div class="obj-group">
        <div class="obj-title">${esc(g.title)} <span id="og-${gi}"></span></div>
        <ul class="objectives">
          ${g.items.map((o) => `<li data-obj="${o.id}"><span class="obj-text">${o.text}</span>${o.hint ? `<details class="obj-hint"><summary>💡</summary>${o.hint}</details>` : ''}</li>`).join('')}
        </ul>
      </div>`).join('') + '<div id="wb-done"></div>';
  }
  function checkObjectives() {
    if (!opts.objectives) return;
    let total = 0;
    let done = 0;
    opts.objectives.forEach((g, gi) => {
      let gd = 0;
      g.items.forEach((o) => {
        const ok = !!o.check(net);
        el.querySelector(`[data-obj="${o.id}"]`)?.classList.toggle('ok', ok);
        if (ok) gd++;
      });
      total += g.items.length;
      done += gd;
      const c = el.querySelector('#og-' + gi);
      if (c) c.textContent = `${gd}/${g.items.length}`;
    });
    opts.onProgress?.(done, total);
    const finished = total > 0 && done === total;
    if (finished && !allDoneFired) {
      allDoneFired = true;
      audio.sfx('win');
      opts.onDone?.(el.querySelector('#wb-done'));
    } else if (!finished && allDoneFired) {
      allDoneFired = false;
      const box = el.querySelector('#wb-done');
      if (box) box.innerHTML = '';
    }
  }

  function changed() {
    opts.onChange?.();
    const headName = right.querySelector('.wb-head b');
    if (headName && selected && net.devices[selected]) headName.textContent = `${ICONS[net.devices[selected].type]} ${net.devices[selected].name}`;
    drawTopo();
    checkObjectives();
  }

  // ---------- Eventos ----------
  el.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => {
    tool = b.dataset.tool;
    pending = null;
    pop.classList.add('hidden');
    paintTool();
    drawTopo();
    say({
      select: 'Toca un equipo para abrir su consola.',
      straight: 'Cable directo: toca el primer equipo.',
      cross: 'Cable cruzado: toca el primer equipo.',
      console: 'Cable de consola: toca primero el PC (COM1) y luego el router o switch.',
      remove: 'Toca un cable para desconectarlo.',
    }[tool]);
  }));
  const paintTool = () => el.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
  paintTool();

  el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const type = b.dataset.add;
    if (type === 'isp' && Object.values(net.devices).some((x) => x.type === 'isp')) {
      audio.sfx('error');
      return say('✘ Solo hay un proveedor de Internet en este laboratorio.', 'bad');
    }
    const n = Object.values(net.devices).filter((x) => x.type === type).length + 1;
    const names = { pc: 'PC', server: 'SRV', printer: 'IMP', switch: 'SW', router: 'R', isp: 'ISP' };
    const nd = addDevice(net, type, type === 'isp' ? 'ISP' : `${names[type]}-${n}`, 80 + Math.random() * 640, 60 + Math.random() * 320);
    selected = nd.id;
    audio.sfx('click');
    changed();
    drawRight();
  }));
  el.querySelector('#wb-mdix')?.addEventListener('change', (e) => {
    net.autoMdix = e.target.checked;
    changed();
  });

  // Arrastrar y tocar equipos
  const svgPoint = (e) => {
    const r = svg.getBoundingClientRect();
    const scale = Math.max(800 / r.width, 440 / r.height);
    const ox = (r.width - 800 / scale) / 2;
    const oy = (r.height - 440 / scale) / 2;
    return { x: (e.clientX - r.left - ox) * scale, y: (e.clientY - r.top - oy) * scale };
  };
  let drag = null;
  svg.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('[data-dev]');
    if (!g) return;
    drag = { id: g.dataset.dev, moved: false, start: svgPoint(e) };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = svgPoint(e);
    if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 6) return;
    drag.moved = true;
    const d = net.devices[drag.id];
    d.x = Math.max(44, Math.min(756, p.x));
    d.y = Math.max(32, Math.min(408, p.y));
    drawTopo();
  });
  svg.addEventListener('pointerup', (e) => {
    if (drag) {
      const d = net.devices[drag.id];
      const moved = drag.moved;
      drag = null;
      if (moved) {
        opts.onChange?.();
        return;
      }
      if (tool === 'select' || tool === 'remove') {
        selected = d.id;
        audio.sfx('click');
        drawTopo();
        drawRight();
      } else {
        clickDeviceWithCable(d);
      }
      return;
    }
    if (tool === 'remove') {
      const lk = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-link]');
      if (lk) {
        removeLink(net, lk.dataset.link);
        audio.sfx('plug');
        say('Cable desconectado.');
        changed();
      }
    }
  });
  pop.addEventListener('pointerdown', (e) => e.stopPropagation());

  drawObjectives();
  drawTopo();
  drawRight();
  checkObjectives();
  say(opts.intro || 'Toca un equipo para abrir su consola.');

  return { refresh: changed, redrawPanel: drawRight };
}

// ---------- Utilidades de objetivos ----------
const linked = (net, aName, bName, cable = null) => {
  const a = byTag(net, aName);
  const b = byTag(net, bName);
  if (!a || !b) return false;
  return net.links.some((l) => ((l.a.dev === a.id && l.b.dev === b.id) || (l.b.dev === a.id && l.a.dev === b.id))
    && (cable ? l.cable === cable : true) && ['up', 'console'].includes(linkState(net, l)));
};
const byTag = (net, t) => Object.values(net.devices).find((d) => d.tag === t);
const tagged = (d, t) => {
  d.tag = t;
  return d;
};
const can = (net, tag, ip) => {
  const d = byTag(net, tag);
  return !!d && ping(net, d.id, ip, { record: false }).ok;
};
const didPing = (net, tag, ip) => {
  const d = byTag(net, tag);
  return !!d && !!net.stats[`${d.id}>${ip}`] && ping(net, d.id, ip, { record: false }).ok;
};
// El enlace debe estar activo y usar ese puerto concreto del equipo.
const linkedOnPort = (net, tag, otherTag, port) => {
  const d = byTag(net, tag);
  const o = byTag(net, otherTag);
  return net.links.some((l) => linkState(net, l) === 'up'
    && ((l.a.dev === d.id && l.a.port === port && l.b.dev === o.id) || (l.b.dev === d.id && l.b.port === port && l.a.dev === o.id)));
};
const ipIsUnique = (net, d) => !Object.values(net.devices).some((x) => x.id !== d.id
  && Object.values(x.ifaces || {}).some((f) => f.ip === d.ifaces.eth0.ip));

function preconfiguredRouter(net, x, y) {
  const r = tagged(addDevice(net, 'router', 'R-1', x, y), 'r');
  r.ifaces['g0/0'] = { ...r.ifaces['g0/0'], ip: '192.168.10.1', mask: '255.255.255.0', up: true, natIn: true };
  r.ifaces['g0/1'] = { ...r.ifaces['g0/1'], ip: '200.10.20.2', mask: '255.255.255.252', up: true, natOut: true };
  r.routes.push({ net: '0.0.0.0', mask: '0.0.0.0', via: '200.10.20.1' });
  r.acl[1] = [{ net: '192.168.10.0', wild: '0.0.0.255' }];
  r.nat = { list: '1', iface: 'g0/1' };
  saveConfig(r);
  return r;
}

const CHEATSHEET = `
  <details class="tip cheat" open><summary>📘 Apuntes rápidos</summary>
    <p><b>Router / switch</b></p>
    <pre>enable
configure terminal
hostname R-OFICINA
interface g0/0
 ip address 192.168.10.1 255.255.255.0
 no shutdown
 exit
end
show ip interface brief
write memory</pre>
    <p><b>PC</b>: <code>ipconfig /all</code>, <code>ping</code>, <code>tracert</code>, <code>nslookup</code>, <code>arp -a</code></p>
    <p>Las abreviaturas funcionan: <code>conf t</code>, <code>int g0/0</code>, <code>no shut</code>, <code>sh ip int br</code>, <code>wr</code>.</p>
  </details>`;

const finishPanel = (box, text, btn, onClick) => {
  box.innerHTML = `<div class="wb-finish"><p class="good">${text}</p><button class="btn primary">${btn}</button></div>`;
  box.querySelector('button').addEventListener('click', onClick);
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
const resetTool = '<button class="tool-btn" id="wb-reset" title="Reiniciar este laboratorio">↺ Reiniciar</button>';
function bindReset(el, key, restart) {
  const b = el.querySelector('#wb-reset');
  if (!b) return;
  let armed = false;
  b.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      b.textContent = '¿Seguro?';
      setTimeout(() => {
        armed = false;
        if (b.isConnected) b.textContent = '↺ Reiniciar';
      }, 2500);
      return;
    }
    dropSave(key);
    restart();
  });
}

// ================================================================
//  L2 · Armado físico de la red
// ================================================================
function buildArmado() {
  const net = createNet();
  const pc1 = tagged(addDevice(net, 'pc', 'PC-1', 100, 90), 'pc1');
  const pc2 = tagged(addDevice(net, 'pc', 'PC-2', 100, 220), 'pc2');
  const imp = tagged(addDevice(net, 'printer', 'IMP-1', 100, 350), 'imp');
  const srv = tagged(addDevice(net, 'server', 'SRV-1', 620, 350), 'srv');
  tagged(addDevice(net, 'switch', 'SW-1', 310, 220), 'sw1');
  tagged(addDevice(net, 'switch', 'SW-2', 460, 350), 'sw2');
  preconfiguredRouter(net, 470, 90);
  tagged(addDevice(net, 'isp', 'ISP', 680, 90), 'isp');
  setHostIp(pc1, '192.168.10.11', '255.255.255.0', '192.168.10.1', '8.8.8.8');
  setHostIp(pc2, '192.168.10.12', '255.255.255.0', '192.168.10.1', '8.8.8.8');
  setHostIp(imp, '192.168.10.30', '255.255.255.0', '192.168.10.1');
  setHostIp(srv, '192.168.10.5', '255.255.255.0', '192.168.10.1', '8.8.8.8');
  return net;
}
const OBJ_ARMADO = [
  {
    title: 'Cableado de la oficina',
    items: [
      { id: 'a1', text: 'PC-1 y PC-2 conectados a SW-1', hint: 'Usa cable <b>directo</b>: PC y switch son equipos de distinto tipo.', check: (n) => linked(n, 'pc1', 'sw1') && linked(n, 'pc2', 'sw1') },
      { id: 'a2', text: 'Impresora conectada a SW-1', hint: 'También va con cable directo.', check: (n) => linked(n, 'imp', 'sw1') },
      { id: 'a3', text: 'SW-1 enlazado con SW-2', hint: 'Dos switches sin Auto-MDIX: usa cable <b>cruzado</b>.', check: (n) => linked(n, 'sw1', 'sw2') },
      { id: 'a4', text: 'Servidor conectado a SW-2', hint: 'Cable directo.', check: (n) => linked(n, 'srv', 'sw2') },
      { id: 'a5', text: 'SW-1 conectado a la interfaz LAN del router (g0/0)', hint: 'Router y switch son distintos: cable directo. <b>El puerto importa</b>: la IP de la LAN está en g0/0.', check: (n) => linkedOnPort(n, 'r', 'sw1', 'g0/0') },
      { id: 'a6', text: 'Router conectado al ISP por g0/1', hint: 'Cable directo desde g0/1 (interfaz WAN) al módem del proveedor.', check: (n) => linkedOnPort(n, 'r', 'isp', 'g0/1') },
    ],
  },
  {
    title: 'Prueba de conectividad',
    items: [
      { id: 'a7', text: 'Desde PC-1, <code>ping 192.168.10.5</code> (servidor)', hint: 'Toca PC-1 → Consola y escribe el comando.', check: (n) => didPing(n, 'pc1', '192.168.10.5') },
      { id: 'a8', text: 'Desde PC-2, <code>ping 8.8.8.8</code> (Internet)', hint: 'Si responde, tu cableado llega hasta el proveedor.', check: (n) => didPing(n, 'pc2', '8.8.8.8') },
    ],
  },
];
const Q_ARMADO = [
  {
    q: 'Un LED de enlace apagado en el switch indica primero que debes revisar:',
    o: ['La capa física: cable, conector, tipo de cable y equipo encendido', 'La tabla de rutas del ISP', 'La versión de Windows', 'El DNS'],
    a: 0,
    e: 'Siempre se diagnostica de abajo hacia arriba en el modelo OSI: si no hay enlace físico, nada de lo demás puede funcionar.',
  },
];

export function armadoLab(el, ctx) {
  const key = 'cybervr-lab-armado';
  const begin = () => {
    const net = loadSave(key) || buildArmado();
    workbench(el, {
      net,
      objectives: OBJ_ARMADO,
      extraTools: resetTool,
      intro: 'Elige un tipo de cable y conecta los equipos. Observa el LED de cada enlace.',
      notes: '<p class="muted">Los equipos ya están configurados: aquí lo que cuenta es el cableado.</p>',
      onChange: () => writeSave(key, net),
      onDone: (box) => finishPanel(box, '✔ ¡La red está cableada y responde!', 'Continuar →', () => {
        dropSave(key);
        el.innerHTML = '';
        quiz(Q_ARMADO, { pass: 1, title: 'Pregunta de cierre' })(el, ctx);
      }),
    });
    bindReset(el, key, begin);
  };
  begin();
}

// ================================================================
//  L3 · Lab completo: del encendido al cierre
// ================================================================
const DEFAULT_BIOS = { lan: false, boot: 'usb' };
const LOGIN = { user: 'tecnico', pass: 'Lab2026!' };

function buildFullNet() {
  const net = createNet();
  const pc = tagged(addDevice(net, 'pc', 'PC-ADM', 110, 90), 'adm');
  const ven = tagged(addDevice(net, 'pc', 'PC-VENTAS', 110, 330), 'ven');
  const srv = tagged(addDevice(net, 'server', 'SRV-1', 330, 380), 'srv');
  const sw = tagged(addDevice(net, 'switch', 'Switch', 330, 210), 'sw');
  const r = tagged(addDevice(net, 'router', 'Router', 540, 210), 'r');
  const isp = tagged(addDevice(net, 'isp', 'ISP', 720, 210), 'isp');
  pc.nicDisabled = true; // coincide con la BIOS de fábrica
  ven.dhcp = true;
  srv.web = { title: 'Intranet · Oficina', body: 'Servidor interno de la oficina funcionando.' };
  addLink(net, ven.id, 'eth0', sw.id, 'fa0/2', 'straight');
  addLink(net, srv.id, 'eth0', sw.id, 'fa0/3', 'straight');
  addLink(net, sw.id, 'g0/1', r.id, 'g0/0', 'straight');
  addLink(net, r.id, 'g0/1', isp.id, 'wan', 'straight');
  [pc, ven, srv, sw, r].forEach((d) => (d.powered = false));
  return net;
}

const iface = (n, name) => byTag(n, 'r')?.ifaces[name] || {};
const OBJ_FULL = [
  {
    title: '1 · Conexión física',
    items: [
      { id: 'f1', text: 'Conectar PC-ADM a un puerto libre del switch (por ejemplo fa0/1)', hint: 'Cable <b>directo</b> desde eth0. Si el LED no prende, revisa si activaste la tarjeta de red en la BIOS.', check: (n) => linked(n, 'adm', 'sw') },
      { id: 'f2', text: 'Conectar el cable de consola de PC-ADM (COM1) al router', hint: 'Elige la herramienta <b>Consola</b>, toca PC-ADM y luego el Router.', check: (n) => n.flags.routerConsole || (n.flags.routerConsole = linked(n, 'adm', 'r', 'console')) },
    ],
  },
  {
    title: '2 · Router',
    items: [
      { id: 'f3', text: 'Nombrar el router <code>R-OFICINA</code>', hint: '<pre>enable\nconfigure terminal\nhostname R-OFICINA</pre>', check: (n) => byTag(n, 'r').name === 'R-OFICINA' },
      { id: 'f4', text: 'LAN g0/0: <code>192.168.10.1/24</code> y activa', hint: '<pre>interface g0/0\n ip address 192.168.10.1 255.255.255.0\n no shutdown\n exit</pre>', check: (n) => iface(n, 'g0/0').ip === '192.168.10.1' && iface(n, 'g0/0').mask === '255.255.255.0' && iface(n, 'g0/0').up },
      { id: 'f5', text: 'WAN g0/1: <code>200.10.20.2/30</code> y activa', hint: '<pre>interface g0/1\n ip address 200.10.20.2 255.255.255.252\n no shutdown\n exit</pre>', check: (n) => iface(n, 'g0/1').ip === '200.10.20.2' && iface(n, 'g0/1').mask === '255.255.255.252' && iface(n, 'g0/1').up },
      { id: 'f6', text: 'Ruta por defecto hacia el ISP (<code>200.10.20.1</code>)', hint: '<pre>ip route 0.0.0.0 0.0.0.0 200.10.20.1</pre>', check: (n) => byTag(n, 'r').routes.some((x) => x.net === '0.0.0.0' && x.mask === '0.0.0.0' && x.via === '200.10.20.1') },
      { id: 'f7', text: 'DHCP: reservar <code>.1</code> a <code>.20</code> y crear un pool para la LAN', hint: '<pre>ip dhcp excluded-address 192.168.10.1 192.168.10.20\nip dhcp pool OFICINA\n network 192.168.10.0 255.255.255.0\n default-router 192.168.10.1\n dns-server 8.8.8.8\n exit</pre>', check: (n) => { const r = byTag(n, 'r'); return r.excluded.length > 0 && r.pools.some((p) => p.net === '192.168.10.0' && p.gw === '192.168.10.1' && p.dns); } },
      { id: 'f8', text: 'NAT: la LAN sale a Internet con la IP de g0/1', hint: '<pre>access-list 1 permit 192.168.10.0 0.0.0.255\nip nat inside source list 1 interface g0/1 overload\ninterface g0/0\n ip nat inside\n exit\ninterface g0/1\n ip nat outside\n exit</pre>', check: (n) => { const r = byTag(n, 'r'); return !!r.nat && iface(n, 'g0/0').natIn && iface(n, 'g0/1').natOut && !!r.acl[r.nat.list]; } },
    ],
  },
  {
    title: '3 · Equipos finales',
    items: [
      { id: 'f9', text: 'PC-ADM con IP fija <code>192.168.10.10/24</code>, puerta de enlace y DNS <code>8.8.8.8</code>', hint: 'Toca PC-ADM → pestaña <b>Red</b>.', check: (n) => { const d = byTag(n, 'adm'); return !d.dhcp && d.ifaces.eth0.ip === '192.168.10.10' && d.ifaces.eth0.mask === '255.255.255.0' && d.gw === '192.168.10.1' && d.dns === '8.8.8.8'; } },
      { id: 'f10', text: 'SRV-1 con IP fija <code>192.168.10.5/24</code> y puerta de enlace', hint: 'Los servidores usan IP fija para que los clientes siempre los encuentren.', check: (n) => { const d = byTag(n, 'srv'); return !d.dhcp && d.ifaces.eth0.ip === '192.168.10.5' && d.gw === '192.168.10.1'; } },
      { id: 'f11', text: 'PC-VENTAS recibe IP por DHCP', hint: 'En PC-VENTAS: <code>ipconfig /renew</code>. Si recibes 169.254.x.x, el DHCP no respondió. El equipo debe recibir una IP mayor a .20.', check: (n) => { const d = byTag(n, 'ven'); const ip = d.ifaces.eth0.ip; return d.dhcp && ip.startsWith('192.168.10.') && +ip.split('.')[3] > 20; } },
    ],
  },
  {
    title: '4 · Verificación',
    items: [
      { id: 'f12', text: 'Desde PC-ADM: <code>ping 192.168.10.1</code>', hint: 'Prueba la puerta de enlace: primero lo cercano.', check: (n) => didPing(n, 'adm', '192.168.10.1') },
      { id: 'f13', text: 'Desde PC-VENTAS: <code>ping 192.168.10.5</code>', hint: 'Comunicación dentro de la LAN.', check: (n) => didPing(n, 'ven', '192.168.10.5') },
      { id: 'f14', text: 'Desde PC-ADM: <code>ping 8.8.8.8</code>', hint: 'Si falla aquí, revisa ruta por defecto y NAT.', check: (n) => didPing(n, 'adm', '8.8.8.8') },
      { id: 'f15', text: 'Desde PC-ADM: <code>nslookup example.com</code>', hint: 'Comprueba que el DNS resuelve nombres.', check: (n) => { const d = byTag(n, 'adm'); return !!n.stats[`${d.id}@example.com`]; } },
      { id: 'f16', text: 'En el navegador de PC-ADM, abre <code>example.com</code>', hint: 'Toca PC-ADM → pestaña <b>Navegador</b>.', check: (n) => { const d = byTag(n, 'adm'); return !!n.stats[`${d.id}#web`]; } },
    ],
  },
  {
    title: '5 · Dejar todo guardado',
    items: [
      { id: 'f17', text: 'Guardar la configuración del router', hint: '<pre>end\nwrite memory</pre>Sin esto, un corte de luz borra todo tu trabajo.', check: (n) => { const r = byTag(n, 'r'); return !!r.startup && !r.dirty; } },
      { id: 'f18', text: 'Nombrar el switch <code>SW-OFICINA</code> y guardar', hint: 'Mueve el cable de consola: <b>Quitar cable</b> y conéctalo de PC-ADM al Switch.<pre>enable\nconf t\nhostname SW-OFICINA\nend\nwrite memory</pre>', check: (n) => { const s = byTag(n, 'sw'); return s.name === 'SW-OFICINA' && !!s.startup && !s.dirty; } },
    ],
  },
];

const Q_FULL = [
  {
    q: 'Levantaste la red. ¿En qué orden conviene comprobar la conectividad?',
    o: [
      'IP local → puerta de enlace → LAN → Internet por IP → nombres DNS',
      'Directo a un sitio web: si no abre, reinstalas Windows',
      'Primero DNS, y después ves si hay cable',
      'El orden no importa',
    ],
    a: 0,
    e: 'Ir de lo cercano a lo lejano te dice exactamente dónde se rompe el camino.',
  },
  {
    q: '¿Qué pasa si apagas un router sin ejecutar write memory?',
    o: [
      'Se pierde lo configurado: running-config está en RAM y startup-config no se actualizó',
      'Nada: se guarda solo',
      'Se borra el sistema operativo',
      'El router queda inservible',
    ],
    a: 0,
    e: 'running-config vive en RAM. Solo lo que copias a startup-config (NVRAM) sobrevive al reinicio.',
  },
  {
    q: '¿Para qué reservaste las direcciones .1 a .20 en el DHCP?',
    o: [
      'Para equipos con IP fija (router, servidores, impresoras) y evitar conflictos',
      'Para que la red sea más rápida',
      'Porque el DHCP solo admite 20 clientes',
      'Para bloquear a los atacantes',
    ],
    a: 0,
    e: 'Si el DHCP entregara una IP que ya usa un servidor, habría un conflicto de direcciones.',
  },
];

export function fullLab(el, ctx) {
  const key = 'cybervr-lab-full';
  let S = loadSave(key) || { stage: 'rack', bios: { ...DEFAULT_BIOS }, ups: false, net: buildFullNet() };
  const save = () => writeSave(key, S);
  const go = (stage) => {
    S.stage = stage;
    save();
    render();
  };
  const dev = (t) => byTag(S.net, t);

  function render() {
    ({ rack, post, bios, nodisk, login, desk, off }[S.stage] || rack)();
  }

  // ---------- Encendido físico ----------
  function rack() {
    const items = [
      ['ups', '🔋', 'UPS / regulador', 'Da energía a todo el rack'],
      ['r', '📡', 'Router', ''],
      ['sw', '🔀', 'Switch', ''],
      ['srv', '🗄️', 'Servidor SRV-1', ''],
      ['ven', '🖥️', 'PC-VENTAS', ''],
    ];
    const isOn = (k) => (k === 'ups' ? S.ups : dev(k).powered);
    el.innerHTML = `
      <div class="stage-head"><span class="kicker">Fase 0 · Sala de equipos</span>
        <h3>Enciende la infraestructura</h3>
        <p class="instr">Llegaste a una oficina nueva. Todo está apagado. Primero la energía, después la red y al final tu PC. Enciende cada equipo con su botón.</p></div>
      <div class="rack">${items.map(([k, ic, n, sub]) => `
        <div class="rack-unit ${isOn(k) ? 'on' : ''}" data-k="${k}">
          <span class="ru-ic">${ic}</span><div><b>${n}</b><small>${sub}</small></div>
          <span class="ru-leds"><i></i><i></i><i></i></span>
          <button class="pw-btn" data-k="${k}" title="Encender o apagar ${n}">⏻</button>
        </div>`).join('')}</div>
      <p class="explain" id="r-msg"></p>
      <div class="pc-tower ${S.ups ? '' : 'nopower'}">
        <div class="tower">🖥️ <b>Tu PC · PC-ADM</b><small>Toca el botón de encendido del gabinete</small></div>
        <button class="pw-big" id="r-pc">⏻</button>
      </div>`;
    const msg = el.querySelector('#r-msg');
    el.querySelectorAll('.pw-btn').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.k;
      if (k === 'ups') {
        if (S.ups && items.slice(1).some(([x]) => dev(x).powered)) {
          audio.sfx('error');
          msg.innerHTML = '<span class="bad">✘ Apaga primero los equipos: cortar la energía con todo encendido puede dañar datos.</span>';
          return;
        }
        S.ups = !S.ups;
      } else {
        if (!S.ups) {
          audio.sfx('error');
          msg.innerHTML = '<span class="bad">✘ Sin energía. Enciende primero la UPS.</span>';
          return;
        }
        setPower(dev(k), !dev(k).powered);
      }
      audio.sfx('power');
      save();
      rack();
    }));
    el.querySelector('#r-pc').addEventListener('click', () => {
      const missing = items.filter(([k]) => !isOn(k)).map(([, , n]) => n);
      if (!S.ups) {
        audio.sfx('error');
        msg.innerHTML = '<span class="bad">✘ El PC no enciende: la UPS está apagada.</span>';
        return;
      }
      if (missing.length) {
        audio.sfx('error');
        msg.innerHTML = `<span class="bad">✘ Antes de encender tu PC, deja lista la infraestructura. Falta: ${missing.join(', ')}.</span>`;
        return;
      }
      setPower(dev('adm'), true);
      audio.sfx('power');
      go('post');
    });
  }

  // ---------- POST ----------
  function crt(html) {
    el.innerHTML = `<div class="crt"><div class="crt-screen" id="crt" tabindex="0">${html}</div></div>`;
    const c = el.querySelector('#crt');
    c.focus();
    return c;
  }
  function post() {
    const lines = [
      'CyberBoard BIOS v2.14  (c) Fabricante genérico',
      '',
      'CPU: Procesador x64 @ 3.2 GHz',
      'Memoria: 16384 MB ... OK',
      'Disco SATA0: SSD 480 GB ... OK',
      'USB: 1 dispositivo detectado',
      `LAN integrada: ${S.bios.lan ? 'Habilitada' : 'DESHABILITADA'}`,
      '',
    ];
    const c = crt('<pre id="p-text"></pre><div class="crt-actions hidden" id="p-act"><button class="crt-btn" id="p-f2">F2 · Entrar a la BIOS</button><span id="p-count"></span></div>');
    const pre = c.querySelector('#p-text');
    audio.sfx('beep');
    let i = 0;
    let timer = null;
    let t2 = null;
    const enterBios = () => {
      clearTimeout(timer);
      clearInterval(t2);
      go('bios');
    };
    const type = () => {
      if (!pre.isConnected) return;
      if (i < lines.length) {
        pre.textContent += lines[i++] + '\n';
        timer = setTimeout(type, 170);
        return;
      }
      const act = c.querySelector('#p-act');
      act.classList.remove('hidden');
      let left = 6;
      const cnt = c.querySelector('#p-count');
      cnt.textContent = `Iniciando en ${left}…`;
      t2 = setInterval(() => {
        if (!cnt.isConnected) return clearInterval(t2);
        left--;
        cnt.textContent = `Iniciando en ${left}…`;
        if (left <= 0) {
          clearInterval(t2);
          go(S.bios.boot === 'ssd' ? 'login' : 'nodisk');
        }
      }, 1000);
      c.querySelector('#p-f2').addEventListener('click', enterBios);
      c.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'F2') {
          e.preventDefault();
          enterBios();
        }
      });
    };
    type();
  }

  function nodisk() {
    const c = crt(`<pre>Reboot and Select proper Boot device
or Insert Boot Media in selected Boot device

El equipo intentó arrancar desde: ${S.bios.boot === 'usb' ? 'USB (memoria sin sistema operativo)' : 'Red PXE (sin servidor de arranque)'}</pre>
      <p class="crt-note">💡 Alguien dejó mal configurado el orden de arranque. Reinicia, entra a la BIOS con <b>F2</b> y pon el disco primero.</p>
      <button class="crt-btn" id="n-r">Reiniciar (Ctrl+Alt+Supr)</button>`);
    audio.sfx('error');
    c.querySelector('#n-r').addEventListener('click', () => go('post'));
  }

  function bios() {
    const b = { ...S.bios };
    const c = crt(`
      <div class="bios">
        <div class="bios-title">CONFIGURACIÓN DE BIOS</div>
        <div class="bios-row"><span>Orden de arranque · primer dispositivo</span>
          <select id="b-boot"><option value="usb">USB</option><option value="ssd">SSD 480 GB</option><option value="pxe">Red (PXE)</option></select></div>
        <div class="bios-row"><span>LAN integrada (tarjeta de red)</span>
          <select id="b-lan"><option value="0">Deshabilitada</option><option value="1">Habilitada</option></select></div>
        <div class="bios-row"><span>Fecha y hora del sistema</span><b>${new Date().toLocaleDateString('es-CO')}</b></div>
        <div class="bios-row"><span>Virtualización</span><b>Habilitada</b></div>
        <p class="crt-note">💡 Para esta instalación, el PC debe arrancar desde el disco y necesita la tarjeta de red activa.</p>
        <div class="bios-actions">
          <button class="crt-btn" id="b-save">F10 · Guardar y salir</button>
          <button class="crt-btn dim" id="b-exit">Esc · Salir sin guardar</button>
        </div>
      </div>`);
    const boot = c.querySelector('#b-boot');
    const lan = c.querySelector('#b-lan');
    boot.value = b.boot;
    lan.value = b.lan ? '1' : '0';
    const stop = (e) => e.stopPropagation();
    c.addEventListener('keydown', stop);
    c.querySelector('#b-save').addEventListener('click', () => {
      S.bios = { boot: boot.value, lan: lan.value === '1' };
      dev('adm').nicDisabled = !S.bios.lan;
      audio.sfx('beep');
      go('post');
    });
    c.querySelector('#b-exit').addEventListener('click', () => go('post'));
  }

  function login() {
    const c = crt(`
      <div class="os-login">
        <div class="os-logo">🛡️ CyberOS</div>
        <div class="postit">📝 Usuario: <b>${LOGIN.user}</b><br>Clave: <b>${LOGIN.pass}</b><br><small>(¡una clave en un post-it es una mala práctica!)</small></div>
        <form id="l-form">
          <input name="u" placeholder="Usuario" autocomplete="off" aria-label="Usuario">
          <input name="p" type="password" placeholder="Contraseña" autocomplete="off" aria-label="Contraseña">
          <button class="crt-btn">Iniciar sesión</button>
          <p class="bad" id="l-msg"></p>
        </form>
      </div>`);
    audio.sfx('startup');
    const f = c.querySelector('#l-form');
    f.elements.u.focus();
    f.addEventListener('keydown', (e) => e.stopPropagation());
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (f.elements.u.value.trim().toLowerCase() === LOGIN.user && f.elements.p.value === LOGIN.pass) {
        audio.sfx('ok');
        go('desk');
      } else {
        audio.sfx('error');
        f.querySelector('#l-msg').textContent = 'Usuario o contraseña incorrectos.';
      }
    });
  }

  // ---------- Escritorio con la mesa de trabajo ----------
  function desk() {
    el.innerHTML = `
      <div class="desktop">
        <div class="desk-work" id="d-work"></div>
        <div class="taskbar">
          <button class="start-btn" id="d-start">🛡️ Inicio</button>
          <div class="start-menu hidden" id="d-menu">
            <button id="d-reboot">🔄 Reiniciar PC</button>
            <button id="d-off">⏻ Apagar PC</button>
          </div>
          <div class="task-progress" id="d-prog"></div>
          <span class="task-clock">${S.bios.lan ? '🌐' : '🚫🌐'} ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>`;
    const work = el.querySelector('#d-work');
    workbench(work, {
      net: S.net,
      objectives: OBJ_FULL,
      initialDevice: dev('adm').id,
      consoleFrom: dev('adm').id,
      extraTools: resetTool,
      intro: S.bios.lan ? 'Sesión iniciada en PC-ADM. Sigue los objetivos de abajo, en orden.' : '⚠ La tarjeta de red de PC-ADM está deshabilitada en la BIOS: reinicia y actívala.',
      notes: CHEATSHEET,
      onChange: save,
      onProgress: (d, t) => {
        const p = el.querySelector('#d-prog');
        if (p) p.innerHTML = `<div class="q-progress"><span>Lab: ${d}/${t}</span><div class="bar"><div style="width:${(d / t) * 100}%"></div></div></div>`;
      },
      onDone: (box) => {
        box.innerHTML = '<div class="wb-finish"><p class="good">✔ Red funcionando y guardada. Para cerrar como se debe: <b>Inicio → Apagar PC</b>.</p></div>';
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
    });
    bindReset(work, key, () => {
      S = { stage: 'rack', bios: { ...DEFAULT_BIOS }, ups: false, net: buildFullNet() };
      save();
      render();
    });
    const menu = el.querySelector('#d-menu');
    el.querySelector('#d-start').addEventListener('click', () => menu.classList.toggle('hidden'));
    el.querySelector('#d-reboot').addEventListener('click', () => {
      audio.sfx('shutdown');
      go('post');
    });
    el.querySelector('#d-off').addEventListener('click', () => {
      const done = OBJ_FULL.every((g) => g.items.every((o) => o.check(S.net)));
      audio.sfx('shutdown');
      S.finished = done;
      go('off');
    });
  }

  function off() {
    setPower(dev('adm'), false);
    save();
    const c = crt('<pre class="shutting">Cerrando sesión…\nGuardando configuración del usuario…\nApagando…</pre>');
    setTimeout(() => {
      if (!c.isConnected) return;
      if (!S.finished) {
        S.stage = 'rack';
        save();
        rack();
        el.querySelector('#r-msg').innerHTML = '<span class="explain">Apagaste el PC, pero aún faltan objetivos. Enciéndelo cuando quieras para continuar.</span>';
        return;
      }
      el.innerHTML = '<div class="stage-head"><span class="kicker">Cierre</span><h3>PC apagado. Ahora, el reporte final</h3><p class="instr">Responde el informe técnico de la instalación para terminar.</p></div><div id="f-quiz"></div>';
      const finishCtx = {
        ...ctx,
        complete: (score) => {
          dropSave(key);
          ctx.complete(score);
        },
      };
      quiz(Q_FULL, { pass: 0.66, title: 'Informe de cierre' })(el.querySelector('#f-quiz'), finishCtx);
    }, 1900);
  }

  render();
}

// ================================================================
//  L4 · Diagnóstico de fallas
// ================================================================
function buildDiag() {
  const net = createNet();
  const cont = tagged(addDevice(net, 'pc', 'PC-CONTA', 110, 70), 'cont');
  const vent = tagged(addDevice(net, 'pc', 'PC-VENTAS', 110, 170), 'vent');
  const rrhh = tagged(addDevice(net, 'pc', 'PC-RRHH', 110, 270), 'rrhh');
  const ger = tagged(addDevice(net, 'pc', 'PC-GERENCIA', 110, 370), 'ger');
  const imp = tagged(addDevice(net, 'printer', 'IMP-1', 330, 380), 'imp');
  const sw = tagged(addDevice(net, 'switch', 'SW-1', 340, 210), 'sw');
  const r = preconfiguredRouter(net, 540, 210);
  const isp = tagged(addDevice(net, 'isp', 'ISP', 720, 210), 'isp');
  setHostIp(cont, '192.168.10.21', '255.255.255.0', '192.168.10.1', '8.8.8.8');
  setHostIp(vent, '192.168.10.22', '255.255.255.0', '192.168.10.254', '8.8.8.8'); // falla: puerta de enlace
  setHostIp(rrhh, '192.168.10.23', '255.255.255.0', '192.168.10.1', '8.8.8.8');
  setHostIp(ger, '192.168.10.24', '255.255.255.0', '192.168.10.1', '8.8.4.40'); // falla: DNS
  setHostIp(imp, '192.168.11.30', '255.255.255.0', '192.168.10.1'); // falla: subred
  addLink(net, cont.id, 'eth0', sw.id, 'fa0/1', 'cross'); // falla: cable
  addLink(net, vent.id, 'eth0', sw.id, 'fa0/2', 'straight');
  addLink(net, rrhh.id, 'eth0', sw.id, 'fa0/3', 'straight');
  addLink(net, ger.id, 'eth0', sw.id, 'fa0/4', 'straight');
  addLink(net, imp.id, 'eth0', sw.id, 'fa0/5', 'straight');
  addLink(net, sw.id, 'g0/1', r.id, 'g0/0', 'straight');
  addLink(net, r.id, 'g0/1', isp.id, 'wan', 'straight');
  sw.switchports['fa0/3'].up = false; // falla: puerto apagado
  saveConfig(sw);
  r.ifaces['g0/1'].up = false; // falla: WAN apagada
  saveConfig(r);
  return net;
}
const OBJ_DIAG = [
  {
    title: 'Mesa de ayuda · tickets abiertos',
    items: [
      { id: 'd1', text: '<b>#4101 Toda la empresa:</b> "Se cayó el Internet, no sale nadie."', hint: 'Entra al router y usa <code>show ip interface brief</code>. ¿Alguna interfaz está <i>administratively down</i>?', check: (n) => can(n, 'r', '8.8.8.8') },
      { id: 'd2', text: '<b>#4102 Contabilidad:</b> "Mi PC dice cable desconectado, pero sí está conectado."', hint: 'Observa el LED del enlace y el tipo de cable en el diagrama. Quita el cable y ponlo del tipo correcto.', check: (n) => can(n, 'cont', '192.168.10.1') },
      { id: 'd3', text: '<b>#4103 Ventas:</b> "Veo las carpetas compartidas de la oficina, pero no salgo a Internet."', hint: 'Compara <code>ipconfig</code> de PC-VENTAS con la IP real del router. ¿Coincide la puerta de enlace?', check: (n) => can(n, 'vent', '8.8.8.8') },
      { id: 'd4', text: '<b>#4104 RRHH:</b> "Mi cable está bien, pero el PC no tiene red."', hint: 'El LED ámbar indica puerto apagado. Entra al switch: <pre>enable\nconf t\nint fa0/3\n no shut</pre>', check: (n) => can(n, 'rrhh', '192.168.10.1') },
      { id: 'd5', text: '<b>#4105 Gerencia:</b> "<code>ping 8.8.8.8</code> funciona, pero ninguna página abre."', hint: 'Hay Internet, pero no resuelve nombres. Revisa el DNS con <code>ipconfig /all</code> y <code>nslookup example.com</code>.', check: (n) => { const d = byTag(n, 'ger'); return can(n, 'ger', '8.8.8.8') && resolveName(n, d.id, 'example.com', { record: false }).ok; } },
      { id: 'd6', text: '<b>#4106 Toda la oficina:</b> "Nadie encuentra la impresora IMP-1."', hint: 'Mira la IP de IMP-1: ¿está en la misma subred que los demás? Debe quedar en <code>192.168.10.x</code>, sin chocar con otro equipo.', check: (n) => { const d = byTag(n, 'imp'); return d.ifaces.eth0.ip.startsWith('192.168.10.') && ipIsUnique(n, d) && can(n, 'cont', d.ifaces.eth0.ip); } },
    ],
  },
  {
    title: 'Cierre',
    items: [
      { id: 'd7', text: 'Guardar los cambios del router y del switch', hint: '<code>write memory</code> en cada uno: si el arreglo no se guarda, la falla vuelve con el próximo reinicio.', check: (n) => can(n, 'r', '8.8.8.8') && can(n, 'rrhh', '192.168.10.1') && !byTag(n, 'r').dirty && !byTag(n, 'sw').dirty },
    ],
  },
];
const Q_DIAG = [
  {
    q: 'Un usuario dice "no tengo Internet". ¿Cómo debe empezar el técnico?',
    o: [
      'Por capas: enlace físico → ipconfig → ping a la puerta de enlace → ping a Internet → DNS',
      'Reinstalando el sistema operativo',
      'Cambiando el router de una vez',
      'Pidiéndole al usuario que espere hasta mañana',
    ],
    a: 0,
    e: 'Un método por capas evita cambios a ciegas y deja claro en qué punto se rompe la comunicación.',
  },
];

export function diagLab(el, ctx) {
  const key = 'cybervr-lab-diag';
  const begin = () => {
    const net = loadSave(key) || buildDiag();
    workbench(el, {
      net,
      objectives: OBJ_DIAG,
      extraTools: resetTool,
      intro: 'Tienes 6 tickets abiertos. Diagnostica antes de cambiar nada.',
      notes: CHEATSHEET,
      onChange: () => writeSave(key, net),
      onDone: (box) => finishPanel(box, '✔ ¡Todos los tickets cerrados!', 'Continuar →', () => {
        dropSave(key);
        el.innerHTML = '';
        quiz(Q_DIAG, { pass: 1, title: 'Revisión del supervisor' })(el, ctx);
      }),
    });
    bindReset(el, key, begin);
  };
  begin();
}

// ================================================================
//  Sandbox: laboratorio libre y retos
// ================================================================
function buildVlan() {
  const net = createNet();
  const a = tagged(addDevice(net, 'pc', 'PC-ADMIN', 120, 110), 'a');
  const b = tagged(addDevice(net, 'pc', 'PC-VENTAS', 120, 330), 'b');
  const sw = tagged(addDevice(net, 'switch', 'SW-1', 380, 220), 'sw');
  const r = tagged(addDevice(net, 'router', 'R-1', 640, 220), 'r');
  setHostIp(a, '192.168.10.10', '255.255.255.0', '192.168.10.1');
  setHostIp(b, '192.168.20.10', '255.255.255.0', '192.168.20.1');
  addLink(net, a.id, 'eth0', sw.id, 'fa0/1', 'straight');
  addLink(net, b.id, 'eth0', sw.id, 'fa0/2', 'straight');
  addLink(net, sw.id, 'g0/1', r.id, 'g0/0', 'straight');
  return net;
}
function buildRoutes() {
  const net = createNet();
  const a = tagged(addDevice(net, 'pc', 'PC-BOGOTA', 80, 220), 'a');
  const r1 = tagged(addDevice(net, 'router', 'R-BOG', 300, 220), 'r1');
  const r2 = tagged(addDevice(net, 'router', 'R-MED', 500, 220), 'r2');
  const b = tagged(addDevice(net, 'pc', 'PC-MEDELLIN', 720, 220), 'b');
  setHostIp(a, '10.1.0.10', '255.255.255.0', '10.1.0.1');
  setHostIp(b, '10.2.0.10', '255.255.255.0', '10.2.0.1');
  addLink(net, a.id, 'eth0', r1.id, 'g0/0', 'cross');
  addLink(net, b.id, 'eth0', r2.id, 'g0/0', 'cross');
  return net;
}
function buildDhcp() {
  const net = createNet();
  const r = tagged(addDevice(net, 'router', 'R-1', 620, 220), 'r');
  const sw = tagged(addDevice(net, 'switch', 'SW-1', 380, 220), 'sw');
  ['a', 'b', 'c'].forEach((t, i) => {
    const p = tagged(addDevice(net, 'pc', `PC-${i + 1}`, 110, 90 + i * 130), t);
    p.dhcp = true;
    addLink(net, p.id, 'eth0', sw.id, `fa0/${i + 1}`, 'straight');
  });
  addLink(net, sw.id, 'g0/1', r.id, 'g0/0', 'straight');
  return net;
}
const SCENARIOS = {
  free: {
    title: 'Red en blanco',
    desc: 'Agrega los equipos que quieras, cabléalos y configúralos. Sin objetivos ni evaluación.',
    build: createNet,
    editable: true,
  },
  vlan: {
    title: 'Reto: VLAN y router-on-a-stick',
    desc: 'Separa dos departamentos en VLAN distintas y haz que se comuniquen a través del router.',
    build: buildVlan,
    objectives: [{
      title: 'Objetivos',
      items: [
        { id: 'v1', text: 'Crear VLAN 10 y 20 en el switch', hint: '<pre>enable\nconf t\nvlan 10\n name ADMIN\n exit\nvlan 20\n name VENTAS\n exit</pre>', check: (n) => { const v = byTag(n, 'sw').vlans; return v[10] && v[20]; } },
        { id: 'v2', text: 'fa0/1 en VLAN 10 y fa0/2 en VLAN 20', hint: '<pre>int fa0/1\n switchport mode access\n switchport access vlan 10\n exit\nint fa0/2\n switchport mode access\n switchport access vlan 20\n exit</pre>', check: (n) => { const s = byTag(n, 'sw').switchports; return s['fa0/1'].vlan === 10 && s['fa0/2'].vlan === 20; } },
        { id: 'v3', text: 'g0/1 del switch en modo trunk', hint: '<pre>int g0/1\n switchport mode trunk\n exit</pre>', check: (n) => byTag(n, 'sw').switchports['g0/1'].mode === 'trunk' },
        { id: 'v4', text: 'Subinterfaces en el router (g0/0.10 y g0/0.20)', hint: '<pre>enable\nconf t\nint g0/0\n no shut\n exit\nint g0/0.10\n encapsulation dot1q 10\n ip address 192.168.10.1 255.255.255.0\n exit\nint g0/0.20\n encapsulation dot1q 20\n ip address 192.168.20.1 255.255.255.0\n exit</pre>', check: (n) => { const f = byTag(n, 'r').ifaces; return f['g0/0'].up && f['g0/0.10']?.tag === 10 && f['g0/0.20']?.tag === 20; } },
        { id: 'v5', text: 'PC-ADMIN hace ping a PC-VENTAS', hint: '<code>ping 192.168.20.10</code> desde PC-ADMIN.', check: (n) => didPing(n, 'a', '192.168.20.10') },
      ],
    }],
  },
  routes: {
    title: 'Reto: rutas estáticas entre sedes',
    desc: 'Une las sedes de Bogotá y Medellín con un enlace entre routers y rutas estáticas.',
    build: buildRoutes,
    objectives: [{
      title: 'Objetivos',
      items: [
        { id: 'r1', text: 'Enlazar los routers por g0/1', hint: 'Dos routers son equipos iguales: usa cable <b>cruzado</b>.', check: (n) => linked(n, 'r1', 'r2') || routersCabled(n) },
        { id: 'r2', text: 'Configurar LAN (<code>10.1.0.1/24</code> y <code>10.2.0.1/24</code>) en g0/0', hint: '<pre>int g0/0\n ip address 10.1.0.1 255.255.255.0\n no shut</pre>En el otro router usa 10.2.0.1.', check: (n) => byTag(n, 'r1').ifaces['g0/0'].ip === '10.1.0.1' && byTag(n, 'r2').ifaces['g0/0'].ip === '10.2.0.1' && byTag(n, 'r1').ifaces['g0/0'].up && byTag(n, 'r2').ifaces['g0/0'].up },
        { id: 'r3', text: 'Enlace WAN: <code>10.0.0.1/30</code> y <code>10.0.0.2/30</code> en g0/1', hint: '<pre>int g0/1\n ip address 10.0.0.1 255.255.255.252\n no shut</pre>', check: (n) => can(n, 'r1', '10.0.0.2') },
        { id: 'r4', text: 'Ruta en cada router hacia la LAN contraria', hint: 'En R-BOG: <code>ip route 10.2.0.0 255.255.255.0 10.0.0.2</code><br>En R-MED: <code>ip route 10.1.0.0 255.255.255.0 10.0.0.1</code>', check: (n) => byTag(n, 'r1').routes.length > 0 && byTag(n, 'r2').routes.length > 0 },
        { id: 'r5', text: 'PC-BOGOTA hace ping a PC-MEDELLIN', hint: '<code>ping 10.2.0.10</code>. Si falla, recuerda: el regreso también necesita ruta.', check: (n) => didPing(n, 'a', '10.2.0.10') },
      ],
    }],
  },
  dhcp: {
    title: 'Reto: servidor DHCP',
    desc: 'Convierte al router en servidor DHCP para que tres PCs obtengan IP solos.',
    build: buildDhcp,
    objectives: [{
      title: 'Objetivos',
      items: [
        { id: 'h1', text: 'g0/0 del router con <code>192.168.50.1/24</code>', hint: '<pre>enable\nconf t\nint g0/0\n ip address 192.168.50.1 255.255.255.0\n no shut\n exit</pre>', check: (n) => { const f = byTag(n, 'r').ifaces['g0/0']; return f.ip === '192.168.50.1' && f.up; } },
        { id: 'h2', text: 'Pool DHCP para <code>192.168.50.0/24</code>', hint: '<pre>ip dhcp pool LAN\n network 192.168.50.0 255.255.255.0\n default-router 192.168.50.1\n dns-server 8.8.8.8\n exit</pre>', check: (n) => byTag(n, 'r').pools.some((p) => p.net === '192.168.50.0') },
        { id: 'h3', text: 'Los tres PCs reciben IP', hint: 'En cada PC: <code>ipconfig /renew</code>', check: (n) => ['a', 'b', 'c'].every((t) => byTag(n, t).ifaces.eth0.ip.startsWith('192.168.50.')) },
        { id: 'h4', text: 'PC-1 hace ping a su puerta de enlace', hint: '<code>ping 192.168.50.1</code>', check: (n) => didPing(n, 'a', '192.168.50.1') },
      ],
    }],
  },
};
// Dos routers enlazados: el LED puede seguir apagado hasta activar los puertos.
function routersCabled(n) {
  const a = byTag(n, 'r1');
  const b = byTag(n, 'r2');
  return n.links.some((l) => ((l.a.dev === a.id && l.b.dev === b.id) || (l.b.dev === a.id && l.a.dev === b.id)) && l.cable === 'cross');
}

export function sandbox(el) {
  const menu = () => {
    el.innerHTML = `
      <p class="instr">Practica lo que quieras, sin afectar tu XP ni tu progreso. Lo que hagas aquí se guarda en este navegador.</p>
      <div class="scn-grid">${Object.entries(SCENARIOS).map(([k, s]) => `
        <button class="scn-card" data-k="${k}"><b>${s.title}</b><span>${s.desc}</span></button>`).join('')}</div>`;
    el.querySelectorAll('.scn-card').forEach((b) => b.addEventListener('click', () => open(b.dataset.k)));
  };
  const open = (k) => {
    const s = SCENARIOS[k];
    const key = 'cybervr-sbx-' + k;
    const net = loadSave(key) || s.build();
    workbench(el, {
      net,
      editable: s.editable,
      objectives: s.objectives,
      extraTools: `<button class="tool-btn" id="wb-back">← Volver</button>${resetTool}`,
      intro: s.desc,
      notes: CHEATSHEET,
      onChange: () => writeSave(key, net),
      onDone: (box) => {
        box.innerHTML = '<div class="wb-finish"><p class="good">✔ ¡Reto superado! Vuelve al menú para probar otro.</p></div>';
      },
    });
    el.querySelector('#wb-back').addEventListener('click', menu);
    bindReset(el, key, () => open(k));
  };
  menu();
}
