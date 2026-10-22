import { TILE } from './constants.js';
import { TILE_DEFS, LEGEND_DEFAULT } from '../data/tiles.js';

// rows: array of strings (ground chars), heights: array of strings of digits (same size, optional).
export function parseMap({ id, rows, heights, legend = {}, face = 'rock', plinth = 'earth', ...rest }) {
  const lg = { ...LEGEND_DEFAULT, ...legend };
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const ground = new Array(w * h);
  const height = new Array(w * h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? ' ';
      const id = lg[ch];
      if (!id) throw new Error(`Map ${rest.id || ''}: unknown legend char '${ch}' at ${x},${y}`);
      ground[y * w + x] = id;
      if (heights) {
        const hc = heights[y]?.[x];
        height[y * w + x] = hc && hc >= '0' && hc <= '9' ? +hc : 0;
      }
    }
  }
  return createWorld({ id, w, h, ground, height, face, plinth, ...rest });
}

export function createWorld(map) {
  const { w, h } = map;
  const inside = (tx, ty) => tx >= 0 && ty >= 0 && tx < w && ty < h;
  const world = {
    ...map,
    pxW: w * TILE,
    pxH: h * TILE,
    inside,
    tileAt(tx, ty) { return inside(tx, ty) ? map.ground[ty * w + tx] : 'void'; },
    version: 0,
    dirty: [],   // cells changed via setTile since the renderer last looked (renderer clears it)
    setTile(tx, ty, id) {
      if (!inside(tx, ty) || map.ground[ty * w + tx] === id) return;
      map.ground[ty * w + tx] = id; world.version++; world.dirty.push(ty * w + tx);
    },
    heightAt(tx, ty) { return inside(tx, ty) ? map.height[ty * w + tx] : 0; },
    def(tx, ty) { return TILE_DEFS[world.tileAt(tx, ty)] || TILE_DEFS.void; },
    // Height at a world-pixel point.
    heightAtPx(px, py) { return world.heightAt(Math.floor(px / TILE), Math.floor(py / TILE)); },
    // Is the world-pixel point walkable for something currently at height z?
    walkable(px, py, z) {
      const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
      if (!inside(tx, ty)) return false;
      const d = world.def(tx, ty);
      if (d.solid) return false;
      const hz = world.heightAt(tx, ty);
      if (hz === z) return true;
      // stairs bridge one level in either direction
      if (Math.abs(hz - z) === 1 && (d.stairs || TILE_DEFS[world.tileAtPx(px, py)]?.stairs)) return true;
      return false;
    },
    tileAtPx(px, py) { return world.tileAt(Math.floor(px / TILE), Math.floor(py / TILE)); },
  };
  return world;
}
