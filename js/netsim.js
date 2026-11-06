// ================================================================
//  CyberVR SOC · Simulador de red (lógica pura, sin DOM)
//  El estado es JSON plano, así se puede guardar en localStorage.
// ================================================================

// ---------- Utilidades IP ----------
export function ipToInt(s) {
  if (typeof s !== 'string') return null;
  const p = s.trim().split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) {
    if (!/^\d{1,3}$/.test(x) || +x > 255) return null;
    n = n * 256 + +x;
  }
  return n;
}
export const intToIp = (n) => [n / 16777216, n / 65536, n / 256, n].map((v) => Math.floor(v) % 256).join('.');
export function maskToPrefix(mask) {
  const m = ipToInt(mask);
  if (m === null) return null;
  const bits = m.toString(2).padStart(32, '0');
  return /^1*0*$/.test(bits) ? bits.indexOf('0') === -1 ? 32 : bits.indexOf('0') : null;
}
export const networkOf = (ip, mask) => (ipToInt(ip) & ipToInt(mask)) >>> 0;
export const broadcastOf = (ip, mask) => (networkOf(ip, mask) | (~ipToInt(mask) >>> 0)) >>> 0;
export const sameSubnet = (a, b, mask) => networkOf(a, mask) === networkOf(b, mask);
export const isPrivate = (ip) => {
  const n = ipToInt(ip);
  if (n === null) return false;
  return (n >>> 24) === 10 || (n >>> 20) === 0xac1 || (n >>> 16) === 0xc0a8 || (n >>> 16) === 0xa9fe;
};

// Devuelve un mensaje de error o null si la pareja IP/máscara se puede asignar a un host.
export function validateHostAddress(ip, mask) {
  if (ipToInt(ip) === null) return `"${ip}" no es una dirección IPv4 válida.`;
  if (maskToPrefix(mask) === null) return `"${mask}" no es una máscara válida (los unos deben ser contiguos).`;
  const p = maskToPrefix(mask);
  if (p === 0) return 'Una máscara /0 no sirve para una interfaz.';
  if (p < 31) {
    if (ipToInt(ip) === networkOf(ip, mask)) return `${ip} es la dirección de RED de esa subred, no se puede asignar.`;
    if (ipToInt(ip) === broadcastOf(ip, mask)) return `${ip} es la dirección de BROADCAST de esa subred, no se puede asignar.`;
  }
  const first = ipToInt(ip) >>> 24;
  if (first === 127 || first === 0 || first >= 224) return `${ip} pertenece a un rango reservado.`;
  return null;
}

// ---------- "Internet" simulado ----------
export const INTERNET = {
  '8.8.8.8': { name: 'dns.google', dns: true },
  '1.1.1.1': { name: 'one.one.one.one', dns: true },
  '93.184.216.34': { name: 'example.com', web: { title: 'Example Domain', body: 'Este dominio existe para ejemplos en documentación.' } },
  '203.0.113.10': { name: 'www.cybercorp.co', web: { title: 'CyberCorp S.A.S.', body: 'Portal público de CyberCorp. ¡Tu red ya sale a Internet!' } },
};
const PUBLIC_DNS = Object.fromEntries(Object.entries(INTERNET).map(([ip, v]) => [v.name, ip]));

// ---------- Construcción ----------
const CONFIG_FIELDS = ['name', 'ifaces', 'switchports', 'vlans', 'routes', 'pools', 'excluded', 'acl', 'nat'];
const snapshot = (d) => JSON.stringify(Object.fromEntries(CONFIG_FIELDS.filter((k) => k in d).map((k) => [k, d[k]])));
const HOST_TYPES = ['pc', 'server', 'printer'];
export const isHost = (d) => HOST_TYPES.includes(d.type);
export const isL3 = (d) => d.type === 'router' || d.type === 'isp' || isHost(d);

export const createNet = () => ({ seq: 1, devices: {}, links: [], stats: {}, flags: {}, autoMdix: false });

export function addDevice(net, type, name, x, y) {
  const id = 'd' + net.seq++;
  const d = { id, type, name, x, y, powered: true, dirty: false, startup: null };
  if (HOST_TYPES.includes(type)) {
    d.ports = type === 'pc' ? ['eth0', 'com1'] : ['eth0'];
    d.ifaces = { eth0: { ip: '', mask: '', up: true } };
    d.gw = '';
    d.dns = '';
    d.dhcp = false;
  } else if (type === 'router') {
    d.ports = ['g0/0', 'g0/1', 'g0/2', 'console'];
    d.ifaces = {};
    ['g0/0', 'g0/1', 'g0/2'].forEach((p) => {
      d.ifaces[p] = { ip: '', mask: '', up: false, natIn: false, natOut: false };
    });
    d.routes = [];
    d.pools = [];
    d.excluded = [];
    d.acl = {};
    d.nat = null;
  } else if (type === 'switch') {
    d.ports = ['fa0/1', 'fa0/2', 'fa0/3', 'fa0/4', 'fa0/5', 'fa0/6', 'fa0/7', 'fa0/8', 'g0/1', 'g0/2', 'console'];
    d.switchports = {};
    d.ports.filter((p) => p !== 'console').forEach((p) => {
      d.switchports[p] = { mode: 'access', vlan: 1, up: true };
    });
    d.vlans = { 1: 'default' };
  } else if (type === 'isp') {
    d.ports = ['wan'];
    d.ifaces = { wan: { ip: '200.10.20.1', mask: '255.255.255.252', up: true } };
    d.routes = [];
  }
  d.factory = snapshot(d);
  net.devices[id] = d;
  return d;
}

export function removeDevice(net, id) {
  net.links = net.links.filter((l) => l.a.dev !== id && l.b.dev !== id);
  delete net.devices[id];
}

export function setHostIp(d, ip, mask, gw = '', dns = '') {
  d.dhcp = false;
  d.ifaces.eth0.ip = ip;
  d.ifaces.eth0.mask = mask;
  d.gw = gw;
  d.dns = dns;
}

export const portInUse = (net, dev, port) => net.links.some((l) => (l.a.dev === dev && l.a.port === port) || (l.b.dev === dev && l.b.port === port));

export function addLink(net, aDev, aPort, bDev, bPort, cable = 'straight') {
  const l = { id: 'l' + net.seq++, a: { dev: aDev, port: aPort }, b: { dev: bDev, port: bPort }, cable };
  net.links.push(l);
  return l;
}
export const removeLink = (net, id) => {
  net.links = net.links.filter((l) => l.id !== id);
};

// Marca la configuración actual como guardada en NVRAM.
export function saveConfig(d) {
  d.startup = snapshot(d);
  d.dirty = false;
}
export function reloadConfig(d) {
  if (isHost(d)) return;
  Object.assign(d, JSON.parse(d.startup || d.factory));
  d.dirty = false;
}
export function setPower(d, on) {
  if (d.powered === on) return;
  d.powered = on;
  if (on) reloadConfig(d); // lo que no se guardó se pierde al apagar
}

// ---------- Capa física ----------
const ifaceUp = (d, name) => {
  const i = d.ifaces[name];
  if (!i || !i.up) return false;
  return i.port ? !!d.ifaces[i.port]?.up : true;
};
function portUp(d, port) {
  if (!d.powered) return false;
  if (isHost(d)) return port === 'eth0' && !d.nicDisabled;
  if (d.type === 'router' || d.type === 'isp') return !!d.ifaces[port]?.up;
  if (d.type === 'switch') return !!d.switchports[port]?.up;
  return false;
}
const isDataPort = (p) => p !== 'console' && p !== 'com1';
const mdiClass = (d) => (d.type === 'switch' || d.type === 'isp' ? 'x' : 'mdi');

// ¿El tipo de cable es el correcto para estos dos equipos?
export function cableOk(net, link) {
  const a = net.devices[link.a.dev];
  const b = net.devices[link.b.dev];
  if (link.cable === 'console') {
    return (link.a.port === 'com1' && link.b.port === 'console') || (link.b.port === 'com1' && link.a.port === 'console');
  }
  if (!isDataPort(link.a.port) || !isDataPort(link.b.port)) return false;
  if (net.autoMdix) return true;
  const want = mdiClass(a) === mdiClass(b) ? 'cross' : 'straight';
  return link.cable === want;
}

// 'up' | 'admin' | 'power' | 'cable' | 'fault' | 'console'
export function linkState(net, link) {
  const a = net.devices[link.a.dev];
  const b = net.devices[link.b.dev];
  if (!cableOk(net, link)) return 'cable';
  if (link.fault) return 'fault';
  if (!a.powered || !b.powered) return 'power';
  if (link.cable === 'console') return 'console';
  if (!portUp(a, link.a.port) || !portUp(b, link.b.port)) return 'admin';
  return 'up';
}
function peer(net, dev, port) {
  for (const l of net.links) {
    if (l.a.dev === dev && l.a.port === port) return { link: l, other: l.b };
    if (l.b.dev === dev && l.b.port === port) return { link: l, other: l.a };
  }
  return null;
}
export const hostLinkUp = (net, d) => {
  const p = peer(net, d.id, 'eth0');
  return !!p && linkState(net, p.link) === 'up';
};

// ---------- Capa 2: dominio de broadcast ----------
// Devuelve los extremos L3 ({dev, iface, ip}) alcanzables desde una interfaz.
export function l2Reach(net, devId, ifName) {
  const start = net.devices[devId];
  const iface = start.ifaces[ifName];
  const out = [];
  if (!iface || !ifaceUp(start, ifName) || !portUp(start, iface.port || ifName)) return out;
  const seen = new Set();

  const leave = (dId, port, tag) => {
    const p = peer(net, dId, port);
    if (!p || linkState(net, p.link) !== 'up') return;
    arrive(p.other.dev, p.other.port, tag);
  };
  const arrive = (dId, port, tag) => {
    const d = net.devices[dId];
    if (d.type === 'switch') {
      const sp = d.switchports[port];
      if (!sp || !sp.up) return;
      let vlan;
      if (sp.mode === 'access') {
        if (tag !== null) return; // un puerto de acceso descarta tramas etiquetadas
        vlan = sp.vlan;
      } else {
        vlan = tag === null ? 1 : tag;
      }
      if (!d.vlans[vlan]) return;
      const key = dId + '#' + vlan;
      if (seen.has(key)) return;
      seen.add(key);
      for (const p of Object.keys(d.switchports)) {
        const o = d.switchports[p];
        if (!o.up) continue;
        if (o.mode === 'access' && o.vlan === vlan) leave(dId, p, null);
        else if (o.mode === 'trunk') leave(dId, p, vlan === 1 ? null : vlan);
      }
      return;
    }
    for (const name of Object.keys(d.ifaces || {})) {
      const i = d.ifaces[name];
      if ((i.port || name) === port && (i.tag ?? null) === tag && ifaceUp(d, name)) {
        out.push({ dev: dId, iface: name, ip: i.ip });
      }
    }
  };
  leave(devId, iface.port || ifName, iface.tag ?? null);
  return out.filter((e) => !(e.dev === devId && e.iface === ifName));
}

// ---------- Capa 3 ----------
function ownsIp(d, ip) {
  return Object.keys(d.ifaces || {}).some((n) => d.ifaces[n].ip === ip && ifaceUp(d, n));
}
function connectedIface(d, dstInt) {
  let best = null;
  let bestP = -1;
  for (const n of Object.keys(d.ifaces || {})) {
    const i = d.ifaces[n];
    if (!i.ip || !i.mask || !ifaceUp(d, n)) continue;
    const p = maskToPrefix(i.mask);
    if (((dstInt & ipToInt(i.mask)) >>> 0) === networkOf(i.ip, i.mask) && p > bestP) {
      best = n;
      bestP = p;
    }
  }
  return best;
}
function lookup(d, dst) {
  const dstInt = ipToInt(dst);
  const conn = connectedIface(d, dstInt);
  if (conn) return { iface: conn, nextHop: dst };
  if (isHost(d)) {
    if (!d.gw) return null;
    const via = connectedIface(d, ipToInt(d.gw));
    return via ? { iface: via, nextHop: d.gw } : null;
  }
  let best = null;
  let bestP = -1;
  for (const r of d.routes || []) {
    const p = maskToPrefix(r.mask);
    if (((dstInt & ipToInt(r.mask)) >>> 0) === ((ipToInt(r.net) & ipToInt(r.mask)) >>> 0) && p > bestP) {
      const via = connectedIface(d, ipToInt(r.via));
      if (via) {
        best = { iface: via, nextHop: r.via };
        bestP = p;
      }
    }
  }
  return best;
}
function natMatches(d, srcIp) {
  if (!d.nat) return false;
  const rules = d.acl?.[d.nat.list];
  if (!rules) return false;
  const s = ipToInt(srcIp);
  return rules.some((r) => {
    const care = ~ipToInt(r.wild) >>> 0;
    return ((s & care) >>> 0) === ((ipToInt(r.net) & care) >>> 0);
  });
}

// Recorre el camino de un paquete salto a salto.
function walk(net, startId, srcIp, dst) {
  let cur = net.devices[startId];
  let ingress = null;
  let src = srcIp;
  let nat = null;
  const hops = [];
  for (let ttl = 0; ttl < 16; ttl++) {
    if (ownsIp(cur, dst)) return { ok: true, at: cur.id, src, nat, hops };
    if (cur.type === 'isp') {
      if (INTERNET[dst]) {
        if (isPrivate(src)) return { ok: false, why: 'natMissing', at: cur.id, hops };
        hops.push({ name: INTERNET[dst].name, ip: dst });
        return { ok: true, at: cur.id, src, nat, hops, internet: true };
      }
      if (!lookup(cur, dst)) return { ok: false, why: isPrivate(dst) ? 'natMissing' : 'unknownDst', at: cur.id, hops };
    }
    const r = lookup(cur, dst);
    if (!r) {
      const why = isHost(cur) ? (cur.gw ? 'badGw' : 'noGw') : 'noRoute';
      return { ok: false, why, at: cur.id, hops };
    }
    const eg = cur.ifaces[r.iface];
    if (cur.type === 'router' && ingress && cur.ifaces[ingress]?.natIn && eg.natOut && natMatches(cur, src)) {
      nat = { dev: cur.id, public: eg.ip, original: src };
      src = eg.ip;
    }
    const eps = l2Reach(net, cur.id, r.iface);
    const ep = eps.find((e) => e.ip === r.nextHop);
    if (!ep) return { ok: false, why: 'arp', at: cur.id, nextHop: r.nextHop, hops };
    hops.push({ name: net.devices[ep.dev].name, ip: ep.ip });
    cur = net.devices[ep.dev];
    ingress = ep.iface;
  }
  return { ok: false, why: 'ttl', at: cur.id, hops };
}

const HINTS = {
  noLink: 'La interfaz de este equipo no tiene enlace: revisa cable, tipo de cable, encendido y si el puerto está activo.',
  noIp: 'Este equipo no tiene dirección IP. Configúrala o pídela por DHCP.',
  noGw: 'El destino está en otra red y este equipo no tiene puerta de enlace configurada.',
  badGw: 'La puerta de enlace configurada no pertenece a la subred de este equipo.',
  noRoute: 'Un router del camino no tiene ruta hacia el destino. Revisa show ip route.',
  arp: 'Nadie responde en la red local por ese siguiente salto: revisa cables, VLAN, IP y máscara.',
  natMissing: 'El ISP no enruta direcciones privadas: falta NAT en el router (o está mal aplicado).',
  unknownDst: 'Ese destino no existe en Internet simulado. Prueba con 8.8.8.8 o 1.1.1.1.',
  noReturn: 'El paquete llega, pero la respuesta no vuelve: el destino no tiene ruta o puerta de enlace de regreso.',
  ttl: 'El paquete da vueltas sin llegar (bucle de enrutamiento).',
};

function sourceIpFor(net, d, dst) {
  if (isHost(d)) return d.ifaces.eth0.ip;
  const r = lookup(d, dst);
  return r ? d.ifaces[r.iface].ip : '';
}

// Prueba de conectividad extremo a extremo (ida y vuelta).
export function ping(net, srcId, dst, { record = true } = {}) {
  const d = net.devices[srcId];
  const fail = (why, extra = {}) => ({ ok: false, why, hint: HINTS[why] || '', hops: [], ...extra });
  if (!d || !d.powered) return fail('noLink');
  if (dst === '127.0.0.1') return { ok: true, hops: [], rtt: 1, local: true };
  if (ipToInt(dst) === null) return fail('unknownDst');
  if (isHost(d)) {
    if (!d.ifaces.eth0.ip) return fail('noIp');
    if (dst === d.ifaces.eth0.ip) return { ok: true, hops: [], rtt: 1, local: true };
    if (!hostLinkUp(net, d)) return fail('noLink');
  }
  const src = sourceIpFor(net, d, dst);
  if (!src) return fail('noRoute');
  const go = walk(net, srcId, src, dst);
  if (!go.ok) return fail(go.why, { hops: go.hops, at: go.at, nextHop: go.nextHop });
  let back = walk(net, go.at, dst, go.src);
  if (back.ok && go.nat) back = walk(net, go.nat.dev, go.nat.public, go.nat.original);
  if (!back.ok) return fail(back.why === 'natMissing' ? 'natMissing' : 'noReturn', { hops: go.hops });
  if (record) net.stats[`${srcId}>${dst}`] = 1;
  return { ok: true, hops: go.hops, rtt: 1 + go.hops.length * (go.internet ? 7 : 1), internet: !!go.internet };
}

// Resolución DNS desde un host.
export function resolveName(net, srcId, name, { record = true } = {}) {
  const d = net.devices[srcId];
  const q = name.toLowerCase();
  if (ipToInt(q) !== null) return { ok: true, ip: q };
  if (!d.dns) return { ok: false, why: 'noDns', hint: 'Este equipo no tiene un servidor DNS configurado.' };
  const reach = ping(net, srcId, d.dns, { record: false });
  if (!reach.ok) return { ok: false, why: 'dnsDown', hint: `No se llega al DNS ${d.dns}. ${reach.hint || ''}` };
  const internal = Object.values(net.devices).find((x) => x.ifaces?.eth0?.ip === d.dns);
  const pub = INTERNET[d.dns];
  let ip = null;
  if (internal?.dnsRecords) ip = internal.dnsRecords[q] || null;
  else if (pub?.dns) ip = PUBLIC_DNS[q] || null;
  else return { ok: false, why: 'notDns', hint: `${d.dns} responde a ping pero no es un servidor DNS.` };
  if (!ip) return { ok: false, why: 'nx', hint: 'Ese nombre no existe en el DNS.' };
  if (record) net.stats[`${srcId}@${q}`] = 1;
  return { ok: true, ip, server: d.dns };
}

// Navegador simulado.
export function webGet(net, srcId, url) {
  const host = url.replace(/^https?:\/\//i, '').split('/')[0].trim().toLowerCase();
  if (!host) return { ok: false, msg: 'Escribe una dirección.' };
  const res = resolveName(net, srcId, host);
  if (!res.ok) return { ok: false, msg: 'DNS_PROBE_FAILED: no se pudo resolver el nombre.', hint: res.hint };
  const p = ping(net, srcId, res.ip);
  if (!p.ok) return { ok: false, msg: 'ERR_CONNECTION_TIMED_OUT: el sitio no responde.', hint: p.hint };
  const internal = Object.values(net.devices).find((x) => x.ifaces?.eth0?.ip === res.ip);
  const web = internal?.web || INTERNET[res.ip]?.web;
  if (!web) return { ok: false, msg: 'ERR_CONNECTION_REFUSED: ese equipo no tiene un servidor web.' };
  net.stats[`${srcId}#web`] = 1;
  return { ok: true, title: web.title, body: web.body, ip: res.ip };
}

// ---------- DHCP ----------
function apipa(d) {
  const n = parseInt(d.id.replace(/\D/g, ''), 10) || 1;
  return `169.254.${(n * 37) % 254 + 1}.${(n * 91) % 254 + 1}`;
}
export function dhcpRenew(net, d) {
  d.dhcp = true;
  const i = d.ifaces.eth0;
  i.ip = '';
  i.mask = '';
  d.gw = '';
  d.dns = '';
  if (!hostLinkUp(net, d)) return { ok: false, why: 'noLink' };
  for (const ep of l2Reach(net, d.id, 'eth0')) {
    const srv = net.devices[ep.dev];
    if (srv.type !== 'router' || !ep.ip) continue;
    const si = srv.ifaces[ep.iface];
    const pool = (srv.pools || []).find((p) => p.net && p.mask && networkOf(p.net, p.mask) === networkOf(si.ip, si.mask));
    if (!pool) continue;
    pool.leases = pool.leases || {};
    const used = new Set(Object.entries(pool.leases).filter(([k]) => k !== d.id).map(([, v]) => v));
    Object.values(net.devices).forEach((x) => {
      if (x.ifaces) Object.values(x.ifaces).forEach((f) => f.ip && x.id !== d.id && used.add(f.ip));
    });
    const excluded = (a) => (srv.excluded || []).some(([lo, hi]) => a >= ipToInt(lo) && a <= ipToInt(hi));
    const first = networkOf(pool.net, pool.mask) + 1;
    const last = broadcastOf(pool.net, pool.mask) - 1;
    let chosen = pool.leases[d.id];
    if (!chosen) {
      for (let a = first; a <= last; a++) {
        const s = intToIp(a);
        if (!excluded(a) && !used.has(s)) {
          chosen = s;
          break;
        }
      }
    }
    if (!chosen) return { ok: false, why: 'exhausted' };
    pool.leases[d.id] = chosen;
    i.ip = chosen;
    i.mask = pool.mask;
    d.gw = pool.gw || '';
    d.dns = pool.dns || '';
    return { ok: true, ip: chosen, server: si.ip };
  }
  i.ip = apipa(d);
  i.mask = '255.255.0.0';
  return { ok: false, why: 'noServer', apipa: true };
}

// ---------- Tabla ARP vista desde un host ----------
export function arpTable(net, d) {
  if (!isHost(d) || !hostLinkUp(net, d)) return [];
  return l2Reach(net, d.id, 'eth0').filter((e) => e.ip).map((e) => ({
    ip: e.ip,
    mac: macOf(e.dev, e.iface),
  }));
}
export function macOf(devId, port) {
  const hex = (n) => (n % 256).toString(16).padStart(2, '0');
  const a = parseInt(devId.replace(/\D/g, ''), 10) || 0;
  const b = [...String(port)].reduce((s, c) => s + c.charCodeAt(0), 0);
  return `00-1a-2b-${hex(a * 17)}-${hex(b)}-${hex(a * 3 + b)}`;
}
