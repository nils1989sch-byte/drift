// Einfache 2D-Kollision in der XZ-Ebene: Kreise gegen orientierte Boxen (OBB).
import { CARGO, RAMP } from './config.js';

// Box: { cx, cz, hx, hz, a }
export function boxFromAABB(w) {
  return { cx: (w.x1 + w.x2) / 2, cz: (w.z1 + w.z2) / 2, hx: (w.x2 - w.x1) / 2, hz: (w.z2 - w.z1) / 2, a: 0, src: w };
}

// Liefert {nx, nz, depth} oder null
export function circleVsBox(px, pz, r, b) {
  const c = Math.cos(b.a), s = Math.sin(b.a);
  const dx = px - b.cx, dz = pz - b.cz;
  const lx = dx * c + dz * s;
  const lz = -dx * s + dz * c;
  const qx = Math.max(-b.hx, Math.min(b.hx, lx));
  const qz = Math.max(-b.hz, Math.min(b.hz, lz));
  let ox = lx - qx, oz = lz - qz;
  let d2 = ox * ox + oz * oz;
  let nlx, nlz, depth;
  if (d2 > 1e-9) {
    if (d2 >= r * r) return null;
    const d = Math.sqrt(d2);
    nlx = ox / d; nlz = oz / d; depth = r - d;
  } else {
    // Mittelpunkt in der Box: entlang der kürzesten Achse raus
    const px_ = b.hx - Math.abs(lx), pz_ = b.hz - Math.abs(lz);
    if (px_ < pz_) { nlx = Math.sign(lx) || 1; nlz = 0; depth = px_ + r; }
    else { nlx = 0; nlz = Math.sign(lz) || 1; depth = pz_ + r; }
  }
  return { nx: nlx * c - nlz * s, nz: nlx * s + nlz * c, depth };
}

export function distToBox(px, pz, b) {
  const c = Math.cos(b.a), s = Math.sin(b.a);
  const dx = px - b.cx, dz = pz - b.cz;
  const lx = dx * c + dz * s, lz = -dx * s + dz * c;
  const ox = Math.max(0, Math.abs(lx) - b.hx), oz = Math.max(0, Math.abs(lz) - b.hz);
  return Math.hypot(ox, oz);
}

// Schiebt einen Kreis aus allen Hindernissen. Gibt Gesamtkorrektur zurück.
export function resolveCircle(p, r, boxes, iterations = 3) {
  let cx = 0, cz = 0;
  for (let it = 0; it < iterations; it++) {
    let any = false;
    for (const b of boxes) {
      const hit = circleVsBox(p.x, p.z, r, b);
      if (hit) {
        p.x += hit.nx * hit.depth; p.z += hit.nz * hit.depth;
        cx += hit.nx * hit.depth; cz += hit.nz * hit.depth;
        any = true;
      }
    }
    if (!any) break;
  }
  return { x: cx, z: cz };
}

export function insideRect(x, z, r, m = 0) {
  return x > r.x1 + m && x < r.x2 - m && z > r.z1 + m && z < r.z2 - m;
}

export function groundHeight(x, z) {
  if (z > CARGO.z1 && z < CARGO.z2 && x >= RAMP.x2 && x < CARGO.x2 + 0.5) return CARGO.floor;
  if (z > RAMP.z1 - 0.2 && z < RAMP.z2 + 0.2 && x > RAMP.x1 && x < RAMP.x2) {
    return ((x - RAMP.x1) / (RAMP.x2 - RAMP.x1)) * CARGO.floor;
  }
  return 0;
}

export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const damp = (k, dt) => 1 - Math.exp(-k * dt);
