// Map registry: every map is built fresh on entry (enemies/objects respawn, flags persist).
import overworld from './overworld.js';
import { houseElder, cave } from './interiors.js';
import { dungeon1, dungeon2, dungeon3, dungeon4 } from './dungeon.js';

export const MAPS = {
  overworld, house_elder: houseElder, cave,
  dungeon_1: dungeon1, dungeon_2: dungeon2, dungeon_3: dungeon3, dungeon_4: dungeon4,
};
