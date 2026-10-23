// Defensive accessors for gameplay data (monsters, party, dex, inventory, clock, money).
// The UI never assumes one exact shape: it accepts the variants documented in docs/UI.md.

// ---- types -------------------------------------------------------------------------------------
export const TYPES = {
  fire: { name: 'Feuer', short: 'FEU', color: '#e06030', dark: '#802818', light: '#f8a868' },
  water: { name: 'Wasser', short: 'WAS', color: '#3888d8', dark: '#183870', light: '#98c8f8' },
  plant: { name: 'Pflanze', short: 'PFL', color: '#48a840', dark: '#1c5020', light: '#a8e078' },
  rock: { name: 'Stein', short: 'STE', color: '#a08860', dark: '#4a3c2a', light: '#d8c8a0' },
  spark: { name: 'Blitz', short: 'BLI', color: '#e8c020', dark: '#806010', light: '#f8f088' },
  wind: { name: 'Wind', short: 'WIN', color: '#70c0c8', dark: '#28606a', light: '#c8f0f0' },
  normal: { name: 'Normal', short: 'NOR', color: '#a8a098', dark: '#4c4844', light: '#e0dcd4' },
};
const TYPE_ALIAS = {
  feuer: 'fire', fire: 'fire', wasser: 'water', water: 'water', pflanze: 'plant', plant: 'plant', grass: 'plant', leaf: 'plant',
  stein: 'rock', rock: 'rock', stone: 'rock', blitz: 'spark', spark: 'spark', electric: 'spark', thunder: 'spark', lightning: 'spark',
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
  dornigel: { no: 6, name: 'Dornigel', types: ['plant', 'rock'], habitat: 'Entwicklung', desc: 'Igel mit dornigem Steinpanzer.' },
  kiesel: { no: 7, name: 'Kieselkrabbe', types: ['rock'], habitat: 'Ufer, Höhle', desc: 'Krabbe, die ihre Schale aus Kieseln baut.' },
  felspanzer: { no: 8, name: 'Felspanzer', types: ['rock'], habitat: 'Höhle', desc: 'Massiger Felskrebs, kaum zu erschüttern.' },
  zappi: { no: 9, name: 'Zappfalter', types: ['spark'], habitat: 'Wiese', desc: 'Schmetterling, dessen Flügel Funken sprühen.' },
  boeli: { no: 10, name: 'Böenspatz', types: ['wind'], habitat: 'Wiese, Klippen', desc: 'Rundlicher Spatz, der mit jedem Windstoß tanzt.' },
  sturmfalk: { no: 11, name: 'Sturmfalk', types: ['wind'], habitat: 'Klippen', desc: 'Falke mit einem Schweif aus Sturmböen.' },
  moosi: { no: 12, name: 'Moosschneck', types: ['plant'], habitat: 'Wald', desc: 'Schnecke, die einen kleinen Moosgarten trägt.' },
  pilzling: { no: 13, name: 'Pilzling', types: ['plant'], habitat: 'Wald (nachts)', desc: 'Wandernder Pilz, meist schläfrig.' },
  steinwaechter: { no: 14, name: 'Steinwächter', types: ['rock'], habitat: 'Monster-Höhle', desc: 'Uralter Golem, Hüter der Höhle.' },
};

const num = (v, d = 0) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : d);

export function speciesTable(game) {
  const src = game?.species || game?.dex?.species || null;
  if (!src) return SPECIES;
  const out = { ...SPECIES };
  const list = Array.isArray(src) ? src : Object.entries(src).map(([id, s]) => ({ id, ...s }));
  for (const s of list) if (s && (s.id || s.key)) out[s.id || s.key] = { ...(SPECIES[s.id || s.key] || {}), ...s };
  return out;
}

export function speciesId(m) {
  if (!m) return null;
  if (typeof m === 'string') return m;
  return m.speciesId || m.species?.id || (typeof m.species === 'string' ? m.species : null) || m.id || null;
}
export function speciesOf(game, m) { const id = speciesId(m); return (id && speciesTable(game)[id]) || null; }

// ---- monster instance ----------------------------------------------------------------------------
export function monName(game, m) {
  if (!m) return '';
  return m.nickname || m.name || speciesOf(game, m)?.name || speciesId(m) || '???';
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
  const next = m.xpNext ?? m.xpToNext ?? m.nextXp;
  if (Number.isFinite(next)) return m.xpToNext != null && m.xpNext == null ? clamp01(1 - next / Math.max(1, next + xp)) : clamp01(xp / Math.max(1, next));
  return 0;
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export function monMoves(m) { return (m?.moves || []).slice(0, 4).map((mv) => (typeof mv === 'string' ? { id: mv, name: mv } : mv)).filter(Boolean); }
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
  return p.members || p.list || p.team || p.monsters || [];
}
export function boxList(game) {
  const p = game?.party;
  return (p && !Array.isArray(p) && (p.box || p.storage)) || game?.box || [];
}
export function leadMon(game) {
  const p = game?.party;
  if (p && !Array.isArray(p) && p.lead && typeof p.lead === 'object') return p.lead;
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
    if (!Array.isArray(p) && 'lead' in p && typeof p.lead === 'object') p.lead = l[0];
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
  const d = game?.dex || {};
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
export function itemName(it) {
  if (!it) return '';
  if (typeof it === 'object' && it.name) return it.name;
  const id = itemId(it) || '';
  if (ITEM_NAMES[id]) return ITEM_NAMES[id];
  let m = /^seeds?_(.+)$/.exec(id);
  if (m) return (ITEM_NAMES[m[1]] || cap(m[1])) + '-Saat';
  m = /^crop_(.+)$/.exec(id);
  if (m) return ITEM_NAMES[m[1]] || cap(m[1]);
  return cap(id.replace(/_/g, ' '));
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export function itemCount(it) { return typeof it === 'object' && it ? num(it.count ?? it.qty ?? it.n ?? it.amount, 1) : 1; }

export function inventory(game) { return game?.inventory || game?.inv || game?.player?.inventoryObj || null; }
export function hotbar(game) {
  const inv = inventory(game);
  if (!inv) return { slots: [], active: -1, inv: null };
  const slots = inv.hotbar || (Array.isArray(inv.slots) ? inv.slots.slice(0, 8) : []) || [];
  const active = num(inv.active ?? inv.selected ?? inv.slot ?? inv.activeSlot, 0);
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
  const v = game?.money ?? game?.player?.money ?? game?.player?.coins ?? inventory(game)?.money ?? game?.farm?.money;
  return Number.isFinite(+v) ? +v : null;
}
export function fmtMoney(v) { return String(Math.floor(Math.max(0, v))).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

const WD = ['Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.', 'So.'];
const SEASONS = { spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst', fall: 'Herbst', winter: 'Winter' };
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
  const season = c.season != null ? SEASONS[String(c.season).toLowerCase()] || String(c.season) : null;
  return { text: `${WD[(day - 1) % 7]} ${day} · ${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`, night, hours: hh, day, season };
}
