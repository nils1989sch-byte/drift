// STUB (Regie) – wird vom Pixel-Art-Agenten ersetzt.
import { TILE_DEFS } from '../data/tiles.js';
const C = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d')); return c; };
const COLORS = { grass: '#58a838', water: '#3870d0', stairs: '#a89070', void: '#000', path: '#c8a870', dirt: '#a07850' };
export function buildAssets() {
  const tiles = {};
  for (const id of Object.keys(TILE_DEFS)) tiles[id] = [C(16, 16, (g) => { g.fillStyle = COLORS[id] || '#68b048'; g.fillRect(0, 0, 16, 16); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 15, 16, 1); })];
  const faces = { rock: [C(16, 16, (g) => { g.fillStyle = '#806850'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#5a4838'; g.fillRect(0, 12, 16, 4); })] };
  faces.dirt = faces.brick = faces.rock;
  const hero = C(16, 24, (g) => { g.fillStyle = '#30a030'; g.fillRect(3, 4, 10, 18); g.fillStyle = '#f0c8a0'; g.fillRect(4, 6, 8, 6); });
  const sprites = { hero_idle_down: [hero], hero_walk_down: [hero] };
  return { tiles, faces, sprites, icons: {}, font: null, palette: {} };
}
