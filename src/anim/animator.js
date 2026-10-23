// Data-driven sprite animator. One instance per entity. Never throws on missing assets.
import { ANIM_DEFS, DEFAULT_DEF, MIN_MS, GENERIC_FALLBACK } from './defs.js';

const DIRS = ['down', 'up', 'left', 'right'];
const MIRROR = { left: 'right', right: 'left' };
let placeholder = null;

function getPlaceholder() {
  if (placeholder !== null) return placeholder || null;
  try {
    if (typeof document === 'undefined') { placeholder = false; return null; }
    const c = document.createElement('canvas'); c.width = 12; c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#181020'; g.fillRect(0, 0, 12, 16);
    g.fillStyle = '#c890e0'; g.fillRect(1, 1, 10, 14);
    g.fillStyle = '#f8f8f8'; g.fillRect(3, 3, 2, 2); g.fillRect(7, 3, 2, 2);
    c.ax = 6; c.ay = 15; c.placeholder = true;
    placeholder = c;
  } catch { placeholder = false; }
  return placeholder || null;
}

// Resample a ms array to n frames keeping the total duration.
function resample(ms, n) {
  if (ms.length === n) return ms.map((v) => Math.max(MIN_MS, v));
  const total = ms.reduce((a, b) => a + b, 0);
  const out = [];
  for (let i = 0; i < n; i++) out.push(ms[Math.min(ms.length - 1, Math.floor((i * ms.length) / n))]);
  const sum = out.reduce((a, b) => a + b, 0) || 1;
  return out.map((v) => Math.max(MIN_MS, Math.round((v * total) / sum)));
}

function resampleEvents(events, expected, n) {
  const out = {};
  if (!events) return out;
  for (const k of Object.keys(events)) {
    const i = expected === n ? +k : Math.min(n - 1, Math.round((+k * n) / expected));
    const list = Array.isArray(events[k]) ? events[k] : [events[k]];
    (out[i] ||= []).push(...list);
  }
  return out;
}

export class Animator {
  constructor(assets, name, opts = {}) {
    this.assets = assets || {};
    this.name = name;
    this.defs = opts.defs || ANIM_DEFS[name] || {};
    this.action = null; this.dir = 'down';
    this.speed = 1;
    this.t = 0;              // ms inside current frame
    this.elapsed = 0;        // ms since play()
    this.i = 0;              // frame index
    this._done = false;
    this._events = [];       // events fired during the last update()/play()
    this.onEvent = opts.onEvent || null;
    this._cache = new Map();
    this.cur = null;
    this.play(opts.action || 'idle', opts.dir || 'down');
  }

  // Re-resolve sprites (e.g. after assets were rebuilt).
  refresh(assets) { if (assets) this.assets = assets; this._cache.clear(); this.play(this.action, this.dir, { restart: false, force: true }); }

  _sprites() { return this.assets.sprites || {}; }

  _def(action) { return this.defs[action] || ANIM_DEFS[this.name]?.[action] || null; }

  // find frames for one action: returns { frames, flip } or null
  _framesFor(action, dir) {
    const S = this._sprites();
    const def = this._def(action);
    const base = def?.key || `${this.name}_${action}`;
    const ok = (a) => Array.isArray(a) ? (a.length ? a : null) : (a ? [a] : null);
    let f;
    if (def?.dir !== false) {
      if ((f = ok(S[`${base}_${dir}`]))) return { frames: f, flip: false };
    }
    if ((f = ok(S[base]))) return { frames: f, flip: false };
    if (action === 'idle' && (f = ok(S[this.name]))) return { frames: f, flip: false }; // objects: key = name
    if (def?.dir !== false) {
      const m = MIRROR[dir];
      if (m && (f = ok(S[`${base}_${m}`]))) return { frames: f, flip: true };
      for (const d of DIRS) if ((f = ok(S[`${base}_${d}`]))) return { frames: f, flip: false };
    }
    return null;
  }

  _resolve(action, dir) {
    const ck = action + '|' + dir;
    let r = this._cache.get(ck);
    if (r) return r;
    const def = this._def(action) || DEFAULT_DEF;
    let found = this._framesFor(action, dir), real = !!found;
    const tried = new Set([action]);
    const chain = [...(def.fallback || []), ...GENERIC_FALLBACK];
    for (const a of chain) {
      if (found) break;
      if (tried.has(a)) continue;
      tried.add(a);
      found = this._framesFor(a, dir);
    }
    if (!found) {
      const S = this._sprites();
      const pick = (a) => Array.isArray(a) ? (a.length ? a : null) : (a ? [a] : null);
      let f = pick(S[this.name]) || pick(S[`${this.name}_idle_down`]);
      if (!f) {
        const k = Object.keys(S).find((k) => k.startsWith(this.name + '_') && pick(S[k]));
        if (k) f = pick(S[k]);
      }
      if (!f) { const p = getPlaceholder(); f = p ? [p] : [null]; }
      found = { frames: f, flip: false };
    }
    if (def.pick && real) {
      const sub = def.pick.map((i) => found.frames[Math.min(found.frames.length - 1, i)]).filter(Boolean);
      if (sub.length) found = { ...found, frames: sub };
    }
    const n = found.frames.length;
    const msArr = Array.isArray(def.ms) ? def.ms : Array(def.frames || n).fill(def.ms ?? DEFAULT_DEF.ms);
    const expected = def.frames || msArr.length;
    // Art has fewer frames than the definition → keep the definition's timeline (so 'hit' etc. fire at the
    // designed moment) and map steps onto the available frames. More frames → resample timing to the art.
    const steps = Math.max(n, expected);
    r = {
      action, dir, real,
      frames: found.frames, flip: found.flip, n, steps,
      map: n < expected ? (i) => Math.min(n - 1, Math.floor((i * n) / expected)) : (i) => i,
      ms: n < expected ? resample(msArr, expected) : resample(msArr, n),
      events: resampleEvents(def.events, expected, steps),
      loop: def.loop !== false,
    };
    r.total = r.ms.reduce((a, b) => a + b, 0);
    this._cache.set(ck, r);
    return r;
  }

  // Is there real art for this action (no fallback)?
  has(action, dir = this.dir) { return this._resolve(action, dir).real; }

  play(action, dir = this.dir, o = {}) {
    if (!action) action = 'idle';
    if (!dir) dir = this.dir || 'down';
    if (o.speed != null) this.speed = o.speed;
    const same = action === this.action;
    if (same && dir === this.dir && !o.restart && !o.force) return this;
    const prevI = this.i, prevT = this.t;
    this.action = action; this.dir = dir;
    this.cur = this._resolve(action, dir);
    if (same && !o.restart) {
      // direction change inside the same action keeps the phase (walk cycle doesn't restart)
      this.i = Math.min(prevI, this.cur.steps - 1); this.t = prevT;
    } else {
      this.i = 0; this.t = 0; this.elapsed = 0; this._done = false;
      this._events = [];
      this._fire(0);
      this._fresh = false; // keep frame-0 events readable through the next update()
    }
    return this;
  }

  _fire(i) {
    const ev = this.cur.events[i];
    if (!ev) return;
    for (const e of ev) { this._events.push(e); if (this.onEvent) try { this.onEvent(e, this); } catch (err) { console.error(err); } }
  }

  update(dt) {
    // events of play() stay readable until the next update consumes them
    if (this._fresh) this._events = [];
    this._fresh = true;
    const c = this.cur;
    if (!c || this._done) return this;
    let ms = dt * 1000 * this.speed;
    if (!(ms > 0)) return this;
    this.elapsed += ms;
    this.t += ms;
    let guard = 64;
    while (this.t >= c.ms[this.i] && guard-- > 0) {
      this.t -= c.ms[this.i];
      if (this.i + 1 < c.steps) this.i++;
      else if (c.loop) this.i = 0;
      else { this._done = true; this.t = c.ms[this.i]; break; }
      this._fire(this.i);
    }
    return this;
  }

  get frame() { return this.cur ? this.cur.frames[this.cur.map(this.i)] || null : null; }
  get flip() { return !!this.cur?.flip; }
  get frameIndex() { return this.cur ? this.cur.map(this.i) : 0; }
  get step() { return this.i; }          // index on the timeline (= frameIndex unless art has fewer frames)
  get frameCount() { return this.cur?.n || 0; }
  get done() { return this._done; }
  get loop() { return !!this.cur?.loop; }
  // once: 0..1 over the whole animation; loop: position inside the current cycle
  get progress() {
    const c = this.cur; if (!c || !c.total) return 1;
    if (this._done) return 1;
    let before = 0; for (let k = 0; k < this.i; k++) before += c.ms[k];
    return Math.min(1, (before + this.t) / c.total);
  }
  get duration() { return (this.cur?.total || 0) / 1000; }
  // first event fired in the last update (or by play()), else null
  get event() { return this._events[0] || null; }
  get events() { return this._events; }
  hasEvent(name) { return this._events.includes(name); }
  is(action) { return this.action === action; }

  // convenience: draw with the render helper
  draw(r, x, y, z = 0, o = {}) {
    const f = this.frame; if (!f) return;
    r.sprite(f, x, y, z, this.flip ? { ...o, flip: !o.flip } : o);
  }
}
