// Oberwelt "Driftwald" (48×36). Höhenstufen 0–3:
//  - Dorf Driftwald (Südwest) mit Häusern, Garten, Platz
//  - Flüsterwiese (Mitte) mit Teich und hohem Gras
//  - Nordklippen (NW, Stufe 1–2) mit versteckter Höhle (rissige Wand, Bomben)
//  - Fluss mit Brücke, Ostufer, kleiner Hügel
//  - Steinwacht-Höhen (NE, Stufe 1–3) mit dem Eingang zur Steinwacht-Ruine
import { painter } from './paint.js';

export default function build() {
  const W = 48, H = 36;
  const P = painter(W, H, '.', 0);

  // --- ground variation -------------------------------------------------------------
  P.blob(16, 6, 5, 3, ',').blob(26, 30, 3, 2, '*').blob(40, 22, 4, 2, '*').blob(8, 17, 3, 1.5, '*');
  P.blob(24, 4, 3, 2, '*').blob(42, 31, 3, 2, ',');

  // --- plateaus -------------------------------------------------------------------------
  // Nordklippen
  P.height(2, 0, 11, 13, 1);
  P.height(3, 0, 7, 7, 2);
  P.rect(5, 7, 5, 7, 'H', 2);          // stairs 2→1
  P.rect(9, 13, 9, 13, 'H', 1);        // stairs 1→0
  P.rect(3, 9, 9, 12, ',', null).rect(4, 1, 6, 4, '*', null);
  // Steinwacht-Höhen
  P.height(34, 0, 45, 14, 1);
  P.height(36, 0, 44, 9, 2);
  P.height(38, 0, 42, 4, 3);
  P.rect(36, 14, 37, 14, 'H', 1);      // stairs 1→0 (2 wide)
  P.rect(40, 9, 40, 9, 'H', 2);        // stairs 2→1
  P.rect(38, 0, 42, 4, ':', null);     // ruin plateau: bare earth
  P.rect(39, 5, 41, 8, 'o', null);     // paved forecourt
  P.rect(40, 5, 40, 8, 'o', null);
  // small hill on the east bank
  P.height(40, 17, 44, 20, 1);
  P.rect(42, 20, 42, 20, 'H', 1);

  // --- river ----------------------------------------------------------------------------
  P.rect(30, 0, 32, 35, '~', 0);
  P.rect(29, 2, 29, 33, 's', 0).rect(33, 0, 33, 35, 's', 0);
  P.rect(29, 27, 29, 31, '-', 0).rect(28, 28, 28, 30, 's', 0);
  P.rect(30, 23, 32, 24, '#', 0);      // bridge

  // --- pond -----------------------------------------------------------------------------
  P.blob(22, 10.5, 3.6, 2.6, '-').blob(22, 10.5, 2.6, 1.7, '~');
  P.rect(21, 13, 23, 13, 's', null);

  // --- paths ----------------------------------------------------------------------------
  P.rect(2, 23, 29, 24, '=');           // village road to the bridge
  P.rect(33, 23, 37, 24, '=');
  P.rect(36, 15, 37, 22, '=');          // up to the heights
  P.rect(12, 14, 13, 22, '=');          // north path through the meadow
  P.rect(9, 14, 11, 15, '=');           // to the cliffs' stairs
  P.rect(10, 25, 15, 27, 'o');          // village square (paved)
  P.rect(8, 28, 8, 30, '=');            // to the shop
  P.rect(8, 27, 9, 27, '=');
  P.rect(15, 22, 16, 22, '=').rect(7, 22, 8, 22, '=');  // house fronts
  P.rect(37, 10, 40, 13, '=', null);    // heights path
  P.rect(40, 10, 40, 10, '=', null);

  // --- tall grass ------------------------------------------------------------------------
  P.rect(21, 15, 27, 19, '"').rectIf(20, 16, 28, 18, '"', '.,*');
  P.rect(15, 3, 18, 5, '"');
  P.rect(39, 26, 44, 32, '"');
  P.rect(3, 16, 7, 18, '"');
  P.rect(35, 2, 37, 5, '"', null);      // on the heights (lvl 1) – wait: those are lvl 2 cells partially; fine
  P.rect(43, 11, 44, 13, '"', null);

  // --- borders (forest) ----------------------------------------------------------------------
  P.rectIf(0, 0, 47, 1, ',', '.*"');
  P.rectIf(0, 34, 47, 35, ',', '.*"');
  P.rectIf(0, 0, 1, 35, ',', '.*"=');
  P.rectIf(46, 0, 47, 35, ',', '.*"');

  const objects = [], enemies = [], npcs = [];
  const O = (t, x, y, o = {}) => objects.push({ t, x, y, ...o });
  const isWater = (x, y) => P.get(x, y) === '~';

  // forest border trees (non-solid: a barrier covers the whole band)
  const tree = (px, py) => objects.push({ t: 'tree', px, py, solid: false, border: true });
  for (let x = 0; x < W; x += 2) {
    if (!isWater(x, 1) && !isWater(x + 1, 1)) tree(x * 16 + 16, 28);
    if (!isWater(x + 1, 0) && x + 2 < W) tree(x * 16 + 32, 10);
    if (!isWater(x, 35) && !isWater(x + 1, 35)) tree(x * 16 + 16, 35 * 16 + 12);
    if (!isWater(x + 1, 34) && x + 2 < W) tree(x * 16 + 32, 34 * 16 + 8);
  }
  for (let y = 3; y < 34; y += 2) { tree(16, y * 16 + 12); tree(46 * 16 + 16, y * 16 + 12); }
  for (let y = 4; y < 33; y += 4) { tree(4, y * 16 + 4); tree(47 * 16 + 12, y * 16 + 4); }
  objects.push({ t: 'barrier', x: 0, y: 0, w: W, h: 2 }, { t: 'barrier', x: 0, y: 34, w: W, h: 2 },
    { t: 'barrier', x: 0, y: 0, w: 2, h: H }, { t: 'barrier', x: 46, y: 0, w: 2, h: H });

  // --- village Driftwald -------------------------------------------------------------------------
  O('house', 0, 0, { px: 8 * 16, py: 22 * 16 - 1, id: 'elder' });
  O('house', 0, 0, { px: 16 * 16, py: 22 * 16 - 1, id: 'mia' });
  O('house', 0, 0, { px: 6 * 16, py: 31 * 16 - 1, id: 'shop' });
  O('sign', 4, 22, { text: ['Driftwald', 'Ein ruhiges Dorf am Rande der Welt. Bitte nicht davontreiben.'] });
  O('sign', 27, 22, { text: ['→ Osten: Steinwacht-Ruine', 'Achtung: Seit Neuestem treiben sich dort Soldaten herum!'] });
  O('sign', 10, 16, { text: ['↑ Nordklippen', 'Aussichtspunkt. Betreten auf eigene Gefahr.'] });
  O('sign', 9, 28, { text: ['Lutz’ Krämerladen', 'Bomben · Kram · Krempel'] });
  O('statue', 12, 26); O('flower', 11, 25); O('flower', 14, 27); O('flower', 10, 27); O('flower', 15, 25);
  O('pot', 10, 21); O('pot', 11, 21); O('pot', 18, 21);
  O('pot', 3, 29); O('pot', 3, 30);
  // garden with fence
  for (let x = 18; x <= 23; x++) { if (x !== 20) O('fence_h', x, 27); O('fence_h', x, 32); }
  for (let y = 28; y <= 31; y++) { O('fence_v', 17, y); O('fence_v', 24, y); }
  O('fence_h', 17, 27); O('fence_h', 24, 27); O('fence_h', 17, 32); O('fence_h', 24, 32);
  for (const [x, y] of [[19, 29], [21, 29], [22, 30], [19, 31], [23, 28], [21, 31]]) O('flower', x, y);
  O('bush', 22, 28); O('bush', 18, 30);
  // trees around the village
  for (const [x, y] of [[3, 20], [4, 26], [3, 32], [11, 32], [16, 31], [26, 26], [27, 32], [19, 20], [25, 21], [5, 19]]) O('tree', x, y);
  for (const [x, y] of [[13, 30], [14, 32], [9, 33], [27, 29], [26, 20], [20, 24]]) O('tree_small', x, y);
  for (const [x, y] of [[2, 25], [2, 26], [5, 33], [6, 33], [15, 33], [25, 33], [26, 33], [17, 25], [18, 25], [24, 22], [11, 19], [10, 19]]) O('bush', x, y);
  O('stump', 22, 25); O('mushroom', 25, 25); O('mushroom', 4, 31);

  // --- meadow & pond ------------------------------------------------------------------------------
  for (const [x, y] of [[15, 9], [27, 6], [14, 13], [26, 12], [17, 16], [28, 14], [19, 2], [23, 2]]) O('tree', x, y);
  for (const [x, y] of [[18, 12], [16, 11], [25, 7], [19, 7], [28, 9], [27, 3]]) O('tree_small', x, y);
  for (const [x, y] of [[14, 6], [14, 7], [20, 6], [21, 6], [17, 13], [18, 14], [26, 8], [27, 8], [15, 18], [16, 19], [19, 15], [18, 16]]) O('bush', x, y);
  for (const [x, y] of [[24, 14], [25, 14], [13, 4], [28, 18]]) O('rock', x, y);
  O('lilypad', 21, 10); O('lilypad', 23, 11); O('lilypad', 22, 9);
  for (const [x, y] of [[17, 8], [25, 13], [24, 6], [16, 15]]) O('flower', x, y);
  npcs.push({ t: 'girl', x: 20, y: 29, wander: true }, { t: 'merchant', x: 9, y: 30, dir: 'down' });
  npcs.push({ t: 'elder', x: 20, y: 13, dir: 'up', dialog: 'fisher', sprite: 'npc_elder' });

  // --- Nordklippen -----------------------------------------------------------------------------------
  for (const [x, y] of [[10, 3], [10, 7], [2, 11], [8, 10], [3, 9]]) O('tree', x, y);
  for (const [x, y] of [[9, 5], [8, 6], [2, 6], [7, 11], [4, 11], [5, 11]]) O('bush', x, y);
  O('rock', 10, 11); O('rock', 11, 12); O('rock', 2, 8);
  O('chest', 4, 3, { item: 'rupees', amount: 20, text: ['Du hast 20 Rupien gefunden!', 'Die Aussicht hier oben ist auch nicht schlecht.'] });
  O('sign', 6, 5, { text: ['Aussichtspunkt Nordklippen', 'Von hier oben sieht man bis zur Steinwacht-Ruine.'] });
  O('flower', 3, 5); O('flower', 6, 2);
  // the hidden cave: cracked cliff (bomb it) → cave entrance
  O('rock_cracked', 4, 13, { flag: 'cave_open', reveal: 'cave_entrance', lvl: 0 });
  O('cave_entrance', 4, 13, { lvl: 0, showFlag: 'cave_open' });
  // trees on the cliff foot
  O('tree', 2, 16); O('tree_small', 7, 15); O('bush', 6, 15); O('bush', 3, 15);

  // --- river banks ------------------------------------------------------------------------------------
  for (const [x, y] of [[28, 4], [28, 20], [28, 26], [34, 18], [34, 27], [34, 32]]) O('bush', x, y);
  O('rock', 28, 33); O('rock', 34, 30);

  // --- east bank & hill ------------------------------------------------------------------------------
  for (const [x, y] of [[38, 19], [45, 24], [36, 30], [44, 33], [39, 33]]) O('tree', x, y);
  for (const [x, y] of [[35, 25], [36, 26], [38, 25], [44, 25], [45, 29], [37, 32]]) O('bush', x, y);
  O('tree_small', 41, 17); O('tree_small', 44, 18);
  O('chest', 43, 18, { item: 'rupees', amount: 5, text: ['Du hast 5 Rupien gefunden!'] });
  O('rock', 40, 22); O('rock', 41, 22); O('pot', 41, 20);
  O('sign', 38, 16, { text: ['↑ Steinwacht-Höhen', 'Die alte Ruine wurde einst von Steinhütern bewacht.'] });

  // --- Steinwacht-Höhen ---------------------------------------------------------------------------------
  for (const [x, y] of [[35, 7], [45, 4], [45, 13]]) O('tree', x, y);
  for (const [x, y] of [[38, 2], [43, 2], [37, 6], [43, 7]]) O('tree_small', x, y);
  O('statue', 38, 6); O('statue', 42, 6);
  O('torch', 39, 5); O('torch', 41, 5);
  O('cave_entrance', 40, 4, { lvl: 2 });
  for (const [x, y] of [[34, 10], [34, 13], [41, 14], [45, 11], [45, 9]]) O('bush', x, y);
  O('rock', 39, 13); O('pot', 44, 6); O('pot', 36, 8);

  // --- enemies ---------------------------------------------------------------------------------------------
  enemies.push(
    { t: 'slime', x: 23, y: 17 }, { t: 'slime', x: 26, y: 16 },
    { t: 'slime', x: 41, y: 29 }, { t: 'slime', x: 43, y: 27 },
    { t: 'octorok', x: 28, y: 11 }, { t: 'octorok', x: 34, y: 20 }, { t: 'octorok', x: 35, y: 28 },
    { t: 'octorok', x: 18, y: 3 },
    { t: 'soldier', x: 36, y: 12, patrol: [[35, 12], [43, 12], [43, 10], [36, 10]] },
    { t: 'soldier', x: 43, y: 8, patrol: [[37, 8], [43, 8]] },
    { t: 'soldier', x: 37, y: 18, patrol: [[37, 17], [37, 21], [35, 21]] },
    { t: 'bat', x: 6, y: 9 }, { t: 'bat', x: 44, y: 3 },
  );

  return {
    id: 'overworld', name: 'Driftwald', face: 'rock', plinth: 'earth', music: 'overworld', outdoor: true,
    rows: P.rows(), heights: P.heights(),
    objects, enemies, npcs,
    warps: [
      { x: 7.6, y: 21.7, w: 0.8, h: 0.7, to: 'house_elder', spawn: 'door', dirReq: 'up' },
      { x: 4, y: 14, w: 1, h: 0.5, to: 'cave', spawn: 'entry', dirReq: 'up', needFlag: 'cave_open' },
      { x: 40, y: 5, w: 1, h: 0.5, to: 'dungeon_1', spawn: 'entry', dirReq: 'up' },
    ],
    spawns: {
      start: { x: 8 * 16, y: 23 * 16 + 4, dir: 'down' },
      house: { x: 8 * 16, y: 22 * 16 + 6, dir: 'down' },
      cave: { x: 4 * 16 + 8, y: 14 * 16 + 10, dir: 'down' },
      dungeon: { x: 40 * 16 + 8, y: 5 * 16 + 11, dir: 'down' },
    },
    areas: [
      { x0: 0, y0: 0, x1: 11, y1: 15, name: 'Nordklippen' },
      { x0: 33, y0: 0, x1: 47, y1: 15, name: 'Steinwacht-Höhen' },
      { x0: 33, y0: 15, x1: 47, y1: 35, name: 'Ostufer' },
      { x0: 12, y0: 0, x1: 32, y1: 19, name: 'Flüsterwiese' },
      { x0: 0, y0: 16, x1: 32, y1: 35, name: 'Driftwald' },
    ],
  };
}
