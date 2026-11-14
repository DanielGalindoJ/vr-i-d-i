// ================================================================
//  CyberVR SOC · ARIA, asistente de ayuda 100% local (sin IA externa)
//  - Lee la pantalla para saber en qué paso va el jugador.
//  - Pistas por niveles: primero orienta, al final casi da la respuesta.
//  - Aparece sola si el jugador se equivoca seguido, se queda quieto
//    o lleva mucho tiempo sin llegar a la siguiente misión.
//  - Chat por "intenciones": entiende preguntas libres con palabras clave.
//  - Voz con speechSynthesis (y micrófono si el navegador lo soporta).
// ================================================================

// ---------- Utilidades de texto ----------
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9./ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const plain = (html) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent.replace(/\s+/g, ' ').trim();
};

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

// Puntaje de coincidencia entre un texto y una lista de palabras clave
function score(text, keywords) {
  const t = ' ' + norm(text) + ' ';
  const tokens = t.trim().split(' ');
  let s = 0;
  for (const raw of keywords) {
    const kw = norm(raw);
    if (!kw) continue;
    if (t.includes(' ' + kw + ' ')) s += 2 + kw.split(' ').length;
    else if (!kw.includes(' ') && kw.length >= 5 && tokens.some((w) => w.length >= 4 && lev(w, kw) <= 1)) s += 1.5;
  }
  return s;
}

// ================================================================
//  Base de conocimiento (conceptos)
// ================================================================
const KB = [
  // --- Fundamentos SOC ---
  { k: ['soc', 'security operations center', 'centro de operaciones'], a: 'El <b>SOC</b> es el equipo que vigila la seguridad de la empresa 24/7: monitorea, detecta, analiza y responde a amenazas.' },
  { k: ['tier', 'tier 1', 'tier 2', 'tier 3', 'niveles del soc', 'analista'], a: '<b>Tier 1</b> clasifica alertas (triage) y escala. <b>Tier 2</b> investiga a fondo los incidentes. <b>Tier 3</b> hace threat hunting y análisis avanzado.' },
  { k: ['cia', 'triada', 'confidencialidad', 'integridad', 'disponibilidad'], a: 'La <b>tríada CIA</b>: <b>Confidencialidad</b> (solo quien debe ve la información), <b>Integridad</b> (nadie la altera sin permiso) y <b>Disponibilidad</b> (está cuando se necesita).' },
  { k: ['siem', 'splunk', 'wazuh', 'sentinel', 'correlacion', 'logs'], a: 'Un <b>SIEM</b> centraliza los logs de toda la empresa y los correlaciona para disparar alertas. Ejemplos: Splunk, Wazuh, QRadar, Microsoft Sentinel.' },
  { k: ['falso positivo', 'falso negativo', 'falsos positivos'], a: '<b>Falso positivo</b>: salta la alerta, pero no hay amenaza real. <b>Falso negativo</b>: hay un ataque real y no salta ninguna alerta, y es el más peligroso.' },
  { k: ['ioc', 'indicador de compromiso', 'indicadores'], a: 'Un <b>IoC</b> es evidencia técnica de un compromiso: una IP, un dominio, un hash o un nombre de archivo malicioso.' },
  { k: ['mitre', 'att&ck', 'attack'], a: '<b>MITRE ATT&CK</b> es un catálogo de tácticas y técnicas reales de atacantes. Ejemplo: T1110 = Brute Force, T1566 = Phishing.' },

  // --- Redes ---
  { k: ['osi', 'capas', 'modelo osi', 'capa'], a: 'El <b>modelo OSI</b> tiene 7 capas: 1 Física, 2 Enlace (MAC, switch), 3 Red (IP, router), 4 Transporte (TCP/UDP), 5 Sesión, 6 Presentación y 7 Aplicación.' },
  { k: ['tcp', 'orientado a conexion'], a: '<b>TCP</b> es confiable: establece conexión (handshake), numera los paquetes y reenvía los que se pierden. Lo usan HTTP, HTTPS, SSH y RDP.' },
  { k: ['udp', 'sin conexion'], a: '<b>UDP</b> no establece conexión: es más rápido pero no garantiza la entrega. Lo usan DNS, DHCP, VoIP y streaming.' },
  { k: ['handshake', 'syn', 'ack', 'three way'], a: 'El <b>three-way handshake</b> de TCP: el cliente envía SYN, el servidor responde SYN-ACK y el cliente confirma con ACK.' },
  { k: ['puertos', 'puertos comunes', 'lista de puertos', 'que puertos'], a: 'Puertos clave: <b>21</b> FTP, <b>22</b> SSH, <b>23</b> Telnet, <b>25</b> SMTP, <b>53</b> DNS, <b>80</b> HTTP, <b>443</b> HTTPS, <b>445</b> SMB, <b>3389</b> RDP.' },
  { k: ['ssh', 'secure shell'], a: '<b>SSH</b> es acceso remoto <b>cifrado</b> a servidores. Funciona sobre TCP, puerto <b>22</b>. Telnet hace lo mismo pero sin cifrar (puerto 23).' },
  { k: ['rdp', 'escritorio remoto'], a: '<b>RDP</b> es el escritorio remoto de Windows, puerto <b>3389</b>. Expuesto a Internet es una entrada clásica de ransomware.' },
  { k: ['https', 'http', 'web'], a: '<b>HTTP</b> (puerto 80) es la web sin cifrar. <b>HTTPS</b> (puerto 443) es la web cifrada con TLS.' },
  { k: ['dns', 'resolver nombres', 'nslookup'], a: 'El <b>DNS</b> traduce nombres (example.com) a IPs. Si <code>ping 8.8.8.8</code> funciona pero las páginas no abren, sospecha del DNS. Pruébalo con <code>nslookup</code>.' },
  { k: ['dhcp', 'ip automatica', 'pool', '169.254'], a: 'El <b>DHCP</b> entrega IP, máscara, puerta de enlace y DNS automáticamente. Si un PC queda con <code>169.254.x.x</code>, no recibió respuesta del DHCP.' },
  { k: ['nat', 'overload', 'pat', 'ip publica'], a: 'El <b>NAT</b> deja que toda la LAN (IPs privadas) salga a Internet con la IP pública del router. Se marca <code>ip nat inside</code> en la LAN y <code>ip nat outside</code> en la WAN.' },
  { k: ['arp', 'mac'], a: '<b>ARP</b> averigua la dirección <b>MAC</b> que corresponde a una IP dentro de la LAN. La MAC es la dirección física de la tarjeta de red (capa 2).' },
  { k: ['ip', 'direccion ip', 'ipv4'], a: 'Una <b>IPv4</b> son 4 números de 0 a 255 (ej. 192.168.10.5). Las privadas más comunes son 10.x.x.x, 172.16–31.x.x y 192.168.x.x.' },
  { k: ['mascara', 'subred', 'subnetting', '/24', '/26', '/30', 'hosts'], a: 'Hosts utilizables = 2<sup>(32 − prefijo)</sup> − 2. Por ejemplo: <b>/24</b> → 254, <b>/26</b> → 62, <b>/30</b> → 2 (ideal para enlaces punto a punto). Dos equipos solo se hablan directo si están en la misma subred.' },
  { k: ['puerta de enlace', 'gateway', 'default gateway', 'enlace predeterminado'], a: 'La <b>puerta de enlace</b> es la IP del router en tu LAN. Si está mal, ves los equipos de tu red pero no sales a Internet.' },
  { k: ['router', 'enrutador', 'ruta', 'ruta por defecto', 'ip route'], a: 'El <b>router</b> conecta redes distintas (capa 3). La <b>ruta por defecto</b> <code>ip route 0.0.0.0 0.0.0.0 &lt;ISP&gt;</code> manda al proveedor todo lo que no conoce.' },
  { k: ['switch', 'conmutador', 'switchport'], a: 'El <b>switch</b> conecta equipos de la misma LAN usando direcciones MAC (capa 2). Un puerto en <i>shutdown</i> deja el LED ámbar o apagado.' },
  { k: ['vlan', 'trunk', 'router on a stick', 'subinterfaz'], a: 'Una <b>VLAN</b> divide un switch en redes lógicas separadas. Para que se comuniquen entre sí se necesita un router (router-on-a-stick con subinterfaces) y un enlace <b>trunk</b>.' },
  { k: ['ping', 'icmp'], a: '<code>ping</code> comprueba si un equipo responde. Ve por capas: primero la puerta de enlace, luego otra IP de la LAN, luego 8.8.8.8 y por último un nombre (DNS).' },
  { k: ['tracert', 'traceroute'], a: '<code>tracert</code> muestra cada salto (router) hasta el destino. Donde se corta, ahí está el problema.' },
  { k: ['ipconfig', 'ipconfig /all', 'renew'], a: '<code>ipconfig</code> muestra IP, máscara y puerta de enlace. <code>ipconfig /all</code> agrega DNS y MAC. <code>ipconfig /renew</code> pide IP al DHCP.' },
  { k: ['show ip interface brief', 'show ip int brief', 'administratively down', 'no shutdown', 'no shut'], a: '<code>show ip interface brief</code> lista las interfaces del router o switch. Si una aparece <i>administratively down</i>, actívala con <code>interface X</code> → <code>no shutdown</code>.' },
  { k: ['write memory', 'guardar configuracion', 'copy run start', 'startup'], a: 'Los cambios del router viven en la <i>running-config</i> (RAM). Para que sobrevivan un reinicio: <code>write memory</code> (o <code>copy running-config startup-config</code>).' },
  { k: ['enable', 'configure terminal', 'conf t', 'hostname', 'consola', 'cisco'], a: 'Comandos base del router: <code>enable</code> → <code>configure terminal</code> → (cambios) → <code>end</code> → <code>write memory</code>. Para entrar, se conecta un PC por el cable de <b>consola</b>.' },

  // --- Cableado / hardware ---
  { k: ['t568b', 't568a', 'orden de colores', 'colores del cable', 'norma'], a: '<b>T568B</b>: blanco-naranja, naranja, blanco-verde, azul, blanco-azul, verde, blanco-café, café. <b>T568A</b> intercambia naranja ↔ verde.' },
  { k: ['cable directo', 'directo', 'straight'], a: '<b>Cable directo</b>: la misma norma en los dos extremos (B-B). Sirve para conectar equipos de <i>distinto</i> tipo: PC ↔ switch, switch ↔ router.' },
  { k: ['cable cruzado', 'cruzado', 'crossover'], a: '<b>Cable cruzado</b>: un extremo T568B y el otro T568A. Sirve para equipos del <i>mismo</i> tipo sin Auto-MDIX: switch ↔ switch, PC ↔ PC.' },
  { k: ['ponchar', 'ponchadora', 'crimpadora', 'rj45'], a: 'Para ponchar: pela la chaqueta, ordena los hilos, recórtalos parejo, mete los 8 hasta el fondo del RJ45 (clip hacia abajo, pin 1 a la izquierda) y presiona la ponchadora hasta el final.' },
  { k: ['tester', 'probador'], a: 'El <b>tester</b> enciende los LED pin por pin. En un cable directo se encienden 1-1, 2-2… En uno cruzado, el 1 y el 2 se cruzan con el 3 y el 6.' },
  { k: ['patch panel', 'impacto', '110', 'ponchadora de impacto'], a: 'En el <b>patch panel</b> cada hilo va a la posición de su color y se fija con la <b>herramienta de impacto 110</b>, que también corta el sobrante.' },
  { k: ['ups', 'energia', 'encender', 'orden de encendido'], a: 'El orden de encendido es: <b>energía (UPS) → red (router, switch) → servidores → PCs</b>. El apagado va al revés.' },
  { k: ['bios', 'uefi', 'arranque', 'boot', 'post'], a: 'El <b>POST</b> es la prueba de hardware al encender. En la <b>BIOS/UEFI</b> se configura el orden de arranque y se activan dispositivos como la tarjeta de red.' },

  // --- Ciberseguridad ---
  { k: ['phishing', 'correo falso', 'correo sospechoso'], a: 'Señales de <b>phishing</b>: dominio parecido pero falso, urgencia o amenaza, saludo genérico, que te pidan credenciales, enlaces que apuntan a otro sitio y adjuntos raros.' },
  { k: ['typosquatting', 'dominio falso', 'remitente'], a: 'El <b>typosquatting</b> usa dominios casi iguales al real (un <b>0</b> por una <b>o</b>, una letra de más). Compáralo letra por letra.' },
  { k: ['doble extension', '.exe', 'adjunto', 'pdf.exe'], a: 'Un archivo <code>factura.pdf.exe</code> es un <b>ejecutable disfrazado</b>: Windows oculta la extensión real y el usuario solo ve "factura.pdf".' },
  { k: ['fuerza bruta', 'brute force', 'diccionario', 'intentos fallidos'], a: 'La <b>fuerza bruta</b> prueba muchas contraseñas seguidas. En los logs se ve como muchos FALLO desde la misma IP en pocos segundos. Se mitiga con MFA, bloqueo por intentos y contraseñas robustas.' },
  { k: ['severidad', 'critica', 'prioridad'], a: 'La <b>severidad</b> depende del impacto: si el atacante <i>logró entrar</i> (un login exitoso tras los fallos) o ejecutó comandos, es <b>crítica</b>.' },
  { k: ['escalar', 'escalamiento', 'triage'], a: 'El Tier 1 <b>documenta, escala</b> a Tier 2 y pide contención (bloquear IP, aislar host). Nunca cierra una alerta real como falso positivo ni reinicia sin avisar.' },
  { k: ['firewall', 'cortafuegos', 'regla', 'deny', 'allow', 'iptables', 'inbound', 'outbound'], a: 'Una regla de <b>firewall</b> tiene: acción (ALLOW/DENY), dirección (INBOUND = entra a tu red, OUTBOUND = sale), protocolo, origen y puerto destino. En Linux: <code>iptables -A INPUT ... -j DROP</code>.' },
  { k: ['default deny', 'lista blanca', 'politica por defecto'], a: 'La política más segura es <b>default deny</b>: negar todo y permitir solo lo necesario.' },
  { k: ['netstat', 'conexiones activas'], a: '<code>netstat -ano</code> lista las conexiones activas con el <b>PID</b> del proceso dueño. Busca conexiones ESTABLISHED a IPs externas en puertos raros.' },
  { k: ['tasklist', 'procesos'], a: '<code>tasklist</code> lista los procesos con su PID. El malware suele imitar nombres legítimos (por ejemplo <i>svch0st.exe</i> con un cero).' },
  { k: ['taskkill', 'matar proceso', 'terminar proceso'], a: '<code>taskkill /PID &lt;número&gt; /F</code> termina un proceso; <b>/F</b> lo fuerza. Asegúrate de que sea el malicioso: matar uno legítimo afecta al usuario.' },
  { k: ['c2', 'comando y control', 'reverse shell', 'rat', '4444', 'metasploit', 'troyano'], a: 'Un <b>C2</b> (comando y control) es el canal por el que el atacante controla un equipo infectado. El puerto <b>4444</b> es el que usa Metasploit por defecto.' },
  { k: ['ransomware', 'cifrado de archivos', 'rescate'], a: 'Ante un <b>ransomware</b>: <b>aislar</b> el equipo de la red primero (sin apagarlo, para conservar la evidencia en RAM). Nunca se recomienda pagar.' },
  { k: ['respuesta a incidentes', 'fases', 'nist', 'sans', 'contencion', 'erradicacion', 'recuperacion', 'lecciones aprendidas', 'preparacion'], a: 'Las fases de respuesta a incidentes son: <b>Preparación → Identificación → Contención → Erradicación → Recuperación → Lecciones aprendidas</b>. Antes, durante y después.' },
  { k: ['cadena de custodia', 'evidencia', 'forense'], a: 'La <b>cadena de custodia</b> registra quién tuvo la evidencia, cuándo y qué hizo con ella, para que sea válida legalmente. Se usan hashes para probar que no cambió.' },
  { k: ['hash', 'sha256', 'sha-256', 'md5', 'integridad de archivo'], a: 'Un <b>hash</b> es la huella de un archivo: si cambia un solo bit, el hash cambia por completo. Sirve para verificar integridad. No es cifrado.' },
  { k: ['aes', 'rsa', 'simetrico', 'asimetrico', 'cifrado'], a: '<b>Simétrico</b> (AES): la misma llave cifra y descifra. <b>Asimétrico</b> (RSA, ECC): una llave pública y otra privada.' },
  { k: ['mfa', '2fa', 'doble factor', 'autenticacion'], a: 'El <b>MFA</b> pide algo que sabes (contraseña) más algo que tienes (código, app) o eres (huella). Aunque roben la contraseña, falta el segundo factor.' },
  { k: ['minimo privilegio', 'privilegios', 'permisos'], a: '<b>Mínimo privilegio</b>: cada usuario solo tiene los permisos que necesita para su trabajo. Si su cuenta cae, el daño es menor.' },
  { k: ['ddos', 'denegacion de servicio'], a: 'Un <b>DDoS</b> satura un servicio con tráfico desde muchas fuentes. Ataca la <b>disponibilidad</b>.' },
  { k: ['edr', 'antivirus', 'endpoint'], a: 'El <b>EDR</b> vigila el comportamiento de los equipos (endpoints), detecta actividad sospechosa y permite aislarlos y responder a distancia.' },
];

// Pistas por paso del taller de cableado y de las fases del lab completo
const STEP_TIPS = [
  { k: ['mesa de trabajo', 'herramientas'], tip: 'Para un cable necesitas: cable UTP, conectores RJ45, pelacables, ponchadora y tester. Ni RJ11 (es de teléfono), ni coaxial, ni cautín.' },
  { k: ['ordena los hilos', 't568b'], tip: 'T568B: blanco-naranja, naranja, blanco-verde, azul, blanco-azul, verde, blanco-café, café. Ojo: el azul va en el pin 4 y el verde en el 6.' },
  { k: ['t568a'], tip: 'T568A: blanco-verde, verde, blanco-naranja, azul, blanco-azul, naranja, blanco-café, café. Es T568B intercambiando naranja con verde.' },
  { k: ['recorta'], tip: 'Corta lo justo: los hilos deben llegar al fondo del conector y la chaqueta debe quedar adentro, apretada por la traba.' },
  { k: ['inserta', 'rj45'], tip: 'Clip hacia abajo y contactos dorados hacia ti: así el pin 1 queda a la izquierda.' },
  { k: ['poncha el conector'], tip: 'Mantén la ponchadora presionada hasta el final. Si la sueltas antes, los contactos no perforan el aislante.' },
  { k: ['tester'], tip: 'En el tester, si un LED no prende o se prende en otro orden, ese extremo quedó mal ordenado o mal ponchado: toca rehacerlo.' },
  { k: ['cable cruzado'], tip: 'Para el cruzado deja el extremo A en T568B y rehaz solo el B en T568A.' },
  { k: ['patch panel'], tip: 'Cada hilo va a la posición de su mismo color en el patch panel; la herramienta de impacto lo fija y corta el sobrante.' },
  { k: ['enciende la infraestructura', 'sala de equipos'], tip: 'Orden correcto: primero la UPS (energía), luego router y switch, y al final tu PC.' },
  { k: ['bios'], tip: 'En la BIOS revisa que la tarjeta de red esté habilitada y que el disco esté primero en el orden de arranque. Luego guarda y sal.' },
  { k: ['post'], tip: 'El POST revisa el hardware. Si muestra un error, lee el mensaje: casi siempre indica qué ajustar en la BIOS.' },
  { k: ['sesion', 'login', 'usuario'], tip: 'Inicia sesión con el usuario que te indica la pantalla. Si no lo ves, revisa el texto de la instrucción.' },
  { k: ['apagado', 'apagar', 'cierre'], tip: 'El apagado va al revés del encendido: primero guarda la configuración y apaga el PC, al final la red y la energía.' },
];

const PHISH_PARTS = { from: 'el remitente', subject: 'el asunto', greet: 'el saludo', body: 'el párrafo que pide datos', link: 'el botón azul (pasa el mouse por encima)', attach: 'el adjunto' };
const IR_PHASES = ['Preparación', 'Identificación / Detección', 'Contención', 'Erradicación', 'Recuperación', 'Lecciones aprendidas'];

// ================================================================
//  Fábrica del asistente
// ================================================================
export function createAssistant(hooks) {
  const PREFS_KEY = 'cybervr-aria';
  const prefs = (() => {
    try {
      return Object.assign({ voice: false, auto: true }, JSON.parse(localStorage.getItem(PREFS_KEY)) || {});
    } catch {
      return { voice: false, auto: true };
    }
  })();
  const savePrefs = () => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch { /* sin almacenamiento */ }
  };

  // ---------- Estado interno ----------
  let open = false;
  let level = 0; // nivel de pista para el paso actual
  let stepKey = '';
  let errTimes = []; // momentos de los errores recientes
  let errMission = null;
  let lastActivity = Date.now();
  let lastProactive = 0;
  let lastMovePos = null;
  let lastMoveAt = Date.now();
  let lostSince = Date.now();
  let lastDone = -1;
  let greeted = false;
  const COOLDOWN = 45000;

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.id = 'aria';
  root.className = 'hidden';
  root.innerHTML = `
    <div id="aria-bubble" class="hidden">
      <div class="aria-bubble-text"></div>
      <div class="aria-bubble-actions">
        <button data-act="hint">💡 Dame una pista</button>
        <button data-act="chat">💬 Abrir chat</button>
        <button data-act="close">✕</button>
      </div>
    </div>
    <div id="aria-panel" class="hidden">
      <header>
        <div class="aria-avatar">🤖</div>
        <div class="aria-title"><b>ARIA</b><small id="aria-ctx">Asistente del SOC</small></div>
        <button id="aria-voice" title="Voz"></button>
        <button id="aria-auto" title="Ayuda automática"></button>
        <button id="aria-close" title="Cerrar (Esc)">✕</button>
      </header>
      <div id="aria-msgs"></div>
      <div id="aria-chips"></div>
      <form id="aria-form" autocomplete="off">
        <input id="aria-input" placeholder="Pregúntame lo que sea… (ej: ¿qué hago?)" maxlength="200">
        <button type="button" id="aria-mic" title="Hablar" class="hidden">🎤</button>
        <button type="submit">➤</button>
      </form>
    </div>
    <button id="aria-fab" title="ARIA · Asistente (tecla H)"><span class="aria-dot"></span>🤖 <b>ARIA</b> <kbd>H</kbd></button>`;
  document.body.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const panel = $('#aria-panel');
  const bubble = $('#aria-bubble');
  const msgs = $('#aria-msgs');
  const input = $('#aria-input');

  const renderToggles = () => {
    $('#aria-voice').textContent = prefs.voice ? '🔊' : '🔈';
    $('#aria-voice').title = prefs.voice ? 'Voz activada' : 'Voz desactivada';
    $('#aria-auto').textContent = prefs.auto ? '🔔' : '🔕';
    $('#aria-auto').title = prefs.auto ? 'Ayuda automática activada' : 'Ayuda automática desactivada';
  };
  renderToggles();

  // ---------- Voz ----------
  const canSpeak = 'speechSynthesis' in window;
  function speak(html) {
    if (!prefs.voice || !canSpeak) return;
    const u = new SpeechSynthesisUtterance(plain(html).replace(/[🤖💡🔒✔✘👋🎯➡️⬅️⬆️⬇️🚩]/gu, ''));
    u.lang = 'es-ES';
    const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.toLowerCase().startsWith('es'));
    if (v) u.voice = v;
    u.rate = 1.05;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const mic = $('#aria-mic');
    mic.classList.remove('hidden');
    mic.addEventListener('click', () => {
      const rec = new SR();
      rec.lang = 'es-CO';
      rec.interimResults = false;
      mic.classList.add('rec');
      rec.onresult = (e) => ask(e.results[0][0].transcript);
      rec.onend = () => mic.classList.remove('rec');
      rec.onerror = () => mic.classList.remove('rec');
      rec.start();
    });
  }

  // ---------- Mensajes ----------
  function addMsg(html, who = 'aria') {
    const d = document.createElement('div');
    d.className = 'aria-msg ' + who;
    d.innerHTML = html;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function reply(html, chips) {
    addMsg(html, 'aria');
    speak(html);
    setChips(chips);
  }
  function setChips(list) {
    const items = list || defaultChips();
    $('#aria-chips').innerHTML = items.map((c) => `<button>${c}</button>`).join('');
    $('#aria-chips').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => ask(b.textContent)));
  }
  function defaultChips() {
    const c = readScreen();
    if (c.type === 'world') return ['¿Qué hago ahora?', '¿Dónde está mi misión?', '¿Cómo me muevo?'];
    if (c.type === 'quiz') return ['Dame una pista', 'Explícame el tema', '¿Qué hago ahora?'];
    return ['¿Qué hago ahora?', 'Dame una pista', 'Explícame el tema'];
  }

  // ================================================================
  //  Lector de contexto: ¿qué está viendo el jugador?
  // ================================================================
  function readScreen() {
    const s = hooks.getState();
    if (!s.started) return { type: 'intro', key: 'intro' };
    const mid = hooks.getMissionId();
    const m = mid ? hooks.missions.find((x) => x.id === mid) : null;
    if (!s.modalOpen || !m) return { type: 'world', key: 'world', s };
    const body = document.getElementById('modal-body');
    const base = { m, mid, s };

    if (body.querySelector('.success')) return { ...base, type: 'success', key: mid + ':success' };
    if (body.querySelector('.brief')) return { ...base, type: 'brief', key: mid + ':brief' };

    // Quiz activo (el motor de quiz expone la pregunta en el contenedor)
    const qEls = [...body.querySelectorAll('.q-text')];
    for (const qEl of qEls) {
      const holder = qEl.parentElement;
      const info = holder && holder.ariaQuiz;
      if (!info || norm(plain(info.q)) !== norm(qEl.textContent)) continue;
      const answered = !!holder.querySelector('.opt:disabled');
      return { ...base, type: answered ? 'feedback' : 'quiz', key: mid + ':q:' + info.q, info, holder };
    }
    const failed = body.querySelector('.result .bad');
    if (failed) return { ...base, type: 'failed', key: mid + ':failed' };

    // Misiones del SOC con interfaz propia
    if (mid === 'phishing' && body.querySelector('#ioc-count')) {
      const found = +body.querySelector('#ioc-count').textContent;
      const missing = Object.keys(PHISH_PARTS).filter((id) => !body.querySelector(`.part[data-id="${id}"].flagged`));
      return { ...base, type: 'phishing', key: mid + ':' + found, found, missing };
    }
    if (mid === 'siem' && body.querySelector('#siem-step') && !body.querySelector('#siem-q')) return { ...base, type: 'siem', key: 'siem:rows' };
    if (mid === 'firewall' && body.querySelector('#fw-apply') && !body.querySelector('#fw-apply').disabled) {
      const v = (id) => (body.querySelector('#fw-' + id)?.value || '').trim();
      return { ...base, type: 'firewall', key: 'fw', vals: { act: v('act'), dir: v('dir'), proto: v('proto'), src: v('src'), port: v('port') } };
    }
    if (mid === 'hunting' && body.querySelector('#t-in') && !body.querySelector('#t-in').disabled) {
      const ok = (id) => !!body.querySelector('#o-' + id + '.ok');
      const pending = ['net', 'task', 'kill'].find((id) => !ok(id));
      return { ...base, type: 'hunting', key: 'hunt:' + pending, pending };
    }
    if (mid === 'ir' && body.querySelector('#ir-pool') && body.querySelectorAll('#ir-plan .ir-card').length < 6) {
      const placed = body.querySelectorAll('#ir-plan .ir-card').length;
      return { ...base, type: 'ir', key: 'ir:' + placed, placed };
    }

    // Laboratorios con lista de objetivos
    const obj = body.querySelector('li[data-obj]:not(.ok)');
    if (obj) {
      const text = plain(obj.querySelector('.obj-text')?.innerHTML || obj.innerHTML);
      const hintEl = obj.querySelector('.obj-hint');
      let hint = '';
      if (hintEl) {
        const clone = hintEl.cloneNode(true);
        clone.querySelector('summary')?.remove();
        hint = clone.innerHTML.trim();
      }
      return { ...base, type: 'objective', key: mid + ':obj:' + obj.dataset.obj, text, hint };
    }

    // Pasos guiados (taller de cableado) y fases (lab completo)
    const step = body.querySelector('.q-text');
    if (step) {
      const instr = step.parentElement.querySelector('.instr');
      return { ...base, type: 'step', key: mid + ':step:' + step.textContent, title: step.textContent, instr: instr ? instr.innerHTML : '' };
    }
    const stage = body.querySelector('.stage-head');
    if (stage) {
      const title = stage.querySelector('h3')?.textContent || '';
      const instr = stage.querySelector('.instr')?.innerHTML || '';
      return { ...base, type: 'stage', key: mid + ':stage:' + title, title, instr };
    }
    return { ...base, type: 'generic', key: mid + ':generic' };
  }

  // ---------- Conceptos relacionados con un texto ----------
  function concept(text) {
    let best = null;
    let bestScore = 0;
    for (const it of KB) {
      const sc = score(text, it.k);
      if (sc > bestScore) {
        best = it;
        bestScore = sc;
      }
    }
    return bestScore >= 2 ? best.a : '';
  }
  function stepTip(text) {
    let best = null;
    let bestScore = 0;
    for (const it of STEP_TIPS) {
      const sc = score(text, it.k);
      if (sc > bestScore) {
        best = it;
        bestScore = sc;
      }
    }
    return bestScore >= 2 ? best.tip : '';
  }

  // ---------- Dirección hacia la siguiente misión ----------
  function directions() {
    const w = hooks.getWorld();
    const n = hooks.getNext();
    if (!n) return '¡Ya completaste todo! Si quieres ver tu certificado, habla con el <b>Director</b> frente al video wall.';
    if (!w || !w.target) return `Tu siguiente misión: <b>${n.title}</b>. ${n.objective}`;
    const tx = w.target.x - w.x;
    const tz = w.target.z - w.z;
    const dist = Math.hypot(tx, tz);
    if (dist < 3) return `¡Ya estás junto a <b>${n.short}</b>! Mírala y presiona <kbd>E</kbd> (o el gatillo en VR).`;
    const ux = tx / dist;
    const uz = tz / dist;
    const front = ux * w.dx + uz * w.dz;
    const side = ux * -w.dz + uz * w.dx;
    let dir = front > 0.85 ? 'justo al frente' : front < -0.5 ? 'detrás de ti' : side > 0 ? 'a tu derecha' : 'a tu izquierda';
    if (front > 0.4 && front <= 0.85) dir = side > 0 ? 'al frente, un poco a la derecha' : 'al frente, un poco a la izquierda';
    return `Tu siguiente misión es <b>${n.title}</b>, ${dir} a unos ${Math.round(dist)} m. ${n.objective} Sigue el <b>anillo azul</b> en el piso.`;
  }

  const zoneName = (z) => ({ lobby: 'el lobby', soc: 'la sala del SOC', lab: 'el Laboratorio de Redes' }[z] || 'CyberCorp');

  // ================================================================
  //  "¿Qué hago ahora?": descripción del paso actual
  // ================================================================
  function whatNow() {
    const c = readScreen();
    switch (c.type) {
      case 'intro': return 'Escribe tu nombre y presiona <b>Ponerse las gafas VR</b> para empezar.';
      case 'world': {
        const w = hooks.getWorld();
        return `Estás en ${zoneName(w && w.zone)}. ${directions()}`;
      }
      case 'brief': return `Estás en <b>${c.m.title}</b>. Lee el objetivo y presiona <b>Comenzar</b> cuando estés listo/a.`;
      case 'success': return '¡Misión completada! 🎉 Presiona el botón verde para volver y seguir con la siguiente.';
      case 'quiz': return `Responde la pregunta: "<i>${c.info.q}</i>". Si dudas, pídeme una pista: te ayudo sin darte la respuesta de una.`;
      case 'feedback': return 'Ya respondiste. Lee la explicación (ahí se aprende) y presiona <b>Siguiente</b>.';
      case 'failed': return 'No alcanzaste el puntaje mínimo. Tranquilo/a: las explicaciones te ayudan. Presiona <b>Reintentar</b>.';
      case 'phishing': return `Busca los indicadores de phishing en el correo: llevas <b>${c.found}/6</b>. Haz clic en cada parte que te parezca sospechosa.`;
      case 'siem': return 'Revisa la tabla de logs y haz clic en una línea que pertenezca a la <b>IP atacante</b>.';
      case 'firewall': return 'Llena la regla de firewall (acción, dirección, protocolo, IP origen y puerto) para bloquear el SSH del atacante y presiona <b>Aplicar regla</b>.';
      case 'hunting': return { net: 'Primero revisa las conexiones de red activas en la terminal.', task: 'Ahora identifica qué proceso es el dueño de la conexión sospechosa.', kill: 'Ya sabes cuál es: termina el proceso malicioso.' }[c.pending];
      case 'ir': return `Ordena las fases de respuesta a incidentes: llevas <b>${c.placed}/6</b>. Haz clic en la que va en la posición ${c.placed + 1}.`;
      case 'objective': return `Tu objetivo ahora: <b>${c.text}</b>`;
      case 'step': return `Paso actual: <b>${c.title}</b>. ${c.instr}`;
      case 'stage': return `<b>${c.title}</b>. ${c.instr}`;
      default: return `Estás en <b>${c.m.title}</b>. ${c.m.brief}`;
    }
  }

  // ================================================================
  //  Pistas por niveles
  // ================================================================
  function hint() {
    const c = readScreen();
    if (c.key !== stepKey) {
      stepKey = c.key;
      level = 0;
    }
    level = Math.min(level + 1, 3);
    const L = level;
    const tag = `<span class="aria-lvl">Pista ${L}/3</span> `;
    const more = L < 3 ? ' <small>(Pide otra pista si necesitas más)</small>' : '';

    switch (c.type) {
      case 'intro':
      case 'world':
      case 'brief':
      case 'success':
      case 'feedback':
      case 'failed':
        level = 0;
        return whatNow();

      case 'quiz': {
        const info = c.info;
        if (L === 1) return tag + 'Lee la pregunta con calma e identifica la <b>palabra clave</b> (un protocolo, un puerto, una fase…). Luego descarta las opciones que suenan absurdas.' + more;
        if (L === 2) {
          const wrong = [...c.holder.querySelectorAll('.opt')].filter((b) => !info.opts[+b.dataset.k].ok && !b.disabled);
          const discard = wrong.slice(0, Math.max(1, wrong.length - 1));
          discard.forEach((b) => b.classList.add('aria-discard'));
          return tag + `Comodín 50/50: puedes descartar ${discard.map((b) => `"<i>${b.textContent}</i>"`).join(' y ')}. Las tacho en pantalla.` + more;
        }
        return tag + (concept(info.q) || 'Repasa con calma: si fallas, la explicación te dice por qué y puedes reintentar.');
      }

      case 'phishing': {
        if (L === 1) return tag + 'Revisa cada parte del correo: <b>remitente, asunto, saludo, cuerpo, enlace y adjunto</b>. ¿Cuál de ellas haría sospechar a un banco real?' + more;
        if (L === 2) return tag + 'Compara el dominio letra por letra, pasa el mouse por el botón azul y mira la barra de abajo, y fíjate bien en la extensión del adjunto.' + more;
        return tag + (c.missing.length ? `Te falta marcar: <b>${c.missing.map((id) => PHISH_PARTS[id]).join(', ')}</b>.` : 'Ya los tienes todos.');
      }

      case 'siem':
        if (L === 1) return tag + 'Busca un <b>patrón</b>: muchas líneas con resultado FALLO, seguidas y en pocos segundos.' + more;
        if (L === 2) return tag + 'Mira la columna <b>IP origen</b>: las IP internas empiezan por 10.x. ¿Cuál IP externa se repite muchas veces?' + more;
        return tag + 'La IP atacante es <b>185.220.101.47</b>. Haz clic en cualquiera de sus líneas.';

      case 'firewall': {
        const v = c.vals;
        const checks = [
          ['Acción', v.act === 'DENY', 'DENY (queremos bloquear)'],
          ['Dirección', v.dir === 'INBOUND', 'INBOUND (el ataque entra desde Internet)'],
          ['Protocolo', v.proto === 'TCP', 'TCP (SSH funciona sobre TCP)'],
          ['IP origen', v.src === '185.220.101.47', '185.220.101.47'],
          ['Puerto destino', v.port === '22', '22 (SSH)'],
        ];
        const bad = checks.filter((x) => !x[1]);
        if (!bad.length) return tag + 'La regla se ve bien. Presiona <b>Aplicar regla</b>.';
        if (L === 1) return tag + 'Pregúntate: ¿quiero <b>bloquear o permitir</b>? ¿El tráfico <b>entra o sale</b>? ¿Qué <b>protocolo y puerto</b> usa SSH?' + more;
        if (L === 2) return tag + `Tienes ${bad.length} campo(s) por corregir: <b>${bad.map((x) => x[0]).join(', ')}</b>.` + more;
        return tag + `${bad[0][0]} debe ser <b>${bad[0][2]}</b>.`;
      }

      case 'hunting': {
        const H = {
          net: ['¿Qué comando muestra las conexiones de red activas?', 'Usa <code>netstat</code> con <code>-ano</code> para ver también el PID.', 'Escribe: <code>netstat -ano</code>'],
          task: ['Hay una conexión a una IP externa en un puerto raro. ¿Qué proceso es su dueño?', 'Usa <code>tasklist</code> y busca un nombre que imite a uno legítimo.', 'Es <b>svch0st.exe</b> (con un cero), con PID <b>4412</b>.'],
          kill: ['Ya sabes cuál es: toca terminarlo a la fuerza.', 'Usa <code>taskkill</code> con <code>/PID</code> y <code>/F</code>.', 'Escribe: <code>taskkill /PID 4412 /F</code>'],
        }[c.pending];
        return tag + H[L - 1] + more;
      }

      case 'ir': {
        const nextPhase = IR_PHASES[c.placed];
        if (L === 1) return tag + 'Piensa en el orden natural: lo que se hace <b>antes</b> del incidente, <b>durante</b> el incidente y <b>después</b>.' + more;
        if (L === 2) return tag + `La fase ${c.placed + 1} ${c.placed === 0 ? 'ocurre antes de que pase nada' : c.placed >= 4 ? 'es de cierre: volver a la normalidad o aprender' : 'ocurre cuando ya detectaste el ataque'}.` + more;
        return tag + `La siguiente es <b>${nextPhase}</b>.`;
      }

      case 'objective': {
        if (L === 1) return tag + `Objetivo: <b>${c.text}</b>. ¿Qué equipo o comando crees que lo resuelve?` + more;
        if (L === 2) return tag + (concept(c.text) || 'Revisa el diagrama: el estado de los LED y los cables te dice mucho.') + more;
        return tag + (c.hint || concept(c.text) || 'Prueba paso a paso y verifica con ping.');
      }

      case 'step':
      case 'stage': {
        if (L === 1) return tag + `Lee con calma la instrucción: ${c.instr || c.title}` + more;
        if (L === 2) return tag + (concept(c.title + ' ' + plain(c.instr)) || 'Fíjate en los detalles en negrita de la instrucción.') + more;
        return tag + (stepTip(c.title + ' ' + plain(c.instr)) || concept(c.title) || 'Si te equivocas, el simulador te deja repetir: no pasa nada.');
      }

      default:
        return tag + (concept(c.m.title + ' ' + c.m.brief) || whatNow());
    }
  }

  // ---------- Explicar el tema de la pantalla actual ----------
  function explainCurrent() {
    const c = readScreen();
    let text = '';
    if (c.type === 'quiz') text = c.info.q;
    else if (c.type === 'objective') text = c.text;
    else if (c.type === 'step' || c.type === 'stage') text = c.title + ' ' + plain(c.instr);
    else if (c.m) text = c.m.title + ' ' + c.m.learn.join(' ');
    const a = concept(text);
    return a || 'No tengo una explicación para esta parte. Pregúntame por un concepto concreto, por ejemplo: "¿qué es DHCP?".';
  }

  // ================================================================
  //  Intenciones del chat
  // ================================================================
  const INTENTS = [
    { k: ['hola', 'buenas', 'hey', 'quien eres', 'que eres'], a: () => `¡Hola${hooks.getState().name ? ' ' + hooks.getState().name : ''}! Soy <b>ARIA</b>, tu asistente del SOC. Pregúntame qué hacer, pídeme una pista o pregúntame por un concepto (DNS, firewall, phishing…).` },
    { k: ['gracias', 'listo', 'genial', 'perfecto', 'ok'], a: () => '¡Con gusto! Aquí estoy si te vuelves a enredar. 💪' },
    { k: ['pista', 'hint', 'ayudame con esto', 'una ayuda', 'otra pista', 'dame una pista'], a: hint },
    { k: ['que hago', 'que tengo que hacer', 'que sigue', 'ayuda', 'perdido', 'no se', 'atascado', 'como sigo', 'estoy perdido', 'no entiendo que hacer'], a: whatNow },
    { k: ['explicame', 'explica', 'no entiendo', 'el tema', 'explicame el tema', 'de que se trata'], a: explainCurrent },
    { k: ['donde estoy', 'donde', 'donde esta', 'mision', 'siguiente mision', 'a donde voy', 'como llego'], a: () => missionWhere() },
    { k: ['como me muevo', 'controles', 'teclas', 'mover', 'caminar', 'mouse'], a: () => '<kbd>W A S D</kbd> para moverte, <kbd>Shift</kbd> para correr, el mouse para mirar, <kbd>E</kbd> para interactuar y <kbd>Esc</kbd> para soltar el mouse. <kbd>H</kbd> me abre a mí. En VR: el joystick para caminar y el gatillo para interactuar.' },
    { k: ['vr', 'gafas', 'realidad virtual', 'oculus', 'quest'], a: () => 'Con gafas compatibles, el juego entra a VR al empezar. Las misiones se abren en la pantalla del navegador; al cerrarlas vuelves a VR. Mis avisos te llegan como mensaje flotante (y con voz si la activas 🔊).' },
    { k: ['certificado', 'diploma', 'titulo'], a: () => 'El certificado sale al aprobar el <b>examen final</b> con el Director (mínimo 70%). Si ya lo aprobaste, vuelve a hablar con él y presiona "Ver mi certificado".' },
    { k: ['xp', 'rango', 'nivel', 'puntos', 'progreso'], a: () => `Llevas <b>${hooks.getState().done.length}/${hooks.missions.filter((m) => m.xp).length}</b> misiones. Cada misión completada da XP y te sube de rango, de Pasante a Ingeniero/a SOC Certificado/a.` },
    { k: ['guardar', 'se guarda', 'perder progreso'], a: () => 'Tu progreso se guarda solo en este navegador. Los laboratorios grandes también guardan tu avance aunque salgas a mitad.' },
    { k: ['respuesta', 'respuestas', 'dime la respuesta', 'cual es la correcta'], a: () => 'No te doy la respuesta directa 😉, pero te ayudo a llegar: pídeme una <b>pista</b>. La 2 y la 3 van más directo.' },
  ];

  function missionWhere() {
    const asked = lastQuestion;
    const m = hooks.missions.find((x) => score(asked, [x.id, x.title, x.short.replace(/^[\w\d]+ · /, '')]) >= 2);
    if (m && m.objective) return `<b>${m.title}</b>: ${m.objective}`;
    const c = readScreen();
    if (c.type !== 'world') return `Estás dentro de <b>${c.m.title}</b>. ${whatNow()}`;
    return whatNow();
  }

  let lastQuestion = '';
  function answer(q) {
    lastQuestion = q;
    let best = null;
    let bestScore = 0;
    for (const it of INTENTS) {
      const sc = score(q, it.k);
      if (sc > bestScore) {
        best = it;
        bestScore = sc;
      }
    }
    // Un concepto concreto gana sobre una intención genérica débil
    let kb = null;
    let kbScore = 0;
    for (const it of KB) {
      const sc = score(q, it.k);
      if (sc > kbScore) {
        kb = it;
        kbScore = sc;
      }
    }
    if (kb && kbScore >= 2 && kbScore >= bestScore) return kb.a;
    if (best && bestScore >= 1.5) return best.a();
    return 'Mmm, no entendí del todo 🤔. Puedes preguntarme <b>"¿qué hago ahora?"</b>, pedirme <b>"una pista"</b> o preguntarme por un concepto, por ejemplo "¿qué es NAT?" o "¿qué puerto usa SSH?".';
  }

  function ask(text) {
    const q = String(text || '').trim();
    if (!q) return;
    addMsg(q.replace(/[<>]/g, ''), 'user');
    reply(answer(q));
  }

  // ================================================================
  //  Abrir / cerrar panel
  // ================================================================
  function setOpen(v) {
    open = v;
    panel.classList.toggle('hidden', !open);
    bubble.classList.add('hidden');
    root.classList.toggle('open', open);
    if (open) {
      hooks.onOpen && hooks.onOpen();
      const c = readScreen();
      $('#aria-ctx').textContent = c.m ? `Estás en: ${c.m.title}` : c.type === 'world' ? `Explorando ${zoneName(hooks.getWorld()?.zone)}` : 'Asistente del SOC';
      if (!msgs.children.length) reply(INTENTS[0].a());
      else setChips();
      setTimeout(() => input.focus(), 30);
    } else {
      if (canSpeak) speechSynthesis.cancel();
      hooks.onClose && hooks.onClose();
    }
  }
  const toggle = () => setOpen(!open);

  $('#aria-fab').addEventListener('click', toggle);
  $('#aria-close').addEventListener('click', () => setOpen(false));
  $('#aria-voice').addEventListener('click', () => {
    prefs.voice = !prefs.voice;
    savePrefs();
    renderToggles();
    if (prefs.voice) speak('Voz activada.');
  });
  $('#aria-auto').addEventListener('click', () => {
    prefs.auto = !prefs.auto;
    savePrefs();
    renderToggles();
    addMsg(prefs.auto ? 'Listo: te aviso si te veo enredado/a. 🔔' : 'Ok, solo te ayudo cuando me llames (tecla H). 🔕', 'aria');
  });
  $('#aria-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = '';
    ask(v);
  });
  // Que escribir en el chat no mueva al jugador ni dispare atajos del juego
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') setOpen(false);
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());

  // ---------- Burbuja proactiva ----------
  // cooldown: false = saludo inicial (no cuenta para la espera entre avisos)
  function proactive(html, withHint = true, { cooldown = true, sticky = false } = {}) {
    if (!prefs.auto || open) return;
    const now = Date.now();
    if (cooldown) {
      if (now - lastProactive < COOLDOWN) return;
      lastProactive = now;
    }
    const s = hooks.getState();
    if (s.vr) {
      hooks.toast('🤖 ARIA: ' + html);
      speak(html);
      return;
    }
    bubble.querySelector('.aria-bubble-text').innerHTML = '🤖 ' + html;
    bubble.dataset.sticky = sticky ? '1' : '';
    bubble.querySelector('[data-act="hint"]').classList.toggle('hidden', !withHint);
    bubble.classList.remove('hidden');
    root.classList.add('ping');
    setTimeout(() => root.classList.remove('ping'), 1200);
    speak(html);
  }
  bubble.addEventListener('click', (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    bubble.classList.add('hidden');
    if (act === 'chat') setOpen(true);
    if (act === 'hint') {
      setOpen(true);
      addMsg('Dame una pista', 'user');
      reply(hint());
    }
  });

  // ================================================================
  //  Detección de errores y avance (observando la misión)
  // ================================================================
  const ERR_SEL = '.opt.wrong, .found-list li.bad, .term-out .err, .hints li.bad, .part.nope';
  const modalBody = document.getElementById('modal-body');
  let checkTimer = null;
  const obs = new MutationObserver((list) => {
    let errors = 0;
    for (const mu of list) {
      if (mu.type === 'childList') {
        mu.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          if (n.matches(ERR_SEL)) errors++;
          errors += n.querySelectorAll(ERR_SEL).length;
        });
      } else if (mu.type === 'attributes' && mu.attributeName === 'class') {
        const t = mu.target;
        const was = mu.oldValue || '';
        if ((t.classList.contains('wrong') && !/\bwrong\b/.test(was)) || (t.classList.contains('shake') && !/\bshake\b/.test(was)) || (t.classList.contains('nope') && !/\bnope\b/.test(was))) errors++;
      }
    }
    if (errors) onError(errors);
    clearTimeout(checkTimer);
    checkTimer = setTimeout(checkProgress, 150);
  });
  if (modalBody) obs.observe(modalBody, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });

  // 3 errores en menos de 3 minutos dentro de la misma misión → ARIA ofrece ayuda
  function onError(n) {
    const now = Date.now();
    const mid = hooks.getMissionId();
    if (mid !== errMission) {
      errMission = mid;
      errTimes = [];
    }
    for (let i = 0; i < n; i++) errTimes.push(now);
    errTimes = errTimes.filter((t) => now - t < 180000);
    if (errTimes.length >= 3) {
      errTimes = [];
      proactive('Veo varios errores seguidos, ¡es normal cuando se está aprendiendo! ¿Quieres una pista para lo que sigue?', true, { sticky: true });
    }
  }
  function checkProgress() {
    const c = readScreen();
    if (c.key !== stepKey) {
      stepKey = c.key;
      level = 0;
      lastActivity = Date.now();
      if (!bubble.dataset.sticky) bubble.classList.add('hidden');
      if (open) $('#aria-ctx').textContent = c.m ? `Estás en: ${c.m.title}` : 'Asistente del SOC';
    }
  }

  // Actividad del jugador (clics y teclas)
  ['pointerdown', 'keydown', 'input'].forEach((ev) => window.addEventListener(ev, () => (lastActivity = Date.now()), true));

  // ================================================================
  //  Vigilancia periódica: inactividad y jugador perdido
  // ================================================================
  setInterval(() => {
    const s = hooks.getState();
    root.classList.toggle('hidden', !s.started);
    if (!s.started) return;

    if (!greeted) {
      greeted = true;
      setTimeout(() => proactive(`Hola${s.name ? ' ' + s.name : ''}, soy <b>ARIA</b>. Si te pierdes o no sabes qué hacer, presiona <kbd>H</kbd> y te ayudo.`, false, { cooldown: false }), 4000);
      return;
    }

    // Una misión nueva completada reinicia el reloj de "perdido"
    if (s.done.length !== lastDone) {
      lastDone = s.done.length;
      lostSince = Date.now();
    }

    const now = Date.now();
    if (s.modalOpen) {
      const c = readScreen();
      const working = !['brief', 'success', 'feedback'].includes(c.type);
      if (working && now - lastActivity > 75000) {
        lastActivity = now;
        proactive('¿Sigues ahí? Si no sabes cómo seguir, te doy una pista.');
      }
      return;
    }

    // En el mundo 3D
    const w = hooks.getWorld();
    if (!w) return;
    if (!lastMovePos || Math.hypot(w.x - lastMovePos.x, w.z - lastMovePos.z) > 0.3) {
      lastMovePos = { x: w.x, z: w.z };
      lastMoveAt = now;
    }
    const near = w.target && Math.hypot(w.target.x - w.x, w.target.z - w.z) < 3.5;
    if (near || !w.target) lostSince = now;
    if (w.target && (now - lostSince > 120000 || now - lastMoveAt > 90000)) {
      lostSince = now;
      lastMoveAt = now;
      proactive('¿Perdido/a? ' + directions(), false);
    }
  }, 1000);

  return {
    toggle,
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: () => open,
    ask,
    hint,
    whatNow,
    _answer: answer, // para pruebas
  };
}
