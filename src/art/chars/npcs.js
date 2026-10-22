// Villagers on the shared humanoid skeleton: elder (robe, beard, staff), girl (braids, dress, apron),
// merchant (hat, moustache, vest, apron, backpack). Same light, ramps and outline rules as the hero.
import { frames } from '../core.js';
import { M } from './materials.js';
import { CX, skeleton } from './human.js';
import { lerp } from './rig.js';

function torsoN(cx, cy, hw, hh) {
  return (x, y) => {
    const u = Math.max(-1, Math.min(1, (x + 0.5 - cx) / hw)), v = Math.max(-1, Math.min(1, (y + 0.5 - cy) / hh));
    const nx = u * 0.9, ny = -0.2 + v * 0.3;
    return [nx, ny, Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny))];
  };
}
// long garment from the shoulders down to `hemY`; folds sway with the walk phase
function gown(f, J, view, pose, o) {
  const top = J.neck[1] + 1, hem = o.hem, ph = pose.phase || 0, sw = Math.sin(ph) * (pose.wind ? 0.8 : 0);
  const side = view === 'side';
  const cx = side ? J.neck[0] + 0.6 : J.neck[0];
  const sw0 = side ? 3.8 : o.sh ?? 5.6, hw = side ? (o.hwS ?? 5) : o.hw ?? 7;
  const pts = [[cx - sw0, top], [cx + sw0, top], [cx + sw0 + 0.6, top + 3], [cx + hw + sw, hem], [cx - hw + sw, hem], [cx - sw0 - 0.6, top + 3]];
  const nf = torsoN(cx, (top + hem) / 2, hw, (hem - top) / 2);
  const g = f.poly(pts, o.mat, { nf });
  // folds
  for (const k of o.folds ?? [-0.45, 0.1, 0.55]) {
    for (let y = Math.round(top + (hem - top) * 0.45); y < hem; y++) {
      const t = (y - top) / (hem - top), x = cx + k * hw * t + sw * t;
      f.touch(x, y, { b: -1.1 }); f.touch(x + 1, y, { b: 0.5 });
    }
  }
  if (o.trim) for (let x = Math.floor(cx - hw - 1); x <= cx + hw + 1; x++) { f.touch(x + sw, hem - 1, { m: o.trim, t: 2 }); }
  return { g, cx, top, hem, hw };
}

// ---------------- elder ----------------
const ELDER_HEAD = {
  down: {
    mass: [0, 0.5, 6.6, 6.2], ears: [[-6, 3.2], [6, 3.2]], face: [0, 2.6, 5.8, 5.6], feat: 'down',
    back: [[-4, -2, -7, 1, -6.6, 5, 2.4], [4, -2, 7, 1, 6.6, 5, 2.4]],
    front: [],
  },
  up: {
    mass: [0, 0, 6.8, 6.6], ears: [[-6.2, 3], [6.2, 3]], face: null,
    back: [],
    front: [[-3, 0, -6.6, 2, -6, 6, 2.6], [3, 0, 6.6, 2, 6, 6, 2.6], [0, 1, -1, 4, -0.6, 7.6, 2.6], [-1.6, 1, -3.6, 4, -3.4, 7.4, 2.2], [1.6, 1, 3.6, 4, 3.4, 7.4, 2.2]],
  },
  side: {
    mass: [1.6, 0, 6, 6.2], ears: [[1.2, 3.2]], face: [-2.2, 2.6, 5.2, 5.6], chin: 0.4, nose: [-7, 3.6], feat: 'side',
    back: [[2, -1, 6, 1, 6.4, 5.6, 2.6], [1, 1, 3.4, 4, 3.6, 7.4, 2.2]],
    front: [],
  },
};
function bald(f, view, hc, pose, s) {
  // bald crown with a soft highlight is the skin ellipsoid itself; beard + brows drawn in front
  const sk = M.skin_old;
  if (view !== 'up') {
    const fx = view === 'side' ? -2.4 : 0;
    // brows
    for (const dx of view === 'side' ? [-4.6] : [-3.4, 3.4]) f.limb(hc[0] + dx - 1.2, hc[1] + 0.6, hc[0] + dx + 1.2, hc[1] + 0.9, 0.9, 0.7, M.beard, { bias: 0.2 });
    // moustache + beard
    const by = hc[1] + 5.4;
    if (view === 'side') {
      f.chain([[hc[0] - 5.8, by - 0.6, 1.4], [hc[0] - 4.6, by + 2.4, 2.4], [hc[0] - 3, by + 6, 2.2], [hc[0] - 2.6, by + 9, 1.0]], M.beard, { flat: 0.2 });
    } else {
      f.ell(hc[0] + fx, by + 1.8, 5.2, 3.4, M.beard, { flat: 0.2 });
      f.chain([[hc[0], by + 2, 3.6], [hc[0], by + 6, 2.8], [hc[0] + 0.2, by + 9.2, 1.0]], M.beard, { flat: 0.2 });
      for (const k of [-1, 1]) f.limb(hc[0] + k * 0.6, by - 0.6, hc[0] + k * 3.6, by + 0.8, 1.2, 0.9, M.beard, { bias: 0.4 });
    }
  }
  void sk; void s; void pose;
}
const ELDER = {
  id: 'elder', skin: M.skin_old, sleeve: M.robe, cuffMat: M.robe_trim, pants: M.robe, boot: M.leather_dk, cuff: true,
  headP: { hair: M.beard, skin: M.skin_old, eye: M.eye_brn, brow: M.beard, ...ELDER_HEAD, onFace: bald },
  noBelt: true,
  body(f, J, view, pose) {
    const G = gown(f, J, view, pose, { mat: M.robe, hem: 45.5, hw: 6.8, sh: 5.6, trim: M.robe_trim });
    // sash
    const y = J.hip[1] - 2;
    if (view !== 'side') f.limb(G.cx - 5.2, y, G.cx + 5.2, y, 1.1, 1.1, M.robe_trim, { flat: 0.3, bias: -0.3 });
    else f.limb(G.cx - 3.8, y, G.cx + 3.8, y, 1.1, 1.1, M.robe_trim, { flat: 0.3, bias: -0.3 });
    if (view === 'down') for (let yy = Math.round(G.top + 1); yy < y - 1; yy++) f.touch(G.cx - 0.5, yy, { m: M.robe_trim, t: 2 });
  },
  prop(f, J, view, pose, hand) {
    // staff in the near / left hand with a glowing gem
    const x = view === 'up' ? hand[0] : hand[0] + (view === 'side' ? -2.6 : 0.6);
    f.limb(x, hand[1] - 13, x + 0.3, 45.6, 1.0, 0.9, M.staff);
    f.chain([[x, hand[1] - 13, 1.2], [x - 1.6, hand[1] - 15.4, 1.1], [x - 0.4, hand[1] - 17.6, 1.0], [x + 1.4, hand[1] - 16.4, 0.9]], M.staff);
    f.ell(x - 0.2, hand[1] - 15.4, 1.5, 1.5, M.gem);
  },
};

// ---------------- girl ----------------
const GIRL_HEAD = {
  down: {
    mass: [0, -1.2, 7.2, 6.8], ears: [[-5.8, 3.4], [5.8, 3.4]], face: [0, 3.2, 5.5, 5.3], feat: 'down',
    back: [[0, -5, -4, -8.6, -7.2, -5.4, 3.2], [0, -5, 4, -8.6, 7.2, -5.4, 3.2]],
    front: [
      [-1, -7, -4.2, -5, -5.8, 0.6, 2.6], [0.5, -7.2, -0.8, -3.4, -2.2, 0.4, 2.4], [1, -7, 2.4, -3.6, 2.6, 0.2, 2.4], [2, -6.6, 5, -4.4, 5.8, 0.8, 2.4],
      [-5, -3, -7, 1, -6.4, 4.6, 2.0, 0.6], [5, -3, 7, 1, 6.4, 4.6, 2.0, 0.6],
    ],
  },
  up: {
    mass: [0, -0.8, 7.2, 7.2], ears: [], face: null, back: [],
    front: [[0, -6, -4.6, -6, -7.2, 0, 3.2], [0, -6, 4.6, -6, 7.2, 0, 3.2], [-1, -3, -4, 1, -4.6, 5.6, 3], [1, -3, 4, 1, 4.6, 5.6, 3], [0, -2, 0, 2, -0.2, 6.4, 2.6]],
  },
  side: {
    mass: [1.4, -1.2, 6.8, 6.8], ears: [[1.4, 3.4]], face: [-2.2, 3.2, 5, 5.3], chin: 0.4, nose: [-6.8, 3.8], feat: 'side',
    back: [[1, -5, 6, -5, 7.6, 0, 3], [1, -2, 5, 1, 5.6, 5, 2.6]],
    front: [[-1, -6.8, -4.6, -5.2, -7.4, -0.6, 2.6], [0, -6.4, -2.6, -3, -3.6, 0.8, 2.2], [0, -7, 2, -8.6, 4.4, -7.6, 2.4]],
  },
};
function braids(f, view, hc, pose, s) {
  const ph = pose.phase || 0, sw = Math.sin(ph) * 0.8;
  const B = (x, y, dx) => {
    const pts = [];
    for (let i = 0; i < 5; i++) pts.push([hc[0] + x + dx * i * 0.4 + sw * i * 0.25, hc[1] + y + i * 2.1, 1.7 - i * 0.12]);
    f.chain(pts, M.hair_red, { flat: 0.2 });
    for (let i = 1; i < 5; i++) f.touch(pts[i][0], pts[i][1] - 1, { b: -1.2 });
    f.ell(pts[4][0], pts[4][1] + 1.2, 1.3, 1.1, M.green_cloth); // ribbon
  };
  if (view === 'down') { B(-6.4, 4.6, -0.6); B(6.4, 4.6, 0.6); }
  else if (view === 'up') { B(-5.6, 4.2, -0.4); B(5.6, 4.2, 0.4); }
  else B(3.4, 4.6, 0.5);
  // head band
  if (view !== 'side') f.limb(hc[0] - 6.4, hc[1] - 3.6, hc[0] + 6.4, hc[1] - 3.6, 0.8, 0.8, M.green_cloth, { clip: (x, y) => view === 'up' || Math.abs(x + 0.5 - hc[0]) > 4.6 || y < hc[1] - 4 });
  void s;
}
const GIRL = {
  id: 'girl', skin: M.skin, sleeve: M.dress, cuffMat: M.apron, pants: M.leather_dk, boot: M.leather_dk, eye: M.eye_brn,
  headP: { hair: M.hair_red, skin: M.skin, eye: M.eye_brn, ...GIRL_HEAD, top: braids },
  noBelt: true,
  body(f, J, view, pose) {
    const G = gown(f, J, view, pose, { mat: M.dress, hem: 41, hw: 6.6, sh: 5.0, hwS: 4.8, folds: [-0.5, 0, 0.5] });
    if (view === 'down') {
      f.poly([[G.cx - 3.4, J.hip[1] - 4], [G.cx + 3.4, J.hip[1] - 4], [G.cx + 4.4, 40.4], [G.cx - 4.4, 40.4]], M.apron, { nf: torsoN(G.cx, 37, 6, 5) });
      f.poly([[G.cx - 2.2, G.top + 1.4], [G.cx + 2.2, G.top + 1.4], [G.cx + 2.6, J.hip[1] - 3.6], [G.cx - 2.6, J.hip[1] - 3.6]], M.apron, { nf: torsoN(G.cx, 30, 6, 5), bias: 0.3 });
    } else if (view === 'side') {
      f.poly([[G.cx - 4.4, J.hip[1] - 4], [G.cx - 1, J.hip[1] - 4], [G.cx - 1.4, 40.4], [G.cx - 5.4, 40.4]], M.apron, { nf: torsoN(G.cx, 37, 5, 5) });
    } else {
      f.limb(G.cx - 1, J.hip[1] - 3.8, G.cx - 3.6, J.hip[1] + 1, 0.8, 0.8, M.apron); f.limb(G.cx + 1, J.hip[1] - 3.8, G.cx + 3.6, J.hip[1] + 1, 0.8, 0.8, M.apron);
      f.ell(G.cx, J.hip[1] - 3.8, 1.4, 1.0, M.apron);
    }
  },
};

// ---------------- merchant ----------------
const MERCH_HEAD = {
  down: {
    mass: [0, 0, 7, 6.4], ears: [[-6, 3.4], [6, 3.4]], face: [0, 3.2, 5.9, 5.6], feat: 'down',
    back: [], front: [[-5, -1, -6.6, 2, -6.2, 5.2, 2.0, 0.6], [5, -1, 6.6, 2, 6.2, 5.2, 2.0, 0.6]],
  },
  up: { mass: [0, 0, 7, 6.8], ears: [[-6.2, 3.2], [6.2, 3.2]], face: null, back: [], front: [[0, 0, -4, 3, -4.4, 6.6, 3], [0, 0, 4, 3, 4.4, 6.6, 3], [0, 1, 0, 4, 0, 7.2, 3]] },
  side: { mass: [1.6, 0, 6.4, 6.4], ears: [[1.4, 3.4]], face: [-2.2, 3.2, 5.3, 5.6], chin: 0.35, nose: [-7.1, 3.8], feat: 'side', back: [[1, 0, 5, 3, 5, 6.6, 2.6]], front: [] },
};
function hatAndMoustache(f, view, hc, pose, s) {
  // moustache
  if (view === 'down') for (const k of [-1, 1]) f.chain([[hc[0] + k * 0.4, hc[1] + 6, 1.1], [hc[0] + k * 2.4, hc[1] + 6.4, 1.1], [hc[0] + k * 3.8, hc[1] + 5.6, 0.7]], M.hair_blk, { bias: 0.4 });
  if (view === 'side') f.chain([[hc[0] - 6, hc[1] + 5.8, 1.1], [hc[0] - 4.4, hc[1] + 6.4, 1.1], [hc[0] - 3, hc[1] + 5.8, 0.7]], M.hair_blk, { bias: 0.4 });
  // wide-brimmed hat
  const sx = view === 'side' ? 0.6 : 0;
  f.ell(hc[0] + sx, hc[1] - 1.8, view === 'side' ? 9.6 : 10, 3.2, M.hat, { flat: 0.55, bias: -0.2 });
  f.ell(hc[0] + sx + (view === 'side' ? 0.8 : 0), hc[1] - 5.2, 6, 4.6, M.hat, { clip: (x, y) => y < hc[1] - 1.8 });
  f.limb(hc[0] + sx - 5.6, hc[1] - 2.8, hc[0] + sx + 5.6 + (view === 'side' ? 1 : 0), hc[1] - 2.8, 1.0, 1.0, M.vest, { flat: 0.3, clip: (x, y) => y >= hc[1] - 3.9 });
  if (view === 'down') f.ell(hc[0] + 4, hc[1] - 4.6, 1.3, 2.4, M.leaf, { flat: 0.2 }); // feather
  void pose; void s;
}
const MERCHANT = {
  id: 'merchant', skin: M.skin, sleeve: M.shirt, cuffMat: M.vest, pants: M.pants, boot: M.boot, eye: M.eye_brn,
  jacket: M.vest, shirt: M.shirt, hemMat: M.apron, belt: M.belt, pouch: true,
  headP: { hair: M.hair_blk, skin: M.skin, eye: M.eye_brn, brow: M.hair_blk, ...MERCH_HEAD, top: hatAndMoustache },
  back(f, J, view) {
    // backpack (behind the body in front view, on top in back view, visible behind in side view)
    const y = J.neck[1] + 5;
    if (view === 'up') {
      f.ell(J.neck[0], y + 1, 5.4, 5.6, M.pack, { flat: 0.25 });
      f.limb(J.neck[0] - 4.6, y - 3.6, J.neck[0] + 4.6, y - 3.6, 1.6, 1.6, M.leather_dk, { flat: 0.3 }); // rolled blanket
      for (const k of [-1, 1]) f.limb(J.neck[0] + k * 2.6, y - 1, J.neck[0] + k * 2.6, y + 5, 0.6, 0.6, M.belt);
      f.ell(J.neck[0], y + 2, 2, 1.4, M.brass);
    } else if (view === 'side') {
      f.ell(J.neck[0] + 5.6, y + 1, 3.6, 5.6, M.pack, { flat: 0.2, bias: -0.3 });
      f.ell(J.neck[0] + 5.6, y - 4.4, 2.4, 1.8, M.leather_dk);
    } else {
      f.ell(J.neck[0] + 6.2, y - 3.4, 2.2, 2, M.leather_dk, { bias: -0.5 }); f.ell(J.neck[0] - 6.2, y - 3.4, 2.2, 2, M.leather_dk, { bias: -0.5 });
    }
  },
  deco(f, J, view) {
    if (view !== 'down') return;
    const cx = J.neck[0], y = J.hip[1] - 2.6;
    f.poly([[cx - 4.2, y - 3], [cx + 4.2, y - 3], [cx + 4.8, 42.2], [cx - 4.8, 42.2]], M.apron, { nf: torsoN(cx, 38, 6, 5) });
    f.limb(cx - 4.6, y - 3, cx + 4.6, y - 3, 0.7, 0.7, M.apron, { bias: 0.6 });
    for (const k of [-2, 1.4]) f.touch(cx + k, y + 1.4, { m: M.brass, t: 2 });
  },
};

const LOOKS = { elder: ELDER, girl: GIRL, merchant: MERCHANT };

export function buildNPCs(renderPose, walkPose, viewOf) {
  const S = {};
  for (const [name, look] of Object.entries(LOOKS)) {
    const scale = name === 'girl' ? 0.92 : 1;
    for (const dir of ['down', 'up', 'left', 'right']) {
      const v = viewOf(dir);
      S[`npc_${name}_idle_${dir}`] = frames([0, 1].map((k) => {
        const p = { bob: k, scale, wind: 0, phase: k * 1.5, eyes: name === 'elder' && k ? 'closed' : undefined };
        const J = skeleton(v, p);
        if (v === 'side') p.hands = { N: [J.shN[0] + (name === 'elder' ? -3.6 : 0.6), J.shN[1] + (name === 'elder' ? 6.8 : 7.2)], F: [J.shF[0] - 0.4, J.shF[1] + 7.2] };
        else p.hands = name === 'merchant' && v === 'down'
          ? { R: [CX - 2.4, J.shR[1] + 7.4], L: [CX + 2.4, J.shL[1] + 7.4] } // hands folded on the belly
          : { R: [J.shR[0] - 0.7 * J.sg, J.shR[1] + 7.4], L: [J.shL[0] + (name === 'elder' ? 1.8 : 0.7) * J.sg, J.shL[1] + (name === 'elder' ? 6.2 : 7.4)] };
        return renderPose(look, dir, p);
      }), { fps: 2 });
      S[`npc_${name}_walk_${dir}`] = frames([0, 2, 4, 6].map((i) => {
        const p = walkPose(v, i, 8, { wind: 0.5, stride: name === 'elder' ? 0.6 : 0.85, arm: name === 'elder' ? 0.3 : 0.8 });
        p.scale = scale;
        if (name === 'elder') { const J = skeleton(v, p); if (v === 'side') p.hands.N = [J.shN[0] - 3.6, J.shN[1] + 6.8]; else p.hands.L = [J.shL[0] + 1.8 * J.sg, J.shL[1] + 6.2]; }
        return renderPose(look, dir, p);
      }), { fps: 7 });
    }
  }
  return S;
}
export { lerp };
