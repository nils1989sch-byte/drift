// DRIFT master palette (docs/STYLE_GUIDE.md §4.3) – 74 colors, every channel on 8-steps, no #000/#fff.
export const palette = {
  ink: '#181020', shadow: '#302848', night: '#283048',
  grass_ink: '#183828', grass_dk: '#286840', grass_md: '#48a050', grass_lt: '#88c858', grass_hi: '#d0e888',
  dirt_ink: '#402028', dirt_dk: '#784838', dirt_md: '#a87048', dirt_lt: '#d0a068', dirt_hi: '#f0d098', sand: '#e0c888',
  cliff_ink: '#402830', cliff_dk: '#705040', cliff_md: '#a08058', cliff_lt: '#c8a870', cliff_hi: '#e8d098',
  rock_ink: '#282038', rock_dk: '#504860', rock_md: '#807880', rock_lt: '#b0a898', rock_hi: '#e0d8c0',
  water_ink: '#102050', water_dk: '#184888', water_md: '#2878c0', water_lt: '#58b0e0', water_hi: '#a8e0f0', foam: '#e8f8f8',
  wood_ink: '#301820', wood_dk: '#603028', wood_md: '#985038', wood_lt: '#c88048', wood_hi: '#e8b870',
  stone_ink: '#181830', stone_dk: '#303858', stone_md: '#506080', stone_lt: '#8090a8', stone_hi: '#b8c8d0',
  skin_dk: '#b05838', skin_md: '#e89868', skin_lt: '#f8d0a0', hair_dk: '#a85820', hair_md: '#e8a838',
  tunic_ink: '#183010', tunic_dk: '#307818', tunic_md: '#58b828', tunic_lt: '#a8e048',
  metal_dk: '#485070', metal_md: '#8898b8', metal_lt: '#c8d8e8', white: '#f8f8f8',
  gold_dk: '#a86010', gold_md: '#e8b028', gold_lt: '#f8e878',
  heart_dk: '#901828', heart_md: '#e03030', heart_hi: '#f8a088', magic: '#40c860', ui_frame: '#d8c8a0',
  red_dk: '#702030', red_md: '#c84040', red_lt: '#f08060',
  blue_dk: '#283070', blue_md: '#4868c8', blue_lt: '#90b0f0',
  purple_dk: '#502878', purple_md: '#8848b8', purple_lt: '#c890e0',
  fx_yellow: '#f8e058', fx_orange: '#f88830', fx_cyan: '#98f0f0', rupee_green: '#30c858',
};
const P = palette;

// material ramps, dark -> light
export const R = {
  grass: [P.grass_ink, P.grass_dk, P.grass_md, P.grass_lt, P.grass_hi],
  dirt: [P.dirt_ink, P.dirt_dk, P.dirt_md, P.dirt_lt, P.dirt_hi],
  cliff: [P.cliff_ink, P.cliff_dk, P.cliff_md, P.cliff_lt, P.cliff_hi],
  rock: [P.rock_ink, P.rock_dk, P.rock_md, P.rock_lt, P.rock_hi],
  water: [P.water_ink, P.water_dk, P.water_md, P.water_lt, P.water_hi, P.foam],
  wood: [P.wood_ink, P.wood_dk, P.wood_md, P.wood_lt, P.wood_hi],
  stone: [P.stone_ink, P.stone_dk, P.stone_md, P.stone_lt, P.stone_hi],
  skin: [P.skin_dk, P.skin_md, P.skin_lt],
  tunic: [P.tunic_ink, P.tunic_dk, P.tunic_md, P.tunic_lt],
  metal: [P.stone_ink, P.metal_dk, P.metal_md, P.metal_lt, P.white],
  gold: [P.wood_ink, P.gold_dk, P.gold_md, P.gold_lt],
  heart: [P.heart_dk, P.heart_md, P.heart_hi],
  red: [P.ink, P.red_dk, P.red_md, P.red_lt],
  blue: [P.ink, P.blue_dk, P.blue_md, P.blue_lt],
  purple: [P.ink, P.purple_dk, P.purple_md, P.purple_lt],
};
