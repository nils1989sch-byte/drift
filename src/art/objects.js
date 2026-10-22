// World objects & pickups.
import { Pix, mat, frames, rng, bayer } from './core.js';
import { palette as P } from './palette.js';

// ---------- foliage: union of shaded clusters + leaf scallops ----------
function foliage(p, clusters, ramp, ink, seed = 1) {
  // clusters drawn back-to-front (sorted by y), each with a dark rim so the clumps read separately
  const cs = [...clusters].sort((a, b) => a[1] - b[1]);
  for (const [cx, cy, rx, ry] of cs) {
    p.ellipse(cx, cy, rx + 1, ry + 1, ramp[0]);
    p.ball(cx, cy, rx, ry, ramp, { dither: 0.18 });
  }
  // leaf scallops: small dark arcs under lighter pixels
  const r = rng(seed);
  const W = p.w, H = p.h, src = p.clone();
  for (let y = 2; y < H - 2; y += 3) for (let x = 1 + ((y / 3) % 2) * 2; x < W - 2; x += 4) {
    const jx = x + r.int(2), jy = y + r.int(2);
    const c = src.get(jx, jy);
    const i = ramp.indexOf(c);
    if (i < 1) continue;
    if (src.get(jx - 1, jy + 2) === 0 || src.get(jx + 2, jy + 2) === 0) continue;
    p.set(jx - 1, jy + 1, ramp[i - 1]); p.set(jx, jy + 2, ramp[i - 1]); p.set(jx + 1, jy + 2, ramp[i - 1]); p.set(jx + 2, jy + 1, ramp[i - 1]);
    if (i + 1 < ramp.length && r() < 0.6) p.set(jx, jy, ramp[i + 1]);
  }
  void ink; void bayer;
}

function tree() {
  const p = new Pix(32, 44);
  // trunk
  const tr = new Pix(32, 44);
  for (let y = 26; y < 43; y++) {
    const flare = y >= 39 ? (y - 38) : 0;
    const x0 = 13 - flare, x1 = 18 + flare;
    for (let x = x0; x <= x1; x++) tr.put(x, y, x <= x0 + 1 ? P.wood_lt : x >= x1 - 1 ? P.wood_dk : P.wood_md);
  }
  tr.set(15, 33, P.wood_dk); tr.set(15, 34, P.wood_dk); tr.set(16, 37, P.wood_dk);
  tr.outline(P.wood_ink);
  p.blit(tr, 0, 0);
  const crown = new Pix(32, 44);
  foliage(crown, [[16, 14, 13, 10], [9, 11, 7, 6], [23, 11, 7, 6], [16, 7, 8, 5.5], [8, 20, 6, 5], [24, 20, 6, 5], [16, 21, 8, 5]],
    [P.grass_ink, P.grass_dk, P.grass_md, P.grass_lt, P.grass_hi], P.grass_ink, 3);
  crown.outline(P.grass_ink);
  p.blit(crown, 0, 0);
  // crown shadow on trunk
  p.hline(13, 18, 28, P.wood_dk); p.hline(14, 17, 29, P.wood_dk);
  return p.canvas(16, 43);
}
function treeSmall() {
  const p = new Pix(16, 24);
  const tr = new Pix(16, 24);
  for (let y = 14; y < 23; y++) for (let x = 6; x <= 9; x++) tr.put(x, y, x === 6 ? P.wood_lt : x === 9 ? P.wood_dk : P.wood_md);
  tr.put(5, 22, P.wood_md); tr.put(10, 22, P.wood_dk);
  tr.outline(P.wood_ink); p.blit(tr, 0, 0);
  const c = new Pix(16, 24);
  foliage(c, [[8, 9, 6.5, 6], [5, 7, 3.5, 3.5], [11, 7, 3.5, 3.5]], [P.grass_ink, P.grass_dk, P.grass_md, P.grass_lt, P.grass_hi], P.grass_ink, 5);
  c.outline(P.grass_ink); p.blit(c, 0, 0);
  p.hline(6, 9, 16, P.wood_dk);
  return p.canvas(8, 23);
}
function bush() {
  const p = new Pix(16, 16);
  foliage(p, [[8, 9.5, 6.5, 5], [5, 7, 3.5, 3], [11, 7, 3.5, 3]], [P.grass_ink, P.grass_dk, P.grass_md, P.grass_lt], P.grass_ink, 9);
  p.outline(P.grass_ink);
  return p.canvas();
}
function bushCut() {
  const p = new Pix(16, 16);
  p.ellipse(8, 12.5, 6, 2.5, P.grass_dk);
  p.ellipse(8, 12, 5, 1.6, P.grass_lt);
  p.set(6, 12, P.grass_hi); p.set(9, 11, P.grass_hi); p.set(4, 13, P.grass_md); p.set(11, 13, P.grass_md);
  for (const x of [5, 8, 11]) p.set(x, 10, P.grass_dk);
  p.outline(P.grass_ink);
  return p.canvas();
}
function rockObj(big) {
  const W = big ? 32 : 16, H = big ? 24 : 16, p = new Pix(W, H);
  const ramp = [P.rock_dk, P.rock_md, P.rock_lt, P.rock_hi];
  if (big) { p.ball(11, 14, 9, 8, ramp); p.ball(21, 15, 9, 7.5, ramp, { bias: -0.05 }); p.ball(16, 10, 8, 6, ramp, { bias: 0.05 }); }
  else p.ball(8, 9, 7, 6, ramp);
  // facets
  const fl = big ? [[8, 9, 12, 13], [12, 13, 12, 19], [20, 8, 23, 12], [23, 12, 27, 13]] : [[4, 8, 7, 10], [7, 10, 7, 14], [9, 5, 11, 8]];
  for (const [a, b, c, d] of fl) p.line(a, b, c, d, P.rock_dk);
  for (const [a, b] of big ? [[9, 8], [13, 12], [21, 7]] : [[5, 7], [8, 9]]) p.set(a, b, P.rock_hi);
  // flat base
  for (let x = 0; x < W; x++) p.clear(x, H - 1);
  p.outline(P.rock_ink);
  return p.canvas();
}
function pot() {
  const p = new Pix(16, 16);
  p.ball(8, 10, 6, 5, [P.dirt_dk, P.dirt_md, P.dirt_lt, P.dirt_hi], { dither: 0.08 });
  p.rect(5, 3, 6, 3, P.dirt_md); p.vline(5, 3, 5, P.dirt_lt); p.vline(10, 3, 5, P.dirt_dk);
  p.ellipse(8, 3.5, 4, 1.5, P.dirt_hi);
  p.ellipse(8, 3.5, 2.6, 0.9, P.dirt_ink);
  p.hline(4, 11, 8, P.dirt_dk); p.hline(5, 10, 9, P.dirt_lt);
  for (let x = 0; x < 16; x++) p.clear(x, 15);
  p.outline(P.dirt_ink);
  return p.canvas();
}
function sign() {
  const p = new Pix(16, 16);
  p.rect(7, 10, 2, 5, P.wood_md); p.vline(8, 10, 14, P.wood_dk);
  p.rect(1, 2, 14, 8, P.wood_md);
  p.hline(1, 14, 2, P.wood_hi); p.vline(1, 3, 9, P.wood_lt); p.vline(14, 3, 9, P.wood_dk); p.hline(1, 14, 9, P.wood_dk);
  p.hline(3, 11, 4, P.wood_dk); p.hline(3, 12, 6, P.wood_dk); p.hline(3, 9, 8 - 0, P.wood_md);
  p.hline(4, 9, 8, P.wood_dk);
  p.outline(P.wood_ink);
  return p.canvas();
}
function chest(open) {
  const p = new Pix(16, 16);
  // box
  p.rect(1, 7, 14, 8, P.wood_md); p.hline(1, 14, 7, P.wood_lt); p.vline(14, 7, 14, P.wood_dk); p.hline(1, 14, 14, P.wood_dk);
  p.hline(2, 13, 11, P.wood_dk);
  if (!open) {
    p.rect(1, 2, 14, 5, P.wood_md); p.hline(2, 13, 1, P.wood_lt); p.hline(1, 14, 2, P.wood_hi); p.hline(1, 14, 6, P.wood_dk);
    p.vline(14, 2, 6, P.wood_dk);
  } else {
    p.rect(1, 0, 14, 4, P.wood_dk); p.hline(2, 13, 0, P.wood_md);
    p.rect(2, 4, 12, 3, P.wood_ink); p.hline(2, 13, 6, P.wood_dk);
    p.set(6, 5, P.gold_lt); p.set(9, 4, P.gold_md);
  }
  // gold bands & lock
  for (const x of [3, 12]) { p.vline(x, open ? 0 : 2, 14, P.gold_md); p.set(x, open ? 0 : 2, P.gold_lt); p.vline(x + 1, open ? 1 : 3, 14, P.gold_dk); }
  if (!open) { p.rect(7, 5, 2, 4, P.gold_md); p.set(7, 5, P.gold_lt); p.set(8, 7, P.wood_ink); }
  else { p.rect(7, 7, 2, 2, P.gold_md); p.set(7, 7, P.gold_lt); }
  p.outline(P.wood_ink);
  return p.canvas();
}
function house() {
  const W = 64, H = 64, p = new Pix(W, H);
  // walls (timber frame)
  p.rect(4, 30, 56, 30, P.dirt_hi);
  for (const x of [4, 5, 22, 41, 58, 59]) p.vline(x, 30, 59, P.wood_dk);
  p.hline(4, 59, 45, P.wood_dk);
  p.line(6, 44, 21, 33, P.wood_dk); p.line(42, 33, 57, 44, P.wood_dk);
  for (let y = 31; y < 58; y += 1) { p.set(6, y, (y & 3) === 0 ? P.sand : p.get(6, y)); }
  // foundation
  for (let x = 2; x < 62; x++) for (let y = 57; y < 63; y++) p.put(x, y, P.rock_md);
  for (let row = 0; row < 2; row++) for (let x = 2 + row * 4; x < 62; x += 8) { p.vline(x, 57 + row * 3, 59 + row * 3, P.rock_dk); }
  p.hline(2, 61, 57, P.rock_lt); p.hline(2, 61, 60, P.rock_dk); p.hline(2, 61, 62, P.rock_dk);
  // windows
  for (const wx of [10, 45]) {
    p.rect(wx - 1, 35, 11, 9, P.wood_dk);
    p.rect(wx, 36, 9, 7, P.fx_yellow);
    p.rect(wx, 36, 9, 2, P.water_lt);
    p.vline(wx + 4, 36, 42, P.wood_dk); p.hline(wx, wx + 8, 39, P.wood_dk);
    p.hline(wx - 1, wx + 9, 44, P.wood_md);
  }
  // door
  p.rect(25, 41, 14, 19, P.wood_ink);
  p.rect(26, 42, 12, 18, P.wood_md);
  for (const x of [29, 32, 35]) p.vline(x, 43, 59, P.wood_dk);
  p.hline(26, 37, 42, P.wood_lt); p.vline(26, 42, 59, P.wood_lt);
  p.set(35, 51, P.gold_md); p.set(36, 51, P.gold_md);
  p.rect(24, 60, 16, 3, P.rock_lt); p.hline(24, 39, 62, P.rock_dk);
  // roof (front slope, tile rows)
  for (let y = 0; y <= 31; y++) {
    const inset = Math.max(0, 6 - y);
    for (let x = inset; x < W - inset; x++) {
      const row = Math.floor((y - 2) / 4), ry = (y - 2) & 3;
      const sx = (x + (row & 1) * 3) % 6;
      let c = P.red_md;
      if (ry === 0) c = P.red_lt;
      else if (ry === 3 || sx === 0) c = P.red_dk;
      if (x < 12 && ry === 1 && sx !== 0) c = P.red_lt;
      if (x > W - 10 && ry !== 0) c = P.red_dk;
      p.put(x, y, c);
    }
  }
  // ridge
  p.hline(6, W - 7, 0, P.red_lt); p.hline(5, W - 6, 1, P.red_md); p.hline(4, W - 5, 2, P.red_dk);
  // eave edge
  p.hline(0, W - 1, 31, P.red_dk); p.hline(0, W - 1, 32, P.wood_dk);
  // overhang shadow on wall
  p.rect(4, 33, 56, 2, P.shadow);
  // chimney
  p.rect(44, 0, 8, 12, P.rock_md); p.vline(44, 0, 11, P.rock_lt); p.vline(51, 0, 11, P.rock_dk); p.hline(44, 51, 0, P.rock_lt);
  p.rect(45, 1, 6, 1, P.rock_dk);
  p.hline(44, 51, 12, P.red_dk);
  p.outline(P.wood_ink);
  return p.canvas(32, 63);
}
function fence(vertical) {
  const p = new Pix(16, 16);
  if (!vertical) {
    for (const y of [6, 10]) { p.hline(0, 15, y, P.wood_lt); p.hline(0, 15, y + 1, P.wood_dk); }
    p.rect(1, 3, 3, 12, P.wood_md); p.vline(1, 3, 14, P.wood_lt); p.vline(3, 3, 14, P.wood_dk); p.hline(1, 3, 3, P.wood_hi);
    p.rect(12, 3, 3, 12, P.wood_md); p.vline(12, 3, 14, P.wood_lt); p.vline(14, 3, 14, P.wood_dk); p.hline(12, 14, 3, P.wood_hi);
  } else {
    p.rect(7, 0, 2, 12, P.wood_lt); p.vline(8, 0, 11, P.wood_dk);
    p.rect(6, 7, 4, 8, P.wood_md); p.vline(6, 7, 14, P.wood_lt); p.vline(9, 7, 14, P.wood_dk); p.hline(6, 9, 7, P.wood_hi);
  }
  p.outline(P.wood_ink);
  return p.canvas();
}
function flower(f, col = P.heart_hi) {
  const p = new Pix(8, 10);
  const dx = [0, 1, 0, -1][f];
  p.vline(4, 5, 9, P.grass_dk); p.set(3, 7, P.grass_md); p.set(5, 8, P.grass_md);
  const cx = 4 + dx, cy = 3;
  p.set(cx, cy - 1, col); p.set(cx - 1, cy, col); p.set(cx + 1, cy, col); p.set(cx, cy + 1, col);
  p.set(cx, cy, P.gold_md);
  p.outline(P.grass_ink);
  return p.canvas(4, 9);
}
function grassTallSprite(f) {
  const p = new Pix(16, 16);
  for (let c = 0; c < 5; c++) {
    const bx = 1 + c * 3, sway = f ? 1 : 0;
    for (const [dx, h] of [[0, 5], [1, 7], [2, 4]]) {
      for (let k = 0; k < h; k++) {
        const x = bx + dx + (k > 3 ? sway : 0), y = 15 - k;
        p.set(x, y, k >= h - 1 ? P.grass_lt : k >= h - 3 ? P.grass_md : P.grass_dk);
      }
    }
  }
  p.outline(P.grass_ink);
  for (let x = 0; x < 16; x++) if (p.get(x, 15) === p.get(-1, -1)) p.clear(x, 15);
  return p.canvas();
}
function statue() {
  const p = new Pix(16, 32);
  const ramp = [P.stone_dk, P.stone_md, P.stone_lt, P.stone_hi];
  // pedestal
  p.rect(1, 22, 14, 9, P.stone_md); p.hline(1, 14, 22, P.stone_hi); p.hline(1, 14, 23, P.stone_lt); p.vline(14, 23, 30, P.stone_dk); p.hline(1, 14, 30, P.stone_dk);
  p.hline(3, 12, 26, P.stone_dk);
  // owl body
  p.ball(8, 15, 6, 7, ramp);
  p.ball(8, 7, 5, 4.5, ramp);
  p.set(4, 3, P.stone_md); p.set(3, 2, P.stone_lt); p.set(12, 3, P.stone_md); p.set(13, 2, P.stone_md); // ears
  p.rect(5, 6, 2, 2, P.stone_hi); p.rect(9, 6, 2, 2, P.stone_hi); p.set(6, 7, P.stone_ink); p.set(10, 7, P.stone_ink);
  p.set(8, 9, P.gold_md);
  for (const y of [14, 17]) { p.set(6, y, P.stone_dk); p.set(8, y + 1, P.stone_dk); p.set(10, y, P.stone_dk); }
  p.line(3, 13, 4, 19, P.stone_dk); p.line(13, 13, 12, 19, P.stone_dk);
  p.outline(P.stone_ink);
  return p.canvas();
}
function torch(f) {
  const p = new Pix(16, 24);
  // post + bowl
  p.rect(6, 16, 4, 7, P.stone_md); p.vline(6, 16, 22, P.stone_lt); p.vline(9, 16, 22, P.stone_dk);
  p.rect(3, 12, 10, 4, P.metal_md); p.hline(3, 12, 12, P.metal_lt); p.hline(4, 11, 15, P.metal_dk); p.vline(12, 12, 15, P.metal_dk);
  p.rect(4, 13, 8, 1, P.metal_dk);
  // flame
  const fl = new Pix(16, 24);
  const sway = [0, 1, 0, -1][f], hgt = [9, 10, 8, 10][f];
  for (let y = 0; y < hgt; y++) {
    const t = y / hgt; // 0 top -> 1 bottom
    const w = Math.max(0.5, Math.sin(t * Math.PI * 0.9) * 4);
    const cx = 8 + (t < 0.5 ? sway : 0);
    const yy = 12 - hgt + y;
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w) - 1; x++) {
      const d = Math.abs(x + 0.5 - cx) / w;
      fl.set(x, yy, d > 0.7 ? P.red_md : d > 0.4 || t < 0.3 ? P.fx_orange : t > 0.55 ? P.white : P.fx_yellow);
    }
  }
  fl.set(8 + sway, 12 - hgt - 1, P.fx_orange);
  p.blit(fl, 0, 0);
  p.outline(P.stone_ink);
  return p.canvas();
}
function doorLocked() {
  const p = new Pix(16, 32);
  p.rect(0, 0, 16, 32, P.stone_md);
  p.hline(0, 15, 0, P.stone_hi); p.vline(0, 0, 31, P.stone_lt); p.vline(15, 0, 31, P.stone_dk);
  p.rect(2, 3, 12, 28, P.wood_md);
  for (const x of [5, 8, 11]) p.vline(x, 3, 30, P.wood_dk);
  p.vline(2, 3, 30, P.wood_lt);
  for (const y of [7, 22]) { p.hline(2, 13, y, P.metal_md); p.hline(2, 13, y + 1, P.metal_dk); p.set(4, y, P.metal_lt); p.set(11, y, P.metal_lt); }
  p.rect(5, 12, 6, 7, P.gold_md); p.hline(5, 10, 12, P.gold_lt); p.vline(10, 13, 18, P.gold_dk); p.hline(5, 10, 18, P.gold_dk);
  p.rect(7, 14, 2, 2, P.ink); p.set(7, 16, P.ink); p.set(8, 16, P.ink); p.set(7, 17, P.ink);
  p.hline(2, 13, 3, P.stone_ink);
  p.outline(P.stone_ink);
  return p.canvas();
}
function block() {
  const p = new Pix(16, 16);
  p.rect(0, 0, 16, 12, P.stone_lt);
  p.hline(0, 15, 0, P.stone_hi); p.vline(0, 0, 11, P.stone_hi); p.vline(15, 1, 11, P.stone_md);
  p.rect(3, 3, 10, 6, P.stone_md); p.hline(3, 12, 3, P.stone_dk); p.vline(3, 3, 8, P.stone_dk); p.hline(4, 12, 9, P.stone_hi); p.vline(13, 4, 9, P.stone_hi);
  p.rect(0, 12, 16, 4, P.stone_md); p.hline(0, 15, 12, P.stone_dk); p.hline(0, 15, 15, P.stone_dk);
  p.set(4, 14, P.stone_dk); p.set(11, 13, P.stone_dk);
  const q = new Pix(16, 16); q.blit(p, 0, 0);
  // outline inside the tile bounds: darkest material
  for (let i = 0; i < 16; i++) { q.put(i, 15, P.stone_ink); q.put(0, i, i > 0 ? q.get(0, i) : q.get(0, i)); }
  return q.canvas();
}
function floorSwitch(down) {
  const p = new Pix(16, 16);
  p.rect(1, 1, 14, 14, P.stone_dk);
  p.hline(1, 14, 1, P.stone_md); p.vline(1, 1, 14, P.stone_md); p.hline(1, 14, 14, P.stone_ink); p.vline(14, 1, 14, P.stone_ink);
  if (!down) {
    p.rect(4, 3, 8, 8, P.gold_md); p.hline(4, 11, 3, P.gold_lt); p.vline(4, 3, 10, P.gold_lt); p.vline(11, 4, 10, P.gold_dk);
    p.rect(4, 11, 8, 2, P.gold_dk); p.hline(4, 11, 13, P.stone_ink);
  } else {
    p.rect(4, 5, 8, 7, P.gold_dk); p.hline(4, 11, 5, P.gold_md); p.hline(4, 11, 4, P.stone_ink);
  }
  return p.canvas();
}
function heartShape(p, x0, y0, ramp, big) {
  const s = big ? `
.ooo...ooo..
oiiMo.oMMMo.
oiMMMoMMMMdo
oiMMMMMMMMdo
oMMMMMMMMMdo
.oMMMMMMMdo.
..oMMMMMdo..
...oMMMdo...
....oMdo....
.....oo.....` : `
.oo.oo.
oiMoMMo
oiMMMdo
oMMMMdo
.oMMdo.
..oMo..
...o...`;
  const m = mat(s, { o: ramp[0], i: ramp[3], M: ramp[2], d: ramp[1] });
  p.blit(m, x0, y0);
}
function heartContainer(f) {
  const p = new Pix(16, 16);
  heartShape(p, 2, 3, [P.ink, P.heart_dk, P.heart_md, P.heart_hi], true);
  p.set(4, 5, P.white); p.set(5, 5, P.white);
  if (f === 1) { p.set(12, 2, P.white); p.set(11, 2, P.fx_yellow); p.set(13, 2, P.fx_yellow); p.set(12, 1, P.fx_yellow); p.set(12, 3, P.fx_yellow); }
  if (f === 2) { p.set(3, 12, P.white); }
  return p.canvas();
}
function heartPickup() {
  const p = new Pix(8, 8);
  heartShape(p, 0, 0, [P.heart_dk, P.heart_dk, P.heart_md, P.heart_hi], false);
  return p.canvas(4, 7);
}
function rupee(ramp, f) {
  const s = `
...oo...
..oLMo..
.oLLMdo.
.oLMMdo.
.oLMMdo.
.oLMMdo.
.oLMMdo.
.oLMMdo.
.oLMMdo.
.oLMMdo.
.oLMddo.
..oMdo..
...oo...`;
  const m = mat(s, { o: P.ink, L: ramp[2], M: ramp[1], d: ramp[0] });
  const p = new Pix(8, 14); p.blit(m, 0, 0);
  const gl = [[2, 3], [3, 6], [2, 9]][f]; p.set(gl[0], gl[1], P.white); p.set(gl[0], gl[1] + 1, P.white);
  return p.canvas(4, 13);
}
function keySmall() {
  const m = mat(`
..oooo..
.oYYYYo.
oYyooYYo
oYo..oYo
oYyooYdo
.oYYYdo.
..oYdo..
..oYdo..
..oYdo..
..oYdoo.
..oYYYdo
..oYdoo.
..oYYYdo
..oYdoo.
..oYdo..
...oo...`, { o: P.ink, Y: P.gold_md, y: P.gold_lt, d: P.gold_dk });
  return m.canvas(4, 15);
}
function bomb(f) {
  const p = new Pix(16, 16);
  p.ball(8, 10, 5.5, 5, [P.stone_ink, P.stone_dk, P.stone_md, P.stone_lt]);
  p.set(6, 7, P.white); p.set(5, 8, P.stone_hi);
  p.rect(7, 3, 3, 2, P.metal_md); p.set(7, 3, P.metal_lt);
  p.set(9, 2, P.wood_lt); p.set(10, 1, P.wood_lt);
  const sp = [[P.fx_yellow, P.fx_orange], [P.white, P.fx_yellow], [P.fx_orange, P.red_md]][f];
  p.set(11, 0, sp[0]); if (f !== 2) { p.set(12, 0, sp[1]); p.set(11, 1, sp[1]); }
  p.outline(P.ink);
  return p.canvas();
}
function stump() {
  const p = new Pix(16, 16);
  p.rect(3, 6, 10, 8, P.wood_md); p.vline(3, 6, 13, P.wood_lt); p.vline(12, 6, 13, P.wood_dk); p.vline(11, 7, 13, P.wood_dk);
  p.vline(6, 9, 13, P.wood_dk); p.vline(9, 10, 13, P.wood_dk);
  p.rect(1, 13, 3, 2, P.wood_md); p.rect(12, 13, 3, 2, P.wood_dk);
  p.ellipse(8, 6, 5, 2.5, P.wood_hi); p.ellipse(8, 6, 3, 1.4, P.wood_lt); p.set(8, 6, P.wood_md); p.set(7, 6, P.wood_md);
  p.outline(P.wood_ink);
  return p.canvas();
}
function mushroom() {
  const p = new Pix(16, 16);
  p.rect(6, 9, 4, 5, P.skin_lt); p.vline(9, 9, 13, P.skin_md);
  p.ball(8, 7, 6, 4, [P.red_dk, P.red_md, P.red_lt]);
  for (let x = 0; x < 16; x++) for (let y = 9; y < 11; y++) if (p.get(x, y) && (x < 6 || x > 9)) p.clear(x, y);
  p.hline(3, 12, 9, P.red_dk);
  p.rect(5, 5, 2, 1, P.white); p.set(10, 6, P.white); p.set(8, 4, P.white);
  p.outline(P.ink);
  return p.canvas();
}
function lilypad() {
  const p = new Pix(16, 16);
  p.ellipse(8, 9, 6.5, 4, P.grass_md);
  p.ellipse(7, 8.5, 4, 2.2, P.grass_lt);
  for (let k = 0; k < 4; k++) { p.clear(8 + k, 9 + (k >> 1)); p.clear(8 + k, 10 + (k >> 1)); }
  p.set(5, 8, P.grass_hi);
  p.hline(4, 12, 12, P.grass_dk);
  p.outline(P.grass_ink);
  p.set(11, 6, P.heart_hi); p.set(12, 6, P.white); p.set(11, 5, P.white);
  return p.canvas();
}

export function buildObjects() {
  const S = {};
  S.tree = [tree()];
  S.tree_small = [treeSmall()];
  S.bush = [bush()];
  S.bush_cut = [bushCut()];
  S.rock = [rockObj(false)];
  S.rock_big = [rockObj(true)];
  S.pot = [pot()];
  S.sign = [sign()];
  S.chest_closed = [chest(false)];
  S.chest_open = [chest(true)];
  S.house = [house()];
  S.fence_h = [fence(false)];
  S.fence_v = [fence(true)];
  S.fence = S.fence_h;
  S.flower = frames([0, 1, 0, 3].map((f) => flower(f)), { fps: 3 });
  S.flower_white = frames([0, 1, 0, 3].map((f) => flower(f, P.white)), { fps: 3 });
  S.flower_yellow = frames([0, 1, 0, 3].map((f) => flower(f, P.fx_yellow)), { fps: 3 });
  S.grass_tall = frames([grassTallSprite(0), grassTallSprite(1)], { fps: 2 });
  S.statue = [statue()];
  S.torch = frames([0, 1, 2, 3].map(torch), { fps: 8 });
  S.door_locked = [doorLocked()];
  S.block = [block()];
  S.switch_up = [floorSwitch(false)];
  S.switch_down = [floorSwitch(true)];
  S.heart_container = frames([heartContainer(0), heartContainer(1), heartContainer(0), heartContainer(2)], { fps: 4 });
  S.bomb = frames([bomb(0), bomb(1), bomb(2)], { fps: 10 });
  S.stump = [stump()];
  S.mushroom = [mushroom()];
  S.lilypad = [lilypad()];
  S.heart_pickup = [heartPickup()];
  S.rupee_green = frames([0, 1, 2].map((f) => rupee([P.grass_dk, P.rupee_green, P.grass_hi], f)), { fps: 8 });
  S.rupee_blue = frames([0, 1, 2].map((f) => rupee([P.blue_dk, P.blue_md, P.blue_lt], f)), { fps: 8 });
  S.rupee_red = frames([0, 1, 2].map((f) => rupee([P.red_dk, P.red_md, P.red_lt], f)), { fps: 8 });
  S.key_small = [keySmall()];
  return S;
}
export { heartShape };
