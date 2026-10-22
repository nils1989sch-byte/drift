// Double-density vegetation billboards & leaf cards (ws = 0.5): grass tufts with clear tips and a back-light rim,
// flower nests (5–9 dabs), leafy bushes made of 5–7 readable leaf balls with a sun edge.
import { Pix, rng, frames } from './core.js';

const hx = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const U = (c) => ((255 << 24) | (Math.max(0, Math.min(255, c[2] | 0)) << 16) | (Math.max(0, Math.min(255, c[1] | 0)) << 8) | Math.max(0, Math.min(255, c[0] | 0))) >>> 0;
const ramp = (a) => a.map(hx);
const at = (R, t) => R[Math.max(0, Math.min(R.length - 1, Math.floor(t * R.length)))];
const cv2 = (p, ax, ay) => { const c = p.canvas(ax, ay); c.ws = 0.5; return c; };

const BLADE = ramp(['#24381a', '#34501e', '#466a24', '#5a822a', '#709a30', '#88ae3a', '#a2c04a', '#bcd060', '#d4e07e', '#e8ec9c']);
const BLADE_DARK = ramp(['#16260f', '#1f3414', '#294418', '#34541c', '#406422', '#4e7428', '#5e8430', '#709438']);
const BLADE_LIGHT = ramp(['#4a6a24', '#5e842a', '#76a032', '#90b63e', '#a8c64e', '#c0d466', '#d6e284', '#eaeea6']);
const LEAF = ramp(['#1c3014', '#253e18', '#2f4e1c', '#3b6022', '#4a7428', '#5a8830', '#6e9c38', '#86b044', '#a2c454', '#c0d66c', '#dce690']);
const LEAF_AUT = ramp(['#4a2a0c', '#6a3e10', '#8a5414', '#a86c18', '#c4881e', '#d8a224', '#e8bc30', '#f4d040', '#f8e070', '#fcf0a0']);

// tapered curved blade, 2–3 texels at the base, clear 1-texel tip; left edge lit (back-light rim)
function blade(p, x0, base, h, lean, R, seed) {
  const r = rng(seed);
  for (let k = 0; k < h; k++) {
    const t = k / Math.max(1, h - 1);
    const x = x0 + lean * t * t, y = base - k;
    const w = t < 0.3 ? 3 : t < 0.75 ? 2 : 1;
    for (let i = 0; i < w; i++) {
      let tone = 0.15 + t * 0.72 + (r() - 0.5) * 0.06;
      if (i === 0 && w > 1) tone += 0.14;          // lit rim
      if (i === w - 1 && w > 1) tone -= 0.1;
      p.put(Math.round(x) + i - (w >> 1), y, U(at(R, tone)));
    }
  }
  p.put(Math.round(x0 + lean), base - h, U(R[R.length - 1]));
}
function tuft(seed, W, H, n, R) {
  const r = rng(seed), p = new Pix(W, H), cx = W / 2;
  const bl = [];
  for (let i = 0; i < n; i++) {
    const s = n === 1 ? 0 : i / (n - 1) - 0.5;
    const h = Math.round(H * (0.55 + 0.42 * (1 - Math.abs(s) * 1.4) * (0.75 + r() * 0.25)));
    bl.push([cx + s * W * 0.38 + (r() - 0.5) * 3, Math.min(H - 2, h), s * W * 0.7 + (r() - 0.5) * 4]);
  }
  bl.sort((a, b) => a[1] - b[1]);
  bl.forEach(([x, h, lean], i) => blade(p, x, H - 1, h, lean, R, seed * 31 + i));
  // dark contact at the foot (soft, not black)
  for (let x = Math.floor(cx - W * 0.22); x <= Math.ceil(cx + W * 0.22); x++) if (p.op(x, H - 1)) { p.put(x, H - 1, U(R[0])); if (p.op(x, H - 2)) p.put(x, H - 2, U(R[1])); }
  return cv2(p, W >> 1, H - 1);
}
function flowerNest(seed, petal, centre) {
  const W = 22, H = 16, p = new Pix(W, H), r = rng(seed), P0 = hx(petal), C0 = hx(centre);
  // leaves/stems
  for (let i = 0; i < 9; i++) { const x = r.range(3, W - 4), y = r.range(8, H - 2); p.put(x, y, U(at(BLADE, 0.35 + r() * 0.3))); p.put(x + 1, y, U(at(BLADE, 0.5 + r() * 0.3))); p.put(x, y + 1, U(at(BLADE, 0.2))); }
  const n = r.range(5, 9);
  for (let i = 0; i < n; i++) {
    const x = r.range(3, W - 4), y = r.range(2, H - 6);
    p.put(x, y + 3, U(at(BLADE, 0.35))); p.put(x, y + 2, U(at(BLADE, 0.45)));
    const lit = [P0[0] * 1.08, P0[1] * 1.08, P0[2] * 1.05], dk = [P0[0] * 0.78, P0[1] * 0.74, P0[2] * 0.8];
    p.put(x, y - 1, U(lit)); p.put(x - 1, y, U(lit)); p.put(x + 1, y, U(P0)); p.put(x, y + 1, U(dk)); p.put(x, y, U(C0));
  }
  return cv2(p, W >> 1, H - 1);
}
// shaded leaf ball with leaf texture + sun edge (top-left) and dark underside
function leafBall(p, cx, cy, rad, R, seed) {
  const r = rng(seed), lx = -0.5, ly = -0.7, lz = 0.5;
  const marks = [];
  for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
    const nx = (x + 0.5 - cx) / rad, ny = (y + 0.5 - cy) / (rad * 0.92), d = nx * nx + ny * ny;
    if (d > 1) continue;
    const nz = Math.sqrt(1 - d), L = nx * lx + ny * ly + nz * lz;
    let t = 0.3 + L * 0.42 + (r() - 0.5) * 0.08;
    if (d > 0.72 && L > 0.25) t = 0.92 + (r() - 0.5) * 0.06;      // sun edge
    if (d > 0.8 && L < -0.15) t -= 0.12;                         // dark underside rim
    p.put(x, y, U(at(R, t)));
    if (r() < 0.18) marks.push([x, y, t]);
  }
  // leaf marks: tiny 2–3 texel leaves, lighter above / darker below
  for (const [x, y, t] of marks) {
    const o = (x + y) & 1;
    p.put(x, y, U(at(R, Math.min(0.99, t + 0.12)))); p.put(x + 1, y + o, U(at(R, Math.min(0.99, t + 0.06))));
    if (p.op(x, y + 1)) p.put(x, y + 1, U(at(R, t - 0.12)));
  }
}
function leafyBushHD(seed, W, H, balls, R) {
  const p = new Pix(W, H);
  [...balls].sort((a, b) => a[1] - b[1]).forEach(([x, y, rr], i) => leafBall(p, x, y, rr, R, seed + i));
  // soft outer edge (darker leaf tone, no ink)
  const src = p.clone();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!src.op(x, y)) continue;
    if (!src.op(x - 1, y) || !src.op(x + 1, y) || !src.op(x, y + 1)) { const v = src.get(x, y); p.put(x, y, ((v & 0xff000000) | (((v >>> 16 & 255) * 0.7) << 16) | (((v >>> 8 & 255) * 0.72) << 8) | ((v & 255) * 0.7)) >>> 0); }
  }
  for (let x = 0; x < W; x++) p.clear(x, H - 1);
  return p;
}
export function leafCardHD(seed, R = LEAF) {
  // 32×32 card with 6 clear balls (for 3D bush/tree models)
  const p = leafyBushHD(seed, 32, 32, [[16, 10, 7], [9, 14, 6.5], [23, 14, 6.5], [12, 21, 7], [21, 21, 7], [16, 25, 6]], R);
  return p.canvas(16, 31);
}

export function buildDecoHD() {
  const S = {};
  S.deco_grass_1 = [tuft(1, 40, 52, 8, BLADE)];
  S.deco_grass_2 = [tuft(2, 32, 40, 6, BLADE)];
  S.deco_grass_3 = [tuft(3, 48, 64, 9, BLADE)];
  S.deco_grass_4 = [tuft(4, 36, 46, 7, BLADE)];
  S.deco_grass_dark_1 = [tuft(5, 36, 44, 8, BLADE_DARK)];
  S.deco_grass_dark_2 = [tuft(6, 32, 36, 6, BLADE_DARK)];
  S.deco_grass_light_1 = [tuft(7, 30, 34, 7, BLADE_LIGHT)];
  S.deco_grass_light_2 = [tuft(8, 26, 28, 5, BLADE_LIGHT)];
  S.deco_grass_light_3 = [tuft(9, 34, 40, 8, BLADE_LIGHT)];
  S.deco_flower_white = [flowerNest(1, '#f4f0e6', '#e8c040')];
  S.deco_flower_yellow = [flowerNest(2, '#f6d850', '#e07a28')];
  S.deco_flower_pink = [flowerNest(3, '#f2a8c0', '#d05060')];
  S.deco_flower_purple = [flowerNest(4, '#b898e8', '#7050b0')];
  const bush = leafyBushHD(11, 48, 40, [[24, 14, 9], [13, 20, 8.5], [35, 20, 8.5], [18, 28, 9], [31, 28, 9], [8, 30, 6.5], [41, 30, 6.5]], LEAF);
  S.deco_bush_leafy = [cv2(bush, 24, 38)];
  S.tex_leaf_cluster_1 = [leafCardHD(21)];
  S.tex_leaf_cluster_2 = [leafCardHD(22)];
  S.tex_leaf_cluster_3 = [leafCardHD(23)];
  S.tex_leaf_autumn = [leafCardHD(24, LEAF_AUT)];
  return S;
}
