// Touch controls (STYLE_GUIDE §8): floating analog stick bottom-left (Ø ≈ 22 % of the short side, dead zone),
// SNES-diamond buttons bottom-right (A = attack, B = action, Item), small Menu + Zoom ± top-right.
// DOM elements catch ONLY their own areas (pointer-events), visuals are drawn pixel-crisp on the UI canvas.
import { drawText } from './font.js';
import { C, disc } from './theme.js';

const DEAD = 0.2;

export function createTouch(U, root) {
  const layer = document.createElement('div');
  layer.className = 'drift-touch';
  Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '6', display: 'none',
    userSelect: 'none', webkitUserSelect: 'none', touchAction: 'none', webkitTouchCallout: 'none' });
  root.appendChild(layer);

  const mk = (name, round = true) => {
    const el = document.createElement('div');
    el.dataset.ctrl = name;
    Object.assign(el.style, { position: 'absolute', pointerEvents: 'auto', touchAction: 'none', borderRadius: round ? '50%' : '0',
      webkitTapHighlightColor: 'transparent', userSelect: 'none', webkitUserSelect: 'none' });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    el.addEventListener('dblclick', (e) => e.preventDefault());
    layer.appendChild(el);
    return el;
  };

  // ---- stick ----------------------------------------------------------------
  const zone = mk('stick', false);
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0, ax: 0, ay: 0, R: 48 }; // css px
  const setAxis = (x, y) => { stick.ax = x; stick.ay = y; U.input?.setVirtualAxis?.(x, y); };
  zone.addEventListener('pointerdown', (e) => {
    if (stick.id !== null) return;
    e.preventDefault();
    stick.id = e.pointerId;
    try { zone.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const R = stick.R;
    stick.ox = Math.max(R + 6, Math.min(innerWidth - R - 6, e.clientX));
    stick.oy = Math.max(R + 6, Math.min(innerHeight - R - 6, e.clientY));
    stick.x = e.clientX; stick.y = e.clientY;
    move(e);
  });
  function move(e) {
    if (e.pointerId !== stick.id) return;
    stick.x = e.clientX; stick.y = e.clientY;
    let dx = stick.x - stick.ox, dy = stick.y - stick.oy;
    const R = stick.R, len = Math.hypot(dx, dy);
    if (len > R * 1.35) { // drag the base along (floating stick)
      const k = (len - R * 1.35) / len; stick.ox += dx * k; stick.oy += dy * k;
      dx = stick.x - stick.ox; dy = stick.y - stick.oy;
    }
    const l2 = Math.hypot(dx, dy) / R;
    if (l2 < DEAD) { setAxis(0, 0); return; }
    const m = Math.min(1, (l2 - DEAD) / (1 - DEAD)) / (l2 || 1);
    setAxis((dx / R) * m, (dy / R) * m);
  }
  const endStick = (e) => { if (e.pointerId !== stick.id) return; stick.id = null; setAxis(0, 0); };
  zone.addEventListener('pointermove', move);
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);
  zone.addEventListener('lostpointercapture', endStick);

  // ---- buttons --------------------------------------------------------------
  const held = new Map(); // action -> {down, seen}
  function press(action) { held.set(action, { down: true, seen: false }); U.input?.setVirtual?.(action, true); }
  function release(action) { const h = held.get(action); if (!h) return; h.down = false; if (h.seen) { held.delete(action); U.input?.setVirtual?.(action, false); } }

  const buttons = [
    { id: 'A', action: 'attack', kind: 'hold', label: 'A' },
    { id: 'B', action: 'action', kind: 'hold', label: 'B' },
    { id: 'item', action: 'item', kind: 'hold', label: '' },
    { id: 'menu', action: 'start', kind: 'pulse', label: '≡' },
    { id: 'zin', action: 'zoomIn', kind: 'pulse', label: '+' },
    { id: 'zout', action: 'zoomOut', kind: 'pulse', label: '–' },
  ];
  for (const b of buttons) {
    b.el = mk(b.id);
    b.pointers = new Set();
    b.flash = 0;
    const down = (e) => {
      e.preventDefault();
      try { b.el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      b.pointers.add(e.pointerId);
      b.flash = 0.15;
      if (b.kind === 'pulse') { U.input?.pulse?.(b.action); return; }
      if (b.pointers.size === 1) press(b.action);
    };
    const up = (e) => {
      if (!b.pointers.delete(e.pointerId)) return;
      if (b.kind === 'hold' && b.pointers.size === 0) release(b.action);
    };
    b.el.addEventListener('pointerdown', down);
    b.el.addEventListener('pointerup', up);
    b.el.addEventListener('pointercancel', up);
    b.el.addEventListener('lostpointercapture', up);
  }
  const byId = Object.fromEntries(buttons.map((b) => [b.id, b]));

  // ---- layout (css px) --------------------------------------------------------
  let shown = false;
  function layout() {
    const cw = innerWidth, ch = innerHeight;
    const s = U.safeCss; // css px safe insets
    const short = Math.min(cw, ch);
    stick.R = Math.round(Math.max(46, short * 0.11));
    const rA = Math.round(Math.max(34, short * 0.085)), rB = Math.round(rA * 0.85), rI = Math.round(rA * 0.72);
    const off = Math.round(rA * 1.42);
    const dcx = cw - s.r - 14 - rA - off;
    const dcy = ch - s.b - 14 - rB - off;
    const set = (b, x, y, r) => {
      b.cx = x; b.cy = y; b.r = r;
      const hr = Math.max(22, r * 1.12); // hit radius ≥ 22 css px (44 px target)
      Object.assign(b.el.style, { left: `${x - hr}px`, top: `${y - hr}px`, width: `${hr * 2}px`, height: `${hr * 2}px` });
    };
    set(byId.A, dcx + off, dcy - Math.round(off * 0.15), rA);
    set(byId.B, dcx + Math.round(off * 0.1), dcy + off - Math.round(off * 0.1), rB);
    set(byId.item, dcx - Math.round(off * 0.75), dcy - Math.round(off * 0.55), rI);
    // menu/zoom row under the hearts (top-right)
    const hudBottom = s.t + (U.hudHeight * U.S) / U.dpr;
    const ry = Math.round(hudBottom + 10 + 22);
    const rs = 20;
    set(byId.menu, cw - s.r - 12 - rs, ry, rs);
    set(byId.zin, cw - s.r - 12 - rs - 50, ry, rs);
    set(byId.zout, cw - s.r - 12 - rs - 100, ry, rs);
    // stick zone: bottom-left, clear of the HUD and the button diamond
    const zTop = Math.max(hudBottom + 56, ch * 0.33);
    const zRight = Math.min(cw * 0.55, byId.item.cx - rI - 24);
    Object.assign(zone.style, { left: '0px', top: `${zTop}px`, width: `${Math.max(120, zRight)}px`, height: `${ch - zTop}px` });
    stick.home = { x: s.l + 24 + stick.R, y: ch - s.b - 28 - stick.R };
  }

  function setShown(v, mode = 'play') {
    const want = v ? mode : '';
    if (want === shown) return;
    shown = want;
    layer.style.display = v ? 'block' : 'none';
    const vis = { play: ['stick', 'A', 'B', 'item', 'menu', 'zin', 'zout'], dialog: ['A', 'B'], none: [] }[mode] || [];
    zone.style.display = vis.includes('stick') ? 'block' : 'none';
    for (const b of buttons) b.el.style.display = vis.includes(b.id) ? 'block' : 'none';
    if (!vis.includes('stick') && stick.id !== null) { stick.id = null; setAxis(0, 0); }
    if (!v) releaseAll();
  }
  function releaseAll() {
    for (const b of buttons) b.pointers.clear();
    for (const a of [...held.keys()]) { const h = held.get(a); h.seen = true; release(a); }
    if (stick.id !== null) { stick.id = null; }
    setAxis(0, 0);
  }
  addEventListener('blur', releaseAll);

  function update(dt) {
    for (const [a, h] of held) { if (h.down) h.seen = true; else { held.delete(a); U.input?.setVirtual?.(a, false); } }
    for (const b of buttons) b.flash = Math.max(0, b.flash - dt);
  }

  // ---- drawing (UI px) -----------------------------------------------------------
  const toUi = (v) => Math.round((v * U.dpr) / U.S);
  function drawBtn(ctx, b, label) {
    if (b.el.style.display === 'none') return;
    const r = Math.max(4, toUi(b.r));
    const cx = toUi(b.cx), cy = toUi(b.cy);
    const on = b.pointers.size > 0 || b.flash > 0;
    const d = disc(r, C.white, C.ink, 1);
    ctx.globalAlpha = on ? 0.55 : 0.3;
    ctx.drawImage(d, cx - r, cy - r);
    const inner = disc(Math.max(2, r - 2), C.white, C.stone_hi, 1);
    ctx.globalAlpha = on ? 0.25 : 0.12;
    ctx.drawImage(inner, cx - r + 2, cy - r + 2);
    ctx.globalAlpha = on ? 1 : 0.8;
    if (b.id === 'menu') {
      ctx.fillStyle = C.ink;
      for (let i = -1; i <= 1; i++) ctx.fillRect(cx - 4, cy + i * 3 - 1, 9, 2);
      ctx.fillStyle = C.white;
      for (let i = -1; i <= 1; i++) ctx.fillRect(cx - 4, cy + i * 3 - 2, 8, 1);
    } else if (label) {
      const sc = r >= 14 ? 2 : 1;
      drawText(ctx, label, cx, cy - Math.round(5.5 * sc) - (sc - 1), { align: 'center', scale: sc, color: C.white, outline: C.ink });
    }
    ctx.globalAlpha = 1;
  }
  function draw(ctx) {
    if (!shown) return;
    // stick
    if (zone.style.display !== 'none') {
      const R = toUi(stick.R);
      const active = stick.id !== null;
      const bx = toUi(active ? stick.ox : stick.home.x), by = toUi(active ? stick.oy : stick.home.y);
      const base = disc(R, C.night, C.white, 1);
      ctx.globalAlpha = active ? 0.4 : 0.22;
      ctx.drawImage(base, bx - R, by - R);
      // direction ticks
      ctx.globalAlpha = active ? 0.6 : 0.3;
      ctx.fillStyle = C.white;
      ctx.fillRect(bx - 1, by - R + 3, 2, 2); ctx.fillRect(bx - 1, by + R - 4, 2, 2);
      ctx.fillRect(bx - R + 3, by - 1, 2, 2); ctx.fillRect(bx + R - 4, by - 1, 2, 2);
      const kr = Math.max(4, Math.round(R * 0.46));
      const kx = bx + Math.round(stick.ax * R * 0.75), ky = by + Math.round(stick.ay * R * 0.75);
      const knob = disc(kr, C.white, C.ink, 1);
      ctx.globalAlpha = active ? 0.6 : 0.3;
      ctx.drawImage(knob, kx - kr, ky - kr);
      ctx.globalAlpha = 1;
    }
    drawBtn(ctx, byId.A, 'A');
    drawBtn(ctx, byId.B, 'B');
    const it = byId.item;
    drawBtn(ctx, it, U.game?.player?.item ? '' : '◆');
    if (it.el.style.display !== 'none' && U.game?.player?.item) {
      const ic = U.icon(U.game.player.item);
      if (ic) { ctx.globalAlpha = 0.9; U.drawIcon(ctx, ic, toUi(it.cx), toUi(it.cy), 16); ctx.globalAlpha = 1; }
    }
    drawBtn(ctx, byId.menu, '');
    drawBtn(ctx, byId.zin, '+');
    drawBtn(ctx, byId.zout, '–');
  }

  return { layout, update, draw, setShown, releaseAll, get shown() { return shown; }, layer, stick, buttons: byId };
}
