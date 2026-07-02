// Lightweight synthesised sound effects (no audio files). Created lazily on the
// first user gesture (browser autoplay policy). Fully guarded so it no-ops in
// headless/no-Web-Audio environments. Listens on the EventBus for 'sfx' names
// plus 'levelup'/'achievement'.
const MUTE_KEY = 'singaporescape:muted';
const MASTER = 0.16;

export class Sfx {
  constructor(bus) {
    this.bus = bus;
    this.ctx = null;
    this.master = null;
    this.muted = this._loadMuted();
    bus.on('sfx', (n) => this.play(n));
    bus.on('levelup', () => this.play('level'));
    bus.on('achievement', () => this.play('achievement'));
  }

  /** Create / resume the AudioContext — must be called from a user gesture. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    this._saveMuted(m);
    if (this.master) this.master.gain.value = m ? 0 : MASTER;
  }
  toggle() { this.setMuted(!this.muted); return this.muted; }

  _tone(freq, dur, type = 'sine', t0 = 0, vol = 1, slideTo = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + t0;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  _noise(dur, vol = 0.4) {
    if (!this.ctx) return;
    const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); // decaying burst
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.master);
    s.start(this.ctx.currentTime);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'hit': this._noise(0.05, 0.3); this._tone(190, 0.07, 'square', 0, 0.45, 90); break;
      case 'swish': this._noise(0.08, 0.16); this._tone(900, 0.08, 'sine', 0, 0.12, 300); break;
      case 'die': this._noise(0.09, 0.32); this._tone(130, 0.18, 'square', 0, 0.4, 45); break;
      case 'bossdie':
        this._noise(0.22, 0.4); this._tone(90, 0.5, 'sawtooth', 0, 0.5, 30);
        [392, 523, 659].forEach((f, i) => this._tone(f, 0.2, 'triangle', 0.18 + i * 0.11, 0.4));
        break;
      case 'hurt': this._tone(210, 0.2, 'sawtooth', 0, 0.55, 70); break;
      case 'eat': this._tone(300, 0.13, 'sine', 0, 0.5, 540); break;
      case 'pickup': this._tone(720, 0.07, 'triangle', 0, 0.5, 940); break;
      case 'gather': this._tone(470, 0.09, 'triangle', 0, 0.35, 640); break;
      case 'clang': this._noise(0.03, 0.2); this._tone(840, 0.11, 'square', 0, 0.3, 620); this._tone(1260, 0.07, 'sine', 0, 0.18); break;
      case 'spec': this._noise(0.18, 0.28); this._tone(140, 0.22, 'sawtooth', 0, 0.4, 540); break;
      case 'travel': this._tone(300, 0.28, 'sine', 0, 0.4, 760); break;
      case 'level': [523, 659, 784].forEach((f, i) => this._tone(f, 0.17, 'triangle', i * 0.1, 0.55)); break;
      case 'achievement': [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.18, 'triangle', i * 0.09, 0.55)); break;
      case 'click': this._tone(600, 0.04, 'square', 0, 0.25); break;
      default: break;
    }
  }

  _loadMuted() { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } }
  _saveMuted(m) { try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ } }
}
