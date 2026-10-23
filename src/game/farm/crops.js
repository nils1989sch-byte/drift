// Crop definitions + crop growth logic + crop Drawables (Gameplay-Agent B).
// Growth: a crop grows only on days it was watered (field.wet at the end of the day). `days` watered days → ripe.
// Sprite keys: crop_<id>_<stage>, stage 0..stages-1, the last stage is ripe (drawn by the art agent; fallback below).
import { TILE } from '../../engine/constants.js';

// days: watered days until ripe; stages: number of sprite stages (incl. ripe);
// regrow: days until the next harvest (multi-harvest); yield: [min,max] items per harvest; bonus: chance of +1;
// seedPrice: shop price per seed (Taler); sell: sale value per harvested item (Taler); color: fallback fruit colour.
export const CROPS = {
  // values from docs/reference/MONSTER_FARM_GUIDE.md §3 (currency "Taler")
  weizen:    { name: 'Weizen', days: 4, stages: 4, yield: [1, 1], seedPrice: 10, sell: 25, seasons: ['fruehling'], color: '#e8c050', leaf: '#a0b040', sickle: true },
  ruebe:     { name: 'Rübe', days: 4, stages: 4, yield: [1, 1], seedPrice: 15, sell: 35, seasons: ['fruehling'], color: '#e8e0f0', leaf: '#58b040' },
  kartoffel: { name: 'Kartoffel', days: 5, stages: 4, yield: [1, 1], bonus: 0.2, seedPrice: 25, sell: 55, seasons: ['fruehling'], color: '#c89858', leaf: '#4a9838' },
  blaubeere: { name: 'Blaubeere', days: 6, stages: 5, regrow: 2, yield: [3, 3], seedPrice: 40, sell: 20, seasons: ['fruehling'], color: '#4060d0', leaf: '#3a8048' },
  erdbeere:  { name: 'Erdbeere', days: 6, stages: 5, regrow: 3, yield: [1, 1], seedPrice: 60, sell: 30, seasons: ['fruehling'], color: '#e03848', leaf: '#3c9040' },
  kuerbis:   { name: 'Kürbis', days: 8, stages: 5, yield: [1, 1], seedPrice: 80, sell: 220, seasons: ['fruehling'], color: '#f08a20', leaf: '#4c8c30' },
};
export const CROP_IDS = Object.keys(CROPS);

/** New crop state stored on a field. */
export function newCrop(id) { return { id, g: 0, harvests: 0, age: 0 }; }

export function isRipe(crop) { const d = CROPS[crop?.id]; return !!d && crop.g >= d.days - 1e-6; }

/** Sprite stage 0..stages-1 (stage 0 = freshly sown, last = ripe). */
export function cropStage(crop) {
  const d = CROPS[crop?.id];
  if (!d) return 0;
  const n = d.stages;
  if (crop.g >= d.days - 1e-6) return n - 1;
  if (crop.g <= 0) return 0;
  // regrowing multi-harvest crops show the stage just before ripe
  if (crop.harvests > 0) return Math.max(1, n - 2);
  return Math.min(n - 2, 1 + Math.floor((crop.g / d.days) * (n - 2)));
}

/** One night of growth. rate = 1 (+0.1 per plant helper). Returns true if it just became ripe. */
export function growCrop(crop, watered, rate = 1) {
  const d = CROPS[crop?.id];
  if (!d) return false;
  crop.age++;
  if (!watered || isRipe(crop)) return false;
  crop.g = Math.min(d.days, crop.g + rate);
  return isRipe(crop);
}

/** Harvest: returns { item, n, remove } (remove = field becomes empty) or null if not ripe. */
export function harvestCrop(crop, rnd = Math.random) {
  const d = CROPS[crop?.id];
  if (!d || !isRipe(crop)) return null;
  const [a, b] = d.yield;
  let n = a + Math.floor(rnd() * (b - a + 1));
  if (d.bonus && rnd() < d.bonus) n++;
  crop.harvests++;
  if (d.regrow) { crop.g = d.days - d.regrow; return { item: 'crop_' + crop.id, n, remove: false }; }
  return { item: 'crop_' + crop.id, n, remove: true };
}

// ---- drawing ---------------------------------------------------------------------------------------------
const fbCache = new Map();
function fallbackCrop(id, stage) {
  const key = id + '_' + stage;
  if (fbCache.has(key)) return fbCache.get(key);
  let c = null;
  try {
    if (typeof document !== 'undefined') {
      const d = CROPS[id] || { stages: 4, color: '#e0e0e0', leaf: '#50a040' };
      c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const g = c.getContext('2d');
      const last = d.stages - 1;
      const k = last ? stage / last : 1;
      const ink = '#1c2a18';
      if (stage === 0) { // seed mound
        g.fillStyle = '#5a3a24'; g.fillRect(5, 13, 6, 2); g.fillStyle = '#e8d8a0'; g.fillRect(6, 12, 1, 1); g.fillRect(9, 12, 1, 1);
      } else {
        const h = Math.round(3 + k * 8);
        g.fillStyle = ink; g.fillRect(7, 15 - h, 2, h);
        g.fillStyle = d.leaf; g.fillRect(7, 15 - h + 1, 1, h - 1);
        const lw = Math.round(2 + k * 3);
        g.fillStyle = ink; g.fillRect(8 - lw - 1, 15 - Math.ceil(h * 0.6) - 1, lw + 1, 3); g.fillRect(9, 15 - Math.ceil(h * 0.8) - 1, lw + 1, 3);
        g.fillStyle = d.leaf; g.fillRect(8 - lw, 15 - Math.ceil(h * 0.6), lw, 1); g.fillRect(9, 15 - Math.ceil(h * 0.8), lw, 1);
        if (stage === last) {
          g.fillStyle = ink; g.fillRect(4, 13 - h, 8, 5);
          g.fillStyle = d.color; g.fillRect(5, 14 - h, 6, 3);
          g.fillStyle = '#fff8e0'; g.fillRect(6, 14 - h, 1, 1);
        }
      }
      c.ax = 8; c.ay = 15; c.fallback = true;
    }
  } catch { c = null; }
  fbCache.set(key, c);
  return c;
}

export function cropSprite(assets, id, stage, t = 0) {
  const arr = assets?.sprites?.[`crop_${id}_${stage}`];
  if (arr && !Array.isArray(arr)) return arr;
  if (arr && arr.length) return arr.length === 1 ? arr[0] : arr[Math.floor(t * (arr.fps || 3)) % arr.length];
  return fallbackCrop(id, stage);
}

/** Drawable for one planted field (same shape as entities: {x, y, z, draw(ctx, r)}). */
export class CropDrawable {
  constructor(field, lvl = 0) {
    this.field = field;
    this.kind = 'crop';
    this.x = field.tx * TILE + 8;
    this.y = field.ty * TILE + 13;
    this.lvl = lvl; this.z = lvl;
    this.shadow = false;
    this.sortBias = -1;
    this.phase = ((field.tx * 7 + field.ty * 13) % 10) / 10;
  }
  draw(ctx, r) {
    const c = this.field.crop;
    if (!c) return;
    const st = cropStage(c);
    const img = cropSprite(r.assets, c.id, st, (r.time || 0) + this.phase);
    if (!img) return;
    const ripe = st === (CROPS[c.id]?.stages ?? 1) - 1;
    // ripe crops sway a little so they read as "ready"
    const hop = ripe ? Math.max(0, Math.sin(((r.time || 0) + this.phase * 6) * 3)) * 0.6 : 0;
    r.sprite(img, this.x, this.y, this.z, { hop });
  }
}
