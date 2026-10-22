// Humanoid paper-doll for HD-2D sprites (32×48 base frame, foot line y = 46, body centre x = 16.5).
// Views: 'down' (front), 'up' (back), 'side' (facing LEFT; right = mirrored + relit).
// A "look" describes materials and feature flags (hero, soldier, NPCs share the skeleton).
import { Fig, ik, lerp } from './rig.js';
import { M } from './materials.js';
import { drawHeadP } from './head.js';

export const CX = 16.5;   // body centre (between columns 16|17 → column 16 is the centre column)
export const FOOT = 45;   // boot centre line (soles reach y = 46)
const D2R = Math.PI / 180;

// ---------------- skeleton ----------------
export function skeleton(view, pose = {}) {
  const b = pose.bob || 0, s = pose.scale || 1, lean = pose.lean || 0;
  const J = { view, bob: b };
  const T = (x, y) => [CX + (x - CX) * s, 47 + (y - 47) * s];
  if (view === 'side') {
    J.hip = T(CX + 0.5 + lean * 0.3, 36.5 + b);
    J.shN = T(CX + 0.8 + lean, 27.6 + b); J.shF = T(CX - 0.2 + lean, 27.4 + b);
    J.neck = T(CX - 0.2 + lean, 24.5 + b);
    J.head = T(CX - 0.5 + lean * 1.2 + (pose.hx || 0), 16 + b + (pose.hdy || 0));
  } else {
    const sg = view === 'down' ? 1 : -1; // character's right is screen-left in the front view
    J.hip = T(CX + lean * 0.3, 36.5 + b);
    J.shR = T(CX - 5.4 * sg + lean, 27.8 + b); J.shL = T(CX + 5.4 * sg + lean, 27.8 + b);
    J.neck = T(CX + lean, 24.5 + b);
    J.head = T(CX + lean * 1.1 + (pose.hx || 0), 16 + b + (pose.hdy || 0));
    J.sg = sg;
  }
  J.s = s;
  return J;
}

// ---------------- head matrices (19 wide, centre column 9; origin = head centre - (9, 8)) ----------------
// h hair · d strand shadow · x deep hair · l highlight · L top highlight · s skin · S skin shadow · q mouth corner
// b brow · e eye (lash/pupil) · i iris · w glint · c blush · n nose shade · m mouth · k ear
export const HERO_HEAD = {
  down: `
........xhd........
......dhhlhhd......
....dhhlLlhhhdd....
...dhlLlhhhhdhhd...
..dhlLhhhhhdhhhhhd.
..hlhhhhhdhhhhdhhhd
.dhlhhhdhhhhhdhhhhd
.hhhhdhhhhhdhhhdhhx
dhhhdhhhdshhdshhdhx
dhhdSdhhsssdhsssdhx
xhdSbbbssssssbbbShx
xhsseesssnssseessSx
xkssiissssssssiisSk
.xsscsssssnsssscsx.
..xSssssqmqssssSx..
...xSSsssssssSSx...
.....xSSSSSSSx.....`,
  up: `
........xhd........
......dhhlhhd......
....dhhlLlhhhdd....
...dhlLlhhhhdhhd...
..dhlLhhhhhdhhhhhd.
..hlhhhhhdhhhhdhhhd
.dhlhhhdhhhhhdhhhhd
.hhhhdhhhhhdhhhdhhx
dhhhdhhhhdhhhhdhhhx
dhhdhhhdhhhhdhhhdhx
xhdhhhdhhhhhdhhdhhx
xhdhhdhhhdhhhdhhdhx
xkhhdhhhhdhhhhdhhkx
.xhdhhhdhhhdhhhdhx.
..xdhhdhhhdhhdhdx..
...xSdhSdhhSdhSx...
.....xSSSSSSSx.....`,
  side: `
.........xhd.......
.......dhhlhhd.....
.....dhhlLlhhhhd...
....dhlLlhhhhhdhhd.
...dhlLhhhhhdhhhhhd
..dhlhhhhhdhhhhdhhd
..hhhhhdhhhhhdhhhhd
.dhhhdhhhhdhhhdhhhx
.hhdshhhdhhhdhhhdhx
dhdsssshhhdhhdhhdhx
xdsbbsssshhdhhhdhhx
.dseesssskkhhdhhdhx
xssiissssSkkhdhhhdx
sssssssssSkhhdhdhx.
.Sssssssssxhhdhhx..
..xqmssssSxdhhdx...
...xSSsssSSxdhx....
....xxSSSSxx.......`,
};

const HEAD_LEGEND = (hairMat, skinMat, eyeMat, hc, o = {}) => {
  const hx = hc[0], hy = hc[1];
  const hairN = (x, y) => { // hair volume: big ellipsoid slightly above the head centre
    const u = (x + 0.5 - hx) / 10, v = (y + 0.5 - (hy - 1.5)) / 10, d = Math.min(0.96, u * u + v * v);
    return [u, v, Math.sqrt(1 - d)];
  };
  const fcx = hx + (o.faceDx || 0);
  const skinN = (x, y) => {
    const u = (x + 0.5 - fcx) / 7.2, v = (y + 0.5 - (hy + 2)) / 7.5, d = Math.min(0.96, u * u + v * v);
    return [u * 0.85, v * 0.85, Math.sqrt(1 - d)];
  };
  const H = (b, t) => ({ m: hairMat, n: hairN, b, t });
  const S = (b, t) => ({ m: skinMat, n: skinN, b, t });
  return {
    h: H(0), d: H(-1.1), x: H(-2.4), l: H(1.0), L: { m: hairMat, n: hairN, t: 5 },
    s: S(0), S: S(-1.1), n: S(-0.8), q: S(-1.3), k: S(-1.6), c: { m: M.blush, t: 2, n: skinN },
    m: { m: skinMat, t: 0, n: skinN },
    b: { m: hairMat, t: 1, n: skinN }, e: { m: eyeMat, t: 0 }, i: { m: eyeMat, t: o.eyeT ?? 2 }, w: { m: eyeMat, t: 3 },
    ...(o.extra || {}),
  };
};

// eye variants applied to the matrix string
export function headVariant(str, eyes) {
  if (eyes === 'closed') return str.replace(/e/g, 's').replace(/i/g, 'm');
  if (eyes === 'wince') return str.replace(/e/g, 'm').replace(/i/g, 'S');
  if (eyes === 'happy') return str.replace(/e/g, 's').replace(/i/g, 'm').replace(/qmq/, 'mmm');
  return str;
}

const HEADS = new Map();
export function drawHead(f, view, hc, look, pose = {}) {
  if (look.headP) {
    // cached stamp per (look, view, expression, scale, sub-pixel offset)
    const fx = Math.round((hc[0] - Math.floor(hc[0])) * 4) / 4, fy = Math.round((hc[1] - Math.floor(hc[1])) * 4) / 4;
    const key = `${look.id || ''}|${view}|${pose.eyes || ''}|${pose.mouth || ''}|${pose.scale || 1}|${fx}|${fy}`;
    let st = HEADS.get(key);
    if (!st) {
      st = new Fig(40, 40, 20, 20);
      drawHeadP(st, view, [fx, fy], look.headP, pose);
      st.ox = 0; st.oy = 0;
      HEADS.set(key, st);
    }
    f.stamp(st, Math.floor(hc[0]) - 20, Math.floor(hc[1]) - 20);
    return;
  }
  const set = look.headSet || HERO_HEAD;
  let str = set[view];
  str = headVariant(str, pose.eyes);
  if (pose.mouth === 'open') str = str.replace('qmq', 'mmm');
  const lg = HEAD_LEGEND(look.hair ?? M.hair, look.skin ?? M.skin, look.eye ?? M.eye, hc, { faceDx: view === 'side' ? -3 : 0, extra: look.headExtra });
  const ox = Math.round(hc[0] - 9.5), oy = Math.round(hc[1] - 8);
  if ((pose.scale || 1) < 0.95) { // small (falling): painted simple head
    const s = pose.scale || 1;
    f.ell(hc[0], hc[1] + 1 * s, 6.2 * s, 6 * s, look.skin ?? M.skin);
    f.ell(hc[0], hc[1] - 1.2 * s, 7 * s, 5.2 * s, look.hair ?? M.hair, { clip: (x, y) => y < hc[1] - 0.5 * s || Math.abs(x + 0.5 - hc[0]) > 4.5 * s });
    return;
  }
  return f.ascii(str, lg, ox, oy);
}

// ---------------- parts ----------------
function torsoN(cx, cy, hw, hh) {
  return (x, y) => {
    const u = Math.max(-1, Math.min(1, (x + 0.5 - cx) / hw)), v = Math.max(-1, Math.min(1, (y + 0.5 - cy) / hh));
    const nx = u * 0.9, ny = -0.25 + v * 0.35;
    return [nx, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))];
  };
}

function boot(f, view, x, y, lift, mat, o = {}) {
  const yy = y - lift;
  if (view === 'side') {
    const fw = o.toe ?? -1; // toe direction (-1 = left)
    f.limb(x, yy - 3.3, x, yy - 0.8, 2.1, 2.2, mat, { grp: o.grp });
    f.ell(x + fw * 1.1, yy + 0.4, 3.2, 1.6, mat, { grp: o.grp, flat: 0.2 });
    if (!o.noCuff) f.limb(x - 0.3, yy - 3.5, x + 0.3, yy - 3.5, 2.3, 2.3, mat, { grp: o.grp, bias: 0.9 });
  } else {
    f.limb(x, yy - 3.2, x, yy - 0.6, 2.2, 2.3, mat, { grp: o.grp });
    f.ell(x, yy + 0.4, 2.6, 1.6, mat, { grp: o.grp, flat: 0.2, bias: view === 'down' ? 0.3 : -0.2 });
    if (!o.noCuff) f.ell(x, yy - 3.4, 2.6, 1.0, mat, { grp: o.grp, bias: 0.9 });
  }
}

function leg(f, J, hip, foot, look, view, near, o = {}) {
  const [fx, fy, lift] = foot;
  const pm = look.pants ?? M.pants, g = f.newGroup();
  const ay = fy - lift - 3.6;
  if (view === 'side') {
    const kn = ik(hip[0], hip[1], fx, ay, 4.6, 4.2, 1); // knee forward (left)
    f.limb(hip[0], hip[1], kn[0], kn[1], 2.5, 2.2, pm, { grp: g, bias: near ? 0 : -0.9 });
    f.limb(kn[0], kn[1], fx, ay, 2.2, 1.9, pm, { grp: g, bias: near ? 0 : -0.9 });
  } else {
    f.limb(hip[0], hip[1], fx, ay, 2.6, 2.1, pm, { grp: g, bias: o.bias ?? 0 });
  }
  if (!look.noBoots) boot(f, view, fx, fy, lift, look.boot ?? M.boot, { grp: f.newGroup(), toe: -1 });
}

function arm(f, sh, hand, look, o = {}) {
  const sm = o.sleeve ?? look.sleeve ?? M.leather, g = f.newGroup();
  const el = ik(sh[0], sh[1], hand[0], hand[1], 4.4 * (o.len ?? 1), 4.2 * (o.len ?? 1), o.bend ?? 1);
  f.limb(sh[0], sh[1], el[0], el[1], 2.15, 1.85, sm, { grp: g, bias: o.bias ?? 0 });
  f.limb(el[0], el[1], hand[0], hand[1], 1.85, 1.6, o.forearm ?? sm, { grp: g, bias: o.bias ?? 0 });
  if (o.cuff !== false && (look.cuff ?? true)) f.ell(lerp(el[0], hand[0], 0.72), lerp(el[1], hand[1], 0.72), 1.9, 1.3, o.cuffMat ?? look.cuffMat ?? sm, { grp: g, bias: 0.6 });
  if (!o.noHand) f.ell(hand[0], hand[1] + 0.4, 1.75, 1.7, look.skin ?? M.skin, { bias: o.bias ?? 0 });
  return el;
}

// sword: hand position, angle (deg, screen space), length
export function sword(f, hx, hy, ang, len = 17, o = {}) {
  const a = ang * D2R, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
  const blade = o.blade ?? M.steel;
  // grip behind the hand, guard just in front, then blade
  f.limb(hx - dx * 2.6, hy - dy * 2.6, hx + dx * 0.8, hy + dy * 0.8, 1.0, 1.0, M.leather_dk);
  f.ell(hx - dx * 3.2, hy - dy * 3.2, 1.3, 1.3, M.brass);
  const g0x = hx + dx * 1.6, g0y = hy + dy * 1.6;
  f.limb(g0x - px * 2.6, g0y - py * 2.6, g0x + px * 2.6, g0y + py * 2.6, 0.95, 0.95, o.guard ?? M.brass);
  const b0x = hx + dx * 2.4, b0y = hy + dy * 2.4, b1x = hx + dx * len, b1y = hy + dy * len;
  const g = f.newGroup();
  f.limb(b0x, b0y, b1x, b1y, 1.35, 0.55, blade, { grp: g, flat: 0.1 });
  // fuller / edge glint along the lit side
  for (let r = 3.5; r < len - 2; r += 0.7) {
    const sx = hx + dx * r - px * 0.45 * Math.sign(px || 1), sy = hy + dy * r - py * 0.45;
    f.touch(sx, sy, { b: 0.9 });
  }
  if (o.hand) f.ell(hx, hy + 0.3, 1.75, 1.7, o.hand);
  return g;
}

// round shield: centre, radii (rx for perspective), facing: 'front' | 'back' | 'edge'
export function shield(f, cx, cy, rx, ry, face = 'front', o = {}) {
  if (face === 'edge') {
    f.ell(cx, cy, Math.max(1.4, rx), ry, M.iron, { flat: 0.3 });
    f.ell(cx - 0.4, cy, Math.max(0.8, rx - 0.8), ry - 1, M.wood, { flat: 0.3, bias: -0.3 });
    return;
  }
  const g = f.newGroup();
  f.ell(cx, cy, rx, ry, M.iron, { grp: g, flat: 0.35 });
  if (face === 'back') {
    f.ell(cx, cy, rx - 1.1, ry - 1.1, M.wood, { flat: 0.6, bias: -0.8 });
    f.limb(cx - rx + 1.5, cy, cx + rx - 1.5, cy, 0.9, 0.9, M.leather_dk);
    return;
  }
  const gi = f.newGroup();
  f.ell(cx, cy, rx - 1.15, ry - 1.15, M.wood, { grp: gi, flat: 0.45 });
  // planks
  for (const k of [-1, 1]) for (let y = -ry; y <= ry; y++) f.touch(cx - 0.5 + k * rx * 0.36, cy + y, f.matAt(cx - 0.5 + k * rx * 0.36, cy + y) === M.wood ? { b: -1.2 } : {});
  // emblem band + boss
  if (!o.plain) f.limb(cx, cy - ry + 1.6, cx, cy + ry - 1.6, Math.max(0.8, rx * 0.22), Math.max(0.8, rx * 0.22), M.emblem, { grp: gi, flat: 0.4 });
  f.ell(cx, cy, Math.max(1.2, rx * 0.34), Math.max(1.2, ry * 0.32), M.brass, { flat: 0.1 });
}

// scarf tail: from knot, base direction angle (deg), length, wave phase, wind 0..1
function tail(f, x, y, angDown, angWind, len, wind, phase, o = {}) {
  const pts = [];
  const n = 6;
  let px = x, py = y;
  const base = lerp(angDown, angWind, wind) * D2R;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const wav = Math.sin(phase - t * 3.2) * (0.5 + wind * 1.1) * t * 2.2;
    const a = base + (o.curl ?? 0) * t;
    const r = lerp(o.w0 ?? 1.9, o.w1 ?? 1.2, t);
    if (i > 0) { px += Math.cos(a) * (len / n) + Math.cos(a + Math.PI / 2) * (wav - (pts[i - 1]?.w ?? 0)); py += Math.sin(a) * (len / n) + Math.sin(a + Math.PI / 2) * (wav - (pts[i - 1]?.w ?? 0)); }
    pts.push(Object.assign([px, py, r, Math.sin(phase * 1.3 - t * 4) * 0.5], { w: wav }));
  }
  const g = f.chain(pts, o.mat ?? M.scarf, { flat: 0.35, grp: o.grp });
  // frayed end
  const e = pts[n];
  f.touch(e[0], e[1] + 1, { m: o.mat ?? M.scarf, g, b: -0.6 });
  return g;
}

function scarfWrap(f, J, view, pose) {
  const n = J.neck, wind = pose.wind ?? 0, ph = pose.phase ?? 0;
  const g = f.newGroup();
  if (view === 'side') {
    f.ell(n[0] + 0.3, n[1] + 0.6, 4.4, 2.7, M.scarf, { grp: g, flat: 0.2 });
    f.ell(n[0] - 0.8, n[1] + 1.6, 3.6, 1.6, M.scarf, { grp: g, flat: 0.25, bias: -0.7 });
  } else {
    f.ell(n[0], n[1] + 0.5, 6.3, 2.6, M.scarf, { grp: g, flat: 0.2 });
    // folds
    for (let x = -5; x <= 5; x += 2.5) f.touch(n[0] + x + (view === 'down' ? 0.5 : 0), n[1] + 1.6, { b: -1 });
    f.ell(n[0], n[1] + 1.7, 5.2, 1.5, M.scarf, { grp: g, flat: 0.3, bias: -0.5, clip: (x, y) => y > n[1] + 1.3 });
  }
  return g;
}

// scarf tails behind (drawn before the body) / in front (after)
function scarfBack(f, J, view, pose) {
  const n = J.neck, wind = pose.wind ?? 0, ph = pose.phase ?? 0;
  if (view === 'side') tail(f, n[0] + 3.4, n[1] + 0.6, 80, -8 + Math.sin(ph) * 6, 12 + wind * 3, wind, ph, { w0: 1.9, w1: 1.3 });
  if (view === 'down') { // tip of the back tail peeking out behind the left shoulder when moving
    if (wind > 0.25) tail(f, n[0] + 4.5, n[1] + 0.5, 70, -30 + Math.sin(ph) * 10, 7 + wind * 3, wind, ph, { w0: 1.6, w1: 1.1, mat: M.scarf_in });
  }
}
function scarfFront(f, J, view, pose) {
  const n = J.neck, wind = pose.wind ?? 0, ph = pose.phase ?? 0;
  if (view === 'down') {
    f.ell(n[0] + 3.6, n[1] + 1.8, 1.9, 1.7, M.scarf, { flat: 0.2, bias: 0.3 }); // knot
    tail(f, n[0] + 3.8, n[1] + 2.6, 94, 50, 7.5, wind * 0.5, ph, { w0: 1.7, w1: 1.35 });
  } else if (view === 'up') {
    f.ell(n[0] - 3.5, n[1] + 1.6, 1.9, 1.6, M.scarf, { flat: 0.2 });
    tail(f, n[0] - 3.2, n[1] + 2.4, 92, 35, 11 + wind * 2, wind * 0.8, ph, { w0: 1.9, w1: 1.4 });
  } else {
    f.ell(n[0] - 2.4, n[1] + 1.4, 1.8, 1.7, M.scarf, { flat: 0.2, bias: 0.3 });
    tail(f, n[0] - 2.4, n[1] + 2.2, 100, 60, 4.5, wind * 0.6, ph + 1, { w0: 1.5, w1: 1.2 });
  }
}

function jacket(f, J, view, look, pose) {
  const s = J.s, hip = J.hip, top = J.neck[1] + 1.2, bot = hip[1] - 1;
  const jm = look.jacket ?? M.leather;
  if (view === 'side') {
    const cx = J.neck[0] + 0.6, l = pose.lean || 0;
    const pts = [[cx - 3.6, top + 0.5], [cx + 3.4, top], [cx + 4.4, top + 4], [cx + 3.4 - l * 0.3, bot + 1.2], [cx - 3.6 - l * 0.3, bot + 1.2], [cx - 4.2, top + 4]];
    const g = f.poly(pts, jm, { nf: torsoN(cx, (top + bot) / 2, 4.4, 6) });
    if (look.shirt) f.poly([[cx - 4.1, top + 1.3], [cx - 2.4, top + 0.6], [cx - 2.4, bot], [cx - 3.8, bot]], look.shirt, { nf: torsoN(cx, (top + bot) / 2, 4.4, 6), grp: g });
    if (look.hem !== false) f.poly([[cx - 3.9, bot - 0.2], [cx + 3.8, bot - 0.2], [cx + 4.3, bot + 2.6], [cx - 4.3, bot + 2.6]], look.hemMat ?? look.shirt ?? jm, { nf: torsoN(cx, bot, 4.4, 4), bias: -0.2 });
    return g;
  }
  const cx = J.neck[0];
  const pts = [[cx - 5.6, top + 0.2], [cx + 5.6, top + 0.2], [cx + 6.0, top + 2.4], [cx + 4.9, bot + 1], [cx - 4.9, bot + 1], [cx - 6.0, top + 2.4]];
  const nf = torsoN(cx, (top + bot) / 2, 6.0, 6);
  const g = f.poly(pts, jm, { nf });
  if (view === 'down' && look.shirt) {
    // open front: shirt V + lapels
    f.poly([[cx - 2.6, top], [cx + 2.6, top], [cx + 1.6, bot + 1], [cx - 1.6, bot + 1]], look.shirt, { nf, grp: g });
    for (let y = Math.round(top); y < bot; y++) { const w = lerp(2.6, 1.6, (y - top) / (bot - top)); f.touch(cx - w - 0.5, y, { b: 1.2 }); f.touch(cx + w - 0.5, y, { b: -1 }); }
    if (look.laces) for (let y = Math.round(top + 2); y < bot - 1; y += 2) f.touch(cx - 0.5, y, { b: -1 });
  }
  if (view === 'up') { // back seam + shoulder yoke
    for (let y = Math.round(top + 1); y < bot; y++) f.touch(cx - 0.5, y, { b: -0.6 });
    for (let x = -5; x <= 5; x++) f.touch(cx + x - 0.5, top + 3.5, { b: 0.5 });
  }
  if (look.hem !== false) f.poly([[cx - 5.0, bot - 0.2], [cx + 5.0, bot - 0.2], [cx + 5.4, bot + 2.6], [cx - 5.4, bot + 2.6]], look.hemMat ?? look.shirt ?? jm, { nf: torsoN(cx, bot, 6, 4), bias: -0.2 });
  return g;
}

function belt(f, J, view, look) {
  if (look.noBelt) return;
  const y = J.hip[1] - 1.6, bm = look.belt ?? M.belt;
  if (view === 'side') {
    const cx = J.neck[0] + 0.6 + (J.lean || 0) * 0.3;
    f.limb(cx - 3.9, y, cx + 3.9, y, 1.15, 1.15, bm, { flat: 0.3 });
    if (look.pouch !== false) { f.ell(cx + 1.2, y + 2.1, 2.1, 2.0, M.pouch, { flat: 0.2 }); f.limb(cx - 0.6, y + 1.2, cx + 3, y + 1.2, 0.7, 0.7, M.pouch, { bias: 0.8 }); }
    return;
  }
  const cx = J.neck[0];
  f.limb(cx - 4.9, y, cx + 4.9, y, 1.15, 1.15, bm, { flat: 0.3 });
  if (view === 'down') {
    f.poly([[cx - 1.6, y - 1.2], [cx + 1.6, y - 1.2], [cx + 1.6, y + 1.2], [cx - 1.6, y + 1.2]], M.brass, { n: [-0.2, -0.3, 0.93] });
    f.touch(cx - 0.5, y - 0.2, { m: M.belt, t: 1 });
    if (look.pouch !== false) { // pouch on the right hip (screen left)
      f.ell(cx - 4.4, y + 2.4, 2.3, 2.1, M.pouch, { flat: 0.25 });
      f.limb(cx - 6.3, y + 1.2, cx - 2.6, y + 1.2, 0.75, 0.75, M.pouch, { bias: 0.9 });
      f.touch(cx - 4.9, y + 1.7, { m: M.brass, t: 3 });
    }
  } else if (look.pouch !== false) {
    f.ell(cx + 4.4, y + 2.2, 2.2, 2.0, M.pouch, { flat: 0.25, bias: -0.3 });
  }
}

// sheath on the left hip
function sheath(f, J, view, hilt = true) {
  const y = J.hip[1] - 0.6;
  if (view === 'side') {
    const x = J.neck[0] + 1.2;
    f.limb(x, y, x + 8.5, y + 5.4, 1.25, 1.0, M.leather_dk);
    f.ell(x + 8.6, y + 5.5, 1.1, 1.1, M.brass);
    if (hilt) { f.limb(x - 1, y - 0.6, x + 1, y + 0.6, 1.0, 1.0, M.brass, { bias: 0.4 }); f.limb(x - 1.2, y - 0.8, x - 4, y - 2.6, 0.95, 0.95, M.leather_dk); f.ell(x - 4.4, y - 2.9, 1.15, 1.15, M.brass); }
  } else if (view === 'up') {
    const x = J.neck[0] - 4.4;
    f.limb(x, y, x - 3.2, y + 7.5, 1.2, 1.0, M.leather_dk);
    f.ell(x - 3.3, y + 7.6, 1.1, 1.1, M.brass);
  } else {
    const x = J.neck[0] + 4.8;
    if (hilt) { f.limb(x - 0.6, y - 1.2, x + 0.8, y - 3.6, 0.95, 0.95, M.leather_dk); f.limb(x - 1.8, y - 0.8, x + 1.4, y - 1.1, 0.85, 0.85, M.brass); }
    f.limb(x + 0.4, y - 0.3, x + 2.3, y + 5.2, 1.2, 1.0, M.leather_dk);
  }
}

// ---------------- full figure ----------------
// pose: { bob, lean, hdy, eyes, mouth, feet:{R,L}|{N,F}, hands:{R,L}|{N,F}, wind, phase, sword:{a,len,behind},
//         shield:'arm'|'none'|'raised', carry, scale }
export function drawHuman(f, view, pose, look) {
  const J = skeleton(view, pose);
  J.lean = pose.lean || 0;
  const s = J.s;
  const T = (x, y) => [CX + (x - CX) * s, 47 + (y - 47) * s];
  const feet = pose.feet || {};
  const hands = pose.hands || {};
  const hasShield = look.shield && pose.shield !== 'none';
  const sw = pose.sword;

  if (view === 'side') {
    const fN = feet.N || [CX + 0.6, FOOT, 0], fF = feet.F || [CX - 0.4, FOOT, 0];
    const hN = hands.N || [J.shN[0] + 0.6, J.shN[1] + 7.6], hF = hands.F || [J.shF[0] - 0.2, J.shF[1] + 7.6];
    // far arm (sword hand) first
    const swordFront = sw && !sw.behind;
    if (sw && sw.behind) sword(f, hF[0], hF[1], sw.a, sw.len, { hand: look.skin ?? M.skin });
    if (look.scarf) scarfBack(f, J, view, pose);
    if (!(sw && swordFront && sw.farFront)) arm(f, J.shF, hF, look, { bias: -0.9, bend: sw ? -1 : 1, len: pose.armLen ?? 1 });
    if (look.back) look.back(f, J, view, pose);
    leg(f, J, J.hip, T(...fF).concat(fF[2]), look, view, false);
    leg(f, J, J.hip, T(...fN).concat(fN[2]), look, view, true);
    if (look.skirt) look.skirt(f, J, view, pose);
    if (look.body) look.body(f, J, view, pose); else jacket(f, J, view, look, pose);
    belt(f, J, view, look);
    if (look.sheath) sheath(f, J, view, !sw);
    if (look.scarf) scarfWrap(f, J, view, pose);
    drawHead(f, view, J.head, look, pose);
    if (look.headTop) look.headTop(f, J, view, pose);
    if (look.scarf) scarfFront(f, J, view, pose);
    if (sw && swordFront && sw.farFront) { arm(f, J.shF, hF, look, { bias: -0.4, bend: -1 }); }
    if (sw && swordFront) sword(f, hF[0], hF[1], sw.a, sw.len, { hand: look.skin ?? M.skin });
    if (look.prop) look.prop(f, J, view, pose, hN);
    arm(f, J.shN, hN, look, { bend: pose.bendN ?? 1, len: pose.armLen ?? 1 });
    if (hasShield) {
      const sh = pose.shieldAt || [hN[0] - 0.4, hN[1] - 0.6];
      shield(f, sh[0], sh[1], 3.4, 4.2, 'front');
    }
    return J;
  }

  const sg = J.sg;
  const fR = feet.R || [CX - 2.8 * sg, FOOT, 0], fL = feet.L || [CX + 2.8 * sg, FOOT, 0];
  const hR = hands.R || [J.shR[0] - 0.9 * sg, J.shR[1] + 7.6], hL = hands.L || [J.shL[0] + 0.9 * sg, J.shL[1] + 7.6];
  const up = view === 'up';
  const armsUp = pose.carry;
  if (sw && sw.behind) sword(f, hR[0], hR[1], sw.a, sw.len, { hand: look.skin ?? M.skin });
  if (look.scarf) scarfBack(f, J, view, pose);
  if (look.back && !up) look.back(f, J, view, pose);
  if (up && hasShield && pose.shield !== 'raised') {
    // seen from behind: shield on the left arm (screen left), edge-on
  }
  // legs: the one further "back" first
  leg(f, J, [J.hip[0] - 2.6 * sg, J.hip[1]], T(...fR).concat(fR[2]), look, view, true);
  leg(f, J, [J.hip[0] + 2.6 * sg, J.hip[1]], T(...fL).concat(fL[2]), look, view, true);
  if (look.skirt) look.skirt(f, J, view, pose);
  if (look.body) look.body(f, J, view, pose); else jacket(f, J, view, look, pose);
  belt(f, J, view, look);
  if (look.deco) look.deco(f, J, view, pose);
  if (look.sheath) sheath(f, J, view, !sw);
  if (up) {
    if (look.scarf) scarfWrap(f, J, view, pose);
    if (!armsUp) {
      arm(f, J.shR, hR, look, { bend: -sg * (pose.bendR ?? 1) });
      arm(f, J.shL, hL, look, { bend: sg });
      if (hasShield) shield(f, hL[0] - 1.2, hL[1] - 1.6, 2.2, 5.2, 'edge');
    }
    drawHead(f, view, J.head, look, pose);
    if (look.headTop) look.headTop(f, J, view, pose);
    if (look.scarf) scarfFront(f, J, view, pose);
    if (look.back) look.back(f, J, view, pose);
    if (armsUp) { arm(f, J.shR, hR, look, { bend: sg, len: 1.55 }); arm(f, J.shL, hL, look, { bend: -sg, len: 1.55 }); }
    if (sw && !sw.behind) sword(f, hR[0], hR[1], sw.a, sw.len, { hand: look.skin ?? M.skin });
    return J;
  }
  // front
  if (!armsUp) arm(f, J.shR, hR, look, { bend: sg * (pose.bendR ?? 1) });
  else { arm(f, J.shR, hR, look, { bend: -sg, len: 1.55 }); arm(f, J.shL, hL, look, { bend: sg, len: 1.55 }); }
  if (look.scarf) scarfWrap(f, J, view, pose);
  drawHead(f, view, J.head, look, pose);
  if (look.headTop) look.headTop(f, J, view, pose);
  if (look.scarf) scarfFront(f, J, view, pose);
  if (look.prop) look.prop(f, J, view, pose, hL);
  if (armsUp) { f.ell(hR[0], hR[1] + 0.4, 1.8, 1.7, look.skin ?? M.skin); f.ell(hL[0], hL[1] + 0.4, 1.8, 1.7, look.skin ?? M.skin); }
  else {
    if (sw && !sw.behind) sword(f, hR[0], hR[1], sw.a, sw.len, { hand: look.skin ?? M.skin });
    arm(f, J.shL, hL, look, { bend: -sg });
    if (hasShield) shield(f, hL[0] + 1.4, hL[1] - 0.6, 3.8, 4.4, 'front');
  }
  return J;
}

export { Fig };
