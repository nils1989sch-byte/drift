// Farming art: soil tiles (48 px), crops in 5 stages (ws 0.5, painterly), farm props, barn textures, UI icons.
import { Pix, rng, frames, mat } from './core.js';
import { palette as P } from './palette.js';

// ---------------------------------------------------------------- helpers (free colours, alpha 0/255)
const hx = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const U = (c) => ((255 << 24) | (Math.max(0, Math.min(248, c[2] | 0)) << 16) | (Math.max(0, Math.min(248, c[1] | 0)) << 8) | Math.max(0, Math.min(248, c[0] | 0))) >>> 0;
const ramp = (a) => a.map(hx);
const at = (R, t) => R[Math.max(0, Math.min(R.length - 1, Math.floor(t * R.length)))];
const sh = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
function hf(x, y, s) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, per, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const x0 = ((xi % per) + per) % per, y0 = ((yi % per) + per) % per, x1 = (x0 + 1) % per, y1 = (y0 + 1) % per;
  const a = hf(x0, y0, s), b = hf(x1, y0, s), c = hf(x0, y1, s), d = hf(x1, y1, s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const cv2 = (p, ax, ay) => { const c = p.canvas(ax, ay); c.ws = 0.5; return c; };

const LEAFG = ramp(['#1e3214', '#2a4418', '#36581e', '#446c24', '#54802a', '#669432', '#7aa63c', '#92b84a', '#acca5e', '#c8da7c']);
const SOIL = ramp(['#1e120c', '#2a1810', '#362014', '#422818', '#4e301c', '#5a3a22', '#684428', '#784f30']);
const SOILW = ramp(['#140c0a', '#1c120e', '#241812', '#2c1e16', '#36241a', '#402c20', '#4a3426', '#563e2e']);

// ---------------------------------------------------------------- soil tiles (48×48, furrows period 8 → seamless)
function soilTex(seed, R, wet) {
  const W = 48, p = new Pix(W, W), r = rng(seed);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const fy = ((y + Math.round(Math.sin((x / 48) * Math.PI * 2 * 2 + seed) * 1.2)) % 8 + 8) % 8;
    const ridge = fy < 2 ? 0.66 : fy < 4 ? 0.52 : fy < 6 ? 0.38 : 0.24;   // lit ridge top → dark trough
    const n = vnoise(x / 6, y / 6, 8, seed) * 0.25 + vnoise(x / 2, y / 2, 24, seed + 1) * 0.15;
    let t = ridge + n - 0.15 + (r() - 0.5) * 0.16;
    p.d[y * W + x] = U(at(R, t));
  }
  // clods & pebbles
  for (let i = 0; i < 26; i++) {
    const x = r.int(W), y = r.int(6) + 8 * r.int(6);
    p.put(x, y, U(at(R, 0.9))); p.put((x + 1) % W, y, U(at(R, 0.8))); p.put(x, (y + 1) % W, U(at(R, 0.3)));
  }
  if (wet) for (let i = 0; i < 40; i++) { // moist sheen on ridges
    const x = r.int(W), y = 8 * r.int(6) + r.int(2);
    p.put(x, y, U(hx(r() < 0.5 ? '#6a5a50' : '#7a6c62'))); if (r() < 0.5) p.put((x + 1) % W, y, U(hx('#5a4a40')));
  }
  return p.canvas();
}
export function buildSoilTiles() {
  return {
    soil: frames([1, 2, 3].map((s) => soilTex(1200 + s, SOIL, false)), { mode: 'variant' }),
    soil_wet: frames([1, 2, 3].map((s) => soilTex(1210 + s, SOILW, true)), { mode: 'variant' }),
  };
}
// edge overlays for soil (rough clod border), 48×48
export function buildSoilEdges() {
  const out = {};
  const tex = soilTex(1201, SOIL, false);
  const src = new Pix(48, 48); src.d.set(new Uint32Array(tex.getContext('2d').getImageData(0, 0, 48, 48).data.buffer));
  for (const side of ['n', 's', 'w', 'e']) {
    const p = new Pix(48, 48);
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const [u, t] = side === 'n' ? [x, y] : side === 's' ? [x, 47 - y] : side === 'w' ? [y, x] : [y, 47 - x];
      const pin = Math.min(1, Math.min(u, 47 - u) / 6);
      const d = 4 + (vnoise(u / 5, 0.5, 48 / 5 | 0, side.charCodeAt(0)) - 0.3) * 6 * pin;
      if (t < d) p.d[y * 48 + x] = t > d - 1.5 ? U(at(SOIL, 0.85)) : src.d[y * 48 + x];
    }
    out[`soil_${side}`] = p.canvas();
  }
  return out;
}

// ---------------------------------------------------------------- crop drawing helpers
function leaf(p, x0, y0, len, ang, wid, R, lit = 0) {
  // pointed oval leaf along angle, midrib, lit upper side
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  for (let s = 0; s <= len; s += 0.5) {
    const t = s / len, w = Math.sin(t * Math.PI) * wid;
    for (let o = -w; o <= w; o += 0.5) {
      const x = Math.round(x0 + dx * s + nx * o), y = Math.round(y0 + dy * s + ny * o);
      const side = o * ny < 0 ? 1 : -1; // upper half (towards -y) is lit
      let tone = 0.42 + t * 0.2 + side * 0.14 + lit + (Math.abs(o) < 0.6 ? -0.12 : 0);
      if (Math.abs(o) > w - 0.6) tone -= 0.1;
      p.put(x, y, U(at(R, tone)));
    }
  }
}
function stem(p, x0, y0, x1, y1, R, tone = 0.35) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let k = 0; k <= n; k++) { const t = k / n; p.put(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), U(at(R, tone + t * 0.1))); }
}
function berry(p, cx, cy, r, col, hi) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r, d = nx * nx + ny * ny; if (d > 1) continue;
    const L = -nx * 0.5 - ny * 0.7 + Math.sqrt(1 - d) * 0.5;
    p.put(x, y, U(sh(col, 0.62 + L * 0.45)));
  }
  p.put(Math.round(cx - r * 0.4), Math.round(cy - r * 0.45), U(hi));
}
function mound(p, cx, by, w) {
  for (let y = by - 4; y <= by; y++) for (let x = cx - w; x <= cx + w; x++) {
    const nx = (x - cx) / w, ny = (by - y) / 4; if (nx * nx + (1 - ny) * (1 - ny) * 0 + ny * ny > 1 - nx * nx * 0.2 && ny > 0.05 + Math.abs(nx) * 0.9) continue;
    const lit = -nx * 0.3 + ny * 0.4;
    p.put(x, y, U(at(SOIL, 0.45 + lit + (hf(x, y, 3) - 0.5) * 0.2)));
  }
}
function seeds(p, cx, by) { mound(p, cx, by, 9); for (const [dx, dy] of [[-4, -3], [1, -4], [5, -2]]) { p.put(cx + dx, by + dy, U(hx('#d8c090'))); p.put(cx + dx + 1, by + dy, U(hx('#a88c60'))); } }
function sprout(p, cx, by) { mound(p, cx, by, 7); stem(p, cx, by - 3, cx, by - 9, LEAFG, 0.5); leaf(p, cx, by - 9, 6, -2.4, 2, LEAFG, 0.1); leaf(p, cx, by - 9, 6, -0.7, 2, LEAFG, 0.15); }

// per-crop growth: stage 2 (young), 3 (grown), 4 (ripe)
const CROPS = {
  ruebe(p, cx, by, s) {
    const n = s === 2 ? 4 : 6, L = s === 2 ? 9 : 13;
    if (s >= 3) { // beet shoulder
      const col = hx('#a0284a');
      berry(p, cx, by - 3, s === 4 ? 6 : 4, col, hx('#e07090'));
    }
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.2; stem(p, cx, by - 5, Math.round(cx + Math.cos(a) * 4), Math.round(by - 5 + Math.sin(a) * 4), [hx('#6a1c34'), hx('#8a2a44'), hx('#a83a54')], 0.4); leaf(p, cx + Math.cos(a) * 3, by - 5 + Math.sin(a) * 3, L, a, 3.2, LEAFG, 0.05 * (i % 2)); }
  },
  kartoffel(p, cx, by, s) {
    const R2 = s === 4 ? ramp(['#3a4018', '#4e5420', '#666a2a', '#7e8034', '#989840', '#b0ac50', '#c4bc64']) : LEAFG;
    const balls = s === 2 ? [[0, -8, 6]] : [[-6, -9, 6], [6, -9, 6], [0, -14, 7]];
    for (const [dx, dy, r] of balls) for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; leaf(p, cx + dx, by + dy, r, a, 2.4, R2, Math.sin(-a) * 0.1); }
    if (s === 3) for (const [dx, dy] of [[-4, -17], [3, -19], [7, -13]]) { p.put(cx + dx, by + dy, U(hx('#c8a8e8'))); p.put(cx + dx + 1, by + dy, U(hx('#e8d8f8'))); p.put(cx + dx, by + dy + 1, U(hx('#f0d060'))); }
    if (s === 4) for (const dx of [-7, 2, 8]) berry(p, cx + dx, by - 1, 3, hx('#b8905a'), hx('#e8cc98'));
  },
  erdbeere(p, cx, by, s) {
    const L = s === 2 ? 7 : 10;
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.62; leaf(p, cx + Math.cos(a) * 2, by - 3 + Math.sin(a) * 2, L, a, 3.6, LEAFG, 0.04); }
    if (s === 3) for (const [dx, dy] of [[-6, -10], [5, -12]]) { for (const [ox, oy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) p.put(cx + dx + ox, by + dy + oy, U(hx('#f4f0e6'))); p.put(cx + dx, by + dy, U(hx('#e8c040'))); }
    if (s === 4) for (const [dx, dy] of [[-8, -4], [7, -5], [-2, -2], [3, -9]]) { berry(p, cx + dx, by + dy, 2.6, hx('#d82838'), hx('#ffb0a0')); p.put(cx + dx, by + dy - 3, U(hx('#4a7a24'))); p.put(cx + dx - 1, by + dy, U(hx('#f8e070'))); }
  },
  kuerbis(p, cx, by, s) {
    for (const [dx, dy, a] of [[-8, -6, -2.6], [8, -7, -0.5], [-2, -12, -1.7], [3, -4, -0.9]]) leaf(p, cx + dx * 0.4, by + dy * 0.4, s === 2 ? 7 : 10, a, 4.2, LEAFG, 0);
    if (s >= 3) {
      const r = s === 4 ? 8 : 4, col = s === 4 ? hx('#e07a20') : hx('#7a9a30');
      for (let y = Math.floor(by - 2 * r * 0.8); y <= by; y++) for (let x = cx - r - 2; x <= cx + r + 2; x++) {
        const nx = (x + 0.5 - cx) / (r + 1.5), ny = (y + 0.5 - (by - r * 0.8)) / (r * 0.8), d = nx * nx + ny * ny; if (d > 1) continue;
        const rib = Math.cos(nx * Math.PI * 2.5) * 0.12;
        p.put(x, y, U(sh(col, 0.66 + (-nx * 0.3 - ny * 0.4 + Math.sqrt(1 - d) * 0.3) + rib)));
      }
      stem(p, cx, by - 2 * r * 0.8, cx + 1, by - 2 * r * 0.8 - 3, [hx('#4a5a20'), hx('#6a7a30')], 0.5);
    }
  },
  blaubeere(p, cx, by, s) {
    stem(p, cx, by, cx - 3, by - 10, [hx('#4a2c1c'), hx('#6a4228')], 0.5); stem(p, cx, by, cx + 4, by - 12, [hx('#4a2c1c'), hx('#6a4228')], 0.5);
    const pts = s === 2 ? [[-3, -10], [4, -12]] : [[-5, -12], [4, -14], [-1, -17], [7, -9], [-7, -7]];
    for (const [dx, dy] of pts) for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; leaf(p, cx + dx, by + dy, 4.5, a, 1.8, LEAFG, Math.sin(-a) * 0.12); }
    if (s >= 3) for (const [dx, dy] of [[-4, -8], [2, -11], [6, -6], [-1, -14], [-6, -12]]) berry(p, cx + dx, by + dy, 1.8, s === 4 ? hx('#4058b8') : hx('#88b060'), s === 4 ? hx('#b8c8f0') : hx('#c8e0a0'));
  },
  weizen(p, cx, by, s) {
    const H = s === 2 ? 12 : s === 3 ? 22 : 26;
    const R2 = s === 4 ? ramp(['#6a4c18', '#8a6420', '#a87e2a', '#c49a38', '#d8b44c', '#e8ca68', '#f4dc88']) : LEAFG;
    for (let i = 0; i < 7; i++) {
      const x = cx - 6 + i * 2, h = H - (i % 3) * 2, lean = (i - 3) * 0.6;
      for (let k = 0; k < h; k++) p.put(Math.round(x + lean * (k / h) ** 2), by - k, U(at(R2, 0.25 + (k / h) * 0.5 + (i % 2) * 0.08)));
      if (s >= 3) for (let k = 0; k < 6; k++) { const xx = Math.round(x + lean), yy = by - h - k + 4; p.put(xx - 1, yy, U(at(R2, 0.6 + (k % 2) * 0.2))); p.put(xx + 1, yy, U(at(R2, 0.75))); }
    }
  },
};
function cropSprite(id, stage) {
  const tall = id === 'weizen' || id === 'kartoffel';
  const W = 32, H = tall ? 40 : 32, p = new Pix(W, H), cx = 16, by = H - 3;
  if (stage === 0) seeds(p, cx, by);
  else if (stage === 1) sprout(p, cx, by);
  else { mound(p, cx, by, 8); CROPS[id](p, cx, by, stage); }
  return cv2(p, 16, H - 1);
}
export const CROP_IDS = ['ruebe', 'kartoffel', 'erdbeere', 'kuerbis', 'blaubeere', 'weizen'];
export function buildCrops() {
  const S = {};
  for (const id of CROP_IDS) for (let st = 0; st <= 4; st++) S[`crop_${id}_${st}`] = [cropSprite(id, st)];
  return S;
}

// ---------------------------------------------------------------- farm props (1× pixel drawings → hdify later)
function shippingBin(open) {
  const p = new Pix(24, 20);
  p.rect(1, 8, 22, 11, P.wood_md); p.hline(1, 22, 8, P.wood_lt); p.hline(1, 22, 18, P.wood_dk);
  for (const x of [1, 8, 15, 22]) p.vline(x, 8, 18, P.wood_dk);
  p.hline(2, 21, 13, P.wood_dk);
  if (!open) { p.rect(0, 4, 24, 5, P.wood_lt); p.hline(0, 23, 4, P.wood_hi); p.hline(0, 23, 8, P.wood_dk); p.rect(10, 6, 4, 2, P.metal_md); }
  else { p.rect(0, 0, 24, 6, P.wood_md); p.hline(0, 23, 0, P.wood_lt); p.rect(2, 6, 20, 3, P.wood_ink); p.hline(2, 21, 8, P.wood_dk); }
  for (const x of [3, 20]) { p.put(x, 10, P.metal_lt); p.put(x, 16, P.metal_lt); }
  p.outline(P.wood_ink);
  return p.canvas(12, 19);
}
function scarecrow() {
  const L = { o: P.ink, b: P.wood_dk, B: P.wood_md, h: P.gold_md, H: P.gold_lt, s: P.dirt_hi, S: P.sand, r: P.red_md, R: P.red_dk, k: P.ink, w: P.wood_lt, g: P.blue_md, G: P.blue_dk };
  return mat(`
.......bbbbb.......
.....bbBBBBBbb.....
....bBBBBBBBBBb....
..bbbbbbbbbbbbbbb..
......osSSSSo......
......oSkSkSo......
......oSSSSSo......
.......oSrSo.......
.hHh..ogrrrgo..hHh.
hHhhwwgggrgggwwhhHh
.h....ogggggo....h.
......oGgggGo......
......oggrggo......
.......ohhho.......
.........b.........
.........b.........
.........b.........
.........b.........
.........b.........
........bBb........
.......bbBbb.......`, L).canvas(9, 20);
}
function bed() {
  const p = new Pix(24, 36);
  p.rect(1, 0, 22, 6, P.wood_md); p.hline(1, 22, 0, P.wood_lt); p.hline(1, 22, 5, P.wood_dk);
  p.rect(2, 6, 20, 26, P.wood_dk);
  p.rect(3, 6, 18, 8, P.white); p.hline(3, 20, 6, P.white); p.hline(3, 20, 13, P.metal_lt); p.rect(5, 8, 14, 4, P.metal_lt); p.hline(6, 17, 8, P.white);
  p.rect(3, 14, 18, 18, P.blue_md); p.hline(3, 20, 14, P.blue_lt); p.vline(3, 14, 31, P.blue_lt); p.vline(20, 14, 31, P.blue_dk);
  for (let y = 17; y < 31; y += 4) for (let x = 5; x < 20; x += 4) { p.put(x, y, P.blue_lt); p.put(x + 1, y + 1, P.blue_dk); }
  p.rect(1, 32, 22, 4, P.wood_md); p.hline(1, 22, 32, P.wood_lt); p.hline(1, 22, 35, P.wood_dk);
  p.outline(P.wood_ink);
  return p.canvas(12, 35);
}
function trough() {
  const p = new Pix(32, 14);
  p.rect(1, 3, 30, 9, P.wood_md); p.hline(1, 30, 3, P.wood_lt); p.hline(1, 30, 11, P.wood_dk);
  p.rect(3, 4, 26, 3, P.water_md); p.hline(3, 28, 4, P.water_lt); p.put(8, 5, P.foam); p.put(20, 5, P.foam);
  for (const x of [1, 30]) p.vline(x, 3, 11, P.wood_dk);
  for (const x of [4, 26]) p.rect(x, 11, 2, 3, P.wood_dk);
  p.hline(2, 29, 8, P.wood_dk);
  p.outline(P.wood_ink);
  return p.canvas(16, 13);
}
function fenceFarm(vertical) {
  const p = new Pix(16, 16);
  const W = P.ui_frame, Wl = P.white, Wd = P.rock_lt;
  if (!vertical) {
    for (const y of [5, 10]) { p.hline(0, 15, y, Wl); p.hline(0, 15, y + 1, Wd); }
    for (const x of [1, 13]) { p.rect(x, 2, 2, 13, W); p.vline(x, 2, 14, Wl); p.vline(x + 1, 2, 14, Wd); p.put(x, 1, Wl); }
  } else {
    p.rect(7, 0, 2, 12, Wl); p.vline(8, 0, 11, Wd);
    p.rect(6, 6, 3, 9, W); p.vline(6, 6, 14, Wl); p.vline(8, 6, 14, Wd);
  }
  p.outline(P.rock_dk);
  return p.canvas();
}
function orb(kind, f = 0) {
  // Drift-Kugel: teal glass sphere with a glowing core, held by a brass cage (meridian + equator band)
  const p = new Pix(12, 12), tilt = kind === 'shake' ? [-1, 0, 1][f] : 0;
  const glass = [P.water_dk, P.water_md, P.water_lt, P.water_hi];
  p.ellipse(6 + tilt * 0.5, 6.5, 5, 5, (x, y, nx, ny) => glass[Math.max(0, Math.min(3, Math.floor((-nx * 0.5 - ny * 0.6 + 0.6) * 3)))]);
  p.vline(6 + tilt, 2, 11, P.gold_md); p.hline(1, 10, 7, P.gold_md); p.hline(2, 9, 6, P.gold_lt);
  p.put(6 + tilt, 7, kind === 'open' ? P.white : P.fx_cyan);
  if (kind === 'open') { for (let x = 0; x < 12; x++) for (let y = 0; y < 6; y++) { const v = p.get(x, y); if (v) { p.clear(x, y); if (y - 2 >= 0) p.put(x, y - 2, v); } } p.put(5, 5, P.fx_cyan); p.put(7, 4, P.white); }
  p.put(4, 4, P.white);
  p.outline(P.ink);
  return p.canvas(6, 11);
}

// ---------------------------------------------------------------- barn textures (64×64, free colours)
function texBarnWall() {
  const W = 64, p = new Pix(W, W), r = rng(1301);
  const RW = ramp(['#3a1410', '#4e1c14', '#62241a', '#762e20', '#8a3826', '#9c442c', '#ae5234']);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const pl = x % 8; let t = 0.5 + (hf(x >> 3, 0, 9) - 0.5) * 0.25 + (vnoise(x / 2, y / 12, 32, 5) - 0.5) * 0.25 + (r() - 0.5) * 0.06;
    if (pl === 0) t = 0.04; else if (pl === 1) t += 0.16; else if (pl === 7) t -= 0.16;
    p.d[y * W + x] = U(at(RW, t));
  }
  // white trim frame with X brace (lower half)
  const trim = (x, y) => { p.put(x, y, U(hx('#e8e0d0'))); };
  for (let i = 0; i < W; i++) { trim(i, 0); trim(i, 1); trim(i, 32); trim(i, 33); trim(0, i); trim(1, i); }
  for (let k = 0; k < 30; k++) { trim(2 + k * 2, 34 + k); trim(3 + k * 2, 34 + k); trim(61 - k * 2, 34 + k); trim(60 - k * 2, 34 + k); }
  for (let i = 0; i < W; i++) { p.put(i, 2, U(hx('#9a9080'))); p.put(2, i, U(hx('#9a9080'))); }
  return p.canvas(0, 63);
}
function texBarnRoof() {
  const W = 64, p = new Pix(W, W), r = rng(1302);
  const RR = ramp(['#1e1c20', '#2a282c', '#363438', '#444046', '#524e52', '#605a5e', '#6e686a']);
  for (let row = 0; row < 8; row++) for (let yy = 0; yy < 8; yy++) for (let x = 0; x < W; x++) {
    const y = row * 8 + yy, off = row % 2 ? 6 : 0, sx = (x + off) % 12;
    let t = 0.5 + (1 - yy / 8) * 0.25 + (hf((x + off) / 12 | 0, row, 4) - 0.5) * 0.2 + (r() - 0.5) * 0.06;
    if (yy === 7) t = 0.02; else if (yy === 6) t -= 0.25; else if (yy === 0) t += 0.2; if (sx === 0) t = Math.min(t, 0.15);
    p.d[y * W + x] = U(at(RR, t));
  }
  return p.canvas(0, 63);
}

// ---------------------------------------------------------------- UI icons (32×32, crisp, ink outline)
function produce(p, id, cx, cy, s = 1) {
  if (id === 'ruebe') { berry(p, cx, cy + 2 * s, 6 * s, hx('#a0284a'), hx('#e88aa0')); for (const a of [-2.2, -1.6, -1.0]) leaf(p, cx, cy - 3 * s, 8 * s, a, 2.2 * s, LEAFG, 0.05); p.put(cx, cy + 8 * s, U(hx('#6a1c34'))); }
  if (id === 'kartoffel') { berry(p, cx - 2 * s, cy + 1 * s, 6 * s, hx('#b8905a'), hx('#ecd2a0')); berry(p, cx + 5 * s, cy + 4 * s, 4 * s, hx('#a8804c'), hx('#e0c490')); p.put(cx - 4, cy, U(hx('#6a4a28'))); p.put(cx + 1, cy + 3, U(hx('#6a4a28'))); }
  if (id === 'erdbeere') { berry(p, cx, cy + 2 * s, 7 * s, hx('#d82838'), hx('#ffb0a0')); for (const a of [-2.4, -1.57, -0.7]) leaf(p, cx, cy - 4 * s, 5 * s, a, 1.8 * s, LEAFG, 0.1); for (let i = 0; i < 7; i++) p.put(cx - 4 + (i * 3) % 9, cy - 1 + (i * 5) % 8, U(hx('#f8e070'))); }
  if (id === 'kuerbis') { const ry = Math.round(7 * s), rx = Math.round(10 * s); for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const nx = x / rx, ny = y / ry, d = nx * nx + ny * ny; if (d > 1) continue; p.put(cx + x, cy + 2 * s + y, U(sh(hx('#e07a20'), 0.66 + (-nx * 0.3 - ny * 0.4 + Math.sqrt(1 - d) * 0.3) + Math.cos(nx * Math.PI * 2.5) * 0.12))); } stem(p, cx, Math.round(cy + 2 * s - ry), cx + 2, Math.round(cy + 2 * s - ry - 4 * s), [hx('#4a5a20'), hx('#6a7a30')], 0.5); }
  if (id === 'blaubeere') { for (const [dx, dy] of [[-4, 2], [3, 3], [-1, -3], [5, -2], [0, 7]]) berry(p, cx + dx * s, cy + dy * s, 3.6 * s, hx('#4058b8'), hx('#c0d0f8')); leaf(p, cx + 2, cy - 7, 7, -0.6, 2.4, LEAFG, 0.1); }
  if (id === 'weizen') {
    const WR = ramp(['#8a6420', '#a87e2a', '#c49a38', '#d8b44c', '#e8ca68', '#f4dc88']);
    for (let i = 0; i < 5; i++) {
      const lean = (i - 2) * 1.6, L = Math.round(22 * s);
      for (let k = 0; k < L; k++) { const x = Math.round(cx + (i - 2) * 2 * s + lean * (k / L)), y = Math.round(cy + 11 * s - k); p.put(x, y, U(at(WR, 0.35 + (k / L) * 0.3))); if (k > L * 0.6) { p.put(x - 1, y, U(at(WR, 0.75 + (k % 2) * 0.2))); p.put(x + 1, y, U(at(WR, 0.6))); } }
    }
    p.hline(Math.round(cx - 5 * s), Math.round(cx + 5 * s), Math.round(cy + 5 * s), U(hx('#9a4a20'))); p.hline(Math.round(cx - 5 * s), Math.round(cx + 5 * s), Math.round(cy + 6 * s), U(hx('#6a3018')));
  }
}
function icon(fn) { const p = new Pix(32, 32); fn(p); p.outline(P.ink); return p.canvas(); }
function seedPack(id) {
  return icon((p) => {
    p.rect(7, 4, 18, 24, P.dirt_hi); p.vline(7, 4, 27, P.white); p.vline(24, 4, 27, P.dirt_lt); p.hline(7, 24, 27, P.dirt_lt);
    for (let x = 7; x < 25; x += 2) p.put(x, 4, P.dirt_lt);
    p.rect(8, 21, 16, 5, P.wood_lt); for (let i = 0; i < 6; i++) p.put(10 + i * 2, 23, P.wood_dk);
    const q = new Pix(32, 32); produce(q, id, 16, 12, 0.6); p.blit(q, 0, 0);
  });
}
function cropIcon(id) { return icon((p) => produce(p, id, 16, 15, 1)); }
function typePlaque(col, dk, glyph) {
  const p = new Pix(16, 16);
  p.rect(1, 2, 14, 12, dk); p.rect(2, 1, 12, 14, dk);
  p.rect(2, 2, 12, 12, col); p.hline(3, 12, 2, P.white);
  glyph.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') { p.put(4 + x, 4 + y, P.white); p.put(5 + x, 5 + y, dk); } }));
  glyph.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') p.put(4 + x, 4 + y, P.white); }));
  p.outline(P.ink);
  return p.canvas();
}
const GLYPH = {
  fire: ['...#...', '..##...', '..###..', '.#####.', '.##.##.', '..###..', '.......'],
  water: ['...#...', '..###..', '.#####.', '.#####.', '.##.##.', '..###..', '.......'],
  leaf: ['....##.', '..####.', '.####..', '.###...', '.#.#...', '#......', '.......'],
  rock: ['..###..', '.#####.', '####.##', '###.###', '.#####.', '.......', '.......'],
  spark: ['....##.', '...##..', '..####.', '...##..', '..##...', '.##....', '.......'],
  wind: ['.####..', '.....#.', '######.', '.......', '.#####.', '......#', '.####..'],
  normal: ['..###..', '.#...#.', '#.....#', '#..#..#', '#.....#', '.#...#.', '..###..'],
};
export function buildFarmIcons() {
  const I = {};
  I.icon_hoe = icon((p) => { p.line(8, 27, 22, 8, P.wood_md); p.line(9, 27, 23, 8, P.wood_dk); p.line(7, 26, 21, 7, P.wood_lt); p.rect(19, 4, 9, 4, P.metal_md); p.hline(19, 27, 4, P.metal_lt); p.rect(25, 4, 3, 8, P.metal_md); p.vline(27, 5, 11, P.metal_dk); });
  I.icon_can = icon((p) => { p.ellipse(14, 19, 9, 8, (x, y, nx, ny) => (ny < -0.4 ? P.blue_lt : nx > 0.4 ? P.blue_dk : P.blue_md)); p.line(22, 18, 29, 10, P.blue_md); p.line(22, 19, 29, 11, P.blue_dk); p.rect(28, 8, 3, 3, P.metal_lt); p.line(8, 12, 12, 7, P.blue_dk); p.line(12, 7, 17, 7, P.blue_dk); p.line(17, 7, 20, 12, P.blue_dk); p.put(10, 16, P.white); p.put(11, 15, P.white); });
  I.icon_sickle = icon((p) => { for (let a = 0; a < 2.6; a += 0.05) { const x = 15 + Math.cos(a + 3.6) * 10, y = 13 + Math.sin(a + 3.6) * 9; p.put(Math.round(x), Math.round(y), P.metal_lt); p.put(Math.round(x), Math.round(y) + 1, P.metal_md); } p.rect(14, 20, 3, 9, P.wood_md); p.vline(14, 20, 28, P.wood_lt); p.vline(16, 20, 28, P.wood_dk); });
  I.icon_orb = icon((p) => {
    const glass = [P.water_ink, P.water_dk, P.water_md, P.water_lt, P.water_hi];
    p.ellipse(16, 16, 11, 11, (x, y, nx, ny) => glass[Math.max(0, Math.min(4, Math.floor((-nx * 0.5 - ny * 0.6 + 0.6) * 4)))]);
    p.ellipse(16, 17, 3.5, 3.5, P.fx_cyan); p.ellipse(16, 17, 1.6, 1.6, P.white);
    for (let y = 5; y <= 27; y++) { p.put(16, y, P.gold_md); p.put(17, y, P.gold_dk); }
    for (let x = 5; x <= 27; x++) { p.put(x, 16, P.gold_lt); p.put(x, 17, P.gold_md); }
    p.rect(14, 3, 5, 3, P.gold_md); p.hline(14, 18, 3, P.gold_lt);
    p.put(10, 9, P.white); p.put(11, 8, P.white); p.put(9, 10, P.foam);
  });
  I.icon_potion = icon((p) => { p.rect(13, 3, 6, 3, P.wood_md); p.rect(14, 6, 4, 4, P.water_hi); p.ellipse(16, 20, 9, 9, (x, y, nx, ny) => (ny < -0.3 ? P.water_hi : nx > 0.4 ? P.magic : P.rupee_green)); p.put(11, 16, P.white); p.put(12, 15, P.white); });
  I.icon_coin = icon((p) => { p.ellipse(16, 16, 10, 10, P.gold_dk); p.ellipse(15, 15, 9, 9, P.gold_md); p.ellipse(14, 14, 6, 6, P.gold_lt); p.ellipse(15, 15, 5, 5, P.gold_md); p.vline(15, 11, 19, P.gold_dk); p.put(11, 10, P.white); });
  for (const id of CROP_IDS) { I[`icon_seeds_${id}`] = seedPack(id); I[`icon_crop_${id}`] = cropIcon(id); }
  const T = { fire: [P.fx_orange, P.red_dk], water: [P.water_md, P.water_ink], leaf: [P.grass_md, P.grass_ink], rock: [P.cliff_md, P.cliff_ink], spark: [P.gold_md, P.gold_dk], wind: [P.fx_cyan, P.water_dk], normal: [P.rock_lt, P.rock_dk] };
  for (const [k, [c, d]] of Object.entries(T)) I[`type_${k}`] = typePlaque(c, d, GLYPH[k]);
  return I;
}

export function buildFarmProps() {
  const S = {};
  S.shipping_bin = [shippingBin(false)];
  S.shipping_bin_open = [shippingBin(true)];
  S.scarecrow = [scarecrow()];
  S.bed = [bed()];
  S.trough = [trough()];
  S.fence_farm = [fenceFarm(false)];
  S.fence_farm_v = [fenceFarm(true)];
  S.orb = [orb('closed')];
  S.orb_open = [orb('open')];
  S.orb_shake = frames([0, 1, 2, 1].map((f) => orb('shake', f)), { fps: 6 });
  S.tex_barn_wall = [texBarnWall()];
  S.tex_barn_roof = [texBarnRoof()];
  return S;
}
