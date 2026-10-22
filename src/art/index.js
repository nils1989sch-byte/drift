// DRIFT procedural pixel-art library. buildAssets() paints every asset from code (no images, no network).
// Contract: docs/ARCHITECTURE.md, docs/ASSET_LIST.md; style: docs/STYLE_GUIDE.md.
import { palette } from './palette.js';
import { buildTiles, buildEdges, buildFaces } from './tiles.js';
import { buildHero, buildSoldier } from './hero.js';
import { buildActors } from './actors.js';
import { buildObjects } from './objects.js';
import { buildFX } from './fx.js';
import { buildIcons } from './icons.js';

export { palette };

export function buildAssets() {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const tiles = buildTiles();
  const { edges, edgeGroup, edgePriority } = buildEdges();
  const faces = buildFaces();
  const sprites = Object.assign({}, buildHero(), buildSoldier(), buildActors(), buildObjects(), buildFX());
  const icons = buildIcons();
  const assets = { tiles, faces, sprites, icons, font: null, palette: { ...palette }, edges, edgeGroup, edgePriority };
  assets.buildMs = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0;
  return assets;
}
