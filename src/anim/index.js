// Animation module (Animations-Agent): Animator, FX, easing/tweens and juice helpers.
// See docs/ANIMATION.md for the API.
export { Animator } from './animator.js';
export { createFX, drawPixelText, FX_COLORS } from './fx.js';
export { ease, tween, createTweens, lerp, clamp } from './tween.js';
export {
  Wobble, Squash, HitFlash, Blink, Knockback, HitStop, Hop,
  drawWobble, drawSquash, itemGetArc, dropArc, bob, chestPop, pulse, shake,
} from './juice.js';
export { ANIM_DEFS, TIMING, FX_TIMING } from './defs.js';
