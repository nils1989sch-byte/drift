// Hero (paper-doll from hand-drawn ASCII parts) + soldier (re-coloured parts with a helmet).
import { Pix, mat, frames } from './core.js';
import { palette as P } from './palette.js';

const L = {
  o: P.ink, d: P.tunic_dk, G: P.tunic_md, L: P.tunic_lt,
  S: P.skin_lt, s: P.skin_md, k: P.skin_dk, H: P.hair_md,
  E: P.blue_dk, b: P.wood_dk, B: P.wood_md, Y: P.gold_md, K: P.blue_md, q: P.blue_dk,
  m: P.metal_md, M: P.metal_lt, w: P.white, r: P.red_md, R: P.red_dk,
};
const M = (s) => mat(s, L);

// ---------------- parts (all include their own ink outline) ----------------
const HEAD = {
  down: M(`
......oooo......
....ooLLGGoo....
...oLLGGGGGdo...
..oLGGGGGGGGdo..
..oGGGGGGGGGdo..
.oHdGGGGGGGddHo.
oSHHHHHHHHHHHHSo
oSkHSSSSSSSSHkSo
.okSSESSSSESSko.
..oSSESSSSESSo..
..osSSSSSSSSso..
...oosSSSSsoo...`),
  up: M(`
......oooo......
....ooLLGGoo....
...oLLGGGGGdo...
..oLGGGGGGGGdo..
..oGGGGGGGGGdo..
.oHGGGGGGGGGdHo.
oSHGGGGGGGGGdHSo
oSkHdGGGGGGdHkSo
.okHHddGGddHHko.
..okHHHdGdHHko..
..okkHHHHHHkko..
...ookkkkkkoo...`),
  left: M(`
......oooo......
....ooLLGGoo....
...oLLGGGGGGo...
..oLGGGGGGGGdo..
..oGGGGGGGGGGdoo
.oHHGGGGGGGGddGo
.oHHHHHHHHdGGddo
oSHHSSHHHkHdooo.
oSSESSSSkSkHo...
oSSESSSSSkkHo...
.osSSSSSSSHko...
..oosSSSSokoo...`),
};
// eyes-closed variants (hurt / dead)
function closedEyes(p) { return p.recolor({ [P.blue_dk]: P.skin_md }); }

const TORSO = {
  down: M(`
....oddddddo....
...oLGGGGGGdo...
...oLGGGGGGdo...
...obBBYYBBbo...
...oGGGGGGGdo...
..oLGGGGGGGGdo..
..oGGdGGGdGGdo..
..oooooooooooo..`),
  up: M(`
....oddddddo....
...oLGGGGGGdo...
...oGGGGGGGdo...
...obBBBBBBbo...
...oGGGGGGGdo...
..oLGGGGGGGGdo..
..oGGdGGGdGGdo..
..oooooooooooo..`),
  left: M(`
.....oddddo.....
....oLGGGGdo....
....oLGGGGdo....
....obBBBBbo....
....oGGGGGdo....
...oLGGGGGGdo...
...oGGdGGdGdo...
...oooooooooo...`),
};

const LEGS = {
  down: {
    stand: M(`
....osSo.osSo...
....obBo.obBo...
...obBBo.obBBo..
...obbbo.obbbo..
....ooo...ooo...`),
    step: M(`
....osSo.osSo...
....obBo.obBo...
...obBBo.obbo...
...obbbo..oo....
....ooo.........`),
  },
  up: {
    stand: M(`
....osSo.osSo...
....obBo.obBo...
...obBBo.obBBo..
...obbbo.obbbo..
....ooo...ooo...`),
    step: M(`
....osSo.osSo...
....obBo.obBo...
...obbbo.obBBo..
....oo...obbbo..
..........ooo...`),
  },
  left: {
    stand: M(`
.....osSso......
.....obBBo......
....obBBBo......
...obbbbbo......
....ooooo.......`),
    a: M(`
....osSo.oSo....
...obBo..obo....
..obBo...obBo...
.obbbo...obbo...
..ooo.....oo....`),
    b: M(`
.....osSo.......
.....obBo.......
....obBBo.......
...obbbbo.......
....oooo........`),
    c: M(`
.....oSo.oSo....
....obo..obBo...
...obBo...obBo..
...obbo...obbbo.
....oo.....ooo..`),
  },
};

const ARM = M(`
.oo.
oLGo
oGdo
oGdo
oGdo
oSso
.oo.`);
const ARM_BACK = M(`
.oo.
odGo
oddo
oddo
oksko
.oo.`.replace('oksko', 'osko'));
const ARM_UP = M(`
.oo.
oSso
oGdo
oGdo
oGdo
.oo.`);
const ARM_FWD = M(`
.oooo.
oGGdSo
odddso
.oooo.`); // side-view arm reaching forward (points right; flipped for left view)
const SHIELD_FRONT = M(`
.oooo.
oYYYYo
oYKKYo
oYKqYo
oYKqYo
.oYYo.
..oo..`);
const SHIELD_SIDE = M(`
.oo.
oYYo
oKYo
oKYo
oKqo
oKqo
.oYo
..o.`);
const SHIELD_BACK = M(`
.oo.
obBo
obBo
obBo
obbo
.oo.`);
const HAND = M(`
.oo.
osSo
osso
.oo.`);

// ---------------- composition ----------------
// pose: { view: 'down'|'up'|'left', legs: key, bob, arms: 'rest'|'swingA'|'swingB'|'up'|'fwd'|'none-sword'|'hurt', head: Pix override }
function compose(pose, parts = { HEAD, TORSO, LEGS }) {
  const v = pose.view, p = new Pix(16, 24);
  const bob = pose.bob || 0, hy = pose.headDy || 0;
  const head = pose.headPix || parts.HEAD[v];
  const torso = parts.TORSO[v];
  const legs = parts.LEGS[v][pose.legs || 'stand'];
  const legsPix = pose.legsFlip ? legs.flipX() : legs;
  const arms = pose.arms || 'rest';
  const sw = arms === 'swingA' ? 1 : arms === 'swingB' ? -1 : 0;
  // back layers
  if (v === 'up') {
    if (arms === 'up') { p.blit(ARM_UP, 0, 6 - bob); p.blit(ARM_UP, 12, 6 - bob); }
  }
  if (v === 'left') {
    if (arms === 'up') p.blit(ARM_UP, 9, 6 - bob);
    else if (arms !== 'nosword' && arms !== 'fwd') p.blit(ARM_BACK, 9, 12 - bob - sw);
  }
  p.blit(legsPix, 0, 19);
  p.blit(torso, 0, 11 - bob);
  p.blit(head, 0, 0 - bob + hy);
  // front layers
  if (v === 'down') {
    if (arms === 'up') { p.blit(ARM_UP, 0, 6 - bob); p.blit(ARM_UP, 12, 6 - bob); }
    else if (arms === 'fwd') { p.blit(HAND, 4, 15 - bob); p.blit(HAND, 8, 15 - bob); }
    else if (arms === 'hurt') { p.blit(ARM, 0, 10 - bob); p.blit(ARM, 12, 10 - bob); }
    else {
      if (arms !== 'nosword') p.blit(ARM, 0, 12 - bob + sw);
      if (!pose.noShield) p.blit(SHIELD_FRONT, 10, 13 - bob - sw); else p.blit(ARM, 12, 12 - bob - sw);
    }
  } else if (v === 'up') {
    if (arms === 'fwd') { p.blit(ARM, 1, 10 - bob); p.blit(ARM, 11, 10 - bob); }
    else if (arms === 'hurt') { p.blit(ARM, 0, 10 - bob); p.blit(ARM, 12, 10 - bob); }
    else if (arms !== 'up') {
      if (!pose.noShield) p.blit(SHIELD_BACK, 1, 13 - bob + sw); else p.blit(ARM, 0, 12 - bob + sw);
      if (arms !== 'nosword') p.blit(ARM, 12, 12 - bob - sw);
    }
  } else {
    if (arms === 'fwd') { p.blit(ARM_FWD.flipX(), 1, 13 - bob); }
    else if (arms === 'up') { p.blit(ARM_UP, 4, 6 - bob); }
    else if (arms === 'hurt') { p.blit(ARM, 3, 10 - bob); }
    else if (!pose.noShield) p.blit(SHIELD_SIDE, 2, 12 - bob + sw);
    else p.blit(ARM, 5, 12 - bob + sw);
  }
  return p;
}
const viewOf = (dir) => (dir === 'right' ? 'left' : dir);
const DIRS = ['down', 'up', 'left', 'right'];
const out = (p, dir, ax, ay) => (dir === 'right' ? p.flipX().canvas(ax !== undefined ? p.w - ax : undefined, ay) : p.canvas(ax, ay));

// walk legs per view: 6 frames contact–pass–contact
const WALK = {
  down: [['step', 0, 'swingA'], ['step', 0, 'swingA'], ['stand', 1, 'rest'], ['step', 0, 'swingB', true], ['step', 0, 'swingB', true], ['stand', 1, 'rest']],
  up: [['step', 0, 'swingA'], ['step', 0, 'swingA'], ['stand', 1, 'rest'], ['step', 0, 'swingB', true], ['step', 0, 'swingB', true], ['stand', 1, 'rest']],
  left: [['a', 0, 'swingA'], ['b', 1, 'rest'], ['c', 0, 'swingB'], ['a', 0, 'swingB'], ['b', 1, 'rest'], ['c', 0, 'swingA']],
};

// ---------------- sword ----------------
function drawSword(angleDeg, len = 11, cols = { blade: P.metal_lt, edge: P.metal_md, guard: P.gold_md, grip: P.wood_dk }) {
  const s = new Pix(40, 40), cx = 20, cy = 20;
  const a = (angleDeg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
  const px = -dy, py = dx; // perpendicular
  for (let r = 0; r <= len; r += 0.5) {
    const x = cx + dx * r, y = cy + dy * r;
    if (r < 2) s.set(Math.round(x), Math.round(y), cols.grip);
    else if (r < 3) { for (let k = -2; k <= 2; k++) s.set(Math.round(x + px * k), Math.round(y + py * k), cols.guard); }
    else {
      s.set(Math.round(x), Math.round(y), cols.blade);
      if (r < len - 1) { const ex = Math.round(x + px), ey = Math.round(y + py); if (!s.op(ex, ey)) s.set(ex, ey, cols.edge); }
    }
  }
  s.outline(P.ink);
  return s; // pivot at (20,20)
}

// attack layout inside a 32×32 canvas: hero frame offset & hand pivot (relative to canvas)
const ATK = {
  down: { ox: 8, oy: 0, pivot: [13, 14], F: 90 },
  up: { ox: 8, oy: 8, pivot: [19, 14], F: 270 },
  left: { ox: 12, oy: 4, pivot: [17, 16], F: 180 },
};
export const ATTACK_ARC = [100, 62, 18, -22, -45];

function attackFrame(dir, angle, bodyPose) {
  const v = viewOf(dir), A = ATK[v];
  const c = new Pix(32, 32);
  const body = compose({ view: v, arms: 'nosword', ...bodyPose });
  const a = v === 'left' ? angle : angle; // left view uses true angle, right = mirror later
  const sw = drawSword(a);
  const behind = Math.sin((a * Math.PI) / 180) < -0.45 && v !== 'left' ? true : v === 'up';
  const [px, py] = A.pivot;
  if (behind) c.blit(sw, px - 20, py - 20);
  c.blit(body, A.ox, A.oy);
  if (!behind) c.blit(sw, px - 20, py - 20);
  c.blit(HAND, px - 2, py - 2);
  return c;
}
function slashFrame(dir, f) {
  const v = viewOf(dir), A = ATK[v];
  const c = new Pix(32, 32);
  const [px, py] = A.pivot;
  const ranges = [[100, 40], [70, -10], [30, -45]][f];
  const rIn = [7, 8, 10][f], rOut = 13;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = x + 0.5 - px, dy = y + 0.5 - py, r = Math.hypot(dx, dy);
    if (r < rIn || r > rOut) continue;
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI - A.F;
    ang = ((ang + 540) % 360) - 180;
    if (ang > ranges[0] || ang < ranges[1]) continue;
    const t = (r - rIn) / (rOut - rIn);
    c.put(x, y, t > 0.7 ? [P.white, P.metal_lt, P.metal_md][f] : t > 0.35 ? [P.metal_lt, P.metal_md, P.metal_dk][f] : [P.metal_md, P.metal_dk, P.metal_dk][f]);
  }
  return c;
}

// ---------------- builders ----------------
export function buildHero() {
  const S = {};
  for (const dir of DIRS) {
    const v = viewOf(dir);
    S[`hero_idle_${dir}`] = frames([out(compose({ view: v }), dir), out(compose({ view: v, headDy: 1 }), dir)], { fps: 1.6 });
    S[`hero_walk_${dir}`] = frames(WALK[v].map(([legs, bob, arms, fl]) => out(compose({ view: v, legs, bob, arms, legsFlip: fl }), dir)), { fps: 11 });
    // attack 32×32
    const A = ATK[v];
    const ax = A.ox + 8, ay = A.oy + 23;
    S[`hero_attack_${dir}`] = frames(ATTACK_ARC.map((d, i) => out(attackFrame(dir, A.F + d, { headDy: i === 2 ? 1 : 0, legs: v === 'left' && i >= 2 ? 'a' : v === 'left' ? 'stand' : 'stand' }), dir, ax, ay)), { fps: 18 });
    S[`fx_slash_${dir}`] = frames([0, 1, 2].map((f) => out(slashFrame(dir, f), dir, ax, ay)), { fps: 25 });
    const hurtHead = closedEyes(HEAD[v]);
    S[`hero_hurt_${dir}`] = frames([out(compose({ view: v, arms: 'hurt', headPix: hurtHead }), dir), out(compose({ view: v, arms: 'hurt', headPix: hurtHead, bob: 1 }), dir)], { fps: 16 });
    S[`hero_lift_${dir}`] = frames([
      out(compose({ view: v, arms: 'fwd', headDy: 2, legs: v === 'left' ? 'b' : 'stand' }), dir),
      out(compose({ view: v, arms: 'fwd', headDy: 1 }), dir),
      out(compose({ view: v, arms: 'up' }), dir),
    ], { fps: 12 });
    S[`hero_carry_${dir}`] = frames([0, 1, 2, 3].map((i) => {
      const w = WALK[v][[0, 2, 3, 5][i]];
      return out(compose({ view: v, legs: w[0], bob: w[1], arms: 'up', legsFlip: w[3] }), dir);
    }), { fps: 9 });
    S[`hero_push_${dir}`] = frames([0, 1, 2].map((i) => {
      const w = WALK[v][[0, 2, 3][i]];
      return out(compose({ view: v, legs: w[0], arms: 'fwd', headDy: 1, legsFlip: w[3] }), dir);
    }), { fps: 6 });
  }
  S.hero_item_get = [compose({ view: 'down', arms: 'up', headDy: 0 }).canvas()];
  // spin: 8 frames, 40×40, anchor (20,31)
  {
    const seq = [['down', 90], ['left', 135], ['left', 180], ['up', 225], ['up', 270], ['right', 315], ['right', 0], ['down', 45]];
    S.hero_spin = frames(seq.map(([dir, ang]) => {
      const v = viewOf(dir), c = new Pix(40, 40);
      const body = compose({ view: v, arms: 'nosword' });
      const a = dir === 'right' ? 180 - ang : ang; // drawn in un-mirrored space
      const sw = drawSword(a, 12), behind = Math.sin((a * Math.PI) / 180) < -0.3;
      const px = 20 + Math.round(Math.cos((a * Math.PI) / 180) * 3), py = 21 + Math.round(Math.sin((a * Math.PI) / 180) * 2);
      if (behind) c.blit(sw, px - 20, py - 20);
      c.blit(body, 12, 8);
      if (!behind) c.blit(sw, px - 20, py - 20);
      c.blit(HAND, px - 2, py - 2);
      return dir === 'right' ? c.flipX().canvas(20, 31) : c.canvas(20, 31);
    }), { fps: 20 });
  }
  // fall: painted smaller each frame, turning
  {
    const f0 = compose({ view: 'down' });
    const f1 = compose({ view: 'left' }).scaled(0.75, 8, 23);
    const f2 = M(`
................
................
................
................
................
................
................
................
................
................
................
................
................
................
......oooo......
.....oLGGdo.....
....oHHHHHHo....
....oSESSESo....
.....osSSso.....
.....oGGGdo.....
......oGdo......
.......oo.......
................
................`);
    const f3 = M(`
................
................
................
................
................
................
................
................
................
................
................
................
................
................
................
................
................
.......oo.......
......oGGo......
......oSSo......
.......oo.......
................
................
................`);
    S.hero_fall = frames([f0, f1, f2, f3].map((p) => p.canvas()), { fps: 8 });
  }
  // dead: spin then lie down
  {
    const lying = new Pix(24, 16);
    const body = compose({ view: 'down', headPix: closedEyes(HEAD.down), arms: 'rest' }).rot90();
    // rot90 → 24×16, head on the right; we want head left: flip
    lying.blit(body.flipX(), 0, 0);
    S.hero_dead = frames([compose({ view: 'left' }).canvas(), compose({ view: 'up' }).canvas(), lying.canvas(12, 14)], { fps: 6 });
  }
  return S;
}

// ---------------- soldier ----------------
const SOLDIER_RECOLOR = { [P.tunic_md]: P.blue_md, [P.tunic_lt]: P.blue_lt, [P.tunic_dk]: P.blue_dk, [P.wood_md]: P.metal_md, [P.wood_dk]: P.metal_dk, [P.gold_md]: P.metal_lt };
const SH = {
  down: M(`
.......rr.......
......rRro......
....oommmmoo....
...oMMmmmmmmo...
..oMMmmmmmmmmo..
..oMmmmmmmmmmo..
.ommmmmmmmmmmmo.
.omoSSSSSSSSomo.
.omoSESSSSESomo.
..ooSESSSSESoo..
...osSSSSSSso...
....oosSSsoo....`),
  up: M(`
.......rr.......
......rRro......
....oommmmoo....
...oMMmmmmmmo...
..oMMmmmmmmmmo..
..oMmmmmmmmmmo..
.ommmmmmmmmmmmo.
.ommmmmmmmmmmmo.
.ommmmmmmmmmmmo.
..ommmmmmmmmmo..
...ommmmmmmmo...
....oooooooo....`),
  left: M(`
........rr......
.......rRRr.....
....oommmmoo....
...oMMmmmmmmo...
..oMMmmmmmmmmo..
..oMmmmmmmmmmmo.
.ommmmmmmmmmmmo.
.oSSSSSmmmmmmmo.
oSESSSSSommmmo..
oSESSSSSommmo...
.osSSSSSSommo...
..oosSSSSooo....`),
};
export function buildSoldier() {
  const S = {};
  const TOR = Object.fromEntries(Object.entries(TORSO).map(([k, v]) => [k, v.recolor(SOLDIER_RECOLOR)]));
  const LEG = Object.fromEntries(Object.entries(LEGS).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([a, b]) => [a, b.recolor(SOLDIER_RECOLOR)]))]));
  const parts = { HEAD: SH, TORSO: TOR, LEGS: LEG };
  for (const dir of DIRS) {
    const v = viewOf(dir);
    const seq = [0, 2, 3, 5].map((i) => WALK[v][i]);
    // soldiers carry a short sword pointing forward-down
    const mk = (pose, ext = 0) => {
      const c = new Pix(32, 32), A = ATK[v];
      const body = compose({ ...pose, view: v, noShield: true }, parts);
      const ang = A.F + (v === 'up' ? 0 : 0);
      const sw = drawSword(ang, 8 + ext, { blade: P.metal_lt, edge: P.metal_md, guard: P.metal_dk, grip: P.wood_dk });
      const off = { down: [12, 16], up: [19, 12], left: [16, 17] }[v];
      const ox = off[0] + Math.round(Math.cos((ang * Math.PI) / 180) * ext), oy = off[1] + Math.round(Math.sin((ang * Math.PI) / 180) * ext);
      const behind = v === 'up';
      if (behind) c.blit(sw, ox - 20, oy - 20);
      c.blit(body, A.ox, A.oy);
      if (!behind) c.blit(sw, ox - 20, oy - 20);
      c.blit(HAND.recolor({}), ox - 2, oy - 2);
      return out(c, dir, A.ox + 8, A.oy + 23);
    };
    S[`soldier_walk_${dir}`] = frames(seq.map(([legs, bob, , fl]) => mk({ legs, bob, legsFlip: fl, arms: 'nosword' })), { fps: 8 });
    S[`soldier_attack_${dir}`] = frames([mk({ arms: 'nosword', headDy: 1 }, -2), mk({ arms: 'nosword', legs: v === 'left' ? 'a' : 'step' }, 4)], { fps: 8 });
  }
  return S;
}

export const heroParts = { compose, HEAD, TORSO, LEGS };
