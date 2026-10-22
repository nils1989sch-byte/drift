// Projectiles: octorok rocks, golem boulders, falling rocks, thrown bushes/pots/rocks/bombs.
import { Entity } from './base.js';
import { spriteFrame, TILE, chance } from '../util.js';
import { hits } from '../combat.js';
import { damage } from '../combat.js';

export class Projectile extends Entity {
  constructor(g, o) {
    super(g, o.x, o.y, { lvl: o.lvl, shadow: o.shadow ?? 3 });
    this.kind = 'projectile';
    this.z = o.z ?? this.lvl;
    this.owner = o.owner || 'enemy';
    this.vx = o.vx || 0; this.vy = o.vy || 0;
    this.dmg = o.dmg ?? 1;
    this.sprite = o.sprite || 'octorok_rock';
    this.life = o.life ?? 2;
    this.hop = o.hop ?? 6;
    this.vz = o.vz ?? 0;              // vertical speed for arcs (thrown)
    this.grav = o.grav ?? 0;
    this.size = o.size ?? 4;
    this.fxOnHit = o.fxOnHit || 'spark';
    this.onEnd = o.onEnd;
    this.carryObj = o.carryObj;       // thrown object spec
    this.flying = false;
    this.t = 0;
    this.deflectable = o.deflectable ?? (this.owner === 'enemy');
  }
  hurtbox() { const s = this.size; return { x: this.x - s, y: this.y - s * 2, w: s * 2, h: s * 2 }; }
  end(how) {
    if (this.dead) return;
    this.dead = true;
    if (this.onEnd) this.onEnd(this.g, this, how);
    else this.g.spawnFX(this.fxOnHit, this.x, this.y - 4, { z: this.z, hop: this.hop });
  }
  update(dt) {
    const g = this.g;
    this.t += dt;
    this.life -= dt;
    if (this.grav) {
      this.vz -= this.grav * dt;
      this.hop += this.vz * dt;
      if (this.hop <= 0) {
        // fell past a ledge? keep falling to the lower ground
        const h = this.g.world.heightAtPx(this.x, this.y - 2);
        if (h < this.lvl) { this.hop += (this.lvl - h) * 16; this.lvl = h; this.z = h; }
        else { this.hop = 0; this.end('land'); return; }
      }
    }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    // terrain: walls and higher cells stop it; water/lower ground is flown over
    const tx = Math.floor(nx / TILE), ty = Math.floor((ny - 2) / TILE);
    const w = g.world;
    if (!w.inside(tx, ty) || (w.def(tx, ty).solid && !w.def(tx, ty).water) || w.heightAt(tx, ty) > this.lvl + 0.01) { this.x = nx; this.y = ny; this.end('wall'); return; }
    this.x = nx; this.y = ny;
    // solid objects at this level
    const hb = this.hurtbox();
    for (const s of g.solids) {
      if (!s.solid || s.dead || s.carried || s === this.carryObj) continue;
      if (s.lvl !== -1 && Math.abs(s.lvl - this.lvl) > 0.5) continue;
      const b = s.solidBox();
      if (hb.x < b.x + b.w && hb.x + hb.w > b.x && this.y - 2 < b.y + b.h && this.y > b.y) {
        if (this.owner === 'player' && s.lift && s.type !== 'rock' && s.destroy) s.destroy(g, 'hit');
        this.end('wall'); return;
      }
    }
    if (this.owner === 'enemy') {
      const p = g.player;
      if (p.canBeHit() && hits(this, null, p, p.hurtbox())) { p.hurt(this.dmg, this); this.end('hit'); return; }
    } else {
      for (const e of g.enemies) {
        if (e.dead) continue;
        if (hits(this, null, e, null)) {
          damage(g, e, this.dmg, this, { kind: 'throw' });
          this.end('hit'); return;
        }
      }
    }
    if (this.life <= 0) this.end('timeout');
  }
  draw(ctx, r) {
    const img = spriteFrame(r.assets, this.sprite, r.time, 12);
    r.sprite(img, this.x, this.y, this.z, { hop: this.hop });
  }
}

// Rock falling from the ceiling: shadow grows, then impact.
export class FallingRock extends Entity {
  constructor(g, x, y, o = {}) {
    super(g, x, y, { lvl: o.lvl, shadow: false });
    this.kind = 'projectile';
    this.t = 0; this.dur = o.dur ?? 1.0;
    this.hop = 160;
  }
  update(dt) {
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    this.hop = 160 * (1 - k * k);
    if (k >= 1) {
      this.dead = true;
      const g = this.g, p = g.player;
      g.spawnFX('rock', this.x, this.y - 4, { z: this.z });
      g.spawnFX('dust', this.x, this.y, { z: this.z });
      g.play('rock_land');
      if (p.canBeHit() && Math.hypot(p.x - this.x, p.y - this.y) < 11 && p.lvl === this.lvl) p.hurt(2, this);
    }
  }
  draw(ctx, r) {
    const k = Math.min(1, this.t / this.dur);
    r.shadow(this.x, this.y, this.z, 2 + k * 6, undefined, 0.15 + k * 0.25);
    const img = spriteFrame(r.assets, 'rock', 0);
    r.sprite(img, this.x, this.y, this.z, { hop: this.hop });
  }
}

// What a thrown object turns into.
export function throwObject(g, p, carry) {
  const v = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[p.dir];
  const spd = 170;
  const kind = carry.type;
  if (kind === 'bomb') {
    // thrown bomb: arcs, then lands and keeps ticking
    const b = carry.obj;
    return new Projectile(g, {
      x: p.x + v[0] * 4, y: p.y + v[1] * 4, lvl: p.lvl, z: p.z, owner: 'player', vx: v[0] * 130, vy: v[1] * 130,
      sprite: 'bomb', hop: 18, vz: 40, grav: 300, life: 3, dmg: 0, shadow: 4, carryObj: b,
      onEnd: (gg, pr) => { b.carried = false; b.dead = false; b.x = pr.x; b.y = pr.y; b.lvl = pr.lvl; b.z = pr.z; b.hop = 0; if (!gg.objects.includes(b)) gg.objects.push(b); },
    });
  }
  const fx = carry.def?.fx || 'poof';
  return new Projectile(g, {
    x: p.x + v[0] * 4, y: p.y + v[1] * 4, lvl: p.lvl, z: p.z, owner: 'player', vx: v[0] * spd, vy: v[1] * spd,
    sprite: carry.sprite, hop: 18, vz: 30, grav: 260, life: 3, dmg: carry.def?.dmg ?? 1, size: 6, shadow: 5,
    onEnd: (gg, pr) => {
      gg.spawnFX(fx, pr.x, pr.y - 4, { z: pr.z });
      if (kind === 'bush') gg.spawnFX('leaves', pr.x, pr.y - 4, { z: pr.z });
      gg.play(kind === 'bush' ? 'cut' : 'break');
      if (kind === 'pot' && chance(0.3)) gg.dropLoot(pr.x, pr.y, pr.lvl, 'small');
    },
  });
}
