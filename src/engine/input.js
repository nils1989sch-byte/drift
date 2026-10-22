// Unified input: keyboard, gamepad and virtual (touch) controls map to the same actions.
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'attack', KeyJ: 'attack',
  KeyK: 'action', KeyE: 'action',
  KeyL: 'item', KeyQ: 'item',
  Enter: 'start', Escape: 'start', KeyP: 'start',
  Equal: 'zoomIn', NumpadAdd: 'zoomIn', BracketRight: 'zoomIn',
  Minus: 'zoomOut', NumpadSubtract: 'zoomOut', Slash: 'zoomOut', BracketLeft: 'zoomOut',
};
const ACTIONS = ['up', 'down', 'left', 'right', 'attack', 'action', 'item', 'start', 'zoomIn', 'zoomOut'];

export function createInput(target = window) {
  const keys = new Set();
  const virtual = new Set();
  const vAxis = { x: 0, y: 0 };
  let prev = new Set();
  let cur = new Set();
  const pulses = new Set(); // one-shot presses (wheel etc.)
  let lastDevice = 'keyboard';
  const listeners = [];

  target.addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code] || (e.key === '+' ? 'zoomIn' : e.key === '-' ? 'zoomOut' : null);
    if (!a) return;
    keys.add(a);
    lastDevice = 'keyboard';
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  target.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code] || (e.key === '+' ? 'zoomIn' : e.key === '-' ? 'zoomOut' : null);
    if (a) keys.delete(a);
  });
  target.addEventListener('blur', () => keys.clear());

  const input = {
    axis: { x: 0, y: 0 },
    get device() { return lastDevice; },
    down: (a) => cur.has(a),
    pressed: (a) => cur.has(a) && !prev.has(a),
    released: (a) => !cur.has(a) && prev.has(a),
    setVirtual(a, on) { lastDevice = 'touch'; on ? virtual.add(a) : virtual.delete(a); },
    setVirtualAxis(x, y) { lastDevice = 'touch'; vAxis.x = x; vAxis.y = y; },
    pulse(a) { pulses.add(a); },
    onAny(fn) { listeners.push(fn); },
    // call once per frame before game update
    poll() {
      prev = cur;
      cur = new Set([...keys, ...virtual, ...pulses]);
      pulses.clear();
      let gx = 0, gy = 0;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (!p) continue;
        if (Math.hypot(p.axes[0], p.axes[1]) > 0.25) { gx = p.axes[0]; gy = p.axes[1]; lastDevice = 'gamepad'; }
        const b = (i) => p.buttons[i]?.pressed;
        if (b(0)) cur.add('attack'); if (b(1)) cur.add('action'); if (b(2)) cur.add('item');
        if (b(9)) cur.add('start'); if (b(12)) cur.add('up'); if (b(13)) cur.add('down');
        if (b(14)) cur.add('left'); if (b(15)) cur.add('right');
        if (b(4)) cur.add('zoomOut'); if (b(5)) cur.add('zoomIn');
      }
      let x = (cur.has('right') ? 1 : 0) - (cur.has('left') ? 1 : 0) + gx + vAxis.x;
      let y = (cur.has('down') ? 1 : 0) - (cur.has('up') ? 1 : 0) + gy + vAxis.y;
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      input.axis.x = x; input.axis.y = y;
      if (cur.size && !prev.size) listeners.forEach((f) => f());
    },
    ACTIONS,
  };
  return input;
}
