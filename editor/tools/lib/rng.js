// Seeded randomness + value noise for generators and scatter tools (deterministic: same seed → same world).
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
// mulberry32
export function rng(seed = 1) {
  let a = (typeof seed === 'number' ? seed : hashStr(seed)) >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  r.weighted = (items, w = (x) => x.weight ?? 1) => {
    const tot = items.reduce((s, it) => s + Math.max(0, w(it)), 0);
    let k = r() * tot;
    for (const it of items) { k -= Math.max(0, w(it)); if (k <= 0) return it; }
    return items[items.length - 1];
  };
  r.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  return r;
}

// 2D value noise with smooth interpolation + fractal sum. Returns a function (x, y) → [0, 1].
export function noise2(seed = 1) {
  const base = hashStr('n' + seed);
  const h = (x, y) => {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + base) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const sm = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, oct = 4) => {
    let s = 0, amp = 1, f = 1, tot = 0;
    for (let o = 0; o < oct; o++) { s += v(x * f + o * 17.3, y * f - o * 9.1) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return s / tot;
  };
}

// Poisson-disc-like sampling inside a predicate (Bridson, simplified). Points in tile units.
export function poisson(r, w, h, minDist, ok = () => true, tries = 24) {
  const cell = minDist / Math.SQRT2, gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const grid = new Array(gw * gh).fill(-1), pts = [], active = [];
  const add = (p) => { pts.push(p); active.push(p); grid[Math.floor(p[1] / cell) * gw + Math.floor(p[0] / cell)] = pts.length - 1; };
  const far = (x, y) => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    for (let j = Math.max(0, gy - 2); j <= Math.min(gh - 1, gy + 2); j++)
      for (let i = Math.max(0, gx - 2); i <= Math.min(gw - 1, gx + 2); i++) {
        const k = grid[j * gw + i]; if (k < 0) continue;
        const q = pts[k]; if ((q[0] - x) ** 2 + (q[1] - y) ** 2 < minDist * minDist) return false;
      }
    return true;
  };
  for (let s = 0; s < 40 && !pts.length; s++) { const x = r() * w, y = r() * h; if (ok(x, y)) add([x, y]); }
  while (active.length) {
    const i = Math.floor(r() * active.length), p = active[i];
    let found = false;
    for (let t = 0; t < tries; t++) {
      const a = r() * Math.PI * 2, d = minDist * (1 + r());
      const x = p[0] + Math.cos(a) * d, y = p[1] + Math.sin(a) * d;
      if (x < 0 || y < 0 || x >= w || y >= h || !far(x, y) || !ok(x, y)) continue;
      add([x, y]); found = true; break;
    }
    if (!found) active.splice(i, 1);
  }
  return pts;
}
