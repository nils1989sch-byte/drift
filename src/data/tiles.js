// Tile definitions – shared contract between art (draws them) and game (places them).
// solid: blocks movement. water: swim/blocked. cut: sword can cut (spawns 'bush_cut' fx). stairs: allows height change.
export const TILE_DEFS = {
  grass:        { solid: false },
  grass_dark:   { solid: false },
  grass_flowers:{ solid: false },
  grass_tall:   { solid: false, tall: true, cut: true },
  dirt:         { solid: false },
  path:         { solid: false },
  sand:         { solid: false },
  water:        { solid: true, water: true },
  water_edge_n: { solid: true, water: true },
  shallow:      { solid: false, shallow: true },
  stairs:       { solid: false, stairs: true },
  bridge:       { solid: false },
  stone_floor:  { solid: false },
  dungeon_floor:{ solid: false },
  dungeon_wall: { solid: true },
  pit:          { solid: false, pit: true },
  wood_floor:   { solid: false },
  void:         { solid: true },
};

export const FACE_IDS = ['rock', 'dirt', 'brick'];

export const LEGEND_DEFAULT = {
  '.': 'grass', ',': 'grass_dark', '*': 'grass_flowers', '"': 'grass_tall',
  ':': 'dirt', '=': 'path', 's': 'sand', '~': 'water', '-': 'shallow',
  'H': 'stairs', '#': 'bridge', 'o': 'stone_floor', '_': 'dungeon_floor',
  'W': 'dungeon_wall', 'O': 'pit', 'w': 'wood_floor', ' ': 'void',
};
