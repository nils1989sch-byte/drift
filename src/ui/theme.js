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
  parch: '#d4cdbf', parchLt: '#ece4d4', parchDk: '#bdb09a', parchSh: '#a89a84', edge: '#3a2e2a', edgeLt: '#5a4a40',
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
/** Row inset of the bubble outline: chamfered corners + shallow chevron points on the left/right sides. */
export function bubbleInset(y, h, chev = 4, cham = 5) {
  const mid = (h - 1) / 2;
  const cv = Math.round(chev * Math.abs(y - mid) / mid);
  const top = Math.max(0, cham - y), bot = Math.max(0, cham - (h - 1 - y));
  return cv + Math.max(top, bot);
}
export function bubble(w, h, seed = 7) {
  const key = w + 'x' + h + ':' + seed;
  if (bubbleCache.has(key)) return bubbleCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const jit = (i, side) => (hash(i * 7 + side * 131 + seed * 977) % 6 === 0 ? 1 : 0);
  const fill = [[0xe2, 0xdc, 0xd0], [0xc2, 0xb9, 0xaa]]; // top -> bottom
  const img = g.createImageData(w, h), d = img.data;
  const ed = [0x2e, 0x26, 0x24];
  const set = (x, y, col, a = 255) => { const o = (y * w + x) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = a; };
  for (let y = 0; y < h; y++) {
    const ins = bubbleInset(y, h);
    const l = ins + jit(y >> 1, 1), r = w - 1 - ins - jit(y >> 1, 2);
    const edgeRow = y < 2 || y >= h - 2;
    const k = y / (h - 1);
    const base = fill[0].map((v, i) => Math.round(v + (fill[1][i] - v) * k));
    for (let x = l; x <= r; x++) {
      // slanted parts get a thicker rim so the outline reads evenly
      const ins1 = bubbleInset(Math.max(0, y - 1), h), ins2 = bubbleInset(Math.min(h - 1, y + 1), h);
      const rimL = 2 + Math.max(0, Math.abs(ins1 - ins2) >> 1), rimR = rimL;
      if (edgeRow || x < l + rimL || x > r - rimR) { set(x, y, ed); continue; }
      const hv = hash(x * 92821 + y * 68917 + seed) % 29;
      const n = hv === 0 ? -9 : hv === 1 ? 7 : hv === 2 ? -4 : 0;
      set(x, y, base.map((v) => v + n));
    }
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.45; g.fillStyle = '#f2eee6';
  g.fillRect(bubbleInset(3, h) + 5, 3, w - (bubbleInset(3, h) + 5) * 2, 1);
  g.globalAlpha = 1;
  bubbleCache.set(key, c);
  if (bubbleCache.size > 40) bubbleCache.delete(bubbleCache.keys().next().value);
  return c;
}

/** Elongated-hexagon name tab (Octopath-like): taupe fill, dark rim, pointed ends. */
export function nameTab(ctx, x, y, w, h) {
  const mid = (h - 1) / 2, P = Math.floor(h / 2) - 1;
  for (let yy = 0; yy < h; yy++) {
    const ins = Math.round(P * Math.abs(yy - mid) / mid);
    ctx.fillStyle = '#2a2220'; ctx.fillRect(x + ins, y + yy, w - ins * 2, 1);
    if (yy > 0 && yy < h - 1) {
      ctx.fillStyle = yy < mid ? '#6c635b' : '#5a524b';
      ctx.fillRect(x + ins + 2, y + yy, w - ins * 2 - 4, 1);
    }
  }
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
