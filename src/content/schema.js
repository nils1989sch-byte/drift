// DRIFT-Inhaltsformat drift-content@1 – Schema, Defaults, Validierung (deutsche Meldungen + Pfad), Migrationen.
// Verbindliche Beschreibung: docs/CONTENT_FORMAT.md. Keine DOM-Abhängigkeit (läuft auch in Node).
//
//   normalizeContent(raw)          → { content, errors, warnings }   Datei-Form → Speicher-Form (+ Migration, Defaults)
//   validateContent(content, opt)  → { errors, warnings }            Querverweise, Typen, Wertebereiche
//   checkContent(raw, opt)         → { ok, content, errors, warnings }
//   createProject(o), createMap(o) → neue, gültige Objekte für den Editor
//
// Speicher-Form („content“): { project, maps:{id:Map}, species:{}, moves:{}, items:{}, characters:{}, dialogs:{} }
// Map.layers.ground = string[] (Tile-IDs, w*h), Map.layers.height = number[] (w*h).
import { TILE_DEFS, FACE_IDS, LEGEND_DEFAULT } from '../data/tiles.js';
import { decodeGround, decodeHeight, RESERVED_CHARS } from './layers.js';

export const TILE = 16;
export const FORMAT_NAME = 'drift-content';
export const FORMAT_VERSION = 1;
export const FORMAT = `${FORMAT_NAME}@${FORMAT_VERSION}`;
export const BUNDLE_FORMAT = 'drift-bundle@1';
export const LOCAL_KEY = 'drift.editor.project';
export const COLLECTIONS = ['maps', 'species', 'moves', 'items', 'characters', 'dialogs'];
export const DIRS = ['down', 'up', 'left', 'right'];
export const TYPES = ['normal', 'fire', 'water', 'plant', 'bolt', 'stone', 'wind'];
export const MOVE_FORMS = ['melee', 'dash', 'projectile', 'area', 'cone', 'buff'];
export const HABITATS = ['grass', 'forest', 'shore', 'cave', 'cliff', 'meadow', 'water', 'any'];
export const TIMES = ['any', 'day', 'night', 'morning', 'evening'];
export const ITEM_KINDS = ['tool', 'seed', 'crop', 'ball', 'potion', 'ore', 'key', 'misc'];
export const MAP_ITEM_TYPES = ['chest', 'pickup', 'hidden'];
export const NPC_BEHAVIORS = ['idle', 'wander', 'patrol', 'turn'];
export const TRIGGERS = ['load', 'enter', 'interact', 'auto'];
export const ASSET_SOURCES = ['local', 'embedded'];
// Gegenstände, die das bestehende Spiel ohne Item-Katalog kennt (Truhen/Pickups der Ur-Welt).
export const LEGACY_ITEMS = ['rupees', 'rupee', 'rupee5', 'rupee20', 'key', 'bombs', 'heart', 'heart_container', 'crystal', 'money'];

// Aktionen (`do`) und Bedingungen (`if`) – Katalog für Validierung, Editor-Paletten und events.js.
export const ACTIONS = {
  say:         'Text zeigen: Zeilen (String | String[]), optional speaker',
  dialog:      'Dialog per ID starten',
  goto:        'zu Dialog/Knoten springen und aktuelle Liste beenden',
  choice:      '{ text, speaker?, options:[{ label, if?, do? }] } – Auswahl',
  setFlag:     'Flag setzen: "name" | { name, value?, save? }',
  clearFlag:   'Flag löschen: "name"',
  toggleFlag:  'Flag umschalten: "name"',
  add:         'Zähler erhöhen: { var, value? }',
  give:        'Gegenstand geben: { item, count? }',
  take:        'Gegenstand nehmen: { item, count? }',
  money:       'Geld ändern: Zahl (+/-)',
  heal:        'Team heilen: true',
  battle:      'Trainerkampf: "trainerId" | { trainer, win?:[…], lose?:[…] }',
  wildBattle:  'Wildkampf: { species, level, win?, lose? }',
  giveMonster: 'Monster geben: { species, level?, nick? }',
  giveStarter: 'Starter-Auswahl: true | ["id", …]',
  warp:        'Kartenwechsel: { map, spawn }',
  shop:        'Laden öffnen: { name?, stock:[itemId|{item,price}] }',
  talk:        'NPC ansprechen lassen: "npcId"',
  music:       'Musik wechseln: "id"',
  sound:       'Geräusch: "id"',
  toast:       'Kurzmeldung: "Text"',
  wait:        'warten: Sekunden',
  if:          'Bedingung: { if, then:[…], else?:[…] }',
  call:        'Host-Funktion: "name" | { name, args }',
  end:         'Liste beenden: true',
};
export const CONDITIONS = {
  flag:       'Flag gesetzt ("name") – "!name" = nicht gesetzt',
  notFlag:    'Flag nicht gesetzt',
  flags:      'alle Flags gesetzt (Array, "!x" erlaubt)',
  var:        '{ var:"name", ">=":2 } Zähler-Vergleich (==, !=, >, >=, <, <=)',
  hasItem:    'Gegenstand vorhanden: "id" | { item, count }',
  hasMonster: 'Monster im Team/Box: "speciesId" | true (irgendeins)',
  time:       'Tageszeit: day | night | morning | evening',
  'money>=':  'mindestens so viel Geld',
  'money<':   'weniger Geld als',
  hurt:       'Team/Spieler verletzt: true',
  defeated:   '"all": alle Gegner/Wildmonster der Karte besiegt',
  check:      'Host-Prüfung: "name" | { name, args }',
  all:        'alle Bedingungen (Array)',
  any:        'mindestens eine (Array)',
  not:        'Negation',
};

// Fußpunkt-Versatz im Tile für Altkarten (Kopie aus src/game/entities/objects.js OBJ.foot, Default [8,14]).
export const LEGACY_FOOT = {
  house: [0, 15], fence_v: [8, 15], rock_big: [16, 15], cave_entrance: [8, 15], rock_cracked: [8, 15],
  wall_cracked: [8, 31.9], door_locked: [8, 31.9], shutter: [8, 15.9], block: [8, 15.5], switch: [8, 12],
  portal: [8, 10], cart: [16, 14], well: [16, 15], bench: [16, 14],
};
export const legacyFoot = (t) => LEGACY_FOOT[t] || [8, 14];
export const NPC_FOOT = [8, 12];      // NPCs/Gegner/Trainer: px = x*16+8, py = y*16+12

export const DEFAULTS = {
  project: () => ({ format: FORMAT, id: 'projekt', name: 'Neues Abenteuer', author: '', description: '', version: '0.1.0',
    start: { map: '', spawn: 'start' }, starters: [], flags: {}, player: { money: 0, items: [] }, music: { default: 'overworld' },
    builtins: { species: true, moves: true, items: true, dialogs: true }, index: {}, assets: { packs: [] } }),
  map: () => ({ name: '', w: 24, h: 16, outdoor: true, face: 'rock', plinth: 'earth', music: 'overworld', ambient: true,
    objects: [], npcs: [], trainers: [], enemies: [], encounters: [], items: [], warps: [], spawns: {}, events: [], areas: [], farm: null }),
  species: () => ({ name: '', types: ['normal'], base: { hp: 50, atk: 50, def: 50, spd: 50 }, catch: 0.5, xp: 50, habitat: 'grass',
    time: 'any', size: 24, learn: [[1, 'rempler']], dex: '' }),
  move: () => ({ name: '', type: 'normal', form: 'melee', power: 30, cooldown: 1, windup: 0.15, range: 20 }),
  item: () => ({ name: '', kind: 'misc', stack: 99, sell: 0, desc: '' }),
  character: () => ({ name: '', base: 'human', body: 'normal', skin: '#e8b896', hair: { style: 'short', color: '#5a3a20' },
    top: { style: 'shirt', color: '#5080c0' }, bottom: { style: 'pants', color: '#4a4038' }, accessories: [], eyes: '#3a2a20' }),
};

// ---------------------------------------------------------------------------------------------------------------
// Meldungen
export class Report {
  constructor() { this.errors = []; this.warnings = []; }
  error(path, message) { this.errors.push({ path, message, level: 'error', toString: () => `${path}: ${message}` }); }
  warn(path, message) { this.warnings.push({ path, message, level: 'warning', toString: () => `${path}: ${message}` }); }
  get ok() { return this.errors.length === 0; }
}
export class ContentError extends Error {
  constructor(errors, warnings = []) {
    super(`Inhalt ungültig (${errors.length} Fehler):\n` + errors.slice(0, 12).map((e) => `  ${e.path}: ${e.message}`).join('\n') + (errors.length > 12 ? `\n  … und ${errors.length - 12} weitere` : ''));
    this.name = 'ContentError'; this.errors = errors; this.warnings = warnings;
  }
}
export const formatIssues = (list) => list.map((e) => `${e.path}: ${e.message}`).join('\n');

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string';
const typeName = (v) => (v === null ? 'null' : Array.isArray(v) ? 'Array' : typeof v === 'object' ? 'Objekt' : typeof v === 'string' ? `Text „${v.length > 20 ? v.slice(0, 20) + '…' : v}“` : typeof v === 'number' ? `Zahl ${v}` : typeof v);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const ID_RE = /^[a-z0-9_][a-z0-9_\-.]*$/i;
export const isRect = (r) => Array.isArray(r) && r.length === 4 && r.every(isNum) && r[2] > 0 && r[3] > 0;

function need(R, path, v, kind, { optional = false } = {}) {
  if (v === undefined || v === null) { if (!optional) R.error(path, 'Pflichtfeld fehlt'); return false; }
  const ok = kind === 'number' ? isNum(v) : kind === 'int' ? Number.isInteger(v) : kind === 'string' ? isStr(v)
    : kind === 'id' ? isStr(v) && ID_RE.test(v) : kind === 'bool' ? typeof v === 'boolean' : kind === 'array' ? Array.isArray(v)
      : kind === 'object' ? isObj(v) : kind === 'rect' ? isRect(v) : true;
  if (!ok) {
    const msg = { number: 'muss eine Zahl sein', int: 'muss eine ganze Zahl sein', string: 'muss ein Text sein',
      id: 'muss eine ID sein (Buchstaben, Ziffern, _ - .)', bool: 'muss true/false sein', array: 'muss eine Liste sein',
      object: 'muss ein Objekt sein', rect: 'muss ein Rechteck [x, y, Breite, Höhe] in Tiles sein (Breite/Höhe > 0)' }[kind];
    R.error(path, `${msg} (ist: ${typeName(v)})`);
  }
  return ok;
}
function oneOf(R, path, v, list, { warn = false, optional = true } = {}) {
  if (v === undefined && optional) return true;
  if (list.includes(v)) return true;
  (warn ? R.warn : R.error).call(R, path, `unbekannter Wert ${typeName(v)} – erlaubt: ${list.join(', ')}`);
  return false;
}

// ---------------------------------------------------------------------------------------------------------------
// Version / Migration
export function parseFormat(f) {
  if (f == null) return { name: FORMAT_NAME, version: 0 };
  const m = /^([a-z-]+)@(\d+)$/.exec(String(f));
  return m ? { name: m[1], version: +m[2] } : { name: String(f), version: NaN };
}
/** Altkarten (JS-Karten von src/game/maps: rows/heights, Objekte mit `t`, Tile-Koordinaten) gelten als Version 0. */
export const isLegacyMap = (m) => isObj(m) && (Array.isArray(m.rows) || (Array.isArray(m.objects) && m.objects.some((o) => o && 't' in o && !('type' in o))));

/** Migrationen je Dateiart: MIGRATIONS[kind][v] wandelt Version v → v+1. */
export const MIGRATIONS = {
  project: { 0: (p) => ({ ...p, format: 'drift-content@1' }) },
  map: { 0: (m, R, path) => migrateLegacyMap(m, R, path) },
};

export function migrate(kind, doc, R = new Report(), path = kind) {
  let v = kind === 'map' ? (isLegacyMap(doc) ? 0 : parseFormat(doc.format ?? FORMAT).version) : parseFormat(doc.format).version;
  if (Number.isNaN(v)) { R.error(path + '.format', `unbekanntes Format „${doc.format}“ (erwartet ${FORMAT})`); return doc; }
  if (v > FORMAT_VERSION) { R.error(path + '.format', `Version ${v} ist neuer als dieser Loader (${FORMAT_VERSION}) – bitte DRIFT aktualisieren`); return doc; }
  let out = doc;
  while (v < FORMAT_VERSION) {
    const fn = MIGRATIONS[kind]?.[v];
    if (fn) { out = fn(out, R, path); R.warn(path, `von Version ${v} auf ${v + 1} migriert`); }
    v++;
  }
  if (kind === 'map' && out.format) delete out.format;
  return out;
}

/** Altkarte (Runtime-Def aus src/game/maps) → drift-content@1-Karte. Funktionen werden verworfen (Warnung). */
export function migrateLegacyMap(def, R = new Report(), path = 'map', { foot = legacyFoot } = {}) {
  const id = def.id;
  const out = {};
  for (const [k, v] of Object.entries(def)) {
    if (typeof v === 'function') { R.warn(`${path}.${k}`, `Funktion „${k}“ lässt sich nicht als JSON speichern – bitte als Event nachbauen`); continue; }
    if (['rows', 'heights', 'objects', 'enemies', 'npcs', 'warps', 'areas', 'legend'].includes(k)) continue;
    out[k] = clone(v);
  }
  const rows = def.rows || [];
  out.h = rows.length; out.w = Math.max(0, ...rows.map((r) => r.length));
  const legend = { ...(def.legend || {}) };
  const usedChars = new Set(rows.join(''));
  out.legend = Object.fromEntries([...usedChars].sort().map((c) => [c, legend[c] ?? LEGEND_DEFAULT[c] ?? c]));
  out.layers = { ground: rows.map((r) => r.padEnd(out.w, ' ')), height: def.heights ? def.heights.map((r) => r.padEnd(out.w, '0')) : undefined };
  if (!out.layers.height) delete out.layers.height;
  out.objects = []; out.items = []; out.enemies = []; out.npcs = [];
  const fnWarn = (p, o) => { for (const [k, v] of Object.entries(o)) if (typeof v === 'function') R.warn(`${p}.${k}`, `Funktion „${k}“ verworfen – als Bedingung (if) nachbauen`); };
  const plain = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v !== 'function'));
  (def.objects || []).forEach((o, i) => {
    const p = `${path}.objects[${i}]`; fnWarn(p, o);
    const { t, x, y, px, py, showFlag, ...rest } = plain(o);
    if (t === 'barrier') { out.objects.push({ type: 'barrier', rect: [x, y, o.w, o.h], ...omit(rest, ['w', 'h']) }); return; }
    const [fx, fy] = foot(t);
    const X = px ?? x * TILE + fx, Y = py ?? y * TILE + fy;
    if (t === 'chest') {
      const { item, amount, text, flag, ...r2 } = rest;
      out.items.push({ type: 'chest', x: X, y: Y, contents: { item, count: amount ?? 1 }, ...(text ? { text } : {}),
        flag: flag || `chest_${id}_${x}_${y}`, ...r2 });
      return;
    }
    const e = { type: t, x: X, y: Y, ...rest };
    if (showFlag) e.if = showFlag;
    out.objects.push(e);
  });
  (def.enemies || []).forEach((o, i) => {
    fnWarn(`${path}.enemies[${i}]`, o);
    const { t, x, y, px, py, patrol, ...rest } = plain(o);
    const e = { type: t, x: px ?? x * TILE + NPC_FOOT[0], y: py ?? y * TILE + NPC_FOOT[1], ...rest };
    if (patrol) e.patrol = patrol.map(([a, b]) => [a * TILE + NPC_FOOT[0], b * TILE + NPC_FOOT[1]]);
    out.enemies.push(e);
  });
  const ids = new Set();
  (def.npcs || []).forEach((o, i) => {
    fnWarn(`${path}.npcs[${i}]`, o);
    const { t, x, y, dir, wander, dialog, sprite, id: nid, ...rest } = plain(o);
    let base = nid || dialog || t, k = base, n = 2;
    while (ids.has(k)) k = `${base}_${n++}`;
    ids.add(k);
    out.npcs.push({ id: k, character: t, x: x * TILE + NPC_FOOT[0], y: y * TILE + NPC_FOOT[1], dir: dir || 'down',
      behavior: wander ? { type: 'wander', radius: 28 } : { type: 'idle' }, dialog: dialog || t, ...rest });
  });
  out.warps = (def.warps || []).map((w) => {
    const { x, y, w: ww, h, to, spawn, needFlag, ...rest } = plain(w);
    const o = { rect: [x, y, ww, h], ...rest };
    if (to) o.to = { map: to, spawn: spawn ?? 'entry' };
    if (needFlag) o.if = needFlag;
    return o;
  });
  if (def.areas) out.areas = def.areas.map(({ x0, y0, x1, y1, name, ...rest }) => ({ name, rect: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], ...rest }));
  return out;
}
const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

// ---------------------------------------------------------------------------------------------------------------
// Normalisierung (Datei-Form → Speicher-Form, Defaults)
function normPoint(R, path, o) { need(R, path + '.x', o.x, 'number'); need(R, path + '.y', o.y, 'number'); }

export function normalizeMap(raw, id, R = new Report(), path = `maps.${id}`) {
  if (!isObj(raw)) { R.error(path, `muss ein Objekt sein (ist: ${typeName(raw)})`); return null; }
  const src = migrate('map', clone(raw), R, path);
  const m = { ...DEFAULTS.map(), ...src, id: src.id || id };
  if (src.id && src.id !== id) R.warn(path + '.id', `ID „${src.id}“ weicht vom Schlüssel „${id}“ ab – Schlüssel gilt`);
  m.id = id;
  if (!m.name) m.name = id;
  if (src.ambient === undefined) m.ambient = !!m.outdoor;
  need(R, path + '.w', m.w, 'int'); need(R, path + '.h', m.h, 'int');
  if (m.w < 1 || m.h < 1 || m.w > 512 || m.h > 512) R.error(path, `Kartengröße ${m.w}×${m.h} außerhalb 1–512`);
  const legend = isObj(m.legend) ? m.legend : {};
  for (const c of Object.keys(legend)) {
    if (c.length !== 1) R.error(`${path}.legend.${c}`, 'Legenden-Schlüssel muss genau ein Zeichen sein');
    if (RESERVED_CHARS.includes(c)) R.error(`${path}.legend.${c}`, `„${c}“ ist für RLE reserviert`);
  }
  const L = isObj(m.layers) ? { ...m.layers } : {};
  try {
    L.ground = Array.isArray(L.ground) && L.ground.length === m.w * m.h && L.ground.every((v) => isStr(v) && v.length > 1)
      ? L.ground.slice()                                     // bereits Speicher-Form (Tile-IDs)
      : L.ground == null ? new Array(m.w * m.h).fill(m.fill || 'grass') : decodeGround(L.ground, m.w, m.h, legend);
  } catch (e) { R.error(path + '.layers.ground', e.message); L.ground = new Array(Math.max(0, m.w * m.h)).fill('grass'); }
  try {
    L.height = Array.isArray(L.height) && L.height.length === m.w * m.h && L.height.every(isNum) ? L.height.slice() : decodeHeight(L.height, m.w, m.h);
  } catch (e) { R.error(path + '.layers.height', e.message); L.height = new Array(Math.max(0, m.w * m.h)).fill(0); }
  m.layers = L; delete m.legend; delete m.fill;

  for (const k of ['objects', 'npcs', 'trainers', 'enemies', 'encounters', 'items', 'warps', 'events', 'areas']) {
    if (!Array.isArray(m[k])) { if (m[k] != null) R.error(`${path}.${k}`, `muss eine Liste sein (ist: ${typeName(m[k])})`); m[k] = []; }
  }
  if (!isObj(m.spawns)) { if (m.spawns != null) R.error(`${path}.spawns`, 'muss ein Objekt { name: {x,y,dir} } sein'); m.spawns = {}; }
  m.objects = m.objects.map((o) => ({ ...o }));
  m.npcs = m.npcs.map((n, i) => ({ id: n.id || `npc_${i + 1}`, dir: 'down', behavior: { type: 'idle' }, ...n,
    behavior: typeof n.behavior === 'string' ? { type: n.behavior } : { type: 'idle', ...(n.behavior || {}) } }));
  m.trainers = m.trainers.map((t, i) => ({ id: t.id || `trainer_${i + 1}`, dir: 'down', sight: 64, reward: 0, team: [], ...t,
    flag: t.flag || `trainer_${id}_${t.id || i + 1}`, team: (t.team || []).map((e) => (isStr(e) ? { species: e, level: 5 } : { level: 5, ...e })) }));
  m.encounters = m.encounters.map((e, i) => ({ id: e.id || `zone_${i + 1}`, density: 3, ...e,
    table: (e.table || []).map((r) => {
      const lv = Array.isArray(r.levels) ? r.levels : isNum(r.level) ? [r.level, r.level] : [3, 5];
      return { weight: 1, time: 'any', ...r, levels: [lv[0], lv[1] ?? lv[0]] };
    }) }));
  m.items = m.items.map((it) => {
    const o = { type: 'chest', ...it };
    if (!o.contents && o.item) { o.contents = { item: o.item, count: o.count ?? o.amount ?? 1 }; delete o.item; delete o.count; delete o.amount; }
    if (o.contents) o.contents = { count: 1, ...o.contents };
    if (!o.flag && isNum(o.x) && isNum(o.y)) o.flag = `${o.type === 'chest' ? 'chest' : 'item'}_${id}_${Math.floor(o.x / TILE)}_${Math.floor(o.y / TILE)}`;
    return o;
  });
  m.warps = m.warps.map((w) => ({ ...w, to: isStr(w.to) ? { map: w.to, spawn: w.spawn ?? 'entry' } : w.to ? { spawn: 'entry', ...w.to } : undefined }));
  for (const w of m.warps) { delete w.spawn; if (!w.to) delete w.to; }
  m.events = m.events.map((e, i) => ({ id: e.id || `event_${i + 1}`, once: false, do: [], ...e,
    trigger: isStr(e.trigger) ? { type: e.trigger } : { type: 'interact', ...(e.trigger || {}) } }));
  if (isObj(m.dialogs)) for (const [k, d] of Object.entries(m.dialogs)) m.dialogs[k] = normalizeDialog(d, k);
  return m;
}

export function normalizeSpecies(raw, id) {
  const s = { ...DEFAULTS.species(), ...clone(raw), id };
  s.base = { ...DEFAULTS.species().base, ...(raw.base || {}) };
  if (!s.name) s.name = id;
  if (isStr(s.types)) s.types = [s.types];
  s.learn = (s.learn || []).map((e) => (Array.isArray(e) ? [e[0], e[1]] : [e.level, e.move]));
  return s;
}
export const normalizeMove = (raw, id) => { const m = { ...DEFAULTS.move(), ...clone(raw), id }; if (!m.name) m.name = id; return m; };
export const normalizeItem = (raw, id) => { const m = { ...DEFAULTS.item(), ...clone(raw), id }; if (!m.name) m.name = id; return m; };
export function normalizeCharacter(raw, id) {
  if (raw && (raw.base === 'builtin' || raw.sprite)) return { name: id, base: 'builtin', ...clone(raw), id };
  const d = DEFAULTS.character();
  const c = { ...d, ...clone(raw), id };
  c.hair = { ...d.hair, ...(raw.hair || {}) }; c.top = { ...d.top, ...(raw.top || {}) }; c.bottom = { ...d.bottom, ...(raw.bottom || {}) };
  if (!c.name) c.name = id;
  return c;
}
export function normalizeDialog(raw, id) {
  if (Array.isArray(raw) || isStr(raw)) return { id, lines: [].concat(raw) };
  const d = { ...clone(raw), id };
  if (isStr(d.lines)) d.lines = [d.lines];
  return d;
}

function normalizeAssets(a, R, path = 'project.assets') {
  if (a == null) return { packs: [] };
  const out = Array.isArray(a) ? { packs: a } : { packs: [], ...a };
  if (!Array.isArray(out.packs)) { R.error(path + '.packs', 'muss eine Liste sein'); out.packs = []; }
  out.packs = out.packs.map((p) => ({ source: 'local', enabled: true, tiles: {}, sprites: {}, overrides: {}, ...p,
    license: isStr(p.license) ? { id: p.license } : { ...(p.license || {}) } }));
  return out;
}

export function normalizeProject(raw, R = new Report()) {
  const src = migrate('project', clone(raw || {}), R, 'project');
  const d = DEFAULTS.project();
  const p = { ...d, ...src, format: FORMAT };
  p.start = { ...d.start, ...(src.start || {}) };
  p.player = { ...d.player, ...(src.player || {}) };
  p.builtins = { ...d.builtins, ...(src.builtins || {}) };
  p.music = { ...d.music, ...(src.music || {}) };
  p.assets = normalizeAssets(src.assets, R);
  return p;
}

/** Rohdaten (Datei-Form, z. B. aus unbundle oder dem Ordner) → Speicher-Form. */
export function normalizeContent(raw, R = new Report()) {
  const content = { project: normalizeProject(raw.project, R) };
  const fns = { maps: null, species: normalizeSpecies, moves: normalizeMove, items: normalizeItem, characters: normalizeCharacter, dialogs: normalizeDialog };
  for (const k of COLLECTIONS) {
    const coll = raw[k] || {};
    content[k] = {};
    if (!isObj(coll)) { R.error(k, `muss ein Objekt { id: … } sein (ist: ${typeName(coll)})`); continue; }
    for (const [id, v] of Object.entries(coll)) {
      if (!ID_RE.test(id)) R.error(`${k}.${id}`, 'ungültige ID (erlaubt: Buchstaben, Ziffern, _ - .)');
      if (k === 'maps') { const m = normalizeMap(v, id, R); if (m) content.maps[id] = m; }
      else if (!isObj(v) && !(k === 'dialogs' && (Array.isArray(v) || isStr(v)))) R.error(`${k}.${id}`, `muss ein Objekt sein (ist: ${typeName(v)})`);
      else content[k][id] = fns[k](v, id);
    }
  }
  // Inline-Dialoge der Karten global verfügbar machen
  for (const m of Object.values(content.maps)) {
    if (!isObj(m.dialogs)) continue;
    for (const [id, d] of Object.entries(m.dialogs)) {
      if (content.dialogs[id] && content.dialogs[id] !== d) R.warn(`maps.${m.id}.dialogs.${id}`, 'Dialog-ID ist doppelt vergeben – Karten-Dialog überschreibt');
    }
  }
  for (const [k, v] of Object.entries(raw)) if (!(k in content) && k !== 'format' && k !== 'assetData') content[k] = clone(v);   // unbekannte Felder erhalten
  return { content, errors: R.errors, warnings: R.warnings };
}

// ---------------------------------------------------------------------------------------------------------------
// Validierung (Speicher-Form)
export function allDialogs(content) {
  const out = { ...(content.dialogs || {}) };
  for (const m of Object.values(content.maps || {})) if (isObj(m.dialogs)) Object.assign(out, m.dialogs);
  return out;
}

/**
 * opts.known = { species:[], moves:[], items:[], dialogs:[], tiles:[] } – zusätzlich bekannte IDs (eingebaute Spiel-Daten).
 * Unbekannte Verweise auf eingebaute Daten sind Warnungen, Kartenverweise Fehler.
 */
export function validateContent(content, opts = {}, R = new Report()) {
  const known = opts.known || {};
  const p = content.project || {};
  const maps = content.maps || {};
  const dialogs = allDialogs(content);
  const set = (k) => new Set([...Object.keys(content[k] || {}), ...(known[k] || [])]);
  const SP = set('species'), MV = set('moves'), IT = new Set([...set('items'), ...LEGACY_ITEMS]), DL = new Set([...Object.keys(dialogs), ...(known.dialogs || [])]);
  const CH = set('characters');
  for (const pk of p.assets?.packs || []) for (const [k, v] of Object.entries(pk.sprites || {})) if (v?.kind === 'character') CH.add(`${pk.id}:${k}`);
  const packTiles = new Set();
  for (const pk of p.assets?.packs || []) for (const t of Object.keys(pk.tiles || {})) { packTiles.add(t); packTiles.add(`${pk.id}:${t}`); }
  const TL = new Set([...Object.keys(TILE_DEFS), ...packTiles, ...(known.tiles || [])]);
  const refSpecies = (path, id) => { if (!SP.has(id)) R.warn(path, `unbekannte Monster-Art „${id}“`); };
  const refItem = (path, id) => { if (!IT.has(id)) R.warn(path, `unbekannter Gegenstand „${id}“`); };
  const refMap = (path, to) => {
    if (!to) return;
    if (!maps[to.map]) { R.error(path + '.map', `unbekannte Karte „${to.map}“`); return; }
    const sp = maps[to.map].spawns || {};
    if (to.spawn && !sp[to.spawn] && !(to.spawn === 'entry' && Object.keys(sp).length)) R.error(path + '.spawn', `Karte „${to.map}“ hat keinen Spawn „${to.spawn}“ (vorhanden: ${Object.keys(sp).join(', ') || '–'})`);
  };
  const ctx = { R, refSpecies, refItem, refMap, DL, maps };

  // Projekt
  need(R, 'project.name', p.name, 'string');
  if (!p.start?.map) R.error('project.start.map', 'Startkarte fehlt');
  else refMap('project.start', p.start);
  if (!Array.isArray(p.starters)) R.error('project.starters', 'muss eine Liste von Monster-IDs sein');
  else p.starters.forEach((s, i) => refSpecies(`project.starters[${i}]`, s));
  if (!isObj(p.flags)) R.error('project.flags', 'muss ein Objekt sein');
  (p.player?.items || []).forEach((e, i) => { need(R, `project.player.items[${i}].item`, e.item, 'string') && refItem(`project.player.items[${i}].item`, e.item); });
  validateAssets(p.assets, R);
  if (!Object.keys(maps).length) R.error('maps', 'Projekt enthält keine Karte');

  for (const [id, m] of Object.entries(maps)) validateMap(m, ctx, `maps.${id}`, TL, CH);
  for (const [id, s] of Object.entries(content.species || {})) {
    const path = `species.${id}`;
    need(R, path + '.name', s.name, 'string');
    if (!Array.isArray(s.types) || !s.types.length) R.error(path + '.types', 'mindestens ein Typ nötig');
    else s.types.forEach((t, i) => oneOf(R, `${path}.types[${i}]`, t, TYPES, { warn: true }));
    for (const k of ['hp', 'atk', 'def', 'spd']) if (need(R, `${path}.base.${k}`, s.base?.[k], 'number') && (s.base[k] < 1 || s.base[k] > 255)) R.error(`${path}.base.${k}`, 'Basiswert muss zwischen 1 und 255 liegen');
    if (need(R, path + '.catch', s.catch, 'number') && (s.catch < 0 || s.catch > 1)) R.error(path + '.catch', 'Fangrate muss zwischen 0 und 1 liegen');
    oneOf(R, path + '.time', s.time, TIMES);
    oneOf(R, path + '.habitat', s.habitat, HABITATS, { warn: true });
    (s.learn || []).forEach(([lv, mv], i) => {
      if (!Number.isInteger(lv) || lv < 1 || lv > 100) R.error(`${path}.learn[${i}]`, `Level ${typeName(lv)} ungültig (1–100)`);
      if (!MV.has(mv)) R.warn(`${path}.learn[${i}]`, `unbekannte Attacke „${mv}“`);
    });
    if (s.evolve) { if (!SP.has(s.evolve.to)) R.error(path + '.evolve.to', `unbekannte Monster-Art „${s.evolve.to}“`); need(R, path + '.evolve.level', s.evolve.level, 'int'); }
  }
  for (const [id, mv] of Object.entries(content.moves || {})) {
    const path = `moves.${id}`;
    oneOf(R, path + '.type', mv.type, TYPES, { warn: true });
    oneOf(R, path + '.form', mv.form, MOVE_FORMS);
    if (mv.form !== 'buff') need(R, path + '.power', mv.power, 'number');
    need(R, path + '.cooldown', mv.cooldown, 'number');
  }
  for (const [id, it] of Object.entries(content.items || {})) {
    oneOf(R, `items.${id}.kind`, it.kind, ITEM_KINDS, { warn: true });
    if (it.price != null) need(R, `items.${id}.price`, it.price, 'number');
  }
  for (const [id, d] of Object.entries(dialogs)) validateDialog(d, ctx, `dialogs.${id}`);
  return { errors: R.errors, warnings: R.warnings };
}

function validateAssets(a, R) {
  const ids = new Set();
  (a?.packs || []).forEach((pk, i) => {
    const path = `project.assets.packs[${i}]`;
    if (need(R, path + '.id', pk.id, 'id')) { if (ids.has(pk.id)) R.error(path + '.id', `Paket-ID „${pk.id}“ doppelt`); ids.add(pk.id); }
    need(R, path + '.name', pk.name, 'string');
    if (!pk.license?.id && !pk.license?.name) R.error(path + '.license', 'Lizenz-Angabe fehlt (z. B. "CC0-1.0", "CC-BY-4.0" oder "proprietär")');
    oneOf(R, path + '.source', pk.source, ASSET_SOURCES);
    if (pk.source === 'embedded' && !pk.license?.redistributable) R.warn(path + '.source', 'eingebettet, aber Lizenz nicht als weitergebbar markiert (license.redistributable) – Bilddaten werden beim Export entfernt');
    for (const k of ['tiles', 'sprites', 'overrides']) if (pk[k] != null && !isObj(pk[k])) R.error(`${path}.${k}`, 'muss ein Objekt sein');
    const own = new Set([...Object.keys(pk.tiles || {}), ...Object.keys(pk.sprites || {})]);
    for (const [ours, key] of Object.entries(pk.overrides || {})) if (!own.has(key)) R.warn(`${path}.overrides.${ours}`, `Paket-Schlüssel „${key}“ ist in tiles/sprites nicht beschrieben`);
    for (const [k, t] of Object.entries({ ...(pk.tiles || {}), ...(pk.sprites || {}) })) {
      if (pk.source === 'local' && isObj(t) && Object.values(t).some((v) => isStr(v) && v.startsWith('data:'))) R.warn(`${path}.${k}`, 'enthält Bilddaten – bei source "local" werden diese nicht gespeichert');
    }
  });
}

function validateMap(m, ctx, path, TL, CH) {
  const { R, refSpecies, refItem, refMap } = ctx;
  oneOf(R, path + '.face', m.face, FACE_IDS, { warn: true });
  oneOf(R, path + '.plinth', m.plinth, ['earth', 'stone'], { warn: true });
  const badTiles = new Set();
  for (const t of m.layers.ground) if (!TL.has(t)) badTiles.add(t);
  for (const t of badTiles) R.warn(path + '.layers.ground', `unbekannte Tile-ID „${t}“ (weder eingebaut noch in einem Asset-Paket)`);
  const pxW = m.w * TILE, pxH = m.h * TILE;
  const inMap = (p, x, y) => { if (x < 0 || y < 0 || x > pxW || y > pxH) R.warn(p, `Position (${x}, ${y}) liegt außerhalb der Karte (${pxW}×${pxH} px)`); };
  const inRect = (p, r) => { if (need(R, p, r, 'rect') && (r[0] < 0 || r[1] < 0 || r[0] + r[2] > m.w + 0.001 || r[1] + r[3] > m.h + 0.001)) R.warn(p, `Rechteck [${r.join(', ')}] ragt über die Karte (${m.w}×${m.h} Tiles)`); };
  m.objects.forEach((o, i) => {
    const p = `${path}.objects[${i}]`;
    need(R, p + '.type', o.type, 'string');
    if (o.rect) inRect(p + '.rect', o.rect); else { normPoint(R, p, o); inMap(p, o.x, o.y); }
    if (o.if != null) validateCondition(o.if, ctx, p + '.if');
  });
  const seen = new Set();
  const uniq = (p, id) => { if (seen.has(id)) R.error(p, `ID „${id}“ ist auf dieser Karte doppelt`); seen.add(id); };
  m.npcs.forEach((n, i) => {
    const p = `${path}.npcs[${i}]`;
    need(R, p + '.id', n.id, 'id') && uniq(p + '.id', n.id);
    need(R, p + '.character', n.character, 'string');
    if (CH.size && n.character && !CH.has(n.character)) R.warn(p + '.character', `Figur „${n.character}“ nicht in characters/ – eingebautes Sprite npc_${n.character} wird erwartet`);
    normPoint(R, p, n); inMap(p, n.x, n.y);
    oneOf(R, p + '.dir', n.dir, DIRS);
    oneOf(R, p + '.behavior.type', n.behavior?.type, NPC_BEHAVIORS);
    if (n.dialog != null) refDialog(ctx, p + '.dialog', n.dialog);
  });
  m.trainers.forEach((t, i) => {
    const p = `${path}.trainers[${i}]`;
    need(R, p + '.id', t.id, 'id') && uniq(p + '.id', t.id);
    normPoint(R, p, t); inMap(p, t.x, t.y);
    oneOf(R, p + '.dir', t.dir, DIRS);
    if (!t.team.length) R.error(p + '.team', 'Trainer braucht mindestens ein Monster');
    t.team.forEach((e, j) => { need(R, `${p}.team[${j}].species`, e.species, 'string') && refSpecies(`${p}.team[${j}].species`, e.species); if (need(R, `${p}.team[${j}].level`, e.level, 'int') && (e.level < 1 || e.level > 100)) R.error(`${p}.team[${j}].level`, 'Level 1–100'); });
    if (t.dialog != null && !isObj(t.dialog)) refDialog(ctx, p + '.dialog', t.dialog);
    need(R, p + '.reward', t.reward, 'number');
  });
  m.enemies.forEach((e, i) => { const p = `${path}.enemies[${i}]`; need(R, p + '.type', e.type, 'string'); normPoint(R, p, e); inMap(p, e.x, e.y); });
  m.encounters.forEach((e, i) => {
    const p = `${path}.encounters[${i}]`;
    inRect(p + '.rect', e.rect);
    if (e.tiles != null && !Array.isArray(e.tiles)) R.error(p + '.tiles', 'muss eine Liste von Tile-IDs sein');
    if (!e.table.length) R.error(p + '.table', 'Encounter-Zone ohne Monster-Tabelle');
    e.table.forEach((r, j) => {
      const q = `${p}.table[${j}]`;
      need(R, q + '.species', r.species, 'string') && refSpecies(q + '.species', r.species);
      if (!r.levels.every(Number.isInteger) || r.levels[0] > r.levels[1] || r.levels[0] < 1) R.error(q + '.levels', `Level-Bereich [${r.levels.join(', ')}] ungültig (min ≤ max, ab 1)`);
      if (need(R, q + '.weight', r.weight, 'number') && r.weight <= 0) R.error(q + '.weight', 'Gewicht muss > 0 sein');
      oneOf(R, q + '.time', r.time, TIMES);
    });
  });
  m.items.forEach((it, i) => {
    const p = `${path}.items[${i}]`;
    oneOf(R, p + '.type', it.type, MAP_ITEM_TYPES);
    normPoint(R, p, it); inMap(p, it.x, it.y);
    if (!it.contents) R.error(p + '.contents', 'Inhalt fehlt: { item, count }');
    else { need(R, p + '.contents.item', it.contents.item, 'string') && refItem(p + '.contents.item', it.contents.item); need(R, p + '.contents.count', it.contents.count, 'int'); }
  });
  m.warps.forEach((w, i) => {
    const p = `${path}.warps[${i}]`;
    need(R, p + '.rect', w.rect, 'rect');
    if (!w.to && !w.hint && !w.do) R.warn(p, 'Warp ohne Ziel, Hinweis oder Aktion');
    refMap(p + '.to', w.to);
    oneOf(R, p + '.dirReq', w.dirReq, DIRS);
    if (w.if != null) validateCondition(w.if, ctx, p + '.if');
  });
  for (const [k, s] of Object.entries(m.spawns)) { const p = `${path}.spawns.${k}`; if (!isObj(s)) { R.error(p, 'muss {x, y, dir} sein'); continue; } normPoint(R, p, s); inMap(p, s.x, s.y); oneOf(R, p + '.dir', s.dir, DIRS); }
  m.events.forEach((e, i) => {
    const p = `${path}.events[${i}]`;
    need(R, p + '.id', e.id, 'id') && uniq(p + '.id', 'ev:' + e.id);
    oneOf(R, p + '.trigger.type', e.trigger.type, TRIGGERS);
    if (['enter', 'interact'].includes(e.trigger.type) && !e.trigger.rect && !(isNum(e.trigger.x) && isNum(e.trigger.y))) R.error(p + '.trigger', `Auslöser „${e.trigger.type}“ braucht rect [x,y,w,h] (Tiles) oder x/y (Tile)`);
    if (e.trigger.rect) inRect(p + '.trigger.rect', e.trigger.rect);
    if (e.if != null) validateCondition(e.if, ctx, p + '.if');
    validateActions(e.do, ctx, p + '.do');
  });
  m.areas.forEach((a, i) => { need(R, `${path}.areas[${i}].name`, a.name, 'string'); inRect(`${path}.areas[${i}].rect`, a.rect); });
  if (m.farm) {
    inRect(path + '.farm.rect', m.farm.rect);
    for (const k of ['bin', 'bed']) if (m.farm[k]) normPoint(R, `${path}.farm.${k}`, m.farm[k]);
  }
}

function refDialog(ctx, path, id) {
  if (isObj(id) || Array.isArray(id)) return validateDialog(isObj(id) ? id : { lines: id }, ctx, path);
  if (!isStr(id)) return ctx.R.error(path, `muss eine Dialog-ID oder ein Dialog-Objekt sein (ist: ${typeName(id)})`);
  const base = id.split('#')[0];
  if (!ctx.DL.has(base)) ctx.R.warn(path, `unbekannter Dialog „${id}“ (nicht in dialogs/ – eingebauter Spiel-Dialog?)`);
}

export function validateDialog(d, ctx, path, depth = 0) {
  const { R } = ctx;
  if (depth > 12) return R.error(path, 'Dialog zu tief verschachtelt');
  if (!isObj(d)) return R.error(path, 'muss ein Dialog-Objekt sein');
  if (d.lines != null && !Array.isArray(d.lines)) R.error(path + '.lines', 'muss eine Liste von Zeilen sein');
  (d.lines || []).forEach((l, i) => { if (!isStr(l) && !(isObj(l) && isStr(l.text))) R.error(`${path}.lines[${i}]`, 'Zeile muss Text oder { speaker, text } sein'); });
  if (d.if != null) validateCondition(d.if, ctx, path + '.if');
  if (d.select != null) oneOf(R, path + '.select', d.select, ['first', 'cycle', 'random']);
  (d.variants || []).forEach((v, i) => validateDialog(v, ctx, `${path}.variants[${i}]`, depth + 1));
  (d.choices || []).forEach((c, i) => {
    const p = `${path}.choices[${i}]`;
    need(R, p + '.label', c.label, 'string');
    if (c.if != null) validateCondition(c.if, ctx, p + '.if');
    if (c.do) validateActions(c.do, ctx, p + '.do');
  });
  if (d.do) validateActions(d.do, ctx, path + '.do');
  if (d.nodes != null) { if (!isObj(d.nodes)) R.error(path + '.nodes', 'muss ein Objekt { knotenId: Dialog } sein'); else for (const [k, n] of Object.entries(d.nodes)) validateDialog(n, ctx, `${path}.nodes.${k}`, depth + 1); }
}

export function validateActions(list, ctx, path) {
  const { R } = ctx;
  if (list == null) return;
  if (!Array.isArray(list)) { R.error(path, 'Aktionen müssen eine Liste sein'); return; }
  list.forEach((a, i) => {
    const p = `${path}[${i}]`;
    if (!isObj(a)) { R.error(p, `Aktion muss ein Objekt sein, z. B. { "setFlag": "x" } (ist: ${typeName(a)})`); return; }
    const key = Object.keys(a).find((k) => k in ACTIONS);
    if (!key) { R.error(p, `unbekannte Aktion (Schlüssel: ${Object.keys(a).join(', ') || '–'}) – erlaubt: ${Object.keys(ACTIONS).join(', ')}`); return; }
    const v = a[key];
    switch (key) {
      case 'if': validateCondition(a.if, ctx, p + '.if'); validateActions(a.then || [], ctx, p + '.then'); validateActions(a.else || [], ctx, p + '.else'); break;
      case 'give': case 'take': { const it = isStr(v) ? v : v?.item; if (need(R, p + `.${key}.item`, it, 'string')) ctx.refItem(p + `.${key}.item`, it); break; }
      case 'money': need(R, p + '.money', v, 'number'); break;
      case 'wait': need(R, p + '.wait', v, 'number'); break;
      case 'warp': if (need(R, p + '.warp', v, 'object')) ctx.refMap(p + '.warp', { spawn: 'entry', ...v }); break;
      case 'giveMonster': case 'wildBattle': if (need(R, p + `.${key}.species`, v?.species, 'string')) ctx.refSpecies(p + `.${key}.species`, v.species); break;
      case 'dialog': case 'goto': refDialog(ctx, p + '.' + key, v); break;
      case 'say': if (!isStr(v) && !Array.isArray(v)) R.error(p + '.say', 'muss Text oder Liste von Texten sein'); break;
      case 'choice': if (!Array.isArray(v?.options)) R.error(p + '.choice.options', 'Auswahl braucht options: [{ label, do }]'); else v.options.forEach((o, j) => { need(R, `${p}.choice.options[${j}].label`, o.label, 'string'); validateActions(o.do || [], ctx, `${p}.choice.options[${j}].do`); }); break;
      case 'battle': if (isObj(v)) { validateActions(v.win || [], ctx, p + '.battle.win'); validateActions(v.lose || [], ctx, p + '.battle.lose'); } break;
      case 'shop': if (!Array.isArray(v?.stock)) R.error(p + '.shop.stock', 'Laden braucht stock: [itemId, …]'); else v.stock.forEach((s, j) => ctx.refItem(`${p}.shop.stock[${j}]`, isStr(s) ? s : s.item)); break;
      case 'setFlag': case 'clearFlag': case 'toggleFlag': if (!isStr(v) && !isStr(v?.name)) R.error(p + '.' + key, 'Flag-Name fehlt'); break;
      default: break;
    }
  });
}

export function validateCondition(c, ctx, path, depth = 0) {
  const { R } = ctx;
  if (depth > 16) return R.error(path, 'Bedingung zu tief verschachtelt');
  if (isStr(c) || typeof c === 'boolean') return;
  if (Array.isArray(c)) { c.forEach((x, i) => validateCondition(x, ctx, `${path}[${i}]`, depth + 1)); return; }
  if (!isObj(c)) return R.error(path, `Bedingung muss Text, Liste oder Objekt sein (ist: ${typeName(c)})`);
  for (const [k, v] of Object.entries(c)) {
    if (!(k in CONDITIONS) && !/^[<>!=]=?$/.test(k)) { R.error(`${path}.${k}`, `unbekannte Bedingung – erlaubt: ${Object.keys(CONDITIONS).join(', ')}`); continue; }
    if (k === 'all' || k === 'any') { if (!Array.isArray(v)) R.error(`${path}.${k}`, 'muss eine Liste sein'); else v.forEach((x, i) => validateCondition(x, ctx, `${path}.${k}[${i}]`, depth + 1)); }
    if (k === 'not') validateCondition(v, ctx, `${path}.not`, depth + 1);
    if (k === 'time') oneOf(R, `${path}.time`, v, TIMES);
    if (k === 'money>=' || k === 'money<') need(R, `${path}.${k}`, v, 'number');
    if (k === 'hasMonster' && isStr(v)) ctx.refSpecies(`${path}.hasMonster`, v);
    if (k === 'hasItem') ctx.refItem(`${path}.hasItem`, isStr(v) ? v : v?.item);
  }
}

/** Normalisieren + validieren in einem Schritt. */
export function checkContent(raw, opts = {}) {
  const R = new Report();
  const { content } = normalizeContent(raw, R);
  validateContent(content, opts, R);
  return { ok: R.errors.length === 0, content, errors: R.errors, warnings: R.warnings };
}

// ---------------------------------------------------------------------------------------------------------------
// Fabriken für den Editor
export function createProject({ id = 'projekt', name = 'Neues Abenteuer', map } = {}) {
  const p = DEFAULTS.project();
  Object.assign(p, { id, name });
  const m = createMap(map || { id: 'start', name: 'Startgebiet' });
  p.start = { map: m.id, spawn: 'start' };
  return { project: p, maps: { [m.id]: m }, species: {}, moves: {}, items: {}, characters: {}, dialogs: {} };
}
export function createMap({ id = 'karte', name, w = 24, h = 16, fill = 'grass', outdoor = true } = {}) {
  const m = { ...DEFAULTS.map(), id, name: name || id, w, h, outdoor, ambient: outdoor };
  m.layers = { ground: new Array(w * h).fill(fill), height: new Array(w * h).fill(0) };
  m.spawns = { start: { x: Math.floor(w / 2) * TILE + 8, y: Math.floor(h / 2) * TILE + 12, dir: 'down' } };
  return m;
}
