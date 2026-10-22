// Base entity (Drawable): x,y = foot point, lvl = logical height level, z = visual height, hop = jump px.
import { FOOT, levelUnder, visualZ } from '../collision.js';

export class Entity {
  constructor(g, x, y, o = {}) {
    this.g = g;
    this.x = x; this.y = y;
    this.lvl = o.lvl ?? levelUnder(g.world, this);
    this.z = this.lvl;
    this.hop = 0;
    this.dead = false;
    this.shadow = o.shadow ?? 6;
    this.foot = o.foot || FOOT;
    this.flash = 0;
    this.iframes = 0;
    this.kind = 'entity';
  }
  get tx() { return Math.floor(this.x / 16); }
  get ty() { return Math.floor((this.y - 2) / 16); }
  syncZ() { if (!this.flying) this.z = visualZ(this.g.world, this.x, this.y, this.lvl); }
  hurtbox() { return { x: this.x - 6, y: this.y - 13, w: 12, h: 14 }; }
  update() {}
  draw() {}
}

import * as Anim from '../../anim/index.js';
// Animator from the animation agent; never throws (stubs or missing assets → null / placeholder).
export function makeAnim(assets, name) {
  try { return typeof Anim.Animator === 'function' ? new Anim.Animator(assets, name) : null; }
  catch (e) { console.warn('[game] Animator failed for', name, e); return null; }
}
export function playAnim(anim, action, dir, o) { try { anim?.play(action, dir, o); } catch { /* ignore */ } }
