// Placeholder sprites used only when src/art does not (yet) deliver a key. Simple, readable shapes.
const cache = new Map();

function C(w, h, draw, ax, ay) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  c.ax = ax ?? (w >> 1); c.ay = ay ?? h - 1;
  c.fallback = true;
  return c;
}
const ell = (g, cx, cy, rx, ry, col) => {
  g.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.01))));
    g.fillRect(cx - w, cy + y, w * 2, 1);
  }
};

function person(body, head = '#f0c8a0', hat) {
  return C(16, 24, (g) => {
    ell(g, 8, 18, 5, 5, '#201828'); ell(g, 8, 18, 4, 4, body);
    ell(g, 8, 8, 6, 6, '#201828'); ell(g, 8, 8, 5, 5, head);
    if (hat) { g.fillStyle = hat; g.fillRect(3, 1, 10, 4); }
    g.fillStyle = '#201828'; g.fillRect(6, 8, 1, 2); g.fillRect(9, 8, 1, 2);
  });
}

const MAKERS = {
  hero: () => person('#40a040', '#f0c8a0', '#309030'),
  soldier: () => person('#3858c0', '#c0c8d8', '#2840a0'),
  npc_elder: () => person('#806040', '#f0d8c0', '#e8e8e8'),
  npc_girl: () => person('#d06080', '#f0c8a0', '#e0a040'),
  npc_merchant: () => person('#a07030', '#e0b890', '#405080'),
  octorok: () => C(16, 16, (g) => { ell(g, 8, 9, 7, 6, '#301010'); ell(g, 8, 9, 6, 5, '#d04040'); g.fillStyle = '#fff'; g.fillRect(5, 7, 2, 2); g.fillRect(9, 7, 2, 2); }),
  slime: () => C(16, 12, (g) => { ell(g, 8, 7, 7, 4, '#301838'); ell(g, 8, 7, 6, 3, '#9050c0'); g.fillStyle = '#fff'; g.fillRect(5, 5, 2, 1); }),
  bat: () => C(16, 10, (g) => { g.fillStyle = '#301838'; g.fillRect(0, 2, 16, 4); g.fillRect(5, 1, 6, 7); g.fillStyle = '#ffd040'; g.fillRect(6, 3, 1, 1); g.fillRect(9, 3, 1, 1); }),
  boss_golem: () => C(40, 40, (g) => { ell(g, 20, 24, 18, 15, '#282030'); ell(g, 20, 24, 17, 14, '#8a8078'); ell(g, 20, 10, 9, 8, '#a09888'); g.fillStyle = '#ff6040'; g.fillRect(16, 9, 3, 2); g.fillRect(22, 9, 3, 2); }),
  octorok_rock: () => C(8, 8, (g) => { ell(g, 4, 4, 3, 3, '#403830'); ell(g, 4, 4, 2, 2, '#a09080'); }, 4, 7),
  tree: () => C(32, 40, (g) => { g.fillStyle = '#5a3a20'; g.fillRect(13, 26, 6, 14); ell(g, 16, 16, 15, 14, '#183818'); ell(g, 16, 15, 14, 13, '#3a8a3a'); ell(g, 12, 11, 6, 5, '#58a848'); }),
  tree_small: () => C(16, 24, (g) => { g.fillStyle = '#5a3a20'; g.fillRect(7, 16, 3, 8); ell(g, 8, 9, 7, 8, '#183818'); ell(g, 8, 9, 6, 7, '#3a8a3a'); }),
  bush: () => C(16, 16, (g) => { ell(g, 8, 9, 7, 6, '#183818'); ell(g, 8, 9, 6, 5, '#48983a'); ell(g, 6, 7, 2, 2, '#70c050'); }),
  bush_cut: () => C(16, 8, (g) => { ell(g, 8, 4, 5, 2, '#305a28'); }),
  rock: () => C(16, 14, (g) => { ell(g, 8, 8, 7, 5, '#282030'); ell(g, 8, 8, 6, 4, '#9a9088'); g.fillStyle = '#c8c0b0'; g.fillRect(4, 5, 4, 1); }),
  rock_big: () => C(32, 24, (g) => { ell(g, 16, 13, 15, 10, '#282030'); ell(g, 16, 13, 14, 9, '#8a8078'); }),
  pot: () => C(12, 14, (g) => { ell(g, 6, 8, 5, 5, '#3a2018'); ell(g, 6, 8, 4, 4, '#c07848'); g.fillStyle = '#3a2018'; g.fillRect(3, 2, 6, 2); }),
  sign: () => C(14, 16, (g) => { g.fillStyle = '#5a3a20'; g.fillRect(6, 9, 2, 7); g.fillStyle = '#3a2418'; g.fillRect(0, 1, 14, 9); g.fillStyle = '#c89858'; g.fillRect(1, 2, 12, 7); }),
  chest_closed: () => C(16, 14, (g) => { g.fillStyle = '#2a1808'; g.fillRect(0, 1, 16, 13); g.fillStyle = '#a06830'; g.fillRect(1, 2, 14, 11); g.fillStyle = '#e8c040'; g.fillRect(1, 6, 14, 1); g.fillRect(7, 5, 2, 3); }),
  chest_open: () => C(16, 14, (g) => { g.fillStyle = '#2a1808'; g.fillRect(0, 1, 16, 13); g.fillStyle = '#a06830'; g.fillRect(1, 7, 14, 6); g.fillStyle = '#180c04'; g.fillRect(2, 3, 12, 4); }),
  house: () => C(64, 64, (g) => {
    g.fillStyle = '#2a1810'; g.fillRect(4, 26, 56, 38); g.fillStyle = '#e8d8b0'; g.fillRect(5, 27, 54, 36);
    g.fillStyle = '#2a1810'; for (let i = 0; i < 30; i++) g.fillRect(32 - i - 2, i, (i + 2) * 2, 1);
    g.fillStyle = '#b84030'; for (let i = 1; i < 30; i++) g.fillRect(32 - i, i, i * 2, 1);
    g.fillStyle = '#3a2418'; g.fillRect(26, 46, 12, 18); g.fillStyle = '#80c8e8'; g.fillRect(10, 36, 8, 8); g.fillRect(46, 36, 8, 8);
  }),
  fence_h: () => C(16, 14, (g) => { g.fillStyle = '#6a4424'; g.fillRect(1, 2, 3, 12); g.fillRect(12, 2, 3, 12); g.fillStyle = '#a07040'; g.fillRect(0, 4, 16, 2); g.fillRect(0, 9, 16, 2); }),
  fence_v: () => C(6, 18, (g) => { g.fillStyle = '#6a4424'; g.fillRect(1, 0, 4, 18); }),
  flower: () => C(8, 8, (g) => { g.fillStyle = '#307030'; g.fillRect(3, 4, 1, 4); g.fillStyle = '#f8e050'; g.fillRect(2, 1, 3, 3); }),
  statue: () => C(16, 28, (g) => { g.fillStyle = '#383040'; g.fillRect(1, 18, 14, 10); g.fillStyle = '#8a8898'; g.fillRect(3, 2, 10, 17); g.fillRect(2, 19, 12, 8); }),
  torch: () => C(8, 18, (g) => { g.fillStyle = '#504858'; g.fillRect(2, 6, 4, 12); g.fillStyle = '#ff9030'; g.fillRect(1, 0, 6, 6); g.fillStyle = '#fff080'; g.fillRect(3, 2, 2, 3); }),
  door_locked: () => C(16, 32, (g) => { g.fillStyle = '#20140c'; g.fillRect(0, 0, 16, 32); g.fillStyle = '#7a4a22'; g.fillRect(2, 4, 12, 28); g.fillStyle = '#e8c040'; g.fillRect(6, 16, 4, 5); g.fillStyle = '#20140c'; g.fillRect(7, 18, 2, 2); }),
  shutter: () => C(16, 32, (g) => { g.fillStyle = '#202030'; g.fillRect(0, 0, 16, 32); g.fillStyle = '#606878'; for (let x = 2; x < 16; x += 4) g.fillRect(x, 2, 2, 30); }),
  wall_cracked: () => C(16, 32, (g) => { g.fillStyle = '#5a5470'; g.fillRect(0, 0, 16, 32); g.fillStyle = '#2a2638'; g.fillRect(7, 4, 1, 10); g.fillRect(5, 13, 3, 1); g.fillRect(4, 14, 1, 9); g.fillRect(8, 14, 1, 1); g.fillRect(9, 15, 1, 8); g.fillRect(9, 22, 3, 1); }),
  rock_cracked: () => C(16, 16, (g) => { g.fillStyle = 'rgba(30,24,40,0.9)'; g.fillRect(7, 1, 1, 6); g.fillRect(5, 6, 3, 1); g.fillRect(4, 7, 1, 6); g.fillRect(8, 7, 1, 1); g.fillRect(9, 8, 1, 6); g.fillRect(9, 13, 3, 1); g.fillRect(3, 12, 1, 3); }),
  cave_entrance: () => C(16, 16, (g) => { g.fillStyle = '#0c0814'; ell(g, 8, 10, 6, 7, '#0c0814'); g.fillRect(2, 10, 12, 6); }),
  block: () => C(16, 20, (g) => { g.fillStyle = '#282030'; g.fillRect(0, 0, 16, 20); g.fillStyle = '#9090a8'; g.fillRect(1, 1, 14, 12); g.fillStyle = '#686880'; g.fillRect(1, 13, 14, 6); }),
  switch_up: () => C(16, 16, (g) => { g.fillStyle = '#282030'; g.fillRect(2, 4, 12, 10); g.fillStyle = '#d0a040'; g.fillRect(3, 4, 10, 7); }),
  switch_down: () => C(16, 16, (g) => { g.fillStyle = '#282030'; g.fillRect(2, 6, 12, 8); g.fillStyle = '#806020'; g.fillRect(3, 7, 10, 5); }),
  heart_container: () => C(14, 14, (g) => { g.fillStyle = '#601020'; g.fillRect(1, 2, 5, 5); g.fillRect(8, 2, 5, 5); g.fillRect(2, 6, 10, 4); g.fillRect(4, 10, 6, 2); g.fillStyle = '#f04060'; g.fillRect(2, 3, 3, 3); g.fillRect(9, 3, 3, 3); g.fillRect(3, 6, 8, 3); g.fillRect(5, 9, 4, 2); }),
  heart_pickup: () => C(8, 8, (g) => { g.fillStyle = '#601020'; g.fillRect(0, 1, 3, 3); g.fillRect(5, 1, 3, 3); g.fillRect(1, 3, 6, 3); g.fillRect(3, 6, 2, 1); g.fillStyle = '#f04060'; g.fillRect(1, 2, 2, 2); g.fillRect(5, 2, 2, 2); g.fillRect(2, 4, 4, 2); }),
  rupee_green: () => rupee('#30c050'), rupee_blue: () => rupee('#4080f0'), rupee_red: () => rupee('#f04040'),
  key_small: () => C(8, 14, (g) => { g.fillStyle = '#e8c040'; g.fillRect(2, 0, 4, 4); g.fillRect(3, 4, 2, 10); g.fillRect(5, 10, 2, 1); g.fillRect(5, 12, 2, 1); g.fillStyle = '#000'; g.fillRect(3, 1, 2, 2); }),
  bomb: () => C(12, 14, (g) => { ell(g, 6, 9, 5, 5, '#101020'); ell(g, 6, 9, 4, 4, '#3040a0'); g.fillStyle = '#c0a060'; g.fillRect(6, 1, 1, 4); g.fillStyle = '#ff8020'; g.fillRect(6, 0, 2, 1); }),
  crystal: () => C(12, 18, (g) => { g.fillStyle = '#103050'; for (let i = 0; i < 9; i++) g.fillRect(6 - Math.min(i, 8 - i) * 0.7 - 1, i * 2, (Math.min(i, 8 - i) * 0.7 + 1) * 2, 2); g.fillStyle = '#80f0ff'; for (let i = 1; i < 8; i++) g.fillRect(6 - Math.min(i, 8 - i) * 0.6, i * 2, Math.min(i, 8 - i) * 1.2, 2); }),
  portal: () => C(24, 12, (g) => { ell(g, 12, 6, 11, 5, '#2050a0'); ell(g, 12, 6, 8, 3, '#80e0ff'); }),
  stump: () => C(14, 10, (g) => { ell(g, 7, 5, 6, 4, '#3a2418'); ell(g, 7, 4, 5, 3, '#a07040'); }),
  mushroom: () => C(10, 10, (g) => { g.fillStyle = '#e8e0d0'; g.fillRect(4, 5, 2, 5); ell(g, 5, 4, 4, 3, '#d03030'); }),
  lilypad: () => C(14, 8, (g) => { ell(g, 7, 4, 6, 3, '#287028'); g.fillStyle = '#285828'; g.fillRect(7, 2, 4, 2); }),
  grass_tall: () => C(16, 8, (g) => { g.fillStyle = '#2a6a2a'; for (let x = 0; x < 16; x += 3) g.fillRect(x, 2 + (x % 2), 2, 6); }),
};
function rupee(col) {
  return C(8, 14, (g) => { g.fillStyle = '#101018'; g.fillRect(1, 1, 6, 12); g.fillStyle = col; g.fillRect(2, 2, 4, 10); g.fillStyle = '#fff'; g.fillRect(3, 3, 1, 3); });
}

export function fallbackSprite(key = '') {
  if (cache.has(key)) return cache.get(key);
  let c = null;
  try {
    let mk = MAKERS[key];
    if (!mk) {
      // strip action/dir suffixes: hero_walk_down → hero, npc_elder_idle_down → npc_elder
      const parts = key.split('_');
      for (let n = parts.length - 1; n > 0 && !mk; n--) mk = MAKERS[parts.slice(0, n).join('_')];
    }
    c = mk ? mk() : C(12, 12, (g) => { g.fillStyle = '#f0f'; g.fillRect(0, 0, 12, 12); });
  } catch { c = null; }
  cache.set(key, c);
  return c;
}
