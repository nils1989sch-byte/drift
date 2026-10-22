// Interiors: Bodos Haus (Startpunkt) und die versteckte Höhle an den Nordklippen.
import { room } from './paint.js';

export function houseElder() {
  const P = room(11, 9, { floor: 'w', doorsS: [5] });
  // little rug
  P.rect(4, 4, 6, 5, 'o');
  return {
    id: 'house_elder', name: 'Bodos Haus', face: 'brick', plinth: 'earth', music: 'overworld', outdoor: false, ambient: false,
    rows: P.rows(), heights: P.heights(),
    objects: [
      { t: 'chest', x: 8, y: 2, item: 'rupees', amount: 10, text: ['Du hast 10 Rupien gefunden!', 'Bodos Notgroschen … er wird es schon verschmerzen.'] },
      { t: 'pot', x: 1, y: 2 }, { t: 'pot', x: 2, y: 2 }, { t: 'pot', x: 1, y: 7 },
      { t: 'torch', x: 3, y: 2 }, { t: 'torch', x: 7, y: 2 },
      { t: 'sign', x: 9, y: 7, text: ['Ein vergilbter Zettel:', '„Schwert schärfen. Kristall polieren. Milch kaufen.“'] },
    ],
    enemies: [],
    npcs: [{ t: 'elder', x: 5, y: 3, dir: 'down', dialog: 'elder' }],
    warps: [{ x: 5, y: 8.4, w: 1, h: 0.6, to: 'overworld', spawn: 'house', dirReq: 'down' }],
    spawns: { start: { x: 5 * 16 + 8, y: 6 * 16 + 8, dir: 'up' }, door: { x: 5 * 16 + 8, y: 7 * 16 + 10, dir: 'up' } },
  };
}

export function cave() {
  const P = room(13, 10, { floor: 'o', doorsS: [6] });
  P.rect(1, 2, 3, 3, ':').rect(9, 6, 11, 8, ':');
  P.rect(5, 5, 7, 6, '-');                   // little spring
  return {
    id: 'cave', name: 'Verborgene Grotte', face: 'rock', plinth: 'stone', music: 'dungeon', outdoor: false,
    rows: P.rows(), heights: P.heights(),
    objects: [
      { t: 'chest', x: 6, y: 2, item: 'heart_container', text: ['Du hast einen Herzcontainer gefunden!', 'Deine maximale Lebensenergie steigt um ein Herz.'] },
      { t: 'pot', x: 1, y: 7 }, { t: 'pot', x: 2, y: 8 }, { t: 'pot', x: 11, y: 2 }, { t: 'pot', x: 10, y: 2 },
      { t: 'torch', x: 4, y: 2 }, { t: 'torch', x: 8, y: 2 },
      { t: 'rock', x: 10, y: 7 }, { t: 'mushroom', x: 2, y: 3 }, { t: 'mushroom', x: 11, y: 8 },
    ],
    enemies: [{ t: 'bat', x: 3, y: 5 }, { t: 'bat', x: 9, y: 4 }],
    npcs: [],
    warps: [{ x: 6, y: 9.4, w: 1, h: 0.6, to: 'overworld', spawn: 'cave', dirReq: 'down' }],
    spawns: { entry: { x: 6 * 16 + 8, y: 8 * 16 + 10, dir: 'up' } },
    loot: { pot: 'rich' },
  };
}
