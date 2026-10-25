// All monster species (ids are binding, see docs/DESIGN.md) + the drift orb.
// Sizes (canvas, ws 0.5): small 64×64 (≈ 24–28 world px tall), evolved 96×96 (≈ 36–40), boss 176×176 (≈ 76).
import { buildMonster } from './kit.js';
import { funkel, glutar, tropfi, strudelott, sprossi, dornigel, kiesel, felspanzer } from './ground.js';
import { zappi, boeli, sturmfalk, moosi, pilzling, steinwaechter } from './others.js';
import { buildOrb } from './orb.js';

export const SPECIES_ART = [
  { id: 'funkel', size: 64, draw: funkel },
  { id: 'glutar', size: 96, draw: glutar, iconScale: 0.42, iconY: 30 },
  { id: 'tropfi', size: 64, draw: tropfi },
  { id: 'strudelott', size: 96, draw: strudelott, iconScale: 0.44, iconY: 30 },
  { id: 'sprossi', size: 64, draw: sprossi },
  { id: 'dornigel', size: 96, draw: dornigel, iconScale: 0.56, iconY: 29 },
  { id: 'kiesel', size: 64, draw: kiesel, iconScale: 0.8, iconY: 26 },
  { id: 'felspanzer', size: 96, draw: felspanzer, iconScale: 0.5, iconY: 27 },
  { id: 'zappi', size: 64, draw: zappi, fly: true, iconScale: 0.72, iconY: 38 },
  { id: 'boeli', size: 64, draw: boeli, fly: true, iconScale: 0.82, iconY: 33 },
  { id: 'sturmfalk', size: 96, draw: sturmfalk, fly: true, iconScale: 0.4, iconY: 39 },
  { id: 'moosi', size: 64, draw: moosi, iconScale: 0.85, iconY: 29 },
  { id: 'pilzling', size: 64, draw: pilzling, iconScale: 0.78, iconY: 30 },
  { id: 'steinwaechter', size: 176, draw: steinwaechter, iconScale: 0.38, iconY: 30 },
];

export function buildMonsters() {
  const S = {};
  for (const spec of SPECIES_ART) Object.assign(S, buildMonster(spec));
  Object.assign(S, buildOrb());
  return S;
}
