// Asset-pack image helpers. An "Img" is a plain pixel buffer { w, h, d: Uint32Array } in canvas byte order
// (little-endian RGBA → packed ABGR), so it can be filled from / written to ImageData without conversion.
// All conversion code (analyze/convert) works on Img buffers; canvases appear only at the edges.

export const R = (v) => v & 255;
export const G = (v) => (v >>> 8) & 255;
export const B = (v) => (v >>> 16) & 255;
export const A = (v) => v >>> 24;
export const pack = (r, g, b, a = 255) =>
  (((a & 255) << 24) | (clamp8(b) << 16) | (clamp8(g) << 8) | clamp8(r)) >>> 0;
export const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
export const lum = (v) => (R(v) * 0.299 + G(v) * 0.587 + B(v) * 0.114) / 255;
export const hexOf = (v) => '#' + ((1 << 24) | (R(v) << 16) | (G(v) << 8) | B(v)).toString(16).slice(1);
export const fromHex = (h) => { const n = parseInt(h.slice(1), 16); return pack(n >> 16, (n >> 8) & 255, n & 255); };
export function dist2(a, b) { const dr = R(a) - R(b), dg = G(a) - G(b), db = B(a) - B(b); return dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11; }

export function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
export function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [f(0), f(8), f(4)];
}
export const hslOf = (v) => rgb2hsl(R(v), G(v), B(v));
// shift lightness with a hue drift (lights → warm, shadows → cool), keeps alpha
export function shiftTone(v, dl, hueDrift = 10) {
  const [h, s, l] = hslOf(v);
  const hh = h + (dl > 0 ? -1 : 1) * Math.abs(dl) * hueDrift * (h > 60 && h < 250 ? 1 : -1);
  const [r, g, b] = hsl2rgb(hh, s * (1 + Math.abs(dl) * 0.2), l + dl);
  return pack(r, g, b, A(v));
}

export function blank(w, h) { return { w, h, d: new Uint32Array(w * h) }; }
export function clone(img) { return { w: img.w, h: img.h, d: new Uint32Array(img.d) }; }
export function get(img, x, y) { return x < 0 || y < 0 || x >= img.w || y >= img.h ? 0 : img.d[y * img.w + x]; }
export function getWrap(img, x, y) { const w = img.w, h = img.h; return img.d[(((y % h) + h) % h) * w + (((x % w) + w) % w)]; }
export function crop(img, x0, y0, w, h) {
  const o = blank(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.d[y * w + x] = get(img, x0 + x, y0 + y);
  return o;
}
export function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const v = src.d[y * src.w + x]; if (!A(v)) continue;
    const X = dx + x, Y = dy + y; if (X < 0 || Y < 0 || X >= dst.w || Y >= dst.h) continue;
    dst.d[Y * dst.w + X] = v;
  }
  return dst;
}
export function flipX(img) { const o = blank(img.w, img.h); for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) o.d[y * img.w + x] = img.d[y * img.w + img.w - 1 - x]; return o; }
export function flipY(img) { const o = blank(img.w, img.h); for (let y = 0; y < img.h; y++) o.d.set(img.d.subarray((img.h - 1 - y) * img.w, (img.h - y) * img.w), y * img.w); return o; }
// nearest-neighbour resample (used for strip fitting, never for the main upscale)
export function resizeNearest(img, w, h) {
  const o = blank(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o.d[y * w + x] = img.d[Math.min(img.h - 1, (y * img.h / h) | 0) * img.w + Math.min(img.w - 1, (x * img.w / w) | 0)];
  return o;
}
export function bbox(img, thr = 16) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (A(img.d[y * img.w + x]) > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
export function opaqueCount(img, thr = 16) { let n = 0; for (let i = 0; i < img.d.length; i++) if (A(img.d[i]) > thr) n++; return n; }
export function isBlankImg(img) { return opaqueCount(img) === 0; }
// stable small hash for ids/seeds
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function hashImg(img) { let h = 2166136261 ^ img.w ^ (img.h << 12); for (let i = 0; i < img.d.length; i += 3) { h ^= img.d[i]; h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------------------------------------------------------------- canvas bridge (browser only)
export function makeCanvas(w, h) {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
}
export function toCanvas(img, meta = {}) {
  const c = makeCanvas(img.w, img.h);
  const g = c.getContext('2d');
  const id = g.createImageData(img.w, img.h);
  new Uint32Array(id.data.buffer).set(img.d);
  g.putImageData(id, 0, 0);
  for (const k of ['ax', 'ay', 'ws']) if (meta[k] != null) c[k] = meta[k];
  return c;
}
export function fromCanvas(c) {
  const g = c.getContext('2d', { willReadFrequently: true });
  const id = g.getImageData(0, 0, c.width, c.height);
  return { w: c.width, h: c.height, d: new Uint32Array(id.data.buffer.slice(0)) };
}
export async function imgFromBlob(blob) {
  const bmp = await createImageBitmap(blob);
  const c = makeCanvas(bmp.width, bmp.height);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  bmp.close?.();
  return fromCanvas(c);
}
export async function canvasToBlob(c) {
  if (c.convertToBlob) return c.convertToBlob({ type: 'image/png' });
  return new Promise((res) => c.toBlob(res, 'image/png'));
}
// small CSS-visible preview canvas (nearest-neighbour scaled, checkerboard behind transparency)
export function previewCanvas(src, maxW = 64, maxH = 64, bg = true) {
  const s = Math.max(1, Math.floor(Math.min(maxW / src.width, maxH / src.height)) || 1);
  const sc = Math.min(maxW / src.width, maxH / src.height) < 1 ? Math.min(maxW / src.width, maxH / src.height) : s;
  const c = makeCanvas(Math.max(1, Math.round(src.width * sc)), Math.max(1, Math.round(src.height * sc)));
  const g = c.getContext('2d');
  if (bg) { for (let y = 0; y < c.height; y += 4) for (let x = 0; x < c.width; x += 4) { g.fillStyle = ((x + y) >> 2) & 1 ? '#3a3f52' : '#2c3040'; g.fillRect(x, y, 4, 4); } }
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
