// HUD (ALttP-like layout per STYLE_GUIDE §8): item box top-left, counters top-middle, hearts top-right.
// Reads game.player every frame; hp counts half hearts (2 hp = 1 heart).
import { drawText, measure, ASC } from './font.js';
import { C, rgba, clamp, plaque } from './theme.js';
import { leadMon, monName, monLevel, monHp, monMaxHp, money, fmtMoney, clockInfo, countOf, inventory } from './data.js';
import { hpBar, animHp, drawPortrait, drawItemIcon } from './monui.js';

const AREA_T = 3.0;
const IVORY_ROWS = ['#fffaf0', '#fffaf0', C.ivory, C.ivory, '#e8dcc0', '#dccca8', '#d0bc94'];

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
      if (monsterMode(g)) st.low = false; // hero hearts are gone in DESIGN 2.0
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

  function showArea(name) { st.areaName = String(name); st.areaT = AREA_T; }

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
    plaque(ctx, x, y, 20, 20, 0.42);
    const ic = item ? U.icon(item) : null;
    if (ic) U.drawIcon(ctx, ic, x + 10, y + 10, 16);
  }

  function counter(ctx, x, y, iconKey, value, digits) {
    const ic = U.icon(iconKey);
    let w = 0;
    if (ic) { U.drawIcon(ctx, ic, x + 4, y + 4, 8); w = 10; }
    const v = String(Math.max(0, Math.floor(value))).padStart(digits, '0');
    drawText(ctx, v, x + w, y - 2, { color: C.ivory, shadow: C.ink });
    return w + measure(v) + 1;
  }

  function counterW(digits) { return 10 + measure('0'.repeat(digits)) + 1; }

  function draw(ctx) {
    const g = U.game, p = g?.player;
    const { W, H } = U; const L = U.safe.l, T = U.safe.t, R = U.safe.r;
    if (!st.visible || U.hideHud) { drawOverlays(ctx); return; }
    if (monsterMode(g)) { if (!g.battle?.active) drawMonsterHud(ctx); drawOverlays(ctx); return; }
    if (!p) { drawOverlays(ctx); return; }
    const top = T + 4;

    // item box
    const ix = L + 6;
    const hasItem = !!p.item && !!U.icon(p.item);
    if (hasItem) iconBox(ctx, ix, top, p.item); // empty box stays hidden until an item is equipped

    // counters
    const rd = Math.max(3, String(Math.floor(num(p.rupees))).length);
    const groups = [['rupee', st.rupees ?? 0, rd], ['bomb', st.bombs ?? 0, 2], ['key', st.keys ?? 0, 1]];
    const cw = groups.reduce((a, gq) => a + counterW(gq[2]), 0) + 8 * (groups.length - 1);
    const hearts = Math.max(1, Math.ceil(num(p.maxHp, 6) / 2));
    const narrow = W < 330;
    let cx = narrow ? (hasItem ? ix + 27 : ix + 5) : Math.floor(W / 2 - cw / 2);
    const cy = top + 7;
    plaque(ctx, cx - 4, top + 4, cw + 8, 13, 0.4);
    for (const [k, v, d] of groups) cx += counter(ctx, cx, cy, k, v, d) + 8;

    // hearts
    const hf = U.icon('heart_full'), hh = U.icon('heart_half'), he = U.icon('heart_empty');
    const base = (hf?.width || 8) <= 8 ? 8 : hf.width; // 8×8 grid
    const right = W - R - 6;
    const avail = right - (cx + 2);
    // wide screens (landscape / desktop): hearts one step larger (2×) if a full row fits; portrait stays 1×
    const hs = W > H && W >= 400 && avail >= Math.min(hearts, 10) * base * 2 + 4 ? 2 : 1;
    const hw = base * hs;
    let perRow = clamp(Math.floor(avail / hw), 5, 10);
    const rows = Math.ceil(hearts / perRow);
    const rowW = Math.min(hearts, perRow) * hw;
    const hx0 = right - rowW;
    let hy = top + 1;
    const lw = measure('LEBEN');
    const pw = Math.max(rowW, rows === 1 ? lw : 0) + 10;
    const ph = rows === 1 ? 13 + hw : rows * (hw + 1) + 5;
    plaque(ctx, right - pw + 5, top, pw, ph, 0.4);
    U.hudHeight = Math.max(28, top - T + ph + 2);
    if (rows === 1) {
      drawText(ctx, 'LEBEN', right + 5 - Math.floor(pw / 2), top - 1, { align: 'center', color: C.ivoryDim, shadow: C.ink });
      hy = top + 10;
    } else hy = top + 2;
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
      const iw = ic.width * hs, ih = ic.height * hs;
      ctx.drawImage(ic, x + Math.floor((hw - iw) / 2), y + dy * hs + Math.floor((hw - ih) / 2), iw, ih);
      ctx.globalAlpha = 1;
      if (st.low && i === lastIdx && Math.sin(st.pulse * 9) > 0.6) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35; ctx.drawImage(ic, x + Math.floor((hw - ic.width * hs) / 2), y + dy * hs + Math.floor((hw - ic.height * hs) / 2), ic.width * hs, ic.height * hs); ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    drawOverlays(ctx);
  }

  // Octopath-like location title: crisp 2× pixel font, dark contour (no box), fine ornament lines left/right.
  // Fade 0.4 s in, hold 2 s, 0.6 s out (st.areaT counts down from AREA_T).
  function drawAreaTitle(ctx) {
    const { W, H } = U;
    const t = AREA_T - st.areaT;
    const a = clamp(Math.min(t / 0.4, st.areaT / 0.6), 0, 1);
    const name = st.areaName;
    const sc = measure(name) * 2 + 90 <= W - 16 ? 2 : 1;
    const tw = measure(name) * sc;
    const y = Math.floor(H * 0.2);
    const midY = y + (ASC + 3) * sc; // optical middle of the caps
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * a;
    // ornaments: hairline fading outward, small diamond + dot at the inner end
    const gap = 6 + sc * 2, len = Math.max(0, Math.min(56, Math.floor((W - tw) / 2) - gap - 10));
    const grow = clamp(t / 0.6, 0, 1);
    const L = Math.floor(len * (0.6 + 0.4 * grow));
    for (const dir of [-1, 1]) {
      const x0 = dir < 0 ? Math.floor(W / 2 - tw / 2) - gap : Math.ceil(W / 2 + tw / 2) + gap;
      for (let i = 0; i < L; i++) {
        const k = 1 - i / L;
        const xx = x0 + dir * (i + 4);
        ctx.globalAlpha = pa * a * k * 0.9; ctx.fillStyle = C.ink; ctx.fillRect(xx, midY - 1, 1, 3);
        ctx.globalAlpha = pa * a * k; ctx.fillStyle = i < 3 ? C.ivory : C.hair; ctx.fillRect(xx, midY, 1, 1);
      }
      ctx.globalAlpha = pa * a;
      // diamond
      ctx.fillStyle = C.ink;
      for (let r = -3; r <= 3; r++) { const hw2 = 3 - Math.abs(r); ctx.fillRect(x0 - hw2, midY + r, hw2 * 2 + 1, 1); }
      ctx.fillStyle = C.hair;
      for (let r = -2; r <= 2; r++) { const hw2 = 2 - Math.abs(r); ctx.fillRect(x0 - hw2, midY + r, hw2 * 2 + 1, 1); }
      ctx.fillStyle = C.ivory; ctx.fillRect(x0, midY - 1, 1, 1);
    }
    drawText(ctx, name, Math.floor(W / 2), y, { align: 'center', scale: sc, color: IVORY_ROWS, outline: C.ink });
    ctx.globalAlpha = pa;
  }

  // ---- monster/farm mode (DESIGN 2.0): lead monster, money, clock – no hearts ---------------------------------
  function monsterMode(g) { return !!(g && (g.party || g.clock || inventory(g))); }
  function sunMoon(ctx, x, y, night) {
    if (night) {
      ctx.fillStyle = C.ink; ctx.fillRect(x + 1, y, 5, 1); ctx.fillRect(x, y + 1, 1, 5); ctx.fillRect(x + 1, y + 6, 5, 1);
      ctx.fillStyle = '#e8e4f8'; ctx.fillRect(x + 1, y + 1, 3, 5); ctx.fillRect(x + 4, y + 1, 1, 1); ctx.fillRect(x + 4, y + 5, 1, 1);
      ctx.fillStyle = '#b8b0d8'; ctx.fillRect(x + 1, y + 4, 1, 2);
    } else {
      ctx.fillStyle = '#f8c838';
      ctx.fillRect(x + 3, y - 1, 1, 1); ctx.fillRect(x + 3, y + 7, 1, 1); ctx.fillRect(x - 1, y + 3, 1, 1); ctx.fillRect(x + 7, y + 3, 1, 1);
      ctx.fillStyle = C.ink; ctx.fillRect(x + 1, y + 1, 5, 5);
      ctx.fillStyle = '#f8d048'; ctx.fillRect(x + 2, y + 1, 3, 5); ctx.fillRect(x + 1, y + 2, 5, 3);
      ctx.fillStyle = '#fff0a0'; ctx.fillRect(x + 2, y + 2, 2, 1);
    }
  }
  function drawMonsterHud(ctx) {
    const g = U.game;
    const { W } = U; const L = U.safe.l, T = U.safe.t, R = U.safe.r;
    const top = T + 4;
    let bottom = top;
    // lead monster (top-left)
    const m = leadMon(g);
    if (m) {
      const w = W < 300 ? 92 : 108, h = 26;
      plaque(ctx, L + 4, top, w, h, 0.42);
      drawPortrait(U, ctx, m, L + 4 + 13, top + 13, 22);
      const nx = L + 4 + 27;
      drawText(ctx, monName(g, m), nx, top + 1, { color: C.ivory, shadow: C.ink });
      drawText(ctx, `Lv.${monLevel(m)}`, L + 4 + w - 4, top + 1, { align: 'right', color: C.hair, shadow: C.ink });
      const an = animHp(m, monHp(m), monMaxHp(m), 1 / 60);
      hpBar(ctx, nx, top + 14, w - 31, 4, an.f, an.trail);
      drawText(ctx, `${Math.ceil(monHp(m))}/${monMaxHp(m)}`, L + 4 + w - 4, top + 16, { align: 'right', color: C.ivoryDim, shadow: C.ink, alpha: 0.9 });
      bottom = top + h;
    }
    // clock (top-right)
    const ci = clockInfo(g);
    let clockW = 0;
    if (ci) {
      clockW = measure(ci.text) + 22;
      const x = W - R - 4 - clockW;
      plaque(ctx, x, top, clockW, 14, 0.42);
      sunMoon(ctx, x + 5, top + 3, ci.night);
      drawText(ctx, ci.text, x + 16, top + 1, { color: C.ivory, shadow: C.ink });
      bottom = Math.max(bottom, top + 14);
    }
    // money + orbs: under the clock on narrow screens, otherwise top-centre
    const mv = money(g);
    const orbs = countOf(g, 'orb') + countOf(g, 'orb_good') + countOf(g, 'orb_master');
    if (mv != null || orbs) {
      const items = [];
      if (mv != null) items.push(['coin', fmtMoney(mv)]);
      if (inventory(g)) items.push(['orb', String(orbs)]);
      const iw = items.reduce((a, [, t]) => a + measure(t) + 16, 0) + 4;
      const narrow = W < 330;
      const x = narrow ? W - R - 4 - iw : Math.floor(W / 2 - iw / 2);
      const y = narrow && ci ? top + 17 : top;
      plaque(ctx, x, y, iw, 14, 0.42);
      let cx = x + 4;
      for (const [k, t] of items) {
        drawItemIcon(U, ctx, k, cx + 5, y + 7, 10);
        cx += 12 + drawText(ctx, t, cx + 12, y + 1, { color: C.ivory, shadow: C.ink }) + 4;
      }
      bottom = Math.max(bottom, y + 14);
    }
    U.hudHeight = Math.max(28, bottom - T + 4);
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
    if (st.areaT > 0 && st.areaName) drawAreaTitle(ctx);
    let ty = T + 32;
    for (const t of st.toasts) {
      const a = clamp(Math.min((t.max - t.t) / 0.15, t.t / 0.35), 0, 1);
      const w = measure(t.text) + 14;
      const x = Math.floor(U.W / 2 - w / 2);
      ctx.globalAlpha = a;
      plaque(ctx, x, ty, w, 15, 0.7);
      drawText(ctx, t.text, x + 7, ty + 1, { color: C.ivory, shadow: C.ink });
      ctx.globalAlpha = 1;
      ty += 18;
    }
  }

  return { update, draw, toast, showArea, st };
}
