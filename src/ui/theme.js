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
 * Style-guide panel: ink outline, 2 px ui_frame border (light top-left, darker bottom-right), night fill.
 */
export function panel(ctx, x, y, w, h, { fill = C.night, alpha = 0.92, frame = C.frame } = {}) {
  pxRect(ctx, x, y, w, h, C.ink, 2);
  pxRect(ctx, x + 1, y + 1, w - 2, h - 2, frame, 1);
  ctx.fillStyle = C.frameLt; ctx.fillRect(x + 3, y + 1, w - 6, 1); ctx.fillRect(x + 1, y + 3, 1, h - 6);
  ctx.fillStyle = C.frameDk; ctx.fillRect(x + 3, y + h - 2, w - 6, 1); ctx.fillRect(x + w - 2, y + 3, 1, h - 6);
  pxRect(ctx, x + 3, y + 3, w - 6, h - 6, C.ink, 0);
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * alpha;
  ctx.fillStyle = fill; ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  ctx.globalAlpha = pa;
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
