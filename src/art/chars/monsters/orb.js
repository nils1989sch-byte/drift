// Drift orb: petrol glass sphere with a glowing core inside a bronze cage of three vertical bands
// (deliberately NOT a horizontally split two-colour ball). 32×32 px canvas (16 world px), anchor (16, 30).
import { frames } from '../../core.js';
import { Fig } from '../rig.js';
import { M } from '../materials.js';
import { pen } from './kit.js';

function orb(p, o = {}) {
  const lean = o.lean || 0, open = o.open || 0, cy = -8.5 + (o.lift || 0);
  const glow = o.glow ? M.glow_hot : M.glow;
  // glass
  if (open < 1) {
    p.ell(lean * 0.4, cy, 7.2, 7.2, M.petrol, { flat: 0.05 });
    p.ell(lean * 0.5, cy + 0.6, 3.2 + (o.glow ? 0.8 : 0), 3.2 + (o.glow ? 0.8 : 0), glow, { flat: 0.4 });
    p.touch(lean * 0.4 - 3.4, cy - 3.6, { m: M.glint, t: 0 }); p.touch(lean * 0.4 - 2.4, cy - 4.4, { m: M.glint, t: 0 });
  } else {
    // open: core rises as a bright light, bands spread like petals
    p.ell(0, cy - 2, 4.6, 4.6, glow, { tone: 3 });
    p.ell(0, cy - 2, 2.6, 2.6, glow, { tone: 4 });
  }
  // bronze cap and foot
  p.ell(lean, cy - 7.2 + open * -1.5, 2.6, 1.4, M.bronze, { flat: 0.1 });
  p.ell(lean * 0.2, cy + 7.2, 3.4, 1.5, M.bronze, { flat: 0.2, bias: -0.3 });
  // three vertical bands (left, centre, right)
  for (const k of [-1, 0, 1]) {
    const spread = open * 7;
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, a = (t - 0.5) * Math.PI;
      const r = 7.4 + spread * Math.sin(t * Math.PI) * 0.6;
      const x = k * Math.cos(a) * r * 0.72 + k * spread * 0.4 * t + lean * (1 - t);
      const y = cy + Math.sin(a) * 7.4 - spread * 0.2 * (1 - t) * Math.abs(k);
      pts.push([x, y, k === 0 ? 1.15 : 1.0]);
    }
    p.chain(pts, M.bronze, { flat: 0.2, bias: k === 1 ? -0.4 : 0.2 });
  }
  p.ell(lean * 0.6, cy - 0.2, 1.1, 1.1, M.bronze, { bias: 0.8 }); // centre rivet
}

export function buildOrb() {
  const mk = (o) => { const f = new Fig(32, 32); orb(pen(f, 16.5, 30.5, 1), o); return f.canvas(16, 30); };
  return {
    orb: [mk({})],
    orb_open: frames([mk({ open: 0.45, glow: 1 }), mk({ open: 1, glow: 1 })], { fps: 10 }),
    orb_shake: frames([mk({ lean: -2.4 }), mk({ glow: 1 }), mk({ lean: 2.4 })], { fps: 6 }),
  };
}
