// Tiny map painter: build ground chars + heights with rectangle ops, then hand them to parseMap.
export function painter(w, h, fill = '.', hfill = 0) {
  const g = Array.from({ length: h }, () => Array(w).fill(fill));
  const hm = Array.from({ length: h }, () => Array(w).fill(hfill));
  const ok = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const P = {
    w, h,
    set(x, y, ch, hv) { if (ok(x, y)) { if (ch != null) g[y][x] = ch; if (hv != null) hm[y][x] = hv; } return P; },
    get: (x, y) => (ok(x, y) ? g[y][x] : ' '),
    hAt: (x, y) => (ok(x, y) ? hm[y][x] : 0),
    rect(x0, y0, x1, y1, ch, hv) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P.set(x, y, ch, hv); return P; },
    // paint only cells currently holding one of `only`
    rectIf(x0, y0, x1, y1, ch, only) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (only.includes(P.get(x, y))) P.set(x, y, ch); return P; },
    height(x0, y0, x1, y1, hv) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P.set(x, y, null, hv); return P; },
    // rough ellipse blob
    blob(cx, cy, rx, ry, ch, hv) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) P.set(x, y, ch, hv);
      return P;
    },
    rows: () => g.map((r) => r.join('')),
    heights: () => hm.map((r) => r.join('')),
  };
  return P;
}

// Standard dungeon/cave room: walls (height 2) on N/W/E, flat wall row at the south (keeps the floor visible).
export function room(w, h, { floor = '_', doorsN = [], doorsS = [] } = {}) {
  const P = painter(w, h, floor, 0);
  P.rect(0, 0, w - 1, 1, 'W', 2);
  P.rect(0, 0, 0, h - 1, 'W', 2);
  P.rect(w - 1, 0, w - 1, h - 1, 'W', 2);
  P.rect(0, h - 1, w - 1, h - 1, 'W', 0);
  for (const x of doorsN) P.rect(x, 0, x, 1, floor, 0);
  for (const x of doorsS) P.set(x, h - 1, floor, 0);
  return P;
}
