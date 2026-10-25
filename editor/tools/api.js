// Adapter between the DRIFT editor core (docs/EDITOR.md) and the smart tools in editor/tools + editor/inspectors.
// Every plugin talks to the core ONLY through this file, so API changes of the core are absorbed here.
import { Grid, TILE } from './lib/grid.js';

export const clone = (o) => (o == null ? o : typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

export function makeApi(editor) {
  const T = { editor, TILE };

  // ---------- document access ----------
  T.doc = () => editor.doc;
  T.project = () => editor.doc?.project ?? editor.doc;
  T.maps = () => {
    const d = editor.doc || {};
    const m = d.maps ?? d.project?.maps ?? {};
    return Array.isArray(m) ? Object.fromEntries(m.map((x) => [x.id, x])) : m;
  };
  T.mapId = () => editor.doc?.currentMap ?? editor.doc?.mapId ?? editor.view?.mapId ?? editor.state?.mapId ?? editor.currentMapId ?? Object.keys(T.maps())[0];
  T.map = (id = T.mapId()) => (typeof editor.doc?.map === 'function' ? editor.doc.map(id) : null) ?? T.maps()[id] ?? (id === T.mapId() ? editor.doc?.map : null);
  T.coll = (name) => { const d = editor.doc || {}; return d[name] ?? d.project?.[name] ?? {}; };
  T.species = () => T.coll('species');
  T.moves = () => T.coll('moves');
  T.characters = () => T.coll('characters');
  T.dialogs = () => T.coll('dialogs');
  T.grid = (id) => Grid.fromMap(T.map(id));

  // ---------- undoable changes ----------
  // set(path, value): path is an array into editor.doc (e.g. ['maps', id, 'npcs']). Undo restores the old value.
  const getAt = (path) => path.reduce((o, k) => (o == null ? undefined : o[k]), editor.doc);
  const setAt = (path, v) => {
    let o = editor.doc;
    for (let i = 0; i < path.length - 1; i++) { if (o[path[i]] == null) o[path[i]] = {}; o = o[path[i]]; }
    const k = path[path.length - 1];
    if (v === undefined) delete o[k]; else o[k] = v;
  };
  T.mapPath = (id = T.mapId()) => {
    const d = editor.doc || {};
    if (d.maps && !Array.isArray(d.maps)) return ['maps', id];
    if (d.project?.maps && !Array.isArray(d.project.maps)) return ['project', 'maps', id];
    if (Array.isArray(d.maps)) return ['maps', d.maps.findIndex((m) => m.id === id)];
    return ['map'];
  };
  // changes: [{path, value}] – applied as ONE undo step
  T.change = (label, changes) => {
    const before = changes.map((c) => ({ path: c.path, value: clone(getAt(c.path)) }));
    const after = changes.map((c) => ({ path: c.path, value: clone(c.value) }));
    const op = {
      type: 'set', label, changes: after, before,
      do: () => { for (const c of after) setAt(c.path, clone(c.value)); },
      undo: () => { for (const c of before) setAt(c.path, clone(c.value)); },
    };
    if (typeof editor.apply === 'function') return editor.apply(op);
    op.do(); editor.emit?.('change', op);
  };
  // replace parts of the current map (fields of the map object)
  T.patchMap = (label, fields, id = T.mapId()) => {
    const base = T.mapPath(id);
    T.change(label, Object.entries(fields).map(([k, v]) => ({ path: [...base, k], value: v })));
  };
  // commit a Grid (only if changed) + optional extra map fields
  T.commitGrid = (label, grid, extra = {}, id = T.mapId()) => {
    const map = T.map(id);
    const L = grid.toLayers(map.legend);
    const fields = { ...extra };
    if (grid.diff().length) fields.layers = { ...(map.layers || {}), ground: L.ground, height: L.height }, fields.legend = L.legend;
    if (Object.keys(fields).length) T.patchMap(label, fields, id);
  };
  T.setCollItem = (coll, key, value, label) => {
    const d = editor.doc || {};
    const base = d[coll] != null || d.project == null ? [coll] : ['project', coll];
    T.change(label ?? `${coll}: ${key}`, [{ path: [...base, key], value }]);
  };

  // ---------- view / input ----------
  // tile coordinates (float) from a pointer event of the core
  T.tileOf = (e) => {
    if (!e) return [0, 0];
    if (e.tile) return Array.isArray(e.tile) ? e.tile : [e.tile.x, e.tile.y];
    if (e.tx != null) return [e.tx, e.ty];
    if (e.world) return [e.world.x / TILE, e.world.y / TILE];
    if (e.wx != null) return [e.wx / TILE, e.wy / TILE];
    const v = editor.view;
    if (v?.screenToTile) { const p = v.screenToTile(e.clientX ?? e.x, e.clientY ?? e.y); return Array.isArray(p) ? p : [p.x, p.y]; }
    if (v?.screenToWorld) { const p = v.screenToWorld(e.clientX ?? e.x, e.clientY ?? e.y); return [(p.x ?? p[0]) / TILE, (p.y ?? p[1]) / TILE]; }
    return [(e.x ?? 0) / TILE, (e.y ?? 0) / TILE];
  };
  // overlay helper: maps tile coords to the overlay context's coordinates.
  // Core may pass a view with tileToScreen/worldToScreen, or an already world-transformed ctx (1 unit = 1 px).
  T.ov = (ctx, view = editor.view) => {
    let pt, s;
    if (view?.tileToScreen) { pt = (x, y) => { const p = view.tileToScreen(x, y); return Array.isArray(p) ? p : [p.x, p.y]; }; const a = pt(0, 0), b = pt(1, 0); s = b[0] - a[0]; }
    else if (view?.worldToScreen) { pt = (x, y) => { const p = view.worldToScreen(x * TILE, y * TILE); return Array.isArray(p) ? p : [p.x, p.y]; }; const a = pt(0, 0), b = pt(1, 0); s = b[0] - a[0]; }
    else { pt = (x, y) => [x * TILE, y * TILE]; s = TILE; }
    const O = { ctx, pt, s,
      cell(x, y, fill, stroke) { const [a, b] = pt(x, y); if (fill) { ctx.fillStyle = fill; ctx.fillRect(a, b, s, s); } if (stroke) { ctx.strokeStyle = stroke; ctx.strokeRect(a + 0.5, b + 0.5, s - 1, s - 1); } },
      line(pts, color, w = 2, dash) { if (pts.length < 2) return; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); pts.forEach((p, i) => { const [a, b] = pt(p[0], p[1]); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke(); ctx.restore(); },
      dot(x, y, r, fill, stroke) { const [a, b] = pt(x, y); ctx.beginPath(); ctx.arc(a, b, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } },
      text(x, y, str, color = '#fff') { const [a, b] = pt(x, y); ctx.save(); ctx.font = '600 12px system-ui, sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.strokeText(str, a, b); ctx.fillStyle = color; ctx.fillText(str, a, b); ctx.restore(); },
      rect(x, y, w, h, fill, stroke) { const [a, b] = pt(x, y); ctx.save(); if (fill) { ctx.fillStyle = fill; ctx.fillRect(a, b, w * s, h * s); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.strokeRect(a, b, w * s, h * s); } ctx.restore(); },
    };
    return O;
  };
  T.redraw = () => (editor.view?.redraw ?? editor.view?.invalidate ?? editor.redraw ?? (() => {})).call(editor.view ?? editor);
  T.select = (sel) => (editor.select ?? editor.selection?.set ?? (() => {})).call(editor.selection ?? editor, sel);
  T.focus = (mapId, tx, ty) => {
    if (mapId && mapId !== T.mapId()) (editor.openMap ?? editor.view?.openMap ?? editor.setMap ?? (() => {})).call(editor.view?.openMap ? editor.view : editor, mapId);
    (editor.view?.centerOn ?? editor.view?.focus ?? editor.view?.panTo ?? (() => {})).call(editor.view, tx * TILE + 8, ty * TILE + 8);
  };
  T.toast = (msg, kind = 'info') => (editor.toast ?? editor.notify ?? ((m) => console.info('[tools]', m)))(msg, kind);
  T.on = (ev, fn) => (editor.on ?? (() => {})).call(editor, ev, fn);
  T.playtest = (opts) => (editor.playtest ?? editor.play ?? (() => {}))(opts);

  // ---------- assets ----------
  T.sprites = (prefix = '') => {
    const a = editor.assets;
    let list = [];
    try { list = a?.list ? a.list(prefix) : a?.sprites ? Object.keys(a.sprites) : a?.keys ? a.keys() : []; } catch { list = []; }
    list = Array.from(list).map((x) => (typeof x === 'string' ? x : x.id ?? x.key ?? x.name)).filter(Boolean);
    return prefix ? list.filter((k) => k.startsWith(prefix)) : list;
  };
  T.spriteCanvas = (key) => {
    const a = editor.assets; if (!a) return null;
    try { const s = a.get ? a.get(key) : a.sprites?.[key]; const f = s?.frames?.[0] ?? s?.[0] ?? s; return f instanceof HTMLCanvasElement || f instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && f instanceof ImageBitmap) ? f : f?.canvas ?? f?.img ?? null; }
    catch { return null; }
  };
  T.imported = () => { try { return editor.assets?.imported?.() ?? editor.assets?.imports ?? []; } catch { return []; } };
  T.objectTypes = () => {
    try { const t = editor.assets?.objectTypes?.() ?? editor.objectTypes; if (t) return Array.isArray(t) ? t : Object.keys(t); } catch { /* fall through */ }
    return null;
  };
  return T;
}
