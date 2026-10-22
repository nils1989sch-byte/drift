// Animation definitions (Animations-Agent). Data only – timing follows docs/STYLE_GUIDE.md §7
// (ALttP feel, min. 33 ms per frame).
//
// Entry per entity name → action:
//   ms:       number (every frame) | number[] (per frame). If the art delivers a different frame count, the array is
//             resampled so the TOTAL duration and relative event positions stay the same.
//   loop:     true = loop, false = once (then `done`, holds last frame)
//   events:   { frameIndex: 'name' | ['a','b'] } – fired when that frame is entered (index relative to `frames`)
//   frames:   expected frame count (for event/ms resampling; defaults to ms.length or 1)
//   dir:      false = sprite key has no direction suffix (hero_fall, slime_idle …); default: try both
//   fallback: list of other actions whose SPRITES are used if this action has none (timing/events stay this one's)
//   key:      explicit sprite-key base (instead of `${name}_${action}`)

export const MIN_MS = 33;
export const DEFAULT_DEF = { ms: 120, loop: true };

const fx = (n, ms) => ({ ms: Array(n).fill(ms), loop: false, dir: false });

export const ANIM_DEFS = {
  hero: {
    idle:     { ms: [600, 600], loop: true },
    walk:     { ms: Array(6).fill(90), loop: true, events: { 0: 'step', 3: 'step' } },
    attack:   { ms: [40, 40, 50, 60, 80], loop: false, events: { 0: 'swing', 2: 'hit' }, fallback: ['idle'] },
    spin:     { ms: Array(8).fill(40), loop: false, dir: false, events: { 0: 'hit', 2: 'hit', 4: 'hit', 6: 'hit' }, fallback: ['attack', 'idle'] },
    charge:   { ms: [80, 80], loop: true, fallback: ['attack', 'idle'] },
    hurt:     { ms: [60, 60], loop: true, fallback: ['idle'] },
    lift:     { ms: [80, 80, 80], loop: false, events: { 2: 'lifted' }, fallback: ['idle'] },
    carry:    { ms: Array(4).fill(110), loop: true, events: { 0: 'step', 2: 'step' }, fallback: ['walk', 'idle'] },
    carry_idle: { ms: [600], loop: true, key: 'hero_carry', fallback: ['idle'] },
    throw:    { ms: [60, 120], loop: false, events: { 0: 'release' }, fallback: ['attack', 'idle'] },
    push:     { ms: Array(4).fill(130), loop: true, events: { 0: 'step', 2: 'step' }, fallback: ['walk'] },
    item_get: { ms: [1200], loop: false, dir: false, fallback: ['idle'] },
    fall:     { ms: [120, 120, 120, 120], loop: false, dir: false, fallback: ['hurt', 'idle'] },
    dead:     { ms: [150, 150, 900], loop: false, dir: false, fallback: ['hurt', 'idle'] },
    swim:     { ms: Array(4).fill(130), loop: true, events: { 0: 'stroke' }, fallback: ['walk'] },
  },
  octorok: {
    walk:   { ms: [150, 150], loop: true },
    idle:   { ms: [300, 300], loop: true, fallback: ['walk'] },
    attack: { ms: [90, 90, 200], loop: false, frames: 3, events: { 1: 'shoot' }, fallback: ['walk'] },
    hurt:   { ms: [60, 60], loop: true, fallback: ['walk'] },
  },
  octorok_rock: { idle: { ms: [70, 70], loop: true, dir: false, key: 'octorok_rock' } },
  soldier: {
    walk:   { ms: Array(4).fill(125), loop: true, events: { 0: 'step', 2: 'step' } },
    idle:   { ms: [500], loop: true, fallback: ['walk'] },
    attack: { ms: [120, 260], loop: false, events: { 1: 'hit' }, fallback: ['walk'] },
    hurt:   { ms: [60, 60], loop: true, fallback: ['walk'] },
  },
  slime: {
    idle: { ms: [180, 180, 180], loop: true, dir: false, events: { 1: 'hop' } },
    walk: { ms: [140, 140, 140], loop: true, dir: false, fallback: ['idle'] },
    hurt: { ms: [60, 60], loop: true, dir: false, fallback: ['idle'] },
  },
  bat: {
    fly:  { ms: [80, 80], loop: true, dir: false, events: { 0: 'flap' } },
    idle: { ms: [80, 80], loop: true, dir: false, fallback: ['fly'] },
    hurt: { ms: [60, 60], loop: true, dir: false, fallback: ['fly'] },
  },
  boss_golem: {
    idle:   { ms: [420, 420], loop: true, dir: false, events: { 0: 'stomp' } },
    walk:   { ms: [260, 260], loop: true, dir: false, events: { 0: 'stomp', 1: 'stomp' }, fallback: ['idle'] },
    attack: { ms: [360, 90, 520], loop: false, dir: false, events: { 1: 'hit' }, fallback: ['idle'] },
    hurt:   { ms: [70, 70], loop: true, dir: false, fallback: ['idle'] },
  },
  npc_elder:    { idle: { ms: [500, 500], loop: true } },
  npc_girl:     { idle: { ms: [500, 500], loop: true } },
  npc_merchant: { idle: { ms: [500, 500], loop: true } },

  // objects (sprite key = name itself)
  flower:      { idle: { ms: [320, 320, 320], loop: true, dir: false, key: 'flower' } },
  torch:       { idle: { ms: [90, 90, 90, 90], loop: true, dir: false, key: 'torch' } },
  bomb:        { idle: { ms: [80, 80, 80], loop: true, dir: false, key: 'bomb' } },
  rupee_green: { idle: { ms: [600, 120, 120, 120], loop: true, dir: false, key: 'rupee_green' } },
  rupee_blue:  { idle: { ms: [600, 120, 120, 120], loop: true, dir: false, key: 'rupee_blue' } },
  rupee_red:   { idle: { ms: [600, 120, 120, 120], loop: true, dir: false, key: 'rupee_red' } },
  heart_container: { idle: { ms: [400, 120], loop: true, dir: false, key: 'heart_container' } },
  water_lily:  { idle: { ms: [700, 700], loop: true, dir: false, key: 'lilypad' } },

  // effects (usually driven by createFX, listed for the demo / direct use)
  fx_slash:     { idle: { ms: [40, 40, 40], loop: false, key: 'fx_slash' } },
  fx_poof:      { idle: fx(5, 60) },
  fx_spark:     { idle: fx(3, 40) },
  fx_splash:    { idle: fx(4, 70) },
  fx_dust:      { idle: fx(3, 70) },
  fx_sparkle:   { idle: fx(4, 70) },
  fx_explosion: { idle: fx(6, 60) },
  fx_heart_pop: { idle: fx(3, 80) },
};

// Per-entity fallback for actions not listed above (e.g. 'tree' → static).
export const GENERIC_FALLBACK = ['idle', 'walk', 'fly'];

// FX timing used by createFX (ms per frame / particle life in seconds).
export const FX_TIMING = {
  slash: 40, poof: 60, spark: 40, splash: 70, dust: 70, sparkle: 70, explosion: 60, heart_pop: 80,
  leafLife: [0.6, 0.9], grassLife: [0.45, 0.7], rockLife: [0.6, 0.9],
};

// Gameplay timing hints (seconds) from the style guide – exported so gameplay uses the same numbers.
export const TIMING = {
  hitstop: 0.05,        // 2–3 frames freeze on hit
  knockback: 0.22,      // 200–250 ms
  knockbackDist: 20,    // px
  invuln: 1.0,          // i-frames after hurt
  blinkHz: 10,
  flash: 0.12,          // white flash after being hit
  itemGetHold: 1.2,
  walkSpeed: 85,        // px/s
};
