// Trainer NPCs (Ranger): spot the player, walk up, talk, battle with their team. Beaten → flag, normal NPC.
import { NPC } from '../entities/npcs.js';
import { makeAnim, playAnim } from '../entities/base.js';
import { move, cellOf } from '../collision.js';
import { animFrame, dirFromVec, DIR_VEC, TILE } from '../util.js';
import { Monster } from './monster.js';

export class Trainer extends NPC {
  constructor(g, spec) {
    super(g, { ...spec, t: spec.sprite || 'ranger' });
    this.kind = 'npc';
    this.trainer = true;
    this.name = spec.animName || 'soldier';
    this.anim = makeAnim(g.assets, this.name);
    this.flag = spec.flag;
    this.state = 'watch';
    this.dir = spec.dir || 'down';
    this.sightRange = spec.sight ?? 80;
    playAnim(this.anim, 'idle', this.dir);
  }
  get beaten() { return !!this.g.flags[this.flag]; }
  sees(p) {
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy);
    if (d > this.sightRange || p.lvl !== this.lvl) return false;
    const v = DIR_VEC[this.dir];
    if ((dx * v.x + dy * v.y) / (d || 1) < 0.6) return false;
    const w = this.g.world, n = Math.ceil(d / 8);
    for (let i = 1; i < n; i++) {
      const x = this.x + (dx * i) / n, y = this.y - 2 + (dy * i) / n;
      const tx = cellOf(x), ty = cellOf(y);
      if (w.heightAt(tx, ty) !== this.lvl || w.def(tx, ty).solid) return false;
    }
    return true;
  }
  update(dt) {
    const g = this.g, p = g.player;
    this.anim?.update(dt);
    if (this.state === 'approach') { this.approach(dt); return; }
    if (this.talking || this.beaten || !g.party?.lead) return;
    if (g.battle?.active || g.trans || p.state !== 'normal') return;
    if (this.state === 'watch') {
      if (this.sees(p)) { this.state = 'approach'; g.spawnFX('text', this.x, this.y - 30, { z: this.z, text: '!', color: '#f8d850', life: 0.7 }); g.play('notice'); p.state = 'frozen'; this.t = 0.5; }
    }
  }
  // driven from game.update while the player is frozen
  approach(dt) {
    const g = this.g, p = g.player;
    if (this.t > 0) { this.t -= dt; return; }
    const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy);
    this.dir = dirFromVec(dx, dy, this.dir);
    if (d > 22) { const r = move(g, this, (dx / d) * 70 * dt, (dy / d) * 70 * dt, { slide: true }); playAnim(this.anim, 'walk', this.dir); if (r.moved < 0.01) this.stuck = (this.stuck || 0) + dt; if ((this.stuck || 0) < 0.6) return; }
    playAnim(this.anim, 'idle', this.dir);
    this.state = 'talk';
    this.challenge();
  }
  async challenge() {
    const g = this.g, p = g.player;
    p.dir = dirFromVec(this.x - p.x, this.y - p.y, p.dir);
    this.talking = true;
    await g.say(this.spec.intro || [`${this.spec.name || 'Ranger'}: Halt! Zeig mir, was deine Monster können!`], { speaker: this.spec.name });
    this.talking = false;
    const team = (this.spec.team || [['boeli', 4]]).map(([id, lv]) => new Monster(id, lv));
    p.state = 'normal';
    g.battle.start({ trainer: this, team, x: this.x, y: this.y, onEnd: async (res) => {
      if (res === 'won') {
        g.setFlag(this.flag, true);
        const money = this.spec.reward ?? 60;
        g.inventory?.addMoney?.(money);
        await g.say([...(this.spec.lose || [`${this.spec.name || 'Ranger'}: Nicht schlecht! Du hast es dir verdient.`]), `Du erhältst ${money} Taler.`], { speaker: this.spec.name });
      }
      this.state = 'watch';
    } });
    this.state = this.beaten ? 'done' : 'cool';
    this.coolT = 0;
  }
  async interact(g, p) {
    this.dir = dirFromVec(p.x - this.x, p.y - this.y, this.dir);
    playAnim(this.anim, 'idle', this.dir);
    if (this.beaten) { this.talking = true; await g.say(this.spec.after || ['Ranger: Pass gut auf deine Monster auf!'], { speaker: this.spec.name }); this.talking = false; return; }
    if (!g.party?.lead) { this.talking = true; await g.say(['Ranger: Ohne Monster kann ich dich nicht herausfordern. Geh zu Bodo!'], { speaker: this.spec.name }); this.talking = false; return; }
    this.challenge();
  }
  draw(ctx, r) {
    const { img, flip } = animFrame(this.anim, 'soldier_walk_' + this.dir);
    r.sprite(img, this.x, this.y, this.z, { flip });
  }
}
