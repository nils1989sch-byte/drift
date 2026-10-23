// Monster types and effectiveness (docs/DESIGN.md).
// Feuer > Pflanze > Wasser > Feuer; Blitz > Wasser, Wind; Stein > Feuer, Blitz, Wind; Wind > Pflanze; Pflanze > Stein.
// The reverse of every "strong" pair is 0.5. Normal is neutral.
export const TYPES = ['normal', 'fire', 'water', 'plant', 'bolt', 'stone', 'wind'];
export const TYPE_NAME = { normal: 'Normal', fire: 'Feuer', water: 'Wasser', plant: 'Pflanze', bolt: 'Blitz', stone: 'Stein', wind: 'Wind' };
export const TYPE_COLOR = { normal: '#c8c0b0', fire: '#f07030', water: '#3890f0', plant: '#50b040', bolt: '#f0d030', stone: '#a08868', wind: '#90d8e0' };

const STRONG = {
  fire: ['plant'],
  water: ['fire'],
  plant: ['water', 'stone'],
  bolt: ['water', 'wind'],
  stone: ['fire', 'bolt', 'wind'],
  wind: ['plant'],
  normal: [],
};

export function effectiveness(atkType, defTypes) {
  let m = 1;
  for (const d of [].concat(defTypes)) {
    if (STRONG[atkType]?.includes(d)) m *= 2;
    else if (STRONG[d]?.includes(atkType)) m *= 0.5;
  }
  return m;
}
export function effText(m) { return m > 1 ? 'Sehr effektiv!' : m < 1 ? 'Nicht sehr effektiv …' : ''; }
