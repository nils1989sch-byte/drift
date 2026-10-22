// DRIFT – Gameplay (Gameplay-Agent). createGame() implements the Game contract from docs/ARCHITECTURE.md.
// State machine: 'title' → 'play' ⇄ ('dialog' | 'pause', owned by the UI) → 'gameover' → 'play'.
// Room/map changes fade out → rebuild map (enemies respawn) → camera.snap() → fade in.
import { parseMap } from '../engine/world.js';
import { MAPS } from './maps/index.js';
import { Player } from './player.js';
import { createEnemy, createObject, createNPC } from './entities/index.js';
import { Pickup } from './entities/pickups.js';
import { Bomb } from './entities/objects.js';
import { damage, sameLayer } from './combat.js';
import { safe, TILE, overlap, chance, choice, pointIn } from './util.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';

// our sound names → audio module names (docs/ANIMATION.md)
const SFX = {
  sword: 'sword', spin: 'sword_spin', charge: 'sword_charge', tink: 'hit', enemy_hit: 'enemy_hit', enemy_die: 'enemy_die',
  hurt: 'hurt', cut: 'cut_grass', lift: 'lift', throw: 'throw', break: 'shatter', chest: 'chest_open', item_get: 'item_get',
  secret: 'secret', door: 'door', wade: 'splash', splash: 'splash', bomb_place: 'bomb_fuse', explode: 'explosion',
  fall: 'fall', boss_roar: 'boss_roar', octorok_shoot: 'shoot', boss_throw: 'shoot', push: 'push', switch: 'switch',
  heart_container: 'heart_container', rupee: 'rupee', rupee_big: 'rupee_big', heart: 'heart', key: 'key', pickup: 'pickup',
  save: 'save', error: 'error', die: 'hurt', boss_stomp: 'explosion', stomp: 'bounce', land: 'bounce', jump: 'dash',
  slime_hop: 'bounce', heal: 'heart', buy: 'rupee_big', rock_land: 'bounce', boss_die: 'boss_roar', boss_tired: 'secret',
  stairs: 'stairs', alert: 'menu_move',
};
// our fx names → FX module types
const FXMAP = { rock: 'rocks', shockwave: 'dust', pot: 'shards' };
const LOOT = {
  enemy: [['heart', 0.28], ['rupee', 0.3], ['rupee5', 0.07], ['bombs', 0.06]],
  small: [['heart', 0.4], ['rupee', 0.45], ['rupee5', 0.05]],
  rich: [['rupee5', 0.5], ['rupee20', 0.15], ['heart', 0.3]],
};

export function createGame({ assets, input, camera, fx, sfx, ui }) {
  const g = {
    assets, input, camera, fx, sfx, ui,
    world: null, mapDef: null, mapId: null,
    entities: [], objects: [], enemies: [], npcs: [], pickups: [], projectiles: [], solids: [], warps: [],
    state: 'title', areaName: '', flags: {},
    hitstop: 0, mapTime: 0, trans: null, entry: null, frame: 0,
    timers: [],
  };
  const player = (g.player = new Player(g));
  let curMusic, lowHealth = false;
  const hints = {};

  // ---- safe wrappers around other agents' modules ----------------------------------------------------
  g.play = (name) => { const n = SFX[name] ?? name; if (n) safe(sfx, 'play', n); };
  g.music = (name) => { if (name === curMusic) return; curMusic = name; safe(sfx, 'music', name); };
  g.spawnFX = (type, x, y, o = {}) => safe(fx, 'spawn', FXMAP[type] || type, x, y, type === 'explosion' ? { camera, ...o } : o);
  g.shake = (a = 2, t = 0.2) => safe(camera, 'shake', a, t);
  g.toast = (text) => safe(ui, 'toast', text);
  g.hint = (id, text, every = 2.5) => { const now = performance.now() / 1000; if ((hints[id] || -99) + every < now) { hints[id] = now; g.toast(text); } };
  g.say = (lines, opts) => {
    let r;
    try { r = ui?.dialog ? ui.dialog(lines, opts) : undefined; } catch (e) { console.warn('[game] dialog', e); }
    if (!ui?.dialog) g.toast([].concat(lines).join(' '));
    return Promise.resolve(r).catch(() => {});
  };
  g.after = (sec, fn) => g.timers.push({ t: sec, fn });
  g.setFlag = (k, v = true, persist = true) => { g.flags[k] = v; if (persist && v) g.save(); };

  // ---- spawning --------------------------------------------------------------------------------------
  g.spawn = (e) => {
    if (!e) return e;
    if (e.kind === 'projectile') g.projectiles.push(e);
    else if (e.kind === 'enemy') g.enemies.push(e);
    else if (e.kind === 'pickup') g.pickups.push(e);
    else if (e.kind === 'npc') g.npcs.push(e);
    else g.objects.push(e);
    return e;
  };
  g.addObject = (spec) => g.spawn(createObject(g, spec));
  g.removeObject = (o) => { const i = g.objects.indexOf(o); if (i >= 0) g.objects.splice(i, 1); };
  g.spawnPickup = (type, x, y, lvl, o = {}) => g.spawn(new Pickup(g, type, x, y, { lvl, ...o }));
  g.dropLoot = (x, y, lvl, table = 'enemy') => {
    const t = LOOT[table];
    if (!t) return;
    let r = Math.random();
    for (const [type, p] of t) {
      if (r < p) {
        let tp = type;
        if (tp === 'bombs' && !player.hasBombs) tp = 'rupee';
        if (tp === 'heart' && player.hp >= player.maxHp && chance(0.5)) tp = 'rupee';
        g.spawnPickup(tp, x, y, lvl);
        return;
      }
      r -= p;
    }
  };

  // ---- world interactions ---------------------------------------------------------------------------
  g.cutArea = (box, lvl, z) => {
    for (const o of g.objects) {
      if (o.dead || !o.cut || o.lvl !== lvl) continue;
      if (overlap(box, o.solidBox())) o.destroy(g, 'cut');
    }
    const w = g.world;
    const x0 = Math.floor(box.x / TILE), x1 = Math.floor((box.x + box.w) / TILE);
    const y0 = Math.floor(box.y / TILE), y1 = Math.floor((box.y + box.h) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (w.tileAt(tx, ty) !== 'grass_tall' || w.heightAt(tx, ty) !== lvl) continue;
      const cx = tx * TILE + 8, cy = ty * TILE + 8;
      if (!pointIn(cx, cy, { x: box.x - 3, y: box.y - 3, w: box.w + 6, h: box.h + 6 })) continue;
      w.setTile(tx, ty, 'grass');
      g.spawnFX('grass', cx, cy + 4, { z: lvl });
      g.play('cut');
      if (chance(0.12)) g.dropLoot(cx, cy + 4, lvl, 'small');
    }
  };
  g.explode = (x, y, lvl, z = lvl) => {
    g.spawnFX('explosion', x, y, { z });
    g.play('explode');
    g.shake(3, 0.3);
    const probe = { x, y, lvl, z };
    for (const e of g.enemies) if (!e.dead && sameLayer(probe, e) && Math.hypot(e.x - x, e.y - 6 - y) < (e.boss ? 40 : 28)) damage(g, e, 2, probe, { kind: 'bomb' });
    if (player.canBeHit() && player.lvl === lvl && Math.hypot(player.x - x, player.y - y) < 22) player.hurt(2, probe);
    for (const o of [...g.objects]) {
      if (o.dead || o === probe) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (o.blast && d < 30 && (o.lvl === lvl || o.lvl === -1)) o.blast(g);
      else if ((o.cut || o.type === 'pot') && d < 24 && o.lvl === lvl) o.destroy(g, 'bomb');
      else if (o instanceof Bomb && d < 30 && o.fuse > 0.12) o.fuse = 0.12;
    }
    g.cutArea({ x: x - 20, y: y - 20, w: 40, h: 40 }, lvl, z);
  };

  // ---- items ------------------------------------------------------------------------------------------
  const ITEM_SPRITE = { rupees: 'rupee_blue', key: 'key_small', bombs: 'bomb', heart_container: 'heart_container', crystal: 'crystal' };
  g.applyItem = (item, amount) => {
    const p = player;
    switch (item) {
      case 'rupees': p.rupees = Math.min(999, p.rupees + (amount || 1)); break;
      case 'key': p.keys++; break;
      case 'bombs': p.hasBombs = true; p.item = 'bomb'; p.bombs = Math.min(p.maxBombs, p.bombs + (amount || 4)); g.flags.bombs_found = true; break;
      case 'heart_container': p.maxHp = Math.min(40, p.maxHp + 2); p.hp = p.maxHp; break;
      case 'crystal': g.flags.crystal = true; break;
    }
    p.syncInventory();
  };
  g.giveItem = async (item, amount, text, o = {}) => {
    g.applyItem(item, amount);
    player.state = 'itemget'; player.t = 0;
    player.showItem = item === 'rupees' && amount >= 20 ? 'rupee_red' : ITEM_SPRITE[item] || item;
    g.play(item === 'heart_container' ? 'heart_container' : 'item_get');
    g.spawnFX('sparkle', player.x, player.y, { z: player.z, hop: 24 });
    await g.say(text || ['Du hast etwas gefunden!']);
    if (player.state === 'itemget') player.state = 'normal';
    player.showItem = null;
    g.save();
    if (item === 'crystal') g.ending();
  };
  g.collect = (pk) => {
    const p = player;
    pk.dead = true;
    switch (pk.type) {
      case 'heart': p.hp = Math.min(p.maxHp, p.hp + 2); g.play('heart'); g.spawnFX('heart_pop', pk.x, pk.y, { z: pk.z }); break;
      case 'rupee': case 'rupee5': case 'rupee20':
        p.rupees = Math.min(999, p.rupees + pk.def.value); g.play(pk.def.value >= 5 ? 'rupee_big' : 'rupee'); break;
      case 'key': p.keys++; g.play('key'); if (pk.flag) g.setFlag(pk.flag); break;
      case 'bombs': p.bombs = Math.min(p.maxBombs, p.bombs + pk.def.value); g.play('pickup'); break;
      case 'heart_container':
        if (pk.flag) g.setFlag(pk.flag);
        g.giveItem('heart_container', 1, ['Du hast einen Herzcontainer erhalten!', 'Deine maximale Lebensenergie steigt um ein Herz.']);
        break;
      case 'crystal':
        g.giveItem('crystal', 1, ['Du hast den Drift-Kristall zurückerobert!', 'Er pulsiert warm in deinen Händen. Driftwald ist gerettet!']);
        break;
    }
  };

  // ---- boss / ending ----------------------------------------------------------------------------------
  g.onBossDefeated = (boss) => {
    g.flags.boss_golem = true;
    g.spawnPickup('heart_container', boss.x, boss.y, boss.lvl, { flag: 'boss_heart' });
    g.after(1.0, () => g.spawnCrystal());
    g.music('dungeon');
    g.save();
  };
  g.spawnCrystal = () => {
    if (g.flags.crystal || g.pickups.some((p) => p.type === 'crystal')) return;
    g.spawnPickup('crystal', 8 * TILE + 8, 6 * TILE + 8, 0, { pop: false });
    g.spawnFX('sparkle', 8 * TILE + 8, 6 * TILE + 8, { count: 6, radius: 12 });
    g.play('secret');
  };
  g.addPortal = () => {
    if (g.objects.some((o) => o.type === 'portal')) return;
    g.addObject({ t: 'portal', x: 8, y: 9 });
    g.warps.push({ rect: { x: 8 * TILE + 3, y: 9 * TILE + 2, w: 10, h: 10 }, to: 'overworld', spawn: 'dungeon', lvl: 0 });
  };
  g.ending = async () => {
    g.music(null);
    g.toast('ENDE – Danke fürs Spielen!');
    await g.say([
      'Der Golem zerfällt zu Staub, und die Ruine wird still.',
      'Mit dem Drift-Kristall kehrt der Halt nach Driftwald zurück. Das Dorf treibt nicht länger davon.',
      'DRIFT – Ende.\nIdee & Regie: das DRIFT-Team · Pixel-Art, Animation, UI & Gameplay: Claude-Agenten',
      'Danke fürs Spielen! Durch das Portal kommst du zurück zur Oberwelt.',
    ]);
    g.addPortal();
    g.music('dungeon');
  };

  // ---- maps & transitions -------------------------------------------------------------------------------
  function resolveSpawn(def, spawn) {
    if (spawn && typeof spawn === 'object') return spawn;
    const s = def.spawns?.[spawn] || def.spawns?.entry || def.spawns?.start || Object.values(def.spawns || {})[0];
    return s || { x: def.rows[0].length * 8, y: def.rows.length * 8, dir: 'down' };
  }
  g.loadMap = (id, spawn) => {
    const build = MAPS[id];
    if (!build) { console.warn('[game] unknown map', id); return false; }
    const def = build();
    const world = parseMap({ ...def, id, rows: def.rows, heights: def.heights });
    world.name = def.name;
    world.outdoor = !!def.outdoor;
    if (def.ambient === false) world.ambient = false;
    g.world = world; g.mapDef = def; g.mapId = id; g.mapTime = 0;
    g.objects = []; g.enemies = []; g.npcs = []; g.pickups = []; g.projectiles = []; g.timers = [];
    for (const s of def.objects || []) {
      if (s.showFlag && !g.flags[s.showFlag]) continue;
      const o = createObject(g, s);
      if (o && !o.dead) g.objects.push(o);
    }
    for (const s of def.enemies || []) { if (s.once && g.flags[s.once]) continue; const e = createEnemy(g, s); if (e) g.enemies.push(e); }
    for (const s of def.npcs || []) g.npcs.push(createNPC(g, s));
    g.warps = (def.warps || []).map((w) => ({
      ...w,
      rect: { x: w.x * TILE, y: w.y * TILE, w: w.w * TILE, h: w.h * TILE },
      lvl: w.lvl ?? world.heightAt(Math.floor(w.x), Math.floor(w.y)),
    }));
    const sp = resolveSpawn(def, spawn);
    player.place(sp.x, sp.y, sp.dir || 'down');
    g.entry = { map: id, spawn: { x: sp.x, y: sp.y, dir: sp.dir || 'down' } };
    camera.follow = player;
    safe(camera, 'snap');
    safe(fx, 'clear', true);
    if (g.state !== 'title') g.music(def.music || 'overworld');
    def.onEnter?.(g);
    rebuild();
    updateArea();
    return true;
  };
  g.warpTo = (id, spawn) => {
    if (g.trans) return;
    g.trans = { phase: 'out', t: 0, to: id, spawn };
    player.state = 'frozen';
    g.play(id.startsWith('dungeon') && g.mapId?.startsWith('dungeon') ? 'door' : 'stairs');
  };
  const FADE = 0.28;
  function updateTransition(dt) {
    const tr = g.trans;
    tr.t += dt;
    if (tr.phase === 'out' && tr.t >= FADE) {
      g.loadMap(tr.to, tr.spawn);
      g.save();
      tr.phase = 'in'; tr.t = 0;
      player.state = 'frozen';
    } else if (tr.phase === 'in' && tr.t >= FADE) {
      g.trans = null;
      player.state = 'normal';
    }
  }
  g.drawOverlay = (ctx) => {
    const tr = g.trans;
    if (!tr) return;
    const a = tr.phase === 'out' ? Math.min(1, tr.t / FADE) : 1 - Math.min(1, tr.t / FADE);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(13,15,28,${a.toFixed(3)})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  };

  function checkWarps() {
    if (player.state !== 'normal') return;
    for (const w of g.warps) {
      if (w.needFlag && !g.flags[w.needFlag]) continue;
      if (Math.abs(player.lvl - w.lvl) > 0.5) continue;
      if (!pointIn(player.x, player.y, w.rect)) continue;
      if (w.dirReq && (player.dir !== w.dirReq || !player.moving)) continue;
      g.warpTo(w.to, w.spawn);
      return;
    }
  }
  function updateArea() {
    const def = g.mapDef;
    let name = def?.name || '';
    if (def?.areas) {
      const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE);
      for (const a of def.areas) if (tx >= a.x0 && tx <= a.x1 && ty >= a.y0 && ty <= a.y1) { name = a.name; break; }
    }
    if (g.state === 'title') return;
    g.areaName = name;
  }
  function rebuild() {
    g.objects = g.objects.filter((o) => !o.dead);
    g.enemies = g.enemies.filter((e) => !e.dead);
    g.pickups = g.pickups.filter((e) => !e.dead);
    g.projectiles = g.projectiles.filter((e) => !e.dead);
    g.solids = [...g.objects.filter((o) => o.solid), ...g.npcs];
    g.entities = [player, ...g.objects, ...g.npcs, ...g.enemies, ...g.pickups, ...g.projectiles];
  }

  // ---- game flow ------------------------------------------------------------------------------------------
  function resetPlayer() {
    Object.assign(player, { hp: 6, maxHp: 6, rupees: 0, keys: 0, bombs: 0, hasBombs: false, item: null, hasSword: true, god: player.god });
    player.syncInventory();
  }
  g.newGame = () => {
    clearSave();
    g.flags = {};
    resetPlayer();
    g.state = 'play';
    g.loadMap('house_elder', 'start');
    g.after(0.7, () => {
      const elder = g.npcs.find((n) => n.spec.dialog === 'elder');
      if (elder && !g.flags.intro) elder.interact(g, player);
    });
  };
  g.continueGame = () => {
    const s = loadGame();
    if (!s) return g.newGame();
    g.flags = s.flags || {};
    resetPlayer();
    Object.assign(player, s.player || {});
    player.hp = player.maxHp;
    player.syncInventory();
    g.state = 'play';
    if (!g.loadMap(s.entry?.map || 'overworld', s.entry?.spawn || 'start')) g.loadMap('overworld', 'start');
  };
  g.start = (mode) => {
    if (g.state !== 'title' && mode !== 'restart' && mode !== 'new') return;
    if (mode === 'restart' || mode === 'new' || !hasSave()) g.newGame();
    else g.continueGame();
  };
  g.hasSave = () => hasSave();
  g.retry = (mode = 'continue') => {
    if (mode === 'restart') return g.restart();
    const e = g.entry || { map: 'overworld', spawn: 'start' };
    player.deadReported = false;
    player.hp = Math.min(player.maxHp, Math.max(6, Math.ceil(player.maxHp / 4) * 2));
    player.iframes = 1;
    g.state = 'play';
    g.loadMap(e.map, e.spawn);
    g.save();
  };
  g.continue = () => g.retry('continue');
  g.restart = () => { player.deadReported = false; g.newGame(); };
  g.onPlayerDead = () => {
    g.state = 'gameover';
    safe(sfx, 'setLowHealth', false);
    lowHealth = false;
  };
  g.togglePause = () => {
    if (g.state === 'play') g.state = 'pause';
    else if (g.state === 'pause') g.state = 'play';
  };
  g.onPause = (on) => { /* UI tells us; nothing extra needed – update() idles while state !== 'play' */ };
  g.save = () => {
    if (g.state === 'title' || !g.entry) return;
    const p = player;
    saveGame({
      flags: g.flags,
      player: { maxHp: p.maxHp, rupees: p.rupees, keys: p.keys, bombs: p.bombs, hasBombs: p.hasBombs, item: p.item },
      entry: g.entry,
    });
  };

  // ---- main update ------------------------------------------------------------------------------------------
  let titleT = 0;
  g.update = (dt) => {
    g.frame++;
    if (g.state === 'title') {
      // attract mode: drift the camera slowly over the village
      titleT += dt;
      const target = g._titleCam || (g._titleCam = { x: 0, y: 0, z: 0 });
      target.x = 14 * TILE + Math.sin(titleT * 0.12) * 120;
      target.y = 22 * TILE + Math.cos(titleT * 0.09) * 50;
      camera.follow = target;
      for (const n of g.npcs) n.update(dt);
      safe(fx, 'ambient', g.world, camera);
      return;
    }
    if (g.state !== 'play') return;
    if (g.hitstop > 0) { g.hitstop -= dt; return; }
    if (g.trans) { updateTransition(dt); safe(fx, 'ambient', g.world, camera); rebuild(); return; }
    g.mapTime += dt;
    for (const t of g.timers) { t.t -= dt; if (t.t <= 0 && !t.done) { t.done = true; t.fn(); } }
    g.timers = g.timers.filter((t) => !t.done);

    player.update(dt);
    for (const o of g.objects) if (!o.dead) o.update(dt);
    for (const n of g.npcs) n.update(dt);
    for (const e of g.enemies) if (!e.dead) e.update(dt);
    for (const pr of g.projectiles) if (!pr.dead) pr.update(dt);
    for (const pk of g.pickups) {
      if (pk.dead) continue;
      pk.update(dt);
      if (player.state === 'dead' || player.state === 'fall' || player.state === 'jump') continue;
      if (pk.hop < 6 && Math.abs(pk.lvl - player.lvl) < 0.5 && Math.hypot(pk.x - player.x, pk.y - 3 - (player.y - 5)) < 11) g.collect(pk);
    }
    g.mapDef?.update?.(g, dt);
    checkWarps();
    rebuild();
    updateArea();
    safe(fx, 'ambient', g.world, camera);
    const low = player.hp > 0 && player.hp <= 2;
    if (low !== lowHealth) { lowHealth = low; safe(sfx, 'setLowHealth', low); }
  };

  // ---- QA / debug API -------------------------------------------------------------------------------------------
  g.debug = {
    teleport(mapId = g.mapId, x, y) {
      g.state = 'play';
      if (x == null) return g.loadMap(mapId);
      const px = x * TILE + 8, py = y * TILE + 10;
      return g.loadMap(mapId, { x: px, y: py, dir: player.dir });
    },
    give(item, amount) {
      const p = player;
      switch (item) {
        case 'bombs': case 'bomb': g.applyItem('bombs', amount ?? 10); break;
        case 'key': case 'keys': for (let i = 0; i < (amount ?? 1); i++) g.applyItem('key'); break;
        case 'rupees': case 'rupee': g.applyItem('rupees', amount ?? 100); break;
        case 'heart': case 'hearts': case 'heal': p.hp = p.maxHp; break;
        case 'heart_container': g.applyItem('heart_container'); break;
        case 'crystal': g.applyItem('crystal'); break;
        case 'sword': p.hasSword = true; break;
        case 'all': g.applyItem('bombs', 10); g.applyItem('key'); g.applyItem('rupees', 100); p.hp = p.maxHp; break;
        default: return false;
      }
      p.syncInventory();
      return true;
    },
    godMode(on = true) { player.god = !!on; return player.god; },
    setFlag(k, v = true) { g.flags[k] = v; return g.flags; },
    flags() { return { ...g.flags }; },
    listEntities() {
      return g.entities.map((e) => ({ kind: e.kind, type: e.type || e.name || e.spec?.t, x: Math.round(e.x), y: Math.round(e.y), tx: Math.floor(e.x / TILE), ty: Math.floor((e.y - 2) / TILE), lvl: e.lvl, hp: e.hp, state: e.state }));
    },
    killAll() { for (const e of g.enemies) if (!e.boss) e.die(g); for (const e of g.enemies) if (e.boss) { e.hp = 0; e.die(g); } },
    player() { const p = player; return { x: p.x, y: p.y, tx: Math.floor(p.x / TILE), ty: Math.floor((p.y - 2) / TILE), lvl: p.lvl, z: p.z, dir: p.dir, state: p.state, hp: p.hp, maxHp: p.maxHp, map: g.mapId }; },
    resetSave() { clearSave(); },
    maps: Object.keys(MAPS),
  };

  // backdrop for the title screen
  g.loadMap('overworld', 'start');
  g.state = 'title';
  g.areaName = '';
  return g;
}
