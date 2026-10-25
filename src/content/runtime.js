// Inhalte → Spiel: lädt ein drift-content-Projekt (Editor/localStorage/URL), wandelt Karten in die Laufzeit-Form von
// src/game/maps (rows/heights, Objekte mit `t`) und hängt Dialoge, Events und Startpunkt ins Spiel ein.
// Aufruf aus main.js: index.html?content=local | ?content=<url-zu-bundle.json> [&map=<id>&x=<tx>&y=<ty>]
import { checkContent, LOCAL_KEY, TILE } from './schema.js';
import { buildLegend, groundToRows, heightToRows } from './layers.js';
import { playDialog, updateEvents, fire, test } from './events.js';
import { MAPS } from '../game/maps/index.js';
import { DIALOG } from '../game/dialog.js';
import { OBJ } from '../game/entities/objects.js';
import { SPECIES } from '../game/monsters/species.js';
import { ITEMS } from '../game/farm/items.js';

const NPC_SPRITES = new Set(['elder', 'girl', 'merchant']);

/** Quelle laden: 'local' (Editor-Autosave) oder URL. Gibt die Rohdaten (Datei-Form) zurück. */
export async function loadContentSource(src) {
  if (!src) return null;
  if (src === 'local') {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) throw new Error('Kein Editor-Projekt im Browser gespeichert');
    return JSON.parse(raw);
  }
  const res = await fetch(src, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Inhalt „${src}“ nicht ladbar (${res.status})`);
  return res.json();
}

/** Speicher-Form einer Karte → Laufzeit-Def (wie die Builder in src/game/maps). */
export function toRuntimeDef(m, content) {
  const w = m.w, h = m.h;
  const legend = buildLegend(m.layers.ground);
  const tx = (px, fx = 8) => (px - fx) / TILE;
  const def = {
    id: m.id, name: m.name, face: m.face, plinth: m.plinth, music: m.music, outdoor: !!m.outdoor, ambient: m.ambient !== false,
    legend, rows: groundToRows(m.layers.ground, w, h, legend), heights: heightToRows(m.layers.height, w, h),
    objects: [], enemies: [], npcs: [], wild: [], spawners: [], warps: [], spawns: {}, content: m,
  };
  for (const o of m.objects) {
    if (o.type === 'barrier' && o.rect) { def.objects.push({ t: 'barrier', x: o.rect[0], y: o.rect[1], w: o.rect[2], h: o.rect[3] }); continue; }
    const known = !!OBJ[o.type];
    const { type, x, y, if: cond, ...rest } = o;
    const spec = { ...rest, t: known ? type : 'deco', px: x, py: y, x: Math.floor(x / TILE), y: Math.floor(y / TILE) };
    if (!known) { spec.sprite = type; spec.solid = o.solid ?? true; spec.box = o.box || [-6, -6, 12, 7]; }
    if (cond) spec.showFlag = typeof cond === 'string' ? cond : cond.flag;
    def.objects.push(spec);
  }
  for (const it of m.items) {
    const c = it.contents || {};
    if (it.type === 'chest') def.objects.push({ t: 'chest', px: it.x, py: it.y, x: Math.floor(it.x / TILE), y: Math.floor(it.y / TILE),
      item: c.item, amount: c.count ?? 1, flag: it.flag, appearFlag: it.appearFlag,
      text: it.text || [`Du hast ${content.items?.[c.item]?.name || c.item}${(c.count ?? 1) > 1 ? ` ×${c.count}` : ''} gefunden!`] });
  }
  for (const e of m.enemies || []) def.enemies.push({ ...e, t: e.type, x: tx(e.x), y: tx(e.y, 12),
    patrol: e.patrol?.map(([a, b]) => [tx(a), tx(b, 12)]) });
  for (const n of m.npcs) {
    const ch = content.characters?.[n.character];
    const sprite = NPC_SPRITES.has(n.character) ? n.character : NPC_SPRITES.has(ch?.sprite) ? ch.sprite : 'elder';
    def.npcs.push({ id: n.id, t: sprite, x: tx(n.x), y: tx(n.y, 12), dir: n.dir || 'down',
      wander: n.behavior?.type === 'wander', dialog: n.dialog ? `content:${n.dialog}` : `content:npc:${m.id}:${n.id}`, contentDialog: n.dialog, lines: n.lines });
  }
  for (const t of m.trainers) {
    const d = t.dialog || {};
    def.npcs.push({ id: t.id, t: 'ranger', trainer: true, x: tx(t.x), y: tx(t.y, 12), dir: t.dir || 'down', flag: t.flag, name: t.name || 'Trainer',
      sight: t.sight ?? 64, reward: t.reward ?? 0, team: t.team.map((e) => [e.species, e.level ?? 5]),
      intro: d.before ? [].concat(d.before) : undefined, lose: d.lose ? [].concat(d.lose) : undefined, after: d.after ? [].concat(d.after) : undefined });
  }
  for (const z of m.encounters) {
    const [x, y, ww, hh] = z.rect || [0, 0, w, h];
    const table = z.table.filter((r) => SPECIES[r.species]);
    if (!table.length) continue;
    const lo = Math.min(...table.map((r) => r.levels[0])), hi = Math.max(...table.map((r) => r.levels[1]));
    // pro Tageszeit ein Spawner, damit time-Einträge der Tabelle respektiert werden
    for (const time of ['any', 'day', 'night']) {
      const rows = table.filter((r) => (r.time || 'any') === time);
      if (!rows.length) continue;
      def.spawners.push({ area: [x, y, x + ww - 1, y + hh - 1], tiles: z.tiles?.length ? z.tiles : undefined, lvl: z.lvl,
        species: rows.map((r) => [r.species, r.weight ?? 1]), level: [lo, hi], max: Math.max(1, Math.round(z.density ?? 3) - (time === 'any' ? 0 : 1)),
        time: time === 'any' ? undefined : time });
    }
  }
  for (const wp of m.warps) {
    const [x, y, ww, hh] = wp.rect || [0, 0, 1, 1];
    def.warps.push({ x, y, w: ww, h: hh, to: wp.to?.map, spawn: wp.to?.spawn, dirReq: wp.dirReq, needFlag: typeof wp.if === 'string' ? wp.if : wp.if?.flag,
      hint: wp.to ? wp.hint : wp.hint || wp.text });
  }
  for (const [k, s] of Object.entries(m.spawns)) def.spawns[k] = { x: s.x, y: s.y, dir: s.dir || 'down' };
  if (!Object.keys(def.spawns).length) def.spawns.start = { x: (w * TILE) / 2, y: (h * TILE) / 2, dir: 'down' };
  if (m.farm?.rect) { const [x, y, ww, hh] = m.farm.rect; def.farm = { x0: x, y0: y, x1: x + ww - 1, y1: y + hh - 1 }; }
  if (m.areas?.length) def.areas = m.areas.filter((a) => a.rect).map((a) => ({ name: a.name, x0: a.rect[0], y0: a.rect[1], x1: a.rect[0] + a.rect[2] - 1, y1: a.rect[1] + a.rect[3] - 1 }));
  const evState = { inside: new Set(), busy: false };
  def.onEnter = (g) => {
    const p = g.player;
    for (const e of m.events) if (e.trigger?.rect && (e.trigger.type === 'enter')) {
      const r = e.trigger.rect, x = p.x / TILE, y = (p.y - 2) / TILE;
      if (x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3]) evState.inside.add(e.id);   // Startpunkt im Rechteck löst nicht aus
    }
    const load = m.events.filter((e) => e.trigger?.type === 'load' && (!e.once || !g.flags[`event_${m.id}_${e.id}`]));
    if (load.length && g.state === 'play') g.after(0.45, () => { for (const e of load) if (test(g, e.if)) fire(g, e, evState); });
  };
  def.onUpdate = (g) => updateEvents(g, m.events, evState);
  return def;
}

/**
 * Inhalte ins Spiel einhängen. raw = Datei-Form (Bündel). opts: { map, x, y } = Direktstart (Editor „Probe spielen“).
 * Gibt { content, errors, warnings } zurück; bei Fehlern bleibt das Spiel unverändert.
 */
export function installContent(g, raw, opts = {}) {
  const res = checkContent(raw, { known: { species: Object.keys(SPECIES), items: Object.keys(ITEMS), dialogs: Object.keys(DIALOG) } });
  if (!res.ok) return res;
  const content = res.content;
  g.content = content;
  // Karten registrieren (eingebaute bleiben erreichbar, gleiche IDs werden überschrieben)
  for (const m of Object.values(content.maps)) MAPS[m.id] = () => toRuntimeDef(m, content);
  // Dialoge: NPC-Dialoge laufen über den Interpreter
  const dialogs = { ...content.dialogs };
  for (const m of Object.values(content.maps)) if (m.dialogs) Object.assign(dialogs, m.dialogs);
  content.dialogs = dialogs;
  for (const id of Object.keys(dialogs)) DIALOG[`content:${id}`] = (game) => playDialog(game, dialogs[id]);
  for (const m of Object.values(content.maps)) for (const n of m.npcs) {
    if (n.dialog && !dialogs[n.dialog] && DIALOG[n.dialog]) DIALOG[`content:${n.dialog}`] = DIALOG[n.dialog];   // eingebauter Dialog
    if (!n.dialog) DIALOG[`content:npc:${m.id}:${n.id}`] = [].concat(n.lines || n.text || ['…']);
  }
  const p = content.project;
  const start = { map: opts.map && content.maps[opts.map] ? opts.map : p.start.map || Object.keys(content.maps)[0], spawn: p.start.spawn || 'start' };
  if (opts.map && opts.x != null) start.spawn = { x: opts.x * TILE + 8, y: opts.y * TILE + 10, dir: 'down' };
  if (p.starters?.length) g.starters = p.starters.filter((s) => SPECIES[s]);
  g.contentStart = start;
  // Neues Spiel: Startkarte des Projekts, Startgeld/-gegenstände, Projekt-Flags
  g.newGame = () => {
    g.resetForNewGame();
    Object.assign(g.flags, p.flags || {});
    g.player.rupees = p.player?.money ?? 0;
    for (const it of p.player?.items || []) g.inventory.add?.(it.item ?? it, it.count ?? 1);
    for (const mon of p.player?.monsters || []) g.debug.giveMonster(mon.species ?? mon, mon.level ?? 5);
    g.state = 'play';
    g.loadMap(start.map, start.spawn);
  };
  // Titel-Hintergrund: Startkarte
  g.loadMap(start.map, start.spawn);
  g._titleAnchor = { x: g.player.x, y: g.player.y };
  return res;
}
