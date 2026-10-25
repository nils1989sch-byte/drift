// Working copy of a map's cell layers (ground tile ids + heights) for the smart tools.
// Tools edit a Grid, then `diff()` lists only changed cells so one undoable op can be produced.
import { LEGEND_DEFAULT, TILE_DEFS } from '../../../src/data/tiles.js';

export const TILE = 16;
const REV_DEFAULT = Object.fromEntries(Object.entries(LEGEND_DEFAULT).map(([k, v]) => [v, k]));

// "ground" may be: array of row strings, one string with newlines, or RLE rows ("12.3=5." → count+char).
export function decodeRows(layer, w, h, fill) {
  if (layer == null) return Array.from({ length: h }, () => fill.repeat(w));
  let rows = Array.isArray(layer) ? layer.slice() : String(layer).split('\n');
  rows = rows.map((r) => {
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

export class Grid {
  constructor(w, h, fill = 'grass', hfill = 0) {
    this.w = w; this.h = h;
    this.t = new Array(w * h).fill(fill);
    this.hm = new Int8Array(w * h).fill(hfill);
    this.dirty = new Set();
  }
  static fromMap(map) {
    const w = map.w | 0, h = map.h | 0;
    const g = new Grid(w, h);
    const legend = { ...LEGEND_DEFAULT, ...(map.legend || {}) };
    const L = map.layers || {};
    const ground = decodeRows(L.ground ?? map.rows, w, h, '.');
    const height = decodeRows(L.height ?? map.heights, w, h, '0');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      g.t[i] = legend[ground[y][x]] || 'grass';
      const hv = parseInt(height[y][x], 36); g.hm[i] = Number.isFinite(hv) ? hv : 0;
    }
    g.legend = legend;
    g.orig = { t: g.t.slice(), hm: g.hm.slice() };
    return g;
  }
  clone() {
    const g = new Grid(this.w, this.h); g.t = this.t.slice(); g.hm = this.hm.slice(); g.legend = this.legend; g.orig = this.orig; return g;
  }
  ok(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.ok(x, y) ? this.t[y * this.w + x] : null; }
  H(x, y) { return this.ok(x, y) ? this.hm[y * this.w + x] : -1; }
  set(x, y, tile) { if (!this.ok(x, y) || tile == null) return this; const i = y * this.w + x; if (this.t[i] !== tile) { this.t[i] = tile; this.dirty.add(i); } return this; }
  setH(x, y, v) { if (!this.ok(x, y) || v == null) return this; const i = y * this.w + x; v = Math.max(0, Math.min(9, v | 0)); if (this.hm[i] !== v) { this.hm[i] = v; this.dirty.add(i); } return this; }
  def(x, y) { return TILE_DEFS[this.get(x, y)] || {}; }
  isWater(x, y) { const t = this.get(x, y); return t === 'water' || t === 'water_edge_n'; }
  walkable(x, y) { const d = this.def(x, y); return this.ok(x, y) && !d.solid && !d.pit; }
  // cells changed vs. the original snapshot: [{x,y,i,tile,h,oldTile,oldH}]
  diff() {
    const out = [];
    for (let i = 0; i < this.t.length; i++) {
      if (this.t[i] !== this.orig.t[i] || this.hm[i] !== this.orig.hm[i])
        out.push({ x: i % this.w, y: (i / this.w) | 0, i, tile: this.t[i], h: this.hm[i], oldTile: this.orig.t[i], oldH: this.orig.hm[i] });
    }
    return out;
  }
  // serialise back to the content format (row strings). Unknown tile ids get a free legend char.
  toLayers(legendIn) {
    const legend = { ...(legendIn || this.legend || LEGEND_DEFAULT) };
    const rev = {}; for (const [k, v] of Object.entries(legend)) if (!(v in rev)) rev[v] = k;
    const free = 'abdeghijklmnpqrtuvxyzABCDEFGIJKLMNPQRSTUVXYZ0123456789!$%&()+/<>?@[]^`{|}';
    let fi = 0;
    const ch = (tile) => {
      if (rev[tile] != null) return rev[tile];
      if (REV_DEFAULT[tile] && !(REV_DEFAULT[tile] in legend)) { legend[REV_DEFAULT[tile]] = tile; rev[tile] = REV_DEFAULT[tile]; return rev[tile]; }
      while (fi < free.length && free[fi] in legend) fi++;
      const c = free[fi++] || '?'; legend[c] = tile; rev[tile] = c; return c;
    };
    const ground = [], height = [];
    for (let y = 0; y < this.h; y++) {
      let g = '', hs = '';
      for (let x = 0; x < this.w; x++) { const i = y * this.w + x; g += ch(this.t[i]); hs += this.hm[i].toString(36); }
      ground.push(g); height.push(hs);
    }
    return { ground, height, legend };
  }
}

export const toPx = (tx) => tx * TILE + TILE / 2;
export const toTile = (px) => Math.floor(px / TILE);
export const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

// flood fill over walkable cells honouring height steps (stairs allow ±1). Returns Uint8Array reach mask.
export function reach(grid, sx, sy, blockedSet) {
  const R = new Uint8Array(grid.w * grid.h);
  if (!grid.ok(sx, sy)) return R;
  const st = [[sx, sy]]; R[sy * grid.w + sx] = 1;
  while (st.length) {
    const [x, y] = st.pop();
    const h0 = grid.H(x, y), s0 = grid.def(x, y).stairs;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (!grid.ok(nx, ny)) continue;
      const k = ny * grid.w + nx;
      if (R[k] || !grid.walkable(nx, ny) || (blockedSet && blockedSet.has(k))) continue;
      const h1 = grid.H(nx, ny), s1 = grid.def(nx, ny).stairs;
      if (h1 !== h0 && !((s0 || s1) && Math.abs(h1 - h0) <= 1)) continue;
      R[k] = 1; st.push([nx, ny]);
    }
  }
  return R;
}
