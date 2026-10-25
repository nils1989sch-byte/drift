// Tool use on the cell in front of the player: hoe, watering can, sickle, seeds; harvesting.
// All functions take the farm context `F` (see index.js) and return a result
//   { ok: bool, action: 'till'|'water'|'refill'|'cut'|'plant'|'harvest'|'item'|'none', reason?, tx?, ty?, anim? }
import { TILE, DIR_VEC } from '../../engine/constants.js';
import { CROPS, isRipe, harvestCrop } from './crops.js';
import { itemDef, itemName } from './items.js';

export const TILLABLE = ['grass', 'dirt', 'grass_light', 'clearing'];
export const TOOL_TIME = 0.25;     // seconds per action (Guide §3)
const REACH = 12;

const overlap = (a, b) => a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Cell in front of the player (auto-aligned to the tile ahead). */
export function targetCell(p) {
  const v = DIR_VEC[p.dir] || DIR_VEC.down;
  const cx = p.x + v.x * REACH, cy = p.y - 2 + v.y * REACH;
  return { tx: Math.floor(cx / TILE), ty: Math.floor(cy / TILE) };
}

export function inArea(F, tx, ty) {
  const a = F.area;
  return !!a && F.onFarmMap() && tx >= a.x && ty >= a.y && tx < a.x + a.w && ty < a.y + a.h;
}

/** Is a solid object (tree, fence, bin …) standing on the cell? */
export function cellBlocked(F, tx, ty) {
  const g = F.game, r = { x: tx * TILE + 2, y: ty * TILE + 2, w: 12, h: 12 };
  for (const o of g.objects || []) {
    if (o.dead || o.hidden || !o.solid || typeof o.solidBox !== 'function') continue;
    if (o.type === 'barrier') continue;
    if (overlap(r, o.solidBox())) return true;
  }
  for (const n of g.npcs || []) if (!n.dead && typeof n.solidBox === 'function' && overlap(r, n.solidBox())) return true;
  return false;
}

function fail(reason, extra) { return { ok: false, action: 'none', reason, ...extra }; }

export function useHoe(F, tx, ty) {
  const w = F.game.world, p = F.game.player;
  if (!inArea(F, tx, ty)) return fail('Hier kannst du nicht hacken. Nur auf dem Hof.');
  if (w.heightAt(tx, ty) !== (p.lvl ?? 0)) return fail('Zu hoch oder zu tief.');
  const tile = w.tileAt(tx, ty);
  if (w.def(tx, ty).soil) return fail(null);                 // already tilled: silently nothing
  if (!F.tillable.includes(tile)) return fail('Dieser Boden lässt sich nicht hacken.');
  if (cellBlocked(F, tx, ty)) return fail('Da steht etwas im Weg.');
  F.fields.add(tx, ty);
  w.setTile(tx, ty, 'soil');
  F.fx('till', tx, ty); F.sfx('till');
  return { ok: true, action: 'till', tx, ty, anim: 'hoe' };
}

export function nearWater(F, tx, ty) {
  const w = F.game.world, p = F.game.player;
  const isW = (x, y) => { const d = w.def(x, y); return !!(d.water || d.shallow); };
  if (isW(tx, ty)) return true;
  const pc = { tx: Math.floor(p.x / TILE), ty: Math.floor((p.y - 2) / TILE) };
  if (isW(pc.tx, pc.ty)) return true;
  for (const o of F.game.objects || []) {
    if (o.dead || !F.refillObjects.includes(o.type)) continue;
    if (Math.hypot(o.x - (tx * TILE + 8), o.y - (ty * TILE + 8)) < 22) return true;
  }
  return false;
}

export function useCan(F, tx, ty) {
  const w = F.game.world;
  if (nearWater(F, tx, ty)) {
    if (F.can.water >= F.can.max) return fail('Die Gießkanne ist schon voll.', { action: 'refill' });
    F.can.water = F.can.max;
    F.fx('water_splash', tx, ty); F.sfx('splash');
    F.toast(`Gießkanne aufgefüllt (${F.can.max}).`);
    return { ok: true, action: 'refill', tx, ty, anim: 'water' };
  }
  const f = F.onFarmMap() ? F.fields.get(tx, ty) : null;
  if (!f) return fail(null, { action: 'water' });          // watering grass: nothing happens
  if (F.can.water <= 0) return fail('Die Gießkanne ist leer. Fülle sie am Wasser auf.');
  F.can.water--;
  F.fx('water_splash', tx, ty); F.sfx('water');
  if (!f.wet) { f.wet = true; w.setTile(tx, ty, 'soil_wet'); }
  return { ok: true, action: 'water', tx, ty, anim: 'water', left: F.can.water };
}

/** Harvest the crop at a cell (B button, or sickle). */
export function harvestAt(F, tx, ty) {
  if (!F.onFarmMap()) return fail(null);
  const f = F.fields.get(tx, ty);
  if (!f?.crop) return fail(null);
  if (!isRipe(f.crop)) return fail('Noch nicht reif.', { action: 'harvest' });
  const id = 'crop_' + f.crop.id;
  if (!canFit(F.inventory, id)) return fail('Dein Rucksack ist voll!', { action: 'harvest' });
  const res = harvestCrop(f.crop, F.rnd);
  const left = F.inventory.add(res.item, res.n);
  if (res.remove) F.fields.clearCrop(f);
  F.fx('harvest', tx, ty); F.sfx('harvest');
  F.toast(`+${itemName(res.item, res.n - left)}`);
  return { ok: true, action: 'harvest', tx, ty, item: res.item, n: res.n - left, anim: 'harvest' };
}
function canFit(inv, id) {
  const max = itemDef(id)?.stack ?? 99;
  return inv.slots.some((s) => !s || (s.id === id && s.n < max));
}

export function useSickle(F, tx, ty) {
  const g = F.game, p = g.player;
  // ripe crop in front → harvest it
  const f = F.onFarmMap() ? F.fields.get(tx, ty) : null;
  if (f?.crop && isRipe(f.crop)) return harvestAt(F, tx, ty);
  const v = DIR_VEC[p.dir] || DIR_VEC.down;
  const box = { x: p.x + v.x * 12 - 9, y: p.y - 8 + v.y * 12 - 7, w: 18, h: 16 };
  const lvl = p.lvl ?? 0;
  // the game's own cut mechanic (Obj.destroy for bushes, grass_tall → grass) if available
  if (typeof g.cutArea === 'function') {
    try { g.cutArea(box, lvl, p.z ?? lvl); } catch (e) { console.warn('[farm] cutArea', e); }
  } else {
    for (const o of g.objects || []) {
      if (o.dead || !o.cut || (o.lvl ?? 0) !== lvl || typeof o.solidBox !== 'function') continue;
      if (overlap(box, o.solidBox())) o.destroy?.(g, 'cut');
    }
    const w = g.world;
    for (let cy = Math.floor(box.y / TILE); cy <= Math.floor((box.y + box.h) / TILE); cy++) {
      for (let cx = Math.floor(box.x / TILE); cx <= Math.floor((box.x + box.w) / TILE); cx++) {
        if (w.tileAt(cx, cy) !== 'grass_tall' || w.heightAt(cx, cy) !== lvl) continue;
        w.setTile(cx, cy, 'grass');
        F.fx('grass', cx, cy); F.sfx('cut');
      }
    }
  }
  F.sfx('sword');
  return { ok: true, action: 'cut', tx, ty, box, anim: 'sickle' };
}

export function useSeeds(F, itemId, tx, ty) {
  const def = itemDef(itemId), cropId = def?.crop, c = CROPS[cropId];
  if (!c) return fail(null);
  const f = F.onFarmMap() ? F.fields.get(tx, ty) : null;
  if (!f) return fail('Saat braucht gehackten Boden.');
  if (f.crop) return fail(isRipe(f.crop) ? null : 'Hier wächst schon etwas.');
  if (c.seasons && !c.seasons.includes(F.clock.season)) return fail(`${c.name} wächst nicht im ${F.clock.seasonName}.`);
  if (!F.inventory.remove(itemId, 1)) return fail('Keine Saat mehr.');
  F.fields.plant(f, cropId, F.game.world.heightAt(tx, ty));
  F.fx('till', tx, ty, { small: true }); F.sfx('plant');
  return { ok: true, action: 'plant', tx, ty, crop: cropId, anim: 'plant' };
}

/** Uses the active hotbar item on the cell in front of the player. */
export function useActive(F) {
  const p = F.game.player;
  if (!p || !F.game.world) return fail('no player');
  const a = F.inventory.active;
  const { tx, ty } = targetCell(p);
  if (!a) return fail(null, { action: 'none', tx, ty });
  let r;
  switch (a.id) {
    case 'hoe': r = useHoe(F, tx, ty); break;
    case 'can': r = useCan(F, tx, ty); break;
    case 'sickle': r = useSickle(F, tx, ty); break;
    default:
      if (a.def?.kind === 'seed') r = useSeeds(F, a.id, tx, ty);
      else return { ok: false, action: 'item', id: a.id, kind: a.def?.kind, tx, ty };   // orb/potion/crop: Agent A decides
  }
  if (!r.ok && r.reason) { F.hint(r.reason); F.sfx('error'); }
  return { tx, ty, item: a.id, ...r };
}
