// Enemies, boss and NPCs.
import { Pix, mat, frames } from './core.js';
import { palette as P, R } from './palette.js';

const DIRS = ['down', 'up', 'left', 'right'];

// shaded ellipsoid with a 1px material-dark rim (separates overlapping parts)
function part(p, cx, cy, rx, ry, ramp, rim, o) {
  if (rim) p.ellipse(cx, cy, rx + 1, ry + 1, rim);
  p.ball(cx, cy, rx, ry, ramp, o);
}

// ---------------- octorok ----------------
function octorok(dir, f) {
  const p = new Pix(16, 16);
  const ramp = [P.red_dk, P.red_md, P.red_md, P.red_lt];
  // legs (alternate)
  const legs = f ? [[3, 13], [7, 14], [11, 13]] : [[4, 14], [8, 13], [12, 14]];
  for (const [x, y] of legs) { p.rect(x, y - 1, 2, 2, P.red_dk); }
  p.ball(8, 7.5, 6.5, 6, ramp);
  const ext = f ? 1 : 0;
  const snout = { down: [8, 12 + ext], up: [8, 2 - ext], left: [2 - ext, 8.5], right: [14 + ext, 8.5] }[dir];
  if (dir !== 'up') {
    const eyes = dir === 'down' ? [[4, 6], [10, 6]] : dir === 'left' ? [[5, 5]] : [[10, 5]];
    for (const [x, y] of eyes) { p.rect(x, y, 2, 3, P.white); p.rect(x + (dir === 'left' ? 0 : dir === 'right' ? 1 : x < 8 ? 1 : 0), y + 1, 1, 2, P.ink); }
  }
  // snout tube
  const [sx, sy] = snout;
  if (dir === 'up') { p.ellipse(sx, sy + 1, 2.5, 2, P.red_lt); p.rect(sx - 1, sy, 2, 1, P.ink); }
  else { p.ellipse(sx, sy, 2.5, 2.5, P.red_lt); p.ellipse(sx, sy, 1.2, 1.2, P.ink); }
  p.outline(P.ink);
  return p;
}
function octorokRock(f) {
  const p = new Pix(8, 8);
  p.ball(4, 4, 3, 3, [P.rock_dk, P.rock_md, P.rock_lt, P.rock_hi], { bias: f ? -0.1 : 0 });
  if (f) { p.set(3, 4, P.rock_dk); p.set(4, 5, P.rock_dk); } else { p.set(4, 3, P.rock_dk); p.set(3, 4, P.rock_dk); }
  p.outline(P.rock_ink);
  return p.canvas(4, 7);
}

// ---------------- slime ----------------
function slime(f) {
  const p = new Pix(16, 16);
  const [rx, ry] = [[6, 5], [7, 4], [5, 6.2]][f];
  const cy = 14.5 - ry;
  const ramp = [P.purple_dk, P.purple_md, P.purple_md, P.purple_lt];
  p.ball(8, cy, rx, ry, ramp);
  // drop tip
  const tip = Math.round(cy - ry);
  p.rect(7, tip - 1, 2, 2, P.purple_md); p.set(7, tip - 2, P.purple_lt);
  // flatten bottom
  for (let x = 0; x < 16; x++) p.clear(x, 15);
  p.rect(5, Math.round(cy - ry * 0.5), 2, 1, P.white); p.set(5, Math.round(cy - ry * 0.5) + 1, P.white);
  const ey = Math.round(cy + 0.5);
  p.rect(6, ey, 1, 2, P.ink); p.rect(10, ey, 1, 2, P.ink);
  p.outline(P.ink);
  return p.canvas();
}

// ---------------- bat ----------------
const BL = { o: P.ink, V: P.purple_dk, v: P.purple_md, Y: P.fx_yellow };
const BAT = [mat(`
................
................
.oo..........oo.
.ovo........ovo.
.ovVo..oo..oVvo.
..ovVooVVooVvo..
..oVVVVvVVVVVo..
...oVVYVVYVVo...
....ooVVVVoo....
......oVVo......
.......oo.......
................
................
................
................
................`, BL), mat(`
................
................
................
................
.......oo.......
......oVVo......
...ooooVvoooo...
..ovvVVYVYVvvo..
.ovVVVVVVVVVVvo.
.oVVoooVVoooVVo.
.oVo...oo...oVo.
.oo..........oo.
................
................
................
................`, BL)];

// ---------------- golem boss (40×40) ----------------
function golem(mode, f) {
  const p = new Pix(40, 40);
  const ramp = [P.rock_dk, P.rock_md, P.rock_lt, P.rock_hi];
  const hurt = mode === 'hurt';
  const rp = hurt ? [P.rock_md, P.rock_lt, P.rock_hi, P.white] : ramp;
  const bob = mode === 'idle' ? f : 0;
  let arms = [[6, 25], [34, 25]], head = [20, 11 + bob], armRy = 7;
  if (mode === 'attack') {
    if (f === 0) { arms = [[7, 20], [33, 20]]; }
    if (f === 1) { arms = [[8, 10], [32, 10]]; head = [20, 12]; }
    if (f === 2) { arms = [[9, 33], [31, 33]]; head = [20, 14]; armRy = 6; }
  }
  // legs
  part(p, 13, 34, 5, 4, rp, P.rock_dk); part(p, 27, 34, 5, 4, rp, P.rock_dk);
  // back arm parts when raised are behind body
  const raised = arms[0][1] < 18;
  if (raised) for (const [x, y] of arms) part(p, x, y, 5, armRy, rp, P.rock_dk);
  part(p, 20, 25 + bob, 13, 10, rp, P.rock_dk);
  if (!raised) for (const [x, y] of arms) part(p, x, y + bob, 5, armRy, rp, P.rock_dk);
  part(p, head[0], head[1], 8, 7, rp, P.rock_dk);
  // cracks
  const cr = [[14, 22], [15, 23], [15, 24], [16, 25], [25, 28], [26, 29], [24, 29]];
  for (const [x, y] of cr) p.set(x, y + bob, P.rock_dk);
  // moss
  for (const [x, y] of [[16, 5], [17, 4], [18, 4], [19, 5], [9, 19], [10, 18], [30, 18], [31, 19]]) p.set(x, y + (y < 10 ? head[1] - 11 : bob), P.grass_md);
  p.set(17, head[1] - 7, P.grass_lt); p.set(10, 17 + bob, P.grass_lt);
  // eyes
  const eye = hurt ? P.white : mode === 'attack' && f > 0 ? P.fx_yellow : P.fx_cyan;
  const ey = head[1] + 1;
  p.rect(16, ey, 3, 2, P.rock_ink); p.rect(22, ey, 3, 2, P.rock_ink);
  p.rect(16 + (f && mode === 'idle' ? 1 : 0), ey, 2, 1, eye); p.rect(22 + (f && mode === 'idle' ? 1 : 0), ey, 2, 1, eye);
  // core gem on chest
  p.rect(19, 23 + bob, 3, 3, hurt ? P.white : P.fx_cyan); p.set(19, 23 + bob, P.white); p.set(21, 25 + bob, P.water_md);
  p.outline(P.rock_ink);
  return p.canvas(20, 38);
}

// ---------------- NPCs ----------------
const NL = {
  o: P.ink, S: P.skin_lt, s: P.skin_md, k: P.skin_dk, E: P.blue_dk, w: P.white, M: P.metal_lt, m: P.metal_md,
  B: P.wood_md, L: P.wood_lt, b: P.wood_dk, H: P.hair_md, h: P.hair_dk, r: P.red_md, R: P.red_dk, l: P.red_lt,
  K: P.blue_md, q: P.blue_dk, u: P.purple_md, U: P.purple_dk, Y: P.gold_md,
};
const NPC = {
  elder: {
    head: `
................
................
.....oooooo.....
....oSSSSSSo....
...oSSSSSSSso...
..oSSSSSSSSSso..
..oMMMSSSSMMMo..
.oSoSESSSSESoSo.
.oSoMMwwwwMMoso.
..owwwwwwwwwwo..
..owwwMwwMwwwo..
...owwwwwwwwo...`,
    body: `
...oUUwwwwUUo...
..oUuUUwwUUUUoo.
..oSuUUUwUUUoSbo
..ouUUUUUUUUUobo
..ouUUUUUUUUUobo
..ouUUUUUUUUUobo
.ouUUUUUUUUUUobo
.ouUUUUUUUUUUobo
.ouuUUUUUUUUUobo
.ouUUUUUUUUUUobo
..ooobbbbbbooobo
....oo....oo..o.`,
  },
  girl: {
    head: `
................
......rrr.......
.....orlrro.....
....oHHHHHHo....
...oHHHHHHHHo...
..oHHHHHHHHHho..
..oHHHSSSSHHho..
.oHHSSSSSSSSHho.
.oHSSESSSSESShHo
.oHSSESSSSESShHo
.oHosSSSSSSsohHo
.oHHoosllsoohHo.`,
    body: `
.ohHorrwwrrohho.
..oorrrwwrrrooo.
...oSrrrrrrSo...
...oSorrrrrkSo..
...orRrrrrRrro..
..orrrrrrrrrRro.
..olrrrrrrrrRro.
.olrrrrrrrrrrRo.
.orwrwrwrwrwrwo.
..ooooooooooooo.
....osSo.osSo...
....oboo.oboo...`,
  },
  merchant: {
    head: `
................
....oooooooo....
...oBLLBBBBbo...
...oBLBBBBBbo...
..oobbbbbbbbbo..
.oBBBBBBBBBBBBo.
..ooSSSSSSSSoo..
...oSSESSESSo...
..oSSSESSESSSo..
..oSShhhhhhSSo..
...osShSShSso...
....oossssoo....`,
    body: `
...oKKKKKKKKo...
..oKKwwwwwwKKo..
.oKKqwwwwwwqKKo.
.oSqowwwwwwoqSo.
.oSqowwwYwwoqSo.
..ooowwwwwwooo..
...oqwwwwwwqo...
...oqwwwwwwqo...
...oqmwmwmwqo...
...oooooooooo...
....obbo.obbo...
....oooo.oooo...`,
  },
};
function npc(def, f) {
  const p = new Pix(16, 24);
  p.blit(mat(def.body, NL), 0, 12);
  p.blit(mat(def.head, NL), 0, f);
  return p.canvas();
}

export function buildActors() {
  const S = {};
  for (const dir of DIRS) S[`octorok_walk_${dir}`] = frames([octorok(dir, 0).canvas(), octorok(dir, 1).canvas()], { fps: 6.7 });
  S.octorok_rock = frames([octorokRock(0), octorokRock(1)], { fps: 10 });
  S.slime_idle = frames([slime(1), slime(0), slime(2)], { fps: 5.5 });
  S.bat_fly = frames(BAT.map((b) => b.canvas()), { fps: 12 });
  S.boss_golem_idle = frames([golem('idle', 0), golem('idle', 1)], { fps: 2 });
  S.boss_golem_attack = frames([golem('attack', 0), golem('attack', 1), golem('attack', 2)], { fps: 6 });
  S.boss_golem_hurt = [golem('hurt', 0)];
  for (const [name, def] of Object.entries(NPC)) S[`npc_${name}_idle_down`] = frames([npc(def, 0), npc(def, 1)], { fps: 2 });
  return S;
}
