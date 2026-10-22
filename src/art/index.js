// DRIFT procedural pixel-art library. buildAssets() paints every asset from code (no images, no network).
// Contract: docs/ARCHITECTURE.md, docs/ASSET_LIST.md; style: docs/STYLE_GUIDE.md.
import { palette } from './palette.js';
import { buildTiles, buildEdges, buildFaces } from './tiles.js';
import { buildHero, buildSoldier } from './hero.js';
import { buildActors } from './actors.js';
import { buildObjects } from './objects.js';
import { buildFX } from './fx.js';
import { buildIcons } from './icons.js';
import { buildDeco } from './deco.js';
import { RES, buildTilesHD, buildEdgesHD, buildFacesHD, buildLeafAndHouseHD, tilePixHD } from './hd.js';
import { grassTallSprite } from './terrain.js';

export { palette };

export function buildAssets() {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const times = {};
  const tm = (k, f) => { const a = performance.now(); const v = f(); times[k] = Math.round(performance.now() - a); return v; };
  // environment: HD textures (48 texels per tile); edgeGroup/edgePriority from the terrain module
  const tiles = tm('tiles', buildTilesHD);
  const { edgeGroup, edgePriority } = buildEdges();
  const edges = tm('edges', () => buildEdgesHD(tilePixHD(tiles)));
  const faces = tm('faces', buildFacesHD);
  const sprites = Object.assign({}, tm('hero', buildHero), tm('soldier', buildSoldier), tm('actors', buildActors), tm('objects', buildObjects), tm('fx', buildFX), tm('deco', buildDeco));
  sprites.grass_tall = grassTallSprite();
  Object.assign(sprites, tm('hdtex', buildLeafAndHouseHD));
  const icons = tm('icons', buildIcons);
  const assets = { tileRes: RES, tiles, faces, sprites, icons, font: null, palette: { ...palette }, edges, edgeGroup, edgePriority };
  assets.buildTimes = times;
  assets.buildMs = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0;
  return assets;
}
