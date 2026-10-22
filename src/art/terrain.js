// Terrain v2 (after REVIEW_1): calm grass, irregular edges, ALttP-style chunky cliff faces (LEVEL 24 → 16×12 pieces),
// end pieces, stairs, shallow water, earth plinth.
import { Pix, rng, frames, hash2, c32 } from './core.js';
import { palette as P } from './palette.js';

const T = (fn, w = 16, h = 16) => { const p = new Pix(w, h); fn(p); return p; };
const cv = (p) => p.canvas();

function scatter(r, n, minD, box = [1, 1, 13, 13]) {
  const pts = [];
  for (let tries = 0; pts.length < n && tries < 300; tries++) {
    const x = r.range(box[0], box[2]), y = r.range(box[1], box[3]);
    if (pts.every(([a, b]) => Math.hypot(a - x, b - y) >= minD)) pts.push([x, y]);
  }
  return pts;
}

// ---------------------------------------------------------------- grass
// ALttP grass: calm mid-tone field, a few small 2–3-tone tufts in a loose irregular pattern.
const TUFTS = [
  [[0, 0, 'd'], [2, 0, 'd'], [1, 1, 'd']],                  // v
  [[0, 0, 'd'], [1, 1, 'd'], [3, 0, 'd'], [2, 1, 'd']],     // w (double)
  [[1, 0, 'd'], [0, 1, 'd']],                               // tick
  [[0, 0, 'd'], [2, 0, 'd'], [1, 1, 'd'], [0, -1, 'l']],    // v with lit tip
];
function tuftAt(p, x, y, kind, dk, lt) { for (const [dx, dy, c] of TUFTS[kind]) p.set(x + dx, y + dy, c === 'd' ? dk : lt); }

// Octopath-like saturated yellow-green: field = grass_lt, tufts grass_md, glints grass_hi
export const G = { base: P.grass_lt, tuft: P.grass_md, glint: P.grass_hi, shade: P.grass_dk, ink: P.grass_ink };
function grassVariant(seed, n, base = G.base, dk = P.grass_dk, lt = G.glint, mix = null) {
  const r = rng(seed);
  return T((p) => {
    p.fill(base);
    // fine blade grain (texture detail for the lit 3D ground): short vertical strokes in 2 tones
    for (let i = 0; i < 26; i++) { const x = r.int(16), y = r.int(16); p.put(x, y, mix ? dk : P.grass_md); if (r() < 0.5) p.put(x, (y + 1) & 15, mix ? dk : P.grass_md); }
    for (let i = 0; i < 7; i++) { const x = r.int(16), y = r.int(16); p.put(x, y, lt); }
    for (const [x, y] of scatter(r, n, 6, [1, 2, 12, 13])) {
      const k = r.chance(0.22) ? 3 : r.chance(0.3) ? 1 : r.chance(0.3) ? 2 : 0;
      tuftAt(p, x, y, k, mix && r.chance(0.3) ? mix : dk, lt);
    }
  });
}
export function grassTiles() {
  const g = [[11, 2], [12, 1], [13, 3], [14, 2], [15, 0], [16, 2], [17, 1], [18, 3]].map(([s, n]) => cv(grassVariant(s, n)));
  const d = [[21, 3], [22, 2], [23, 4], [24, 3]].map(([s, n]) => {
    const p = grassVariant(s, n, P.grass_md, P.grass_dk, P.grass_lt, P.grass_lt);
    const r = rng(s * 7); for (let i = 0; i < 2; i++) p.set(r.range(1, 14), r.range(1, 14), P.grass_lt);
    return cv(p);
  });
  return { grass: frames(g, { mode: 'variant' }), grass_dark: frames(d, { mode: 'variant' }) };
}
export function grassFlowers() {
  const base = grassVariant(31, 1);
  const fl = [[4, 4, P.white], [11, 7, P.fx_yellow], [6, 12, P.heart_hi]];
  return frames([0, 1].map((f) => {
    const p = base.clone();
    for (const [x, y, c] of fl) {
      const ox = x + (f && x % 3 === 1 ? 1 : 0), oy = y + (f && x % 3 !== 1 ? 1 : 0) * 0;
      p.set(x, y + 2, P.grass_md); p.set(x, y + 3, P.grass_md);
      p.set(ox, oy - 1, c); p.set(ox - 1, oy, c); p.set(ox + 1, oy, c); p.set(ox, oy + 1, c);
      p.set(ox, oy, P.gold_md); p.set(ox + 1, oy + 1, P.grass_md);
    }
    return cv(p);
  }), { fps: 2, phase: true });
}
// tall grass: irregular clumps of 2/3/4 px blades, ink foot, lit tips; 2 sway frames
function clump(p, cx, cy, size, f) {
  const hs = [size - 1, size + 1, size + 2, size, size - 1];
  for (let i = 0; i < 5; i++) {
    const h = Math.max(2, hs[i]), x0 = cx - 2 + i;
    for (let k = 0; k < h; k++) {
      const x = x0 + (f && k >= h - 2 && i > 0 ? 1 : 0);
      p.set(((x % 16) + 16) % 16, cy - k, k === 0 ? P.grass_ink : k === h - 1 ? P.grass_hi : k >= h - 3 ? P.grass_lt : P.grass_md);
    }
  }
  p.set(((cx - 2) % 16 + 16) % 16, cy + 1, P.grass_ink); p.set(cx % 16, cy + 1, P.grass_ink); p.set((cx + 1) % 16, cy + 1, P.grass_ink);
}
const CLUMPS = [[3, 6, 3], [9, 5, 2], [14, 7, 3], [6, 12, 4], [12, 14, 2], [1, 15, 3]];
export function grassTallFrames() {
  return frames([0, 1].map((f) => cv(T((p) => { p.fill(P.grass_md); for (const [x, y, s] of CLUMPS) clump(p, x, y, s, f); }))), { fps: 2, phase: true });
}
export function grassTallSprite() {
  // foreground blades (covers the feet): just the clumps on transparent, bottom 9 px
  return frames([0, 1].map((f) => {
    const p = new Pix(16, 16);
    for (const [x, y, s] of [[3, 15, 3], [8, 15, 4], [13, 15, 3], [6, 15, 2], [11, 15, 2]]) clump(p, x, y, s, f);
    for (let x = 0; x < 16; x++) p.clear(x, 15);
    return p.canvas();
  }), { fps: 2 });
}

// ---------------------------------------------------------------- shallow water
export function shallowFrames() {
  const r = rng(77);
  const peb = [];
  for (let gy = 0; gy < 16; gy += 3) for (let gx = (gy / 3) % 2 * 2; gx < 16; gx += 4) if (r() < 0.45) peb.push([gx + r.int(2), gy + r.int(2), r.chance(0.35) ? P.dirt_lt : P.sand]);
  const waves = [[2, 3, 3], [9, 9, 3], [4, 13, 2]];
  return frames([0, 1, 2].map((f) => cv(T((p) => {
    p.fill(P.water_lt);
    for (const [x, y, c] of peb) { p.put(x % 16, y % 16, c); p.put((x + 1) % 16, y % 16, c); }
    waves.forEach(([x, y, len], i) => {
      const x0 = (x + f * 2 + i) % 16, L = len + ((f + i) % 3 === 0 ? 1 : 0);
      for (let k = 0; k < L; k++) p.put((x0 + k) % 16, y, P.foam);
      p.put((x0 + L) % 16, y + 1, P.water_md);
    });
  }))), { fps: 3, phase: true });
}

// ---------------------------------------------------------------- stairs (cliff ramp)
export function stairsTile() {
  return cv(T((p) => {
    for (let k = 0; k < 4; k++) {
      const y = k * 4;
      p.hline(0, 15, y, P.cliff_hi); p.hline(0, 15, y + 1, P.cliff_lt); p.hline(0, 15, y + 2, P.cliff_md); p.hline(0, 15, y + 3, P.cliff_ink);
      p.set(5 + k * 2, y + 2, P.cliff_dk); p.set(11 - k, y + 1, P.cliff_md);
    }
    for (let y = 0; y < 16; y++) { p.put(0, y, P.cliff_ink); p.put(1, y, P.cliff_dk); p.put(14, y, P.cliff_dk); p.put(15, y, P.cliff_ink); }
  }));
}

// ---------------------------------------------------------------- edges
// irregular profile: jittered teeth (spacing 2–5, depth 1–3), gaps every 6–10 px, slow base wobble; ends = base
function profile(seed, base, maxTooth) {
  const r = rng(seed), d = new Array(16).fill(base);
  let w = 0;
  for (let u = 2; u < 14; u++) { if (r() < 0.3) w = Math.max(-1, Math.min(1, w + (r() < 0.5 ? -1 : 1))); d[u] = Math.max(1, base + w); }
  if (maxTooth > 0) {
    let u = r.range(1, 3), sinceGap = 0;
    while (u < 15) {
      const depth = r.chance(0.7) ? 1 : r.range(1, maxTooth), wdt = r.range(2, 3);
      for (let k = 0; k < wdt && u + k < 15; k++) d[u + k] += k === 0 || k === wdt - 1 ? Math.max(1, depth - (wdt > 2 ? 1 : 0)) : depth;
      let step = r.range(2, 5); sinceGap += step;
      if (sinceGap > r.range(6, 10)) { step += r.range(2, 4); sinceGap = 0; }
      u += step;
    }
  }
  d[0] = d[15] = base; d[1] = Math.min(d[1], base + 1); d[14] = Math.min(d[14], base + 1);
  return d;
}
const SIDE_UV = { n: (x, y) => [x, y], s: (x, y) => [x, 15 - y], w: (x, y) => [y, x], e: (x, y) => [y, 15 - x] };
function edgeSet(spec) {
  const out = {};
  for (const side of ['n', 's', 'w', 'e']) {
    const prof = profile(spec.seed + side.charCodeAt(0) * 13, spec.base, spec.amp);
    const make = (beyond) => {
      const p = new Pix(16, 16);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const [u, t] = SIDE_UV[side](x, y), d = prof[u];
        if (t < d) {
          let c = t === d - 1 && spec.rim ? spec.rim : spec.fill;
          if (spec.tex) c = spec.tex(u, t, d, c) || c;
          p.put(x, y, c);
        } else if (t === d && beyond) { const c = beyond(u, side); if (c) p.put(x, y, c); }
      }
      return p.canvas();
    };
    out[`${spec.group}_${side}`] = make(spec.beyond);
    for (const [target, fn] of Object.entries(spec.targets || {})) out[`${spec.group}_${side}@${target}`] = make(fn);
  }
  return out;
}
// shoreline: shadow under the bank on n/w (light from top-left), foam lap on s/e
const shore = (shadowCol, foamCol) => (u, side) => (side === 'n' || side === 'w' ? shadowCol : hash2(u, side.charCodeAt(0)) < 0.7 ? foamCol : null);

export function buildEdges() {
  const water = { water: shore(P.water_ink, P.foam), shallow: shore(P.water_md, P.foam) };
  const edges = Object.assign({},
    edgeSet({ group: 'grass', seed: 100, base: 2, amp: 3, fill: G.base, rim: G.tuft, targets: water,
      tex: (u, t, d) => (t === 0 && hash2(u, 3) < 0.12 ? G.glint : null) }),
    edgeSet({ group: 'grass_dark', seed: 150, base: 2, amp: 2, fill: P.grass_md,
      beyond: (u) => (u % 2 === 0 ? P.grass_md : null), targets: { ...water, grass: (u) => (u % 2 === 0 ? P.grass_md : null) } }),
    edgeSet({ group: 'path', seed: 200, base: 2, amp: 2, fill: P.dirt_lt, rim: P.dirt_md,
      tex: (u, t) => (t === 0 && hash2(u, 9) < 0.15 ? P.dirt_hi : null) }),
    edgeSet({ group: 'dirt', seed: 300, base: 2, amp: 2, fill: P.dirt_md, rim: P.dirt_dk, targets: water }),
    edgeSet({ group: 'sand', seed: 400, base: 2, amp: 3, fill: P.sand, rim: P.dirt_lt, targets: water,
      tex: (u, t) => (t === 0 && hash2(u, 5) < 0.15 ? P.dirt_hi : null) }),
    edgeSet({ group: 'shallow', seed: 500, base: 2, amp: 2, fill: P.water_lt, rim: P.water_md,
      tex: (u, t) => ((u + t) % 4 === 0 && t < 1 ? P.sand : null) }),
    edgeSet({ group: 'water', seed: 600, base: 1, amp: 1, fill: P.water_dk, rim: P.water_md }),
    edgeSet({ group: 'stone_floor', seed: 700, base: 2, amp: 0, fill: P.stone_lt, rim: P.stone_dk }),
  );
  const edgeGroup = { grass_flowers: 'grass', grass_tall: 'grass', water_edge_n: 'water' };
  const edgePriority = {
    grass_dark: 8, grass: 7, stone_floor: 6, sand: 5, path: 4, dirt: 3, shallow: 2, water: 1,
    bridge: 99, stairs: 99, dungeon_floor: 99, dungeon_wall: 99, wood_floor: 99, void: 99,
  };
  return { edges, edgeGroup, edgePriority };
}

// ---------------------------------------------------------------- cliff faces (16×12 pieces)
const FW = 16, FH = 12;
const CL = { ink: P.cliff_ink, dk: P.cliff_dk, md: P.cliff_md, lt: P.cliff_lt, hi: P.cliff_hi };

// grass overhang for top pieces; returns lip depth per column
function lip(p, seed, cols) {
  const r = rng(seed), d = [];
  let cur = 2;
  for (let x = 0; x < FW; x++) { if (r() < 0.45) cur = Math.max(1, Math.min(3, cur + (r() < 0.5 ? -1 : 1))); d.push(cur); }
  d[0] = d[15] = 2;
  for (let x = 0; x < FW; x++) {
    for (let y = 0; y < d[x]; y++) p.put(x, y, cols.fill);
    p.put(x, d[x] - 1, d[x] > 1 && hash2(x, seed) < 0.25 ? cols.blade : cols.under);
    if (d[x] > 1 && hash2(x, seed + 1) < 0.2) p.put(x, 0, cols.blade);
  }
  return d;
}

// chunky rock: joints (ink) split the piece into 4–6 irregular boulders; vertical/slanted seams dominate.
function cliffPiece(seed, kind) {
  const r = rng(seed);
  const p = new Pix(FW, FH);
  const J = new Uint8Array(FW * FH);
  const setJ = (x, y) => { if (x >= 0 && x < FW && y >= 0 && y < FH) J[y * FW + x] = 1; };
  const isJ = (x, y) => (y < 0 || y >= FH ? false : x < 0 ? false : x >= FW ? true : J[y * FW + x] === 1);
  let y0 = 0, lipD = null;
  if (kind === 'top') { lipD = lip(p, seed, { fill: G.base, under: P.grass_md, blade: G.glint }); y0 = 3; }
  // seam at x = 0 (shared port across all variants at the piece boundaries)
  const off = r() < 0.55 ? [r.range(3, 4), r.range(7, 8)] : null;
  for (let y = y0; y < FH; y++) if (!off || y < off[0] || y > off[1]) setJ(0, y);
  // interior seams from ports 6 and 11, bulging up to 2 px between rows a..b
  const s1 = r() < 0.5 ? -1 : 1, s2 = s1 === 1 ? 1 : r() < 0.5 ? -1 : 1;
  const seamX = [];
  [[6, s1], [11, s2]].forEach(([px, s], j) => {
    const a = r.range(y0 + 1, y0 + 3), b = r.range(Math.max(a + 2, 6), 9);
    const xs = [];
    let prev = px;
    for (let y = 0; y < FH; y++) {
      const o = y >= a && y <= b ? s * Math.min(2, y - a + 1, b - y + 1) : 0;
      const x = Math.max(2, Math.min(14, px + o));
      xs.push(x);
      if (y >= y0) { setJ(x, y); if (x !== prev && y > y0) setJ(prev, y); }
      prev = x;
    }
    seamX[j] = xs;
  });
  // horizontal/slanted splits inside each column, staggered between columns
  const colEdges = (y) => [[0, seamX[0][y]], [seamX[0][y], seamX[1][y]], [seamX[1][y], FW]];
  const nSplit = kind === 'bot' ? [1, 2, 1] : kind === 'top' ? [r.range(0, 1), r.range(0, 1), r.range(0, 1)] : [r.range(0, 1), r.range(1, 1), r.range(0, 1)];
  const used = [];
  for (let c = 0; c < 3; c++) for (let k = 0; k < nSplit[c]; k++) {
    let ys, tries = 0;
    do { ys = r.range(kind === 'top' ? 6 : 2, kind === 'bot' ? 7 : 9); tries++; } while (tries < 20 && used.some(([uc, uy]) => Math.abs(uc - c) <= 1 && Math.abs(uy - ys) < 3));
    used.push([c, ys]);
    const step = r.pick([-1, 0, 1]);
    const [l, rr] = colEdges(ys);
    const mid = Math.floor((l + rr) / 2);
    for (let x = l + 1; x < rr; x++) setJ(x, x > mid ? ys + step : ys);
    if (step) setJ(mid, ys + step);
  }
  // shade
  const base = kind === 'bot' ? 'dk' : 'md';
  for (let y = y0; y < FH; y++) for (let x = 0; x < FW; x++) {
    if (isJ(x, y)) { p.put(x, y, CL.ink); continue; }
    let c = base;
    if (isJ(x, y - 1)) c = kind === 'bot' ? 'md' : 'hi';
    else if (isJ(x - 1, y)) c = kind === 'bot' ? 'md' : 'lt';
    else if (isJ(x + 1, y)) c = kind === 'bot' ? 'ink' : 'dk';
    else if (isJ(x, y + 1)) c = 'dk';
    else if (kind === 'top' && isJ(x - 2, y)) c = 'lt';
    else if (kind !== 'bot' && isJ(x + 2, y) && (x + y) % 3 === 0) c = 'dk';
    p.put(x, y, CL[c]);
  }
  // crack pixels
  for (let i = 0; i < (kind === 'bot' ? 1 : 3); i++) {
    const x = r.range(2, 13), y = r.range(y0 + 2, FH - 3);
    if (p.get(x, y) === p.get(-1, -1)) continue;
    if (!isJ(x, y) && !isJ(x + 1, y + 1)) { p.put(x, y, CL.dk); p.put(x + 1, y + 1, CL.dk); }
  }
  // moss on some boulder tops, roots hanging from the overhang
  if (kind !== 'bot') {
    for (let i = 0; i < 2; i++) {
      const x = r.range(1, 12);
      for (let y = y0 + 1; y < FH - 1; y++) if (p.get(x, y) === c32(CL.hi)) {
        const w = r.range(2, 3);
        for (let k = 0; k < w; k++) if (!isJ(x + k, y)) { p.put(x + k, y, k === 0 ? P.grass_lt : P.grass_md); if (k === 1 && !isJ(x + k, y + 1)) p.put(x + k, y + 1, P.grass_md); }
        break;
      }
    }
  }
  if (kind === 'top') {
    for (let i = 0; i < 2; i++) { let x = r.range(2, 13); for (let y = y0; y < y0 + r.range(3, 6); y++) { p.put(x, y, CL.ink); if (r() < 0.3) x += r() < 0.5 ? -1 : 1; } }
  }
  if (kind === 'top') {
    // shadow under the overhang: 1 px ink + 1 px dk following the lip
    for (let x = 0; x < FW; x++) { p.put(x, lipD[x], CL.ink); p.put(x, lipD[x] + 1, CL.dk); for (let y = lipD[x] + 2; y < y0; y++) if (!p.get(x, y)) p.put(x, y, CL.md); }
  }
  if (kind === 'bot') {
    // rubble + dark foot
    const stones = [[r.range(1, 3), 7, 3], [r.range(6, 8), 8, 4], [r.range(12, 13), 7, 2]];
    for (const [sx, sy, w] of stones) {
      p.hline(sx, sx + w - 1, sy, CL.lt); p.set(sx, sy, CL.hi);
      p.hline(sx, sx + w - 1, sy + 1, CL.md); p.set(sx + w - 1, sy + 1, CL.dk);
      p.hline(sx, sx + w - 1, sy + 2, CL.ink);
    }
    p.rect(0, FH - 2, FW, 2, CL.ink);
  }
  return p;
}
// end pieces: rounded rock edge, lit on the left end, shadowed on the right end
function endPiece(src, side, kind, cols) {
  const p = src.clone();
  for (let y = 0; y < FH; y++) {
    if (side === 'l') { p.put(0, y, cols.ink); if (p.get(1, y) !== 0 && y > 3) p.put(1, y, cols.lt); }
    else { p.put(15, y, cols.ink); if (y > 3) { p.put(14, y, cols.dk); if (p.get(13, y) === p.get(-9, 0) || true) { const c = p.get(13, y); if (c && c !== cols.ink32) p.put(13, y, (y & 1) ? cols.dk : cols.md); } } }
  }
  if (kind === 'top') {
    const [a, b] = side === 'l' ? [0, 1] : [15, 14];
    p.clear(a, 0); p.clear(a, 1); p.clear(b, 0);
    p.put(a, 2, cols.grass); p.put(a, 3, cols.under); p.put(b, 1, cols.grass);
  }
  if (kind === 'bot') { const a = side === 'l' ? 0 : 15; p.clear(a, FH - 1); }
  return p;
}
function faceSet(name, mk, cols, nMids = 4) {
  const top = mk('top', 1), bot = mk('bot', 2);
  const mids = Array.from({ length: nMids }, (_, i) => mk('mid', 10 + i));
  const pack = (t, ms, b) => { const a = [t.canvas(), ms[0].canvas(), b.canvas()]; a.mids = ms.map((m) => m.canvas()); return a; };
  const out = { [name]: pack(top, mids, bot) };
  for (const side of ['l', 'r']) out[`${name}_${side}`] = pack(endPiece(top, side, 'top', cols), mids.map((m) => endPiece(m, side, 'mid', cols)), endPiece(bot, side, 'bot', cols));
  return out;
}

// dirt cliff: horizontal strata, stones, hanging roots
function dirtPiece(seed, kind) {
  const r = rng(seed), p = new Pix(FW, FH);
  let y0 = 0;
  if (kind === 'top') { lip(p, seed, { fill: G.base, under: P.grass_md, blade: G.glint }); y0 = 3; }
  const ph = r() * 6;
  for (let y = y0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const wv = Math.sin(x / 16 * Math.PI * 2 + ph) > 0.3 ? 1 : 0;
    let c = y >= 5 + wv && y <= 7 + wv ? P.dirt_dk : P.dirt_md;
    if (y === 8 + wv && (x + seed) % 3 !== 0) c = P.dirt_lt;
    if (kind === 'bot') c = y >= 10 ? P.dirt_ink : y >= 4 + wv ? P.dirt_dk : P.dirt_md;
    p.put(x, y, c);
  }
  if (kind === 'top') for (let x = 0; x < FW; x++) { p.put(x, 3, P.dirt_dk); }
  const nst = kind === 'bot' ? 1 : r.range(1, 2);
  for (let i = 0; i < nst; i++) {
    const x = r.range(1, 12), y = r.range(y0 + 1, FH - 4), w = r.range(2, 3);
    p.hline(x, x + w - 1, y, kind === 'top' ? P.dirt_lt : P.rock_lt); p.hline(x, x + w - 1, y + 1, P.rock_md);
    p.set(x + w, y + 1, P.dirt_dk); p.hline(x, x + w - 1, y + 2, P.dirt_dk);
  }
  if (kind !== 'bot') {
    let x = r.range(2, 13);
    for (let y = y0; y < y0 + r.range(4, 8) && y < FH; y++) { p.put(x, y, P.wood_dk); if (r() < 0.35) x = Math.max(1, Math.min(14, x + (r() < 0.5 ? -1 : 1))); }
  }
  return p;
}
// brick wall: 8×6 bricks, half-offset rows (2 rows per 12 px piece → seamless)
function brickPiece(seed, kind) {
  const r = rng(seed), p = new Pix(FW, FH);
  p.fill(P.stone_md);
  for (let row = 0; row < 2; row++) {
    const y = row * 6, off = row ? 4 : 0;
    p.hline(0, 15, y, P.stone_lt); p.hline(0, 15, y + 4, P.stone_dk); p.hline(0, 15, y + 5, P.stone_ink);
    for (let x = off; x < 16 + off; x += 8) { p.vline(x % 16, y, y + 5, P.stone_ink); p.vline((x + 1) % 16, y + 1, y + 4, P.stone_lt); p.vline((x + 7) % 16, y + 1, y + 4, P.stone_dk); }
  }
  for (let i = 0; i < 2; i++) { const x = r.range(2, 13), y = r.range(1, 10); if (p.get(x, y) === p.get(3, 2)) p.put(x, y, P.stone_dk); }
  if (kind === 'top') { p.rect(0, 0, 16, 3, P.stone_lt); p.hline(0, 15, 0, P.stone_hi); p.hline(0, 15, 3, P.stone_ink); p.hline(0, 15, 2, P.stone_md); }
  if (kind === 'bot') p.rect(0, 10, 16, 2, P.stone_ink);
  return p;
}
// stairs cut into the cliff face (for faces.stairs)
function stairsPiece(kind) {
  const p = new Pix(FW, FH);
  for (let y = 0; y < FH; y++) {
    const k = y % 4;
    p.hline(0, 15, y, [P.cliff_hi, P.cliff_lt, P.cliff_md, P.cliff_ink][k]);
    p.put(0, y, P.cliff_ink); p.put(1, y, P.cliff_dk); p.put(14, y, P.cliff_dk); p.put(15, y, P.cliff_ink);
  }
  if (kind === 'bot') p.hline(0, 15, FH - 1, P.cliff_ink);
  return p;
}

function plinthEarth() {
  const W = 64, H = 40, p = new Pix(W, H), r = rng(4321);
  const wave = (x, a, ph, amp) => Math.round(Math.sin((x / W) * Math.PI * 2 * a + ph) * amp);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    let c = P.dirt_md;
    if (y > 13 + wave(x, 2, 1, 1.4)) c = P.dirt_dk;
    if (y > 27 + wave(x, 1, 3, 1.6)) c = P.dirt_ink;
    p.put(x, y, c);
  }
  // grass edge on top (lit), with irregular drips
  for (let x = 0; x < W; x++) {
    p.put(x, 0, G.base); p.put(x, 1, G.base);
    const drip = hash2(x, 11) < 0.3 ? 1 : hash2(x, 12) < 0.12 ? 2 : 0;
    for (let k = 0; k < drip; k++) p.put(x, 2 + k, G.base);
    p.put(x, 2 + drip, P.grass_md);
  }
  // roots hanging from the top
  for (const rx of [7, 30, 51]) {
    let x = rx; const len = r.range(7, 12);
    for (let y = 3; y < 3 + len; y++) { p.put((x + W) % W, y, P.wood_dk); if (r() < 0.4) x += r() < 0.5 ? -1 : 1; if (r() < 0.15) p.put((x + 1 + W) % W, y, P.wood_dk); }
  }
  const stone = (x, y, w, h) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const corner = (i === 0 || i === w - 1) && (j === 0 || j === h - 1) && w > 2 && h > 1;
      if (corner) continue;
      p.put((x + i) % W, y + j, j === 0 || i === 0 ? P.rock_lt : i === w - 1 || j === h - 1 ? P.rock_md : P.rock_md);
    }
    for (let i = 0; i < w; i++) p.put((x + i) % W, y + h, P.dirt_ink);
  };
  // grouped stones: clusters with 1 big boulder + 2-3 small ones
  for (const [cx, cy] of [[12, 18], [40, 21], [58, 12]]) {
    stone(cx, cy, 5, 3);
    for (let i = 0; i < 3; i++) stone(cx + r.range(-5, 7), cy + r.range(-4, 4), r.range(1, 3), r.range(1, 2));
  }
  for (let i = 0; i < 4; i++) stone(r.int(W), r.range(30, 35), r.range(2, 3), 1);
  for (let i = 0; i < 18; i++) p.put(r.int(W), r.range(5, 12), P.dirt_dk);
  for (let i = 0; i < 14; i++) p.put(r.int(W), r.range(30, 39), P.dirt_dk);
  return p.canvas();
}
function plinthStone() {
  const W = 32, H = 40, p = new Pix(W, H);
  p.fill(P.stone_dk);
  for (let row = 0; row * 8 < H; row++) {
    const y = row * 8, off = row % 2 ? 8 : 0;
    p.hline(0, W - 1, y, P.stone_ink); p.hline(0, W - 1, y + 1, P.stone_md);
    for (let x = off; x < W + 16; x += 16) { p.vline(x % W, y, y + 7, P.stone_ink); p.vline((x + 1) % W, y + 1, y + 6, P.stone_md); }
  }
  p.hline(0, W - 1, 0, P.stone_lt);
  for (let y = 30; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 2 === 0 && y > 33) p.put(x, y, P.stone_ink);
  return p.canvas();
}

export function buildFaces() {
  const rockCols = { ink: P.cliff_ink, lt: P.cliff_lt, dk: P.cliff_dk, md: P.cliff_md, grass: G.base, under: P.grass_md };
  const dirtCols = { ink: P.dirt_dk, lt: P.dirt_lt, dk: P.dirt_dk, md: P.dirt_md, grass: G.base, under: P.grass_md };
  const brickCols = { ink: P.stone_ink, lt: P.stone_lt, dk: P.stone_dk, md: P.stone_md, grass: P.stone_lt, under: P.stone_hi };
  const faces = Object.assign({},
    faceSet('rock', (k, s) => cliffPiece(1000 + s * 31, k), rockCols),
    faceSet('dirt', (k, s) => dirtPiece(2000 + s * 17, k), dirtCols, 3),
    faceSet('brick', (k, s) => brickPiece(3000 + s * 7, k), brickCols, 3),
  );
  const st = [stairsPiece('top').canvas(), stairsPiece('mid').canvas(), stairsPiece('bot').canvas()];
  faces.stairs = st;
  faces.plinth_earth = [plinthEarth()];
  faces.plinth_stone = [plinthStone()];
  return faces;
}
