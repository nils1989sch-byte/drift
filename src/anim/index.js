// STUB (Regie) – wird vom Animations-Agenten ersetzt.
export class Animator {
  constructor(assets, name) { this.assets = assets; this.name = name; this.action = 'idle'; this.dir = 'down'; this.t = 0; }
  play(action, dir = this.dir) { this.action = action; this.dir = dir; }
  update(dt) { this.t += dt; }
  get frame() { const s = this.assets.sprites; return (s[`${this.name}_${this.action}_${this.dir}`] || s[`${this.name}_idle_down`] || [])[0]; }
  get done() { return true; }
  get event() { return null; }
}
export function createFX() { return { spawn() {}, update() {}, drawables: () => [] }; }
export const ease = { linear: (t) => t };
