// Baked FX sprites: every effect is drawn through r.sprite(canvas) so it works in the 2D renderer AND the
// 3D renderer (which ignores direct ctx drawing). Canvases are generated once and cached by key.
// HD effects use ws = 0.5 (2 canvas px per world px), like the HD characters.

export const C = {
  ink: '#181020', shadow: '#302848', night: '#283048', white: '#f8f8f8',
  grass_ink: '#183828', grass_dk: '#286840', grass_md: '#48a050', grass_lt: '#88c858', grass_hi: '#d0e888',
  dirt_ink: '#402028', dirt_dk: '#784838', dirt_md: '#a87048', dirt_lt: '#d0a068', dirt_hi: '#f0d098', sand: '#e0c888',
  rock_ink: '#282038', rock_dk: '#504860', rock_md: '#807880', rock_lt: '#b0a898', rock_hi: '#e0d8c0',
  water_ink: '#102050', water_dk: '#184888', water_md: '#2878c0', water_lt: '#58b0e0', water_hi: '#a8e0f0', foam: '#e8f8f8',
  wood_dk: '#603028', wood_md: '#985038', wood_lt: '#c88048',
  metal_dk: '#485070', metal_md: '#8898b8', metal_lt: '#c8d8e8',
  gold_dk: '#a86010', gold_md: '#e8b028', gold_lt: '#f8e878',
  heart_dk: '#901828', heart_md: '#e03030', heart_hi: '#f8a088',
  red_dk: '#702030', red_md: '#c84040', red_lt: '#f08060',
  blue_dk: '#283070', blue_md: '#4868c8', blue_lt: '#90b0f0',
  purple_dk: '#502878', purple_md: '#8848b8', purple_lt: '#c890e0',
  fx_yellow: '#f8e058', fx_orange: '#f88830', fx_cyan: '#98f0f0', magic: '#40c860',
};

const hasDOM = () => typeof document !== 'undefined' && typeof document.createElement === 'function';
const cache = new Map();

// bake(key, wWorld, hWorld, axWorld, ayWorld, ws, draw(g, P)) – P = { s, w, h, ax, ay } in canvas px (s = 1/ws)
export function bake(key, w, h, ax, ay, ws, draw) {
  let c = cache.get(key);
  if (c !== undefined) return c;
  c = null;
  if (hasDOM()) {
    try {
      const s = Math.round(1 / ws);
      c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      draw(g, { s, w: c.width, h: c.height, ax: Math.round(ax * s), ay: Math.round(ay * s) });
      c.ax = Math.round(ax * s); c.ay = Math.round(ay * s);
      if (ws !== 1) c.ws = ws;
      c.fx = true;
    } catch (e) { console.warn('bake', key, e); c = null; }
  }
  cache.set(key, c);
  return c;
}
export function bakeFrames(key, n, w, h, ax, ay, ws, draw) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(bake(`${key}#${i}`, w, h, ax, ay, ws, (g, P) => draw(g, P, n > 1 ? i / (n - 1) : 0, i)));
  return out.some(Boolean) ? out : null;
}

// ---------- pixel primitives (canvas px) ----------
export function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
export function disc(g, cx, cy, r, col, ry) {
  r = Math.max(0, r); ry = ry ?? r; cx = Math.round(cx); cy = Math.round(cy);
  g.fillStyle = col;
  const R = Math.round(ry);
  for (let i = -R; i <= R; i++) {
    const k = R ? i / (ry + 0.5) : 0;
    const w = Math.round(r * Math.sqrt(Math.max(0, 1 - k * k)));
    g.fillRect(cx - w, cy + i, w * 2 + 1, 1);
  }
}
export function ring(g, cx, cy, rx, ry, col, th = 1) {
  g.fillStyle = col;
  const n = Math.max(12, Math.round(Math.max(rx, ry) * 7));
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(a) * rx - th / 2), Math.round(cy + Math.sin(a) * ry - th / 2), th, th);
  }
}
export function line(g, x0, y0, x1, y1, col, th = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  g.fillStyle = col;
  for (let i = 0; i <= n; i++) { const t = i / n; g.fillRect(Math.round(x0 + (x1 - x0) * t - th / 2), Math.round(y0 + (y1 - y0) * t - th / 2), th, th); }
}
export function star(g, cx, cy, r, col, core) {
  cx = Math.round(cx); cy = Math.round(cy);
  g.fillStyle = col;
  g.fillRect(cx - r, cy, r * 2 + 1, 1); g.fillRect(cx, cy - r, 1, r * 2 + 1);
  if (r >= 2) { g.fillRect(cx - 1, cy - 1, 3, 3); }
  if (r >= 3) { const d = Math.round(r * 0.5); g.fillRect(cx - d, cy - d, 1, 1); g.fillRect(cx + d, cy - d, 1, 1); g.fillRect(cx - d, cy + d, 1, 1); g.fillRect(cx + d, cy + d, 1, 1); }
  if (core) rect(g, cx, cy, 1, 1, core);
}
// 5-point star (pickup / capture success)
export function star5(g, cx, cy, R, col, outline) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.45 : R; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  const fill = (c) => {
    g.fillStyle = c;
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      let inside = false;
      for (let i = 0, j = 9; i < 10; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside; }
      if (inside) g.fillRect(x, y, 1, 1);
    }
  };
  if (outline) { g.save(); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { g.translate(dx, dy); fill(outline); g.translate(-dx, -dy); } g.restore(); }
  fill(col);
}
// deterministic pseudo-random for baked art
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function hashStr(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------- 3×5 pixel font ----------
export const GLYPHS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '!': '010010010000010', '?': '110001010000010', '+': '000010111010000', '-': '000000111000000',
  '.': '000000000000010', ':': '000010000010000', "'": '010010000000000', '/': '001001010100100', ' ': '000000000000000',
  '_': '000000000000111', ',': '000000000010100', '(': '010100100100010', ')': '010001001001010', '=': '000111000111000',
  '%': '101001010100101', '#': '101111101111101', '×': '000101010101000',
  'Ä': '101010111101101', 'Ö': '101010101101010', 'Ü': '101000101101111', 'ß': '110101110101110',
};
export function drawPixelText(g, text, x, y, col = C.white, shadow = C.ink, px = 1) {
  const s = String(text).toUpperCase();
  const w = (s.length * 4 - 1) * px;
  let cx = Math.round(x - w / 2); const cy = Math.round(y);
  for (const ch of s) {
    const gl = GLYPHS[ch] || GLYPHS['?'];
    for (let i = 0; i < 15; i++) if (gl[i] === '1') {
      const gx = cx + (i % 3) * px, gy = cy + ((i / 3) | 0) * px;
      if (shadow) { g.fillStyle = shadow; g.fillRect(gx + px, gy + px, px, px); }
      g.fillStyle = col; g.fillRect(gx, gy, px, px);
    }
    cx += 4 * px;
  }
}
// baked text sprite (anchor bottom-centre). px = world px per font pixel.
const TEXT_MAX = 300;
let textCount = 0;
export function textSprite(text, col = C.white, px = 1, outline = C.ink) {
  const s = String(text);
  const key = `txt:${s}:${col}:${px}:${outline}`;
  if (!cache.has(key) && ++textCount > TEXT_MAX) { // keep the cache bounded (damage numbers etc.)
    for (const k of cache.keys()) if (k.startsWith('txt:')) { cache.delete(k); if (--textCount <= TEXT_MAX * 0.7) break; }
  }
  const w = (s.length * 4 + 1) * px + 2, h = 7 * px;
  return bake(key, w, h, w / 2, h - 1, 0.5, (g, P) => {
    const k = P.s * px;
    if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) drawPixelText(g, s, P.w / 2 + dx * P.s, P.s + dy * P.s, outline, null, k);
    drawPixelText(g, s, P.w / 2, P.s, col, null, k);
  });
}

// white silhouette of a sprite (evolution / summon flashes) – keeps anchor & density
const silCache = new WeakMap();
export function silhouette(img, col = C.white) {
  if (!img || !hasDOM()) return null;
  let m = silCache.get(img);
  if (!m) { m = {}; silCache.set(img, m); }
  if (m[col]) return m[col];
  try {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
    c.ax = img.ax; c.ay = img.ay; if (img.ws) c.ws = img.ws;
    m[col] = c;
    return c;
  } catch { return null; }
}

// ---------- small reusable sprites ----------
export const dot = (col, size = 1, ws = 1) => bake(`dot:${col}:${size}:${ws}`, size * ws * Math.round(1 / ws) / Math.round(1 / ws) * 1, size * ws, (size * ws) / 2, size * ws - ws, ws, (g, P) => rect(g, 0, 0, P.w, P.h, col));
// glowing ember: bright core + coloured halo (HD)
export const ember = (core, halo, r = 1.5) => bake(`ember:${core}:${halo}:${r}`, r * 2 + 1, r * 2 + 1, r + 0.5, r + 0.5, 0.5, (g, P) => {
  const c = P.w / 2 - 0.5;
  disc(g, c, c, r * P.s * 0.95, halo); disc(g, c, c, Math.max(0.5, r * P.s * 0.45), core);
});
export const sparkleSprite = (col, r = 3, core = C.white) => bake(`spk:${col}:${r}`, r * 2 + 1, r * 2 + 1, r + 0.5, r + 0.5, 0.5, (g, P) => star(g, P.w / 2 - 0.5, P.h / 2 - 0.5, r * P.s - 1, col, core));
export const starSprite = (col, R = 3.5, outline = C.gold_dk) => bake(`star5:${col}:${R}`, R * 2 + 2, R * 2 + 2, R + 1, R + 1, 0.5, (g, P) => star5(g, P.w / 2, P.h / 2, R * P.s, col, outline));
// flat ellipse ring on the floor / vertical ring (for rising level-up rings)
export const floorRing = (r, col, th = 1, fill = null, ws = 0.5) => bake(`fring:${r}:${col}:${th}:${fill}:${ws}`, r * 2 + 3, r * 2 + 3, r + 1.5, r + 1.5, ws, (g, P) => {
  const c = P.w / 2;
  if (fill) disc(g, c, c, r / ws, fill);
  ring(g, c, c, r / ws, r / ws, col, Math.max(1, Math.round(th / ws)));
});
export const ellipseRing = (rx, ry, col, th = 1) => bake(`ering:${rx}:${ry}:${col}:${th}`, rx * 2 + 2, ry * 2 + 2, rx + 1, ry + 1, 0.5, (g, P) => {
  ring(g, P.w / 2, P.h / 2, rx * P.s, ry * P.s, col, Math.max(1, Math.round(th * P.s)));
});
// soft light column (summon / level up / evolve): stepped alpha bands, no smoothing
export const beam = (w, h, col = C.white, core = C.gold_lt) => bake(`beam:${w}:${h}:${col}:${core}`, w, h, w / 2, h - 1, 0.5, (g, P) => {
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const ww = Math.round(P.w * (1 - i / steps)), x = Math.round((P.w - ww) / 2);
    g.globalAlpha = 0.18 + i * 0.12;
    g.fillStyle = i >= steps - 2 ? core : col;
    // fade out towards the top in bands
    for (let b = 0; b < 6; b++) { const y0 = Math.round((P.h * b) / 6), y1 = Math.round((P.h * (b + 1)) / 6); g.globalAlpha = (0.18 + i * 0.12) * (0.35 + 0.65 * (b / 5)); g.fillRect(x, y0, ww, y1 - y0); }
  }
  g.globalAlpha = 1;
});
