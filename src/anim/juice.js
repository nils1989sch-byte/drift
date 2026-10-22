// Juice helpers: small time-based state objects that gameplay only has to update() and read.
// All drawing keeps the pixel grid (style guide: no runtime rotation/scaling) – squash/wobble are done
// by re-sampling whole pixel rows, never by fractional scaling.
import { LEVEL } from '../engine/constants.js';
import { ease, clamp } from './tween.js';
import { TIMING } from './defs.js';

// ---------- springs -------------------------------------------------------------------------------

// Damped spring around 0. kick() adds velocity. value is in "units" (px for wobble, ratio for squash).
class Spring {
  constructor(k = 260, damp = 9) { this.k = k; this.damp = damp; this.v = 0; this.x = 0; }
  kick(impulse) { this.v += impulse; return this; }
  set(x) { this.x = x; return this; }
  update(dt) {
    // semi-implicit Euler, sub-stepped for stability
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (-this.k * this.x - this.damp * this.v) * h; this.x += this.v * h; }
    if (Math.abs(this.x) < 0.01 && Math.abs(this.v) < 0.05) { this.x = 0; this.v = 0; }
    return this;
  }
  get active() { return this.x !== 0 || this.v !== 0; }
}

// Bush/grass/sign wobble when walked through or hit. Read .px (integer top offset in px).
export class Wobble extends Spring {
  constructor(o = {}) { super(o.k ?? 220, o.damp ?? 7); this.max = o.max ?? 3; }
  hit(dir = 1, strength = 1) { return this.kick(dir * 40 * strength); }
  get px() { return Math.round(clamp(this.x, -this.max, this.max)); }
  draw(r, img, x, y, z = 0, o = {}) { drawWobble(r, img, x, y, z, this.x, o); }
}

// Squash & stretch: pop(+) squashes (flat & wide), pop(-) stretches. Read .s (−1..1).
export class Squash extends Spring {
  constructor(o = {}) { super(o.k ?? 320, o.damp ?? 10); }
  pop(amount = 0.35) { this.x = amount; this.v = 0; return this; }
  land(amount = 0.3) { return this.pop(amount); }
  jump(amount = 0.25) { return this.pop(-amount); }
  get s() { return clamp(this.x, -0.6, 0.6); }
  draw(r, img, x, y, z = 0, o = {}) { drawSquash(r, img, x, y, z, this.s, o); }
}

function screenPos(img, x, y, z, hop) {
  const ax = img.ax ?? (img.width >> 1), ay = img.ay ?? img.height - 1;
  return [Math.round(x - ax), Math.round(y - z * LEVEL - (hop || 0) - ay), ax, ay];
}

// Skew the sprite: bottom row stays, top row shifted by `amount` px (rows stepped in whole pixels).
export function drawWobble(r, img, x, y, z = 0, amount = 0, o = {}) {
  if (!img) return;
  if (Math.round(amount) === 0 || o.flash || o.flip) { r.sprite(img, x, y, z, o); return; }
  const ctx = r.ctx;
  const [dx, dy] = screenPos(img, x, y, z, o.hop);
  const h = img.height, w = img.width;
  const a = o.alpha ?? 1;
  if (a !== 1) ctx.globalAlpha = a;
  let row = 0;
  while (row < h) {
    const off = Math.round(amount * (1 - row / (h - 1 || 1)));
    let end = row + 1;
    while (end < h && Math.round(amount * (1 - end / (h - 1 || 1))) === off) end++;
    ctx.drawImage(img, 0, row, w, end - row, dx + off, dy + row, w, end - row);
    row = end;
  }
  if (a !== 1) ctx.globalAlpha = 1;
}

// Squash (s>0 → fewer rows, wider by 1–2 px via column duplication at the centre) / stretch (s<0) while
// keeping the foot anchored. Row resampling is nearest-neighbour on whole pixels.
export function drawSquash(r, img, x, y, z = 0, s = 0, o = {}) {
  if (!img) return;
  const h = img.height, w = img.width;
  const dh = Math.round(s * h * 0.3);
  if (dh === 0 || o.flash || o.flip) { r.sprite(img, x, y, z, o); return; }
  const ctx = r.ctx;
  const [dx, dy, , ay] = screenPos(img, x, y, z, o.hop);
  const H = Math.max(1, h - dh);
  const dw = Math.max(0, Math.round(s * w * 0.25)); // widen by duplicating the centre column when squashed
  const a = o.alpha ?? 1;
  if (a !== 1) ctx.globalAlpha = a;
  const top = dy + ay - Math.round((ay * H) / h);
  const half = w >> 1, l = dw >> 1, rr = dw - l;
  for (let j = 0; j < H; j++) {
    const sr = Math.min(h - 1, Math.floor((j * h) / H));
    const ty = top + j;
    if (dw > 0) {
      ctx.drawImage(img, 0, sr, half, 1, dx - l, ty, half, 1);
      ctx.drawImage(img, half, sr, w - half, 1, dx + half + rr, ty, w - half, 1);
      ctx.drawImage(img, half, sr, 1, 1, dx + half - l, ty, dw, 1);
    } else ctx.drawImage(img, 0, sr, w, 1, dx, ty, w, 1);
  }
  if (a !== 1) ctx.globalAlpha = 1;
}

// ---------- hit feedback --------------------------------------------------------------------------

// White hit-flash: flash.trigger(); r.sprite(img, x, y, z, { flash: flash.on })
export class HitFlash {
  constructor(dur = TIMING.flash) { this.dur = dur; this.t = 0; }
  trigger(dur = this.dur) { this.t = dur; return this; }
  update(dt) { if (this.t > 0) this.t = Math.max(0, this.t - dt); return this; }
  get active() { return this.t > 0; }
  // flickers every ~33 ms while active (2 SNES frames)
  get on() { return this.t > 0 && Math.floor(this.t / 0.033) % 2 === 0; }
}

// Invulnerability blink: blink.start(); if (!blink.visible) skip drawing (or use blink.alpha)
export class Blink {
  constructor(dur = TIMING.invuln, hz = TIMING.blinkHz) { this.dur = dur; this.hz = hz; this.t = 0; }
  start(dur = this.dur) { this.t = dur; return this; }
  stop() { this.t = 0; return this; }
  update(dt) { if (this.t > 0) this.t = Math.max(0, this.t - dt); return this; }
  get active() { return this.t > 0; }
  get visible() { return this.t <= 0 || Math.floor(this.t * this.hz * 2) % 2 === 0; }
  get alpha() { return this.visible ? 1 : 0.25; }
}

// Knockback with ease-out. kb.start(entity.x, entity.y, attacker.x, attacker.y)
// each step: const d = kb.update(dt); try moving entity by d.dx, d.dy (collision is gameplay's job).
export class Knockback {
  constructor(o = {}) { this.dist = o.dist ?? TIMING.knockbackDist; this.dur = o.dur ?? TIMING.knockback; this.t = 1; this.T = 0; this.nx = 0; this.ny = 0; this.hopH = 0; this.out = { dx: 0, dy: 0, hop: 0 }; }
  start(x, y, fromX, fromY, o = {}) {
    let nx = x - fromX, ny = y - fromY;
    const l = Math.hypot(nx, ny);
    if (l < 1e-3) { nx = 0; ny = 1; } else { nx /= l; ny /= l; }
    // ALttP pushes along the dominant axis only
    if (o.axis !== false) { if (Math.abs(nx) > Math.abs(ny)) { nx = Math.sign(nx); ny = 0; } else { ny = Math.sign(ny); nx = 0; } }
    this.nx = nx; this.ny = ny;
    this.D = o.dist ?? this.dist; this.T = o.dur ?? this.dur; this.hopH = o.hop ?? 0; this.t = 0; this.prev = 0;
    return this;
  }
  // start from a direction vector instead of a source point
  startDir(dx, dy, o = {}) { return this.start(0, 0, -dx, -dy, o); }
  update(dt) {
    const o = this.out; o.dx = o.dy = 0; o.hop = 0;
    if (!this.active) return o;
    this.t = Math.min(this.T, this.t + dt);
    const p = this.t / this.T;
    const d = ease.cubicOut(p) * this.D;
    const step = d - this.prev; this.prev = d;
    o.dx = this.nx * step; o.dy = this.ny * step; o.hop = ease.arc(p) * this.hopH;
    return o;
  }
  stop() { this.t = this.T; }
  get active() { return this.T > 0 && this.t < this.T; }
  get progress() { return this.T ? this.t / this.T : 1; }
}

// Hitstop: freeze gameplay for a couple of frames. if (hitstop.update(dt)) return; // frozen
export class HitStop {
  constructor() { this.t = 0; }
  trigger(sec = TIMING.hitstop) { this.t = Math.max(this.t, sec); }
  update(dt) { if (this.t > 0) { this.t -= dt; return true; } return false; }
  get active() { return this.t > 0; }
}

// Vertical physics for thrown pots, dropped pickups, bouncing items. hop in px above ground.
export class Hop {
  constructor(o = {}) { this.g = o.g ?? 420; this.bounce = o.bounce ?? 0.45; this.minV = o.minV ?? 40; this.hop = 0; this.v = 0; this.landed = true; this.bounces = 0; this.justLanded = false; }
  launch(v0 = 120, hop = this.hop) { this.v = v0; this.hop = hop; this.landed = false; this.bounces = 0; return this; }
  update(dt) {
    this.justLanded = false;
    if (this.landed) return this;
    this.v -= this.g * dt; this.hop += this.v * dt;
    if (this.hop <= 0) {
      this.hop = 0;
      this.justLanded = true; this.bounces++;
      if (-this.v * this.bounce > this.minV) this.v = -this.v * this.bounce;
      else { this.v = 0; this.landed = true; }
    }
    return this;
  }
  get px() { return Math.round(this.hop); }
}

// ---------- pure time functions -------------------------------------------------------------------

// Item-get arc: item rises out of the chest / above the hero's head and hovers.
// t = seconds since start. Returns { hop, alpha, bob } – add hop to the item's draw hop.
export function itemGetArc(t, o = {}) {
  const rise = o.rise ?? 0.45, height = o.height ?? 18;
  if (t < rise) { const p = t / rise; return { hop: Math.round(ease.backOut(p) * height), alpha: Math.min(1, p * 3), p }; }
  return { hop: height + Math.round(Math.sin((t - rise) * 4) * 1), alpha: 1, p: 1 };
}

// Pickup thrown out of a bush / enemy: small hop arc with one bounce. t seconds → hop px.
export function dropArc(t, height = 12, dur = 0.45) {
  if (t >= dur) return 0;
  const p = t / dur;
  if (p < 0.7) return Math.round(ease.arc(p / 0.7) * height);
  return Math.round(ease.arc((p - 0.7) / 0.3) * height * 0.3);
}

// Floating pickup bob (heart containers, keys). Integer px.
export const bob = (time, amp = 1, speed = 3, phase = 0) => Math.round(Math.sin(time * speed + phase) * amp);

// Chest opening: lid pop. t seconds → { hop, squash } for drawing chest_open with drawSquash.
export function chestPop(t) {
  if (t < 0.08) return { hop: 0, squash: 0.25 * (t / 0.08) };
  const p = clamp((t - 0.08) / 0.35);
  return { hop: Math.round(ease.arc(Math.min(1, p * 2)) * 2), squash: -0.25 * Math.sin(p * Math.PI) * (1 - p) };
}

// Slow pulse 0..1 (glow, selection)
export const pulse = (time, hz = 1) => 0.5 + 0.5 * Math.sin(time * hz * Math.PI * 2);

// Screen shake helper for gameplay: shake(camera, 'small'|'medium'|'big')
export function shake(camera, size = 'small') {
  const p = { small: [1, 0.12], medium: [2, 0.2], big: [4, 0.4] }[size] || [size, 0.2];
  camera?.shake?.(p[0], p[1]);
}
