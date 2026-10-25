// Shared drawing helpers for the monster UI: type plaques, HP/XP bars with trailing animation,
// crisp HD icons/portraits (integer device-pixel scale, independent of the UI scale), cooldown rings.
import { drawText, measure } from './font.js';
import { C, pxRect, rgba } from './theme.js';
import { typeInfo, speciesId, monTypes } from './data.js';

/** Small type plaque ("Feuer"), returns its width. compact → 3-letter label. */
export function typePlaque(ctx, x, y, type, compact = false) {
  const t = typeInfo(type);
  const label = compact ? t.short : t.name;
  const w = measure(label) + 6;
  pxRect(ctx, x, y, w, 9, t.dark, 1);
  pxRect(ctx, x + 1, y + 1, w - 2, 7, t.color, 0);
  ctx.fillStyle = rgba(t.light, 0.6); ctx.fillRect(x + 2, y + 1, w - 4, 1);
  drawText(ctx, label, x + 3, y - 2, { color: '#fffaf0', shadow: t.dark });
  return w;
}

export function hpColor(f) { return f > 0.5 ? '#58c868' : f > 0.2 ? '#e8c040' : '#e05040'; }

/** HP bar: dark trough, light "trail" (recent damage) and the coloured fill. */
export function hpBar(ctx, x, y, w, h, frac, trail = frac) {
  pxRect(ctx, x, y, w, h, C.ink, 1);
  ctx.fillStyle = rgba(C.night, 0.9); ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  const iw = w - 2;
  const fw = Math.round(iw * Math.max(0, Math.min(1, frac)));
  const tw = Math.round(iw * Math.max(0, Math.min(1, trail)));
  if (tw > fw) { ctx.fillStyle = '#f8e0c8'; ctx.fillRect(x + 1 + fw, y + 1, tw - fw, h - 2); }
  if (fw > 0) {
    const col = hpColor(frac);
    ctx.fillStyle = col; ctx.fillRect(x + 1, y + 1, fw, h - 2);
    ctx.fillStyle = rgba('#ffffff', 0.35); ctx.fillRect(x + 1, y + 1, fw, 1);
  }
}

export function xpBar(ctx, x, y, w, frac) {
  ctx.fillStyle = rgba(C.ink, 0.85); ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = '#58a8f0'; ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * Math.max(0, Math.min(1, frac))), 1);
}

// per-monster HP animation: shown value eases to the real one, the trail drains after a short delay
const hpAnim = new WeakMap();
export function animHp(m, hp, max, dt) {
  if (!m || typeof m !== 'object') return { f: hp / max, trail: hp / max };
  let s = hpAnim.get(m);
  const f = Math.max(0, Math.min(1, hp / max));
  if (!s) { s = { f, trail: f, wait: 0 }; hpAnim.set(m, s); }
  if (f < s.f - 1e-4) { s.wait = 0.45; if (s.trail < s.f) s.trail = s.f; }
  s.f += (f - s.f) * Math.min(1, dt * 10);
  if (Math.abs(f - s.f) < 0.002) s.f = f;
  if (s.wait > 0) s.wait -= dt;
  else if (s.trail > s.f) s.trail = Math.max(s.f, s.trail - dt * 0.6);
  if (s.trail < s.f) s.trail = s.f;
  return s;
}

/**
 * Draw an HD image (icons/portraits are 32×32 art) centred at UI coords (cx, cy) with an integer device-pixel scale
 * close to `target` UI px. Returns the drawn size in UI px.
 */
export function drawHD(U, ctx, img, cx, cy, target, { alpha = 1, silhouette = false, k: forceK = 0 } = {}) {
  if (!img) return 0;
  const S = U.S;
  const k = forceK || Math.max(1, Math.round((target * S) / Math.max(img.width, img.height)));
  const dw = img.width * k, dh = img.height * k;
  const src = silhouette ? silhouetteOf(img, typeof silhouette === 'string' ? silhouette : '#2a2236') : img;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= alpha;
  ctx.drawImage(src, Math.round(cx * S - dw / 2), Math.round(cy * S - dh / 2), dw, dh);
  ctx.restore();
  return dw / S;
}
const silCache = new WeakMap();
function silhouetteOf(img, color) {
  let per = silCache.get(img);
  if (!per) { per = new Map(); silCache.set(img, per); }
  let c = per.get(color);
  if (c) return c;
  c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  per.set(color, c);
  return c;
}

// ---- portraits ------------------------------------------------------------------------------------
const portraitFallback = new Map();
function fallbackPortrait(id, types) {
  const key = id + '|' + types.join(',');
  if (portraitFallback.has(key)) return portraitFallback.get(key);
  const t = typeInfo(types[0]);
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = (x - 15.5) / 11, dy = (y - 18) / 10;
    const d = dx * dx + dy * dy;
    if (d > 1.15) continue;
    g.fillStyle = d > 0.92 ? C.ink : dy < -0.4 && dx < 0 ? t.light : dx > 0.45 || dy > 0.55 ? t.dark : t.color;
    g.fillRect(x, y, 1, 1);
  }
  g.fillStyle = C.ink; g.fillRect(11, 15, 3, 4); g.fillRect(18, 15, 3, 4);
  g.fillStyle = '#ffffff'; g.fillRect(11, 15, 1, 1); g.fillRect(18, 15, 1, 1);
  portraitFallback.set(key, c);
  return c;
}
export function portraitImg(U, mOrId) {
  const id = speciesId(mOrId);
  const a = U.assets;
  const s = a?.sprites?.[`mon_${id}_icon`] || a?.icons?.[`mon_${id}_icon`];
  const img = Array.isArray(s) ? s[0] : s;
  if (img && img.width) return img;
  return fallbackPortrait(id || '?', monTypes(U.game, typeof mOrId === 'string' ? { id: mOrId } : mOrId));
}
export function drawPortrait(U, ctx, mOrId, cx, cy, target, opts) { return drawHD(U, ctx, portraitImg(U, mOrId), cx, cy, target, opts); }

/** Item icon (`icon_<id>` in assets.icons) or a fallback; drawn crisp at ~target UI px. */
export function drawItemIcon(U, ctx, id, cx, cy, target, opts) {
  if (!id) return 0;
  const a = U.assets?.icons || {};
  const img = a['icon_' + id] || a[id] || U.icon(id) || U.icon('icon_' + id) || fallbackItem(id);
  return drawHD(U, ctx, img, cx, cy, target, opts);
}
const itemFallback = new Map();
function fallbackItem(id) {
  if (itemFallback.has(id)) return itemFallback.get(id);
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const g = c.getContext('2d');
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const col = `hsl(${h % 360} 45% 55%)`;
  g.fillStyle = C.ink; g.fillRect(2, 2, 12, 12);
  g.fillStyle = col; g.fillRect(3, 3, 10, 10);
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(3, 3, 10, 1);
  itemFallback.set(id, c);
  return c;
}

// ---- cooldown ring ----------------------------------------------------------------------------------
const ringCache = new Map();
function ringPixels(r) {
  if (ringCache.has(r)) return ringCache.get(r);
  const pts = [];
  for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
    const d = Math.hypot(x + 0.5, y + 0.5);
    if (d <= r + 0.5 && d > r - 1.5) pts.push([x, y, (Math.atan2(x + 0.5, -(y + 0.5)) + Math.PI * 2) % (Math.PI * 2)]);
  }
  pts.sort((a, b) => a[2] - b[2]);
  ringCache.set(r, pts);
  return pts;
}
/** Ring around (cx, cy): `frac` of it (clockwise from 12 o'clock) in `color`, rest in `bg`. */
export function ring(ctx, cx, cy, r, frac, color, bg = null) {
  const pts = ringPixels(r);
  const n = Math.round(pts.length * Math.max(0, Math.min(1, frac)));
  if (bg) { ctx.fillStyle = bg; for (let i = n; i < pts.length; i++) ctx.fillRect(cx + pts[i][0], cy + pts[i][1], 1, 1); }
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) ctx.fillRect(cx + pts[i][0], cy + pts[i][1], 1, 1);
}
