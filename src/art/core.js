// DRIFT art core: tiny pixel buffer + drawing helpers. Everything is integer-pixel, no anti-aliasing.
// Colors are stored as Uint32 (little-endian ABGR) inside a Pix buffer; converted to Canvas at the end.

// ---------- color utils ----------
const cache32 = new Map();
export function c32(hex, a = 255) {
  if (hex == null) return 0;
  if (typeof hex === 'number') return hex;
  const k = hex + a;
  let v = cache32.get(k);
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16);
    v = ((a << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0;
    cache32.set(k, v);
  }
  return v;
}
export function rgbOf(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, v >>> 24]; }
export function hexOf(v) { const [r, g, b] = rgbOf(v); return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1); }
export function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
export function hsl2hex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return '#' + ((1 << 24) | (f(0) << 16) | (f(8) << 8) | f(4)).toString(16).slice(1);
}
// darken/lighten with hue shift (shadows drift to blue/purple, lights to yellow)
export function shade(hex, dl, hueShift = 0, ds = 0) {
  const v = c32(hex); const [r, g, b] = rgbOf(v);
  const [h, s, l] = rgb2hsl(r, g, b);
  return hsl2hex(h + hueShift, s + ds, l + dl);
}
// ---------- RNG ----------
export function rng(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.int = (n) => Math.floor(f() * n);
  f.range = (a0, b0) => a0 + Math.floor(f() * (b0 - a0 + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  return f;
}
export function hash2(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x, y) => BAYER4[(y & 3) * 4 + (x & 3)];

// ---------- pixel buffer ----------
export class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.d[y * this.w + x] : 0; }
  set(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.d[y * this.w + x] = typeof c === 'number' ? c : c32(c);
    return this;
  }
  put(x, y, c) { if (this.in(x, y)) this.d[y * this.w + x] = typeof c === 'number' ? c : c32(c); return this; }
  clear(x, y) { if (this.in(x, y)) this.d[y * this.w + x] = 0; }
  op(x, y) { return (this.get(x, y) >>> 24) > 0; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
  fill(c) { this.d.fill(c32(c)); return this; }
  hline(x0, x1, y, c) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c); return this; }
  vline(x, y0, y1, c) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c); return this; }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
    return this;
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, typeof c === 'function' ? c(x, y, nx, ny) : c);
      }
    return this;
  }
  // 3D-shaded ellipsoid, ramp = dark→light. light from top-left.
  ball(cx, cy, rx, ry, ramp, o = {}) {
    const lx = -0.55, ly = -0.65, lz = 0.52, dith = o.dither ?? 0.06, bias = o.bias ?? 0;
    return this.ellipse(cx, cy, rx, ry, (x, y, nx, ny) => {
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let L = nx * lx + ny * ly + nz * lz;
      L = Math.max(0, Math.min(0.999, L * 0.62 + 0.42 + bias + (bayer(x, y) - 0.5) * dith));
      return ramp[Math.floor(L * ramp.length)];
    });
  }
  blit(src, x, y, o = {}) {
    for (let j = 0; j < src.h; j++)
      for (let i = 0; i < src.w; i++) {
        const v = src.d[j * src.w + (o.flip ? src.w - 1 - i : i)];
        if (!v) continue;
        if (o.under && this.op(x + i, y + j)) continue;
        this.set(x + i, y + j, o.map ? o.map(v) : v);
      }
    return this;
  }
  clone() { const p = new Pix(this.w, this.h); p.d.set(this.d); return p; }
  flipX() { const p = new Pix(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[y * this.w + x] = this.d[y * this.w + this.w - 1 - x]; return p; }
  flipY() { const p = new Pix(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[y * this.w + x] = this.d[(this.h - 1 - y) * this.w + x]; return p; }
  rot90() { const p = new Pix(this.h, this.w); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[x * p.w + (this.h - 1 - y)] = this.d[y * this.w + x]; return p; }
  // nearest-neighbour scale into a new buffer of same size (centred on anchor)
  scaled(f, ax = this.w >> 1, ay = this.h - 1) {
    const p = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const sx = Math.floor((x - ax) / f + ax), sy = Math.floor((y - ay) / f + ay);
      const v = this.get(sx, sy); if (v) p.d[y * this.w + x] = v;
    }
    return p;
  }
  shifted(dx, dy) { const p = new Pix(this.w, this.h); p.blit(this, dx, dy); return p; }
  recolor(map) { // map: {fromHex: toHex}
    const m = new Map(Object.entries(map).map(([a, b]) => [c32(a), c32(b)]));
    const p = this.clone(); for (let i = 0; i < p.d.length; i++) { const r = m.get(p.d[i]); if (r !== undefined) p.d[i] = r; }
    return p;
  }
  // add 1px outline around opaque pixels. color: hex | (neighbourColor)=>uint | undefined (auto ink)
  outline(color, o = {}) {
    const w = this.w, h = this.h, src = this.d, out = new Uint32Array(src);
    const fixed = typeof color === 'string' ? c32(color) : null;
    const N = o.diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y * w + x] >>> 24) continue;
      let nb = 0;
      for (const [dx, dy] of N) { const v = this.get(x + dx, y + dy); if ((v >>> 24) > 200) { nb = v; break; } }
      if (nb) out[y * w + x] = fixed ?? (typeof color === 'function' ? color(nb) : c32('#181020'));
    }
    this.d = out; return this;
  }
  // canvas conversion; anchors ax/ay (feet)
  canvas(ax, ay) {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    const g = c.getContext('2d');
    const id = g.createImageData(this.w, this.h);
    new Uint32Array(id.data.buffer).set(this.d);
    g.putImageData(id, 0, 0);
    if (ax !== undefined) c.ax = ax;
    if (ay !== undefined) c.ay = ay;
    return c;
  }
}
// ---------- ASCII pixel matrices ----------
// rows: template string, legend: { char: hex }. '.' and ' ' are transparent.
export function mat(str, legend, w, h) {
  const rows = str.split('\n').map((r) => r.replace(/\s+$/, '')).filter((r) => r.trim().length);
  const indent = Math.min(...rows.map((r) => r.match(/^ */)[0].length));
  const rr = rows.map((r) => r.slice(indent));
  const W = w ?? Math.max(...rr.map((r) => r.length)), H = h ?? rr.length;
  const p = new Pix(W, H);
  rr.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x]; if (ch === '.' || ch === ' ') continue; const col = legend[ch]; if (col === undefined) throw new Error(`mat: unknown char '${ch}'`); if (col) p.put(x, y, c32(col)); } });
  return p;
}

export function frames(list, opts = {}) { const a = list; Object.assign(a, opts); return a; }
export function pixToCanvas(p, ax, ay) { return p.canvas(ax, ay); }

// palette swap on a finished canvas (keeps anchors)
export function recolorCanvas(c, map) {
  const g = c.getContext('2d');
  const id = g.getImageData(0, 0, c.width, c.height);
  const d = new Uint32Array(id.data.buffer);
  const m = new Map(Object.entries(map).map(([a, b]) => [c32(a), c32(b)]));
  for (let i = 0; i < d.length; i++) { const r = m.get(d[i]); if (r !== undefined) d[i] = r; }
  const o = document.createElement('canvas'); o.width = c.width; o.height = c.height;
  o.getContext('2d').putImageData(id, 0, 0);
  if (c.ax !== undefined) o.ax = c.ax;
  if (c.ay !== undefined) o.ay = c.ay;
  return o;
}
// hit-flash palette: every ramp one step lighter
export const HURT_MAP = {
  '#702030': '#c84040', '#c84040': '#f08060', '#f08060': '#f8f8f8',
  '#283070': '#4868c8', '#4868c8': '#90b0f0', '#90b0f0': '#f8f8f8',
  '#502878': '#8848b8', '#8848b8': '#c890e0', '#c890e0': '#f8f8f8',
  '#485070': '#8898b8', '#8898b8': '#c8d8e8', '#c8d8e8': '#f8f8f8',
  '#181020': '#502878',
};
