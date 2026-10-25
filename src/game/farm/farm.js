// Farm state: tilled fields + crops on the farm map, shipping bin, bed, monster helpers, end-of-day processing.
// Pure logic + two world objects (ShippingBin, Bed) that plug into game.objects (solid, interact via player B button).
import { TILE } from '../../engine/constants.js';
import { CROPS, newCrop, growCrop, isRipe, CropDrawable } from './crops.js';
import { itemDef, itemName } from './items.js';

export const key = (tx, ty) => tx + ',' + ty;

/** Field store. A field = { tx, ty, wet, crop|null, drawable }. */
export function createFields() {
  const map = new Map();
  const F = {
    map,
    get(tx, ty) { return map.get(key(tx, ty)) || null; },
    add(tx, ty) { let f = map.get(key(tx, ty)); if (!f) { f = { tx, ty, wet: false, crop: null, drawable: null }; map.set(key(tx, ty), f); } return f; },
    remove(tx, ty) { map.delete(key(tx, ty)); },
    all() { return [...map.values()]; },
    plant(f, cropId, lvl = 0) { f.crop = newCrop(cropId); f.drawable = new CropDrawable(f, lvl); return f.crop; },
    clearCrop(f) { f.crop = null; f.drawable = null; },
    get size() { return map.size; },
    serialize() { return F.all().map((f) => [f.tx, f.ty, f.wet ? 1 : 0, f.crop ? [f.crop.id, +f.crop.g.toFixed(3), f.crop.harvests, f.crop.age] : 0]); },
    deserialize(arr, lvlAt = () => 0) {
      map.clear();
      for (const e of arr || []) {
        if (!Array.isArray(e)) continue;
        const [tx, ty, wet, c] = e;
        const f = F.add(tx | 0, ty | 0);
        f.wet = !!wet;
        if (Array.isArray(c) && CROPS[c[0]]) { F.plant(f, c[0], lvlAt(tx, ty)); Object.assign(f.crop, { g: +c[1] || 0, harvests: c[2] | 0, age: c[3] | 0 }); }
      }
    },
  };
  return F;
}

// ---- monster helpers -------------------------------------------------------------------------------------
const TYPE_ALIASES = { wasser: 'water', pflanze: 'plant', grass: 'plant', leaf: 'plant', stein: 'stone', rock: 'stone', feuer: 'fire' };
export function monsterTypes(m) {
  let t = m?.types ?? m?.sp?.types ?? m?.species?.types ?? m?.def?.types ?? m?.type;
  if (!t) return [];
  if (!Array.isArray(t)) t = [t];
  return t.map((x) => { const s = String(x).toLowerCase(); return TYPE_ALIASES[s] || s; });
}
/** Up to 4 helper monsters from the farm box. Works with party.helpers() (Agent A) or plain arrays. */
export function getHelpers(game, override) {
  let list = null;
  try {
    if (typeof override === 'function') list = override(game);
    else if (Array.isArray(override)) list = override;
    else if (typeof game?.party?.helpers === 'function') list = game.party.helpers();
    else if (Array.isArray(game?.party?.box)) list = game.party.box;
  } catch (e) { console.warn('[farm] helpers', e); }
  return (Array.isArray(list) ? list : []).filter(Boolean).slice(0, 4);
}
const monName = (m) => m?.name || m?.nick || m?.sp?.name || 'Ein Monster';

/**
 * End-of-day processing (before the clock moves to the next morning):
 *   growth (watered crops +1 day, +10 % per plant helper), soil dries.
 * Morning processing (after the clock moved): shipping payout, water helpers water, stone helpers find ore.
 * Returns report lines (German) for toasts.
 */
export function processNight(fields, helpers, rnd = Math.random) {
  const plant = helpers.filter((m) => monsterTypes(m).includes('plant')).length;
  const rate = 1 + 0.1 * plant;
  let ripe = 0;
  for (const f of fields.all()) {
    if (f.crop) { if (growCrop(f.crop, f.wet, rate)) ripe++; }
    f.wet = false;
  }
  return { rate, ripe, plant };
}

export function processMorning({ fields, helpers, inventory, bin, rnd = Math.random }) {
  const lines = [];
  // shipping payout
  if (bin.items.length) {
    const total = bin.value();
    inventory.addMoney(total);
    lines.push(`Versandkiste: +${total} Taler`);
    bin.items.length = 0;
  }
  // water helpers: 6 fields each (crops that are not ripe first)
  const wetted = [];
  for (const m of helpers.filter((x) => monsterTypes(x).includes('water'))) {
    const todo = fields.all().filter((f) => f.crop && !f.wet && !isRipe(f.crop)).slice(0, 6);
    for (const f of todo) { f.wet = true; wetted.push(f); }
    if (todo.length) lines.push(`${monName(m)} hat ${todo.length} ${todo.length === 1 ? 'Feld' : 'Felder'} gegossen.`);
  }
  // stone helpers: find ore
  for (const m of helpers.filter((x) => monsterTypes(x).includes('stone'))) {
    if (rnd() < 0.5) { const n = rnd() < 0.25 ? 2 : 1; inventory.add('ore', n); lines.push(`${monName(m)} hat ${n}× Erz gefunden.`); }
  }
  const plant = helpers.filter((m) => monsterTypes(m).includes('plant'));
  if (plant.length && fields.all().some((f) => f.crop)) lines.push(`${monName(plant[0])} hilft: Pflanzen wachsen schneller.`);
  return { lines, wetted };
}

// ---- shipping bin ------------------------------------------------------------------------------------------
export function createBin() {
  const items = [];
  return {
    items,
    put(id, n) { const e = items.find((x) => x.id === id); if (e) e.n += n; else items.push({ id, n }); },
    takeBack(id, n) { const e = items.find((x) => x.id === id); if (!e) return 0; const k = Math.min(e.n, n); e.n -= k; if (e.n <= 0) items.splice(items.indexOf(e), 1); return k; },
    value() { return items.reduce((s, e) => s + (itemDef(e.id)?.sell || 0) * e.n, 0); },
    describe() { return items.map((e) => itemName(e.id, e.n)).join(', '); },
    serialize() { return items.map((e) => [e.id, e.n]); },
    deserialize(a) { items.length = 0; for (const e of a || []) if (Array.isArray(e) && itemDef(e[0]) && e[1] > 0) items.push({ id: e[0], n: e[1] | 0 }); },
  };
}

// ---- world objects --------------------------------------------------------------------------------------------
const propCache = new Map();
function propFallback(kind) {
  if (propCache.has(kind)) return propCache.get(kind);
  let c = null;
  try {
    if (typeof document !== 'undefined') {
      c = document.createElement('canvas');
      const g = c.getContext('2d');
      if (kind === 'shipping_bin') {
        c.width = 20; c.height = 18;
        g.fillStyle = '#2a1808'; g.fillRect(0, 3, 20, 15);
        g.fillStyle = '#9a6430'; g.fillRect(1, 7, 18, 10);
        g.fillStyle = '#c08848'; g.fillRect(1, 4, 18, 3);
        g.fillStyle = '#6a4020'; for (let x = 3; x < 19; x += 5) g.fillRect(x, 8, 1, 9);
        g.fillStyle = '#e8c040'; g.fillRect(9, 5, 2, 2);
        c.ax = 10; c.ay = 17;
      } else if (kind === 'bed') {
        c.width = 16; c.height = 28;
        g.fillStyle = '#2a1808'; g.fillRect(0, 0, 16, 28);
        g.fillStyle = '#8a5a30'; g.fillRect(1, 1, 14, 26);
        g.fillStyle = '#f0ece0'; g.fillRect(2, 2, 12, 6);
        g.fillStyle = '#4a70c0'; g.fillRect(2, 9, 12, 17);
        g.fillStyle = '#6a90e0'; g.fillRect(2, 9, 12, 2);
        c.ax = 8; c.ay = 27;
      } else {
        c.width = 16; c.height = 16; g.strokeStyle = 'rgba(255,248,220,0.85)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 15, 15);
        g.fillStyle = 'rgba(255,248,220,0.18)'; g.fillRect(1, 1, 14, 14); c.ax = 8; c.ay = 15;
      }
      c.fallback = true;
    }
  } catch { c = null; }
  propCache.set(kind, c);
  return c;
}
export function propSprite(assets, k, t = 0) {
  const a = assets?.sprites?.[k];
  if (a && !Array.isArray(a)) return a;
  if (a && a.length) return a[Math.floor(t * (a.fps || 4)) % a.length];
  return propFallback(k);
}

// Same interface as entities/objects.js Obj (kind/type/solid/lvl/solidBox/update/draw/interact), but without
// importing it, so the farm module graph stays independent of entities → anim (which change in parallel).
class FarmProp {
  constructor(g, spec) {
    this.g = g; this.kind = 'object'; this.type = spec.t; this.spec = spec;
    this.x = spec.px ?? spec.x * TILE + 8; this.y = spec.py ?? spec.y * TILE + 14;
    this.lvl = spec.lvl ?? 0; this.z = this.lvl; this.hop = 0;
    this.sprite = spec.sprite; this.box = spec.box; this.solid = true;
    this.dead = false; this.hidden = false; this.flash = 0; this.shadow = false; this.sortBias = 0; this.def = {};
  }
  solidBox() { const [ox, oy, w, h] = this.box; return { x: this.x + ox, y: this.y + oy, w, h }; }
  hurtbox() { return this.solidBox(); }
  update() {}
  destroy() {}               // props are not cuttable
  draw(ctx, r) {
    const img = propSprite(r.assets, this.sprite, r.time);
    if (img) r.sprite(img, this.x, this.y, this.z, { flash: this.flash > 0 });
  }
}
export class ShippingBin extends FarmProp {
  constructor(g, farm, tx, ty, lvl) {
    super(g, { t: 'shipping_bin', x: tx, y: ty, lvl, sprite: 'shipping_bin', box: [-9, -9, 18, 10] });
    this.farm = farm; this.shadow = 8;
  }
  interact() { return this.farm.openShipping(); }
}
export class Bed extends FarmProp {
  constructor(g, farm, tx, ty, lvl) {
    // the bed covers its tile and the one below; foot point at the bottom of the lower tile
    super(g, { t: 'bed', px: tx * TILE + 8, py: ty * TILE + 30, lvl, sprite: 'bed', box: [-7, -26, 14, 26] });
    this.farm = farm;
  }
  interact() { return this.farm.askSleep(); }
}

/** A floor-decal drawable that marks the target cell of the active tool. */
export class Cursor {
  constructor() { this.kind = 'cursor'; this.layer = 'floor'; this.shadow = false; this.x = 0; this.y = 0; this.z = 0; this.hidden = true; this.sortBias = -8; this.ok = true; }
  set(tx, ty, lvl, ok) { this.x = tx * TILE + 8; this.y = ty * TILE + 15; this.z = lvl; this.lvl = lvl; this.ok = ok; this.hidden = false; }
  draw(ctx, r) {
    const img = propSprite(r.assets, 'tile_cursor', r.time);
    if (img) r.sprite(img, this.x, this.y, this.z, { alpha: this.ok ? 0.9 : 0.4 });
  }
}
