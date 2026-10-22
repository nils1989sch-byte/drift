// DRIFT pixel font (UI-Agent). 5×7 base glyphs (proportional), 2 px descender, 2 px cap-accent room.
// Rendering: text is rasterised once into a small cached canvas (fill + 1 px outline and/or drop shadow)
// and drawn with integer scale on a context whose transform is already integer-scaled -> always crisp.
//
// Line box: LINE_H = 11 px.  y passed to drawText = top of line box; cap top = y + ASC (2).
export const CAP_H = 7, ASC = 2, DESC = 2, LINE_H = 11;

// '#' = pixel. Rows are relative to cap top (row 0). Rows beyond 7 hang below the baseline.
// Object form {y:-2, r:[...]} starts above cap top (caps umlauts).
const G = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '###|.#.|.#.|.#.|.#.|.#.|###',
  J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  a: '.....|.....|.###.|....#|.####|#...#|.####',
  b: '#....|#....|####.|#...#|#...#|#...#|####.',
  c: '....|....|.###|#...|#...|#...|.###',
  d: '....#|....#|.####|#...#|#...#|#...#|.####',
  e: '.....|.....|.###.|#...#|#####|#....|.###.',
  f: '..##|.#..|####|.#..|.#..|.#..|.#..',
  g: '.....|.....|.####|#...#|#...#|#...#|.####|....#|.###.',
  h: '#....|#....|####.|#...#|#...#|#...#|#...#',
  i: '#|.|#|#|#|#|#',
  j: '..#|...|..#|..#|..#|..#|..#|#.#|.#.',
  k: '#...|#...|#..#|#.#.|##..|#.#.|#..#',
  l: '#.|#.|#.|#.|#.|#.|.#',
  m: '.....|.....|##.#.|#.#.#|#.#.#|#.#.#|#...#',
  n: '.....|.....|####.|#...#|#...#|#...#|#...#',
  o: '.....|.....|.###.|#...#|#...#|#...#|.###.',
  p: '.....|.....|####.|#...#|#...#|#...#|####.|#....|#....',
  q: '.....|.....|.####|#...#|#...#|#...#|.####|....#|....#',
  r: '....|....|#.##|##..|#...|#...|#...',
  s: '.....|.....|.####|#....|.###.|....#|####.',
  t: '.#..|.#..|####|.#..|.#..|.#..|..##',
  u: '.....|.....|#...#|#...#|#...#|#...#|.####',
  v: '.....|.....|#...#|#...#|#...#|.#.#.|..#..',
  w: '.....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.',
  x: '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
  y: '.....|.....|#...#|#...#|#...#|#...#|.####|....#|.###.',
  z: '.....|.....|#####|...#.|..#..|.#...|#####',
  ä: '.#.#.|.....|.###.|....#|.####|#...#|.####',
  ö: '.#.#.|.....|.###.|#...#|#...#|#...#|.###.',
  ü: '.#.#.|.....|#...#|#...#|#...#|#...#|.####',
  ß: '.##..|#..#.|#..#.|#.##.|#...#|#...#|#.##.',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
  3: '#####|...#.|..#..|...#.|....#|#...#|.###.',
  4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '..##.|.#...|#....|####.|#...#|#...#|.###.',
  7: '#####|....#|...#.|..#..|.#...|.#...|.#...',
  8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  9: '.###.|#...#|#...#|.####|....#|...#.|.##..',
  '.': '.|.|.|.|.|.|#',
  ',': '..|..|..|..|..|..|.#|#.',
  '!': '#|#|#|#|#|.|#',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  ':': '.|.|#|.|.|.|#',
  ';': '..|..|.#|..|..|..|.#|#.',
  '-': '....|....|....|####|....|....|....',
  '–': '.....|.....|.....|#####|.....|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '=': '....|....|####|....|####|....|....',
  "'": '#|#|.|.|.|.|.',
  '’': '.#|#.|..|..|..|..|..',
  '‘': '.#|#.|..|..|..|..|..',
  '‚': '..|..|..|..|..|..|.#|#.',
  '"': '#.#|#.#|...|...|...|...|...',
  '“': '.#.#|#.#.|....|....|....|....|....',
  '”': '.#.#|#.#.|....|....|....|....|....',
  '„': '....|....|....|....|....|....|.#.#|#.#.',
  '«': '.....|.....|.#..#|#..#.|.#..#|.....|.....',
  '»': '.....|.....|#..#.|.#..#|#..#.|.....|.....',
  '(': '..#|.#.|#..|#..|#..|.#.|..#',
  ')': '#..|.#.|..#|..#|..#|.#.|#..',
  '[': '##|#.|#.|#.|#.|#.|##',
  ']': '##|.#|.#|.#|.#|.#|##',
  '/': '....#|...#.|...#.|..#..|.#...|.#...|#....',
  '%': '##..#|##..#|...#.|..#..|.#...|#..##|#..##',
  '×': '.....|#...#|.#.#.|..#..|.#.#.|#...#|.....',
  '·': '.|.|.|#|.|.|.',
  '_': '.....|.....|.....|.....|.....|.....|.....|#####',
  '<': '...#|..#.|.#..|#...|.#..|..#.|...#',
  '>': '#...|.#..|..#.|...#|..#.|.#..|#...',
  '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.',
  '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....',
  '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#',
  '~': '.....|.....|.#..#|#.##.|.....|.....|.....',
  '°': '.#.|#.#|.#.|...|...|...|...',
  '…': '.....|.....|.....|.....|.....|.....|#.#.#',
  '▶': '#...|##..|###.|####|###.|##..|#...',
  '◀': '...#|..##|.###|####|.###|..##|...#',
  '▼': '.....|.....|#####|.###.|..#..|.....|.....',
  '▲': '.....|.....|..#..|.###.|#####|.....|.....',
  '♥': '.....|##.##|#####|#####|.###.|..#..|.....',
  '♪': '..##|..#.|..#.|..#.|.##.|###.|.#..',
  '↑': '..#..|.###.|#.#.#|..#..|..#..|..#..|.....',
  '↓': '.....|..#..|..#..|..#..|#.#.#|.###.|..#..',
  '←': '.....|..#..|.#...|#####|.#...|..#..|.....',
  '→': '.....|..#..|...#.|#####|...#.|..#..|.....',
  '≡': '.....|.....|#####|.....|#####|.....|#####',
  '■': '.....|.....|.###.|.###.|.###.|.....|.....',
  '½': '#...#|#..#.|#.#..|.#.##|#...#|...#.|..###',
  '◆': '.....|..#..|.###.|#####|.###.|..#..|.....',
  '✓': '.....|....#|...#.|#.#..|.#...|.....|.....',
};
G.Ä = { y: -2, r: '.#.#.|.....|' + G.A };
G.Ö = { y: -2, r: '.#.#.|.....|' + G.O };
G.Ü = { y: -2, r: '.#.#.|.....|' + G.U };
G['ẞ'] = G.ß;
G.é = '...#.|..#..|.###.|#...#|#####|#....|.###.';
G.è = '.#...|..#..|.###.|#...#|#####|#....|.###.';
G.à = '.#...|..#..|.###.|....#|.####|#...#|.####';

const SPACE_W = 3, GAP = 1;
const glyphs = {};
for (const ch of Object.keys(G)) {
  const g = G[ch];
  const rows = (typeof g === 'string' ? g : g.r).split('|');
  const y0 = typeof g === 'string' ? 0 : g.y;
  const w = Math.max(...rows.map((r) => r.length));
  const px = [];
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') px.push(x, y + y0); });
  glyphs[ch] = { w, px };
}
export const FONT_GLYPHS = glyphs;

function glyph(ch) { return glyphs[ch] || glyphs[ch.toUpperCase?.()] || glyphs['?']; }

/** Width in font pixels (unscaled) of a single line. */
export function measure(text) {
  let w = 0, first = true;
  for (const ch of String(text)) {
    if (ch === '\n') continue;
    if (!first) w += GAP;
    first = false;
    w += ch === ' ' ? SPACE_W : glyph(ch).w;
  }
  return w;
}

/** Word-wrap a string into lines no wider than maxW font pixels. Honors '\n'. */
export function wrap(text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (measure(test) <= maxW || !line) {
        line = test;
        // hard-break very long words
        while (measure(line) > maxW && line.length > 1) {
          let i = line.length - 1;
          while (i > 1 && measure(line.slice(0, i)) > maxW) i--;
          out.push(line.slice(0, i)); line = line.slice(i);
        }
      } else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

// ---- rasteriser with cache -------------------------------------------------
const cache = new Map();
const MAX_CACHE = 400;
const rgbCache = new Map();
function rgba(c) {
  if (rgbCache.has(c)) return rgbCache.get(c);
  let r = 255, g = 255, b = 255, a = 255;
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c || '');
  if (m) { const n = parseInt(m[1], 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; if (m[2]) a = parseInt(m[2], 16); }
  const v = [r, g, b, a]; rgbCache.set(c, v); return v;
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && !globalThis.__driftNoOffscreen) {
    try { return new OffscreenCanvas(w, h); } catch { /* fall through */ }
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/**
 * Rasterise text. opts: color ('#rrggbb' or array of per-row colors, row 0 = cap top),
 * outline (color|null, 1 px, 8-neighbourhood), shadow (color|null, offset 1,1).
 * Returns { canvas, w, h, ox, oy } – draw at (x - ox, y - oy) so that the line box top-left is (x, y).
 */
export function rasterize(text, opts = {}) {
  text = String(text);
  const color = opts.color || '#f8f8f8';
  const outline = opts.outline || null, shadow = opts.shadow === undefined ? (outline ? null : '#181020') : opts.shadow;
  const key = text + '\u0000' + color + '|' + outline + '|' + shadow;
  let hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const tw = Math.max(1, measure(text));
  const pad = outline ? 1 : 0;
  const w = tw + pad * 2 + (shadow ? 1 : 0), h = LINE_H + pad * 2 + (shadow ? 1 : 0);
  const cv = makeCanvas(w, h);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const pts = [];
  let x = 0, first = true;
  for (const ch of text) {
    if (ch === '\n') continue;
    if (!first) x += GAP;
    first = false;
    if (ch === ' ') { x += SPACE_W; continue; }
    const g = glyph(ch);
    for (let i = 0; i < g.px.length; i += 2) pts.push(x + g.px[i] + pad, g.px[i + 1] + ASC + pad);
    x += g.w;
  }
  const put = (px, py, c) => {
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    const o = (py * w + px) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c[3];
  };
  if (outline) {
    const oc = rgba(outline);
    for (let i = 0; i < pts.length; i += 2)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(pts[i] + dx, pts[i + 1] + dy, oc);
    if (shadow) { const sc = rgba(shadow); for (let i = 0; i < pts.length; i += 2) { put(pts[i] + 2, pts[i + 1] + 2, sc); put(pts[i] + 1, pts[i + 1] + 2, sc); put(pts[i] + 2, pts[i + 1] + 1, sc); } }
    if (outline) for (let i = 0; i < pts.length; i += 2) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(pts[i] + dx, pts[i + 1] + dy, oc);
  } else if (shadow) {
    const sc = rgba(shadow);
    for (let i = 0; i < pts.length; i += 2) put(pts[i] + 1, pts[i + 1] + 1, sc);
  }
  const rows = Array.isArray(color) ? color.map(rgba) : null;
  const fc = rows ? null : rgba(color);
  for (let i = 0; i < pts.length; i += 2) {
    const ry = pts[i + 1] - ASC - pad;
    put(pts[i], pts[i + 1], rows ? rows[Math.max(0, Math.min(rows.length - 1, ry))] : fc);
  }
  ctx.putImageData(img, 0, 0);
  hit = { canvas: cv, w, h, ox: pad, oy: pad, tw };
  cache.set(key, hit);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
  return hit;
}

/**
 * Draw text. (x, y) = top-left of the line box in the context's current (integer-scaled) units.
 * opts: color, outline, shadow, scale (integer, default 1), align ('left'|'center'|'right'), alpha.
 * Returns drawn width (in context units).
 */
export function drawText(ctx, text, x, y, opts = {}) {
  if (text === '' || text == null) return 0;
  const s = Math.max(1, Math.round(opts.scale || 1));
  const r = rasterize(text, opts);
  let dx = x;
  if (opts.align === 'center') dx = x - Math.floor((r.tw * s) / 2);
  else if (opts.align === 'right') dx = x - r.tw * s;
  const pa = ctx.globalAlpha;
  if (opts.alpha != null) ctx.globalAlpha = pa * opts.alpha;
  ctx.drawImage(r.canvas, Math.round(dx - r.ox * s), Math.round(y - r.oy * s), r.w * s, r.h * s);
  ctx.globalAlpha = pa;
  return r.tw * s;
}

/** Contract helper: { glyphs: {[char]: Canvas}, w, h } built lazily (for other modules that want it). */
export function buildFontAtlas() {
  const out = { glyphs: {}, w: 5, h: LINE_H };
  for (const ch of Object.keys(glyphs)) out.glyphs[ch] = rasterize(ch, { shadow: null }).canvas;
  return out;
}
