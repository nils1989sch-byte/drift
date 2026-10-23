// Monster kit: a scaled "pen" over the rig Fig, shared eye/mouth helpers, frame/pose builder and
// mirrored+relit side views. Design space: x right, y down, ground at y = 0, origin = foot anchor.
import { frames } from '../../core.js';
import { Fig } from '../rig.js';
import { M } from '../materials.js';
import { flashCanvas } from '../util.js';

export function pen(f, ax, ay, s = 1) {
  const X = (x) => ax + x * s, Y = (y) => ay + y * s;
  const wrapClip = (o) => (o && o.clip ? { ...o, clip: (x, y, a, b) => o.clip((x - ax) / s, (y - ay) / s, a, b) } : o);
  return {
    f, s,
    ell: (x, y, rx, ry, m, o = {}) => f.ell(X(x), Y(y), Math.max(0.5, rx * s), Math.max(0.5, ry * s), m, wrapClip(o)),
    limb: (x0, y0, x1, y1, r0, r1, m, o = {}) => f.limb(X(x0), Y(y0), X(x1), Y(y1), Math.max(0.45, r0 * s), Math.max(0.45, r1 * s), m, wrapClip(o)),
    chain: (pts, m, o = {}) => f.chain(pts.map((q) => [X(q[0]), Y(q[1]), Math.max(0.45, q[2] * s), q[3]]), m, wrapClip(o)),
    poly: (pts, m, o = {}) => f.poly(pts.map((q) => [X(q[0]), Y(q[1])]), m, o.nf ? { ...o, nf: (x, y) => o.nf((x - ax) / s, (y - ay) / s) } : o),
    touch: (x, y, t) => f.touch(X(x), Y(y), t),
    at: (x, y) => f.matAt(X(x), Y(y)),
    grp: () => f.grp,
  };
}

// big glossy creature eye. state: open | closed | wince | happy | sleepy
export function eye(p, x, y, r, state = 'open', o = {}) {
  const em = o.mat ?? M.eye;
  if (state === 'closed' || state === 'happy') { p.limb(x - r * 0.9, y + (state === 'happy' ? 0.4 : 0), x + r * 0.9, y + (state === 'happy' ? 0.4 : 0), 0.6, 0.6, o.line ?? M.eye, { tone: 0 }); if (state === 'happy') { p.touch(x - r, y + 1, { m: em, t: 0 }); p.touch(x + r, y + 1, { m: em, t: 0 }); } return; }
  if (state === 'wince') { p.limb(x - r, y - r * 0.6, x + r * 0.3, y, 0.6, 0.6, em, { tone: 0 }); p.limb(x + r * 0.3, y, x - r, y + r * 0.6, 0.6, 0.6, em, { tone: 0 }); return; }
  const ry = state === 'sleepy' ? r * 0.5 : r;
  const yy = state === 'sleepy' ? y + r * 0.4 : y;
  p.ell(x, yy, r * 0.82, ry, em, { tone: 0 });
  if (state !== 'sleepy') p.ell(x, yy + ry * 0.38, r * 0.5, ry * 0.42, em, { tone: 2 });
  p.touch(x - r * 0.32, yy - ry * 0.42, { m: M.glint, t: 0 });
  if (r > 2.6 && state !== 'sleepy') p.touch(x + r * 0.3, yy + ry * 0.2, { m: M.glint, t: 0 });
  if (state === 'sleepy') p.limb(x - r * 0.9, yy - ry * 0.7, x + r * 0.9, yy - ry * 0.7, 0.55, 0.55, o.lid ?? M.eye, { tone: 0 });
}
export function mouth(p, x, y, w, open, o = {}) {
  if (open) { p.ell(x, y + 0.6, w * 0.6, w * 0.5, M.mouth, { tone: 1 }); p.touch(x, y + w * 0.4, { m: M.blush, t: 2 }); return; }
  p.touch(x - w * 0.5, y - 0.4, { m: o.mat ?? M.mouth, t: 1 }); p.touch(x, y, { m: o.mat ?? M.mouth, t: 0 }); p.touch(x + w * 0.5, y - 0.4, { m: o.mat ?? M.mouth, t: 1 });
}
export const sparkle = (p, x, y, r, m = M.spark) => { for (const [dx, dy, t] of [[0, 0, 3], [1, 0, 2], [-1, 0, 2], [0, 1, 2], [0, -1, 2], [0, 2, 0], [0, -2, 0], [2, 0, 0], [-2, 0, 0]]) if (Math.abs(dx) + Math.abs(dy) <= r) p.touch(x + dx / p.s, y + dy / p.s, { m, t }); };

// ---------------- frame builder ----------------
// spec: { id, size, ay, draw(p, view, P), fly?, hover?, iconScale?, iconY? }
const DIRS = ['down', 'up', 'left', 'right'];
const viewOf = (d) => (d === 'left' || d === 'right' ? 'side' : d);

export function buildMonster(spec) {
  const S = {}, N = spec.size, AX = N >> 1, AY = N - (spec.ay ?? 4);
  const memo = new Map();
  const render = (dir, P, o = {}) => {
    const key = JSON.stringify(P);
    if (dir === 'right' && memo.has(key)) { const f = memo.get(key); memo.delete(key); f.flip(); return f.canvas(N - 1 - AX, AY); }
    const f = new Fig(N, N);
    spec.draw(pen(f, AX + 0.5, AY + 0.5, 1), viewOf(dir), P);
    if (dir === 'right') { f.flip(); return f.canvas(N - 1 - AX, AY); }
    if (dir === 'left') { const c = f.canvas(AX, AY, { release: false }); memo.set(key, f); return c; }
    return f.canvas(AX, AY);
  };
  const fly = !!spec.fly;
  for (const dir of DIRS) {
    const base = { bob: 0, step: 0, flap: fly ? 0.5 : 0, ph: 0 };
    const i0 = render(dir, base);
    const i1 = render(dir, { ...base, bob: 1, flap: fly ? 1 : 0, ph: 1.6 });
    S[`mon_${spec.id}_idle_${dir}`] = frames([i0, i1], { fps: fly ? 6 : 2.5 });
    const wA = render(dir, { ...base, step: 1, bob: fly ? 0 : -1, flap: fly ? 1 : 0, ph: 0.8 });
    const wB = render(dir, { ...base, step: -1, bob: fly ? 1 : -1, flap: fly ? 0 : 0, ph: 2.4 });
    S[`mon_${spec.id}_walk_${dir}`] = frames([wA, i0, wB, i0], { fps: 8 });
    S[`mon_${spec.id}_attack_${dir}`] = frames([
      render(dir, { ...base, atk: 0, bob: 1, flap: fly ? 1 : 0, ph: 0.4 }),
      render(dir, { ...base, atk: 1, mouth: true, flap: fly ? 0 : 0, ph: 1.2 }),
      render(dir, { ...base, atk: 2, mouth: true, flap: fly ? 0.5 : 0, ph: 2 }),
    ], { fps: 10 });
    S[`mon_${spec.id}_hurt_${dir}`] = frames([flashCanvas(render(dir, { ...base, hurt: 1, eyes: 'wince', bob: 1, ph: 0.2 })), i0], { fps: 14 });
  }
  // faint (no direction): wince → sink → lying on the side, eyes closed
  {
    const f0 = render('down', { bob: 1, step: 0, flap: 0, eyes: 'wince', ph: 0, faint: 1 });
    const f1 = render('down', { bob: 2, step: 0, flap: 0, eyes: 'closed', ph: 0, faint: 2, sq: 1 });
    const f = new Fig(N, N);
    spec.draw(pen(f, AX + 0.5, AY + 0.5, 1), 'side', { bob: 0, step: 0, flap: 0, eyes: 'closed', ph: 0, faint: 3 });
    const r = f.rot90(); f.release();
    // lying body: rotated so the back rests on the ground; shift down so it touches the ground line
    const lie = new Fig(N, N);
    let maxY = 0, minX = N, maxX = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (r.m[y * N + x]) { maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    const dy = AY - 1 - maxY, dx = Math.round(AX - (minX + maxX) / 2);
    lie.stamp(r, dx, dy);
    S[`mon_${spec.id}_faint`] = frames([f0, f1, lie.canvas(AX, AY)], { fps: 6 });
  }
  // icon: 32×32 portrait, front view, drawn (not scaled) at a smaller pen scale
  {
    const f = new Fig(32, 32);
    const sc = spec.iconScale ?? 32 / N * 1.25;
    spec.draw(pen(f, 16.5, (spec.iconY ?? 29) + 0.5, sc), 'down', { bob: 0, step: 0, flap: fly ? 0.5 : 0, ph: 0, icon: 1 });
    const c = f.canvas(16, 31, { ws: 1 });
    S[`mon_${spec.id}_icon`] = [c];
  }
  return S;
}
export { M };
