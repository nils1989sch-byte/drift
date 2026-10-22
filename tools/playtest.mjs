// DRIFT – automated playtest (QA-Agent). `npm run playtest` or `node tools/playtest.mjs [options]`
//
// Options:
//   --only=a,b      run only these scenarios (substring match)
//   --no3d          skip the 3D sample scenarios (perf + screenshots)
//   --headed        show the browser
//   --seed=N        random seed for the random-walk scenarios (default 1)
//   --frames=N      frames per random walk (default 2000)
//
// Logic tests run against the 2D renderer (?r=2d). Frames are stepped *synchronously* inside the page
// (same order as the main loop in src/main.js: input.poll → game.update → fx.update → ui.update → camera.update),
// while the real requestAnimationFrame loop is paused, so results are deterministic-ish and fast.
// Output: console summary, docs/qa/playtest-results.json, screenshots in docs/qa/shots/.
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/qa');
const SHOTS = path.join(OUT, 'shots');
mkdirSync(SHOTS, { recursive: true });

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const ONLY = args.only ? String(args.only).split(',') : null;
const SEED = +(args.seed ?? 1);
const RW_FRAMES = +(args.frames ?? 2000);
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

// ---------------------------------------------------------------------------------------------------------
// server + browser
const port = 8600 + Math.floor(Math.random() * 300);
const srv = spawn('npx', ['http-server', ROOT, '-p', String(port), '-c-1', '--silent'], { stdio: 'ignore' });
const BASE = `http://localhost:${port}/index.html`;
async function waitServer() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(BASE); if (r.ok) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('http-server did not start');
}

// Injected before any page script: pausable rAF + QA helpers (only touch window.__qa*, never game code).
const INIT = () => {
  window.__qaPause = false;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { if (window.__qaPause) window.requestAnimationFrame(cb); else cb(t); });
  try { if (!sessionStorage.getItem('__qaInit')) { localStorage.clear(); sessionStorage.setItem('__qaInit', '1'); } } catch { /* ignore */ }
};

// Helper library evaluated inside the page after boot.
const QA_LIB = async () => {
  const col = await import('/src/game/collision.js');
  const ACTS = ['attack', 'action', 'item', 'start', 'zoomIn', 'zoomOut', 'up', 'down', 'left', 'right'];
  const D = window.__drift;
  const qa = {
    col,
    log: [],
    // one synchronous frame, mirrors main.js
    frame(c = {}) {
      const { game, input, ui, camera, fx } = D;
      input.setVirtualAxis(c.x || 0, c.y || 0);
      for (const a of ACTS) input.setVirtual(a, !!(c.keys && c.keys.includes(a)));
      input.poll();
      if (input.pressed('zoomIn')) camera.zoom(1);
      if (input.pressed('zoomOut')) camera.zoom(-1);
      if (!ui.blocking) { game.update(1 / 60); fx.update(1 / 60); }
      ui.update(1 / 60);
      camera.update(1 / 60, game.world);
    },
    release() { D.input.setVirtualAxis(0, 0); for (const a of ACTS) D.input.setVirtual(a, false); },
    // run n frames; ctl(i) → {x,y,keys}; check(i) → string|null aborts with that message
    run(n, ctl, check) {
      for (let i = 0; i < n; i++) {
        qa.frame(ctl ? ctl(i) || {} : {});
        if (check) { const m = check(i); if (m) { qa.release(); return { frame: i, fail: m }; } }
      }
      qa.release();
      return { frame: n, fail: null };
    },
    tap(action, n = 1) { qa.frame({ keys: [action] }); qa.run(n); },
    p() { return D.game.player; },
    snap() {
      const g = D.game, p = g.player;
      return { map: g.mapId, x: +p.x.toFixed(2), y: +p.y.toFixed(2), tx: Math.floor(p.x / 16), ty: Math.floor((p.y - 2) / 16), lvl: p.lvl, z: +(+p.z).toFixed(2), state: p.state, dir: p.dir, hp: p.hp, maxHp: p.maxHp, keys: p.keys, bombs: p.bombs, rupees: p.rupees, carry: p.carry?.type || null, gstate: g.state, ui: D.ui.state };
    },
    // why is entity e blocked at its position? (null = free)
    stuck(e = D.game.player) {
      const g = D.game;
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) return 'NaN position';
      if (!col.blocked(g, e, e.x, e.y)) return null;
      const w = g.world, fb = e.foot || col.FOOT, why = [];
      const pts = [[e.x - fb.hw, e.y - fb.top], [e.x + fb.hw - 0.01, e.y - fb.top], [e.x - fb.hw, e.y + fb.bottom - 0.01], [e.x + fb.hw - 0.01, e.y + fb.bottom - 0.01]];
      for (const [px, py] of pts) {
        const tx = Math.floor(px / 16), ty = Math.floor(py / 16);
        const cs = w.def(Math.floor(e.x / 16), Math.floor((e.y - 2) / 16)).stairs;
        if (!col.cellOk(w, tx, ty, e.lvl, cs, e)) why.push(`tile(${tx},${ty})=${w.tileAt(tx, ty)} h${w.heightAt(tx, ty)} vs lvl${e.lvl}`);
      }
      const fr = { x: e.x - fb.hw, y: e.y - fb.top, w: fb.hw * 2, h: fb.top + fb.bottom };
      for (const s of g.solids) {
        if (s === e || s.dead || !s.solid || s.carried) continue;
        if (s.lvl !== -1 && Math.abs(s.lvl - e.lvl) > 0.5) continue;
        const b = s.solidBox();
        if (fr.x < b.x + b.w && fr.x + fr.w > b.x && fr.y < b.y + b.h && fr.y + fr.h > b.y) why.push(`solid ${s.kind}:${s.type || s.name} @(${Math.round(s.x)},${Math.round(s.y)})`);
      }
      return [...new Set(why)].join('; ') || 'blocked (unknown)';
    },
    freeStates: ['normal', 'attack', 'charge', 'spin', 'lift', 'throw', 'hurt', 'itemget', 'frozen'],
    playerStuck() { const p = qa.p(); return qa.freeStates.includes(p.state) ? qa.stuck(p) : null; },
    // steer straight towards a world-pixel target (no pathfinding)
    walkTo(x, y, max = 600, tol = 2) {
      const p = qa.p();
      return qa.run(max, () => { const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy); return d < tol ? {} : { x: dx / d, y: dy / d }; }, () => (Math.hypot(x - p.x, y - p.y) < tol ? 'ARRIVED' : null));
    },
    face(dir) { const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]; qa.frame({ x: v[0] * 0.3, y: v[1] * 0.3 }); qa.p().dir = dir; qa.run(1); },
    tp(map, tx, ty, calm = false) { D.game.debug.teleport(map, tx, ty); D.game.trans = null; if (calm) qa.calm(); qa.run(2); },
    calm() { const g = D.game; g.enemies.forEach((e) => (e.dead = true)); g.projectiles.forEach((e) => (e.dead = true)); },
    // let pending promise continuations (dialog → itemget end etc.) run
    flush() { return new Promise((r) => setTimeout(r, 0)); },
    // advance until dialogs are gone (presses attack every few frames); async so `await g.say()` continuations run
    async clearDialogs(max = 900) {
      let i = 0;
      await qa.flush();
      for (; i < max && (D.ui.state === 'dialog' || D.game.state === 'dialog'); i++) { qa.frame({ keys: i % 6 === 0 ? ['attack'] : [] }); if (i % 6 === 1) await qa.flush(); }
      await qa.flush();
      qa.run(2);
      await qa.flush();
      return i;
    },
    // nearest cell to (tx,ty) where the player can stand freely
    freeCell(tx, ty) {
      const g = D.game, p = g.player, sx = p.x, sy = p.y, sl = p.lvl;
      for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        p.x = (tx + dx) * 16 + 8; p.y = (ty + dy) * 16 + 10; p.lvl = col.levelUnder(g.world, p);
        const ok = !col.blocked(g, p, p.x, p.y) && !g.world.def(tx + dx, ty + dy).pit;
        if (ok) { p.x = sx; p.y = sy; p.lvl = sl; return [tx + dx, ty + dy]; }
      }
      p.x = sx; p.y = sy; p.lvl = sl; return [tx, ty];
    },
    ents(kind) { return D.game.debug.listEntities().filter((e) => !kind || e.kind === kind); },
    rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); },
  };
  window.__qa = qa;
  return true;
};

const browser = await chromium.launch({ headless: !args.headed });
const results = [];
const allErrors = [];

async function openPage({ r3d = false, ctx: ctxOpts = {}, query = '' } = {}) {
  const b = r3d ? await chromium.launch({ headless: !args.headed, args: GL_ARGS }) : browser;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, ...ctxOpts });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); if (m.type() === 'warning' && /\[game\]|\[ui\]/.test(m.text())) errors.push('warn: ' + m.text()); });
  const q = (r3d ? '?' : '?r=2d') + (query ? (r3d ? '' : '&') + query : '');
  await page.goto(BASE + q);
  await page.waitForFunction(() => window.__drift?.game && window.__drift.ui, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  await page.evaluate(QA_LIB);
  return { page, errors, close: async () => { await ctx.close(); if (r3d) await b.close(); } };
}
// start a new game via the real title screen, skip the intro
async function newGame(page, { skipIntro = true } = {}) {
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
  if (skipIntro) await page.evaluate(async () => { __qaPause = true; __qa.run(50); await __qa.clearDialogs(); });
}
// on=false resumes the real rAF loop; wait a bit so the loop has polled before real key events arrive
const pause = async (page, on = true) => { await page.evaluate((on) => { window.__qaPause = on; }, on); if (!on) await page.waitForTimeout(300); };

// ---------------------------------------------------------------------------------------------------------
// scenario runner
const scenarios = [];
const S = (name, fn, o = {}) => scenarios.push({ name, fn, ...o });

async function runScenario(sc) {
  const t0 = Date.now();
  const res = { name: sc.name, ok: true, checks: [], notes: [], errors: [] };
  const assert = (cond, msg, data) => { res.checks.push({ ok: !!cond, msg, data }); if (!cond) res.ok = false; };
  const note = (msg, data) => res.notes.push(data === undefined ? msg : `${msg}: ${JSON.stringify(data)}`);
  let pg;
  try {
    pg = await openPage(sc.open || {});
    await sc.fn({ page: pg.page, assert, note, ev: (fn, a) => pg.page.evaluate(fn, a) });
  } catch (e) {
    res.ok = false; res.checks.push({ ok: false, msg: 'EXCEPTION in scenario: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ') });
  }
  if (pg) {
    res.errors = [...new Set(pg.errors)];
    if (res.errors.length && !sc.allowErrors) { res.ok = false; res.checks.push({ ok: false, msg: `${res.errors.length} console/page errors`, data: res.errors.slice(0, 5) }); }
    allErrors.push(...res.errors.map((e) => `[${sc.name}] ${e}`));
    await pg.close().catch(() => {});
  }
  res.ms = Date.now() - t0;
  results.push(res);
  const fails = res.checks.filter((c) => !c.ok);
  console.log(`${res.ok ? 'PASS' : 'FAIL'}  ${sc.name}  (${res.checks.length - fails.length}/${res.checks.length}, ${res.ms} ms)`);
  for (const f of fails) console.log(`      ✗ ${f.msg}${f.data !== undefined ? '  ' + JSON.stringify(f.data).slice(0, 400) : ''}`);
  for (const n of res.notes) console.log(`      · ${n.slice(0, 400)}`);
}

// ===========================================================================================================
// SCENARIOS
// ===========================================================================================================

S('boot_title_intro', async ({ page, assert, ev }) => {
  const s0 = await ev(() => ({ g: __drift.game.state, ui: __drift.ui.state }));
  assert(s0.g === 'title' && s0.ui === 'title', 'boots into title', s0);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const s1 = await ev(() => __qa.snap());
  assert(s1.map === 'house_elder', 'new game starts in house_elder', s1.map);
  assert(s1.ui === 'dialog', 'intro dialog opens automatically', s1.ui);
  // click through with real keys (Space / J / K alternate)
  let pages = 0;
  for (let i = 0; i < 60; i++) {
    const st = await ev(() => __drift.ui.state);
    if (st !== 'dialog') break;
    await page.keyboard.press(['Space', 'KeyJ', 'KeyK'][i % 3]);
    await page.waitForTimeout(120); pages++;
  }
  const s2 = await ev(() => ({ ...__qa.snap(), flags: __drift.game.debug.flags() }));
  assert(s2.ui === 'hud' && s2.gstate === 'play', 'intro dialog can be clicked away with keys', { ui: s2.ui, g: s2.gstate, presses: pages });
  assert(s2.flags.intro === true, 'flag intro set');
  // player can move after the intro
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(400); await page.keyboard.up('ArrowLeft');
  const s3 = await ev(() => __qa.snap());
  assert(s3.x < s2.x - 10, 'player moves with real keyboard after intro', { from: s2.x, to: s3.x });
  // talking to Bodo again must not replay the intro
  await pause(page);
  const again = await ev(async () => { __qa.tp('house_elder', 5, 4); __qa.face('up'); __qa.tap('action', 3); const st = __drift.ui.state; await __qa.clearDialogs(); return { st, flags: __drift.game.debug.flags() }; });
  assert(again.st === 'dialog', 'Bodo can be talked to again', again);
});

S('movement_8dir', async ({ page, assert, note, ev }) => {
  await newGame(page);
  const r = await ev(() => {
    const out = {};
    const dirs = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1], dr: [0.7071, 0.7071], dl: [-0.7071, 0.7071], ur: [0.7071, -0.7071], ul: [-0.7071, -0.7071] };
    for (const [k, [x, y]] of Object.entries(dirs)) {
      __qa.tp('overworld', 21, 21);           // open meadow/road area
      const p = __qa.p(), x0 = p.x, y0 = p.y;
      __qa.run(30, () => ({ x, y }));
      out[k] = { dx: +(p.x - x0).toFixed(1), dy: +(p.y - y0).toFixed(1), dir: p.dir, stuck: __qa.playerStuck() };
    }
    return out;
  });
  for (const [k, v] of Object.entries(r)) {
    const dist = Math.hypot(v.dx, v.dy);
    assert(dist > 35 && dist < 45, `walk ${k}: ~41px in 0.5s (82px/s)`, v);
    assert(!v.stuck, `walk ${k}: not stuck`, v.stuck);
  }
  assert(r.right.dir === 'right' && r.up.dir === 'up' && r.left.dir === 'left' && r.down.dir === 'down', 'facing follows cardinal input', r);
  note('diagonal facing', { dr: r.dr.dir, dl: r.dl.dir, ur: r.ur.dir, ul: r.ul.dir });
  // keyboard diagonal (two keys)
  await pause(page, false);
  const k0 = await ev(() => __qa.snap());
  await page.keyboard.down('KeyD'); await page.keyboard.down('KeyS'); await page.waitForTimeout(500);
  await page.keyboard.up('KeyD'); await page.keyboard.up('KeyS');
  const k1 = await ev(() => __qa.snap());
  const dx = k1.x - k0.x, dy = k1.y - k0.y;
  assert(dx > 10 && dy > 10 && Math.abs(dx - dy) < 6, 'keyboard diagonal (D+S) moves diagonally & normalized', { dx, dy });
});

S('corner_slide', async ({ page, assert, ev }) => {
  await newGame(page);
  const r = await ev(() => {
    const g = __drift.game, out = [];
    // pick a free-standing tree in the meadow and approach its corners
    __qa.tp('overworld', 15, 11);
    const tree = g.objects.find((o) => o.type === 'tree' && Math.floor(o.x / 16) === 15 && Math.floor(o.y / 16) === 9);
    const b = tree.solidBox();
    for (const [name, sx, dir] of [['up-rightEdge', b.x + b.w + 5 - 3, [0, -1]], ['up-leftEdge', b.x - 5 + 3, [0, -1]], ['up-center', b.x + b.w / 2, [0, -1]]]) {
      __qa.tp('overworld', 15, 11);
      const p = __qa.p(); p.x = sx; p.y = b.y + b.h + 14;
      __qa.run(70, () => ({ x: dir[0], y: dir[1] }));
      out.push({ name, passed: p.y < b.y, x: +p.x.toFixed(1), y: +p.y.toFixed(1), stuck: __qa.playerStuck() });
    }
    // horizontal into tree corner from the left with 3 px vertical overlap
    __qa.tp('overworld', 13, 9);
    const p = __qa.p(); p.x = b.x - 14; p.y = b.y - 1 + 3 + 0; // foot box bottom = y+1 → overlaps top edge by ~3
    __qa.run(70, () => ({ x: 1, y: 0 }));
    out.push({ name: 'right-topEdge', passed: p.x > b.x + b.w, x: +p.x.toFixed(1), y: +p.y.toFixed(1), stuck: __qa.playerStuck() });
    return out;
  });
  for (const c of r) {
    if (c.name === 'up-center') assert(!c.passed, 'walking straight into a tree centre is blocked', c);
    else assert(c.passed, `corner slide ${c.name} (3px overlap) glides around the tree`, c);
    assert(!c.stuck, `corner slide ${c.name}: not stuck`, c.stuck);
  }
});

// Random walk with invariant: the player never stands inside a solid tile/object.
const RW_MAPS = [
  ['overworld', 12, 23], ['overworld', 22, 16], ['overworld', 8, 10], ['overworld', 38, 11], ['overworld', 36, 26], ['overworld', 14, 27],
  ['house_elder', 5, 6], ['cave', 6, 7], ['dungeon_1', 8, 10], ['dungeon_2', 7, 9], ['dungeon_3', 7, 10], ['dungeon_4', 8, 11],
];
S('random_walk_collision', async ({ page, assert, note, ev }) => {
  await newGame(page);
  const r = await ev(async ({ maps, frames, seed }) => {
    const out = [];
    const g = __drift.game;
    g.debug.godMode(true);
    let mi = 0;
    for (const [map, tx0, ty0] of maps) {
      const rnd = __qa.rng(seed * 977 + mi++);
      __qa.tp(map, tx0, ty0);
      const [tx, ty] = __qa.freeCell(tx0, ty0);
      const startBlocked = tx !== tx0 || ty !== ty0 ? `${tx0},${ty0} is blocked → started at ${tx},${ty}` : null;
      __qa.tp(map, tx, ty);
      let deaths = 0;
      let vx = 0, vy = 0, hold = 0, keys = [], fails = [], enemyStuck = new Set(), maps = new Set([map]), visited = new Set(), npcOverlap = 0;
      const res = { frame: 0 };
      const ctlFn = (i) => {
        if (--hold <= 0) {
          hold = 8 + Math.floor(rnd() * 40);
          const a = Math.floor(rnd() * 9);
          const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]];
          [vx, vy] = dirs[a];
          const k = rnd();
          keys = k < 0.12 ? ['attack'] : k < 0.17 ? ['action'] : [];
        }
        // dialogs: keep pressing through
        if (__drift.ui.state === 'dialog') return { keys: i % 5 ? [] : ['attack'] };
        return { x: vx, y: vy, keys: hold % 6 === 0 ? keys : [] };
      };
      const checkFn = (i) => {
        if (g.mapId !== map) { maps.add(g.mapId); }
        const s = __qa.playerStuck();
        if (s) { if (/solid npc/.test(s)) { npcOverlap++; return null; } fails.push({ i, s, snap: __qa.snap() }); return 'STUCK'; }
        const p = __qa.p(); visited.add(Math.floor(p.x / 16) + ',' + Math.floor(p.y / 16));
        for (const e of g.enemies) if (!e.dead && !e.flying && e.state !== 'dying') { const m = __qa.stuck(e); if (m && !/solid/.test(m)) enemyStuck.add(`${e.name}: ${m}`); }
        return null;
      };
      let wasDead = false;
      for (let i = 0; i < frames; i++) {
        __qa.frame(ctlFn(i)); res.frame = i + 1;
        if (__drift.ui.state !== 'hud' || i % 30 === 0) await __qa.flush();
        const dead = __qa.p().state === 'dead' || g.state === 'gameover';
        if (dead && !wasDead) deaths++;
        wasDead = dead;
        if (g.state === 'gameover') { __qa.run(70); __qa.tap('attack', 30); continue; }   // always "Weiter"
        if (checkFn(i)) break;
      }
      __qa.release();
      out.push({ start: `${map}@${tx},${ty}`, startBlocked, frames: res.frame, fail: fails[0] || null, mapsSeen: [...maps], cells: visited.size, enemyStuck: [...enemyStuck].slice(0, 3), npcOverlap, deaths });
    }
    g.debug.godMode(false);
    return out;
  }, { maps: RW_MAPS, frames: RW_FRAMES, seed: SEED });
  for (const w of r) {
    assert(!w.fail, `random walk ${w.start}: player never inside solid (${w.frames} frames, ${w.cells} cells)`, w.fail);
    if (w.enemyStuck.length) assert(false, `random walk ${w.start}: walker enemies inside solid tiles`, w.enemyStuck);
    if (w.startBlocked) note(`random walk: teleport target ${w.startBlocked}`);
    if (w.deaths) note(`random walk ${w.start}: died ${w.deaths}× despite godMode (pits ignore godMode)`);
    if (w.npcOverlap) note(`random walk ${w.start}: player overlapped an NPC solid box in ${w.npcOverlap} frames (NPC walked into player)`);
    if (w.mapsSeen.length > 1) note(`random walk ${w.start}: warped through`, w.mapsSeen);
  }
});

S('stairs_height', async ({ page, assert, ev }) => {
  await newGame(page);
  const r = await ev(() => {
    const out = {};
    const p = __qa.p();
    // Nordklippen stairs (9,13) 1→0: walk up from (9,15)
    const T = (m, x, y) => __qa.tp(m, x, y, true);
    T('overworld', 9, 15);
    const l0 = p.lvl;
    const zs = [];
    __qa.run(90, () => ({ y: -1 }), () => { zs.push(+p.z.toFixed(2)); return null; });
    out.nord = { startLvl: l0, lvl: p.lvl, ty: Math.floor((p.y - 2) / 16), zMonotone: zs.every((z, i) => i === 0 || z >= zs[i - 1] - 0.01), zmax: Math.max(...zs), stuck: __qa.playerStuck() };
    // continue to level 2 via stairs at (5..,7)
    T('overworld', 5, 9);
    __qa.run(80, () => ({ y: -1 }));
    out.nord2 = { lvl: p.lvl, ty: Math.floor((p.y - 2) / 16) };
    // back down the stairs
    T('overworld', 9, 12);
    __qa.run(80, () => ({ y: 1 }));
    out.down = { lvl: p.lvl, ty: Math.floor((p.y - 2) / 16), state: p.state };
    // Steinwacht stairs (36..37,14)
    T('overworld', 36, 16);
    __qa.run(90, () => ({ y: -1 }));
    out.stein = { lvl: p.lvl, ty: Math.floor((p.y - 2) / 16) };
    T('overworld', 40, 11);
    __qa.run(45, () => ({ y: -1 }));
    out.stein2 = { lvl: p.lvl, ty: Math.floor((p.y - 2) / 16) };
    // cannot walk up a cliff face (no stairs): from below the Nordklippen at (7,14)? use (8,15) up
    T('overworld', 6, 16);
    __qa.run(90, () => ({ y: -1 }));
    out.cliffUp = { lvl: p.lvl, ty: Math.floor((p.y - 2) / 16), stuck: __qa.playerStuck() };
    // side-step from stairs onto the plateau edge (stairs → sideways higher cell must be blocked)
    T('overworld', 9, 13);
    const lvlS = p.lvl;
    __qa.run(40, () => ({ x: 1 }));
    out.sideFromStairs = { startLvl: lvlS, lvl: p.lvl, tx: Math.floor(p.x / 16), stuck: __qa.playerStuck() };
    return out;
  });
  assert(r.nord.startLvl === 0 && r.nord.lvl === 1 && r.nord.ty <= 12, 'Nordklippen stairs: 0 → 1', r.nord);
  assert(r.nord.zMonotone, 'visual z rises smoothly on the stairs', r.nord);
  assert(r.nord2.lvl === 2, 'Nordklippen upper stairs: 1 → 2', r.nord2);
  assert(r.down.lvl === 0 && r.down.state === 'normal', 'walking down the stairs: 1 → 0', r.down);
  assert(r.stein.lvl === 1, 'Steinwacht stairs: 0 → 1', r.stein);
  assert(r.stein2.lvl === 2, 'Steinwacht upper stairs: 1 → 2', r.stein2);
  assert(r.cliffUp.lvl === 0, 'cannot walk up a cliff face without stairs', r.cliffUp);
  assert(!r.cliffUp.stuck && !r.sideFromStairs.stuck, 'no stuck at cliffs/stairs', r);
});

S('ledge_jump', async ({ page, assert, ev }) => {
  await newGame(page);
  const r = await ev(() => {
    const out = [];
    const p = __qa.p();
    for (const [name, tx, ty, dx, dy] of [['south', 8, 12, 0, 1], ['east', 11, 4, 1, 0], ['stein-west', 34, 12, -1, 0], ['north(no)', 6, 0, 0, -1], ['stein-south', 43, 13, 0, 1], ['ruin-west', 38, 3, -1, 0], ['ruin-south', 41, 4, 0, 1]]) {
      __qa.tp('overworld', tx, ty, true);
      const l0 = p.lvl; let jumped = false, st = [];
      __qa.run(90, () => ({ x: dx, y: dy }), () => { if (p.state === 'jump') jumped = true; return null; });
      out.push({ name, from: l0, to: p.lvl, jumped, tx: Math.floor(p.x / 16), ty: Math.floor((p.y - 2) / 16), state: p.state, stuck: __qa.playerStuck() });
    }
    return out;
  });
  for (const c of r) {
    if (c.name.includes('(no)')) { assert(!c.jumped, `ledge ${c.name}: no jump upwards/north`, c); continue; }
    assert(c.jumped && c.to < c.from, `ledge jump ${c.name}: jumps down a level`, c);
    assert(!c.stuck && c.state === 'normal', `ledge jump ${c.name}: lands free`, c);
  }
});

S('sword_vs_enemies', async ({ page, assert, note, ev }) => {
  await newGame(page);
  const r = await ev(() => {
    const g = __drift.game, p = __qa.p(), out = {};
    g.debug.godMode(true);
    // fight helper: walk to enemy, face, swing; returns hits
    const fight = (pred, maxF = 900) => {
      const e = g.enemies.find(pred);
      if (!e) return { found: false };
      const hp0 = e.hp; let swings = 0, dmgSeen = [];
      for (let f = 0; f < maxF && !e.dead; f += 1) {
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d > 16) { __qa.frame({ x: dx / d, y: dy / d }); continue; }
        p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        const before = e.hp;
        __qa.frame({ keys: ['attack'] }); swings++;
        __qa.run(18);
        if (e.hp < before) dmgSeen.push(before - e.hp);
      }
      return { found: true, type: e.name, hp0, dead: e.dead, swings, dmgSeen };
    };
    __qa.tp('dungeon_1', 4, 9);
    out.slime = fight((e) => e.name === 'slime');
    __qa.run(20);
    out.pickupsAfterSlime = g.pickups.filter((k) => !k.dead).map((k) => k.type);
    __qa.tp('dungeon_3', 4, 9);
    out.soldier = fight((e) => e.name === 'soldier');
    __qa.tp('overworld', 28, 13);
    out.octorok = fight((e) => e.name === 'octorok' && Math.hypot(e.x - p.x, e.y - p.y) < 120);
    __qa.tp('dungeon_1', 8, 6);
    out.bat = fight((e) => e.name === 'bat');
    // drop statistics: kill 200 slimes artificially
    const drops = {};
    for (let i = 0; i < 300; i++) { const n0 = g.pickups.length; g.enemies[0] && 0; g.dropLoot(100, 100, 0, 'enemy'); const k = g.pickups.length > n0 ? g.pickups[g.pickups.length - 1].type : 'none'; drops[k] = (drops[k] || 0) + 1; }
    out.dropTable = drops;
    // spin attack: hold 0.8 s then release
    __qa.tp('dungeon_1', 8, 8);
    __qa.run(5);
    let spun = false;
    __qa.run(80, () => ({ keys: ['attack'] }), () => { if (p.state === 'charge' && p.charged) spun = true; return null; });
    __qa.run(10, () => ({}), () => (p.state === 'spin' ? 'SPIN' : null));
    out.spin = { charged: spun, state: p.state };
    g.debug.godMode(false);
    return out;
  });
  for (const k of ['slime', 'soldier', 'octorok', 'bat']) {
    const f = r[k];
    assert(f.found, `${k}: found`, f);
    if (f.found) assert(f.dead, `${k}: sword kills it (hp ${f.hp0}, ${f.swings} swings)`, f);
  }
  assert(r.soldier.dmgSeen?.every((d) => d === 1), 'sword deals 1 damage per hit', r.soldier.dmgSeen);
  assert(r.spin.charged && r.spin.state === 'spin', 'holding attack charges and releasing spins', r.spin);
  note('slime drops', r.pickupsAfterSlime);
  note('drop table (300 rolls)', r.dropTable);
});

S('player_damage_knockback', async ({ page, assert, note, ev }) => {
  await newGame(page);
  const r = await ev(() => {
    const g = __drift.game, p = __qa.p(), out = {};
    // put the player against the west wall of dungeon_1 and a soldier right of him
    __qa.tp('dungeon_1', 1, 7);
    const wallX = 16 + 5; p.x = wallX + 0.5;
    g.enemies.forEach((e) => (e.dead = true));
    __qa.run(1);
    const e = g.addObject ? null : null;
    // manual hurt from the east
    const hp0 = p.hp;
    p.hurt(1, { x: p.x + 8, y: p.y });
    let stuck = null;
    __qa.run(40, null, () => { stuck = __qa.playerStuck(); return stuck ? 'STUCK' : null; });
    out.wall = { hp0, hp: p.hp, x: p.x, stuck };
    // knockback towards a cliff edge/pit: dungeon_2 pits (10..12, 6..8): from the east side push west into pit
    __qa.tp('dungeon_2', 13, 7);
    p.x = 13 * 16 + 6;
    p.hurt(1, { x: p.x + 10, y: p.y });
    __qa.run(60);
    out.pitKb = __qa.snap();
    // knockback into a tree on the overworld
    __qa.tp('overworld', 15, 10);
    const tree = g.objects.find((o) => o.type === 'tree' && Math.floor(o.x / 16) === 15 && Math.floor(o.y / 16) === 9);
    p.x = tree.x; p.y = tree.y + 7;
    stuck = __qa.playerStuck();
    p.iframes = 0; p.hurt(1, { x: p.x, y: p.y + 10 });
    let st2 = null;
    __qa.run(40, null, () => { st2 = __qa.playerStuck(); return st2 ? 'STUCK' : null; });
    out.tree = { startStuck: stuck, stuck: st2, y: p.y, treeY: tree.y };
    // i-frames: two hits in a row only count once
    __qa.tp('dungeon_1', 8, 8);
    p.iframes = 0; const h1 = p.hp; p.hurt(1, { x: p.x, y: p.y - 10 }); p.hurt(1, { x: p.x, y: p.y - 10 });
    out.iframes = { before: h1, after: p.hp };
    // real enemy contact: slime next to player
    __qa.tp('dungeon_1', 4, 8);
    p.iframes = 0;
    const hp2 = p.hp;
    __qa.run(400, () => ({}), () => (p.hp < hp2 ? 'HIT' : null));
    out.contact = { before: hp2, after: p.hp };
    return out;
  });
  assert(r.wall.hp === r.wall.hp0 - 1, 'hurt() removes HP', r.wall);
  assert(!r.wall.stuck, 'knockback into a wall never leaves the player inside it', r.wall);
  assert(!r.tree.stuck, 'knockback into a tree never leaves the player inside it', r.tree);
  assert(r.iframes.after === r.iframes.before - 1, 'i-frames prevent double damage', r.iframes);
  assert(r.contact.after < r.contact.before, 'enemy contact hurts the player', r.contact);
  note('knockback towards pit (dungeon_2)', r.pitKb);
});

S('death_gameover_continue', async ({ page, assert, ev }) => {
  await newGame(page);
  const r = await ev(() => {
    const g = __drift.game, p = __qa.p(), out = {};
    __qa.tp('dungeon_1', 8, 8);
    g.entry = { map: 'dungeon_1', spawn: 'entry' };
    p.hp = 1; p.iframes = 0;
    p.hurt(2, { x: p.x, y: p.y - 10 });
    out.dead = p.state;
    __qa.run(150);
    out.g1 = g.state; out.ui1 = __drift.ui.state;
    __qa.run(60);
    // choose "Weiter" (first entry)
    __qa.tap('attack', 60);
    out.after = __qa.snap();
    out.stuck = __qa.playerStuck();
    // second death → "Neustart"
    p.hp = 1; p.iframes = 0; p.hurt(2, { x: p.x, y: p.y - 10 });
    __qa.run(200);
    __qa.tap('down', 4); __qa.tap('attack', 60);
    out.restart = __qa.snap();
    return out;
  });
  assert(r.dead === 'dead', 'hp 0 → state dead', r.dead);
  assert(r.g1 === 'gameover' && r.ui1 === 'gameover', 'game over screen appears', r);
  assert(r.after.gstate === 'play' && r.after.hp >= 6 && r.after.map === 'dungeon_1', 'Weiter → play again at last entry with ≥3 hearts', r.after);
  assert(!r.stuck, 'respawn is free', r.stuck);
  assert(r.restart.map === 'house_elder', 'Neustart → new game in Bodos Haus', r.restart);
});

S('pits_fall', async ({ page, assert, note, ev }) => {
  await newGame(page);
  const r = await ev(() => {
    const p = __qa.p(), g = __drift.game;
    g.enemies.forEach((e) => (e.dead = true));
    __qa.tp('dungeon_2', 9, 7);
    g.enemies.forEach((e) => (e.dead = true));
    const hp0 = p.hp; let fell = false;
    __qa.run(120, () => (fell ? {} : { x: 1 }), () => { if (p.state === 'fall') fell = true; return null; });
    __qa.run(60);
    const hpAfter = p.hp;
    const snap1 = __qa.snap(), stuck1 = __qa.playerStuck(), cell1 = g.world.tileAt(Math.floor(p.x / 16), Math.floor((p.y - 2) / 16));
    // holding the direction after respawn: how many falls in 3 s?
    let falls = 0, prev = 'normal';
    __qa.tp('dungeon_2', 9, 7, true); p.hp = 20; p.maxHp = 20;
    __qa.run(180, () => ({ x: 1 }), () => { if (p.state === 'fall' && prev !== 'fall') falls++; prev = p.state; return null; });
    const rep = { falls, hpLeft: p.hp };
    p.maxHp = 6; p.hp = 6;
    return { rep, fell, hp0, hp: hpAfter, snap: snap1, stuck: stuck1, cell: cell1 };
  });
  note('holding → into a pit for 3 s (respawn next to the pit)', r.rep);
  assert(r.fell, 'walking into a pit → fall', r);
  assert(r.hp === r.hp0 - 2, 'pit costs one heart', r);
  assert(r.cell !== 'pit' && !r.stuck, 'respawn on safe ground', r);
});

S('bush_cut_lift_throw', async ({ page, assert, note, ev }) => {
  await newGame(page);
  const r = await ev(() => {
    const g = __drift.game, p = __qa.p(), out = {};
    g.debug.godMode(true);
    const bushAt = (tx, ty) => g.objects.find((o) => o.type === 'bush' && !o.dead && Math.floor(o.x / 16) === tx && Math.floor(o.y / 16) === ty);
    // cut: bush (14,6)/(14,7) in the meadow; stand below (14,8) facing up
    __qa.tp('overworld', 14, 8);
    const b1 = bushAt(14, 7);
    __qa.face('up'); __qa.tap('attack', 25);
    out.cut = { existed: !!b1, dead: b1?.dead };
    // lift: (20,6),(21,6) – stand at (20,7) facing up, press action
    __qa.tp('overworld', 20, 7);
    const b2 = bushAt(20, 6);
    __qa.face('up'); __qa.tap('action', 20);
    out.lift = { existed: !!b2, carry: p.carry?.type || null, state: p.state };
    // walk with it, then throw (attack)
    __qa.run(20, () => ({ y: 1 }));
    out.carryWalk = { carry: p.carry?.type || null };
    const nProj = g.projectiles.length;
    __qa.tap('attack', 2);
    out.thrown = { carry: p.carry?.type || null, projectiles: g.projectiles.length - nProj };
    __qa.run(60);
    out.landed = g.projectiles.filter((q) => !q.dead).length;
    // throw a pot at an enemy: house_elder pots, no enemy there; use dungeon_1 pot (1,10) and slime
    __qa.tp('dungeon_1', 2, 10);
    __qa.face('left'); __qa.tap('action', 20);
    out.pot = { carry: p.carry?.type || null };
    // tall grass cutting
    __qa.tp('overworld', 21, 20);
    __qa.face('up');
    const before = g.world.tileAt(21, 19);
    __qa.tap('attack', 25);
    out.grass = { before, after: g.world.tileAt(21, 19) };
    // lift a rock
    __qa.tp('overworld', 24, 15);
    __qa.face('up'); __qa.tap('action', 20);
    out.rock = { carry: p.carry?.type || null };
    g.debug.godMode(false);
    return out;
  });
  assert(r.cut.existed && r.cut.dead, 'sword cuts a bush', r.cut);
  assert(r.lift.existed && r.lift.carry === 'bush', 'action lifts a bush', r.lift);
  assert(r.carryWalk.carry === 'bush', 'carry while walking', r.carryWalk);
  assert(!r.thrown.carry && r.thrown.projectiles === 1, 'attack throws the carried bush', r.thrown);
  assert(r.landed === 0, 'thrown object lands/breaks', r.landed);
  assert(r.pot.carry === 'pot', 'pot can be lifted', r.pot);
  assert(r.grass.before === 'grass_tall' && r.grass.after === 'grass', 'sword cuts tall grass', r.grass);
  assert(r.rock.carry === 'rock', 'rock can be lifted', r.rock);
});

S('chest_sign_npc', async ({ page, assert, note, ev }) => {
  await newGame(page);
  const r = await ev(async () => {
    const g = __drift.game, p = __qa.p(), out = {};
    __qa.tp('house_elder', 8, 3);
    const r0 = p.rupees;
    __qa.face('up'); __qa.tap('action', 5);
    out.dlg = __drift.ui.state;
    await __qa.clearDialogs();
    out.chest = { r0, r1: p.rupees, flag: !!Object.keys(g.flags).find((k) => k.startsWith('chest_house_elder')), state: p.state };
    // reopen → no second reward
    __qa.tap('action', 5); await __qa.clearDialogs();
    out.chest.r2 = p.rupees;
    // re-enter the map → chest stays open
    __qa.tp('house_elder', 8, 3);
    out.chestReload = g.objects.find((o) => o.type === 'chest')?.open;
    // sign
    __qa.tp('house_elder', 9, 8);
    __qa.face('up'); __qa.tap('action', 5);
    out.sign = __drift.ui.state; await __qa.clearDialogs();
    // merchant without bombs
    __qa.tp('overworld', 9, 31);
    __qa.face('up'); __qa.tap('action', 5);
    out.merchant = __drift.ui.state; await __qa.clearDialogs();
    // merchant with bombs & rupees: does buying ask for confirmation?
    g.debug.give('bombs', 1); p.rupees = 50;
    __qa.tap('action', 5); await __qa.clearDialogs();
    out.buy = { rupees: p.rupees, bombs: p.bombs };
    // Mia
    __qa.tp('overworld', 20, 30);
    const mia = g.npcs.find((n) => n.spec.t === 'girl');
    out.mia = { x: mia.x, y: mia.y };
    return out;
  });
  assert(r.dlg === 'dialog', 'opening a chest shows a dialog', r.dlg);
  assert(r.chest.r1 === r.chest.r0 + 10 && r.chest.flag, 'chest gives 10 rupees + sets flag', r.chest);
  assert(r.chest.r2 === r.chest.r1, 'chest can only be opened once', r.chest);
  assert(r.chestReload === true, 'chest stays open after re-entering', r.chestReload);
  assert(r.sign === 'dialog', 'signs can be read', r.sign);
  assert(r.merchant === 'dialog', 'merchant talks', r.merchant);
  note('merchant purchase without a yes/no choice', r.buy);
});

S('dungeon_full_run', async ({ page, assert, note, ev }) => {
  await newGame(page);
  const r = await ev(async () => {
    const g = __drift.game, p = __qa.p(), out = { steps: [] };
    const log = (k, v) => out.steps.push([k, v]);
    // walk into the dungeon from the overworld entrance
    __qa.tp('overworld', 40, 7);
    __qa.run(120, () => ({ y: -1 }), () => (g.mapId !== 'overworld' && !g.trans ? 'IN' : null));
    __qa.run(40);
    log('enter', __qa.snap());
    out.enterOk = g.mapId === 'dungeon_1';
    g.enemies.forEach((e) => e.die(g));
    // locked door without key
    __qa.tp('dungeon_1', 12, 2);
    __qa.run(40, () => ({ y: -1 }));
    log('lockedNoKey', { map: g.mapId, flag: !!g.flags.d1_door });
    out.lockedHolds = g.mapId === 'dungeon_1' && !g.flags.d1_door;
    // room 2 via NW door
    __qa.tp('dungeon_1', 4, 2);
    __qa.run(120, () => ({ y: -1 }), () => (g.mapId === 'dungeon_2' && !g.trans ? 'IN' : null));
    __qa.run(40);
    log('room2', __qa.snap());
    out.room2 = g.mapId === 'dungeon_2';
    g.enemies.forEach((e) => (e.dead = true));
    // puzzle: block (4,7) → right ×3 → up ×4 onto switch (7,3)
    const block = g.objects.find((o) => o.type === 'block' && Math.floor(o.x / 16) === 4);
    const bt = () => [Math.floor(block.x / 16), Math.floor((block.y - 4) / 16)];
    const push = (dir, n) => {
      const v = { right: [1, 0], up: [0, -1] }[dir];
      for (let k = 0; k < n; k++) {
        const [bx, by] = bt();
        // stand behind the block
        const sx = (bx - v[0]) * 16 + 8, sy = (by - v[1]) * 16 + 10;
        __qa.walkTo(sx, sy, 400, 1.5);
        const t0 = bt().join();
        __qa.run(90, () => ({ x: v[0], y: v[1] }), () => (bt().join() !== t0 && !block.slide ? 'MOVED' : null));
        __qa.run(25);
      }
    };
    push('right', 3); log('blockAfterRight', bt());
    push('up', 4); log('blockAfterUp', bt());
    __qa.run(30);
    out.switchFlag = !!g.flags.d2_switch;
    // open the chest (12,3)
    __qa.walkTo(12 * 16 + 8, 4 * 16 + 12, 600, 2);
    __qa.face('up'); __qa.tap('action', 5); await __qa.clearDialogs();
    out.key = p.keys;
    // back to room 1
    __qa.tp('dungeon_2', 7, 10);
    __qa.run(120, () => ({ y: 1 }), () => (g.mapId === 'dungeon_1' && !g.trans ? 'IN' : null));
    __qa.run(40);
    out.backTo1 = { map: g.mapId, snap: __qa.snap(), stuck: __qa.playerStuck() };
    // open locked door by pushing into it
    __qa.tp('dungeon_1', 12, 2);
    g.enemies.forEach((e) => (e.dead = true));
    __qa.run(60, () => ({ y: -1 }));
    out.door = { flag: !!g.flags.d1_door, keys: p.keys };
    __qa.run(120, () => ({ y: -1 }), () => (g.mapId === 'dungeon_3' && !g.trans ? 'IN' : null));
    __qa.run(40);
    out.room3 = g.mapId === 'dungeon_3';
    // north wall must be closed before bombing
    __qa.tp('dungeon_3', 7, 2);
    __qa.run(60, () => ({ y: -1 }));
    out.wallBlocks = g.mapId === 'dungeon_3';
    // fight: kill all enemies (real sword, godmode)
    g.debug.godMode(true);
    __qa.tp('dungeon_3', 7, 10);
    let guard = 0;
    while (g.enemies.some((e) => !e.dead) && guard++ < 6000) {
      const e = g.enemies.filter((q) => !q.dead).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d > 15) __qa.frame({ x: dx / d, y: dy / d });
      else { p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); __qa.frame({ keys: guard % 20 === 0 ? ['attack'] : [] }); }
    }
    __qa.run(60);
    out.fightFrames = guard;
    out.d3clear = !!g.flags.d3_clear;
    // bombs chest (7,7)
    __qa.walkTo(7 * 16 + 8, 8 * 16 + 12, 600, 2);
    __qa.face('up'); __qa.tap('action', 5); await __qa.clearDialogs();
    out.bombs = p.bombs;
    // bomb the cracked wall: walk around the chest to (7,2), face up, place bomb, back off
    __qa.walkTo(5 * 16 + 8, 8 * 16 + 10, 300, 2); __qa.walkTo(5 * 16 + 8, 3 * 16 + 10, 300, 2);
    __qa.walkTo(7 * 16 + 8, 2 * 16 + 10, 300, 2);
    out.atWall = __qa.snap();
    __qa.face('up'); __qa.tap('item', 2);
    __qa.run(40, () => ({ y: 1 }));
    __qa.run(150);
    out.wall = !!g.flags.d3_wall;
    out.bombsLeft = p.bombs;
    g.debug.godMode(false);
    __qa.tp('dungeon_3', 7, 2);
    __qa.run(150, () => ({ y: -1 }), () => (g.mapId === 'dungeon_4' && !g.trans ? 'IN' : null));
    __qa.run(40);
    out.room4 = { map: g.mapId, snap: __qa.snap(), stuck: __qa.playerStuck() };
    return out;
  });
  assert(r.enterOk, 'overworld ruin entrance → dungeon_1', r.steps[0]);
  assert(r.lockedHolds, 'locked door blocks without a key');
  assert(r.room2, 'NW door → dungeon_2');
  assert(r.switchFlag, 'push block onto switch sets d2_switch', r.steps.filter((s) => s[0].startsWith('block')));
  assert(r.key === 1, 'switch chest gives the small key', r.key);
  assert(r.backTo1.map === 'dungeon_1' && !r.backTo1.stuck, 'back to room 1, free spawn', r.backTo1);
  assert(r.door.flag && r.door.keys === 0, 'pushing into the locked door with a key opens it', r.door);
  assert(r.room3, 'NE door → dungeon_3');
  assert(r.wallBlocks, 'cracked wall blocks before bombing');
  assert(r.d3clear, `killing all enemies sets d3_clear (${r.fightFrames} frames)`);
  assert(r.bombs >= 9, 'bomb chest gives bombs', r.bombs);
  assert(r.wall, 'bomb opens the cracked wall (d3_wall)', { at: r.atWall, bombsLeft: r.bombsLeft });
  assert(r.room4.map === 'dungeon_4' && !r.room4.stuck, 'through the bombed wall → boss room', r.room4);
});

S('boss_fight', async ({ page, assert, note, ev }) => {
  await newGame(page);
  const r = await ev(async () => {
    const g = __drift.game, p = __qa.p(), out = {};
    g.debug.godMode(true);
    __qa.tp('dungeon_4');
    const boss = g.enemies.find((e) => e.boss);
    out.hp0 = boss.hp; out.hpBeforeFight = p.maxHp;
    let f = 0, shutterClosed = false, tinks = 0, swings = 0, states = {};
    const shutter = g.objects.find((o) => o.type === 'shutter');
    for (; f < 60 * 120 && !boss.dead; f++) {
      states[boss.state] = (states[boss.state] || 0) + 1;
      if (shutter?.solid) shutterClosed = true;
      const dx = boss.x - p.x, dy = boss.y - p.y, d = Math.hypot(dx, dy);
      if (boss.state === 'dying') { __qa.frame({}); continue; }
      if (d > 20) __qa.frame({ x: dx / d, y: dy / d });
      else {
        p.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
        const atk = f % 16 === 0; if (atk) swings++;
        __qa.frame({ keys: atk ? ['attack'] : [] });
      }
      const s = __qa.playerStuck(); if (s) { out.stuck = { f, s, snap: __qa.snap() }; break; }
      const bs = __qa.stuck(boss); if (bs && !/solid/.test(bs) && !out.bossStuck) out.bossStuck = { f, bs, x: boss.x, y: boss.y };
    }
    out.frames = f; out.dead = boss.dead; out.states = states; out.swings = swings; out.shutterClosed = shutterClosed;
    out.flag = !!g.flags.boss_golem;
    const maxHp0 = out.maxHpBefore = p.maxHp;
    out.pickupsSeen = new Set();
    // the heart container may land right on the player: collect pickups until the crystal is ours
    for (let k = 0; k < 40 && !g.flags.crystal; k++) {
      await __qa.clearDialogs(3000);
      __qa.run(20);
      for (const q of g.pickups) if (!q.dead) out.pickupsSeen.add(q.type);
      const q = g.pickups.find((q) => !q.dead && (q.type === 'heart_container' || q.type === 'crystal'));
      if (q) { __qa.walkTo(q.x, q.y + 4, 400, 3); __qa.run(5); }
      else __qa.run(30);
    }
    out.pickupsSeen = [...out.pickupsSeen];
    out.hcFlag = !!g.flags.boss_heart;
    out.shutterOpen = !shutter?.solid;
    out.maxHp = [out.hpBeforeFight, p.maxHp];
    out.crystal = !!g.flags.crystal;
    await __qa.clearDialogs(3000); __qa.run(30);
    out.portal = !!g.objects.find((o) => o.type === 'portal');
    // walk into the portal
    __qa.walkTo(8 * 16 + 8, 9 * 16 + 8, 600, 2);
    __qa.run(60);
    out.afterPortal = __qa.snap();
    out.afterPortalStuck = __qa.playerStuck();
    // back into the boss room: no boss, portal still there
    __qa.tp('dungeon_4');
    out.reenter = { boss: g.enemies.some((e) => e.boss && !e.dead), portal: !!g.objects.find((o) => o.type === 'portal'), shutter: g.objects.find((o) => o.type === 'shutter')?.solid };
    g.debug.godMode(false);
    return out;
  });
  assert(r.dead, `golem is beatable with sword + godMode (${r.frames} frames ≈ ${(r.frames / 60).toFixed(0)} s, ${r.swings} swings)`, r.states);
  assert(r.shutterClosed, 'shutter closes during the fight');
  assert(r.shutterOpen, 'shutter opens after the fight');
  assert(!r.stuck, 'player never stuck during boss fight', r.stuck);
  if (r.bossStuck) note('boss inside solid tile', r.bossStuck);
  assert(r.hcFlag, 'boss drops a heart container (collected)', r.pickupsSeen);
  assert(r.maxHp[1] === r.maxHp[0] + 2, 'heart container +1 heart', r.maxHp);
  assert(r.crystal, 'crystal collected');
  assert(r.portal, 'portal appears after the ending');
  assert(r.afterPortal.map === 'overworld' && !r.afterPortalStuck, 'portal → overworld, free spawn', r.afterPortal);
  assert(!r.reenter.boss, 'boss does not respawn', r.reenter);
});

S('warps_roundtrip', async ({ page, assert, note, ev }) => {
  await newGame(page);
  const r = await ev(() => {
    const g = __drift.game, p = __qa.p(), out = [];
    g.debug.godMode(true);
    // walk in a direction until a map change completes
    const go = (dx, dy, max = 200) => {
      const from = g.mapId;
      __qa.run(max, () => ({ x: dx, y: dy }), () => (g.mapId !== from && !g.trans ? 'WARP' : null));
      const arrived = g.mapId !== from;
      __qa.run(3);
      const s = { from, to: g.mapId, arrived, snap: __qa.snap(), stuck: __qa.playerStuck() };
      // standing still / walking away for 1 s must not bounce back
      const inWarp = g.warps.filter((w) => p.x >= w.rect.x && p.x < w.rect.x + w.rect.w && p.y >= w.rect.y && p.y < w.rect.y + w.rect.h).map((w) => w.to);
      s.spawnInWarp = inWarp;
      __qa.run(60);
      s.stillThere = g.mapId === s.to;
      return s;
    };
    // house_elder → overworld (down through the door)
    __qa.tp('house_elder', 5, 7);
    out.push(go(0, 1));
    // overworld → house (up into the door)
    out.push(go(0, -1));
    // turn around immediately → back out
    out.push(go(0, 1));
    // dungeon entrance and back
    __qa.tp('overworld', 40, 6); out.push(go(0, -1)); out.push(go(0, 1));
    // cave: needs cave_open
    g.debug.setFlag('cave_open', true);
    __qa.tp('overworld', 4, 15); out.push(go(0, -1)); out.push(go(0, 1));
    // dungeon interior doors
    __qa.tp('dungeon_1', 4, 2); out.push(go(0, -1)); out.push(go(0, 1));
    g.debug.setFlag('d1_door', true);
    __qa.tp('dungeon_1', 12, 2); out.push(go(0, -1)); out.push(go(0, 1));
    g.debug.setFlag('d3_wall', true);
    __qa.tp('dungeon_3', 7, 2); out.push(go(0, -1)); out.push(go(0, 1));
    // do the other houses have doors?
    __qa.tp('overworld', 16, 23); out.push(go(0, -1, 60));
    g.debug.godMode(false);
    return out;
  });
  for (const w of r.slice(0, -1)) {
    assert(w.arrived, `warp ${w.from} → ${w.to}`, w.snap);
    assert(!w.stuck, `warp ${w.from} → ${w.to}: spawn not inside a wall`, w.stuck);
    assert(w.stillThere, `warp ${w.from} → ${w.to}: no immediate bounce back`, w);
    if (w.spawnInWarp.length) note(`spawn ${w.from}→${w.to} lies inside a warp rect (dirReq protects it)`, w.spawnInWarp);
  }
  const mia = r[r.length - 1];
  note('walking into Mia\'s house door', { arrived: mia.arrived, to: mia.to });
});

S('bomb_cave', async ({ page, assert, note, ev }) => {
  await newGame(page);
  const r = await ev(async () => {
    const g = __drift.game, p = __qa.p(), out = {};
    g.debug.give('bombs', 5);
    __qa.tp('overworld', 4, 15);
    __qa.run(60, () => ({ y: -1 }));
    out.beforeMap = g.mapId;
    __qa.face('up');
    const hp0 = p.hp;
    __qa.tap('item', 2);
    out.bombObj = g.objects.some((o) => o.type === 'bomb');
    __qa.run(150);
    out.flag = !!g.flags.cave_open; out.hp = [hp0, p.hp];
    __qa.run(120, () => ({ y: -1 }), () => (g.mapId === 'cave' && !g.trans ? 'IN' : null));
    __qa.run(30);
    out.map = g.mapId;
    // heart container chest in the cave
    const mh = p.maxHp;
    __qa.walkTo(6 * 16 + 8, 3 * 16 + 12, 600, 2);
    __qa.face('up'); __qa.tap('action', 5); await __qa.clearDialogs(); __qa.run(20);
    out.maxHp = [mh, p.maxHp];
    // lifting/throwing a bomb
    __qa.tp('overworld', 21, 22);
    __qa.face('down'); __qa.tap('item', 2);
    __qa.tap('action', 20);
    out.carryBomb = p.carry?.type || null;
    __qa.tap('attack', 1);
    __qa.run(200);
    out.afterThrow = __qa.snap();
    return out;
  });
  assert(r.bombObj, 'item key places a bomb');
  assert(r.flag, 'bomb next to the cracked rock opens the cave', r);
  note('HP when standing next to own bomb (hp before/after)', r.hp);
  assert(r.map === 'cave', 'walk into the opened cave', r.map);
  assert(r.maxHp[1] === r.maxHp[0] + 2, 'cave chest gives a heart container', r.maxHp);
  assert(r.carryBomb === 'bomb', 'a placed bomb can be lifted', r.carryBomb);
  note('after throwing bomb', r.afterThrow);
});

S('pause_menu', async ({ page, assert, note, ev }) => {
  await newGame(page);
  await pause(page, false);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const a = await ev(() => ({ g: __drift.game.state, ui: __drift.ui.state, x: __drift.game.player.x }));
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.up('ArrowRight');
  const b = await ev(() => ({ x: __drift.game.player.x }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const c = await ev(() => ({ g: __drift.game.state, ui: __drift.ui.state }));
  await page.keyboard.press('KeyP'); await page.waitForTimeout(300);
  const d = await ev(() => ({ ui: __drift.ui.state }));
  await page.keyboard.press('KeyP'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, 'pause_2d.png') }).catch(() => {});
  assert(a.g === 'pause' && a.ui === 'pause', 'Enter opens pause', a);
  assert(Math.abs(b.x - a.x) < 0.01, 'game frozen while paused', { a: a.x, b: b.x });
  assert(c.g === 'play' && c.ui === 'hud', 'Esc closes pause', c);
  assert(d.ui === 'pause', 'P opens pause too', d);
});

S('zoom', async ({ page, assert, ev }) => {
  await newGame(page);
  await pause(page, false);
  const z0 = await ev(() => __drift.camera.target);
  await page.keyboard.press('Equal'); await page.waitForTimeout(200);
  const z1 = await ev(() => __drift.camera.target);
  await page.keyboard.press('Minus'); await page.keyboard.press('Minus'); await page.waitForTimeout(200);
  const z2 = await ev(() => __drift.camera.target);
  for (let i = 0; i < 12; i++) await page.keyboard.press('Equal');
  const zmax = await ev(() => [__drift.camera.target, __drift.camera.maxScale]);
  for (let i = 0; i < 12; i++) await page.keyboard.press('Minus');
  const zmin = await ev(() => [__drift.camera.target, __drift.camera.minScale]);
  await page.mouse.move(640, 360); await page.mouse.wheel(0, -100); await page.waitForTimeout(200);
  const zw = await ev(() => __drift.camera.target);
  assert(z1 > z0, '+ zooms in', [z0, z1]);
  assert(z2 < z1, '- zooms out', [z1, z2]);
  assert(zmax[0] === zmax[1], 'zoom clamps at max', zmax);
  assert(zmin[0] >= 0.5, 'zoom clamps at min', zmin);
  assert(zw > zmin[0], 'mouse wheel zooms', zw);
});

// touch controls via CDP touch events (pointer events are synthesised from them)
async function touchDrag(page, client, x0, y0, x1, y1, holdMs = 700) {
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
  const n = 6;
  for (let i = 1; i <= n; i++) { await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n, id: 1 }] }); await page.waitForTimeout(16); }
  await page.waitForTimeout(holdMs);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
for (const [W, H] of [[390, 844], [844, 390]]) {
  S(`touch_${W}x${H}`, async ({ page, assert, note, ev }) => {
    const client = await page.context().newCDPSession(page);
    await page.touchscreen.tap(W / 2, H / 2); await page.waitForTimeout(1200);
    const s0 = await ev(() => __qa.snap());
    assert(s0.map === 'house_elder', 'tap on title starts the game', s0);
    await page.waitForFunction(() => __drift.ui.state === 'dialog', null, { timeout: 4000 }).catch(() => {});
    await page.screenshot({ path: path.join(SHOTS, `touch_dialog_${W}x${H}.png`) });
    for (let i = 0; i < 40; i++) { if ((await ev(() => __drift.ui.state)) !== 'dialog') break; await page.touchscreen.tap(W / 2, H / 3); await page.waitForTimeout(150); }
    const s1 = await ev(() => ({ ...__qa.snap(), touch: __drift.ui.touchMode }));
    assert(s1.ui === 'hud', 'dialog can be tapped away', s1.ui);
    assert(s1.touch, 'touch mode active', s1.touch);
    const ctl = await ev(() => [...document.querySelectorAll('[data-ctrl]')].map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.ctrl, x: r.x, y: r.y, w: r.width, h: r.height, vis: getComputedStyle(e.parentElement).display !== 'none' }; }));
    const C = Object.fromEntries(ctl.map((c) => [c.id, c]));
    assert(C.stick && C.A && C.B && C.menu, 'touch controls exist', ctl.map((c) => c.id));
    for (const c of ctl) assert(c.x >= 0 && c.y >= 0 && c.x + c.w <= W + 1 && c.y + c.h <= H + 1, `control ${c.id} inside viewport`, c);
    for (const id of ['A', 'B', 'item']) if (C[id]) assert(C[id].w >= 44 && C[id].h >= 44, `button ${id} ≥ 44 px`, C[id]);
    await page.screenshot({ path: path.join(SHOTS, `touch_${W}x${H}.png`) });
    // stick: drag left and up inside the stick zone
    const sx = C.stick.x + Math.min(90, C.stick.w / 3), sy = C.stick.y + C.stick.h - 90;
    const a = await ev(() => __qa.snap());
    await touchDrag(page, client, sx, sy, sx - 60, sy, 600);
    const b = await ev(() => __qa.snap());
    await touchDrag(page, client, sx, sy, sx, sy - 60, 400);
    const c = await ev(() => __qa.snap());
    assert(b.x < a.x - 15, 'virtual stick left moves the player left', { a: a.x, b: b.x });
    assert(c.y < b.y - 10, 'virtual stick up moves the player up', { b: b.y, c: c.y });
    const axisAfter = await ev(() => __drift.input.axis);
    assert(Math.hypot(axisAfter.x, axisAfter.y) === 0, 'axis resets after release', axisAfter);
    // A button → attack
    let sawAttack = false;
    await page.touchscreen.tap(C.A.x + C.A.w / 2, C.A.y + C.A.h / 2);
    for (let i = 0; i < 8 && !sawAttack; i++) { sawAttack = (await ev(() => __drift.game.player.state)) === 'attack' || sawAttack; await page.waitForTimeout(30); }
    assert(sawAttack, 'A button swings the sword');
    // B: talk to Bodo (walk up first via evaluate)
    await ev(() => { __qa.tp('house_elder', 5, 4); __qa.p().dir = 'up'; });
    await page.touchscreen.tap(C.B.x + C.B.w / 2, C.B.y + C.B.h / 2); await page.waitForTimeout(300);
    const dl = await ev(() => __drift.ui.state);
    assert(dl === 'dialog', 'B button talks to NPC', dl);
    for (let i = 0; i < 30; i++) { if ((await ev(() => __drift.ui.state)) !== 'dialog') break; await page.touchscreen.tap(W / 2, H / 3); await page.waitForTimeout(150); }
    // menu
    await page.touchscreen.tap(C.menu.x + C.menu.w / 2, C.menu.y + C.menu.h / 2); await page.waitForTimeout(300);
    const pm = await ev(() => __drift.ui.state);
    assert(pm === 'pause', 'menu button opens pause', pm);
    await page.screenshot({ path: path.join(SHOTS, `touch_pause_${W}x${H}.png`) });
    await page.touchscreen.tap(C.menu.x + C.menu.w / 2, C.menu.y + C.menu.h / 2); await page.waitForTimeout(300);
    const z0 = await ev(() => __drift.camera.target);
    if (C.zin) { await page.touchscreen.tap(C.zin.x + C.zin.w / 2, C.zin.y + C.zin.h / 2); await page.waitForTimeout(200); }
    const z1 = await ev(() => __drift.camera.target);
    note('pause after second menu tap / zoom', { ui: await ev(() => __drift.ui.state), z0, z1 });
    assert(z1 > z0, 'zoom + button zooms in', { z0, z1 });
  }, { open: { ctx: { viewport: { width: W, height: H }, deviceScaleFactor: 3, hasTouch: true, isMobile: true } } });
}

// A key tapped between two polls (keydown+keyup inside one frame) – happens at low FPS / fast taps.
S('input_quick_tap', async ({ page, assert, note, ev }) => {
  await newGame(page);
  await pause(page, false);
  const res = {};
  for (const [name, key, read] of [['attack', 'Space', () => __drift.game.player.state], ['pause', 'Enter', () => __drift.ui.state]]) {
    // freeze the loop, tap the key, resume → the next poll sees neither keydown nor keyup
    await ev(() => { window.__qaPause = true; });
    await page.waitForTimeout(50);
    await page.keyboard.press(key);
    await ev(() => { window.__qaPause = false; });
    let seen = false;
    for (let i = 0; i < 10; i++) { const v = await ev(read); if (v === 'attack' || v === 'pause') seen = true; await page.waitForTimeout(20); }
    res[name] = seen;
    if (seen && name === 'pause') { await page.keyboard.press('Enter', { delay: 50 }); await page.waitForTimeout(200); }
  }
  note('tap inside one frame registered?', res);
  assert(res.attack && res.pause, 'a key tapped within one frame (keydown+keyup before the next poll) is not lost', res);
});

// Throwing a lifted bomb, with the real main loop (an exception there kills requestAnimationFrame).
S('bomb_throw_realloop', async ({ page, assert, note, ev }) => {
  await newGame(page);
  await ev(() => { __qa.tp('overworld', 21, 22, true); __drift.game.debug.give('bombs', 3); __drift.game.player.dir = 'down'; });
  await pause(page, false);
  await page.keyboard.press('KeyQ', { delay: 50 }); await page.waitForTimeout(150);
  await page.keyboard.press('KeyE', { delay: 50 }); await page.waitForTimeout(400);
  const c = await ev(() => __drift.game.player.carry?.type || null);
  await page.keyboard.press('Space', { delay: 50 });
  await page.waitForTimeout(1500);
  const f0 = await ev(() => __drift.game.frame);
  await page.waitForTimeout(500);
  const f1 = await ev(() => __drift.game.frame);
  note('carried', c);
  assert(c === 'bomb', 'bomb can be lifted with E');
  assert(f1 > f0 + 5, 'game loop keeps running after throwing a bomb', { f0, f1 });
  // a bomb exploding while it is carried
  await ev(() => { window.__qaPause = true; __qa.tp('overworld', 21, 22, true); __qa.face('down'); __qa.tap('item', 2); __qa.tap('action', 20); });
  const r = await ev(() => { const p = __qa.p(); const c = p.carry; __qa.run(200); return { carriedBefore: c?.type, carryAfter: p.carry?.type || null, carryDead: !!p.carry?.dead, hp: p.hp }; });
  note('bomb held for 3.3 s', r);
  assert(!(r.carryAfter && r.carryDead), 'an exploded bomb is not still held over the head', r);
}, { allowErrors: true });

S('memory_room_changes', async ({ page, assert, note, ev }) => {
  await newGame(page);
  const r = await ev(() => {
    const g = __drift.game, D = __drift, out = [];
    const count = () => ({ ents: g.entities.length, objs: g.objects.length, enemies: g.enemies.length, pickups: g.pickups.length, fx: (D.fx.drawables?.() || []).length, timers: g.timers.length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null });
    const cycle = ['overworld', 'house_elder', 'overworld', 'dungeon_1', 'dungeon_2', 'dungeon_1', 'dungeon_3', 'dungeon_4', 'overworld'];
    for (let k = 0; k < 4; k++) for (const m of cycle) { __qa.tp(m); __qa.run(30); if (m === 'overworld') out.push({ k, ...count() }); }
    return out;
  });
  note('overworld entity counts per cycle', r);
  const first = r[0], last = r[r.length - 1];
  assert(last.ents <= first.ents + 5, 'entity count stable after room cycling', { first: first.ents, last: last.ents });
  assert(last.fx <= first.fx + 20, 'fx drawables stable', { first: first.fx, last: last.fx });
  if (first.heap) note('JS heap MB first/last', [first.heap, last.heap]);
});

S('save_continue', async ({ page, assert, ev }) => {
  await newGame(page);
  await ev(() => { __qa.tp('dungeon_1'); __drift.game.debug.give('rupees', 33); __drift.game.save(); });
  await pause(page, false);
  await page.reload();
  await page.waitForFunction(() => window.__drift?.game);
  await page.waitForTimeout(300);
  await page.evaluate(QA_LIB);
  await page.keyboard.press('Enter'); await page.waitForTimeout(1000);
  const s = await ev(() => __qa.snap());
  assert(s.map === 'dungeon_1', 'reload + start continues at last entry', s);
  assert(s.rupees === 33, 'rupees persisted', s.rupees);
}, { open: {} });

// ---------------- 3D samples ----------------
const SHOT_SPOTS = [
  ['3d_village', 'overworld', 9, 24], ['3d_cliffs', 'overworld', 8, 15], ['3d_heights', 'overworld', 40, 8],
  ['3d_house', 'house_elder', 5, 6], ['3d_dungeon1', 'dungeon_1', 8, 10], ['3d_boss', 'dungeon_4', 8, 11],
];
S('3d_screens_and_fps', async ({ page, assert, note, ev }) => {
  await newGame(page);
  await pause(page, false);
  const fps = {};
  for (const [name, map, tx, ty] of SHOT_SPOTS) {
    await ev(([m, x, y]) => { __drift.game.debug.teleport(m, x, y); }, [map, tx, ty]);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SHOTS, name + '.png') });
    const f = await ev(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); }; requestAnimationFrame(tick); }));
    fps[name] = f;
  }
  // walking + fighting in 3D (logic should match 2D)
  await ev(() => __drift.game.debug.teleport('overworld', 21, 21));
  await page.waitForTimeout(500);
  const a = await ev(() => __qa.snap());
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(800); await page.keyboard.up('ArrowRight');
  const b = await ev(() => __qa.snap());
  await page.keyboard.press('Space'); await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(SHOTS, '3d_attack.png') });
  const info = await ev(() => ({ renderer: __drift.renderer.constructor?.name, stats: __drift.renderer.stats, gl: !!document.querySelector('#game').getContext }));
  note('3D FPS (SwiftShader software GL – not representative of real GPUs)', fps);
  note('renderer stats', info.stats);
  assert(b.x > a.x + 20, '3D: player walks', { a: a.x, b: b.x });
  assert(Object.values(fps).every((v) => v > 3), '3D renders frames everywhere (>3 fps in SwiftShader)', fps);
}, { open: { r3d: true }, allowErrors: false });

S('3d_touch_portrait', async ({ page, assert, note, ev }) => {
  await page.touchscreen.tap(195, 422); await page.waitForTimeout(1500);
  await page.waitForFunction(() => __drift.ui.state === 'dialog', null, { timeout: 6000 }).catch(() => {});
  for (let i = 0; i < 40; i++) { if ((await ev(() => __drift.ui.state)) !== 'dialog') break; await page.touchscreen.tap(195, 300); await page.waitForTimeout(150); }
  await ev(() => __drift.game.debug.teleport('overworld', 12, 24));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, '3d_touch_390x844.png') });
  const f = await ev(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(+(n / 3).toFixed(1)); }; requestAnimationFrame(tick); }));
  note('3D mobile FPS (SwiftShader, DPR 3)', f);
  assert(f > 1, '3D mobile renders', f);
}, { open: { r3d: true, ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true } } });

// ===========================================================================================================
await waitServer();
const t0 = Date.now();
for (const sc of scenarios) {
  if (ONLY && !ONLY.some((o) => sc.name.includes(o))) continue;
  if (args.no3d && sc.open?.r3d) continue;
  await runScenario(sc);
}
await browser.close();
srv.kill();
const failed = results.filter((r) => !r.ok);
const nChecks = results.reduce((a, r) => a + r.checks.length, 0), nFail = results.reduce((a, r) => a + r.checks.filter((c) => !c.ok).length, 0);
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed, ${nChecks - nFail}/${nChecks} checks, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (allErrors.length) console.log('Console/page errors:\n  ' + [...new Set(allErrors)].slice(0, 20).join('\n  '));
writeFileSync(path.join(OUT, 'playtest-results.json'), JSON.stringify({ date: new Date().toISOString(), seed: SEED, frames: RW_FRAMES, results }, null, 1));
process.exit(failed.length ? 1 : 0);
