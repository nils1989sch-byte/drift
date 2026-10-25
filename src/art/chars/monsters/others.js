// Flyers (zappi, boeli, sturmfalk), forest dwellers (moosi, pilzling) and the boss (steinwaechter).
// Side view = facing LEFT. Ground at y = 0; flyers hover above it.
import { M } from '../materials.js';
import { eye, mouth, sparkle } from './kit.js';
import { motion, burst } from './ground.js';

const E = (P, def = 'open') => P.eyes || def;

// ---------------- ZAPPI: violet moth-butterfly, zigzag-edged spark wings (yellow/violet) ----------------
function zigWing(p, root, tip, back, flapK, mirror = 1) {
  // wing polygon root → tip → trailing corner, zigzag rim in violet, spark spots
  const [rx, ry] = root, [tx, ty] = tip, [bx, by] = back;
  p.poly([[rx, ry - 1.5], [tx, ty], [(tx + bx) / 2 + mirror * 1.5, (ty + by) / 2], [bx, by], [rx, ry + 2]], M.volt, { n: [mirror * 0.2, -0.3 * flapK, 0.92] });
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = tx + (bx - tx) * t, y = ty + (by - ty) * t;
    p.limb(x, y, x + (i % 2 ? -1.6 : 1.6) * mirror * 0.4, y + (i % 2 ? 1.6 : -1.6) * 0.4, 0.8, 0.6, M.violet, {});
  }
  p.ell(rx + (tx - rx) * 0.55, ry + (ty - ry) * 0.55, 1.8, 1.6, M.violet, { bias: 0.4 });
  p.touch(rx + (tx - rx) * 0.55, ry + (ty - ry) * 0.55, { m: M.spark, t: 2 });
}
export function zappi(p, view, P) {
  const f = P.flap ?? 0.5, dy = (P.bob || 0) - (P.atk === 0 ? -2 : P.atk === 1 ? 2 : 0);
  const cy = -26 + dy + (P.faint ? 18 : 0);
  const jitter = P.atk === 1 ? -3 : 0;
  const zap = (x, y) => { sparkle(p, x, y, 2); };
  if (view === 'side') {
    const x0 = jitter;
    // far wing
    zigWing(p, [x0 + 2, cy - 2], [x0 + 12 - f * 4, cy - 12 - f * 10], [x0 + 15 - f * 4, cy + 2 - f * 6], f, 1);
    p.limb(x0 + 2, cy + 2, x0 + 7, cy + 9, 2.8, 1.4, M.violet, {});
    for (const y of [cy + 4, cy + 6.5]) p.touch(x0 + 4.4 + (y - cy - 4), y, { m: M.volt, t: 2 });
    p.ell(x0, cy, 3.6, 4.4, M.violet, { flat: 0.05 });
    p.ell(x0 - 3, cy - 5.6, 4.8, 4.6, M.violet, { flat: 0.05 });
    for (const [ax, ay] of [[-7, -15], [-3, -15.6]]) { p.chain([[x0 - 3, cy - 9.4, 0.7], [x0 + ax * 0.6, cy + ay * 0.8, 0.6], [x0 + ax, cy + ay, 0.5]], M.violet, {}); zap(x0 + ax, cy + ay - 1); }
    eye(p, x0 - 4.6, cy - 4.6, 2.6, E(P));
    mouth(p, x0 - 6.6, cy - 2, 1, !!P.mouth);
    // near wing (in front)
    zigWing(p, [x0 + 1, cy - 1], [x0 + 9 - f * 3, cy - 14 - f * 8], [x0 + 13 - f * 3, cy + 4 - f * 5], f, 1);
    if (P.atk === 1) burst(p, x0 - 12, cy - 4, 'spark');
    if (P.atk === 0) zap(x0 + 10, cy - 18);
    return;
  }
  const up = view === 'up';
  const wing = (s) => {
    zigWing(p, [s * 2, cy - 2], [s * (17 - f * 5), cy - 13 - f * 9], [s * (15 - f * 3), cy + 3 - f * 3], f, s);
    zigWing(p, [s * 2, cy + 1], [s * (12 - f * 2), cy + 8 - f * 2], [s * (5), cy + 11 - f * 2], f, s);
  };
  if (!up) { wing(-1); wing(1); }
  p.limb(0, cy + 2, 0, cy + 10, 2.6, 1.4, M.violet, {});
  p.ell(0, cy, 3.6, 4.4, M.violet, { flat: 0.05 });
  p.ell(0, cy - 6, 5.2, 4.8, M.violet, { flat: 0.05 });
  for (const s of [-1, 1]) { p.chain([[s * 2, cy - 10, 0.7], [s * 4, cy - 14, 0.6], [s * 6.6, cy - 16.6, 0.5]], M.violet, {}); zap(s * 6.6, cy - 17.4); }
  if (!up) {
    eye(p, -2.4, cy - 5.4, 2.2, E(P)); eye(p, 2.4, cy - 5.4, 2.2, E(P));
    mouth(p, 0, cy - 2.6, 1, !!P.mouth);
  } else { wing(-1); wing(1); }
  if (P.atk === 1) burst(p, 0, cy + 6, 'spark');
}

// ---------------- BOELI: round white puff-bird, sky-blue back, big curled wind-sickle tail ----------------
function sickleTail(p, x, y, k, ph, dir = 1, mat = M.sky) {
  const w = Math.sin(ph * 2) * 1.2;
  p.chain([[x, y, 3.2 * k], [x + dir * 6 * k, y - 3 * k + w * 0.3, 2.8 * k], [x + dir * 9 * k, y - 9 * k + w * 0.6, 2.2 * k], [x + dir * 6.4 * k, y - 13.6 * k + w, 1.6 * k], [x + dir * 2.6 * k, y - 12.6 * k + w, 0.9 * k]], mat, { flat: 0.2 });
  p.chain([[x + dir * 1 * k, y + 1, 2 * k], [x + dir * 7 * k, y + 0.5 * k, 1.6 * k], [x + dir * 11 * k, y - 3 * k + w * 0.4, 0.8 * k]], M.feather, { flat: 0.2 });
}
export function boeli(p, view, P) {
  const f = P.flap ?? 0.5, dy = (P.bob || 0) + (P.atk === 0 ? 1 : P.atk === 1 ? -1 : 0);
  const cy = -17 + dy + (P.faint ? 8 : 0), ph = P.ph || 0;
  const dash = P.atk === 1 ? -4 : 0;
  if (view === 'side') {
    const x0 = dash;
    sickleTail(p, x0 + 7, cy + 1, 1, ph, 1);
    p.limb(x0 + 1, cy - 1, x0 + 9, cy - 4 - f * 7 + 3, 3.2, 1.6, M.sky, { bias: -0.8 }); // far wing
    p.ell(x0, cy, 10, 9.4, M.feather, { flat: 0.04 });
    p.ell(x0 + 3, cy - 3.6, 8.6, 6.6, M.sky, { flat: 0.05, clip: (x, y) => p.at(x, y) === M.feather && y < cy + 1 - (x - x0) * 0.25 });
    p.poly([[x0 - 9.4, cy - 1.6], [x0 - 14, cy + 0.2], [x0 - 9.4, cy + 1.8]], M.beak, { n: [-0.3, -0.3, 0.9] });
    eye(p, x0 - 5, cy - 1.8, 2.6, E(P));
    p.ell(x0 - 5.6, cy + 3, 1.4, 0.9, M.blush, { tone: 1 });
    p.limb(x0 + 2, cy - 0.6, x0 + 10, cy - 3 - f * 8 + 4, 3.4, 1.6, M.sky, {}); // near wing
    for (const s of [-1, 1]) p.limb(x0 + s * 2, cy + 8.6, x0 + s * 2 - 0.4, cy + 11, 0.6, 0.5, M.beak, {});
    if (P.atk === 1) burst(p, x0 - 17, cy, 'wind');
    return;
  }
  const up = view === 'up';
  if (!up) sickleTail(p, 5, cy - 3, 0.9, ph, 1);
  for (const s of [-1, 1]) p.limb(s * 8, cy - 1, s * 15, cy - 3 - f * 8 + 4, 3.2, 1.5, M.sky, { bias: up ? 0 : -0.3 });
  p.ell(0, cy, 10.4, 9.6, M.feather, { flat: 0.04 });
  if (up) { p.ell(0, cy - 1, 10, 8.6, M.sky, { flat: 0.05, clip: (x, y) => p.at(x, y) === M.feather }); sickleTail(p, 0, cy + 4, 0.9, ph, 1); return; }
  p.ell(0, cy - 6, 9, 4.6, M.sky, { flat: 0.05, clip: (x, y) => p.at(x, y) === M.feather });
  p.poly([[-2, cy + 0.6], [2, cy + 0.6], [0, cy + 3.8]], M.beak, { n: [0, -0.3, 0.95] });
  eye(p, -4.4, cy - 1.4, 2.6, E(P)); eye(p, 4.4, cy - 1.4, 2.6, E(P));
  p.ell(-6.8, cy + 2.6, 1.4, 0.9, M.blush, { tone: 1 }); p.ell(6.8, cy + 2.6, 1.4, 0.9, M.blush, { tone: 1 });
  for (const s of [-1, 1]) p.limb(s * 2.4, cy + 9, s * 2.6, cy + 11.4, 0.6, 0.5, M.beak, {});
  if (P.atk === 1) burst(p, 0, cy + 7, 'wind');
}

// ---------------- STURMFALK: sleek falcon, wide wings, long storm streamers (escalated sickle) + crest (new) ----------------
export function sturmfalk(p, view, P) {
  const f = P.flap ?? 0.5, dy = (P.bob || 0) * 1.5 + (P.atk === 0 ? -3 : P.atk === 1 ? 3 : 0);
  const cy = -40 + dy + (P.faint ? 26 : 0), ph = P.ph || 0;
  const w = Math.sin(ph * 2) * 1.6;
  const streamers = (x, y, dir) => {
    for (const [o, k, m] of [[0, 1, M.sky], [3, 0.8, M.feather], [-3, 0.75, M.sky]]) p.chain([[x, y + o * 0.3, 2.6 * k], [x + dir * 10, y + o + 4 + w * 0.5, 2.2 * k], [x + dir * 20, y + o + 2 + w, 1.6 * k], [x + dir * 26, y + o - 6 + w, 0.9 * k]], m, { flat: 0.2 });
  };
  if (view === 'side') {
    const x0 = P.atk === 1 ? -6 : 0;
    streamers(x0 + 10, cy + 4, 1);
    p.poly([[x0 + 2, cy - 6], [x0 + 22 - f * 6, cy - 30 + f * 4 - (1 - f) * 2], [x0 + 28 - f * 4, cy - 14 + f * 18], [x0 + 12, cy + 2]], M.sky, { n: [0.3, -0.4, 0.86], bias: -0.8 }); // far wing
    p.ell(x0, cy, 12, 8.6, M.sky, { flat: 0.04 });
    p.ell(x0 - 3, cy + 3, 8.6, 5, M.feather, { flat: 0.1, clip: (x, y) => p.at(x, y) === M.sky });
    p.ell(x0 - 10, cy - 8, 6.8, 6.2, M.sky, { flat: 0.04 });
    p.ell(x0 - 12, cy - 5.6, 4, 3.4, M.feather, { flat: 0.1, clip: (x, y) => p.at(x, y) === M.sky });
    p.chain([[x0 - 7, cy - 13, 1.6], [x0 - 2, cy - 17, 1.2], [x0 + 3, cy - 16, 0.6]], M.sky, { bias: 0.4 }); // crest
    p.poly([[x0 - 16, cy - 9], [x0 - 20.6, cy - 7.4], [x0 - 18, cy - 4.4], [x0 - 15.6, cy - 6]], M.beak, { n: [-0.4, -0.3, 0.86] });
    eye(p, x0 - 12, cy - 8.4, 2.3, E(P));
    p.limb(x0 - 15, cy - 11.4, x0 - 9, cy - 10.6, 0.7, 0.7, M.otter_dk, { tone: 0 });
    p.poly([[x0 + 1, cy - 5], [x0 + 18 - f * 6, cy - 34 + f * 6], [x0 + 26 - f * 4, cy - 18 + f * 20], [x0 + 10, cy + 3]], M.sky, { n: [0.2, -0.5, 0.84] }); // near wing
    for (let i = 0; i < 4; i++) p.limb(x0 + 8 + i * 4, cy - 10 + i * 2, x0 + 15 + i * 4 - f * 4, cy - 26 + f * 14 + i * 4, 0.6, 0.5, M.feather, { tone: 3 });
    for (const s of [-1, 1]) p.limb(x0 + s * 3, cy + 8, x0 + s * 3 - 1, cy + 12, 1, 0.8, M.beak, {});
    if (P.atk === 1) burst(p, x0 - 24, cy - 6, 'wind', 1.5);
    return;
  }
  const up = view === 'up';
  const wing = (s) => p.poly([[s * 6, cy - 6], [s * (36 - f * 8), cy - 20 - f * 14 + (1 - f) * 4], [s * (34 - f * 6), cy - 4 - f * 6], [s * 8, cy + 5]], M.sky, { n: [s * 0.25, -0.45, 0.86] });
  if (!up) streamers(4, cy + 8, 1);
  wing(-1); wing(1);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) p.limb(s * (14 + i * 5), cy - 3 - i * 1.5, s * (18 + i * 5 - f * 3), cy - 10 - f * 8 - i * 1.6, 0.6, 0.5, M.feather, { tone: 3 });
  p.ell(0, cy, 9.6, 12, M.sky, { flat: 0.04 });
  if (up) { streamers(0, cy + 10, 1); p.ell(0, cy - 12, 6.8, 6.2, M.sky); return; }
  p.ell(0, cy + 3, 6.4, 8.6, M.feather, { flat: 0.1, clip: (x, y) => p.at(x, y) === M.sky });
  p.ell(0, cy - 12, 7, 6.4, M.sky, { flat: 0.04 });
  p.ell(0, cy - 9.4, 4.6, 3.6, M.feather, { flat: 0.1, clip: (x, y) => p.at(x, y) === M.sky });
  for (const s of [-1, 1]) p.chain([[s * 2, cy - 17, 1.4], [s * 4, cy - 21, 1.0], [s * 6.4, cy - 22, 0.5]], M.sky, { bias: 0.4 });
  p.poly([[-1.8, cy - 9], [1.8, cy - 9], [0, cy - 5]], M.beak, { n: [0, -0.3, 0.95] });
  eye(p, -3.6, cy - 12, 2.2, E(P)); eye(p, 3.6, cy - 12, 2.2, E(P));
  p.limb(-6, cy - 15, -1.6, cy - 13.6, 0.7, 0.7, M.otter_dk, { tone: 0 }); p.limb(6, cy - 15, 1.6, cy - 13.6, 0.7, 0.7, M.otter_dk, { tone: 0 });
  for (const s of [-1, 1]) p.limb(s * 3, cy + 11, s * 3.4, cy + 15, 1, 0.8, M.beak, {});
  if (P.atk === 1) burst(p, 0, cy + 10, 'wind', 1.5);
}

// ---------------- MOOSI: snail carrying a little moss garden on its house ----------------
function mossHouse(p, x, y, r, ph) {
  p.ell(x, y, r, r * 0.96, M.snail, { flat: 0.05, bias: -0.4 });
  for (let t = 0; t < 1; t += 0.05) { const a = t * Math.PI * 3, rr = r * 0.82 * (1 - t * 0.85); p.touch(x + Math.cos(a) * rr, y + Math.sin(a) * rr, { b: -1.4 }); }
  p.ell(x, y - r * 0.32, r * 1.02, r * 0.72, M.moss, { flat: 0.1, clip: (xx, yy) => p.at(xx, yy) === M.snail && yy < y + r * 0.05 + Math.sin(xx * 1.3) * 1.2 });
  // tiny garden: two flowers, a sprout
  const sw = Math.sin(ph * 1.5) * 0.6;
  for (const [dx, h, m] of [[-r * 0.45, 4.4, M.petal], [r * 0.3, 5.4, M.bud]]) { p.limb(x + dx, y - r * 0.8, x + dx + sw, y - r * 0.8 - h, 0.6, 0.5, M.spine, {}); p.ell(x + dx + sw, y - r * 0.8 - h - 0.8, 1.6, 1.4, m); }
  p.limb(x + r * 0.05, y - r * 0.95, x - 1 + sw, y - r * 0.95 - 3.4, 0.7, 0.5, M.spine, {});
  p.limb(x - 1 + sw, y - r * 0.95 - 2.6, x - 3.6 + sw, y - r * 0.95 - 3.6, 0.8, 0.4, M.spine, { bias: 0.4 });
}
export function moosi(p, view, P) {
  const { dx, dy } = motion(P, view === 'side');
  const ph = P.ph || 0;
  const tuck = P.bob ? 2.6 : 0; // feelers pull in (personality idle)
  const st = P.step || 0;
  if (view === 'side') {
    const bx = dx;
    p.chain([[bx + 13 + st, -2, 2.4], [bx + 4, -2.6, 3], [bx - 8, -3, 3.2]], M.snail, { flat: 0.1, bias: 0.2 });
    mossHouse(p, bx + 4, -14 + dy, 10.6, ph);
    p.chain([[bx - 8, -3, 3.4], [bx - 12, -7 + dy * 0.5, 3.6], [bx - 13, -11 + dy * 0.5, 3.4]], M.snail, { flat: 0.1, bias: 0.3 });
    for (const [ox, len] of [[-1.6, 8], [1.4, 7]]) { const tx = bx - 13 + ox - 1.6, ty = -13 + dy * 0.5 - len + tuck; p.limb(bx - 13 + ox, -13 + dy * 0.5, tx, ty, 0.9, 0.7, M.snail, {}); p.ell(tx, ty - 1, 1.7, 1.8, M.snail, {}); p.ell(tx - 0.3, ty - 0.8, 1.0, 1.2, M.eye, { tone: 0 }); p.touch(tx - 0.7, ty - 1.6, { m: M.glint, t: 0 }); }
    eye(p, bx - 14.6, -9 + dy * 0.5, 1.8, E(P) === 'open' ? 'happy' : E(P));
    p.ell(bx - 12, -6.6 + dy * 0.5, 1.4, 0.9, M.blush, { tone: 1 });
    mouth(p, bx - 15.6, -6.4 + dy * 0.5, 1.2, !!P.mouth);
    if (P.atk === 1) burst(p, bx - 20, -9, 'leaf');
    return;
  }
  const up = view === 'up';
  if (up) {
    p.chain([[0, -1, 3], [0, -4, 3.6]], M.snail, {});
    for (const s of [-1, 1]) { const tx = s * 3.4, ty = -26 + tuck + dy; p.limb(s * 1.6, -16 + dy, tx, ty, 0.9, 0.7, M.snail, {}); p.ell(tx, ty - 1, 1.7, 1.8, M.snail, {}); }
    mossHouse(p, 0, -13 + dy, 11, ph);
    return;
  }
  mossHouse(p, 0, -15 + dy, 10.6, ph);
  p.ell(0, -5.4 + dy * 0.5, 7.4, 5.6, M.snail, { flat: 0.1, bias: 0.3 });
  p.chain([[-6, -2, 2.4], [0, -1.6, 3], [6, -2, 2.4]], M.snail, { flat: 0.1 });
  for (const s of [-1, 1]) { const tx = s * 4.6, ty = -18 + tuck + dy * 0.5; p.limb(s * 2.4, -9 + dy * 0.5, tx, ty, 0.9, 0.7, M.snail, {}); p.ell(tx, ty - 1, 1.7, 1.8, M.snail, {}); p.ell(tx, ty - 0.8, 1.0, 1.2, M.eye, { tone: 0 }); p.touch(tx - 0.4, ty - 1.6, { m: M.glint, t: 0 }); }
  eye(p, -3, -6 + dy * 0.5, 1.9, E(P) === 'open' ? 'happy' : E(P)); eye(p, 3, -6 + dy * 0.5, 1.9, E(P) === 'open' ? 'happy' : E(P));
  p.ell(-5, -3.6 + dy * 0.5, 1.3, 0.8, M.blush, { tone: 1 }); p.ell(5, -3.6 + dy * 0.5, 1.3, 0.8, M.blush, { tone: 1 });
  mouth(p, 0, -3 + dy * 0.5, 1.2, !!P.mouth);
  if (P.atk === 1) burst(p, 0, 1, 'leaf');
}

// ---------------- PILZLING: sleepy wandering mushroom – mossy olive cap with pale growth rings ----------------
function cap(p, x, y, rx, ry, tilt = 0) {
  p.ell(x, y + ry * 0.55, rx * 0.86, ry * 0.36, M.stem, { flat: 0.4, bias: -1.2 }); // gills
  p.ell(x, y, rx, ry, M.cap, { flat: 0.04, clip: (xx, yy) => yy < y + ry * 0.45 + tilt * (xx - x) * 0.05 });
  for (const [a, r] of [[0.35, 0.55], [0.75, 0.82]]) for (let t = -1; t <= 1; t += 0.08) p.touch(x + t * rx * r, y - ry * a * Math.sqrt(1 - t * t) * 0.9 + ry * 0.1, { b: 0.9 });
  p.limb(x + 1, y - ry + 0.4, x + 2.4, y - ry - 3.4, 0.7, 0.5, M.spine, {});
  p.limb(x + 2.2, y - ry - 2.6, x + 5, y - ry - 3.2, 0.9, 0.4, M.spine, { bias: 0.4 });
}
export function pilzling(p, view, P) {
  const { dx, dy, st } = motion(P, view === 'side');
  const nod = P.bob ? 1.6 : 0; // nodding off
  const eyes = P.eyes || (P.bob ? 'closed' : 'sleepy');
  if (view === 'side') {
    const bx = dx;
    p.ell(bx + 3 - st * 2, -1.6, 2.8, 1.8, M.stem, { bias: -0.6 });
    p.ell(bx, -10 + dy, 6.6, 8.6, M.stem, { flat: 0.05 });
    p.ell(bx - 3 + st * 2, -1.6, 2.8, 1.8, M.stem, {});
    cap(p, bx - 1.5 - nod * 0.6, -21 + dy + nod, 13, 8.4);
    eye(p, bx - 3.4, -11 + dy + nod * 0.3, 2, eyes);
    p.ell(bx - 1.6, -8 + dy, 1.4, 0.9, M.blush, { tone: 1 });
    mouth(p, bx - 5.4, -7.6 + dy, 1.2, !!P.mouth);
    p.limb(bx - 2, -9 + dy, bx - 6 + (P.atk === 1 ? -3 : 0), -6 + dy - (P.atk === 0 ? 4 : 0), 1.4, 1.2, M.stem, {});
    if (P.atk === 1) { for (const [x, y] of [[-10, -16], [-13, -12], [-9, -20]]) p.ell(bx + x, y + dy, 1.2, 1.2, M.bud, { tone: 3 }); }
    return;
  }
  const up = view === 'up';
  for (const s of [-1, 1]) p.ell(s * (3.6 + st * s * 0.8), -1.6, 2.8, 1.8, M.stem, { bias: 0.1 });
  p.ell(0, -10 + dy, 7, 8.6, M.stem, { flat: 0.05 });
  for (const s of [-1, 1]) p.limb(s * 6, -10 + dy, s * 8.4, -6.6 + dy - (P.atk === 0 ? 4 : 0), 1.4, 1.2, M.stem, {});
  cap(p, 0, -21 + dy + nod, 13.6, 8.6);
  if (up) return;
  eye(p, -3, -11 + dy + nod * 0.3, 2, eyes); eye(p, 3, -11 + dy + nod * 0.3, 2, eyes);
  p.ell(-5, -8 + dy, 1.3, 0.8, M.blush, { tone: 1 }); p.ell(5, -8 + dy, 1.3, 0.8, M.blush, { tone: 1 });
  mouth(p, 0, -7.2 + dy, 1.2, !!P.mouth);
  if (P.bob && !P.icon) { p.touch(8, -26, { m: M.white, t: 3 }); p.touch(10, -29, { m: M.white, t: 4 }); } // "z" puffs
  if (P.atk === 1) for (const [x, y] of [[-6, -2], [0, 1], [6, -2]]) p.ell(x, y, 1.2, 1.2, M.bud, { tone: 3 });
}

// ---------------- STEINWAECHTER: the ancient golem, grown – shoulder crystals + glowing runes ----------------
function crackL(p, pts) { for (let i = 0; i < pts.length - 1; i++) p.limb(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 0.45, 0.45, M.stone, { bias: -2.4 }); }
export function steinwaechter(p, view, P) {
  const st = P.step || 0, up = view === 'up', side = view === 'side';
  const bob = P.atk === undefined && !P.hurt ? (P.bob || 0) : 0;
  let arms = [[-27, -27], [27, -27]], head = [0, -55 + bob];
  if (P.atk === 0) { arms = [[-22, -57], [22, -57]]; head = [0, -52]; }
  if (P.atk === 1) { arms = [[-20, -11], [20, -11]]; head = [0, -49]; }
  if (P.atk === 2) { arms = [[-26, -37], [26, -37]]; head = [0, -54]; }
  if (P.faint) head = [0, -52];
  const hx = side ? -5 : 0;
  // legs
  for (const [x, l] of [[-13, st > 0 ? -2 : 0], [13, st < 0 ? -2 : 0]]) { p.ell(x, -11 + l, 9, 8.4, M.stone, { flat: 0.05 }); p.ell(x, -4.4 + l * 0.5, 10.4, 4.6, M.stone_dk, { flat: 0.1, bias: -0.3 }); }
  const raised = arms[0][1] < -41;
  const drawArm = ([x, y], s) => {
    const sx = s * 18, sy = -37 + bob;
    p.limb(sx, sy, x, y + bob, 7.2, 6.4, M.stone, { flat: 0.05 });
    p.ell(x + s * 0.6, y + bob + (raised ? -3 : 4), 8.4, 7.4, M.stone, { flat: 0.05 });
    crackL(p, [[x - 3, y + bob - 2 + (raised ? -3 : 4)], [x, y + bob + (raised ? -4 : 5)], [x + 2, y + bob + 1 + (raised ? -3 : 4)]]);
  };
  if (raised) { drawArm(arms[0], -1); drawArm(arms[1], 1); }
  p.ell(0, -32 + bob, 21, 17, M.stone, { flat: 0.04 });
  p.ell(0, -23 + bob, 16, 8, M.stone_dk, { flat: 0.2, bias: -0.2, clip: (x, y) => y > -24 + bob });
  for (const s of [-1, 1]) {
    p.ell(s * 17, -42 + bob, 8.6, 7, M.stone, { flat: 0.05 });
    // shoulder crystals (new feature)
    for (const [cx, h, l] of [[s * 15, 8, s * -1], [s * 19, 10, s * 1.5], [s * 22.5, 6, s * 3]]) p.limb(cx, -47 + bob, cx + l, -47 + bob - h, 1.9, 0.6, M.crystal, {});
  }
  const glow = P.hurt ? M.flash : P.atk === 0 || P.atk === 1 ? M.glow_hot : M.glow;
  if (!up) {
    p.poly([[hx - 3, -36 + bob], [hx + 3, -37 + bob], [hx + 5, -31 + bob], [hx + 1, -26 + bob], [hx - 4, -30 + bob]], M.stone_dk, { n: [0, 0, 1], tone: 0 });
    p.ell(hx + 0.5, -31.5 + bob, 3.2, 3.8, glow, { flat: 0.2 });
    p.touch(hx - 0.4, -33 + bob, { m: glow, t: 4 });
    // runes radiating from the core
    for (const [a, b] of [[[hx - 6, -36], [hx - 11, -40]], [[hx + 6, -36], [hx + 11, -41]], [[hx - 6, -27], [hx - 10, -24]], [[hx + 6, -27], [hx + 11, -25]]]) p.limb(a[0], a[1] + bob, b[0], b[1] + bob, 0.55, 0.55, glow, { tone: 2 });
  } else {
    for (const [a, b] of [[[-4, -44], [4, -44]], [[0, -44], [0, -30]], [[-6, -34], [6, -34]]]) p.limb(a[0], a[1] + bob, b[0], b[1] + bob, 0.6, 0.6, glow, { tone: 1 });
  }
  crackL(p, [[-10, -41 + bob], [-7, -37 + bob], [-8, -33 + bob]]); crackL(p, [[10, -29 + bob], [13, -25 + bob], [11, -21 + bob]]);
  if (!raised) { drawArm(arms[0], -1); drawArm(arms[1], 1); }
  // head with brow ridge
  p.ell(head[0] + hx, head[1], 10.4, 9, M.stone, { flat: 0.05 });
  p.ell(head[0] + hx, head[1] - 1, 10.8, 3.2, M.stone, { flat: 0.2, bias: 0.6, clip: (x, y) => y < head[1] });
  if (!up) {
    const ey = head[1] + 2;
    for (const ex of side ? [-10.5, -1.5] : [-5.5, 5.5]) {
      p.ell(ex + hx * 0.2, ey, 3, 2, M.stone_dk, { tone: 0 });
      p.ell(ex + hx * 0.2 + (P.bob ? 0.6 : 0), ey, 1.9, 1.1, glow, { tone: P.faint ? 0 : 2 });
      if (!P.faint) p.touch(ex + hx * 0.2 - 0.6, ey - 0.4, { m: glow, t: 4 });
    }
    p.limb(hx - 4, head[1] + 6, hx + 4, head[1] + 6, 0.6, 0.6, M.stone_dk, { tone: 0 });
  }
  // moss on upward faces + vines
  const f = p.f;
  for (let i = 0; i < f.m.length; i++) {
    if (f.m[i] !== M.stone) continue;
    const x = i % f.w, y = (i / f.w) | 0, h = ((x * 73856093) ^ (y * 19349663) ^ 1337) >>> 0;
    if (f.ny[i] < -0.62 && (h % 7) < 5) f.m[i] = M.moss;
    else if (f.ny[i] < -0.45 && (h % 11) === 0) f.m[i] = M.moss;
  }
  for (const [x, y, l] of [[-16, -47, 5], [17, -46, 4], [-6, -61, 3]]) p.chain([[x, y + bob, 0.8], [x + 0.6, y + l * 0.5 + bob, 0.7], [x, y + l + bob, 0.5]], M.moss, { bias: -0.4 });
}
