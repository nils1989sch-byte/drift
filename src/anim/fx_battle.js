// Battle / monster effects: type effects (hit, projectile, area, cone, trail), telegraph, arena, capture sequence,
// summon/recall, level_up, evolve, faint. All drawing via r.sprite with baked canvases (works in 2D and 3D).
import { LEVEL } from '../engine/constants.js';
import { ease } from './tween.js';
import {
  C, bake, bakeFrames, rect, disc, ring, line, star, rng, ember, sparkleSprite, starSprite, floorRing, ellipseRing, beam,
  textSprite, silhouette, dot,
} from './bake.js';

// ---------- type look ----------
export const TYPE_ALIAS = { plant: 'leaf', grass: 'leaf', stone: 'rock', bolt: 'spark', electric: 'spark', air: 'wind' };
export const FX_TYPES = ['fire', 'water', 'leaf', 'rock', 'spark', 'wind', 'normal'];
const T = {
  fire:   { c: [C.white, C.gold_lt, C.fx_yellow, C.fx_orange, C.heart_md, C.red_dk], accent: C.fx_orange, glow: true },
  water:  { c: [C.foam, C.water_hi, C.water_lt, C.water_md, C.water_dk, C.water_ink], accent: C.water_lt, glow: false },
  leaf:   { c: [C.grass_hi, C.grass_lt, C.grass_md, C.grass_dk, C.heart_hi, C.grass_ink], accent: C.grass_lt, glow: false },
  rock:   { c: [C.rock_hi, C.rock_lt, C.rock_md, C.rock_dk, C.dirt_lt, C.rock_ink], accent: C.rock_hi, glow: false },
  spark:  { c: [C.white, C.gold_lt, C.fx_yellow, C.fx_cyan, C.blue_md, C.blue_dk], accent: C.fx_yellow, glow: true },
  wind:   { c: [C.white, C.foam, C.fx_cyan, C.water_hi, C.metal_lt, C.metal_md], accent: C.metal_lt, glow: false },
  normal: { c: [C.white, C.rock_hi, C.rock_lt, C.metal_lt, C.rock_md, C.rock_dk], accent: C.white, glow: false },
};
export const typeKey = (t) => { t = TYPE_ALIAS[t] || t; return T[t] ? t : 'normal'; };
const DIRA = { down: Math.PI / 2, up: -Math.PI / 2, left: Math.PI, right: 0 };
export function dirAngle(d) {
  if (typeof d === 'number') return d;
  if (d && typeof d === 'object') return Math.atan2(d.y || 0, d.x || 0);
  return DIRA[d] ?? Math.PI / 2;
}
const A16 = (a) => ((Math.round((a / (Math.PI * 2)) * 16) % 16) + 16) % 16;

// ---------- baked type sprites (HD ws 0.5) ----------
const impactFrames = (t) => bakeFrames('impact_' + t, 5, 40, 40, 20, 20, 0.5, (g, P, p, i) => {
  const s = P.s, cx = P.ax, cy = P.ay, c = T[t].c, R = rng(1234 + i * 7 + t.length * 31);
  const r = (3 + p * 13) * s;
  if (t === 'fire') {
    if (p < 0.85) {
      for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.28 + p * 2, l = r * (1.05 + R() * 0.45); line(g, cx, cy, cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.9, c[3], Math.max(2, Math.round(3 * s * (1 - p)))); }
      disc(g, cx, cy, r * 0.85, c[3]); disc(g, cx, cy, r * 0.62, c[2]);
      if (p < 0.6) disc(g, cx, cy, r * 0.4, c[1]);
      if (p < 0.3) disc(g, cx, cy, r * 0.22, c[0]);
    } else for (let k = 0; k < 10; k++) { const a = k * 0.63; disc(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.85, 1.6 * s, c[k % 2 ? 3 : 4]); }
  } else if (t === 'water') {
    ring(g, cx, cy, r, r * 0.9, c[2], Math.max(2, Math.round(2 * s * (1 - p * 0.5))));
    if (p < 0.5) disc(g, cx, cy, r * 0.55, c[1]);
    if (p < 0.25) disc(g, cx, cy, r * 0.3, c[0]);
    for (let k = 0; k < 8; k++) { const a = k * 0.785 + 0.3, l = r * 1.15; disc(g, cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.9, (1.8 - p) * s, k % 2 ? c[0] : c[2]); }
  } else if (t === 'leaf') {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * 6.28 + p * 3, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.85;
      disc(g, x, y, 2.2 * s * (1 - p * 0.4), c[k % 3 === 0 ? 4 : 1], 1.2 * s); rect(g, x - s, y, 2 * s, s, c[3]);
    }
    if (p < 0.4) disc(g, cx, cy, r * 0.5, c[0]);
  } else if (t === 'rock') {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * 6.28 + 0.4, l = r * (0.9 + R() * 0.3), x = cx + Math.cos(a) * l, y = cy + Math.sin(a) * l * 0.85, w = (3.5 - p * 1.5) * s;
      rect(g, x - w / 2, y - w / 2, w, w * 0.8, c[2]); rect(g, x - w / 2, y - w / 2, w, s, c[0]); rect(g, x - w / 2, y + w * 0.3, w, s, c[3]);
    }
    if (p < 0.5) disc(g, cx, cy, r * 0.5, c[4]);
    if (p < 0.25) disc(g, cx, cy, r * 0.3, c[0]);
  } else if (t === 'spark') {
    for (let k = 0; k < 6; k++) {
      let a = (k / 6) * 6.28 + R(), x = cx, y = cy; const l = r * 1.2, n = 4;
      for (let j = 0; j < n; j++) { const nx = cx + Math.cos(a) * l * ((j + 1) / n) + (R() - 0.5) * 4 * s, ny = cy + Math.sin(a) * l * ((j + 1) / n) + (R() - 0.5) * 4 * s; line(g, x, y, nx, ny, j < 2 ? c[0] : c[3], Math.max(1, Math.round(s * (p < 0.5 ? 1.5 : 1)))); x = nx; y = ny; }
    }
    if (p < 0.6) disc(g, cx, cy, r * 0.45, c[2]);
    if (p < 0.35) disc(g, cx, cy, r * 0.28, c[0]);
  } else if (t === 'wind') {
    for (let k = 0; k < 4; k++) {
      const a0 = k * 1.571 + p * 3.5, rr = r * (0.6 + k * 0.15);
      for (let j = 0; j < 12; j++) { const a = a0 + j * 0.12; rect(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.75, s * (j > 8 ? 2 : 1), s, j > 8 ? c[0] : c[2]); }
    }
  } else {
    star(g, cx, cy, Math.round(r * 0.9), c[0], c[0]);
    ring(g, cx, cy, r, r * 0.85, c[2], Math.max(1, Math.round(s * (1.5 - p))));
  }
});
const orbFrames = (t) => bakeFrames('porb_' + t, 3, 14, 14, 7, 7, 0.5, (g, P, p, i) => {
  const s = P.s, cx = P.ax, cy = P.ay, c = T[t].c;
  if (t === 'fire') { disc(g, cx, cy, 5 * s, c[3]); disc(g, cx - s, cy - s * (1 + i * 0.5), 3.6 * s, c[2]); disc(g, cx - s, cy - s, 2 * s, c[0]); for (let k = 0; k < 3; k++) rect(g, cx + (k - 1) * 3 * s, cy - (5 + ((i + k) % 3)) * s, s * 2, s * 2, c[3]); }
  else if (t === 'water') { disc(g, cx, cy, 4.6 * s, c[3]); disc(g, cx, cy, 3.8 * s, c[2]); disc(g, cx - 1.5 * s, cy - 1.5 * s, 1.4 * s, c[0]); ring(g, cx, cy, 5 * s, 5 * s, c[1], s); }
  else if (t === 'leaf') { const a = i * 2.1; for (let k = 0; k < 3; k++) { const b = a + k * 2.09; disc(g, cx + Math.cos(b) * 2.8 * s, cy + Math.sin(b) * 2.8 * s, 2.4 * s, k ? c[1] : c[4], 1.4 * s); } disc(g, cx, cy, 1.3 * s, c[0]); }
  else if (t === 'rock') { const w = 8 * s; rect(g, cx - w / 2, cy - w / 2, w, w, c[2]); rect(g, cx - w / 2, cy - w / 2, w, s * 2, c[0]); rect(g, cx - w / 2, cy + w / 2 - s * 2, w, s * 2, c[3]); rect(g, cx - w / 2 + (i * 2) * s, cy - s, s * 2, s, c[3]); }
  else if (t === 'spark') { disc(g, cx, cy, 3.4 * s, c[2]); disc(g, cx, cy, 2 * s, c[0]); const R = rng(77 + i); for (let k = 0; k < 4; k++) { const a = k * 1.57 + R(); line(g, cx, cy, cx + Math.cos(a) * 6 * s, cy + Math.sin(a) * 6 * s, c[3], s); } }
  else if (t === 'wind') { for (let j = 0; j < 14; j++) { const a = -1.2 + j * 0.17 + i * 0.3; rect(g, cx + Math.cos(a) * 5 * s, cy + Math.sin(a) * 5 * s, s * (j % 4 === 0 ? 2 : 1), s * 1, j > 9 ? c[0] : c[2]); } disc(g, cx, cy, 1.5 * s, c[1]); }
  else { disc(g, cx, cy, 4 * s, c[2]); disc(g, cx, cy, 2.5 * s, c[0]); }
});
const streak = (col, len = 5) => bake(`streak:${col}:${len}`, len + 1, 2, len / 2, 1, 0.5, (g, P) => { rect(g, 0, P.h / 2 - P.s / 2, P.w, P.s, col); rect(g, P.w - P.s * 2, P.h / 2 - P.s / 2, P.s * 2, P.s, C.white); });
const leafHD = (col) => bakeFrames('hleaf_' + col, 2, 5, 4, 2.5, 3, 0.5, (g, P, p, i) => {
  const s = P.s;
  if (i === 0) { disc(g, P.w / 2, P.h / 2, 2.2 * s, col, 1.1 * s); rect(g, P.w / 2 - 2 * s, P.h / 2, 4 * s, s, C.grass_dk); }
  else { disc(g, P.w / 2, P.h / 2, 1.1 * s, col, 1.6 * s); rect(g, P.w / 2, P.h / 2 - s, s, 2 * s, C.grass_dk); }
});
const chunkHD = (col, dk) => bake(`hchunk:${col}:${dk}`, 3.5, 3, 1.75, 2.5, 0.5, (g, P) => { rect(g, 0, 0, P.w, P.h - P.s, col); rect(g, 0, P.h - P.s, P.w, P.s, dk); rect(g, 0, 0, P.s, P.s, C.rock_hi); });
// type particle images
function bitImg(t, pick) {
  const c = T[t].c;
  switch (t) {
    case 'fire': return pick([ember(c[0], c[2], 1), ember(c[1], c[3], 1.2), ember(c[2], c[4], 0.8)]);
    case 'water': return pick([ember(c[0], c[2], 0.9), dot(c[1], 1), ember(c[1], c[3], 0.7)]);
    case 'rock': return chunkHD(pick([c[1], c[2], c[4]]), c[3]);
    case 'spark': return pick([ember(c[0], c[3], 0.8), ember(c[0], c[2], 1), dot(c[3], 1)]);
    case 'wind': return streak(pick([c[0], c[1], c[2]]), 5);
    default: return pick([ember(c[0], c[2], 0.8), dot(c[1], 1)]);
  }
}

// floor decals
const fillCol = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
function wedge(g, cx, cy, R, a0, a1, col) {
  g.fillStyle = col;
  const r2 = R * R;
  for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy; if (dx * dx + dy * dy > r2) continue;
    let a = Math.atan2(dy, dx) - a0; a = ((a % 6.2832) + 6.2832) % 6.2832; if (a <= a1 - a0) g.fillRect(x, y, 1, 1);
  }
}
function wedgeRim(g, cx, cy, R, a0, a1, col, th) {
  const n = Math.max(12, Math.round(R * (a1 - a0)));
  for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * (k / n); g.fillStyle = col; g.fillRect(Math.round(cx + Math.cos(a) * R - th / 2), Math.round(cy + Math.sin(a) * R - th / 2), th, th); }
  line(g, cx, cy, cx + Math.cos(a0) * R, cy + Math.sin(a0) * R, col, th); line(g, cx, cy, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, col, th);
}
function lineShape(g, cx, cy, L, W, ang, col, rimOnly, th) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  if (rimOnly) {
    const pts = [[0, -W / 2], [L, -W / 2], [L, W / 2], [0, W / 2]].map(([u, v]) => [cx + u * ca - v * sa, cy + u * sa + v * ca]);
    for (let i = 0; i < 4; i++) line(g, pts[i][0], pts[i][1], pts[(i + 1) % 4][0], pts[(i + 1) % 4][1], col, th);
    // chevrons pointing along the dash direction
    for (let k = 1; k <= 3; k++) { const u = (L * k) / 4, w = W * 0.3; line(g, cx + (u - w) * ca + w * sa, cy + (u - w) * sa - w * ca, cx + u * ca, cy + u * sa, col, th); line(g, cx + (u - w) * ca - w * sa, cy + (u - w) * sa + w * ca, cx + u * ca, cy + u * sa, col, th); }
    return;
  }
  g.fillStyle = col;
  const R = L + W;
  for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    if (u >= 0 && u <= L && Math.abs(v) <= W / 2) g.fillRect(x, y, 1, 1);
  }
}
// telegraph sprite: shape outline (rim) or fill at grow step k/STEPS
const TSTEPS = 8;
function telegraphSprite(shape, R, ai, widthDeg, W, part, k, fillHex) {
  const ws = R > 48 ? 1 : 0.5;
  const size = shape === 'line' ? (R + W) * 2 + 4 : R * 2 + 4;
  return bake(`tg:${shape}:${R}:${ai}:${widthDeg}:${W}:${part}:${k}:${fillHex}`, size, size, size / 2, size / 2, ws, (g, P) => {
    const s = P.s, cx = P.w / 2, cy = P.h / 2, ang = (ai / 16) * Math.PI * 2, half = ((widthDeg / 2) * Math.PI) / 180;
    const th = Math.max(1, Math.round(1.2 * s));
    const f = k / TSTEPS;
    if (shape === 'circle') {
      if (part === 'rim') { ring(g, cx, cy, R * s, R * s, fillCol(C.fx_orange, 0.75), th); }
      else { disc(g, cx, cy, R * s * f, fillCol(fillHex, 0.35)); if (f > 0) ring(g, cx, cy, R * s * f, R * s * f, fillCol(C.fx_orange, 0.5), Math.max(1, th - 1)); }
    } else if (shape === 'cone') {
      if (part === 'rim') wedgeRim(g, cx, cy, R * s, ang - half, ang + half, fillCol(C.fx_orange, 0.75), th);
      else wedge(g, cx, cy, R * s * f, ang - half, ang + half, fillCol(fillHex, 0.35));
    } else {
      if (part === 'rim') lineShape(g, cx, cy, R * s, W * s, ang, fillCol(C.fx_orange, 0.75), true, th);
      else lineShape(g, cx, cy, R * s * f, W * s, ang, fillCol(fillHex, 0.35), false, th);
    }
  });
}
const AREA_STEPS = 6;
const areaRing = (t, R, k) => bake(`aring:${t}:${R}:${k}`, R * 2 + 4, R * 2 + 4, R + 2, R + 2, R > 48 ? 1 : 0.5, (g, P) => {
  const s = P.s, f = (k + 1) / AREA_STEPS, c = T[t].c;
  disc(g, P.w / 2, P.h / 2, R * s * f, fillCol(c[2], 0.25 * (1 - f * 0.5)));
  ring(g, P.w / 2, P.h / 2, R * s * f, R * s * f, c[1], Math.max(1, Math.round(2 * s * (1 - f * 0.4))));
  ring(g, P.w / 2, P.h / 2, R * s * f * 0.7, R * s * f * 0.7, fillCol(c[0], 0.6), Math.max(1, Math.round(s)));
});
// arena ring: soft double line with notches
const arenaRing = (R, k, col) => bake(`arena:${R}:${k}:${col}`, R * 2 + 6, R * 2 + 6, R + 3, R + 3, 1, (g, P) => {
  const f = 0.3 + (0.7 * (k + 1)) / 6, r = R * f, cx = P.w / 2, cy = P.h / 2;
  disc(g, cx, cy, r, 'rgba(248,232,120,0.06)');
  ring(g, cx, cy, r, r, fillCol(col, 0.85), 2);
  ring(g, cx, cy, r - 3, r - 3, fillCol(col, 0.35), 1);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.2832; rect(g, cx + Math.cos(a) * (r + 2) - 0.5, cy + Math.sin(a) * (r + 2) - 0.5, 1, 1, fillCol(col, 0.6)); }
});
const runeSprite = (col) => bake(`rune:${col}`, 5, 5, 2.5, 2.5, 0.5, (g, P) => { const c = P.w / 2; for (let i = 0; i < P.w / 2; i++) { g.fillStyle = col; g.fillRect(c - i, P.h / 2 - (P.w / 2 - i), i * 2, 1); g.fillRect(c - i, P.h / 2 + (P.w / 2 - i) - 1, i * 2, 1); } });

// ---------- capture orb (own design: amber glass core in a brass cage with 3 vertical clasps) ----------
const ORB_R = 4.5;
const orbSpin = () => bakeFrames('dorb', 4, 11, 11, 5.5, 10, 0.5, (g, P, p, i) => {
  const s = P.s, cx = P.w / 2, cy = P.h / 2 - 0.5 * s, r = ORB_R * s;
  disc(g, cx, cy, r + s, C.wood_dk); disc(g, cx, cy, r, C.gold_md); disc(g, cx - s, cy - s, r * 0.7, C.gold_lt); disc(g, cx - 1.8 * s, cy - 1.8 * s, s, C.white);
  disc(g, cx + s * 0.5, cy + s * 0.5, r * 0.35, C.fx_orange);
  for (let k = 0; k < 3; k++) { // clasps: rotating with the spin
    const ph = ((k / 3 + i / 12) % 1) * Math.PI, x = cx + Math.cos(ph) * r;
    if (Math.sin(ph) < 0.15) continue;
    rect(g, x - s * 0.5, cy - r, s * 1.5, r * 2, C.wood_lt); rect(g, x + s, cy - r * 0.8, s * 0.6, r * 1.6, C.wood_dk);
  }
  rect(g, cx - s, cy - r - s * 1.5, 2 * s, s * 1.5, C.wood_lt); // top cap
});
const orbOpen = () => bake('dorb_open', 15, 12, 7.5, 11, 0.5, (g, P) => {
  const s = P.s, cx = P.w / 2, cy = P.h - 5 * s;
  disc(g, cx, cy, 5 * s, fillCol(C.gold_lt, 0.6)); disc(g, cx, cy, 3 * s, C.white);
  for (const d of [-1, 1]) { rect(g, cx + d * 5 * s - s, cy - 6 * s, 2 * s, 8 * s, C.wood_lt); rect(g, cx + d * 6.5 * s - s, cy - 4 * s, s, 6 * s, C.wood_dk); }
  rect(g, cx - 3 * s, cy + 3 * s, 6 * s, 2 * s, C.wood_lt);
});

export function registerBattleFX(kit) {
  const { get, anim, bit, decal, handle, frames, SPAWN, rnd, pick } = kit;
  const imgOf = (v, act = 'idle') => {
    if (!v) return null;
    if (typeof v === 'string') return frames(v)?.[0] || frames(`mon_${v}_${act}_down`)?.[0] || frames(`mon_${v}_idle_down`)?.[0] || null;
    return Array.isArray(v) ? v[0] : v;
  };
  const orbImgs = () => frames('orb') || orbSpin();
  const orbShake = () => frames('orb_shake') || orbSpin();
  const orbOpenImg = () => frames('orb_open')?.[0] || orbOpen();
  const custom = (type, x, y, o, life) => {
    const p = get();
    p.kind = 'custom'; p.type = type; p.x = x; p.y = y; p.z = o.z || 0; p.life = life; p.sortBias = o.sortBias ?? 4; p.layer = o.layer;
    p.t = -(o.delay || 0);
    return p;
  };
  const glowBit = (x, y, o, cfg) => bit('glow', x, y, o, { shadow: 0, glow: true, ...cfg });

  // ======================= type effects =======================
  function typeBits(t, x, y, o, n, cfg = {}) {
    const hop = o.hop ?? 10;
    for (let k = 0; k < n; k++) {
      const base = { ang: cfg.ang != null ? cfg.ang + rnd(-(cfg.spreadA ?? 3.2), cfg.spreadA ?? 3.2) : undefined, hop: [hop - 2, hop + 2], img: bitImg(t, pick), sortBias: 6, layer: o.layer, delay: cfg.delay ? rnd(0, cfg.delay) : 0 };
      const sp = cfg.speed || [30, 70];
      let c;
      switch (t) {
        case 'fire': c = { speed: sp, vh: [20, 55], g: -50, drag: 2.5, life: [0.35, 0.6], fade: 0.5, glow: true, shadow: 0 }; break;
        case 'water': c = { speed: sp, vh: [40, 95], g: 380, life: [0.4, 0.6], fade: 0.25, shadow: 1 }; break;
        case 'leaf': { const col = pick([C.grass_lt, C.grass_hi, C.heart_hi, C.grass_lt]); c = { speed: sp, vh: [30, 70], g: 200, term: 28, sway: 26, life: [0.6, 0.9], fade: 0.35, frames: leafHD(col), spinMs: rnd(70, 120), shadow: 1, img: null }; break; }
        case 'rock': c = { speed: sp, vh: [50, 100], g: 460, bounce: 0.35, life: [0.55, 0.85], fade: 0.25, shadow: 1 }; break;
        case 'spark': c = { speed: [sp[0] * 1.8, sp[1] * 1.8], vh: [-20, 30], g: 0, drag: 4, life: [0.12, 0.3], fade: 0.5, glow: true, shadow: 0 }; break;
        case 'wind': c = { speed: [sp[0] * 1.4, sp[1] * 1.4], vh: [-8, 12], g: 0, drag: 1.5, life: [0.25, 0.45], fade: 0.6, shadow: 0 }; break;
        default: c = { speed: sp, vh: [20, 60], g: 200, life: [0.3, 0.5], fade: 0.4, shadow: 0 };
      }
      const p = bit('type_' + t, x, y, o, { ...base, ...c, ...(cfg.over || {}) });
      if (t === 'wind') { const sw = Math.random() < 0.5 ? 1 : -1; p.onUpdate = (q, dt) => { const a = 5 * dt * sw, vx = q.vx; q.vx = vx * Math.cos(a) - q.vy * Math.sin(a); q.vy = vx * Math.sin(a) + q.vy * Math.cos(a); q.flip = q.vx < 0; }; }
    }
  }
  const IMPACT_MS = 55;
  function hit(t, x, y, o) {
    const hop = o.hop ?? 10, strong = !!o.strong || (o.eff ?? 1) > 1;
    const p = anim('type_hit', impactFrames(t), x, y, { ...o, hop: hop - 20 * 0.5 * 0 , sortBias: 7, glow: T[t].glow }, IMPACT_MS);
    p.hop = hop; // impact sprite anchored at its centre
    typeBits(t, x, y, o, strong ? 16 : 10, { speed: strong ? [40, 95] : [30, 70] });
    if (t === 'fire') for (let k = 0; k < 3; k++) { const s = bit('smoke', x, y, o, { speed: [6, 14], vh: [14, 26], g: 0, hop: [hop, hop + 4], life: [0.45, 0.6], fade: 0.6, shadow: 0, frames: kit.baked('smoke', kit.B.smoke), delay: 0.08 }); s.kind = 'anim'; s.ms = 130; s.alpha = 0.6; }
    if (t === 'water') SPAWN.ripple(x, y, o);
    if (t === 'rock') { SPAWN.dust(x - 4, y, o); SPAWN.dust(x + 4, y, o); }
    if (t === 'spark') anim('type_hit2', impactFrames(t), x + rnd(-4, 4), y, { ...o, delay: 0.08, sortBias: 7, glow: true }, IMPACT_MS).hop = hop + rnd(-3, 3);
    if (strong) o.camera?.shake?.(2, 0.06);
    return p;
  }
  function projectile(t, x, y, o) {
    const p = custom('type_projectile', x, y, o, o.life ?? 2);
    const speed = o.speed ?? 170;
    let ang = dirAngle(o.dir);
    if (o.to) ang = Math.atan2(o.to.y - y, o.to.x - x);
    p.vx = Math.cos(ang) * speed; p.vy = Math.sin(ang) * speed;
    p.hop = o.hop ?? 8; p.frames = orbFrames(t); p.glow = T[t].glow;
    let acc = 0, ended = false;
    const end = (fxOn = true) => {
      if (ended) return; ended = true;
      if (fxOn) hit(t, p.x, p.y, { ...o, hop: p.hop, z: p.z });
      p.life = p.t;
      try { o.onHit?.(p.x, p.y); } catch (e) { console.error(e); }
    };
    p.onUpdate = (q, dt) => {
      if (o.auto !== false) { q.x += q.vx * dt; q.y += q.vy * dt; }
      if (o.to && Math.hypot(o.to.x - q.x, o.to.y - q.y) <= speed * dt + 1) { q.x = o.to.x; q.y = o.to.y; end(true); return; }
      acc += dt;
      while (acc > 0.03) { acc -= 0.03; typeBits(t, q.x, q.y, { z: q.z, hop: q.hop }, 1, { speed: [5, 15], over: { life: [0.18, 0.32] } }); }
    };
    p.onDraw = (q, r) => {
      r.shadow?.(q.x, q.y, q.z, 3, 1.5, 0.22);
      const f = q.frames; if (!f) return;
      r.sprite(f[Math.floor(q.t * 14) % f.length], q.x, q.y, q.z, { hop: q.hop, flip: q.vx < 0, flash: q.glow && r.is3D });
    };
    p.onEnd = () => { if (!ended && o.to) end(true); };
    return handle(p, { end, get type() { return t; } });
  }
  function area(t, x, y, o) {
    const R = Math.round(o.radius ?? 32);
    const p = decal('type_area', Array.from({ length: AREA_STEPS }, (_, k) => areaRing(t, R, k)), x, y, o, 0.42);
    p.fade = 0.35;
    const n = Math.max(8, Math.round(R / 2.5));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 6.2832, rr = R * rnd(0.55, 1);
      typeBits(t, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9, { ...o, hop: 2 }, 1, { ang: a, spreadA: 0.4, speed: [10, 30], delay: 0.15, over: t === 'fire' ? { vh: [50, 90] } : t === 'rock' ? { vh: [80, 130] } : t === 'water' ? { vh: [80, 120] } : {} });
    }
    hit(t, x, y, { ...o, hop: o.hop ?? 6 });
    if (t === 'rock' || R >= 48) o.camera?.shake?.(2, 0.15);
    return p;
  }
  function cone(t, x, y, o) {
    const R = Math.round(o.radius ?? 40), ang = dirAngle(o.dir), half = (((o.angle ?? 60) / 2) * Math.PI) / 180;
    const life = 0.28;
    const n = Math.round(R * 0.6);
    for (let k = 0; k < n; k++) {
      const a = ang + rnd(-half, half), d = (k / n) * 0.22;
      const p = bit('type_cone', x + Math.cos(ang) * 6, y + Math.sin(ang) * 5, { ...o, hop: o.hop ?? 8 }, { ang: a, speed: [R / 0.35 * 0.7, R / 0.35], flat: 1, vh: [-5, 15], g: t === 'water' ? 200 : t === 'rock' ? 300 : t === 'fire' ? -30 : 0, drag: 1, hop: [-2, 2], life: [0.28, 0.4], fade: 0.4, img: bitImg(t, pick), glow: T[t].glow, shadow: t === 'rock' || t === 'water' ? 1 : 0, delay: d, sortBias: 6 });
      if (t === 'leaf') { p.frames = leafHD(pick([C.grass_lt, C.grass_hi])); p.spinMs = 80; p.img = null; }
      if (t === 'wind') p.flip = Math.cos(a) < 0;
    }
    const tip = custom('type_cone_flash', x, y, o, life);
    tip.onDraw = (q, r) => { const f = impactFrames(t); if (f) r.sprite(f[Math.min(f.length - 1, Math.floor(q.t / 0.06))], q.x + Math.cos(ang) * 8, q.y + Math.sin(ang) * 6, q.z, { hop: o.hop ?? 8, flash: T[t].glow && r.is3D, alpha: 1 - q.progress * 0.5 }); };
    return tip;
  }
  function trail(t, x, y, o) { typeBits(t, x + rnd(-3, 3), y + rnd(-2, 2), { ...o, hop: o.hop ?? 4 }, o.count ?? 2, { speed: [4, 14], over: { life: [0.2, 0.35] } }); }
  const FORMS = { hit, projectile, area, cone, trail, melee: hit, dash: trail };
  function typeFX(type, x, y, o) {
    const t = typeKey(type || o.type);
    const f = FORMS[o.form || 'hit'] || hit;
    const p = f(t, x, y, o);
    if (p) p.elem = t;            // Renderer: farbiges Licht der Attacke
    return p;
  }
  for (const t of [...FX_TYPES, ...Object.keys(TYPE_ALIAS)]) {
    SPAWN['type_' + t] = (x, y, o) => typeFX(t, x, y, o);
    for (const form of Object.keys(FORMS)) SPAWN[`type_${t}_${form}`] = (x, y, o) => typeFX(t, x, y, { ...o, form });
  }
  SPAWN.type = (x, y, o) => typeFX(o.type, x, y, o);

  // ======================= telegraph & arena =======================
  // telegraph: { shape: 'circle'|'cone'|'line'|'arc', radius, dir, angle (deg, cone width), width (line), duration, type, onDone }
  SPAWN.telegraph = (x, y, o) => {
    let shape = o.shape || 'circle';
    let widthDeg = Math.round(o.angle ?? 70), R = Math.round(o.radius ?? 28);
    if (shape === 'arc') { shape = 'cone'; widthDeg = Math.round(o.angle ?? 140); R = Math.round(o.radius ?? 18); }
    const W = Math.round(o.width ?? 12), ai = A16(dirAngle(o.dir)), dur = o.duration ?? 0.6;
    const fillHex = T[typeKey(o.type)].accent;
    const p = custom('telegraph', x, y, { ...o, layer: 'floor', sortBias: -8 }, dur + 0.12);
    p.layer = 'floor'; p.keep = true;
    p.onDraw = (q, r) => {
      const prog = Math.min(1, q.t / dur);
      const fade = q.t > dur ? 1 - (q.t - dur) / 0.12 : Math.min(1, q.t / 0.06);
      const k = Math.min(TSTEPS, Math.ceil(ease.quadIn(prog) * TSTEPS));
      const fill = telegraphSprite(shape, R, ai, widthDeg, W, 'fill', k, fillHex);
      if (fill && k > 0) r.sprite(fill, q.x, q.y, q.z, { alpha: fade });
      const pulse = 0.55 + 0.45 * Math.sin(q.t * Math.PI * 2 * (4 + prog * 6));
      const rim = telegraphSprite(shape, R, ai, widthDeg, W, 'rim', 0, fillHex);
      if (rim) r.sprite(rim, q.x, q.y, q.z, { alpha: fade * pulse });
    };
    if (o.onDone) p.onEnd = () => o.onDone();
    return handle(p, { get progress() { return Math.min(1, p.t / dur); } });
  };
  // arena: ring decal r=72, opens in 0.35 s, pulses softly, handle.close() shrinks it away
  SPAWN.arena = (x, y, o) => {
    const R = Math.round(o.radius ?? 72), col = o.color || C.gold_lt;
    const p = custom('arena', x, y, { ...o, layer: 'floor', sortBias: -12 }, 1e9);
    p.layer = 'floor'; p.keep = true;
    let closing = -1;
    p.data = { close(q) { if (closing < 0) { closing = q.t; q.life = q.t + 0.35; } } };
    const runes = runeSprite(col);
    p.onUpdate = (q) => {
      if (closing < 0 && Math.random() < 0.08) { // light motes rising from the ring
        const a = rnd(0, 6.28);
        glowBit(q.x + Math.cos(a) * R, q.y + Math.sin(a) * R, { z: q.z }, { speed: [0, 2], vh: [10, 22], g: 0, hop: [0, 2], life: [0.8, 1.3], fade: 0.5, img: ember(C.white, col, 0.6), sortBias: 0 });
      }
    };
    p.onDraw = (q, r) => {
      let k, a;
      if (closing >= 0) { const c = Math.min(1, (q.t - closing) / 0.35); k = Math.max(0, Math.round(5 * (1 - c))); a = 1 - c; }
      else { const o2 = Math.min(1, q.t / 0.35); k = Math.round(ease.backOut(o2) * 5); k = Math.min(5, k); a = Math.min(1, q.t / 0.15); }
      const pulse = 0.6 + 0.25 * Math.sin(q.t * Math.PI * 2 * 0.8);
      const ringImg = arenaRing(R, k, col);
      if (ringImg) r.sprite(ringImg, q.x, q.y, q.z, { alpha: a * pulse });
      if (k >= 5 && runes) for (let i = 0; i < 8; i++) { const ang = q.t * 0.25 + (i / 8) * 6.2832; r.sprite(runes, q.x + Math.cos(ang) * (R - 6), q.y + Math.sin(ang) * (R - 6), q.z, { alpha: a * (0.5 + 0.3 * Math.sin(q.t * 3 + i)) }); }
    };
    if (o.onClose) p.onEnd = () => o.onClose();
    return handle(p, { radius: R });
  };

  // ======================= capture =======================
  // capture_throw: orb flies in an arc from (x,y) to opts.to, spinning, with sparkles; onLand(x, y) at the end
  SPAWN.capture_throw = (x, y, o) => {
    const to = o.to || { x: x + 40, y }, dur = o.dur ?? 0.45, H = o.height ?? 26, z0 = o.z || 0, z1 = o.toZ ?? z0, hop0 = o.hop ?? 12, hop1 = o.toHop ?? 0;
    const p = custom('capture_throw', x, y, o, dur);
    const fr = orbImgs();
    p.onUpdate = (q) => {
      const k = Math.min(1, q.t / dur);
      q.x = x + (to.x - x) * k; q.y = y + (to.y - y) * k;
      q.hop = hop0 + (hop1 - hop0) * k + ease.arc(k) * H + (z1 - z0) * LEVEL * k;
      if (Math.random() < 0.5) glowBit(q.x, q.y, { z: q.z, hop: q.hop }, { speed: [0, 6], vh: [-6, 6], g: 0, hop: [0, 0], life: [0.2, 0.35], fade: 0.6, img: sparkleSprite(pick([C.gold_lt, C.white]), 1.5) });
    };
    p.onDraw = (q, r) => {
      r.shadow?.(q.x, q.y, z0 + (z1 - z0) * Math.min(1, q.t / dur), 3, 1.5, 0.25);
      if (fr) r.sprite(fr[Math.floor(q.t * 16) % fr.length], q.x, q.y, q.z, { hop: q.hop });
    };
    p.onEnd = () => {
      SPAWN.sparkle(to.x, to.y, { z: z1, hop: hop1 + 4, count: 3, radius: 5 });
      try { o.onLand?.(to.x, to.y); } catch (e) { console.error(e); }
    };
    return handle(p);
  };
  // monster is drawn into the orb as a streak of light (0.3 s): { from: {x, y, hop}, sprite }
  SPAWN.capture_absorb = (x, y, o) => {
    const f = o.from || { x, y: y - 1, hop: 10 }, img = imgOf(o.sprite);
    const sil = img && silhouette(img, C.gold_lt);
    const p = custom('capture_absorb', f.x, f.y, o, 0.32);
    p.onDraw = (q, r) => { if (sil && q.t < 0.18) r.sprite(sil, f.x, f.y, q.z, { alpha: 1 - q.t / 0.18, flash: r.is3D }); };
    for (let k = 0; k < 14; k++) {
      const s = glowBit(f.x + rnd(-8, 8), f.y + rnd(-3, 3), o, { speed: [0, 0], vh: [0, 0], g: 0, hop: [(f.hop ?? 10) - 6, (f.hop ?? 10) + 8], life: [0.3, 0.3], fade: 0.2, img: ember(C.white, C.gold_lt, 1), delay: k * 0.012 });
      const sx = s.x, sy = s.y, sh = s.hop;
      s.onUpdate = (q) => { const k2 = ease.quadIn(Math.min(1, q.t / 0.28)); q.x = sx + (x - sx) * k2; q.y = sy + (y - sy) * k2; q.hop = sh + ((o.hop ?? 3) - sh) * k2; };
    }
    if (o.onDone) p.onEnd = () => o.onDone();
    return handle(p);
  };
  // capture_shake: orb on the ground wobbles `shakes` times (0.5 s each: 0.3 wobble + 0.2 pause). onShake(i), onDone().
  // { hold: true } keeps the orb lying there until handle.close() (or capture_success/capture_break with { orb })
  SPAWN.capture_shake = (x, y, o) => {
    const n = o.shakes ?? 1, per = 0.5, total = n * per;
    const p = custom('capture_shake', x, y, o, o.hold ? 1e9 : total + 0.05);
    p.keep = !!o.hold;
    const fr = orbShake(), still = orbImgs();
    let fired = -1, done = false;
    p.onUpdate = (q) => {
      const i = Math.floor(q.t / per);
      if (i < n && i > fired) { fired = i; try { o.onShake?.(i); } catch (e) { console.error(e); } }
      if (!done && q.t >= total) { done = true; try { o.onDone?.(); } catch (e) { console.error(e); } }
    };
    p.onDraw = (q, r) => {
      r.shadow?.(q.x, q.y, q.z, 3, 1.5, 0.28);
      const local = q.t % per, active = q.t < total && local < 0.3;
      const w = active ? Math.sin((local / 0.3) * Math.PI * 2) : 0;
      const img = active && fr ? fr[Math.min(fr.length - 1, Math.floor((w + 1) * 0.5 * fr.length))] : still?.[0];
      if (img) r.sprite(img, q.x + Math.round(w * 1.5), q.y, q.z, { hop: active ? Math.abs(w) * 1.5 : 0 });
      // core glow pulse (the cage "breathing")
      if (active) r.sprite(ember(C.gold_lt, C.fx_orange, 1.2), q.x + Math.round(w * 1.5), q.y, q.z, { hop: 4, alpha: 0.5 + 0.5 * Math.abs(w), flash: r.is3D });
    };
    return handle(p);
  };
  SPAWN.capture_success = (x, y, o) => {
    o.orb?.close?.();
    const p = custom('capture_success', x, y, o, o.life ?? 1.4);
    const still = orbImgs();
    p.onDraw = (q, r) => {
      const a = q.t > q.life - 0.3 ? (q.life - q.t) / 0.3 : 1;
      r.shadow?.(q.x, q.y, q.z, 3, 1.5, 0.28 * a);
      const hop = q.t < 0.25 ? ease.arc(q.t / 0.25) * 3 : 0;
      if (still) r.sprite(still[0], q.x, q.y, q.z, { hop, alpha: a, flash: q.t < 0.08 });
    };
    const st = starSprite(C.gold_lt);
    for (let k = 0; k < 5; k++) bit('star', x, y, o, { ang: -Math.PI / 2 + (k - 2) * 0.55, speed: [28, 36], flat: 1, vh: [60, 80], g: 220, hop: [4, 5], life: [0.8, 0.9], fade: 0.4, img: st, shadow: 1, glow: true, delay: 0.05 });
    SPAWN.sparkle(x, y, { z: o.z, hop: 6, count: 5, radius: 10, stagger: 0.07 });
    const ringP = decal('success_ring', [floorRing(10, C.gold_lt, 1), floorRing(16, C.gold_lt, 1), floorRing(22, C.gold_lt, 1)], x, y, o, 0.35);
    ringP.fade = 0.5;
    if (o.onDone) p.onEnd = () => o.onDone();
    return handle(p);
  };
  SPAWN.capture_break = (x, y, o) => {
    o.orb?.close?.();
    const flash = custom('capture_break', x, y, o, 0.35);
    const op = orbOpenImg();
    flash.onDraw = (q, r) => {
      const k = q.t / 0.35;
      const f = impactFrames('normal'); if (f) r.sprite(f[Math.min(f.length - 1, Math.floor(k * f.length))], q.x, q.y, q.z, { hop: 6, flash: r.is3D });
      if (op && k < 0.7) r.sprite(op, q.x, q.y, q.z, { alpha: 1 - k });
    };
    for (let k = 0; k < 10; k++) glowBit(x, y, o, { ang: (k / 10) * 6.28, speed: [60, 90], vh: [-10, 20], drag: 3, g: 0, hop: [5, 7], life: [0.2, 0.35], fade: 0.5, img: streak(C.white, 4) });
    SPAWN.poof(x, y, { z: o.z });
    o.camera?.shake?.(1, 0.1);
    return handle(flash);
  };

  // ======================= summon / recall =======================
  SPAWN.monster_summon = (x, y, o) => {
    const p = custom('monster_summon', x, y, o, 0.95);
    const bm = beam(14, 60, C.white, T[typeKey(o.type)].accent);
    const op = orbOpenImg();
    let appeared = false;
    p.onUpdate = (q) => {
      if (!appeared && q.t >= 0.25) { appeared = true; try { o.onAppear?.(); } catch (e) { console.error(e); } SPAWN.sparkle(x, y, { z: q.z, hop: 10, count: 4, radius: 9 }); }
      if (q.t < 0.6 && Math.random() < 0.6) glowBit(x + rnd(-6, 6), y + rnd(-2, 2), { z: q.z }, { speed: [0, 3], vh: [40, 70], g: 0, hop: [0, 4], life: [0.35, 0.5], fade: 0.6, img: ember(C.white, T[typeKey(o.type)].accent, 0.8) });
    };
    p.onDraw = (q, r) => {
      const t = q.t;
      if (op && t < 0.3) r.sprite(op, q.x, q.y, q.z, { hop: 6 + t * 10, alpha: 1 - t / 0.3 });
      const a = t < 0.15 ? t / 0.15 : t < 0.45 ? 1 : Math.max(0, 1 - (t - 0.45) / 0.5);
      if (bm && a > 0) r.sprite(bm, q.x, q.y + 0.5, q.z, { alpha: a * 0.85, flash: r.is3D });
    };
    const rp = decal('summon_ring', [floorRing(6, C.white, 1), floorRing(12, C.gold_lt, 1), floorRing(18, C.gold_lt, 1), floorRing(24, C.gold_lt, 1)], x, y, { ...o, delay: 0.15 }, 0.45);
    rp.fade = 0.5;
    if (o.onDone) p.onEnd = () => o.onDone();
    return handle(p);
  };
  SPAWN.monster_recall = (x, y, o) => {
    const img = imgOf(o.sprite), sil = img && silhouette(img, C.white), to = o.to;
    const p = custom('monster_recall', x, y, o, to ? 0.6 : 0.35);
    const bm = beam(10, 48, C.white, C.gold_lt);
    p.onDraw = (q, r) => {
      const t = q.t;
      if (sil && t < 0.25 && Math.floor(t * 30) % 2 === 0) r.sprite(sil, x, y, q.z, { alpha: 1 - t / 0.25, flash: r.is3D });
      if (bm && t < 0.3) r.sprite(bm, x, y + 0.5, q.z, { alpha: (1 - t / 0.3) * 0.8, flash: r.is3D });
      if (to && t >= 0.25) {
        const k = ease.quadInOut(Math.min(1, (t - 0.25) / 0.35));
        const px = x + (to.x - x) * k, py = y + (to.y - y) * k, hop = 10 + ease.arc(k) * 14;
        r.sprite(ember(C.white, C.gold_lt, 2), px, py, q.z, { hop, flash: r.is3D });
      }
    };
    for (let k = 0; k < 10; k++) {
      const s = glowBit(x + rnd(-10, 10), y + rnd(-3, 3), o, { speed: [0, 0], vh: [0, 0], g: 0, hop: [4, 20], life: [0.25, 0.25], fade: 0.2, img: ember(C.white, C.gold_lt, 0.8) });
      const sx = s.x, sy = s.y, sh = s.hop;
      s.onUpdate = (q) => { const k2 = ease.quadIn(Math.min(1, q.t / 0.24)); q.x = sx + (x - sx) * k2; q.y = sy + (y - sy) * k2; q.hop = sh + (10 - sh) * k2; };
    }
    if (o.onDone) p.onEnd = () => o.onDone();
    return handle(p);
  };

  // ======================= progression =======================
  SPAWN.level_up = (x, y, o) => {
    const p = custom('level_up', x, y, o, 1.2);
    for (let k = 0; k < 18; k++) glowBit(x + rnd(-8, 8), y + rnd(-3, 3), o, { speed: [0, 4], vh: [50, 90], g: -60, drag: 0, hop: [0, 8], life: [0.5, 0.8], fade: 0.5, img: pick([ember(C.white, C.gold_lt, 0.8), ember(C.gold_lt, C.fx_yellow, 1), sparkleSprite(C.gold_lt, 2)]), delay: (k / 18) * 0.6 });
    const rg = ellipseRing(11, 4, C.gold_lt, 1);
    p.onDraw = (q, r) => {
      for (let i = 0; i < 2; i++) { const t = q.t - i * 0.18; if (t < 0 || t > 0.6) continue; r.sprite(rg, q.x, q.y + 1, q.z, { hop: ease.quadOut(t / 0.6) * 28, alpha: 1 - t / 0.6, flash: r.is3D }); }
    };
    SPAWN.text(x, y, { z: o.z, hop: o.hop ?? 30, text: o.text || (o.level ? `LV ${o.level}!` : 'LV UP!'), color: C.gold_lt, size: 2, life: 1.1, rise: 10, delay: 0.12 });
    SPAWN.sparkle(x, y, { z: o.z, hop: 18, count: 3, radius: 12, delay: 0.2 });
    return handle(p);
  };
  // evolve: { from, to (canvas | sprite key | species id), dur = 3.2, onSwap, onDone } – gameplay hides the monster
  // until onDone; fx draws the converging light, the blinking silhouettes (0.4 → 0.1 s), the burst and the new form.
  SPAWN.evolve = (x, y, o) => {
    const dur = o.dur ?? 3.2, from = imgOf(o.from), to = imgOf(o.to) || from;
    const sf = from && silhouette(from), st = to && silhouette(to);
    const p = custom('evolve', x, y, o, dur);
    p.keep = true; p.sortBias = 5;
    const sw0 = 0.6, sw1 = dur * 0.75;
    // silhouette switch schedule
    const sched = []; { let t = sw0, i = 0; const iv = [0.4, 0.4, 0.3, 0.3, 0.2, 0.2, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.06]; while (t < sw1) { sched.push(t); t += iv[Math.min(iv.length - 1, i++)]; } }
    const bm = beam(26, 70, C.white, C.gold_lt);
    let swapped = false;
    p.onUpdate = (q) => {
      const t = q.t;
      if (t < sw1 && Math.random() < 0.7) {
        const a = rnd(0, 6.28), d = rnd(18, 30);
        const s = glowBit(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, q, { speed: [0, 0], vh: [0, 0], g: 0, hop: [6, 26], life: [0.4, 0.4], fade: 0.3, img: ember(C.white, C.gold_lt, 0.7) });
        const sx = s.x, sy = s.y, sh = s.hop;
        s.onUpdate = (b) => { const k = ease.quadIn(Math.min(1, b.t / 0.38)); b.x = sx + (x - sx) * k; b.y = sy + (y - sy) * k; b.hop = sh + (12 - sh) * k; };
      }
      if (!swapped && t >= sw1) {
        swapped = true;
        try { o.onSwap?.(); } catch (e) { console.error(e); }
        const f = impactFrames('normal'); anim('evolve_burst', f, x, y, { z: q.z, sortBias: 9, glow: true }, 70).hop = 12;
        for (let k = 0; k < 14; k++) bit('star', x, y, q, { ang: (k / 14) * 6.28, speed: [40, 70], vh: [40, 80], g: 160, hop: [10, 14], life: [0.6, 0.9], fade: 0.4, img: k % 2 ? starSprite(C.gold_lt, 2.5) : sparkleSprite(C.white, 3), glow: true, shadow: 1 });
        decal('evolve_ring', [floorRing(10, C.white, 1), floorRing(20, C.gold_lt, 1), floorRing(30, C.gold_lt, 1), floorRing(40, C.gold_lt, 1)], x, y, q, 0.5).fade = 0.5;
        o.camera?.shake?.(2, 0.2);
      }
    };
    p.onDraw = (q, r) => {
      const t = q.t, hop = o.hop ?? 0;
      r.shadow?.(q.x, q.y, q.z, 8, 3, 0.28);
      const ba = t < sw0 ? t / sw0 : t < sw1 ? 0.7 + 0.3 * Math.sin(t * 10) : Math.max(0, 1 - (t - sw1) / 0.5);
      if (bm && ba > 0) r.sprite(bm, q.x, q.y + 1, q.z, { alpha: ba * 0.55, flash: r.is3D });
      if (t < sw0) { if (from) r.sprite(from, q.x, q.y, q.z, { hop }); if (sf) r.sprite(sf, q.x, q.y, q.z, { hop, alpha: t / sw0 }); }
      else if (t < sw1) { let i = 0; while (i + 1 < sched.length && sched[i + 1] <= t) i++; const s = i % 2 ? st : sf; if (s) r.sprite(s, q.x, q.y, q.z, { hop, flash: r.is3D }); }
      else if (to) { const k = Math.min(1, (t - sw1) / 0.35); r.sprite(to, q.x, q.y, q.z, { hop }); if (st && k < 1) r.sprite(st, q.x, q.y, q.z, { hop, alpha: 1 - k }); }
    };
    if (o.onDone) p.onEnd = () => o.onDone();
    return handle(p, { get swapped() { return swapped; } });
  };
  // faint: optional { sprite } is drawn blinking & fading (gameplay hides its monster), dizzy stars, grey poof
  SPAWN.faint = (x, y, o) => {
    const img = imgOf(o.sprite, 'faint');
    const p = custom('faint', x, y, o, 0.9);
    const st = starSprite(C.gold_lt, 2);
    p.onDraw = (q, r) => {
      const t = q.t;
      if (img && t < 0.55 && Math.floor(t * 16) % 2 === 0) r.sprite(img, q.x, q.y, q.z, { alpha: 1 - t / 0.55 });
      if (st) for (let i = 0; i < 3; i++) { const a = t * 6 + (i / 3) * 6.28; r.sprite(st, q.x + Math.cos(a) * 7, q.y + Math.sin(a) * 2, q.z, { hop: (o.hop ?? 18) + Math.sin(a) * 1, alpha: Math.min(1, (0.9 - t) * 3) }); }
    };
    SPAWN.poof(x, y, { z: o.z, delay: 0.35 });
    if (o.onDone) p.onEnd = () => o.onDone();
    return handle(p);
  };
}
