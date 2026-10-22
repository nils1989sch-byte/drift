// Combat: hitboxes (AABB, screen-space so different heights don't collide), damage, knockback, i-frames.
import { LEVEL, overlap } from './util.js';
import { move } from './collision.js';

// Box of an entity projected to screen space (y shifted by height). Flyers include their hop.
export function screenBox(e, box) {
  const b = box || e.hurtbox();
  const zz = (e.z || 0) * LEVEL + (e.flying ? (e.hop || 0) * 0.5 : 0);
  return { x: b.x, y: b.y - zz, w: b.w, h: b.h };
}
// Same level (walkers) or flyer within reach of the other's height.
export function sameLayer(a, b) {
  if (a.flying || b.flying) return Math.abs((a.z || 0) - (b.z || 0)) <= 1.5;
  return Math.abs((a.lvl ?? 0) - (b.lvl ?? 0)) < 0.5;
}
export function hits(a, boxA, b, boxB) {
  return sameLayer(a, b) && overlap(screenBox(a, boxA), screenBox(b, boxB));
}

// Knockback state helper (ease-out). e.kb = {vx, vy, t, dur}
export function knock(e, from, power = 150, dur = 0.2) {
  let dx = e.x - from.x, dy = e.y - from.y;
  const l = Math.hypot(dx, dy) || 1;
  if (l < 0.01) { dx = 0; dy = 1; }
  e.kb = { vx: (dx / l) * power, vy: (dy / l) * power, t: dur, dur };
}
export function updateKnock(g, e, dt) {
  if (!e.kb || e.kb.t <= 0) return false;
  const k = e.kb.t / e.kb.dur;                        // 1 → 0, ease-out
  move(g, e, e.kb.vx * k * dt * 1.6, e.kb.vy * k * dt * 1.6);
  e.kb.t -= dt;
  return true;
}

// Generic damage for enemies/objects. Returns true when the hit landed.
export function damage(g, target, dmg, from, o = {}) {
  if (!target || target.dead || target.hp == null) return false;
  if ((target.iframes || 0) > 0) return false;
  if (target.canBeHit && !target.canBeHit(g, o)) { target.onBlocked?.(g, from, o); return false; }
  target.hp -= dmg;
  target.iframes = o.iframes ?? target.iframesMax ?? 0.3;
  target.flash = 0.12;
  if (!target.heavy && o.kb !== false) knock(target, from, o.kbPower ?? 170, 0.2);
  g.hitstop = Math.max(g.hitstop, 0.05);
  g.spawnFX('spark', (target.x + from.x) / 2, target.y - 8, { z: target.z });
  g.play(target.hp <= 0 ? 'enemy_die' : 'enemy_hit');
  target.onDamage?.(g, dmg, from, o);
  if (target.hp <= 0) target.die?.(g, o);
  return true;
}
