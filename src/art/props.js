// Props & gameplay objects (pixel sprites, master palette, material-dark outlines, anchors bottom-centre).
import { Pix, rng, frames } from './core.js';
import { palette as P } from './palette.js';

function barrel() {
  const p = new Pix(16, 20);
  for (let y = 3; y < 19; y++) {
    const bulge = Math.round(Math.sin(((y - 3) / 15) * Math.PI) * 1.5);
    const x0 = 2 - bulge, x1 = 13 + bulge;
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0);
      p.put(x, y, t < 0.2 ? P.wood_lt : t > 0.8 ? P.wood_dk : (x % 4 === 0 ? P.wood_dk : P.wood_md));
    }
  }
  for (const y of [5, 11, 16]) for (let x = 0; x < 16; x++) if (p.op(x, y)) p.put(x, y, x < 5 ? P.metal_lt : x > 11 ? P.metal_dk : P.metal_md);
  p.ellipse(8, 3, 5.5, 2, P.wood_md); p.ellipse(8, 3, 4, 1.2, P.wood_dk); p.hline(5, 9, 2, P.wood_lt);
  p.outline(P.wood_ink);
  return p.canvas(8, 19);
}
function crate() {
  const p = new Pix(16, 16);
  p.rect(1, 1, 14, 14, P.wood_md);
  p.rect(1, 1, 14, 2, P.wood_lt); p.rect(1, 13, 14, 2, P.wood_dk); p.rect(1, 1, 2, 14, P.wood_lt); p.rect(13, 1, 2, 14, P.wood_dk);
  for (let k = 0; k < 10; k++) { p.put(3 + k, 3 + k, P.wood_dk); p.put(4 + k, 3 + k, P.wood_lt); }
  for (const y of [6, 9]) p.hline(3, 12, y, P.wood_dk);
  for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) p.put(x, y, P.metal_md);
  p.outline(P.wood_ink);
  return p.canvas(8, 15);
}
function sack() {
  const p = new Pix(14, 14);
  p.ball(7, 9, 6, 4.5, [P.dirt_md, P.dirt_lt, P.sand, P.dirt_hi]);
  p.rect(5, 2, 4, 3, P.dirt_lt); p.put(5, 2, P.dirt_hi); p.put(8, 4, P.dirt_md);
  p.hline(5, 8, 4, P.wood_dk); p.put(9, 3, P.wood_dk);
  p.put(4, 9, P.dirt_md); p.put(10, 10, P.dirt_md); p.put(7, 12, P.dirt_md);
  for (let x = 0; x < 14; x++) p.clear(x, 13);
  p.outline(P.dirt_ink);
  return p.canvas(7, 12);
}
function cart() {
  const p = new Pix(32, 24);
  // hay load
  p.ball(15, 8, 12, 5, [P.gold_dk, P.gold_md, P.gold_lt, P.gold_lt]);
  const r = rng(3); for (let i = 0; i < 18; i++) { const x = r.range(5, 25), y = r.range(4, 11); p.put(x, y, P.gold_dk); p.put(x + 1, y - 1, P.gold_lt); }
  // box
  p.rect(3, 10, 24, 7, P.wood_md); p.hline(3, 26, 10, P.wood_lt); p.hline(3, 26, 16, P.wood_dk);
  for (const x of [3, 10, 18, 26]) p.vline(x, 10, 16, P.wood_dk);
  p.hline(4, 25, 13, P.wood_dk);
  // shafts
  p.line(27, 14, 31, 16, P.wood_dk); p.line(27, 13, 31, 15, P.wood_md);
  // wheels
  for (const cx of [8, 21]) {
    p.ellipse(cx, 18.5, 4.5, 4.5, P.wood_dk); p.ellipse(cx, 18.5, 3.2, 3.2, P.wood_md); p.ellipse(cx, 18.5, 1.2, 1.2, P.metal_md);
    p.line(cx - 3, 18, cx + 3, 18, P.wood_dk); p.line(cx, 15, cx, 22, P.wood_dk);
  }
  p.outline(P.wood_ink);
  return p.canvas(15, 23);
}
function well() {
  const p = new Pix(32, 32);
  // roof
  for (let y = 0; y < 7; y++) { const w = 4 + y * 2; p.hline(16 - w, 15 + w, y + 1, y === 0 ? P.red_lt : y % 2 ? P.red_md : P.red_dk); }
  p.hline(1, 30, 8, P.wood_dk);
  // posts
  p.rect(5, 8, 2, 14, P.wood_md); p.vline(5, 8, 21, P.wood_lt); p.rect(25, 8, 2, 14, P.wood_md); p.vline(26, 8, 21, P.wood_dk);
  p.hline(7, 24, 12, P.wood_dk); p.vline(16, 12, 16, P.metal_md);
  p.rect(14, 16, 4, 3, P.wood_md); p.hline(14, 17, 16, P.metal_lt);
  // stone ring
  p.ellipse(16, 22, 13, 3.5, P.rock_lt); p.ellipse(16, 22, 10, 2.2, P.ink);
  p.rect(3, 22, 26, 8, P.rock_md);
  for (let x = 3; x < 29; x += 5) p.vline(x + ((x / 5) % 2 ? 2 : 0), 22, 29, P.rock_dk);
  p.hline(3, 28, 25, P.rock_dk); p.hline(3, 28, 26, P.rock_lt); p.hline(3, 28, 29, P.rock_dk);
  p.outline(P.rock_ink);
  return p.canvas(16, 31);
}
function gravestone() {
  const p = new Pix(16, 20);
  p.rect(3, 6, 10, 12, P.rock_md);
  p.ellipse(8, 6.5, 5, 4.5, P.rock_md);
  p.vline(3, 6, 17, P.rock_lt); p.vline(4, 4, 17, P.rock_lt); p.hline(6, 10, 2, P.rock_hi);
  p.vline(12, 6, 17, P.rock_dk);
  p.vline(8, 6, 12, P.rock_dk); p.hline(6, 10, 8, P.rock_dk);
  p.hline(5, 11, 14, P.rock_dk);
  p.put(4, 15, P.grass_md); p.put(5, 16, P.grass_md); p.put(11, 16, P.grass_dk); p.put(10, 4, P.grass_md);
  p.rect(1, 17, 14, 2, P.rock_dk); p.hline(1, 14, 17, P.rock_lt);
  p.outline(P.rock_ink);
  return p.canvas(8, 19);
}
function lantern(f) {
  const p = new Pix(10, 16);
  p.rect(2, 4, 6, 8, f ? P.fx_yellow : P.gold_lt);
  p.rect(4, 6, 2, 4, P.white);
  if (f) p.put(5, 5, P.white);
  for (const x of [2, 7]) p.vline(x, 4, 11, P.metal_dk);
  p.hline(1, 8, 3, P.metal_dk); p.hline(2, 7, 2, P.metal_md); p.rect(4, 0, 2, 2, P.metal_md);
  p.hline(1, 8, 12, P.metal_dk); p.hline(3, 6, 13, P.metal_md);
  p.outline(P.ink);
  return p.canvas(5, 15);
}
// stone wall front (16 wide, n×16 tall) with bricks
function wallFront(h) {
  const p = new Pix(16, h);
  p.fill(P.stone_md);
  for (let row = 0; row * 6 < h; row++) {
    const y = row * 6, off = row % 2 ? 4 : 0;
    p.hline(0, 15, y, P.stone_ink); p.hline(0, 15, y + 1, P.stone_lt);
    for (let x = off; x < 16; x += 8) p.vline(x, y, y + 5, P.stone_ink);
  }
  return p;
}
function wallCracked() {
  const p = wallFront(48);
  const pts = [[8, 8], [7, 12], [9, 16], [6, 20], [8, 24], [10, 28], [7, 32], [9, 36], [8, 40]];
  for (let i = 0; i < pts.length - 1; i++) { p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], P.ink); p.line(pts[i][0] + 1, pts[i][1], pts[i + 1][0] + 1, pts[i + 1][1], P.stone_dk); }
  p.line(7, 12, 3, 15, P.ink); p.line(9, 28, 13, 31, P.ink); p.line(8, 24, 12, 22, P.stone_dk);
  p.rect(6, 41, 4, 3, P.stone_dk); p.put(5, 44, P.stone_lt); p.put(11, 45, P.stone_lt);
  return p.canvas(8, 47);
}
function doorLocked48() {
  const p = wallFront(48);
  p.rect(2, 14, 12, 34, P.wood_ink);
  p.ellipse(8, 15, 6, 5, P.wood_ink);
  p.rect(3, 15, 10, 33, P.wood_md); p.ellipse(8, 15, 5, 4, P.wood_md);
  for (const x of [5, 8, 11]) p.vline(x, 12, 47, P.wood_dk);
  p.vline(3, 14, 47, P.wood_lt);
  for (const y of [20, 38]) { p.hline(3, 12, y, P.metal_md); p.hline(3, 12, y + 1, P.metal_dk); }
  p.rect(5, 27, 6, 7, P.gold_md); p.hline(5, 10, 27, P.gold_lt); p.vline(10, 28, 33, P.gold_dk);
  p.rect(7, 29, 2, 2, P.ink); p.put(7, 31, P.ink); p.put(8, 31, P.ink); p.put(7, 32, P.ink);
  return p.canvas(8, 47);
}
function shutter() {
  const p = wallFront(48);
  p.rect(1, 12, 14, 36, P.ink);
  for (const x of [2, 5, 8, 11, 14]) { p.vline(x, 12, 47, P.metal_md); if (x < 14) p.vline(x + 1, 12, 47, P.metal_dk); }
  for (const y of [18, 30, 42]) { p.hline(1, 14, y, P.metal_lt); p.hline(1, 14, y + 1, P.metal_dk); }
  for (let x = 2; x < 15; x += 3) p.put(x, 47, P.metal_lt);
  p.hline(0, 15, 11, P.stone_ink);
  return p.canvas(8, 47);
}
function rockCracked() {
  // overlay for cliff faces (transparent), 16×24: dark crack with lit lips
  const p = new Pix(16, 24);
  const path = [[8, 2], [7, 6], [9, 9], [6, 13], [8, 16], [7, 20], [9, 23]];
  for (let i = 0; i < path.length - 1; i++) {
    p.line(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1], P.cliff_ink);
    p.line(path[i][0] - 1, path[i][1], path[i + 1][0] - 1, path[i + 1][1], P.cliff_hi);
    p.line(path[i][0] + 1, path[i][1], path[i + 1][0] + 1, path[i + 1][1], P.cliff_dk);
  }
  p.line(7, 6, 3, 8, P.cliff_ink); p.line(9, 9, 13, 11, P.cliff_ink); p.line(8, 16, 12, 18, P.cliff_ink);
  p.put(4, 9, P.cliff_hi); p.put(12, 12, P.cliff_dk);
  return p.canvas(8, 23);
}
function caveEntrance() {
  const p = new Pix(32, 32);
  // rock frame
  p.ellipse(16, 20, 15, 14, P.cliff_md);
  p.rect(1, 20, 30, 12, P.cliff_md);
  const r = rng(11);
  for (let i = 0; i < 14; i++) { const a = Math.PI + (i / 13) * Math.PI, x = 16 + Math.cos(a) * 13, y = 20 + Math.sin(a) * 12; p.ball(x, y, 2.8, 2.4, [P.cliff_dk, P.cliff_md, P.cliff_lt, P.cliff_hi]); }
  for (const x of [3, 28]) for (let y = 21; y < 31; y += 4) p.ball(x, y, 2.5, 2.2, [P.cliff_dk, P.cliff_md, P.cliff_lt]);
  // dark opening with depth gradient
  p.ellipse(16, 21, 10, 10, P.night); p.rect(6, 21, 21, 11, P.night);
  p.ellipse(16, 23, 8, 8, P.ink); p.rect(8, 23, 17, 9, P.ink);
  p.hline(7, 25, 31, P.shadow);
  void r;
  p.outline(P.cliff_ink);
  return p.canvas(16, 31);
}
function crystal(f) {
  const p = new Pix(16, 24);
  const shards = [[8, 3, 3, 18], [4, 10, 2, 12], [12, 8, 2, 13]];
  for (const [cx, top, hw, h] of shards) {
    for (let y = 0; y < h; y++) {
      const w = y < hw * 2 ? Math.ceil((y + 1) / 2) : hw;
      for (let x = -w; x <= w; x++) p.put(cx + x, top + y, x < 0 ? P.fx_cyan : x > 0 ? P.water_lt : P.water_hi);
    }
  }
  const glint = [[7, 6], [8, 11], [7, 16]][f];
  p.put(glint[0], glint[1], P.white); p.put(glint[0], glint[1] + 1, P.white);
  p.put(3, 13 + f, P.white);
  p.rect(2, 21, 12, 2, P.rock_md); p.hline(2, 13, 21, P.rock_lt);
  p.outline(P.blue_dk);
  return p.canvas(8, 23);
}
function portal(f) {
  const p = new Pix(32, 32), c = 15.5;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const d = Math.hypot(x + 0.5 - 16, (y + 0.5 - 16) * 1.25);
    if (d > 15) continue;
    if (d > 13.5) p.put(x, y, P.purple_dk);
    else if (d > 12.5) p.put(x, y, P.purple_lt);
    else if (d > 11) p.put(x, y, P.purple_md);
    else if (d < 9.5 && d > 8.5) p.put(x, y, P.fx_cyan);
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + f * (Math.PI / 16);
    const x = Math.round(16 + Math.cos(a) * 12), y = Math.round(16 + Math.sin(a) * 9.6);
    p.put(x, y, P.white); p.put(x + 1, y, P.fx_cyan);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 - f * (Math.PI / 8);
    const x = Math.round(16 + Math.cos(a) * 5), y = Math.round(16 + Math.sin(a) * 4);
    p.put(x, y, P.purple_lt);
  }
  p.put(16, 16, f % 2 ? P.white : P.fx_cyan);
  void c;
  return p.canvas(16, 16);
}

export function buildProps() {
  const S = {};
  S.barrel = [barrel()];
  S.crate = [crate()];
  S.sack = [sack()];
  S.cart = [cart()];
  S.well = [well()];
  S.gravestone = [gravestone()];
  S.lantern = frames([lantern(0), lantern(1)], { fps: 5 });
  S.wall_cracked = [wallCracked()];
  S.door_locked = [doorLocked48()];
  S.shutter = [shutter()];
  S.rock_cracked = [rockCracked()];
  S.cave_entrance = [caveEntrance()];
  S.crystal = frames([0, 1, 2].map(crystal), { fps: 6 });
  const pf = frames([0, 1, 2, 3].map(portal), { fps: 8 });
  pf.layer = 'floor';
  S.portal = pf;
  return S;
}
