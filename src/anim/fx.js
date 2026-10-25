// Particle / effect system with pooling. Effects are Drawables { x, y, z, layer?, sortBias?, draw(ctx, r) }.
// EVERYTHING is drawn via r.sprite(canvas) + r.shadow – baked canvases (src/anim/bake.js) replace direct ctx
// drawing, so effects work in the 2D renderer and in the 3D renderer (where r.ctx is a no-op).
// Heights: `hop` (px above the ground plane) + `z` (height level). Glowing bits pass { flash } in 3D (emissive →
// bloom = additive-looking embers).
import { LEVEL, TILE } from '../engine/constants.js';
import { FX_TIMING } from './defs.js';
import { tween } from './tween.js';
import {
  C, bake, bakeFrames, rect, disc, ring, star, dot, ember, sparkleSprite, textSprite, floorRing, drawPixelText as drawText,
} from './bake.js';
import { registerBattleFX } from './fx_battle.js';
import { registerFarmFX } from './fx_farm.js';

export const FX_COLORS = C;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const DIRV = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

// Legacy helper kept for callers that draw into a real 2D ctx (UI overlays, demo labels).
export function drawPixelText(ctx, text, x, y, col = C.white, shadow = C.ink) { drawText(ctx, text, x, y, col, shadow, 1); }

// ---------- baked fallback sprites for the classic effects (ws 1, anchor = foot) ----------
const B = {
  slash: (dir) => bakeFrames('slash_' + dir, 3, 32, 32, 16, 23, 1, (g, P, t) => {
    const [dx, dy] = DIRV[dir] || DIRV.down;
    const base = Math.atan2(dy, dx), R = 11, sweep = Math.PI * 0.9;
    const a0 = base - sweep / 2, head = a0 + sweep * Math.min(1, 0.45 + t * 0.8);
    const col = t < 0.34 ? C.white : t < 0.67 ? C.metal_lt : C.metal_md;
    const cx = P.ax, cy = P.ay - 7;
    for (let k = 0; k <= 14; k++) {
      const a = a0 + (head - a0) * (k / 14);
      if (head - a > sweep * (0.9 - t * 0.5)) continue;
      const s = k > 10 ? 2 : 1;
      rect(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.85, s, s, col);
    }
  }),
  poof: () => bakeFrames('poof', 5, 24, 20, 12, 19, 1, (g, P, t) => {
    const r0 = 2 + t * 6, col = [C.white, C.rock_hi, C.rock_lt, C.rock_md, C.rock_md][Math.round(t * 4)];
    for (let k = 0; k < 4; k++) { const a = k * (Math.PI / 2) + 0.7; disc(g, P.ax + Math.cos(a) * r0, P.ay - 5 + Math.sin(a) * r0 * 0.7, Math.max(0, 3.2 - t * 3), col); }
    if (t < 0.4) disc(g, P.ax, P.ay - 5, 3 - t * 5, C.white);
  }),
  spark: () => bakeFrames('spark', 3, 13, 13, 6, 6, 1, (g, P, t) => {
    const s = Math.round(5 * (1 - t)) + 1, col = t < 0.34 ? C.white : t < 0.67 ? C.fx_yellow : C.fx_orange;
    star(g, P.ax, P.ay, s, col, t < 0.5 ? C.white : null);
  }),
  splash: () => bakeFrames('splash', 4, 24, 18, 12, 14, 1, (g, P, t) => {
    const r = 2 + t * 8; ring(g, P.ax, P.ay, r, r * 0.45, t < 0.5 ? C.foam : C.water_lt);
    const h = Math.round(Math.sin(t * Math.PI) * 8) + 1;
    rect(g, P.ax - 3, P.ay - h, 1, h, C.water_lt); rect(g, P.ax + 3, P.ay - h, 1, h, C.water_lt); rect(g, P.ax, P.ay - h - 3, 1, h, C.foam);
  }),
  dust: () => bakeFrames('dust', 3, 8, 8, 4, 7, 1, (g, P, t) => disc(g, P.ax, P.ay - 1 - t * 3, 2.2 - t * 1.6, t < 0.5 ? C.dirt_hi : C.dirt_lt)),
  sparkle: () => bakeFrames('sparkle', 4, 9, 9, 4, 4, 1, (g, P, t) => star(g, P.ax, P.ay, Math.max(1, Math.round(Math.sin((0.15 + t * 0.7) * Math.PI) * 4)), t < 0.5 ? C.white : C.fx_yellow, C.white)),
  explosion: () => bakeFrames('explosion', 6, 36, 36, 18, 33, 1, (g, P, t) => {
    const r = 3 + t * 12, cy = P.ay - 9;
    if (t < 0.75) disc(g, P.ax, cy, r, C.fx_orange);
    if (t < 0.6) disc(g, P.ax, cy, r * 0.7, C.fx_yellow);
    if (t < 0.3) disc(g, P.ax, cy, r * 0.45, C.white);
    if (t >= 0.55) for (let k = 0; k < 7; k++) { const a = k * 0.9; disc(g, P.ax + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 3.5 * (1 - t) + 0.5, C.rock_md); }
  }),
  heart_pop: () => bakeFrames('heart_pop', 3, 9, 14, 4, 13, 1, (g, P, t) => heart(g, P.ax, P.ay - 6 - t * 4, t < 0.5 ? C.heart_hi : C.heart_md)),
  heart: () => bake('heart_small', 8, 7, 4, 6, 1, (g, P) => heart(g, P.ax, P.ay - 3, C.heart_md)),
  smoke: () => bakeFrames('smoke', 4, 10, 10, 5, 5, 1, (g, P, t) => disc(g, P.ax, P.ay, 1.5 + t * 2.8, t < 0.4 ? C.rock_lt : C.rock_md)),
  ripple: () => bakeFrames('ripple', 5, 20, 12, 10, 6, 1, (g, P, t) => { const r = 2 + t * 7; ring(g, P.ax, P.ay, r, r * 0.45, C.foam); }),
  scorch: () => bake('scorch', 22, 9, 11, 4, 1, (g, P) => { g.fillStyle = 'rgba(48,40,72,0.6)'; for (let i = -3; i <= 3; i++) { const w = Math.round(10 * Math.sqrt(1 - (i * i) / 12.25)); g.fillRect(P.ax - w, P.ay + i, w * 2, 1); } }),
  leaf: (col) => bakeFrames('leaf_' + col, 2, 5, 5, 2, 4, 1, (g, P, t, i) => {
    if (i === 0) { rect(g, 1, 1, 2, 1, col); rect(g, 0, 2, 4, 1, col); rect(g, 1, 3, 2, 1, C.grass_md); rect(g, 3, 3, 1, 1, C.grass_ink); rect(g, 1, 1, 1, 1, C.grass_hi); }
    else { rect(g, 2, 0, 1, 4, col); rect(g, 1, 1, 3, 2, col); rect(g, 3, 2, 1, 2, C.grass_md); rect(g, 3, 4, 1, 1, C.grass_ink); rect(g, 1, 1, 1, 1, C.grass_hi); }
  }),
  grassBit: (col) => bakeFrames('gbit_' + col, 2, 3, 4, 1, 3, 1, (g, P, t, i) => { rect(g, 1, 0, 1, 3, C.grass_ink); rect(g, 0, 0, 1, 3, col); if (i) rect(g, 1, 0, 1, 1, col); }),
  chunk: (col, dk) => bake(`chunk:${col}:${dk}`, 3, 3, 1, 2, 1, (g) => { rect(g, 0, 0, 3, 2, col); rect(g, 0, 2, 3, 1, dk); rect(g, 0, 0, 1, 1, C.rock_hi); }),
  butterfly: (a, b) => bakeFrames(`bfly:${a}:${b}`, 2, 6, 4, 3, 3, 1, (g, P, t, i) => {
    rect(g, 3, 1, 1, 2, C.shadow);
    if (i === 0) { rect(g, 0, 0, 2, 2, a); rect(g, 4, 0, 2, 2, a); rect(g, 0, 0, 1, 1, b); rect(g, 5, 0, 1, 1, b); }
    else { rect(g, 2, 0, 1, 2, a); rect(g, 4, 0, 1, 2, a); }
  }),
};
function heart(g, x, y, col) {
  x = Math.round(x); y = Math.round(y);
  rect(g, x - 3, y - 2, 2, 2, col); rect(g, x + 1, y - 2, 2, 2, col);
  rect(g, x - 3, y - 1, 6, 2, col); rect(g, x - 2, y + 1, 4, 1, col); rect(g, x - 1, y + 2, 2, 1, col);
  rect(g, x - 2, y - 2, 1, 1, C.white);
}
const memo = new Map();
const baked = (k, f) => { if (!memo.has(k)) memo.set(k, f()); return memo.get(k); };

// ---------- particle ------------------------------------------------------------------------------
let GEN = 0;
class P {
  constructor() { this.reset(); }
  reset() {
    this.gen = ++GEN;
    this.kind = 'bit'; this.type = ''; this.alive = false; this.hidden = false; this.keep = false;
    this.x = this.y = this.z = 0; this.hop = 0; this.vx = this.vy = this.vh = 0;
    this.g = 0; this.drag = 0; this.bounce = 0; this.term = 0; this.sway = 0; this.phase = 0;
    this.t = 0; this.life = 1; this.fade = 0.3; this.fadeIn = 0; this.alpha = 1;
    this.frames = null; this.img = null; this.ms = 60; this.fi = 0; this.spinMs = 0; this.flip = false; this.glow = false;
    this.shadowR = 0; this.shadowA = 0.24; this.shadow = false; this.size = 1;
    this.layer = undefined; this.sortBias = 0;
    this.dir = 'down'; this.landed = false; this.data = null; this.ambient = null;
    this.onUpdate = null; this.onDraw = null; this.onEnd = null; this.loopFrames = false;
  }
  get progress() { return Math.max(0, Math.min(1, this.t / this.life)); }
  get a() {
    const p = this.progress;
    let a = this.alpha;
    if (this.fade > 0 && p > 1 - this.fade) a *= (1 - p) / this.fade;
    if (this.fadeIn && this.t < this.fadeIn) a *= this.t / this.fadeIn;
    return Math.max(0, Math.min(1, a));
  }
  draw(ctx, r) { try { DRAW(this, r); } catch (e) { /* never break the frame for an effect */ } }
}

function DRAW(p, r) {
  if (p.onDraw) { p.onDraw(p, r); return; }
  const a = p.a; if (a <= 0.01) return;
  if (p.shadowR && r.shadow) {
    const k = 1 - Math.min(1, p.hop / 48);
    r.shadow(p.x, p.y, p.z, p.shadowR, Math.max(1, p.shadowR * 0.5), p.shadowA * k * Math.min(1, a * 1.5));
  }
  let img = p.img;
  const f = p.frames;
  if (f && f.length) {
    if (p.kind === 'anim') { const i = Math.floor((p.t * 1000) / p.ms); img = f[p.loopFrames ? i % f.length : Math.min(f.length - 1, i)]; }
    else if (p.spinMs) img = f[(p.fi + Math.floor((p.t * 1000) / p.spinMs)) % f.length];
    else img = f[p.fi % f.length];
  }
  if (!img) return;
  let al = a;
  if (p.kind === 'mote') { const tw = 0.5 + 0.5 * Math.sin(p.t * p.data + p.phase); al *= tw; if (al < 0.05) return; }
  r.sprite(img, p.x, p.y, p.z, { hop: p.hop, alpha: al, flip: p.flip, flash: p.glow && r.is3D });
}

// ---------- system --------------------------------------------------------------------------------
export function createFX(assets) {
  const S = () => (assets && assets.sprites) || {};
  const frames = (key) => { const v = S()[key]; return Array.isArray(v) ? (v.length ? v : null) : v ? [v] : null; };
  const MAX = 900;
  const pool = [], active = [];
  const out = [];
  const amb = { butterflies: 0, motes: 0, leaves: 0, world: null, view: null };

  function get() {
    let p = pool.pop();
    if (!p) {
      if (active.length >= MAX) {
        const i = active.findIndex((q) => !q.keep);
        p = active.splice(i < 0 ? 0 : i, 1)[0];
        if (p.ambient) amb[p.ambient]--;
      } else p = new P();
    }
    p.reset(); p.alive = true; active.push(p);
    return p;
  }
  // safe external handle for a pooled particle (pool reuse can't hit the wrong effect)
  function handle(p, extra = {}) {
    const gen = p.gen;
    const h = {
      get alive() { return p.alive && p.gen === gen; },
      get x() { return p.x; }, set x(v) { if (h.alive) p.x = v; },
      get y() { return p.y; }, set y(v) { if (h.alive) p.y = v; },
      get z() { return p.z; }, set z(v) { if (h.alive) p.z = v; },
      get t() { return p.t; },
      close() { if (h.alive) { if (p.data?.close) p.data.close(p); else p.life = Math.min(p.life, p.t); } },
      kill() { if (h.alive) p.life = p.t; },
      particle: () => (h.alive ? p : null),
      ...extra,
    };
    return h;
  }

  // one-shot sprite animation (frames from art or baked fallback)
  function anim(type, frs, x, y, o, ms) {
    const p = get();
    p.kind = 'anim'; p.type = type; p.x = x; p.y = y; p.z = o.z || 0; p.hop = o.hop ?? 0;
    p.frames = frs; p.ms = ms;
    p.life = ((frs?.length || 4) * ms) / 1000;
    p.fade = o.fade ?? 0; p.dir = o.dir || 'down';
    p.sortBias = o.sortBias ?? 2; p.layer = o.layer; p.flip = !!o.flip; p.glow = !!o.glow; p.alpha = o.alpha ?? 1;
    p.t = -(o.delay || 0);
    return p;
  }

  // physical bit flying in an arc with gravity and a ground shadow
  function bit(type, x, y, o, cfg) {
    const p = get();
    p.kind = 'bit'; p.type = type;
    const ang = cfg.ang ?? rnd(0, Math.PI * 2), sp = rnd(cfg.speed[0], cfg.speed[1]);
    p.x = x + (cfg.spread ? rnd(-cfg.spread, cfg.spread) : 0); p.y = y + (cfg.spread ? rnd(-cfg.spread, cfg.spread) * 0.6 : 0);
    p.z = o.z || 0;
    p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp * (cfg.flat ?? 0.7);
    p.hop = (o.hop ?? 0) + rnd(cfg.hop?.[0] ?? 2, cfg.hop?.[1] ?? 6);
    p.vh = rnd(cfg.vh[0], cfg.vh[1]); p.g = cfg.g ?? 360; p.drag = cfg.drag ?? 0.5;
    p.bounce = cfg.bounce ?? 0; p.term = cfg.term ?? 0; p.sway = cfg.sway ?? 0; p.phase = rnd(0, 6.28);
    p.life = rnd(cfg.life[0], cfg.life[1]); p.fade = cfg.fade ?? 0.3;
    p.frames = cfg.frames || null; p.img = cfg.img ? (typeof cfg.img === 'function' ? cfg.img() : cfg.img) : null;
    p.fi = (Math.random() * 8) | 0; p.spinMs = cfg.spinMs || 0; p.flip = Math.random() < 0.5;
    p.shadowR = cfg.shadow ?? 1; p.glow = !!cfg.glow;
    p.sortBias = cfg.sortBias ?? 1; p.layer = cfg.layer ?? o.layer;
    p.t = -(cfg.delay || 0);
    return p;
  }

  // floor decal (layer floor) – frames advance with progress
  function decal(type, frs, x, y, o, life) {
    const p = get();
    p.kind = 'decal'; p.type = type; p.x = x; p.y = y; p.z = o.z || 0; p.layer = 'floor';
    p.frames = frs; p.life = life; p.fade = o.fade ?? 0.5; p.alpha = o.alpha ?? 1; p.ms = (life * 1000) / Math.max(1, frs?.length || 1);
    p.kind = 'anim'; p.loopFrames = false; p.sortBias = -10;
    p.t = -(o.delay || 0);
    return p;
  }

  const art = (key, fallback) => frames(key) || baked(key + ':fb', fallback);

  const SPAWN = {
    slash(x, y, o) {
      const dir = o.dir || 'down';
      const [dx, dy] = DIRV[dir] || DIRV.down;
      const off = o.offset ?? 0;
      const frs = frames('fx_slash_' + dir) || frames('fx_slash') || baked('slash_' + dir, () => B.slash(dir));
      const p = anim('slash', frs, x + dx * off, y + dy * off, { ...o, hop: o.hop ?? 0, sortBias: dir === 'up' ? -1 : 3 }, o.ms ?? FX_TIMING.slash);
      p.dir = dir;
      return p;
    },
    poof(x, y, o) {
      const p = anim('poof', art('fx_poof', B.poof), x, y, { ...o, sortBias: 4 }, FX_TIMING.poof);
      const sm = baked('smoke', B.smoke);
      for (let k = 0; k < 4; k++) { const s = bit('smoke', x, y, o, { ang: k * 1.571 + 0.78, speed: [18, 26], vh: [6, 14], g: 0, hop: [3, 6], life: [0.3, 0.4], fade: 0.6, shadow: 0, frames: sm, delay: 0.05 }); s.kind = 'anim'; s.ms = 90; }
      return p;
    },
    leaves(x, y, o) {
      const fr = frames('fx_leaf');
      const n = o.count ?? (6 + ((Math.random() * 3) | 0));
      const cols = o.colors || [C.grass_lt, C.grass_hi, C.grass_lt, C.grass_md];
      for (let k = 0; k < n; k++) {
        const col = pick(cols);
        bit('leaf', x, y, o, {
          ang: (k / n) * Math.PI * 2 + rnd(-0.3, 0.3), speed: [22, 52], vh: [70, 125], g: 330, hop: [4, 9], term: 32, sway: 22,
          life: FX_TIMING.leafLife.map((v) => v + 0.15), fade: 0.35, frames: fr || baked('leaf_' + col, () => B.leaf(col)), spinMs: rnd(70, 110), shadow: 1,
        });
      }
      if (o.grass !== false) SPAWN.grass(x, y, { ...o, count: 3 });
    },
    grass(x, y, o) {
      const fr = frames('fx_grass_bit');
      for (let k = 0; k < (o.count ?? 6); k++) {
        const col = pick([C.grass_lt, C.grass_hi]);
        bit('grass', x, y, o, { speed: [14, 38], vh: [50, 95], g: 380, hop: [1, 4], term: 45, sway: 12, life: FX_TIMING.grassLife, frames: fr || baked('gbit_' + col, () => B.grassBit(col)), spinMs: 80, spread: 4 });
      }
    },
    spark(x, y, o) {
      const p = anim('spark', art('fx_spark', B.spark), x, y, { ...o, hop: o.hop ?? 8, sortBias: 6, glow: true }, FX_TIMING.spark);
      for (let k = 0; k < 4; k++) bit('spark_bit', x, y, { ...o, hop: (o.hop ?? 8) - 3 }, { ang: k * 1.571 + 0.785 + rnd(-0.2, 0.2), speed: [70, 100], vh: [-10, 10], g: 0, hop: [0, 0], life: [0.12, 0.18], fade: 0.5, img: () => ember(C.white, C.fx_yellow, 1), shadow: 0, sortBias: 6, glow: true });
      return p;
    },
    splash(x, y, o) {
      const p = anim('splash', art('fx_splash', B.splash), x, y, { ...o, sortBias: 2 }, FX_TIMING.splash);
      for (let k = 0; k < 6; k++) bit('drop', x, y, o, { speed: [15, 40], vh: [70, 115], g: 420, hop: [0, 2], life: [0.3, 0.45], fade: 0.3, img: dot(pick([C.foam, C.water_lt, C.water_hi]), 1), shadow: 0 });
      SPAWN.ripple(x, y, o);
      return p;
    },
    ripple(x, y, o) { return decal('ripple', baked('ripple', B.ripple), x, y, o, 0.5); },
    dust(x, y, o) {
      const [dx, dy] = DIRV[o.dir] || [0, 0];
      const p = anim('dust', art('fx_dust', B.dust), x - dx * 3 + rnd(-1, 1), y - dy * 2, { ...o, sortBias: -3 }, FX_TIMING.dust);
      p.alpha = 0.85; p.vx = -dx * 8; p.vy = -dy * 6; p.vh = 6;
      return p;
    },
    sparkle(x, y, o) {
      const n = o.count ?? 3, rad = o.radius ?? 8;
      const frs = art('fx_sparkle', B.sparkle);
      for (let k = 0; k < n; k++) anim('sparkle', frs, x + rnd(-rad, rad), y + rnd(-2, 2), { ...o, hop: (o.hop ?? 8) + rnd(-rad * 0.6, rad * 0.6), delay: (o.delay || 0) + k * (o.stagger ?? 0.09), sortBias: 8, glow: true }, FX_TIMING.sparkle);
    },
    explosion(x, y, o) {
      const p = anim('explosion', art('fx_explosion', B.explosion), x, y, { ...o, sortBias: 8, glow: true }, FX_TIMING.explosion);
      const sm = frames('fx_poof') || baked('smoke', B.smoke);
      for (let k = 0; k < 6; k++) { const s = bit('smoke', x, y, o, { ang: (k / 6) * 6.28, speed: [8, 18], vh: [10, 22], g: 0, hop: [6, 14], life: [0.5, 0.8], fade: 0.5, shadow: 0, delay: rnd(0.12, 0.25), frames: sm, sortBias: 9 }); s.kind = 'anim'; s.ms = 120; }
      const rb = frames('fx_rock_bit');
      for (let k = 0; k < 6; k++) bit('debris', x, y, o, { speed: [40, 75], vh: [80, 130], g: 420, bounce: 0.35, life: [0.6, 0.9], frames: rb, img: B.chunk(C.rock_md, C.rock_dk), spinMs: 90 });
      decal('scorch', [baked('scorch', B.scorch)], x, y, { ...o, fade: 0.4 }, 2.5);
      o.camera?.shake?.(3, 0.3);
      return p;
    },
    heart_pop(x, y, o) {
      const p = anim('heart_pop', art('fx_heart_pop', B.heart_pop), x, y, { ...o, hop: o.hop ?? 6, sortBias: 6 }, FX_TIMING.heart_pop);
      for (let k = 0; k < 3; k++) bit('heart', x, y, o, { ang: -Math.PI / 2 + (k - 1) * 0.7, speed: [14, 20], vh: [28, 36], g: 0, hop: [8, 10], life: [0.5, 0.6], fade: 0.5, shadow: 0, img: baked('heart', B.heart), delay: k * 0.06, sortBias: 6 });
      return p;
    },
    rocks(x, y, o) {
      const fr = frames('fx_rock_bit');
      for (let k = 0; k < (o.count ?? 6); k++) bit('rock', x, y, o, { ang: (k / 6) * 6.28 + rnd(-0.4, 0.4), speed: [28, 60], vh: [60, 115], g: 440, bounce: 0.4, hop: [3, 8], life: FX_TIMING.rockLife, frames: fr, img: B.chunk(pick([C.rock_md, C.rock_lt]), C.rock_dk), spinMs: 100, shadow: 1 });
      SPAWN.dust(x - 4, y, {}); SPAWN.dust(x + 4, y, {});
    },
    shards(x, y, o) {
      const fr = frames('fx_pot_bit');
      for (let k = 0; k < (o.count ?? 6); k++) bit('shard', x, y, o, { ang: (k / 6) * 6.28 + rnd(-0.4, 0.4), speed: [28, 60], vh: [60, 115], g: 440, bounce: 0.35, hop: [3, 8], life: FX_TIMING.rockLife, frames: fr, img: B.chunk(pick([C.dirt_md, C.dirt_lt, C.wood_md]), C.dirt_dk), spinMs: 100, shadow: 1 });
      SPAWN.dust(x, y, {});
    },
    // damage numbers: rise ~12 px in 0.6 s and fade (MONSTER_FARM_GUIDE §2). opts.eff: 2 → yellow + 'STARK!', 0.5 → grey + 'SCHWACH...'
    damage_number(x, y, o) {
      const eff = o.eff ?? 1;
      const col = o.color || (eff > 1 ? C.fx_yellow : eff < 1 ? C.metal_md : C.white);
      const p = get();
      p.kind = 'bit'; p.type = 'damage'; p.img = textSprite(String(o.value ?? o.text ?? 1), col, o.big || eff > 1 ? 2 : 1);
      p.x = x + rnd(-3, 3); p.y = y; p.z = o.z || 0; p.hop = o.hop ?? 22; p.vh = 20; p.g = 0; p.layer = 'top';
      p.life = 0.75; p.fade = 0.35; p.sortBias = 20;
      p.onUpdate = (q) => { q.vh = Math.max(0, 20 - q.t * 40) + (q.t < 0.08 ? 60 : 0); };
      if (eff !== 1 && o.label !== false) SPAWN.text(x, y, { z: o.z, hop: (o.hop ?? 22) + 9, text: eff > 1 ? 'STARK!' : 'SCHWACH...', color: col, life: 0.8, rise: 14 });
      return p;
    },
    text(x, y, o) {
      const p = get();
      p.kind = 'bit'; p.type = 'text'; p.img = textSprite(String(o.text ?? ''), o.color || C.white, o.size ?? 1);
      p.x = x; p.y = y; p.z = o.z || 0; p.hop = o.hop ?? 20; p.vh = o.rise ?? 18; p.g = 0;
      p.life = o.life ?? 1.0; p.fade = 0.4; p.layer = 'top'; p.sortBias = 20; p.t = -(o.delay || 0);
      return p;
    },
  };
  SPAWN.bush = SPAWN.leaves; SPAWN.hit = SPAWN.spark; SPAWN.death = SPAWN.poof; SPAWN.pot = SPAWN.shards; SPAWN.damage = SPAWN.damage_number;

  function stepPhysics(p, dt) {
    if (p.kind === 'butterfly' || p.kind === 'mote' || p.kind === 'custom') return;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'anim') { p.hop += p.vh * dt; return; }
    p.vh -= p.g * dt;
    if (p.term && p.vh < -p.term) { p.vh = -p.term; p.x += Math.sin(p.t * 9 + p.phase) * p.sway * dt; }
    p.hop += p.vh * dt;
    if (p.hop <= 0 && p.g > 0) {
      p.hop = 0;
      if (p.bounce && -p.vh * p.bounce > 25) { p.vh = -p.vh * p.bounce; p.vx *= 0.6; p.vy *= 0.6; }
      else { p.vh = 0; p.vx *= 0.2; p.vy *= 0.2; if (!p.landed) { p.landed = true; p.spinMs = 0; if (p.life - p.t > 0.25) p.life = Math.min(p.life, p.t + 0.35); } }
    }
    if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
  }

  function kill(i) {
    const p = active[i];
    if (p.ambient) amb[p.ambient]--;
    if (p.onEnd) { const f = p.onEnd; p.onEnd = null; try { f(p); } catch (e) { console.error(e); } }
    p.alive = false;
    active[i] = active[active.length - 1]; active.pop();
    pool.push(p);
  }

  // ---------- ambient ----------
  const BUTTERFLY_COLORS = [[C.white, C.fx_yellow], [C.gold_lt, C.fx_orange], [C.fx_cyan, C.blue_lt], [C.heart_hi, C.white]];
  function ambient(world, camera, o = {}) {
    if (!world || !camera || world.ambient === false) return;
    const scale = camera.scale || 1;
    const vw = (camera.viewW || 640) / scale, vh = (camera.viewH || 480) / scale;
    const cx = camera.x, cy = camera.y;
    amb.view = { x0: cx - vw / 2 - 48, x1: cx + vw / 2 + 48, y0: cy - vh / 2 - 64, y1: cy + vh / 2 + 80 };
    amb.world = world;
    const outdoor = o.outdoor ?? world.outdoor ?? !(world.plinth === 'stone' || /dungeon|cave|house|interior|boss|hoehle/i.test(world.id || ''));
    const night = o.night ?? false;
    const density = o.density ?? 1;
    const lim = outdoor ? { butterflies: night ? 0 : Math.round(3 * density), motes: Math.round((night ? 16 : 12) * density), leaves: Math.round(3 * density) }
      : { butterflies: 0, motes: Math.round(10 * density), leaves: 0 };
    const rx = () => rnd(Math.max(0, cx - vw / 2), Math.min(world.pxW, cx + vw / 2));
    const ry = () => rnd(Math.max(0, cy - vh / 2), Math.min(world.pxH, cy + vh / 2 + 16));
    const okGround = (x, y) => { const d = world.def?.(Math.floor(x / TILE), Math.floor(y / TILE)); return d && !d.solid; };
    if (amb.butterflies < lim.butterflies && Math.random() < 0.02) {
      let bx = rx(), by = ry();
      for (let k = 0; k < 8; k++) { const x = rx(), y = ry(); if (/flower/.test(world.tileAtPx?.(x, y) || '')) { bx = x; by = y; break; } }
      if (okGround(bx, by)) {
        const p = get(); const cols = pick(BUTTERFLY_COLORS);
        p.kind = 'butterfly'; p.type = 'butterfly'; p.ambient = 'butterflies'; amb.butterflies++;
        p.x = bx; p.y = by; p.z = world.heightAtPx(bx, by); p.hop = rnd(6, 14); p.phase = rnd(0, 6);
        p.life = rnd(14, 24); p.fade = 0.1; p.fadeIn = 1; p.shadowR = 1; p.shadowA = 0.16;
        p.frames = frames('fx_butterfly') || baked(`bfly:${cols}`, () => B.butterfly(cols[0], cols[1])); p.spinMs = 90;
        p.data = { tx: bx, ty: by, th: 10, wait: 0 };
      }
    }
    if (amb.motes < lim.motes && Math.random() < 0.15) {
      const p = get(); const x = rx(), y = ry();
      p.kind = 'mote'; p.type = 'mote'; p.ambient = 'motes'; amb.motes++;
      p.x = x; p.y = y; p.z = world.heightAtPx(x, y); p.hop = rnd(8, 40);
      p.vx = rnd(-4, 4) + (outdoor ? 3 : 0); p.vy = rnd(-2, 2); p.vh = rnd(-1.5, 2);
      p.life = rnd(4, 8); p.fade = 0.3; p.fadeIn = 1; p.layer = 'top'; p.phase = rnd(0, 6); p.data = rnd(1.5, 4);
      const col = night && outdoor ? pick([C.magic, C.grass_hi, C.gold_lt]) : outdoor ? pick([C.white, '#fff6c8', C.gold_lt]) : pick([C.rock_hi, C.metal_lt]);
      p.img = Math.random() < 0.3 ? sparkleSprite(col, 1.5) : ember(col, col, 0.5);
      p.glow = night; p.alpha = outdoor ? 0.85 : 0.5;
    }
    if (amb.leaves < lim.leaves && Math.random() < 0.012) {
      const x = rx(), y = ry();
      if (okGround(x, y)) {
        const col = pick([C.grass_lt, C.gold_lt, C.grass_md]);
        const p = bit('leaf', x, y, { z: world.heightAtPx(x, y) }, { speed: [3, 8], vh: [-5, 0], g: 60, hop: [50, 70], term: 14, sway: 26, life: [5, 7], fade: 0.15, frames: frames('fx_leaf') || baked('leaf_' + col, () => B.leaf(col)), spinMs: 140 });
        p.ambient = 'leaves'; amb.leaves++; p.fadeIn = 0.6; p.drag = 0;
      }
    }
  }

  function updateAmbient(p, dt) {
    const v = amb.view, w = amb.world;
    if (v && (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1)) p.t = Math.max(p.t, p.life - 0.3);
    if (p.kind === 'butterfly') {
      const d = p.data;
      if (d.wait > 0) d.wait -= dt;
      const dx = d.tx - p.x, dy = d.ty - p.y, dist = Math.hypot(dx, dy);
      if (dist < 3 || Math.random() < 0.004) { d.tx = p.x + rnd(-40, 40); d.ty = p.y + rnd(-28, 28); d.th = rnd(4, 18); if (Math.random() < 0.25) d.wait = rnd(0.5, 1.5); }
      const sp = d.wait > 0 ? 0 : 22;
      p.vx += ((dist ? (dx / dist) * sp : 0) - p.vx) * Math.min(1, dt * 2.5) + Math.sin(p.t * 7 + p.phase) * 60 * dt;
      p.vy += ((dist ? (dy / dist) * sp : 0) - p.vy) * Math.min(1, dt * 2.5);
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.flip = p.vx < 0;
      p.hop += (d.th + Math.sin(p.t * 6 + p.phase) * 2 - p.hop) * Math.min(1, dt * 2);
      if (w) { const nz = w.heightAtPx(p.x, p.y); if (nz !== p.z) { p.hop -= (nz - p.z) * LEVEL; p.z = nz; } }
      p.hop = Math.max(2, p.hop);
    } else if (p.kind === 'mote') {
      p.x += (p.vx + Math.sin(p.t * 0.8 + p.phase) * 2) * dt; p.y += p.vy * dt; p.hop += p.vh * dt;
    }
  }

  const api = {
    spawn(type, x, y, opts = {}) {
      const f = SPAWN[type];
      if (!f) return null;
      try { return f(x, y, opts || {}) || null; } catch (e) { console.error('fx.spawn', type, e); return null; }
    },
    update(dt) {
      tween.update(dt);
      for (let i = active.length - 1; i >= 0; i--) {
        const p = active[i];
        if (i >= active.length) continue;
        p.t += dt;
        if (p.t < 0) { p.hidden = true; continue; }
        p.hidden = false;
        if (p.t >= p.life) { kill(i); continue; }
        if (p.ambient) updateAmbient(p, dt);
        if (p.onUpdate) { try { p.onUpdate(p, dt); } catch (e) { console.error(e); p.life = p.t; } }
        stepPhysics(p, dt);
      }
    },
    drawables() {
      out.length = 0;
      for (const p of active) if (!p.hidden && p.t >= 0) out.push(p);
      return out;
    },
    ambient,
    clear(keepAmbient = false) {
      for (let i = active.length - 1; i >= 0; i--) if (i < active.length && (!keepAmbient || !active[i].ambient)) kill(i);
    },
    get count() { return active.length; },
    types: null,
    drawText: drawPixelText,
  };
  // shared kit for the effect families
  const kit = { get, anim, bit, decal, handle, frames, baked, SPAWN, rnd, pick, DIRV, B, api };
  registerBattleFX(kit);
  registerFarmFX(kit);
  api.types = Object.keys(SPAWN);
  return api;
}
