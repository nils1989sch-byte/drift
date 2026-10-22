// Dialog (HD-2D / Octopath look): translucent parchment speech bubble with an irregular dark rim,
// dark name tab top-left, optional tail pointing at the speaker (anchor), dark pixel text on light paper.
// Typewriter 36 chars/s with 'text_blip', blinking continue arrow (2 Hz), optional choices (Ja/Nein).
import { drawText, measure, wrap } from './font.js';
import { C, bubble, clamp } from './theme.js';

const CPS = 36, LINES = 3, LH = 12, PADX = 11, PADY = 8;
const TEXT = { color: C.textDk, shadow: C.textSh };

/** Normalise dialog input into segments [{text, speaker, choices, anchor}] */
function normalise(lines, opts) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const segs = [];
  for (const l of arr) {
    if (l == null) continue;
    if (typeof l === 'string' || typeof l === 'number') segs.push({ text: String(l) });
    else if (typeof l === 'object') segs.push({ text: String(l.text ?? l.t ?? ''), speaker: l.speaker ?? l.name, choices: l.choices, anchor: l.anchor });
  }
  if (!segs.length) segs.push({ text: '' });
  if (opts?.choices && !segs.some((s) => s.choices)) segs[segs.length - 1].choices = opts.choices;
  for (const s of segs) {
    if (s.speaker == null && opts?.speaker) s.speaker = opts.speaker;
    if (s.anchor == null && opts?.anchor) s.anchor = opts.anchor;
  }
  return segs;
}

export function createDialog(U) {
  let cur = null;
  const queue = [];

  function open(lines, opts = {}) {
    return new Promise((resolve) => {
      const d = { segs: normalise(lines, opts), resolve, result: true };
      if (cur) queue.push(d); else start(d);
    });
  }
  function start(d) {
    cur = d;
    d.pages = null; d.page = 0; d.chars = 0; d.blipAcc = 0; d.age = 0; d.choice = 0; d.choosing = false;
    U.onModal?.(true, 'dialog');
  }

  /**
   * Resolve an anchor to UI px. Accepts {x,y} in game-canvas device px (default), {x,y,space:'css'},
   * {x,y,z,world:true} (via renderer.worldToScreen), an entity {x,y,z} with world:true, or a function returning one.
   */
  function anchorUi(a) {
    if (!a) return null;
    try {
      if (typeof a === 'function') a = a();
      if (!a) return null;
      let x = a.x, y = a.y;
      if (a.world || a.space === 'world') {
        const r = U.renderer?.();
        if (!r?.worldToScreen) return null;
        const p = r.worldToScreen(a.x, a.y, a.z || 0);
        if (!p) return null;
        x = p.x ?? p[0]; y = p.y ?? p[1];
        if (p.space === 'css') { x *= U.dpr; y *= U.dpr; }
      } else if (a.space === 'css') { x *= U.dpr; y *= U.dpr; }
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      let b = a.bottom ?? a.by;
      if (Number.isFinite(b)) b = a.space === 'css' ? b * U.dpr : b;
      return { x: Math.round(x / U.S), y: Math.round(y / U.S), bottom: Number.isFinite(b) ? Math.round(b / U.S) : null };
    } catch { return null; }
  }

  function layout(d) {
    const { W, H, safe } = U;
    const bw = Math.min(W - safe.l - safe.r - 12, 272);
    const bh = LINES * LH + PADY * 2 + 2;
    let x = Math.floor(safe.l + (W - safe.l - safe.r - bw) / 2);
    let y = H - safe.b - bh - 8;
    const page = d.pages?.[d.page];
    const seg = page?.anchor;
    const an = anchorUi(seg);
    let tail = null;
    if (an && an.x > -20 && an.x < W + 20 && an.y > -20 && an.y < H + 20) {
      const gap = 14; // keep the bubble clear of the speaker's head
      const above = an.y - gap - bh - 8 >= safe.t + 28;
      const foot = an.bottom ?? an.y + 30; // below the speaker: point at the feet, don't cover the figure
      y = above ? an.y - gap - 8 - bh : Math.min(H - safe.b - bh - 4, foot + gap + 8);
      x = clamp(Math.round(an.x - bw / 2), safe.l + 4, W - safe.r - bw - 4);
      tail = { tx: an.x, ty: above ? an.y - gap + 4 : foot + 4, up: !above };
    }
    return { x, y, w: bw, h: bh, tw: bw - PADX * 2, tail };
  }

  function paginate(d, tw) {
    if (d.pages && d.tw === tw) return;
    const pages = [];
    for (const s of d.segs) {
      const ls = wrap(s.text, tw);
      for (let i = 0; i < ls.length; i += LINES) pages.push({ lines: ls.slice(i, i + LINES), speaker: s.speaker, anchor: s.anchor, choices: null });
      if (s.choices?.length) pages[pages.length - 1].choices = s.choices.map(String);
    }
    d.pages = pages; d.tw = tw;
    d.page = Math.min(d.page, pages.length - 1);
  }
  const pageLen = (p) => p.lines.reduce((a, l) => a + l.length, 0) + p.lines.length;

  function finish() {
    const d = cur; cur = null;
    U.onModal?.(false, 'dialog');
    d.resolve(d.result);
    if (queue.length) start(queue.shift());
  }
  function advance() {
    const d = cur; if (!d || !d.pages) return;
    const p = d.pages[d.page];
    if (d.chars < pageLen(p)) { d.chars = pageLen(p); return; }
    if (p.choices && !d.choosing) { d.choosing = true; d.choice = 0; return; }
    if (d.choosing) { d.result = d.choice; d.choosing = false; U.sfx?.play?.('menu_select'); }
    else U.sfx?.play?.('text_next');
    if (d.page < d.pages.length - 1) { d.page++; d.chars = 0; }
    else finish();
  }

  function update(dt) {
    const d = cur; if (!d) return;
    d.age += dt;
    const W0 = Math.min(U.W - U.safe.l - U.safe.r - 12, 272) - PADX * 2;
    paginate(d, W0);
    const p = d.pages[d.page];
    const total = pageLen(p);
    if (d.chars < total) {
      const fast = U.input?.down?.('attack') || U.input?.down?.('action') ? 3 : 1;
      const before = Math.floor(d.chars);
      d.chars = Math.min(total, d.chars + dt * CPS * fast);
      const flat = p.lines.join('\n');
      for (let i = before; i < Math.floor(d.chars); i++) {
        const ch = flat[i];
        if (ch && ch !== ' ' && ch !== '\n' && (d.blipAcc++ % 2 === 0)) U.sfx?.play?.('text_blip');
      }
      if (d.chars >= total && p.choices) d.choosing = true;
    }
    if (d.choosing) {
      const n = U.nav();
      if (n.y) { d.choice = (d.choice + n.y + p.choices.length) % p.choices.length; U.sfx?.play?.('menu_move'); }
    }
    if (d.age > 0.18 && U.confirmPressed()) advance();
  }

  function drawTail(ctx, L) {
    const t = L.tail; if (!t) return;
    const bx = clamp(t.tx, L.x + 14, L.x + L.w - 14);
    const by = t.up ? L.y + 2 : L.y + L.h - 3;
    const len = Math.abs(t.ty - by);
    if (len < 3) return;
    for (let i = 0; i <= len; i++) {
      const k = i / len;
      const cx = Math.round(bx + (t.tx - bx) * k);
      const yy = t.up ? by - i : by + i;
      const hw = Math.round(5 * (1 - k));
      ctx.fillStyle = C.edge; ctx.fillRect(cx - hw - 2, yy, hw * 2 + 4, 1);
      if (hw >= 1 && i < len - 1) { ctx.fillStyle = C.parch; ctx.fillRect(cx - hw, yy, hw * 2, 1); }
    }
  }

  function draw(ctx) {
    const d = cur; if (!d) return;
    const W0 = Math.min(U.W - U.safe.l - U.safe.r - 12, 272) - PADX * 2;
    paginate(d, W0);
    const L = layout(d);
    const p = d.pages[d.page];
    const pop = clamp(d.age / 0.14, 0, 1);
    const pa = ctx.globalAlpha;
    ctx.globalAlpha = pa * pop * 0.94;
    const yOff = Math.round((1 - pop) * 4);
    // soft shadow under the bubble
    ctx.globalAlpha = pa * pop * 0.28; ctx.fillStyle = C.ink;
    ctx.fillRect(L.x + 4, L.y + 3 + yOff, L.w - 4, L.h - 2);
    ctx.globalAlpha = pa * pop * 0.94;
    ctx.save(); ctx.translate(0, yOff);
    ctx.drawImage(bubble(L.w, L.h, 3), L.x, L.y);
    drawTail(ctx, L);
    ctx.globalAlpha = pa * pop;
    U.hit(L.x, L.y, L.w, L.h, () => advance());
    if (p.speaker) {
      const sw = measure(p.speaker) + 14;
      const tx = L.x + 8, ty = L.y - 11;
      ctx.globalAlpha = pa * pop * 0.92;
      ctx.fillStyle = C.edge; ctx.fillRect(tx + 1, ty, sw - 2, 15); ctx.fillRect(tx, ty + 1, sw, 13);
      ctx.fillStyle = C.plaque; ctx.fillRect(tx + 1, ty + 1, sw - 2, 13);
      ctx.globalAlpha = pa * pop * 0.6; ctx.fillStyle = C.hair; ctx.fillRect(tx + 2, ty + 13, sw - 4, 1);
      ctx.globalAlpha = pa * pop;
      drawText(ctx, p.speaker, tx + 7, ty + 1, { color: C.ivory, shadow: C.ink });
    }
    if (pop >= 1) {
      let left = Math.floor(d.chars);
      const ty0 = L.y + PADY + (p.speaker ? 3 : 1);
      for (let i = 0; i < p.lines.length; i++) {
        const line = p.lines[i];
        const vis = line.slice(0, Math.max(0, left));
        left -= line.length + 1;
        if (vis) drawText(ctx, vis, L.x + PADX, ty0 + i * LH - 2, TEXT);
      }
      const done = d.chars >= pageLen(p);
      if (done && !d.choosing && Math.floor(U.time * 4) % 2 === 0) {
        drawText(ctx, '▼', L.x + L.w - 16, L.y + L.h - 15 + (Math.floor(U.time * 4) % 4 === 0 ? 1 : 0), { color: C.accent, shadow: C.textSh });
      }
    }
    ctx.restore();
    if (pop >= 1 && d.choosing && p.choices) {
      const cw = Math.max(...p.choices.map(measure)) + 30;
      const ch = p.choices.length * 13 + 12;
      const cx = L.x + L.w - cw - 6;
      const { H, safe } = U;
      const below = L.y + L.h + 4, above = L.y - ch - 3 - (p.speaker ? 4 : 0);
      const cy = L.tail?.up
        ? (below + ch <= H - safe.b - 2 ? below : above >= safe.t + 26 ? above : L.y + L.h - ch - 4)
        : (above >= safe.t + 26 ? above : below + ch <= H - safe.b - 2 ? below : L.y + L.h - ch - 4);
      ctx.globalAlpha = pa * 0.94;
      ctx.drawImage(bubble(cw, ch, 11), cx, cy);
      ctx.globalAlpha = pa;
      p.choices.forEach((c, i) => {
        const yy = cy + 6 + i * 13;
        const sel = i === d.choice;
        if (sel) { ctx.globalAlpha = pa * 0.55; ctx.fillStyle = C.parchDk; ctx.fillRect(cx + 4, yy, cw - 8, 12); ctx.globalAlpha = pa; }
        if (sel && Math.floor(U.time * 3) % 3 !== 2) drawText(ctx, '▶', cx + 8, yy, { color: C.accent, shadow: C.textSh });
        drawText(ctx, c, cx + 17, yy, { color: sel ? C.textDk : C.edgeLt, shadow: C.textSh });
        U.hit(cx, yy - 1, cw, 13, () => { d.choice = i; advance(); });
      });
    }
    ctx.globalAlpha = pa;
  }

  return {
    open, update, draw,
    get active() { return !!cur; },
    tapAnywhere() { if (cur && !cur.choosing && cur.age > 0.18) advance(); },
    close() { if (cur) { queue.length = 0; finish(); } },
  };
}
