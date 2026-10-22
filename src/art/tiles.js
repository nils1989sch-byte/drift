// Ground tiles, transition edges, cliff faces and diorama plinths. All 16×16, opaque (tiles) / 0-or-1 alpha (edges).
import { Pix, rng, frames } from './core.js';
import { palette as P } from './palette.js';
import { grassTiles, grassFlowers, grassTallFrames, shallowFrames as shallowV2, stairsTile as stairsV2 } from './terrain.js';
export { buildEdges, buildFaces } from './terrain.js';

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
  Object.assign(tiles, grassTiles());
  tiles.grass_flowers = grassFlowers();
  tiles.grass_tall = grassTallFrames();
  tiles.dirt = frames([
    speckTile(41, P.dirt_md, [P.dirt_dk, P.dirt_dk, P.dirt_lt], 34, 3, P.dirt_lt, P.dirt_dk),
    speckTile(42, P.dirt_md, [P.dirt_dk, P.dirt_lt], 30, 2, P.dirt_lt, P.dirt_dk),
    speckTile(43, P.dirt_md, [P.dirt_dk, P.dirt_dk, P.dirt_lt], 32, 3, P.dirt_lt, P.dirt_dk),
  ].map(cv), { mode: 'variant' });
  tiles.path = frames([
    speckTile(51, P.dirt_lt, [P.dirt_md, P.dirt_hi, P.sand], 22, 4, P.rock_lt, P.dirt_md),
    speckTile(52, P.dirt_lt, [P.dirt_md, P.sand], 18, 3, P.rock_hi, P.dirt_md),
    speckTile(53, P.dirt_lt, [P.dirt_hi, P.dirt_md, P.sand], 24, 4, P.rock_lt, P.dirt_md),
  ].map(cv), { mode: 'variant' });
  tiles.sand = frames([
    speckTile(61, P.sand, [P.dirt_lt, P.dirt_lt, P.dirt_hi], 14, 0),
    speckTile(62, P.sand, [P.dirt_lt, P.dirt_hi], 11, 1, P.dirt_hi, P.dirt_lt),
  ].map(cv), { mode: 'variant' });

  tiles.water = frames(waterFrames().map(cv), { fps: 4, phase: true });
  tiles.water_edge_n = frames(shoreFrames().map(cv), { fps: 4 });
  tiles.shallow = shallowV2();
  tiles.stairs = [stairsV2()];
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

