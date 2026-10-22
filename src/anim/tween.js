// Easing + tween manager. Times in seconds.
const PI = Math.PI;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export const ease = {
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => t * (2 - t),
  quadInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  cubicIn: (t) => t * t * t,
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sineIn: (t) => 1 - Math.cos((t * PI) / 2),
  sineOut: (t) => Math.sin((t * PI) / 2),
  sineInOut: (t) => -(Math.cos(PI * t) - 1) / 2,
  expoOut: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  backIn: (t) => { const c = 1.70158; return (c + 1) * t * t * t - c * t * t; },
  backOut: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  elasticOut: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * PI) / 3)) + 1),
  bounceOut: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  // 0 → 1 → 0 parabola (jumps / hops)
  arc: (t) => 4 * t * (1 - t),
};

const getEase = (e) => (typeof e === 'function' ? e : ease[e] || ease.linear);

// Tween manager. tw.to(obj, {x: 10, hop: 0}, 0.3, {ease:'cubicOut', delay, onUpdate, onDone, from:{...}})
export function createTweens() {
  let list = [];
  const api = {
    to(target, props, dur = 0.25, o = {}) {
      const tw = {
        target, dur: Math.max(1e-4, dur), t: -(o.delay || 0), ease: getEase(o.ease),
        from: null, to: props, fromOpt: o.from, onUpdate: o.onUpdate, onDone: o.onDone,
        yoyo: !!o.yoyo, repeat: o.repeat || 0, dead: false,
        cancel() { tw.dead = true; },
        get done() { return tw.dead; },
      };
      list.push(tw);
      return tw;
    },
    // plain timer: calls fn after sec
    after(sec, fn) { return api.to({}, {}, sec, { onDone: fn }); },
    // numeric tween without target: tw.value(0, 1, 0.3, 'backOut', v => ...)
    value(a, b, dur, e, onUpdate, onDone) {
      const o = { v: a };
      return api.to(o, { v: b }, dur, { ease: e, onUpdate: () => onUpdate?.(o.v), onDone });
    },
    kill(target) { for (const tw of list) if (tw.target === target) tw.dead = true; },
    clear() { list = []; },
    get count() { return list.length; },
    update(dt) {
      if (!list.length) return;
      for (const tw of list) {
        if (tw.dead) continue;
        tw.t += dt;
        if (tw.t < 0) continue;
        if (!tw.from) {
          tw.from = {};
          for (const k in tw.to) tw.from[k] = tw.fromOpt?.[k] ?? tw.target[k] ?? 0;
        }
        const p = clamp(tw.t / tw.dur);
        const e = tw.ease(p);
        for (const k in tw.to) tw.target[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
        try { tw.onUpdate?.(tw.target, p); } catch (err) { console.error(err); }
        if (p >= 1) {
          if (tw.repeat !== 0) {
            if (tw.repeat > 0) tw.repeat--;
            tw.t = 0;
            if (tw.yoyo) { const f = tw.from; tw.from = { ...tw.to }; tw.to = f; }
          } else {
            tw.dead = true;
            try { tw.onDone?.(tw.target); } catch (err) { console.error(err); }
          }
        }
      }
      list = list.filter((t) => !t.dead);
    },
  };
  return api;
}

// Shared manager, advanced by fx.update(dt).
export const tween = createTweens();
