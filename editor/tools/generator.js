// Szenen-Generator: erzeugt aus Vorlage + Seed + Reglern eine komplette, spielbare Karte im Inhaltsformat:
// Gelände (Wege zu den Ausgängen, Plateaus mit Treppen, Flüsse/Teiche/Küste mit Brücken und Ufern), Bodenvielfalt,
// Waldrand und Baumgruppen, Deko, hohes Gras mit passenden Begegnungs-Zonen, Truhen an erreichbaren Nebenplätzen,
// Schild, Dorfbewohner, Ankunftspunkte an jedem Ausgang. Gleicher Seed + gleiche Regler → gleiche Karte.
import { rng, noise2 } from './lib/rng.js';
import { catmull, thickCells } from './lib/spline.js';
import { Grid, reach, N4, N8, TILE } from './lib/grid.js';
import { SPECIES } from '../../src/game/monsters/species.js';

export const TEMPLATES = {
  route: { label: '🌾 Wiesen-Route', water: 0.25, forest: 0.45, hills: 0.4, grass: 0.55, habitat: ['grass', 'meadow'] },
  forest: { label: '🌲 Waldweg', water: 0.15, forest: 0.85, hills: 0.3, grass: 0.4, habitat: ['forest', 'grass'] },
  river: { label: '🏞 Flusstal', water: 0.7, forest: 0.45, hills: 0.35, grass: 0.45, habitat: ['shore', 'grass'] },
  coast: { label: '🏖 Küste', water: 0.8, forest: 0.3, hills: 0.25, grass: 0.35, habitat: ['shore', 'meadow'] },
  village: { label: '🏘 Dorf', water: 0.2, forest: 0.35, hills: 0.15, grass: 0.15, habitat: ['grass'] },
  cave: { label: '🪨 Höhle', water: 0.15, forest: 0, hills: 0, grass: 1, habitat: ['cave'] },
};
export const SIDES = { n: 'Norden', s: 'Süden', w: 'Westen', e: 'Osten' };
const SIDE_SPAWN = { n: 'nord', s: 'sued', w: 'west', e: 'ost' };

export function defaults(template = 'route') {
  const t = TEMPLATES[template];
  return { template, seed: Math.floor(Math.random() * 99999), w: template === 'cave' ? 32 : 40, h: template === 'cave' ? 26 : 30,
    water: t.water, forest: t.forest, hills: t.hills, grass: t.grass, levels: [3, 7], exits: template === 'cave' ? ['s'] : ['w', 'e'], chests: 2, name: '' };
}

/** Monster-Tabelle passend zu Lebensräumen (nur Grundformen, keine Bosse) */
export function speciesFor(habitats, levels) {
  const base = Object.entries(SPECIES).filter(([, s]) => s.catch >= 0.4);
  let rows = base.filter(([, s]) => habitats.includes(s.habitat));
  if (rows.length < 2) rows = rows.concat(base.filter(([, s]) => s.habitat === 'grass')).slice(0, 3);
  return rows.map(([id, s], i) => ({ species: id, levels: [levels[0], levels[1]], weight: Math.max(1, Math.round(s.catch * 6)) - (i > 2 ? 1 : 0),
    ...(s.time && s.time !== 'any' ? { time: s.time } : {}) }));
}

const LINES = [
  ['Schönes Wetter heute, nicht wahr?'], ['Im hohen Gras raschelt es ständig …', 'Pass gut auf dich auf!'],
  ['Mein Großvater hat diese Wege angelegt.'], ['Hast du schon das alte Schild am Ortseingang gelesen?'],
  ['Nachts sollen hier seltene Monster auftauchen.'], ['Ich träume davon, einmal ans Meer zu reisen.'],
];

/**
 * opts: siehe defaults(). Gibt { map, dialogs, info } zurück (map im kanonischen Editor-Format: Felder für format.js).
 * Die Karte enthält ground/height als Grid; der Aufrufer schreibt sie mit writeGrid() in eine Karte.
 */
export function generate(o) {
  const R = rng(`${o.template}:${o.seed}`), nz = noise2(o.seed), nz2 = noise2(o.seed + 101), nz3 = noise2(o.seed + 202);
  const W = Math.max(16, Math.min(128, o.w | 0)), H = Math.max(14, Math.min(128, o.h | 0));
  if (o.template === 'cave') return cave(o, R, nz, W, H);
  const G = new Grid(W, H, 'grass', 0);
  const idx = (x, y) => y * W + x;
  const pathM = new Uint8Array(W * H), pathD = new Float32Array(W * H).fill(99), waterM = new Uint8Array(W * H), block = new Uint8Array(W * H);
  const objects = [], npcs = [], items = [], dialogs = {}, encounters = [], spawns = {};

  // ---- 1) Ausgänge + Wege (Kurven über einen Knotenpunkt) --------------------------------------------------
  const exits = (o.exits?.length ? o.exits : ['w', 'e']).map((side) => {
    const along = side === 'n' || side === 's' ? W : H;
    const p = Math.round(along * (0.3 + R() * 0.4));
    const pt = { n: [p, -1], s: [p, H], w: [-1, p], e: [W, p] }[side];
    const inner = { n: [p, 1], s: [p, H - 2], w: [1, p], e: [W - 2, p] }[side];
    return { side, pt, inner };
  });
  const hub = [W * (0.4 + R() * 0.2), H * (0.4 + R() * 0.2)];
  const curves = exits.map((ex) => {
    const mid = [(ex.pt[0] + hub[0]) / 2 + (R() - 0.5) * W * 0.25, (ex.pt[1] + hub[1]) / 2 + (R() - 0.5) * H * 0.25];
    const lead = { n: [ex.pt[0], 3], s: [ex.pt[0], H - 4], w: [3, ex.pt[1]], e: [W - 4, ex.pt[1]] }[ex.side];
    return catmull([ex.pt, lead, mid, hub], 0.3);
  });
  if (exits.length === 1) curves.push(catmull([hub, [hub[0] + (R() - 0.5) * 6, hub[1] + (R() - 0.5) * 6]], 0.3));
  const pathW = o.template === 'village' ? 2.6 : 2.1;
  for (const c of curves) for (const cell of thickCells(c, pathW + 6, 0, W, H).values()) {
    const i = idx(cell.x, cell.y); const d = Math.max(0, cell.d - pathW / 2);
    if (d < pathD[i]) pathD[i] = d;
    if (cell.d <= pathW / 2) pathM[i] = 1;
  }

  // ---- 2) Höhen: Plateaus abseits der Wege --------------------------------------------------------------
  const hillThr = 0.7 - o.hills * 0.2;
  const hv = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    const edgeExit = exits.some((ex) => Math.hypot(x - ex.inner[0], y - ex.inner[1]) < 4);
    const e = nz(x / 11, y / 11, 3);
    hv[i] = e;
    if (pathD[i] > 2.5 && !edgeExit && e > hillThr) G.hm[i] = e > hillThr + 0.1 && pathD[i] > 4.5 ? 2 : 1;
  }
  smoothHeights(G, 2);

  // ---- 3) Wasser ---------------------------------------------------------------------------------------
  if (o.template === 'river' || (o.template === 'route' && o.water > 0.55)) {
    const vertical = exits.every((e) => e.side === 'w' || e.side === 'e');
    const pts = [];
    for (let k = 0; k <= 4; k++) { const t = k / 4; pts.push(vertical ? [W * (0.35 + R() * 0.3) + (k - 2) * (R() - 0.5) * 4, -1 + t * (H + 1)] : [-1 + t * (W + 1), H * (0.35 + R() * 0.3)]); }
    const rw = 2 + o.water * 3;
    for (const cell of thickCells(catmull(pts, 0.3), rw + 2, 0, W, H).values()) {
      const i = idx(cell.x, cell.y);
      G.hm[i] = 0;
      if (cell.d <= rw / 2) waterM[i] = 1;
    }
  }
  if (o.template === 'coast') {
    const side = exits.some((e) => e.side === 's') ? 'e' : 's';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const f = side === 's' ? y / H : x / W;
      const shore = 0.72 - o.water * 0.22 + (nz2(x / 7, y / 7, 2) - 0.5) * 0.18;
      if (f > shore) { const i = idx(x, y); waterM[i] = pathM[i] ? 0 : 1; G.hm[i] = 0; }
      else if (f > shore - 0.12) { G.hm[idx(x, y)] = 0; }
    }
  }
  if (o.water > 0.05 && o.template !== 'coast' && o.template !== 'river') {   // Teiche in feuchten Senken
    const pondThr = 0.78 - o.water * 0.2;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y), m = nz2(x / 6, y / 6, 3);
      if (m > pondThr && pathD[i] > 2 && G.hm[i] === 0) waterM[i] = 1;
    }
  }
  // Wasser liegt flach und hat Ufer auf gleicher Höhe
  for (let i = 0; i < W * H; i++) if (waterM[i]) {
    const x = i % W, y = (i / W) | 0;
    G.hm[i] = 0;
    for (const [dx, dy] of N8) if (G.ok(x + dx, y + dy)) G.hm[idx(x + dx, y + dy)] = 0;
  }
  smoothHeights(G, 1);

  // ---- 4) Wald-Maske (Rand + Gruppen) und Boden ---------------------------------------------------------
  const border = 1.5 + o.forest * 3.2;
  const nearExitF = (x, y) => exits.some((ex) => Math.hypot(x - ex.inner[0], y - ex.inner[1]) < 3.2);
  const forestM = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    if (pathD[i] < 1.6 || waterM[i] || nearExitF(x, y)) continue;
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (edge < border + (nz(x / 3, y / 3, 1) - 0.3) * 2.5 || nz3(x / 8 + 40, y / 8, 3) > 0.74 - o.forest * 0.22) forestM[i] = 1;
  }
  const tallThr = 0.69 - o.grass * 0.14;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    const moist = nz2(x / 9, y / 9, 3), detail = nz3(x / 4, y / 4, 2);
    let t = 'grass';
    if (moist > 0.62 || forestM[i]) t = 'grass_dark';
    else if (moist < 0.38) t = 'grass_light';
    if (detail > 0.74) t = 'grass_flowers';
    if (o.template === 'coast' && G.hm[i] === 0 && nz(x / 5, y / 5, 2) < 0.35) t = 'sand';
    if (!pathM[i] && !forestM[i] && pathD[i] > 0.6 && G.hm[i] <= 1 && nz(x / 5 + 30, y / 5 + 30, 3) > tallThr && o.grass > 0.05) t = 'grass_tall';
    if (pathD[i] < 1.4 && !pathM[i] && t !== 'grass_tall' && R() < 0.5) t = 'grass_light';
    if (pathM[i]) t = o.template === 'village' ? 'path' : nz(x / 3, y / 3, 1) > 0.72 ? 'dirt' : 'path';
    G.t[i] = t;
  }
  // Wasser: tiefer Kern, flacher Rand, Sand-Ufer
  for (let i = 0; i < W * H; i++) if (waterM[i]) G.t[i] = pathM[i] ? 'bridge' : 'water';
  for (let i = 0; i < W * H; i++) {
    if (G.t[i] !== 'water') continue;
    const x = i % W, y = (i / W) | 0;
    let land = 0; for (const [dx, dy] of N8) { const t = G.get(x + dx, y + dy); if (t && t !== 'water' && t !== 'shallow' && t !== 'bridge') land++; }
    if (land >= 2) G.t[i] = 'shallow';
  }
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0, t = G.t[i];
    if (t === 'water' || t === 'shallow' || t === 'bridge' || pathM[i]) continue;
    if (N4.some(([dx, dy]) => { const n = G.get(x + dx, y + dy); return n === 'water' || n === 'shallow'; }) && (o.template !== 'route' || R() < 0.6)) G.t[i] = 'sand';
  }
  // Brücke: Weg über Wasser; Ränder flach
  for (let i = 0; i < W * H; i++) if (G.t[i] === 'bridge') G.hm[i] = 0;

  // ---- 5) Treppen zu jedem Plateau (Südkante, mit Anschluss an begehbaren Boden) ------------------------
  for (const lvl of [1, 2]) {
    for (const comp of components(G, (i) => G.hm[i] >= lvl, W, H)) {
      if (comp.length < 14) { for (const i of comp) G.hm[i] = lvl - 1; continue; }
      const cand = comp.filter((i) => {
        const x = i % W, y = (i / W) | 0;
        if (G.hm[i] !== lvl) return false;
        const below = G.ok(x, y + 1) ? idx(x, y + 1) : -1, below2 = G.ok(x + 1, y + 1) ? idx(x + 1, y + 1) : -1, side = G.ok(x + 1, y) ? idx(x + 1, y) : -1;
        return below >= 0 && below2 >= 0 && side >= 0 && G.hm[side] === lvl && G.hm[below] === lvl - 1 && G.hm[below2] === lvl - 1 && !waterM[below] && !waterM[below2];
      });
      if (!cand.length) continue;
      cand.sort((a, b) => pathD[a] - pathD[b]);
      const s = cand[Math.min(cand.length - 1, Math.floor(R() * Math.min(3, cand.length)))];
      G.t[s] = 'stairs'; G.t[s + 1] = 'stairs';
      for (const k of [s + W, s + W + 1]) if (G.t[k] === 'grass_tall') G.t[k] = 'grass_light';
    }
  }

  // ---- 6) Bäume: Waldrand + Gruppen ---------------------------------------------------------------------
  const treeTypes = o.template === 'forest' ? ['tree_pine', 'tree_pine', 'tree', 'tree_small'] : o.template === 'coast' ? ['tree', 'tree_small'] : ['tree', 'tree', 'tree_pine', 'tree_autumn', 'tree_small'];
  const nearExit = (x, y) => exits.some((ex) => Math.hypot(x - ex.inner[0], y - ex.inner[1]) < 3.2);
  const okTree = (x, y) => {
    const i = idx(x, y), t = G.t[i];
    if (pathD[i] < 1.6 || waterM[i] || t === 'sand' || t === 'stairs' || t === 'bridge' || t === 'grass_tall' || nearExit(x, y)) return false;
    // nicht direkt vor Treppen und nicht an Plateau-Südkanten (Bäume würden die Klippe verdecken)
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 2]]) if (G.get(x + dx, y + dy) === 'stairs') return false;
    if (G.ok(x, y - 1) && G.hm[idx(x, y - 1)] > G.hm[i]) return false;
    return true;
  };
  // gejittertes Raster statt Poisson: erreicht auch getrennte Waldstücke
  const pts = [], STEP = o.template === 'forest' ? 1.45 : 1.6;
  for (let gy = 0; gy < H; gy += STEP) for (let gx = 0; gx < W; gx += STEP) {
    const fx = gx + R() * STEP * 0.8, fy = gy + R() * STEP * 0.8, x = Math.floor(fx), y = Math.floor(fy);
    if (!G.ok(x, y) || !forestM[idx(x, y)] || !okTree(x, y) || R() < 0.12) continue;
    if (pts.some(([a, b]) => Math.abs(a - fx) < 1.2 && Math.abs(b - fy) < 1.2)) continue;
    pts.push([fx, fy]);
  }
  // vereinzelte Bäume auf offenen Wiesen
  for (let k = 0; k < Math.round(W * H * o.forest / 260); k++) { const x = R.int(2, W - 3), y = R.int(2, H - 3); if (okTree(x, y) && pathD[idx(x, y)] > 2.5 && !pts.some(([a, b]) => Math.hypot(a - x, b - y) < 2.5)) pts.push([x + 0.5, y + 0.5]); }
  for (const [fx, fy] of pts) {
    const x = Math.floor(fx), y = Math.floor(fy);
    const type = R.pick(treeTypes);
    objects.push({ type, x: x * TILE + 8, y: y * TILE + 14 });
    block[idx(x, y)] = 1;
  }

  // ---- 7) Deko --------------------------------------------------------------------------------------------
  const free = (x, y) => G.ok(x, y) && !block[idx(x, y)] && !pathM[idx(x, y)] && !waterM[idx(x, y)] && !['stairs', 'bridge', 'grass_tall'].includes(G.t[idx(x, y)]);
  const scatter = (n, type, okFn = () => true, solid = true) => {
    for (let k = 0, tries = 0; k < n && tries < n * 30; tries++) {
      const x = R.int(1, W - 2), y = R.int(1, H - 2);
      if (!free(x, y) || !okFn(x, y)) continue;
      objects.push({ type, x: x * TILE + 8, y: y * TILE + 14 });
      if (solid) block[idx(x, y)] = 1;
      k++;
    }
  };
  const area = W * H;
  scatter(Math.round(area / 140), 'bush', (x, y) => pathD[idx(x, y)] > 1);
  scatter(Math.round(area / 220), 'rock', (x, y) => G.hm[idx(x, y)] > 0 || nz(x / 4, y / 4, 1) > 0.6);
  scatter(Math.round(area / 120), 'flower', (x, y) => G.t[idx(x, y)].startsWith('grass'), false);
  if (o.template === 'forest') { scatter(Math.round(area / 90), 'mushroom', () => true, false); scatter(Math.round(area / 260), 'stump'); }
  for (let i = 0; i < W * H; i++) if (G.t[i] === 'water' && R() < 0.03) objects.push({ type: 'lilypad', x: (i % W) * TILE + 8, y: ((i / W) | 0) * TILE + 12 });

  // ---- 8) Dorf -----------------------------------------------------------------------------------------
  if (o.template === 'village') village(o, R, G, { W, H, idx, hub, pathM, pathD, waterM, block, objects, npcs, dialogs, nz });

  // ---- 9) Ankunftspunkte + Schild ----------------------------------------------------------------------
  for (const ex of exits) {
    const [x, y] = ex.inner.map((v, k) => Math.max(1, Math.min((k ? H : W) - 2, v)));
    spawns[SIDE_SPAWN[ex.side]] = { x: x * TILE + 8, y: y * TILE + 12, dir: { n: 'down', s: 'up', w: 'right', e: 'left' }[ex.side] };
  }
  spawns.start = { ...spawns[SIDE_SPAWN[exits[0].side]] };
  {
    const ex = exits[0];
    const sx = ex.inner[0] + (ex.side === 'w' ? 2 : ex.side === 'e' ? -2 : 2), sy = ex.inner[1] + (ex.side === 'n' ? 2 : ex.side === 's' ? -2 : -2);
    for (let r = 0; r < 4; r++) {
      const cand = [[sx, sy - r], [sx, sy + r], [sx + r, sy], [sx - r, sy]].find(([x, y]) => free(x, y) && pathD[idx(x, y)] > 0.3);
      if (cand) { objects.push({ type: 'sign', x: cand[0] * TILE + 8, y: cand[1] * TILE + 14, text: [`${o.name || TEMPLATES[o.template].label.slice(3)}`, 'Vorsicht: wilde Monster im hohen Gras!'] }); block[idx(cand[0], cand[1])] = 1; break; }
    }
  }

  // ---- 10) Begegnungs-Zonen aus hohem Gras -------------------------------------------------------------
  const habitats = TEMPLATES[o.template].habitat;
  for (const comp of components(G, (i) => G.t[i] === 'grass_tall', W, H)) {
    if (comp.length < 6) continue;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const i of comp) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const onHill = comp.filter((i) => G.hm[i] > 0).length > comp.length / 2;
    encounters.push({ id: `gras_${encounters.length + 1}`, rect: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], tiles: ['grass_tall'], density: Math.max(1, Math.min(4, Math.round(comp.length / 14))),
      table: speciesFor(onHill ? [...habitats, 'cliff'] : habitats, o.levels) });
  }

  // ---- 11) Truhen an erreichbaren, abgelegenen Plätzen -------------------------------------------------
  const RG = G.clone();
  const blocked = new Set(); for (let i = 0; i < W * H; i++) if (block[i]) blocked.add(i);
  const st = spawns.start, sxT = Math.floor(st.x / TILE), syT = Math.floor(st.y / TILE);
  const reachM = reach(RG, sxT, syT, blocked);
  const spots = [];
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0;
    if (!reachM[i] || !free(x, y) || pathD[i] < 2.5 || x < 2 || y < 2 || x > W - 3 || y > H - 3) continue;
    // Truhe darf keinen Durchgang versperren: mindestens 2 freie Nachbarn bleiben
    if (N4.filter(([dx, dy]) => reachM[idx(x + dx, y + dy)]).length < 2) continue;
    spots.push([i, pathD[i] + (G.hm[i] > 0 ? 4 : 0) + R() * 2]);
  }
  spots.sort((a, b) => b[1] - a[1]);
  const loot = [['orb', 3], ['potion', 2], ['orb', 2], ['potion_big', 1], ['revive', 1], ['orb_good', 2]];
  const used = [];
  for (const [i] of spots) {
    if (items.length >= (o.chests | 0)) break;
    const x = i % W, y = (i / W) | 0;
    if (used.some(([a, b]) => Math.hypot(a - x, b - y) < 8)) continue;
    used.push([x, y]);
    const [item, count] = loot[(o.seed + items.length) % loot.length];
    items.push({ type: 'chest', x: x * TILE + 8, y: y * TILE + 14, contents: { item, count }, flag: `chest_gen_${o.seed}_${x}_${y}` });
  }

  const reachable = reachM.reduce((s, v) => s + v, 0);
  return { grid: G, map: { outdoor: true, face: 'rock', plinth: 'earth', music: 'overworld', ambient: true, objects, npcs, items, encounters, spawns, warps: [], events: [], trainers: [] },
    dialogs, info: { trees: pts.length, zones: encounters.length, chests: items.length, reachable, exits: exits.map((e) => SIDE_SPAWN[e.side]) } };
}

// ---------------------------------------------------------------------------------------------------------
function village(o, R, G, c) {
  const { W, H, idx, hub, pathM, pathD, waterM, block, objects, npcs, dialogs } = c;
  // Platz
  const [px, py] = hub.map(Math.round);
  for (let y = py - 3; y <= py + 3; y++) for (let x = px - 4; x <= px + 4; x++) {
    if (!G.ok(x, y) || ((x - px) / 4.6) ** 2 + ((y - py) / 3.4) ** 2 > 1) continue;
    const i = idx(x, y); G.t[i] = 'stone_floor'; G.hm[i] = 0; pathM[i] = 1; pathD[i] = 0;
  }
  // bestehende Objekte auf dem Platz entfernen
  const clear = (x0, y0, x1, y1) => { for (let k = objects.length - 1; k >= 0; k--) { const ob = objects[k], tx = Math.floor(ob.x / TILE), ty = Math.floor(ob.y / TILE); if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1) { objects.splice(k, 1); block[idx(tx, ty)] = 0; } } };
  clear(px - 5, py - 4, px + 5, py + 4);
  objects.push({ type: 'well', x: px * TILE + 16, y: py * TILE + 15 }); block[idx(px, py)] = block[idx(px + 1, py)] = 1;
  // Häuser rund um den Platz (Fußabdruck 5×4 Tiles, Tür unten mittig → Weg zum Platz)
  const slots = [[-9, -6], [3, -7], [-10, 3], [6, 4], [-2, 7], [10, -2]];
  R.shuffle(slots);
  let n = 0;
  for (const [dx, dy] of slots) {
    if (n >= 3 + Math.round(o.forest * 2)) break;
    const hx = px + dx, hy = py + dy;       // hx = linke Kante, hy = Türreihe (unten)
    if (hx < 2 || hy < 4 || hx + 5 > W - 2 || hy + 2 > H - 2) continue;
    let ok = true;
    for (let y = hy - 3; y <= hy; y++) for (let x = hx; x < hx + 5; x++) if (waterM[idx(x, y)] || G.t[idx(x, y)] === 'stairs' || (pathM[idx(x, y)] && G.t[idx(x, y)] === 'stone_floor')) ok = false;
    if (!ok) continue;
    clear(hx - 1, hy - 4, hx + 5, hy + 1);
    for (let y = hy - 3; y <= hy + 1; y++) for (let x = hx - 1; x <= hx + 5; x++) if (G.ok(x, y)) { const i = idx(x, y); G.hm[i] = 0; if (G.t[i] === 'grass_tall') G.t[i] = 'grass'; }
    for (let y = hy - 3; y <= hy; y++) for (let x = hx; x < hx + 5; x++) block[idx(x, y)] = 1;
    objects.push({ type: 'house', x: (hx + 2.5) * TILE, y: hy * TILE + 15 });
    // Weg von der Tür zum Platz
    const door = [hx + 2, hy + 1];
    const pts = catmull([door, [door[0], door[1] + 1], [(door[0] + px) / 2, (door[1] + py) / 2 + (R() - 0.5) * 2], [px, py]], 0.3);
    for (const cell of thickCells(pts, 1.6, 0, W, H).values()) { const i = idx(cell.x, cell.y); if (G.t[i] !== 'stone_floor' && !waterM[i] && G.t[i] !== 'stairs') { G.t[i] = 'path'; G.hm[i] = 0; pathM[i] = 1; pathD[i] = 0; block[i] = 0; } }
    clear(door[0] - 1, door[1], door[0] + 1, door[1] + 2);
    objects.push({ type: R.pick(['barrel', 'crate', 'flowerbox', 'sack']), x: (hx + 4) * TILE + 8, y: (hy + 1) * TILE + 12 });
    objects.push({ type: 'lantern', x: (hx) * TILE + 8, y: (hy + 1) * TILE + 12 });
    n++;
  }
  // Bewohner
  for (let k = 0; k < 3; k++) {
    for (let t = 0; t < 30; t++) {
      const x = px + R.int(-6, 6), y = py + R.int(-5, 5);
      if (!G.ok(x, y) || block[idx(x, y)] || waterM[idx(x, y)] || G.hm[idx(x, y)] !== 0) continue;
      const id = `bewohner_${k + 1}`, did = `gen_${o.seed}_${id}`;
      npcs.push({ id, character: ['girl', 'elder', 'merchant'][k], x: x * TILE + 8, y: y * TILE + 12, dir: 'down', behavior: { type: k === 1 ? 'idle' : 'wander' }, dialog: did });
      dialogs[did] = { id: did, speaker: ['Mira', 'Opa Hein', 'Händler Udo'][k], lines: LINES[(o.seed + k) % LINES.length], ...(k === 2 ? { do: [{ shop: { name: 'Händler Udo', stock: ['orb', 'potion', 'potion_big'] } }] } : {}) };
      block[idx(x, y)] = 1;
      break;
    }
  }
  // nichts Störendes auf neuen Wegen
  const keep = new Set(['house', 'well', 'lantern', 'barrel', 'crate', 'flowerbox', 'sack']);
  for (let k = objects.length - 1; k >= 0; k--) { const ob = objects[k], i = idx(Math.floor(ob.x / TILE), Math.floor(ob.y / TILE)); if (pathM[i] && !keep.has(ob.type)) { objects.splice(k, 1); block[i] = 0; } }
  // Bänke und Laternen am Platz
  objects.push({ type: 'bench', x: (px - 3) * TILE, y: (py + 3) * TILE + 14 }, { type: 'lantern', x: (px + 4) * TILE + 8, y: (py - 2) * TILE + 12 });
}

function cave(o, R, nz, W, H) {
  const G = new Grid(W, H, 'dungeon_floor', 0);
  const idx = (x, y) => y * W + x;
  let wall = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) wall[idx(x, y)] = x < 1 || y < 2 || x >= W - 1 || y >= H - 1 || R() < 0.44 ? 1 : 0;
  for (let it = 0; it < 5; it++) {
    const nw = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (x < 1 || y < 2 || x >= W - 1 || y >= H - 1) { nw[idx(x, y)] = 1; continue; }
      let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (wall[idx(x + dx, y + dy)]) n++;
      nw[idx(x, y)] = n >= 5 ? 1 : 0;
    }
    wall = nw;
  }
  // Eingang unten mittig + Gang nach innen
  const ex = Math.floor(W / 2);
  for (let y = Math.floor(H * 0.55); y < H; y++) for (let x = ex - 1; x <= ex + 1; x++) wall[idx(x, y)] = y === H - 1 && x !== ex ? 1 : 0;
  // nur die größte zusammenhängende Höhle behalten (vom Eingang aus)
  const seen = new Uint8Array(W * H), st = [idx(ex, H - 2)]; seen[st[0]] = 1;
  while (st.length) { const i = st.pop(), x = i % W, y = (i / W) | 0; for (const [dx, dy] of N4) { const j = idx(x + dx, y + dy); if (G.ok(x + dx, y + dy) && !wall[j] && !seen[j]) { seen[j] = 1; st.push(j); } } }
  for (let i = 0; i < W * H; i++) if (!seen[i]) wall[i] = 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    if (wall[i]) { G.t[i] = 'dungeon_wall'; G.hm[i] = y === H - 1 ? 0 : 2; }
    else G.t[i] = nz(x / 4, y / 4, 2) > 0.7 ? 'dirt' : 'dungeon_floor';
  }
  const floors = []; for (let i = 0; i < W * H; i++) if (!wall[i] && ((i / W) | 0) < H - 2) floors.push(i);
  const objects = [], items = [];
  const pick = () => floors.splice(Math.floor(R() * floors.length), 1)[0];
  const near = (i, k) => { const x = i % W, y = (i / W) | 0; return N8.filter(([dx, dy]) => wall[idx(x + dx, y + dy)]).length >= k; };
  for (let k = 0; k < Math.round(W * H / 120); k++) { const i = pick(); if (i != null && near(i, 3)) objects.push({ type: R.pick(['rock', 'mushroom', 'rock']), x: (i % W) * TILE + 8, y: ((i / W) | 0) * TILE + 14 }); }
  for (let k = 0; k < 4; k++) { const i = floors.find((j) => near(j, 3) && wall[j - W]); if (i == null) break; floors.splice(floors.indexOf(i), 1); objects.push({ type: 'torch', x: (i % W) * TILE + 8, y: ((i / W) | 0) * TILE + 14 }); }
  const far = floors.filter((i) => near(i, 4)).sort((a, b) => ((a / W) | 0) - ((b / W) | 0));
  for (let k = 0; k < (o.chests | 0) && far.length; k++) { const i = far.splice(k * 3 % far.length, 1)[0]; items.push({ type: 'chest', x: (i % W) * TILE + 8, y: ((i / W) | 0) * TILE + 14, contents: { item: k ? 'potion' : 'orb_good', count: 2 }, flag: `chest_gen_${o.seed}_${i}` }); }
  const spawns = { sued: { x: ex * TILE + 8, y: (H - 2) * TILE + 10, dir: 'up' } };
  spawns.start = { ...spawns.sued };
  const encounters = [{ id: 'hoehle', rect: [1, 2, W - 2, H - 4], density: Math.max(2, Math.round(W * H / 220)), table: speciesFor(['cave', 'shore'], o.levels) }];
  return { grid: G, map: { outdoor: false, face: 'rock', plinth: 'stone', music: 'dungeon', ambient: false, objects, npcs: [], items, encounters, spawns, warps: [], events: [], trainers: [] },
    dialogs: {}, info: { trees: 0, zones: 1, chests: items.length, reachable: floors.length, exits: ['sued'] } };
}

// ---------------------------------------------------------------------------------------------------------
function components(G, pred, W, H) {
  const seen = new Uint8Array(W * H), out = [];
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || !pred(s)) continue;
    const comp = [], st = [s]; seen[s] = 1;
    while (st.length) {
      const i = st.pop(); comp.push(i);
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (!seen[j] && pred(j)) { seen[j] = 1; st.push(j); } }
    }
    out.push(comp);
  }
  return out;
}
// einzelne Höhen-Zacken und 1-Tile-Kanten glätten (Klippen sollen als ruhige Plateaus lesen)
function smoothHeights(G, passes) {
  const { w: W, h: H } = G;
  for (let p = 0; p < passes; p++) {
    const nh = G.hm.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, v = G.hm[i];
      let same = 0, lower = 0, higher = 0;
      for (const [dx, dy] of N4) { const h = G.H(x + dx, y + dy); if (h < 0) { same++; continue; } if (h === v) same++; else if (h < v) lower++; else higher++; }
      if (same <= 1 && lower >= 2) nh[i] = v - 1;
      else if (same <= 1 && higher >= 3) nh[i] = v + 1;
      // vertikal 1 Tile dünne Plateaus (Klippenfront ohne Oberfläche) vermeiden
      if (v > 0 && G.H(x, y - 1) >= 0 && G.H(x, y - 1) < v && G.H(x, y + 1) >= 0 && G.H(x, y + 1) < v) nh[i] = v - 1;
    }
    G.hm = nh;
  }
}

/** Ergebnis in eine (neue oder bestehende) Editor-Karte schreiben. charFor/format aus editor/src/format.js. */
export function writeInto(map, res, charFor) {
  const G = res.grid;
  map.w = G.w; map.h = G.h; map.legend = {};
  const ground = [], height = [];
  for (let y = 0; y < G.h; y++) {
    let g = '', h = '';
    for (let x = 0; x < G.w; x++) { const i = y * G.w + x; g += charFor(map, G.t[i]); h += String(Math.max(0, Math.min(9, G.hm[i]))); }
    ground.push(g); height.push(h);
  }
  map.layers = { ...(map.layers || {}), ground, height };
  Object.assign(map, res.map);
  return map;
}
