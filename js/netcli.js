// ================================================================
//  CyberVR SOC · Consolas del laboratorio
//   - Símbolo del sistema para PCs y servidores
//   - CLI de red (sintaxis estilo IOS) para routers y switches
// ================================================================
import {
  ping, resolveName, dhcpRenew, arpTable, macOf, hostLinkUp, isHost, ipToInt, maskToPrefix,
  validateHostAddress, networkOf, saveConfig, reloadConfig, setHostIp, intToIp,
} from './netsim.js';

export function normIf(raw) {
  const s = raw.replace(/\s+/g, '').toLowerCase();
  let m = s.match(/^(g|gi|gig|gigabit|gigabitethernet)(\d+\/\d+(?:\.\d+)?)$/);
  if (m) return 'g' + m[2];
  m = s.match(/^(f|fa|fast|fastethernet)(\d+\/\d+)$/);
  if (m) return 'fa' + m[2];
  return null;
}

// ================================================================
//  Consola de equipos finales
// ================================================================
function hostShell(net, d, io) {
  const P = (t, c) => io.print(t, c);
  const hint = (h) => h && P('💡 ' + h, 'hint');

  const doPing = (target) => {
    const r0 = resolveName(net, d.id, target);
    if (!r0.ok) {
      P(`La solicitud de ping no pudo encontrar el host ${target}. Compruebe el nombre e inténtelo de nuevo.`, 'err');
      return hint(r0.hint);
    }
    const ip = r0.ip;
    P(`\nHaciendo ping a ${target === ip ? ip : `${target} [${ip}]`} con 32 bytes de datos:`);
    const r = ping(net, d.id, ip);
    if (r.ok) {
      for (let i = 0; i < 4; i++) P(`Respuesta desde ${ip}: bytes=32 tiempo=${r.rtt + (i % 2)}ms TTL=${r.internet ? 54 : 64}`, 'ok');
      P(`\nEstadísticas de ping para ${ip}:\n    Paquetes: enviados = 4, recibidos = 4, perdidos = 0 (0% perdidos)`);
      io.changed();
      return;
    }
    if (r.why === 'noLink' || r.why === 'noIp') P('Error general.', 'err');
    else if (r.why === 'noGw' || r.why === 'badGw') P(`Respuesta desde ${d.ifaces.eth0.ip}: Host de destino inaccesible.`, 'err');
    else for (let i = 0; i < 4; i++) P('Tiempo de espera agotado para esta solicitud.', 'err');
    P(`\nEstadísticas de ping para ${ip}:\n    Paquetes: enviados = 4, recibidos = 0, perdidos = 4 (100% perdidos)`);
    hint(r.hint);
  };

  const ipconfig = (arg) => {
    const i = d.ifaces.eth0;
    if (arg === '/release') {
      if (!d.dhcp) return P('Este adaptador tiene IP estática: no hay concesión DHCP que liberar.', 'err');
      i.ip = '';
      i.mask = '';
      d.gw = '';
      d.dns = '';
      P('Concesión DHCP liberada.');
      return io.changed();
    }
    if (arg === '/renew') {
      if (!d.dhcp) return P('Este adaptador tiene IP estática. Cambia a DHCP para usar /renew.', 'err');
      const r = dhcpRenew(net, d);
      io.changed();
      if (r.ok) return P(`DHCP OK: concesión de ${r.ip} entregada por ${r.server}.`, 'ok');
      P('No se puede contactar con el servidor DHCP.', 'err');
      if (r.apipa) hint(`Windows se autoasignó ${i.ip} (APIPA 169.254.x.x): señal de que el DHCP no respondió.`);
      else hint('La interfaz no tiene enlace. Revisa cable y encendido.');
      return;
    }
    if (arg && arg !== '/all') return P(`Opción no válida: ${arg}`, 'err');
    P('\nConfiguración IP\n');
    if (arg === '/all') {
      P(`   Nombre de host. . . . . . . . : ${d.name}`);
      P(`   Dirección física. . . . . . . : ${macOf(d.id, 'eth0')}`);
      P(`   DHCP habilitado . . . . . . . : ${d.dhcp ? 'sí' : 'no'}`);
    }
    if (d.nicDisabled) return P('Adaptador Ethernet: deshabilitado en BIOS (no aparece en el sistema).', 'err');
    if (!hostLinkUp(net, d)) P('Adaptador Ethernet:\n   Estado de los medios. . . . . : medios desconectados', 'err');
    else P('Adaptador Ethernet:');
    P(`   Dirección IPv4. . . . . . . . : ${i.ip || '(sin dirección)'}`);
    P(`   Máscara de subred . . . . . . : ${i.mask || '-'}`);
    P(`   Puerta de enlace predet.. . . : ${d.gw || '-'}`);
    if (arg === '/all') P(`   Servidores DNS. . . . . . . . : ${d.dns || '-'}`);
  };

  const tracert = (target) => {
    const r0 = resolveName(net, d.id, target);
    if (!r0.ok) {
      P(`No se puede resolver ${target}.`, 'err');
      return hint(r0.hint);
    }
    P(`\nTraza a ${target} [${r0.ip}] (máximo 30 saltos):\n`);
    const r = ping(net, d.id, r0.ip, { record: false });
    r.hops.forEach((h, k) => P(`  ${k + 1}    ${(k + 1) * 2} ms    ${h.name} [${h.ip}]`));
    if (!r.ok) {
      P(`  ${r.hops.length + 1}    *    *    *    Tiempo de espera agotado.`, 'err');
      hint(r.hint);
    } else {
      P('\nTraza completa.', 'ok');
    }
  };

  const netsh = (line) => {
    const m = line.match(/^netsh\s+interface\s+ip\s+set\s+address\s+("?[\w ]+"?)\s+(dhcp|static)\s*(.*)$/i);
    if (m) {
      if (m[2].toLowerCase() === 'dhcp') {
        const r = dhcpRenew(net, d);
        io.changed();
        return P(r.ok ? `Ahora usa DHCP. IP: ${r.ip}` : 'DHCP activado, pero no hubo respuesta del servidor.', r.ok ? 'ok' : 'err');
      }
      const [ip, mask, gw] = m[3].trim().split(/\s+/);
      const err = validateHostAddress(ip || '', mask || '');
      if (err) return P(err, 'err');
      if (gw && ipToInt(gw) === null) return P(`Puerta de enlace no válida: ${gw}`, 'err');
      setHostIp(d, ip, mask, gw || '', d.dns);
      io.changed();
      return P('Dirección configurada.', 'ok');
    }
    const n = line.match(/^netsh\s+interface\s+ip\s+set\s+dns\s+("?[\w ]+"?)\s+static\s+(\S+)$/i);
    if (n) {
      if (ipToInt(n[2]) === null) return P(`DNS no válido: ${n[2]}`, 'err');
      d.dns = n[2];
      io.changed();
      return P('DNS configurado.', 'ok');
    }
    P('Uso:\n  netsh interface ip set address "Ethernet" static <ip> <máscara> <gateway>\n  netsh interface ip set address "Ethernet" dhcp\n  netsh interface ip set dns "Ethernet" static <ip>', 'err');
  };

  return {
    prompt: () => 'C:\\>',
    banner: () => `${d.name} · Símbolo del sistema\nEscribe help para ver los comandos.\n`,
    exec(line) {
      const raw = line.trim();
      if (!raw) return;
      const [cmd, ...rest] = raw.split(/\s+/);
      const c = cmd.toLowerCase();
      const arg = rest.join(' ');
      if (c === 'help' || c === '?') {
        return P(`Comandos disponibles:
  ipconfig [/all | /release | /renew]   ver o renovar la configuración IP
  ping <ip o nombre>                    probar conectividad
  tracert <ip o nombre>                 ver los saltos del camino
  nslookup <nombre>                     consultar el DNS
  arp -a                                tabla IP → MAC de la red local
  getmac                                dirección física del adaptador
  hostname                              nombre del equipo
  netsh interface ip set address ...    configurar la IP desde consola
  cls                                   limpiar pantalla`);
      }
      if (c === 'cls' || c === 'clear') return io.clear();
      if (c === 'hostname') return P(d.name);
      if (c === 'getmac') return P(macOf(d.id, 'eth0'));
      if (c === 'ipconfig') return ipconfig(arg.toLowerCase());
      if (c === 'ping') return arg ? doPing(rest[0]) : P('Uso: ping <ip o nombre>', 'err');
      if (c === 'tracert' || c === 'traceroute') return arg ? tracert(rest[0]) : P('Uso: tracert <ip o nombre>', 'err');
      if (c === 'nslookup') {
        if (!arg) return P('Uso: nslookup <nombre>', 'err');
        const r = resolveName(net, d.id, rest[0]);
        io.changed();
        if (r.ok) return P(`Servidor:  ${r.server || 'local'}\n\nNombre:    ${rest[0]}\nAddress:   ${r.ip}`, 'ok');
        P(`*** No se pudo resolver ${rest[0]}`, 'err');
        return hint(r.hint);
      }
      if (c === 'arp') {
        const t = arpTable(net, d);
        if (!t.length) return P('No se encontraron entradas ARP.');
        P('  Dirección IP          Dirección física');
        t.forEach((e) => P(`  ${e.ip.padEnd(20)}  ${e.mac}`));
        return;
      }
      if (c === 'netsh') return netsh(raw);
      P(`"${cmd}" no se reconoce como un comando interno o externo. Escribe help.`, 'err');
    },
    complete: (s) => s,
  };
}

// ================================================================
//  CLI de red (router y switch)
// ================================================================
function iosShell(net, d, io) {
  let mode = 'user';
  let cur = null; // interfaz / vlan / pool seleccionados
  const P = (t, c) => io.print(t, c);
  const isR = d.type === 'router';
  const changed = () => {
    d.dirty = true;
    io.changed();
  };

  const ifaceOf = (name) => (isR ? d.ifaces[name] : d.switchports[name]);

  const showRun = (src = null) => {
    const c = src ? JSON.parse(src) : d;
    const L = ['!', `hostname ${c.name}`, '!'];
    if (isR) {
      (c.excluded || []).forEach(([a, b]) => L.push(`ip dhcp excluded-address ${a} ${b}`));
      (c.pools || []).forEach((p) => {
        L.push(`ip dhcp pool ${p.name}`);
        if (p.net) L.push(` network ${p.net} ${p.mask}`);
        if (p.gw) L.push(` default-router ${p.gw}`);
        if (p.dns) L.push(` dns-server ${p.dns}`);
      });
      L.push('!');
      Object.keys(c.ifaces).forEach((n) => {
        const i = c.ifaces[n];
        L.push(`interface ${n}`);
        if (i.tag) L.push(` encapsulation dot1q ${i.tag}`);
        L.push(i.ip ? ` ip address ${i.ip} ${i.mask}` : ' no ip address');
        if (i.natIn) L.push(' ip nat inside');
        if (i.natOut) L.push(' ip nat outside');
        L.push(i.up ? ' no shutdown' : ' shutdown', '!');
      });
      if (c.nat) L.push(`ip nat inside source list ${c.nat.list} interface ${c.nat.iface} overload`);
      Object.entries(c.acl || {}).forEach(([k, rs]) => rs.forEach((r) => L.push(`access-list ${k} permit ${r.net} ${r.wild}`)));
      (c.routes || []).forEach((r) => L.push(`ip route ${r.net} ${r.mask} ${r.via}`));
    } else {
      Object.entries(c.vlans).forEach(([v, n]) => {
        if (v !== '1') L.push(`vlan ${v}`, ` name ${n}`, '!');
      });
      Object.keys(c.switchports).forEach((n) => {
        const s = c.switchports[n];
        if (s.mode === 'access' && s.vlan === 1 && s.up) return;
        L.push(`interface ${n}`);
        if (s.mode === 'trunk') L.push(' switchport mode trunk');
        else if (s.vlan !== 1) L.push(' switchport mode access', ` switchport access vlan ${s.vlan}`);
        if (!s.up) L.push(' shutdown');
        L.push('!');
      });
    }
    L.push('end');
    P(L.join('\n'));
  };

  const showIpBrief = () => {
    P('Interface          IP-Address       Status                Protocol');
    if (isR) {
      Object.keys(d.ifaces).forEach((n) => {
        const i = d.ifaces[n];
        const parentUp = i.port ? d.ifaces[i.port]?.up : true;
        const conn = net.links.some((l) => (l.a.dev === d.id && l.a.port === (i.port || n)) || (l.b.dev === d.id && l.b.port === (i.port || n)));
        const st = !i.up || !parentUp ? 'administratively down' : 'up';
        const pr = st === 'up' && conn ? 'up' : 'down';
        P(`${n.padEnd(18)} ${(i.ip || 'unassigned').padEnd(16)} ${st.padEnd(21)} ${pr}`);
      });
    } else {
      Object.keys(d.switchports).forEach((n) => {
        const s = d.switchports[n];
        const conn = net.links.some((l) => (l.a.dev === d.id && l.a.port === n) || (l.b.dev === d.id && l.b.port === n));
        P(`${n.padEnd(18)} ${'unassigned'.padEnd(16)} ${(s.up ? 'up' : 'administratively down').padEnd(21)} ${s.up && conn ? 'up' : 'down'}`);
      });
    }
  };

  const showRoute = () => {
    P('Codes: C - connected, S - static\n');
    Object.keys(d.ifaces).forEach((n) => {
      const i = d.ifaces[n];
      if (i.ip && i.up) P(`C    ${intToIp(networkOf(i.ip, i.mask))}/${maskToPrefix(i.mask)} is directly connected, ${n}`);
    });
    d.routes.forEach((r) => P(`S    ${r.net}/${maskToPrefix(r.mask)} [1/0] via ${r.via}`));
  };

  const showVlan = () => {
    P('VLAN Name                 Status    Ports\n---- -------------------- --------- ------------------------');
    Object.entries(d.vlans).forEach(([v, n]) => {
      const ports = Object.keys(d.switchports).filter((p) => d.switchports[p].mode === 'access' && d.switchports[p].vlan === +v);
      P(`${v.padEnd(4)} ${n.padEnd(20)} active    ${ports.join(', ')}`);
    });
  };
  const showTrunk = () => {
    const t = Object.keys(d.switchports).filter((p) => d.switchports[p].mode === 'trunk');
    if (!t.length) return P('No hay puertos en modo trunk.');
    P('Port        Mode    Encapsulation  Status    Native vlan');
    t.forEach((p) => P(`${p.padEnd(11)} on      802.1q         trunking  1`));
  };

  const doPing = (target) => {
    if (ipToInt(target) === null) return P('% Unrecognized host or address.', 'err');
    const r = ping(net, d.id, target);
    P(`Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`);
    if (r.ok) {
      P('!!!!!\nSuccess rate is 100 percent (5/5)', 'ok');
      io.changed();
    } else {
      P('.....\nSuccess rate is 0 percent (0/5)', 'err');
      if (r.hint) P('💡 ' + r.hint, 'hint');
    }
  };

  const setIfaceIp = (ip, mask) => {
    const i = d.ifaces[cur];
    if (!i) return P('% Esta interfaz no admite dirección IP.', 'err');
    if (i.port && !i.tag) return P('% Configura primero: encapsulation dot1q <vlan>', 'err');
    const err = validateHostAddress(ip, mask);
    if (err) return P('% ' + err, 'err');
    i.ip = ip;
    i.mask = mask;
    changed();
  };
  const swOnly = (fn) => (...a) => {
    if (!d.switchports?.[cur]) return P('% Este comando solo aplica a puertos de switch.', 'err');
    return fn(...a);
  };
  const vlanNum = (s) => {
    const v = +s;
    if (!Number.isInteger(v) || v < 1 || v > 4094) {
      P('% VLAN inválida (1-4094).', 'err');
      return null;
    }
    return v;
  };

  const toPriv = () => {
    mode = 'priv';
    cur = null;
  };

  const SHOW = [
    ['show running-config', () => showRun()],
    ['show startup-config', () => (d.startup ? showRun(d.startup) : P('startup-config is not present', 'err'))],
    ['show ip interface brief', showIpBrief],
    ['show ip route', () => (isR ? showRoute() : P('% Comando disponible solo en routers.', 'err'))],
    ['show vlan brief', () => (isR ? P('% Comando disponible solo en switches.', 'err') : showVlan())],
    ['show interfaces trunk', () => (isR ? P('% Comando disponible solo en switches.', 'err') : showTrunk())],
    ['show ip dhcp binding', () => {
      P('IP address       Client');
      (d.pools || []).forEach((p) => Object.entries(p.leases || {}).forEach(([k, ip]) => P(`${ip.padEnd(16)} ${net.devices[k]?.name || k}`)));
    }],
    ['show ip nat translations', () => P(d.nat ? `Inside global via ${d.nat.iface} (PAT overload activo, lista ${d.nat.list})` : 'NAT no configurado.')],
  ];

  const T = {
    user: [
      ['enable', () => { mode = 'priv'; }],
      ['ping <host>', doPing],
      ['exit', () => P('Sesión de consola abierta. Usa enable para continuar.')],
      ...SHOW.filter(([p]) => p === 'show ip interface brief'),
    ],
    priv: [
      ['configure terminal', () => {
        mode = 'config';
        P('Enter configuration commands, one per line.  End with exit or end.');
      }],
      ['disable', () => { mode = 'user'; }],
      ['exit', () => { mode = 'user'; }],
      ['ping <host>', doPing],
      ['copy running-config startup-config', () => {
        saveConfig(d);
        io.changed();
        P('Destination filename [startup-config]?\nBuilding configuration...\n[OK]', 'ok');
      }],
      ['write memory', () => {
        saveConfig(d);
        io.changed();
        P('Building configuration...\n[OK]', 'ok');
      }],
      ['write', () => {
        saveConfig(d);
        io.changed();
        P('Building configuration...\n[OK]', 'ok');
      }],
      ['reload', () => {
        P(d.dirty ? '⚠ Había cambios sin guardar: se perdieron.' : 'Reiniciando con la configuración guardada…', d.dirty ? 'err' : '');
        reloadConfig(d);
        mode = 'user';
        io.changed();
      }],
      ...SHOW,
    ],
    config: [
      ['hostname <name>', (n) => {
        d.name = n;
        changed();
      }],
      ['interface <if...>', (raw) => {
        const n = normIf(raw);
        if (!n) return P(`% Nombre de interfaz inválido: ${raw}`, 'err');
        const sub = n.match(/^(.+)\.(\d+)$/);
        if (sub) {
          if (!isR) return P('% Los switches no usan subinterfaces.', 'err');
          if (!d.ifaces[sub[1]]) return P(`% La interfaz ${sub[1]} no existe.`, 'err');
          if (!d.ifaces[n]) {
            d.ifaces[n] = { ip: '', mask: '', up: true, port: sub[1], tag: null, natIn: false, natOut: false };
            changed();
          }
        } else if (!ifaceOf(n)) {
          return P(`% La interfaz ${n} no existe en este equipo. Usa show ip interface brief.`, 'err');
        }
        cur = n;
        mode = 'if';
      }],
      ['ip route <ip> <mask> <ip>', (net_, mask, via) => {
        if (!isR) return P('% Comando disponible solo en routers.', 'err');
        if (ipToInt(net_) === null || maskToPrefix(mask) === null || ipToInt(via) === null) return P('% Dirección o máscara inválida.', 'err');
        d.routes = d.routes.filter((r) => !(r.net === net_ && r.mask === mask));
        d.routes.push({ net: net_, mask, via });
        changed();
      }],
      ['no ip route <ip> <mask> <ip>', (net_, mask) => {
        if (!isR) return P('% Comando disponible solo en routers.', 'err');
        d.routes = d.routes.filter((r) => !(r.net === net_ && r.mask === mask));
        changed();
      }],
      ['ip dhcp pool <name>', (n) => {
        if (!isR) return P('% Comando disponible solo en routers.', 'err');
        let p = d.pools.find((x) => x.name === n);
        if (!p) {
          p = { name: n, net: '', mask: '', gw: '', dns: '', leases: {} };
          d.pools.push(p);
          changed();
        }
        cur = n;
        mode = 'dhcp';
      }],
      ['ip dhcp excluded-address <ip> <ip>', (a, b) => {
        if (!isR) return P('% Comando disponible solo en routers.', 'err');
        if (ipToInt(a) === null || ipToInt(b) === null) return P('% Dirección inválida.', 'err');
        d.excluded.push([a, b]);
        changed();
      }],
      ['ip nat inside source list <n> interface <if> overload', (list, raw) => {
        if (!isR) return P('% Comando disponible solo en routers.', 'err');
        const n = normIf(raw);
        if (!n || !d.ifaces[n]) return P(`% La interfaz ${raw} no existe.`, 'err');
        d.nat = { list, iface: n };
        changed();
      }],
      ['no ip nat inside source list <n> interface <if> overload', () => {
        d.nat = null;
        changed();
      }],
      ['access-list <n> permit <ip> <mask>', (k, a, w) => {
        if (!isR) return P('% Comando disponible solo en routers.', 'err');
        if (ipToInt(a) === null || ipToInt(w) === null) return P('% Dirección inválida. Recuerda que aquí va la wildcard (ej: 0.0.0.255).', 'err');
        d.acl[k] = d.acl[k] || [];
        d.acl[k].push({ net: a, wild: w });
        changed();
      }],
      ['vlan <n>', (s) => {
        if (isR) return P('% Comando disponible solo en switches.', 'err');
        const v = vlanNum(s);
        if (v === null) return;
        d.vlans[v] = d.vlans[v] || `VLAN${String(v).padStart(4, '0')}`;
        cur = v;
        mode = 'vlan';
        changed();
      }],
      ['no vlan <n>', (s) => {
        if (isR) return P('% Comando disponible solo en switches.', 'err');
        const v = vlanNum(s);
        if (v === null) return;
        if (v === 1) return P('% La VLAN 1 no se puede borrar.', 'err');
        delete d.vlans[v];
        changed();
      }],
      ['exit', toPriv],
      ['end', toPriv],
    ],
    if: [
      ['ip address <ip> <mask>', setIfaceIp],
      ['no ip address', () => {
        if (d.ifaces?.[cur]) {
          d.ifaces[cur].ip = '';
          d.ifaces[cur].mask = '';
          changed();
        }
      }],
      ['no shutdown', () => {
        ifaceOf(cur).up = true;
        P(`%LINK-5-CHANGED: Interface ${cur}, changed state to up`, 'ok');
        changed();
      }],
      ['shutdown', () => {
        ifaceOf(cur).up = false;
        P(`%LINK-5-CHANGED: Interface ${cur}, changed state to administratively down`);
        changed();
      }],
      ['ip nat inside', () => {
        if (!d.ifaces?.[cur]) return P('% Solo en interfaces de router.', 'err');
        d.ifaces[cur].natIn = true;
        d.ifaces[cur].natOut = false;
        changed();
      }],
      ['ip nat outside', () => {
        if (!d.ifaces?.[cur]) return P('% Solo en interfaces de router.', 'err');
        d.ifaces[cur].natOut = true;
        d.ifaces[cur].natIn = false;
        changed();
      }],
      ['encapsulation dot1q <n>', (s) => {
        const i = d.ifaces?.[cur];
        if (!i || !i.port) return P('% Solo en subinterfaces (ej: interface g0/0.10).', 'err');
        const v = vlanNum(s);
        if (v === null) return;
        i.tag = v;
        changed();
      }],
      ['switchport mode access', swOnly(() => {
        d.switchports[cur].mode = 'access';
        changed();
      })],
      ['switchport mode trunk', swOnly(() => {
        d.switchports[cur].mode = 'trunk';
        changed();
      })],
      ['switchport access vlan <n>', swOnly((s) => {
        const v = vlanNum(s);
        if (v === null) return;
        if (!d.vlans[v]) {
          d.vlans[v] = `VLAN${String(v).padStart(4, '0')}`;
          P(`% Access VLAN does not exist. Creating vlan ${v}`);
        }
        d.switchports[cur].vlan = v;
        changed();
      })],
      ['description <text...>', () => {}],
      ['exit', () => {
        mode = 'config';
        cur = null;
      }],
      ['end', toPriv],
    ],
    vlan: [
      ['name <name>', (n) => {
        d.vlans[cur] = n;
        changed();
      }],
      ['exit', () => {
        mode = 'config';
        cur = null;
      }],
      ['end', toPriv],
    ],
    dhcp: [
      ['network <ip> <mask>', (a, m) => {
        if (ipToInt(a) === null || maskToPrefix(m) === null) return P('% Red o máscara inválida.', 'err');
        const p = d.pools.find((x) => x.name === cur);
        p.net = a;
        p.mask = m;
        changed();
      }],
      ['default-router <ip>', (a) => {
        if (ipToInt(a) === null) return P('% Dirección inválida.', 'err');
        d.pools.find((x) => x.name === cur).gw = a;
        changed();
      }],
      ['dns-server <ip>', (a) => {
        if (ipToInt(a) === null) return P('% Dirección inválida.', 'err');
        d.pools.find((x) => x.name === cur).dns = a;
        changed();
      }],
      ['exit', () => {
        mode = 'config';
        cur = null;
      }],
      ['end', toPriv],
    ],
  };

  // Normaliza filas: tokens + función
  const table = (m) => T[m].map(([p, fn]) => ({ tokens: p.split(' '), fn, text: p }));

  function match(m, toks) {
    const hits = [];
    let incomplete = false;
    for (const row of table(m)) {
      let ok = true;
      let exact = 0;
      let consumed = 0;
      const args = [];
      for (let i = 0; i < row.tokens.length; i++) {
        const pt = row.tokens[i];
        if (i >= toks.length) {
          ok = false;
          incomplete = true;
          break;
        }
        if (pt.endsWith('...>')) {
          args.push(toks.slice(i).join(' ')); // este parámetro se queda con el resto de la línea
          consumed = toks.length;
          break;
        }
        consumed = i + 1;
        if (pt.startsWith('<')) {
          args.push(toks[i]);
          continue;
        }
        const tk = toks[i].toLowerCase();
        if (pt === tk) exact++;
        else if (!pt.startsWith(tk)) {
          ok = false;
          break;
        }
      }
      if (ok && consumed === toks.length) hits.push({ row, args, exact });
    }
    return { hits, incomplete };
  }

  function run(m, toks) {
    const { hits, incomplete } = match(m, toks);
    if (!hits.length) {
      if (incomplete) return P('% Incomplete command.', 'err');
      return P('% Invalid input detected. Escribe ? para ver los comandos de este modo.', 'err');
    }
    const best = Math.max(...hits.map((h) => h.exact));
    const top = hits.filter((h) => h.exact === best);
    if (top.length > 1) return P(`% Ambiguous command: "${toks.join(' ')}"`, 'err');
    top[0].row.fn(...top[0].args);
  }

  const HELP = {
    user: 'Modo usuario: enable para pasar a modo privilegiado.',
    priv: 'Modo privilegiado: configure terminal para configurar.',
    config: 'Modo configuración global.',
    if: 'Configurando una interfaz.',
    vlan: 'Configurando VLAN.',
    dhcp: 'Configurando pool DHCP.',
  };

  return {
    prompt: () => {
      const n = d.name;
      return { user: `${n}>`, priv: `${n}#`, config: `${n}(config)#`, if: `${n}(config-if)#`, vlan: `${n}(config-vlan)#`, dhcp: `${n}(dhcp-config)#` }[mode];
    },
    banner: () => `\n${d.name} · consola de administración\nPulsa Tab para autocompletar y ? para ver comandos.\n`,
    exec(line) {
      let raw = line.trim();
      if (!raw) return;
      if (raw === '?' || raw.endsWith(' ?')) {
        P(HELP[mode]);
        const rows = table(mode).filter((r) => !r.text.startsWith('no ') || mode === 'if');
        P(rows.map((r) => '  ' + r.text).join('\n'));
        return;
      }
      let toks = raw.split(/\s+/);
      // "do show ..." funciona desde cualquier modo de configuración
      if (toks[0].toLowerCase() === 'do' && !['user', 'priv'].includes(mode)) {
        return run('priv', toks.slice(1));
      }
      run(mode, toks);
    },
    // Autocompleta la última palabra si solo hay una opción posible.
    complete(line) {
      const toks = line.split(/\s+/);
      const last = toks.at(-1).toLowerCase();
      const prev = toks.slice(0, -1).map((t) => t.toLowerCase());
      const options = new Set();
      for (const r of table(mode)) {
        if (r.tokens.length <= prev.length) continue;
        let okp = true;
        for (let i = 0; i < prev.length; i++) {
          const pt = r.tokens[i];
          if (!pt.startsWith('<') && !pt.startsWith(prev[i])) {
            okp = false;
            break;
          }
        }
        const nt = r.tokens[prev.length];
        if (okp && !nt.startsWith('<') && nt.startsWith(last)) options.add(nt);
      }
      if (options.size === 1) return [...prev.map((_, i) => toks[i]), [...options][0]].join(' ') + ' ';
      if (options.size > 1) P([...options].join('  '));
      return line;
    },
  };
}

// ---------- Punto de entrada ----------
export function createShell(net, devId, io) {
  const d = net.devices[devId];
  return isHost(d) ? hostShell(net, d, io) : iosShell(net, d, io);
}
