// Visible wild monsters roaming their habitats + spawners (time-of-day aware), and the companion monster.
import { Entity, makeAnim, playAnim } from '../entities/base.js';
import { move, cellOf } from '../collision.js';
import { animFrame, rand, choice, dirFromVec, DIR_VEC, TILE, chance } from '../util.js';
import { Monster } from './monster.js';
import { SPECIES } from './species.js';

const FLYERS = new Set(['boeli', 'sturmfalk', 'zappi']);

export class WildMon extends Entity {
  constructor(g, id, level, x, y, o = {}) {
    super(g, x, y, { shadow: 5 });
    this.kind = 'wild';
    this.mon = new Monster(id, level);
    this.anim = makeAnim(g.assets, 'mon_' + id);
    this.dir = choice(['down', 'left', 'right', 'up']);
    this.home = { x, y }; this.roam = o.roam ?? 40;
    this.state = 'idle'; this.t = rand(0.5, 2);
    this.spawner = o.spawner || null;
    this.avoidPits = true; this.avoidWater = !(SPECIES[id]?.types.includes('water'));
    this.calm = 1.2;           // seconds before it may engage
    this.flyer = FLYERS.has(id);
    this.boss = !!o.boss;
    this.r = Math.max(6, Math.round((SPECIES[id]?.size || 24) * 0.32));
    if (this.boss) { this.calm = 0; this.roam = 0; this.foot = { hw: 10, top: 6, bottom: 2 }; this.shadow = 14; }
  }
  hurtbox() { return { x: this.x - this.r, y: this.y - this.r * 2, w: this.r * 2, h: this.r * 2 }; }
  update(dt) {
    const g = this.g, p = g.player;
    this.anim?.update(dt);
    if (this.hidden) return;
    if (this.calm > 0) this.calm -= dt;
    this.t -= dt;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    const canFight = !g.battle?.active && g.party?.lead && (g.battleCooldown || 0) <= 0 && p.state === 'normal' && p.lvl === this.lvl && !g.trans;
    if (this.boss) {
      playAnim(this.anim, 'idle', 'down');
      if (canFight && d < 70) g.engageWild(this);
      return;
    }
    if (this.state === 'notice') {
      this.hop = Math.max(0, Math.sin((1 - this.t / 0.45) * Math.PI) * 5);
      if (this.t <= 0) { this.hop = 0; this.state = 'chase'; this.t = 3; }
    } else if (this.state === 'chase') {
      if (!canFight) { this.state = 'idle'; this.t = 1; }
      else {
        const ux = (p.x - this.x) / (d || 1), uy = (p.y - this.y) / (d || 1);
        this.dir = dirFromVec(ux, uy, this.dir);
        move(g, this, ux * 55 * dt, uy * 55 * dt, { slide: true });
        playAnim(this.anim, 'walk', this.dir);
        if (d < 22) { g.engageWild(this); return; }
        if (this.t <= 0 || d > 110) { this.state = 'idle'; this.t = 1.5; }
      }
    } else if (this.state === 'walk') {
      const v = DIR_VEC[this.dir];
      const r = move(g, this, v.x * 26 * dt, v.y * 26 * dt);
      playAnim(this.anim, 'walk', this.dir);
      const far = Math.hypot(this.x - this.home.x, this.y - this.home.y) > this.roam;
      if (r.hitX || r.hitY || this.t <= 0 || far) {
        this.state = 'idle'; this.t = rand(0.8, 2.4);
        if (far) this.dir = dirFromVec(this.home.x - this.x, this.home.y - this.y);
      }
    } else {
      playAnim(this.anim, 'idle', this.dir);
      if (this.t <= 0) { this.state = 'walk'; this.t = rand(0.6, 1.6); this.dir = choice(['down', 'left', 'right', 'up']); }
    }
    if (this.flyer && this.state !== 'notice') this.hop = 6 + Math.sin(g.mapTime * 6 + this.home.x) * 2;
    // notice the player
    if (canFight && this.calm <= 0 && (this.state === 'idle' || this.state === 'walk') && d < 56) {
      this.state = 'notice'; this.t = 0.45;
      this.dir = dirFromVec(p.x - this.x, p.y - this.y, this.dir);
      g.spawnFX('text', this.x, this.y - this.r * 2 - 6, { z: this.z, text: '!', color: '#f8d850', life: 0.6 });
      g.play('notice');
    } else if (!g.party?.lead && d < 40 && !g.battle?.active) g.hint('nomon', 'Ohne eigenes Monster solltest du wilden Monstern lieber aus dem Weg gehen …', 8);
  }
  draw(ctx, r) {
    if (this.hidden) return;
    const { img, flip } = animFrame(this.anim, `mon_${this.mon.id}_idle_${this.dir}`);
    r.sprite(img, this.x, this.y, this.z, { hop: this.hop, flip });
  }
}

// Spawner: { area:[x0,y0,x1,y1], tiles?:[tileIds], species:[[id, weight]], level:[a,b], max, time?:'day'|'night'|'any', every? }
export function createSpawner(g, spec) {
  const S = { spec, list: [], t: 0 };
  const hour = () => g.clock?.hours ?? 12;
  const isNight = () => { const h = hour(); return h >= 20 || h < 6; };
  const timeOk = (sid) => {
    const t = spec.time || SPECIES[sid]?.time || 'any';
    return t === 'any' || (t === 'night' ? isNight() : !isNight());
  };
  function pickSpecies() {
    const opts = spec.species.filter(([id]) => timeOk(id));
    if (!opts.length) return null;
    let total = opts.reduce((s, [, w]) => s + (w || 1), 0), r = Math.random() * total;
    for (const [id, w] of opts) { r -= w || 1; if (r <= 0) return id; }
    return opts[0][0];
  }
  function spawnOne(farFromPlayer = true) {
    const id = pickSpecies();
    if (!id) return null;
    const [x0, y0, x1, y1] = spec.area, w = g.world, p = g.player;
    for (let k = 0; k < 20; k++) {
      const tx = x0 + Math.floor(Math.random() * (x1 - x0 + 1)), ty = y0 + Math.floor(Math.random() * (y1 - y0 + 1));
      const d = w.def(tx, ty);
      if (d.solid || d.pit || (d.shallow && !SPECIES[id].types.includes('water'))) continue;
      if (spec.tiles && !spec.tiles.includes(w.tileAt(tx, ty))) continue;
      if (spec.lvl != null && w.heightAt(tx, ty) !== spec.lvl) continue;
      const px = tx * TILE + 8, py = ty * TILE + 10;
      if (farFromPlayer && Math.hypot(px - p.x, py - p.y) < 90) continue;
      if (g.solids.some((s) => s.solid && !s.dead && s.lvl === w.heightAt(tx, ty) && px > s.solidBox().x - 6 && px < s.solidBox().x + s.solidBox().w + 6 && py > s.solidBox().y - 2 && py < s.solidBox().y + s.solidBox().h + 6)) continue;
      const [a, b] = spec.level || [2, 5];
      const m = new WildMon(g, id, a + Math.floor(Math.random() * (b - a + 1)), px, py, { spawner: S });
      S.list.push(m);
      g.wilds.push(m);
      return m;
    }
    return null;
  }
  S.fill = () => { for (let i = 0; i < (spec.max || 2); i++) spawnOne(false); };
  S.update = (dt) => {
    S.list = S.list.filter((m) => !m.dead);
    // time of day: night monsters vanish in the morning and vice versa (when off-screen-ish)
    for (const m of S.list) if (!timeOk(m.mon.id) && Math.hypot(m.x - g.player.x, m.y - g.player.y) > 120 && !m.hidden) m.dead = true;
    S.t -= dt;
    if (S.t <= 0) { S.t = spec.every ?? 18; if (S.list.length < (spec.max || 2)) spawnOne(true); }
  };
  return S;
}

// Companion: the lead monster follows the player on the overworld (no fighting).
export class Companion extends Entity {
  constructor(g) {
    super(g, g.player.x, g.player.y + 12, { lvl: g.player.lvl, shadow: 5 });
    this.kind = 'companion';
    this.trail = [];
    this.monId = null; this.anim = null; this.dir = 'down';
    this.noSolids = true;
  }
  sync() {
    const lead = this.g.party?.lead;
    const id = lead?.id || null;
    if (id !== this.monId) { this.monId = id; this.anim = id ? makeAnim(this.g.assets, 'mon_' + id) : null; }
    return lead;
  }
  reset() { const p = this.g.player; this.trail = []; this.x = p.x; this.y = p.y + 10; this.lvl = p.lvl; this.z = p.z; }
  update(dt) {
    const g = this.g, p = g.player;
    const lead = this.sync();
    if (!lead || g.battle?.active) { this.hidden = true; return; }
    if (this.hidden && !g.battle?.active) { this.hidden = false; this.reset(); }
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 2) this.trail.push({ x: p.x, y: p.y, lvl: p.lvl, z: p.z });
    if (this.trail.length > 60) this.trail.shift();
    const target = this.trail.length > 10 ? this.trail[this.trail.length - 11] : null;
    let moving = false;
    if (target) {
      const dx = target.x - this.x, dy = target.y - this.y, d = Math.hypot(dx, dy);
      if (d > 1 && Math.hypot(p.x - this.x, p.y - this.y) > 16) {
        const sp = Math.min(d, (d > 40 ? 160 : 90) * dt);
        this.x += (dx / d) * sp; this.y += (dy / d) * sp; this.lvl = target.lvl; this.z += (target.z - this.z) * Math.min(1, dt * 10);
        this.dir = dirFromVec(dx, dy, this.dir); moving = true;
      }
    }
    if (Math.hypot(p.x - this.x, p.y - this.y) > 120) this.reset();
    playAnim(this.anim, moving ? 'walk' : 'idle', this.dir);
    this.anim?.update(dt);
  }
  draw(ctx, r) {
    if (this.hidden || !this.monId) return;
    const { img, flip } = animFrame(this.anim, `mon_${this.monId}_idle_${this.dir}`);
    r.sprite(img, this.x, this.y, this.z, { flip });
  }
}
