// Lutz' shop: stock data + buy/sell logic (pure) and a dialog-driven shop flow over ui.dialog({choices}).
// A UI shop menu can use shopStock()/buy()/sell()/sellables() directly instead of openShop().
import { ITEMS, itemDef, itemName } from './items.js';
import { CROP_IDS } from './crops.js';

export const CURRENCY = 'Taler';
const BASE_SEEDS = ['seeds_weizen', 'seeds_ruebe', 'seeds_kartoffel'];
const ROTATE_SEEDS = ['seeds_erdbeere', 'seeds_kuerbis', 'seeds_blaubeere'];

/** Weekly "Angebot der Woche": one seed 20 % cheaper (changes every 7 days). */
export function weeklyDeal(day = 1) { const w = Math.floor((day - 1) / 7); return [...BASE_SEEDS, ...ROTATE_SEEDS][(w * 5 + 1) % 6]; }

/** Price the shop asks for one item on a given day (null = not for sale). */
export function buyPrice(id, day = 1) {
  const d = itemDef(id);
  if (!d || !d.price || d.noShop) return null;
  if (d.fromDay && day < d.fromDay) return null;
  const p = id === weeklyDeal(day) ? Math.round(d.price * 0.8) : d.price;
  return p;
}
export function sellPrice(id) { return itemDef(id)?.sell || 0; }

/** Shop stock for a day: [{ id, name, price, kind, deal, icon }] grouped by category. */
export function shopStock(day = 1) {
  const deal = weeklyDeal(day);
  const ids = [...BASE_SEEDS, ...ROTATE_SEEDS, 'orb', 'orb_good', 'potion', 'potion_big', 'revive'];
  return ids.map((id) => ({ id, name: ITEMS[id].name, price: buyPrice(id, day), kind: ITEMS[id].kind, deal: id === deal, icon: 'icon_' + id }))
    .filter((e) => e.price != null);
}

export function buy(inv, id, n = 1, day = 1) {
  const p = buyPrice(id, day);
  if (p == null) return { ok: false, reason: 'Das verkaufe ich nicht.' };
  const cost = p * n;
  if (inv.money < cost) return { ok: false, reason: `Dafür reichen deine ${CURRENCY} nicht.` };
  const left = inv.add(id, n);
  const got = n - left;
  if (!got) return { ok: false, reason: 'Dein Rucksack ist voll!' };
  inv.spend(p * got);
  return { ok: true, n: got, cost: p * got };
}

/** Stacks the player can sell (crops, ore, seeds, balls, potions – no tools). */
export function sellables(inv) {
  const seen = new Map();
  for (const s of inv.slots) if (s && sellPrice(s.id) > 0 && itemDef(s.id).kind !== 'tool') seen.set(s.id, (seen.get(s.id) || 0) + s.n);
  return [...seen].map(([id, n]) => ({ id, n, name: itemDef(id).name, price: sellPrice(id) }))
    .sort((a, b) => (itemDef(a.id).kind === 'crop' ? 0 : 1) - (itemDef(b.id).kind === 'crop' ? 0 : 1));
}

export function sell(inv, id, n = 1) {
  const have = inv.count(id), k = Math.min(have, n), p = sellPrice(id);
  if (!k || !p) return { ok: false, reason: 'Das kaufe ich dir nicht ab.' };
  inv.remove(id, k);
  inv.addMoney(p * k);
  return { ok: true, n: k, gain: p * k };
}

/**
 * Dialog flow: Kaufen / Verkaufen / Tschüss. `say(lines|{text,speaker,choices})` → Promise<choiceIndex>.
 * ctx = { inventory, clock, say, sfx(name) }.
 */
export async function openShop(ctx, speaker = 'Lutz') {
  const { inventory: inv, clock } = ctx;
  const ask = async (text, choices) => { const c = await ctx.say({ text, speaker, choices }); return typeof c === 'number' ? c : -1; };
  const talk = (text) => ctx.say({ text, speaker });
  let first = true;
  for (let guard = 0; guard < 40; guard++) {
    const main = await ask(first ? `Willkommen! Was darf’s sein? (Du hast ${inv.money} ${CURRENCY}.)` : `Noch etwas? (${inv.money} ${CURRENCY})`, ['Kaufen', 'Verkaufen', 'Tschüss']);
    first = false;
    if (main === 0) {
      const cat = await ask('Was suchst du?', ['Saatgut', 'Kugeln', 'Tränke', 'Zurück']);
      const kind = ['seed', 'ball', 'potion'][cat];
      if (!kind) continue;
      const list = shopStock(clock?.day ?? 1).filter((e) => e.kind === kind).slice(0, 6);
      const pick = await ask(kind === 'seed' ? `Angebot der Woche: ${ITEMS[weeklyDeal(clock?.day ?? 1)].name}!` : 'Bitte sehr:',
        [...list.map((e) => `${e.name} – ${e.price} T${e.deal ? ' ★' : ''}`), 'Zurück']);
      const e = list[pick];
      if (!e) continue;
      const amounts = kind === 'seed' ? [1, 5, 10] : [1, 3, 5];
      const q = await ask(`${e.name}: ${ITEMS[e.id].desc} Wie viele?`, [...amounts.map((a) => `${a}× (${a * e.price} T)`), 'Zurück']);
      if (!(q >= 0 && q < amounts.length)) continue;
      const r = buy(inv, e.id, amounts[q], clock?.day ?? 1);
      if (r.ok) { ctx.sfx?.('buy'); await talk(`Danke! ${itemName(e.id, r.n)} für ${r.cost} ${CURRENCY}.`); }
      else { ctx.sfx?.('error'); await talk(r.reason); }
    } else if (main === 1) {
      const list = sellables(inv).slice(0, 5);
      if (!list.length) { await talk('Du hast nichts, was ich dir abkaufen könnte. Bring mir Ernte vom Hof!'); continue; }
      const pick = await ask('Was willst du verkaufen?', [...list.map((e) => `${e.name} ×${e.n} – je ${e.price} T`), 'Zurück']);
      const e = list[pick];
      if (!e) continue;
      const q = await ask(`${e.name} verkaufen?`, [`Alle (${e.n * e.price} T)`, `Eins (${e.price} T)`, 'Zurück']);
      if (q !== 0 && q !== 1) continue;
      const r = sell(inv, e.id, q === 0 ? e.n : 1);
      if (r.ok) { ctx.sfx?.('buy'); await talk(`Abgemacht: ${itemName(e.id, r.n)} für ${r.gain} ${CURRENCY}.`); }
      else await talk(r.reason);
    } else {
      await talk('Bis bald! Und gieß deine Pflanzen!');
      return;
    }
  }
}
export { CROP_IDS };
