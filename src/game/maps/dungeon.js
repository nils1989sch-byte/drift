// Steinwacht-Ruine: 4 Räume (face 'brick', plinth 'stone').
//  1 Eingangshalle  → NW-Tür (offen) → 2 Rätselraum (Schiebeblock auf Schalter → Truhe mit kleinem Schlüssel)
//                   → NO-Tür (verschlossen) → 3 Gegnerraum (alle besiegen → Truhe mit Bomben; rissige Nordwand)
//  3 → (Bombe) → 4 Bossraum: Stein-Golem → Herzcontainer + Drift-Kristall.
import { room } from './paint.js';

const base = (id, name, music = 'dungeon') => ({ id, name, face: 'brick', plinth: 'stone', music, outdoor: false });

export function dungeon1() {
  const P = room(17, 13, { doorsN: [4, 12], doorsS: [8] });
  P.rect(7, 3, 9, 10, 'o');                    // carpet of slabs to the doors
  P.rect(4, 2, 4, 3, 'o').rect(12, 2, 12, 3, 'o');
  return {
    ...base('dungeon_1', 'Steinwacht-Ruine'),
    rows: P.rows(), heights: P.heights(),
    objects: [
      { t: 'statue', x: 6, y: 5 }, { t: 'statue', x: 10, y: 5 }, { t: 'statue', x: 6, y: 9 }, { t: 'statue', x: 10, y: 9 },
      { t: 'torch', x: 3, y: 2 }, { t: 'torch', x: 5, y: 2 }, { t: 'torch', x: 11, y: 2 }, { t: 'torch', x: 13, y: 2 },
      { t: 'pot', x: 1, y: 10 }, { t: 'pot', x: 1, y: 11 }, { t: 'pot', x: 2, y: 11 }, { t: 'pot', x: 15, y: 10 }, { t: 'pot', x: 15, y: 11 },
      { t: 'door_locked', x: 12, y: 0, flag: 'd1_door' },
      { t: 'sign', x: 14, y: 6, text: ['Eine Steintafel:', '„Wer den Hüter wecken will, braucht Schlüssel und Mut.“'] },
    ],
    enemies: [{ t: 'slime', x: 4, y: 7 }, { t: 'slime', x: 13, y: 8 }, { t: 'bat', x: 8, y: 4 }],
    npcs: [],
    warps: [
      { x: 8, y: 12.4, w: 1, h: 0.6, to: 'overworld', spawn: 'dungeon', dirReq: 'down' },
      { x: 4, y: 0, w: 1, h: 0.6, to: 'dungeon_2', spawn: 'entry', dirReq: 'up' },
      { x: 12, y: 0, w: 1, h: 0.6, to: 'dungeon_3', spawn: 'entry', dirReq: 'up' },
    ],
    spawns: {
      entry: { x: 8 * 16 + 8, y: 11 * 16 + 8, dir: 'up' },
      from_r2: { x: 4 * 16 + 8, y: 2 * 16 + 9, dir: 'down' },
      from_r3: { x: 12 * 16 + 8, y: 2 * 16 + 9, dir: 'down' },
    },
  };
}

export function dungeon2() {
  const P = room(15, 12, { doorsS: [7] });
  P.rect(10, 6, 12, 8, 'O');                   // pits
  P.rect(2, 2, 12, 2, 'o');
  return {
    ...base('dungeon_2', 'Steinwacht-Ruine'),
    rows: P.rows(), heights: P.heights(),
    objects: [
      { t: 'switch', x: 7, y: 3, flag: 'd2_switch', latch: true },
      { t: 'block', x: 4, y: 7 },
      { t: 'block', x: 2, y: 4 },
      { t: 'statue', x: 5, y: 4 }, { t: 'statue', x: 9, y: 4 },
      { t: 'chest', x: 12, y: 3, appearFlag: 'd2_switch', flag: 'd2_chest', item: 'key', text: ['Du hast einen kleinen Schlüssel gefunden!', 'Er öffnet eine verschlossene Tür in dieser Ruine.'] },
      { t: 'pot', x: 1, y: 9 }, { t: 'pot', x: 13, y: 10 }, { t: 'pot', x: 1, y: 10 },
      { t: 'torch', x: 1, y: 2 }, { t: 'torch', x: 13, y: 2 },
      { t: 'sign', x: 3, y: 9, text: ['In den Stein geritzt:', '„Schweres Gewicht öffnet den Weg.“'] },
    ],
    enemies: [{ t: 'bat', x: 11, y: 5 }, { t: 'bat', x: 3, y: 6 }],
    npcs: [],
    warps: [{ x: 7, y: 11.4, w: 1, h: 0.6, to: 'dungeon_1', spawn: 'from_r2', dirReq: 'down' }],
    spawns: { entry: { x: 7 * 16 + 8, y: 10 * 16 + 8, dir: 'up' } },
  };
}

export function dungeon3() {
  const P = room(15, 13, { doorsN: [7], doorsS: [7] });
  P.rect(2, 4, 3, 5, 'O').rect(11, 4, 12, 5, 'O').rect(2, 9, 3, 9, 'O').rect(11, 9, 12, 9, 'O');
  P.rect(6, 6, 8, 8, 'o');
  return {
    ...base('dungeon_3', 'Steinwacht-Ruine'),
    rows: P.rows(), heights: P.heights(),
    objects: [
      { t: 'wall_cracked', x: 7, y: 0, flag: 'd3_wall' },
      { t: 'chest', x: 7, y: 7, appearFlag: 'd3_clear', flag: 'd3_chest', item: 'bombs', amount: 10, text: ['Du hast Bomben gefunden!', 'Drücke Q/L, um eine Bombe zu legen. Sie sprengt rissige Wände – Abstand halten!'] },
      { t: 'torch', x: 5, y: 2 }, { t: 'torch', x: 9, y: 2 },
      { t: 'pot', x: 1, y: 11 }, { t: 'pot', x: 13, y: 11 }, { t: 'pot', x: 13, y: 2 },
      { t: 'statue', x: 1, y: 7 }, { t: 'statue', x: 13, y: 7 },
    ],
    enemies: [
      { t: 'soldier', x: 4, y: 7, patrol: [[4, 7], [4, 10], [10, 10], [10, 7]] },
      { t: 'soldier', x: 10, y: 3, patrol: [[10, 3], [4, 3]] },
      { t: 'slime', x: 6, y: 10 }, { t: 'slime', x: 9, y: 5 }, { t: 'octorok', x: 12, y: 7 },
    ],
    npcs: [],
    warps: [
      { x: 7, y: 12.4, w: 1, h: 0.6, to: 'dungeon_1', spawn: 'from_r3', dirReq: 'down' },
      { x: 7, y: 0, w: 1, h: 0.6, to: 'dungeon_4', spawn: 'entry', dirReq: 'up' },
    ],
    spawns: { entry: { x: 7 * 16 + 8, y: 11 * 16 + 8, dir: 'up' }, from_r4: { x: 7 * 16 + 8, y: 2 * 16 + 9, dir: 'down' } },
    update(g) {
      if (!g.flags.d3_clear && g.enemies.every((e) => e.dead) && g.mapTime > 0.5) {
        g.setFlag('d3_clear', true);
        g.toast('Ein Klicken hallt durch den Raum …');
      }
    },
  };
}

export function dungeon4() {
  const P = room(17, 14, { doorsS: [8] });
  P.rect(3, 3, 13, 11, 'o');
  P.rect(5, 5, 11, 9, '_');
  return {
    ...base('dungeon_4', 'Thron des Golems', 'dungeon'),
    rows: P.rows(), heights: P.heights(),
    objects: [
      { t: 'torch', x: 2, y: 2 }, { t: 'torch', x: 14, y: 2 }, { t: 'torch', x: 2, y: 11 }, { t: 'torch', x: 14, y: 11 },
      { t: 'statue', x: 5, y: 2 }, { t: 'statue', x: 11, y: 2 },
      { t: 'shutter', x: 8, y: 13, closedWhile: (g) => g.flags.boss_fight && !g.flags.boss_golem },
    ],
    enemies: [{ t: 'golem', x: 8, y: 5, once: 'boss_golem' }],
    npcs: [],
    warps: [{ x: 8, y: 13.4, w: 1, h: 0.6, to: 'dungeon_3', spawn: 'from_r4', dirReq: 'down' }],
    spawns: { entry: { x: 8 * 16 + 8, y: 12 * 16 + 6, dir: 'up' } },
    onEnter(g) {
      g.setFlag('boss_fight', false, false);
      if (g.flags.boss_golem && !g.flags.crystal) g.spawnCrystal();
      if (g.flags.boss_golem) g.addPortal();
    },
  };
}
