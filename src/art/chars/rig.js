// DRIFT character rig: a tiny "normal-map painter" for HD-2D sprites (double density, canvas.ws = 0.5).
// Primitives write material + surface normal (+ tone bias) per pixel; shading, selective outline and
// internal contact lines are resolved at the end. Mirroring negates the normal x, so a right-facing sprite
// that is a mirrored left-facing one is still lit from the TOP-LEFT (consistent light in every direction).
import { c32 } from '../core.js';
import { MAT } from './materials.js';

const LX = -0.5, LY = -0.62, LZ = 0.6;
const LN = Math.hypot(LX, LY, LZ);
const lx = LX / LN, ly = LY / LN, lz = LZ / LN;

const POOL = new Map();
let SCR = null; // scratch arrays for canvas()
function scratch(n) {
  if (!SCR || SCR.n < n) SCR = { n, tone: new Int8Array(n), tone2: new Int8Array(n), out: new Uint32Array(n), res: new Uint32Array(n) };
  return SCR;
}

export class Fig {
  constructor(w, h, ox = 0, oy = 0) {
    this.w = w; this.h = h; this.ox = ox; this.oy = oy;
    const n = w * h;
    const P = POOL.get(n);
    const bufs = P && P.length ? P.pop() : null;
    if (bufs) {
      Object.assign(this, bufs);
      this.m.fill(0); this.b.fill(0); this.t.fill(-1); this.g.fill(0); this.o.fill(0);
    } else {
      this.m = new Uint8Array(n);      // material index (0 = empty)
      this.nx = new Float32Array(n); this.ny = new Float32Array(n); this.nz = new Float32Array(n);
      this.b = new Float32Array(n);    // tone bias (in tone steps)
      this.t = new Int8Array(n).fill(-1); // fixed tone (-1 = lit)
      this.g = new Uint16Array(n);     // group id (contact lines between groups)
      this.o = new Uint16Array(n);     // draw order
    }
    this.cur = 1; this.grp = 1;
  }
  // return buffers to the pool (the Fig must not be used afterwards)
  release() {
    const n = this.w * this.h;
    if (!POOL.has(n)) POOL.set(n, []);
    const P = POOL.get(n);
    if (P.length < 4) P.push({ m: this.m, nx: this.nx, ny: this.ny, nz: this.nz, b: this.b, t: this.t, g: this.g, o: this.o });
    this.m = null;
  }
  // copy another Fig (a cached part, e.g. a head) at integer offset (local coords of its origin)
  stamp(src, dx, dy) {
    const ox = Math.round(dx + this.ox), oy = Math.round(dy + this.oy);
    const gb = this.grp, ob = this.cur;
    let maxO = 0, maxG = 0;
    for (let y = 0; y < src.h; y++) {
      const ty = y + oy; if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const tx = x + ox; if (tx < 0 || tx >= this.w) continue;
        const i = y * src.w + x; if (!src.m[i]) continue;
        const j = ty * this.w + tx;
        this.m[j] = src.m[i]; this.nx[j] = src.nx[i]; this.ny[j] = src.ny[i]; this.nz[j] = src.nz[i];
        this.b[j] = src.b[i]; this.t[j] = src.t[i]; this.g[j] = gb + src.g[i]; this.o[j] = ob + src.o[i];
        if (src.o[i] > maxO) maxO = src.o[i]; if (src.g[i] > maxG) maxG = src.g[i];
      }
    }
    this.grp = gb + Math.max(src.grp, maxG) + 1; this.cur = ob + Math.max(src.cur, maxO) + 1;
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
    const g = o.grp ?? this.newGroup(), b = o.bias ?? 0, fl = 1 - (o.flat ?? 0), t = o.tone ?? -1, clip = o.clip, grad = o.grad;
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx), y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
      if (d > 1) continue;
      if (clip && !clip(x - this.ox, y - this.oy, u, v)) continue;
      const nz = Math.sqrt(1 - d);
      this._px(x, y, m, u * fl, v * fl, nz + (1 - fl) * 0.5, grad ? b + grad(u, v) : b, t, g);
    }
    this.cur++;
    return g;
  }
  // capsule / tapered limb from (x0,y0,r0) to (x1,y1,r1)
  limb(x0, y0, x1, y1, r0, r1, m, o = {}) {
    x0 += this.ox; y0 += this.oy; x1 += this.ox; y1 += this.oy;
    const g = o.grp ?? this.newGroup(), b = o.bias ?? 0, fl = 1 - (o.flat ?? 0), t = o.tone ?? -1, clip = o.clip, grad = o.grad, sph = o.sph;
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
      let NX = u * fl, NY = v * fl, NZ = nz + (1 - fl) * 0.5;
      if (sph) { // blend with a big sphere normal (hair locks keep the head's overall light falloff)
        const sx = sph[0], sy = sph[1], sr = sph[2], sw = sph[3];
        const su = Math.max(-1, Math.min(1, (px - sx - this.ox) / sr)), sv = Math.max(-1, Math.min(1, (py - sy - this.oy) / sr));
        const sz = Math.sqrt(Math.max(0.04, 1 - su * su - sv * sv));
        NX = NX * (1 - sw) + su * sw; NY = NY * (1 - sw) + sv * sw; NZ = NZ * (1 - sw) + sz * sw;
        const L = Math.hypot(NX, NY, NZ) || 1; NX /= L; NY /= L; NZ /= L;
      }
      this._px(x, y, m, NX, NY, NZ, grad ? b + grad(s, u, v) : b, t, g);
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
    const __t0 = performance.now();
    const w = this.w, h = this.h, n = w * h, M = this.m;
    // content bounding box
    let X0 = w, X1 = -1, Y0 = h, Y1 = -1;
    for (let y = 0; y < h; y++) {
      const r = y * w; let any = false;
      for (let x = 0; x < w; x++) if (M[r + x]) { any = true; if (x < X0) X0 = x; break; }
      if (!any) continue;
      for (let x = w - 1; x >= 0; x--) if (M[r + x]) { if (x > X1) X1 = x; break; }
      if (y < Y0) Y0 = y; Y1 = y;
    }
    const SC = scratch(n), out = SC.out.subarray(0, n); out.fill(0);
    if (X1 >= 0) {
      const tone = SC.tone.subarray(0, n);
      const TB = tables(), AMB = TB.amb, KK = TB.k, SPEC = TB.spec, TOP = TB.top, NL = TB.noLine, LT = TB.lineTone;
      const light = o.light ?? 0, NX = this.nx, NY = this.ny, NZ = this.nz, B = this.b, TF = this.t, G = this.g, O = this.o;
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
        const i = y * w + x, mi = M[i]; if (!mi) continue;
        const top = TOP[mi];
        if (TF[i] >= 0) { tone[i] = TF[i] > top ? top : TF[i]; continue; }
        const v = AMB[mi] + (NX[i] * lx + NY[i] * ly + NZ[i] * lz) * KK[mi] + B[i] * 0.16 + light;
        let tt = Math.floor(v * (top + 0.2));
        if (tt >= top && v < SPEC[mi]) tt = top - 1;
        tone[i] = tt < 0 ? 0 : tt > top ? top : tt;
      }
      // internal contact lines: a front part's pixel next to a part behind it (other group)
      const UU = TB.u;
      for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
        const i = y * w + x, mi = M[i]; if (!mi) continue;
        let tn = tone[i];
        if (!NL[mi] && TF[i] < 0) {
          const g = G[i], od = O[i];
          let line = 0, shade = 0, j, mj;
          // below / right: shadow side → dark line
          j = i + w; mj = y + 1 < h ? M[j] : 0;
          if (mj && G[j] !== g) { if (O[j] < od) { if (!NL[mj]) line = 2; } }
          j = i + 1; mj = x + 1 < w ? M[j] : 0;
          if (mj && G[j] !== g) { if (O[j] < od) { if (!NL[mj]) line = 2; } }
          // left / above: lit side → softer line (not between equal materials); front part above → contact shade
          if (line < 2) {
            j = i - 1; mj = x > 0 ? M[j] : 0;
            if (mj && G[j] !== g) { if (O[j] < od) { if (!NL[mj] && mj !== mi) line = 1; } else if (mj !== mi) shade = 1; }
            j = i - w; mj = y > 0 ? M[j] : 0;
            if (mj && G[j] !== g) { if (O[j] < od) { if (!NL[mj] && mj !== mi) line = 1; } else if (mj !== mi) shade = 1; }
          }
          const lt = LT[mi];
          if (line === 2) { if (tn > lt) tn = lt; }
          else if (line === 1) { if (tn > lt + 1) tn = lt + 1; }
          else if (shade && tn > 0) tn--;
        }
        out[i] = UU[mi * 8 + tn];
      }
      // outer selective outline (4-neighbour): dark coloured line; lighter on the lit (top-left) side
      if (o.outline !== false) {
        const res = SC.res.subarray(0, n); res.set(out);
        const ya = Math.max(0, Y0 - 1), yb = Math.min(h - 1, Y1 + 1), xa = Math.max(0, X0 - 1), xb = Math.min(w - 1, X1 + 1);
        for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
          const i = y * w + x; if (M[i]) continue;
          const R = x + 1 < w ? M[i + 1] : 0, D = y + 1 < h ? M[i + w] : 0, Lf = x > 0 ? M[i - 1] : 0, U = y > 0 ? M[i - w] : 0;
          if (!(R || D || Lf || U)) continue;
          const mi = U || Lf || D || R;
          if (TB.noOutline[mi]) continue;
          res[i] = (Lf || U) ? TB.lineU[mi] : TB.lineLitU[mi];
        }
        out.set(res);
      }
    }
    globalThis.__rigR = (globalThis.__rigR || 0) + performance.now() - __t0;
    const __t = performance.now();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const gx = c.getContext('2d', { willReadFrequently: true }), id = gx.createImageData(w, h);
    new Uint32Array(id.data.buffer).set(out);
    gx.putImageData(id, 0, 0);
    globalThis.__rigT = (globalThis.__rigT || 0) + performance.now() - __t;
    c.ax = ax; c.ay = ay; c.ws = o.ws ?? 0.5;
    if (o.release !== false) this.release();
    return c;
  }
}

// flat per-material lookup tables (material objects have different shapes → avoid megamorphic reads per pixel)
let TBL = null;
function tables() {
  if (TBL && TBL.n === MAT.length) return TBL;
  const n = MAT.length;
  const T = { n, amb: new Float32Array(n), k: new Float32Array(n), spec: new Float32Array(n), top: new Int8Array(n), lineTone: new Int8Array(n),
    noLine: new Uint8Array(n), noOutline: new Uint8Array(n), lineU: new Uint32Array(n), lineLitU: new Uint32Array(n), u: new Uint32Array(n * 8) };
  for (let i = 1; i < n; i++) {
    const m = MAT[i];
    T.amb[i] = m.amb ?? 0.34; T.k[i] = m.k ?? 0.62; T.spec[i] = m.spec ?? 9; T.top[i] = m.c.length - 1; T.lineTone[i] = m.lineTone ?? 1;
    T.noLine[i] = m.noLine ? 1 : 0; T.noOutline[i] = m.noOutline ? 1 : 0; T.lineU[i] = m.lineU; T.lineLitU[i] = m.lineLitU;
    for (let k = 0; k < 8; k++) T.u[i * 8 + k] = m.u[Math.min(k, m.u.length - 1)];
  }
  return (TBL = T);
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
