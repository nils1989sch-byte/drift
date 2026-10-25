// Defensive accessors for gameplay data (monsters, party, dex, inventory, clock, money).
// The UI never assumes one exact shape: it accepts the variants documented in docs/UI.md.

// ---- types -------------------------------------------------------------------------------------
export const TYPES = {
  fire: { name: 'Feuer', short: 'FEU', color: '#e06030', dark: '#802818', light: '#f8a868' },
  water: { name: 'Wasser', short: 'WAS', color: '#3888d8', dark: '#183870', light: '#98c8f8' },
  plant: { name: 'Pflanze', short: 'PFL', color: '#48a840', dark: '#1c5020', light: '#a8e078' },
  stone: { name: 'Stein', short: 'STE', color: '#a08860', dark: '#4a3c2a', light: '#d8c8a0' },
  bolt: { name: 'Blitz', short: 'BLI', color: '#e8c020', dark: '#806010', light: '#f8f088' },
  wind: { name: 'Wind', short: 'WIN', color: '#70c0c8', dark: '#28606a', light: '#c8f0f0' },
  normal: { name: 'Normal', short: 'NOR', color: '#a8a098', dark: '#4c4844', light: '#e0dcd4' },
};
const TYPE_ALIAS = {
  feuer: 'fire', fire: 'fire', wasser: 'water', water: 'water', pflanze: 'plant', plant: 'plant', grass: 'plant', leaf: 'plant',
  stein: 'stone', rock: 'stone', stone: 'stone', blitz: 'bolt', bolt: 'bolt', spark: 'bolt', electric: 'bolt', thunder: 'bolt', lightning: 'bolt',
  wind: 'wind', air: 'wind', flying: 'wind', normal: 'normal',
};
export function typeKey(t) { return TYPE_ALIAS[String(t ?? 'normal').toLowerCase()] || 'normal'; }
export function typeInfo(t) { return TYPES[typeKey(t)]; }

// ---- fallback species table (DESIGN.md); game data (game.species / game.dex.species) overrides ----
export const SPECIES = {
  funkel: { no: 1, name: 'Funkel', types: ['fire'], habitat: 'Driftwald (Starter)', desc: 'Kleiner Salamander, dessen Schwanz wie Glut glimmt.' },
  glutar: { no: 2, name: 'Glutar', types: ['fire'], habitat: 'Entwicklung', desc: 'Aufrechter Lava-Salamander mit heißem Temperament.' },
  tropfi: { no: 3, name: 'Tropfi', types: ['water'], habitat: 'Driftwald (Starter)', desc: 'Verspieltes Otterjunges mit Muschelkappe.' },
  strudelott: { no: 4, name: 'Strudelott', types: ['water'], habitat: 'Entwicklung', desc: 'Großer Otter, der Wasserwirbel um sich zieht.' },
  sprossi: { no: 5, name: 'Sprossi', types: ['plant'], habitat: 'Driftwald (Starter)', desc: 'Igel, dessen Stacheln junge Blätter sind.' },
  dornigel: { no: 6, name: 'Dornigel', types: ['plant', 'stone'], habitat: 'Entwicklung', desc: 'Igel mit dornigem Steinpanzer.' },
  kiesel: { no: 7, name: 'Kieselkrabbe', types: ['stone'], habitat: 'Ufer, Höhle', desc: 'Krabbe, die ihre Schale aus Kieseln baut.' },
  felspanzer: { no: 8, name: 'Felspanzer', types: ['stone'], habitat: 'Höhle', desc: 'Massiger Felskrebs, kaum zu erschüttern.' },
  zappi: { no: 9, name: 'Zappfalter', types: ['bolt'], habitat: 'Wiese', desc: 'Schmetterling, dessen Flügel Funken sprühen.' },
  boeli: { no: 10, name: 'Böenspatz', types: ['wind'], habitat: 'Wiese, Klippen', desc: 'Rundlicher Spatz, der mit jedem Windstoß tanzt.' },
  sturmfalk: { no: 11, name: 'Sturmfalk', types: ['wind'], habitat: 'Klippen', desc: 'Falke mit einem Schweif aus Sturmböen.' },
  moosi: { no: 12, name: 'Moosschneck', types: ['plant'], habitat: 'Wald', desc: 'Schnecke, die einen kleinen Moosgarten trägt.' },
  pilzling: { no: 13, name: 'Pilzling', types: ['plant'], habitat: 'Wald (nachts)', desc: 'Wandernder Pilz, meist schläfrig.' },
  steinwaechter: { no: 14, name: 'Steinwächter', types: ['stone'], habitat: 'Monster-Höhle', desc: 'Uralter Golem, Hüter der Höhle.' },
};

// ---- live game data (read-only imports from src/game; optional) ------------------------------------
export const GD = { species: null, moves: null, items: null, starters: null, xpForLevel: (l) => Math.floor(6 * l * l + 10 * l), habitats: null };
export async function loadGameData() {
  const tryImport = async (p) => { try { return await import(p); } catch { return null; } };
  const [sp, mv, mo, it] = await Promise.all([
    tryImport('../game/monsters/species.js'), tryImport('../game/monsters/moves.js'),
    tryImport('../game/monsters/monster.js'), tryImport('../game/farm/items.js')]);
  if (sp?.SPECIES) GD.species = sp.SPECIES;
  if (sp?.STARTERS) GD.starters = sp.STARTERS;
  if (mv?.MOVES) GD.moves = mv.MOVES;
  if (mo?.xpForLevel) GD.xpForLevel = mo.xpForLevel;
  if (it?.ITEMS) GD.items = it.ITEMS;
}
export const HABITATS = { grass: 'Hohes Gras', forest: 'Wald', shore: 'Ufer', cave: 'Höhle', cliff: 'Klippen', meadow: 'Wiese' };
export const TIMES = { day: 'tagsüber', night: 'nachts', any: '' };

const num = (v, d = 0) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : d);

export function speciesTable(game) {
  const src = game?.species || game?.dex?.species || GD.species || null;
  if (!src) return SPECIES;
  const out = { ...SPECIES };
  const list = Array.isArray(src) ? src : Object.entries(src).map(([id, s]) => ({ id, ...s }));
  let no = 0;
  for (const s of list) {
    if (!s || !(s.id || s.key)) continue;
    const id = s.id || s.key; no++;
    const merged = { ...(SPECIES[id] || {}), ...s, no: s.no ?? SPECIES[id]?.no ?? no };
    if (s.dex && !s.desc) merged.desc = s.dex;
    if (s.habitat && HABITATS[s.habitat]) merged.habitat = HABITATS[s.habitat] + (TIMES[s.time] ? ` (${TIMES[s.time]})` : '');
    merged.types = (merged.types || ['normal']).map(typeKey);
    out[id] = merged;
  }
  return out;
}

export function speciesId(m) {
  if (!m) return null;
  if (typeof m === 'string') return m;
  return m.speciesId || m.species?.id || (typeof m.species === 'string' ? m.species : null) || m.id || null; // Monster.id = species id
}
export function speciesOf(game, m) { const id = speciesId(m); return (id && speciesTable(game)[id]) || null; }

// ---- monster instance ----------------------------------------------------------------------------
export function monName(game, m) {
  if (!m) return '';
  return m.nickname || m.nick || m.name || speciesOf(game, m)?.name || speciesId(m) || '???';
}
export function monTypes(game, m) {
  const t = m?.types || (m?.type ? [m.type] : null) || m?.species?.types || speciesOf(game, m)?.types || ['normal'];
  return (Array.isArray(t) ? t : [t]).map(typeKey);
}
export function monLevel(m) { return num(m?.level ?? m?.lv, 1); }
export function monMaxHp(m) { return Math.max(1, num(m?.maxHp ?? m?.stats?.hp ?? m?.hpMax, 1)); }
export function monHp(m) { return Math.max(0, num(m?.hp, monMaxHp(m))); }
export function monStatus(m) {
  const s = m?.status;
  if (!s) return null;
  const map = { burn: 'BRA', burned: 'BRA', poison: 'GIF', sleep: 'SCH', asleep: 'SCH', para: 'PAR', paralyzed: 'PAR', freeze: 'GEF', confused: 'VER' };
  return map[String(s).toLowerCase()] || String(s).slice(0, 3).toUpperCase();
}
/** XP progress 0..1 within the current level. */
export function monXpFrac(m) {
  if (!m) return 0;
  if (Number.isFinite(m.xpFrac)) return Math.max(0, Math.min(1, m.xpFrac));
  const xp = num(m.xp ?? m.exp, 0);
  if (Number.isFinite(m.xpMin) && Number.isFinite(m.xpMax)) return clamp01((xp - m.xpMin) / Math.max(1, m.xpMax - m.xpMin));
  if (Number.isFinite(m.xpNext)) return clamp01(xp / Math.max(1, m.xpNext));
  // Monster (src/game/monsters/monster.js): xp is the running total; xpForLevel(l) = total needed to reach l
  const L = monLevel(m), a = GD.xpForLevel(L), b = GD.xpForLevel(L + 1);
  return b > a ? clamp01((xp - a) / (b - a)) : 0;
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** Move info for an id or object (merges src/game/monsters/moves.js). */
export function moveData(mv) {
  if (!mv) return null;
  const id = typeof mv === 'string' ? mv : mv.id;
  const base = (id && GD.moves?.[id]) || {};
  return typeof mv === 'string' ? { id, ...base } : { ...base, ...mv, id };
}
export function monMoves(m) { return (m?.moves || []).slice(0, 4).map(moveData).filter(Boolean); }
export function moveName(mv) { return mv?.name || mv?.id || '–'; }
export function moveType(mv) { return typeKey(mv?.type); }
/** Remaining cooldown fraction 0 (ready) .. 1 (just used). */
export function moveCdFrac(mv) {
  if (!mv) return 0;
  if (Number.isFinite(mv.cdFrac)) return clamp01(mv.cdFrac);
  const left = num(mv.cdLeft ?? mv.cooldownLeft ?? mv.cd ?? mv.timer, 0);
  const total = num(mv.cooldown ?? mv.cdMax ?? mv.cooldownMax, 0);
  return total > 0 ? clamp01(left / total) : left > 0 ? 1 : 0;
}

// ---- party / box / dex ------------------------------------------------------------------------------
export function partyList(game) {
  const p = game?.party;
  if (!p) return [];
  if (Array.isArray(p)) return p;
  return p.team || p.members || p.list || p.monsters || [];
}
export function boxList(game) {
  const p = game?.party;
  return (p && !Array.isArray(p) && (p.box || p.storage)) || game?.box || [];
}
export function leadMon(game) {
  const p = game?.party;
  if (p && !Array.isArray(p) && p.lead && typeof p.lead === 'object') return p.lead; // party.lead = first non-fainted
  const l = partyList(game);
  return l.find((m) => m && monHp(m) > 0) || l[0] || null;
}
/** Swap two party slots (uses party.swap / party.move if available). */
export function partySwap(game, i, j) {
  const p = game?.party;
  if (i === j || !p) return;
  try {
    if (typeof p.swap === 'function') return p.swap(i, j);
    if (typeof p.move === 'function') return p.move(i, j);
    const l = partyList(game);
    if (l[i] === undefined || l[j] === undefined) return;
    [l[i], l[j]] = [l[j], l[i]];
    p.onChange?.();
  } catch (e) { console.warn('[ui] party swap failed', e); }
}
function asSet(v) {
  if (!v) return new Set();
  if (v instanceof Set) return v;
  if (Array.isArray(v)) return new Set(v);
  if (typeof v === 'object') return new Set(Object.keys(v).filter((k) => v[k]));
  return new Set();
}
export function dexState(game) {
  const d = game?.dex || (game?.party && !Array.isArray(game.party) ? game.party : null) || {};
  const seen = asSet(d.seen), caught = asSet(d.caught);
  for (const c of caught) seen.add(c);
  return { seen, caught };
}

// ---- items / inventory / money / clock ---------------------------------------------------------
export const ITEM_NAMES = {
  hoe: 'Hacke', can: 'Gießkanne', watering_can: 'Gießkanne', sickle: 'Sichel', axe: 'Axt', pickaxe: 'Spitzhacke',
  orb: 'Driftkugel', orb_great: 'Superkugel', potion: 'Trank', super_potion: 'Supertrank', coin: 'Münzen',
  ruebe: 'Rübe', kartoffel: 'Kartoffel', erdbeere: 'Erdbeere', kuerbis: 'Kürbis', blaubeere: 'Blaubeere', weizen: 'Weizen',
};
export function itemId(it) { return typeof it === 'string' ? it : it?.id || it?.item || it?.key || null; }
export function itemDef(it) { const id = itemId(it); return (id && GD.items?.[id]) || null; }
export function itemName(it) {
  if (!it) return '';
  if (typeof it === 'object' && it.name) return it.name;
  const id = itemId(it) || '';
  if (GD.items?.[id]?.name) return GD.items[id].name;
  if (ITEM_NAMES[id]) return ITEM_NAMES[id];
  let m = /^seeds?_(.+)$/.exec(id);
  if (m) return (ITEM_NAMES[m[1]] || cap(m[1])) + '-Saat';
  m = /^crop_(.+)$/.exec(id);
  if (m) return ITEM_NAMES[m[1]] || cap(m[1]);
  return cap(id.replace(/_/g, ' '));
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export function itemCount(it) { return typeof it === 'object' && it ? num(it.count ?? it.n ?? it.qty ?? it.amount, 1) : 1; }

export function inventory(game) { return game?.inventory || game?.inv || game?.player?.inventoryObj || null; }
export function hotbar(game) {
  const inv = inventory(game);
  if (!inv) return { slots: [], active: -1, inv: null };
  let slots = typeof inv.hotbar === 'function' ? inv.hotbar() : inv.hotbar || (Array.isArray(inv.slots) ? inv.slots.slice(0, 8) : []);
  slots = (slots || []).map((s) => (s && itemId(s) ? s : null));
  const active = num(inv.activeSlot ?? (typeof inv.active === 'number' ? inv.active : null) ?? inv.selected ?? inv.slot, 0);
  return { slots: Array.from({ length: 8 }, (_, i) => slots[i] || null), active, inv };
}
export function hotbarSelect(game, i) {
  const inv = inventory(game);
  if (!inv) return;
  try {
    if (typeof inv.select === 'function') inv.select(i);
    else if ('active' in inv) inv.active = i;
    else inv.selected = i;
  } catch (e) { console.warn('[ui] hotbar select failed', e); }
}
/** All items (bag) as [{id, name, count, ...}] */
export function allItems(game) {
  const inv = inventory(game);
  if (!inv) return [];
  if (typeof inv.list === 'function') {
    const m = new Map();
    for (const it of inv.list()) { const id = itemId(it); if (!id) continue; const p = m.get(id); m.set(id, { ...it, id, count: (p?.count || 0) + itemCount(it) }); }
    return [...m.values()];
  }
  let src = inv.items || inv.bag || inv.slots || [];
  if (!Array.isArray(src)) src = Object.entries(src).map(([id, v]) => (typeof v === 'object' ? { id, ...v } : { id, count: v }));
  const map = new Map();
  for (const it of [...src, ...(inv.hotbar || [])]) {
    const id = itemId(it); if (!id) continue;
    if (map.has(id) && (inv.items || inv.bag)) continue; // bag lists are authoritative
    const prev = map.get(id);
    map.set(id, { ...(typeof it === 'object' ? it : {}), id, count: (prev?.count || 0) + itemCount(it) });
  }
  return [...map.values()];
}
export function countOf(game, id) {
  const inv = inventory(game);
  if (inv && typeof inv.count === 'function') { try { return num(inv.count(id), 0); } catch { /* fall through */ } }
  return allItems(game).filter((i) => i.id === id).reduce((a, i) => a + i.count, 0);
}
export function money(game) {
  const v = inventory(game)?.money ?? game?.money ?? game?.player?.money ?? game?.player?.coins ?? game?.farm?.money;
  return Number.isFinite(+v) ? +v : null;
}
export function fmtMoney(v) { return String(Math.floor(Math.max(0, v))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

const WD = ['Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.', 'So.'];
const SEASONS = { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', fall: 'Herbst', winter: 'Winter', fruehling: 'Frühling', sommer: 'Sommer', herbst: 'Herbst' };
export function clockInfo(game) {
  const c = game?.clock;
  if (!c) return null;
  let h = num(c.hours ?? c.hour ?? c.time, 6);
  let min = c.minutes ?? c.minute;
  if (min == null) { min = Math.floor((h % 1) * 60); h = Math.floor(h); }
  min = Math.floor(num(min, 0) / 10) * 10; // Stardew-like 10-minute steps
  const day = Math.max(1, Math.floor(num(c.day, 1)));
  const hh = ((h % 24) + 24) % 24;
  const night = hh < 6 || hh >= 19;
  const season = c.seasonName || (c.season != null ? SEASONS[String(c.season).toLowerCase()] || String(c.season) : null);
  const wd = c.weekdayShort ? c.weekdayShort.replace(/\.$/, '') + '.' : WD[(day - 1) % 7];
  const time = c.timeText || `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  const isNight = c.isNight ?? night;
  return { text: `${wd} ${day} · ${time}`, night: isNight || hh < 6, hours: hh, day, season, darkness: c.darkness ?? (night ? 1 : 0) };
}
