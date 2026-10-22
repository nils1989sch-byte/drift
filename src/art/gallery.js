// Art gallery: renders every asset from buildAssets() at several scales (animated) + a mini diorama scene
// rendered through the real engine renderer, plus automatic style-guide checks (palette, alpha, color counts).
import { buildAssets, palette } from './index.js';
import { parseMap } from '../engine/world.js';
import { createRenderer } from '../engine/renderer.js';

const q = new URLSearchParams(location.search);
const only = (q.get('only') || '').split(',').filter(Boolean);
const scales = (q.get('scales') || '1,3,4').split(',').map(Number);
const bg = q.get('bg') || 'grass';
const animOn = q.get('anim') !== '0';
const t0 = performance.now();
const A = buildAssets();
const ms = Math.round(performance.now() - t0);
const root = document.getElementById('root');
const anims = [];
const BG = { grass: palette.grass_md, dark: palette.stone_dk, none: null };

// ---------- automatic checks ----------
const pal = new Set(Object.values(palette).map((h) => h.toLowerCase()));
const issues = [];
function check(name, c, maxColors) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const cols = new Set();
  let semi = 0, off = new Set();
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 0) continue;
    if (a !== 255) semi++;
    const h = '#' + ((1 << 24) | (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).slice(1);
    cols.add(h);
    if (!pal.has(h)) off.add(h);
  }
  if (semi) issues.push(`${name}: ${semi} semi-transparent px`);
  if (off.size) issues.push(`${name}: off-palette ${[...off].slice(0, 4).join(' ')}`);
  if (cols.size > maxColors) issues.push(`${name}: ${cols.size} colors (max ${maxColors})`);
  return cols.size;
}

function card(name, list, meta, grid, maxColors) {
  if (only.length && !only.some((o) => name.startsWith(o))) return;
  const arr = Array.isArray(list) ? list : [list];
  const el = document.createElement('div'); el.className = 'card';
  let ncol = 0;
  arr.forEach((c, i) => { ncol = Math.max(ncol, check(`${name}[${i}]`, c, maxColors)); });
  const info = [`${arr.length}f`, `${arr[0].width}×${arr[0].height}`, `${ncol}c`];
  if (arr[0].ax !== undefined) info.push(`anchor ${arr[0].ax},${arr[0].ay}`);
  if (arr.mode) info.push(arr.mode);
  if (arr.fps) info.push(`${arr.fps}fps`);
  if (meta) info.push(meta);
  el.innerHTML = `<div class="n">${name}</div><div class="m">${info.join(' · ')}</div>`;
  const row = document.createElement('div'); row.className = 'row'; el.appendChild(row);
  for (const s of scales) {
    const cv = document.createElement('canvas');
    const w = Math.max(...arr.map((c) => c.width)), h = Math.max(...arr.map((c) => c.height));
    cv.width = w * s; cv.height = h * s;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const draw = (i) => {
      const c = arr[i % arr.length];
      if (BG[bg]) { g.fillStyle = BG[bg]; g.fillRect(0, 0, cv.width, cv.height); } else g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(c, 0, 0, c.width * s, c.height * s);
      if (c.ax !== undefined && s >= 3) { g.fillStyle = '#f0f'; g.fillRect(c.ax * s, c.ay * s + s - 1, s, 1); }
    };
    draw(0);
    if (arr.length > 1) {
      if (arr.mode === 'variant' || !animOn) {
        // show variants side by side instead of animating
        cv.width = (w * arr.length + arr.length - 1) * s; g.imageSmoothingEnabled = false;
        arr.forEach((c, i) => { if (BG[bg]) { g.fillStyle = BG[bg]; g.fillRect(i * (w + 1) * s, 0, w * s, h * s); } g.drawImage(c, i * (w + 1) * s, 0, c.width * s, c.height * s); });
      } else anims.push({ draw, fps: arr.fps || 6 });
    }
    row.appendChild(cv);
  }
  grid.appendChild(el);
}
function section(title, obj, maxColors, filter = () => true) {
  const keys = Object.keys(obj).filter(filter);
  if (!keys.length) return;
  const h = document.createElement('h2'); h.textContent = `${title} (${keys.length})`;
  const grid = document.createElement('div'); grid.className = 'grid';
  for (const k of keys) card(k, obj[k], null, grid, maxColors);
  if (!grid.children.length) return;
  root.appendChild(h); root.appendChild(grid);
}

// ---------- mini diorama scene via the real renderer ----------
function scene() {
  if (q.get('scene') === '0' || only.length) return;
  const rows = [
    '..,,,,,,....*...""..',
    '.,,,,,,,..*......"".',
    '..,,,,.....=====....',
    '.....::....=...=.ooo',
    '..*..::.====...=.ooo',
    '.........=.....=.ooo',
    'sssss....=..*..=....',
    '~~~~ss...=.....=....',
    '~~~~~s...#.....=....',
    '~--~~s...=...======.',
    '~~~~~s...=..........',
    'ssssss..===.....*...',
  ];
  const heights = [
    '22222200001111111111',
    '22222200001111111111',
    '222222000011111H1111',
    '00000000000000000111',
    '00000000000000000111',
    '00000000000000000111',
    '00000000000000000000',
    '00000000000000000000',
    '00000000000000000000',
    '00000000000000000000',
    '00000000000000000000',
    '00000000000000000000',
  ].map((r) => r);
  heights[2] = '222222000011111H1111';
  const world = parseMap({ id: 'gallery', rows, heights, face: 'rock', plinth: 'earth' });
  const S = 3, W = world.pxW * S + 120, H = (world.pxH + 60) * S;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const r = createRenderer(cv, A); r.tiltShift = false; r.vignette = false;
  const cam = { x: world.pxW / 2, y: world.pxH / 2 + 4, ox: 0, oy: 0, scale: S, viewW: W, viewH: H };
  const spr = (key, x, y, z = 0, shadow = 0, fps = 6) => ({ x, y, z, shadow, draw(ctx, R) { const a = A.sprites[key]; if (!a) return; R.sprite(a[Math.floor(R.time * fps) % a.length], x, y, z); } });
  const ents = [
    spr('tree', 40, 22, 2, 0), spr('tree_small', 76, 30, 2, 0), spr('bush', 120, 60, 0, 6), spr('rock', 140, 60, 0, 6),
    spr('hero_walk_down', 150, 100, 0, 6, 11), spr('octorok_walk_left', 230, 120, 0, 6, 6), spr('slime_idle', 260, 150, 0, 5),
    spr('pot', 290, 56, 1, 5), spr('chest_closed', 300, 30, 1, 5), spr('house', 230, 48, 1, 0), spr('sign', 196, 100, 0, 4),
    spr('soldier_walk_down', 110, 170, 0, 6, 8), spr('flower', 60, 140, 0, 0, 3), spr('rupee_green', 170, 140, 0, 3, 8),
    spr('heart_pickup', 186, 140, 0, 3), spr('fence_h', 16, 112, 0, 0), spr('fence_h', 32, 112, 0, 0), spr('lilypad', 24, 152, 0, 0),
    spr('npc_elder_idle_down', 130, 120, 0, 6, 2), spr('torch', 280, 90, 1, 0, 8), spr('stump', 96, 100, 0, 0),
  ];
  const h = document.createElement('h2'); h.textContent = 'Diorama-Szene (echter Renderer, 3×)';
  const wrap = document.createElement('div'); wrap.id = 'scene'; wrap.appendChild(cv);
  root.appendChild(h); root.appendChild(wrap);
  let last = performance.now();
  const loop = (now) => { r.render(world, ents, cam, (now - last) / 1000); last = now; if (animOn) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

scene();
section('Tiles', A.tiles, 8);
section('Edges', A.edges, 8);
section('Faces', A.faces, 8);
const groups = [
  ['Held', (k) => k.startsWith('hero_')],
  ['Gegner', (k) => /^(octorok|soldier|slime|bat|boss)/.test(k)],
  ['NPC', (k) => k.startsWith('npc_')],
  ['FX', (k) => k.startsWith('fx_')],
  ['Deko-Billboards', (k) => k.startsWith('deco_')],
  ['Haus-Texturen', (k) => k.startsWith('tex_')],
  ['Objekte & Pickups', (k) => !/^(hero_|octorok|soldier|slime|bat|boss|npc_|fx_|deco_|tex_)/.test(k)],
];
for (const [t, f] of groups) section(t, A.sprites, 15, f);
section('Icons', A.icons, 15);

document.getElementById('info').innerHTML = `buildAssets ${ms} ms · tiles ${Object.keys(A.tiles).length} · sprites ${Object.keys(A.sprites).length} · icons ${Object.keys(A.icons).length} · ` +
  (issues.length ? `<span class="bad">${issues.length} Style-Issues (console)</span>` : 'Style-Checks OK');
if (issues.length) console.warn('STYLE ISSUES\n' + issues.join('\n'));
window.__gallery = { assets: A, issues, ms };

let start = performance.now();
function tick(now) {
  const t = (now - start) / 1000;
  for (const a of anims) a.draw(Math.floor(t * a.fps));
  requestAnimationFrame(tick);
}
if (animOn) requestAnimationFrame(tick);
