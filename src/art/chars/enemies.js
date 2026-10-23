// Enemies in the HD-2D character style (double density, ws = 0.5, light from the top-left, coloured outlines).
//  - "Spitter" (sprite keys octorok_*): round clay-red burrow critter with a leaf sprout, big glossy eyes and a
//    tube snout that spits pebbles. Own design – not an octopus.
//  - slime, bat, stone golem boss.
import { frames } from '../core.js';
import { Fig } from './rig.js';
import { M } from './materials.js';
import { flashCanvas } from './util.js';

const D = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

// ---------------- spitter (octorok) 32×32, anchor (16, 30) ----------------
function eye(f, x, y, rx, ry, look = [0, 0], o = {}) {
  f.ell(x, y, rx, ry, M.white, { flat: 0.3 });
  f.ell(x + look[0] * rx * 0.35, y + look[1] * ry * 0.3 + 0.3, rx * 0.55, ry * 0.62, M.eye, { tone: 0 });
  if (!o.noGlint) f.touch(x - rx * 0.3, y - ry * 0.35, { m: M.glint, t: 0 });
}
const SPIT = new Map();
function spitter(dir, step, puff = 0) {
  const key = `${step}|${puff}`;
  if (dir === 'right' && SPIT.has(key)) { const f = SPIT.get(key); SPIT.delete(key); f.flip(); return f.canvas(15, 30); }
  const f = new Fig(32, 32);
  const [dx, dy] = D[dir];
  const side = dir === 'left' || dir === 'right';
  const v = dir === 'right' ? 'left' : dir;
  const sq = puff > 0 ? 0.6 : puff < 0 ? -0.5 : 0; // inhale (wider) / spit (stretched)
  const cx = 16, cy = 19 + (step ? 0.5 : 0);
  // feet (4 stubby legs, alternating)
  const fy = 28.4;
  const feet = side ? [[-5, step ? -1 : 0], [-1.5, step ? 0 : -1], [3, step ? -1 : 0], [6, step ? 0 : -1]] : [[-7, step ? -1 : 0], [-2.8, step ? 0 : -1], [2.8, step ? -1 : 0], [7, step ? 0 : -1]];
  for (const [x, l] of feet) f.ell(cx + x, fy + l, 2.4, 1.8, M.clay, { bias: -0.6, flat: 0.2 });
  // snout behind the body when facing up
  const snout = () => {
    const ext = 1 + (step ? 0.5 : 0) + Math.max(0, puff) * 1.5 - Math.min(0, puff);
    if (v === 'up') { f.limb(cx, cy - 6, cx, cy - 9 - ext, 2.8, 3.2, M.clay); f.ell(cx, cy - 9.8 - ext, 2.6, 1.4, M.mouth, { tone: 1 }); return; }
    if (v === 'down') {
      f.limb(cx, cy + 1, cx, cy + 4 + ext * 0.6, 3.0, 3.4 + puff * 0.4, M.clay, { bias: 0.2 });
      f.ell(cx, cy + 4.6 + ext * 0.6, 2.4 + puff * 0.4, 2.0 + puff * 0.3, M.mouth, { tone: 1 });
      f.ell(cx, cy + 4.9 + ext * 0.6, 1.3, 1.0, M.mouth, { tone: 0 });
      return;
    }
    f.limb(cx - 6, cy + 1.5, cx - 10.5 - ext, cy + 1.8, 3.0, 3.3 + puff * 0.4, M.clay);
    f.ell(cx - 11.6 - ext, cy + 1.8, 1.5, 2.6 + puff * 0.3, M.mouth, { tone: 1 });
    f.ell(cx - 11.9 - ext, cy + 1.9, 0.8, 1.4, M.mouth, { tone: 0 });
  };
  if (v === 'up') snout();
  // body
  f.ell(cx, cy, 10.2 + sq, 9 - sq * 0.6, M.clay, { flat: 0.05 });
  // back spots (lighter rim highlight + darker spots)
  const spots = v === 'up' ? [[-4, -2, 2], [3, -4, 1.6], [1, 2, 2.2], [-5, 4, 1.4], [6, 2, 1.4]] : v === 'down' ? [[-6, -4, 1.6], [5, -5, 1.4], [7, 0, 1.2]] : [[3, -5, 1.8], [6, -1, 1.6], [2, 2, 1.2], [7, 4, 1.2]];
  for (const [x, y, r] of spots) f.ell(cx + x, cy + y, r, r * 0.8, M.clay, { bias: -1.3, grp: f.grp });
  if (v === 'down') f.ell(cx, cy + 4, 6.4, 4, M.clay_belly, { flat: 0.2, clip: (x, y) => f.matAt(x, y) === M.clay });
  if (v === 'left') f.ell(cx - 2, cy + 4.6, 5.6, 3.4, M.clay_belly, { flat: 0.2, clip: (x, y) => f.matAt(x, y) === M.clay });
  // eyes on top of the head
  if (v === 'down') { eye(f, cx - 4.2, cy - 4.6, 2.9, 3.4, [0, 0.6]); eye(f, cx + 4.2, cy - 4.6, 2.9, 3.4, [0, 0.6]); }
  else if (v === 'left') { eye(f, cx - 4.6, cy - 4.6, 2.8, 3.4, [-0.8, 0.2]); }
  if (v !== 'up') snout();
  // leaf sprout
  const sy = cy - 8.6;
  f.limb(cx + 0.5, sy + 1, cx + 0.8, sy - 2, 0.8, 0.7, M.leaf, { bias: -0.6 });
  const sw = step ? 0.6 : 0;
  f.chain([[cx + 0.8, sy - 2, 0.8], [cx - 2.4, sy - 4 + sw, 1.8], [cx - 5.2, sy - 3.2 + sw, 0.6]], M.leaf, { flat: 0.3 });
  f.chain([[cx + 0.8, sy - 2, 0.8], [cx + 3.6, sy - 4.6 - sw, 1.6], [cx + 6, sy - 4.2 - sw, 0.5]], M.leaf, { flat: 0.3, bias: 0.3 });
  if (dir === 'right') { f.flip(); return f.canvas(15, 30); }
  if (dir === 'left') { const c = f.canvas(16, 30, { release: false }); SPIT.set(key, f); return c; }
  return f.canvas(16, 30);
}
function pebble(k) {
  const f = new Fig(16, 16);
  f.ell(8, 8.4, 4.2, 3.8, M.stone, { flat: 0.05 });
  const cr = k ? [[7, 9], [8, 10], [9, 10]] : [[9, 7], [8, 8], [8, 9]];
  for (const [x, y] of cr) f.touch(x, y, { b: -1.6 });
  f.touch(6, 6.5, { b: 1.2 });
  return f.canvas(8, 13);
}

// ---------------- slime 32×32, anchor (16, 30) ----------------
function slimeF(k) {
  const f = new Fig(32, 32);
  const [rx, ry] = [[10, 8.2], [11.6, 6.8], [8.6, 10]][k];
  const base = 29.2, cy = base - ry * 0.92;
  f.ell(16, cy, rx, ry, M.slime, { clip: (x, y) => y + 0.5 < base + 0.4, flat: 0.05 });
  // drip tip
  f.limb(16, cy - ry + 1, 16.6, cy - ry - 1.8 - (k === 2 ? 1 : 0), 2.2, 0.9, M.slime, { grp: f.grp });
  // inner core (seen through the jelly)
  f.ell(17.6, cy + ry * 0.25, rx * 0.42, ry * 0.36, M.slime_core, { flat: 0.5, bias: -0.6 });
  // glossy highlights
  const hx = 16 - rx * 0.52, hy = cy - ry * 0.45;
  f.ell(hx, hy, 1.9, 1.3, M.glint, { tone: 0 }); f.touch(hx + 2.4, hy - 1.2, { m: M.glint, t: 0 });
  // face
  const ey = Math.round(cy - ry * 0.05);
  for (const ex of [12.4, 19.6]) { f.ell(ex, ey, 1.3, 1.9, M.eye, { tone: 0 }); f.touch(ex - 0.6, ey - 1, { m: M.glint, t: 0 }); }
  f.touch(16, ey + 2, { m: M.mouth, t: 0 }); f.touch(15, ey + 1.6, { m: M.mouth, t: 1 }); f.touch(17, ey + 1.6, { m: M.mouth, t: 1 });
  // ground contact rim
  for (let x = Math.ceil(16 - rx + 1); x < 16 + rx - 1; x++) f.touch(x, base - 0.4, { b: -1.2 });
  return f.canvas(16, 30);
}

// ---------------- bat 32×32, anchor (16, 24) ----------------
function batF(k) {
  const f = new Fig(32, 32);
  const up = k === 0;
  const by = up ? 14 : 15;
  for (const s of [-1, 1]) {
    // wing membrane polygon with finger bones
    const sx = 16 + s * 2.6, sy = by - 1;
    const tips = up
      ? [[16 + s * 13.5, by - 9], [16 + s * 14.5, by - 2.5], [16 + s * 11, by + 2], [16 + s * 7, by + 2.6]]
      : [[16 + s * 14, by + 1], [16 + s * 12.6, by + 6.4], [16 + s * 9, by + 8], [16 + s * 5.6, by + 5.4]];
    f.poly([[sx, sy - 1.5], ...tips, [sx, sy + 3]], M.membrane, { n: [s * 0.25, up ? -0.35 : 0.1, 0.9], bias: -0.2 });
    // scallop the trailing edge
    for (let i = 0; i < 3; i++) { const a = tips[i + 1], b = tips[i]; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; f.ell(mx - s * 0.4, my - 0.4 + (up ? 0 : -0.8), 1.6, 1.4, M.membrane, { tone: -1 }); for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) if (Math.abs(xx) + Math.abs(yy) < 2) f.erase(Math.round(mx) + xx - s * 0.5, Math.round(my) + yy + (up ? 0.6 : 0.4)); }
    // bones
    f.limb(sx, sy, tips[0][0], tips[0][1], 0.9, 0.6, M.bat, { bias: 0.2 });
    for (const t of tips.slice(1, 3)) f.limb(tips[0][0] * 0.4 + sx * 0.6, tips[0][1] * 0.4 + sy * 0.6, t[0], t[1], 0.55, 0.45, M.bat, { bias: -0.4 });
  }
  // body + head
  f.ell(16, by + 2.6, 4.2, 4.6, M.bat, { flat: 0.05 });
  f.ell(16, by - 2, 4.4, 3.8, M.bat, { flat: 0.05 });
  for (const s of [-1, 1]) f.chain([[16 + s * 2.4, by - 4, 1.4], [16 + s * 3.6, by - 6.6, 1.1], [16 + s * 3.8, by - 8.2, 0.4]], M.bat, { bias: 0.3 });
  for (const s of [-1, 1]) { f.ell(16 + s * 1.9, by - 1.8, 1.25, 1.2, M.eye_y, { tone: 2 }); f.touch(16 + s * 1.9 - 0.5, by - 2.4, { m: M.eye_y, t: 3 }); }
  f.touch(15, by + 0.8, { m: M.white, t: 3 }); f.touch(17, by + 0.8, { m: M.white, t: 3 });
  // tiny feet
  f.limb(14.6, by + 6.8, 14.2, by + 8.4, 0.6, 0.5, M.bat); f.limb(17.4, by + 6.8, 17.8, by + 8.4, 0.6, 0.5, M.bat);
  return f.canvas(16, 24);
}

// ---------------- stone golem boss 80×80, anchor (40, 77) ----------------
function mossify(f, seed) {
  // moss on upward-facing stone
  for (let i = 0; i < f.m.length; i++) {
    if (f.m[i] !== M.stone) continue;
    const x = i % f.w, y = (i / f.w) | 0;
    const h = ((x * 73856093) ^ (y * 19349663) ^ seed) >>> 0;
    if (f.ny[i] < -0.62 && (h % 7) < 5) { f.m[i] = M.moss; f.t[i] = -1; }
    else if (f.ny[i] < -0.45 && (h % 11) === 0) { f.m[i] = M.moss; }
  }
}
function crack(f, pts) { for (let i = 0; i < pts.length - 1; i++) { const [a, b] = [pts[i], pts[i + 1]]; const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); for (let k = 0; k <= n; k++) f.touch(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, { b: -2.2 }); } }
function golemF(mode, k) {
  const f = new Fig(80, 80);
  const hurt = mode === 'hurt';
  const bob = mode === 'idle' ? k : 0;
  let arms = [[13, 50], [67, 50]], head = [40, 22 + bob], armR = [9, 12.5], fist = 7.4;
  if (mode === 'attack') {
    if (k === 0) { arms = [[14, 40], [66, 40]]; head = [40, 23]; }
    if (k === 1) { arms = [[18, 20], [62, 20]]; head = [40, 25]; }
    if (k === 2) { arms = [[20, 66], [60, 66]]; head = [40, 28]; armR = [9, 11]; }
  }
  const lw = mode === 'walk' ? (k ? [-2, 1] : [1, -2]) : [0, 0];
  // legs
  for (const [x, l] of [[27, lw[0]], [53, lw[1]]]) {
    f.ell(x, 66 + l, 9, 8.4, M.stone, { flat: 0.05 });
    f.ell(x, 72.6 + l * 0.5, 10.4, 4.6, M.stone_dk, { flat: 0.1, bias: -0.3 });
  }
  const raised = arms[0][1] < 36;
  const drawArm = ([x, y], s) => {
    const shx = 40 + s * 18, shy = 40 + bob;
    f.limb(shx, shy, x, y + bob, 7.2, 6.4, M.stone, { flat: 0.05 });
    f.ell(x + s * 0.6, y + bob + (raised ? -3 : 4), fist + 1, fist, M.stone, { flat: 0.05 });
    crack(f, [[x - 3, y + bob - 2 + (raised ? -3 : 4)], [x, y + bob + (raised ? -4 : 5)], [x + 2, y + bob + 1 + (raised ? -3 : 4)]]);
  };
  if (raised) { drawArm(arms[0], -1); drawArm(arms[1], 1); }
  // torso boulder
  f.ell(40, 45 + bob, 21, 17, M.stone, { flat: 0.04 });
  f.ell(40, 54 + bob, 16, 8, M.stone_dk, { flat: 0.2, bias: -0.2, clip: (x, y) => y > 53 + bob });
  // shoulder pauldrons
  for (const s of [-1, 1]) f.ell(40 + s * 17, 35 + bob, 8.6, 7, M.stone, { flat: 0.05 });
  // glowing core in a chest crack
  const core = hurt ? M.flash : mode === 'attack' && k > 0 ? M.glow_hot : M.glow;
  f.poly([[37, 41 + bob], [43, 40 + bob], [45, 46 + bob], [41, 51 + bob], [36, 47 + bob]], M.stone_dk, { n: [0, 0, 1], tone: 0 });
  f.ell(40.5, 45.5 + bob, 3.2, 3.8, core, { flat: 0.2 });
  f.touch(39.6, 44 + bob, { m: core, t: 4 });
  crack(f, [[30, 36 + bob], [33, 40 + bob], [32, 44 + bob]]); crack(f, [[50, 48 + bob], [53, 52 + bob], [51, 56 + bob]]); crack(f, [[46, 34 + bob], [48, 37 + bob]]);
  if (!raised) { drawArm(arms[0], -1); drawArm(arms[1], 1); }
  // head (sunk between the shoulders) with a brow ridge
  f.ell(head[0], head[1], 10.4, 9, M.stone, { flat: 0.05 });
  f.ell(head[0], head[1] - 1, 10.8, 3.2, M.stone, { flat: 0.2, bias: 0.6, clip: (x, y) => y < head[1] });
  const ey = Math.round(head[1] + 2);
  const eyeM = hurt ? M.flash : mode === 'attack' && k > 0 ? M.glow_hot : M.glow;
  for (const ex of [34.5, 45.5]) {
    f.ell(ex, ey, 3, 2, M.stone_dk, { tone: 0 });
    f.ell(ex + (mode === 'idle' && k ? 0.6 : 0), ey, 1.9, 1.1, eyeM, { tone: 2 });
    f.touch(ex - 0.6, ey - 0.4, { m: eyeM, t: 4 });
  }
  f.limb(36, head[1] + 6, 44, head[1] + 6, 0.6, 0.6, M.stone_dk, { tone: 0 }); // mouth slit
  mossify(f, 1337);
  // a few hanging vines
  for (const [x, y, l] of [[24, 30 + bob, 5], [57, 31 + bob, 4], [34, 16 + bob, 3]]) f.chain([[x, y, 0.8], [x + 0.6, y + l * 0.5, 0.7], [x, y + l, 0.5]], M.moss, { bias: -0.4 });
  const c = f.canvas(40, 77);
  return hurt ? flashCanvas(c, 0.35) : c;
}

export function buildEnemies() {
  const S = {};
  for (const dir of ['down', 'up', 'left', 'right']) {
    const w = [spitter(dir, 0), spitter(dir, 1)];
    S[`octorok_walk_${dir}`] = frames(w, { fps: 6.7 });
    S[`octorok_idle_${dir}`] = frames([w[0], spitter(dir, 0, -0.2)], { fps: 3 });
    S[`octorok_attack_${dir}`] = frames([spitter(dir, 0, -1), spitter(dir, 0, 2), w[0]], { fps: 8 });
    S[`octorok_hurt_${dir}`] = frames([flashCanvas(w[0]), w[0]], { fps: 16 });
  }
  S.octorok_rock = frames([pebble(0), pebble(1)], { fps: 10 });
  S.slime_idle = frames([slimeF(1), slimeF(0), slimeF(2)], { fps: 5.5 });
  S.slime_walk = frames([S.slime_idle[2], S.slime_idle[1], S.slime_idle[0]], { fps: 7 });
  S.slime_hurt = frames([flashCanvas(S.slime_idle[1]), S.slime_idle[1]], { fps: 16 });
  S.bat_fly = frames([batF(0), batF(1)], { fps: 12 });
  S.bat_hurt = frames([flashCanvas(S.bat_fly[0]), S.bat_fly[0]], { fps: 16 });
  S.boss_golem_idle = frames([golemF('idle', 0), golemF('idle', 1)], { fps: 2 });
  S.boss_golem_attack = frames([golemF('attack', 0), golemF('attack', 1), golemF('attack', 2)], { fps: 6 });
  S.boss_golem_hurt = [golemF('hurt', 0)];
  S.boss_golem_walk = frames([golemF('walk', 0), golemF('walk', 1)], { fps: 4 });
  return S;
}
