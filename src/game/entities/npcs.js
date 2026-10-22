// NPCs: solid, idle animation, face the player while talking, optional slow wandering.
import { Entity, makeAnim, playAnim } from './base.js';
import { TILE, rand, choice, dirFromVec, animFrame, DIR_VEC } from '../util.js';
import { move } from '../collision.js';
import { DIALOG } from '../dialog.js';

export class NPC extends Entity {
  constructor(g, spec) {
    super(g, spec.x * TILE + 8, spec.y * TILE + 12, { shadow: 5 });
    this.kind = 'npc';
    this.spec = spec;
    this.name = `npc_${spec.t}`;
    this.anim = makeAnim(g.assets, this.name);
    this.dir = spec.dir || 'down';
    this.solid = true;
    this.wander = !!spec.wander;
    this.home = { x: this.x, y: this.y };
    this.t = rand(1, 3);
    this.walking = false;
    playAnim(this.anim, 'idle', this.dir);
  }
  solidBox() { return { x: this.x - 6, y: this.y - 6, w: 12, h: 7 }; }
  hurtbox() { return { x: this.x - 6, y: this.y - 16, w: 12, h: 17 }; }
  update(dt) {
    this.anim?.update(dt);
    if (this.talking) return;
    if (!this.wander) return;
    this.t -= dt;
    if (this.walking) {
      const v = DIR_VEC[this.dir];
      const r = move(this.g, this, v.x * 22 * dt, v.y * 22 * dt);
      const far = Math.hypot(this.x - this.home.x, this.y - this.home.y) > 28;
      if (r.hitX || r.hitY || this.t <= 0 || far) {
        this.walking = false; this.t = rand(1.5, 3.5);
        if (far) this.dir = dirFromVec(this.home.x - this.x, this.home.y - this.y);
        playAnim(this.anim, 'idle', this.dir);
      }
    } else if (this.t <= 0) {
      this.walking = true; this.t = rand(0.6, 1.4);
      this.dir = Math.hypot(this.x - this.home.x, this.y - this.home.y) > 12 ? dirFromVec(this.home.x - this.x, this.home.y - this.y) : choice(['down', 'up', 'left', 'right']);
      playAnim(this.anim, 'walk', this.dir);
    }
  }
  ignoreSolid(s) { return s === this; }
  async interact(g, p) {
    const fn = DIALOG[this.spec.dialog || this.spec.t];
    const lines = typeof fn === 'function' ? fn(g, this) : fn || ['…'];
    const prev = this.dir;
    this.dir = dirFromVec(p.x - this.x, p.y - this.y, this.dir);
    playAnim(this.anim, 'idle', this.dir);
    this.talking = true;
    if (typeof lines?.then === 'function') await lines.catch(() => {});
    else await g.say(lines);
    this.talking = false;
    this.after?.(g);
    if (!this.wander) { this.dir = this.spec.dir || prev; playAnim(this.anim, 'idle', this.dir); }
  }
  draw(ctx, r) {
    const { img, flip } = animFrame(this.anim, `${this.name}_idle_down`);
    r.sprite(img, this.x, this.y, this.z, { flip });
  }
}

export function createNPC(g, spec) { return new NPC(g, spec); }
