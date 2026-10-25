// Pause menu 2.0 (monster/farm mode): tabs Team · Lexikon · Box · Inventar · Optionen.
// Team: 6 slots, HP, level; pick + pick again = swap (top slot = lead monster). Box: portraits, "ins Team".
// Lexikon: seen/caught, portrait (silhouette if only seen), type, habitat. Inventar: items + description.
import { drawText, measure, wrap, LINE_H } from './font.js';
import { C, panel, plaque, pxRect, rgba, clamp } from './theme.js';
import { partyList, boxList, partySwap, dexState, speciesTable, monName, monLevel, monHp, monMaxHp, monTypes, monMoves,
  moveName, moveType, monXpFrac, allItems, itemName, itemDef, money, fmtMoney, clockInfo, typeInfo, typeKey } from './data.js';
import { typePlaque, hpBar, xpBar, drawPortrait, drawItemIcon } from './monui.js';
import { fmtZoom, controlsHelp } from './screens.js';

const TABS = [['team', 'Team'], ['dex', 'Lexikon'], ['box', 'Box'], ['items', 'Inventar'], ['opts', 'Optionen']];

export function createMenu(U) {
  let st = null;

  function open(tab = 'team') {
    if (st) return;
    const g = U.game;
    st = { tab: Math.max(0, TABS.findIndex(([k]) => k === tab)), focus: 'list', sel: { team: 0, dex: 0, box: 0, items: 0, opts: 0 }, pick: null, help: false, t: 0, prevState: g?.state, scroll: { dex: 0 } };
    if (g && g.state === 'play') { try { g.state = 'pause'; } catch { /* ignore */ } }
    U.onModal(true, 'menu');
    U.sfx?.play?.('menu_open');
    try { g?.onPause?.(true); } catch { /* ignore */ }
  }
  function close() {
    if (!st) return;
    const g = U.game;
    if (g && g.state === 'pause' && st.prevState === 'play') { try { g.state = 'play'; } catch { /* ignore */ } }
    st = null;
    U.onModal(false, 'menu');
    U.sfx?.play?.('menu_close');
    try { g?.onPause?.(false); } catch { /* ignore */ }
  }
  const tabKey = () => TABS[st.tab][0];
  function setTab(i) { st.tab = (i + TABS.length) % TABS.length; st.pick = null; U.sfx?.play?.('menu_move'); }

  // ---- data per tab -------------------------------------------------------------------------------------
  const team = () => partyList(U.game);
  const box = () => boxList(U.game);
  function dexList() {
    const tbl = speciesTable(U.game);
    return Object.entries(tbl).map(([id, s]) => ({ id, ...s })).sort((a, b) => (a.no ?? 99) - (b.no ?? 99));
  }
  function optRows() {
    const r = U.renderer();
    const rows = [
      { id: 'resume', label: 'Fortsetzen' },
      { id: 'zoom', label: 'Zoom', value: fmtZoom(U.camera?.target), lr: true },
      { id: 'sound', label: 'Ton', value: U.soundOn ? 'An' : 'Aus', lr: true },
      { id: 'tilt', label: 'Tilt-Shift', value: r ? (r.tiltShift !== false ? 'An' : 'Aus') : '–', lr: true },
      { id: 'help', label: 'Steuerung' },
    ];
    if (typeof U.game?.save === 'function') rows.splice(1, 0, { id: 'save', label: 'Speichern' });
    return rows;
  }
  function optAction(id, dir) {
    U.sfx?.play?.(dir ? 'menu_move' : 'menu_select');
    switch (id) {
      case 'resume': if (!dir) close(); break;
      case 'save': if (!dir) { try { U.game.save(); U.toast('Gespeichert.'); } catch { U.toast('Speichern fehlgeschlagen'); } } break;
      case 'zoom': U.camera?.zoom?.(dir || 1); break;
      case 'sound': U.setSound(!U.soundOn); break;
      case 'tilt': { const r = U.renderer(); if (r) r.tiltShift = r.tiltShift === false; break; }
      case 'help': if (!dir) st.help = true; break;
    }
  }
  function count() {
    switch (tabKey()) {
      case 'team': return Math.max(1, Math.min(6, Math.max(team().length, 1)));
      case 'dex': return dexList().length;
      case 'box': return box().length;
      case 'items': return allItems(U.game).length;
      case 'opts': return optRows().length;
    }
    return 0;
  }
  function activate(i) {
    const k = tabKey();
    if (k === 'team') {
      const t = team();
      if (!t[i]) return;
      if (st.pick == null) { st.pick = i; U.sfx?.play?.('menu_select'); }
      else { if (st.pick !== i) { partySwap(U.game, st.pick, i); U.sfx?.play?.('menu_select'); } st.pick = null; }
    } else if (k === 'box') {
      const p = U.game?.party;
      if (!box()[i]) return;
      if (team().length >= 6) { U.toast('Dein Team ist voll.'); U.sfx?.play?.('error'); return; }
      if (typeof p?.fromBox === 'function' && p.fromBox(i)) { U.toast('Ins Team geholt.'); U.sfx?.play?.('menu_select'); }
    } else if (k === 'opts') optAction(optRows()[i]?.id, 0);
  }
  function toBox(i) {
    const p = U.game?.party;
    if (typeof p?.toBox !== 'function' || !team()[i]) return;
    if (p.toBox(i)) { U.toast('In die Box gebracht.'); U.sfx?.play?.('menu_select'); st.pick = null; }
    else { U.toast('Mindestens ein Monster muss im Team bleiben.'); U.sfx?.play?.('error'); }
  }

  // grid geometry for keyboard navigation (cols per tab, filled while drawing)
  const cols = { team: 1, dex: 1, box: 1, items: 1, opts: 1 };

  function update(dt) {
    if (!st) return;
    st.t += dt;
    if (st.t < 0.12 || U.dialogActive()) return;
    if (st.help) { if (U.confirmPressed() || U.input?.pressed?.('start')) { st.help = false; U.sfx?.play?.('menu_close'); } return; }
    if (U.input?.pressed?.('start')) { close(); return; }
    if (U.input?.pressed?.('item')) { setTab(st.tab + 1); return; } // Q/L: next tab
    const k = tabKey();
    const n = U.nav();
    if (st.focus === 'tabs') {
      if (n.x) setTab(st.tab + n.x);
      if (n.y > 0 || U.confirmPressed()) st.focus = 'list';
      return;
    }
    const N = count(), c = cols[k] || 1;
    let s = st.sel[k];
    if (n.y) {
      if (n.y < 0 && s - c < 0) { st.focus = 'tabs'; U.sfx?.play?.('menu_move'); return; }
      s = clamp(s + n.y * c, 0, Math.max(0, N - 1));
    }
    if (n.x) {
      if (k === 'opts') { const r = optRows()[s]; if (r?.lr) optAction(r.id, n.x); }
      else if (c > 1) s = clamp(s + n.x, 0, Math.max(0, N - 1));
      else setTab(st.tab + n.x);
    }
    if (s !== st.sel[k]) { st.sel[k] = s; U.sfx?.play?.('menu_move'); }
    if (U.input?.pressed?.('attack')) activate(st.sel[k]);
    else if (U.input?.pressed?.('action')) { if (k === 'team') toBox(st.sel[k]); else if (st.pick != null) st.pick = null; else st.focus = 'tabs'; }
  }

  // ---- drawing ------------------------------------------------------------------------------------------
  function frame() {
    const { W, H, safe } = U;
    const pw = Math.min(W - safe.l - safe.r - 8, 440), ph = Math.min(H - safe.t - safe.b - 8, 300);
    return { x: Math.floor(safe.l + (W - safe.l - safe.r - pw) / 2), y: Math.floor(safe.t + (H - safe.t - safe.b - ph) / 2), w: pw, h: ph };
  }
  function drawTabs(ctx, F) {
    const narrow = F.w < 300;
    let x = F.x + 8;
    const y = F.y + 6;
    const tw = Math.floor((F.w - 16 - (TABS.length - 1) * 2) / TABS.length);
    TABS.forEach(([k, label], i) => {
      const act = i === st.tab;
      const txt = narrow && measure(label) > tw - 4 ? label.slice(0, 4) + '.' : label;
      plaque(ctx, x, y, tw, 14, act ? 0.9 : 0.45);
      if (act) { ctx.fillStyle = C.hair; ctx.fillRect(x + 2, y + 12, tw - 4, 1); if (st.focus === 'tabs') { ctx.fillStyle = rgba(C.hair, 0.25); ctx.fillRect(x + 1, y + 1, tw - 2, 12); } }
      drawText(ctx, txt, x + Math.floor(tw / 2), y + 1, { align: 'center', color: act ? C.ivory : C.ivoryDim, shadow: C.ink });
      U.hit(x, y, tw, 14, () => { st.tab = i; st.focus = 'list'; st.pick = null; U.sfx?.play?.('menu_move'); });
      x += tw + 2;
    });
    return y + 18;
  }
  function selBox(ctx, x, y, w, h, on, picked) {
    if (picked) { ctx.fillStyle = rgba('#a8e078', 0.22); ctx.fillRect(x, y, w, h); }
    if (on && st.focus === 'list') {
      ctx.fillStyle = rgba(C.hair, 0.16 + 0.06 * Math.sin(U.time * 5)); ctx.fillRect(x, y, w, h);
      ctx.fillStyle = C.hair; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    }
  }

  function drawTeam(ctx, F, y0) {
    const t = team();
    const wide = F.w >= 340;
    const c = wide ? 2 : 1; cols.team = c;
    const gap = 4;
    const bottomH = 32; // details line
    const avail = F.y + F.h - 8 - bottomH - y0;
    const cw = Math.floor((F.w - 16 - (c - 1) * gap) / c);
    const ch = clamp(Math.floor((avail - (6 / c - 1) * gap) / (6 / c)), 22, 42);
    for (let i = 0; i < 6; i++) {
      const x = F.x + 8 + (i % c) * (cw + gap), y = y0 + Math.floor(i / c) * (ch + gap);
      const m = t[i];
      plaque(ctx, x, y, cw, ch, m ? 0.55 : 0.25);
      selBox(ctx, x, y, cw, ch, st.sel.team === i, st.pick === i);
      U.hit(x, y, cw, ch, () => { st.sel.team = i; st.focus = 'list'; activate(i); });
      if (!m) { drawText(ctx, '– frei –', x + cw / 2, y + ch / 2 - 6, { align: 'center', color: rgba(C.ivoryDim, 0.6), shadow: null }); continue; }
      const fainted = monHp(m) <= 0;
      const ps = Math.min(ch - 4, 32);
      drawPortrait(U, ctx, m, x + 3 + ps / 2, y + ch / 2, ps, { alpha: fainted ? 0.45 : 1 });
      const tx = x + 7 + ps;
      drawText(ctx, monName(U.game, m), tx, y + 1, { color: fainted ? C.ivoryDim : C.ivory, shadow: C.ink });
      drawText(ctx, `Lv.${monLevel(m)}`, x + cw - 4, y + 1, { align: 'right', color: C.hair, shadow: C.ink });
      if (i === 0) { const lw = measure('Leit') + 6; plaque(ctx, tx + measure(monName(U.game, m)) + 4, y + 2, lw, 9, 0.9); drawText(ctx, 'Leit', tx + measure(monName(U.game, m)) + 7, y, { color: C.hair, shadow: C.ink }); }
      const hy = ch >= 34 ? y + 23 : y + 13;
      if (ch >= 34) { let px = tx; for (const ty of monTypes(U.game, m)) px += typePlaque(ctx, px, y + 12, ty, cw < 160) + 2; }
      const max = monMaxHp(m), hp = monHp(m);
      hpBar(ctx, tx, hy, cw - (tx - x) - 44, 4, hp / max);
      drawText(ctx, fainted ? 'K.O.' : `${Math.ceil(hp)}/${max}`, x + cw - 4, hy - 3, { align: 'right', color: fainted ? '#f08070' : C.ivoryDim, shadow: C.ink });
      if (ch >= 40) xpBar(ctx, tx, hy + 7, Math.min(60, cw - (tx - x) - 44), monXpFrac(m));
    }
    // details of the selected monster: moves
    const m = t[st.sel.team];
    const dy = F.y + F.h - 8 - bottomH + 4;
    if (m) {
      const mv = monMoves(m);
      const mw = Math.floor((F.w - 16 - 6) / 4);
      mv.forEach((v, i) => {
        const x = F.x + 8 + i * (mw + 2);
        const ti = typeInfo(moveType(v));
        plaque(ctx, x, dy, mw, 13, 0.6);
        ctx.fillStyle = ti.color; ctx.fillRect(x + 1, dy + 2, 2, 9);
        const nm = moveName(v);
        drawText(ctx, measure(nm) > mw - 8 ? nm.slice(0, Math.max(3, Math.floor((mw - 8) / 6))) + '.' : nm, x + 5, dy, { color: C.ivory, shadow: C.ink });
      });
    }
    const hint = st.pick != null ? 'Zweiten Platz wählen zum Tauschen' : U.touchMode ? 'Tippen: wählen · nochmal tippen: tauschen · oben = Leit-Monster' : 'A: wählen/tauschen · B: in die Box · oberster Platz = Leit-Monster';
    drawText(ctx, wrap(hint, F.w - 16)[0], F.x + 8, dy + 15, { color: C.ivoryDim, shadow: C.ink });
  }

  function drawDex(ctx, F, y0) {
    const list = dexList();
    const { seen, caught } = dexState(U.game);
    cols.dex = 1;
    const wide = F.w >= 340;
    const listW = wide ? Math.floor(F.w * 0.42) : F.w - 16;
    const rowH = 12;
    const listH = wide ? F.y + F.h - 8 - y0 - 12 : Math.floor((F.y + F.h - 8 - y0 - 12) * 0.42);
    const vis = Math.max(1, Math.floor(listH / rowH));
    const sel = st.sel.dex;
    let sc = st.scroll.dex;
    if (sel < sc) sc = sel; if (sel >= sc + vis) sc = sel - vis + 1;
    st.scroll.dex = sc = clamp(sc, 0, Math.max(0, list.length - vis));
    drawText(ctx, `Gesehen ${list.filter((s) => seen.has(s.id)).length} · Gefangen ${list.filter((s) => caught.has(s.id)).length}`, F.x + 8, y0 - 2, { color: C.hair, shadow: C.ink });
    const ly = y0 + 11;
    for (let k = 0; k < vis && sc + k < list.length; k++) {
      const i = sc + k, s = list[i], y = ly + k * rowH;
      const known = seen.has(s.id), got = caught.has(s.id);
      selBox(ctx, F.x + 6, y, listW, rowH, i === sel, false);
      drawText(ctx, String(s.no ?? i + 1).padStart(2, '0'), F.x + 9, y, { color: C.ivoryDim, shadow: C.ink });
      drawText(ctx, known ? s.name : '???', F.x + 26, y, { color: known ? C.ivory : rgba(C.ivoryDim, 0.7), shadow: C.ink });
      // caught = filled orb, seen = ring
      const ox = F.x + 6 + listW - 9, oy = y + 3;
      if (got) { ctx.fillStyle = '#e05040'; ctx.fillRect(ox, oy, 5, 2); ctx.fillStyle = '#e8e4dc'; ctx.fillRect(ox, oy + 3, 5, 2); ctx.fillStyle = C.ink; ctx.fillRect(ox, oy + 2, 5, 1); }
      else if (known) { ctx.fillStyle = rgba(C.ivoryDim, 0.7); ctx.fillRect(ox + 1, oy + 1, 3, 3); }
      U.hit(F.x + 6, y, listW, rowH, () => { st.sel.dex = i; st.focus = 'list'; });
    }
    if (sc > 0) drawText(ctx, '▲', F.x + 6 + listW / 2, ly - 9, { align: 'center', color: C.hair, shadow: C.ink });
    if (sc + vis < list.length) drawText(ctx, '▼', F.x + 6 + listW / 2, ly + vis * rowH - 3, { align: 'center', color: C.hair, shadow: C.ink });
    // detail
    const s = list[sel];
    if (!s) return;
    const known = seen.has(s.id), got = caught.has(s.id);
    const dx = wide ? F.x + 14 + listW : F.x + 8, dy = wide ? y0 : ly + vis * rowH + 6;
    const dw = wide ? F.x + F.w - 8 - dx : F.w - 16, dh = F.y + F.h - 8 - dy;
    plaque(ctx, dx, dy, dw, dh, 0.4);
    const ps = Math.min(64, dh - 20, Math.floor(dw * 0.4));
    if (known) drawPortrait(U, ctx, s.id, dx + 6 + ps / 2, dy + 6 + ps / 2, ps, { silhouette: got ? false : '#3a3248' });
    else drawText(ctx, '?', dx + 6 + ps / 2, dy + ps / 2 - 4, { align: 'center', scale: 2, color: C.ivoryDim, outline: C.ink });
    const tx = dx + 12 + ps;
    drawText(ctx, known ? s.name : '???', tx, dy + 4, { color: C.ivory, shadow: C.ink });
    drawText(ctx, got ? 'gefangen' : known ? 'gesehen' : 'unbekannt', tx, dy + 15, { color: got ? '#a8e078' : C.ivoryDim, shadow: C.ink });
    if (known) {
      let px = tx; for (const t of (s.types || ['normal']).map(typeKey)) px += typePlaque(ctx, px, dy + 28, t) + 2;
      drawText(ctx, s.habitat || '–', tx, dy + 39, { color: C.ivoryDim, shadow: C.ink });
    }
    const textY = Math.max(dy + 52, dy + ps + 10);
    if (got || known) {
      const lines = wrap(got ? (s.desc || s.dex || '') : 'Fange es, um mehr zu erfahren.', dw - 12);
      lines.slice(0, Math.max(0, Math.floor((dy + dh - 4 - textY) / LINE_H))).forEach((l, k) => drawText(ctx, l, dx + 6, textY + k * LINE_H, { color: C.ivoryDim, shadow: C.ink }));
    }
  }

  function drawBox(ctx, F, y0) {
    const b = box();
    const cell = 28;
    const c = Math.max(3, Math.floor((F.w - 16) / (cell + 2))); cols.box = c;
    drawText(ctx, `Hof-Box · ${b.length} Monster · die ersten 4 helfen auf dem Hof`, F.x + 8, y0 - 2, { color: C.hair, shadow: C.ink });
    const gy = y0 + 11;
    const rowsVis = Math.max(1, Math.floor((F.y + F.h - 8 - 40 - gy) / (cell + 2)));
    if (!b.length) drawText(ctx, 'Noch leer. Gefangene Monster landen hier, wenn dein Team voll ist.', F.x + 8, gy + 4, { color: C.ivoryDim, shadow: C.ink });
    const sel = st.sel.box;
    const start = Math.max(0, Math.floor(sel / c) - rowsVis + 1) * c;
    for (let i = start; i < Math.min(b.length, start + rowsVis * c); i++) {
      const k = i - start, x = F.x + 8 + (k % c) * (cell + 2), y = gy + Math.floor(k / c) * (cell + 2);
      pxRect(ctx, x, y, cell, cell, rgba(C.plaque, 0.55), 2);
      if (i < 4) { ctx.fillStyle = rgba('#a8e078', 0.7); ctx.fillRect(x + 2, y + cell - 3, cell - 4, 1); }
      selBox(ctx, x, y, cell, cell, i === sel, false);
      drawPortrait(U, ctx, b[i], x + cell / 2, y + cell / 2, cell - 4);
      U.hit(x, y, cell, cell, () => { if (st.sel.box === i && U.touchMode) activate(i); st.sel.box = i; st.focus = 'list'; });
    }
    const m = b[sel];
    const dy = F.y + F.h - 8 - 34;
    if (m) {
      plaque(ctx, F.x + 8, dy, F.w - 16, 32, 0.45);
      drawText(ctx, `${monName(U.game, m)}  Lv.${monLevel(m)}`, F.x + 13, dy + 2, { color: C.ivory, shadow: C.ink });
      let px = F.x + 13; for (const t of monTypes(U.game, m)) px += typePlaque(ctx, px, dy + 15, t) + 2;
      drawText(ctx, team().length >= 6 ? 'Team voll' : U.touchMode ? 'Nochmal tippen: ins Team' : 'A: ins Team holen', F.x + F.w - 13, dy + 2, { align: 'right', color: C.ivoryDim, shadow: C.ink });
      hpBar(ctx, F.x + F.w - 13 - 70, dy + 17, 70, 4, monHp(m) / monMaxHp(m));
    }
  }

  function drawItems(ctx, F, y0) {
    const items = allItems(U.game);
    const cell = 26;
    const c = Math.max(3, Math.floor((F.w - 16) / (cell + 2))); cols.items = c;
    const mv = money(U.game);
    if (mv != null) {
      drawItemIcon(U, ctx, 'coin', F.x + 13, y0 + 3, 10);
      drawText(ctx, `${fmtMoney(mv)} Taler`, F.x + 21, y0 - 2, { color: C.ivory, shadow: C.ink });
    }
    const ci = clockInfo(U.game);
    if (ci) drawText(ctx, `${ci.text}${ci.season ? ' · ' + ci.season : ''}`, F.x + F.w - 8, y0 - 2, { align: 'right', color: C.ivoryDim, shadow: C.ink });
    const gy = y0 + 11;
    if (!items.length) drawText(ctx, 'Deine Tasche ist leer.', F.x + 8, gy + 4, { color: C.ivoryDim, shadow: C.ink });
    const rowsVis = Math.max(1, Math.floor((F.y + F.h - 8 - 36 - gy) / (cell + 2)));
    const sel = clamp(st.sel.items, 0, Math.max(0, items.length - 1));
    const start = Math.max(0, Math.floor(sel / c) - rowsVis + 1) * c;
    for (let i = start; i < Math.min(items.length, start + rowsVis * c); i++) {
      const k = i - start, x = F.x + 8 + (k % c) * (cell + 2), y = gy + Math.floor(k / c) * (cell + 2);
      const it = items[i];
      pxRect(ctx, x, y, cell, cell, rgba(C.plaque, 0.55), 2);
      selBox(ctx, x, y, cell, cell, i === sel, false);
      drawItemIcon(U, ctx, it.id, x + cell / 2, y + cell / 2, cell - 6);
      if (it.count > 1) drawText(ctx, String(it.count), x + cell - 1, y + cell - 10, { align: 'right', color: C.ivory, outline: C.ink });
      U.hit(x, y, cell, cell, () => { st.sel.items = i; st.focus = 'list'; });
    }
    const it = items[sel];
    const dy = F.y + F.h - 8 - 30;
    if (it) {
      plaque(ctx, F.x + 8, dy, F.w - 16, 28, 0.45);
      drawText(ctx, itemName(it), F.x + 13, dy + 1, { color: C.ivory, shadow: C.ink });
      const d = itemDef(it);
      const desc = d?.desc || it.desc || '';
      if (d?.sell) drawText(ctx, `Wert ${d.sell}`, F.x + F.w - 13, dy + 1, { align: 'right', color: C.hair, shadow: C.ink });
      drawText(ctx, wrap(desc, F.w - 26)[0] || '', F.x + 13, dy + 13, { color: C.ivoryDim, shadow: C.ink });
    }
  }

  function drawOpts(ctx, F, y0) {
    cols.opts = 1;
    const rows = optRows();
    const w = Math.min(F.w - 32, 260), x = Math.floor(F.x + F.w / 2 - w / 2);
    rows.forEach((r, i) => {
      const y = y0 + 4 + i * 15;
      const sel = i === st.sel.opts;
      selBox(ctx, x - 4, y - 1, w + 8, 14, sel, false);
      drawText(ctx, r.label, x + 4, y, { color: sel ? C.ivory : C.ivoryDim, shadow: C.ink });
      if (r.value != null) drawText(ctx, r.lr ? `◀ ${r.value} ▶` : r.value, x + w - 4, y, { align: 'right', color: sel ? C.hair : C.ivoryDim, shadow: C.ink });
      const toggle = r.id === 'sound' || r.id === 'tilt';
      if (r.lr) {
        U.hit(x - 4, y - 1, Math.floor(w / 2) + 4, 14, () => { st.sel.opts = i; optAction(r.id, toggle ? 0 : -1); });
        U.hit(x + Math.floor(w / 2), y - 1, Math.ceil(w / 2) + 4, 14, () => { st.sel.opts = i; optAction(r.id, toggle ? 0 : 1); });
      } else U.hit(x - 4, y - 1, w + 8, 14, () => { st.sel.opts = i; optAction(r.id, 0); });
    });
  }

  function drawHelp(ctx, F) {
    const kb = [...controlsHelp(false), 'Kampf: A/B/1/2 Attacken · Shift Ausweichen · Q Kugel', '1–8: Hotbar-Platz · Q/L: Hotbar weiter'];
    const tc = [...controlsHelp(true), 'Kampf: 4 Attacken-Knöpfe · Ausweichen · Kugel', 'Hotbar: Platz antippen'];
    const sections = U.touchMode ? [['TOUCH', tc], ['TASTATUR', kb]] : [['TASTATUR', kb], ['TOUCH', tc]];
    let y = F.y + 24;
    drawText(ctx, '- STEUERUNG -', F.x + F.w / 2, F.y + 8, { align: 'center', color: C.ivory, shadow: C.ink });
    for (const [h, ls] of sections) {
      if (y > F.y + F.h - 20) break;
      drawText(ctx, h, F.x + 10, y, { color: C.hair, shadow: C.ink }); y += LINE_H;
      for (const l of ls) for (const w of wrap(l, F.w - 20)) { if (y > F.y + F.h - 14) break; drawText(ctx, w, F.x + 10, y, { color: C.ivory, shadow: C.ink }); y += LINE_H; }
      y += 3;
    }
    U.hit(0, 0, U.W, U.H, () => { st.help = false; });
  }

  function draw(ctx) {
    if (!st) return;
    const { W, H } = U;
    const a = clamp(st.t / 0.15, 0, 1);
    ctx.globalAlpha = 0.55 * a; ctx.fillStyle = C.bg0; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const F = frame();
    panel(ctx, F.x, F.y, F.w, F.h, { alpha: 0.9 });
    U.hit(0, 0, W, H, () => {}, -1);
    if (st.help) return drawHelp(ctx, F);
    const y0 = drawTabs(ctx, F) + 4;
    switch (tabKey()) {
      case 'team': drawTeam(ctx, F, y0); break;
      case 'dex': drawDex(ctx, F, y0); break;
      case 'box': drawBox(ctx, F, y0); break;
      case 'items': drawItems(ctx, F, y0); break;
      case 'opts': drawOpts(ctx, F, y0); break;
    }
    // close button (touch)
    if (U.touchMode) {
      const bx = F.x + F.w - 16, by = F.y - 2;
      plaque(ctx, bx, by, 14, 12, 0.9);
      drawText(ctx, '×', bx + 7, by - 1, { align: 'center', color: C.ivory, shadow: C.ink });
      U.hit(bx - 4, by - 4, 22, 20, close, 3);
    }
  }

  return { open, close, update, draw, get active() { return !!st; }, get tab() { return st ? tabKey() : null; } };
}
