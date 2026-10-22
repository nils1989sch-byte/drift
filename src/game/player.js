// The hero: 8-way movement, 4-way facing, sword + spin attack, lift/carry/throw, push blocks,
// ledge jumps, pits, shallow water, damage with knockback and i-frames.
import { Entity, makeAnim, playAnim } from './entities/base.js';
import { move, findLedge, cellOf, centerY, levelUnder, visualZ, FOOT } from './collision.js';
import { DIR_VEC, dirFromVec, animFrame, overlap, spriteFrame, TILE, LEVEL, rand, clamp } from './util.js';
import { damage, knock, updateKnock, hits, screenBox } from './combat.js';
import { throwObject } from './entities/projectiles.js';
import { Block, LockedDoor, Bomb } from './entities/objects.js';

const SPEED = 82;
const ATTACK_T = 0.27, HIT_FROM = 0.03, HIT_TO = 0.2;
const CHARGE_T = 0.75, SPIN_T = 0.42;
const SPIN_ORDER = ['down', 'left', 'up', 'right'];

export class Player extends Entity {
  constructor(g) {
    super(g, 0, 0, { lvl: 0, shadow: 6 });
    this.kind = 'player';
    this.dir = 'down';
    this.state = 'normal';
    this.t = 0;
    this.hp = 6; this.maxHp = 6;
    this.rupees = 0; this.keys = 0;
    this.bombs = 0; this.maxBombs = 10; this.hasBombs = false;
    this.item = null;
    this.hasSword = true;
    this.anim = makeAnim(g.assets, 'hero');
    this.carry = null;
    this.charge = 0; this.charged = false;
    this.pushT = 0; this.ledgeT = 0;
    this.swingHit = new Set();
    this.lastSafe = { x: 0, y: 0, lvl: 0 };
    this.stepT = 0;
    this.moving = false;
    this.god = false;
  }
  syncInventory() {
    this.items = ['sword', ...(this.hasBombs ? ['bomb'] : [])];
    this.sword = this.hasSword;
    if (this.hasBombs && !this.item) this.item = 'bomb';
  }
  // ---- placement / queries --------------------------------------------------------------
  place(x, y, dir = this.dir) {
    this.x = x; this.y = y; this.dir = dir;
    this.lvl = levelUnder(this.g.world, this);
    this.z = visualZ(this.g.world, x, y, this.lvl);
    this.hop = 0; this.kb = null; this.state = 'normal'; this.t = 0;
    this.carry = null; this.charge = 0; this.charged = false; this.pushT = this.ledgeT = 0;
    this.lastSafe = { x, y, lvl: this.lvl };
    this.hidden = false;
    playAnim(this.anim, 'idle', dir, { restart: true });
  }
  hurtbox() { return { x: this.x - 5, y: this.y - 14, w: 10, h: 15 }; }
  get airborne() { return this.state === 'jump'; }
  canBeHit() {
    return !this.god && this.iframes <= 0 && !['dead', 'fall', 'jump', 'itemget', 'frozen'].includes(this.state);
  }
  frontRect(reach = 14) {
    const x = this.x, y = this.y;
    switch (this.dir) {
      case 'down': return { x: x - 6, y: y - 2, w: 12, h: reach };
      case 'up': return { x: x - 6, y: y - 6 - reach, w: 12, h: reach };
      case 'left': return { x: x - 5 - reach, y: y - 10, w: reach, h: 12 };
      default: return { x: x + 5, y: y - 10, w: reach, h: 12 };
    }
  }
  swordBox() {
    const x = this.x, y = this.y;
    switch (this.dir) {
      case 'down': return { x: x - 13, y: y - 10, w: 26, h: 24 };
      case 'up': return { x: x - 13, y: y - 30, w: 26, h: 31 };
      case 'left': return { x: x - 23, y: y - 20, w: 27, h: 24 };
      default: return { x: x - 4, y: y - 20, w: 27, h: 24 };
    }
  }
  spinBox() { return { x: this.x - 24, y: this.y - 30, w: 48, h: 42 }; }

  // ---- damage --------------------------------------------------------------------------
  hurt(dmg, from) {
    const g = this.g;
    if (!this.canBeHit()) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.iframes = 1.0;
    this.flash = 0.12;
    g.hitstop = Math.max(g.hitstop, 0.06);
    g.play('hurt');
    g.shake(1.5, 0.15);
    this.dropCarry();
    if (this.hp <= 0) { this.die(); return true; }
    knock(this, from, 150, 0.22);
    this.state = 'hurt'; this.t = 0;
    this.charge = 0; this.charged = false;
    return true;
  }
  knockBack(from, power = 120) { knock(this, from, power, 0.15); if (this.state === 'normal' || this.state === 'attack') { this.state = 'hurt'; this.t = 0.08; } }
  die() {
    this.state = 'dead'; this.t = 0; this.kb = null; this.hop = 0;
    this.g.play('die');
    this.g.music(null);
  }
  dropCarry() {
    if (!this.carry) return;
    const c = this.carry; this.carry = null;
    if (c.type === 'bomb') { c.carried = false; c.x = this.x; c.y = this.y + 2; c.lvl = this.lvl; c.z = this.z; c.hop = 0; this.g.objects.push(c); return; }
    this.g.spawnFX(c.def?.fx || 'poof', this.x, this.y - 18, { z: this.z });
    this.g.play('break');
  }

  // ---- update --------------------------------------------------------------------------
  update(dt) {
    const g = this.g, inp = g.input;
    if (this.iframes > 0) this.iframes -= dt;
    if (this.flash > 0) this.flash -= dt;
    this.t += dt;
    if (this.lock > 0) this.lock -= dt;
    // a carried bomb keeps ticking
    if (this.carry instanceof Bomb) { this.carry.fuse -= dt; if (this.carry.fuse <= 0) this.carry.explode(); }
    let ax = inp.axis.x || 0, ay = inp.axis.y || 0;
    if (this.lock > 0) ax = ay = 0;
    const mag = Math.min(1, Math.hypot(ax, ay));
    const cell = g.world.def(cellOf(this.x), cellOf(centerY(this)));
    this.moving = false;

    switch (this.state) {
      case 'normal': this.updateNormal(dt, ax, ay, mag, cell); break;
      case 'attack': {
        if (this.t >= HIT_FROM && this.t <= HIT_TO) this.swordHits(this.swordBox(), 1, 'sword');
        // a little forward glide keeps it snappy
        if (mag > 0.2) move(g, this, ax * SPEED * 0.25 * dt, ay * SPEED * 0.25 * dt, { slide: true });
        if (this.t >= ATTACK_T) {
          if (inp.down('attack')) { this.state = 'charge'; this.t = 0; this.charge = 0; this.charged = false; }
          else this.state = 'normal';
        }
        break;
      }
      case 'charge': {
        this.charge += dt;
        if (!this.charged && this.charge >= CHARGE_T) {
          this.charged = true; g.play('charge');
          const v = DIR_VEC[this.dir];
          g.spawnFX('sparkle', this.x + v.x * 14, this.y + v.y * 10 - 8, { z: this.z });
        }
        if (mag > 0.2) { this.moving = true; move(g, this, ax * SPEED * 0.55 * dt, ay * SPEED * 0.55 * dt, { slide: true }); }
        // the held sword pokes things in front
        this.swordHits(this.frontRect(12), 1, 'poke', true);
        if (!inp.down('attack')) {
          if (this.charged) { this.state = 'spin'; this.t = 0; this.swingHit.clear(); g.play('spin'); this.spinQ = -1; }
          else this.state = 'normal';
          this.charged = false; this.charge = 0;
        }
        break;
      }
      case 'spin': {
        const q = Math.min(3, Math.floor((this.t / SPIN_T) * 4));
        if (q !== this.spinQ) {
          this.spinQ = q;
          const d = SPIN_ORDER[(SPIN_ORDER.indexOf(this.dir) + q) % 4];
          g.spawnFX('slash', this.x, this.y, { z: this.z, dir: d });
          if (q === 2) this.swingHit.clear();
        }
        this.swordHits(this.spinBox(), 2, 'spin');
        if (this.t >= SPIN_T) { this.state = 'normal'; }
        break;
      }
      case 'lift':
        if (this.t >= 0.24) this.state = 'normal';
        break;
      case 'throw':
        if (this.t >= 0.16) this.state = 'normal';
        break;
      case 'hurt':
        updateKnock(g, this, dt);
        if (this.t >= 0.22) { this.state = 'normal'; this.kb = null; }
        break;
      case 'jump': this.updateJump(dt); break;
      case 'fall': this.updateFall(dt); break;
      case 'itemget': break;
      case 'frozen': break;
      case 'dead':
        if (this.t > 1.6 && !this.deadReported) { this.deadReported = true; g.onPlayerDead(); }
        break;
    }
    if (this.state !== 'jump' && this.state !== 'fall') {
      this.lvl = levelUnder(g.world, this);
      this.z = visualZ(g.world, this.x, this.y, this.lvl);
    }
    // pits
    if (['normal', 'attack', 'charge', 'spin', 'hurt', 'lift', 'throw'].includes(this.state)) {
      const c = g.world.def(cellOf(this.x), cellOf(centerY(this)));
      if (c.pit && !this.god) this.startFall();
      else if (this.state === 'normal' && this.isSafeSpot()) this.lastSafe = { x: this.x, y: this.y, lvl: this.lvl };
    }
    this.pickAnim();
    this.anim?.update(dt);
    this.shadow = this.state === 'fall' || this.state === 'dead' ? false : 6;
  }

  updateNormal(dt, ax, ay, mag, cell) {
    const g = this.g, inp = g.input;
    // actions first
    if (inp.pressed('attack')) {
      if (this.carry) { this.throwCarry(); return; }
      if (this.hasSword) { this.startAttack(); return; }
    }
    if (inp.pressed('action')) {
      if (this.carry) { this.throwCarry(); return; }
      if (this.interact()) return;
    }
    if (inp.pressed('item') && !this.carry) this.useItem();

    let speed = SPEED;
    if (cell.shallow) speed *= 0.55;
    if (cell.tall) speed *= 0.88;
    if (mag > 0.15) {
      this.moving = true;
      this.dir = dirFromVec(ax, ay, this.dir);
      const r = move(g, this, ax * speed * dt, ay * speed * dt, { slide: true });
      // on stairs, walking up/down gently centres the hero on the staircase column
      if (cell.stairs && Math.abs(ay) > Math.abs(ax)) {
        const cx = cellOf(this.x) * TILE + 8, d = cx - this.x;
        if (Math.abs(d) > 0.3) move(g, this, Math.sign(d) * Math.min(Math.abs(d), 40 * dt), 0);
      }
      const cardinalX = Math.abs(ax) > 0.6 && Math.abs(ay) < 0.35, cardinalY = Math.abs(ay) > 0.6 && Math.abs(ax) < 0.35;
      const pushing = (r.hitX && cardinalX) || (r.hitY && cardinalY);
      if (pushing && r.moved < speed * dt * 0.3) {
        this.pushT += dt;
        const ahead = this.objectAhead();
        if (ahead instanceof Block && this.pushT > 0.4) { if (ahead.tryPush(g, this.dir)) this.pushT = 0; }
        if (ahead instanceof LockedDoor && this.pushT > 0.12 && !this._doorTried) { this._doorTried = true; ahead.tryOpen(g, this); }
        const ledge = this.pushT > 0.02 ? findLedge(g, this, this.dir) : null;
        if (ledge) { this.ledgeT += dt; if (this.ledgeT >= 0.09) { this.startJump(ledge); return; } }
        else this.ledgeT = 0;
      } else { this.pushT = 0; this.ledgeT = 0; this._doorTried = false; }
      // water/grass feedback
      this.stepT -= dt;
      if (this.stepT <= 0) {
        if (cell.shallow) { g.spawnFX('splash', this.x, this.y, { z: this.z, small: true }); g.play('wade'); this.stepT = 0.28; }
        else if (cell.tall) { g.spawnFX('grass', this.x, this.y - 2, { z: this.z, small: true }); g.play('rustle'); this.stepT = 0.3; }
        else this.stepT = 0.1;
      }
    } else { this.pushT = 0; this.ledgeT = 0; this._doorTried = false; }
  }

  startAttack() {
    const g = this.g;
    this.state = 'attack'; this.t = 0;
    this.swingHit.clear();
    playAnim(this.anim, 'attack', this.dir, { restart: true });
    g.play('sword');
    g.spawnFX('slash', this.x, this.y, { z: this.z, dir: this.dir });
  }

  swordHits(box, dmg, kind, poke = false) {
    const g = this.g;
    for (const e of g.enemies) {
      if (e.dead || this.swingHit.has(e)) continue;
      if (hits(this, box, e, e.hurtbox())) {
        this.swingHit.add(e);
        const landed = damage(g, e, dmg, this, { kind });
        if (landed && poke) this.knockBack(e, 80);
      }
    }
    if (poke) return;
    // deflect enemy projectiles
    for (const pr of g.projectiles) {
      if (pr.dead || pr.owner !== 'enemy' || !pr.deflectable) continue;
      if (hits(this, box, pr, pr.hurtbox())) { pr.end('deflect'); g.play('tink'); }
    }
    g.cutArea(box, this.lvl, this.z);
  }

  objectAhead() {
    const g = this.g, fr = this.frontRect(6);
    let best = null;
    for (const o of g.objects) {
      if (o.dead || !o.solid || o.carried) continue;
      if (o.lvl !== this.lvl && o.lvl !== -1) continue;
      if (overlap(fr, o.solidBox())) best = o;
    }
    return best;
  }

  interact() {
    const g = this.g, fr = this.frontRect(14);
    let target = null, pri = -1;
    const consider = (o, p) => { if (p > pri) { target = o; pri = p; } };
    for (const n of g.npcs) if (!n.dead && n.lvl === this.lvl && overlap(fr, n.hurtbox())) consider(n, 3);
    for (const o of g.objects) {
      if (o.dead || o.carried || o.hidden) continue;
      if (o.lvl !== this.lvl) continue;
      if (!overlap(fr, o.solidBox())) continue;
      if (o.interact) consider(o, 2);
      else if (o.lift) consider(o, 1);
    }
    if (!target) return false;
    if (pri >= 2) { target.interact(g, this); return true; }
    this.lift(target);
    return true;
  }

  lift(o) {
    const g = this.g;
    g.removeObject(o);
    o.carried = true; o.dead = false;
    this.carry = o;
    this.state = 'lift'; this.t = 0;
    this.liftFrom = { x: o.x, y: o.y };
    playAnim(this.anim, 'lift', this.dir, { restart: true });
    g.play('lift');
    if (o.type === 'bush') { g.spawnFX('leaves', o.x, o.y - 6, { z: o.z }); if (Math.random() < (o.def.drop || 0)) g.dropLoot(o.x, o.y - 2, o.lvl, 'small'); }
  }

  throwCarry() {
    const g = this.g, c = this.carry;
    if (!c) return;
    this.carry = null;
    g.spawn(throwObject(g, this, c));
    this.state = 'throw'; this.t = 0;
    playAnim(this.anim, 'throw', this.dir, { restart: true });
    g.play('throw');
  }

  useItem() {
    const g = this.g;
    if (this.item === 'bomb' || this.item === 'bombs') {
      if (this.bombs <= 0) { g.hint('nobombs', 'Keine Bomben mehr!'); g.play('error'); return; }
      const active = g.objects.filter((o) => o instanceof Bomb && !o.dead).length;
      if (active >= 3) return;
      const v = DIR_VEC[this.dir];
      let bx = this.x + v.x * 12, by = this.y + v.y * 10 + (v.y < 0 ? 2 : 0);
      // keep the bomb on the player's level
      const tx = cellOf(bx), ty = cellOf(by - 2);
      if (g.world.heightAt(tx, ty) !== this.lvl || g.world.def(tx, ty).solid) { bx = this.x; by = this.y + 1; }
      this.bombs--;
      g.addObject({ t: 'bomb', px: bx, py: by, lvl: this.lvl });
      g.play('bomb_place');
    }
  }

  // ---- ledge jump -------------------------------------------------------------------------
  startJump(l) {
    const drop = Math.max(1, this.lvl - l.lvl);
    this.jump = { fx: this.x, fy: this.y, fz: this.z, tx: l.x, ty: l.y, tl: l.lvl, dur: 0.3 + drop * 0.07, drop };
    this.state = 'jump'; this.t = 0; this.pushT = this.ledgeT = 0;
    this.g.play('jump');
  }
  updateJump() {
    const j = this.jump, k = Math.min(1, this.t / j.dur);
    this.x = j.fx + (j.tx - j.fx) * k;
    this.y = j.fy + (j.ty - j.fy) * k;
    this.z = j.fz + (j.tl - j.fz) * k * k;
    this.hop = Math.sin(k * Math.PI) * (7 + j.drop * 2);
    if (k >= 1) {
      this.hop = 0; this.lvl = j.tl; this.z = j.tl; this.state = 'normal';
      this.g.play('land');
      this.g.spawnFX('dust', this.x, this.y, { z: this.z });
      const c = this.g.world.def(cellOf(this.x), cellOf(centerY(this)));
      if (c.shallow) this.g.spawnFX('splash', this.x, this.y, { z: this.z });
    }
  }

  // ---- pits -------------------------------------------------------------------------------
  isSafeSpot() {
    const w = this.g.world, fb = this.foot || FOOT;
    for (const [px, py] of [[this.x - fb.hw - 2, this.y - fb.top - 2], [this.x + fb.hw + 2, this.y - fb.top - 2], [this.x - fb.hw - 2, this.y + fb.bottom + 2], [this.x + fb.hw + 2, this.y + fb.bottom + 2]]) {
      const d = w.def(cellOf(px), cellOf(py));
      if (d.pit || d.stairs) return false;
    }
    // keep a margin of a few pixels to any pit so a respawn never lands on its edge
    for (const [px, py] of [[this.x - 10, this.y - 2], [this.x + 10, this.y - 2], [this.x, this.y - 12], [this.x, this.y + 8]]) if (w.def(cellOf(px), cellOf(py)).pit) return false;
    return true;
  }
  startFall() {
    this.dropCarry();
    this.state = 'fall'; this.t = 0; this.kb = null;
    this.fallTo = { x: cellOf(this.x) * TILE + 8, y: cellOf(centerY(this)) * TILE + 10 };
    playAnim(this.anim, 'fall', this.dir, { restart: true });
    this.g.play('fall');
  }
  updateFall(dt) {
    this.x += (this.fallTo.x - this.x) * Math.min(1, dt * 8);
    this.y += (this.fallTo.y - this.y) * Math.min(1, dt * 8);
    if (this.t > 0.7) {
      const s = this.lastSafe;
      this.x = s.x; this.y = s.y; this.lvl = s.lvl; this.z = s.lvl;
      this.state = 'normal'; this.t = 0;
      this.hp = Math.max(0, this.hp - 2);
      this.flash = 0.12;
      this.g.play('hurt');
      if (this.hp <= 0) this.die(); else { this.iframes = 1.0; this.lock = 0.4; }
    }
  }

  // ---- animation / drawing ------------------------------------------------------------------
  pickAnim() {
    const a = this.anim;
    if (!a) return;
    let act = 'idle', dir = this.dir;
    switch (this.state) {
      case 'normal':
        if (this.carry) act = this.moving ? 'carry' : 'carry_idle';
        else if (this.moving) act = this.pushT > 0.12 ? 'push' : 'walk';
        break;
      case 'attack': act = 'attack'; break;
      case 'charge': act = this.moving ? 'charge' : 'charge'; break;
      case 'spin': act = 'spin'; dir = SPIN_ORDER[(SPIN_ORDER.indexOf(this.dir) + Math.min(3, Math.floor((this.t / SPIN_T) * 4))) % 4]; break;
      case 'lift': act = 'lift'; break;
      case 'throw': act = 'throw'; break;
      case 'hurt': act = 'hurt'; break;
      case 'jump': act = 'walk'; break;
      case 'fall': act = 'fall'; break;
      case 'itemget': act = 'item_get'; break;
      case 'dead': act = 'dead'; break;
      case 'frozen': act = 'idle'; break;
    }
    if (act === 'spin' && !(a.has?.('spin'))) act = 'attack';
    playAnim(a, act, dir);
  }

  draw(ctx, r) {
    if (this.hidden) return;
    const st = this.state;
    if (st === 'fall' && this.t > 0.6) return;
    const blink = this.iframes > 0 && st !== 'dead' && Math.floor(this.iframes * 20) % 2 === 0;
    const { img, flip } = animFrame(this.anim, `hero_idle_${this.dir}`);
    const o = { hop: this.hop, flip, flash: this.flash > 0, alpha: blink ? 0.35 : 1 };
    if (st === 'fall' && !(this.anim?.has?.('fall'))) {
      // fallback fall: sink and fade into the hole
      const k = Math.min(1, this.t / 0.6);
      r.sprite(img, this.x, this.y, this.z, { ...o, hop: -k * 10, alpha: 1 - k });
    } else r.sprite(img, this.x, this.y, this.z, o);

    // tall grass hides the feet (foreground blades sprite)
    const w = this.g.world, tx = cellOf(this.x), ty = cellOf(centerY(this));
    if (w.def(tx, ty).tall && st !== 'jump') {
      const gs = r.assets?.sprites?.grass_tall;
      const gi = Array.isArray(gs) ? gs[Math.floor(r.time * 2) % gs.length] : gs;
      if (gi) r.sprite(gi, this.x, this.y + 2, this.z);
    }
    // carried object over the head
    if (this.carry) {
      const ci = spriteFrame(r.assets, this.carry.sprite, r.time, 8);
      let cx = this.x, cy = this.y, hop = this.hop + 18;
      if (st === 'lift' && this.liftFrom) {
        const k = Math.min(1, this.t / 0.24);
        cx = this.liftFrom.x + (this.x - this.liftFrom.x) * k;
        cy = this.liftFrom.y + (this.y - this.liftFrom.y) * k;
        hop = this.hop + 18 * k;
      }
      const bob = this.moving && Math.floor(r.time * 9) % 2 ? 1 : 0;
      r.sprite(ci, cx, cy + 0.5, this.z, { hop: hop - bob });
    }
    if (st === 'itemget' && this.showItem) {
      const ii = spriteFrame(r.assets, this.showItem, r.time, 6);
      r.sprite(ii, this.x, this.y, this.z, { hop: 24 });
    }
  }
}
