// Pickups: hearts, rupees, keys, bombs, heart containers, the crystal. Pop out with a small hop.
import { Entity } from './base.js';
import { spriteFrame } from '../util.js';

export const PICKUPS = {
  heart:      { sprite: 'heart_pickup', life: 12 },
  rupee:      { sprite: 'rupee_green', value: 1, life: 12 },
  rupee5:     { sprite: 'rupee_blue', value: 5, life: 12 },
  rupee20:    { sprite: 'rupee_red', value: 20, life: 14 },
  key:        { sprite: 'key_small', life: Infinity },
  bombs:      { sprite: 'bomb', value: 4, life: 12 },
  heart_container: { sprite: 'heart_container', life: Infinity, big: true },
  crystal:    { sprite: 'crystal', life: Infinity, big: true },
};

export class Pickup extends Entity {
  constructor(g, type, x, y, o = {}) {
    super(g, x, y, { lvl: o.lvl, shadow: 3 });
    this.kind = 'pickup';
    this.type = type;
    this.def = PICKUPS[type] || PICKUPS.rupee;
    this.life = o.life ?? this.def.life;
    this.vz = o.pop === false ? 0 : 90;      // hop velocity (px/s)
    this.hop = o.pop === false ? 0 : 1;
    this.t = 0;
    this.flag = o.flag;
    this.vx = o.vx || 0; this.vy = o.vy || 0;
    this.shadow = this.def.big ? 6 : 3;
  }
  update(dt) {
    this.t += dt;
    if (this.vz || this.hop > 0) {
      this.vz -= 400 * dt;
      this.hop = Math.max(0, this.hop + this.vz * dt);
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.hop === 0) { this.vz = this.vz < -60 ? -this.vz * 0.35 : 0; if (!this.vz) { this.vx = this.vy = 0; } }
    }
    if (this.def.big) this.hop = Math.max(this.hop, 2 + Math.sin(this.t * 3) * 2);
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx, r) {
    if (this.life < 3 && Math.floor(this.life * 10) % 2 === 0) return;
    const img = spriteFrame(r.assets, this.def.sprite, r.time + this.x * 0.01, 6);
    r.sprite(img, this.x, this.y, this.z, { hop: this.hop });
  }
}
