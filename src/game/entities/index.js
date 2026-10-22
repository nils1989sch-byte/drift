// Entity factories.
import { Octorok, Soldier, Slime, Bat } from './enemies.js';
import { Golem } from './boss.js';
export { createObject } from './objects.js';
export { createNPC } from './npcs.js';

export function createEnemy(g, spec) {
  switch (spec.t) {
    case 'octorok': return new Octorok(g, spec);
    case 'soldier': return new Soldier(g, spec);
    case 'slime': return new Slime(g, spec);
    case 'bat': return new Bat(g, spec);
    case 'golem': case 'boss_golem': return new Golem(g, spec);
    default: console.warn('[game] unknown enemy', spec.t); return null;
  }
}
