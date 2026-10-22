// Full-screen UI states: title screen, pause menu (inventory + options + controls help), game over.
import { drawText, measure, wrap, LINE_H } from './font.js';
import { C, panel, plaque, pxRect, rgba, clamp, easeOutBounce } from './theme.js';

// ---- big "DRIFT" logo (own pixel letters, 2 px strokes, 11 rows) -------------------------------
const LOGO = {
  D: ['######..', '#######.', '##...###', '##....##', '##....##', '##....##', '##....##', '##....##', '##...###', '#######.', '######..'],
  R: ['######..', '#######.', '##...###', '##....##', '##...###', '#######.', '######..', '##..##..', '##...##.', '##....##', '##....##'],
  I: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '######', '######'],
  F: ['########', '########', '##......', '##......', '##......', '######..', '######..', '##......', '##......', '##......', '##......'],
  T: ['########', '########', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...', '...##...'],
};
const FACE = ['#fffcf4', '#fffaf0', '#f8f0dc', '#f4ead0', '#efe2c4', '#e8d8b4', '#e2cea6', '#dcc498', '#d4b888', '#c8a878', '#b89868'];
const EXTR = ['#6a5848', '#3a2e2a'];
const LOGO_WORD = 'DRIFT', LGAP = 2, LH = 11, DEPTH = 2, PADT = 14; // PADT: room for drop-in

const logoLetters = (() => {
  let x = 0; const out = [];
  for (const ch of LOGO_WORD) { const rows = LOGO[ch]; out.push({ ch, x, rows, w: rows[0].length }); x += rows[0].length + LGAP; }
  return { letters: out, w: x - LGAP };
})();

let logoCanvas = null;
function renderLogo(t) {
  const W = logoLetters.w + 4, H = LH + DEPTH + 4 + PADT;
  if (!logoCanvas) { logoCanvas = document.createElement('canvas'); logoCanvas.width = W; logoCanvas.height = H; }
  const g = logoCanvas.getContext('2d');
  g.clearRect(0, 0, W, H);
  const shine = ((t * 26) % 110) - 25;
  const pts = [];
  logoLetters.letters.forEach((L, i) => {
    const t0 = t - 0.12 * i;
    let dy;
    if (t0 < 0) dy = -PADT - 20;
    else if (t0 < 0.7) dy = Math.round(-PADT * (1 - easeOutBounce(t0 / 0.7)));
    else dy = Math.round(Math.sin(t * 2.2 + i * 0.9) * 0.9);
    L.rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') pts.push([L.x + x + 2, y + dy + 2 + PADT, y]); });
  });
  const put = (x, y) => g.fillRect(x, y, 1, 1);
  g.fillStyle = C.ink;
  for (const [x, y] of pts) for (let dy = -1; dy <= DEPTH + 1; dy++) for (let dx = -1; dx <= 1; dx++) put(x + dx, y + dy);
  for (let d = DEPTH; d >= 1; d--) { g.fillStyle = EXTR[d - 1]; for (const [x, y] of pts) put(x, y + d); }
  for (const [x, y, row] of pts) {
    const s = x - row * 0.6 - shine;
    g.fillStyle = s >= 0 && s < 2.2 ? '#ffffff' : s >= 2.2 && s < 3.4 ? '#fffdf6' : FACE[row];
    put(x, y);
  }
  return logoCanvas;
}

// soft glow: logo silhouette downsampled and upscaled with smoothing (works without ctx.filter)
let glowSmall = null;
const GLOW_M = 4; // transparent margin (texels) so the bilinear upscale fades out instead of ending in a hard box
function logoGlow(logo, k) {
  const w = Math.ceil(logo.width / k) + GLOW_M * 2, h = Math.ceil(logo.height / k) + GLOW_M * 2;
  if (!glowSmall || glowSmall.width !== w || glowSmall.height !== h) { glowSmall = document.createElement('canvas'); glowSmall.width = w; glowSmall.height = h; }
  const g = glowSmall.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  g.imageSmoothingEnabled = true;
  g.drawImage(logo, GLOW_M, GLOW_M, logo.width / k, logo.height / k);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffd890'; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
  return glowSmall;
}

const ITEM_NAMES = { sword: 'Schwert', shield: 'Schild', bomb: 'Bomben', bow: 'Bogen', boomerang: 'Bumerang', lamp: 'Laterne',
  potion: 'Trank', map: 'Karte', compass: 'Kompass', hookshot: 'Enterhaken', hammer: 'Hammer', rod: 'Stab', net: 'Netz' };
const BASE_ITEMS = ['sword', 'shield', 'bomb', 'bow', 'boomerang', 'lamp', 'potion', 'map', 'compass'];
const PASSIVE = new Set(['sword', 'shield', 'map', 'compass']);

export function ownedItems(p) {
  const s = new Set();
  if (!p) return [];
  const add = (src) => {
    if (!src) return;
    if (src instanceof Set || Array.isArray(src)) for (const v of src) { if (typeof v === 'string') s.add(v); else if (v?.id) s.add(v.id); }
    else if (typeof src === 'object') for (const [k, v] of Object.entries(src)) if (v) s.add(k);
  };
  add(p.inventory); add(p.items); add(p.owned);
  if (p.item) s.add(p.item);
  if (p.bombs > 0) s.add('bomb');
  if (p.sword || p.hasSword) s.add('sword');
  if (p.shield || p.hasShield) s.add('shield');
  return [...s];
}

export function controlsHelp(touch) {
  return touch
    ? ['Stick links (Daumen aufsetzen): Laufen', 'A: Schwert   B: Aktion / Heben', 'Item-Taste: Item benutzen', '≡: Menü   + / –  oder Pinch: Zoom', 'Tippen: Dialog weiter']
    : ['WASD / Pfeile: Laufen', 'J / Leertaste: Schwert', 'K / E: Aktion / Heben', 'L / Q: Item   Enter / Esc: Menü', '+ / – / Mausrad: Zoom'];
}

export function fmtZoom(z) {
  if (!Number.isFinite(z)) return '?';
  const r = Math.round(z * 10) / 10;
  return (Number.isInteger(r) ? String(r) : String(r).replace('.', ',')) + '×';
}

export function createScreens(U) {
  // ------------------------------------------------------------------ TITLE
  const title = { active: false, t: 0, out: -1, onStart: null, motes: [] };
  function showTitle(onStart) {
    title.active = true; title.t = 0; title.out = -1; title.onStart = onStart || null;
    title.fromState = U.game?.state === 'title' || !U.game; // opened while the game is in its title state
    title.motes = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), s: 0.3 + Math.random(), p: Math.random() * 6 }));
    U.onModal(true, 'title');
    U.sfx?.music?.('title');
  }
  /** Close the title immediately (no callback), e.g. when the game left its 'title' state on its own. */
  function closeTitle() {
    if (!title.active) return;
    title.active = false; title.out = -1; title.onStart = null;
    U.onModal(false, 'title');
  }
  /** Title must never outlive the game's title state. */
  function checkTitle() {
    if (!title.active) return;
    const g = U.game;
    if (!g || g.state === undefined) return;
    if (g.state === 'title') { title.fromState = true; return; }
    if (title.fromState || title.out >= 0) closeTitle();
  }
  function startGame() {
    if (title.out >= 0 || title.t < 0.35) return;
    title.out = 0;
    U.sfx?.play?.('menu_start');
    U.sfx?.unlock?.();
  }
  function updateTitle(dt) {
    title.t += dt;
    for (const m of title.motes) { m.x += dt * 0.012 * m.s; m.y -= dt * 0.02 * m.s; if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); } if (m.x > 1.02) m.x = -0.02; }
    if (title.out >= 0) {
      title.out += dt;
      if (title.out >= 0.45) {
        title.active = false; U.onModal(false, 'title');
        const cb = title.onStart; title.onStart = null;
        try { if (cb) cb(); else U.game?.start?.(); } catch (e) { console.error('[ui] onStart failed', e); }
      }
      return;
    }
    if (title.t > 0.35 && (U.confirmPressed() || U.input?.pressed?.('start'))) startGame();
  }
  function drawTitle(ctx) {
    const { W, H, safe } = U;
    const t = title.t;
    const fadeIn = clamp(t / 0.5, 0, 1);
    const a = title.out >= 0 ? 1 - clamp(title.out / 0.45, 0, 1) : 1;
    ctx.globalAlpha = a;
    if (U.game?.world) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(C.bg0, 0.62)); g.addColorStop(0.42, rgba(C.bg0, 0.12)); g.addColorStop(0.62, rgba(C.bg0, 0.08)); g.addColorStop(1, rgba(C.bg0, 0.78));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.7);
      g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg0);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // drifting motes
    for (const m of title.motes) {
      const tw = 0.35 + 0.35 * Math.sin(t * 2 + m.p);
      ctx.globalAlpha = a * tw * fadeIn;
      ctx.fillStyle = m.s > 1 ? '#ffe8b0' : C.ivory;
      const sz = m.s > 1.1 ? 2 : 1;
      ctx.fillRect(Math.floor(m.x * W), Math.floor(m.y * H), sz, sz);
    }
    ctx.globalAlpha = a;
    // logo
    const logo = renderLogo(t);
    const lsc = Math.max(1, Math.min(Math.floor((W - 24) / logo.width), Math.floor((H * 0.3) / (LH + DEPTH + 4)), 6));
    const lx = Math.floor(W / 2 - (logo.width * lsc) / 2);
    const ly = Math.floor(H * 0.17) - PADT * lsc;
    {
      const K = 3;
      const gl = logoGlow(logo, K);
      const pulse = 0.55 + 0.15 * Math.sin(t * 1.6);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = 'lighter';
      const f = lsc * K; // UI px per glow texel
      const cxl = lx + (logo.width * lsc) / 2, cyl = ly + (logo.height * lsc) / 2;
      const fade = clamp(t / 1.2, 0, 1);
      for (const [sc, al] of [[1.0, 0.42], [1.35, 0.2]]) {
        const dw = gl.width * f * sc, dh = gl.height * f * sc;
        ctx.globalAlpha = a * pulse * al * fade;
        ctx.drawImage(gl, cxl - dw / 2, cyl - dh / 2, dw, dh);
      }
      ctx.restore();
      ctx.imageSmoothingEnabled = false;
    }
    ctx.drawImage(logo, lx, ly, logo.width * lsc, logo.height * lsc);
    const sub = 'Ein Diorama-Abenteuer';
    const ly2 = ly + logo.height * lsc + 4;
    ctx.globalAlpha = a * clamp((t - 0.9) / 0.5, 0, 1);
    drawText(ctx, sub, Math.floor(W / 2), ly2, { align: 'center', color: C.ivory, shadow: C.ink });
    ctx.globalAlpha = a;
    // prompt
    if (t > 1.1) {
      const blink = title.out >= 0 ? Math.floor(title.out * 16) % 2 === 0 : true;
      if (blink) {
        ctx.globalAlpha = a * (title.out >= 0 ? 1 : 0.55 + 0.45 * Math.sin(t * 3)) * clamp((t - 1.1) / 0.4, 0, 1);
        const txt = U.touchMode ? 'Tippe zum Starten' : 'Drücke Start (Enter)';
        const sc = measure(txt) * 2 < W - 24 && H > 200 ? 2 : 1;
        drawText(ctx, txt, Math.floor(W / 2), Math.floor(H * 0.60), { align: 'center', scale: sc, color: C.ivory, shadow: C.ink });
        ctx.globalAlpha = a;
      }
    }
    // controls hint
    ctx.globalAlpha = a * clamp((t - 1.4) / 0.6, 0, 1);
    const lines = controlsHelp(U.touchMode);
    const bottom = H - safe.b - 6;
    const maxW = W - safe.l - safe.r - 16;
    const wrapped = lines.flatMap((l) => wrap(l, maxW));
    const startY = bottom - wrapped.length * LINE_H - 2;
    if (startY > H * 0.62 + 24) {
      const bw = Math.min(maxW + 8, Math.max(...wrapped.map(measure)) + 20);
      plaque(ctx, Math.floor(W / 2 - bw / 2), startY - 4, bw, wrapped.length * LINE_H + 6, 0.5);
      wrapped.forEach((l, i) => drawText(ctx, l, Math.floor(W / 2), startY + i * LINE_H - 1, { align: 'center', color: C.ivoryDim, shadow: C.ink }));
    }
    ctx.globalAlpha = a * 0.6;
    drawText(ctx, 'v0.1', W - safe.r - 4, safe.t + 2, { align: 'right', color: C.dim, shadow: C.ink });
    ctx.globalAlpha = 1;
    U.hit(0, 0, W, H, startGame);
  }

  // ------------------------------------------------------------------ PAUSE
  const pause = { active: false, t: 0, sel: 0, help: false, prevState: null };
  function pauseRows() {
    const r = U.renderer();
    const p = U.game?.player;
    const usable = ownedItems(p).filter((i) => !PASSIVE.has(i));
    return [
      { id: 'resume', label: 'Fortsetzen' },
      ...(usable.length ? [{ id: 'item', label: 'Item', value: ITEM_NAMES[p?.item] || p?.item || '–', lr: true }] : []),
      { id: 'zoom', label: 'Zoom', value: fmtZoom(U.camera?.target), lr: true },
      { id: 'sound', label: 'Ton', value: U.soundOn ? 'An' : 'Aus', lr: true },
      { id: 'tilt', label: 'Tilt-Shift', value: r ? (r.tiltShift !== false ? 'An' : 'Aus') : '–', lr: true },
      { id: 'help', label: 'Steuerung' },
    ];
  }
  function openPause() {
    if (pause.active) return;
    pause.active = true; pause.t = 0; pause.sel = 0; pause.help = false;
    const g = U.game;
    pause.prevState = g?.state;
    if (g && g.state === 'play') { try { g.state = 'pause'; } catch { /* read-only */ } }
    U.onModal(true, 'pause');
    U.sfx?.play?.('menu_open');
    try { g?.onPause?.(true); } catch { /* ignore */ }
  }
  function closePause() {
    if (!pause.active) return;
    pause.active = false;
    const g = U.game;
    if (g && g.state === 'pause' && pause.prevState === 'play') { try { g.state = 'play'; } catch { /* ignore */ } }
    U.onModal(false, 'pause');
    U.sfx?.play?.('menu_close');
    try { g?.onPause?.(false); } catch { /* ignore */ }
  }
  function cycleItem(dir) {
    const p = U.game?.player; if (!p) return;
    const usable = ownedItems(p).filter((i) => !PASSIVE.has(i));
    if (!usable.length) return;
    let i = usable.indexOf(p.item);
    i = (i + dir + usable.length) % usable.length;
    p.item = usable[i];
  }
  function rowAction(id, dir) {
    U.sfx?.play?.(dir ? 'menu_move' : 'menu_select');
    switch (id) {
      case 'resume': if (!dir) closePause(); break;
      case 'item': cycleItem(dir || 1); break;
      case 'zoom': U.camera?.zoom?.(dir || 1); break;
      case 'sound': U.setSound(!U.soundOn); break;
      case 'tilt': { const r = U.renderer(); if (r) r.tiltShift = r.tiltShift === false; break; }
      case 'help': if (!dir) pause.help = true; break;
    }
  }
  function updatePause(dt) {
    pause.t += dt;
    if (pause.t < 0.12) return;
    if (pause.help) {
      if (U.confirmPressed() || U.input?.pressed?.('start')) { pause.help = false; U.sfx?.play?.('menu_close'); }
      return;
    }
    if (U.input?.pressed?.('start')) { closePause(); return; }
    const rows = pauseRows();
    pause.sel = clamp(pause.sel, 0, rows.length - 1);
    const n = U.nav();
    if (n.y) { pause.sel = (pause.sel + n.y + rows.length) % rows.length; U.sfx?.play?.('menu_move'); }
    if (n.x && rows[pause.sel].lr) rowAction(rows[pause.sel].id, n.x);
    if (U.confirmPressed()) rowAction(rows[pause.sel].id, 0);
  }
  function invCount() {
    const owned = ownedItems(U.game?.player);
    return BASE_ITEMS.length + owned.filter((i) => !BASE_ITEMS.includes(i)).length;
  }
  function drawInventory(ctx, x, y, w) {
    const p = U.game?.player;
    const owned = new Set(ownedItems(p));
    const list = [...BASE_ITEMS, ...[...owned].filter((i) => !BASE_ITEMS.includes(i))];
    const cols = Math.max(3, Math.min(list.length, Math.floor((w) / 22)));
    drawText(ctx, 'INVENTAR', x, y, { color: C.hair, shadow: C.ink });
    const gy = y + 12;
    list.forEach((id, i) => {
      const cx = x + (i % cols) * 22, cy = gy + Math.floor(i / cols) * 22;
      const has = owned.has(id);
      const sel = p?.item === id;
      pxRect(ctx, cx, cy, 20, 20, sel ? C.hair : rgba(C.hair, 0.25), 1);
      pxRect(ctx, cx + 1, cy + 1, 18, 18, rgba(C.bg0, 0.6), 0);
      if (has) {
        const ic = U.icon(id);
        if (ic) U.drawIcon(ctx, ic, cx + 10, cy + 10, 16);
        if (!PASSIVE.has(id)) U.hit(cx, cy, 20, 20, () => { p.item = id; U.sfx?.play?.('menu_select'); });
      } else { ctx.fillStyle = rgba(C.stone_lt, 0.35); ctx.fillRect(cx + 9, cy + 9, 2, 2); }
    });
    const rowsN = Math.ceil(list.length / cols);
    let yy = gy + rowsN * 22 + 3;
    // counters line
    const pl = p || {};
    let xx = x;
    for (const [k, v] of [['rupee', pl.rupees ?? 0], ['bomb', pl.bombs ?? 0], ['key', pl.keys ?? 0], ['heart_full', `${Math.ceil((pl.hp ?? 0) / 2)}/${Math.ceil((pl.maxHp ?? 0) / 2)}`]]) {
      const ic = U.icon(k); if (ic) U.drawIcon(ctx, ic, xx + 4, yy + 5, 8);
      xx += 10 + drawText(ctx, String(v), xx + 10, yy - 1, { color: C.white, shadow: C.ink }) + 8;
    }
    return yy + 12 - y;
  }
  function drawRows(ctx, x, y, w) {
    const rows = pauseRows();
    rows.forEach((r, i) => {
      const yy = y + i * 14;
      const sel = i === pause.sel;
      if (sel) { ctx.fillStyle = rgba(C.hair, 0.14); ctx.fillRect(x - 2, yy - 1, w + 4, 13); }
      if (sel && Math.floor(U.time * 3) % 3 !== 2) drawText(ctx, '▶', x, yy, { color: C.hair, shadow: C.ink });
      drawText(ctx, r.label, x + 9, yy, { color: sel ? C.ivory : C.ivoryDim, shadow: C.ink });
      if (r.value != null) {
        const vx = x + w;
        const vw = drawText(ctx, r.lr ? `◀ ${r.value} ▶` : r.value, vx, yy, { align: 'right', color: sel ? C.hair : C.dim, shadow: C.ink });
        void vw;
      }
      if (r.lr) {
        U.hit(x - 2, yy - 1, Math.floor(w / 2) + 2, 13, () => { pause.sel = i; rowAction(r.id, r.id === 'sound' || r.id === 'tilt' ? 0 : -1); });
        U.hit(x + Math.floor(w / 2), yy - 1, Math.ceil(w / 2) + 2, 13, () => { pause.sel = i; rowAction(r.id, r.id === 'sound' || r.id === 'tilt' ? 0 : 1); });
      } else U.hit(x - 2, yy - 1, w + 4, 13, () => { pause.sel = i; rowAction(r.id, 0); });
    });
    return rows.length * 14;
  }
  function drawPause(ctx) {
    const { W, H, safe } = U;
    const a = clamp(pause.t / 0.15, 0, 1);
    ctx.globalAlpha = 0.6 * a; ctx.fillStyle = C.bg0; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const aw = W - safe.l - safe.r - 12, ah = H - safe.t - safe.b - 8;
    if (pause.help) return drawHelp(ctx, aw, ah);
    const wide = aw >= 360;
    const pw = wide ? Math.min(aw, 400) : Math.min(aw, 250);
    const invW = wide ? 5 * 22 : pw - 24;
    const invRows = Math.ceil(invCount() / Math.max(3, Math.min(invCount(), Math.floor(invW / 22))));
    const ph = wide ? Math.max(140, 22 + 12 + invRows * 22 + 30) : 22 + (12 + invRows * 22 + 15) + 4 + pauseRows().length * 14 + 8;
    const px = Math.floor(safe.l + 6 + (aw - pw) / 2);
    const py = Math.floor(safe.t + 4 + Math.max(0, (ah - ph) / 2));
    panel(ctx, px, py, pw, Math.min(ph, ah), { alpha: 0.94 });
    drawText(ctx, '- PAUSE -', px + Math.floor(pw / 2), py + 6, { align: 'center', color: C.ivory, shadow: C.ink });
    if (wide) {
      const colW = invW;
      drawInventory(ctx, px + 12, py + 22, colW);
      ctx.fillStyle = rgba(C.hair, 0.3); ctx.fillRect(px + 12 + colW + 8, py + 24, 1, 104);
      drawRows(ctx, px + colW + 32, py + 30, pw - colW - 46);
    } else {
      const ih = drawInventory(ctx, px + 12, py + 22, invW);
      drawRows(ctx, px + 12, py + 26 + ih, pw - 24);
    }
    U.hit(0, 0, W, H, () => {}, -1); // swallow taps outside
  }
  function drawHelp(ctx, aw, ah) {
    const { W, safe } = U;
    const pw = Math.min(aw, 290);
    const kb = controlsHelp(false), tc = controlsHelp(true);
    const sections = U.touchMode ? [['TOUCH', tc], ['TASTATUR', kb]] : [['TASTATUR', kb], ['TOUCH', tc]];
    const lines = [];
    for (const [h, ls] of sections) { lines.push({ h }); for (const l of ls) for (const w of wrap(l, pw - 24)) lines.push({ t: w }); lines.push({ t: '' }); }
    const ph = Math.min(ah, 22 + lines.length * LINE_H + 10);
    const px = Math.floor(safe.l + 6 + (aw - pw) / 2), py = Math.floor(safe.t + 4 + (ah - ph) / 2);
    panel(ctx, px, py, pw, ph, { alpha: 0.95 });
    drawText(ctx, '- STEUERUNG -', px + Math.floor(pw / 2), py + 6, { align: 'center', color: C.ivory, shadow: C.ink });
    let y = py + 22;
    for (const l of lines) {
      if (y > py + ph - 14) break;
      if (l.h) drawText(ctx, l.h, px + 12, y, { color: C.hair, shadow: C.ink });
      else drawText(ctx, l.t, px + 12, y, { color: C.white, shadow: C.ink });
      y += LINE_H;
    }
    U.hit(0, 0, W, U.H, () => { pause.help = false; });
  }

  // ------------------------------------------------------------------ GAME OVER
  const over = { active: false, t: 0, sel: 0, cb: null, prevState: null };
  function showGameOver(onRetry) {
    over.active = true; over.t = 0; over.sel = 0; over.cb = onRetry || null;
    U.onModal(true, 'gameover');
    U.sfx?.play?.('game_over'); U.sfx?.music?.(null);
    U.haptic?.([80, 60, 120]);
  }
  function chooseOver(i) {
    if (!over.active || over.t < 1.3) return;
    over.active = false; U.onModal(false, 'gameover');
    over.dismissed = true;
    const choice = i === 0 ? 'continue' : 'restart';
    U.sfx?.play?.('menu_select');
    const g = U.game;
    try {
      if (over.cb) over.cb(choice);
      else if (choice === 'continue') (g?.retry || g?.continue || g?.start)?.call(g);
      else if (g?.restart) g.restart();
      else location.reload();
    } catch (e) { console.error('[ui] retry failed', e); }
  }
  function updateOver(dt) {
    over.t += dt;
    if (over.t < 1.3) return;
    const n = U.nav();
    if (n.y || n.x) { over.sel = (over.sel + 1) % 2; U.sfx?.play?.('menu_move'); }
    if (U.confirmPressed() || U.input?.pressed?.('start')) chooseOver(over.sel);
  }
  function drawOver(ctx) {
    const { W, H } = U;
    const t = over.t;
    {
      const k = clamp(t / 1.0, 0, 1);
      const g = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.7);
      g.addColorStop(0, rgba('#2a0c18', 0.55 * k)); g.addColorStop(1, rgba(C.bg0, 0.92 * k));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    const txt = 'GAME OVER';
    const sc = measure(txt) * 3 < W - 24 ? 3 : 2;
    const n = Math.floor(clamp((t - 0.3) / 0.6, 0, 1) * txt.length);
    const rows = ['#fff0e8', '#f8d8cc', '#f0b8a8', '#e89888', '#d87868', '#c85850', '#a84040'];
    const full = measure(txt) * sc;
    const shown = txt.slice(0, n);
    drawText(ctx, shown, Math.floor(W / 2 - full / 2), Math.floor(H * 0.3), { scale: sc, color: rows, shadow: C.ink });
    if (t >= 1.3) {
      const opts = ['Weiter', 'Neustart'];
      const ow = 120, oh = opts.length * 16 + 12;
      const ox = Math.floor(W / 2 - ow / 2), oy = Math.floor(H * 0.3 + LINE_H * sc + 16);
      panel(ctx, ox, oy, ow, oh, { alpha: 0.92 });
      opts.forEach((o, i) => {
        const yy = oy + 7 + i * 16;
        const sel = i === over.sel;
        if (sel && Math.floor(U.time * 3) % 3 !== 2) drawText(ctx, '▶', ox + 12, yy, { color: C.hair, shadow: C.ink });
        drawText(ctx, o, ox + 24, yy, { color: sel ? C.ivory : C.ivoryDim, shadow: C.ink });
        U.hit(ox, yy - 2, ow, 15, () => { over.sel = i; chooseOver(i); });
      });
    }
    U.hit(0, 0, W, H, () => {}, -1);
  }

  return {
    title, pause, over,
    showTitle, showGameOver, openPause, closePause, closeTitle, checkTitle,
    update(dt) {
      if (title.active) updateTitle(dt);
      else if (over.active) updateOver(dt);
      else if (pause.active) updatePause(dt);
    },
    draw(ctx) {
      checkTitle();
      if (pause.active) drawPause(ctx);
      if (over.active) drawOver(ctx);
      if (title.active) drawTitle(ctx);
    },
  };
}
