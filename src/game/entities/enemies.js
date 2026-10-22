// Enemies with distinct AI: Octorok (wanders, spits rocks), Soldier (patrols, chases on sight),
// Slime (hops towards the player), Bat (zig-zag flight, ignores cliffs). Boss lives in boss.js.
import { Entity, makeAnim, playAnim } from './base.js';
import { TILE, DIR_VEC, rand, choice, chance, dirFromVec, animFrame, clamp } from '../util.js';
import { move, cellOf, centerY } from '../collision.js';
import { hits, updateKnock } from '../combat.js';
import { Projectile } from './projectiles.js';

const DIRS = ['down', 'up', 'left', 'right'];

export class Enemy extends Entity {
  constructor(g, spec, o) {
    super(g, spec.px ?? spec.x * TILE + 8, spec.py ?? spec.y * TILE + 12, { shadow: o.shadow ?? 5 });
    this.kind = 'enemy';
    this.spec = spec;
    this.name = o.name;
    this.hp = this.maxHp = o.hp;
    this.dmg = o.dmg ?? 1;
    this.speed = o.speed ?? 40;
    this.anim = makeAnim(g.assets, o.name);
    this.dir = spec.dir || 'down';
    this.state = 'idle';
    this.t = rand(0.2, 1);
    this.avoidPits = true;
    this.iframesMax = 0.35;
    this.home = { x: this.x, y: this.y };
    this.loot = o.loot ?? 'enemy';
    this.action = 'walk';
  }
  setAnim(action, dir = this.dir, o) { this.action = action; playAnim(this.anim, action, dir, o); }
  distTo(p) { return Math.hypot(p.x - this.x, p.y - this.y); }
  canSee(p, range) {
    if (p.lvl !== this.lvl || this.distTo(p) > range) return false;
    const w = this.g.world, n = Math.ceil(this.distTo(p) / 8);
    for (let i = 1; i < n; i++) {
      const x = this.x + ((p.x - this.x) * i) / n, y = this.y - 2 + ((p.y - this.y) * i) / n;
      const tx = cellOf(x), ty = cellOf(y);
      if (w.heightAt(tx, ty) > this.lvl || (w.def(tx, ty).solid && !w.def(tx, ty).water)) return false;
    }
    return true;
  }
  update(dt) {
    const g = this.g;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.flash > 0) this.flash -= dt;
    this.t -= dt;
    const knocked = this.kb && this.kb.t > 0;
    if (knocked) { this.avoidPits = false; updateKnock(g, this, dt); this.avoidPits = !this.flying; }
    else this.ai(dt);
    this.syncZ();
    this.anim?.update(dt);
    if (!this.flying && g.world.def(cellOf(this.x), cellOf(centerY(this))).pit) { this.fallIn(); return; }
    const p = g.player;
    if (this.dmg && !this.harmless && p.canBeHit() && hits(this, this.hurtbox(), p, p.hurtbox())) p.hurt(this.dmg, this);
  }
  fallIn() {
    this.dead = true;
    this.g.spawnFX('poof', this.x, this.y - 2, { z: this.z });
    this.g.play('fall');
  }
  die(g) {
    this.dead = true;
    g.spawnFX('poof', this.x, this.y - 6, { z: this.z, hop: this.hop });
    g.dropLoot(this.x, this.y, this.lvl, this.loot);
  }
  ai() {}
  frameKey() { return `${this.name}_walk_${this.dir}`; }
  draw(ctx, r) {
    const { img, flip } = animFrame(this.anim, this.frameKey());
    r.sprite(img, this.x, this.y, this.z, { hop: this.hop, flip, flash: this.flash > 0 || (this.iframes > 0 && Math.floor(this.iframes * 20) % 2 === 0) });
  }
}

export class Octorok extends Enemy {
  constructor(g, spec) { super(g, spec, { name: 'octorok', hp: 2, dmg: 1, speed: 34 }); this.state = 'pause'; this.foot = { hw: 5, top: 5, bottom: 1 }; this.avoidWater = false; }
  hurtbox() { return { x: this.x - 7, y: this.y - 12, w: 14, h: 13 }; }
  ai(dt) {
    const p = this.g.player;
    if (this.state === 'walk') {
      const v = DIR_VEC[this.dir];
      const r = move(this.g, this, v.x * this.speed * dt, v.y * this.speed * dt);
      if (r.hitX || r.hitY) this.dir = choice(DIRS.filter((d) => d !== this.dir));
      this.setAnim('walk');
      if (this.t <= 0) { this.state = 'pause'; this.t = rand(0.35, 0.8); this.setAnim('idle'); }
    } else if (this.state === 'pause') {
      if (this.t <= 0) {
        const dx = p.x - this.x, dy = p.y - this.y;
        const aligned = (Math.abs(dx) < 12 || Math.abs(dy) < 12) && Math.hypot(dx, dy) < 128 && p.lvl === this.lvl;
        if (aligned && chance(0.75)) { this.dir = dirFromVec(dx, dy); this.shoot(); }
        else if (chance(0.25) && Math.hypot(dx, dy) < 140) this.shoot();
        else { this.state = 'walk'; this.t = rand(0.6, 1.6); this.dir = choice(DIRS); }
      }
    } else if (this.state === 'shoot') {
      if (!this.fired && this.t < 0.28) {
        this.fired = true;
        const v = DIR_VEC[this.dir];
        this.g.spawn(new Projectile(this.g, { x: this.x + v.x * 9, y: this.y + v.y * 8 + (v.y < 0 ? -2 : 0), lvl: this.lvl, z: this.z, vx: v.x * 120, vy: v.y * 120, sprite: 'octorok_rock', dmg: 1, hop: 6, life: 1.6, fxOnHit: 'rock' }));
        this.g.play('octorok_shoot');
      }
      if (this.t <= 0) { this.state = 'walk'; this.t = rand(0.5, 1.2); this.dir = chance(0.5) ? this.dir : choice(DIRS); }
    }
  }
  shoot() { this.state = 'shoot'; this.t = 0.5; this.fired = false; this.setAnim('attack', this.dir, { restart: true }); }
}

export class Soldier extends Enemy {
  constructor(g, spec) {
    super(g, spec, { name: 'soldier', hp: 3, dmg: 2, speed: 30 });
    this.patrol = (spec.patrol || [[spec.x, spec.y]]).map(([x, y]) => ({ x: x * TILE + 8, y: y * TILE + 12 }));
    this.wp = 0; this.state = 'patrol'; this.lost = 0;
  }
  hurtbox() { return { x: this.x - 6, y: this.y - 18, w: 12, h: 19 }; }
  sees(p) {
    if (p.state === 'dead') return false;
    const d = this.distTo(p);
    if (!this.canSee(p, 100)) return false;
    if (d < 36) return true;
    const v = DIR_VEC[this.dir];
    return ((p.x - this.x) * v.x + (p.y - this.y) * v.y) / (d || 1) > 0.35;
  }
  ai(dt) {
    const g = this.g, p = g.player;
    if (this.state === 'patrol') {
      const t = this.patrol[this.wp];
      const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy);
      if (this.t > 0) { this.setAnim('idle'); if (this.t < 0.3 && this.patrol.length < 2) this.dir = choice(DIRS); }
      else if (d < 2) { this.wp = (this.wp + 1) % this.patrol.length; this.t = rand(0.5, 1.1); }
      else {
        this.dir = dirFromVec(dx, dy, this.dir);
        const r = move(g, this, (dx / d) * this.speed * dt, (dy / d) * this.speed * dt, { slide: true });
        if (r.moved < 0.05) { this.wp = (this.wp + 1) % this.patrol.length; this.t = 0.4; }
        this.setAnim('walk');
      }
      if (this.sees(p)) { this.state = 'alert'; this.t = 0.4; this.dir = dirFromVec(p.x - this.x, p.y - this.y); this.hop = 0; g.play('alert'); }
    } else if (this.state === 'alert') {
      this.hop = Math.sin((1 - this.t / 0.4) * Math.PI) * 5;
      this.setAnim('idle');
      if (this.t <= 0) { this.hop = 0; this.state = 'chase'; this.lost = 0; }
    } else if (this.state === 'chase') {
      const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
      this.dir = dirFromVec(dx, dy, this.dir);
      const sp = 54;
      move(g, this, (dx / d) * sp * dt, (dy / d) * sp * dt, { slide: true });
      this.setAnim(d < 24 ? 'attack' : 'walk');
      if (!this.canSee(p, 150) || p.state === 'dead') this.lost += dt; else this.lost = 0;
      if (this.lost > 2.5) { this.state = 'patrol'; this.t = 0.8; }
    }
  }
}

export class Slime extends Enemy {
  constructor(g, spec) { super(g, spec, { name: 'slime', hp: 1, dmg: 1, shadow: 5 }); this.state = 'idle'; this.t = rand(0.3, 1.2); }
  hurtbox() { return { x: this.x - 6, y: this.y - 9, w: 12, h: 10 }; }
  frameKey() { return 'slime_idle'; }
  ai(dt) {
    const g = this.g, p = g.player;
    if (this.state === 'idle') {
      this.setAnim('idle');
      if (this.t <= 0) {
        let dx = rand(-1, 1), dy = rand(-1, 1);
        if (p.lvl === this.lvl && this.distTo(p) < 110 && p.state !== 'dead') { dx = p.x - this.x; dy = p.y - this.y; }
        const d = Math.hypot(dx, dy) || 1;
        this.vx = (dx / d) * 72; this.vy = (dy / d) * 72;
        this.state = 'hop'; this.t = 0.42;
        g.play('slime_hop');
      }
    } else if (this.state === 'hop') {
      const k = 1 - this.t / 0.42;
      this.hop = Math.sin(k * Math.PI) * 7;
      move(g, this, this.vx * dt, this.vy * dt);
      this.setAnim('walk');
      if (this.t <= 0) { this.hop = 0; this.state = 'idle'; this.t = rand(0.5, 1.1); }
    }
  }
}

export class Bat extends Enemy {
  constructor(g, spec) {
    super(g, spec, { name: 'bat', hp: 1, dmg: 1, shadow: 4 });
    this.flying = true; this.avoidPits = false; this.noSolids = true;
    this.state = 'perch'; this.hop = 2; this.phase = rand(0, 6);
    this.foot = { hw: 4, top: 4, bottom: 1 };
  }
  hurtbox() { return { x: this.x - 7, y: this.y - 9, w: 14, h: 9 }; }
  frameKey() { return 'bat_fly'; }
  ai(dt) {
    const g = this.g, p = g.player;
    const w = g.world;
    const groundZ = w.heightAt(cellOf(this.x), cellOf(this.y - 2));
    this.z += (groundZ - this.z) * Math.min(1, dt * 5);
    this.lvl = Math.round(this.z);
    this.phase += dt;
    this.setAnim('fly');
    if (this.state === 'perch') {
      this.hop = Math.max(2, this.hop - dt * 30);
      if (this.distTo(p) < 72 && p.state !== 'dead') { this.state = 'fly'; this.t = rand(2.2, 3.2); g.play('bat'); }
      return;
    }
    let dx = p.x - this.x, dy = p.y - this.y;
    if (this.state === 'away') { dx = -dx; dy = -dy; }
    const d = Math.hypot(dx, dy) || 1;
    const zig = Math.sign(Math.sin(this.phase * 4.5)) * 55;
    const vx = (dx / d) * 52 + (-dy / d) * zig, vy = (dy / d) * 52 + (dx / d) * zig;
    const r = move(g, this, vx * dt, vy * dt);
    if (r.hitX || r.hitY) this.phase += 0.7;
    this.hop = 12 + Math.sin(this.phase * 9) * 2;
    if (this.t <= 0) {
      if (this.state === 'fly') { this.state = 'away'; this.t = rand(0.8, 1.3); }
      else { this.state = 'fly'; this.t = rand(2, 3); }
    }
  }
  // bats override syncZ (handled in ai)
  syncZ() {}
}

