// Battle UI (docs/DESIGN.md): ally panel bottom-left, enemy panel top-right (name, level, type plaques, HP bar with
// trailing drain, status), 4 move chips with type colour and cooldown ring (PC key hints A/B/1/2; touch buttons are
// drawn by touch.js), "Fangen!" hint, battle start banner, victory/EP/level-up panel, evolution sequence overlay.
// Reads game.battle = { active, phase, ally, enemy, canCapture, wild, trainer, boss, result } (Fighter: f.mon, f.cds).
import { drawText, measure } from './font.js';
import { C, plaque, panel, rgba, clamp } from './theme.js';
import { monName, monLevel, monHp, monMaxHp, monTypes, monStatus, monMoves, moveName, moveType, monXpFrac, typeInfo,
  speciesOf, GD, countOf, leadMon } from './data.js';
import { typePlaque, hpBar, xpBar, animHp, drawPortrait, drawItemIcon, ring } from './monui.js';

const IVORY_ROWS = ['#fffaf0', '#fffaf0', C.ivory, C.ivory, '#e8dcc0', '#dccca8', '#d0bc94'];
const STAT_NAMES = [['hp', 'KP'], ['atk', 'Ang'], ['def', 'Ver'], ['spd', 'Ini']];
const monOf = (f) => (f && (f.mon || f.monster)) || f || null;

function statsAt(game, m, level) {
  const b = (GD.species || {})[m?.id]?.base || speciesOf(game, m)?.base;
  if (!b) return null;
  const L = level;
  return { hp: Math.floor((b.hp * L) / 20 + L + 12), atk: Math.floor((b.atk * L) / 25 + 5), def: Math.floor((b.def * L) / 25 + 5), spd: Math.floor((b.spd * L) / 25 + 5) };
}

export function createBattleUI(U) {
  const st = {
    wasActive: false, lastPhase: 'none', banner: null, snap: null, victory: null, evo: null, capPulse: 0, endT: 0,
  };
  const B = () => U.game?.battle || null;

  // ---- banners (same visual language as the location title) -------------------------------------
  function banner(text, sub = null, time = 2.4) { st.banner = { text, sub, t: 0, max: time }; }
  function drawBanner(ctx) {
    const b = st.banner; if (!b) return;
    const { W, H } = U;
    const a = clamp(Math.min(b.t / 0.3, (b.max - b.t) / 0.5), 0, 1);
    const sc = measure(b.text) * 2 + 60 <= W - 16 ? 2 : 1;
    const y = Math.floor(H * 0.3);
    const tw = measure(b.text) * sc;
    const slide = Math.round((1 - clamp(b.t / 0.3, 0, 1)) * 24);
    // soft dark band (fades to the sides) so the line reads over the busy arena
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, rgba(C.plaque, 0)); g.addColorStop(0.25, rgba(C.plaque, 0.5 * a)); g.addColorStop(0.75, rgba(C.plaque, 0.5 * a)); g.addColorStop(1, rgba(C.plaque, 0));
    ctx.fillStyle = g; ctx.fillRect(0, y - 6, W, 11 * sc + (b.sub ? 14 : 10));
    ctx.globalAlpha = a;
    ctx.fillStyle = rgba(C.hair, 0.8);
    const lw = Math.floor(tw / 2 + 24);
    ctx.fillRect(Math.floor(W / 2 - lw) - slide, y - 6, lw * 2, 1);
    drawText(ctx, b.text, Math.floor(W / 2) + slide, y, { align: 'center', scale: sc, color: IVORY_ROWS, outline: C.ink });
    if (b.sub) drawText(ctx, b.sub, Math.floor(W / 2), y + 11 * sc + 1, { align: 'center', color: C.ivoryDim, shadow: C.ink });
    ctx.globalAlpha = 1;
  }

  // ---- monster panels ------------------------------------------------------------------------------
  function monPanel(ctx, f, x, y, w, { ally = false, dt = 0 } = {}) {
    const m = monOf(f); if (!m) return 0;
    const g = U.game;
    const h = ally ? 34 : 28;
    plaque(ctx, x, y, w, h, 0.62);
    // name + level
    const name = monName(g, m);
    drawText(ctx, name, x + 5, y + 1, { color: C.ivory, shadow: C.ink });
    const lv = `Lv.${monLevel(m)}`;
    drawText(ctx, lv, x + w - 5, y + 1, { align: 'right', color: C.hair, shadow: C.ink });
    // types + status
    let tx = x + 5;
    for (const t of monTypes(g, m)) tx += typePlaque(ctx, tx, y + 12, t, w < 120) + 2;
    const stt = monStatus(m);
    if (stt) { plaque(ctx, tx + 1, y + 12, measure(stt) + 6, 9, 0.9); drawText(ctx, stt, tx + 4, y + 10, { color: '#f8b0a0', shadow: C.ink }); }
    // hp bar
    const hp = monHp(m), max = monMaxHp(m);
    const an = animHp(m, hp, max, dt);
    const bx = x + 5, bw = w - 10;
    hpBar(ctx, bx, y + 22, bw, 4, an.f, an.trail);
    if (ally) {
      drawText(ctx, `${Math.ceil(hp)}/${max}`, x + w - 5, y + 24, { align: 'right', color: C.ivoryDim, shadow: C.ink });
      xpBar(ctx, bx, y + 28, Math.min(bw - 34, 70), monXpFrac(m));
    }
    return h;
  }

  // ---- move chips (PC) ----------------------------------------------------------------------------------
  const KEYS = ['A', 'B', '1', '2'];
  function moveChips(ctx, f, right, bottom) {
    const m = monOf(f); if (!m) return;
    const moves = monMoves(m);
    const cw = 92, ch = 18, gap = 3;
    const x0 = right - (cw * 2 + gap), y0 = bottom - (ch * 2 + gap);
    for (let i = 0; i < 4; i++) {
      const mv = moves[i];
      const x = x0 + (i % 2) * (cw + gap), y = y0 + Math.floor(i / 2) * (ch + gap);
      const ti = typeInfo(mv ? moveType(mv) : 'normal');
      const total = mv?.cooldown || 0;
      const left = f?.cds?.[i] || 0;
      const frac = total > 0 ? clamp(left / total, 0, 1) : left > 0 ? 1 : 0;
      plaque(ctx, x, y, cw, ch, mv ? 0.7 : 0.35);
      if (!mv) { drawText(ctx, '–', x + cw / 2, y + 3, { align: 'center', color: C.ivoryDim, shadow: C.ink }); continue; }
      // type stripe
      ctx.fillStyle = ti.color; ctx.fillRect(x + 1, y + 2, 2, ch - 4);
      // key cap
      ctx.fillStyle = rgba(C.ivory, frac > 0 ? 0.25 : 0.85); ctx.fillRect(x + 6, y + 4, 9, 10);
      drawText(ctx, KEYS[i], x + 11, y + 3, { align: 'center', color: C.plaque, shadow: null });
      ctx.globalAlpha = frac > 0 ? 0.5 : 1;
      drawText(ctx, moveName(mv), x + 19, y + 3, { color: C.ivory, shadow: C.ink });
      ctx.globalAlpha = 1;
      // cooldown ring: type colour = ready part
      const rx = x + cw - 9, ry = y + 9;
      ring(ctx, rx, ry, 5, 1 - frac, frac > 0 ? ti.light : ti.color, rgba(C.ink, 0.8));
      if (frac <= 0) { ctx.fillStyle = ti.color; ctx.fillRect(rx - 2, ry - 2, 4, 4); }
      else drawText(ctx, String(Math.ceil(left)), rx + 1, ry - 6, { align: 'center', color: C.ivoryDim, shadow: C.ink });
    }
    // dodge / orb hints above the grid
    const b = B();
    const orbs = countOf(U.game, 'orb') + countOf(U.game, 'orb_good') + countOf(U.game, 'orb_master');
    const hints = [['Shift', 'Ausweichen', false]];
    if (b?.wild) hints.push(['Q', `Kugel ×${orbs}`, !!b.canCapture]);
    let hx = right;
    for (const [k, label, hot] of hints.reverse()) {
      const w = measure(k) + measure(label) + 14;
      hx -= w;
      const pulse = hot ? 0.6 + 0.4 * Math.sin(st.capPulse * 8) : 0;
      plaque(ctx, hx, y0 - 14, w, 12, 0.6 + pulse * 0.3);
      if (hot) { ctx.globalAlpha = pulse; ctx.fillStyle = rgba(C.hair, 0.35); ctx.fillRect(hx + 1, y0 - 13, w - 2, 10); ctx.globalAlpha = 1; }
      drawText(ctx, k, hx + 4, y0 - 15, { color: C.hair, shadow: C.ink });
      drawText(ctx, label, hx + 8 + measure(k), y0 - 15, { color: C.ivory, shadow: C.ink });
      hx -= 3;
    }
  }

  // ---- capture hint ----------------------------------------------------------------------------------------
  function captureHint(ctx, x, y) {
    const p = 0.5 + 0.5 * Math.sin(st.capPulse * 7);
    const txt = 'Fangen!';
    const w = measure(txt) * 2 + 14;
    ctx.globalAlpha = 0.75 + 0.25 * p;
    plaque(ctx, x - w / 2, y, w, 19, 0.75);
    ctx.fillStyle = rgba(C.hair, 0.25 + 0.35 * p); ctx.fillRect(Math.round(x - w / 2) + 1, y + 1, w - 2, 1);
    drawText(ctx, txt, Math.round(x), y - 1, { align: 'center', scale: 2, color: ['#fff8e0', '#fff0c0', '#ffe8a0', '#f8d880', '#f0c860', '#e8b848', '#d8a038'], outline: C.ink });
    ctx.globalAlpha = 1;
  }

  // ---- victory / EP / level-up panel (non-blocking) ----------------------------------------------------
  function snapshotTeam() {
    const team = U.game?.party?.team || [];
    st.snap = new Map(team.map((m) => [m, { level: monLevel(m), xp: m.xp ?? 0, frac: monXpFrac(m), moves: [...(m.moves || [])] }]));
  }
  function startVictory(kind) {
    if (!st.snap) return;
    st.victory = { kind, t: 0, prog: new Map(), flash: new Map() };
  }
  function drawVictory(ctx, dt) {
    const v = st.victory; if (!v) return;
    v.t += dt;
    const { W, H } = U;
    const rows = [];
    for (const [m, s] of st.snap) {
      const gained = (m.xp ?? 0) - s.xp;
      if (gained <= 0 && monLevel(m) === s.level) continue;
      rows.push({ m, s, gained });
    }
    if (!rows.length && v.t > 1.2) { st.victory = null; return; }
    const a = clamp(Math.min(v.t / 0.3, (v.max ? (v.max - v.t) / 0.4 : 1)), 0, 1);
    const pw = Math.min(W - 16, 200), rh = 22;
    const lvRow = rows.find((r) => monLevel(r.m) > r.s.level);
    const extra = lvRow ? 30 : 0;
    const ph = 22 + rows.length * rh + extra + 6;
    const px = Math.floor(W / 2 - pw / 2), py = Math.floor(Math.max(U.safe.t + 34, H * 0.16));
    ctx.globalAlpha = a;
    panel(ctx, px, py, pw, ph, { alpha: 0.86 });
    drawText(ctx, v.kind === 'caught' ? 'Gefangen!' : 'Sieg!', px + pw / 2, py + 5, { align: 'center', color: IVORY_ROWS, outline: C.ink });
    rows.slice(0, 4).forEach((r, i) => {
      const y = py + 20 + i * rh;
      drawPortrait(U, ctx, r.m, px + 16, y + 9, 18, { alpha: a });
      drawText(ctx, monName(U.game, r.m), px + 30, y - 1, { color: C.ivory, shadow: C.ink });
      drawText(ctx, `+${Math.max(0, Math.round(r.gained))} EP`, px + pw - 8, y - 1, { align: 'right', color: C.hair, shadow: C.ink });
      // animated progress: levels + fraction
      const target = monLevel(r.m) + monXpFrac(r.m);
      let p = v.prog.get(r.m) ?? (r.s.level + r.s.frac);
      if (p < target) {
        const np = Math.min(target, p + dt * 0.9);
        if (Math.floor(np) > Math.floor(p)) { v.flash.set(r.m, 0.8); U.sfx?.play?.('level_up'); }
        p = np;
      }
      v.prog.set(r.m, p);
      const lvShown = Math.floor(p);
      const fl = v.flash.get(r.m) || 0;
      if (fl > 0) v.flash.set(r.m, fl - dt);
      drawText(ctx, `Lv.${lvShown}`, px + 30, y + 9, { color: fl > 0 && Math.floor(fl * 10) % 2 ? '#ffffff' : C.ivoryDim, shadow: C.ink });
      xpBar(ctx, px + 58, y + 12, pw - 66, p - lvShown);
    });
    if (lvRow) {
      const y = py + 20 + rows.length * rh + 2;
      const m = lvRow.m, L0 = lvRow.s.level, L1 = monLevel(m);
      const s0 = statsAt(U.game, m, L0), s1 = statsAt(U.game, m, L1);
      ctx.fillStyle = rgba(C.hair, 0.35); ctx.fillRect(px + 8, y - 2, pw - 16, 1);
      drawText(ctx, `${monName(U.game, m)} erreicht Lv. ${L1}!`, px + 8, y, { color: '#fff0c0', shadow: C.ink });
      if (s0 && s1) {
        let sx = px + 8;
        for (const [k, n] of STAT_NAMES) sx += drawText(ctx, `${n} +${s1[k] - s0[k]}`, sx, y + 11, { color: C.ivoryDim, shadow: C.ink }) + 8;
      }
      const learned = (m.moves || []).filter((id) => !lvRow.s.moves.includes(id));
      if (learned.length) {
        const nm = GD.moves?.[learned[0]]?.name || learned[0];
        drawText(ctx, `Neu: ${nm}`, px + pw - 8, y, { align: 'right', color: '#a8e078', shadow: C.ink });
      }
    }
    ctx.globalAlpha = 1;
    U.hit(px, py, pw, ph, () => { v.max = Math.min(v.max ?? 1e9, v.t + 0.4); }, 5);
    if (v.max && v.t >= v.max) st.victory = null;
  }

  // ---- level-up panel (explicit API, blocking) ------------------------------------------------------------
  let lvl = null;
  function levelUp(mon, info = {}) {
    return new Promise((resolve) => {
      lvl = { mon, from: info.from ?? monLevel(mon) - 1, to: info.to ?? monLevel(mon), learned: info.learned || [], t: 0, resolve };
      U.onModal(true, 'levelup');
      U.sfx?.play?.('level_up');
    });
  }
  function drawLevelUp(ctx) {
    if (!lvl) return;
    const { W, H } = U;
    const pw = Math.min(W - 16, 190), ph = 86;
    const px = Math.floor(W / 2 - pw / 2), py = Math.floor(H / 2 - ph / 2);
    panel(ctx, px, py, pw, ph, { alpha: 0.9 });
    drawPortrait(U, ctx, lvl.mon, px + 22, py + 22, 28);
    drawText(ctx, monName(U.game, lvl.mon), px + 42, py + 8, { color: C.ivory, shadow: C.ink });
    drawText(ctx, `Lv. ${lvl.from} → ${lvl.to}`, px + 42, py + 19, { color: '#fff0c0', shadow: C.ink });
    const s0 = statsAt(U.game, lvl.mon, lvl.from), s1 = statsAt(U.game, lvl.mon, lvl.to);
    if (s0 && s1) STAT_NAMES.forEach(([k, n], i) => {
      const x = px + 10 + (i % 2) * Math.floor(pw / 2), y = py + 40 + Math.floor(i / 2) * 11;
      drawText(ctx, n, x, y, { color: C.ivoryDim, shadow: C.ink });
      drawText(ctx, `${s1[k]}  +${s1[k] - s0[k]}`, x + Math.floor(pw / 2) - 20, y, { align: 'right', color: C.ivory, shadow: C.ink });
    });
    if (lvl.learned.length) drawText(ctx, `Lernt ${lvl.learned.map((id) => GD.moves?.[id]?.name || id).join(', ')}!`, px + 10, py + 64, { color: '#a8e078', shadow: C.ink });
    if (Math.floor(U.time * 4) % 2 === 0) drawText(ctx, '▼', px + pw - 12, py + ph - 14, { color: C.hair, shadow: C.ink });
    U.hit(0, 0, W, H, closeLevelUp);
  }
  function closeLevelUp() { if (!lvl || lvl.t < 0.25) return; const r = lvl.resolve; lvl = null; U.onModal(false, 'levelup'); r(); }

  // ---- evolution sequence (explicit API, blocking) -----------------------------------------------------------
  /**
   * ui.evolve(mon, { to, apply = true }) → Promise. Shows the overlay, the dialog lines, the flashing transformation;
   * calls mon.evolve() at the peak (if apply and the monster can evolve), then the congratulation line.
   */
  function evolve(mon, opts = {}) {
    return new Promise((resolve) => {
      const fromName = monName(U.game, mon);
      st.evo = { mon, t: 0, stage: 'intro', fromId: mon?.id, toId: opts.to || speciesOf(U.game, mon)?.evolve?.to || GD.species?.[mon?.id]?.evolve?.to, resolve, fromName };
      U.onModal(true, 'evolve');
      (async () => {
        await U.dialogRef(`Was? ${fromName} entwickelt sich!`);
        st.evo.stage = 'morph'; st.evo.t = 0;
        U.sfx?.play?.('evolve');
        await new Promise((r) => { st.evo.onMorphDone = r; });
        let res = null;
        try { if (opts.apply !== false && typeof mon.evolve === 'function' && (mon.canEvolve ?? true)) res = mon.evolve(); } catch (e) { console.warn('[ui] evolve', e); }
        st.evo.stage = 'done'; st.evo.t = 0; st.evo.toId = mon.id !== st.evo.fromId ? mon.id : st.evo.toId;
        U.sfx?.play?.('evolve_done');
        const toName = res?.to || speciesOf(U.game, st.evo.toId)?.name || monName(U.game, mon);
        await U.dialogRef(`Glückwunsch! ${fromName} hat sich zu ${toName} entwickelt!`);
        const r = st.evo.resolve; st.evo = null; U.onModal(false, 'evolve'); r(res);
      })();
    });
  }
  function drawEvolve(ctx, dt) {
    const e = st.evo; if (!e) return;
    e.t += dt;
    const { W, H } = U;
    const k = e.stage === 'intro' ? clamp(e.t / 0.6, 0, 1) : 1;
    const g = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.7);
    g.addColorStop(0, rgba('#2a2448', 0.75 * k)); g.addColorStop(1, rgba(C.bg0, 0.95 * k));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = Math.floor(H * 0.38), size = Math.min(72, Math.floor(H * 0.3));
    // glow
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
    const pulse = e.stage === 'morph' ? 0.35 + 0.3 * Math.sin(e.t * 6) : 0.2;
    gl.addColorStop(0, rgba('#fff0c0', pulse * k)); gl.addColorStop(1, rgba('#fff0c0', 0));
    ctx.fillStyle = gl; ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
    ctx.restore();
    if (e.stage === 'intro') drawPortrait(U, ctx, e.fromId, cx, cy, size, { alpha: k });
    else if (e.stage === 'morph') {
      const T = 3.4;
      const f = 2 + e.t * e.t * 2.2; // flicker frequency rises
      const showNew = e.toId && Math.sin(e.t * f * Math.PI) > 0 && e.t > 0.6;
      drawPortrait(U, ctx, showNew ? e.toId : e.fromId, cx, cy, size, { silhouette: '#fffaf0' });
      // rising sparkles
      for (let i = 0; i < 18; i++) {
        const ph = (i * 0.37 + e.t * 0.6) % 1;
        const x = cx + Math.sin(i * 2.4 + e.t) * size * 0.8, y = cy + size * 0.6 - ph * size * 1.4;
        ctx.globalAlpha = (1 - ph) * 0.9; ctx.fillStyle = i % 3 ? '#fff0c0' : '#ffffff';
        ctx.fillRect(Math.round(x), Math.round(y), 1 + (i % 2), 1 + (i % 2));
      }
      ctx.globalAlpha = 1;
      if (e.t > T - 0.25) { ctx.globalAlpha = clamp((e.t - (T - 0.25)) / 0.25, 0, 1); ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      if (e.t >= T && e.onMorphDone) { const r = e.onMorphDone; e.onMorphDone = null; r(); }
    } else {
      drawPortrait(U, ctx, e.toId || e.mon, cx, cy, size);
      if (e.t < 0.5) { ctx.globalAlpha = 1 - e.t / 0.5; ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    }
    U.hit(0, 0, W, H, () => {}, -1);
  }

  // ---- main ----------------------------------------------------------------------------------------------------
  function update(dt) {
    const b = B();
    st.capPulse += dt;
    if (st.banner) { st.banner.t += dt; if (st.banner.t >= st.banner.max) st.banner = null; }
    if (lvl) { lvl.t += dt; if (lvl.t > 0.25 && U.confirmPressed()) closeLevelUp(); }
    if (st.victory && U.confirmPressed() && !U.dialogActive()) st.victory.max = Math.min(st.victory.max ?? 1e9, st.victory.t + 0.4);
    const active = !!b?.active;
    if (active && !st.wasActive) {
      snapshotTeam();
      st.victory = null;
      const e = monOf(b.enemy);
      const en = e ? monName(U.game, e) : 'Monster';
      if (b.trainer) banner(`${b.trainer.spec?.name || b.trainer.name || 'Ranger'} fordert dich heraus!`, e ? `${en} tritt an` : null);
      else if (b.boss) banner(`${en} erwacht!`);
      else banner(`Ein wildes ${en} erscheint!`);
      const a = monOf(b.ally);
      if (a) st.banner.sub = st.banner.sub || `Los, ${monName(U.game, a)}!`;
    }
    const ph = b?.phase || 'none';
    if (ph !== st.lastPhase) {
      if (ph === 'won') startVictory('won');
      if (ph === 'caught') startVictory('caught');
      if (ph === 'lost') banner('Dein Team ist erschöpft …', null, 2.6);
      st.lastPhase = ph;
    }
    if (!active && st.wasActive && st.victory) st.victory.max = st.victory.max ?? st.victory.t + 3.5;
    st.wasActive = active;
  }

  function draw(ctx, dt) {
    const b = B();
    if (b?.active) {
      const { W, H, safe } = U;
      const touch = U.touchMode;
      const pw = Math.min(touch ? Math.floor((W - safe.l - safe.r - 18) / 2) : 140, 150);
      // enemy top-right
      if (b.enemy && !(monOf(b.enemy) && b.phase === 'capture' && b.enemy.hidden && false)) monPanel(ctx, b.enemy, W - safe.r - 6 - pw, safe.t + 6, pw, { dt });
      // ally: bottom-left on PC, top-left on touch (thumb area is busy)
      if (b.ally) {
        const ay = touch ? safe.t + 6 : H - safe.b - 6 - 34;
        monPanel(ctx, b.ally, safe.l + 6, ay, pw, { ally: true, dt });
      }
      if (!touch && b.ally && ['fight', 'switch', 'enemySwitch', 'capture', 'intro'].includes(b.phase)) moveChips(ctx, b.ally, W - safe.r - 6, H - safe.b - 6);
      if (b.canCapture) captureHint(ctx, W - safe.r - 6 - pw / 2, safe.t + 6 + 31);
    }
    drawVictory(ctx, dt);
    drawBanner(ctx);
  }

  return {
    update, draw, drawModal(ctx, dt) { drawEvolve(ctx, dt); drawLevelUp(ctx); },
    levelUp, evolve, banner,
    get active() { return !!B()?.active; },
    get blockingOverlay() { return !!(st.evo || lvl); },
    st,
  };
}
