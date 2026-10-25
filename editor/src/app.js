// DRIFT-Editor – App-Kern (docs/EDITOR_PLAN.md): Dokument + Verlauf, Autosave (localStorage, gleicher Schlüssel wie das
// Spiel in index.html?content=local), Werkzeuge, Paletten, Inspektor, Kartenliste, Probe spielen, Live-HD-2D-Vorschau, Plugins.
import { buildAssets } from '../../src/art/index.js';
import { TILE_DEFS } from '../../src/data/tiles.js';
import { LOCAL_KEY, LEGACY_FOOT, NPC_FOOT, checkContent } from '../../src/content/schema.js';
import { SPECIES } from '../../src/game/monsters/species.js';
import { ITEMS } from '../../src/game/farm/items.js';
import { TILE, MAX_H, clone, docFromBundle, bundleFromDoc, newMap, starterProject, charFor, resizeMap, normalizeMap } from './format.js';
import { createView } from './view.js';
import { makeApi } from '../tools/api.js';
import plugins from '../plugins.js';

const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== undefined && v !== null && v !== false) e[k] = v;
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
};

// ---------------------------------------------------------------------------------------------------------------
// Kataloge
const TILE_NAMES = {
  grass: 'Gras', grass_dark: 'Dunkles Gras', grass_light: 'Helles Gras', grass_flowers: 'Blumenwiese', grass_tall: 'Hohes Gras',
  clearing: 'Lichtung', soil: 'Acker', dirt: 'Erde', path: 'Weg', sand: 'Sand', water: 'Wasser', shallow: 'Flachwasser',
  stairs: 'Treppe', bridge: 'Brücke', stone_floor: 'Steinboden', dungeon_floor: 'Dungeon', dungeon_wall: 'Wand', pit: 'Grube',
  wood_floor: 'Holzboden', void: 'Leere',
};
const TILE_IDS = Object.keys(TILE_NAMES).filter((id) => TILE_DEFS[id]);
const OBJECTS = {
  tree: 'Baum', tree_pine: 'Tanne', tree_autumn: 'Herbstbaum', tree_small: 'Bäumchen', bush: 'Busch', rock: 'Stein', rock_big: 'Felsbrocken',
  stump: 'Stumpf', flower: 'Blume', mushroom: 'Pilz', lilypad: 'Seerose', sign: 'Schild', house: 'Haus', fence_h: 'Zaun —', fence_v: 'Zaun |',
  statue: 'Statue', torch: 'Fackel', lantern: 'Laterne', barrel: 'Fass', crate: 'Kiste', sack: 'Sack', hay: 'Heu', cart: 'Karren', well: 'Brunnen',
  bench: 'Bank', flowerbox: 'Blumenkasten', gravestone: 'Grabstein', scarecrow: 'Vogelscheuche', pot: 'Topf', tools: 'Werkzeug', bed: 'Bett',
};
const CHARACTERS = { elder: 'Ältester', girl: 'Mädchen', merchant: 'Händler' };
const DIRS = { down: 'unten', up: 'oben', left: 'links', right: 'rechts' };
const MUSIC = { overworld: 'Oberwelt', dungeon: 'Dungeon', boss: 'Boss' };
const FACES = { rock: 'Fels', dirt: 'Erde', brick: 'Ziegel' };
const LEGACY_ITEM_NAMES = { rupees: 'Taler (Rupien)', key: 'Schlüssel', bombs: 'Bomben', heart_container: 'Herzcontainer' };
const itemOptions = () => ({ ...Object.fromEntries(Object.entries(ITEMS).map(([id, it]) => [id, it.name])), ...LEGACY_ITEM_NAMES, ...Object.fromEntries(Object.entries(E.doc.items || {}).map(([id, it]) => [id, it.name || id])) });
const speciesOptions = () => ({ ...Object.fromEntries(Object.entries(SPECIES).map(([id, s]) => [id, s.name])), ...Object.fromEntries(Object.entries(E.doc.species || {}).map(([id, s]) => [id, s.name || id])) });
const foot = (t) => LEGACY_FOOT[t] || [8, 14];

// ---------------------------------------------------------------------------------------------------------------
// Editor-Zustand
const E = {
  doc: null, mapId: null, sel: null, tool: null, toolId: 'paint', assets: null, view: null, ghost: null,
  brush: { tile: 'grass', size: 1, height: 1, object: 'tree', character: 'elder', heightMode: 'set' },
  layersVisible: { objects: true, zones: true }, overlays: [], tools: {}, listeners: {}, hover: null,
  history: [], future: [],
};
window.__editor = E;
E.map = (id = E.mapId) => E.doc?.maps[id];
E.on = (ev, fn) => (E.listeners[ev] ||= []).push(fn);
E.emit = (ev, ...a) => { for (const fn of E.listeners[ev] || []) { try { fn(...a); } catch (e) { console.warn('[editor]', ev, e); } } };
E.toast = (msg, kind = 'info') => {
  const d = el('div', { class: kind, textContent: msg });
  $('#toasts').append(d); setTimeout(() => d.remove(), kind === 'error' ? 5000 : 2600);
};

// ---------- Verlauf ----------
const snap = () => JSON.stringify(E.doc);
function restore(s) { E.doc = JSON.parse(s); if (!E.doc.maps[E.mapId]) E.mapId = Object.keys(E.doc.maps)[0]; E.sel = resolveSel(E.sel); }
function pushHistory(entry) {
  E.history.push(entry); if (E.history.length > 150) E.history.shift();
  E.future = [];
  changed(entry.label);
}
/** Änderung als ein Schritt: fn mutiert E.doc direkt. */
E.change = (label, fn) => {
  const before = snap();
  const r = fn(E.doc);
  const after = snap();
  if (before === after) return r;
  pushHistory({ label, undo: () => restore(before), redo: () => restore(after) });
  return r;
};
/** Kompatibel zu editor/tools/api.js: op = { label, do(), undo() } */
E.apply = (op) => { op.do(); pushHistory({ label: op.label, undo: () => op.undo(), redo: () => op.do() }); };
E.undo = () => { const h = E.history.pop(); if (!h) return; h.undo(); E.future.push(h); changed('Rückgängig: ' + h.label, true); };
E.redo = () => { const h = E.future.pop(); if (!h) return; h.redo(); E.history.push(h); changed('Wiederholt: ' + h.label, true); };

let saveT = 0, prevT = 0;
function changed(label, quiet) {
  E.view?.invalidate();
  renderMaps(); renderInspector();
  $('#saveState').textContent = 'ungespeichert …';
  clearTimeout(saveT); saveT = setTimeout(save, 500);
  if (quiet) E.toast(label);
  E.emit('change', { label });
}
function save() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(bundleFromDoc(E.doc)));
    localStorage.setItem('drift.editor.ui', JSON.stringify({ map: E.mapId, tool: E.toolId }));
    $('#saveState').textContent = 'im Browser gespeichert ✓';
  } catch (e) { $('#saveState').textContent = 'Speichern fehlgeschlagen!'; E.toast('Speichern im Browser fehlgeschlagen: ' + e.message, 'error'); }
  if (!$('#previewPane').hidden && $('#autoPrev').checked) { clearTimeout(prevT); prevT = setTimeout(refreshPreview, 900); }
}

// ---------- Auswahl ----------
// sel = { kind: 'object'|'item'|'npc'|'trainer'|'warp'|'encounter'|'event'|'spawn', index | name }
const COLL = { object: 'objects', item: 'items', npc: 'npcs', trainer: 'trainers', warp: 'warps', encounter: 'encounters', event: 'events' };
E.ref = (sel = E.sel) => { const m = E.map(); if (!sel || !m) return null; return sel.kind === 'spawn' ? m.spawns[sel.name] : m[COLL[sel.kind]]?.[sel.index]; };
function resolveSel(sel) { return sel && E.ref(sel) ? sel : null; }
E.select = (sel) => { E.sel = sel && E.ref(sel) ? sel : null; renderInspector(); E.view?.redraw(); };
E.rectOf = (sel) => { const r = E.ref(sel); if (!r) return null; return sel.kind === 'warp' || sel.kind === 'encounter' ? r.rect : sel.kind === 'event' ? r.trigger?.rect : null; };
E.boundsOf = (sel) => {
  const r = E.ref(sel); if (!r) return null;
  const rect = E.rectOf(sel);
  if (rect) return { x: rect[0] * TILE, y: rect[1] * TILE, w: rect[2] * TILE, h: rect[3] * TILE };
  if (sel.kind === 'spawn') return { x: r.x - 2, y: r.y - 19, w: 14, h: 20 };
  const key = E.view.spriteFor(sel.kind, r);
  const s = E.assets.sprites[key]; const img = Array.isArray(s) ? s[0] : s;
  if (!img) return { x: r.x - 6, y: r.y - 12, w: 12, h: 12 };
  const ws = img.ws || 1, ax = img.ax ?? img.width / 2, ay = img.ay ?? img.height - 1;
  return { x: r.x - ax * ws, y: r.y - ay * ws, w: img.width * ws, h: img.height * ws };
};
function pick(wx, wy) {
  const m = E.map(); const hits = [];
  const inB = (b) => b && wx >= b.x && wy >= b.y && wx < b.x + b.w && wy < b.y + b.h;
  for (const name of Object.keys(m.spawns)) if (inB(E.boundsOf({ kind: 'spawn', name }))) return { kind: 'spawn', name };
  for (const kind of ['object', 'item', 'npc', 'trainer']) m[COLL[kind]].forEach((e, index) => { if (e.x == null) return; const b = E.boundsOf({ kind, index }); if (inB(b)) hits.push({ sel: { kind, index }, y: e.y, area: 0, fine: Math.abs(wx - e.x) < 8 && wy < e.y + 2 && wy > e.y - 14 }); });
  if (hits.length) { hits.sort((a, b) => (b.fine - a.fine) || (b.y - a.y)); return hits[0].sel; }
  if (E.layersVisible.zones) for (const kind of ['warp', 'event', 'encounter']) m[COLL[kind]].forEach((e, index) => { const b = E.boundsOf({ kind, index }); if (inB(b)) hits.push({ sel: { kind, index }, area: b.w * b.h }); });
  hits.sort((a, b) => a.area - b.area);
  return hits[0]?.sel || null;
}

// ---------------------------------------------------------------------------------------------------------------
// Karten-Zellen bearbeiten (direkt während eines Strichs; der Strich ist EIN Verlaufsschritt)
function setCell(m, x, y, tile, height) {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  let changedCell = false;
  if (tile != null) { const c = charFor(m, tile); const r = m.layers.ground[y]; if (r[x] !== c) { m.layers.ground[y] = r.slice(0, x) + c + r.slice(x + 1); changedCell = true; } }
  if (height != null) { const v = String(Math.max(0, Math.min(MAX_H, height))); const r = m.layers.height[y]; if (r[x] !== v) { m.layers.height[y] = r.slice(0, x) + v + r.slice(x + 1); changedCell = true; } }
  return changedCell;
}
const tileAt = (m, x, y) => { const c = m.layers.ground[y]?.[x]; return c == null ? null : ({ ...m.legend }[c] ?? E.view.grid?.ground[y * m.w + x]); };
const heightAt = (m, x, y) => +(m.layers.height[y]?.[x] ?? 0);
function brushCells(cx, cy, size) {
  const out = [], r = (size - 1) / 2;
  for (let y = Math.floor(cy - r); y <= Math.floor(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.floor(cx + r); x++) {
    if (size >= 3 && (x - cx) ** 2 + (y - cy) ** 2 > (r + 0.5) ** 2) continue;
    out.push([x, y]);
  }
  return out;
}
let stroke = null;
function strokeBegin(label) { stroke = { label, before: snap(), cells: new Map() }; }
function strokeCells(cells, fn) {
  const m = E.map(); const dirty = [];
  for (const [x, y] of cells) { const k = x + ',' + y; if (stroke.cells.has(k)) continue; stroke.cells.set(k, 1); if (fn(m, x, y)) dirty.push([x, y], [x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]); }
  if (dirty.length) E.view.invalidate(dirty);
}
function strokeEnd() {
  if (!stroke) return;
  const before = stroke.before, after = snap(), label = stroke.label;
  stroke = null;
  if (before !== after) pushHistory({ label, undo: () => restore(before), redo: () => restore(after) });
}

// ---------------------------------------------------------------------------------------------------------------
// Werkzeuge
const tileOf = (e) => { const t = E.view.screenToTile(e.clientX, e.clientY); return { fx: t.x, fy: t.y, x: Math.floor(t.x), y: Math.floor(t.y) }; };
function rectTool(id, icon, label, key, make) {
  return { id, icon, label, key, cursor: 'crosshair', hint: `${label}: Rechteck auf der Karte ziehen.`,
    down(e) { const t = tileOf(e); this.drag = { x0: t.x, y0: t.y, x1: t.x, y1: t.y }; },
    move(e) { if (!this.drag) return; const t = tileOf(e); this.drag.x1 = t.x; this.drag.y1 = t.y; E.view.redraw(); },
    up() {
      const d = this.drag; this.drag = null; if (!d) return;
      const rect = [Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0) + 1, Math.abs(d.y1 - d.y0) + 1];
      const m = E.map();
      const kind = make.kind;
      const index = E.change(`${label} anlegen`, () => { const o = make(m, rect); m[COLL[kind]].push(o); return m[COLL[kind]].length - 1; });
      E.select({ kind, index }); setTool('select');
    },
    overlay(ctx, V) {
      const d = this.drag; if (!d) return;
      const a = V.tileToScreen(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1));
      const w = (Math.abs(d.x1 - d.x0) + 1) * TILE * V.scale, h = (Math.abs(d.y1 - d.y0) + 1) * TILE * V.scale;
      ctx.save(); ctx.strokeStyle = '#f0c060'; ctx.lineWidth = 2; ctx.setLineDash([6, 3]); ctx.strokeRect(a.x, a.y, w, h); ctx.restore();
    },
  };
}
const uid = (base, list) => { let i = 1; while (list.some((x) => x.id === `${base}_${i}`)) i++; return `${base}_${i}`; };
function placeTool(id, icon, label, key, place) {
  return { id, icon, label, key, cursor: 'copy', hint: `${label}: auf die Karte klicken. Alt = frei (ohne Raster).`,
    down(e) {
      const t = tileOf(e), m = E.map();
      if (t.x < 0 || t.y < 0 || t.x >= m.w || t.y >= m.h) return;
      const sel = E.change(`${label} setzen`, () => place(m, t, e.altKey));
      if (sel) E.select(sel);
    },
    overlay(ctx, V) { brushOverlay(ctx, V, 1); },
  };
}
function brushOverlay(ctx, V, size) {
  const h = E.hover; if (!h) return;
  const cells = brushCells(h.x + 0.5, h.y + 0.5, size);
  ctx.save(); ctx.strokeStyle = '#f0c060'; ctx.fillStyle = 'rgba(240,192,96,.15)'; ctx.lineWidth = 1.5;
  for (const [x, y] of cells) { const a = V.tileToScreen(x, y); ctx.fillRect(a.x, a.y, TILE * V.scale, TILE * V.scale); }
  const a = V.tileToScreen(cells[0][0], cells[0][1]);
  if (cells.length === 1) ctx.strokeRect(a.x + 0.5, a.y + 0.5, TILE * V.scale - 1, TILE * V.scale - 1);
  ctx.restore();
}
const DEFAULT_TOOLS = [
  { id: 'select', icon: '⬚', label: 'Auswählen & verschieben', key: 'v', cursor: 'default',
    hint: 'Klicken wählt aus, Ziehen verschiebt (Alt = frei). Ecke unten rechts ziehen ändert Zonen-Größe. Entf löscht.',
    down(e) {
      const w = E.view.screenToWorld(e.clientX, e.clientY);
      // Größe ändern: Griff unten rechts einer gewählten Zone
      const rect = E.sel && E.rectOf(E.sel);
      if (rect) { const b = E.boundsOf(E.sel); const s = E.view.worldToScreen(b.x + b.w, b.y + b.h), c = E.view.worldToScreen(w.x, w.y); if (Math.abs(s.x - c.x) < 12 && Math.abs(s.y - c.y) < 12) { this.drag = { mode: 'resize', before: snap() }; return; } }
      const sel = pick(w.x, w.y);
      E.select(sel);
      if (sel) this.drag = { mode: 'move', before: snap(), w0: w, start: clone(E.ref(sel)), moved: false };
    },
    move(e) {
      const d = this.drag; if (!d) return;
      const w = E.view.screenToWorld(e.clientX, e.clientY), ref = E.ref(); if (!ref) return;
      const rect = E.rectOf(E.sel);
      if (d.mode === 'resize') { rect[2] = Math.max(1, Math.round(w.x / TILE - rect[0])); rect[3] = Math.max(1, Math.round(w.y / TILE - rect[1])); E.view.redraw(); renderInspector(); return; }
      const dx = w.x - d.w0.x, dy = w.y - d.w0.y;
      if (!d.moved && Math.hypot(dx, dy) * E.view.scale < 4) return;
      d.moved = true;
      if (rect) { const r0 = E.rectOf.call(null, E.sel) && (d.start.rect || d.start.trigger.rect); rect[0] = r0[0] + Math.round(dx / TILE); rect[1] = r0[1] + Math.round(dy / TILE); }
      else {
        let x = d.start.x + dx, y = d.start.y + dy;
        if (!e.altKey) { const [fx, fy] = E.sel.kind === 'npc' || E.sel.kind === 'trainer' || E.sel.kind === 'spawn' ? NPC_FOOT : foot(ref.type); x = Math.floor(x / TILE) * TILE + fx; y = Math.floor(y / TILE) * TILE + fy; }
        ref.x = Math.round(x); ref.y = Math.round(y);
      }
      E.view.redraw();
    },
    up() {
      const d = this.drag; this.drag = null; if (!d) return;
      const after = snap();
      if (after !== d.before) pushHistory({ label: d.mode === 'resize' ? 'Größe geändert' : 'Verschoben', undo: () => restore(d.before), redo: () => restore(after) });
    },
  },
  { id: 'paint', icon: '🖌', label: 'Boden malen', key: 'b', cursor: 'crosshair', palette: 'tiles', hint: 'Malt das gewählte Boden-Tile. Rechtsklick/Alt = Pipette.',
    down(e) { if (e.altKey || e.button === 2) { const t = tileOf(e); const id = tileAt(E.map(), t.x, t.y); if (id) { E.brush.tile = id; renderPalette(); } return; } strokeBegin('Boden malen'); this.move(e); },
    move(e) { if (!stroke) return; const t = tileOf(e); strokeCells(brushCells(t.x + 0.5, t.y + 0.5, E.brush.size), (m, x, y) => setCell(m, x, y, E.brush.tile)); },
    up: strokeEnd, overlay(ctx, V) { brushOverlay(ctx, V, E.brush.size); },
  },
  { id: 'fill', icon: '🪣', label: 'Fläche füllen', key: 'f', cursor: 'crosshair', palette: 'tiles', hint: 'Füllt zusammenhängende gleiche Tiles (gleiche Höhe) mit dem gewählten Tile.',
    down(e) {
      const t = tileOf(e), m = E.map(); const from = tileAt(m, t.x, t.y); const h0 = heightAt(m, t.x, t.y);
      if (from == null || from === E.brush.tile) return;
      E.change('Füllen', () => {
        const seen = new Set(), st = [[t.x, t.y]];
        while (st.length) {
          const [x, y] = st.pop(); const k = y * m.w + x;
          if (x < 0 || y < 0 || x >= m.w || y >= m.h || seen.has(k)) continue; seen.add(k);
          if (tileAt(m, x, y) !== from || heightAt(m, x, y) !== h0) continue;
          setCell(m, x, y, E.brush.tile); st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
      });
    },
    overlay(ctx, V) { brushOverlay(ctx, V, 1); },
  },
  { id: 'height', icon: '⛰', label: 'Höhe formen', key: 'h', cursor: 'crosshair', palette: 'height', hint: 'Setzt die Höhenstufe (0–9). Klippen entstehen an Stufenkanten; Treppe-Tile verbindet Stufen. Alt = Höhe aufnehmen.',
    down(e) {
      const t = tileOf(e), m = E.map();
      if (e.altKey || e.button === 2) { E.brush.height = heightAt(m, t.x, t.y); renderPalette(); return; }
      this.base = heightAt(m, t.x, t.y);
      strokeBegin('Höhe formen'); this.move(e);
    },
    move(e) {
      if (!stroke) return; const t = tileOf(e); const mode = E.brush.heightMode;
      strokeCells(brushCells(t.x + 0.5, t.y + 0.5, E.brush.size), (m, x, y) => {
        const h = heightAt(m, x, y);
        const v = mode === 'up' ? h + 1 : mode === 'down' ? h - 1 : mode === 'flat' ? this.base : E.brush.height;
        return setCell(m, x, y, null, v);
      });
    },
    up: strokeEnd, overlay(ctx, V) { brushOverlay(ctx, V, E.brush.size); },
  },
  placeTool('object', '🌳', 'Objekt', 'o', (m, t, free) => {
    const type = E.brush.object; const [fx, fy] = foot(type);
    const x = free ? Math.round(t.fx * TILE) : t.x * TILE + fx, y = free ? Math.round(t.fy * TILE) : t.y * TILE + fy;
    const o = { type, x, y }; if (type === 'sign') o.text = ['Ein Schild.'];
    m.objects.push(o); return null;
  }),
  placeTool('npc', '🧑', 'Person', 'n', (m, t) => {
    const id = uid('person', m.npcs);
    m.npcs.push({ id, character: E.brush.character, x: t.x * TILE + NPC_FOOT[0], y: t.y * TILE + NPC_FOOT[1], dir: 'down', behavior: { type: 'idle' }, dialog: `${m.id}_${id}` });
    E.doc.dialogs[`${m.id}_${id}`] = { id: `${m.id}_${id}`, speaker: CHARACTERS[E.brush.character] || 'Person', lines: ['Hallo!'] };
    return { kind: 'npc', index: m.npcs.length - 1 };
  }),
  placeTool('trainer', '🎯', 'Trainer', 't', (m, t) => {
    const id = uid('trainer', m.trainers);
    m.trainers.push({ id, name: 'Ranger', x: t.x * TILE + NPC_FOOT[0], y: t.y * TILE + NPC_FOOT[1], dir: 'down', sight: 64, reward: 50,
      team: [{ species: 'boeli', level: 5 }], dialog: { before: ['Halt! Lass uns kämpfen!'], lose: ['Du bist stark!'], after: ['Viel Glück auf deiner Reise.'] } });
    return { kind: 'trainer', index: m.trainers.length - 1 };
  }),
  placeTool('chest', '📦', 'Truhe', 'c', (m, t) => {
    m.items.push({ type: 'chest', x: t.x * TILE + 8, y: t.y * TILE + 14, contents: { item: 'orb', count: 3 }, flag: `chest_${m.id}_${t.x}_${t.y}` });
    return { kind: 'item', index: m.items.length - 1 };
  }),
  rectTool('warp', '🚪', 'Übergang', 'w', Object.assign((m, rect) => {
    const other = Object.keys(E.doc.maps).find((id) => id !== m.id) || m.id;
    return { rect, to: { map: other, spawn: Object.keys(E.doc.maps[other].spawns)[0] || 'start' } };
  }, { kind: 'warp' })),
  rectTool('zone', '🐾', 'Begegnungs-Zone', 'z', Object.assign((m, rect) => ({ id: uid('zone', m.encounters), rect, tiles: ['grass_tall'], density: 3,
    table: [{ species: 'boeli', levels: [2, 5], weight: 3 }, { species: 'zappi', levels: [2, 5], weight: 2 }] }), { kind: 'encounter' })),
  rectTool('event', '⚡', 'Ereignis', 'e', Object.assign((m, rect) => ({ id: uid('event', m.events), once: true, trigger: { type: 'enter', rect },
    do: [{ say: ['Etwas Besonderes passiert hier …'] }] }), { kind: 'event' })),
  placeTool('spawn', '🚩', 'Startpunkt', 's', (m, t) => {
    const name = m.spawns.start ? (Object.keys(m.spawns).length === 1 && !confirm('Startpunkt „start“ hierher verschieben?\n(Abbrechen = weiteren Ankunftspunkt anlegen)') ? `punkt_${Object.keys(m.spawns).length}` : 'start') : 'start';
    m.spawns[name] = { x: t.x * TILE + NPC_FOOT[0], y: t.y * TILE + NPC_FOOT[1], dir: m.spawns[name]?.dir || 'down' };
    return { kind: 'spawn', name };
  }),
  { id: 'erase', icon: '🧽', label: 'Löschen', key: 'x', cursor: 'not-allowed', hint: 'Klick löscht Objekt, Person, Zone … unter dem Zeiger.',
    down(e) { const w = E.view.screenToWorld(e.clientX, e.clientY); const s = pick(w.x, w.y); if (s) deleteSel(s); } },
];
function deleteSel(sel = E.sel) {
  if (!sel) return;
  const m = E.map();
  if (sel.kind === 'spawn' && Object.keys(m.spawns).length <= 1) { E.toast('Die Karte braucht mindestens einen Ankunftspunkt.', 'error'); return; }
  E.change('Gelöscht', () => { if (sel.kind === 'spawn') delete m.spawns[sel.name]; else m[COLL[sel.kind]].splice(sel.index, 1); });
  E.select(null);
}
E.addTool = (t) => { E.tools[t.id] = t; renderTools(); };
function setTool(id) {
  if (!E.tools[id]) return;
  E.toolId = id; E.tool = E.tools[id];
  $('#view').style.cursor = E.tool.cursor || 'crosshair';
  renderTools(); renderPalette(); E.view?.redraw();
}

// ---------------------------------------------------------------------------------------------------------------
// Oberfläche: Werkzeugleiste, Palette, Karten, Inspektor
function renderTools() {
  const box = $('#tools'); box.textContent = '';
  for (const t of Object.values(E.tools)) {
    if (t.id === 'warp' || t.id === 'erase') box.append(el('hr'));
    box.append(el('button', { class: E.toolId === t.id ? 'on' : '', title: `${t.label}${t.key ? ` (${t.key.toUpperCase()})` : ''}`, onclick: () => setTool(t.id) }, t.icon, t.key ? el('small', { textContent: t.key.toUpperCase() }) : null));
  }
  box.append(el('hr'),
    el('button', { title: 'Raster ein/aus (#)', class: E.view?.showGrid ? 'on' : '', onclick: () => { E.view.showGrid = !E.view.showGrid; renderTools(); E.view.redraw(); } }, '#'),
    el('button', { title: 'Höhenzahlen ein/aus', class: E.view?.showHeights ? 'on' : '', onclick: () => { E.view.showHeights = !E.view.showHeights; renderTools(); E.view.redraw(); } }, '🔢'),
    el('button', { title: 'Zonen/Warps ein/aus', class: E.layersVisible.zones ? 'on' : '', onclick: () => { E.layersVisible.zones = !E.layersVisible.zones; renderTools(); E.view.redraw(); } }, '▦'),
    el('button', { title: 'Ganze Karte zeigen (0)', onclick: () => E.view.fit() }, '⤢'));
}
function thumb(img, size = 48) {
  const c = el('canvas', { width: size, height: size });
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  if (img) { const s = Math.min(size / img.width, size / img.height); const w = img.width * s, h = img.height * s; x.drawImage(img, (size - w) / 2, size - h, w, h); }
  return c;
}
const first = (v) => (Array.isArray(v) ? v[0] : v);
function renderPalette() {
  const pal = $('#palette'), opts = $('#brushOpts'), title = $('#paletteTitle');
  pal.textContent = ''; opts.textContent = '';
  const t = E.tool || {};
  const sizeCtl = () => el('label', {}, 'Größe', el('input', { type: 'range', min: 1, max: 9, value: E.brush.size, oninput: (e) => { E.brush.size = +e.target.value; e.target.nextSibling.textContent = E.brush.size; } }), el('b', { textContent: E.brush.size }));
  const hint = t.hint ? el('div', { class: 'hint', textContent: t.hint }) : null;
  if (t.id === 'paint' || t.id === 'fill') {
    title.textContent = 'Boden';
    if (t.id === 'paint') opts.append(sizeCtl());
    for (const id of TILE_IDS) pal.append(el('div', { class: 'it' + (E.brush.tile === id ? ' on' : ''), title: id, onclick: () => { E.brush.tile = id; renderPalette(); } }, thumb(first(E.assets.tiles[id])), TILE_NAMES[id]));
  } else if (t.id === 'height') {
    title.textContent = 'Höhe';
    opts.append(sizeCtl());
    const modes = { set: 'Stufe setzen', up: '+1 anheben', down: '−1 absenken', flat: 'ebnen' };
    opts.append(el('div', { class: 'row', style: 'flex-wrap:wrap' }, ...Object.entries(modes).map(([k, v]) => el('button', { class: 'mini' + (E.brush.heightMode === k ? ' on' : ''), onclick: () => { E.brush.heightMode = k; renderPalette(); } }, v))));
    for (let h = 0; h <= MAX_H; h++) pal.append(el('div', { class: 'it' + (E.brush.height === h && E.brush.heightMode === 'set' ? ' on' : ''), style: `font-size:18px;padding:12px 0;color:hsl(${40 - h * 6},70%,${40 + h * 5}%)`, onclick: () => { E.brush.height = h; E.brush.heightMode = 'set'; renderPalette(); } }, `${h}`));
  } else if (t.id === 'object') {
    title.textContent = 'Objekte';
    for (const [id, name] of Object.entries(OBJECTS)) pal.append(el('div', { class: 'it' + (E.brush.object === id ? ' on' : ''), title: id, onclick: () => { E.brush.object = id; renderPalette(); } }, thumb(first(E.assets.sprites[id])), name));
  } else if (t.id === 'npc') {
    title.textContent = 'Personen';
    for (const [id, name] of Object.entries(CHARACTERS)) pal.append(el('div', { class: 'it' + (E.brush.character === id ? ' on' : ''), onclick: () => { E.brush.character = id; renderPalette(); } }, thumb(first(E.assets.sprites[`npc_${id}_idle_down`])), name));
  } else title.textContent = t.label || 'Palette';
  if (hint) pal.after ? opts.prepend(hint) : null;
}
function renderMaps() {
  const ul = $('#mapList'); ul.textContent = '';
  const st = E.doc.project.start?.map;
  for (const m of Object.values(E.doc.maps)) {
    ul.append(el('li', { class: m.id === E.mapId ? 'cur' : '', title: m.id, onclick: () => openMap(m.id) },
      m.id === st ? el('span', { class: 'star', title: 'Startkarte', textContent: '★' }) : el('span', { textContent: m.outdoor ? '🌲' : '🏠' }),
      el('span', { textContent: m.name }), el('span', { class: 'sz', textContent: `${m.w}×${m.h}` })));
  }
  $('#projName').value = E.doc.project.name;
}
function openMap(id) {
  if (!E.doc.maps[id]) return;
  E.mapId = id; E.sel = null;
  E.view.invalidate(); E.view.fit();
  renderMaps(); renderInspector();
  try { localStorage.setItem('drift.editor.ui', JSON.stringify({ map: E.mapId, tool: E.toolId })); } catch { /* egal */ }
  if (!$('#previewPane').hidden) refreshPreview();
}
E.openMap = openMap;

// ---------- Formular-Helfer ----------
function field(label, input) { return el('label', { class: 'field' }, el('span', { textContent: label }), input); }
function inp(value, onchange, props = {}) { return el('input', { value: value ?? '', ...props, onchange: (e) => onchange(props.type === 'number' ? +e.target.value : e.target.value) }); }
function num(value, onchange, props = {}) { return inp(value, onchange, { type: 'number', ...props }); }
function sel(options, value, onchange) {
  const s = el('select', { onchange: (e) => onchange(e.target.value) });
  const entries = Array.isArray(options) ? options.map((o) => [o, o]) : Object.entries(options);
  if (value != null && !entries.some(([k]) => k === value)) entries.unshift([value, `${value} (?)`]);
  for (const [k, v] of entries) s.append(el('option', { value: k, textContent: v, selected: k === value }));
  return s;
}
function lines(value, onchange) { return el('textarea', { value: [].concat(value || []).join('\n'), placeholder: 'Eine Zeile pro Textfenster', onchange: (e) => onchange(e.target.value.split('\n').map((s) => s.trimEnd()).filter(Boolean)) }); }
function check(value, onchange, label) { return el('label', { class: 'row', style: 'gap:6px;flex:0' }, el('input', { type: 'checkbox', checked: !!value, onchange: (e) => onchange(e.target.checked) }), label); }
const upd = (label, fn) => () => {};
function edit(label, fn) { return (v) => E.change(label, () => fn(v)); }
function rectFields(r, label) {
  return el('div', { class: 'row' }, ...['x', 'y', 'b', 'h'].map((k, i) => num(r[i], edit(label, (v) => { r[i] = Math.max(i > 1 ? 1 : 0, Math.round(v)); }), { title: k, min: i > 1 ? 1 : 0 })));
}

function renderInspector() {
  const box = $('#inspector'); box.textContent = '';
  const m = E.map(); if (!m) return;
  const r = E.ref();
  const head = (title, tag) => box.append(el('h2', {}, title, tag ? el('span', { class: 'tag', textContent: tag }) : null));
  const del = () => box.append(el('div', { class: 'row', style: 'margin-top:12px' }, el('button', { class: 'danger', onclick: () => deleteSel() }, '🗑 Löschen')));
  if (!r) return mapInspector(box, m, head);
  const k = E.sel.kind;
  if (k === 'object') {
    head(OBJECTS[r.type] || r.type, 'Objekt');
    box.append(field('Art', sel(OBJECTS, r.type, edit('Objekt-Art', (v) => { r.type = v; }))));
    box.append(field('Position (Welt-Pixel)', el('div', { class: 'row' }, num(r.x, edit('Position', (v) => { r.x = v; })), num(r.y, edit('Position', (v) => { r.y = v; })))));
    if (r.type === 'sign' || r.text) box.append(field('Text', lines(r.text, edit('Schild-Text', (v) => { r.text = v; }))));
    box.append(field('Nur sichtbar wenn Flag gesetzt (optional)', inp(typeof r.if === 'string' ? r.if : '', edit('Bedingung', (v) => { if (v) r.if = v; else delete r.if; }))));
  } else if (k === 'item') {
    head('Truhe', 'Gegenstand');
    r.contents ||= { item: 'orb', count: 1 };
    box.append(field('Inhalt', sel(itemOptions(), r.contents.item, edit('Truhen-Inhalt', (v) => { r.contents.item = v; }))));
    box.append(field('Anzahl', num(r.contents.count ?? 1, edit('Anzahl', (v) => { r.contents.count = Math.max(1, v | 0); }), { min: 1 })));
    box.append(field('Flag (merkt sich „geöffnet“)', inp(r.flag, edit('Flag', (v) => { r.flag = v; }))));
    box.append(field('Erscheint erst bei Flag (optional)', inp(r.appearFlag, edit('Flag', (v) => { if (v) r.appearFlag = v; else delete r.appearFlag; }))));
  } else if (k === 'npc') {
    head(r.id, 'Person');
    box.append(field('ID', inp(r.id, edit('ID', (v) => { r.id = v.replace(/[^\w.-]/g, '_') || r.id; }))));
    box.append(field('Aussehen', sel({ ...CHARACTERS, ...Object.fromEntries(Object.keys(E.doc.characters || {}).map((c) => [c, c])) }, r.character, edit('Aussehen', (v) => { r.character = v; }))));
    box.append(field('Blickrichtung', sel(DIRS, r.dir, edit('Richtung', (v) => { r.dir = v; }))));
    box.append(field('Verhalten', sel({ idle: 'steht', wander: 'läuft umher' }, r.behavior?.type || 'idle', edit('Verhalten', (v) => { r.behavior = { type: v }; }))));
    const did = r.dialog || (r.dialog = `${m.id}_${r.id}`);
    const d = E.doc.dialogs[did] || { id: did, lines: [] };
    const dd = (fn) => edit('Dialog', (v) => { E.doc.dialogs[did] = { ...d, id: did }; fn(E.doc.dialogs[did], v); });
    box.append(el('h3', { textContent: 'Dialog' }));
    box.append(field('Name im Textfenster', inp(d.speaker, dd((x, v) => { x.speaker = v; }))));
    box.append(field('Text', lines(d.lines, dd((x, v) => { x.lines = v; }))));
    const actions = { '': '– nichts –', heal: 'Team heilen', giveStarter: 'Starter-Monster wählen lassen', shop: 'Laden öffnen' };
    const curAct = (d.do || []).map((a) => Object.keys(a)[0]).find((a) => a in actions) || '';
    box.append(field('Danach', sel(actions, curAct, dd((x, v) => { x.do = (x.do || []).filter((a) => !(Object.keys(a)[0] in actions)); if (v) x.do.unshift({ [v]: v === 'shop' ? { name: x.speaker || 'Laden' } : true }); if (!x.do.length) delete x.do; }))));
    const flagAct = (d.do || []).find((a) => a.setFlag);
    box.append(field('Setzt Flag (optional)', inp(flagAct?.setFlag, dd((x, v) => { x.do = (x.do || []).filter((a) => !a.setFlag); if (v) x.do.push({ setFlag: v }); if (!x.do.length) delete x.do; }))));
  } else if (k === 'trainer') {
    head(r.name || r.id, 'Trainer');
    box.append(field('Name', inp(r.name, edit('Name', (v) => { r.name = v; }))));
    box.append(field('Blickrichtung', sel(DIRS, r.dir, edit('Richtung', (v) => { r.dir = v; }))));
    box.append(el('div', { class: 'row' }, field('Sichtweite (px)', num(r.sight ?? 64, edit('Sicht', (v) => { r.sight = v; }))), field('Belohnung (Taler)', num(r.reward ?? 0, edit('Belohnung', (v) => { r.reward = v; })))));
    box.append(el('h3', {}, 'Team', el('button', { class: 'mini', onclick: () => E.change('Team', () => r.team.push({ species: 'boeli', level: 5 })) }, '＋')));
    const tb = el('div', { class: 'table' });
    r.team.forEach((mon, i) => tb.append(el('div', { class: 'row' }, sel(speciesOptions(), mon.species, edit('Team', (v) => { mon.species = v; })),
      num(mon.level, edit('Team', (v) => { mon.level = Math.max(1, Math.min(100, v | 0)); }), { min: 1, max: 100, style: 'max-width:64px', title: 'Level' }),
      el('button', { class: 'mini', onclick: () => E.change('Team', () => r.team.splice(i, 1)) }, '✕'))));
    box.append(tb);
    r.dialog ||= {};
    box.append(field('Text vor dem Kampf', lines(r.dialog.before, edit('Trainer-Text', (v) => { r.dialog.before = v; }))));
    box.append(field('Text nach Niederlage', lines(r.dialog.lose, edit('Trainer-Text', (v) => { r.dialog.lose = v; }))));
    box.append(field('Text danach', lines(r.dialog.after, edit('Trainer-Text', (v) => { r.dialog.after = v; }))));
  } else if (k === 'warp') {
    head('Übergang', 'Warp');
    r.to ||= { map: m.id, spawn: 'start' };
    box.append(field('Bereich (Tiles x, y, Breite, Höhe)', rectFields(r.rect, 'Bereich')));
    box.append(field('Ziel-Karte', sel(Object.fromEntries(Object.values(E.doc.maps).map((x) => [x.id, x.name])), r.to.map, edit('Ziel', (v) => { r.to.map = v; r.to.spawn = Object.keys(E.doc.maps[v]?.spawns || {})[0] || 'start'; }))));
    box.append(field('Ankunftspunkt', sel(Object.keys(E.doc.maps[r.to.map]?.spawns || { start: 1 }), r.to.spawn, edit('Ziel', (v) => { r.to.spawn = v; }))));
    box.append(field('Nur beim Laufen in Richtung', sel({ '': 'egal', ...DIRS }, r.dirReq || '', edit('Richtung', (v) => { if (v) r.dirReq = v; else delete r.dirReq; }))));
    box.append(field('Nur wenn Flag gesetzt (optional)', inp(typeof r.if === 'string' ? r.if : '', edit('Bedingung', (v) => { if (v) r.if = v; else delete r.if; }))));
    box.append(el('button', { onclick: () => { const t = E.doc.maps[r.to.map]; if (t) { openMap(t.id); const s = t.spawns[r.to.spawn]; if (s) E.view.centerOn(s.x, s.y); } } }, 'Zum Ziel springen ➜'));
    box.append(el('div', { class: 'hint', textContent: 'Tipp: Auf der Ziel-Karte mit 🚩 einen Ankunftspunkt setzen und dort einen Rück-Übergang anlegen.' }));
  } else if (k === 'encounter') {
    head(r.id, 'Begegnungs-Zone');
    box.append(field('Bereich (Tiles x, y, Breite, Höhe)', rectFields(r.rect, 'Bereich')));
    box.append(check(r.tiles?.includes('grass_tall'), edit('Nur hohes Gras', (v) => { if (v) r.tiles = ['grass_tall']; else delete r.tiles; }), 'nur im hohen Gras'));
    box.append(field('Max. Monster gleichzeitig', num(r.density ?? 3, edit('Dichte', (v) => { r.density = Math.max(1, Math.min(8, v | 0)); }), { min: 1, max: 8 })));
    box.append(el('h3', {}, 'Monster', el('button', { class: 'mini', onclick: () => E.change('Monster', () => r.table.push({ species: 'zappi', levels: [2, 5], weight: 1 })) }, '＋')));
    const tb = el('div', { class: 'table' });
    tb.append(el('div', { class: 'row muted' }, el('span', { textContent: 'Art' }), el('span', { textContent: 'Lv von–bis · Gewicht · Zeit', style: 'flex:2' })));
    const total = r.table.reduce((s, x) => s + (x.weight || 1), 0) || 1;
    r.table.forEach((row, i) => tb.append(el('div', { class: 'row' }, sel(speciesOptions(), row.species, edit('Monster', (v) => { row.species = v; })),
      num(row.levels[0], edit('Level', (v) => { row.levels[0] = Math.max(1, v | 0); row.levels[1] = Math.max(row.levels[0], row.levels[1]); }), { style: 'max-width:46px' }),
      num(row.levels[1], edit('Level', (v) => { row.levels[1] = Math.max(row.levels[0], v | 0); }), { style: 'max-width:46px' }),
      num(row.weight ?? 1, edit('Gewicht', (v) => { row.weight = Math.max(1, v | 0); }), { style: 'max-width:46px', title: `${Math.round(((row.weight || 1) / total) * 100)} %` }),
      sel({ any: '☀🌙', day: '☀', night: '🌙' }, row.time || 'any', edit('Zeit', (v) => { if (v === 'any') delete row.time; else row.time = v; })),
      el('button', { class: 'mini', onclick: () => E.change('Monster', () => r.table.splice(i, 1)) }, '✕'))));
    box.append(tb);
  } else if (k === 'event') {
    head(r.id, 'Ereignis');
    box.append(field('Bereich (Tiles x, y, Breite, Höhe)', rectFields(r.trigger.rect, 'Bereich')));
    box.append(check(r.once, edit('Einmalig', (v) => { r.once = v; }), 'nur einmal auslösen'));
    box.append(field('Nur wenn Flag (z. B. „starter“ oder „!intro“)', inp(typeof r.if === 'string' ? r.if : '', edit('Bedingung', (v) => { if (v) r.if = v; else delete r.if; }))));
    const say = r.do.find((a) => a.say);
    box.append(field('Text', lines(say?.say, edit('Text', (v) => { r.do = r.do.filter((a) => !a.say); if (v.length) r.do.unshift({ say: v }); }))));
    const actions = { '': '– nichts –', heal: 'Team heilen', giveStarter: 'Starter wählen lassen' };
    const curAct = r.do.map((a) => Object.keys(a)[0]).find((a) => a in actions) || '';
    box.append(field('Danach', sel(actions, curAct, edit('Aktion', (v) => { r.do = r.do.filter((a) => !(Object.keys(a)[0] in actions)); if (v) r.do.push({ [v]: true }); }))));
    const gm = r.do.find((a) => a.giveMonster);
    box.append(field('Monster schenken (optional)', sel({ '': '–', ...speciesOptions() }, gm?.giveMonster.species || '', edit('Geschenk', (v) => { r.do = r.do.filter((a) => !a.giveMonster); if (v) r.do.push({ giveMonster: { species: v, level: 5 } }); }))));
    const fl = r.do.find((a) => a.setFlag);
    box.append(field('Setzt Flag (optional)', inp(fl?.setFlag, edit('Flag', (v) => { r.do = r.do.filter((a) => !a.setFlag); if (v) r.do.push({ setFlag: v }); }))));
    const wp = r.do.find((a) => a.warp);
    box.append(field('Danach reisen nach (optional)', sel({ '': '–', ...Object.fromEntries(Object.values(E.doc.maps).map((x) => [x.id, x.name])) }, wp?.warp.map || '', edit('Reise', (v) => { r.do = r.do.filter((a) => !a.warp); if (v) r.do.push({ warp: { map: v, spawn: Object.keys(E.doc.maps[v].spawns)[0] || 'start' } }); }))));
  } else if (k === 'spawn') {
    head(E.sel.name, 'Ankunftspunkt');
    box.append(field('Name', inp(E.sel.name, (v) => {
      v = v.replace(/[^\w.-]/g, '_'); if (!v || m.spawns[v]) return;
      const old = E.sel.name;
      E.change('Umbenannt', () => { m.spawns[v] = m.spawns[old]; delete m.spawns[old]; if (E.doc.project.start.map === m.id && E.doc.project.start.spawn === old) E.doc.project.start.spawn = v; });
      E.select({ kind: 'spawn', name: v });
    })));
    box.append(field('Blickrichtung', sel(DIRS, r.dir || 'down', edit('Richtung', (v) => { r.dir = v; }))));
    box.append(el('button', { onclick: () => E.change('Spielstart gesetzt', () => { E.doc.project.start = { map: m.id, spawn: E.sel.name }; }) }, '★ Spiel startet hier'));
  }
  del();
}

function mapInspector(box, m, head) {
  head(m.name, 'Karte');
  box.append(field('Name', inp(m.name, edit('Kartenname', (v) => { m.name = v || m.id; }))));
  box.append(el('div', { class: 'row' }, check(m.outdoor, edit('Draußen', (v) => { m.outdoor = v; m.ambient = v; }), 'draußen (Tageszeit, Wetter)')));
  box.append(el('div', { class: 'row' },
    field('Musik', sel(MUSIC, m.music, edit('Musik', (v) => { m.music = v; }))),
    field('Klippen', sel(FACES, m.face, edit('Klippen', (v) => { m.face = v; })))));
  const size = { w: m.w, h: m.h, ax: 0, ay: 0 };
  box.append(field('Größe (Tiles)', el('div', { class: 'row' },
    num(m.w, (v) => { size.w = v; }, { min: 4, max: 256 }), num(m.h, (v) => { size.h = v; }, { min: 4, max: 256 }),
    sel({ '0,0': '↘ oben links fest', '0.5,0.5': '✥ mittig', '1,1': '↖ unten rechts fest' }, '0,0', (v) => { [size.ax, size.ay] = v.split(',').map(Number); }),
    el('button', { class: 'mini', onclick: () => {
      const w = Math.max(4, Math.min(256, size.w | 0)), h = Math.max(4, Math.min(256, size.h | 0));
      if (w === m.w && h === m.h) return;
      E.change('Kartengröße', () => { E.doc.maps[m.id] = resizeMap(m, w, h, size.ax, size.ay, m.outdoor ? 'grass' : 'void'); });
      E.view.fit();
    } }, '✓'))));
  const farm = !!m.farm?.rect;
  box.append(check(farm, edit('Hof', (v) => { if (v) m.farm = { rect: [Math.floor(m.w / 2) - 3, Math.floor(m.h / 2) - 2, 6, 4] }; else delete m.farm; }), 'hat ein Hof-Feld (Anbau)'));
  if (farm) box.append(field('Hof-Bereich', rectFields(m.farm.rect, 'Hof')));
  box.append(el('div', { class: 'row', style: 'margin:10px 0' },
    el('button', { onclick: () => E.change('Startkarte', () => { E.doc.project.start = { map: m.id, spawn: Object.keys(m.spawns)[0] || 'start' }; }) }, '★ Startkarte'),
    el('button', { onclick: () => duplicateMap(m) }, 'Duplizieren'),
    el('button', { class: 'danger', onclick: () => deleteMap(m) }, 'Löschen')));
  const cnt = (k) => m[k].length;
  box.append(el('div', { class: 'hint', textContent: `${cnt('objects')} Objekte · ${cnt('npcs')} Personen · ${cnt('trainers')} Trainer · ${cnt('items')} Truhen · ${cnt('warps')} Übergänge · ${cnt('encounters')} Zonen · ${cnt('events')} Ereignisse` }));
  // Projekt
  const p = E.doc.project;
  box.append(el('h2', { style: 'margin-top:18px' }, 'Projekt', el('span', { class: 'tag', textContent: 'Spiel' })));
  box.append(field('Starter-Monster (bis zu 3)', el('div', { class: 'row' }, ...[0, 1, 2].map((i) => sel({ '': '–', ...speciesOptions() }, p.starters[i] || '', edit('Starter', (v) => { p.starters[i] = v; p.starters = p.starters.filter(Boolean); }))))));
  box.append(el('div', { class: 'row' },
    field('Startgeld', num(p.player?.money ?? 0, edit('Startgeld', (v) => { p.player = { ...(p.player || {}), money: Math.max(0, v | 0) }; }))),
    field('Start-Kugeln', num((p.player?.items || []).find((x) => x.item === 'orb')?.count ?? 0, edit('Start-Kugeln', (v) => { p.player = { ...(p.player || {}) }; p.player.items = (p.player.items || []).filter((x) => x.item !== 'orb'); if (v > 0) p.player.items.push({ item: 'orb', count: v | 0 }); })))));
  box.append(el('div', { class: 'hint', innerHTML: `Spielstart: <b>${E.doc.maps[p.start.map]?.name ?? '?'}</b> · ${p.start.spawn}<br>Tastatur: B Pinsel · F Füllen · H Höhe · O Objekt · N Person · W Übergang · Z Zone · Leertaste+Ziehen verschiebt · Rad zoomt` }));
}

function duplicateMap(m) {
  let id = m.id + '_kopie', i = 2; while (E.doc.maps[id]) id = `${m.id}_kopie${i++}`;
  E.change('Karte dupliziert', () => { E.doc.maps[id] = { ...clone(m), id, name: m.name + ' (Kopie)' }; });
  openMap(id);
}
function deleteMap(m) {
  if (Object.keys(E.doc.maps).length <= 1) { E.toast('Die letzte Karte kann nicht gelöscht werden.', 'error'); return; }
  if (!confirm(`Karte „${m.name}“ wirklich löschen?`)) return;
  E.change('Karte gelöscht', () => { delete E.doc.maps[m.id]; if (E.doc.project.start.map === m.id) E.doc.project.start = { map: Object.keys(E.doc.maps)[0], spawn: 'start' }; });
  openMap(Object.keys(E.doc.maps)[0]);
}
function addMapDialog() {
  const f = { id: '', name: '', w: 32, h: 24, kind: 'route' };
  const body = $('#modalBody'); body.textContent = '';
  body.append(el('h2', { textContent: 'Neue Karte' }),
    field('Name', inp('', (v) => { f.name = v; }, { placeholder: 'z. B. Route 2', oninput: (e) => { f.name = e.target.value; } })),
    field('Art', sel({ route: '🌲 Draußen (Gras)', indoor: '🏠 Innenraum (Holzboden)', cave: '🪨 Höhle/Dungeon (Steinboden)' }, 'route', (v) => { f.kind = v; })),
    el('div', { class: 'row' }, field('Breite', num(32, (v) => { f.w = v; }, { min: 6, max: 256 })), field('Höhe', num(24, (v) => { f.h = v; }, { min: 6, max: 256 }))));
  const dlg = $('#modal');
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok') return;
    const name = f.name.trim() || 'Neue Karte';
    let id = name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'karte';
    let i = 2; const base = id; while (E.doc.maps[id]) id = `${base}_${i++}`;
    const outdoor = f.kind === 'route';
    const w = Math.max(6, Math.min(256, f.w | 0)), h = Math.max(6, Math.min(256, f.h | 0));
    const m = newMap({ id, name, w, h, outdoor, tile: outdoor ? 'grass' : f.kind === 'indoor' ? 'wood_floor' : 'stone_floor' });
    if (!outdoor) {   // Wände ringsum (Höhe 2), unten eine Tür-Lücke
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (y < 2 || x === 0 || x === w - 1 || y === h - 1) setCell(m, x, y, 'dungeon_wall', y === h - 1 ? 0 : 2);
      const dx = Math.floor(w / 2); setCell(m, dx, h - 1, f.kind === 'indoor' ? 'wood_floor' : 'stone_floor', 0);
      m.spawns = { entry: { x: dx * TILE + 8, y: (h - 2) * TILE + 10, dir: 'up' } };
      m.music = f.kind === 'cave' ? 'dungeon' : 'overworld';
      if (f.kind === 'cave') m.face = 'rock'; else m.face = 'brick';
    }
    E.change('Neue Karte', () => { E.doc.maps[id] = m; });
    openMap(id);
  };
  dlg.showModal();
}

// ---------------------------------------------------------------------------------------------------------------
// Probe spielen, Vorschau, Datei, Prüfen
function gameUrl(where) {
  const q = new URLSearchParams({ content: 'local' });
  if (where) { q.set('map', where.map); if (where.x != null) { q.set('x', where.x); q.set('y', where.y); } } else q.set('play', '1');
  q.set('notitle', '');
  return `index.html?${q.toString()}`;
}
function playtest(opts = {}) {
  save();
  const h = E.hover;
  const url = opts.here && h ? gameUrl({ map: E.mapId, x: h.x, y: h.y }) : gameUrl(opts.map ? opts : null);
  window.open(url, 'drift-probe');
}
E.playtest = playtest;
function viewCenterTile() {
  const r = $('#view').getBoundingClientRect();
  const t = E.view.screenToTile(r.left + r.width / 2, r.top + r.height / 2); const m = E.map();
  let x = Math.max(0, Math.min(m.w - 1, Math.floor(t.x))), y = Math.max(0, Math.min(m.h - 1, Math.floor(t.y)));
  // auf eine begehbare Zelle in der Nähe legen
  for (let d = 0; d < 8; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
    const id = tileAt(m, x + dx, y + dy); if (id && !TILE_DEFS[id]?.solid && !TILE_DEFS[id]?.pit) return { x: x + dx, y: y + dy };
  }
  return { x, y };
}
function refreshPreview() {
  const c = viewCenterTile();
  $('#previewFrame').src = gameUrl({ map: E.mapId, x: c.x, y: c.y }) + '&preview=1';
}
function togglePreview() {
  const pane = $('#previewPane'); pane.hidden = !pane.hidden;
  $('#btnPreview').classList.toggle('on', !pane.hidden);
  if (!pane.hidden) { save(); refreshPreview(); } else $('#previewFrame').src = 'about:blank';
}
function exportFile() {
  const blob = new Blob([JSON.stringify(bundleFromDoc(E.doc), null, 1)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: (E.doc.project.name || 'projekt').replace(/[^\wäöüÄÖÜß -]/g, '_') + '.drift.json' });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  E.toast('Projekt exportiert.');
}
function loadBundle(b, label) {
  try {
    const doc = docFromBundle(b);
    const before = snap();
    E.doc = doc; E.mapId = doc.project.start.map || Object.keys(doc.maps)[0]; E.sel = null;
    const after = snap();
    pushHistory({ label, undo: () => restore(before), redo: () => restore(after) });
    openMap(E.mapId);
    E.toast(label);
  } catch (e) { E.toast('Datei nicht lesbar: ' + e.message, 'error'); }
}
function checkProject() {
  const res = checkContent(bundleFromDoc(E.doc), { known: { species: Object.keys(SPECIES), items: Object.keys(ITEMS) } });
  const body = $('#modalBody'); body.textContent = '';
  body.append(el('h2', { textContent: res.errors.length ? `${res.errors.length} Fehler` : 'Alles spielbar ✓' }));
  const box = el('div', { class: 'issues' });
  for (const e of res.errors) box.append(el('div', { class: 'e', textContent: `✘ ${e.path}: ${e.message}` }));
  for (const w of res.warnings.filter((w) => !/migriert/.test(w.message))) box.append(el('div', { class: 'w', textContent: `⚠ ${w.path}: ${w.message}` }));
  // eigene Prüfungen: Warps ohne Rückweg, Karten ohne Zugang
  const reach = new Set([E.doc.project.start.map]); let grew = true;
  while (grew) { grew = false; for (const m of Object.values(E.doc.maps)) if (reach.has(m.id)) for (const w of [...m.warps, ...m.events.flatMap((e) => e.do.filter((a) => a.warp).map((a) => ({ to: a.warp })))]) if (w.to?.map && !reach.has(w.to.map)) { reach.add(w.to.map); grew = true; } }
  for (const m of Object.values(E.doc.maps)) if (!reach.has(m.id)) box.append(el('div', { class: 'w', textContent: `⚠ Karte „${m.name}“ ist vom Spielstart aus nicht erreichbar (kein Übergang dorthin).` }));
  if (!box.children.length) box.append(el('div', { textContent: 'Keine Probleme gefunden.' }));
  body.append(box);
  $('#modal').onclose = null; $('#modal').showModal();
}

// ---------------------------------------------------------------------------------------------------------------
// Eingabe auf der Karte
function bindInput() {
  const cv = $('#view');
  const pts = new Map(); let pan = null, pinch = null, spaceDown = false, active = false;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { e.preventDefault(); E.view.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - cv.getBoundingClientRect().left, e.clientY - cv.getBoundingClientRect().top); }, { passive: false });
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, e);
    if (pts.size === 2) {   // Zwei-Finger: Werkzeug abbrechen, Pan/Zoom
      if (active) { E.tool?.up?.(e); active = false; if (stroke) { restore(stroke.before); stroke = null; E.view.invalidate(); } }
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), s: E.view.scale, cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2, vx: E.view.x, vy: E.view.y };
      return;
    }
    if (e.button === 1 || spaceDown || E.toolId === 'pan') { pan = { x: e.clientX, y: e.clientY, vx: E.view.x, vy: E.view.y }; cv.style.cursor = 'grabbing'; return; }
    if (e.button === 2 && E.toolId !== 'paint' && E.toolId !== 'height') { pan = { x: e.clientX, y: e.clientY, vx: E.view.x, vy: E.view.y }; return; }
    active = true;
    try { E.tool?.down?.(e); } catch (err) { console.error(err); }
  });
  cv.addEventListener('pointermove', (e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, e);
    const t = tileOf(e); const m = E.map();
    const hv = { x: t.x, y: t.y };
    if (!E.hover || E.hover.x !== hv.x || E.hover.y !== hv.y) { E.hover = hv; E.view.redraw(); }
    if (m) $('#coords').textContent = t.x >= 0 && t.y >= 0 && t.x < m.w && t.y < m.h ? `${t.x}, ${t.y} · ${TILE_NAMES[tileAt(m, t.x, t.y)] || tileAt(m, t.x, t.y)} · Höhe ${heightAt(m, t.x, t.y)} · Zoom ${E.view.scale.toFixed(1)}×` : '';
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), cx = (a.clientX + b.clientX) / 2, cy = (a.clientY + b.clientY) / 2;
      const r = cv.getBoundingClientRect();
      const wx = (pinch.cx - r.left) / pinch.s + pinch.vx, wy = (pinch.cy - r.top) / pinch.s + pinch.vy;
      E.view.scale = Math.max(0.35, Math.min(8, pinch.s * (d / pinch.d)));
      E.view.x = wx - (cx - r.left) / E.view.scale; E.view.y = wy - (cy - r.top) / E.view.scale; E.view.redraw();
      return;
    }
    if (pan) { E.view.x = pan.vx - (e.clientX - pan.x) / E.view.scale; E.view.y = pan.vy - (e.clientY - pan.y) / E.view.scale; E.view.redraw(); return; }
    if (active) { try { E.tool?.move?.(e); } catch (err) { console.error(err); } }
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pan) { pan = null; cv.style.cursor = E.tool?.cursor || 'crosshair'; return; }
    if (active) { active = false; try { E.tool?.up?.(e); } catch (err) { console.error(err); } }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { E.hover = null; E.view.redraw(); });
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || $('#modal').open) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? E.redo() : E.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); E.redo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); save(); exportFile(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'd' && E.sel && E.sel.kind !== 'spawn') { e.preventDefault(); const m = E.map(); const c = clone(E.ref()); if (c.x != null) { c.x += TILE; } else if (c.rect) c.rect[0] += 1; if (c.id) c.id += '_2'; const kind = E.sel.kind; const index = E.change('Dupliziert', () => { m[COLL[kind]].push(c); return m[COLL[kind]].length - 1; }); E.select({ kind, index }); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === ' ') { spaceDown = true; cv.style.cursor = 'grab'; e.preventDefault(); return; }
    if ((k === 'delete' || k === 'backspace') && E.sel) { deleteSel(); return; }
    if (k === 'escape') { E.select(null); return; }
    if (k === '0') { E.view.fit(); return; }
    if (k === '+' || k === '=') { const r = cv.getBoundingClientRect(); E.view.zoomAt(1.25, r.width / 2, r.height / 2); return; }
    if (k === '-') { const r = cv.getBoundingClientRect(); E.view.zoomAt(0.8, r.width / 2, r.height / 2); return; }
    if (k === '#') { E.view.showGrid = !E.view.showGrid; renderTools(); E.view.redraw(); return; }
    if (k === 'p') { playtest({ here: e.shiftKey }); return; }
    if (k === '[' || k === ']') { E.brush.size = Math.max(1, Math.min(9, E.brush.size + (k === ']' ? 1 : -1))); renderPalette(); E.view.redraw(); return; }
    const t = Object.values(E.tools).find((x) => x.key === k); if (t) setTool(t.id);
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') { spaceDown = false; cv.style.cursor = E.tool?.cursor || 'crosshair'; } });
}

// ---------------------------------------------------------------------------------------------------------------
// Start
async function loadPlugins() {
  for (const p of plugins) {
    try { const mod = await import(new URL(p, new URL('../plugins.js', import.meta.url)).href); await (mod.default || mod.register)?.(E, makeApi(E)); }
    catch (e) { console.warn('[editor] Plugin', p, e); E.toast(`Plugin „${p}“ konnte nicht geladen werden.`, 'error'); }
  }
}
function boot() {
  E.assets = buildAssets();
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch { raw = null; }
  try { E.doc = raw ? docFromBundle(raw) : starterProject(); } catch (e) { console.warn(e); E.doc = starterProject(); E.toast('Gespeichertes Projekt war defekt – Beispielprojekt geladen.', 'error'); }
  for (const id of Object.keys(E.doc.maps)) normalizeMap(E.doc.maps[id], id);
  let ui = {}; try { ui = JSON.parse(localStorage.getItem('drift.editor.ui') || '{}'); } catch { /* egal */ }
  E.mapId = E.doc.maps[ui.map] ? ui.map : E.doc.project.start.map || Object.keys(E.doc.maps)[0];
  for (const t of DEFAULT_TOOLS) E.tools[t.id] = t;
  E.view = createView($('#view'), E);
  setTool(E.tools[ui.tool] ? ui.tool : 'paint');
  renderMaps(); renderInspector();
  E.view.fit();
  bindInput();
  document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', (e) => {
    const c = b.dataset.cmd;
    if (c === 'undo') E.undo(); else if (c === 'redo') E.redo();
    else if (c === 'play') playtest({ here: e.shiftKey });
    else if (c === 'preview') togglePreview(); else if (c === 'refreshPreview') { save(); refreshPreview(); }
    else if (c === 'export') exportFile(); else if (c === 'open') $('#fileIn').click();
    else if (c === 'check') checkProject(); else if (c === 'addMap') addMapDialog();
    else if (c === 'new') { if (confirm('Neues Projekt beginnen? (Das aktuelle bleibt per Rückgängig erreichbar – exportiere es vorher, wenn du es behalten willst.)')) loadBundle(bundleFromDoc(starterProject()), 'Neues Projekt'); }
  }));
  $('#fileIn').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; try { loadBundle(JSON.parse(await f.text()), `„${f.name}“ geöffnet`); } catch (err) { E.toast('Keine gültige JSON-Datei: ' + err.message, 'error'); } e.target.value = ''; });
  $('#projName').addEventListener('change', (e) => E.change('Projektname', () => { E.doc.project.name = e.target.value || 'Mein Abenteuer'; }));
  // Dateien per Drag & Drop
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', async (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && /json$/i.test(f.name)) { try { loadBundle(JSON.parse(await f.text()), `„${f.name}“ geöffnet`); } catch (err) { E.toast(err.message, 'error'); } } });
  save();
  loadPlugins();
  E.emit('ready');
}
boot();
