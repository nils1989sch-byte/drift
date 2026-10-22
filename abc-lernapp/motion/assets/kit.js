/* ABC mit Bruno – motion kit.
   Every composition is a pure function render(t) of the timeline time t (seconds).
   HyperFrames seeks a paused GSAP timeline per frame; we tween a clock object whose
   setter calls render(t). No Math.random / Date: randomness comes from a seeded PRNG. */
(function () {
  const K = {};
  K.clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  K.lerp = (a, b, p) => a + (b - a) * p;
  K.prog = (t, t0, d) => K.clamp((t - t0) / d);

  // CSS-style cubic-bezier easing (Newton + bisection fallback)
  K.bezier = function (x1, y1, x2, y2) {
    const A = (a, b) => 1 - 3 * b + 3 * a, B = (a, b) => 3 * b - 6 * a, C = a => 3 * a;
    const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const s = slope(t, x1, x2); if (Math.abs(s) < 1e-6) break;
        const e = calc(t, x1, x2) - x; t -= e / s;
      }
      if (t < 0 || t > 1 || Math.abs(calc(t, x1, x2) - x) > 1e-4) {
        let lo = 0, hi = 1; t = x;
        for (let i = 0; i < 30; i++) { const v = calc(t, x1, x2); if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      }
      return calc(t, y1, y2);
    };
  };
  K.E = {
    spring: K.bezier(.34, 1.56, .64, 1),
    springSoft: K.bezier(.5, 1.35, .6, 1),
    out: K.bezier(.22, 1, .36, 1),
    inOut: K.bezier(.45, 0, .55, 1),
    in: K.bezier(.55, 0, .9, .5),
    outQuad: p => 1 - (1 - p) * (1 - p),
    inQuad: p => p * p,
    sine: p => (1 - Math.cos(Math.PI * p)) / 2,
  };

  // Damped spring 0 -> 1 (closed form), stiffness/damping/mass as in DESIGN.md.
  K.springAt = function (t, k = 260, c = 14, m = 1) {
    if (t <= 0) return 0;
    const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };
  K.PLAYFUL = [260, 14, 1];
  K.SOFT = [180, 20, 1];
  K.spr = (t, t0, cfg = K.PLAYFUL) => K.springAt(t - t0, cfg[0], cfg[1], cfg[2]);

  // Seeded PRNG (mulberry32) — deterministic "randomness"
  K.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // Smooth bump 0 -> 1 -> 0 over [t0, t0+d]
  K.bump = (t, t0, d) => { const p = K.prog(t, t0, d); return Math.sin(Math.PI * p); };
  // Breathing phase 0..1..0 with period
  K.breath = (t, period = 3.2) => (1 - Math.cos(2 * Math.PI * t / period)) / 2;
  // Blink lid value (0 open, 1 closed) for a list of blink start times (~140ms)
  K.blink = function (t, times) {
    let v = 0;
    for (const b of times) { const p = (t - b) / 0.14; if (p > 0 && p < 1) v = Math.max(v, Math.sin(Math.PI * p)); }
    return v;
  };

  // Bind render(t) to a HyperFrames-controlled paused GSAP timeline.
  K.bind = function (compId, duration, render) {
    const clock = { _t: -1, get t() { return this._t; }, set t(v) { this._t = v; render(v); } };
    const tl = gsap.timeline({ paused: true });
    tl.fromTo(clock, { t: 0 }, { t: duration, duration, ease: 'none', immediateRender: false }, 0);
    window.__timelines = window.__timelines || {};
    window.__timelines[compId] = tl;
    render(0);
    tl.seek(0);
    // Debug helper: ?t=1.5 in a normal browser shows that frame.
    const m = /[?&]t=([\d.]+)/.exec(location.search);
    if (m) tl.seek(parseFloat(m[1]));
    return tl;
  };

  // Bruno controller: inline transforms on the SVG groups (CSS transitions are disabled).
  K.Bruno = function (rootEl) {
    const svg = rootEl.querySelector('svg.bruno');
    svg.classList.remove('alive');
    const q = c => svg.querySelector('.b-' + c);
    const p = {
      armL: q('arm-l'), armR: q('arm-r'), head: q('head'), body: q('body'),
      eyeL: q('eye-l'), eyeR: q('eye-r'), lidL: q('eyelid-l'), lidR: q('eyelid-r'),
      earL: q('ear-l'), earR: q('ear-r'), shadow: q('shadow'), aura: q('aura'),
      sparkles: q('sparkles'), heart: q('heart'), blush: q('blush'),
    };
    const sparkleKids = p.sparkles ? Array.from(p.sparkles.children) : [];
    sparkleKids.forEach(el => { el.style.transformBox = 'fill-box'; el.style.transformOrigin = 'center'; });
    if (p.shadow) { p.shadow.style.transformBox = 'fill-box'; p.shadow.style.transformOrigin = 'center'; }
    let mood = null;
    return {
      svg, parts: p, sparkleKids,
      set(o) {
        if (o.mood && o.mood !== mood) { svg.setAttribute('data-mood', o.mood); mood = o.mood; }
        p.armL.style.transform = `rotate(${o.armL || 0}deg)`;
        p.armR.style.transform = `rotate(${o.armR || 0}deg)`;
        const br = o.breath || 0;
        p.body.style.transform = `scale(${1 + 0.025 * br},${1 - 0.015 * br})`;
        p.head.style.transform = `translate(${o.headX || 0}px,${(o.headY || 0) + 2.5 * br}px) rotate(${o.headRot || 0}deg)`;
        const lid = o.lid || 0;
        p.lidL.style.transform = p.lidR.style.transform = `scaleY(${lid})`;
        const ex = o.eyeX || 0, ey = o.eyeY || 0;
        p.eyeL.style.transform = p.eyeR.style.transform = `translate(${ex}px,${ey}px)`;
        p.earL.style.transform = `rotate(${o.earL || 0}deg)`;
        p.earR.style.transform = `rotate(${o.earR || 0}deg)`;
        if (p.shadow) {
          const s = o.shadow == null ? 1 : o.shadow;
          p.shadow.style.transform = `scale(${s})`;
          p.shadow.style.opacity = String(K.clamp(0.35 + 0.65 * s));
        }
      },
    };
  };
  // Ear wiggle (0 -> -12 -> 8 -> 0deg, 450ms) starting at t0
  K.earWiggle = function (t, t0) {
    const p = K.prog(t, t0, 0.45);
    if (p <= 0 || p >= 1) return 0;
    const keys = [0, -12, 8, 0];
    const seg = Math.min(2, Math.floor(p * 3)), lp = K.E.sine(p * 3 - seg);
    return K.lerp(keys[seg], keys[seg + 1], lp);
  };

  window.K = K;
})();
