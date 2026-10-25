// All monster species (ids are binding, see docs/DESIGN.md) + the drift orb.
// Sizes (ws 0.5): small ≈ 24–28 world px tall, evolved ≈ 36–42, boss ≈ 76. Canvas = square fitted to the
// species' widest pose (see buildMonster), anchor = foot point.
import { buildMonster } from './kit.js';
import { funkel, glutar, tropfi, strudelott, sprossi, dornigel, kiesel, felspanzer } from './ground.js';
import { zappi, boeli, sturmfalk, moosi, pilzling, steinwaechter } from './others.js';
import { buildOrb } from './orb.js';

export const SPECIES_ART = [
  { id: 'funkel', scale: 1.75, draw: funkel },
  { id: 'glutar', scale: 1.08, draw: glutar },
  { id: 'tropfi', scale: 1.8, draw: tropfi },
  { id: 'strudelott', scale: 1.32, draw: strudelott },
  { id: 'sprossi', scale: 1.8, draw: sprossi },
  { id: 'dornigel', scale: 1.4, draw: dornigel },
  { id: 'kiesel', scale: 2.1, draw: kiesel, faint: 'back' },
  { id: 'felspanzer', scale: 1.5, draw: felspanzer, faint: 'back' },
  { id: 'zappi', scale: 1.55, draw: zappi, fly: true },
  { id: 'boeli', scale: 1.7, draw: boeli, fly: true },
  { id: 'sturmfalk', scale: 1.15, draw: sturmfalk, fly: true },
  { id: 'moosi', scale: 1.8, draw: moosi },
  { id: 'pilzling', scale: 1.75, draw: pilzling },
  { id: 'steinwaechter', scale: 2.3, draw: steinwaechter },
];

export function buildMonsters() {
  const S = {};
  for (const spec of SPECIES_ART) Object.assign(S, buildMonster(spec));
  Object.assign(S, buildOrb());
  return S;
}
