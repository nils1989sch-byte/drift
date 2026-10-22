// Ground tiles, transition edges, cliff faces and diorama plinths. All 16×16, opaque (tiles) / 0-or-1 alpha (edges).
import { Pix, rng, frames } from './core.js';
import { palette as P } from './palette.js';

const T = (fn) => { const p = new Pix(16, 16); fn(p); return p; };
const cv = (p) => p.canvas();

// small grass tuft "V" with lit tip on the left
function tuft(p, x, y, dk, lt, big) {
  p.set(x, y, dk); p.set(x + 1, y + 1, dk); p.set(x + 2, y, dk);
  if (big) { p.set(x + 1, y + 2, dk); p.set(x - 1, y - 1, lt); p.set(x + 3, y - 1, dk); }
  else if (lt) p.set(x, y - 1, lt);
}
// scatter non-overlapping positions inside a margin
function scatter(r, n, minD = 4, m = 1, W = 16, H = 16) {
  const pts = [];
  for (let tries = 0; pts.length < n && tries < 200; tries++) {
    const x = r.range(m, W - 1 - m - 2), y = r.range(m + 1, H - 1 - m - 2);
    if (pts.every(([a, b]) => Math.abs(a - x) + Math.abs(b - y) >= minD)) pts.push([x, y]);
  }
  return pts;
}

// ---------------------------------------------------------------- tiles
function grassTile(seed, base, dk, lt, n, opts = {}) {
  const r = rng(seed);
  return T((p) => {
    p.fill(base);
    for (const [x, y] of scatter(r, n, 5)) {
      const big = r.chance(opts.big ?? 0.3);
      tuft(p, x, y, dk, r.chance(opts.lit ?? 0.5) ? lt : null, big && x > 1 && x < 12 && y > 2);
    }
    if (opts.speck) for (let i = 0; i < opts.speck; i++) p.set(r.range(1, 14), r.range(1, 14), lt);
  });
}

function speckTile(seed, base, cols, n, pebbles, pebLt, pebDk) {
  const r = rng(seed);
  return T((p) => {
    p.fill(base);
    for (let i = 0; i < n; i++) p.set(r.int(16), r.int(16), r.pick(cols));
    for (const [x, y] of scatter(r, pebbles, 5, 1)) {
      const w = r.chance(0.5) ? 2 : 1;
      p.rect(x, y, w, 1, pebLt); if (w === 2 && r.chance(0.5)) p.set(x, y + 1, pebLt);
      p.set(x + w, y + 1, pebDk); p.set(x + w - 1, y + 1 + (w === 2 ? 1 : 0), pebDk);
    }
  });
}

function waterFrames() {
  // horizontal glints that drift right and pulse in length
  const strokes = [[2, 3, 4], [9, 6, 3], [4, 10, 5], [11, 13, 3], [0, 14, 2]];
  const out = [];
  for (let f = 0; f < 4; f++) out.push(T((p) => {
    p.fill(P.water_dk);
    strokes.forEach(([x, y, len], i) => {
      const L = Math.max(2, len + [0, 1, 0, -1][(f + i) % 4]);
      const x0 = (x + f + (i & 1)) % 14;
      for (let k = 0; k < L && x0 + k < 16; k++) p.set(x0 + k, y, k === 1 && L > 3 ? P.water_lt : P.water_md);
      if ((f + i) % 2 === 0) p.set(x0 + 1, y - 1, P.water_md);
    });
    // dark ripple troughs
    p.set((5 + f * 3) % 16, 8, P.water_ink); p.set((6 + f * 3) % 16, 8, P.water_ink);
    p.set((13 + f * 3) % 16, 1, P.water_ink);
  }));
  return out;
}

function shoreFrames() {
  const w = waterFrames();
  return w.map((wp, f) => {
    const p = wp.clone();
    p.rect(0, 0, 16, 3, P.water_ink);
    for (let x = 0; x < 16; x++) {
      const wave = (x + f * 2) % 8;
      p.set(x, 3, wave < 5 ? P.foam : P.water_lt);
      if (wave === 1 || wave === 2) p.set(x, 2, P.foam);
      p.set(x, 4, wave >= 3 && wave < 6 ? P.water_lt : P.water_md);
    }
    return p;
  });
}

function shallowFrames() {
  const r = rng(77);
  const sandPts = [];
  for (let i = 0; i < 18; i++) sandPts.push([r.int(16), r.int(16)]);
  const rings = [[5, 5], [12, 11]];
  const out = [];
  for (let f = 0; f < 3; f++) out.push(T((p) => {
    p.fill(P.water_lt);
    for (const [x, y] of sandPts) p.set(x, y, P.sand);
    for (let x = 0; x < 16; x += 1) if ((x + y0(x)) % 7 === 0) p.set(x, 15 - (x % 3), P.water_md);
    rings.forEach(([cx, cy], i) => {
      const rr = 1 + ((f + i) % 3);
      for (let x = -rr; x <= rr; x++) { p.set(cx + x, cy - (rr > 1 ? 1 : 0), Math.abs(x) === rr ? P.water_hi : P.foam); }
      if (rr > 1) { p.set(cx - rr - 1, cy, P.water_hi); p.set(cx + rr + 1, cy, P.water_hi); p.hline(cx - rr + 1, cx + rr - 1, cy + 1, P.water_md); }
    });
  }));
  function y0(x) { return x * 3; }
  return out;
}

function stairsTile() {
  return T((p) => {
    for (let k = 0; k < 4; k++) {
      const y = k * 4;
      p.hline(0, 15, y, P.rock_hi);
      p.hline(0, 15, y + 1, P.rock_lt);
      p.hline(0, 15, y + 2, P.rock_md);
      p.hline(0, 15, y + 3, P.rock_ink);
      p.set(4 + k * 3, y + 2, P.rock_dk); p.set(11 - k, y + 2, P.rock_dk);
    }
    for (let y = 0; y < 16; y++) { p.set(0, y, P.rock_dk); p.set(1, y, y % 4 === 3 ? P.rock_ink : P.rock_dk); p.set(14, y, P.rock_dk); p.set(15, y, P.rock_ink); }
    for (let y = 0; y < 16; y += 4) p.set(1, y, P.rock_md);
  });
}

function bridgeTile() {
  return T((p) => {
    for (let k = 0; k < 4; k++) {
      const y = k * 4;
      p.hline(0, 15, y, P.wood_lt);
      p.hline(0, 15, y + 1, P.wood_md); p.hline(0, 15, y + 2, P.wood_md);
      p.hline(0, 15, y + 3, P.wood_ink);
      p.set(2, y + 1, P.metal_md); p.set(13, y + 1, P.metal_md);
      const gx = [5, 9, 7, 10][k]; p.hline(gx, gx + 2, y + 2, P.wood_dk);
      if (k === 1 || k === 3) p.set(1 + k * 2, y, P.wood_hi);
    }
    for (let y = 0; y < 16; y++) { p.set(0, y, P.wood_dk); p.set(15, y, P.wood_dk); }
  });
}

function slabTile(seed, body, hi, edge, joint, specks, crack) {
  const r = rng(seed);
  return T((p) => {
    p.fill(body);
    for (let sy = 0; sy < 16; sy += 8) for (let sx = 0; sx < 16; sx += 8) {
      p.hline(sx, sx + 6, sy, hi);
      p.vline(sx + 6, sy + 1, sy + 6, edge);
      p.hline(sx, sx + 7, sy + 7, joint); p.vline(sx + 7, sy, sy + 7, joint);
      for (let i = 0; i < specks; i++) p.set(sx + r.range(1, 5), sy + r.range(1, 5), edge);
    }
    if (crack) { const x = r.range(2, 4), y = r.range(2, 3); p.set(x, y, joint); p.set(x + 1, y + 1, joint); p.set(x + 1, y + 2, joint); p.set(x + 2, y + 3, joint); }
  });
}

function dungeonWallTile() {
  return T((p) => {
    p.fill(P.stone_md);
    for (let row = 0; row < 4; row++) {
      const y = row * 4, off = row % 2 ? 4 : 0;
      p.hline(0, 15, y, P.stone_lt);
      p.hline(0, 15, y + 3, P.stone_dk);
      for (let x = off; x < 16; x += 8) { p.vline(x, y, y + 3, P.stone_dk); }
    }
    for (let i = 0; i < 16; i++) { p.set(i, 0, P.stone_ink); p.set(i, 15, P.stone_ink); p.set(0, i, P.stone_ink); p.set(15, i, P.stone_ink); }
    for (let i = 1; i < 15; i++) { p.set(i, 1, P.stone_hi); }
  });
}

function pitTile() {
  return T((p) => {
    p.fill(P.ink);
    p.rect(0, 0, 16, 2, P.stone_md);
    p.hline(0, 15, 2, P.stone_dk);
    p.hline(0, 15, 3, P.stone_ink);
    p.hline(0, 15, 4, P.night);
    for (let x = 0; x < 16; x += 2) p.set(x + 1, 5, P.night);
    for (let y = 0; y < 16; y++) { p.set(0, y, y > 3 ? P.stone_ink : p.get(0, y)); }
  });
}

function woodFloorTile() {
  const r = rng(31);
  return T((p) => {
    p.fill(P.wood_md);
    for (let k = 0; k < 4; k++) {
      const x = k * 4;
      p.vline(x, 0, 15, P.wood_dk);
      const j = [5, 12, 2, 9][k]; p.hline(x, x + 3, j, P.wood_dk);
      for (let i = 0; i < 3; i++) { const yy = r.int(16); if (yy !== j) p.vline(x + 1 + r.int(3), yy, Math.min(15, yy + 1), P.wood_lt); }
    }
  });
}

export function buildTiles() {
  const tiles = {};
  tiles.grass = frames([
    grassTile(11, P.grass_md, P.grass_dk, P.grass_lt, 7),
    grassTile(12, P.grass_md, P.grass_dk, P.grass_lt, 9),
    grassTile(13, P.grass_md, P.grass_dk, P.grass_lt, 6, { speck: 2 }),
    grassTile(14, P.grass_md, P.grass_dk, P.grass_lt, 8, { big: 0.6 }),
    grassTile(15, P.grass_md, P.grass_dk, P.grass_lt, 5),
  ].map(cv), { mode: 'variant' });
  tiles.grass_dark = frames([
    grassTile(21, P.grass_dk, P.grass_ink, P.grass_md, 7, { lit: 0.15 }),
    grassTile(22, P.grass_dk, P.grass_ink, P.grass_md, 9, { lit: 0.1 }),
    grassTile(23, P.grass_dk, P.grass_ink, P.grass_md, 6, { lit: 0.2 }),
  ].map(cv), { mode: 'variant' });

  // flowers: 2 frames gentle sway, phase per cell
  {
    const base = grassTile(31, P.grass_md, P.grass_dk, P.grass_lt, 4);
    const fl = [[4, 4, P.white], [11, 7, P.fx_yellow], [6, 12, P.heart_hi]];
    tiles.grass_flowers = frames([0, 1].map((f) => {
      const p = base.clone();
      for (const [x, y, c] of fl) {
        const dx = f && (x & 1) ? 1 : f ? -0 : 0, ox = x + (f ? (x % 3 === 1 ? 1 : 0) : 0);
        p.set(x, y + 2, P.grass_dk); p.set(x, y + 3, P.grass_dk); // stem
        p.set(ox, y - 1, c); p.set(ox - 1, y, c); p.set(ox + 1, y, c); p.set(ox, y + 1, c);
        p.set(ox, y, P.gold_md); p.set(ox + 1, y + 1, P.grass_dk);
        void dx;
      }
      return cv(p);
    }), { fps: 2, phase: true });
  }

  // tall grass: dense blade clumps, 2 sway frames
  tiles.grass_tall = frames([0, 1].map((f) => {
    const p = new Pix(16, 16); p.fill(P.grass_dk);
    for (let row = 0; row < 2; row++) for (let c = 0; c < 4; c++) {
      const bx = c * 4 + (row ? 2 : 0), by = row * 8 + 7;
      // clump: blades fan out
      for (const [dx, h] of [[0, 4], [1, 6], [2, 5], [3, 3]]) {
        const x = (bx + dx) % 16, sway = f && h > 4 ? 1 : 0;
        for (let k = 0; k < h; k++) {
          const yy = by - k, xx = (x + (k > 3 ? sway : 0)) % 16;
          p.set(xx, yy, k === 0 ? P.grass_ink : k >= h - 1 ? P.grass_lt : k >= h - 3 ? P.grass_md : P.grass_dk);
        }
      }
      p.set(bx % 16, by + 1, P.grass_ink); p.set((bx + 1) % 16, by + 1, P.grass_ink); p.set((bx + 2) % 16, by + 1, P.grass_ink);
    }
    return cv(p);
  }), { fps: 2, phase: true });

  tiles.dirt = frames([
    speckTile(41, P.dirt_md, [P.dirt_dk], 10, 3, P.dirt_lt, P.dirt_dk),
    speckTile(42, P.dirt_md, [P.dirt_dk], 8, 2, P.dirt_lt, P.dirt_dk),
    speckTile(43, P.dirt_md, [P.dirt_dk, P.dirt_lt], 9, 3, P.dirt_lt, P.dirt_dk),
  ].map(cv), { mode: 'variant' });
  tiles.path = frames([
    speckTile(51, P.dirt_lt, [P.dirt_md, P.dirt_hi], 8, 2, P.dirt_hi, P.dirt_md),
    speckTile(52, P.dirt_lt, [P.dirt_md], 6, 1, P.dirt_hi, P.dirt_md),
    speckTile(53, P.dirt_lt, [P.dirt_hi, P.dirt_md], 9, 2, P.dirt_hi, P.dirt_md),
  ].map(cv), { mode: 'variant' });
  tiles.sand = frames([
    speckTile(61, P.sand, [P.dirt_lt, P.dirt_lt, P.dirt_hi], 14, 0),
    speckTile(62, P.sand, [P.dirt_lt, P.dirt_hi], 11, 1, P.dirt_hi, P.dirt_lt),
  ].map(cv), { mode: 'variant' });

  tiles.water = frames(waterFrames().map(cv), { fps: 4, phase: true });
  tiles.water_edge_n = frames(shoreFrames().map(cv), { fps: 4 });
  tiles.shallow = frames(shallowFrames().map(cv), { fps: 3, phase: true });
  tiles.stairs = [cv(stairsTile())];
  tiles.bridge = [cv(bridgeTile())];
  tiles.stone_floor = frames([
    slabTile(71, P.stone_lt, P.stone_hi, P.stone_md, P.stone_dk, 1, false),
    slabTile(72, P.stone_lt, P.stone_hi, P.stone_md, P.stone_dk, 1, true),
  ].map(cv), { mode: 'variant' });
  tiles.dungeon_floor = frames([
    slabTile(81, P.stone_dk, P.stone_md, P.stone_ink, P.stone_ink, 0, false),
    slabTile(82, P.stone_dk, P.stone_md, P.stone_ink, P.stone_ink, 1, true),
    slabTile(83, P.stone_dk, P.stone_md, P.stone_ink, P.stone_ink, 2, false),
  ].map(cv), { mode: 'variant' });
  tiles.dungeon_wall = [cv(dungeonWallTile())];
  tiles.pit = [cv(pitTile())];
  tiles.wood_floor = [cv(woodFloorTile())];
  tiles.void = [cv(T((p) => p.fill(P.night)))];
  return tiles;
}

// ---------------------------------------------------------------- edges
// side = side of THIS cell where the higher-priority neighbour lies; overlay grows in from that side.
function profile(seed, base, amp, teeth) {
  const r = rng(seed), d = [];
  for (let u = 0; u < 16; u++) d.push(base + (r() < 0.5 ? 0 : 1));
  for (let u = 0; u < 16; u++) if (u % 4 === 1 + (seed & 1) && teeth) { d[u] += amp; if (u + 1 < 16 && r() < 0.6) d[u + 1] += amp - 1; }
  d[0] = d[15] = base; // ends match neighbours' edges
  return d;
}
function edgeSet(spec) {
  const out = {};
  for (const side of ['n', 's', 'w', 'e']) {
    const prof = profile(spec.seed + side.charCodeAt(0), spec.base, spec.amp, spec.teeth);
    const p = new Pix(16, 16);
    const lightSide = side === 's' || side === 'e';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const [u, t] = side === 'n' ? [x, y] : side === 's' ? [x, 15 - y] : side === 'w' ? [y, x] : [y, 15 - x];
      const d = prof[u];
      if (t >= d) continue;
      let c = spec.fill;
      if (t === d - 1) c = lightSide ? spec.rimLt : spec.rimDk;
      else if (spec.tex) c = spec.tex(u, t, d) || c;
      p.put(x, y, c);
    }
    out[`${spec.group}_${side}`] = p.canvas();
  }
  return out;
}

export function buildEdges() {
  const edges = Object.assign({},
    edgeSet({ group: 'grass', seed: 100, base: 3, amp: 2, teeth: true, fill: P.grass_md, rimDk: P.grass_dk, rimLt: P.grass_lt,
      tex: (u, t, d) => (t === d - 2 && u % 5 === 2 ? P.grass_dk : (t === 0 && u % 7 === 3 ? P.grass_lt : null)) }),
    edgeSet({ group: 'path', seed: 200, base: 2, amp: 1, teeth: true, fill: P.dirt_lt, rimDk: P.dirt_md, rimLt: P.dirt_hi,
      tex: (u, t) => (u % 6 === 4 && t === 0 ? P.dirt_hi : null) }),
    edgeSet({ group: 'dirt', seed: 300, base: 2, amp: 1, teeth: true, fill: P.dirt_md, rimDk: P.dirt_dk, rimLt: P.dirt_lt }),
    edgeSet({ group: 'sand', seed: 400, base: 2, amp: 2, teeth: true, fill: P.sand, rimDk: P.dirt_lt, rimLt: P.dirt_hi }),
    edgeSet({ group: 'shallow', seed: 500, base: 2, amp: 1, teeth: true, fill: P.water_lt, rimDk: P.water_hi, rimLt: P.foam }),
    edgeSet({ group: 'water', seed: 600, base: 1, amp: 1, teeth: true, fill: P.water_md, rimDk: P.water_md, rimLt: P.water_lt }),
    edgeSet({ group: 'stone_floor', seed: 700, base: 2, amp: 0, teeth: false, fill: P.stone_lt, rimDk: P.stone_dk, rimLt: P.stone_hi }),
  );
  const edgeGroup = { grass: 'grass', grass_dark: 'grass', grass_flowers: 'grass', grass_tall: 'grass', water_edge_n: 'water', water: 'water' };
  const edgePriority = {
    grass: 7, stone_floor: 6, sand: 5, path: 4, dirt: 3, shallow: 2, water: 1,
    // structural tiles never receive or give soft edges
    bridge: 99, stairs: 99, dungeon_floor: 99, dungeon_wall: 99, wood_floor: 99, void: 99,
  };
  return { edges, edgeGroup, edgePriority };
}

// ---------------------------------------------------------------- faces
function grassLip(p, seed) {
  const r = rng(seed);
  p.rect(0, 0, 16, 2, P.grass_md);
  for (let x = 0; x < 16; x++) {
    const tooth = (x % 4 === 1) ? 2 : (x % 4 === 2 && r() < 0.6) ? 1 : 0;
    for (let k = 0; k < tooth; k++) p.set(x, 2 + k, P.grass_md);
    p.set(x, 2 + tooth, P.grass_ink);
    if (x % 4 === 1) p.set(x, 1, P.grass_dk);
  }
}
// rock cliff with vertical ribs (rounded columns, lit left, staggered segment ends, wraps vertically)
const RIBS = [[0, 4, [5, 13]], [6, 3, [10]], [11, 3, [2, 8]]]; // x, width, break rows
function rockFace(kind) {
  const p = new Pix(16, 16);
  p.fill(P.rock_dk);
  const shift = [0, 7, 3][kind];
  for (const [x0, w, brk] of RIBS) {
    for (let y = 0; y < 16; y++) {
      const yy = (y + shift) % 16;
      for (let i = 0; i < w; i++) p.put(x0 + i, y, i === 0 ? P.rock_lt : i === 1 && w > 3 && (yy & 7) < 3 ? P.rock_lt : P.rock_md);
      p.put(x0 + w, y, P.rock_dk);
      if (x0 + w + 1 < 16) p.put(x0 + w + 1, y, (yy % 7) === 3 ? P.rock_dk : P.rock_ink);
      for (const b of brk) {
        if (yy === b) for (let i = 0; i <= w; i++) p.put(x0 + i, y, P.rock_ink);
        if (yy === (b + 1) % 16) { for (let i = 0; i < w; i++) p.put(x0 + i, y, i === 0 ? P.rock_hi : P.rock_lt); }
        if (yy === (b + 15) % 16) { for (let i = 1; i < w; i++) p.put(x0 + i, y, P.rock_dk); }
      }
    }
  }
  p.vline(15, 0, 15, P.rock_ink);
  if (kind === 0) {
    grassLip(p, 5);
    for (const [x0, w] of RIBS) { p.put(x0, 4, P.rock_hi); if (w > 1) p.put(x0 + 1, 4, P.rock_lt); }
  }
  if (kind === 2) {
    const chunks = [[1, 11, 3], [7, 12, 4], [12, 11, 3]];
    for (const [cx, cy, w] of chunks) {
      p.rect(cx, cy, w, 2, P.rock_md); p.hline(cx, cx + w - 1, cy - 1, P.rock_lt); p.set(cx, cy - 1, P.rock_hi);
      p.vline(cx + w, cy - 1, cy + 1, P.rock_dk); p.hline(cx - 1, cx + w, cy + 2, P.rock_ink);
    }
    p.rect(0, 14, 16, 2, P.rock_ink);
  }
  return p.canvas();
}

function dirtFace(kind) {
  const r = rng(900 + kind);
  const p = new Pix(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const band = Math.floor((y + (Math.sin((x / 16) * Math.PI * 2 + kind) > 0.4 ? 1 : 0)) / 4) % 2;
    p.put(x, y, band ? P.dirt_dk : P.dirt_md);
  }
  for (let i = 0; i < 4; i++) { const x = r.range(1, 13), y = r.range(kind === 0 ? 5 : 1, 12); p.rect(x, y, 2, 2, P.rock_md); p.set(x, y, P.rock_lt); p.set(x + 2, y + 1, P.dirt_dk); p.set(x + 1, y + 2, P.dirt_dk); }
  for (const rx of kind === 2 ? [] : [4, 12]) { let x = rx; for (let y = 0; y < 12; y++) { p.set(x, y, P.wood_dk); if (r() < 0.35) x += r() < 0.5 ? -1 : 1; } }
  if (kind === 0) grassLip(p, 7);
  if (kind === 2) { p.rect(0, 13, 16, 3, P.dirt_ink); for (let x = 0; x < 16; x += 3) p.set(x, 12, P.dirt_ink); }
  return p.canvas();
}

function brickFace(kind) {
  const p = new Pix(16, 16);
  p.fill(P.stone_md);
  for (let row = 0; row < 4; row++) {
    const y = row * 4, off = row % 2 ? 4 : 0;
    p.hline(0, 15, y, P.stone_ink);
    p.hline(0, 15, y + 1, P.stone_lt);
    p.hline(0, 15, y + 3, P.stone_dk);
    for (let x = off; x < 16; x += 8) { p.vline(x, y, y + 3, P.stone_ink); p.vline((x + 7) % 16, y + 1, y + 3, P.stone_dk); }
  }
  if (kind === 0) { p.rect(0, 0, 16, 3, P.stone_lt); p.hline(0, 15, 0, P.stone_hi); p.hline(0, 15, 3, P.stone_ink); }
  if (kind === 2) { p.rect(0, 14, 16, 2, P.stone_ink); }
  return p.canvas();
}

function plinthEarth() {
  const W = 64, H = 28, p = new Pix(W, H), r = rng(1234);
  const wave = (x, a, ph) => Math.round(Math.sin((x / W) * Math.PI * 2 * a + ph) * 1.2);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    let c = P.dirt_md;
    if (y > 7 + wave(x, 2, 1)) c = P.dirt_dk;
    if (y > 17 + wave(x, 1, 3)) c = P.dirt_ink;
    p.put(x, y, c);
  }
  p.hline(0, W - 1, 0, P.dirt_lt); p.hline(0, W - 1, 1, P.dirt_lt);
  for (let x = 0; x < W; x += 3) p.set(x + (x % 2), 2, P.dirt_lt);
  // roots
  for (const rx of [5, 23, 41, 57]) { let x = rx; for (let y = 2; y < 12; y++) { p.set((x + W) % W, y, P.wood_dk); if (r() < 0.4) x += r() < 0.5 ? -1 : 1; } }
  // stones
  for (let i = 0; i < 13; i++) {
    const x = r.int(W - 4), y = r.range(9, 24), w = r.range(1, 4), h = w > 2 ? 2 : 1;
    p.rect(x, y, w, h, P.rock_md); p.set(x, y, P.rock_lt);
    p.hline(x, x + w, y + h, P.dirt_ink); p.vline(x + w, y, y + h - 1, P.rock_dk);
  }
  for (let i = 0; i < 26; i++) p.set(r.int(W), r.range(3, 7), P.dirt_dk);
  for (let i = 0; i < 20; i++) p.set(r.int(W), r.range(20, 27), P.dirt_dk);
  return p.canvas();
}
function plinthStone() {
  const W = 32, H = 28, p = new Pix(W, H);
  p.fill(P.stone_dk);
  for (let row = 0; row * 7 < H; row++) {
    const y = row * 7, off = row % 2 ? 8 : 0;
    p.hline(0, W - 1, y, P.stone_ink);
    p.hline(0, W - 1, y + 1, P.stone_md);
    for (let x = off; x < W + 16; x += 16) { p.vline(x % W, y, y + 6, P.stone_ink); p.vline((x + 1) % W, y + 1, y + 5, P.stone_md); }
  }
  p.hline(0, W - 1, 0, P.stone_lt);
  for (let y = 21; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 2 === 0 && p.get(x, y) !== 0) p.put(x, y, y > 24 ? P.stone_ink : p.get(x, y));
  return p.canvas();
}

export function buildFaces() {
  return {
    rock: [rockFace(0), rockFace(1), rockFace(2)],
    dirt: [dirtFace(0), dirtFace(1), dirtFace(2)],
    brick: [brickFace(0), brickFace(1), brickFace(2)],
    plinth_earth: [plinthEarth()],
    plinth_stone: [plinthStone()],
  };
}
