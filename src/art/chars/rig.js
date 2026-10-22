// DRIFT character rig: a tiny "normal-map painter" for HD-2D sprites (double density, canvas.ws = 0.5).
// Primitives write material + surface normal (+ tone bias) per pixel; shading, selective outline and
// internal contact lines are resolved at the end. Mirroring negates the normal x, so a right-facing sprite
// that is a mirrored left-facing one is still lit from the TOP-LEFT (consistent light in every direction).
import { c32 } from '../core.js';
import { MAT } from './materials.js';

const LX = -0.5, LY = -0.62, LZ = 0.6;
const LN = Math.hypot(LX, LY, LZ);
const lx = LX / LN, ly = LY / LN, lz = LZ / LN;

export class Fig {
  constructor(w, h, ox = 0, oy = 0) {
    this.w = w; this.h = h; this.ox = ox; this.oy = oy;
    const n = w * h;
    this.m = new Uint8Array(n);      // material index (0 = empty)
    this.nx = new Float32Array(n); this.ny = new Float32Array(n); this.nz = new Float32Array(n);
    this.b = new Float32Array(n);    // tone bias (in tone steps)
    this.t = new Int8Array(n).fill(-1); // fixed tone (-1 = lit)
    this.g = new Uint16Array(n);     // group id (contact lines between groups)
    this.o = new Uint16Array(n);     // draw order
    this.cur = 1; this.grp = 1;
  }
  // translate local (character) coordinates
  at(ox, oy) { this.ox = ox; this.oy = oy; return this; }
  newGroup() { return ++this.grp; }
  _px(x, y, m, nx, ny, nz, b, t, g) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.m[i] = m; this.nx[i] = nx; this.ny[i] = ny; this.nz[i] = nz; this.b[i] = b; this.t[i] = t; this.g[i] = g; this.o[i] = this.cur;
  }
  // ellipsoid (dome when flat > 0: normal xy scaled down)
  ell(cx, cy, rx, ry, m, o = {}) {
    cx += this.ox; cy += this.oy;
    const g = o.grp ?? this.newGroup(), b = o.bias ?? 0, fl = 1 - (o.flat ?? 0), t = o.tone ?? -1, clip = o.clip;
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
      if (d > 1) continue;
      if (clip && !clip(x - this.ox, y - this.oy, u, v)) continue;
      const nz = Math.sqrt(1 - d);
      this._px(x, y, m, u * fl, v * fl, nz + (1 - fl) * 0.5, b + (o.grad ? o.grad(u, v) : 0), t, g);
    }
    this.cur++;
    return g;
  }
  // capsule / tapered limb from (x0,y0,r0) to (x1,y1,r1)
  limb(x0, y0, x1, y1, r0, r1, m, o = {}) {
    x0 += this.ox; y0 += this.oy; x1 += this.ox; y1 += this.oy;
    const g = o.grp ?? this.newGroup(), b = o.bias ?? 0, fl = 1 - (o.flat ?? 0), t = o.tone ?? -1, clip = o.clip;
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6, rm = Math.max(r0, r1);
    const bx0 = Math.floor(Math.min(x0, x1) - rm), bx1 = Math.ceil(Math.max(x0, x1) + rm);
    const by0 = Math.floor(Math.min(y0, y1) - rm), by1 = Math.ceil(Math.max(y0, y1) + rm);
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5, py = y + 0.5;
      let s = ((px - x0) * dx + (py - y0) * dy) / L2; s = s < 0 ? 0 : s > 1 ? 1 : s;
      const qx = x0 + dx * s, qy = y0 + dy * s, r = r0 + (r1 - r0) * s;
      const ex = px - qx, ey = py - qy, d2 = ex * ex + ey * ey;
      if (d2 > r * r) continue;
      if (clip && !clip(x - this.ox, y - this.oy, s)) continue;
      const u = ex / r, v = ey / r, nz = Math.sqrt(Math.max(0, 1 - u * u - v * v));
      this._px(x, y, m, u * fl, v * fl, nz + (1 - fl) * 0.5, b + (o.grad ? o.grad(s, u, v) : 0), t, g);
    }
    this.cur++;
    return g;
  }
  // chain of limb segments: pts = [[x,y,r], ...]
  chain(pts, m, o = {}) {
    const g = o.grp ?? this.newGroup();
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, c] = [pts[i], pts[i + 1]];
      const cur = this.cur;
      this.limb(a[0], a[1], c[0], c[1], a[2], c[2], m, { ...o, grp: g, bias: (o.bias ?? 0) + (a[3] ?? 0) });
      this.cur = cur; // whole chain shares one draw order
    }
    this.cur++;
    return g;
  }
  // filled polygon, normal from fn(x,y) or a fixed normal
  poly(pts, m, o = {}) {
    const P = pts.map(([x, y]) => [x + this.ox, y + this.oy]);
    const g = o.grp ?? this.newGroup(), b = o.bias ?? 0, t = o.tone ?? -1;
    const N = o.n || [0, 0, 1];
    let y0 = Infinity, y1 = -Infinity;
    for (const p of P) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const sy = y + 0.5, xs = [];
      for (let i = 0; i < P.length; i++) {
        const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, c) => a - c);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
          const lxp = x - this.ox, lyp = y - this.oy;
          if (o.clip && !o.clip(lxp, lyp)) continue;
          const n = o.nf ? o.nf(lxp, lyp) : N;
          this._px(x, y, m, n[0], n[1], n[2], b + (o.grad ? o.grad(lxp, lyp) : 0), t, g);
        }
      }
    }
    this.cur++;
    return g;
  }
  // modify existing pixels (keeps normal): fn(x, y, i) → {bias?, tone?, m?} | null
  touch(x, y, f) {
    x = Math.round(x + this.ox); y = Math.round(y + this.oy);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    if (f.m !== undefined) {
      if (!this.m[i]) { this.nx[i] = 0; this.ny[i] = 0; this.nz[i] = 1; this.g[i] = f.g ?? this.grp; this.o[i] = this.cur; }
      this.m[i] = f.m;
    }
    if (!this.m[i]) return;
    if (f.b !== undefined) this.b[i] += f.b;
    if (f.t !== undefined) this.t[i] = f.t;
    if (f.g !== undefined) this.g[i] = f.g;
    if (f.n) { this.nx[i] = f.n[0]; this.ny[i] = f.n[1]; this.nz[i] = f.n[2]; }
  }
  erase(x, y) { x = Math.round(x + this.ox); y = Math.round(y + this.oy); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.m[y * this.w + x] = 0; }
  isSet(x, y) { x = Math.round(x + this.ox); y = Math.round(y + this.oy); return x >= 0 && y >= 0 && x < this.w && y < this.h && this.m[y * this.w + x] > 0; }
  matAt(x, y) { x = Math.round(x + this.ox); y = Math.round(y + this.oy); return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.m[y * this.w + x] : 0; }
  // ASCII overlay. legend[ch] = { m, t?, b?, n?: 'keep' | [nx,ny,nz] | (x,y)=>n, erase? }
  // origin (x,y) = top-left in local coords. Normal default: keep existing, else from o.nf or facing camera.
  ascii(str, legend, x, y, o = {}) {
    const rows = str.split('\n').filter((r) => r.trim().length);
    const ind = Math.min(...rows.map((r) => r.match(/^ */)[0].length));
    const g = o.grp ?? this.newGroup();
    rows.forEach((r0, j) => {
      const r = r0.slice(ind);
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (ch === '.' || ch === ' ') continue;
        const L = legend[ch];
        if (!L) throw new Error(`rig.ascii: unknown char '${ch}'`);
        const X = x + i, Y = y + j;
        if (L.erase) { this.erase(X, Y); continue; }
        const px = Math.round(X + this.ox), py = Math.round(Y + this.oy);
        if (px < 0 || py < 0 || px >= this.w || py >= this.h) continue;
        const k = py * this.w + px;
        let n = L.n;
        if (typeof n === 'function') n = n(X, Y);
        else if (!n) n = o.nf ? o.nf(X, Y) : (this.m[k] ? [this.nx[k], this.ny[k], this.nz[k]] : [0, 0, 1]);
        else if (n === 'keep') n = this.m[k] ? [this.nx[k], this.ny[k], this.nz[k]] : [0, 0, 1];
        this._px(px, py, L.m, n[0], n[1], n[2], L.b ?? 0, L.t ?? -1, L.g ?? g);
      }
    });
    this.cur++;
    return g;
  }
  // mirror horizontally (normals follow, light stays top-left)
  flip() {
    const w = this.w, h = this.h;
    for (const k of ['m', 'nx', 'ny', 'nz', 'b', 't', 'g', 'o']) {
      const a = this[k];
      for (let y = 0; y < h; y++) {
        const r = y * w;
        for (let x = 0; x < w >> 1; x++) { const i = r + x, j = r + w - 1 - x; const v = a[i]; a[i] = a[j]; a[j] = v; }
      }
    }
    for (let i = 0; i < this.nx.length; i++) this.nx[i] = -this.nx[i];
    return this;
  }
  // rotate 90° clockwise (normals rotate along, so the light stays top-left)
  rot90() {
    const w = this.w, h = this.h, r = new Fig(h, w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, j = x * h + (h - 1 - y);
      r.m[j] = this.m[i]; r.nx[j] = -this.ny[i]; r.ny[j] = this.nx[i]; r.nz[j] = this.nz[i];
      r.b[j] = this.b[i]; r.t[j] = this.t[i]; r.g[j] = this.g[i]; r.o[j] = this.o[i];
    }
    return r;
  }
  // resolve to a canvas. ax/ay = foot anchor in sprite pixels; ws = 0.5 (HD density)
  canvas(ax, ay, o = {}) {
    const w = this.w, h = this.h, n = w * h, M = this.m;
    const tone = new Int8Array(n);
    for (let i = 0; i < n; i++) {
      const mi = M[i]; if (!mi) continue;
      const mat = MAT[mi];
      if (this.t[i] >= 0) { tone[i] = Math.min(this.t[i], mat.c.length - 1); continue; }
      const d = this.nx[i] * lx + this.ny[i] * ly + this.nz[i] * lz;
      // wrap lighting: shadows keep a floor, lit side spreads over two tones
      let v = (mat.amb ?? 0.34) + d * (mat.k ?? 0.62) + this.b[i] * 0.16 + (o.light ?? 0);
      const top = mat.c.length - 1;
      let tt = Math.floor(v * (top + 0.2));
      const specAt = mat.spec ?? 9;
      if (tt >= top && v < specAt) tt = top - 1;
      tone[i] = tt < 0 ? 0 : tt > top ? top : tt;
    }
    // internal contact lines: front part pixel next to a part behind it (other group)
    const out = new Uint32Array(n);
    const W = w;
    const tone2 = new Int8Array(tone);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * W + x, mi = M[i]; if (!mi) continue;
      const mat = MAT[mi];
      if (mat.noLine || this.t[i] >= 0) continue;
      const g = this.g[i], od = this.o[i];
      // neighbour below / right / left / above that is BEHIND this pixel
      let line = 0, shade = 0;
      const chk = (j, kind) => {
        if (!M[j] || this.g[j] === g) return;
        if (this.o[j] < od) { if (MAT[M[j]].noLine) return; line = Math.max(line, kind); }
        else if (kind === 1) shade = 1; // something in front lies above/left: soft contact shadow
      };
      if (y + 1 < h) chk(i + W, 2);
      if (x + 1 < w) chk(i + 1, 2);
      if (x > 0) chk(i - 1, 1);
      if (y > 0) chk(i - W, 1);
      if (line === 2) tone2[i] = Math.min(tone2[i], mat.lineTone ?? 1);
      else if (line === 1) tone2[i] = Math.max(0, Math.min(tone2[i], (mat.lineTone ?? 1) + 1));
      if (shade && !line) tone2[i] = Math.max(0, tone2[i] - 1);
    }
    for (let i = 0; i < n; i++) if (M[i]) out[i] = MAT[M[i]].u[tone2[i]];
    // outer selective outline (4-neighbour): dark coloured line; lighter on the lit (top-left) side
    if (o.outline !== false) {
      const res = new Uint32Array(out);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * W + x; if (M[i]) continue;
        const R = x + 1 < w ? M[i + 1] : 0, D = y + 1 < h ? M[i + W] : 0, Lf = x > 0 ? M[i - 1] : 0, U = y > 0 ? M[i - W] : 0;
        if (!(R || D || Lf || U)) continue;
        // dark side when the figure lies to the left/above of this empty pixel
        const darkSide = Lf || U;
        const mi = U || Lf || D || R;
        const mat = MAT[mi];
        if (mat.noOutline) continue;
        res[i] = darkSide ? mat.lineU : mat.lineLitU;
      }
      for (let i = 0; i < n; i++) out[i] = res[i];
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const gx = c.getContext('2d'), id = gx.createImageData(w, h);
    new Uint32Array(id.data.buffer).set(out);
    gx.putImageData(id, 0, 0);
    c.ax = ax; c.ay = ay; c.ws = o.ws ?? 0.5;
    return c;
  }
}

// helpers
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;
// 2-bone IK: returns elbow/knee point given root, target, lengths, bend sign (+1/-1)
export function ik(ax, ay, tx, ty, l1, l2, bend = 1) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 1e-6;
  const dm = Math.min(d, l1 + l2 - 0.01);
  const a = (l1 * l1 - l2 * l2 + dm * dm) / (2 * dm);
  const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d;
  return [ax + ux * a - uy * hh * bend, ay + uy * a + ux * hh * bend];
}
export { c32 };
