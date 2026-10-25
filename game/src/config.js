// Möbel-Chaos – alle Level- und Balancing-Daten an einem Ort.
// Koordinaten: X = Ost/West (rechts = +X), Z = Nord/Süd (unten auf dem Bildschirm = +Z), Meter.

export const ROUND_TIME = 180; // Sekunden
export const STAR_THRESHOLDS = [0.35, 0.6, 0.85]; // Anteil am Gesamtwert
export const TIME_BONUS_PER_SEC = 5; // € pro Restsekunde, wenn alles erledigt ist

export const TUNING = {
  playerRadius: 0.32,
  speedFree: 5.0,
  speedLight: 4.0,
  speedHeavy: 2.9,
  accel: 14,
  turnRate: 11,
  reach: 0.6, // max. Abstand Spieler → Möbelkante zum Greifen
  liftLight: 0.55,
  liftHeavy: 0.42,
  handleGap: 0.3, // Abstand Griff ↔ Möbelende
  impactThreshold: 1.8, // m/s ab denen ein Aufprall Schaden macht
  impactDamage: 6, // Schaden pro m/s über der Schwelle × Zerbrechlichkeit
  impactCooldown: 0.3,
  dropDamage: 14, // bei unfreiwilligem Fallenlassen × Zerbrechlichkeit
  tensionSpeed: 3.4, // Trennungsgeschwindigkeit ab der Spannung entsteht (beide ziehen weg)
  tensionDamage: 9, // pro Sekunde × Zerbrechlichkeit
  tensionDrop: 1.1, // Sekunden Dauerzug bis das Möbel runterfällt
  roombaSpeed: 1.7,
  roombaDamage: 12,
};

export const HOUSE = { x1: -17, x2: 1, z1: -9, z2: 9 };
export const CARGO = { x1: 8.3, x2: 14.3, z1: -2.5, z2: 2.5, floor: 0.45 };
export const RAMP = { x1: 6.1, x2: 8.3, z1: -1.7, z2: 1.7 };
export const WORLD_BOUNDS = { x1: -18.5, x2: 18.5, z1: -11, z2: 11 };

const T = 0.3; // Wandstärke
export const WALL_HEIGHT = 1.25;

// Wand entlang X (bei z) mit Türlücken [[a,b], …]
function hWall(z, x1, x2, gaps = [], kind = 'house') {
  const out = [];
  let cur = x1;
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (a > cur) out.push({ x1: cur, x2: a, z1: z - T / 2, z2: z + T / 2, kind });
    cur = b;
  }
  if (x2 > cur) out.push({ x1: cur, x2, z1: z - T / 2, z2: z + T / 2, kind });
  return out;
}
// Wand entlang Z (bei x)
function vWall(x, z1, z2, gaps = [], kind = 'house') {
  const out = [];
  let cur = z1;
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (a > cur) out.push({ x1: x - T / 2, x2: x + T / 2, z1: cur, z2: a, kind });
    cur = b;
  }
  if (z2 > cur) out.push({ x1: x - T / 2, x2: x + T / 2, z1: cur, z2, kind });
  return out;
}

export const WALLS = [
  // Außenwände
  ...hWall(-9, -17.15, 1.15, [], 'outer'),
  ...hWall(9, -17.15, 1.15, [], 'outer'),
  ...vWall(-17, -9, 9, [], 'outer'),
  ...vWall(1, -9, 9, [[-1.1, 1.1]], 'outer'), // Haustür
  // Flur
  ...hWall(-1.4, -12, 1, [[-3.7, -1.5], [-10.4, -8.4]]),
  ...hWall(1.4, -12, 1, [[-3.7, -1.5], [-10.4, -8.4]]),
  // Raumtrennungen
  ...vWall(-6, -9, -1.4),
  ...vWall(-6, 1.4, 9),
  ...vWall(-12, -9, 9, [[-1.4, 1.4]]),
];

export const TRUCK_WALLS = [
  { x1: 8.0, x2: 14.6, z1: -2.85, z2: -2.5, kind: 'truck' },
  { x1: 8.0, x2: 14.6, z1: 2.5, z2: 2.85, kind: 'truck' },
  { x1: 14.3, x2: 14.6, z1: -2.85, z2: 2.85, kind: 'truck' },
  { x1: 14.6, x2: 17.6, z1: -2.6, z2: 2.6, kind: 'cab' },
  // hintere Ecken der Ladefläche – rein nur über die Rampe
  { x1: 8.0, x2: 8.35, z1: -2.85, z2: -1.75, kind: 'truck' },
  { x1: 8.0, x2: 8.35, z1: 1.75, z2: 2.85, kind: 'truck' },
];

// Deko-Hindernisse draußen (Bäume, Briefkasten, Hecken …)
export const PROPS = [
  { type: 'tree', x: 3.6, z: -7.2 },
  { type: 'tree', x: 4.2, z: 6.8 },
  { type: 'tree', x: -18.2, z: -10.4, solid: false },
  { type: 'bush', x: 2.2, z: -3.4 },
  { type: 'bush', x: 2.3, z: 3.6 },
  { type: 'bush', x: 5.0, z: -4.6 },
  { type: 'mailbox', x: 5.3, z: 2.1 },
  { type: 'hedge', x: 3.6, z: -10.2, w: 4.6 },
  { type: 'hedge', x: 3.6, z: 10.2, w: 4.6 },
  { type: 'lamp', x: 6.6, z: -6.5 },
  { type: 'lamp', x: 6.6, z: 6.5 },
  { type: 'car', x: 11.8, z: -8.6 },
  { type: 'cone', x: 7.4, z: 3.2 },
  { type: 'cone', x: 7.4, z: -3.2 },
];

// Räume: Bodenbelag + Label
export const ROOMS = [
  { name: 'Wohnzimmer', floor: 'wood', x1: -6, x2: 1, z1: -9, z2: -1.4 },
  { name: 'Küche', floor: 'tiles', x1: -12, x2: -6, z1: -9, z2: -1.4 },
  { name: 'Schlafzimmer', floor: 'carpet', x1: -6, x2: 1, z1: 1.4, z2: 9 },
  { name: 'Büro', floor: 'darkwood', x1: -12, x2: -6, z1: 1.4, z2: 9 },
  { name: 'Musikzimmer', floor: 'herring', x1: -17, x2: -12, z1: -9, z2: 9 },
  { name: 'Flur', floor: 'stone', x1: -12, x2: 1, z1: -1.4, z2: 1.4 },
];

// len = lange Seite (lokale X-Achse), dep = Tiefe, h = Höhe
export const ITEM_TYPES = {
  sofa:      { label: 'Sofa',        len: 2.2,  dep: 0.95, h: 0.8,  value: 400, fragility: 1.0, heavy: true },
  armchair:  { label: 'Sessel',      len: 1.0,  dep: 0.9,  h: 0.8,  value: 150, fragility: 1.0, heavy: false },
  tv:        { label: 'Fernseher',   len: 1.1,  dep: 0.35, h: 0.7,  value: 300, fragility: 2.5, heavy: false },
  plant:     { label: 'Pflanze',     len: 0.55, dep: 0.55, h: 1.0,  value: 60,  fragility: 1.6, heavy: false },
  lamp:      { label: 'Stehlampe',   len: 0.45, dep: 0.45, h: 1.4,  value: 80,  fragility: 2.0, heavy: false },
  fridge:    { label: 'Kühlschrank', len: 0.85, dep: 0.8,  h: 1.7,  value: 500, fragility: 1.2, heavy: true },
  table:     { label: 'Esstisch',    len: 1.5,  dep: 0.9,  h: 0.75, value: 200, fragility: 0.9, heavy: true },
  chair:     { label: 'Stuhl',       len: 0.55, dep: 0.55, h: 0.9,  value: 70,  fragility: 1.0, heavy: false },
  dishes:    { label: 'Geschirr ⚠',  len: 0.7,  dep: 0.6,  h: 0.5,  value: 160, fragility: 3.0, heavy: false },
  box:       { label: 'Umzugskiste', len: 0.7,  dep: 0.6,  h: 0.55, value: 50,  fragility: 0.6, heavy: false },
  bed:       { label: 'Bett',        len: 2.1,  dep: 1.5,  h: 0.6,  value: 450, fragility: 0.8, heavy: true },
  wardrobe:  { label: 'Kleiderschrank', len: 1.5, dep: 0.65, h: 2.0, value: 350, fragility: 1.0, heavy: true },
  bookshelf: { label: 'Bücherregal', len: 1.4,  dep: 0.45, h: 1.8,  value: 250, fragility: 1.0, heavy: true },
  aquarium:  { label: 'Aquarium ⚠',  len: 1.2,  dep: 0.5,  h: 0.9,  value: 600, fragility: 3.0, heavy: true },
  piano:     { label: 'Klavier',     len: 1.7,  dep: 0.75, h: 1.3,  value: 900, fragility: 1.4, heavy: true },
  guitar:    { label: 'Gitarre',     len: 1.0,  dep: 0.38, h: 0.3,  value: 220, fragility: 2.2, heavy: false },
};

// Startaufstellung (a in Radiant)
const H = Math.PI / 2;
export const ITEMS = [
  // Wohnzimmer
  { type: 'sofa', x: -2.6, z: -8.2, a: 0 },
  { type: 'tv', x: -2.6, z: -3.0, a: 0 },
  { type: 'armchair', x: -5.1, z: -5.6, a: H },
  { type: 'plant', x: 0.25, z: -8.25, a: 0 },
  { type: 'lamp', x: -5.3, z: -8.3, a: 0 },
  // Küche
  { type: 'fridge', x: -11.3, z: -8.3, a: 0 },
  { type: 'table', x: -9.0, z: -5.4, a: 0 },
  { type: 'chair', x: -10.6, z: -5.4, a: 0 },
  { type: 'dishes', x: -7.0, z: -8.3, a: 0 },
  // Schlafzimmer
  { type: 'bed', x: -2.4, z: 7.6, a: 0 },
  { type: 'wardrobe', x: -5.35, z: 4.6, a: H },
  { type: 'lamp', x: 0.2, z: 8.3, a: 0 },
  { type: 'box', x: -0.1, z: 3.0, a: 0.3 },
  // Büro
  { type: 'bookshelf', x: -9.0, z: 8.45, a: 0 },
  { type: 'aquarium', x: -11.4, z: 5.0, a: H },
  { type: 'chair', x: -8.0, z: 5.2, a: 0.5 },
  { type: 'box', x: -7.0, z: 7.6, a: -0.2 },
  // Musikzimmer
  { type: 'piano', x: -16.25, z: -4.5, a: H },
  { type: 'guitar', x: -14.0, z: -7.9, a: 0.4 },
  { type: 'plant', x: -16.3, z: 8.3, a: 0 },
  { type: 'box', x: -14.2, z: 6.0, a: 0.1 },
];

export const PLAYERS = [
  { name: 'Grüni', color: 0x5fbf3a, screen: 0x7dff7a, x: 3.0, z: -1.6,
    keys: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], grab: ['Space', 'KeyE'] },
    hint: 'WASD + Leertaste' },
  { name: 'Orangi', color: 0xf26b2a, screen: 0x6fe8ff, x: 3.0, z: 1.6,
    keys: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
      grab: ['Enter', 'NumpadEnter', 'ShiftRight', 'Numpad0', 'ControlRight'] },
    hint: 'Pfeiltasten + Enter' },
];

export const ROOMBA_START = { x: -8.5, z: 0.2 };
