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
  const S = {}, sc = spec.scale ?? 1;
  // 1) measure: union bbox (relative to the foot anchor) over the widest poses of every view
  const B = 220, BA = 110, BY = 200;
  let L = 0, R = 0, T = 0, D = 0;
  for (const view of ['down', 'up', 'side']) for (const P of [{ bob: 0, step: 1, flap: 1 }, { bob: 0, atk: 1, mouth: true, flap: 0 }, { bob: 0, atk: 0, flap: 1 }]) {
    const f = new Fig(B, B);
    spec.draw(pen(f, BA + 0.5, BY + 0.5, sc), view, { ph: 0, ...P });
    const bb = f.bbox(); f.release();
    if (bb.x1 < 0) continue;
    L = Math.max(L, BA - bb.x0); R = Math.max(R, bb.x1 - BA); T = Math.max(T, BY - bb.y0); D = Math.max(D, bb.y1 - BY);
  }
  const half = Math.ceil(Math.max(L, R)) + 2;
  const N = Math.max(2 * half, Math.ceil(T + D) + 4);
  const AX = N >> 1, AY = N - 2 - Math.ceil(D);
  const memo = new Map();
  const render = (dir, P) => {
    const key = JSON.stringify(P);
    if (dir === 'right' && memo.has(key)) { const f = memo.get(key); memo.delete(key); f.flip(); return f.canvas(N - 1 - AX, AY); }
    const f = new Fig(N, N);
    spec.draw(pen(f, AX + 0.5, AY + 0.5, sc), viewOf(dir), P);
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
    const wB = render(dir, { ...base, step: -1, bob: fly ? 1 : -1, flap: 0, ph: 2.4 });
    S[`mon_${spec.id}_walk_${dir}`] = frames([wA, i0, wB, i0], { fps: 8 });
    S[`mon_${spec.id}_attack_${dir}`] = frames([
      render(dir, { ...base, atk: 0, bob: 1, flap: fly ? 1 : 0, ph: 0.4 }),
      render(dir, { ...base, atk: 1, mouth: true, flap: 0, ph: 1.2 }),
      render(dir, { ...base, atk: 2, mouth: true, flap: fly ? 0.5 : 0, ph: 2 }),
    ], { fps: 10 });
    S[`mon_${spec.id}_hurt_${dir}`] = frames([flashCanvas(render(dir, { ...base, hurt: 1, eyes: 'wince', bob: 1, ph: 0.2 })), i0], { fps: 14 });
  }
  // faint (no direction): wince → sink → lying (tipped over onto its side, or on its back for crabs)
  {
    const f0 = render('down', { bob: 1, step: 0, flap: 0, eyes: 'wince', ph: 0, faint: 1 });
    const f1 = render('down', { bob: 2, step: 0, flap: 0, eyes: 'closed', ph: 0, faint: 2, mouth: true });
    const f = new Fig(N, N);
    spec.draw(pen(f, AX + 0.5, AY + 0.5, sc), 'down', { bob: 0, step: 0, flap: 0, eyes: 'closed', ph: 0, faint: 3 });
    const r = spec.faint === 'back' ? f.flipV() : f.rot90();
    const bb = r.bbox();
    const lie = new Fig(N, N);
    lie.stamp(r, Math.round(AX - (bb.x0 + bb.x1) / 2), AY - bb.y1);
    if (r !== f) f.release();
    S[`mon_${spec.id}_faint`] = frames([f0, f1, lie.canvas(AX, AY)], { fps: 6 });
    r.release && r.m && r.release();
  }
  // icon: 32×32 portrait, front view, re-painted at a pen scale that fits the box (not a scaled bitmap)
  {
    const m = new Fig(B, B);
    spec.draw(pen(m, BA + 0.5, BY + 0.5, 1), 'down', { bob: 0, step: 0, flap: fly ? 0.5 : 0, ph: 0, icon: 1 });
    const bb = m.bbox(); m.release();
    const w = bb.x1 - bb.x0 + 1, h = bb.y1 - bb.y0 + 1;
    const k = Math.min(27 / w, 27 / h, 1.6);
    const cx = (bb.x0 + bb.x1 + 1) / 2 - BA, by = bb.y1 + 1 - BY;
    const f = new Fig(32, 32);
    const oy = 16 + (h * k) / 2 - by * k;
    spec.draw(pen(f, 16 - cx * k, oy, k), 'down', { bob: 0, step: 0, flap: fly ? 0.5 : 0, ph: 0, icon: 1 });
    S[`mon_${spec.id}_icon`] = [f.canvas(16, 31, { ws: 1 })];
  }
  S[`mon_${spec.id}_idle_down`].size = N;
  return S;
}
export { M };
