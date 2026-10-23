// Item catalogue for the farm/inventory (Gameplay-Agent B). Item id = icon suffix: icon key is `icon_<id>`.
// kind: 'tool' | 'seed' | 'crop' | 'ball' | 'potion' | 'ore'. price = shop buy price (G), sell = sale value (G).
import { CROPS } from './crops.js';

export const ITEMS = {
  hoe:    { name: 'Hacke', kind: 'tool', stack: 1, sell: 0, desc: 'Lockert Gras und Erde im Hof zu Ackerboden.' },
  can:    { name: 'Gießkanne', kind: 'tool', stack: 1, sell: 0, desc: 'Gießt Ackerboden. Am Wasser auffüllen.' },
  sickle: { name: 'Sichel', kind: 'tool', stack: 1, sell: 0, desc: 'Schneidet hohes Gras und Büsche, erntet Pflanzen.' },
  orb:    { name: 'Driftkugel', kind: 'ball', stack: 99, price: 20, sell: 8, desc: 'Fängt geschwächte wilde Monster.' },
  potion: { name: 'Trank', kind: 'potion', stack: 99, price: 30, sell: 12, heal: 20, desc: 'Heilt ein Monster um 20 KP.' },
  ore:    { name: 'Erz', kind: 'ore', stack: 99, sell: 15, desc: 'Von einem Stein-Monster ausgegraben.' },
};
for (const [id, c] of Object.entries(CROPS)) {
  ITEMS['seeds_' + id] = { name: c.name + '-Saat', kind: 'seed', stack: 99, price: c.seedPrice, sell: Math.floor(c.seedPrice / 2), crop: id, desc: `Reift in ${c.days} Tagen${c.regrow ? ', mehrfach erntbar' : ''}.` };
  ITEMS['crop_' + id] = { name: c.name, kind: 'crop', stack: 99, sell: c.sell, crop: id, desc: `Verkaufswert ${c.sell} G.` };
}

export function itemDef(id) { return ITEMS[id] || null; }
export function itemName(id, n = 1) { const d = ITEMS[id]; return d ? (n > 1 ? `${n}× ${d.name}` : d.name) : id; }
export function iconKey(id) { return id ? 'icon_' + id : null; }
