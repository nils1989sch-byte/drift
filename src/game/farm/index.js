// DRIFT – Hof, Zeit & Inventar (Gameplay-Agent B). Entry point: createFarm(game, opts).
// Integration steps for Agent A: docs/FARM.md.
import { TILE } from '../../engine/constants.js';
import { createClock } from './clock.js';
import { createInventory, giveStarterKit, HOTBAR } from './inventory.js';
import { ITEMS, itemDef, itemName } from './items.js';
import { CROPS, isRipe, cropStage } from './crops.js';
import { createFields, createBin, getHelpers, processNight, processMorning, ShippingBin, Bed, Cursor, monsterTypes } from './farm.js';
import { useActive, targetCell, harvestAt, inArea, TILLABLE, TOOL_TIME } from './tools.js';
import { openShop, shopStock, buy, sell, sellables, buyPrice, sellPrice, weeklyDeal } from './shop.js';

export { CROPS, ITEMS, HOTBAR, itemDef, itemName, monsterTypes, shopStock, buyPrice, sellPrice, weeklyDeal };

const FADE = 0.6, HOLD = 0.5;

export function createFarm(game, opts = {}) {
  const area = { map: 'overworld', x: 18, y: 19, w: 4, h: 3, ...(opts.area || {}) };
  const binPos = opts.bin === false ? null : { map: area.map, x: area.x + area.w, y: area.y - 1, ...(opts.bin || {}) };
  const bedPos = opts.bed === false ? null : { map: 'house_elder', x: 9, y: 4, ...(opts.bed || {}) };
  const home = { map: 'house_elder', spawn: { x: 8 * TILE + 8, y: 5 * TILE + 12, dir: 'right' }, ...(opts.home || {}) };
  const rnd = opts.random || Math.random;

  const clock = createClock({ minuteSec: opts.minuteSec ?? 0.7, seasons: !!opts.seasons, startHour: opts.startHour });
  const moneyAccessor = opts.money === 'internal' ? null
    : opts.money && typeof opts.money.get === 'function' ? opts.money
    : { get: () => game.player?.rupees ?? 0, set: (v) => { if (game.player) game.player.rupees = v; } };
  const inventory = createInventory({ size: opts.bagSize ?? 24, moneyAccessor });
  const fields = createFields();
  const bin = createBin();
  const can = { water: opts.canMax ?? 20, max: opts.canMax ?? 20 };
  const cursor = new Cursor();
  let seenWorld = null, props = [], cool = 0, sleeping = null, lastReport = [];
  const dayListeners = new Set();

  // ---- safe bridges into the game / other agents ----------------------------------------------------------
  const call = (o, fn, ...a) => { try { const f = o?.[fn]; return typeof f === 'function' ? f.apply(o, a) : undefined; } catch (e) { console.warn('[farm]', fn, e); return undefined; } };
  const say = (lines, o) => {
    if (opts.say) return Promise.resolve(opts.say(lines, o));
    if (typeof game.say === 'function') return Promise.resolve(game.say(lines, o));
    if (typeof game.ui?.dialog === 'function') return Promise.resolve(game.ui.dialog(lines, o)).catch(() => undefined);
    return Promise.resolve(undefined);
  };
  const toast = (text, o) => { if (typeof game.toast === 'function') game.toast(text, o); else call(game.ui, 'toast', text, o); };
  const hint = (text) => { if (!text) return; if (typeof game.hint === 'function') game.hint('farm_' + text, text, 2); else toast(text); };
  const sfx = (name) => { if (typeof game.play === 'function') game.play(name); else call(game.sfx, 'play', name); };
  const fx = (type, tx, ty, o = {}) => {
    const x = tx * TILE + 8, y = ty * TILE + 12, z = game.world?.heightAt?.(tx, ty) ?? 0;
    if (typeof game.spawnFX === 'function') game.spawnFX(type, x, y, { z, ...o }); else call(game.fx, 'spawn', type, x, y, { z, ...o });
  };
  const curMap = () => game.mapId ?? game.world?.id;
  const onFarmMap = () => !!game.world && curMap() === area.map;
  const inBattle = () => !!(game.battle && (game.battle.active ?? true) && !game.battle.done);

  // context shared with tools.js
  const F = {
    game, area, fields, inventory, clock, can, rnd,
    tillable: opts.tillable || TILLABLE,
    refillObjects: opts.refillObjects || ['well', 'trough'],
    onFarmMap, fx, sfx, toast, hint, say,
  };

  // ---- world sync: re-apply soil tiles + props after every map (re)build --------------------------------------
  function applyTiles() {
    const w = game.world;
    if (!w || !onFarmMap()) return;
    for (const f of fields.all()) {
      if (!w.inside?.(f.tx, f.ty) && w.inside) continue;
      w.setTile(f.tx, f.ty, f.wet ? 'soil_wet' : 'soil');
      if (f.drawable) { f.drawable.lvl = f.drawable.z = w.heightAt(f.tx, f.ty); }
    }
  }
  function onMapLoad() {
    const w = game.world;
    seenWorld = w;
    props = [];
    if (!w) return;
    applyTiles();
    const map = curMap();
    try {
      if (binPos && map === binPos.map) props.push(new ShippingBin(game, api, binPos.x, binPos.y, w.heightAt(binPos.x, binPos.y)));
      if (bedPos && map === bedPos.map) props.push(new Bed(game, api, bedPos.x, bedPos.y, w.heightAt(bedPos.x, bedPos.y)));
    } catch (e) { console.warn('[farm] props', e); props = []; }
    if (Array.isArray(game.objects)) for (const p of props) if (!game.objects.includes(p)) game.objects.push(p);
  }

  // ---- day end ---------------------------------------------------------------------------------------------------
  function endDay(reason) {
    const helpers = getHelpers(game, opts.helpers);
    const night = processNight(fields, helpers, rnd);
    const info = clock.sleep(reason);
    const morning = processMorning({ fields, helpers, inventory, bin, rnd });
    const lines = [`Tag ${info.day} · ${clock.weekday}, ${clock.dayOfSeason}. ${clock.seasonName}`];
    if (reason === 'passout') {
      const loss = Math.min(200, Math.floor(inventory.money * 0.1));
      if (loss > 0) inventory.spend(loss);
      lines.push(loss > 0 ? `Du bist vor Erschöpfung umgekippt … (−${loss} Taler)` : 'Du bist vor Erschöpfung umgekippt …');
    }
    if (night.ripe) lines.push(`${night.ripe} Pflanze${night.ripe > 1 ? 'n sind' : ' ist'} reif!`);
    lines.push(...morning.lines);
    // rest: hero + team
    if (game.player && typeof game.player.maxHp === 'number') game.player.hp = game.player.maxHp;
    call(game.party, 'healAll');
    applyTiles();
    lastReport = lines;
    const ev = { ...info, report: lines, night, morning };
    for (const f of dayListeners) { try { f(ev, api); } catch (e) { console.warn('[farm] onNewDay', e); } }
    return ev;
  }

  function startSleep(reason = 'bed') {
    if (sleeping) return false;
    sleeping = { t: 0, phase: 'out', reason };
    clock.paused = true;
    if (game.player) { sleeping.prevState = game.player.state; game.player.state = 'frozen'; }
    sfx(reason === 'passout' ? 'hurt' : 'menu_select');
    return true;
  }
  function updateSleep(dt) {
    const s = sleeping;
    s.t += dt;
    if (s.phase === 'out' && s.t >= FADE) { s.phase = 'hold'; s.t = 0; }
    else if (s.phase === 'hold' && !s.ev) {
      s.ev = endDay(s.reason);
      if (s.reason === 'passout' && home.map && curMap() !== home.map && typeof game.loadMap === 'function') {
        try { game.loadMap(home.map, home.spawn); } catch (e) { console.warn('[farm] loadMap home', e); }
      } else if (s.reason === 'passout' && game.player && typeof home.spawn === 'object' && typeof game.player.place === 'function') {
        call(game.player, 'place', home.spawn.x, home.spawn.y, home.spawn.dir);
      }
      if (game.player) game.player.state = 'frozen';
    } else if (s.phase === 'hold' && s.t >= HOLD) { s.phase = 'in'; s.t = 0; }
    else if (s.phase === 'in' && s.t >= FADE) {
      sleeping = null;
      clock.paused = false;
      if (game.player && game.player.state === 'frozen') game.player.state = 'normal';
      lastReport.forEach((l, i) => toast(l, { id: 'farm_day_' + i, time: 3 + i * 0.6 }));
      sfx('save');
      call(game, 'save');
    }
  }

  // ---- interactions ---------------------------------------------------------------------------------------------
  async function openShipping() {
    const a = inventory.active;
    const sellable = a && a.def && a.def.kind !== 'tool' && a.def.sell > 0;
    const crops = inventory.list().filter((e) => e.kind === 'crop');
    const inBin = bin.items.length ? ` In der Kiste: ${bin.describe()} (${bin.value()} Taler).` : '';
    const choices = [];
    if (sellable) choices.push(['all', `${a.def.name}: alle ${a.n}`], ['one', `${a.def.name}: eins`]);
    if (crops.length && !(sellable && a.def.kind === 'crop' && crops.length === 1)) choices.push(['crops', 'Gesamte Ernte']);
    choices.push(['no', 'Nichts']);
    const c = await say({ text: `Versandkiste: Was hineingelegt wird, wird morgen früh ausgezahlt.${inBin}`, speaker: 'Versandkiste', choices: choices.map((x) => x[1]) });
    const pick = choices[c]?.[0];
    let added = 0;
    if (pick === 'all' || pick === 'one') { const n = pick === 'all' ? a.n : 1; if (inventory.removeAt(a.slot, n)) { bin.put(a.id, n); added = n * a.def.sell; } }
    else if (pick === 'crops') for (const e of crops) { const n = inventory.count(e.id); if (inventory.remove(e.id, n)) { bin.put(e.id, n); added += n * (itemDef(e.id).sell || 0); } }
    if (added) { sfx('pickup'); toast(`Versandkiste: ${bin.value()} Taler morgen früh`, { id: 'farm_bin' }); }
    return true;
  }
  async function askSleep() {
    if (sleeping) return true;
    const c = await say({ text: clock.abs < 18 ? 'Es ist noch früh. Trotzdem schlafen und den Tag beenden?' : 'Schlafen gehen und den Tag beenden?', speaker: 'Bett', choices: ['Ja', 'Nein'] });
    if (c === 0) startSleep('bed');
    return true;
  }

  // ---- public API -------------------------------------------------------------------------------------------------
  const api = {
    clock, inventory, fields, bin, can, area, cursor,
    get sleeping() { return !!sleeping; },
    get lastReport() { return lastReport; },
    get props() { return props; },
    TOOL_TIME,

    update(dt) {
      if (game.world !== seenWorld) onMapLoad();
      if (cool > 0) cool -= dt;
      if (sleeping) { updateSleep(dt); updateCursor(); return; }
      const st = game.state;
      if (st && st !== 'play') { updateCursor(); return; }      // time stands still in dialogs, menus, title
      if (!game.trans) clock.update(dt);
      if (clock.passedOut && !inBattle()) startSleep('passout');
      updateCursor();
    },
    /** Hotbar action (A button outside battle). Returns the tools.js result. */
    useTool() {
      if (sleeping) return { ok: false, action: 'none', reason: 'sleeping' };
      if (cool > 0) return { ok: false, action: 'none', reason: 'busy' };
      const r = useActive(F);
      if (r.ok || r.action === 'cut') {
        cool = TOOL_TIME;
        const p = game.player;
        if (p && 'lock' in p) p.lock = Math.max(p.lock || 0, TOOL_TIME);
      }
      return r;
    },
    /** B button: harvests a ripe crop in front (props are handled through game.objects / player.interact). true = handled. */
    interact() {
      if (sleeping) return true;
      const p = game.player;
      if (!p || !game.world) return false;
      const { tx, ty } = targetCell(p);
      const f = onFarmMap() ? fields.get(tx, ty) : null;
      if (f?.crop && isRipe(f.crop)) { harvestAt(F, tx, ty); return true; }
      if (!Array.isArray(game.objects)) {          // no object list: talk to our props directly
        for (const o of props) if (Math.abs(o.x - (tx * TILE + 8)) < 14 && Math.abs(o.y - (ty * TILE + 12)) < 20) { o.interact(); return true; }
      }
      return false;
    },
    /** Item button: next hotbar slot. */
    cycleHotbar(d = 1) { const s = d < 0 ? inventory.prev() : inventory.next(); syncPlayerItem(); const a = inventory.active; toast(a ? itemName(a.id, a.n) : '–', { id: 'hotbar', time: 1 }); return s; },
    select(slot) { const s = inventory.select(slot); syncPlayerItem(); return s; },
    get active() { return inventory.active; },
    drawables() {
      const out = [];
      if (onFarmMap()) for (const f of fields.all()) if (f.drawable && f.crop) out.push(f.drawable);
      if (!cursor.hidden) out.push(cursor);
      if (!Array.isArray(game.objects)) out.push(...props);
      return out;
    },
    drawOverlay(ctx) {
      if (!sleeping) return;
      const s = sleeping;
      const a = s.phase === 'out' ? Math.min(1, s.t / FADE) : s.phase === 'hold' ? 1 : 1 - Math.min(1, s.t / FADE);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(13,15,28,${a.toFixed(3)})`; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    },
    get overlayAlpha() { if (!sleeping) return 0; const s = sleeping; return s.phase === 'out' ? Math.min(1, s.t / FADE) : s.phase === 'hold' ? 1 : 1 - Math.min(1, s.t / FADE); },
    sleep(reason = 'bed') { return startSleep(reason); },
    /** Immediate day end without fade (tests / debug). */
    skipDay(reason = 'bed') { return endDay(reason); },
    askSleep, openShipping,
    openShop: (speaker = 'Lutz') => openShop({ inventory, clock, say, sfx }, speaker),
    shop: { stock: () => shopStock(clock.day), buy: (id, n) => buy(inventory, id, n, clock.day), sell: (id, n) => sell(inventory, id, n), sellables: () => sellables(inventory), deal: () => weeklyDeal(clock.day) },
    onNewDay(fn) { dayListeners.add(fn); return () => dayListeners.delete(fn); },
    onMapLoad,
    targetCell: () => (game.player ? targetCell(game.player) : null),
    cropAt(tx, ty) { const f = fields.get(tx, ty); return f?.crop ? { ...f.crop, stage: cropStage(f.crop), ripe: isRipe(f.crop), wet: f.wet, name: CROPS[f.crop.id].name } : null; },
    helpers: () => getHelpers(game, opts.helpers),

    newGame() {
      clock.deserialize({ day: 1, t: 0 });
      inventory.clear(); fields.map.clear(); bin.items.length = 0; can.water = can.max;
      if (opts.starterKit !== false) giveStarterKit(inventory);
      syncPlayerItem();
      seenWorld = null;
    },
    serialize() {
      return { v: 1, clock: clock.serialize(), inventory: inventory.serialize(), fields: fields.serialize(), bin: bin.serialize(), can: can.water };
    },
    deserialize(d) {
      if (!d || d.v !== 1) return false;
      clock.deserialize(d.clock);
      inventory.deserialize(d.inventory);
      fields.deserialize(d.fields, (x, y) => (onFarmMap() ? game.world.heightAt(x, y) : 0));
      bin.deserialize(d.bin);
      can.water = Math.max(0, Math.min(can.max, d.can ?? can.max));
      syncPlayerItem();
      seenWorld = null;           // re-apply tiles on the next update
      return true;
    },
    debug: {
      grow(days = 1) { for (let i = 0; i < days; i++) { for (const f of fields.all()) if (f.crop) f.wet = true; endDay('bed'); } return api.serialize().fields; },
      setTime(h) { clock.setTime(h); },
      give(id, n = 1) { return inventory.add(id, n); },
      waterAll() { for (const f of fields.all()) { f.wet = true; } applyTiles(); },
    },
  };

  function syncPlayerItem() {
    if (opts.syncPlayerItem === false || !game.player) return;
    game.player.item = inventory.activeId;
  }
  function updateCursor() {
    cursor.hidden = true;
    if (opts.cursor === false || sleeping || !game.player || !game.world || (game.state && game.state !== 'play')) return;
    const a = inventory.active;
    if (!a || !(a.def?.kind === 'tool' || a.def?.kind === 'seed')) return;
    const { tx, ty } = targetCell(game.player);
    const farmCell = inArea(F, tx, ty) || (onFarmMap() && fields.get(tx, ty));
    if (!farmCell) return;
    cursor.set(tx, ty, game.world.heightAt(tx, ty), true);
  }

  inventory.onChange(() => syncPlayerItem());
  game.clock = clock;
  game.farm = game.farm || api;
  if (opts.starterKit !== false && opts.autoStart !== false) api.newGame();
  return api;
}
