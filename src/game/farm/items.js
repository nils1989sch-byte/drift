// Item catalogue for the farm/inventory (Gameplay-Agent B). Item id = icon suffix: icon key is `icon_<id>`.
// kind: 'tool' | 'seed' | 'crop' | 'ball' | 'potion' | 'ore'. price = shop buy price (Taler), sell = sale value (Taler).
import { CROPS } from './crops.js';

export const ITEMS = {
  hoe:    { name: 'Hacke', kind: 'tool', stack: 1, sell: 0, desc: 'Lockert Gras und Erde im Hof zu Ackerboden.' },
  can:    { name: 'Gießkanne', kind: 'tool', stack: 1, sell: 0, desc: 'Gießt Ackerboden. Am Wasser auffüllen.' },
  sickle: { name: 'Sichel', kind: 'tool', stack: 1, sell: 0, desc: 'Schneidet hohes Gras und Büsche, erntet Pflanzen.' },
  // prices from docs/reference/MONSTER_FARM_GUIDE.md §3. fromDay: shop offers it from that day on.
  orb:        { name: 'Driftkugel', kind: 'ball', stack: 99, price: 50, sell: 20, ball: 1.0, desc: 'Fängt geschwächte wilde Monster (Faktor 1,0).' },
  orb_good:   { name: 'Gute Kugel', kind: 'ball', stack: 99, price: 150, sell: 60, ball: 1.6, fromDay: 5, desc: 'Bessere Fangchance (Faktor 1,6).' },
  orb_master: { name: 'Meisterkugel', kind: 'ball', stack: 99, sell: 0, ball: 2.5, noShop: true, desc: 'Selten. Nur als Belohnung (Faktor 2,5).' },
  potion:     { name: 'Trank', kind: 'potion', stack: 99, price: 40, sell: 16, heal: 30, desc: 'Heilt ein Monster um 30 KP.' },
  potion_big: { name: 'Großtrank', kind: 'potion', stack: 99, price: 120, sell: 48, heal: 100, fromDay: 8, desc: 'Heilt ein Monster um 100 KP.' },
  revive:     { name: 'Wiederbeleber', kind: 'potion', stack: 99, price: 200, sell: 80, revive: 0.5, desc: 'Belebt ein besiegtes Monster mit 50 % KP.' },
  ore:    { name: 'Erz', kind: 'ore', stack: 99, sell: 15, desc: 'Von einem Stein-Monster ausgegraben.' },
};
for (const [id, c] of Object.entries(CROPS)) {
  ITEMS['seeds_' + id] = { name: c.name + '-Saat', kind: 'seed', stack: 99, price: c.seedPrice, sell: Math.floor(c.seedPrice / 2), crop: id, desc: `Reift in ${c.days} Tagen${c.regrow ? ', mehrfach erntbar' : ''}.` };
  ITEMS['crop_' + id] = { name: c.name, kind: 'crop', stack: 99, sell: c.sell, crop: id, desc: `Verkaufswert ${c.sell} Taler.` };
}

export function itemDef(id) { return ITEMS[id] || null; }
export function itemName(id, n = 1) { const d = ITEMS[id]; return d ? (n > 1 ? `${n}× ${d.name}` : d.name) : id; }
export function iconKey(id) { return id ? 'icon_' + id : null; }
