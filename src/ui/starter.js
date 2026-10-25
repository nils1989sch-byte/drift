// Starter selection: 3 cards (portrait mon_<id>_icon, name, type, short description). ui.chooseStarter() → Promise<id>.
import { drawText, measure, wrap, LINE_H } from './font.js';
import { C, panel, rgba, clamp } from './theme.js';
import { speciesTable, GD, typeKey } from './data.js';
import { typePlaque, drawPortrait } from './monui.js';

const BLURB = {
  funkel: 'Mutig und flink. Greift gern aus der Nähe an.',
  tropfi: 'Verspielt und zäh. Hält einiges aus.',
  sprossi: 'Ruhig und ausdauernd. Heilt sich mit Wurzelkraft.',
};

export function createStarter(U) {
  let st = null;

  function chooseStarter(opts = {}) {
    return new Promise((resolve) => {
      const ids = opts.ids || GD.starters || ['funkel', 'tropfi', 'sprossi'];
      st = { ids, sel: Math.min(1, ids.length - 1), t: 0, resolve, title: opts.title || 'Wähle deinen Partner', confirming: false, speaker: opts.speaker };
      U.onModal(true, 'starter');
    });
  }

  async function confirm(i) {
    if (!st || st.confirming || st.t < 0.4) return;
    st.sel = i;
    st.confirming = true;
    const sp = speciesTable(U.game)[st.ids[i]] || {};
    U.sfx?.play?.('menu_select');
    const r = await U.dialogRef({ text: `${sp.name || st.ids[i]} wählen?`, speaker: st.speaker, choices: ['Ja', 'Nein'] });
    if (!st) return;
    st.confirming = false;
    if (r === 0) {
      const done = st.resolve, id = st.ids[i];
      st = null; U.onModal(false, 'starter');
      U.sfx?.play?.('monster_summon');
      done(id);
    }
  }

  function update(dt) {
    if (!st) return;
    st.t += dt;
    if (st.confirming || U.dialogActive()) return;
    const n = U.nav();
    const d = n.x || n.y;
    if (d) { st.sel = (st.sel + d + st.ids.length) % st.ids.length; U.sfx?.play?.('menu_move'); }
    if (st.t > 0.4 && U.confirmPressed()) confirm(st.sel);
  }

  function draw(ctx) {
    if (!st) return;
    const { W, H, safe } = U;
    const a = clamp(st.t / 0.4, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgba(C.bg0, 0.75 * a)); g.addColorStop(1, rgba(C.bg0, 0.9 * a));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    drawText(ctx, st.title, Math.floor(W / 2), safe.t + 10, { align: 'center', scale: W >= 300 ? 2 : 1, color: ['#fffaf0', '#fffaf0', C.ivory, C.ivory, '#e8dcc0', '#dccca8', '#d0bc94'], outline: C.ink });
    const tbl = speciesTable(U.game);
    const n = st.ids.length;
    const portrait = W < H; // phones in portrait: stacked rows instead of cards
    const top = safe.t + (W >= 300 ? 36 : 26);
    const availH = H - safe.b - 8 - top;
    st.ids.forEach((id, i) => {
      const sp = tbl[id] || { name: id, types: ['normal'] };
      const sel = i === st.sel;
      let x, y, w, h;
      if (portrait) {
        h = Math.min(Math.floor((availH - (n - 1) * 6) / n), 120); w = Math.min(W - safe.l - safe.r - 16, 260);
        x = Math.floor(W / 2 - w / 2); y = top + i * (h + 6);
      } else {
        w = Math.min(Math.floor((W - safe.l - safe.r - 16 - (n - 1) * 8) / n), 130); h = Math.min(availH, 170);
        x = Math.floor(W / 2 - (n * w + (n - 1) * 8) / 2) + i * (w + 8); y = top + Math.floor((availH - h) / 2);
      }
      const lift = sel ? -2 : 0;
      panel(ctx, x, y + lift, w, h, { alpha: sel ? 0.92 : 0.78 });
      if (sel) { ctx.fillStyle = rgba(C.hair, 0.12 + 0.06 * Math.sin(U.time * 4)); ctx.fillRect(x + 4, y + lift + 4, w - 8, h - 8); }
      const types = (sp.types || ['normal']).map(typeKey);
      if (portrait) {
        const ps = Math.min(h - 16, 48);
        drawPortrait(U, ctx, id, x + 10 + ps / 2, y + lift + h / 2, ps, { alpha: a });
        const tx = x + 18 + ps;
        drawText(ctx, sp.name, tx, y + lift + 7, { color: C.ivory, shadow: C.ink });
        let px = tx; for (const t of types) px += typePlaque(ctx, px, y + lift + 20, t) + 2;
        const lines = wrap(BLURB[id] || sp.desc || sp.dex || '', w - (tx - x) - 8).slice(0, Math.max(1, Math.floor((h - 34) / LINE_H)));
        lines.forEach((l, k) => drawText(ctx, l, tx, y + lift + 31 + k * LINE_H, { color: C.ivoryDim, shadow: C.ink }));
      } else {
        const ps = Math.min(w - 24, 64);
        drawPortrait(U, ctx, id, x + w / 2, y + lift + 10 + ps / 2, ps, { alpha: a });
        let cy = y + lift + 14 + ps;
        drawText(ctx, sp.name, x + w / 2, cy, { align: 'center', color: C.ivory, shadow: C.ink });
        cy += 12;
        const tw = types.reduce((acc, t) => acc + measure((({ fire: 'Feuer', water: 'Wasser', plant: 'Pflanze', stone: 'Stein', bolt: 'Blitz', wind: 'Wind' })[t] || 'Normal')) + 8, 0);
        let px = Math.floor(x + w / 2 - tw / 2); for (const t of types) px += typePlaque(ctx, px, cy, t) + 2;
        cy += 12;
        const lines = wrap(BLURB[id] || sp.desc || sp.dex || '', w - 12).slice(0, Math.max(1, Math.floor((y + lift + h - 6 - cy) / LINE_H)));
        lines.forEach((l, k) => drawText(ctx, l, x + w / 2, cy + k * LINE_H, { align: 'center', color: C.ivoryDim, shadow: C.ink }));
      }
      U.hit(x, y, w, h, () => { if (st.sel === i || !U.touchMode) confirm(i); else { st.sel = i; U.sfx?.play?.('menu_move'); } });
    });
    if (!portrait) drawText(ctx, U.touchMode ? 'Tippe eine Karte zweimal zum Wählen' : '◀ ▶ wählen · A bestätigen', Math.floor(W / 2), H - safe.b - 14, { align: 'center', color: C.ivoryDim, shadow: C.ink });
    ctx.globalAlpha = 1;
    U.hit(0, 0, W, H, () => {}, -1);
  }

  return { chooseStarter, update, draw, get active() { return !!st; } };
}
