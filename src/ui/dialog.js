// Dialog box (STYLE_GUIDE §8): bottom, 3 lines, ui_frame border + ink outline, night 90 %,
// typewriter 36 chars/s with 'text_blip', blinking continue arrow (2 Hz), optional choices (Ja/Nein).
import { drawText, measure, wrap, LINE_H } from './font.js';
import { C, panel, rgba } from './theme.js';

const CPS = 36, LINES = 3;

/** Normalise dialog input into segments [{text, speaker, choices}] */
function normalise(lines, opts) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const segs = [];
  for (const l of arr) {
    if (l == null) continue;
    if (typeof l === 'string' || typeof l === 'number') segs.push({ text: String(l) });
    else if (typeof l === 'object') segs.push({ text: String(l.text ?? l.t ?? ''), speaker: l.speaker ?? l.name, choices: l.choices });
  }
  if (!segs.length) segs.push({ text: '' });
  if (opts?.choices && !segs.some((s) => s.choices)) segs[segs.length - 1].choices = opts.choices;
  if (opts?.speaker) segs.forEach((s) => { if (s.speaker == null) s.speaker = opts.speaker; });
  return segs;
}

export function createDialog(U) {
  let cur = null;           // active dialog
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

  function layout() {
    const { W, H, safe } = U;
    const bw = Math.min(W - safe.l - safe.r - 12, 256);
    const bh = LINES * LINE_H + 14;
    const x = Math.floor(safe.l + (W - safe.l - safe.r - bw) / 2);
    const y = H - safe.b - bh - 8;
    return { x, y, w: bw, h: bh, tw: bw - 20 };
  }

  function paginate(d, tw) {
    if (d.pages && d.tw === tw) return;
    const pages = [];
    for (const s of d.segs) {
      const ls = wrap(s.text, tw);
      for (let i = 0; i < ls.length; i += LINES) pages.push({ lines: ls.slice(i, i + LINES), speaker: s.speaker, choices: null });
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
    const L = layout(); paginate(d, L.tw);
    const p = d.pages[d.page];
    const total = pageLen(p);
    if (d.chars < total) {
      const fast = U.input?.down?.('attack') || U.input?.down?.('action') ? 3 : 1;
      const before = Math.floor(d.chars);
      d.chars = Math.min(total, d.chars + dt * CPS * fast);
      // blip every 2 visible chars
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

  function draw(ctx) {
    const d = cur; if (!d) return;
    const L = layout(); paginate(d, L.tw);
    const p = d.pages[d.page];
    const pop = Math.min(1, d.age / 0.12);
    const h = Math.max(10, Math.round(L.h * pop));
    const y = L.y + Math.floor((L.h - h) / 2);
    panel(ctx, L.x, y, L.w, h, { alpha: 0.9 });
    // full-box tap target (advance)
    U.hit(L.x, L.y, L.w, L.h, () => advance());
    if (pop < 1) return;
    if (p.speaker) {
      const sw = measure(p.speaker) + 12;
      panel(ctx, L.x + 6, L.y - 16, sw, 18, { alpha: 1 });
      drawText(ctx, p.speaker, L.x + 12, L.y - 12, { color: [C.gold_lt, C.gold_lt, C.gold_md, C.gold_md, C.gold_md, C.gold_dk, C.gold_dk], shadow: C.ink });
    }
    // typewriter text
    let left = Math.floor(d.chars);
    for (let i = 0; i < p.lines.length; i++) {
      const line = p.lines[i];
      const vis = line.slice(0, Math.max(0, left));
      left -= line.length + 1;
      if (vis) drawText(ctx, vis, L.x + 10, L.y + 6 + i * LINE_H, { color: C.white, shadow: C.ink });
    }
    const done = d.chars >= pageLen(p);
    if (done && !d.choosing && Math.floor(U.time * 4) % 2 === 0) {
      drawText(ctx, '▼', L.x + L.w - 14, L.y + L.h - 13 + (Math.floor(U.time * 4) % 4 === 0 ? 1 : 0), { color: C.gold_lt, shadow: C.ink });
    }
    if (d.choosing && p.choices) {
      const cw = Math.max(...p.choices.map(measure)) + 26;
      const ch = p.choices.length * 13 + 9;
      const cx = L.x + L.w - cw - 4, cy = L.y - ch - 2;
      panel(ctx, cx, cy, cw, ch, { alpha: 0.95 });
      p.choices.forEach((c, i) => {
        const yy = cy + 5 + i * 13;
        const sel = i === d.choice;
        if (sel) { ctx.fillStyle = rgba(C.frame, 0.18); ctx.fillRect(cx + 4, yy, cw - 8, 12); }
        if (sel && Math.floor(U.time * 3) % 3 !== 2) drawText(ctx, '▶', cx + 7, yy, { color: C.gold_lt, shadow: C.ink });
        drawText(ctx, c, cx + 15, yy, { color: sel ? C.white : C.dim, shadow: C.ink });
        U.hit(cx, yy - 1, cw, 13, () => { d.choice = i; advance(); });
      });
    }
  }

  return {
    open, update, draw,
    get active() { return !!cur; },
    tapAnywhere() { if (cur && !cur.choosing && cur.age > 0.18) advance(); },
    close() { if (cur) { queue.length = 0; finish(); } },
  };
}
