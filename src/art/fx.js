// Effects. Burst-type FX (poof, spark, sparkle, explosion, heart_pop) are anchored at their centre;
// ground FX (splash, dust) at bottom-centre; particles (leaf, grass_bit, rock_bit) at centre.
import { Pix, frames, rng } from './core.js';
import { palette as P } from './palette.js';
import { heartShape } from './objects.js';

const C = (p) => p.canvas(p.w >> 1, p.h >> 1);

function poof(f) {
  const p = new Pix(24, 24), r = rng(5);
  const puffs = [[12, 12], [7, 10], [17, 10], [9, 16], [16, 16], [12, 7]];
  const rad = [2.5, 3.5, 4, 3.5, 2.5][f], spread = [1, 2.2, 3.4, 4.6, 5.8][f];
  const ramp = [P.rock_md, P.rock_lt, P.white, P.white];
  puffs.forEach(([x, y], i) => {
    if (f >= 3 && i % 2 === f % 2) return;
    const dx = (x - 12) / 5 * spread, dy = (y - 12) / 5 * spread;
    const rr = Math.max(1, rad - (i === 0 ? 0 : 0.5) - (f === 4 ? 1 : 0));
    p.ball(12 + dx, 12 + dy, rr, rr, f >= 3 ? [P.rock_md, P.rock_lt, P.rock_lt] : ramp);
  });
  void r;
  if (f < 3) p.outline(P.rock_md);
  return C(p);
}
function leaf(v) {
  const shapes = [
    [[0, 1], [1, 0], [1, 1], [2, 1], [2, 2]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 2], [1, 1], [2, 1], [2, 0], [1, 2]],
  ];
  const p = new Pix(5, 5);
  shapes[v].forEach(([x, y], i) => p.set(x + 1, y + 1, i === 0 ? P.grass_lt : i % 2 ? P.grass_md : P.grass_dk));
  return C(p);
}
function grassBit(f) {
  const p = new Pix(5, 5);
  const pts = [[[2, 0], [2, 1], [2, 2], [1, 3]], [[0, 1], [1, 1], [2, 2], [3, 2]], [[1, 0], [2, 1], [2, 2], [3, 3]]][f];
  pts.forEach(([x, y], i) => p.set(x, y, i === 0 ? P.grass_lt : P.grass_md));
  p.set(pts[3][0], pts[3][1], P.grass_dk);
  return C(p);
}
function spark(f) {
  const p = new Pix(11, 11), c = 5;
  const len = [2, 5, 4][f];
  const col = [P.white, P.fx_yellow, P.fx_orange][f];
  for (let k = 1; k <= len; k++) {
    const cc = k <= 1 ? P.white : col;
    if (f !== 2) { p.set(c + k, c, cc); p.set(c - k, c, cc); p.set(c, c + k, cc); p.set(c, c - k, cc); }
    if (k <= len - 2 || f === 2) { const d = f === 2 ? k : k; if (d <= 3) { p.set(c + d, c + d, cc); p.set(c - d, c - d, cc); p.set(c + d, c - d, cc); p.set(c - d, c + d, cc); } }
  }
  p.set(c, c, f === 2 ? P.fx_yellow : P.white);
  return C(p);
}
function splash(f) {
  const p = new Pix(16, 16);
  const drops = [[-4, -1], [-2, -2], [0, -3], [2, -2], [4, -1]];
  const h = [2, 5, 6, 4][f];
  drops.forEach(([dx, s], i) => {
    const x = 8 + dx * (0.6 + f * 0.25), y = 14 + s * h / 3 + (f === 3 ? 2 : 0);
    p.set(Math.round(x), Math.round(y), i % 2 ? P.water_lt : P.foam);
    if (f < 3) p.set(Math.round(x), Math.round(y) + 1, P.water_lt);
  });
  const rw = [2, 4, 6, 7][f];
  p.hline(8 - rw, 8 + rw, 15, f === 3 ? P.water_lt : P.foam);
  if (f > 0) { p.set(8 - rw - 1, 14, P.water_lt); p.set(8 + rw + 1, 14, P.water_lt); }
  return p.canvas(8, 15);
}
function dust(f) {
  const p = new Pix(10, 8);
  const r = [1.5, 2.5, 2][f];
  p.ball(4, 5, r, r * 0.8, f === 2 ? [P.dirt_lt, P.dirt_lt] : [P.dirt_lt, P.dirt_hi]);
  p.ball(7, 4.5 - f * 0.5, r * 0.7, r * 0.6, [P.dirt_lt, P.dirt_hi]);
  return p.canvas(5, 7);
}
function sparkle(f) {
  const p = new Pix(7, 7), c = 3;
  const n = [1, 2, 3, 1][f];
  for (let k = 1; k <= n; k++) { const col = k === n ? P.fx_yellow : P.white; p.set(c + k, c, col); p.set(c - k, c, col); p.set(c, c + k, col); p.set(c, c - k, col); }
  if (f === 2) { p.set(c + 1, c + 1, P.fx_yellow); p.set(c - 1, c - 1, P.fx_yellow); p.set(c + 1, c - 1, P.fx_yellow); p.set(c - 1, c + 1, P.fx_yellow); }
  p.set(c, c, P.white);
  return C(p);
}
function explosion(f) {
  const p = new Pix(32, 32), r = rng(40 + f);
  const fire = [P.red_md, P.fx_orange, P.fx_yellow, P.white];
  const smoke = [P.rock_dk, P.rock_md, P.rock_lt];
  if (f === 0) { p.ball(16, 16, 4, 4, [P.fx_yellow, P.white, P.white]); }
  else if (f === 1) { p.ball(16, 16, 8, 8, fire); }
  else if (f === 2) { p.ball(16, 16, 11, 11, fire, { bias: -0.1 }); p.ball(16, 16, 5, 5, [P.fx_yellow, P.white]); }
  else if (f === 3) {
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; p.ball(16 + Math.cos(a) * 8, 16 + Math.sin(a) * 8, 5, 5, [P.red_dk, P.red_md, P.fx_orange, P.fx_yellow]); }
    p.ball(16, 16, 6, 6, [P.fx_orange, P.fx_yellow]);
  } else {
    const n = f === 4 ? 8 : 6, rad = f === 4 ? 10 : 12, s = f === 4 ? 4.5 : 3;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + f; p.ball(16 + Math.cos(a) * rad, 15 + Math.sin(a) * rad - (f - 4) * 2, s, s, smoke); }
    if (f === 4) p.ball(16, 16, 4, 4, [P.red_md, P.fx_orange]);
  }
  void r;
  if (f >= 1 && f <= 3) p.outline(P.red_dk);
  return C(p);
}
function heartPop(f) {
  const p = new Pix(16, 16);
  if (f === 0) heartShape(p, 4, 5, [P.heart_dk, P.heart_dk, P.heart_md, P.heart_hi], false);
  if (f === 1) { heartShape(p, 4, 3, [P.heart_dk, P.heart_dk, P.heart_md, P.heart_hi], false); p.set(2, 2, P.white); p.set(13, 4, P.white); p.set(12, 10, P.heart_hi); }
  if (f === 2) { for (const [x, y] of [[3, 3], [12, 3], [2, 10], [13, 11], [8, 1], [8, 13]]) { p.set(x, y, P.heart_hi); p.set(x + 1, y, P.white); } }
  return C(p);
}
function rockBit(f) {
  const p = new Pix(5, 5);
  const pts = [[[1, 1], [2, 1], [1, 2], [2, 2], [3, 2]], [[2, 1], [1, 2], [2, 2], [3, 2], [2, 3]], [[1, 1], [2, 1], [3, 1], [2, 2]]][f];
  pts.forEach(([x, y], i) => p.set(x, y, i === 0 ? P.rock_lt : i === pts.length - 1 ? P.rock_dk : P.rock_md));
  return C(p);
}

export function buildFX() {
  const S = {};
  S.fx_poof = frames([0, 1, 2, 3, 4].map(poof), { fps: 16 });
  S.fx_leaf = frames([0, 1, 2, 3].map(leaf), { fps: 8 });
  S.fx_grass_bit = frames([0, 1, 2].map(grassBit), { fps: 10 });
  S.fx_spark = frames([0, 1, 2].map(spark), { fps: 25 });
  S.fx_splash = frames([0, 1, 2, 3].map(splash), { fps: 14 });
  S.fx_dust = frames([0, 1, 2].map(dust), { fps: 12 });
  S.fx_sparkle = frames([0, 1, 2, 3].map(sparkle), { fps: 10 });
  S.fx_explosion = frames([0, 1, 2, 3, 4, 5].map(explosion), { fps: 14 });
  S.fx_heart_pop = frames([0, 1, 2].map(heartPop), { fps: 10 });
  S.fx_rock_bit = frames([0, 1, 2].map(rockBit), { fps: 10 });
  return S;
}
