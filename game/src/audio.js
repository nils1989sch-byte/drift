// Synthetisierte Soundeffekte (WebAudio, keine Dateien nötig).
export class Audio {
  constructor() { this.ctx = null; this.muted = false; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; }

  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.3, freq = 1200, q = 0.8, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  play(name, k = 1) {
    switch (name) {
      case 'pickup': this.tone(420, 0.12, { type: 'triangle', vol: 0.25, slide: 1.8 }); break;
      case 'drop': this.tone(260, 0.12, { type: 'triangle', vol: 0.2, slide: 0.6 }); break;
      case 'bump':
        this.noise(0.15, { vol: 0.25 * k, freq: 300 });
        this.tone(110, 0.15, { type: 'sine', vol: 0.3 * k, slide: 0.5 }); break;
      case 'crash':
        this.noise(0.7, { vol: 0.6, freq: 2500, q: 0.5 });
        this.noise(0.5, { vol: 0.5, freq: 500, q: 0.7 });
        this.tone(90, 0.5, { type: 'sawtooth', vol: 0.25, slide: 0.3 }); break;
      case 'deliver':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, { type: 'square', vol: 0.09, delay: i * 0.07 })); break;
      case 'strain': this.tone(160 + Math.random() * 40, 0.1, { type: 'sawtooth', vol: 0.06 }); break;
      case 'need': this.tone(600, 0.08, { type: 'square', vol: 0.07 }); this.tone(500, 0.08, { type: 'square', vol: 0.07, delay: 0.1 }); break;
      case 'roomba': this.tone(880, 0.06, { type: 'square', vol: 0.06 }); this.tone(660, 0.06, { type: 'square', vol: 0.06, delay: 0.08 }); break;
      case 'step': this.noise(0.05, { vol: 0.04, freq: 900 }); break;
      case 'tick': this.tone(1000, 0.05, { type: 'square', vol: 0.08 }); break;
      case 'go': this.tone(880, 0.35, { type: 'square', vol: 0.12 }); break;
      case 'end':
        [784, 659, 523, 392].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.15, delay: i * 0.12 })); break;
      case 'win':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.14, delay: i * 0.1 })); break;
    }
  }
}
