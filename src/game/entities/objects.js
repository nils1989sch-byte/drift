// World objects as Drawables: scenery (solid trees/houses/fences/statues), cuttable bushes, liftable pots/rocks,
// signs, chests, doors, push blocks, floor switches, bombable walls, bombs.
import { Entity } from './base.js';
import { spriteFrame, TILE, chance, overlap, DIR_VEC } from '../util.js';
import { blocked, cellOk } from '../collision.js';

// box: [ox, oy, w, h] relative to the foot point. foot: where the foot sits inside its tile [dx, dy].
export const OBJ = {
  tree:        { sprite: 'tree', box: [-8, -9, 16, 10], shadow: 10 },
  tree_small:  { sprite: 'tree_small', box: [-6, -7, 12, 8], shadow: 6 },
  bush:        { sprite: 'bush', box: [-7, -12, 14, 12], cut: true, lift: true, fx: 'leaves', drop: 0.22, shadow: false },
  rock:        { sprite: 'rock', box: [-7, -12, 14, 12], lift: true, fx: 'rock', dmg: 2, shadow: false },
  rock_big:    { sprite: 'rock_big', box: [-15, -14, 30, 15], bombable: true, fx: 'rock', foot: [16, 15], shadow: false },
  pot:         { sprite: 'pot', box: [-6, -10, 12, 10], lift: true, fx: 'poof', drop: 0.45, shadow: false },
  sign:        { sprite: 'sign', box: [-6, -6, 12, 7], shadow: false },
  chest:       { sprite: 'chest_closed', box: [-8, -12, 16, 12], shadow: false },
  house:       { sprite: 'house', box: [-30, -38, 60, 36], foot: [0, 15], shadow: false },
  fence_h:     { sprite: 'fence_h', box: [-8, -5, 16, 6], shadow: false },
  fence_v:     { sprite: 'fence_v', box: [-3, -15, 6, 16], foot: [8, 15], shadow: false },
  statue:      { sprite: 'statue', box: [-7, -10, 14, 11], shadow: 7 },
  torch:       { sprite: 'torch', box: [-4, -6, 8, 7], shadow: false, fps: 10 },
  stump:       { sprite: 'stump', box: [-6, -7, 12, 8], shadow: false },
  flower:      { sprite: 'flower', solid: false, shadow: false, fps: 3 },
  mushroom:    { sprite: 'mushroom', solid: false, shadow: false },
  lilypad:     { sprite: 'lilypad', solid: false, shadow: false, layer: 'floor' },
  cave_entrance: { sprite: 'cave_entrance', solid: false, shadow: false, foot: [8, 15] },
  rock_cracked: { sprite: 'rock_cracked', solid: false, shadow: false, foot: [8, 15], bombable: true },
  wall_cracked: { sprite: 'wall_cracked', box: [-8, -32, 16, 32], foot: [8, 31.9], bombable: true, shadow: false },
  door_locked: { sprite: 'door_locked', box: [-8, -32, 16, 32], foot: [8, 31.9], shadow: false },
  shutter:     { sprite: 'shutter', box: [-8, -16, 16, 16], foot: [8, 15.9], shadow: false },
  block:       { sprite: 'block', box: [-8, -15.5, 16, 15.5], foot: [8, 15.5], shadow: false },
  switch:      { sprite: 'switch_up', solid: false, shadow: false, layer: 'floor', foot: [8, 12] },
  portal:      { sprite: 'portal', solid: false, shadow: false, layer: 'floor', foot: [8, 10], fps: 8 },
  barrier:     { sprite: null, shadow: false },
  // village props (solid, small foot boxes)
  barrel:      { sprite: 'barrel', box: [-6, -6, 12, 7], shadow: 5 },
  crate:       { sprite: 'crate', box: [-7, -7, 14, 8], shadow: 6 },
  sack:        { sprite: 'sack', box: [-5, -5, 10, 6], shadow: 4 },
  hay:         { sprite: 'hay', box: [-7, -6, 14, 7], shadow: 6 },
  cart:        { sprite: 'cart', box: [-13, -7, 26, 8], foot: [16, 14], shadow: 12 },
  well:        { sprite: 'well', box: [-12, -10, 24, 11], foot: [16, 15], shadow: 12 },
  gravestone:  { sprite: 'gravestone', box: [-6, -5, 12, 6], shadow: 5 },
  lantern:     { sprite: 'lantern', box: [-3, -4, 6, 5], shadow: 3, fps: 5 },
  tools:       { sprite: 'tools', box: [-6, -4, 12, 5], shadow: false },
  bench:       { sprite: 'bench', box: [-10, -4, 20, 5], foot: [16, 14], shadow: 8 },
  flowerbox:   { sprite: 'flowerbox', box: [-7, -5, 14, 6], shadow: false },
};

export class Obj extends Entity {
  constructor(g, spec) {
    const def = OBJ[spec.t] || {};
    const [fx, fy] = def.foot || [8, 14];
    const x = spec.px ?? spec.x * TILE + fx, y = spec.py ?? spec.y * TILE + fy;
    super(g, x, y, { lvl: spec.lvl, shadow: def.shadow ?? false });
    this.kind = 'object';
    this.type = spec.t;
    this.spec = spec;
    this.def = def;
    this.sprite = spec.sprite || def.sprite;
    this.solid = spec.solid ?? def.solid ?? true;
    this.layer = def.layer;
    this.box = spec.box || def.box || [-7, -12, 14, 12];
    if (spec.t === 'house') { this.model = 'house'; this.footprint = { w: 60, h: 36 }; }
    if (spec.t === 'barrier') { this.box = [0, 0, spec.w * TILE, spec.h * TILE]; this.x = spec.x * TILE; this.y = spec.y * TILE; this.lvl = -1; this.hidden = true; }
    this.lift = !!def.lift; this.cut = !!def.cut;
    this.sortBias = spec.sortBias ?? 0;
    this.phase = Math.random() * 3;
    if (spec.flag && g.flags[spec.flag]) this.onFlagAtLoad?.();
  }
  solidBox() { const [ox, oy, w, h] = this.box; return { x: this.x + ox, y: this.y + oy, w, h }; }
  hurtbox() { return this.solidBox(); }
  update(dt) {}
  draw(ctx, r) {
    if (!this.sprite) return;
    const img = spriteFrame(r.assets, this.sprite, r.time + this.phase, this.def.fps || 6);
    r.sprite(img, this.x, this.y, this.z, { hop: this.hop, flash: this.flash > 0 });
  }
  // sword / explosion destroys it (bushes)
  destroy(g, how = 'cut') {
    if (this.dead) return;
    this.dead = true;
    const fx = this.def.fx;
    if (fx) g.spawnFX(fx, this.x, this.y - 6, { z: this.z });
    if (this.type === 'bush') { g.play('cut'); g.spawnFX('leaves', this.x, this.y - 6, { z: this.z }); }
    else if (this.type === 'pot') g.play('break');
    else g.play('break');
    if (this.def.drop && chance(this.def.drop)) g.dropLoot(this.x, this.y - 2, this.lvl, 'small');
  }
}

export class Sign extends Obj {
  interact(g) { g.say(this.spec.text || ['Auf dem Schild steht nichts.']); }
}

// Chest: contents {item, amount, text}. Optional appearFlag: invisible until that flag is set.
export class Chest extends Obj {
  constructor(g, spec) {
    super(g, spec);
    this.flag = spec.flag || `chest_${g.world.id}_${spec.x}_${spec.y}`;
    this.open = !!g.flags[this.flag];
    this.sprite = this.open ? 'chest_open' : 'chest_closed';
    this.appearFlag = spec.appearFlag;
    this.visible = !this.appearFlag || !!g.flags[this.appearFlag] || this.open;
    this.solid = this.visible; this.hidden = !this.visible;
  }
  update(dt) {
    if (!this.visible && this.g.flags[this.appearFlag]) {
      this.visible = true; this.solid = true; this.hidden = false;
      this.g.spawnFX('poof', this.x, this.y - 6, { z: this.z });
      this.g.spawnFX('sparkle', this.x, this.y - 10, { z: this.z });
      this.g.play('secret');
      // don't trap the player inside the chest
      const p = this.g.player;
      if (overlap(this.solidBox(), { x: p.x - 5, y: p.y - 5, w: 10, h: 6 })) p.y = this.y + 7;
    }
  }
  interact(g, p) {
    if (this.open || !this.visible) return;
    this.open = true;
    this.sprite = 'chest_open';
    g.setFlag(this.flag, true);
    g.play('chest');
    g.giveItem(this.spec.item, this.spec.amount, this.spec.text, { chest: this });
  }
}

// Locked door: opens with a small key when the player pushes into it.
export class LockedDoor extends Obj {
  constructor(g, spec) {
    super(g, spec);
    this.flag = spec.flag;
    if (g.flags[this.flag]) this.dead = true;
  }
  tryOpen(g, p) {
    if (this.dead) return;
    if (p.keys > 0) {
      p.keys--;
      g.setFlag(this.flag, true);
      this.dead = true;
      g.play('door');
      g.spawnFX('poof', this.x, this.y - 12, { z: this.z });
      g.save();
    } else g.hint('locked', 'Verschlossen. Du brauchst einen kleinen Schlüssel.');
  }
}

// Shutter: closed while `closedWhile(g)` is true.
export class Shutter extends Obj {
  update() {
    const closed = !!this.spec.closedWhile?.(this.g);
    if (closed !== this.solid) {
      this.solid = closed; this.hidden = !closed;
      this.g.play('door');
      this.g.shake(1, 0.12);
    }
  }
}

// Bombable: cracked wall / cracked cliff. Flag persists the opening.
export class Bombable extends Obj {
  constructor(g, spec) {
    super(g, spec);
    this.flag = spec.flag;
    if (this.flag && g.flags[this.flag]) this.dead = true;
  }
  blast(g) {
    if (this.dead) return;
    this.dead = true;
    if (this.flag) g.setFlag(this.flag, true);
    g.spawnFX('rock', this.x, this.y - 10, { z: this.z });
    g.spawnFX('poof', this.x, this.y - 10, { z: this.z });
    g.play('secret');
    if (this.spec.reveal) g.addObject({ t: this.spec.reveal, px: this.x, py: this.y, lvl: this.lvl });
    g.save();
  }
}

// Push block: slides one tile when pushed for a moment.
export class Block extends Obj {
  constructor(g, spec) { super(g, spec); this.slide = null; }
  tryPush(g, dir) {
    if (this.slide) return false;
    const v = DIR_VEC[dir];
    const nx = this.x + v.x * TILE, ny = this.y + v.y * TILE;
    const tx = Math.floor(nx / TILE), ty = Math.floor((ny - 4) / TILE);
    if (!cellOk(g.world, tx, ty, this.lvl, false, { avoidPits: true })) return false;
    const nb = { x: nx - 8, y: ny - 15.5, w: 16, h: 15.5 };
    for (const s of g.solids) if (s !== this && s.solid && !s.dead && s.lvl === this.lvl && overlap(nb, s.solidBox())) return false;
    for (const e of g.enemies) if (!e.dead && overlap(nb, e.hurtbox())) return false;
    this.slide = { fx: this.x, fy: this.y, tx: nx, ty: ny, t: 0 };
    g.play('push');
    return true;
  }
  update(dt) {
    if (!this.slide) return;
    const s = this.slide;
    s.t = Math.min(1, s.t + dt / 0.3);
    this.x = s.fx + (s.tx - s.fx) * s.t; this.y = s.fy + (s.ty - s.fy) * s.t;
    if (s.t >= 1) { this.slide = null; this.g.play('block_stop'); }
  }
}

// Floor switch: pressed by blocks (or the player). Sets spec.flag once pressed by a block.
export class FloorSwitch extends Obj {
  constructor(g, spec) { super(g, spec); this.solid = false; this.pressed = !!(spec.flag && g.flags[spec.flag]); }
  update() {
    const g = this.g, cx = this.x, cy = this.y - 4;
    const area = { x: cx - 6, y: cy - 6, w: 12, h: 12 };
    let byBlock = false, byPlayer = false;
    for (const o of g.objects) if (o instanceof Block && !o.slide && overlap(area, o.solidBox())) byBlock = true;
    const p = g.player;
    if (p && p.lvl === this.lvl && overlap(area, { x: p.x - 3, y: p.y - 3, w: 6, h: 4 })) byPlayer = true;
    const now = byBlock || byPlayer || (this.spec.latch && this.pressed);
    if (now && !this.down) { g.play('switch'); g.spawnFX('dust', cx, this.y, { z: this.z }); }
    this.down = now;
    if (byBlock && this.spec.flag && !g.flags[this.spec.flag]) { g.setFlag(this.spec.flag, true); this.pressed = true; }
    this.sprite = now ? 'switch_down' : 'switch_up';
  }
}

// Ticking bomb (also liftable and throwable).
export class Bomb extends Obj {
  constructor(g, spec) {
    super(g, { ...spec, t: 'bomb_obj' });
    this.type = 'bomb';
    this.sprite = 'bomb';
    this.def = { fps: 8 };
    this.box = [-5, -8, 10, 8];
    this.solid = false;
    this.lift = true;
    this.shadow = 4;
    this.fuse = spec.fuse ?? 1.9;
  }
  update(dt) {
    if (this.carried) return;
    this.fuse -= dt;
    if (this.fuse <= 0) this.explode();
  }
  explode() {
    if (this.dead) return;
    this.dead = true;
    const p = this.g.player;
    if (p.carry === this) { p.carry = null; this.carried = false; this.x = p.x; this.y = p.y; this.lvl = p.lvl; this.z = p.z; }
    this.g.explode(this.x, this.y - 2, this.lvl, this.z);
  }
  draw(ctx, r) {
    const blink = this.fuse < 0.6 && Math.floor(this.fuse * 16) % 2 === 0;
    const img = spriteFrame(r.assets, 'bomb', r.time, 8);
    r.sprite(img, this.x, this.y, this.z, { hop: this.hop, flash: blink });
  }
}

export function createObject(g, spec) {
  switch (spec.t) {
    case 'sign': return new Sign(g, spec);
    case 'chest': return new Chest(g, spec);
    case 'door_locked': return new LockedDoor(g, spec);
    case 'shutter': return new Shutter(g, spec);
    case 'wall_cracked': case 'rock_cracked': case 'rock_big': return new Bombable(g, spec);
    case 'block': return new Block(g, spec);
    case 'switch': return new FloorSwitch(g, spec);
    case 'bomb': return new Bomb(g, spec);
    default: return new Obj(g, spec);
  }
}
