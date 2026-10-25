// Tastatur + Gamepads (Gamepad 1 → Spieler 1, Gamepad 2 → Spieler 2).
const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter']);

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.padPrev = [false, false];
    this.padPressed = [false, false];
    this.padStart = false;
    this.padStartPrev = false;
    addEventListener('keydown', (e) => {
      if (BLOCK.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
  }

  poll() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    this.pads = pads;
    let start = false;
    for (let i = 0; i < 2; i++) {
      const p = pads[i];
      const a = !!(p && (p.buttons[0]?.pressed || p.buttons[2]?.pressed));
      this.padPressed[i] = a && !this.padPrev[i];
      this.padPrev[i] = a;
      if (p && p.buttons[9]?.pressed) start = true;
    }
    this.padStart = start && !this.padStartPrev;
    this.padStartPrev = start;
  }

  any(codes) { return codes.some((c) => this.down.has(c)); }
  hit(codes) { return codes.some((c) => this.pressed.has(c)); }

  move(index, keys) {
    let x = (this.any(keys.right) ? 1 : 0) - (this.any(keys.left) ? 1 : 0);
    let z = (this.any(keys.down) ? 1 : 0) - (this.any(keys.up) ? 1 : 0);
    const p = this.pads?.[index];
    if (p) {
      const ax = p.axes[0] || 0, az = p.axes[1] || 0;
      if (Math.hypot(ax, az) > 0.2) { x += ax; z += az; }
      if (p.buttons[15]?.pressed) x += 1;
      if (p.buttons[14]?.pressed) x -= 1;
      if (p.buttons[13]?.pressed) z += 1;
      if (p.buttons[12]?.pressed) z -= 1;
    }
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    return { x, z };
  }

  grab(index, keys) { return this.hit(keys.grab) || this.padPressed[index]; }

  endFrame() { this.pressed.clear(); }
}
