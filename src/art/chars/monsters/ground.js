// Ground monsters: funkel/glutar (fire), tropfi/strudelott (water), sprossi/dornigel (plant, plant/stone),
// kiesel/felspanzer (stone). Side view = facing LEFT (forward = -x). Ground at y = 0.
import { M } from '../materials.js';
import { eye, mouth, sparkle } from './kit.js';

// body motion from the pose: windup leans back, strike lunges forward
export function motion(P, side) {
  const a = P.atk;
  let dx = 0, dy = P.bob || 0;
  if (a === 0) { dx = side ? 2 : 0; dy += 1; }
  else if (a === 1) { dx = side ? -3 : 0; dy -= 1; }
  else if (a === 2) { dx = side ? -1 : 0; }
  if (P.hurt) dx = side ? 2 : 0;
  return { dx, dy, st: P.step || 0 };
}
// small in-sprite type burst in front of the mouth (strike frame)
export function burst(p, x, y, type, k = 1) {
  if (type === 'fire') { p.ell(x, y, 3.4 * k, 2.8 * k, M.flame, { flat: 0.3 }); p.ell(x - 2.6 * k, y - 1.6 * k, 1.8 * k, 1.6 * k, M.flame, { tone: 3 }); p.touch(x - 4 * k, y + 1, { m: M.flame, t: 4 }); }
  else if (type === 'water') { p.ell(x, y, 3 * k, 2.4 * k, M.water, { flat: 0.2 }); for (const [dx, dy] of [[-4, -2], [-3, 2.4], [-5.4, 0.4]]) p.ell(x + dx * k, y + dy * k, 1.1 * k, 1.1 * k, M.water, { tone: 3 }); }
  else if (type === 'leaf') { for (const [dx, dy, r] of [[0, 0, 2.4], [-3.4, -2, 1.8], [-2.6, 2.6, 1.6]]) p.limb(x + dx * k - r, y + dy * k + r * 0.5, x + dx * k + r, y + dy * k - r * 0.5, 1.1 * k, 0.6 * k, M.spine); }
  else if (type === 'rock') { for (const [dx, dy, r] of [[0, 0, 2.2], [-3.6, -1.6, 1.5], [-2.4, 2.4, 1.3]]) p.ell(x + dx * k, y + dy * k, r * k, r * 0.9 * k, M.stone); }
  else if (type === 'spark') { sparkle(p, x, y, 3); sparkle(p, x - 4 * k, y - 3 * k, 2); sparkle(p, x - 2 * k, y + 3 * k, 2); }
  else if (type === 'wind') { p.chain([[x + 2 * k, y - 2 * k, 0.8], [x - 2 * k, y - 3 * k, 1.0], [x - 4 * k, y, 0.9], [x - 1 * k, y + 2 * k, 0.6]], M.feather, { tone: 4 }); }
}
const E = (P, def = 'open') => P.eyes || def;

// ---------------- FUNKEL: dark red-brown salamander, glowing ember crest along the spine ----------------
function crestPlate(p, x, y, h, lean = 0, r = 2.3, hot = 0) {
  p.limb(x, y, x + lean, y - h, r, 0.7, M.flame, { flat: 0.2, bias: hot });
}
export function funkel(p, view, P) {
  const { dx, dy, st } = motion(P, view === 'side');
  const flick = Math.sin((P.ph || 0) * 2.4) * 0.8;
  if (view === 'side') {
    const bx = 6 + dx;
    // far legs
    p.ell(-3 + st * 2 + dx, -3, 3, 3.4, M.salamander, { bias: -1 }); p.ell(13 - st * 2 + dx, -3, 3, 3.4, M.salamander, { bias: -1 });
    // tail (curls up, no flame – speckled with embers)
    p.chain([[bx + 11, -12 + dy, 4.6], [bx + 19, -9 + dy, 3.8], [bx + 25, -13 + dy, 2.8], [bx + 25.5, -19 + dy + flick, 1.8], [bx + 22.5, -22 + dy + flick, 1.0]], M.salamander, { flat: 0.1 });
    for (const [x, y] of [[bx + 18, -11], [bx + 24, -15]]) p.touch(x, y + dy, { m: M.flame, t: 2 });
    p.ell(bx, -12 + dy, 12.5, 8, M.salamander, { flat: 0.05 });
    p.ell(bx - 1, -7.5 + dy, 9, 3.2, M.salamander, { bias: 0.8, clip: (x, y) => p.at(x, y) === M.salamander });
    // near legs
    p.ell(-5 - st * 2 + dx, -2.6, 3.3, 3.6, M.salamander, { bias: 0.1 }); p.ell(11 + st * 2 + dx, -2.6, 3.3, 3.6, M.salamander);
    for (const x of [-7 - st * 2 + dx, 9 + st * 2 + dx]) p.ell(x, -0.6, 2.4, 1.2, M.salamander, { bias: 0.4 });
    // head
    const hx = -9 + dx * 1.3, hy = -19 + dy;
    p.ell(hx, hy, 10.5, 9.6, M.salamander, { flat: 0.05 });
    p.ell(hx - 7.5, hy + 3.2, 4.6, 4.2, M.salamander, { bias: 0.4 });
    // crest: plates from crown down the back (the dominant silhouette feature)
    const pl = [[hx + 1, hy - 8.6, 6, 2.4], [hx + 6.6, hy - 6.2, 5, 1.8], [bx + 1, -19 + dy, 5.4, 2.2], [bx + 6.5, -18.6 + dy, 5, 2.2], [bx + 12, -16.4 + dy, 4.2, 2.6]];
    for (const [x, y, h, l] of pl) crestPlate(p, x, y, h + flick * 0.5, l, 2.3, P.atk === 0 ? 0.6 : 0);
    eye(p, hx - 3.4, hy + 1.6, 3.3, E(P));
    p.touch(hx - 11.4, hy + 1.8, { m: M.mouth, t: 0 });
    mouth(p, hx - 9, hy + 5.6, 2, !!P.mouth);
    p.ell(hx + 1.2, hy + 4.6, 1.6, 1.0, M.blush, { tone: 1 });
    if (P.atk === 1) burst(p, hx - 15, hy + 5, 'fire');
    if (P.atk === 0) { p.touch(hx + 2, hy - 14, { m: M.flame, t: 4 }); p.touch(bx + 4, -26 + dy, { m: M.flame, t: 3 }); }
    return;
  }
  const up = view === 'up';
  const hy = -20 + dy;
  if (up) { // back view: head behind, crest runs down the back towards the viewer
    p.ell(0, hy - 1, 10.6, 9.4, M.salamander, { flat: 0.05, bias: -0.2 });
    p.ell(-7.5 - st, -2.8, 3.2, 3.4, M.salamander); p.ell(7.5 + st, -2.8, 3.2, 3.4, M.salamander);
    p.ell(0, -11 + dy, 11.5, 8.6, M.salamander, { flat: 0.05 });
    p.chain([[0, -6 + dy, 4.6], [1, 0, 3.6], [6, 3, 2.6], [10, 1 + flick, 1.6]], M.salamander, { flat: 0.1 });
    for (const [y, h] of [[hy - 7, 6], [hy - 1.5, 5], [-15 + dy, 5], [-10 + dy, 4.4], [-5 + dy, 3.6]]) crestPlate(p, 0, y, h + flick * 0.5, 0, 2.4);
    return;
  }
  // front
  p.chain([[6, -10 + dy, 3.8], [13, -12 + dy, 3], [16, -18 + dy + flick, 2], [14, -22 + dy + flick, 1.1]], M.salamander, { flat: 0.1 });
  for (const [x, h, l] of [[-6, 5, -2], [6, 5, 2]]) crestPlate(p, x, -16 + dy, h + flick * 0.4, l, 2.2);
  p.ell(0, -10.5 + dy, 11, 8, M.salamander, { flat: 0.05 });
  p.ell(-7 - st, -2.6, 3.2, 3.4, M.salamander, { bias: 0.1 }); p.ell(7 + st, -2.6, 3.2, 3.4, M.salamander, { bias: 0.1 });
  p.ell(0, hy, 11.6, 10, M.salamander, { flat: 0.05 });
  p.ell(0, hy + 5, 6.4, 3.6, M.salamander, { bias: 0.7, clip: (x, y) => p.at(x, y) === M.salamander });
  for (const [x, h, l] of [[0, 7, 0], [-4.6, 5.4, -1.6], [4.6, 5.4, 1.6]]) crestPlate(p, x, hy - 8.6, h + flick * 0.5, l, 2.4, P.atk === 0 ? 0.6 : 0);
  eye(p, -4.8, hy + 2, 3.2, E(P)); eye(p, 4.8, hy + 2, 3.2, E(P));
  p.ell(-8.4, hy + 5.6, 1.6, 1, M.blush, { tone: 1 }); p.ell(8.4, hy + 5.6, 1.6, 1, M.blush, { tone: 1 });
  mouth(p, 0, hy + 7, 2.2, !!P.mouth);
  if (P.atk === 1) burst(p, 0, hy + 12, 'fire');
}

// ---------------- GLUTAR: upright lava salamander, crest → lava mane, + basalt shoulder plates ----------------
export function glutar(p, view, P) {
  const { dx, dy, st } = motion(P, view === 'side');
  const fl = Math.sin((P.ph || 0) * 2.2);
  const mane = (pts) => { for (const [x, y, l, h, r] of pts) p.limb(x, y, x + l, y - h, r, 0.8, M.flame, { flat: 0.2 }); };
  if (view === 'side') {
    const tx = 2 + dx * 0.6, ty = -30 + dy;
    // far leg + far arm
    p.limb(tx + 3, ty + 12, tx + 1 + st * 4, -4, 4.6, 3.6, M.salamander, { bias: -0.9 });
    p.ell(tx - 1 + st * 4, -1.6, 5, 2.4, M.salamander, { bias: -0.6 });
    p.limb(tx - 2, ty - 8, tx - 9 + (P.atk === 1 ? -5 : 0), ty + 2 + (P.atk === 0 ? -6 : 0), 3.2, 2.6, M.salamander, { bias: -0.9 });
    // tail
    p.chain([[tx + 7, ty + 10, 7], [tx + 18, ty + 20, 5], [tx + 28, ty + 22, 3.4], [tx + 34, ty + 17 + fl, 2], [tx + 35, ty + 12 + fl, 1]], M.salamander, { flat: 0.05 });
    for (const [x, y] of [[tx + 20, ty + 19], [tx + 28, ty + 20], [tx + 33, ty + 15]]) p.touch(x, y, { m: M.flame, t: 3 });
    // torso
    p.ell(tx, ty, 11.5, 16, M.salamander, { flat: 0.04 });
    p.ell(tx - 5.5, ty + 3, 5.2, 12, M.salamander, { bias: 0.9, clip: (x, y) => p.at(x, y) === M.salamander });
    // near leg (thick thigh + foot)
    p.ell(tx + 2, ty + 15, 6.6, 7, M.salamander);
    p.limb(tx + 1, ty + 18, tx - 1 - st * 4, -3.6, 4.4, 3.6, M.salamander);
    p.ell(tx - 3.4 - st * 4, -1.6, 5.4, 2.4, M.salamander, { bias: 0.3 });
    // head on a short neck
    const hx = tx - 7 + dx * 0.6, hy = ty - 22;
    p.limb(tx - 2, ty - 12, hx + 2, hy + 4, 6, 5, M.salamander);
    p.ell(hx, hy, 9.6, 8.4, M.salamander, { flat: 0.04 });
    p.ell(hx - 7.4, hy + 2.6, 5.4, 4.2, M.salamander, { bias: 0.3 });
    // lava mane (escalated crest) down the neck and back
    mane([[hx + 2, hy - 7, 3, 8, 2.8], [hx + 6.5, hy - 4, 5, 7, 2.6], [hx + 9, hy + 1.6, 6, 5.6, 2.6], [tx + 4, ty - 10, 6, 5, 2.4], [tx + 8.6, ty - 2, 5.6, 4, 2.2]].map(([x, y, l, h, r]) => [x, y, l, h + fl, r]));
    // basalt shoulder plate with glowing cracks (new feature)
    p.ell(tx - 1, ty - 9, 6.2, 5, M.basalt, { flat: 0.1 });
    for (const [x, y] of [[tx - 3, ty - 9], [tx - 1, ty - 8], [tx + 1, ty - 10]]) p.touch(x, y, { m: M.flame, t: 3 });
    // near arm with claws
    const ax = tx - 6 + (P.atk === 1 ? -9 : P.atk === 0 ? 3 : -2), ay = ty + 4 + (P.atk === 0 ? -9 : 0);
    p.limb(tx - 2, ty - 7, ax, ay, 3.6, 3, M.salamander);
    p.ell(ax - 0.6, ay + 1, 2.6, 2.4, M.salamander, { bias: 0.3 });
    eye(p, hx - 3, hy + 0.6, 2.7, E(P));
    p.limb(hx - 6, hy - 2.6, hx - 0.4, hy - 2, 0.7, 0.7, M.basalt, { tone: 0 }); // mature brow
    p.touch(hx - 11.6, hy + 1.4, { m: M.mouth, t: 0 });
    mouth(p, hx - 8.6, hy + 5.2, 2.4, !!P.mouth);
    if (P.atk === 1) burst(p, hx - 17, hy + 5, 'fire', 1.4);
    return;
  }
  const up = view === 'up';
  const ty = -30 + dy, hy = ty - 22;
  if (up) {
    p.ell(0, hy, 9.6, 8.4, M.salamander, { bias: -0.2 });
    p.limb(-6, ty + 14, -6 - st * 2, -3.6, 4.6, 3.6, M.salamander); p.limb(6, ty + 14, 6 + st * 2, -3.6, 4.6, 3.6, M.salamander);
    p.ell(0, ty, 13, 16, M.salamander, { flat: 0.04 });
    for (const s of [-1, 1]) { p.limb(s * 10, ty - 8, s * 14, ty + 6, 3.4, 2.8, M.salamander); p.ell(s * 9, ty - 9, 6, 5, M.basalt, { flat: 0.1 }); }
    p.chain([[0, ty + 12, 6.4], [2, ty + 24, 4.4], [8, ty + 30, 2.8], [13, ty + 28 + fl, 1.4]], M.salamander, { flat: 0.05 });
    for (const [x, y, h] of [[0, hy - 6, 9], [-4, hy - 3, 7], [4, hy - 3, 7], [0, ty - 12, 6], [0, ty - 4, 5]]) p.limb(x, y, x * 1.3, y - h - fl, 2.8, 0.8, M.flame, { flat: 0.2 });
    return;
  }
  p.chain([[6, ty + 14, 5], [16, ty + 22, 3.4], [21, ty + 18 + fl, 2], [21, ty + 12 + fl, 1]], M.salamander, { flat: 0.05 });
  p.limb(-6, ty + 12, -6.5 - st * 2, -3.6, 4.8, 3.8, M.salamander); p.limb(6, ty + 12, 6.5 + st * 2, -3.6, 4.8, 3.8, M.salamander);
  p.ell(-7 - st * 2, -1.6, 5, 2.4, M.salamander, { bias: 0.3 }); p.ell(7 + st * 2, -1.6, 5, 2.4, M.salamander, { bias: 0.3 });
  p.ell(0, ty, 12.6, 16, M.salamander, { flat: 0.04 });
  p.ell(0, ty + 3, 6.6, 12, M.salamander, { bias: 0.9, clip: (x, y) => p.at(x, y) === M.salamander });
  for (const [x, y, l, h] of [[-8, hy + 2, -6, 7], [8, hy + 2, 6, 7], [-5, hy - 5, -3, 8], [5, hy - 5, 3, 8], [0, hy - 7, 0, 9]]) p.limb(x, y, x + l, y - h - fl, 2.8, 0.8, M.flame, { flat: 0.2 });
  p.ell(0, hy, 10, 8.6, M.salamander, { flat: 0.04 });
  p.ell(0, hy + 4.6, 5.6, 3.4, M.salamander, { bias: 0.5, clip: (x, y) => p.at(x, y) === M.salamander });
  for (const s of [-1, 1]) {
    const ax = s * (14 + (P.atk === 1 ? 2 : 0)), ay = ty + 6 + (P.atk === 0 ? -10 : 0);
    p.limb(s * 10, ty - 8, ax, ay, 3.6, 3, M.salamander);
    p.ell(ax, ay + 1, 2.6, 2.4, M.salamander, { bias: 0.3 });
    p.ell(s * 9.6, ty - 9.6, 6.2, 5, M.basalt, { flat: 0.1 });
    p.touch(s * 9.6, ty - 9.6, { m: M.flame, t: 3 });
  }
  eye(p, -4.4, hy + 1.4, 2.7, E(P)); eye(p, 4.4, hy + 1.4, 2.7, E(P));
  p.limb(-7, hy - 2, -2, hy - 0.8, 0.7, 0.7, M.basalt, { tone: 0 }); p.limb(7, hy - 2, 2, hy - 0.8, 0.7, 0.7, M.basalt, { tone: 0 });
  mouth(p, 0, hy + 6, 2.6, !!P.mouth);
  if (P.atk === 1) burst(p, 0, hy + 12, 'fire', 1.4);
}

// ---------------- TROPFI: sandy otter pup with a turquoise scallop-shell cap ----------------
function scallop(p, x, y, rx, ry, tilt = 0) {
  p.ell(x, y, rx, ry, M.otter, { flat: 0.15 });
  for (let k = -2; k <= 2; k++) for (let t = 0.25; t < 1; t += 0.18) p.touch(x + k * rx * 0.36 * t + tilt * t, y + ry * 0.85 - t * ry * 1.6, { b: k % 2 ? -1 : 0.6 });
  p.ell(x, y + ry * 0.7, rx * 0.4, ry * 0.32, M.otter, { bias: -0.6 }); // hinge
}
export function tropfi(p, view, P) {
  const { dx, dy, st } = motion(P, view === 'side');
  const wag = Math.sin((P.ph || 0) * 2) * 1.2;
  if (view === 'side') {
    const bx = 4 + dx;
    p.ell(-4 + st * 2 + dx, -2.8, 2.8, 2.8, M.otter_dk, { bias: -0.6 }); p.ell(11 - st * 2 + dx, -2.8, 2.8, 2.8, M.otter_dk, { bias: -0.6 });
    p.chain([[bx + 11, -9 + dy, 3.6], [bx + 19, -6 + dy + wag * 0.4, 3.0], [bx + 26, -3.6 + wag, 2.4], [bx + 29, -2.6 + wag, 1.4]], M.otter_dk, { flat: 0.4 });
    p.ell(bx, -10.5 + dy, 12.5, 7.4, M.sandfur, { flat: 0.05 });
    p.ell(bx - 2, -6.6 + dy, 9, 2.6, M.cream, { flat: 0.2, clip: (x, y) => p.at(x, y) === M.sandfur });
    p.ell(-6 - st * 2 + dx, -2.4, 3, 3, M.otter_dk); p.ell(9 + st * 2 + dx, -2.4, 3, 3, M.otter_dk);
    const hx = -10 + dx * 1.2, hy = -16 + dy;
    p.ell(hx, hy, 9, 8.4, M.sandfur, { flat: 0.05 });
    p.ell(hx - 6.6, hy + 2.6, 4.4, 3.4, M.cream, { flat: 0.1 });
    p.ell(hx - 10.4, hy + 1.2, 1.5, 1.2, M.eye, { tone: 0 });
    p.ell(hx + 3, hy - 6.4, 2, 2, M.sandfur, { bias: -0.4 });
    scallop(p, hx + 0.5, hy - 7.6, 7.2, 4.2, -1);
    eye(p, hx - 3, hy + 0.6, 3, E(P));
    for (const k of [-1, 1]) p.touch(hx - 8, hy + 3.6 + k, { m: M.cream, t: 1 }); // whisker dots
    mouth(p, hx - 7.6, hy + 5.4, 1.6, !!P.mouth);
    if (P.atk === 1) burst(p, hx - 14, hy + 4, 'water');
    return;
  }
  const up = view === 'up', hy = -18 + dy;
  if (up) {
    p.ell(0, hy, 9.4, 8.6, M.sandfur, { bias: -0.1 });
    p.ell(-7 - st, -2.6, 3, 3, M.otter_dk); p.ell(7 + st, -2.6, 3, 3, M.otter_dk);
    p.ell(0, -10 + dy, 10.6, 7.6, M.sandfur, { flat: 0.05 });
    scallop(p, 0, hy - 7, 8, 4.4);
    p.chain([[0, -5 + dy, 3.6], [1 + wag * 0.4, 1, 3.2], [2 + wag, 5, 2.4]], M.otter_dk, { flat: 0.4 });
    return;
  }
  p.chain([[6, -7 + dy, 3], [12 + wag * 0.4, -5 + dy, 2.6], [16 + wag, -3, 1.8]], M.otter_dk, { flat: 0.4 });
  p.ell(0, -9.5 + dy, 10, 7.4, M.sandfur, { flat: 0.05 });
  p.ell(0, -8 + dy, 6.4, 5.2, M.cream, { flat: 0.2 });
  p.ell(-6.6 - st, -2.4, 3, 3, M.otter_dk, { bias: 0.1 }); p.ell(6.6 + st, -2.4, 3, 3, M.otter_dk, { bias: 0.1 });
  for (const s of [-1, 1]) p.ell(s * 8, hy - 5.4, 2.4, 2.2, M.sandfur, { bias: -0.2 });
  p.ell(0, hy, 10.2, 9, M.sandfur, { flat: 0.05 });
  p.ell(0, hy + 4.4, 5, 3.4, M.cream, { flat: 0.1 });
  p.ell(0, hy + 2.6, 1.6, 1.2, M.eye, { tone: 0 });
  scallop(p, 0, hy - 7.4, 8.2, 4.4);
  eye(p, -4.8, hy + 1.2, 3, E(P)); eye(p, 4.8, hy + 1.2, 3, E(P));
  mouth(p, 0, hy + 6, 1.8, !!P.mouth);
  if (P.atk === 1) burst(p, 0, hy + 11, 'water');
}

// ---------------- STRUDELOTT: tall otter, spiral shell helm (escalated cap) + water swirl ring (new) ----------------
function spiralHelm(p, x, y, r) {
  p.ell(x, y, r * 1.1, r * 0.8, M.otter, { flat: 0.1 });
  for (let t = 0; t < 1; t += 0.06) { const a = t * Math.PI * 3.2, rr = r * (1 - t) * 0.9; p.touch(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7, { b: -1.2 }); }
  p.limb(x - r * 0.3, y - r * 0.6, x + r * 0.5, y - r * 1.3, r * 0.35, 0.8, M.otter, { bias: 0.4 }); // spire
}
function swirl(p, cx, cy, rx, ry, ph, front) {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a0 = ph + (i / n) * Math.PI * 2, a1 = a0 + 0.5;
    const s0 = Math.sin(a0), s1 = Math.sin(a1);
    if (front ? s0 < 0 : s0 >= 0) continue;
    p.limb(cx + Math.cos(a0) * rx, cy + s0 * ry, cx + Math.cos(a1) * rx, cy + s1 * ry, 1.4, 1.1, M.water, { tone: i % 3 === 0 ? 3 : 2 });
  }
}
export function strudelott(p, view, P) {
  const { dx, dy, st } = motion(P, view === 'side');
  const ph = (P.ph || 0) * 1.4, wag = Math.sin((P.ph || 0) * 2) * 1.6;
  const ty = -26 + dy;
  if (view === 'side') {
    const tx = 2 + dx * 0.6;
    swirl(p, tx, ty + 6, 18, 5, ph, false);
    p.ell(tx + 1 + st * 3, -2.4, 5, 2.6, M.otter_dk, { bias: -0.6 });
    p.chain([[tx + 8, ty + 14, 5], [tx + 18, ty + 22, 4.4], [tx + 28, ty + 24 + wag * 0.5, 3.6], [tx + 34, ty + 23 + wag, 2]], M.otter_dk, { flat: 0.4 });
    p.ell(tx, ty, 11, 15.5, M.sandfur, { flat: 0.04 });
    p.ell(tx - 4.6, ty + 3, 5.4, 11, M.cream, { flat: 0.2, clip: (x, y) => p.at(x, y) === M.sandfur });
    p.ell(tx + 2, ty + 15, 6.4, 6, M.sandfur);
    p.ell(tx - 2 - st * 3, -2.4, 5.6, 2.8, M.otter_dk);
    const hx = tx - 5 + dx * 0.5, hy = ty - 20;
    p.ell(hx, hy, 9.4, 8.6, M.sandfur, { flat: 0.04 });
    p.ell(hx - 7, hy + 2.6, 5, 3.6, M.cream, { flat: 0.1 });
    p.ell(hx - 11.4, hy + 1.2, 1.6, 1.3, M.eye, { tone: 0 });
    spiralHelm(p, hx + 1.5, hy - 7.6, 7.6);
    eye(p, hx - 3.2, hy + 0.6, 2.6, E(P));
    p.limb(hx - 6, hy - 2.4, hx - 0.6, hy - 1.8, 0.6, 0.6, M.otter_dk, { tone: 0 });
    const ax = tx - 7 + (P.atk === 1 ? -8 : 0), ay = ty + 4 + (P.atk === 0 ? -8 : 0);
    p.limb(tx - 2, ty - 6, ax, ay, 3.4, 2.8, M.sandfur); p.ell(ax - 0.4, ay + 1, 2.6, 2.4, M.otter_dk);
    mouth(p, hx - 8.2, hy + 5.4, 2, !!P.mouth);
    swirl(p, tx, ty + 6, 18, 5, ph, true);
    if (P.atk === 1) burst(p, hx - 16, hy + 6, 'water', 1.5);
    return;
  }
  const up = view === 'up', hy = ty - 21;
  swirl(p, 0, ty + 6, 19, 5.4, ph, false);
  if (up) {
    p.ell(0, hy, 9.6, 8.6, M.sandfur, { bias: -0.1 });
    p.ell(-6 - st * 2, -2.4, 5, 2.6, M.otter_dk); p.ell(6 + st * 2, -2.4, 5, 2.6, M.otter_dk);
    p.ell(0, ty, 12.6, 15.5, M.sandfur, { flat: 0.04 });
    for (const s of [-1, 1]) p.limb(s * 10, ty - 7, s * 13, ty + 6, 3.2, 2.6, M.sandfur);
    spiralHelm(p, 0, hy - 7.4, 8);
    p.chain([[0, ty + 12, 5], [1, ty + 22, 4.6], [3 + wag, ty + 30, 3.4]], M.otter_dk, { flat: 0.4 });
    swirl(p, 0, ty + 6, 19, 5.4, ph, true);
    return;
  }
  p.chain([[6, ty + 14, 4.4], [15, ty + 20, 3.6], [20 + wag, ty + 22, 2.2]], M.otter_dk, { flat: 0.4 });
  p.ell(-6 - st * 2, -2.4, 5.4, 2.8, M.otter_dk); p.ell(6 + st * 2, -2.4, 5.4, 2.8, M.otter_dk);
  p.ell(0, ty, 12.6, 15.5, M.sandfur, { flat: 0.04 });
  p.ell(0, ty + 3, 7.6, 11, M.cream, { flat: 0.2, clip: (x, y) => p.at(x, y) === M.sandfur });
  for (const s of [-1, 1]) { const ax = s * (12.6 + (P.atk === 1 ? 2 : 0)), ay = ty + 4 + (P.atk === 0 ? -9 : 0); p.limb(s * 9.6, ty - 7, ax, ay, 3.4, 2.8, M.sandfur); p.ell(ax, ay + 1, 2.6, 2.4, M.otter_dk); }
  for (const s of [-1, 1]) p.ell(s * 7.8, hy - 5.6, 2.4, 2.2, M.sandfur, { bias: -0.2 });
  p.ell(0, hy, 9.8, 8.6, M.sandfur, { flat: 0.04 });
  p.ell(0, hy + 4.4, 5, 3.4, M.cream, { flat: 0.1 });
  p.ell(0, hy + 2.6, 1.7, 1.3, M.eye, { tone: 0 });
  spiralHelm(p, 0, hy - 7.6, 8);
  eye(p, -4.4, hy + 1, 2.6, E(P)); eye(p, 4.4, hy + 1, 2.6, E(P));
  mouth(p, 0, hy + 6, 2, !!P.mouth);
  swirl(p, 0, ty + 6, 19, 5.4, ph, true);
  if (P.atk === 1) burst(p, 0, hy + 12, 'water', 1.5);
}

// ---------------- SPROSSI: earthy hedgehog, back covered with upright sprouts carrying buds ----------------
function sprout(p, x, y, h, lean, sway, bud = true, k = 1) {
  const tx = x + lean + sway, ty = y - h;
  p.limb(x, y, tx, ty, 1.0 * k, 0.75 * k, M.spine, { flat: 0.2 });
  p.limb(tx, ty + h * 0.4, tx - 2.6 * k, ty + h * 0.2, 0.9 * k, 0.5 * k, M.spine, { bias: 0.3 });
  p.limb(tx, ty + h * 0.55, tx + 2.4 * k, ty + h * 0.3, 0.9 * k, 0.5 * k, M.spine, { bias: -0.2 });
  if (bud) p.ell(tx, ty - 0.8 * k, 1.7 * k, 1.9 * k, M.bud, { flat: 0.1 });
}
export function sprossi(p, view, P) {
  const { dx, dy, st } = motion(P, view === 'side');
  const sw = Math.sin((P.ph || 0) * 1.8) * 1;
  if (view === 'side') {
    const bx = 3 + dx;
    p.ell(-3 + st * 1.6 + dx, -2.4, 2.4, 2.4, M.earthfur, { bias: -0.8 }); p.ell(9 - st * 1.6 + dx, -2.4, 2.4, 2.4, M.earthfur, { bias: -0.8 });
    // back sprouts behind the body outline
    for (const [x, y, h, l] of [[bx + 9, -15, 7, 2.6], [bx + 3, -19, 8.4, 1], [bx - 3, -19.4, 8, -0.8], [bx + 12, -9.6, 5.6, 3.6]]) sprout(p, x, y + dy, h, l, sw * (h / 8));
    p.ell(bx, -11 + dy, 12.6, 10, M.earthfur, { flat: 0.05 });
    // face
    p.ell(bx - 9.6, -10 + dy, 5.6, 5.2, M.sandfur, { flat: 0.1 });
    p.ell(bx - 14.8, -10.6 + dy, 1.5, 1.3, M.eye, { tone: 0 });
    p.ell(-5 - st * 1.6 + dx, -2, 2.6, 2.4, M.earthfur); p.ell(7 + st * 1.6 + dx, -2, 2.6, 2.4, M.earthfur);
    eye(p, bx - 8.6, -11 + dy, 2.6, E(P));
    p.ell(bx - 6, -7.6 + dy, 1.4, 0.9, M.blush, { tone: 1 });
    mouth(p, bx - 12.4, -7.2 + dy, 1.4, !!P.mouth);
    for (const [x, y, h, l] of [[bx + 6, -18 + dy, 7, 1.4], [bx, -21 + dy, 7.6, -0.4]]) sprout(p, x, y, h, l, sw * 0.8);
    if (P.atk === 1) burst(p, bx - 19, -10 + dy, 'leaf');
    return;
  }
  const up = view === 'up';
  if (up) {
    p.ell(-6.6 - st, -2.4, 2.6, 2.4, M.earthfur); p.ell(6.6 + st, -2.4, 2.6, 2.4, M.earthfur);
    p.ell(0, -11 + dy, 12.4, 10.2, M.earthfur, { flat: 0.05 });
    for (const [x, y, h, l] of [[-6, -14, 6.4, -2], [6, -14, 6.4, 2], [0, -17, 7.4, 0], [-8, -8, 5, -3], [8, -8, 5, 3], [-3, -9, 5.6, -1], [3, -9, 5.6, 1]]) sprout(p, x, y + dy, h, l, sw * 0.8);
    return;
  }
  for (const [x, y, h, l] of [[-7, -16, 6, -3], [7, -16, 6, 3]]) sprout(p, x, y + dy, h, l, sw * 0.8);
  p.ell(0, -11 + dy, 12.2, 10, M.earthfur, { flat: 0.05 });
  p.ell(0, -9.6 + dy, 7.6, 6.6, M.sandfur, { flat: 0.1 });
  p.ell(-6.6 - st, -2, 2.6, 2.4, M.earthfur, { bias: 0.1 }); p.ell(6.6 + st, -2, 2.6, 2.4, M.earthfur, { bias: 0.1 });
  for (const [x, y, h, l] of [[-3.6, -19.6, 7, -1.2], [3.6, -19.6, 7, 1.2], [0, -20.4, 8.4, 0]]) sprout(p, x, y + dy, h, l, sw);
  eye(p, -3.8, -10 + dy, 2.6, E(P)); eye(p, 3.8, -10 + dy, 2.6, E(P));
  p.ell(0, -6.6 + dy, 1.5, 1.2, M.eye, { tone: 0 });
  p.ell(-6.6, -7 + dy, 1.4, 0.9, M.blush, { tone: 1 }); p.ell(6.6, -7 + dy, 1.4, 0.9, M.blush, { tone: 1 });
  mouth(p, 0, -4.6 + dy, 1.4, !!P.mouth);
  if (P.atk === 1) burst(p, 0, -1 + dy, 'leaf');
}

// ---------------- DORNIGEL (plant/stone): armoured hedgehog – stone plates (new) + thorny sprouts ----------------
function plate(p, x, y, rx, ry) {
  p.ell(x, y, rx, ry, M.ochre, { flat: 0.05 });
  p.limb(x - rx * 0.5, y - ry * 0.2, x + rx * 0.3, y + ry * 0.4, 0.5, 0.5, M.ochre, { bias: -1.6 });
}
function thorn(p, x, y, h, lean, sw) {
  p.limb(x, y, x + lean + sw, y - h, 1.4, 0.5, M.spine, { flat: 0.2 });
  p.limb(x + (lean + sw) * 0.5, y - h * 0.5, x + (lean + sw) * 0.5 + 2.2, y - h * 0.62, 0.6, 0.4, M.spine, { bias: -0.6 });
  p.ell(x + lean + sw, y - h - 0.6, 1.6, 1.7, M.bud);
}
export function dornigel(p, view, P) {
  const { dx, dy, st } = motion(P, view === 'side');
  const sw = Math.sin((P.ph || 0) * 1.6) * 1.2;
  const by = -20 + dy;
  if (view === 'side') {
    const bx = 4 + dx;
    p.ell(-6 + st * 2.4 + dx, -3, 4.2, 3.6, M.earthfur, { bias: -0.8 }); p.ell(14 - st * 2.4 + dx, -3, 4.2, 3.6, M.earthfur, { bias: -0.8 });
    for (const [x, y, h, l] of [[bx + 14, by - 9, 9, 4], [bx + 5, by - 15, 11, 1.4], [bx - 5, by - 14, 10, -1.4], [bx + 18, by + 1, 7, 5]]) thorn(p, x, y, h, l, sw);
    p.ell(bx, by, 20, 16, M.earthfur, { flat: 0.04 });
    for (const [x, y, rx, ry] of [[bx + 1, by - 9, 7, 5], [bx + 11, by - 5, 6.4, 5], [bx - 8, by - 7, 6, 4.6], [bx + 16, by + 4, 5, 4.4], [bx + 5, by + 1, 6, 4.4]]) plate(p, x, y, rx, ry);
    p.ell(bx - 15.6, by + 4, 7, 6.4, M.sandfur, { flat: 0.1 });
    p.ell(bx - 22, by + 3.4, 2, 1.6, M.eye, { tone: 0 });
    p.ell(-8 - st * 2.4 + dx, -2.6, 4.4, 3.6, M.earthfur); p.ell(12 + st * 2.4 + dx, -2.6, 4.4, 3.6, M.earthfur);
    eye(p, bx - 14.6, by + 2.4, 2.8, E(P));
    p.limb(bx - 18, by - 1, bx - 12, by - 0.4, 0.7, 0.7, M.earthfur, { tone: 0 });
    mouth(p, bx - 19, by + 8, 2, !!P.mouth);
    for (const [x, y, h, l] of [[bx + 9, by - 13, 9, 2], [bx - 1, by - 15.6, 10, -0.6]]) thorn(p, x, y, h, l, sw);
    if (P.atk === 1) burst(p, bx - 27, by + 4, 'rock', 1.3);
    return;
  }
  const up = view === 'up';
  if (up) {
    p.ell(-11 - st, -3, 4.4, 3.6, M.earthfur); p.ell(11 + st, -3, 4.4, 3.6, M.earthfur);
    p.ell(0, by, 19, 16, M.earthfur, { flat: 0.04 });
    for (const [x, y, rx, ry] of [[0, by - 8, 7.4, 5], [-9.6, by - 3, 6.4, 5], [9.6, by - 3, 6.4, 5], [-5, by + 6, 6.4, 4.6], [5, by + 6, 6.4, 4.6], [0, by + 1, 5, 4]]) plate(p, x, y, rx, ry);
    for (const [x, y, h, l] of [[-4.6, by - 12, 9, -2], [4.6, by - 12, 9, 2], [-13, by - 6, 8, -4], [13, by - 6, 8, 4], [0, by - 4, 8, 0]]) thorn(p, x, y, h, l, sw);
    return;
  }
  for (const [x, y, h, l] of [[-12, by - 9, 9, -4], [12, by - 9, 9, 4], [-6, by - 14, 10, -2], [6, by - 14, 10, 2]]) thorn(p, x, y, h, l, sw);
  p.ell(0, by, 19.4, 16, M.earthfur, { flat: 0.04 });
  for (const [x, y, rx, ry] of [[-11, by - 6, 6, 5], [11, by - 6, 6, 5], [0, by - 11, 7, 4.6]]) plate(p, x, y, rx, ry);
  p.ell(0, by + 4, 10, 8.6, M.sandfur, { flat: 0.1 });
  p.ell(-11 - st, -2.6, 4.6, 3.6, M.earthfur, { bias: 0.1 }); p.ell(11 + st, -2.6, 4.6, 3.6, M.earthfur, { bias: 0.1 });
  thorn(p, 0, by - 15, 10, 0, sw);
  eye(p, -5, by + 2.6, 2.8, E(P)); eye(p, 5, by + 2.6, 2.8, E(P));
  p.limb(-8, by - 1, -2.6, by + 0.2, 0.7, 0.7, M.earthfur, { tone: 0 }); p.limb(8, by - 1, 2.6, by + 0.2, 0.7, 0.7, M.earthfur, { tone: 0 });
  p.ell(0, by + 6.4, 2, 1.5, M.eye, { tone: 0 });
  mouth(p, 0, by + 9.6, 2, !!P.mouth);
  if (P.atk === 1) burst(p, 0, by + 15, 'rock', 1.3);
}

// ---------------- KIESEL: crab with PEBBLE claws, flat ochre shell with a moss spot ----------------
function pebbleClaw(p, x, y, r, open, side = 1) {
  p.ell(x, y, r, r * 0.9, M.stone, { flat: 0.05 });
  p.ell(x - side * r * 0.5, y - r * 0.9 - open, r * 0.62, r * 0.5, M.stone, { flat: 0.05, bias: 0.2 }); // upper pincer pebble
  p.touch(x - side * r * 0.2, y - r * 0.3, { b: -1.4 });
}
function crabLegs(p, cx, cy, w, st, n = 3, k = 1, back = false) {
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
    const lift = (i % 2 ? st : -st) * 0.8;
    const x0 = cx + s * w * (0.55 + i * 0.12), y0 = cy + 1;
    const x1 = cx + s * (w + 3.4 * k + i * 1.4 * k), y1 = -0.6 - Math.max(0, lift) * 1.2;
    p.limb(x0, y0, x1 - s * 1.4 * k, y0 - 2 * k, 1.2 * k, 1.0 * k, M.ochre, { bias: back ? -0.8 : -0.3 });
    p.limb(x1 - s * 1.4 * k, y0 - 2 * k, x1, y1, 1.0 * k, 0.6 * k, M.ochre, { bias: back ? -0.8 : -0.3 });
  }
}
export function kiesel(p, view, P) {
  const { dx, dy, st } = motion(P, view === 'side');
  const open = P.atk === 1 ? 2.4 : P.atk === 0 ? -0.4 : 0.6;
  const cy = -9 + dy;
  if (view === 'side') {
    const bx = 3 + dx;
    crabLegs(p, bx, cy, 7, st, 3, 0.9, true);
    p.ell(bx, cy, 12, 6.6, M.ochre, { flat: 0.05 });
    p.ell(bx + 1, cy - 2.4, 10, 3.6, M.ochre, { bias: 0.6, clip: (x, y) => p.at(x, y) === M.ochre });
    p.ell(bx + 3, cy - 4, 4, 2, M.moss, { flat: 0.3 });
    for (const [x, h] of [[bx - 7, 7], [bx - 4, 7.6]]) { p.limb(x, cy - 3, x - 0.6, cy - 3 - h, 0.9, 0.8, M.ochre); eye(p, x - 0.6, cy - 4 - h, 2.2, E(P)); }
    pebbleClaw(p, bx - 13 + (P.atk === 1 ? -3 : 0), cy - 1 - (P.atk === 0 ? 4 : 0), 4.6, open);
    mouth(p, bx - 10, cy + 2.2, 1.4, !!P.mouth);
    if (P.atk === 1) burst(p, bx - 21, cy - 2, 'rock');
    return;
  }
  const up = view === 'up';
  if (up) {
    for (const s of [-1, 1]) pebbleClaw(p, s * 12, cy - 4, 4.6, open, -s);
    crabLegs(p, 0, cy, 11, st, 3, 1);
    p.ell(0, cy, 14, 7, M.ochre, { flat: 0.05 });
    p.ell(2, cy - 2, 5, 2.6, M.moss, { flat: 0.3 });
    for (const [x, y] of [[-6, cy], [4, cy + 2], [8, cy - 2]]) p.touch(x, y, { b: -1.4 });
    return;
  }
  crabLegs(p, 0, cy, 11, st, 3, 1);
  p.ell(0, cy, 14, 7, M.ochre, { flat: 0.05 });
  p.ell(0, cy - 2.6, 11, 3.4, M.ochre, { bias: 0.6, clip: (x, y) => p.at(x, y) === M.ochre });
  p.ell(3, cy - 4.4, 4.6, 2, M.moss, { flat: 0.3 });
  for (const s of [-1, 1]) { p.limb(s * 3.6, cy - 4, s * 4.6, cy - 10, 0.9, 0.8, M.ochre); eye(p, s * 4.6, cy - 11.6, 2.4, E(P)); }
  mouth(p, 0, cy + 2.4, 1.6, !!P.mouth);
  for (const s of [-1, 1]) pebbleClaw(p, s * (15 + (P.atk === 1 ? 1 : 0)), cy + 1 - (P.atk === 0 ? 4 : 0), 4.8, open, -s);
  if (P.atk === 1) burst(p, 0, cy + 9, 'rock');
}

// ---------------- FELSPANZER: massive rock crab – jagged shell mound, boulder claws, crystals (new) ----------------
function crystal(p, x, y, h, lean, r = 2.2) { p.limb(x, y, x + lean, y - h, r, 0.6, M.crystal, { flat: 0.0 }); }
export function felspanzer(p, view, P) {
  const { dx, dy, st } = motion(P, view === 'side');
  const open = P.atk === 1 ? 4 : P.atk === 0 ? -0.6 : 1;
  const cy = -16 + dy;
  if (view === 'side') {
    const bx = 4 + dx;
    crabLegs(p, bx, cy + 4, 11, st, 3, 1.5, true);
    for (const [x, h, l] of [[bx + 2, 12, 1], [bx + 9, 9, 3], [bx - 5, 9, -2]]) crystal(p, x, cy - 9, h, l, 2.6);
    p.ell(bx, cy, 20, 12, M.stone, { flat: 0.04 });
    p.poly([[bx - 16, cy - 2], [bx - 8, cy - 12], [bx + 4, cy - 14], [bx + 16, cy - 9], [bx + 20, cy + 1], [bx - 18, cy + 3]], M.stone, { nf: (x, y) => [Math.sign(x - bx) * 0.3, -0.6, 0.74] });
    for (const [a, b] of [[[bx - 6, cy - 10], [bx - 2, cy - 4]], [[bx + 8, cy - 11], [bx + 6, cy - 3]], [[bx + 14, cy - 6], [bx + 17, cy]]]) p.limb(a[0], a[1], b[0], b[1], 0.5, 0.5, M.stone, { bias: -2 });
    p.ell(bx - 1, cy + 6, 16, 5, M.ochre, { flat: 0.2, bias: -0.2 });
    for (const [x, h] of [[bx - 11, 7], [bx - 7, 8]]) { p.limb(x, cy - 2, x - 1, cy - 2 - h, 1.3, 1.1, M.ochre); eye(p, x - 1, cy - 3 - h, 2.4, E(P)); }
    const cx = bx - 21 + (P.atk === 1 ? -5 : 0), ccy = cy + 2 - (P.atk === 0 ? 7 : 0);
    p.limb(bx - 12, cy + 4, cx + 3, ccy, 2.4, 2.4, M.ochre);
    pebbleClaw(p, cx, ccy, 7.6, open);
    for (const [x, h, l] of [[bx + 5, 10, 2], [bx - 2, 12, -1]]) crystal(p, x, cy - 11, h, l, 2.4);
    mouth(p, bx - 15, cy + 6, 2, !!P.mouth);
    if (P.atk === 1) burst(p, bx - 34, cy + 2, 'rock', 1.6);
    return;
  }
  const up = view === 'up';
  if (up) for (const s of [-1, 1]) pebbleClaw(p, s * 20, cy - 4, 7.4, open, -s);
  crabLegs(p, 0, cy + 4, 16, st, 3, 1.5);
  for (const [x, h, l] of [[-8, 10, -3], [8, 10, 3], [0, 13, 0]]) crystal(p, x, cy - 10, h, l, 2.6);
  p.ell(0, cy, 22, 12, M.stone, { flat: 0.04 });
  p.poly([[-18, cy - 1], [-10, cy - 12], [0, cy - 15], [10, cy - 12], [18, cy - 1]], M.stone, { nf: (x) => [x / 30, -0.6, 0.78] });
  for (const [a, b] of [[[-8, cy - 10], [-5, cy - 3]], [[7, cy - 11], [5, cy - 3]], [[14, cy - 6], [17, cy]]]) p.limb(a[0], a[1], b[0], b[1], 0.5, 0.5, M.stone, { bias: -2 });
  for (const [x, y] of [[-6, cy - 4], [9, cy - 6], [-14, cy - 2]]) p.ell(x, y, 3.2, 1.6, M.moss, { flat: 0.3 });
  if (up) { crystal(p, 4, cy - 5, 8, 2, 2.2); return; }
  p.ell(0, cy + 6, 18, 5.4, M.ochre, { flat: 0.2, bias: -0.2 });
  for (const s of [-1, 1]) { p.limb(s * 5, cy - 3, s * 6.4, cy - 11, 1.3, 1.1, M.ochre); eye(p, s * 6.4, cy - 12.6, 2.6, E(P)); }
  mouth(p, 0, cy + 6, 2.2, !!P.mouth);
  for (const s of [-1, 1]) { const x = s * (23 + (P.atk === 1 ? 2 : 0)), y = cy + 3 - (P.atk === 0 ? 7 : 0); p.limb(s * 14, cy + 4, x, y, 2.4, 2.4, M.ochre); pebbleClaw(p, x, y, 7.6, open, -s); }
  if (P.atk === 1) burst(p, 0, cy + 14, 'rock', 1.6);
}
