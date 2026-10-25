// Eigene Grafik-Pakete ins laufende Spiel/den Editor einhängen: liest die Bilder aus IndexedDB (store.js), schneidet sie laut
// Paket-Spezifikation (project.assets.packs[]) aus und registriert sie in assets + TILE_DEFS.
//   Tiles:   assets.tiles['<paket>:<name>'] (auf tileRes hochskaliert, kantenscharf), Verhalten von `like` (grass, water …)
//   Objekte: assets.sprites['<paket>:<name>'] (Anker unten mittig, ws = 16 / Raster)
//   Figuren: assets.sprites['npc_<paket>:<name>_<idle|walk>_<dir>'] → als NPC-Aussehen „<paket>:<name>“ nutzbar
//   overrides: { <eingebaute Tile-ID>: <Paket-Tile> } ersetzt eingebaute Boden-Texturen
import { TILE_DEFS } from '../data/tiles.js';
import { getPack } from './store.js';
import { imgFromBlob, crop, toCanvas, resizeNearest, bbox } from './img.js';

const SOFT = new Set(['grass', 'grass_dark', 'grass_light', 'grass_flowers', 'grass_tall', 'path', 'dirt', 'sand', 'clearing', 'stone_floor']);
/** Laufzeit-Infos zu Paket-Objekten (für Kollision im Spiel): id → { solid, box } */
export const PACK_OBJECTS = {};
const DIRS = ['down', 'up', 'left', 'right'];

export const packKey = (pk, name) => `${pk}:${name}`;

/** Bild-Puffer eines Pakets laden (Cache pro Aufruf) */
async function loader(packId) {
  const rec = await getPack(packId).catch(() => null);
  if (!rec) return null;
  const files = new Map(rec.files.map((f) => [f.path, f.blob]));
  const cache = new Map();
  return async (path) => {
    if (cache.has(path)) return cache.get(path);
    const blob = files.get(path);
    const p = blob ? imgFromBlob(blob).catch(() => null) : Promise.resolve(null);
    cache.set(path, p);
    return p;
  };
}

/**
 * Alle aktiven Pakete eines Projekts registrieren. Gibt eine Übersicht für Paletten zurück:
 * { tiles:[{id,name,like,canvas}], objects:[{id,name,canvas}], characters:[{id,name,canvas}], missing:[packId] }
 */
export async function installPacks(project, assets, { tileDefs = TILE_DEFS } = {}) {
  const out = { tiles: [], objects: [], characters: [], missing: [] };
  const packs = project?.assets?.packs || [];
  const RES = assets.tileRes || 16;
  for (const pk of packs) {
    if (pk.enabled === false || pk.source === 'embedded') continue;
    const load = await loader(pk.id);
    if (!load) { out.missing.push(pk.id); continue; }
    try { await installOne(pk, load, assets, tileDefs, RES, out); }
    catch (e) { console.warn('[assetpack] Paket', pk.id, e); out.missing.push(pk.id); }
  }
  return out;
}

async function installOne(pk, load, assets, tileDefs, RES, out) {
  for (const [name, t] of Object.entries(pk.tiles || {})) {
    const img = await load(t.file); if (!img) continue;
    const rects = t.frames || [t.rect];
    const arr = rects.map((r) => toCanvas(resizeNearest(crop(img, r[0], r[1], r[2], r[3]), RES, RES)));
    if (arr.length > 1) arr.mode = t.anim ? undefined : 'variant';
    const id = packKey(pk.id, name), like = tileDefs[t.like] ? t.like : 'grass';
    assets.tiles[id] = arr;
    tileDefs[id] = { ...tileDefs[like], pack: pk.id, like };
    if (assets.edgeGroup) assets.edgeGroup[id] = SOFT.has(like) ? like : (assets.edgeGroup[like] && like !== 'water' ? assets.edgeGroup[like] : id);
    out.tiles.push({ id, name, like, canvas: arr[0] });
  }
  for (const [builtin, key] of Object.entries(pk.overrides || {})) {
    const id = packKey(pk.id, key);
    if (assets.tiles[id] && tileDefs[builtin]) assets.tiles[builtin] = assets.tiles[id];
  }
  for (const [name, s] of Object.entries(pk.sprites || {})) {
    const img = await load(s.file); if (!img) continue;
    const ws = s.scale || 16 / (pk.grid || 16);
    const id = packKey(pk.id, name);
    if (s.kind === 'character') {
      const [fw, fh] = s.frame || [16, 16];
      const [ax, ay] = s.anchor || [fw / 2, fh];
      let first = null;
      for (const [action, dirs] of Object.entries(s.anim || {})) for (const dir of DIRS) {
        const row = dirs?.[dir];
        if (!Array.isArray(row)) continue;                // 'mirror' → Animator spiegelt rechts
        const [r, n] = row;
        const frames = [];
        for (let c = 0; c < Math.max(1, n); c++) frames.push(toCanvas(crop(img, c * fw, r * fh, fw, fh), { ax, ay: ay - 1, ws }));
        assets.sprites[`npc_${id}_${action}_${dir}`] = frames;
        first ||= frames[0];
      }
      // ohne eigene Idle-Reihe: erstes Lauf-Bild
      for (const dir of DIRS) if (!assets.sprites[`npc_${id}_idle_${dir}`] && assets.sprites[`npc_${id}_walk_${dir}`]) assets.sprites[`npc_${id}_idle_${dir}`] = [assets.sprites[`npc_${id}_walk_${dir}`][0]];
      if (first) out.characters.push({ id, name, canvas: first });
      continue;
    }
    const [x, y, w, h] = s.rect;
    const part = crop(img, x, y, w, h);
    const b = bbox(part) || { x: 0, y: 0, w, h };
    const c = toCanvas(part, { ax: b.x + b.w / 2, ay: b.y + b.h - 1, ws });
    assets.sprites[id] = [c];
    // Fuß-Box: untere Kante, ~70 % der Breite, flach
    const bw = Math.max(6, Math.round(b.w * ws * 0.7)), bh = Math.max(4, Math.min(10, Math.round(b.h * ws * 0.3)));
    PACK_OBJECTS[id] = { solid: s.solid !== false, box: s.box || [-bw / 2, -bh, bw, bh + 1], name: s.label || name };
    out.objects.push({ id, name, canvas: c });
  }
}
