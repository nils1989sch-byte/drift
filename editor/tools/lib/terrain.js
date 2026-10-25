// Terrain painting with automatic transitions ("halo" rules, inspired by Tiled's terrain sets but on the
// material level: the renderer draws the tiles, we choose sensible neighbour materials).
import { N4, N8 } from './grid.js';

// materials offered by the terrain brush (tile id, label, swatch colour for UI)
export const MATERIALS = [
  { id: 'grass', label: 'Gras', color: '#6cb04a' },
  { id: 'grass_light', label: 'Helles Gras', color: '#9ccc5a' },
  { id: 'grass_dark', label: 'Dunkles Gras', color: '#3f8a3c' },
  { id: 'grass_flowers', label: 'Blumenwiese', color: '#b6d06a' },
  { id: 'grass_tall', label: 'Hohes Gras', color: '#2f7a34' },
  { id: 'clearing', label: 'Lichtung', color: '#c4d88a' },
  { id: 'dirt', label: 'Erde', color: '#a0784a' },
  { id: 'path', label: 'Weg', color: '#d6b47a' },
  { id: 'sand', label: 'Sand', color: '#e8d498' },
  { id: 'shallow', label: 'Flachwasser', color: '#7cc8d8' },
  { id: 'water', label: 'Wasser', color: '#3a7ec0' },
  { id: 'stone_floor', label: 'Pflaster', color: '#a8a49a' },
  { id: 'soil', label: 'Ackerboden', color: '#7a5034' },
  { id: 'wood_floor', label: 'Holzboden', color: '#b08050' },
  { id: 'dungeon_floor', label: 'Höhlenboden', color: '#6a6470' },
  { id: 'dungeon_wall', label: 'Höhlenwand', color: '#3a3440' },
];
export const MAT_COLOR = Object.fromEntries(MATERIALS.map((m) => [m.id, m.color]));
Object.assign(MAT_COLOR, { stairs: '#c8a878', bridge: '#9a6a3a', pit: '#101018', void: '#000000', water_edge_n: '#3a7ec0', soil_wet: '#5a3824' });

const GRASSY = new Set(['grass', 'grass_light', 'grass_dark', 'grass_flowers', 'grass_tall', 'clearing']);
export const isGrassy = (t) => GRASSY.has(t);
const LANDISH = (t) => t && t !== 'water' && t !== 'water_edge_n' && t !== 'shallow' && t !== 'void';

// Transition rules: when `a` touches `b`, the `b` cell may become `to` (prob p).
// Applied only to the ring around the stroke, so hand-made details elsewhere survive.
export const RULES = [
  { a: 'water', b: GRASSY, to: 'sand', p: 1, name: 'Ufer' },
  { a: 'water', b: new Set(['path', 'dirt']), to: 'sand', p: 1 },
  { a: 'shallow', b: GRASSY, to: 'sand', p: 0.55 },
  { a: 'path', b: new Set(['grass', 'grass_dark', 'grass_tall']), to: 'grass_light', p: 0.45, name: 'Wegrand' },
  { a: 'sand', b: new Set(['grass', 'grass_dark']), to: 'grass_light', p: 0.35 },
  { a: 'dirt', b: new Set(['grass', 'grass_dark']), to: 'grass_light', p: 0.3 },
  { a: 'stone_floor', b: new Set(['grass', 'grass_dark']), to: 'clearing', p: 0.4 },
  { a: 'grass_tall', b: new Set(['grass']), to: 'grass_dark', p: 0.25 },
];

// organic circular dab with noisy edge. Returns the list of touched cell indices.
export function dab(grid, cx, cy, r, tile, o = {}) {
  const touched = [];
  const nz = o.noise, jitter = o.jitter ?? 0.35, only = o.only, height = o.height;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      if (!grid.ok(x, y)) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const edge = r * (1 + (nz ? (nz(x * 0.35, y * 0.35, 2) - 0.5) * 2 * jitter : 0));
      if (d > Math.max(0.5, edge)) continue;
      if (only && !only(grid.get(x, y), x, y)) continue;
      if (tile != null) grid.set(x, y, tile);
      if (height != null) grid.setH(x, y, height);
      touched.push(y * grid.w + x);
    }
  return touched;
}

// apply halo rules + water depth shaping around the touched cells
export function autoTransition(grid, touched, r = Math.random, o = {}) {
  if (o.off) return;
  const ring = new Set();
  for (const i of touched) {
    const x = i % grid.w, y = (i / grid.w) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (grid.ok(x + dx, y + dy)) ring.add((y + dy) * grid.w + x + dx);
  }
  const snap = new Map([...ring].map((i) => [i, grid.t[i]]));
  // 1) water: cells of water touching land become shallow (keeps a deep core of width ≥ 1)
  if (o.shallowEdge !== false) for (const i of ring) {
    if (snap.get(i) !== 'water') continue;
    const x = i % grid.w, y = (i / grid.w) | 0;
    let land = 0, deep = 0;
    for (const [dx, dy] of N8) { const t = grid.get(x + dx, y + dy); if (t == null) continue; if (LANDISH(t) && t !== 'bridge') land++; else if (t === 'water') deep++; }
    if (land >= 2 && deep >= 3) grid.set(x, y, 'shallow');
  }
  // 2) halo rules
  for (const i of ring) {
    const x = i % grid.w, y = (i / grid.w) | 0;
    const t = grid.t[i];
    for (const rule of RULES) {
      if (!(rule.b instanceof Set ? rule.b.has(t) : rule.b === t)) continue;
      let touch = false;
      for (const [dx, dy] of N4) if (grid.get(x + dx, y + dy) === rule.a || (rule.a === 'water' && grid.get(x + dx, y + dy) === 'shallow' && snap.get((y + dy) * grid.w + x + dx) === 'water')) { touch = true; break; }
      if (touch && r() < rule.p) { grid.set(x, y, rule.to); break; }
    }
  }
  // 3) water must be flat: equalise heights of connected water cells in the ring to their minimum neighbour
  for (const i of ring) {
    const t = grid.t[i]; if (t !== 'water' && t !== 'shallow') continue;
    const x = i % grid.w, y = (i / grid.w) | 0;
    let mh = grid.H(x, y);
    for (const [dx, dy] of N4) { const t2 = grid.get(x + dx, y + dy); if (t2 === 'water' || t2 === 'shallow') mh = Math.min(mh, grid.H(x + dx, y + dy)); }
    grid.setH(x, y, mh);
  }
}
