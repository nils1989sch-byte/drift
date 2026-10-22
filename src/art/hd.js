// HD environment textures (Octopath/HD-2D direction): 48×48 tiles/edges, 48×36 face pieces, leaf cards, bark,
// house textures 64×64. No palette limit, no outlines, light comes from the engine – only micro-shading
// (blades, pebbles, stones). All textures tile seamlessly; variants share their border band (window blend),
// so different variants placed next to each other show no seams. Alpha stays binary (0/255).
import { Pix, rng, frames } from './core.js';

export const RES = 48;           // texels per tile
const FWH = [48, 36];            // face piece (16×12 world units at 3×)

// ---------------------------------------------------------------- colour + noise helpers
const rgb = (r, g, b) => ((255 << 24) | (Math.max(0, Math.min(255, b | 0)) << 16) | (Math.max(0, Math.min(255, g | 0)) << 8) | Math.max(0, Math.min(255, r | 0))) >>> 0;
const hx = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shadeC = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const toU = (c) => (typeof c === 'number' ? c : rgb(c[0], c[1], c[2]));
function ramp(hexes) { return hexes.map(hx); }
// quantised ramp lookup (crisp pixel tones, many of them)
function rampAt(R, t) { let u = R._u; if (!u) { u = R._u = Uint32Array.from(R.map((c) => rgb(c[0], c[1], c[2]))); } const i = t <= 0 ? 0 : t >= 1 ? u.length - 1 : (t * u.length) | 0; return u[i]; }

function hf(x, y, s) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, period, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
  const x1 = x0 + 1 === period ? 0 : x0 + 1, y1 = y0 + 1 === period ? 0 : y0 + 1;
  const a = hf(x0, y0, s), b = hf(x1, y0, s), c = hf(x0, y1, s), d = hf(x1, y1, s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// tileable fbm over a W×H texture, base = lattice cells across the width at octave 0
const FBM = new Map();
function fbmField(W, H, seed, base = 3, oct = 4, gain = 0.5) {
  const key = `${W},${H},${seed},${base},${oct},${gain}`;
  if (FBM.has(key)) return FBM.get(key);
  const f = new Float32Array(W * H);
  FBM.set(key, f);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0, amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
      const cx = base << o, cy = Math.max(1, Math.round((base << o) * H / W));
      v += vnoise((x / W) * cx, (y / H) * cy, cx, seed + o * 101) * amp; tot += amp; amp *= gain;
    }
    f[y * W + x] = v / tot;
  }
  return f;
}
// variant field: common field near the borders, own field inside → seamless between variants
function variantField(common, own, W, H) {
  const f = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const win = Math.pow(Math.sin((Math.PI * (x + 0.5)) / W) * Math.sin((Math.PI * (y + 0.5)) / H), 0.6);
    const i = y * W + x; f[i] = common[i] + (own[i] - common[i]) * win * 0.55;
  }
  // keep the variant's mean equal to the common field's → no brighter/darker tile squares
  let a = 0, b = 0; for (let i = 0; i < f.length; i++) { a += f[i]; b += common[i]; }
  const d = (b - a) / f.length; for (let i = 0; i < f.length; i++) f[i] += d;
  return f;
}
const wrap = (v, n) => ((v % n) + n) % n;

// ---------------------------------------------------------------- materials
const GRASS = ramp(['#1e3014', '#2a4018', '#38521c', '#466422', '#557628', '#66862c', '#7a9632', '#90a63c', '#a8b64c', '#c2c86a']);
const MOSS = ramp(['#142410', '#1b3014', '#233c18', '#2c4a1c', '#375a22', '#446a28', '#557a30', '#6a8c3a']);
const DIRT = ramp(['#3e2416', '#54301c', '#683c22', '#7a4a2a', '#8c5732', '#9c643a', '#ad7444', '#bf8652', '#cf9a64']);
const PATH = ramp(['#6e4a2c', '#85593a', '#9a6a44', '#ab7a4e', '#ba8a5a', '#c89a68', '#d4aa78', '#dfba8a']);
const SAND = ramp(['#a88a58', '#bda068', '#ccb078', '#d8be88', '#e2ca98', '#ecd8aa']);
const STONE = ramp(['#4a4844', '#5e5c56', '#706d66', '#827e76', '#948f86', '#a7a197', '#b9b3a8', '#cbc6bb']);
const WATER = ramp(['#0f2830', '#14323c', '#193c46', '#1e4650', '#245260', '#2c606c']);
const EARTH = ramp(['#2e1a10', '#3e2416', '#50301c', '#623c22', '#74482a', '#865632', '#98643a', '#a87444', '#b88552']);
const WOOD = ramp(['#2e1a10', '#462a18', '#5c3820', '#704628', '#865632', '#9c683c', '#b27c4a', '#c8925c']);
const SLATE = ramp(['#1c1e26', '#24262f', '#2c2f39', '#353844', '#3f4350', '#4a4e5c', '#565b6a']);

// grass blades: many short strokes, top pixel lighter, foot darker (micro shading)
function bladeLayer(p, field, R, seed, count, opts = {}) {
  const r = rng(seed), W = p.w, H = p.h;
  const hmin = opts.hmin ?? 2, hmax = opts.hmax ?? 4;
  for (let i = 0; i < count; i++) {
    const x = r.int(W), y = r.int(H);
    const t = field[y * W + x];
    const base = Math.max(0, Math.min(1, t + (r() - 0.5) * (opts.spread ?? 0.22) + (opts.bias || 0)));
    const h = r.range(hmin, hmax), lean = r() < 0.3 ? (r() < 0.5 ? -1 : 1) : 0;
    for (let k = 0; k < h; k++) {
      const tt = Math.min(0.999, base + (k / h) * 0.18 - 0.06);
      const xx = wrap(x + (k === h - 1 ? lean : 0), W), yy = wrap(y - k, H);
      p.put(xx, yy, toU(rampAt(R, tt)));
    }
  }
}
function fillField(p, field, R, jitter, seed) {
  const r = rng(seed);
  for (let i = 0; i < p.d.length; i++) p.d[i] = toU(rampAt(R, Math.max(0, Math.min(0.999, field[i] + (r() - 0.5) * jitter))));
}
function stretch(f, lo, hi) { const o = new Float32Array(f.length); for (let i = 0; i < f.length; i++) o[i] = Math.max(0, Math.min(1, (f[i] - lo) / (hi - lo))); return o; }

const COMMON = {};
const common = (key, seed, base = 3) => (COMMON[key] ||= fbmField(RES, RES, seed, base, 4));

function grassTex(seed, R = GRASS, opts = {}) {
  const W = RES, p = new Pix(W, W);
  const raw = variantField(common('grass' + (opts.key || ''), 7000, 4), fbmField(W, W, seed, 4, 4, 0.65), W, W);
  const f = new Float32Array(raw.length); for (let i = 0; i < raw.length; i++) f[i] = 0.5 + (raw[i] - 0.5) * 1.1;
  fillField(p, f, R.slice(opts.lo ?? 2, Math.ceil(R.length * (opts.hi ?? 0.8))), 0.25, seed);
  // dark gaps
  const r = rng(seed + 1);
  for (let i = 0; i < 30; i++) { const x = r.int(W), y = r.int(W); if (f[y * W + x] < 0.4) p.put(x, y, toU(R[1])); }
  bladeLayer(p, f, R, seed + 2, opts.blades ?? 1500, { hmin: 2, hmax: opts.hmax ?? 4 });
  // a few clover leaves / tiny flowers
  for (let i = 0; i < (opts.clover ?? 3); i++) {
    const x = r.range(2, W - 3), y = r.range(2, W - 3), c = toU(R[R.length - 3]), d = toU(R[2]);
    p.put(x, y, c); p.put(x + 1, y, c); p.put(x, y + 1, c); p.put(x - 1, y + 1, c); p.put(x + 1, y + 1, d);
  }
  for (let i = 0; i < (opts.flowers ?? 0); i++) {
    const x = r.range(2, W - 3), y = r.range(2, W - 3), col = r.pick(opts.flowerCols);
    p.put(x, y, toU(col)); p.put(x + 1, y, toU(col)); p.put(x, y - 1, toU(shadeC(col, 1.08))); p.put(x, y + 1, toU(shadeC(col, 0.7)));
    p.put(x + 1, y + 1, toU(R[1]));
  }
  return p;
}

function pebble(p, x, y, w, h, light, mid, dark) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1) && w > 2) continue;
    p.put(wrap(x + i, p.w), wrap(y + j, p.h), toU(j === 0 || i === 0 ? light : j === h - 1 || i === w - 1 ? dark : mid));
  }
  for (let i = 1; i < w; i++) p.put(wrap(x + i, p.w), wrap(y + h, p.h), toU(shadeC(dark, 0.75)));
}
function earthTex(seed, R, opts = {}) {
  const W = RES, p = new Pix(W, W), r = rng(seed);
  const f = stretch(variantField(common('earth' + opts.key, 7100 + (opts.key?.length || 0)), fbmField(W, W, seed, 4, 4), W, W), opts.lo ?? 0.1, opts.hi ?? 0.9);
  fillField(p, f, R, opts.jit ?? 0.3, seed);
  // grain: single pixels lighter/darker
  for (let i = 0; i < 300; i++) { const x = r.int(W), y = r.int(W), t = f[y * W + x]; p.put(x, y, toU(rampAt(R, Math.min(0.999, Math.max(0, t + (r() < 0.5 ? -0.18 : 0.18)))))); }
  // cracks
  for (let c = 0; c < (opts.cracks ?? 2); c++) {
    let x = r.int(W), y = r.int(W);
    for (let k = 0; k < r.range(6, 14); k++) { p.put(wrap(x, W), wrap(y, W), toU(shadeC(R[0], 0.9))); x += r.range(-1, 1); y += r() < 0.6 ? 1 : 0; if (r() < 0.5) x += r() < 0.5 ? 1 : -1; }
  }
  // pebbles 2–4 px, lit top, dark bottom
  const pc = opts.pebbleCols || [hx('#c8b8a0'), hx('#9a8c78'), hx('#5e5244')];
  for (let i = 0; i < (opts.pebbles ?? 8); i++) {
    const w = r.range(2, 4), h = r.range(2, 3);
    const tone = 0.85 + r() * 0.3;
    pebble(p, r.int(W), r.int(W), w, h, shadeC(pc[0], tone), shadeC(pc[1], tone), shadeC(pc[2], tone));
  }
  return p;
}
// torus voronoi cobbles with moss in joints
function cobbleTex(seed) {
  const W = RES, p = new Pix(W, W), r = rng(9090);
  const pts = [];
  for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 6; gx++) pts.push([(gx + 0.5 + (r() - 0.5) * 0.6 + (gy % 2) * 0.4) * W / 6, (gy + 0.5 + (r() - 0.5) * 0.5) * W / 6]);
  const rv = rng(seed);
  const tone = pts.map(() => 0.42 + rv() * 0.22);
  const moss = hx('#3d5a24'), mossL = hx('#56742e');
  const f = fbmField(W, W, seed + 3, 6, 3);
  const cell = (x, y) => {
    let b = 1e9, s = 1e9, id = 0;
    for (let i = 0; i < pts.length; i++) {
      const dx = Math.min(Math.abs(x - pts[i][0]), W - Math.abs(x - pts[i][0])), dy = Math.min(Math.abs(y - pts[i][1]), W - Math.abs(y - pts[i][1]));
      const d = Math.sqrt(dx * dx + dy * dy * 1.15);
      if (d < b) { s = b; b = d; id = i; } else if (d < s) s = d;
    }
    return [id, s - b, b];
  };
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const [id, edge, dist] = cell(x + 0.5, y + 0.5);
    const i = y * W + x;
    if (edge < 1.3) { p.d[i] = toU(f[i] > 0.66 ? (f[i] > 0.74 ? mossL : moss) : STONE[1]); continue; }
    // dome shading: lighter toward the up-left of the stone centre
    const [cx, cy] = pts[id];
    let dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx > W / 2) dx -= W; if (dx < -W / 2) dx += W; if (dy > W / 2) dy -= W; if (dy < -W / 2) dy += W;
    const lit = (-dx - dy) / (W / 6) * 0.17;
    let t = tone[id] + lit + (f[i] - 0.5) * 0.17 + (rv() - 0.5) * 0.06;
    if (edge < 2.3) t -= 0.09;
    p.d[i] = toU(rampAt(STONE, Math.max(0, Math.min(0.999, t))));
    void dist;
  }
  return p;
}
function waterFramesHD(nf = 4) {
  const W = RES, out = [];
  const f = fbmField(W, W, 8100, 3, 4);
  for (let k = 0; k < nf; k++) {
    const p = new Pix(W, W), r = rng(8200 + k);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const wave = Math.sin((x / W) * Math.PI * 2 * 2 + (y / W) * Math.PI * 2 * 3 + (k / nf) * Math.PI * 2 + f[i] * 4);
      p.d[i] = toU(rampAt(WATER, Math.max(0, Math.min(0.999, f[i] * 0.7 + wave * 0.12 + 0.15 + (r() - 0.5) * 0.08))));
    }
    // glint lines drifting
    const gl = rng(8300);
    for (let g = 0; g < 9; g++) {
      const gx = gl.int(W), gy = gl.int(W), len = gl.range(3, 8);
      const x0 = gx + Math.round(k * 1.5);
      const vis = (g + k) % 3 !== 0;
      if (!vis) continue;
      for (let j = 0; j < len; j++) p.put(wrap(x0 + j, W), gy, toU(j === 1 || j === len - 2 ? hx('#9ccac4') : hx('#5e9a9c')));
    }
    out.push(p);
  }
  return out;
}
function shallowFramesHD() {
  const W = RES, out = [];
  const sand = earthTex(8400, SAND, { key: 'sh', pebbles: 6, cracks: 0 });
  for (let k = 0; k < 3; k++) {
    const p = sand.clone(), r = rng(8500 + k);
    for (let i = 0; i < p.d.length; i++) { const v = p.d[i]; const R0 = v & 255, G0 = (v >> 8) & 255, B0 = (v >> 16) & 255; p.d[i] = rgb(R0 * 0.3 + 22, G0 * 0.38 + 52, B0 * 0.4 + 62); }
    for (let g = 0; g < 7; g++) {
      const gx = r.int(W), gy = r.int(W), len = r.range(3, 7);
      for (let j = 0; j < len; j++) p.put(wrap(gx + j + k * 2, W), gy, toU(hx(j % 3 ? '#cfe8e0' : '#a8d4cc')));
    }
    out.push(p);
  }
  return out;
}
function plankTex(seed, horizontal = true, plank = 12) {
  const W = RES, p = new Pix(W, W), r = rng(seed);
  const f = fbmField(W, W, seed, 2, 3);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const a = horizontal ? y : x, b = horizontal ? x : y;
    const k = Math.floor(a / plank), inP = a % plank;
    const grain = Math.sin(b * 0.35 + k * 7 + f[y * W + x] * 6) * 0.08;
    let t = 0.45 + (hf(k, 0, seed) - 0.5) * 0.3 + grain + (f[y * W + x] - 0.5) * 0.25;
    if (inP === 0) t = 0.02; else if (inP === 1) t += 0.18; else if (inP === plank - 1) t -= 0.2;
    p.d[y * W + x] = toU(rampAt(WOOD, Math.max(0, Math.min(0.999, t))));
  }
  for (let k = 0; k < W / plank; k++) for (const b of [4, W - 5]) {
    const a = k * plank + 3; const [x, y] = horizontal ? [b, a] : [a, b];
    p.put(x, y, toU(hx('#9aa0a8'))); p.put(x + 1, y + 1, toU(hx('#4a4c54')));
  }
  void r;
  return p;
}
function stairsTex() {
  const W = RES, p = new Pix(W, W), f = fbmField(W, W, 8600, 4, 3);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const s = y % 12, i = y * W + x;
    let t = s < 2 ? 0.85 : s < 7 ? 0.6 : s < 11 ? 0.38 : 0.08;
    t += (f[i] - 0.5) * 0.3;
    if (x < 4 || x > W - 5) t = 0.25 + (f[i] - 0.5) * 0.2;
    p.d[i] = toU(rampAt(STONE, Math.max(0, Math.min(0.999, t))));
  }
  return p;
}
function slabTexHD(seed, R, size = 24) {
  const W = RES, p = new Pix(W, W), f = fbmField(W, W, seed, 4, 4), r = rng(seed);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, sx = x % size, sy = y % size;
    let t = 0.45 + (f[i] - 0.5) * 0.5 + (hf(Math.floor(x / size), Math.floor(y / size), seed) - 0.5) * 0.25;
    if (sx === 0 || sy === 0) t = 0.02; else if (sx === 1 || sy === 1) t += 0.2; else if (sx === size - 1 || sy === size - 1) t -= 0.2;
    p.d[i] = toU(rampAt(R, Math.max(0, Math.min(0.999, t + (r() - 0.5) * 0.08))));
  }
  return p;
}
function pitTex() {
  const W = RES, p = new Pix(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const t = y < 6 ? 0.6 : y < 9 ? 0.3 : Math.max(0, 0.18 - (y - 9) * 0.02);
    p.d[y * W + x] = toU(y < 9 ? rampAt(SLATE, t) : [10 + t * 40, 10 + t * 40, 18 + t * 50]);
  }
  return p;
}

// ---------------------------------------------------------------- tiles
export function buildTilesHD() {
  const t = {};
  const cv = (p) => p.canvas();
  t.grass = frames([1, 2, 3, 4].map((s) => cv(grassTex(7010 + s))), { mode: 'variant' });
  t.grass_dark = frames([1, 2, 3].map((s) => cv(grassTex(7020 + s, MOSS, { key: 'moss', blades: 1300, clover: 1 }))), { mode: 'variant' });
  const flowerCols = [hx('#f4f0e4'), hx('#f8e078'), hx('#f0a8c0'), hx('#c8a0e8')];
  const fl = grassTex(7030, GRASS, { flowers: 9, flowerCols });
  const fl2 = fl.clone(); { const r = rng(7031); for (let i = 0; i < 9; i++) { const x = r.range(2, 45), y = r.range(2, 45); fl2.put(x, y, toU(r.pick(flowerCols))); } }
  t.grass_flowers = frames([cv(fl), cv(fl2)], { fps: 2, phase: true });
  const tall = (k) => { const p = grassTex(7040, GRASS, { blades: 2400, hmax: 7, clover: 0 }); bladeLayer(p, fbmField(RES, RES, 7041, 3, 3), GRASS, 7042 + k, 500, { hmin: 5, hmax: 9, bias: 0.15 }); return cv(p); };
  t.grass_tall = frames([tall(0), tall(1)], { fps: 2, phase: true });
  const GLIGHT = GRASS.map((c) => [c[0] * 1.08 + 10, c[1] * 1.05 + 6, c[2] * 0.95]);
  t.grass_light = frames([1, 2, 3].map((s) => cv(grassTex(7060 + s, GLIGHT, { key: 'light', blades: 900, clover: 2, lo: 4, hi: 0.95, hmax: 3 }))), { mode: 'variant' });
  t.clearing = frames([1, 2].map((s) => cv(earthTex(7130 + s, PATH.slice(2), { key: 'clear', pebbles: 4, cracks: 0, lo: 0.3, hi: 0.7, jit: 0.15 }))), { mode: 'variant' });
  t.dirt = frames([1, 2, 3].map((s) => cv(earthTex(7100 + s, DIRT, { key: 'dirt', pebbles: 9, cracks: 2 }))), { mode: 'variant' });
  t.path = frames([1, 2, 3].map((s) => cv(earthTex(7110 + s, PATH, { key: 'path', pebbles: 14, cracks: 1 }))), { mode: 'variant' });
  t.sand = frames([1, 2].map((s) => cv(earthTex(7120 + s, SAND, { key: 'sand', pebbles: 3, cracks: 0, pebbleCols: [hx('#f0e0c0'), hx('#c8b088'), hx('#8a7454')] }))), { mode: 'variant' });
  const wf = waterFramesHD();
  t.water = frames(wf.map(cv), { fps: 4, phase: true });
  t.water_edge_n = frames(wf.map((w, k) => {
    const p = w.clone();
    for (let x = 0; x < RES; x++) {
      for (let y = 0; y < 7; y++) p.put(x, y, toU(shadeC(WATER[0], 0.7 + y * 0.04)));
      const fo = (x + k * 3) % 11 < 7;
      p.put(x, 7, toU(hx(fo ? '#d8ece6' : '#6aa4a4'))); if (fo && (x + k) % 3 === 0) p.put(x, 8, toU(hx('#8cc0bc')));
    }
    return cv(p);
  }), { fps: 4 });
  t.shallow = frames(shallowFramesHD().map(cv), { fps: 3, phase: true });
  t.stairs = [cv(stairsTex())];
  t.bridge = [cv(plankTex(7200, true, 12))];
  t.stone_floor = frames([cv(cobbleTex(7300)), cv(cobbleTex(7301))], { mode: 'variant' });
  t.dungeon_floor = frames([cv(slabTexHD(7400, SLATE)), cv(slabTexHD(7401, SLATE))], { mode: 'variant' });
  t.dungeon_wall = [cv(slabTexHD(7410, SLATE.map((c) => shadeC(c, 1.3)), 12))];
  t.pit = [cv(pitTex())];
  t.wood_floor = [cv(plankTex(7500, false, 12))];
  t.void = [cv((() => { const p = new Pix(RES, RES); p.d.fill(rgb(20, 22, 34)); return p; })())];
  return t;
}

// ---------------------------------------------------------------- edges (48×48 overlays, binary alpha)
function profileHD(seed, base, amp) {
  // smooth wobble + jittered lobes, ends pinned to base
  const r = rng(seed), d = new Float32Array(RES);
  const f = []; for (let u = 0; u < RES; u++) f.push(vnoise(u / 8, 0.5, RES / 8, seed) * 0.6 + vnoise(u / 3, 2.5, RES / 3, seed + 1) * 0.4);
  for (let u = 0; u < RES; u++) {
    const pin = Math.min(1, Math.min(u, RES - 1 - u) / 6);
    d[u] = base + (f[u] - 0.5) * 2 * amp * pin + amp * 0.5 * pin;
  }
  void r;
  return d;
}
const UV = { n: (x, y) => [x, y], s: (x, y) => [x, RES - 1 - y], w: (x, y) => [y, x], e: (x, y) => [y, RES - 1 - x] };
function edgeHD(group, src, opts) {
  // src: Pix (48×48 texture of the group) – the overlay shows that texture inside an irregular mask
  const out = {};
  for (const side of ['n', 's', 'w', 'e']) {
    const prof = profileHD(opts.seed + side.charCodeAt(0) * 31, opts.base, opts.amp);
    const make = (beyond) => {
      const p = new Pix(RES, RES), r = rng(opts.seed + side.charCodeAt(0));
      for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
        const [u, t] = UV[side](x, y), d = prof[u];
        if (t < d) {
          let v = src.d[y * RES + x];
          if (t > d - 2 && opts.rim) v = toU(opts.rim);
          p.d[y * RES + x] = v;
        } else if (beyond) { const c = beyond(u, t - d, side, r); if (c) p.d[y * RES + x] = toU(c); }
      }
      // grass fringe: blades poking out past the edge
      if (opts.fringe) for (let k = 0; k < 70; k++) {
        const u = r.int(RES), d = prof[u], h = r.range(2, 5);
        for (let j = 0; j < h; j++) {
          const t = Math.floor(d) + j - 1; if (t < 0 || t >= RES) continue;
          const [x, y] = side === 'n' ? [u, t] : side === 's' ? [u, RES - 1 - t] : side === 'w' ? [t, u] : [RES - 1 - t, u];
          p.put(x, y, toU(rampAt(opts.fringe, Math.min(0.999, 0.35 + (j / h) * 0.5 + r() * 0.15))));
        }
      }
      return p.canvas();
    };
    out[`${group}_${side}`] = make(opts.beyond);
    for (const [target, fn] of Object.entries(opts.targets || {})) out[`${group}_${side}@${target}`] = make(fn);
  }
  return out;
}
export function buildEdgesHD(tilesPix) {
  // shoreline on water: shadow line under the bank (n/w), foam lap (s/e)
  const shoreW = (u, dt, side) => (dt < 3 ? (side === 'n' || side === 'w' ? shadeC(WATER[0], 0.75) : (dt < 2 && hf(u, 1, 3) < 0.7 ? hx('#cfe6e0') : null)) : null);
  const shoreS = (u, dt, side) => (dt < 2 ? (side === 'n' || side === 'w' ? hx('#3e7070') : hx('#d8ece6')) : null);
  const water = { water: shoreW, shallow: shoreS };
  const edges = Object.assign({},
    edgeHD('grass', tilesPix.grass, { seed: 100, base: 6, amp: 4, fringe: GRASS, targets: water }),
    edgeHD('grass_dark', tilesPix.grass_dark, { seed: 150, base: 7, amp: 5, fringe: MOSS, targets: water }),
    edgeHD('grass_light', tilesPix.grass_light, { seed: 170, base: 6, amp: 4, fringe: GRASS.slice(3), targets: water }),
    edgeHD('clearing', tilesPix.clearing, { seed: 180, base: 6, amp: 4 }),
    edgeHD('path', tilesPix.path, { seed: 200, base: 5, amp: 3, rim: null }),
    edgeHD('dirt', tilesPix.dirt, { seed: 300, base: 5, amp: 3, targets: water }),
    edgeHD('sand', tilesPix.sand, { seed: 400, base: 6, amp: 4, targets: water }),
    edgeHD('shallow', tilesPix.shallow, { seed: 500, base: 6, amp: 3 }),
    edgeHD('water', tilesPix.water, { seed: 600, base: 3, amp: 2 }),
    edgeHD('stone_floor', tilesPix.stone_floor, { seed: 700, base: 4, amp: 2 }),
  );
  return edges;
}

// ---------------------------------------------------------------- faces (48×36 pieces)
// earth wall: horizontal sediment layers (wavy, tile x-period 48, y-period 36 so mids tile), stones, roots,
// vertical cracks, hanging grass on top, darker foot at the bottom
const LAYERS = [ // [y-start within 36-period, tone 0..1]
  [0, 0.55], [5, 0.42], [9, 0.62], [15, 0.36], [19, 0.5], [26, 0.68], [30, 0.4],
];
function layerTone(y, wobble) {
  const yy = wrap(y + wobble, 36);
  let t = LAYERS[0][1];
  for (const [ys, tt] of LAYERS) if (yy >= ys) t = tt;
  return t;
}
function earthFace(seed, kind, R = EARTH) {
  const [W, H] = FWH, p = new Pix(W, H), r = rng(seed);
  const f = fbmField(W, H, 7600, 3, 4);              // shared → mids tile vertically/horizontally
  const g = fbmField(W, H, seed, 4, 3);              // per piece detail
  const WOB = []; for (let x = 0; x < W; x++) WOB.push(Math.round((vnoise(x / 12, 0.3, W / 12, 7700) - 0.5) * 5));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const wob = WOB[x];
    let t = layerTone(y, wob) + (f[i] - 0.5) * 0.3 + (g[i] - 0.5) * 0.15 + (r() - 0.5) * 0.14;
    if (kind === 'bot') t -= 0.12 + (y / H) * 0.3;
    if (kind === 'top') t += 0.05;
    p.d[i] = toU(rampAt(R, Math.max(0, Math.min(0.999, t))));
  }
  // vertical cracks / striations
  for (let c = 0; c < 6; c++) {
    let x = r.int(W); const y0 = r.int(H), len = r.range(5, 16);
    for (let k = 0; k < len; k++) { const y = y0 + k; if (y >= H) break; p.put(x, y, toU(shadeC(R[0], 0.85))); p.put(x + 1, y, toU(R[Math.min(R.length - 1, 6)])); if (r() < 0.2) x += r() < 0.5 ? -1 : 1; }
  }
  // embedded stones
  for (let s = 0; s < (kind === 'bot' ? 5 : 3); s++) {
    const w = r.range(3, 7), h = r.range(2, 4), x = r.int(W - w), y = r.range(kind === 'top' ? 10 : 1, H - h - 2);
    const tone = 0.8 + r() * 0.35;
    pebble(p, x, y, w, h, shadeC(hx('#b8ae9c'), tone), shadeC(hx('#8a8070'), tone), shadeC(hx('#55493c'), tone));
  }
  // roots
  if (kind !== 'bot') for (let k = 0; k < (kind === 'top' ? 3 : 1); k++) {
    let x = r.int(W); const y0 = kind === 'top' ? 6 : r.int(10), len = r.range(8, 20);
    for (let j = 0; j < len && y0 + j < H; j++) { p.put(x, y0 + j, toU(hx('#3a2216'))); if (r() < 0.3) p.put(x + 1, y0 + j, toU(hx('#5a3a24'))); if (r() < 0.35) x += r() < 0.5 ? -1 : 1; }
  }
  // moss tufts
  for (let m = 0; m < (kind === 'bot' ? 1 : 3); m++) {
    const x = r.int(W - 6), y = r.range(kind === 'top' ? 12 : 2, H - 4), w = r.range(4, 9);
    for (let k = 0; k < w; k++) { p.put(x + k, y, toU(rampAt(MOSS, 0.55 + r() * 0.4))); if (r() < 0.6) p.put(x + k, y + 1, toU(rampAt(MOSS, 0.3 + r() * 0.3))); if (r() < 0.4) p.put(x + k, y - 1, toU(rampAt(GRASS, 0.6 + r() * 0.3))); }
  }
  if (kind === 'top') {
    // grass overhang + hanging blades (6–12 px)
    for (let x = 0; x < W; x++) {
      const d = 3 + Math.round(vnoise(x / 5, 1.5, W / 5, seed) * 4);
      for (let y = 0; y < d; y++) p.put(x, y, toU(rampAt(GRASS, Math.min(0.999, 0.45 + (1 - y / d) * 0.3 + (r() - 0.5) * 0.25))));
      p.put(x, d, toU(shadeC(R[0], 0.8))); p.put(x, d + 1, toU(R[1]));
      if (r() < 0.35) { const h = r.range(3, 10); for (let j = 0; j < h; j++) p.put(x, d + j, toU(rampAt(GRASS, Math.max(0, 0.6 - j * 0.05 + (r() - 0.5) * 0.2)))); }
    }
  }
  if (kind === 'bot') {
    for (let x = 0; x < W; x++) { const d = 3 + Math.round(hf(x, 0, seed) * 2); for (let y = H - d; y < H; y++) p.put(x, y, toU(shadeC(R[0], 0.7))); }
  }
  return p;
}
function brickFaceHD(seed, kind) {
  const [W, H] = FWH, p = new Pix(W, H), f = fbmField(W, H, seed, 4, 3), r = rng(seed);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const row = Math.floor(y / 9), off = row % 2 ? 12 : 0, bx = wrap(x + off, 24), by = y % 9;
    let t = 0.5 + (hf(Math.floor((x + off) / 24), row, seed) - 0.5) * 0.3 + (f[y * W + x] - 0.5) * 0.3 + (r() - 0.5) * 0.08;
    if (by === 8 || bx === 0) t = 0.05; else if (by === 0 || bx === 1) t += 0.18; else if (by === 7 || bx === 23) t -= 0.15;
    if (kind === 'bot') t -= y > H - 5 ? 0.4 : 0.08;
    if (kind === 'top' && y < 4) t = y === 0 ? 0.95 : 0.75;
    p.d[y * W + x] = toU(rampAt(STONE, Math.max(0, Math.min(0.999, t))));
  }
  return p;
}
function stairsFaceHD(kind) {
  const [W, H] = FWH, p = new Pix(W, H), f = fbmField(W, H, 7800, 4, 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = y % 12; let t = s < 2 ? 0.85 : s < 7 ? 0.6 : s < 11 ? 0.38 : 0.08;
    t += (f[y * W + x] - 0.5) * 0.3; if (x < 4 || x > W - 5) t = 0.25;
    if (kind === 'bot' && y > H - 3) t = 0.05;
    p.d[y * W + x] = toU(rampAt(STONE, Math.max(0, Math.min(0.999, t))));
  }
  return p;
}
// end pieces: irregular rounded outer edge (transparent bite) – lit on the left, darker on the right
function endHD(src, side, kind, seed) {
  const [W, H] = FWH, p = src.clone();
  for (let y = 0; y < H; y++) {
    const bite = Math.round(1 + vnoise(y / 6, 0.5, 6, seed) * 3) + (kind === 'top' && y < 6 ? 6 - y : 0) + (kind === 'bot' && y > H - 6 ? (y - (H - 6)) : 0);
    for (let k = 0; k < bite; k++) p.clear(side === 'l' ? k : W - 1 - k, y);
    const ex = side === 'l' ? bite : W - 1 - bite;
    const v = p.get(ex, y); if (!v) continue;
    const c = [v & 255, (v >> 8) & 255, (v >> 16) & 255];
    p.put(ex, y, toU(shadeC(c, side === 'l' ? 1.18 : 0.62)));
    const ex2 = side === 'l' ? ex + 1 : ex - 1; const v2 = p.get(ex2, y);
    if (v2 && side === 'r') p.put(ex2, y, toU(shadeC([v2 & 255, (v2 >> 8) & 255, (v2 >> 16) & 255], 0.8)));
  }
  return p;
}
function faceSetHD(name, mk, nMids = 4) {
  const top = mk('top', 1), bot = mk('bot', 2), mids = Array.from({ length: nMids }, (_, i) => mk('mid', 10 + i));
  const pack = (t, ms, b) => { const a = [t.canvas(), ms[0].canvas(), b.canvas()]; a.mids = ms.map((m) => m.canvas()); return a; };
  const out = { [name]: pack(top, mids, bot) };
  for (const side of ['l', 'r']) out[`${name}_${side}`] = pack(endHD(top, side, 'top', 31), mids.map((m, i) => endHD(m, side, 'mid', 40 + i)), endHD(bot, side, 'bot', 33));
  return out;
}
function plinthHD(kind) {
  const W = 192, H = 120, p = new Pix(W, H), r = rng(9900);
  const f = fbmField(W, H, 9901, 6, 4);
  const PW = []; for (let x = 0; x < W; x++) PW.push(Math.round((vnoise(x / 20, 0.3, W / 20, 9902) - 0.5) * 8));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (kind === 'stone') {
      const row = Math.floor(y / 15), off = row % 2 ? 24 : 0, bx = wrap(x + off, 48), by = y % 15;
      let t = 0.35 + (hf(Math.floor((x + off) / 48), row, 3) - 0.5) * 0.25 + (f[i] - 0.5) * 0.3 - y / H * 0.25;
      if (by === 14 || bx === 0) t = 0.03; else if (by === 0) t += 0.15;
      p.d[i] = toU(rampAt(SLATE.map((c) => shadeC(c, 1.4)), Math.max(0, Math.min(0.999, t))));
      continue;
    }
    const wob = PW[x];
    let t = layerTone(Math.floor(y / 1.6), wob) * 0.8 + (f[i] - 0.5) * 0.3 + (r() - 0.5) * 0.12 - (y / H) * 0.35;
    p.d[i] = toU(rampAt(EARTH, Math.max(0, Math.min(0.999, t))));
  }
  if (kind !== 'stone') {
    for (let s = 0; s < 22; s++) { const w = r.range(3, 9), h = r.range(2, 5); const tone = 0.6 + r() * 0.4; pebble(p, r.int(W), r.range(10, H - 10), w, h, shadeC(hx('#a89e8c'), tone), shadeC(hx('#7a7060'), tone), shadeC(hx('#45392e'), tone)); }
    for (let k = 0; k < 7; k++) { let x = r.int(W); for (let y = 4; y < r.range(14, 40); y++) { p.put(wrap(x, W), y, toU(hx('#3a2216'))); if (r() < 0.35) x += r() < 0.5 ? -1 : 1; } }
    for (let x = 0; x < W; x++) { const d = 4 + Math.round(vnoise(x / 6, 0.5, W / 6, 9903) * 4); for (let y = 0; y < d; y++) p.put(x, y, toU(rampAt(GRASS, 0.5 + (1 - y / d) * 0.35 + (r() - 0.5) * 0.2))); if (r() < 0.3) for (let j = 0; j < r.range(2, 7); j++) p.put(x, d + j, toU(rampAt(GRASS, 0.45 - j * 0.04))); }
  }
  return p.canvas();
}
export function buildFacesHD() {
  const faces = Object.assign({},
    faceSetHD('rock', (k, s) => earthFace(7600 + s * 13, k)),
    faceSetHD('dirt', (k, s) => earthFace(7650 + s * 13, k, DIRT)),
    faceSetHD('brick', (k, s) => brickFaceHD(7700 + s * 7, k), 3),
  );
  faces.stairs = [stairsFaceHD('top').canvas(), stairsFaceHD('mid').canvas(), stairsFaceHD('bot').canvas()];
  faces.plinth_earth = [plinthHD('earth')];
  faces.plinth_stone = [plinthHD('stone')];
  return faces;
}

// ---------------------------------------------------------------- leaf cards, bark, needles (alpha 0/255)
const LEAF = ramp(['#1a2c12', '#243c16', '#2f4e1a', '#3c621e', '#4c7624', '#5e8a2a', '#76a032', '#92b63e', '#b0c852', '#ccdc70']);
const LEAF_AUT = ramp(['#4a2a0c', '#6a3e10', '#8a5414', '#a86c18', '#c4881e', '#d8a224', '#e8bc30', '#f4d040', '#f8e070', '#fcf0a0']);
function leafCard(seed, R, size = 32, n = 150) {
  const p = new Pix(size, size), r = rng(seed), c = size / 2;
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (size * 0.44);
    const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d * 0.9;
    // light from top-left + depth toward the centre/back
    const L = 0.55 - ((x - c) + (y - c)) / size * 0.9 + (d / size) * 0.4 + (r() - 0.5) * 0.3;
    leaves.push([x, y, L, r()]);
  }
  leaves.sort((a, b) => a[2] - b[2]); // dark (back) first
  for (const [x, y, L, k] of leaves) {
    const col = rampAt(R, Math.max(0, Math.min(0.999, L)));
    const dk = rampAt(R, Math.max(0, Math.min(0.999, L - 0.25)));
    const ang = k * Math.PI;
    // small leaf: 4–6 px oval along its angle, dark lower edge
    for (let t = -2; t <= 2; t++) {
      const px = Math.round(x + Math.cos(ang) * t), py = Math.round(y + Math.sin(ang) * t * 0.6);
      if (px < 0 || py < 0 || px >= size || py >= size) continue;
      p.put(px, py, toU(col));
      if (Math.abs(t) < 2 && py + 1 < size) p.put(px, py + 1, toU(dk));
    }
  }
  return p.canvas(size >> 1, size - 1);
}
function barkTex() {
  const W = 32, p = new Pix(W, W), f = fbmField(W, W, 9500, 2, 4), r = rng(9501);
  const BARK = ramp(['#1e120c', '#2c1c12', '#3a2618', '#4a321e', '#5a3e26', '#6c4c30', '#7e5c3a']);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const ridge = Math.sin((x / W) * Math.PI * 2 * 5 + vnoise(x / 4, y / 8, 8, 9502) * 4) * 0.5 + 0.5;
    p.d[i] = toU(rampAt(BARK, Math.max(0, Math.min(0.999, ridge * 0.55 + f[i] * 0.4 + (r() - 0.5) * 0.12))));
  }
  return p.canvas(16, 31);
}
function needles(seed) {
  const W = 32, p = new Pix(W, W), r = rng(seed);
  const N = ramp(['#0f2016', '#14281a', '#1a3420', '#224026', '#2c4e2c', '#386034', '#4a7440', '#5e8a4c']);
  for (let b = 0; b < 26; b++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.6, len = r.range(6, 14), x0 = 16 + (r() - 0.5) * 10, y0 = 18 + (r() - 0.5) * 10;
    for (let k = 0; k < len; k++) {
      const x = Math.round(x0 + Math.cos(a) * k), y = Math.round(y0 + Math.sin(a) * k * 0.7 + k * 0.25);
      if (x < 0 || y < 0 || x >= W || y >= W) break;
      const L = 0.45 - ((x - 16) + (y - 16)) / 40 + (r() - 0.5) * 0.25;
      p.put(x, y, toU(rampAt(N, Math.max(0, Math.min(0.999, L)))));
      if (k % 2 === 0) { p.put(x - 1, y + 1, toU(rampAt(N, Math.max(0, Math.min(0.999, L - 0.2))))); p.put(x + 1, y + 1, toU(rampAt(N, Math.max(0, Math.min(0.999, L + 0.1))))); }
    }
  }
  return p.canvas(16, 31);
}

// ---------------------------------------------------------------- house textures 64×64
function plaster64() {
  const W = 64, p = new Pix(W, W), f = fbmField(W, W, 9600, 4, 4), r = rng(9601);
  const PL = ramp(['#b8a888', '#c8b898', '#d6c8a8', '#e2d6b8', '#ece2c8', '#f4ecd6']);
  for (let i = 0; i < p.d.length; i++) p.d[i] = toU(rampAt(PL, Math.max(0, Math.min(0.999, f[i] * 0.8 + 0.15 + (r() - 0.5) * 0.15))));
  const beam = (x0, y0, x1, y1, w) => {
    const len = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= len; k++) for (let j = 0; j < w; j++) {
      const t = k / len, x = Math.round(x0 + (x1 - x0) * t + (Math.abs(y1 - y0) > Math.abs(x1 - x0) ? j : 0)), y = Math.round(y0 + (y1 - y0) * t + (Math.abs(y1 - y0) > Math.abs(x1 - x0) ? 0 : j));
      const tone = j === 0 ? 0.62 : j === w - 1 ? 0.12 : 0.3 + hf(x, y, 9) * 0.12;
      p.put(wrap(x, W), wrap(y, W), toU(rampAt(WOOD, tone)));
    }
  };
  beam(0, 0, 0, 63, 6); beam(0, 0, 63, 0, 6); beam(0, 32, 63, 32, 5);
  beam(6, 31, 30, 6, 4); beam(33, 6, 57, 31, 4);
  beam(32, 37, 32, 63, 5);
  return p.canvas(0, 63);
}
function stone64() {
  const W = 64, p = new Pix(W, W), f = fbmField(W, W, 9700, 6, 3), r = rng(9701);
  const pts = []; for (let i = 0; i < 26; i++) pts.push([r() * W, r() * W, 0.3 + r() * 0.55]);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    let b = 1e9, s = 1e9, id = 0;
    for (let k = 0; k < pts.length; k++) { const dx = Math.min(Math.abs(x - pts[k][0]), W - Math.abs(x - pts[k][0])), dy = Math.min(Math.abs(y - pts[k][1]), W - Math.abs(y - pts[k][1])) * 1.4; const d = Math.sqrt(dx * dx + dy * dy); if (d < b) { s = b; b = d; id = k; } else if (d < s) s = d; }
    const e = s - b, i = y * W + x;
    let t = pts[id][2] + (f[i] - 0.5) * 0.35 + (r() - 0.5) * 0.1;
    if (e < 2) t = 0.04 + f[i] * 0.1; else if (e < 3.2) t -= 0.2;
    p.d[i] = toU(rampAt(STONE, Math.max(0, Math.min(0.999, t))));
  }
  return p.canvas(0, 63);
}
function roof64() {
  // gold-ochre roof tiles as relief: each row = rounded tiles, top edge light, bottom edge dark, overlap shadow
  const W = 64, p = new Pix(W, W), f = fbmField(W, W, 9800, 4, 3), r = rng(9801);
  const RF = ramp(['#4a3010', '#6a4616', '#8a601c', '#a87a26', '#c09232', '#d4a842', '#e2bc56', '#eed070', '#f6e090']);
  for (let row = 0; row < 8; row++) {
    const y0 = row * 8, off = row % 2 ? 4 : 0;
    for (let s = -1; s < 9; s++) {
      const x0 = s * 8 + off, tone = 0.5 + (hf(s, row, 3) - 0.5) * 0.18;
      for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) {
        const X = wrap(x0 + xx, W), Y = y0 + yy, i = Y * W + X;
        const cxn = (xx - 3.5) / 4; // -1..1 across the tile (rounded profile)
        let t = tone + (1 - yy / 7) * 0.22 - cxn * 0.12 - cxn * cxn * 0.15 + (f[i] - 0.5) * 0.1 + (r() - 0.5) * 0.04;
        if (yy === 0) t = 0.95;                    // edge light
        else if (yy === 7) t = 0.02;               // row underside
        else if (yy === 6) t -= 0.25;
        if (xx === 0) t = Math.min(t, 0.18);       // gap between tiles
        if (yy >= 5 && (xx === 0 || xx === 7)) t = 0.05; // rounded lower corners
        p.d[i] = toU(rampAt(RF, Math.max(0, Math.min(0.999, t))));
      }
    }
  }
  return p.canvas(0, 63);
}
function roofEdge64() {
  const p = new Pix(64, 12), f = fbmField(64, 12, 9850, 4, 3);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 64; x++) { let t = 0.45 + (f[y * 64 + x] - 0.5) * 0.3; if (y < 2) t = 0.8; if (y > 9) t = 0.05; p.d[y * 64 + x] = toU(rampAt(WOOD, Math.max(0, Math.min(0.999, t)))); }
  return p.canvas(0, 11);
}
function door64() {
  const W = 32, H = 48, p = new Pix(W, H), f = fbmField(W, H, 9900, 2, 3);
  const cx = W / 2, archR = W / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const inArch = y >= archR || Math.hypot(x + 0.5 - cx, y + 0.5 - archR) <= archR;
    if (!inArch) continue;
    const frame = y >= archR ? (x < 3 || x > W - 4) : Math.hypot(x + 0.5 - cx, y + 0.5 - archR) > archR - 3;
    let t;
    if (frame) t = 0.75 + (f[y * W + x] - 0.5) * 0.2;
    else { const pl = (x - 3) % 6; t = pl === 0 ? 0.06 : 0.4 + (f[y * W + x] - 0.5) * 0.35 + Math.sin(y * 0.6 + x) * 0.04; if (pl === 1) t += 0.12; }
    p.d[y * W + x] = toU(frame ? rampAt(STONE, t) : rampAt(WOOD, Math.max(0, Math.min(0.999, t))));
  }
  for (const y of [22, 38]) for (let x = 3; x < W - 3; x++) { p.put(x, y, toU(hx('#3a3c44'))); p.put(x, y - 1, toU(hx('#7a7e88'))); }
  p.rect(22, 30, 3, 3, toU(hx('#d8b048'))); p.put(22, 30, toU(hx('#f8e088')));
  return p.canvas(16, 47);
}
function window64() {
  const W = 32, H = 32, p = new Pix(W, H), f = fbmField(W, H, 9950, 2, 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const shutterL = x < 7, shutterR = x >= W - 7;
    let c;
    if (shutterL || shutterR) { const sx = shutterL ? x : x - (W - 7); c = (y % 4 === 0) ? hx('#1e4a4a') : sx === 0 || sx === 6 ? hx('#245a58') : mixc(hx('#2e7270'), hx('#3a8a86'), f[i]); }
    else if (x < 9 || x > W - 10 || y < 3 || y > H - 4) c = rampAt(WOOD, 0.3 + f[i] * 0.3);
    else if (x === 15 || x === 16 || y === 15 || y === 16) c = rampAt(WOOD, 0.2);
    else { const g = 1 - Math.hypot(x - 16, y - 18) / 18; c = mixc(hx('#d88a28'), hx('#fce8a0'), Math.max(0, Math.min(1, g + (f[i] - 0.5) * 0.3))); }
    p.d[i] = toU(c);
  }
  return p.canvas(16, 31);
}

export function buildLeafAndHouseHD() {
  const S = {};
  S.tex_leaf_cluster_1 = [leafCard(1, LEAF)];
  S.tex_leaf_cluster_2 = [leafCard(2, LEAF, 32, 120)];
  S.tex_leaf_cluster_3 = [leafCard(3, LEAF, 32, 190)];
  S.tex_leaf_autumn = [leafCard(4, LEAF_AUT)];
  S.tex_bark = [barkTex()];
  S.tex_needles = [needles(5)];
  S.tex_wall_plaster = [plaster64()];
  S.tex_wall_stone = [stone64()];
  S.tex_roof = [roof64()];
  S.tex_roof_edge = [roofEdge64()];
  S.tex_door = [door64()];
  S.tex_window = [window64()];
  return S;
}

// raw access for edges
export function tilePixHD(tiles) {
  // re-read variant 0 of each group back into Pix buffers for edge texturing
  const get = (c) => { const p = new Pix(c.width, c.height); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; p.d.set(new Uint32Array(d.buffer)); return p; };
  const o = {};
  for (const k of ['grass', 'grass_dark', 'grass_light', 'clearing', 'path', 'dirt', 'sand', 'shallow', 'water', 'stone_floor']) if (tiles[k]) o[k] = get(tiles[k][0]);
  return o;
}
