// Double-density "painterly" conversion for props/pickups (canvas.ws = 0.5, world size unchanged).
// Scale2x keeps pixel-art diagonals clean, hard ink outlines become soft dark material edges,
// plus fine value grain and warm top-left light. Alpha stays 0/255.
import { Pix } from './core.js';
import { palette as P } from './palette.js';

const INK = new Set([P.ink, P.wood_ink, P.grass_ink, P.rock_ink, P.stone_ink, P.dirt_ink, P.cliff_ink, P.water_ink, P.tunic_ink].map((h) => { const n = parseInt(h.slice(1), 16); return ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | (n >> 16)) >>> 0; }));

function fromCanvas(c) { const p = new Pix(c.width, c.height); p.d.set(new Uint32Array(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.buffer)); return p; }
function hf(x, y, s) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const R = (v) => v & 255, G = (v) => (v >>> 8) & 255, B = (v) => (v >>> 16) & 255;
const pack = (r, g, b) => ((255 << 24) | (Math.max(0, Math.min(248, b | 0)) << 16) | (Math.max(0, Math.min(248, g | 0)) << 8) | Math.max(0, Math.min(248, r | 0))) >>> 0;
const scaleC = (v, k, warm = 0) => pack(R(v) * k * (1 + warm * 0.06), G(v) * k, B(v) * k * (1 - warm * 0.08));

function scale2x(s) {
  const W = s.w, H = s.h, o = new Pix(W * 2, H * 2);
  const g = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : s.d[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = g(x, y), A = g(x, y - 1), Bc = g(x + 1, y), C = g(x - 1, y), D = g(x, y + 1);
    const e0 = C === A && C !== D && A !== Bc ? A : p, e1 = A === Bc && A !== C && Bc !== D ? Bc : p;
    const e2 = D === C && D !== Bc && C !== A ? C : p, e3 = Bc === D && Bc !== A && D !== C ? D : p;
    o.d[(2 * y) * o.w + 2 * x] = e0; o.d[(2 * y) * o.w + 2 * x + 1] = e1; o.d[(2 * y + 1) * o.w + 2 * x] = e2; o.d[(2 * y + 1) * o.w + 2 * x + 1] = e3;
  }
  return o;
}
// nearest non-ink colour in the 1× source around (x,y)
function materialAt(s, x, y) {
  for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= s.w || yy >= s.h) continue;
    const v = s.d[yy * s.w + xx]; if (v && !INK.has(v)) return v;
  }
  return 0;
}

export function hdify(c, seed = 1) {
  const s = fromCanvas(c), o = scale2x(s), W = o.w, H = o.h;
  // bounding box for the light gradient
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (o.d[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
  const out = new Uint32Array(o.d);
  const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && o.d[y * W + x] !== 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = o.d[y * W + x]; if (!v) continue;
    const edge = !op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1);
    if (INK.has(v)) {
      const m = materialAt(s, x >> 1, y >> 1) || v;
      // outer ring: dark material, inner half of the old outline: mid-dark → soft edge, no black line
      v = scaleC(m, edge ? 0.5 : 0.68, -0.5);
    }
    // warm key light top-left, cooler shade bottom-right, fine painterly grain
    const lx = (x - x0) / bw - 0.5, ly = (y - y0) / bh - 0.5;
    const light = -(lx * 0.6 + ly * 0.8);                         // -0.7 .. 0.7
    const grain = (hf(x, y, seed) - 0.5) * 0.09 + (hf(x >> 2, y >> 2, seed + 7) - 0.5) * 0.07;
    const k = 1 + light * 0.16 + grain;
    v = scaleC(v, k, light > 0 ? light * 1.2 : light * 0.6);
    if (edge && light > 0.25 && !INK.has(o.d[y * W + x])) v = scaleC(v, 1.08, 0.6); // sun rim on lit edges
    out[y * W + x] = v;
  }
  o.d = out;
  const ax = c.ax ?? (c.width >> 1), ay = c.ay ?? c.height - 1;
  const cv = o.canvas(ax * 2, ay * 2 + 1);
  cv.ws = 0.5;
  return cv;
}
// convert a frame array in place-ish (keeps fps/mode/layer…)
export function hdifyFrames(arr, seed) {
  const out = arr.map((c, i) => hdify(c, seed + i));
  for (const k of Object.keys(arr)) if (Number.isNaN(+k)) out[k] = arr[k];
  return out;
}
