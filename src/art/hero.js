// Hero + soldier (HD-2D, double density: canvas.ws = 0.5 → world size stays 16×24 / 32×32).
// Painted procedurally with the character rig (src/art/chars/): normals + material ramps, relit when mirrored.
// Hero design: young adventurer – dark brown tousled hair, petrol scarf, short leather jacket over a cream
// shirt, belt with pouch, slate trousers, brown boots, short sword at the left hip, small round shield.
import { frames } from './core.js';
import { Fig, TAU, lerp } from './chars/rig.js';
import { M } from './chars/materials.js';
import { drawHuman, CX, FOOT, skeleton, sword } from './chars/human.js';
import { SOLDIER, buildSoldierHD } from './chars/soldier.js';
import { HERO_HAIR } from './chars/head.js';

const DIRS = ['down', 'up', 'left', 'right'];
const viewOf = (d) => (d === 'left' || d === 'right' ? 'side' : d);

export const HERO_LOOK = {
  id: 'hero',
  skin: M.skin, hair: M.hair, eye: M.eye,
  jacket: M.leather, shirt: M.shirt, sleeve: M.leather, cuffMat: M.leather_dk, hemMat: M.shirt,
  pants: M.pants, boot: M.boot, belt: M.belt,
  scarf: true, shield: true, sheath: true, pouch: true, laces: true,
  headP: { hair: M.hair, skin: M.skin, eye: M.eye, ...HERO_HAIR },
};

// render one pose; base frame 32×48, foot anchor (16, 47). Larger canvases keep the foot at (ax, ay).
export function renderPose(look, dir, pose, o = {}) {
  const w = o.w ?? 32, h = o.h ?? 48, ax = o.ax ?? 16, ay = o.ay ?? 47;
  const f = new Fig(w, h, ax - 16, ay - 47);
  const view = viewOf(dir);
  (o.draw || drawHuman)(f, view, pose, look);
  if (o.post) o.post(f);
  if (dir === 'right') { f.flip(); return f.canvas(w - 1 - ax, ay); }
  return f.canvas(ax, ay);
}

// ---------------- pose library ----------------
export function walkPose(view, i, n = 8, o = {}) {
  const ph = (i / n) * TAU + (o.ph0 ?? 0);
  const st = o.stride ?? 1, sn = Math.sin(ph), cs = Math.cos(ph);
  const bob = Math.round(-Math.cos(2 * ph) * (o.bobAmp ?? 1));
  const hdy = Math.round(-Math.cos(2 * ph - 1.1) * 0.6) - Math.round(-Math.cos(2 * ph) * 0.6);
  const pose = { bob, hdy, wind: o.wind ?? 0.75, phase: ph };
  const lift = (c) => Math.max(0, c) * (o.lift ?? 1.8);
  if (view === 'side') {
    const hx = CX + 0.5;
    pose.feet = {
      N: [hx - 4.4 * st * sn, FOOT, lift(cs) * 1.4],
      F: [hx + 4.4 * st * sn, FOOT, lift(-cs) * 1.4],
    };
    const J = skeleton('side', pose);
    pose.hands = {
      N: [J.shN[0] + 0.4 + 3.3 * sn * (o.arm ?? 1), J.shN[1] + 7.4 - Math.abs(sn) * 0.9],
      F: [J.shF[0] - 0.2 - 3.0 * sn * (o.arm ?? 1), J.shF[1] + 7.3 - Math.abs(sn) * 0.7],
    };
    pose.lean = o.lean ?? -0.6;
  } else {
    const sg = view === 'down' ? 1 : -1, fwd = view === 'down' ? 1 : -1;
    pose.feet = {
      R: [CX - 2.7 * sg + 0.3 * sg * lift(cs), FOOT + fwd * 1.3 * sn * st, lift(cs)],
      L: [CX + 2.7 * sg - 0.3 * sg * lift(-cs), FOOT - fwd * 1.3 * sn * st, lift(-cs)],
    };
    const J = skeleton(view, pose);
    pose.hands = {
      R: [J.shR[0] - 0.9 * sg + 0.5 * sg * sn, J.shR[1] + 7.5 - fwd * 1.5 * sn * (o.arm ?? 1)],
      L: [J.shL[0] + 0.9 * sg - 0.3 * sg * sn, J.shL[1] + 7.5 + fwd * 1.0 * sn * (o.arm ?? 1)],
    };
  }
  return pose;
}

function idlePose(view, i) {
  const br = [0, 0, 1, 1][i], ph = (i / 4) * TAU;
  const pose = { bob: br, wind: 0.12, phase: ph };
  const J = skeleton(view, pose);
  if (view === 'side') pose.hands = { N: [J.shN[0] + 0.7, J.shN[1] + 7.6 - br * 0.3], F: [J.shF[0] - 0.4, J.shF[1] + 7.5] };
  else pose.hands = { R: [J.shR[0] - 0.9 * J.sg, J.shR[1] + 7.6 - br * 0.4], L: [J.shL[0] + 0.9 * J.sg, J.shL[1] + 7.6 - br * 0.4] };
  return pose;
}

// attack: sword angles per view (deg, screen space) + body motion
const ATK = {
  down: { ax: 32, ay: 44, ang: [205, 160, 112, 64, 38], lean: [-1, -0.6, 0, 0.8, 0.5], bob: [0, 0, 1, 1, 0], reach: [4.5, 6, 6.8, 6.2, 5.2] },
  up: { ax: 32, ay: 60, ang: [22, 338, 288, 244, 218], lean: [1, 0.6, 0, -0.8, -0.5], bob: [0, 0, 1, 1, 0], reach: [4.5, 6, 6.8, 6.2, 5.2] },
  side: { ax: 40, ay: 54, ang: [312, 250, 202, 158, 134], lean: [0.8, 0, -1.6, -2, -1.2], bob: [0, 0, 1, 1, 0], reach: [4.5, 5.6, 6.8, 6.4, 5.4] },
};
const D2R = Math.PI / 180;
function attackPose(view, k, o = {}) {
  const A = ATK[view];
  const a = o.ang ?? A.ang[k];
  const pose = { bob: A.bob[k], lean: A.lean[k], wind: 0.6, phase: k * 1.3, mouth: k === 2 ? 'open' : undefined };
  const J = skeleton(view, pose);
  const r = o.reach ?? A.reach[k], c = Math.cos(a * D2R), s = Math.sin(a * D2R);
  let behind = false, farFront = false;
  if (view === 'down') behind = s < -0.35;
  else if (view === 'up') behind = s < -0.3;
  else { behind = c > 0.2 || s < -0.75; farFront = !behind && c < -0.2; }
  if (view === 'side') {
    const sh = J.shF;
    pose.hands = { F: [sh[0] + c * r, sh[1] + s * r * 0.85 + 1], N: [J.shN[0] + 2.5 - (A.lean[k] < -1 ? 0 : 1), J.shN[1] + 6.4] };
    pose.feet = { N: [CX - 2.4 + (k >= 2 ? -1.6 : 0), FOOT, 0], F: [CX + 3, FOOT, 0] };
  } else {
    const sh = J.shR;
    pose.hands = { R: [sh[0] + c * r, sh[1] + s * r * 0.8 + 1.2], L: [J.shL[0] + 0.6 * J.sg, J.shL[1] + 6.8] };
    pose.feet = { R: [CX - 3.1 * J.sg, FOOT + (view === 'down' ? 0.6 : -0.6), 0], L: [CX + 3.1 * J.sg, FOOT, 0] };
  }
  pose.sword = { a, len: o.len ?? 17, behind, farFront };
  return pose;
}

// slash arc FX matching the attack canvas (3 frames)
function slashFrame(dir, k) {
  const view = viewOf(dir), A = ATK[view];
  const f = new Fig(64, 64, A.ax - 16, A.ay - 47);
  const J = skeleton(view, { bob: 1 });
  const sh = view === 'side' ? J.shF : J.shR;
  const ranges = [[A.ang[0], A.ang[2]], [A.ang[1], A.ang[3]], [A.ang[2], A.ang[4]]][k];
  const rIn = [9, 11, 13][k], rOut = 24;
  const a0 = Math.min(...ranges), a1 = Math.max(...ranges);
  const span = a1 - a0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const lx = x - f.ox + 0.5 - sh[0], ly = (y - f.oy + 0.5 - sh[1]) / (view === 'side' ? 0.85 : 0.8);
    const r = Math.hypot(lx, ly);
    if (r < rIn || r > rOut) continue;
    let ang = Math.atan2(ly, lx) / D2R;
    // bring into [a0-180, a0+180)
    while (ang < a0 - 90) ang += 360; while (ang > a0 + 270) ang -= 360;
    if (ang < a0 || ang > a1) continue;
    const t = (r - rIn) / (rOut - rIn);
    const along = (ang - a0) / (span || 1);
    const lead = view === 'up' || (ATK[view].ang[0] > ATK[view].ang[4]) ? 1 - along : along; // leading edge brighter
    let tone = t > 0.82 ? 3 : t > 0.55 ? 2 : t > 0.3 ? 1 : 0;
    if (lead < 0.35 - k * 0.08) tone = Math.max(0, tone - 2 - k);
    if (k === 2) tone = Math.max(0, tone - 1);
    if (tone <= 0 && t < 0.3) continue;
    f.touch(x - f.ox, y - f.oy, { m: M.slash, t: tone });
  }
  if (dir === 'right') { f.flip(); return f.canvas(63 - A.ax, A.ay, { outline: false }); }
  return f.canvas(A.ax, A.ay, { outline: false });
}

export function buildHero() {
  const S = {};
  const L = HERO_LOOK;
  for (const dir of DIRS) {
    const v = viewOf(dir);
    S[`hero_idle_${dir}`] = frames([0, 1, 2, 3].map((i) => renderPose(L, dir, idlePose(v, i))), { fps: 3.3 });
    S[`hero_walk_${dir}`] = frames([0, 1, 2, 3, 4, 5, 6, 7].map((i) => renderPose(L, dir, walkPose(v, i))), { fps: 14 });
    const A = ATK[v];
    const big = { w: 64, h: 64, ax: A.ax, ay: A.ay };
    S[`hero_attack_${dir}`] = frames([0, 1, 2, 3, 4].map((k) => renderPose(L, dir, attackPose(v, k), big)), { fps: 18 });
    S[`fx_slash_${dir}`] = frames([0, 1, 2].map((k) => slashFrame(dir, k)), { fps: 25 });
    // charge: sword held forward, glint travels along the blade
    const chA = { down: 100, up: 262, side: 190 }[v];
    const ch = (gl) => renderPose(L, dir, { ...attackPose(v, 2, { ang: chA, reach: 5.4 }), bob: 0, lean: 0, mouth: undefined }, {
      ...big, post: gl ? (f) => {
        const J = skeleton(v, {}); const sh = v === 'side' ? J.shF : J.shR;
        const hx = sh[0] + Math.cos(chA * D2R) * 5.4, hy = sh[1] + Math.sin(chA * D2R) * 5.4 * (v === 'side' ? 0.85 : 0.8) + (v === 'side' ? 1 : 1.2);
        const tx = hx + Math.cos(chA * D2R) * 15, ty = hy + Math.sin(chA * D2R) * 15;
        for (const [dx, dy, t] of [[0, 0, 0], [1, 0, 2], [-1, 0, 2], [0, 1, 2], [0, -1, 2], [2, 0, 3], [-2, 0, 3], [0, 2, 3], [0, -2, 3]]) f.touch(tx + dx, ty + dy, { m: t === 0 ? M.glint : M.glow_hot, t: t === 0 ? 0 : t === 2 ? 3 : 2 });
      } : null,
    });
    S[`hero_charge_${dir}`] = frames([ch(false), ch(true)], { fps: 12 });
    // hurt: recoil, wince, arms flung out
    S[`hero_hurt_${dir}`] = frames([0, 1].map((k) => {
      const p = { bob: k, lean: v === 'side' ? 1.4 : 0, hdy: -1 + k, eyes: 'wince', mouth: 'open', wind: 0.9, phase: k * 2 };
      const J = skeleton(v, p);
      if (v === 'side') p.hands = { N: [J.shN[0] + 4.5, J.shN[1] + 4.5], F: [J.shF[0] - 4.2, J.shF[1] + 4] };
      else p.hands = { R: [J.shR[0] - 3.2 * J.sg, J.shR[1] + 5.2], L: [J.shL[0] + 3.2 * J.sg, J.shL[1] + 5.2] };
      p.shield = 'arm';
      return renderPose(L, dir, p);
    }), { fps: 16 });
    // lift: crouch & grab → rise → overhead
    S[`hero_lift_${dir}`] = frames([0, 1, 2].map((k) => renderPose(L, dir, liftPose(v, k))), { fps: 12 });
    S[`hero_carry_${dir}`] = frames([0, 2, 4, 6].map((i) => {
      const p = walkPose(v, i, 8, { arm: 0, wind: 0.6 });
      return renderPose(L, dir, carryHands(v, p));
    }), { fps: 9 });
    S[`hero_push_${dir}`] = frames([0, 2, 4, 6].map((i) => renderPose(L, dir, pushPose(v, i))), { fps: 7.7 });
    S[`hero_throw_${dir}`] = frames([0, 1].map((k) => {
      const p = { bob: 0, lean: v === 'side' ? -1.2 * (1 - k) : 0, wind: 0.5, phase: k, shield: k ? 'arm' : 'none' };
      const J = skeleton(v, p);
      if (v === 'side') p.hands = k ? { N: [J.shN[0] - 3, J.shN[1] + 5.5], F: [J.shF[0] - 3.4, J.shF[1] + 5] } : { N: [J.shN[0] - 5.5, J.shN[1] - 1], F: [J.shF[0] - 5.8, J.shF[1] - 1.5] };
      else p.hands = k ? { R: [J.shR[0] - 0.5 * J.sg, J.shR[1] + 7.2], L: [J.shL[0] + 0.5 * J.sg, J.shL[1] + 7.2] } : { R: [J.shR[0] + 2 * J.sg, J.shR[1] + (v === 'down' ? 4 : 1)], L: [J.shL[0] - 2 * J.sg, J.shL[1] + (v === 'down' ? 4 : 1)] };
      return renderPose(L, dir, p);
    }), { fps: 10 });
    // swim: upper body in water, arms stroking, ripple ring
    S[`hero_swim_${dir}`] = frames([0, 1, 2, 3].map((k) => renderPose(L, dir, swimPose(v, k), { ay: 47, post: (f) => waterCut(f, k) })), { fps: 7.5 });
  }
  // item get: both arms up, happy face
  {
    const p = { bob: 0, eyes: 'happy', mouth: 'open', wind: 0.3, carry: true, shield: 'none' };
    const J = skeleton('down', p);
    p.hands = { R: [CX - 8, J.head[1] - 4.5], L: [CX + 8, J.head[1] - 4.5] };
    S.hero_item_get = [renderPose(L, 'down', p)];
  }
  // spin attack: 8 frames 80×80, anchor (40, 62)
  {
    const seq = [['down', 90], ['left', 135], ['left', 180], ['up', 225], ['up', 270], ['right', 315], ['right', 0], ['down', 45]];
    S.hero_spin = frames(seq.map(([dir, ang], k) => {
      const v = viewOf(dir);
      const a = dir === 'right' ? 180 - ang : ang; // drawn in un-mirrored (left) space
      const p = { bob: 1, wind: 1, phase: k * 0.8, lean: v === 'side' ? -0.8 : 0, mouth: 'open' };
      const J = skeleton(v, p);
      const c = Math.cos(a * D2R), s = Math.sin(a * D2R);
      if (v === 'side') { p.hands = { F: [J.shF[0] + c * 6.6, J.shF[1] + s * 5.6 + 1], N: [J.shN[0] + 2, J.shN[1] + 6.4] }; p.sword = { a, len: 18, behind: c > 0.2, farFront: c < -0.2 }; }
      else { p.hands = { R: [J.shR[0] + c * 6.6, J.shR[1] + s * 5.4 + 1.2], L: [J.shL[0] + 0.6 * J.sg, J.shL[1] + 6.8] }; p.sword = { a, len: 18, behind: v === 'down' ? s < -0.35 : s < -0.3 }; }
      return renderPose(L, dir, p, { w: 80, h: 80, ax: dir === 'right' ? 39 : 40, ay: 62 });
    }), { fps: 20 });
    // anchors: mirrored canvases keep the foot column
    for (const c of S.hero_spin) c.ax = 40;
  }
  // fall: painted smaller each frame while turning
  S.hero_fall = frames([['down', 1], ['left', 0.78], ['up', 0.56], ['right', 0.36]].map(([dir, sc], k) => {
    const v = viewOf(dir);
    const p = { scale: sc, eyes: 'wince', wind: 1, phase: k * 1.5, shield: sc < 0.6 ? 'none' : 'arm' };
    const J = skeleton(v, p);
    if (v === 'side') p.hands = { N: [J.shN[0] - 3 * sc, J.shN[1] - 5 * sc], F: [J.shF[0] + 3 * sc, J.shF[1] - 5 * sc] };
    else p.hands = { R: [J.shR[0] - 2.5 * J.sg * sc, J.shR[1] - 5 * sc], L: [J.shL[0] + 2.5 * J.sg * sc, J.shL[1] - 5 * sc] };
    return renderPose(L, dir, p);
  }), { fps: 8 });
  // dead: turn, then lie down
  {
    const lieF = new Fig(48, 32);
    const body = new Fig(32, 48);
    const p = { eyes: 'closed', wind: 0, shield: 'none' };
    drawHuman(body, 'down', p, L);
    const r = body.rot90(); // 48×32, head on the right
    r.flip(); // head left
    S.hero_dead = frames([renderPose(L, 'left', { eyes: 'wince', wind: 0.4 }), renderPose(L, 'up', { wind: 0.4, bob: 1 }), r.canvas(24, 27)], { fps: 6 });
    void lieF;
  }
  return S;
}

function liftPose(v, k) {
  const p = { bob: [3, 2, 0][k], hdy: [1, 0, 0][k], lean: v === 'side' ? [-2, -1, 0][k] : 0, wind: 0.3, phase: k, shield: 'none' };
  const J = skeleton(v, p);
  if (k === 2) return carryHands(v, p);
  if (v === 'side') { const y = [6.5, 3.5][k]; p.hands = { N: [J.shN[0] - 4.5, J.shN[1] + y], F: [J.shF[0] - 5, J.shF[1] + y - 0.5] }; }
  else { const y = v === 'down' ? [8, 5][k] : [5.5, 3][k]; p.hands = { R: [CX - 3.6 * J.sg, J.shR[1] + y], L: [CX + 3.6 * J.sg, J.shL[1] + y] }; if (v === 'up') p.handsBehind = true; }
  return p;
}
function carryHands(v, p) {
  const J = skeleton(v, p);
  p.carry = true; p.shield = 'none';
  if (v === 'side') { p.hands = { N: [J.shN[0] - 2.6, J.head[1] - 3.2], F: [J.shF[0] - 3, J.head[1] - 3.6] }; p.carry = false; p.armLen = 1.5; }
  else p.hands = { R: [CX - 7.8 * J.sg, J.head[1] - 2.4], L: [CX + 7.8 * J.sg, J.head[1] - 2.4] };
  return p;
}
function pushPose(v, i) {
  const p = walkPose(v, i, 8, { stride: 0.7, arm: 0, wind: 0.4, lift: 1.1 });
  p.shield = 'none';
  const J = skeleton(v, { ...p, lean: v === 'side' ? -2.4 : 0 });
  p.lean = v === 'side' ? -2.4 : 0;
  if (v === 'side') p.hands = { N: [J.shN[0] - 6.2, J.shN[1] + 1.2], F: [J.shF[0] - 6.4, J.shF[1] + 0.6] };
  else if (v === 'down') { p.hands = { R: [CX - 4.2, J.shR[1] + 5.4], L: [CX + 4.2, J.shL[1] + 5.4] }; p.hdy = 1; }
  else p.hands = { R: [CX + 4.2, J.shR[1] + 2.6], L: [CX - 4.2, J.shL[1] + 2.6] };
  return p;
}
function swimPose(v, k) {
  const ph = (k / 4) * TAU;
  const p = { bob: 9, wind: 0.2, phase: ph, shield: 'none' };
  const J = skeleton(v, p);
  const sn = Math.sin(ph);
  if (v === 'side') p.hands = { N: [J.shN[0] - 4 * sn, J.shN[1] + 4], F: [J.shF[0] + 4 * sn, J.shF[1] + 4] };
  else p.hands = { R: [J.shR[0] - 3 * J.sg, J.shR[1] + 3.5 + 1.5 * sn], L: [J.shL[0] + 3 * J.sg, J.shL[1] + 3.5 - 1.5 * sn] };
  return p;
}
function waterCut(f, k) {
  // clear below the water line, add ripple ring
  const wl = 37 + f.oy;
  for (let y = wl; y < f.h; y++) for (let x = 0; x < f.w; x++) f.m[y * f.w + x] = 0;
  for (let x = 4; x < 28; x++) {
    const w = (x + k * 3) % 8;
    if (w < 5) f.touch(x - f.ox, wl - f.oy, { m: M.white, t: w < 2 ? 4 : 3, n: [0, -0.6, 0.8] });
    if (w === 0 || w === 5) f.touch(x - f.ox, wl + 1 - f.oy, { m: M.white, t: 2, n: [0, 0, 1] });
  }
}

export function buildSoldier() { return buildSoldierHD(renderPose, walkPose, ATK, skeleton, viewOf); }
export { SOLDIER };
