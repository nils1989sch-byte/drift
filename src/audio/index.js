// SFX + music, fully synthesized with WebAudio (no audio files). Chiptune/SNES-ish: pulse waves with
// different duty cycles, triangle bass, noise drums, and a small echo (the SNES DSP echo feel).
// All compositions are original. Safe without AudioContext (headless): every call becomes a no-op.

const NOTE_I = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteFreq(tok) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return 0;
  const midi = 12 * (+m[3] + 1) + NOTE_I[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
}
const N = noteFreq;
const midiF = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------------------------------------------
// Songs. Melody tokens are 8th notes: note | '.' hold | '-' rest. One string per bar (8 tokens).
// chords: one per bar ('F', 'Dm', 'Bb', 'C#' …). Bass/arp/drums are generated from the chords + style.
// ---------------------------------------------------------------------------------------------------
const SONGS = {
  title: {
    bpm: 76, lead: 'triangle', leadVol: 0.5, arp: 'pulse12', arpVol: 0.1, bass: 'long', drums: null, echo: 0.35,
    chords: ['Am', 'F', 'C', 'G', 'F', 'G', 'C', 'C'],
    melody: [
      'A4 . C5 . E5 . . D5', 'C5 . . . A4 . . .', 'G4 . C5 . E5 . G5 .', 'F5 . E5 . D5 . . .',
      'C5 . F5 . A5 . . G5', 'F5 . . . D5 . . .', 'E5 . D5 . C5 . . .', 'C5 . . . - - - -',
    ],
  },
  overworld: {
    bpm: 120, lead: 'pulse25', leadVol: 0.32, arp: 'pulse12', arpVol: 0.07, bass: 'bounce', drums: 'k h s h k k s h', echo: 0.2,
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'Dm', 'Bb', 'F', 'C', 'Gm', 'Bb', 'C', 'C'],
    melody: [
      'F4 . A4 C5 F5 . E5 D5', 'C5 . . G4 C5 D5 E5 .', 'F5 . E5 D5 A4 . D5 .', 'D5 C5 Bb4 . F4 . . .',
      'F4 . A4 C5 F5 . G5 A5', 'G5 . E5 . C5 . E5 G5', 'F5 . D5 Bb4 D5 . F5 .', 'E5 . . . C5 . - -',
      'A5 . . G5 F5 . E5 F5', 'D5 . . . Bb4 C5 D5 .', 'C5 . A4 . F4 . A4 C5', 'E5 . D5 . C5 . . .',
      'Bb4 . D5 . G5 . F5 E5', 'F5 . D5 . Bb4 . D5 F5', 'G5 . . . E5 . G5 .', 'C6 . . . - - - -',
    ],
  },
  dungeon: {
    bpm: 84, lead: 'pulse50', leadVol: 0.2, arp: 'pulse12', arpVol: 0.08, bass: 'long', drums: 'k - - h - - h -', echo: 0.4, vibrato: true,
    chords: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'A', 'A'],
    melody: [
      'D5 . . . . . A4 .', 'F5 . E5 . D5 . . .', '- - D5 . F5 . Bb5 .', 'A5 . . . C#5 . . .',
      'D5 . F5 . A5 . . G5', 'G5 . F5 . D5 . Bb4 .', 'A4 . . . E5 . C#5 .', 'A4 . . . - - - -',
    ],
  },
  boss: {
    bpm: 150, lead: 'pulse25', leadVol: 0.3, arp: 'pulse12', arpVol: 0.07, bass: 'drive', drums: 'k h s h k k s s', echo: 0.15,
    chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'],
    melody: [
      'E5 . G5 . B5 . A5 G5', 'F#5 . . . E5 . D5 .', 'E5 . . . G5 . C6 .', 'B5 . A5 . F#5 . D5 .',
      'E5 . B4 . E5 . G5 .', 'B5 . . A5 G5 . F#5 .', 'G5 . E5 . C5 . E5 .', 'D#5 . . . F#5 . B5 .',
    ],
  },
};

function chordNotes(name) {
  const m = /^([A-G])([#b]?)(m?)$/.exec(name) || ['', 'C', '', ''];
  const root = NOTE_I[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return { root, tones: m[3] ? [0, 3, 7] : [0, 4, 7] };
}

// expand a song to per-16th-step events
function compileSong(s) {
  const steps = s.chords.length * 16;
  const lead = new Array(steps).fill(null);
  let st = 0;
  for (const bar of s.melody) {
    const toks = bar.trim().split(/\s+/);
    for (const t of toks) {
      if (t !== '.' && t !== '-') lead[st] = { f: N(t), len: 2 };
      else if (t === '.') { for (let b = st - 1; b >= 0; b--) if (lead[b]) { lead[b].len += 2; break; } else if (lead[b] === false) break; }
      else lead[st] = false;
      st += 2;
    }
  }
  for (let i = 0; i < steps; i++) if (lead[i] === false) lead[i] = null;
  const bass = [], arp = [], drum = [];
  const dpat = s.drums ? s.drums.split(/\s+/) : null;
  s.chords.forEach((c, bi) => {
    const { root, tones } = chordNotes(c);
    const b0 = 36 + root; // C2-ish
    for (let k = 0; k < 16; k++) {
      const i = bi * 16 + k;
      if (s.bass === 'long') { if (k === 0) bass[i] = { f: midiF(b0), len: 8 }; if (k === 8) bass[i] = { f: midiF(b0 + 7), len: 8 }; }
      else if (s.bass === 'bounce') { if (k % 4 === 0) bass[i] = { f: midiF(k % 8 === 0 ? b0 : b0 + 12), len: 2 }; if (k === 14) bass[i] = { f: midiF(b0 + 7), len: 2 }; }
      else if (s.bass === 'drive') { if (k % 2 === 0) bass[i] = { f: midiF(k === 6 || k === 14 ? b0 + 12 : b0), len: 1 }; }
      if (s.arp) { const seq = [0, 1, 2, 1]; if (k % 2 === 0 || s.bpm < 100) arp[i] = { f: midiF(60 + root + tones[seq[(k >> (s.bpm < 100 ? 0 : 1)) % 4]] + (k >= 8 ? 12 : 0) - (root > 6 ? 12 : 0)), len: 1 }; }
      if (dpat && k % 2 === 0) { const d = dpat[(k >> 1) % dpat.length]; if (d && d !== '-' && d !== '.') drum[i] = d; }
    }
  });
  return { ...s, steps, seqLead: lead, seqBass: bass, seqArp: arp, seqDrum: drum };
}

// ---------------------------------------------------------------------------------------------------
export function createSFX(opts = {}) {
  const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  let ctx = null, master = null, sfxBus = null, musicBus = null, echoIn = null;
  let volume = opts.volume ?? 0.7, musicVolume = opts.musicVolume ?? 0.5, muted = false;
  const waves = {};
  let noiseBuf = null;
  const last = {};
  let wantMusic = null, song = null, schedTimer = null, lowHpTimer = null;

  function ensure() {
    if (ctx || !AC) return ctx;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
      master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = musicVolume * 0.45; musicBus.connect(master);
      // SNES-style echo (feedback delay with lowpass in the loop)
      echoIn = ctx.createGain(); echoIn.gain.value = 1;
      const d = ctx.createDelay(1); d.delayTime.value = 0.16;
      const fb = ctx.createGain(); fb.gain.value = 0.32;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      const wet = ctx.createGain(); wet.gain.value = 0.28;
      echoIn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(master);
      // pulse waves
      for (const [k, duty] of [['pulse12', 0.125], ['pulse25', 0.25], ['pulse50', 0.5]]) {
        const n = 48, re = new Float32Array(n), im = new Float32Array(n);
        for (let i = 1; i < n; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
        waves[k] = ctx.createPeriodicWave(re, im);
      }
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) { console.warn('audio disabled', e); ctx = null; }
    return ctx;
  }
  const ready = () => ctx && ctx.state === 'running';

  // ---- synth primitives (t = absolute start time) ----
  function env(g, t, dur, vol, a = 0.004, curve = 'exp') {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else { g.gain.setValueAtTime(vol, Math.max(t + a, t + dur - 0.03)); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
  }
  function tone(type, f0, f1, t, dur, vol, o = {}) {
    const osc = ctx.createOscillator();
    if (waves[type]) osc.setPeriodicWave(waves[type]); else osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 && f1 !== f0) {
      if (o.lin) osc.frequency.linearRampToValueAtTime(Math.max(1, f1), t + (o.slide ?? dur));
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + (o.slide ?? dur));
    }
    if (o.vib) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vibHz || 6; lg.gain.value = o.vib;
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(t + (o.vibDelay || 0)); lfo.stop(t + dur + 0.05);
    }
    const g = ctx.createGain();
    env(g, t, dur, vol, o.a, o.curve);
    osc.connect(g);
    g.connect(o.dest || sfxBus);
    if (o.echo !== false && echoIn) { const eg = ctx.createGain(); eg.gain.value = o.echo ?? 0.5; g.connect(eg); eg.connect(echoIn); }
    osc.start(t); osc.stop(t + dur + 0.05);
    return osc;
  }
  function noise(t, dur, vol, o = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    if (o.rate) src.playbackRate.value = o.rate;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass'; f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.f0 || 2000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + (o.slide ?? dur));
    const g = ctx.createGain();
    env(g, t, dur, vol, o.a ?? 0.002, o.curve);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    if (o.echo && echoIn) { const eg = ctx.createGain(); eg.gain.value = o.echo; g.connect(eg); eg.connect(echoIn); }
    src.start(t, Math.random() * 0.8); src.stop(t + dur + 0.05);
    return src;
  }
  const seq = (t, notes, step, fn) => notes.forEach((n, i) => n && fn(N(n) || n, t + i * step, i));

  // ---- sound bank ----
  const SFX = {
    sword(t) {
      noise(t, 0.13, 0.35, { f0: 5500, f1: 900, q: 1.4 });
      tone('pulse25', 1100, 380, t, 0.08, 0.07, { echo: 0.2 });
    },
    sword_spin(t) {
      for (let i = 0; i < 4; i++) noise(t + i * 0.09, 0.12, 0.28, { f0: 6000 - i * 900, f1: 1200, q: 1.6 });
      seq(t, ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.05, (f, tt) => tone('pulse12', f, f, tt, 0.09, 0.08));
    },
    sword_charge(t) { tone('pulse12', 600, 1400, t, 0.35, 0.06, { lin: true }); },
    hit(t) { // sword hits something solid (clink)
      tone('square', 1900, 1700, t, 0.07, 0.12); tone('square', 2550, 2400, t + 0.01, 0.1, 0.08);
      noise(t, 0.04, 0.25, { type: 'highpass', f0: 4000 });
    },
    enemy_hit(t) {
      tone('pulse25', 700, 140, t, 0.14, 0.2, { echo: 0.2 });
      noise(t, 0.08, 0.3, { f0: 1800, f1: 400 });
    },
    enemy_die(t) {
      noise(t, 0.3, 0.35, { type: 'lowpass', f0: 3000, f1: 200 });
      seq(t, [880, 660, 520, 390, 260], 0.045, (f, tt) => tone('pulse50', f, f * 0.8, tt, 0.06, 0.12));
    },
    hurt(t) {
      tone('pulse50', 520, 180, t, 0.26, 0.18, { vib: 60, vibHz: 28 });
      noise(t, 0.06, 0.2, { f0: 1200 });
    },
    cut_grass(t) {
      noise(t, 0.06, 0.32, { type: 'highpass', f0: 3200 });
      noise(t + 0.05, 0.09, 0.24, { f0: 2600, f1: 1200, q: 2 });
    },
    lift(t) { tone('pulse25', 220, 440, t, 0.14, 0.14, { lin: true }); noise(t, 0.05, 0.12, { f0: 900 }); },
    throw(t) { noise(t, 0.22, 0.28, { f0: 600, f1: 2800, q: 2.5, slide: 0.12 }); },
    shatter(t) {
      noise(t, 0.18, 0.4, { type: 'highpass', f0: 2200 });
      noise(t + 0.03, 0.25, 0.25, { f0: 5000, f1: 2000, q: 3 });
      [3136, 2637, 3520, 2349].forEach((f, i) => tone('square', f, f, t + 0.02 + i * 0.035, 0.05, 0.04));
    },
    rupee(t) { seq(t, ['E6', 'B6'], 0.06, (f, tt, i) => tone('pulse25', f, f, tt, i ? 0.22 : 0.07, 0.11)); },
    rupee_big(t) { seq(t, ['E6', 'G#6', 'B6', 'E7'], 0.05, (f, tt) => tone('pulse25', f, f, tt, 0.12, 0.1)); },
    heart(t) { seq(t, ['A5', 'E6'], 0.07, (f, tt) => tone('triangle', f, f, tt, 0.18, 0.3)); },
    key(t) { seq(t, ['G5', 'D6', 'G6'], 0.06, (f, tt) => tone('pulse12', f, f, tt, 0.15, 0.13)); },
    pickup(t) { tone('pulse25', 880, 1320, t, 0.08, 0.1); },
    chest_open(t) {
      tone('sawtooth', 110, 160, t, 0.32, 0.06, { vib: 12, vibHz: 18, echo: false }); // creak
      noise(t + 0.3, 0.06, 0.3, { type: 'lowpass', f0: 900 });                    // lid pop
      tone('pulse50', 196, 98, t + 0.3, 0.1, 0.12);
    },
    item_get(t) { // short original fanfare (C – D – E rising, resolving onto a held G major chord)
      const s = 0.11;
      seq(t, ['G4', 'C5', 'D5', 'E5', null, 'D5', 'G5'], s, (f, tt) => tone('pulse25', f, f, tt, s * 0.95, 0.15, { curve: 'lin' }));
      const h = t + s * 7;
      ['G5', 'B5', 'D6'].forEach((n) => tone('pulse12', N(n), N(n), h, 0.7, 0.08, { curve: 'lin', vib: 4, vibDelay: 0.2 }));
      tone('pulse25', N('G5'), N('G5'), h, 0.7, 0.14, { curve: 'lin', vib: 5, vibDelay: 0.2 });
      seq(t, ['C3', 'C3', 'G2', 'G2'], s * 2, (f, tt) => tone('triangle', f, f, tt, s * 1.8, 0.3, { echo: false }));
      tone('triangle', N('G2'), N('G2'), h, 0.7, 0.3, { curve: 'lin', echo: false });
    },
    secret(t) { // original "something opened" jingle: two climbing triads, a chromatic turn, a bright landing
      const s = 0.095;
      const notes = ['D5', 'F#5', 'A5', 'C#6', 'E5', 'G#5', 'B5', 'D#6'];
      seq(t, notes, s, (f, tt) => tone('pulse25', f, f, tt, s * 1.6, 0.12));
      seq(t, notes, s, (f, tt) => tone('pulse12', f * 2, f * 2, tt + 0.03, s, 0.035));
      const h = t + notes.length * s;
      tone('pulse25', N('E6'), N('E6'), h, 0.8, 0.14, { curve: 'lin', vib: 6, vibDelay: 0.25 });
      tone('pulse12', N('B5'), N('B5'), h, 0.8, 0.07, { curve: 'lin' });
      tone('triangle', N('E3'), N('E3'), h, 0.8, 0.3, { curve: 'lin', echo: false });
      [0, 0.06, 0.12, 0.18].forEach((d, i) => tone('square', N('E7') * (1 + i * 0.12), N('E7'), h + d, 0.05, 0.025));
    },
    door(t) {
      noise(t, 0.35, 0.3, { type: 'lowpass', f0: 500, f1: 120 });
      tone('pulse50', 90, 60, t, 0.35, 0.12, { echo: false });
      noise(t + 0.33, 0.08, 0.35, { type: 'lowpass', f0: 700 });
    },
    stairs(t) { seq(t, [660, 590, 520, 460, 400], 0.07, (f, tt) => { tone('pulse50', f, f * 0.95, tt, 0.05, 0.08); noise(tt, 0.03, 0.12, { f0: 1500 }); }); },
    splash(t) {
      noise(t, 0.35, 0.35, { type: 'lowpass', f0: 3500, f1: 300 });
      noise(t + 0.05, 0.2, 0.18, { f0: 1600, f1: 700, q: 3, echo: 0.3 });
    },
    bomb_fuse(t) { for (let i = 0; i < 8; i++) noise(t + i * 0.05 + Math.random() * 0.02, 0.025, 0.14, { type: 'highpass', f0: 5000 }); },
    explosion(t) {
      noise(t, 0.9, 0.7, { type: 'lowpass', f0: 2400, f1: 80, q: 0.7, echo: 0.4 });
      tone('sine', 150, 35, t, 0.5, 0.5, { echo: false });
      noise(t, 0.08, 0.5, { type: 'highpass', f0: 1500 });
    },
    menu_move(t) { tone('pulse25', 1320, 1320, t, 0.035, 0.08, { echo: false }); },
    menu_select(t) { tone('pulse25', 988, 988, t, 0.05, 0.1, { echo: false }); tone('pulse25', 1480, 1480, t + 0.05, 0.08, 0.1); },
    menu_open(t) { seq(t, [660, 880, 1100], 0.04, (f, tt) => tone('pulse12', f, f, tt, 0.06, 0.08)); },
    menu_close(t) { seq(t, [1100, 880, 660], 0.04, (f, tt) => tone('pulse12', f, f, tt, 0.06, 0.08)); },
    text_blip(t) { const f = 700 + Math.random() * 60; tone('pulse50', f, f, t, 0.025, 0.045, { echo: false, curve: 'lin' }); },
    error(t) { tone('pulse50', 140, 120, t, 0.18, 0.12, { echo: false, curve: 'lin' }); },
    low_health(t) { tone('pulse50', 1047, 1047, t, 0.07, 0.07, { echo: false, curve: 'lin' }); tone('pulse50', 1047, 1047, t + 0.14, 0.07, 0.07, { echo: false, curve: 'lin' }); },
    fall(t) { tone('pulse25', 900, 70, t, 1.0, 0.13, { vib: 30, vibHz: 10, echo: 0.3 }); },
    boss_roar(t) {
      const ws = ctx.createWaveShaper(); const c = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 4); }
      ws.curve = c;
      const g = ctx.createGain(); g.gain.value = 0.5; ws.connect(g); g.connect(sfxBus);
      const ge = ctx.createGain(); ge.gain.value = 0.4; g.connect(ge); ge.connect(echoIn);
      tone('sawtooth', 95, 55, t, 1.2, 0.35, { dest: ws, vib: 14, vibHz: 9, echo: false });
      tone('sawtooth', 142, 80, t, 1.1, 0.2, { dest: ws, vib: 10, vibHz: 7, echo: false });
      noise(t, 1.2, 0.4, { type: 'lowpass', f0: 900, f1: 200, dest: ws });
    },
    shoot(t) { tone('pulse25', 520, 260, t, 0.08, 0.1); noise(t, 0.05, 0.15, { f0: 1200 }); },
    bounce(t) { tone('triangle', 300, 520, t, 0.08, 0.25, { echo: false }); },
    push(t) { noise(t, 0.12, 0.18, { type: 'lowpass', f0: 600 }); },
    switch(t) { tone('pulse50', 300, 300, t, 0.05, 0.12); tone('pulse50', 450, 450, t + 0.06, 0.08, 0.12); },
    dash(t) { noise(t, 0.15, 0.2, { f0: 800, f1: 300 }); },
    heart_container(t) { seq(t, ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.06, (f, tt) => tone('pulse25', f, f, tt, 0.2, 0.09)); },
    save(t) { seq(t, ['G5', 'C6', 'E6'], 0.09, (f, tt) => tone('triangle', f, f, tt, 0.3, 0.25)); },
  };
  const GAP = { text_blip: 0.03, menu_move: 0.03, bomb_fuse: 0.35, low_health: 0.5 };

  // ---- music sequencer ----
  const compiled = {};
  function startSong(name) {
    const def = SONGS[name]; if (!def) return;
    const s = compiled[name] || (compiled[name] = compileSong(def));
    const gain = ctx.createGain(); gain.gain.value = 0.0001; gain.connect(musicBus);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.4);
    song = { name, s, gain, step: 0, next: ctx.currentTime + 0.08, dt: 60 / s.bpm / 4 };
    if (!schedTimer) schedTimer = setInterval(schedule, 25);
  }
  function stopSong(fade = 0.5) {
    if (!song) return;
    const g = song.gain;
    try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(g.gain.value, ctx.currentTime); g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade); } catch { /* ignore */ }
    setTimeout(() => { try { g.disconnect(); } catch { /* ignore */ } }, fade * 1000 + 200);
    song = null;
  }
  const INST = {
    lead(s, ev, t, dur, dest) {
      const v = s.leadVol;
      tone(s.lead, ev.f, ev.f, t, dur * 0.95, v * 0.5, { dest, curve: 'lin', a: 0.006, vib: dur > 0.3 ? ev.f * 0.012 : 0, vibDelay: 0.18, vibHz: 5.5, echo: s.echo });
    },
    bass(s, ev, t, dur, dest) { tone('triangle', ev.f, ev.f, t, dur * 0.85, 0.42, { dest, curve: 'lin', echo: false }); },
    arp(s, ev, t, dur, dest) { tone(s.arp, ev.f, ev.f, t, Math.min(0.09, dur), s.arpVol, { dest, echo: s.echo }); },
    drum(d, t, dest) {
      if (d === 'k') { tone('sine', 140, 40, t, 0.13, 0.55, { dest, echo: false }); }
      else if (d === 's') { noise(t, 0.12, 0.28, { f0: 1800, q: 0.8, dest }); tone('triangle', 220, 160, t, 0.06, 0.2, { dest, echo: false }); }
      else if (d === 'h') noise(t, 0.035, 0.12, { type: 'highpass', f0: 7000, dest });
    },
  };
  function schedule() {
    if (!song || !ready()) return;
    const now = ctx.currentTime;
    if (song.next < now - 0.25) song.next = now + 0.05; // tab was throttled: skip ahead instead of bursting
    while (song.next < now + 0.14) {
      const { s } = song, i = song.step, t = song.next, d = song.dt, dest = song.gain;
      try {
        const l = s.seqLead[i]; if (l) INST.lead(s, l, t, l.len * d, dest);
        const b = s.seqBass[i]; if (b) INST.bass(s, b, t, b.len * d, dest);
        const a = s.seqArp[i]; if (a) INST.arp(s, a, t, d, dest);
        const k = s.seqDrum[i]; if (k) INST.drum(k, t, dest);
      } catch (e) { console.warn(e); }
      song.step = (i + 1) % s.steps;
      song.next += d;
    }
  }

  const api = {
    play(name, o = {}) {
      if (!ready()) return false;
      const f = SFX[name]; if (!f) return false;
      const now = ctx.currentTime;
      if (now - (last[name] ?? -1) < (GAP[name] ?? 0.025)) return false;
      last[name] = now;
      try { f(now + 0.005 + (o.delay || 0), o); } catch (e) { console.warn('sfx', name, e); return false; }
      return true;
    },
    music(name) {
      if (name === undefined) return wantMusic;
      wantMusic = name && SONGS[name] ? name : null;
      if (!ready()) return wantMusic;
      if (song && song.name === wantMusic) return wantMusic;
      stopSong();
      if (wantMusic) startSong(wantMusic);
      return wantMusic;
    },
    unlock() {
      if (!ensure()) return Promise.resolve(false);
      try {
        // play a silent buffer (iOS) and resume
        const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
      } catch { /* ignore */ }
      const p = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
      return Promise.resolve(p).then(() => {
        if (wantMusic && (!song || song.name !== wantMusic)) { stopSong(0.1); startSong(wantMusic); }
        return ctx.state === 'running';
      }).catch(() => false);
    },
    setVolume(v) { volume = Math.max(0, Math.min(1, +v || 0)); if (master && !muted) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02); },
    setMusicVolume(v) { musicVolume = Math.max(0, Math.min(1, +v || 0)); if (musicBus) musicBus.gain.setTargetAtTime(musicVolume * 0.45, ctx.currentTime, 0.05); },
    mute(on = !muted) { muted = !!on; if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02); return muted; },
    get muted() { return muted; },
    get volume() { return volume; },
    get unlocked() { return !!ready(); },
    // beeps every ~0.9 s while on (ALttP low-health warning)
    setLowHealth(on) {
      if (on && !lowHpTimer) { api.play('low_health'); lowHpTimer = setInterval(() => api.play('low_health'), 900); }
      else if (!on && lowHpTimer) { clearInterval(lowHpTimer); lowHpTimer = null; }
    },
    has: (name) => !!SFX[name],
    names: Object.keys(SFX),
    songs: Object.keys(SONGS),
    get context() { return ctx; },
  };
  if (typeof document !== 'undefined') {
    // pause music in background tabs
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend?.().catch(() => {});
      else if (song || wantMusic) ctx.resume?.().catch(() => {});
    });
  }
  return api;
}
