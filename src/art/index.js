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
import { buildProps } from './props.js';
import { buildDecoHD } from './decohd.js';
import { hdifyFrames } from './hdsprite.js';
import { RES, buildTilesHD, buildEdgesHD, buildFacesHD, buildLeafAndHouseHD, tilePixHD } from './hd.js';
import { grassTallSprite, edgeMeta } from './terrain.js';

export { palette };

export function buildAssets() {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const times = {};
  const tm = (k, f) => { const a = performance.now(); const v = f(); times[k] = Math.round(performance.now() - a); return v; };
  // environment: HD textures (48 texels per tile); edgeGroup/edgePriority from the terrain module
  const tiles = tm('tiles', buildTilesHD);
  const { edgeGroup, edgePriority } = edgeMeta();
  const edges = tm('edges', () => buildEdgesHD(tilePixHD(tiles)));
  const faces = tm('faces', buildFacesHD);
  const sprites = Object.assign({}, tm('hero', buildHero), tm('soldier', buildSoldier), tm('actors', buildActors), tm('objects', buildObjects), tm('fx', buildFX), tm('deco', buildDeco));
  sprites.grass_tall = grassTallSprite();
  Object.assign(sprites, tm('hdtex', buildLeafAndHouseHD), tm('props', buildProps), tm('decohd', buildDecoHD));
  // double-density painterly props / pickups / small deco (ws = 0.5); figures, trees (3D models), FX and icons stay
  tm('hdify', () => {
    const HD = /^(barrel|crate|sack|cart|well|gravestone|lantern|tools|hay|bench|flowerbox|wall_cracked|door_locked|shutter|rock_cracked|cave_entrance|crystal|portal|pot|sign|statue|fence|fence_h|fence_v|chest_closed|chest_open|rock|rock_big|stump|mushroom|flower|flower_white|flower_yellow|lilypad|bush_cut|block|switch_up|switch_down|torch|bomb|heart_container|heart_pickup|rupee_green|rupee_blue|rupee_red|key_small|house|deco_fern_1|deco_fern_2|deco_reed_1|deco_reed_2|deco_pebble_1|deco_pebble_2)$/;
    let k = 0;
    for (const key of Object.keys(sprites)) if (HD.test(key)) sprites[key] = hdifyFrames(sprites[key], 100 + k++ * 7);
  });
  const icons = tm('icons', buildIcons);
  const assets = { tileRes: RES, tiles, faces, sprites, icons, font: null, palette: { ...palette }, edges, edgeGroup, edgePriority };
  assets.buildTimes = times;
  assets.buildMs = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0;
  return assets;
}
