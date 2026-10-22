// Procedural heads: skin ellipsoid face + painted features + hair built from tapered LOCKS (each lock is its own
// group → automatic dark separation lines between locks, cylinder-lit with the head sphere blended in).
import { M } from './materials.js';

const FEAT = {
  // features relative to the face centre column/row; chars: b brow, e eye dark, i iris, w glint, c blush, m mouth,
  // n nose shade, o open mouth, s skin (force), S shadow
  down: { x: -4, y: -2, rows: [
    'bb.....bb',
    '.ee...ee.',
    '.ie...ei.',
    'c...n...c',
    '.........',
    '....m....'] },
  side: { x: -6, y: -2, rows: [
    '.bb...',
    '.ee...',
    '.ie...',
    '...c..',
    '......',
    '.m....'] },
};
const VAR = {
  closed: { e: 'S', i: 'b' }, wince: { e: 'b', i: 'S' }, happy: { e: 'S', i: 'b' },
};

function lockChain(f, hc, L, mat, sph, o = {}) {
  const [x0, y0, x1, y1, x2, y2, r0, r1 = 0.55, bias = 0] = L;
  const pts = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    pts.push([hc[0] + a * x0 + b * x1 + c * x2, hc[1] + a * y0 + b * y1 + c * y2, r0 + (r1 - r0) * Math.pow(t, 1.3)]);
  }
  return f.chain(pts, mat, { sph, flat: 0.15, bias: bias + (o.bias ?? 0) });
}

export function drawHeadP(f, view, hc, spec, pose = {}) {
  const s = pose.scale || 1;
  const hair = spec.hair, skin = spec.skin ?? M.skin, eye = spec.eye ?? M.eye;
  const H = spec[view];
  const sc = (L) => L.map((v, i) => (i < 8 ? v * s : v));
  const sph = [hc[0] + (H.sphX ?? 0) * s, hc[1] - 1.5 * s, 9 * s, spec.sphW ?? 0.68];
  // 1) back hair / locks behind the face
  if (H.mass) { const [mx, my, rx, ry] = H.mass; f.ell(hc[0] + mx * s, hc[1] + my * s, rx * s, ry * s, hair, { bias: -0.5, flat: 0.1 }); }
  for (const L of H.back || []) lockChain(f, hc, sc(L), hair, sph, { bias: -0.3 });
  if (spec.behindFace) spec.behindFace(f, view, hc, pose);
  // 2) ears, face
  for (const e of H.ears || []) f.ell(hc[0] + e[0] * s, hc[1] + e[1] * s, 1.3 * s, 1.7 * s, skin, { bias: -0.4 });
  if (H.face) {
    const [fx, fy, rx, ry] = H.face;
    const cx = hc[0] + fx * s, cy = hc[1] + fy * s;
    f.ell(cx, cy, rx * s, ry * s, skin, { clip: (x, y, u, v) => Math.abs(u) < 1 - Math.max(0, v - 0.25) * (H.chin ?? 0.55), flat: 0.15 });
    if (H.nose) f.ell(hc[0] + H.nose[0] * s, hc[1] + H.nose[1] * s, 0.95 * s, 0.9 * s, skin, { bias: 0.2, grp: f.grp });
    // features
    if (s > 0.9 && H.feat) {
      const F = FEAT[H.feat];
      const vm = VAR[pose.eyes] || {};
      const col0 = Math.floor(cx) + F.x, row0 = Math.round(cy) + F.y;
      F.rows.forEach((r, j) => {
        for (let i = 0; i < r.length; i++) {
          let ch = r[i]; if (ch === '.') continue;
          if (vm[ch]) ch = vm[ch];
          if (ch === 'm' && pose.mouth === 'open') { f.touch(col0 + i, row0 + j, { m: M.mouth, t: 1 }); f.touch(col0 + i + (H.feat === 'side' ? 1 : -1), row0 + j, { m: M.mouth, t: 2 }); continue; }
          if (ch === 'm' && pose.eyes === 'happy') { f.touch(col0 + i - 1, row0 + j, { m: skin, t: 1 }); f.touch(col0 + i + 1, row0 + j, { m: skin, t: 1 }); }
          const X = col0 + i - f.ox * 0, Y = row0 + j;
          const T = { b: { m: spec.brow ?? hair, t: 1 }, e: { m: eye, t: 0 }, i: { m: eye, t: 2 }, w: { m: eye, t: 3 }, c: { m: M.blush, t: 2 }, m: { m: skin, t: 0 }, n: { b: -1 }, S: { m: skin, t: 1 } }[ch];
          if (T) f.touch(X, Y, T);
        }
      });
    }
  }
  if (spec.onFace) spec.onFace(f, view, hc, pose, s);
  // 3) side locks + fringe in front
  for (const L of H.front || []) lockChain(f, hc, sc(L), hair, sph);
  if (spec.top) spec.top(f, view, hc, pose, s);
}

// ---------------- hero hair: tousled, dark brown, side-swept fringe, cowlick ----------------
export const HERO_HAIR = {
  down: {
    mass: [0, -1.6, 7.6, 7.0], ears: [[-5.9, 3.4], [5.9, 3.4]], face: [0, 3.2, 5.7, 5.5], feat: 'down', sphX: -0.5,
    back: [
      [0, -5, -4, -9, -7.8, -6.4, 3.4], [0, -5, 3.5, -9.4, 7.2, -7.2, 3.4], [0, -6, 0.5, -9.5, 2, -11.2, 2.6],
      [-4, -4, -7.6, -1, -7.4, 4.4, 2.6], [4, -4, 7.8, -1, 7.2, 4.8, 2.6],
    ],
    front: [
      [3, -6.5, 6.4, -3.2, 6.8, 2.4, 2.4], [2.2, -7, 4.2, -3, 3.8, 1.2, 2.6],
      [1, -7.2, 1.2, -3, 0.2, 0.6, 2.4], [-0.5, -7.2, -2.2, -3.4, -3, 1.0, 2.6], [-2.5, -6.6, -5.6, -3.2, -6.4, 1.8, 2.6],
      [-4.6, -3, -6.6, 1, -6.2, 5.6, 1.8, 0.5, -0.4], [4.6, -3, 6.6, 1, 6.1, 5.8, 1.8, 0.5, -0.4],
    ],
  },
  up: {
    mass: [0, -1, 7.6, 7.4], ears: [[-6, 3.2], [6, 3.2]], sphX: 0,
    face: null,
    back: [],
    front: [
      [0, -6, -4, -9, -7.8, -6.4, 3.4], [0, -6, 3.5, -9.4, 7.2, -7.2, 3.4], [0, -6, 0.5, -9.5, 2, -11.2, 2.6],
      [-1, -6, -6, -4, -7.6, 1.6, 3.0], [1, -6, 6, -4, 7.6, 2, 3.0],
      [-1, -4, -4.6, 0, -5.4, 5.6, 2.9], [1, -4, 4.4, 0.5, 5.2, 6, 2.9],
      [0, -3, -0.6, 2, -1.4, 7.2, 3.0], [1.5, -2, 2.4, 3, 2.2, 6.6, 2.2],
    ],
  },
  side: {
    mass: [1.4, -1.6, 7.2, 7.0], ears: [[1.4, 3.4]], face: [-2.4, 3.2, 5.2, 5.4], chin: 0.4, nose: [-6.9, 3.7], feat: 'side', sphX: 0.5,
    back: [
      [1, -6, 6, -6, 8.8, -1.6, 3.2], [1, -3, 6.4, -0.4, 7.4, 5.2, 2.9], [0.5, 0, 4, 3.4, 4.2, 7.4, 2.4],
    ],
    front: [
      [0, -6, -3.4, -9.4, -6.8, -7.4, 3.0], [1, -7, 2.5, -9.8, 4.4, -10.6, 2.4], [2, -6, 5.5, -8.4, 8.4, -6.4, 2.8],
      [-1.5, -6.4, -5.4, -4.4, -8.2, -0.2, 2.6], [-0.5, -5.6, -3.4, -2.4, -4.2, 1.0, 2.2],
      [0.4, -3, -0.2, 1.4, -0.8, 5.2, 1.7, 0.5, -0.3],
    ],
  },
};
