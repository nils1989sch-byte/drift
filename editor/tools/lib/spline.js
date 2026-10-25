// Centripetal Catmull-Rom splines through click points (tile units) + rasterising a "thick" curve to cells.
export function catmull(pts, step = 0.25) {
  if (pts.length < 2) return pts.slice();
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(seg / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      // interpolate an optional 3rd component (width) linearly
      const wv = (p1[2] ?? 1) + ((p2[2] ?? 1) - (p1[2] ?? 1)) * t;
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), wv]);
    }
  }
  const L = pts[pts.length - 1];
  out.push([L[0], L[1], L[2] ?? 1]);
  return out;
}

// cells within radius(width/2 * scale + extra) of the polyline. Returns Map key "x,y" → {x,y,d,t}
// d = distance to the centre line (tiles), t = 0..1 position along the curve, w = local width.
export function thickCells(curve, width = 1, extra = 0, w = 1e9, h = 1e9) {
  const cells = new Map();
  let len = 0; const acc = [0];
  for (let i = 1; i < curve.length; i++) { len += Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]); acc.push(len); }
  for (let i = 0; i < curve.length; i++) {
    const [cx, cy, ws = 1] = curve[i];
    const r = (width * ws) / 2 + extra;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r); x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r) continue;
        const k = x + ',' + y, prev = cells.get(k);
        // normalised distance (0 = centre, 1 = edge of the core width)
        const nd = d / Math.max(0.01, (width * ws) / 2);
        if (!prev || nd < prev.nd) cells.set(k, { x, y, d, nd, t: len ? acc[i] / len : 0, w: width * ws });
      }
  }
  return cells;
}

export function curveLength(c) { let s = 0; for (let i = 1; i < c.length; i++) s += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]); return s; }

// direction (unit) of the curve near index i
export function tangent(c, i) {
  const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  return [dx / L, dy / L];
}
