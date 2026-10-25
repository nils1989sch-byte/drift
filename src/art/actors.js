// Enemies, boss and NPCs (HD-2D, double density: canvas.ws = 0.5). Painted with the character rig in
// src/art/chars/ so every figure shares the hero's ramps, light direction and outline rules.
import { buildEnemies } from './chars/enemies.js';
import { buildNPCs } from './chars/npcs.js';
import { buildMonsters } from './chars/monsters/index.js';
import { renderPose, walkPose } from './hero.js';

const viewOf = (d) => (d === 'left' || d === 'right' ? 'side' : d);

export function buildActors() {
  return Object.assign({}, buildEnemies(), buildNPCs(renderPose, walkPose, viewOf), buildMonsters());
}
