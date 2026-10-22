// HUD (ALttP-like layout per STYLE_GUIDE §8): item box top-left, counters top-middle, hearts top-right.
// Reads game.player every frame; hp counts half hearts (2 hp = 1 heart).
import { drawText, measure, LINE_H } from './font.js';
import { C, pxRect, rgba, clamp } from './theme.js';

const GOLD_ROWS = [C.gold_lt, C.gold_lt, C.gold_md, C.gold_md, C.gold_md, C.gold_dk, C.gold_dk];

export function createHUD(U) {
  const st = {
    rupees: null, bombs: null, keys: null, // displayed (counting) values
    lastHp: null, hurtT: 0, healT: 0, pulse: 0,
    area: null, areaT: 0, areaName: '', lastAreaSeen: undefined,
    toasts: [],
    visible: true,
  };

  function num(v, d = 0) { v = Number(v); return Number.isFinite(v) ? v : d; }

  function update(dt) {
    const g = U.game, p = g?.player;
    if (p) {
      const hp = num(p.hp), maxHp = num(p.maxHp, 6);
      if (st.lastHp != null && hp < st.lastHp) { st.hurtT = 0.45; U.haptic?.(hp <= 0 ? [60, 40, 90] : 35); }
      if (st.lastHp != null && hp > st.lastHp) st.healT = 0.4;
      st.lastHp = hp;
      st.low = maxHp > 2 && hp > 0 && (hp <= 2 || hp <= maxHp / 4);
      for (const k of ['rupees', 'bombs', 'keys']) {
        const target = num(p[k]);
        if (st[k] == null) st[k] = target;
        const diff = target - st[k];
        if (diff) st[k] += Math.sign(diff) * Math.max(1, Math.floor(Math.abs(diff) / 12));
      }
      // area-name banner when game.areaName changes
      const an = g.areaName ?? g.world?.name ?? null;
      if (an !== st.lastAreaSeen && g.state !== 'title' && !U.titleActive) {
        if (an) showArea(an);
        st.lastAreaSeen = an;
      }
    }
    st.hurtT = Math.max(0, st.hurtT - dt);
    st.healT = Math.max(0, st.healT - dt);
    st.pulse += dt;
    if (st.areaT > 0) st.areaT -= dt;
    for (const t of st.toasts) t.t -= dt;
    st.toasts = st.toasts.filter((t) => t.t > 0);
  }

  function showArea(name) { st.areaName = String(name); st.areaT = 3.2; }

  function toast(text, { id = null, time = 1.8 } = {}) {
    text = String(text);
    if (id) {
      const ex = st.toasts.find((t) => t.id === id);
      if (ex) { ex.text = text; ex.t = Math.max(ex.t, time - 0.2); ex.max = time; return; }
    }
    st.toasts.push({ text, t: time, max: time, id });
    if (st.toasts.length > 4) st.toasts.shift();
  }

  function iconBox(ctx, x, y, item) {
    pxRect(ctx, x, y, 22, 22, C.ink, 2);
    pxRect(ctx, x + 1, y + 1, 20, 20, C.frame, 1);
    ctx.fillStyle = C.frameDk; ctx.fillRect(x + 2, y + 19, 18, 1); ctx.fillRect(x + 19, y + 2, 1, 18);
    pxRect(ctx, x + 2, y + 2, 18, 18, C.ink, 0);
    ctx.fillStyle = rgba(C.night, 0.85); ctx.fillRect(x + 3, y + 3, 16, 16);
    const ic = item ? U.icon(item) : null;
    if (ic) U.drawIcon(ctx, ic, x + 11, y + 11, 16);
  }

  function counter(ctx, x, y, iconKey, value, digits) {
    const ic = U.icon(iconKey);
    let w = 0;
    if (ic) { U.drawIcon(ctx, ic, x + 4, y + 4, 8); w = 10; }
    const v = String(Math.max(0, Math.floor(value))).padStart(digits, '0');
    drawText(ctx, v, x + w, y - 2, { color: C.white, shadow: C.ink });
    return w + measure(v) + 1;
  }

  function counterW(digits) { return 10 + measure('0'.repeat(digits)) + 1; }

  function draw(ctx) {
    const g = U.game, p = g?.player;
    const { W, H } = U; const L = U.safe.l, T = U.safe.t, R = U.safe.r;
    if (!st.visible || !p || U.hideHud) { drawOverlays(ctx); return; }
    const top = T + 4;

    // item box
    const ix = L + 6;
    iconBox(ctx, ix, top, p.item ?? null);

    // counters
    const rd = Math.max(3, String(Math.floor(num(p.rupees))).length);
    const groups = [['rupee', st.rupees ?? 0, rd], ['bomb', st.bombs ?? 0, 2], ['key', st.keys ?? 0, 1]];
    const cw = groups.reduce((a, gq) => a + counterW(gq[2]), 0) + 8 * (groups.length - 1);
    const hearts = Math.max(1, Math.ceil(num(p.maxHp, 6) / 2));
    const narrow = W < 330;
    let cx = narrow ? ix + 28 : Math.floor(W / 2 - cw / 2);
    const cy = top + 7;
    for (const [k, v, d] of groups) cx += counter(ctx, cx, cy, k, v, d) + 8;

    // hearts
    const hf = U.icon('heart_full'), hh = U.icon('heart_half'), he = U.icon('heart_empty');
    const hw = (hf?.width || 8) <= 8 ? 8 : hf.width; // 8×8 grid
    const right = W - R - 6;
    const avail = right - (cx + 2);
    let perRow = clamp(Math.floor(avail / hw), 5, 10);
    const rows = Math.ceil(hearts / perRow);
    const rowW = Math.min(hearts, perRow) * hw;
    const hx0 = right - rowW;
    let hy = top + 1;
    if (rows === 1) {
      const lw = measure('- LEBEN -');
      drawText(ctx, '- LEBEN -', Math.min(hx0 + Math.floor(rowW / 2), right - Math.ceil(lw / 2)), top - 3, { align: 'center', color: C.heart_hi, shadow: C.ink });
      hy = top + 10;
    }
    const hp = num(p.hp);
    const shake = st.hurtT > 0 ? Math.round(Math.sin(st.hurtT * 60) * 1) : 0;
    const flash = st.hurtT > 0 && Math.floor(st.hurtT * 20) % 2 === 0;
    // index of the last (partly) filled heart for the low-health pulse
    const lastIdx = Math.ceil(hp / 2) - 1;
    for (let i = 0; i < hearts; i++) {
      const col = i % perRow, row = Math.floor(i / perRow);
      const x = hx0 + col * hw + shake, y = hy + row * (hw + 1);
      const fillv = hp - i * 2;
      const ic = fillv >= 2 ? hf : fillv === 1 ? hh : he;
      if (!ic) continue;
      let dy = 0;
      if (st.low && i === lastIdx) dy = Math.sin(st.pulse * 9) > 0.2 ? -1 : 0;
      if (st.healT > 0 && i === lastIdx) dy = -1;
      ctx.globalAlpha = flash && fillv > 0 ? 0.45 : 1;
      ctx.drawImage(ic, x + Math.floor((hw - ic.width) / 2), y + dy + Math.floor((hw - ic.height) / 2));
      ctx.globalAlpha = 1;
      if (st.low && i === lastIdx && Math.sin(st.pulse * 9) > 0.6) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35; ctx.drawImage(ic, x + Math.floor((hw - ic.width) / 2), y + dy + Math.floor((hw - ic.height) / 2)); ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    drawOverlays(ctx);
  }

  // low-health vignette, area banner, toasts
  function drawOverlays(ctx) {
    const { W, H } = U; const T = U.safe.t;
    if (st.low && !U.hideHud && U.game?.state !== 'title') {
      const a = 0.10 + 0.08 * Math.sin(st.pulse * 6);
      const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      gr.addColorStop(0, rgba(C.heart_dk, 0)); gr.addColorStop(1, rgba(C.heart_dk, a));
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    if (st.areaT > 0 && st.areaName) {
      const t = 3.2 - st.areaT;
      const a = clamp(Math.min(t / 0.45, st.areaT / 0.7), 0, 1);
      const sc = measure(st.areaName) * 2 + 40 <= W - 16 ? 2 : 1;
      const y = Math.floor(H * 0.26);
      const tw = measure(st.areaName) * sc;
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = C.night;
      ctx.fillRect(0, y - 4 * sc + 3, W, LINE_H * sc + 6 * sc - 4);
      ctx.globalAlpha = a;
      ctx.fillStyle = C.gold_md;
      const lw = Math.floor(clamp((t - 0.15) / 0.6, 0, 1) * (tw / 2 + 14));
      ctx.fillRect(Math.floor(W / 2 - lw - 8), y - 4 * sc + 3, lw * 2 + 16, 1);
      ctx.fillRect(Math.floor(W / 2 - lw - 8), y + LINE_H * sc + 2 * sc - 2, lw * 2 + 16, 1);
      drawText(ctx, st.areaName, Math.floor(W / 2), y, { align: 'center', scale: sc, color: GOLD_ROWS, outline: C.ink, shadow: C.shadow });
      ctx.globalAlpha = 1;
    }
    let ty = T + 32;
    for (const t of st.toasts) {
      const a = clamp(Math.min((t.max - t.t) / 0.15, t.t / 0.35), 0, 1);
      const w = measure(t.text) + 14;
      const x = Math.floor(U.W / 2 - w / 2);
      ctx.globalAlpha = a;
      pxRect(ctx, x, ty, w, 15, C.ink, 2);
      pxRect(ctx, x + 1, ty + 1, w - 2, 13, rgba(C.night, 0.95), 1);
      ctx.fillStyle = rgba(C.frame, 0.5); ctx.fillRect(x + 3, ty + 1, w - 6, 1);
      drawText(ctx, t.text, x + 7, ty + 1, { color: C.white, shadow: C.ink });
      ctx.globalAlpha = 1;
      ty += 18;
    }
  }

  return { update, draw, toast, showArea, st };
}
