// Particle / effect system with pooling. Effects are Drawables { x, y, z, layer?, sortBias?, draw(ctx, r) }.
// Heights: `hop` (px above the ground plane) + `z` (height level) – drawn through r.sprite / r.shadow so effects
// sit in the diorama like little physical things (shadow stays on the ground while the bit flies).
import { LEVEL, TILE } from '../engine/constants.js';
import { FX_TIMING } from './defs.js';
import { tween } from './tween.js';

const C = {
  ink: '#181020', shadow: '#302848', white: '#f8f8f8',
  grass_ink: '#183828', grass_dk: '#286840', grass_md: '#48a050', grass_lt: '#88c858', grass_hi: '#d0e888',
  dirt_dk: '#784838', dirt_md: '#a87048', dirt_lt: '#d0a068', dirt_hi: '#f0d098',
  rock_dk: '#504860', rock_md: '#807880', rock_lt: '#b0a898', rock_hi: '#e0d8c0',
  water_md: '#2878c0', water_lt: '#58b0e0', water_hi: '#a8e0f0', foam: '#e8f8f8',
  metal_md: '#8898b8', metal_lt: '#c8d8e8',
  heart_dk: '#901828', heart_md: '#e03030', heart_hi: '#f8a088',
  fx_yellow: '#f8e058', fx_orange: '#f88830', fx_cyan: '#98f0f0', gold_lt: '#f8e878',
  red_md: '#c84040', purple_lt: '#c890e0', blue_lt: '#90b0f0', wood_md: '#985038',
};
export const FX_COLORS = C;

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const DIRV = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

// ---------- tiny pixel helpers --------------------------------------------------------------------
function rect(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function disc(ctx, cx, cy, r, col) {
  r = Math.max(0, Math.round(r)); cx = Math.round(cx); cy = Math.round(cy);
  ctx.fillStyle = col;
  for (let i = -r; i <= r; i++) { const w = Math.round(Math.sqrt(Math.max(0, r * r - i * i + r * 0.8))); ctx.fillRect(cx - w, cy + i, w * 2 + 1, 1); }
}
function ring(ctx, cx, cy, rx, ry, col) {
  ctx.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
  const n = Math.max(8, Math.round(rx * 4));
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1); }
}

// 3×5 pixel font for damage numbers / tiny texts
const GLYPHS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '!': '010010010000010', '?': '110001010000010', '+': '000010111010000', '-': '000000111000000',
  '.': '000000000000010', ':': '000010000010000', "'": '010010000000000', '/': '001001010100100', ' ': '000000000000000', '_': '000000000000111', ',': '000000000010100',
  '(': '010100100100010', ')': '010001001001010', '=': '000111000111000', '%': '101001010100101', '#': '101111101111101',
  'Ä': '101010111101101', 'Ö': '101010101101010', 'Ü': '101000101101111', 'ß': '110101110101110',
};
export function drawPixelText(ctx, text, x, y, col = C.white, shadow = C.ink) {
  const s = String(text).toUpperCase();
  const w = s.length * 4 - 1;
  let cx = Math.round(x - w / 2); const cy = Math.round(y);
  for (const ch of s) {
    const g = GLYPHS[ch] || GLYPHS['?'];
    for (let i = 0; i < 15; i++) if (g[i] === '1') {
      const gx = cx + (i % 3), gy = cy + ((i / 3) | 0);
      if (shadow) { ctx.fillStyle = shadow; ctx.fillRect(gx + 1, gy + 1, 1, 1); }
      ctx.fillStyle = col; ctx.fillRect(gx, gy, 1, 1);
    }
    cx += 4;
  }
}

// ---------- particle ------------------------------------------------------------------------------
class P {
  constructor() { this.reset(); }
  reset() {
    this.kind = 'bit'; this.type = ''; this.alive = false; this.hidden = false;
    this.x = this.y = this.z = 0; this.hop = 0; this.vx = this.vy = this.vh = 0;
    this.g = 0; this.drag = 0; this.bounce = 0; this.term = 0; this.sway = 0; this.phase = 0;
    this.t = 0; this.life = 1; this.fade = 0.3; this.alpha = 1;
    this.frames = null; this.ms = 60; this.fi = 0; this.spinMs = 0; this.flip = false;
    this.color = C.white; this.color2 = null; this.size = 1; this.text = '';
    this.layer = undefined; this.sortBias = 0; this.shadowR = 0; this.shadow = false;
    this.paint = null; this.dir = 'down'; this.landed = false; this.onLand = null; this.data = null; this.ambient = null;
  }
  get progress() { return Math.max(0, Math.min(1, this.t / this.life)); }
  get a() {
    const p = this.progress;
    let a = this.alpha;
    if (this.fade > 0 && p > 1 - this.fade) a *= (1 - p) / this.fade;
    if (this.fadeIn && this.t < this.fadeIn) a *= this.t / this.fadeIn;
    return Math.max(0, a);
  }
  draw(ctx, r) { DRAW[this.kind]?.(this, ctx, r); }
}

function bitShadow(p, r) {
  if (!p.shadowR || !r.shadow) return;
  const k = 1 - Math.min(1, p.hop / 48);
  r.shadow(p.x, p.y, p.z, p.shadowR, 1, 0.24 * k * Math.min(1, p.a * 1.5));
}

const DRAW = {
  anim(p, ctx, r) {
    const a = p.a; if (a <= 0) return;
    const f = p.frames;
    if (p.shadowR) bitShadow(p, r);
    if (f && f.length) {
      const img = f[Math.min(f.length - 1, Math.floor((p.t * 1000) / p.ms))];
      if (img) { r.sprite(img, p.x, p.y, p.z, { hop: p.hop, alpha: a, flip: p.flip }); return; }
    }
    if (p.paint) {
      if (a !== 1) ctx.globalAlpha = a;
      p.paint(p, ctx, Math.round(p.x), Math.round(p.y - p.z * LEVEL - p.hop), p.progress);
      if (a !== 1) ctx.globalAlpha = 1;
    }
  },
  bit(p, ctx, r) {
    const a = p.a; if (a <= 0) return;
    bitShadow(p, r);
    let img = null;
    if (p.frames && p.frames.length) img = p.spinMs ? p.frames[(p.fi + Math.floor((p.t * 1000) / p.spinMs)) % p.frames.length] : p.frames[p.fi % p.frames.length];
    if (img) { r.sprite(img, p.x, p.y, p.z, { hop: p.hop, alpha: a, flip: p.flip }); return; }
    if (a !== 1) ctx.globalAlpha = a;
    const sx = Math.round(p.x - (p.size >> 1)), sy = Math.round(p.y - p.z * LEVEL - p.hop - p.size + 1);
    if (p.paint) p.paint(p, ctx, sx, sy, p.progress);
    else {
      rect(ctx, sx, sy, p.size, p.size, p.color);
      if (p.color2 && p.size > 1) rect(ctx, sx + p.size - 1, sy + p.size - 1, 1, 1, p.color2);
    }
    if (a !== 1) ctx.globalAlpha = 1;
  },
  text(p, ctx) {
    const a = p.a; if (a <= 0) return;
    if (a !== 1) ctx.globalAlpha = a;
    drawPixelText(ctx, p.text, p.x, p.y - p.z * LEVEL - p.hop - 5, p.color, C.ink);
    if (a !== 1) ctx.globalAlpha = 1;
  },
  decal(p, ctx) {
    const a = p.a; if (a <= 0) return;
    if (a !== 1) ctx.globalAlpha = a;
    p.paint(p, ctx, Math.round(p.x), Math.round(p.y - p.z * LEVEL), p.progress);
    if (a !== 1) ctx.globalAlpha = 1;
  },
  butterfly(p, ctx, r) {
    const a = p.a; if (a <= 0) return;
    const img = p.frames?.[Math.floor(p.t * 10) % p.frames.length];
    r.shadow?.(p.x, p.y, p.z, 1, 1, 0.16 * a);
    if (img) { r.sprite(img, p.x, p.y, p.z, { hop: p.hop, alpha: a, flip: p.vx < 0 }); return; }
    if (a !== 1) ctx.globalAlpha = a;
    const sx = Math.round(p.x), sy = Math.round(p.y - p.z * LEVEL - p.hop);
    const open = Math.floor(p.t * 12 + p.phase) % 2 === 0;
    rect(ctx, sx, sy, 1, 2, C.shadow);                 // body
    if (open) { rect(ctx, sx - 2, sy - 1, 2, 2, p.color); rect(ctx, sx + 1, sy - 1, 2, 2, p.color); rect(ctx, sx - 2, sy - 1, 1, 1, p.color2); }
    else { rect(ctx, sx - 1, sy - 1, 1, 2, p.color); rect(ctx, sx + 1, sy - 1, 1, 2, p.color); }
    if (a !== 1) ctx.globalAlpha = 1;
  },
  mote(p, ctx) {
    const tw = 0.5 + 0.5 * Math.sin(p.t * p.data + p.phase);
    const a = p.a * tw; if (a <= 0.05) return;
    ctx.globalAlpha = a;
    const sx = Math.round(p.x), sy = Math.round(p.y - p.z * LEVEL - p.hop);
    rect(ctx, sx, sy, 1, 1, p.color);
    if (tw > 0.85 && p.size > 1) { ctx.globalAlpha = a * 0.5; rect(ctx, sx - 1, sy, 3, 1, p.color); rect(ctx, sx, sy - 1, 1, 3, p.color); }
    ctx.globalAlpha = 1;
  },
};

// ---------- fallback painters (used when the art has no sprite for an effect) -----------------------
const PAINT = {
  slash(p, ctx, x, y, t) {
    const [dx, dy] = DIRV[p.dir] || DIRV.down;
    const base = Math.atan2(dy, dx);
    const R = 11, sweep = Math.PI * 0.9;
    const a0 = base - sweep / 2, head = a0 + sweep * Math.min(1, t * 1.4);
    const col = t < 0.34 ? C.white : t < 0.67 ? C.metal_lt : C.metal_md;
    const cx = x, cy = y - 7;
    for (let k = 0; k <= 12; k++) {
      const a = a0 + (head - a0) * (k / 12);
      if (head - a > sweep * (0.8 - t * 0.5)) continue;
      const s = k > 9 ? 2 : 1;
      rect(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.85, s, s, col);
    }
  },
  poof(p, ctx, x, y, t) {
    const r0 = 2 + t * 6;
    const cols = [C.white, C.rock_lt, C.rock_md];
    const col = cols[Math.min(2, Math.floor(t * 3))];
    for (let k = 0; k < 4; k++) {
      const a = k * (Math.PI / 2) + 0.7;
      disc(ctx, x + Math.cos(a) * r0, y - 4 + Math.sin(a) * r0 * 0.7, Math.max(0, 3 - t * 3), col);
    }
    if (t < 0.4) disc(ctx, x, y - 4, 3 - t * 5, C.white);
  },
  spark(p, ctx, x, y, t) {
    const s = Math.round(4 * (1 - t)) + 1;
    const col = t < 0.34 ? C.white : t < 0.67 ? C.fx_yellow : C.fx_orange;
    rect(ctx, x - s, y, s * 2 + 1, 1, col); rect(ctx, x, y - s, 1, s * 2 + 1, col);
    if (t < 0.5) { rect(ctx, x - 1, y - 1, 3, 3, col); }
    else { rect(ctx, x - s + 1, y - s + 1, 1, 1, col); rect(ctx, x + s - 1, y + s - 1, 1, 1, col); rect(ctx, x - s + 1, y + s - 1, 1, 1, col); rect(ctx, x + s - 1, y - s + 1, 1, 1, col); }
  },
  splash(p, ctx, x, y, t) {
    const r = 2 + t * 7;
    ring(ctx, x, y, r, r * 0.45, t < 0.5 ? C.foam : C.water_lt);
    const h = Math.round(Math.sin(t * Math.PI) * 7);
    rect(ctx, x - 3, y - h, 1, h, C.water_lt); rect(ctx, x + 3, y - h, 1, h, C.water_lt); rect(ctx, x, y - h - 2, 1, h, C.foam);
  },
  dust(p, ctx, x, y, t) {
    disc(ctx, x, y - 1 - t * 3, 2 - t * 2, t < 0.5 ? C.dirt_hi : C.dirt_lt);
  },
  sparkle(p, ctx, x, y, t) {
    const s = Math.round(Math.sin(t * Math.PI) * 3);
    const col = t < 0.5 ? C.white : C.fx_yellow;
    rect(ctx, x - s, y, s * 2 + 1, 1, col); rect(ctx, x, y - s, 1, s * 2 + 1, col);
  },
  explosion(p, ctx, x, y, t) {
    const r = 3 + t * 11;
    if (t < 0.7) disc(ctx, x, y - 8, r, C.fx_orange);
    if (t < 0.55) disc(ctx, x, y - 8, r * 0.7, C.fx_yellow);
    if (t < 0.3) disc(ctx, x, y - 8, r * 0.45, C.white);
    if (t >= 0.6) for (let k = 0; k < 6; k++) { const a = k * 1.05; disc(ctx, x + Math.cos(a) * r, y - 8 + Math.sin(a) * r * 0.8, 3 * (1 - t), C.rock_md); }
  },
  heart_pop(p, ctx, x, y, t) { heart(ctx, x, y - 6 - t * 4, t < 0.5 ? C.heart_hi : C.heart_md); },
  heart(p, ctx, x, y) { heart(ctx, x + 1, y + 2, C.heart_md); },
  smoke(p, ctx, x, y, t) { disc(ctx, x, y, 1.5 + t * 2.5, t < 0.4 ? C.rock_lt : C.rock_md); },
  ripple(p, ctx, x, y, t) { const r = 2 + t * 6; ring(ctx, x, y, r, r * 0.45, C.foam); },
  scorch(p, ctx, x, y) { ctx.fillStyle = 'rgba(48,40,72,0.55)'; for (let i = -3; i <= 3; i++) { const w = Math.round(9 * Math.sqrt(1 - (i * i) / 12.25)); ctx.fillRect(x - w, y + i, w * 2, 1); } },
  leaf(p, ctx, x, y) {
    const flipH = Math.floor(p.t * 1000 / 90 + p.fi) % 2 === 0;
    const ink = p.color2 || C.grass_ink;
    if (flipH) { // 4×3 leaf lying
      rect(ctx, x + 1, y, 2, 1, p.color); rect(ctx, x, y + 1, 4, 1, p.color); rect(ctx, x + 1, y + 2, 2, 1, C.grass_md);
      rect(ctx, x + 3, y + 2, 1, 1, ink); rect(ctx, x + 1, y, 1, 1, C.grass_hi);
    } else {     // 3×4 leaf tumbling
      rect(ctx, x + 1, y - 1, 1, 4, p.color); rect(ctx, x, y, 3, 2, p.color); rect(ctx, x + 2, y + 1, 1, 2, C.grass_md);
      rect(ctx, x + 2, y + 3, 1, 1, ink); rect(ctx, x, y, 1, 1, C.grass_hi);
    }
  },
};
function heart(ctx, x, y, col) {
  x = Math.round(x); y = Math.round(y);
  rect(ctx, x - 3, y - 2, 2, 2, col); rect(ctx, x + 1, y - 2, 2, 2, col);
  rect(ctx, x - 3, y - 1, 6, 2, col); rect(ctx, x - 2, y + 1, 4, 1, col); rect(ctx, x - 1, y + 2, 2, 1, col);
  rect(ctx, x - 2, y - 2, 1, 1, C.white);
}

// ---------- system --------------------------------------------------------------------------------
export function createFX(assets) {
  const S = () => (assets && assets.sprites) || {};
  const frames = (key) => { const v = S()[key]; return Array.isArray(v) ? (v.length ? v : null) : v ? [v] : null; };
  const MAX = 700;
  const pool = [], active = [];
  const out = [];
  const amb = { t: 0, butterflies: 0, motes: 0, leaves: 0, world: null };

  function get() {
    let p = pool.pop();
    if (!p) {
      if (active.length >= MAX) { p = active.shift(); if (p.ambient) amb[p.ambient]--; }
      else p = new P();
    }
    p.reset(); p.alive = true; active.push(p);
    return p;
  }

  // one-shot sprite animation (with painter fallback)
  function anim(type, key, x, y, o, ms) {
    const p = get();
    p.kind = 'anim'; p.type = type; p.x = x; p.y = y; p.z = o.z || 0; p.hop = o.hop ?? 0;
    p.frames = frames(key); p.ms = ms;
    p.life = ((p.frames?.length || 4) * ms) / 1000;
    p.fade = 0; p.paint = PAINT[type] || null; p.dir = o.dir || 'down';
    p.sortBias = o.sortBias ?? 2; p.layer = o.layer; p.flip = !!o.flip;
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
    p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp * 0.7;
    p.hop = (o.hop ?? 0) + rnd(cfg.hop?.[0] ?? 2, cfg.hop?.[1] ?? 6);
    p.vh = rnd(cfg.vh[0], cfg.vh[1]); p.g = cfg.g ?? 360; p.drag = cfg.drag ?? 0.5;
    p.bounce = cfg.bounce ?? 0; p.term = cfg.term ?? 0; p.sway = cfg.sway ?? 0; p.phase = rnd(0, 6.28);
    p.life = rnd(cfg.life[0], cfg.life[1]); p.fade = cfg.fade ?? 0.3;
    p.frames = cfg.frames || null; p.fi = (Math.random() * 8) | 0; p.spinMs = cfg.spinMs || 0; p.flip = Math.random() < 0.5;
    p.color = cfg.colors ? pick(cfg.colors) : C.white; p.color2 = cfg.color2 || null; p.size = cfg.size ?? 1;
    p.shadowR = cfg.shadow ?? 1; p.paint = cfg.paint || null;
    p.sortBias = cfg.sortBias ?? 1; p.layer = o.layer;
    p.t = -(cfg.delay || 0);
    return p;
  }

  const SPAWN = {
    slash(x, y, o) {
      const dir = o.dir || 'down';
      const [dx, dy] = DIRV[dir] || DIRV.down;
      const off = o.offset ?? 0;
      const key = frames('fx_slash_' + dir) ? 'fx_slash_' + dir : 'fx_slash';
      const p = anim('slash', key, x + dx * off, y + dy * off, { ...o, hop: o.hop ?? 0, sortBias: dir === 'up' ? -1 : 3 }, o.ms ?? FX_TIMING.slash);
      p.dir = dir;
      return p;
    },
    poof(x, y, o) {
      const p = anim('poof', 'fx_poof', x, y, { ...o, sortBias: 4 }, FX_TIMING.poof);
      for (let k = 0; k < 4; k++) bit('smoke', x, y, o, { ang: k * 1.571 + 0.78, speed: [18, 26], vh: [6, 14], g: 0, hop: [3, 6], life: [0.3, 0.4], fade: 0.6, shadow: 0, paint: PAINT.smoke, delay: 0.05 });
      return p;
    },
    leaves(x, y, o) {
      const fr = frames('fx_leaf');
      const n = o.count ?? (6 + ((Math.random() * 3) | 0));
      for (let k = 0; k < n; k++) {
        bit('leaf', x, y, o, {
          ang: (k / n) * Math.PI * 2 + rnd(-0.3, 0.3), speed: [22, 52], vh: [70, 125], g: 330, hop: [4, 9], term: 32, sway: 22,
          life: FX_TIMING.leafLife.map((v) => v + 0.15), fade: 0.35, frames: fr, spinMs: rnd(70, 110),
          colors: o.colors || [C.grass_lt, C.grass_hi, C.grass_lt, C.grass_md], color2: C.grass_ink, size: 2, paint: fr ? null : PAINT.leaf, shadow: 1,
        });
      }
      if (o.grass !== false) SPAWN.grass(x, y, { ...o, count: 3 });
    },
    grass(x, y, o) {
      const fr = frames('fx_grass_bit');
      const n = o.count ?? 6;
      for (let k = 0; k < n; k++) bit('grass', x, y, o, {
        speed: [14, 38], vh: [50, 95], g: 380, hop: [1, 4], term: 45, sway: 12, life: FX_TIMING.grassLife, frames: fr, spinMs: 80,
        colors: [C.grass_lt, C.grass_hi], size: 1, spread: 4,
        paint: fr ? null : (p, ctx, sx, sy) => { rect(ctx, sx + 1, sy, 1, 3, C.grass_ink); rect(ctx, sx, sy, 1, 3, p.color); if (Math.floor(p.t * 12) % 2) rect(ctx, sx + 1, sy - 1, 1, 1, p.color); },
      });
    },
    spark(x, y, o) {
      const p = anim('spark', 'fx_spark', x, y, { ...o, hop: o.hop ?? 8, sortBias: 6 }, FX_TIMING.spark);
      for (let k = 0; k < 4; k++) bit('spark_bit', x, y, { ...o, hop: (o.hop ?? 8) - 3 }, { ang: k * 1.571 + 0.785 + rnd(-0.2, 0.2), speed: [70, 100], vh: [-10, 10], g: 0, hop: [0, 0], life: [0.12, 0.18], fade: 0.5, colors: [C.white, C.fx_yellow], shadow: 0, sortBias: 6 });
      return p;
    },
    splash(x, y, o) {
      const p = anim('splash', 'fx_splash', x, y, { ...o, sortBias: 2 }, FX_TIMING.splash);
      for (let k = 0; k < 6; k++) bit('drop', x, y, o, { speed: [15, 40], vh: [70, 115], g: 420, hop: [0, 2], life: [0.3, 0.45], fade: 0.3, colors: [C.foam, C.water_lt, C.water_hi], shadow: 0 });
      SPAWN.ripple(x, y, o);
      return p;
    },
    ripple(x, y, o) {
      const p = get();
      p.kind = 'decal'; p.type = 'ripple'; p.x = x; p.y = y; p.z = o.z || 0; p.life = 0.5; p.fade = 0.6; p.paint = PAINT.ripple; p.layer = 'floor';
      return p;
    },
    dust(x, y, o) {
      const [dx, dy] = DIRV[o.dir] || [0, 0];
      const p = anim('dust', 'fx_dust', x - dx * 3 + rnd(-1, 1), y - dy * 2, { ...o, sortBias: -3 }, FX_TIMING.dust);
      p.alpha = 0.85; p.vx = -dx * 8; p.vy = -dy * 6; p.vh = 6;
      return p;
    },
    sparkle(x, y, o) {
      const n = o.count ?? 3, rad = o.radius ?? 8;
      for (let k = 0; k < n; k++) {
        const p = anim('sparkle', 'fx_sparkle', x + rnd(-rad, rad), y + rnd(-2, 2), { ...o, hop: (o.hop ?? 8) + rnd(-rad * 0.6, rad * 0.6), delay: (o.delay || 0) + k * (o.stagger ?? 0.09), sortBias: 8 }, FX_TIMING.sparkle);
        p.layer = o.layer;
      }
    },
    explosion(x, y, o) {
      const p = anim('explosion', 'fx_explosion', x, y, { ...o, sortBias: 8 }, FX_TIMING.explosion);
      const sm = frames('fx_poof');
      for (let k = 0; k < 6; k++) {
        const s = bit('smoke', x, y, o, { ang: (k / 6) * 6.28, speed: [8, 18], vh: [10, 22], g: 0, hop: [6, 14], life: [0.5, 0.8], fade: 0.5, shadow: 0, delay: rnd(0.12, 0.25), paint: PAINT.smoke, sortBias: 9 });
        if (sm) { s.kind = 'anim'; s.frames = sm; s.ms = 90; s.life = (sm.length * 90) / 1000; }
      }
      for (let k = 0; k < 6; k++) bit('debris', x, y, o, { speed: [40, 75], vh: [80, 130], g: 420, bounce: 0.35, life: [0.6, 0.9], colors: [C.rock_md, C.rock_dk, C.dirt_md], size: 2, frames: frames('fx_rock_bit'), spinMs: 90 });
      const d = get();
      d.kind = 'decal'; d.type = 'scorch'; d.x = x; d.y = y; d.z = o.z || 0; d.life = 2.5; d.fade = 0.4; d.paint = PAINT.scorch; d.layer = 'floor';
      o.camera?.shake?.(3, 0.3);
      return p;
    },
    heart_pop(x, y, o) {
      const p = anim('heart_pop', 'fx_heart_pop', x, y, { ...o, hop: o.hop ?? 6, sortBias: 6 }, FX_TIMING.heart_pop);
      for (let k = 0; k < 3; k++) bit('heart', x, y, o, { ang: -Math.PI / 2 + (k - 1) * 0.7, speed: [14, 20], vh: [28, 36], g: 0, hop: [8, 10], life: [0.5, 0.6], fade: 0.5, shadow: 0, paint: PAINT.heart, size: 5, delay: k * 0.06, sortBias: 6 });
      return p;
    },
    rocks(x, y, o) {
      const fr = frames('fx_rock_bit');
      for (let k = 0; k < (o.count ?? 6); k++) bit('rock', x, y, o, { ang: (k / 6) * 6.28 + rnd(-0.4, 0.4), speed: [28, 60], vh: [60, 115], g: 440, bounce: 0.4, hop: [3, 8], life: FX_TIMING.rockLife, frames: fr, spinMs: 100, colors: [C.rock_md, C.rock_lt, C.rock_dk], color2: C.rock_dk, size: 2, shadow: 1 });
      SPAWN.dust(x - 4, y, {}); SPAWN.dust(x + 4, y, {});
    },
    shards(x, y, o) {
      const fr = frames('fx_pot_bit');
      for (let k = 0; k < (o.count ?? 6); k++) bit('shard', x, y, o, { ang: (k / 6) * 6.28 + rnd(-0.4, 0.4), speed: [28, 60], vh: [60, 115], g: 440, bounce: 0.35, hop: [3, 8], life: FX_TIMING.rockLife, frames: fr, spinMs: 100, colors: o.colors || [C.dirt_md, C.dirt_lt, C.wood_md], color2: C.dirt_dk, size: 2, shadow: 1 });
      SPAWN.dust(x, y, {});
    },
    damage_number(x, y, o) {
      const p = get();
      p.kind = 'text'; p.type = 'damage'; p.text = String(o.value ?? o.text ?? 1);
      p.x = x; p.y = y; p.z = o.z || 0; p.hop = o.hop ?? 18; p.vh = 55; p.g = 260; p.bounce = 0.3;
      p.vx = rnd(-8, 8); p.life = 0.8; p.fade = 0.35; p.color = o.color || C.white; p.layer = 'top';
      return p;
    },
    text(x, y, o) {
      const p = get();
      p.kind = 'text'; p.type = 'text'; p.text = String(o.text ?? '');
      p.x = x; p.y = y; p.z = o.z || 0; p.hop = o.hop ?? 20; p.vh = o.rise ?? 18; p.g = 0;
      p.life = o.life ?? 1.0; p.fade = 0.4; p.color = o.color || C.white; p.layer = 'top';
      return p;
    },
  };
  // aliases
  SPAWN.bush = SPAWN.leaves; SPAWN.hit = SPAWN.spark; SPAWN.death = SPAWN.poof; SPAWN.pot = SPAWN.shards; SPAWN.damage = SPAWN.damage_number;

  function stepPhysics(p, dt) {
    if (p.kind === 'butterfly' || p.kind === 'mote') return;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'anim' || p.kind === 'decal') { p.hop += p.vh * dt; return; }
    p.vh -= p.g * dt;
    if (p.term && p.vh < -p.term) {
      // fluttering fall (leaves): terminal velocity + side sway
      p.vh = -p.term;
      p.x += Math.sin(p.t * 9 + p.phase) * p.sway * dt;
    }
    p.hop += p.vh * dt;
    if (p.hop <= 0 && p.g > 0) {
      p.hop = 0;
      if (p.bounce && -p.vh * p.bounce > 25) { p.vh = -p.vh * p.bounce; p.vx *= 0.6; p.vy *= 0.6; }
      else { p.vh = 0; p.vx *= 0.2; p.vy *= 0.2; if (!p.landed) { p.landed = true; p.spinMs = 0; if (p.life - p.t > 0.25 && p.type !== 'damage') p.life = Math.min(p.life, p.t + 0.35); } }
    }
    if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
  }

  function kill(i) {
    const p = active[i];
    if (p.ambient) amb[p.ambient]--;
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
    const outdoor = o.outdoor ?? world.outdoor ?? !(world.plinth === 'stone' || /dungeon|cave|house|interior|boss/i.test(world.id || ''));
    const density = o.density ?? 1;
    const lim = outdoor ? { butterflies: Math.round(3 * density), motes: Math.round(12 * density), leaves: Math.round(3 * density) }
      : { butterflies: 0, motes: Math.round(10 * density), leaves: 0 };
    const rx = () => rnd(Math.max(0, cx - vw / 2), Math.min(world.pxW, cx + vw / 2));
    const ry = () => rnd(Math.max(0, cy - vh / 2), Math.min(world.pxH, cy + vh / 2 + 16));
    const okGround = (x, y) => { const d = world.def?.(Math.floor(x / TILE), Math.floor(y / TILE)); return d && !d.solid; };
    if (amb.butterflies < lim.butterflies && Math.random() < 0.02) {
      // prefer flower tiles
      let bx = rx(), by = ry();
      for (let k = 0; k < 8; k++) { const x = rx(), y = ry(); if (/flower/.test(world.tileAtPx?.(x, y) || '')) { bx = x; by = y; break; } }
      if (okGround(bx, by)) {
        const p = get(); const cols = pick(BUTTERFLY_COLORS);
        p.kind = 'butterfly'; p.type = 'butterfly'; p.ambient = 'butterflies'; amb.butterflies++;
        p.x = bx; p.y = by; p.z = world.heightAtPx(bx, by); p.hop = rnd(6, 14); p.phase = rnd(0, 6);
        p.color = cols[0]; p.color2 = cols[1]; p.life = rnd(14, 24); p.fade = 0.1; p.fadeIn = 1;
        p.frames = frames('fx_butterfly'); p.data = { tx: bx, ty: by, th: 10, wait: 0 };
      }
    }
    if (amb.motes < lim.motes && Math.random() < 0.15) {
      const p = get(); const x = rx(), y = ry();
      p.kind = 'mote'; p.type = 'mote'; p.ambient = 'motes'; amb.motes++;
      p.x = x; p.y = y; p.z = world.heightAtPx(x, y); p.hop = rnd(8, 40);
      p.vx = rnd(-4, 4) + (outdoor ? 3 : 0); p.vy = rnd(-2, 2); p.vh = rnd(-1.5, 2);
      p.life = rnd(4, 8); p.fade = 0.3; p.fadeIn = 1; p.layer = 'top'; p.phase = rnd(0, 6); p.data = rnd(1.5, 4);
      p.color = outdoor ? pick([C.white, '#fff6c8', C.gold_lt]) : pick([C.rock_hi, C.metal_lt]); p.size = Math.random() < 0.3 ? 2 : 1;
      p.alpha = outdoor ? 0.85 : 0.5;
    }
    if (amb.leaves < lim.leaves && Math.random() < 0.012) {
      const x = rx(), y = ry();
      if (okGround(x, y)) {
        const fr = frames('fx_leaf');
        const p = bit('leaf', x, y, { z: world.heightAtPx(x, y) }, { speed: [3, 8], vh: [-5, 0], g: 60, hop: [50, 70], term: 14, sway: 26, life: [5, 7], fade: 0.15, frames: fr, spinMs: 140, colors: [C.grass_lt, C.gold_lt, C.grass_md], color2: C.grass_dk, size: 2, paint: fr ? null : PAINT.leaf });
        p.ambient = 'leaves'; amb.leaves++; p.fadeIn = 0.6; p.drag = 0;
      }
    }
  }

  function updateAmbient(p, dt) {
    const v = amb.view, w = amb.world;
    if (v && (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1)) { p.t = Math.max(p.t, p.life - 0.3); }
    if (p.kind === 'butterfly') {
      const d = p.data;
      if (d.wait > 0) d.wait -= dt;
      const dx = d.tx - p.x, dy = d.ty - p.y, dist = Math.hypot(dx, dy);
      if (dist < 3 || Math.random() < 0.004) {
        d.tx = p.x + rnd(-40, 40); d.ty = p.y + rnd(-28, 28); d.th = rnd(4, 18);
        if (Math.random() < 0.25) d.wait = rnd(0.5, 1.5);
      }
      const sp = d.wait > 0 ? 0 : 22;
      p.vx += ((dist ? (dx / dist) * sp : 0) - p.vx) * Math.min(1, dt * 2.5) + Math.sin(p.t * 7 + p.phase) * 6 * dt * 10;
      p.vy += ((dist ? (dy / dist) * sp : 0) - p.vy) * Math.min(1, dt * 2.5);
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.hop += (d.th + Math.sin(p.t * 6 + p.phase) * 2 - p.hop) * Math.min(1, dt * 2);
      if (w) { const nz = w.heightAtPx(p.x, p.y); if (nz !== p.z) { p.hop -= (nz - p.z) * LEVEL; p.z = nz; } }
      p.hop = Math.max(2, p.hop);
    } else if (p.kind === 'mote') {
      p.x += (p.vx + Math.sin(p.t * 0.8 + p.phase) * 2) * dt; p.y += p.vy * dt; p.hop += p.vh * dt;
    }
  }

  return {
    spawn(type, x, y, opts = {}) {
      const f = SPAWN[type];
      if (!f) return null;
      try { return f(x, y, opts || {}) || null; } catch (e) { console.error('fx.spawn', type, e); return null; }
    },
    update(dt) {
      tween.update(dt);
      for (let i = active.length - 1; i >= 0; i--) {
        const p = active[i];
        p.t += dt;
        if (p.t < 0) { p.hidden = true; continue; }
        p.hidden = false;
        if (p.t >= p.life) { kill(i); continue; }
        if (p.ambient) updateAmbient(p, dt);
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
      for (let i = active.length - 1; i >= 0; i--) if (!keepAmbient || !active[i].ambient) kill(i);
    },
    get count() { return active.length; },
    types: Object.keys(SPAWN),
    drawText: drawPixelText,
  };
}
