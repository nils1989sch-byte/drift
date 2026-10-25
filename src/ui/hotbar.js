// Hotbar (8 slots) at the bottom: icons icon_*, active slot, stack counts.
// PC: digits 1–8 select (outside battle), Q/L cycles via the game (farm.cycleHotbar); touch: tap a slot.
import { drawText, measure } from './font.js';
import { C, plaque, rgba, pxRect } from './theme.js';
import { hotbar, hotbarSelect, itemId, itemName, itemCount, inventory } from './data.js';

import { drawItemIcon } from './monui.js';

export function createHotbar(U, root) {
  const st = { rect: null, nameT: 0, lastActive: -1, hidden: false };
  // DOM hit area (only exists while the hotbar is visible and no modal is open)
  const el = document.createElement('div');
  el.className = 'drift-hotbar';
  Object.assign(el.style, { position: 'fixed', left: '0', top: '0', width: '0', height: '0', zIndex: '6', pointerEvents: 'auto',
    touchAction: 'none', display: 'none', userSelect: 'none', webkitUserSelect: 'none', webkitTapHighlightColor: 'transparent' });
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = st.rect; if (!r) return;
    const x = (e.clientX * U.dpr) / U.S - r.x;
    const i = Math.floor(x / r.step);
    if (i >= 0 && i < 8) { hotbarSelect(U.game, i); U.sfx?.play?.('menu_move'); }
  });
  el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  root.appendChild(el);

  // digits 1–8 outside battle (input.js maps only 1/2 → skill3/4, so the hotbar listens itself)
  addEventListener('keydown', (e) => {
    const m = /^Digit([1-8])$/.exec(e.code);
    if (!m || e.repeat || U.blocking() || U.game?.battle?.active || !inventory(U.game)) return;
    hotbarSelect(U.game, +m[1] - 1);
  });

  function visible() {
    const g = U.game;
    return !!inventory(g) && !g?.battle?.active && !U.blocking() && !U.hideHud && g?.state !== 'title';
  }

  function update() {
    const g = U.game;
    // Q/L cycling belongs to the game (farm.cycleHotbar); the UI only selects directly (digits / taps)
    const hb = hotbar(g);
    if (hb.active !== st.lastActive) { if (st.lastActive >= 0) st.nameT = 1.6; st.lastActive = hb.active; }
    st.nameT = Math.max(0, st.nameT - 1 / 60);
  }

  function layout() {
    const { W, H, safe } = U;
    const slot = W >= 300 ? 24 : 22, gap = 2;
    const w = slot * 8 + gap * 7 + 6;
    let y = H - safe.b - slot - 9;
    // touch portrait: the bottom edge belongs to stick + buttons → float above them
    if (U.touchMode && U.controlsTop != null && W < 380) y = Math.min(y, U.controlsTop - slot - 12);
    else if (U.touchMode && U.controlsTop != null && W >= 380) y = H - safe.b - slot - 9; // landscape: centre gap is free
    const x = Math.floor(W / 2 - w / 2);
    return { x, y, w, h: slot + 6, slot, gap, step: slot + gap };
  }

  function syncDom(r, on) {
    const want = on && U.touchMode;
    if (!want) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
    const k = U.S / U.dpr;
    const css = { left: `${r.x * k}px`, top: `${r.y * k}px`, width: `${r.w * k}px`, height: `${r.h * k}px` };
    for (const [p, v] of Object.entries(css)) if (el.style[p] !== v) el.style[p] = v;
    if (el.style.display !== 'block') el.style.display = 'block';
  }

  function draw(ctx) {
    const on = visible();
    const r = layout();
    st.rect = { x: r.x + 3, y: r.y, step: r.step };
    syncDom(r, on);
    if (!on) return;
    const hb = hotbar(U.game);
    plaque(ctx, r.x, r.y, r.w, r.h, 0.45);
    for (let i = 0; i < 8; i++) {
      const x = r.x + 3 + i * r.step, y = r.y + 3;
      const it = hb.slots[i];
      const act = i === hb.active;
      pxRect(ctx, x, y, r.slot, r.slot, act ? C.hair : rgba(C.ink, 0.55), 2);
      pxRect(ctx, x + 1, y + 1, r.slot - 2, r.slot - 2, rgba(act ? '#3a3040' : C.plaque, act ? 0.85 : 0.55), 1);
      if (it) {
        drawItemIcon(U, ctx, itemId(it), x + r.slot / 2, y + r.slot / 2, r.slot - 4);
        const n = itemCount(it);
        if (n > 1) drawText(ctx, String(n), x + r.slot - 1, y + r.slot - 10, { align: 'right', color: C.ivory, outline: C.ink });
      }
      if (!U.touchMode && r.slot >= 22) drawText(ctx, String(i + 1), x + 2, y - 1, { color: act ? C.plaque : rgba(C.ivory, 0.55), shadow: null, alpha: act ? 0 : 0.8 });
    }
    // active item name (fades after switching)
    const it = hb.slots[hb.active];
    if (it && st.nameT > 0) {
      const name = itemName(it);
      const w = measure(name) + 12;
      ctx.globalAlpha = Math.min(1, st.nameT / 0.3);
      plaque(ctx, Math.floor(U.W / 2 - w / 2), r.y - 16, w, 13, 0.6);
      drawText(ctx, name, Math.floor(U.W / 2), r.y - 16, { align: 'center', color: C.ivory, shadow: C.ink });
      ctx.globalAlpha = 1;
    }
  }

  return { update, draw, layout, get rect() { return st.rect; } };
}
