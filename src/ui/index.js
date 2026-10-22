// DRIFT UI (UI-Agent): overlay canvas in device pixels with integer UI scale, HUD, dialogs, title / pause /
// game-over screens, touch controls, toasts. Contract: docs/ARCHITECTURE.md (UI-Vertrag), details: docs/UI.md.
import { createHUD } from './hud.js';
import { createDialog } from './dialog.js';
import { createScreens, fmtZoom } from './screens.js';
import { createTouch } from './touch.js';
import { getIcon } from './icons.js';
import { applyPalette } from './theme.js';

export { drawText, measure, wrap, rasterize, buildFontAtlas, LINE_H } from './font.js';

const HUD_H = 28; // logical HUD height incl. margin (UI px)

export function createUI({ root, input, assets, sfx, camera } = {}) {
  root = root || document.getElementById('app') || document.body;
  try { applyPalette(assets?.palette); } catch { /* ignore */ }
  const params = new URLSearchParams(location.search);

  // ---- DOM: overlay canvas, modal tap layer, safe-area probe ---------------------------------
  const canvas = document.createElement('canvas');
  canvas.className = 'drift-ui';
  Object.assign(canvas.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none',
    zIndex: '4', imageRendering: 'pixelated' });
  root.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const modalEl = document.createElement('div');
  modalEl.className = 'drift-modal';
  Object.assign(modalEl.style, { position: 'fixed', inset: '0', zIndex: '5', pointerEvents: 'none', touchAction: 'none',
    userSelect: 'none', webkitUserSelect: 'none', webkitTapHighlightColor: 'transparent' });
  root.appendChild(modalEl);

  const probe = document.createElement('div');
  Object.assign(probe.style, { position: 'fixed', left: '0', top: '0', width: '0', height: '0', visibility: 'hidden', pointerEvents: 'none',
    paddingTop: 'env(safe-area-inset-top)', paddingRight: 'env(safe-area-inset-right)',
    paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)' });
  root.appendChild(probe);

  // ---- shared UI context ----------------------------------------------------------------------
  let hits = [];
  const modals = new Set();
  let navHold = { y: 0, x: 0, t: 0 }, navOut = { x: 0, y: 0 }, axisPrev = { x: 0, y: 0 };
  let soundOn = true;
  try { soundOn = localStorage.getItem('drift.sound') !== '0'; } catch { /* ignore */ }
  try { if (!soundOn) sfx?.setVolume?.(0); } catch { /* ignore */ }

  const U = {
    W: 320, H: 240, S: 1, dpr: 1, safe: { l: 0, t: 0, r: 0, b: 0 }, safeCss: { l: 0, t: 0, r: 0, b: 0 },
    assets, input, sfx, camera, game: null, time: 0, hudHeight: HUD_H, hideHud: false,
    touchMode: params.get('touch') === '1' || (params.get('touch') !== '0' && !!(window.matchMedia?.('(pointer: coarse)').matches && navigator.maxTouchPoints > 0)),
    get soundOn() { return soundOn; },
    get titleActive() { return screens?.title.active; },
    setSound(v) {
      soundOn = !!v;
      try { sfx?.setVolume?.(soundOn ? 1 : 0); } catch { /* ignore */ }
      try { localStorage.setItem('drift.sound', soundOn ? '1' : '0'); } catch { /* ignore */ }
    },
    renderer: () => window.__drift?.renderer || null,
    icon: (k) => getIcon(assets, k),
    drawIcon(c, ic, cx, cy, box) {
      const m = Math.max(ic.width, ic.height);
      let s = m * 2 <= box + 2 ? 2 : 1;
      if (m > box * 1.25) s = box / m;
      const w = Math.round(ic.width * s), h = Math.round(ic.height * s);
      c.drawImage(ic, Math.floor(cx - w / 2), Math.floor(cy - h / 2), w, h);
    },
    hit(x, y, w, h, fn, prio = 0) { hits.push({ x, y, w, h, fn, prio }); },
    nav: () => navOut,
    confirmPressed: () => !!(input?.pressed?.('attack') || input?.pressed?.('action')),
    haptic(p) { try { if (U.touchMode && navigator.vibrate) navigator.vibrate(p); } catch { /* ignore */ } },
    onModal(on, kind) {
      if (on) modals.add(kind); else modals.delete(kind);
      modalEl.style.pointerEvents = modals.size ? 'auto' : 'none';
      syncTouch();
      syncState(on, kind);
    },
  };

  const hud = createHUD(U);
  const dialog = createDialog(U);
  const screens = createScreens(U);
  const touch = createTouch(U, root);

  // game.state sync for dialog (pause handled in screens)
  let dlgPrev = null;
  function syncState(on, kind) {
    const g = U.game; if (!g || kind !== 'dialog') return;
    try {
      if (on) { dlgPrev = g.state; if (g.state === 'play') g.state = 'dialog'; }
      else if (g.state === 'dialog' && dlgPrev === 'play') g.state = 'play';
    } catch { /* ignore */ }
  }

  function syncTouch() {
    if (!touch) return;
    if (!U.touchMode) { touch.setShown(false); return; }
    const m = modals.has('title') || modals.has('pause') || modals.has('gameover') ? 'none' : modals.has('dialog') ? 'none' : 'play';
    touch.setShown(true, m);
  }
  function setTouchMode(v) {
    if (U.touchMode === v) return;
    U.touchMode = v;
    syncTouch();
  }

  // input-device detection
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') setTouchMode(true);
  }, true);
  window.addEventListener('keydown', (e) => { if (!e.repeat && params.get('touch') !== '1') setTouchMode(false); }, true);

  // modal taps (title, menus, dialog advance)
  modalEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sfx?.unlock?.();
    const x = (e.clientX * U.dpr) / U.S, y = (e.clientY * U.dpr) / U.S;
    let best = null;
    for (const h of hits) if (x >= h.x && y >= h.y && x < h.x + h.w && y < h.y + h.h && (!best || h.prio >= best.prio)) best = h;
    if (best) { try { best.fn(); } catch (err) { console.error('[ui] tap handler', err); } }
    else if (dialog.active) dialog.tapAnywhere();
  });
  modalEl.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  modalEl.addEventListener('contextmenu', (e) => e.preventDefault());

  function readSafe() {
    try {
      const cs = getComputedStyle(probe);
      return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    } catch { return { t: 0, r: 0, b: 0, l: 0 }; }
  }

  function resize(w, h, dpr) {
    dpr = dpr || Math.min(window.devicePixelRatio || 1, 3);
    w = Math.max(1, Math.floor(w || innerWidth * dpr)); h = Math.max(1, Math.floor(h || innerHeight * dpr));
    canvas.width = w; canvas.height = h;
    const short = Math.min(w, h);
    let S = +params.get('uiscale') || Math.max(1, Math.round(short / 260));
    while (S > 1 && short / S < 200) S--;
    U.S = S; U.dpr = dpr;
    U.W = Math.floor(w / S); U.H = Math.floor(h / S);
    const sc = readSafe();
    U.safeCss = sc;
    const k = dpr / S;
    U.safe = { l: Math.ceil(sc.l * k), t: Math.ceil(sc.t * k), r: Math.ceil(sc.r * k), b: Math.ceil(sc.b * k) };
    touch.layout();
  }

  function computeNav(dt) {
    let y = 0, x = 0;
    if (input?.pressed?.('up')) y = -1; else if (input?.pressed?.('down')) y = 1;
    if (input?.pressed?.('left')) x = -1; else if (input?.pressed?.('right')) x = 1;
    // analog (gamepad / virtual) edges + auto-repeat for held directions
    const ax = input?.axis?.x || 0, ay = input?.axis?.y || 0;
    const dy = Math.abs(ay) > 0.6 ? Math.sign(ay) : 0, dx = Math.abs(ax) > 0.6 ? Math.sign(ax) : 0;
    const pdy = Math.abs(axisPrev.y) > 0.6 ? Math.sign(axisPrev.y) : 0, pdx = Math.abs(axisPrev.x) > 0.6 ? Math.sign(axisPrev.x) : 0;
    if (!y && dy && dy !== pdy) y = dy;
    if (!x && dx && dx !== pdx) x = dx;
    axisPrev = { x: ax, y: ay };
    if ((dy || dx) && (dy === navHold.y && dx === navHold.x)) {
      navHold.t += dt;
      if (navHold.t > 0.38) { navHold.t -= 0.11; if (!y) y = dy; if (!x) x = dx; }
    } else navHold = { y: dy, x: dx, t: 0 };
    return { x, y };
  }

  let lastState, lastZoom = null, pauseCooldown = 0;

  const ui = {
    canvas, U,
    bind(game) {
      U.game = game || null;
      if (game && game.state === 'title' && !screens.title.active && params.get('notitle') == null) {
        screens.showTitle(() => game.start?.());
      } else if (params.get('title') === '1' && !screens.title.active) screens.showTitle(() => game?.start?.());
      lastState = game?.state;
    },
    resize,
    get blocking() { return modals.size > 0; },
    get scale() { return U.S; },
    get touchMode() { return U.touchMode; },
    set touchMode(v) { setTouchMode(!!v); },
    get hideHud() { return U.hideHud; },
    set hideHud(v) { U.hideHud = !!v; },

    update(dt = 1 / 60) {
      try {
        U.time += dt;
        navOut = computeNav(dt);
        const g = U.game;
        // state edges from the game: title / gameover
        const s = g?.state;
        if (s !== lastState) {
          if (s === 'title' && !screens.title.active) screens.showTitle(() => g.start?.());
          if (s === 'gameover' && !screens.over.active) screens.showGameOver(null);
          lastState = s;
        }
        pauseCooldown = Math.max(0, pauseCooldown - dt);
        const wasBlocking = modals.size > 0;
        if (screens.title.active || screens.over.active || screens.pause.active) screens.update(dt);
        else if (dialog.active) dialog.update(dt);
        else if (!wasBlocking && pauseCooldown <= 0 && input?.pressed?.('start') && (s === 'play' || s == null || s === undefined) && g) {
          screens.openPause();
        }
        if (wasBlocking && modals.size === 0) pauseCooldown = 0.1;
        hud.update(dt);
        touch.update(dt);
        // zoom toast
        const z = camera?.target;
        if (z != null) {
          if (lastZoom != null && Math.abs(z - lastZoom) > 1e-3 && !screens.title.active) hud.toast(`Zoom ${fmtZoom(z)}`, { id: 'zoom', time: 1.2 });
          lastZoom = z;
        }
      } catch (e) { console.error('[ui] update', e); }
    },

    draw() {
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(U.S, 0, 0, U.S, 0, 0);
        ctx.imageSmoothingEnabled = false;
        hits = [];
        const hudOff = screens.title.active || screens.over.active;
        if (!hudOff) hud.draw(ctx);
        touch.draw(ctx);
        dialog.draw(ctx);
        screens.draw(ctx);
      } catch (e) { console.error('[ui] draw', e); }
    },

    dialog(lines, opts) { return dialog.open(lines, opts); },
    toast(text, opts) { hud.toast(text, opts); },
    showArea(name) { hud.showArea(name); },
    showTitle(onStart) { screens.showTitle(onStart); },
    showGameOver(onRetry) { screens.showGameOver(onRetry); },
    openPause() { screens.openPause(); },
    closePause() { screens.closePause(); },
    closeDialog() { dialog.close(); },
    get state() {
      return screens.title.active ? 'title' : screens.over.active ? 'gameover' : screens.pause.active ? 'pause' : dialog.active ? 'dialog' : 'hud';
    },
  };

  resize(innerWidth * Math.min(window.devicePixelRatio || 1, 3), innerHeight * Math.min(window.devicePixelRatio || 1, 3));
  syncTouch();
  return ui;
}
