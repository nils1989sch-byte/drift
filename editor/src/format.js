// DRIFT-Editor – Datenformat (docs/CONTENT_FORMAT.md, drift-content@1).
// Der Editor hält editor.doc im KANONISCHEN Format (Karten mit layers.ground/height als Zeilen-Strings + legend).
// Dieses Modul normalisiert geladene Daten, legt neue Karten/Projekte an und (de)serialisiert .drift.json-Bündel.
// Sobald src/content/ (Content-Agent) existiert, werden dessen Validierung/Migration zusätzlich genutzt (siehe content.js).
import { LEGEND_DEFAULT } from '../../src/data/tiles.js';

export const FORMAT = 'drift-content@1';
export const TILE = 16;
export const MAX_H = 9;
const REV_DEFAULT = Object.fromEntries(Object.entries(LEGEND_DEFAULT).map(([k, v]) => [v, k]));
// characters used for tile ids that are not in the legend yet (never digits, so RLE stays unambiguous)
const FREE = 'abdeghijklmnpqrtuvxyzABCDEFGIJKLMNPQRSTUVXYZ!$%&()+/<>?@[]^`{|}\'';

export const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

/** rows: array of strings | string with \n | RLE rows ("12.3=") → array of exactly h strings of length w */
export function decodeRows(layer, w, h, fill) {
  if (layer == null) return Array.from({ length: h }, () => fill.repeat(w));
  let rows = Array.isArray(layer) ? layer.slice() : String(layer).split('\n');
  rows = rows.map((r) => {
    r = String(r ?? '');
    if (r.length !== w && /\d/.test(r) && /^(\d*[^\d])+$/.test(r)) {
      let out = ''; const re = /(\d*)([^\d])/g; let m;
      while ((m = re.exec(r))) out += m[2].repeat(m[1] ? +m[1] : 1);
      if (out.length === w) return out;
    }
    return r;
  });
  while (rows.length < h) rows.push(fill.repeat(w));
  return rows.slice(0, h).map((r) => (r.length >= w ? r.slice(0, w) : r + fill.repeat(w - r.length)));
}

export function fullLegend(map) { return { ...LEGEND_DEFAULT, ...(map.legend || {}) }; }

/** char for a tile id in this map's legend; adds a new legend entry when needed (mutates map.legend) */
export function charFor(map, id) {
  const lg = map.legend || (map.legend = {});
  for (const [c, v] of Object.entries(lg)) if (v === id) return c;
  const d = REV_DEFAULT[id];
  if (d != null && !(d in lg)) return d;
  for (const c of FREE) if (!(c in lg) && !(c in LEGEND_DEFAULT)) { lg[c] = id; return c; }
  for (let k = 0xc0; k < 0x2000; k++) { const c = String.fromCharCode(k); if (!(c in lg)) { lg[c] = id; return c; } }
  return '?';
}

/** normalise one map in place to the canonical in-editor shape */
export function normalizeMap(m, idHint) {
  m.id = String(m.id || idHint || 'karte');
  m.name = m.name ?? m.id;
  // legacy game shape (rows/heights) → layers
  if (!m.layers && (m.rows || m.heights)) { m.layers = { ground: m.rows, height: m.heights }; delete m.rows; delete m.heights; }
  m.layers = m.layers || {};
  const g0 = m.layers.ground;
  const rowsGuess = Array.isArray(g0) ? g0 : typeof g0 === 'string' ? g0.split('\n') : [];
  m.h = (m.h | 0) || rowsGuess.length || 24;
  m.w = (m.w | 0) || Math.max(1, ...rowsGuess.map((r) => r.length)) || 32;
  const lg = fullLegend(m);
  const fillCh = charFor(m, 'grass');
  m.layers.ground = decodeRows(m.layers.ground, m.w, m.h, fillCh).map((r) => [...r].map((c) => (c in lg ? c : fillCh)).join(''));
  m.layers.height = decodeRows(m.layers.height, m.w, m.h, '0').map((r) => r.replace(/[^0-9]/g, '0'));
  m.legend = m.legend || {};
  for (const k of ['objects', 'npcs', 'trainers', 'encounters', 'items', 'warps', 'events']) if (!Array.isArray(m[k])) m[k] = m[k] ? Object.values(m[k]) : [];
  if (!m.spawns || typeof m.spawns !== 'object') m.spawns = {};
  if (m.outdoor === undefined) m.outdoor = true;
  m.face = m.face || 'rock';
  m.plinth = m.plinth || 'earth';
  return m;
}

export function normalizeProject(p) {
  p.format = FORMAT;
  p.name = p.name || 'Mein Abenteuer';
  p.start = p.start || {};
  p.starters = p.starters || ['funkel', 'tropfi', 'sprossi'];
  p.flags = p.flags || {};
  return p;
}

/** bundle (.drift.json / localStorage) → editor.doc. Accepts { project, maps } or a lone map. */
export function docFromBundle(b) {
  if (!b || typeof b !== 'object') throw new Error('Keine gültige Projektdatei');
  if (b.layers || b.rows) b = { project: { name: b.name || b.id, start: { map: b.id, spawn: Object.keys(b.spawns || {})[0] || 'start' } }, maps: { [b.id]: b } };
  const doc = {
    project: normalizeProject(clone(b.project || { name: b.name })),
    maps: {}, species: clone(b.species || {}), moves: clone(b.moves || {}), characters: clone(b.characters || {}), dialogs: clone(b.dialogs || {}),
  };
  // keep unknown top-level collections
  for (const [k, v] of Object.entries(b)) if (!(k in doc) && k !== 'format' && k !== 'editor') doc[k] = clone(v);
  const maps = Array.isArray(b.maps) ? Object.fromEntries(b.maps.map((m) => [m.id, m])) : (b.maps || {});
  for (const [id, m] of Object.entries(maps)) { const mm = normalizeMap(clone(m), id); doc.maps[mm.id] = mm; }
  if (!Object.keys(doc.maps).length) { const m = newMap({ id: 'route_1', name: 'Route 1' }); doc.maps[m.id] = m; }
  if (!doc.project.start.map || !doc.maps[doc.project.start.map]) doc.project.start = { map: Object.keys(doc.maps)[0], spawn: 'start' };
  return doc;
}

/** editor.doc → bundle for export / playtest (pure JSON, canonical content format) */
export function bundleFromDoc(doc, extra = {}) {
  const out = { format: FORMAT, ...clone(doc), ...extra };
  out.project = { ...out.project, format: FORMAT };
  return out;
}

export function newMap({ id = 'karte', name, w = 32, h = 24, tile = 'grass', height = 0, outdoor = true } = {}) {
  const m = { id, name: name || id, w, h, outdoor, face: outdoor ? 'rock' : 'brick', plinth: outdoor ? 'earth' : 'stone', music: outdoor ? 'overworld' : 'dungeon', ambient: outdoor,
    layers: {}, legend: {}, objects: [], npcs: [], trainers: [], encounters: [], items: [], warps: [], spawns: {}, events: [] };
  const c = charFor(m, tile);
  m.layers.ground = Array.from({ length: h }, () => c.repeat(w));
  m.layers.height = Array.from({ length: h }, () => String(Math.max(0, Math.min(MAX_H, height | 0))).repeat(w));
  m.spawns.start = { x: Math.floor(w / 2) * TILE + 8, y: Math.floor(h / 2) * TILE + 12, dir: 'down' };
  return m;
}

/** decoded cache of a map: ids per cell + heights */
export function decodeGrid(m) {
  const lg = fullLegend(m), w = m.w, h = m.h;
  const ground = new Array(w * h), height = new Uint8Array(w * h);
  const G = m.layers.ground, H = m.layers.height;
  for (let y = 0; y < h; y++) {
    const gr = G[y] || '', hr = H[y] || '';
    for (let x = 0; x < w; x++) {
      ground[y * w + x] = lg[gr[x]] || 'grass';
      const c = hr.charCodeAt(x) - 48;
      height[y * w + x] = c >= 0 && c <= 9 ? c : 0;
    }
  }
  return { w, h, ground, height };
}

/** resized copy of a map; anchor ax/ay ∈ {0, 0.5, 1}; new cells filled with `tile` */
export function resizeMap(m, w, h, ax = 0, ay = 0, tile = 'grass') {
  const n = clone(m);
  const dx = Math.round((w - m.w) * ax), dy = Math.round((h - m.h) * ay);
  const fc = charFor(n, tile);
  const G = [], H = [];
  for (let y = 0; y < h; y++) {
    let gr = '', hr = '';
    const sy = y - dy;
    for (let x = 0; x < w; x++) {
      const sx = x - dx;
      const ok = sx >= 0 && sy >= 0 && sx < m.w && sy < m.h;
      gr += ok ? m.layers.ground[sy][sx] : fc;
      hr += ok ? m.layers.height[sy][sx] : '0';
    }
    G.push(gr); H.push(hr);
  }
  n.w = w; n.h = h; n.layers = { ...n.layers, ground: G, height: H };
  const px = dx * TILE, py = dy * TILE;
  const inRect = (r) => r && (r[0] += dx, r[1] += dy);
  for (const k of ['objects', 'npcs', 'trainers', 'items']) for (const o of n[k] || []) { o.x += px; o.y += py; }
  for (const s of Object.values(n.spawns || {})) { s.x += px; s.y += py; }
  for (const z of n.encounters || []) inRect(z.rect);
  for (const z of n.warps || []) inRect(z.rect);
  for (const z of n.events || []) inRect(z.trigger?.rect);
  if (n.farm?.rect) inRect(n.farm.rect);
  const inside = (o) => o.x >= 0 && o.y >= 0 && o.x < w * TILE && o.y < h * TILE;
  for (const k of ['objects', 'npcs', 'trainers', 'items']) n[k] = (n[k] || []).filter(inside);
  return n;
}

/** a small but complete starter route so the first look (2D + HD-2D) is inviting */
export function starterProject() {
  const m = newMap({ id: 'route_1', name: 'Route 1', w: 40, h: 30 });
  const set = (x, y, id) => { const c = charFor(m, id); const r = m.layers.ground[y]; m.layers.ground[y] = r.slice(0, x) + c + r.slice(x + 1); };
  const setH = (x, y, v) => { const r = m.layers.height[y]; m.layers.height[y] = r.slice(0, x) + v + r.slice(x + 1); };
  const blob = (cx, cy, rx, ry, id) => { for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) set(x, y, id); };
  blob(10, 8, 6, 4, 'grass_light'); blob(30, 22, 6, 4, 'grass_dark');
  // plateau in the north-east with stairs
  for (let y = 0; y < 10; y++) for (let x = 26; x < 40; x++) setH(x, y, '1');
  for (let y = 0; y < 5; y++) for (let x = 31; x < 40; x++) setH(x, y, '2');
  set(29, 10 - 1, 'stairs'); set(30, 9, 'stairs');
  // winding path
  for (let x = 0; x < 40; x++) { const y = 18 + Math.round(Math.sin(x / 5) * 2); set(x, y, 'path'); set(x, y + 1, 'path'); }
  for (let y = 10; y < 18; y++) { set(29, y, 'path'); set(30, y, 'path'); }
  // pond
  blob(12, 24, 4, 2.6, 'shallow'); blob(12, 24, 2.8, 1.6, 'water');
  // tall grass
  blob(20, 9, 4, 2.5, 'grass_tall'); blob(34, 25, 3, 2, 'grass_tall');
  blob(6, 13, 2, 1.5, 'grass_flowers');
  const T = TILE;
  const trees = [[2, 2], [4, 1], [1, 5], [3, 27], [7, 28], [17, 2], [24, 4], [37, 13], [38, 16], [22, 27], [26, 28], [36, 7], [33, 6]];
  for (const [x, y] of trees) m.objects.push({ type: (x + y) % 3 ? 'tree' : 'tree_pine', x: x * T + 8, y: y * T + 14 });
  m.objects.push({ type: 'bush', x: 15 * T + 8, y: 14 * T + 14 }, { type: 'rock', x: 24 * T + 8, y: 15 * T + 14 }, { type: 'sign', x: 5 * T + 8, y: 16 * T + 14, text: ['Route 1 – Willkommen!'] },
    { type: 'flower', x: 8 * T + 8, y: 12 * T + 14 }, { type: 'barrel', x: 33 * T + 8, y: 2 * T + 14 }, { type: 'lantern', x: 28 * T + 8, y: 16 * T + 14 });
  m.items.push({ type: 'chest', x: 37 * T + 8, y: 2 * T + 14, contents: { item: 'orb', count: 3 }, flag: 'route_1_chest_1' });
  m.npcs.push({ id: 'wanderer', character: 'elder', x: 9 * T + 8, y: 17 * T + 12, dir: 'down', dialog: 'wanderer_hallo' });
  m.encounters.push({ id: 'gras_nord', rect: [16, 7, 9, 5], tiles: ['grass_tall'], density: 3, table: [{ species: 'zappi', levels: [3, 5], weight: 50 }, { species: 'pilzling', levels: [3, 6], weight: 30, time: 'night' }] });
  m.spawns.start = { x: 3 * T + 8, y: 18 * T + 12, dir: 'right' };
  return docFromBundle({
    project: { name: 'Meine Welt', start: { map: 'route_1', spawn: 'start' } },
    maps: { route_1: m },
    dialogs: { wanderer_hallo: { id: 'wanderer_hallo', speaker: 'Wanderer', lines: ['Schöner Tag für eine Route!', 'Im hohen Gras verstecken sich Monster.'] } },
  });
}
