// Boss: Stein-Golem. Pattern: walk → throw boulders → 2–3 stomping leaps (shockwave + falling rocks)
// → tired phase (core exposed, only now the sword hurts). Bombs always hurt a little.
import { Enemy } from './enemies.js';
import { Projectile, FallingRock } from './projectiles.js';
import { rand, choice, animFrame, TILE } from '../util.js';
import { move } from '../collision.js';

export class Golem extends Enemy {
  constructor(g, spec) {
    super(g, spec, { name: 'boss_golem', hp: 12, dmg: 1, shadow: 14, loot: null });
    this.heavy = true;
    this.boss = true;
    this.foot = { hw: 11, top: 8, bottom: 2 };
    this.state = 'sleep'; this.t = 0;
    this.iframesMax = 0.45;
    this.queue = [];
    this.awake = 0;
  }
  hurtbox() { return { x: this.x - 14, y: this.y - 30, w: 28, h: 31 }; }
  canBeHit(g, o = {}) {
    if (this.state === 'dying' || this.state === 'sleep' || this.state === 'roar') return false;
    return this.state === 'tired' || o.kind === 'bomb';
  }
  onBlocked(g, from, o) {
    if (this.state === 'dying') return;
    if (this._tink > 0) return;
    this._tink = 0.25;
    g.play('tink');
    g.spawnFX('spark', (this.x + from.x) / 2, this.y - 14, { z: this.z });
    if (from === g.player) g.player.knockBack?.(this, 120);
  }
  onDamage(g, dmg, from, o) {
    g.shake(2, 0.15);
    if (this.state === 'tired' && ++this.tiredHits >= 3) this.next();
    if (o.kind === 'bomb' && this.state !== 'tired' && this.hp > 0) { this.state = 'tired'; this.t = 2.2; this.tiredHits = 0; this.setAnim('hurt'); }
  }
  die(g) {
    this.state = 'dying'; this.t = 2.4; this.harmless = true; this.hp = 0; this.boomT = 0;
    g.play('boss_die');
    g.music(null);
  }
  frameKey() { return this.action === 'attack' ? 'boss_golem_attack' : this.action === 'hurt' ? 'boss_golem_hurt' : 'boss_golem_idle'; }
  next() {
    if (!this.queue.length) {
      const leaps = this.hp <= 6 ? 3 : 2;
      this.queue = ['walk', 'throw', 'walk', ...Array(leaps).fill('leap'), 'tired'];
      if (this.hp <= 6) this.queue.splice(2, 0, 'throw');
    }
    const s = this.queue.shift();
    this.state = s; this.harmless = false;
    if (s === 'walk') { this.t = rand(1.2, 2.0); this.setAnim('walk'); }
    if (s === 'throw') { this.t = 1.1; this.thrown = false; this.setAnim('attack', 'down', { restart: true }); }
    if (s === 'leap') { this.t = 0.95; this.landed = false; const p = this.g.player; this.tgt = { x: p.x, y: p.y }; this.from = { x: this.x, y: this.y }; this.setAnim('idle'); }
    if (s === 'tired') {
      this.t = 3.0; this.tiredHits = 0; this.harmless = true; this.setAnim('hurt'); this.g.play('boss_tired');
      this.g.spawnFX('sparkle', this.x, this.y - 16, { z: this.z, count: 6, radius: 14 });
      if (!this.g.flags._golemHint) { this.g.flags._golemHint = true; this.g.toast('Der Kern des Golems glüht – jetzt zuschlagen!'); }
    }
  }
  ai(dt) {
    const g = this.g, p = g.player;
    if (this._tink > 0) this._tink -= dt;
    const speedUp = this.hp <= 6 ? 1.35 : 1;
    switch (this.state) {
      case 'sleep':
        this.awake += dt;
        this.harmless = true;
        this.setAnim('idle');
        if (this.awake > 1.2 && (this.distTo(p) < 100 || this.awake > 3)) {
          this.state = 'roar'; this.t = 1.1; g.play('boss_roar'); g.shake(3, 0.8); g.setFlag('boss_fight', true, false); g.music('boss');
        }
        break;
      case 'roar':
        this.hop = Math.abs(Math.sin(this.t * 12)) * 2;
        if (this.t <= 0) { this.hop = 0; this.next(); }
        break;
      case 'walk': {
        const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy) || 1;
        if (d > 20) move(g, this, (dx / d) * 26 * speedUp * dt, (dy / d) * 26 * speedUp * dt, { slide: true });
        this._step = (this._step || 0) + dt;
        if (this._step > 0.5) { this._step = 0; g.shake(1, 0.08); g.play('stomp'); g.spawnFX('dust', this.x + rand(-8, 8), this.y, { z: this.z }); }
        if (this.t <= 0) this.next();
        break;
      }
      case 'throw':
        if (!this.thrown && this.t < 0.6) {
          this.thrown = true;
          const base = Math.atan2(p.y - this.y, p.x - this.x);
          const n = this.hp <= 6 ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.32;
            g.spawn(new Projectile(g, { x: this.x + Math.cos(a) * 12, y: this.y + Math.sin(a) * 6, lvl: this.lvl, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, sprite: 'octorok_rock', dmg: 1, hop: 22, life: 2.4, size: 5, fxOnHit: 'rock' }));
          }
          g.play('boss_throw');
        }
        if (this.t <= 0) this.next();
        break;
      case 'leap': {
        const T = 0.95, k = 1 - this.t / T;
        if (k < 0.75) {
          const kk = k / 0.75;
          this.hop = Math.sin(kk * Math.PI * 0.5) * 38;
          const nx = this.from.x + (this.tgt.x - this.from.x) * kk * 0.9, ny = this.from.y + (this.tgt.y - this.from.y) * kk * 0.9;
          move(g, this, nx - this.x, ny - this.y);
          this.harmless = true;
        } else if (!this.landed) {
          this.hop = Math.max(0, this.hop - dt * 380);
          if (this.hop <= 0) {
            this.landed = true; this.harmless = false;
            g.shake(4, 0.35); g.play('boss_stomp');
            g.spawnFX('dust', this.x - 10, this.y, { z: this.z }); g.spawnFX('dust', this.x + 10, this.y, { z: this.z });
            g.spawnFX('shockwave', this.x, this.y, { z: this.z, r: 46 });
            if (p.canBeHit() && !p.airborne && Math.hypot(p.x - this.x, p.y - this.y) < 46) p.hurt(2, this);
            const rocks = this.hp <= 6 ? 4 : 3;
            for (let i = 0; i < rocks; i++) {
              const rx = p.x + rand(-40, 40), ry = p.y + rand(-30, 30);
              const tx = Math.floor(rx / TILE), ty = Math.floor((ry - 2) / TILE);
              if (g.world.def(tx, ty).solid || g.world.def(tx, ty).pit) continue;
              g.spawn(new FallingRock(g, rx, ry, { lvl: this.lvl, dur: rand(0.8, 1.3) }));
            }
          }
        }
        if (this.t <= 0) { this.hop = 0; this.next(); }
        break;
      }
      case 'tired':
        this.hop = 0;
        this.flash = Math.floor(this.t * 5) % 2 ? 0.05 : 0;   // pulsing glow = vulnerable
        if (Math.random() < dt * 8) g.spawnFX('sparkle', this.x + rand(-6, 6), this.y - 20, { z: this.z });
        if (this.t <= 0) { this.g.play('boss_roar'); this.next(); }
        break;
      case 'dying':
        this.flash = Math.floor(this.t * 14) % 2 ? 0.1 : 0;
        this.boomT -= dt;
        if (this.boomT <= 0) { this.boomT = 0.22; g.spawnFX('explosion', this.x + rand(-16, 16), this.y - rand(0, 26), { z: this.z }); g.play('explode'); g.shake(2, 0.2); }
        if (this.t <= 0) { this.dead = true; g.onBossDefeated(this); }
        break;
    }
  }
  draw(ctx, r) {
    const { img, flip } = animFrame(this.anim, this.frameKey());
    const blink = this.iframes > 0 && Math.floor(this.iframes * 20) % 2 === 0;
    if (this.state === 'leap' && this.hop > 0) r.shadow(this.x, this.y, this.z, 10 + this.hop * 0.1, undefined, 0.3);
    r.sprite(img, this.x, this.y, this.z, { hop: this.hop, flip, flash: this.flash > 0 || blink });
  }
}
