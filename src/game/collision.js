// Movement against the tile world + solid objects.
// - Axis-separated sub-stepping (no tunnelling), ALttP-style corner sliding.
// - Height rules: an entity on level L may enter cells of height L; stairs bridge one level
//   (enter a stairs cell of height L+1, or leave a stairs cell down to L-1). Cliffs block.
// - Flyers (bats) ignore heights and objects; only walls/void block them.
import { TILE, DIR_VEC, overlap } from './util.js';

export const FOOT = { hw: 5, top: 5, bottom: 1 };       // foot box: x-hw..x+hw, y-top..y+bottom
const SLIDE_MAX = 7;                                      // px of corner overlap we slide around

export const cellOf = (px) => Math.floor(px / TILE);
export function centerY(e) { return e.y - 2; }

export function footRect(x, y, fb = FOOT) {
  return { x: x - fb.hw, y: y - fb.top, w: fb.hw * 2, h: fb.top + fb.bottom };
}

// Can a walker on level `lvl` stand in cell (tx,ty)?
export function cellOk(world, tx, ty, lvl, centerStairs, e) {
  if (!world.inside(tx, ty)) return false;
  const d = world.def(tx, ty);
  if (d.solid) return false;
  if (e?.avoidPits && d.pit) return false;
  if (e?.avoidWater && d.shallow) return false;
  const h = world.heightAt(tx, ty);
  if (h === lvl) return true;
  if (d.stairs && h === lvl + 1) return true;
  if (centerStairs && h === lvl - 1) return true;
  return false;
}
export function flyCellOk(world, tx, ty) {
  if (!world.inside(tx, ty)) return false;
  const d = world.def(tx, ty);
  return !(d.solid && !d.water);
}

// Does the foot box of `e` at (x,y) collide with anything?
export function blocked(g, e, x, y) {
  const world = g.world;
  const fb = e.foot || FOOT;
  const x0 = x - fb.hw, x1 = x + fb.hw - 0.01, y0 = y - fb.top, y1 = y + fb.bottom - 0.01;
  const pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
  // wide boxes (boss) need middle samples too
  if (fb.hw * 2 > TILE) for (let px = x0 + TILE; px < x1; px += TILE) pts.push([px, y0], [px, y1]);
  if (fb.top + fb.bottom > TILE) for (let py = y0 + TILE; py < y1; py += TILE) pts.push([x0, py], [x1, py]);
  if (e.flying) {
    for (const [px, py] of pts) if (!flyCellOk(world, cellOf(px), cellOf(py))) return true;
    return false;
  }
  const lvl = e.lvl;
  const cs = world.def(cellOf(e.x), cellOf(centerY(e))).stairs;
  for (const [px, py] of pts) if (!cellOk(world, cellOf(px), cellOf(py), lvl, cs, e)) return true;
  if (e.noSolids) return false;
  const fr = { x: x0, y: y0, w: fb.hw * 2, h: fb.top + fb.bottom };
  for (const s of g.solids) {
    if (s === e || s.dead || !s.solid || s.carried) continue;
    if (s.lvl !== -1 && Math.abs(s.lvl - lvl) > 0.5) continue;
    if (e.ignoreSolid && e.ignoreSolid(s)) continue;
    if (overlap(fr, s.solidBox())) return true;
  }
  return false;
}

// Level of the cell under the entity's centre (walkers).
export function levelUnder(world, e) { return world.heightAt(cellOf(e.x), cellOf(centerY(e))); }

// Visual z: smooth along stairs, integer elsewhere.
export function visualZ(world, x, y, lvl) {
  const tx = cellOf(x), ty = cellOf(y - 2);
  const d = world.def(tx, ty);
  if (!d.stairs) return lvl;
  const h = world.heightAt(tx, ty);
  const fy = (y - 2 - ty * TILE) / TILE, fx = (x - tx * TILE) / TILE;
  if (world.heightAt(tx, ty + 1) < h) return h - fy;
  if (world.heightAt(tx - 1, ty) < h) return h - 1 + fx;
  if (world.heightAt(tx + 1, ty) < h) return h - fx;
  if (world.heightAt(tx, ty - 1) < h) return h - 1 + fy;
  return h;
}

// Move with sub-steps. Returns { hitX, hitY, moved }.
export function move(g, e, dx, dy, o = {}) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const sx = dx / n, sy = dy / n;
  let hitX = false, hitY = false;
  const x0 = e.x, y0 = e.y;
  for (let i = 0; i < n; i++) {
    if (sx) {
      if (!blocked(g, e, e.x + sx, e.y)) e.x += sx;
      else { hitX = true; if (o.slide && Math.abs(dy) < Math.abs(dx) * 0.25) slide(g, e, 'x', sx); }
    }
    if (sy) {
      if (!blocked(g, e, e.x, e.y + sy)) e.y += sy;
      else { hitY = true; if (o.slide && Math.abs(dx) < Math.abs(dy) * 0.25) slide(g, e, 'y', sy); }
    }
    if (!e.flying) e.lvl = levelUnder(g.world, e);
  }
  return { hitX, hitY, moved: Math.hypot(e.x - x0, e.y - y0) };
}

// Corner sliding: blocked while moving along `axis`; if the obstacle only overlaps a few pixels,
// nudge perpendicular so the entity glides around the corner (ALttP feel).
function slide(g, e, axis, s) {
  for (let k = 1; k <= SLIDE_MAX; k++) {
    for (const sgn of [-1, 1]) {
      const off = k * sgn;
      const ax = axis === 'x' ? e.x + s : e.x + off, ay = axis === 'x' ? e.y + off : e.y + s;
      const bx = axis === 'x' ? e.x : e.x + off, by = axis === 'x' ? e.y + off : e.y;
      if (!blocked(g, e, ax, ay) && !blocked(g, e, bx, by)) {
        const st = Math.min(Math.abs(s), k) * sgn;
        const nx = axis === 'x' ? e.x : e.x + st, ny = axis === 'x' ? e.y + st : e.y;
        if (!blocked(g, e, nx, ny)) { e.x = nx; e.y = ny; }
        return true;
      }
    }
  }
  return false;
}

// Ledge jump: walking off a cliff edge (to a LOWER, non-stairs cell) in `dir`. Returns landing or null.
export function findLedge(g, e, dir) {
  if (dir === 'up') return null;                 // the back side of plateaus is hidden in this projection
  const world = g.world, v = DIR_VEC[dir], fb = e.foot || FOOT;
  const lvl = e.lvl, cx = e.x, cy = centerY(e);
  const here = world.def(cellOf(cx), cellOf(cy));
  if (here.stairs) return null;
  // probe points just beyond the leading edge (both corners + middle)
  const probes = [];
  if (v.y) { const py = cy + v.y * 6; probes.push([cx - fb.hw + 1, py], [cx, py], [cx + fb.hw - 1, py]); }
  else { const px = cx + v.x * (fb.hw + 3); probes.push([px, e.y - fb.top + 1], [px, cy], [px, e.y + fb.bottom - 1]); }
  for (const [px, py] of probes) {
    const tx = cellOf(px), ty = cellOf(py);
    if (!world.inside(tx, ty)) return null;
    const d = world.def(tx, ty);
    if (d.solid || d.stairs || world.heightAt(tx, ty) >= lvl) return null;
  }
  // landing: first lower cell along the direction where the foot box fits
  const [mx, my] = probes[1];
  let tx = cellOf(mx), ty = cellOf(my);
  for (let k = 0; k < 4; k++, tx += v.x, ty += v.y) {
    if (!world.inside(tx, ty)) return null;
    const d = world.def(tx, ty), h = world.heightAt(tx, ty);
    if (h >= lvl) return null;
    if (d.solid) continue;
    const lx = v.x ? tx * TILE + 8 : e.x;
    const ly = v.y ? ty * TILE + 10 : e.y;
    const probe = { ...e, x: lx, y: ly, lvl: h, foot: fb, solid: false };
    if (!blocked(g, probe, lx, ly)) return { x: lx, y: ly, lvl: h };
  }
  return null;
}
