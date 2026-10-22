// Castle soldier: kettle helmet with red plume, chainmail, blue tabard with brass trim, sword held forward.
import { frames } from '../core.js';
import { M } from './materials.js';
import { CX, FOOT } from './human.js';
import { flashCanvas } from './util.js';

const HELM_P = {
  down: { mass: null, ears: [], face: [0, 3.2, 5.6, 5.4], feat: 'down', back: [], front: [] },
  up: { mass: [0, 1, 6.4, 6.4], ears: [], face: null, back: [], front: [] },
  side: { mass: [1.6, 1, 5.6, 6], ears: [], face: [-2.4, 3.2, 5.0, 5.4], chin: 0.4, nose: [-6.9, 3.7], feat: 'side', back: [], front: [] },
};
function helmet(f, view, hc, pose, s) {
  const side = view === 'side', sx = side ? 0.8 : 0;
  // neck guard / cheek plates
  if (view === 'up') f.ell(hc[0], hc[1] + 3.6, 6.6, 4.2, M.chain, { flat: 0.1 });
  else if (side) f.ell(hc[0] + 3.4, hc[1] + 3.8, 3.8, 4.4, M.chain, { flat: 0.1 });
  else for (const k of [-1, 1]) f.ell(hc[0] + k * 5.4, hc[1] + 4, 1.8, 3.6, M.chain, { flat: 0.1 });
  // dome
  f.ell(hc[0] + sx, hc[1] - 2.6, 7.4, 6.6, M.steel, { clip: (x, y) => y + 0.5 < hc[1] + 0.6 });
  // ridge
  if (!side) f.limb(hc[0], hc[1] - 8.6, hc[0], hc[1] - 1, 0.9, 0.9, M.steel, { bias: 0.9 });
  else f.chain([[hc[0] - 5.4, hc[1] - 4, 0.9], [hc[0] - 1, hc[1] - 8.8, 0.9], [hc[0] + 4.6, hc[1] - 7.4, 0.9]], M.steel, { bias: 0.9 });
  // brim
  f.ell(hc[0] + sx, hc[1] + 0.2, side ? 9.4 : 9.2, 2.1, M.steel, { flat: 0.55, bias: -0.2 });
  for (let x = -8; x <= 8; x += 3) f.touch(hc[0] + sx + x, hc[1] - 0.4, { m: M.brass, t: 2 }); // rivets
  // shadow of the brim on the face
  if (view !== 'up') for (let x = -5; x <= 5; x++) f.touch(hc[0] + (side ? -2.4 : 0) + x, hc[1] + 2.4, f.matAt(hc[0] + (side ? -2.4 : 0) + x, hc[1] + 2.4) === M.skin ? { b: -1.2 } : {});
  void pose; void s;
}
export const SOLDIER = {
  id: 'soldier',
  skin: M.skin, eye: M.eye_brn, headP: { hair: M.steel, skin: M.skin, eye: M.eye_brn, brow: M.hair_blk, ...HELM_P, top: helmet },
  jacket: M.tabard, sleeve: M.chain, cuffMat: M.leather_dk, hemMat: M.chain,
  pants: M.pants, boot: M.leather_dk, belt: M.belt, pouch: false,
  scarf: false, shield: false, sheath: false,
  headTop(f, J, view) {
    const h = J.head;
    if (view === 'side') {
      f.chain([[h[0] - 1, h[1] - 8.6, 1.6], [h[0] + 2.5, h[1] - 10.6, 1.9], [h[0] + 6.4, h[1] - 10, 1.6], [h[0] + 9.4, h[1] - 7.4, 1.0]], M.plume, { flat: 0.3 });
    } else {
      f.chain([[h[0], h[1] - 8.6, 1.7], [h[0] + 0.3, h[1] - 10.8, 2.1], [h[0] + 0.1, h[1] - 12.4, 1.4]], M.plume, { flat: 0.2 });
      if (view === 'up') f.chain([[h[0], h[1] - 9, 1.6], [h[0], h[1] - 4, 1.5], [h[0] - 0.3, h[1] - 1, 1.1]], M.plume, { flat: 0.3, bias: -0.3 });
    }
  },
  deco(f, J, view) {
    // brass trim lines + emblem on the tabard
    const top = J.neck[1] + 1.2, bot = J.hip[1] - 1;
    if (view === 'side') return;
    const cx = J.neck[0];
    for (let y = Math.round(top + 1); y < bot - 2; y++) { f.touch(cx - 5.2, y, { m: M.brass, t: 2 }); f.touch(cx + 4.2, y, { m: M.brass, t: 1 }); }
    if (view === 'down') {
      f.ell(cx, top + 4.6, 1.9, 2.0, M.brass, { flat: 0.2 });
      f.touch(cx - 0.5, top + 4.3, { m: M.plume, t: 3 });
    }
  },
};

const D2R = Math.PI / 180;
export function buildSoldierHD(renderPose, walkPose, ATK, skeleton, viewOf) {
  const S = {};
  for (const dir of ['down', 'up', 'left', 'right']) {
    const v = viewOf(dir), A = ATK[v];
    const big = { w: 64, h: 64, ax: A.ax, ay: A.ay };
    const holdA = { down: 72, up: 280, side: 160 }[v];
    const hold = (pose, ang, reach = 5.2) => {
      const J = skeleton(v, pose);
      const c = Math.cos(ang * D2R), s = Math.sin(ang * D2R);
      if (v === 'side') {
        pose.hands = { ...(pose.hands || {}), F: [J.shF[0] + c * reach, J.shF[1] + s * reach * 0.85 + 2] };
        pose.sword = { a: ang, len: 14, behind: c > 0.2, farFront: c < -0.2 };
      } else {
        pose.hands = { ...(pose.hands || {}), R: [J.shR[0] + c * reach * 0.9, J.shR[1] + s * reach * 0.8 + 2] };
        pose.sword = { a: ang, len: 14, behind: v === 'down' ? s < -0.35 : s < -0.3 };
      }
      return pose;
    };
    S[`soldier_walk_${dir}`] = frames([0, 2, 4, 6].map((i) => renderPose(SOLDIER, dir, hold(walkPose(v, i, 8, { wind: 0, stride: 0.9 }), holdA), big)), { fps: 8 });
    S[`soldier_idle_${dir}`] = frames([0, 1].map((k) => renderPose(SOLDIER, dir, hold({ bob: k }, holdA), big)), { fps: 2 });
    S[`soldier_hurt_${dir}`] = frames([flashCanvas(S[`soldier_walk_${dir}`][0]), S[`soldier_walk_${dir}`][0]], { fps: 16 });
    const windA = { down: 200, up: 340, side: 280 }[v];
    S[`soldier_attack_${dir}`] = frames([
      renderPose(SOLDIER, dir, hold({ bob: 0, lean: v === 'side' ? 1 : 0, hdy: 0 }, windA, 4.4), big),
      renderPose(SOLDIER, dir, hold({ bob: 1, lean: v === 'side' ? -1.8 : 0, mouth: 'open', feet: v === 'side' ? { N: [CX - 3.4, FOOT, 0], F: [CX + 3.2, FOOT, 0] } : undefined }, holdA + (v === 'side' ? 15 : v === 'down' ? 18 : -18), 7.4), big),
    ], { fps: 8 });
  }
  return S;
}
