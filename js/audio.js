// ================================================================
//  CyberVR SOC · Música generativa y efectos (Web Audio, sin archivos)
//  Toda la música se sintetiza en vivo: no hay pistas con derechos.
// ================================================================

const PREFS_KEY = 'cybervr-audio';

// Acordes en notas MIDI. Cada acorde dura un compás.
const THEMES = {
  lobby: {
    name: 'Recepción · Bienvenida',
    bpm: 84,
    chords: [[48, 60, 64, 67, 71], [45, 60, 64, 67, 69], [41, 60, 65, 69, 72], [43, 62, 67, 71, 74]],
    scale: [60, 62, 64, 67, 69, 72, 74, 76],
    arp: [0, null, 2, null, 3, null, 2, null, 4, null, 2, null, 3, null, 1, null],
    bass: [0, null, null, null, null, null, 0, null, 0, null, null, null, null, null, null, null],
    drums: { kick: '', hat: '', snare: '' },
    pad: 0.05, arpGain: 0.05, bassGain: 0.12, leadGain: 0.04, leadChance: 0.28, arpType: 'triangle', cutoff: 1500,
  },
  soc: {
    name: 'SOC · Monitoreo 24/7',
    bpm: 100,
    chords: [[45, 57, 60, 64], [41, 57, 60, 65], [38, 57, 62, 65], [40, 56, 59, 64]],
    scale: [57, 60, 62, 64, 67, 69, 72],
    arp: [0, 2, 1, 2, 0, 2, 3, 2, 0, 2, 1, 2, 3, 2, 1, 2],
    bass: [0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, 0, 0, null],
    drums: { kick: 'x.......x.......', hat: '....x.......x...', snare: '' },
    pad: 0.045, arpGain: 0.028, bassGain: 0.12, leadGain: 0.025, leadChance: 0.12, arpType: 'square', cutoff: 900,
  },
  lab: {
    name: 'Lab de Redes · Manos a la obra',
    bpm: 118,
    chords: [[40, 59, 64, 67], [36, 60, 64, 67], [43, 59, 62, 67], [38, 57, 62, 66]],
    scale: [64, 66, 67, 69, 71, 74, 76, 78],
    arp: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 3, 2, 1, 0],
    bass: [0, null, 0, 0, null, 0, 0, null, 0, null, 0, 0, null, 0, 0, null],
    drums: { kick: 'x...x...x...x...', hat: '..x...x...x...xx', snare: '....x.......x...' },
    pad: 0.04, arpGain: 0.04, bassGain: 0.13, leadGain: 0.045, leadChance: 0.3, arpType: 'sawtooth', cutoff: 1800,
  },
  focus: {
    name: 'Concentración',
    bpm: 72,
    chords: [[38, 57, 60, 64, 65], [34, 58, 62, 65, 69], [43, 58, 62, 65, 67], [33, 57, 61, 64, 69]],
    scale: [62, 65, 67, 69, 72, 74],
    arp: [0, null, null, null, 2, null, null, null, 3, null, null, null, 1, null, null, null],
    bass: [0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    drums: { kick: '', hat: '', snare: '' },
    pad: 0.055, arpGain: 0.03, bassGain: 0.1, leadGain: 0.022, leadChance: 0.1, arpType: 'sine', cutoff: 1100,
  },
};
export const THEME_IDS = Object.keys(THEMES);

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function loadPrefs() {
  const base = { music: true, sfx: true, volume: 0.55, track: 'auto' };
  try {
    return Object.assign(base, JSON.parse(localStorage.getItem(PREFS_KEY)) || {});
  } catch {
    return base;
  }
}

class AudioEngine {
  constructor() {
    this.prefs = loadPrefs();
    this.ctx = null;
    this.zone = 'lobby';
    this.focus = false;
    this.current = null;
    this.step = 0;
    this.bar = 0;
    this.nextTime = 0;
    this.motif = [];
    this.listeners = [];
  }

  // Debe llamarse dentro de un gesto del usuario (política de autoplay).
  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    this.master = ctx.createDynamicsCompressor();
    this.master.threshold.value = -14;
    this.master.ratio.value = 4;
    this.master.connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);

    // Reverberación con impulso de ruido sintético
    const len = ctx.sampleRate * 2.4;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    this.reverb.connect(wet);
    wet.connect(this.musicBus);

    // Eco
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.33;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(this.musicBus);

    // Búfer de ruido para percusión
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend();
      else ctx.resume();
    });

    this.nextTime = ctx.currentTime + 0.1;
    this.setThemeNow(this.wantedTheme());
    this.applyVolume(0.6);
    this.timer = setInterval(() => this.tick(), 60);
    this.emit();
  }

  // ---------- Selección de tema ----------
  wantedTheme() {
    if (this.prefs.track !== 'auto') return this.prefs.track;
    return this.focus ? 'focus' : this.zone;
  }
  setZone(zone) {
    if (zone === this.zone) return;
    this.zone = zone;
    this.syncTheme();
  }
  setFocus(on) {
    if (on === this.focus) return;
    this.focus = on;
    this.syncTheme();
  }
  setTrack(id) {
    this.prefs.track = id;
    this.save();
    this.syncTheme();
    this.emit();
  }
  nextTrack() {
    const order = ['auto', ...THEME_IDS];
    this.setTrack(order[(order.indexOf(this.prefs.track) + 1) % order.length]);
  }
  syncTheme() {
    if (!this.ctx) return;
    const want = this.wantedTheme();
    if (want === this.current) return;
    // Baja, cambia y vuelve a subir para que la transición no sea brusca.
    clearTimeout(this.fadeT);
    const g = this.musicBus.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(0, this.ctx.currentTime, 0.25);
    this.fadeT = setTimeout(() => {
      this.setThemeNow(this.wantedTheme());
      this.applyVolume(1.2);
    }, 900);
    this.current = want;
    this.emit();
  }
  setThemeNow(id) {
    this.current = id;
    this.theme = THEMES[id];
    this.step = 0;
    this.bar = 0;
    this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
    this.makeMotif();
  }
  makeMotif() {
    // Motivo de 16 pasos que se repite, para que la melodía tenga identidad.
    const th = this.theme;
    let idx = Math.floor(th.scale.length / 2);
    this.motif = Array.from({ length: 32 }, (_, i) => {
      const onBeat = i % 2 === 0;
      if (Math.random() > th.leadChance * (onBeat ? 1.6 : 0.6)) return null;
      idx = Math.max(0, Math.min(th.scale.length - 1, idx + Math.floor(Math.random() * 5) - 2));
      return th.scale[idx];
    });
  }

  // ---------- Volumen / preferencias ----------
  applyVolume(tc = 0.15) {
    if (!this.ctx) return;
    const v = this.prefs.music ? this.prefs.volume : 0;
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, tc);
  }
  setVolume(v) {
    this.prefs.volume = v;
    this.save();
    this.applyVolume();
  }
  toggleMusic() {
    this.prefs.music = !this.prefs.music;
    this.save();
    this.applyVolume();
    this.emit();
  }
  toggleSfx() {
    this.prefs.sfx = !this.prefs.sfx;
    this.save();
    this.emit();
  }
  save() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch { /* sin almacenamiento */ }
  }
  onChange(fn) {
    this.listeners.push(fn);
  }
  emit() {
    this.listeners.forEach((f) => f());
  }
  label() {
    const t = THEMES[this.wantedTheme()];
    return t ? t.name : '';
  }

  // ---------- Secuenciador ----------
  tick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const stepDur = 60 / this.theme.bpm / 4;
    // Si la pestaña estuvo pausada no se intenta recuperar el tiempo perdido.
    if (this.nextTime < this.ctx.currentTime - 0.3) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
      if (this.step % 16 === 0) this.bar++;
    }
  }
  playStep(step, t, dur) {
    if (!this.prefs.music) return;
    const th = this.theme;
    const s = step % 16;
    const chord = th.chords[this.bar % th.chords.length];
    const section = this.bar % 16; // capas que entran y salen, para no ser monótono

    if (s === 0) this.playPad(chord, t, dur * 16);
    if (th.bass[s] !== null && section >= 2) {
      this.voice(t, midi(chord[0] + (th.bass[s] || 0)), dur * 1.8, { type: 'triangle', gain: th.bassGain, attack: 0.005, cutoff: 500 });
    }
    if (th.arp[s] !== null && section >= 4 && !(section >= 12 && section < 14)) {
      const notes = chord.slice(1);
      const n = notes[th.arp[s] % notes.length] + 12;
      this.voice(t, midi(n), dur * 1.2, { type: th.arpType, gain: th.arpGain, attack: 0.004, cutoff: th.cutoff, send: 0.4 });
    }
    const m = this.motif[(this.bar % 2) * 16 + s];
    if (m && section >= 8) {
      this.voice(t, midi(m + 12), dur * 3, { type: 'triangle', gain: th.leadGain, attack: 0.02, cutoff: 2600, send: 0.7 });
    }
    if (section >= 4) {
      if (th.drums.kick[s] === 'x') this.kick(t);
      if (th.drums.snare[s] === 'x') this.hit(t, 1800, 0.12, 0.05);
      if (th.drums.hat[s] === 'x') this.hit(t, 7500, 0.04, 0.03);
    }
    if (s === 0 && this.bar % 8 === 7) this.makeMotif();
  }
  playPad(chord, t, dur) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(this.theme.cutoff * 0.5, t);
    f.frequency.linearRampToValueAtTime(this.theme.cutoff, t + dur * 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(this.theme.pad, t + dur * 0.25);
    g.gain.setValueAtTime(this.theme.pad, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur * 1.1);
    f.connect(g);
    g.connect(this.musicBus);
    g.connect(this.reverb);
    chord.slice(1).forEach((n, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      o.detune.value = (i % 2 ? 1 : -1) * 7;
      o.connect(f);
      o.start(t);
      o.stop(t + dur * 1.15);
    });
  }
  voice(t, freq, dur, { type = 'sine', gain = 0.1, attack = 0.01, cutoff = 2000, send = 0, bus = null } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(bus || this.musicBus);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(this.delay);
      s.connect(this.reverb);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  kick(t, bus = null) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g);
    g.connect(bus || this.musicBus);
    o.start(t);
    o.stop(t + 0.22);
  }
  hit(t, freq, dur, gain, bus = null) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f);
    f.connect(g);
    g.connect(bus || this.musicBus);
    n.start(t, Math.random() * 0.5);
    n.stop(t + dur + 0.02);
  }

  // ---------- Efectos ----------
  sfx(name) {
    if (!this.ctx || !this.prefs.sfx) return;
    const t = this.ctx.currentTime + 0.005;
    const v = (time, f, d, opts = {}) => this.voice(time, f, d, { bus: this.sfxBus, ...opts });
    const seq = (notes, gap, opts) => notes.forEach((n, i) => v(t + i * gap, midi(n), gap * 2.2, opts));
    switch (name) {
      case 'click':
        v(t, 1100, 0.05, { type: 'square', gain: 0.03, attack: 0.002, cutoff: 3000 });
        break;
      case 'plug':
        this.hit(t, 2600, 0.05, 0.25, this.sfxBus);
        this.hit(t + 0.06, 3800, 0.04, 0.2, this.sfxBus);
        break;
      case 'crimp':
        this.hit(t, 900, 0.09, 0.4, this.sfxBus);
        this.hit(t + 0.05, 3200, 0.06, 0.3, this.sfxBus);
        break;
      case 'punch':
        this.kick(t, this.sfxBus);
        this.hit(t, 2400, 0.08, 0.4, this.sfxBus);
        break;
      case 'ok':
        seq([76, 83], 0.08, { type: 'triangle', gain: 0.1 });
        break;
      case 'error':
        seq([50, 47], 0.12, { type: 'square', gain: 0.05, cutoff: 900 });
        break;
      case 'beep':
        v(t, 980, 0.18, { type: 'square', gain: 0.05, cutoff: 3000 });
        break;
      case 'power':
        v(t, 90, 0.5, { type: 'sawtooth', gain: 0.07, cutoff: 500 });
        seq([55, 62], 0.1, { type: 'triangle', gain: 0.05 });
        break;
      case 'startup':
        seq([60, 67, 72, 76, 79], 0.14, { type: 'triangle', gain: 0.08, send: 0.5 });
        break;
      case 'shutdown':
        seq([79, 72, 67, 60], 0.16, { type: 'triangle', gain: 0.08, send: 0.5 });
        break;
      case 'door':
        v(t, 70, 0.9, { type: 'sawtooth', gain: 0.09, cutoff: 350 });
        seq([72, 79], 0.14, { type: 'sine', gain: 0.07 });
        break;
      case 'win':
        seq([64, 67, 72, 76, 79, 84], 0.1, { type: 'triangle', gain: 0.1, send: 0.6 });
        break;
      default:
    }
  }
}

export const audio = new AudioEngine();

// ---------- Mini reproductor en pantalla ----------
export function mountAudioWidget(root) {
  root.innerHTML = `
    <button id="au-music" title="Música (tecla M)"></button>
    <select id="au-track" title="Pista (tecla N)">
      <option value="auto">Auto · según la sala</option>
      ${THEME_IDS.map((id) => `<option value="${id}">${THEMES[id].name}</option>`).join('')}
    </select>
    <input id="au-vol" type="range" min="0" max="1" step="0.01" title="Volumen">
    <button id="au-sfx" title="Efectos de sonido"></button>`;
  const music = root.querySelector('#au-music');
  const track = root.querySelector('#au-track');
  const vol = root.querySelector('#au-vol');
  const sfx = root.querySelector('#au-sfx');
  const paint = () => {
    music.textContent = audio.prefs.music ? '🎵' : '🔇';
    music.classList.toggle('off', !audio.prefs.music);
    sfx.textContent = audio.prefs.sfx ? '🔔' : '🔕';
    sfx.classList.toggle('off', !audio.prefs.sfx);
    track.value = audio.prefs.track;
    vol.value = audio.prefs.volume;
  };
  // Los clics en el reproductor también cuentan como gesto para activar el audio.
  root.addEventListener('pointerdown', () => audio.start());
  music.addEventListener('click', () => audio.toggleMusic());
  sfx.addEventListener('click', () => audio.toggleSfx());
  track.addEventListener('change', () => audio.setTrack(track.value));
  vol.addEventListener('input', () => audio.setVolume(+vol.value));
  // Impide que las teclas usadas aquí activen controles del juego.
  root.addEventListener('keydown', (e) => e.stopPropagation());
  audio.onChange(paint);
  paint();
}
