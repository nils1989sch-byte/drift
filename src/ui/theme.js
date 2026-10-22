// UI palette (from docs/STYLE_GUIDE.md) + small pixel drawing helpers. No pure black anywhere.
export const C = {
  ink: '#181020', shadow: '#302848', night: '#283048', white: '#f8f8f8',
  frame: '#d8c8a0', frameDk: '#a89870', frameLt: '#f0e8c8',
  heart_dk: '#901828', heart_md: '#e03030', heart_hi: '#f8a088',
  gold_dk: '#a86010', gold_md: '#e8b028', gold_lt: '#f8e878',
  stone_lt: '#8090a8', stone_hi: '#b8c8d0', metal_lt: '#c8d8e8',
  grass: '#48a050', rupee: '#30c858', magic: '#40c860',
  red_md: '#c84040', red_lt: '#f08060', blue_md: '#4868c8', blue_lt: '#90b0f0',
  dim: '#b8b0c8', bg0: '#0d0f1c', bg1: '#2d3550',
  // HD-2D / Octopath-like UI materials
  parch: '#d9cfbd', parchLt: '#ece4d4', parchDk: '#bdb09a', parchSh: '#a89a84', edge: '#3a2e2a', edgeLt: '#5a4a40',
  textDk: '#2a2026', textSh: '#c4b8a2', accent: '#8a3a2a', plaque: '#141019', hair: '#c8b07a', ivory: '#f4ecd8', ivoryDim: '#c8c0b0',
};

/** Merge palette entries from assets.palette (art agent) where names match. */
export function applyPalette(pal) {
  if (!pal) return;
  const map = { ink: 'ink', shadow: 'shadow', night: 'night', white: 'white', ui_frame: 'frame',
    heart_dk: 'heart_dk', heart_md: 'heart_md', heart_hi: 'heart_hi', gold_dk: 'gold_dk', gold_md: 'gold_md', gold_lt: 'gold_lt' };
  for (const [k, v] of Object.entries(map)) if (typeof pal[k] === 'string' && /^#[0-9a-f]{6}$/i.test(pal[k])) C[v] = pal[k];
}

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Rounded-corner pixel rect (corner cut of r px, stair-stepped). */
export function pxRect(ctx, x, y, w, h, color, r = 0) {
  ctx.fillStyle = color;
  if (r <= 0) { ctx.fillRect(x, y, w, h); return; }
  for (let i = 0; i < r; i++) {
    const inset = r - i; // stair
    ctx.fillRect(x + inset, y + i, w - inset * 2, 1);
    ctx.fillRect(x + inset, y + h - 1 - i, w - inset * 2, 1);
  }
  ctx.fillRect(x, y + r, w, h - r * 2);
}

/**
 * Elegant dark panel (HD-2D look): translucent plaque, ink edge, warm gold hairline, corner studs.
 */
export function panel(ctx, x, y, w, h, { alpha = 0.86 } = {}) {
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * 0.35; pxRect(ctx, x + 2, y + 2, w, h, C.ink, 3); // soft drop shadow
  ctx.globalAlpha = pa * alpha; pxRect(ctx, x, y, w, h, C.plaque, 3);
  ctx.globalAlpha = pa * 0.8; ctx.fillStyle = C.ink;
  ctx.fillRect(x + 3, y, w - 6, 1); ctx.fillRect(x + 3, y + h - 1, w - 6, 1); ctx.fillRect(x, y + 3, 1, h - 6); ctx.fillRect(x + w - 1, y + 3, 1, h - 6);
  ctx.globalAlpha = pa * 0.55; ctx.fillStyle = C.hair;
  ctx.fillRect(x + 4, y + 2, w - 8, 1); ctx.fillRect(x + 4, y + h - 3, w - 8, 1); ctx.fillRect(x + 2, y + 4, 1, h - 8); ctx.fillRect(x + w - 3, y + 4, 1, h - 8);
  ctx.globalAlpha = pa * 0.9;
  for (const [cx, cy] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 4], [x + w - 4, y + h - 4]]) {
    ctx.fillStyle = C.hair; ctx.fillRect(cx, cy, 2, 2);
  }
  ctx.globalAlpha = pa;
}

/** Small dark HUD plaque: translucent, ink edge at half strength, faint gold hairline. */
export function plaque(ctx, x, y, w, h, a = 0.58) {
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * a; pxRect(ctx, x, y, w, h, C.plaque, 2);
  ctx.globalAlpha = pa * 0.38; ctx.fillStyle = C.hair;
  ctx.fillRect(x + 2, y + 1, w - 4, 1); ctx.fillRect(x + 2, y + h - 2, w - 4, 1);
  ctx.fillRect(x + 1, y + 2, 1, h - 4); ctx.fillRect(x + w - 2, y + 2, 1, h - 4);
  ctx.globalAlpha = pa;
}

// ---- parchment / stone speech bubble with an irregular dark rim (cached per size) ----------
const hash = (n) => { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; };
const bubbleCache = new Map();
export function bubble(w, h, seed = 7) {
  const key = w + 'x' + h + ':' + seed;
  if (bubbleCache.has(key)) return bubbleCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const R = 4;
  const corner = (i, n) => { const d = Math.min(i, n - 1 - i); if (d >= R) return 0; const t = R - d - 0.5; return Math.round(R - Math.sqrt(Math.max(0, R * R - t * t))); };
  const jit = (i, side) => (hash(i * 7 + side * 131 + seed * 977) % 5 === 0 ? 1 : 0);
  // rows: rim with jitter, then parchment inside
  for (let y = 0; y < h; y++) {
    const ci = corner(y, h);
    const l = ci + jit(y >> 1, 1), r = ci + jit(y >> 1, 2);
    g.fillStyle = C.edge; g.fillRect(l, y, w - l - r, 1);
  }
  // top/bottom rim jitter (notches inward = rim thicker)
  for (let x = 0; x < w; x++) {
    const ci = corner(x, w);
    const t = 2 + ci + jit(x >> 1, 3), b = 2 + ci + jit(x >> 1, 4);
    g.fillStyle = C.parch;
    const top = t, bot = h - b;
    const li = 2 + ci; // keep side rim ≥ 2
    if (x < 2 || x >= w - 2) continue;
    void li;
    g.fillRect(x, top, 1, Math.max(0, bot - top));
  }
  // side rim: repaint 2 px rim at left/right with jitter
  for (let y = 0; y < h; y++) {
    const ci = corner(y, h);
    const l = ci + jit(y >> 1, 1), r = ci + jit(y >> 1, 2);
    g.fillStyle = C.edge;
    g.fillRect(l, y, 2 + jit(y, 5), 1); g.fillRect(w - r - 2 - jit(y, 6), y, 2 + jit(y, 6), 1);
  }
  // paper grain & light
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const pr = [0xd9, 0xcf, 0xbd];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (d[o + 3] === 0 || (d[o] !== pr[0] || d[o + 1] !== pr[1] || d[o + 2] !== pr[2])) continue;
    const hv = hash(x * 92821 + y * 68917 + seed) % 23;
    let k = hv === 0 ? -10 : hv === 1 ? 8 : hv === 2 ? -5 : 0;
    k += Math.round(6 - (y / h) * 12); // light from above
    d[o] += k; d[o + 1] += k; d[o + 2] += k;
  }
  g.putImageData(img, 0, 0);
  // inner highlight under the top rim and shade above the bottom rim
  g.globalAlpha = 0.5; g.fillStyle = C.parchLt; g.fillRect(6, 3, w - 12, 1);
  g.fillStyle = C.parchSh; g.fillRect(6, h - 4, w - 12, 1); g.globalAlpha = 1;
  bubbleCache.set(key, c);
  if (bubbleCache.size > 40) bubbleCache.delete(bubbleCache.keys().next().value);
  return c;
}

// Cache of pixel discs (filled circle with outline) rendered at UI resolution.
const discCache = new Map();
export function disc(r, fill, line, lineW = 1) {
  const key = r + fill + line + lineW;
  if (discCache.has(key)) return discCache.get(key);
  const d = r * 2 + 1;
  const c = document.createElement('canvas'); c.width = d; c.height = d;
  const g = c.getContext('2d');
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
    const dist = Math.hypot(x - r, y - r);
    if (dist <= r + 0.35) { g.fillStyle = dist > r + 0.35 - lineW ? line : fill; g.fillRect(x, y, 1, 1); }
  }
  discCache.set(key, c);
  return c;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
export const easeOutBounce = (t) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
