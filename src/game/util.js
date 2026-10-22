// Gameplay helpers: math, rects, sprite lookup with fallbacks, safe calls into other agents' APIs.
import { TILE, LEVEL, DIR_VEC } from '../engine/constants.js';
import { fallbackSprite } from './fallback.js';

export { TILE, LEVEL, DIR_VEC };
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function overlap(a, b) {
  return a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function pointIn(px, py, r) { return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h; }
export function rectCenter(r) { return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }

// 4-way facing from a vector (prefers the dominant axis; keeps `prev` on ties for stable facing).
export function dirFromVec(x, y, prev = 'down') {
  if (!x && !y) return prev;
  const ax = Math.abs(x), ay = Math.abs(y);
  if (Math.abs(ax - ay) < 0.05) {
    // diagonal: keep previous if it is one of the two components
    if ((prev === 'left' && x < 0) || (prev === 'right' && x > 0) || (prev === 'up' && y < 0) || (prev === 'down' && y > 0)) return prev;
  }
  if (ax > ay) return x < 0 ? 'left' : 'right';
  return y < 0 ? 'up' : 'down';
}
export const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

// Call a method on a possibly-missing object without ever throwing.
export function safe(obj, fn, ...args) {
  try { const f = obj?.[fn]; return typeof f === 'function' ? f.apply(obj, args) : undefined; }
  catch (e) { console.warn(`[game] ${fn} failed:`, e); return undefined; }
}

// Sprite lookup: assets.sprites[key] (array or canvas) → frame by time; falls back to a placeholder.
export function spriteFrame(assets, key, t = 0, fps = 6, alt) {
  const s = assets?.sprites;
  let arr = s?.[key];
  if ((!arr || (Array.isArray(arr) && !arr.length)) && alt) arr = s?.[alt];
  if (!arr || (Array.isArray(arr) && !arr.length)) return fallbackSprite(key);
  if (!Array.isArray(arr)) return arr;
  if (arr.length === 1) return arr[0];
  return arr[Math.floor(t * (arr.fps || fps)) % arr.length];
}
export function hasSprite(assets, key) {
  const a = assets?.sprites?.[key];
  return !!(a && (!Array.isArray(a) || a.length));
}

// Frame from an Animator, unless it only has a placeholder → our own fallback per sprite key.
export function animFrame(anim, fbKey) {
  const f = anim?.frame;
  if (f && !f.placeholder) return { img: f, flip: !!anim.flip };
  return { img: fallbackSprite(fbKey), flip: false };
}
