// HD-2D additions: deco billboards (grass, flowers, ferns, reeds, pebbles), big foliage trees, lush bush,
// and house textures for the 3D renderer. All opaque pixels (alpha 0/255), anchors bottom-centre.
import { Pix, rng, frames } from './core.js';
import { palette as P } from './palette.js';

// ---------- blades ----------
// one blade from (x0, base) upward with height h and lean (curved). colour by height fraction.
function blade(p, x0, base, h, lean, ramp, w2 = false) {
  for (let k = 0; k < h; k++) {
    const t = k / Math.max(1, h - 1);
    const x = Math.round(x0 + lean * t * t);
    const c = t < 0.12 ? ramp[0] : t < 0.4 ? ramp[1] : t < 0.78 ? ramp[2] : ramp[3];
    p.set(x, base - k, c);
    if (w2 && t < 0.35) p.set(x + 1, base - k, t < 0.18 ? ramp[0] : ramp[1]);
  }
}
const GR = [P.grass_dk, P.grass_md, P.grass_lt, P.grass_hi];
const GR_DARK = [P.grass_ink, P.grass_dk, P.grass_md, P.grass_lt];

function decoGrass(seed, W, H, n, ramp) {
  const r = rng(seed), p = new Pix(W, H), cx = (W - 1) / 2;
  const bl = [];
  for (let i = 0; i < n; i++) {
    const off = (i / (n - 1) - 0.5) * (W - 4) + (r() - 0.5) * 2;
    const h = Math.round(H * (0.55 + 0.45 * (1 - Math.abs(off) / (W / 2)) * (0.7 + r() * 0.3)));
    bl.push([cx + off * 0.45, h, off * 0.9 + (r() - 0.5) * 3]);
  }
  // draw shorter (back) blades first so tall ones read in front
  bl.sort((a, b) => a[1] - b[1]);
  for (const [x, h, lean] of bl) blade(p, x, H - 1, h, lean, ramp, r() < 0.4);
  // dark foot
  for (let x = Math.floor(cx - 2); x <= Math.ceil(cx + 2); x++) if (p.op(x, H - 1)) p.put(x, H - 1, P.grass_ink);
  return p.canvas(W >> 1, H - 1);
}

function decoFlower(seed, petal, centre) {
  const r = rng(seed), p = new Pix(8, 8);
  const heads = [[2, 3], [5, 2], [4, 5]];
  for (const [x, y] of heads) { p.vline(x, y + 1, 7, P.grass_md); }
  p.set(1, 6, P.grass_lt); p.set(6, 6, P.grass_lt); p.set(3, 7, P.grass_dk); p.set(5, 7, P.grass_dk);
  heads.forEach(([x, y], i) => {
    if (i === 2 && r() < 0.5) { p.set(x, y, petal); p.set(x + 1, y, petal); p.set(x, y - 1, petal); return; }
    p.set(x, y - 1, petal); p.set(x - 1, y, petal); p.set(x + 1, y, petal); p.set(x, y + 1, petal); p.set(x, y, centre);
  });
  return p.canvas(4, 7);
}

function decoFern(seed, W, H) {
  const r = rng(seed), p = new Pix(W, H), cx = W >> 1, base = H - 1;
  const fronds = [[-1, 0.9], [-0.55, 1], [0, 1.05], [0.55, 1], [1, 0.85]];
  for (const [dir, len] of fronds) {
    const L = Math.round((H - 2) * len * (0.85 + r() * 0.15));
    let px = cx, py = base;
    for (let k = 0; k < L; k++) {
      const t = k / L;
      const x = Math.round(cx + dir * (W / 2 - 1) * Math.sin(t * Math.PI * 0.6));
      const y = Math.round(base - (H - 2) * len * Math.sin(t * Math.PI * 0.55) + (Math.abs(dir) > 0.7 ? t * t * 4 : 0));
      p.set(x, y, t < 0.2 ? P.grass_ink : P.grass_dk);
      // leaflets
      if (k % 2 === 1 && t > 0.15) {
        p.set(x - 1, y - 1, t > 0.7 ? P.grass_lt : P.grass_md);
        p.set(x + 1, y - 1, t > 0.7 ? P.grass_hi : P.grass_lt);
      }
      px = x; py = y;
    }
    void px; void py;
  }
  return p.canvas(cx, base);
}

function decoReed(seed, W, H) {
  const r = rng(seed), p = new Pix(W, H);
  const stems = [[3, H - 2, -1], [6, H - 6, 0.5], [9, H - 4, 1.5]];
  // leaves
  for (const [x0, lean] of [[2, -2], [5, -3], [8, 3], [10, 2]]) blade(p, x0, H - 1, Math.round(H * (0.4 + r() * 0.2)), lean, GR_DARK);
  stems.forEach(([x0, h, lean], i) => {
    blade(p, x0, H - 1, h, lean, [P.grass_dk, P.grass_md, P.grass_md, P.grass_lt]);
    if (i !== 2 || seed % 2) {
      const tx = Math.round(x0 + lean), ty = H - h + 2;
      p.rect(tx, ty, 2, 4, P.wood_md); p.set(tx, ty, P.wood_lt); p.vline(tx + 1, ty + 1, ty + 3, P.wood_dk);
      p.set(tx, ty - 1, P.grass_lt);
    }
  });
  return p.canvas(W >> 1, H - 1);
}

function decoPebble(seed, W, H) {
  const p = new Pix(W, H), r = rng(seed);
  p.ball(W * 0.38, H * 0.55, W * 0.3, H * 0.45, [P.rock_dk, P.rock_md, P.rock_lt, P.rock_hi]);
  p.ball(W * 0.72, H * 0.65, W * 0.2, H * 0.35, [P.rock_dk, P.rock_md, P.rock_lt]);
  void r;
  p.outline(P.rock_ink);
  return p.canvas(W >> 1, H - 1);
}

// ---------- leafy foliage: many small lit leaves over a dark core ----------
// clusters: [cx, cy, rx, ry]; ramp dark→light (5); light from top-left, deep shade low-right
function leafy(p, clusters, ramp, seed, density = 0.42) {
  const r = rng(seed);
  const inside = (x, y) => clusters.find(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
  let area = 0;
  const pts = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (inside(x + 0.5, y + 0.5)) { p.put(x, y, ramp[(x + y) % 3 === 0 ? 0 : 1]); area++; pts.push([x, y]); }
  const n = Math.round(area * density);
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[r.int(pts.length)];
    const c = inside(x + 0.5, y + 0.5);
    const nx = (x + 0.5 - c[0]) / c[2], ny = (y + 0.5 - c[1]) / c[3], nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    // global light term too (whole crown lit top-left)
    const gx = (x / p.w) - 0.5, gy = (y / p.h) - 0.45;
    let L = -0.55 * nx - 0.6 * ny + 0.55 * nz - 0.6 * (gx + gy) + (r() - 0.5) * 0.35;
    leaves.push([x, y, L]);
  }
  leaves.sort((a, b) => a[1] - b[1]);
  for (const [x, y, L] of leaves) {
    const idx = Math.max(1, Math.min(ramp.length - 1, Math.floor((L + 0.55) * 3.2)));
    const shape = (x * 7 + y * 3) % 3;
    const pix = shape === 0 ? [[0, 0], [1, 0], [0, 1]] : shape === 1 ? [[0, 0], [1, 0], [1, 1]] : [[0, 0], [0, 1], [1, 1]];
    for (const [dx, dy] of pix) if (inside(x + dx + 0.5, y + dy + 0.5)) p.put(x + dx, y + dy, ramp[idx]);
    if (inside(x + 1.5, y + 2.5) && idx >= 2) p.put(x + 1, y + 2, ramp[Math.max(0, idx - 2)]);
  }
}

// irregular leafy silhouette: grow/carve the outer rim
function roughen(p, seed, passes = 2) {
  const r = rng(seed);
  for (let k = 0; k < passes; k++) {
    const src = p.clone();
    for (let y = 1; y < p.h - 1; y++) for (let x = 1; x < p.w - 1; x++) {
      const v = src.get(x, y);
      const nb = [src.get(x - 1, y), src.get(x + 1, y), src.get(x, y - 1), src.get(x, y + 1)];
      if (!v) { const n = nb.filter(Boolean); if (n.length && r() < 0.22 * n.length) p.put(x, y, n[r.int(n.length)]); }
      else if (nb.some((c) => !c) && r() < 0.18) p.clear(x, y);
    }
  }
}

// ---------- big foliage tree ----------
function leafMass(p, clusters, ramp, seed, smallCount) {
  const r = rng(seed);
  const cs = [...clusters].sort((a, b) => a[1] - b[1]);
  for (const [cx, cy, rx, ry] of cs) { p.ellipse(cx, cy, rx + 1, ry + 1, ramp[0]); p.ball(cx, cy, rx, ry, ramp, { dither: 0.08, bias: -0.18 }); }
  // small leaf clumps on top: lit ones up-left, shadowed ones low-right
  const box = { x0: Math.min(...cs.map((c) => c[0] - c[2])), x1: Math.max(...cs.map((c) => c[0] + c[2])), y0: Math.min(...cs.map((c) => c[1] - c[3])), y1: Math.max(...cs.map((c) => c[1] + c[3])) };
  const src = p.clone();
  for (let i = 0; i < smallCount; i++) {
    const x = r.range(box.x0 + 2, box.x1 - 2), y = r.range(box.y0 + 2, box.y1 - 3);
    if (!src.op(x, y) || !src.op(x, y + 3) || !src.op(x - 2, y) || !src.op(x + 2, y)) continue;
    const t = ((x - box.x0) / (box.x1 - box.x0) + (y - box.y0) / (box.y1 - box.y0)) / 2; // 0 = top-left
    const bias = 0.22 - t * 0.55;
    const rr = r.range(2, 3);
    p.ellipse(x, y + 1, rr + 0.6, rr * 0.8 + 0.6, ramp[t > 0.55 ? 0 : 1]);
    p.ball(x, y, rr, rr * 0.8, ramp, { dither: 0.05, bias });
  }
}
function bigTree(ramp, ink, seed) {
  const W = 64, H = 84, p = new Pix(W, H);
  // trunk + asymmetric roots
  const tr = new Pix(W, H);
  for (let y = 50; y < 82; y++) {
    const x0 = 27 - (y > 74 ? Math.min(5, y - 74) : 0) + (y < 58 ? 1 : 0), x1 = 37 + (y > 77 ? Math.min(3, y - 77) : 0) - (y < 58 ? 1 : 0);
    for (let x = x0; x <= x1; x++) tr.put(x, y, x <= x0 + 1 ? P.wood_md : x >= x1 - 2 ? P.wood_ink : (x + y) % 5 === 0 ? P.wood_ink : P.wood_dk);
  }
  for (const [x, y0, y1] of [[31, 58, 66], [34, 64, 72], [30, 70, 76]]) tr.vline(x, y0, y1, P.wood_ink);
  tr.hline(19, 26, 81, P.wood_dk); tr.hline(20, 26, 80, P.wood_md); tr.put(19, 80, P.wood_md);
  tr.hline(38, 42, 81, P.wood_ink); tr.hline(38, 41, 80, P.wood_dk);
  // a visible branch fork
  tr.line(29, 54, 22, 46, P.wood_dk); tr.line(30, 54, 23, 46, P.wood_md); tr.line(35, 54, 43, 47, P.wood_ink); tr.line(36, 54, 44, 47, P.wood_dk);
  tr.outline(P.wood_ink);
  for (let x = 17; x <= 46; x++) if (tr.op(x, 82)) tr.put(x, 82, P.grass_dk);
  p.blit(tr, 0, 0);
  const crown = new Pix(W, H);
  leafy(crown, [[32, 28, 26, 21], [16, 30, 13, 13], [47, 30, 13, 13], [32, 13, 17, 10], [22, 44, 13, 8], [42, 44, 13, 8], [9, 38, 6, 6], [55, 38, 6, 6]], ramp, seed);
  // cut a couple of gaps so the trunk/branches show through at the bottom
  for (const [cx, cy, rx, ry] of [[26, 52, 3, 2.5], [39, 51, 3, 2]]) crown.ellipse(cx, cy, rx, ry, 0) ;
  for (let y = 48; y < 56; y++) for (let x = 24; x < 42; x++) if (((x - 32) / 7) ** 2 + ((y - 56) / 5) ** 2 < 1) crown.clear(x, y);
  roughen(crown, seed + 9, 2);
  crown.outline(ink);
  p.blit(crown, 0, 0);
  return p.canvas(32, 82);
}
function pineTree(seed) {
  const W = 32, H = 64, p = new Pix(W, H), r = rng(seed);
  const tr = new Pix(W, H);
  for (let y = 52; y < 63; y++) for (let x = 14; x <= 17; x++) tr.put(x, y, x === 14 ? P.wood_md : x === 17 ? P.wood_ink : P.wood_dk);
  tr.outline(P.wood_ink); p.blit(tr, 0, 0);
  const c = new Pix(W, H);
  const ramp = [P.grass_ink, P.grass_ink, P.grass_dk, P.grass_md, P.grass_lt];
  const tiers = [[3, 8, 4], [9, 18, 7], [16, 28, 10], [24, 39, 12.5], [33, 52, 15]]; // top y, bottom y, half width
  for (const [t0, t1, hw] of tiers) {
    for (let y = t0; y <= t1; y++) {
      const f = (y - t0) / (t1 - t0), w = Math.max(1, hw * (0.25 + 0.75 * f));
      for (let x = Math.round(16 - w); x <= Math.round(15 + w); x++) {
        const side = (x - 15.5) / w; // -1 left (lit) .. 1 right
        let idx = f > 0.85 ? 1 : side < -0.35 ? 4 : side < 0.15 ? 3 : side < 0.6 ? 2 : 1;
        if (hash(x, y) < 0.18) idx = Math.max(1, idx - 1);
        c.put(x, y, ramp[idx]);
      }
      // jagged needle hem
      if (y === t1) for (let x = Math.round(16 - hw); x <= Math.round(15 + hw); x += 2) c.put(x, y + 1, ramp[1]);
    }
  }
  void r;
  c.outline(P.grass_ink);
  p.blit(c, 0, 0);
  return p.canvas(16, 62);
  function hash(x, y) { return ((Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453) % 1 + 1) % 1; }
}
function lushBush() {
  const p = new Pix(16, 16);
  const ramp = [P.grass_ink, P.grass_dk, P.grass_md, P.grass_lt, P.grass_hi];
  leafy(p, [[8, 9.5, 7, 5.5], [5, 7.5, 4, 4], [11, 7.5, 4, 4]], ramp, 77, 0.5);
  for (let x = 0; x < 16; x++) p.clear(x, 15);
  p.outline(P.grass_ink);
  return p.canvas();
}
function leafyBush() {
  const p = new Pix(24, 20);
  const ramp = [P.grass_ink, P.grass_dk, P.grass_md, P.grass_lt, P.grass_hi];
  leafy(p, [[12, 12, 10, 6.5], [7, 9, 5.5, 5.5], [17, 9, 5.5, 5.5], [12, 7, 6, 4.5]], ramp, 91, 0.5);
  roughen(p, 92, 1);
  for (let x = 0; x < 24; x++) p.clear(x, 19);
  p.outline(P.grass_ink);
  return p.canvas(12, 18);
}

// ---------- house textures ----------
function texPlaster() {
  const W = 32, p = new Pix(W, W), r = rng(51);
  p.fill(P.dirt_hi);
  for (let i = 0; i < 40; i++) p.put(r.int(W), r.int(W), r.chance(0.6) ? P.sand : P.ui_frame);
  // timber frame: posts at x 0..2, rails at y 0..2 and y 16..17, brace in left panel
  const beam = (x, y, w, h) => { p.rect(x, y, w, h, P.wood_dk); };
  beam(0, 0, 3, W); beam(0, 0, W, 3); beam(0, 16, W, 2);
  for (let k = 0; k < 13; k++) { p.put(3 + k, 15 - k, P.wood_dk); p.put(4 + k, 15 - k, P.wood_dk); }
  // beam highlights (top-left) and grain
  p.vline(0, 0, W - 1, P.wood_md); p.hline(0, W - 1, 0, P.wood_md); p.hline(0, W - 1, 16, P.wood_md);
  p.hline(3, W - 1, 3, P.dirt_lt); p.hline(3, W - 1, 18, P.dirt_lt); p.vline(3, 3, W - 1, P.dirt_lt);
  for (const [x, y] of [[1, 8], [1, 24], [10, 1], [22, 17]]) p.put(x, y, P.wood_ink);
  return p.canvas(0, W - 1);
}
function texStone() {
  const W = 32, p = new Pix(W, W), r = rng(61);
  p.fill(P.rock_dk);
  let y = 0;
  const rows = [7, 8, 9, 8];
  rows.forEach((h, ri) => {
    let x = ri % 2 ? -r.range(3, 6) : 0;
    while (x < W) {
      const w = r.range(7, 11);
      const x0 = Math.max(0, x), x1 = Math.min(W, x + w) - 1;
      for (let yy = y; yy < y + h - 1; yy++) for (let xx = x0; xx < x1; xx++) {
        const top = yy === y, left = xx === x0 && x >= 0, right = xx === x1 - 1, bot = yy === y + h - 2;
        p.put(xx, yy, top ? P.rock_hi : left ? P.rock_lt : right || bot ? P.rock_md : (r() < 0.12 ? P.rock_md : P.rock_lt));
      }
      x += w;
    }
    // wrap the partial first stone of offset rows onto the right edge (seamless)
    y += h;
  });
  // horizontal tiling: copy column 0 joint behaviour by forcing a joint at x = 31
  for (let yy = 0; yy < W; yy++) if ((yy % 8) !== 0) p.put(W - 1, yy, P.rock_dk);
  return p.canvas(0, W - 1);
}
function texRoof() {
  // small warm-orange shingles: 4 px rows, staggered 3/5/6 px widths, shadowed lower lip
  const W = 32, p = new Pix(W, W), r = rng(71);
  for (let row = 0; row < 8; row++) {
    const y = row * 4;
    let x = row % 2 ? -3 : 0;
    while (x < W) {
      const w = r.pick([5, 6, 6, 7]);
      const body = r.chance(0.2) ? P.wood_md : r.chance(0.15) ? P.red_lt : P.wood_lt;
      for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < w; xx++) {
        const X = ((x + xx) % W + W) % W, Y = y + yy;
        let c = body;
        if (xx === w - 1) c = P.wood_dk;
        else if (yy === 3) c = P.wood_dk;
        else if (yy === 2) c = body === P.wood_lt ? P.wood_md : P.wood_dk;
        else if (yy === 0 && xx < w - 2) c = P.wood_hi;
        p.put(X, Y, c);
      }
      x += w;
    }
  }
  return p.canvas(0, W - 1);
}
function texRoofEdge() {
  const p = new Pix(32, 8);
  p.rect(0, 0, 32, 8, P.wood_dk);
  p.hline(0, 31, 0, P.wood_lt); p.hline(0, 31, 1, P.wood_md); p.hline(0, 31, 6, P.wood_ink); p.hline(0, 31, 7, P.wood_ink);
  for (let x = 4; x < 32; x += 8) { p.put(x, 3, P.metal_md); p.put(x, 4, P.metal_dk); }
  for (let x = 1; x < 32; x += 5) p.put(x, 2, P.wood_md);
  return p.canvas(0, 7);
}
function texDoor() {
  const p = new Pix(16, 24);
  p.fill(P.wood_ink);
  p.rect(1, 1, 14, 23, P.wood_md);
  for (const x of [4, 8, 12]) p.vline(x, 1, 23, P.wood_dk);
  p.vline(1, 1, 23, P.wood_lt); p.hline(1, 14, 1, P.wood_lt);
  for (const y of [5, 18]) { p.hline(1, 14, y, P.metal_dk); p.hline(1, 14, y - 1, P.metal_md); }
  p.rect(11, 12, 2, 2, P.gold_md); p.put(11, 12, P.gold_lt);
  p.hline(0, 15, 0, P.wood_ink);
  return p.canvas(8, 23);
}
function texWindow() {
  const p = new Pix(12, 12);
  p.fill(P.wood_dk);
  p.rect(1, 1, 10, 10, P.wood_ink);
  p.rect(2, 2, 8, 8, P.fx_yellow);
  p.rect(2, 2, 3, 3, P.gold_lt); p.rect(7, 2, 3, 3, P.gold_lt);
  p.rect(2, 7, 8, 3, P.gold_md);
  p.vline(5, 2, 9, P.wood_dk); p.vline(6, 2, 9, P.wood_dk); p.hline(2, 9, 5, P.wood_dk); p.hline(2, 9, 6, P.wood_dk);
  p.hline(0, 11, 0, P.wood_md); p.hline(0, 11, 11, P.wood_ink);
  return p.canvas(6, 11);
}
function texWood() {
  const p = new Pix(16, 16), r = rng(81);
  p.fill(P.wood_md);
  for (let k = 0; k < 4; k++) {
    const x = k * 4;
    p.vline(x, 0, 15, P.wood_dk); p.vline(x + 1, 0, 15, P.wood_lt);
    for (let i = 0; i < 3; i++) { const y = r.int(15); p.vline(x + 2 + r.int(2), y, y + 1, P.wood_dk); }
  }
  return p.canvas(8, 15);
}

export function buildDeco() {
  const S = {};
  S.deco_grass_1 = [decoGrass(1, 20, 26, 15, GR)];
  S.deco_grass_2 = [decoGrass(2, 16, 20, 11, GR)];
  S.deco_grass_3 = [decoGrass(3, 24, 32, 19, GR)];
  S.deco_grass_4 = [decoGrass(4, 18, 23, 13, GR)];
  S.deco_grass_dark_1 = [decoGrass(5, 18, 22, 13, GR_DARK)];
  S.deco_grass_dark_2 = [decoGrass(6, 16, 18, 11, GR_DARK)];
  S.deco_bush_leafy = [leafyBush()];
  S.deco_flower_white = [decoFlower(1, P.white, P.gold_md)];
  S.deco_flower_yellow = [decoFlower(2, P.fx_yellow, P.fx_orange)];
  S.deco_flower_pink = [decoFlower(3, P.heart_hi, P.red_md)];
  S.deco_flower_purple = [decoFlower(4, P.purple_lt, P.purple_md)];
  S.deco_fern_1 = [decoFern(1, 16, 12)];
  S.deco_fern_2 = [decoFern(2, 14, 10)];
  S.deco_reed_1 = [decoReed(1, 12, 24)];
  S.deco_reed_2 = [decoReed(2, 12, 20)];
  S.deco_pebble_1 = [decoPebble(1, 8, 4)];
  S.deco_pebble_2 = [decoPebble(2, 10, 5)];
  S.tree = [bigTree([P.grass_ink, P.grass_dk, P.grass_md, P.grass_lt, P.grass_hi], P.grass_ink, 3)];
  S.tree_autumn = [bigTree([P.wood_dk, P.gold_dk, P.gold_md, P.fx_yellow, P.gold_lt], P.wood_ink, 4)];
  S.tree_pine = [pineTree(5)];
  S.bush = [lushBush()];
  S.tex_wall_plaster = [texPlaster()];
  S.tex_wall_stone = [texStone()];
  S.tex_roof = [texRoof()];
  S.tex_roof_edge = [texRoofEdge()];
  S.tex_door = [texDoor()];
  S.tex_window = [texWindow()];
  S.tex_wood = [texWood()];
  return S;
}
