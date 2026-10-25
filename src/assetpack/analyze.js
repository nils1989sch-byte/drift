// Automatische Erkennung für importierte 2D-Sets: Raster, Boden-Tiles, Objekte (freistehende Sprites) und
// Figuren-Sheets (Laufanimationen in Reihen). Ergebnis ist ein Vorschlag, den der Nutzer im Importer korrigiert.
// Arbeitet auf Img-Puffern aus img.js ({ w, h, d: Uint32Array }).
import { A, R, G, B, crop, hashImg, rgb2hsl } from './img.js';

const ALPHA = 24;
export const GRIDS = [8, 16, 24, 32, 48, 64];
export const LIKES = ['grass', 'grass_dark', 'grass_light', 'grass_flowers', 'grass_tall', 'dirt', 'path', 'sand', 'clearing', 'soil',
  'water', 'shallow', 'stone_floor', 'wood_floor', 'dungeon_floor', 'dungeon_wall', 'bridge', 'stairs', 'pit'];

const baseName = (path) => path.split('/').pop().replace(/\.[a-z0-9]+$/i, '');
export const slug = (s) => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'teil';

const CHAR_RE = /(player|char|hero|npc|figur|person|villager|human|enemy|enemies|skeleton|slime|goblin|orc|knight|warrior|mage|walk|_anim|sprite_?sheet|animals?|cow|chicken|sheep|pig)/i;
const IGNORE_RE = /(preview|cover|thumbnail|screenshot|mockup|example|logo|font|ui[_ -]|icons?\b|button|portrait)/i;

/** grobe Art eines Bildes: 'tiles' (Tiles + Objekte), 'character' (Animations-Sheet) oder 'ignore' */
export function guessKind(path, img) {
  if (IGNORE_RE.test(path)) return 'ignore';
  if (CHAR_RE.test(path)) return 'character';
  if (img.w > 2048 || img.h > 2048) return 'ignore';
  return 'tiles';
}

/** Rastergröße: Dateiname („16x16“), sonst die kleinste Größe, deren Zellen gut gefüllt und nicht durchschnitten sind */
export function guessGrid(path, img) {
  const m = /(\d{1,2})\s*[x×]\s*(\d{1,2})/.exec(path);
  if (m && GRIDS.includes(+m[1])) return +m[1];
  for (const g of [16, 32, 48, 24]) if (img.w % g === 0 && img.h % g === 0) return g;
  return 16;
}

const opaqueAt = (img, x, y) => A(img.d[y * img.w + x]) > ALPHA;
function cellFill(img, x0, y0, g) {
  let n = 0;
  for (let y = y0; y < Math.min(img.h, y0 + g); y++) for (let x = x0; x < Math.min(img.w, x0 + g); x++) if (opaqueAt(img, x, y)) n++;
  return n / (g * g);
}

/** Zusammenhängende undurchsichtige Bereiche (8er-Nachbarschaft), optional mit Ausschlussmaske. → [{x,y,w,h,n}] */
export function components(img, skip = null, minPx = 6) {
  const W = img.w, H = img.h, lab = new Int32Array(W * H), out = [];
  const st = [];
  let cur = 0;
  for (let i = 0; i < W * H; i++) {
    if (lab[i] || A(img.d[i]) <= ALPHA || (skip && skip[i])) continue;
    cur++;
    let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
    st.push(i); lab[i] = cur;
    while (st.length) {
      const k = st.pop(), x = k % W, y = (k / W) | 0;
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (lab[j] || A(img.d[j]) <= ALPHA || (skip && skip[j])) continue;
        lab[j] = cur; st.push(j);
      }
    }
    if (n >= minPx) out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n });
  }
  return out;
}
/** Rechtecke, die sich überlappen oder höchstens `gap` Pixel auseinander liegen, verschmelzen (Schatten, Blätter …) */
export function mergeBoxes(list, gap = 1) {
  const bs = list.map((b) => ({ ...b }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      if (a.x > b.x + b.w + gap || b.x > a.x + a.w + gap || a.y > b.y + b.h + gap || b.y > a.y + a.h + gap) continue;
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      bs[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y, n: a.n + b.n };
      bs.splice(j, 1); changed = true; j--;
    }
  }
  return bs;
}

/** Bodenart eines Tiles schätzen: Dateiname zuerst, dann Farbe */
export function guessLike(img, path = '') {
  const p = path.toLowerCase();
  const kw = [[/tall|high_?grass|hohes/, 'grass_tall'], [/flower|blume/, 'grass_flowers'], [/farm|soil|acker|tilled/, 'soil'], [/shallow|flach/, 'shallow'],
    [/water|wasser|sea|ocean|lake|river/, 'water'], [/path|road|weg/, 'path'], [/sand|beach|strand/, 'sand'], [/dirt|erde|mud/, 'dirt'],
    [/bridge|brücke|bruecke/, 'bridge'], [/stair|treppe/, 'stairs'], [/wood|plank|holz/, 'wood_floor'], [/wall|wand/, 'dungeon_wall'],
    [/stone|cobble|brick|stein|floor|tile_?floor/, 'stone_floor'], [/grass|gras/, 'grass']];
  let byName = null;
  for (const [re, like] of kw) if (re.test(p)) { byName = like; break; }
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < img.d.length; i++) { const v = img.d[i]; if (A(v) <= ALPHA) continue; r += R(v); g += G(v); b += B(v); n++; }
  if (!n) return byName || 'grass';
  if (byName) return byName;
  const [H, S, L] = rgb2hsl(r / n, g / n, b / n);
  if (S > 0.25 && H >= 175 && H <= 250) return L > 0.55 ? 'shallow' : 'water';
  if (S > 0.2 && H >= 65 && H < 175) return L < 0.3 ? 'grass_dark' : L > 0.55 ? 'grass_light' : 'grass';
  if (S < 0.14) return L < 0.25 ? 'dungeon_wall' : 'stone_floor';
  if (H >= 35 && H < 65 && L > 0.6) return 'sand';
  if (H < 45) return L < 0.35 ? 'dirt' : 'path';
  return 'dirt';
}

/** Tile-/Objekt-Sheet zerlegen. Volle Zellen → Tiles (Duplikate entfernt), Rest → Objekte (zusammenhängende Sprites). */
export function analyzeSheet(img, grid, path) {
  const base = slug(baseName(path));
  const cols = Math.floor(img.w / grid), rows = Math.floor(img.h / grid);
  const skip = new Uint8Array(img.w * img.h);
  const tiles = [], objects = [], seen = new Set();
  const single = cols * rows === 1;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const x = cx * grid, y = cy * grid;
    if (cellFill(img, x, y, grid) < 0.985) continue;
    for (let yy = y; yy < y + grid; yy++) skip.fill(1, yy * img.w + x, yy * img.w + x + grid);
    const c = crop(img, x, y, grid, grid), h = hashImg(c);
    if (seen.has(h)) continue;
    seen.add(h);
    tiles.push({ name: single ? base : `${base}_${tiles.length + 1}`, rect: [x, y, grid, grid], like: guessLike(c, path) });
  }
  // Objekte: zusammenhängende Pixel außerhalb der vollen Tiles
  const comps = mergeBoxes(components(img, skip, 6), 1).filter((b) => b.n >= 12 && b.w >= 3 && b.h >= 3);
  comps.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const b of comps) {
    const big = b.w >= grid * 1.5 || b.h >= grid * 1.5;
    objects.push({ name: comps.length === 1 ? base : `${base}_${objects.length + 1}`, rect: [b.x, b.y, b.w, b.h], solid: big || b.h >= grid * 0.75 });
  }
  return { tiles, objects };
}

/** Figuren-Sheet: Rahmengröße, Reihen → Aktion/Richtung, Anker */
export function analyzeCharacter(img, path, frameHint) {
  const comps = mergeBoxes(components(img, null, 4), 0);
  const fits = (s) => {
    if (img.w % s || img.h % s) return false;
    let inside = 0;
    for (const b of comps) if (Math.floor(b.x / s) === Math.floor((b.x + b.w - 1) / s) && Math.floor(b.y / s) === Math.floor((b.y + b.h - 1) / s)) inside++;
    return comps.length && inside / comps.length >= 0.9;
  };
  let fw = frameHint || [16, 24, 32, 48, 64, 96].find((s) => fits(s) && img.w / s <= 16) || guessGrid(path, img);
  let fh = fw;
  // nicht-quadratische Rahmen (z. B. 16×24 oder 32×48): nur wenn quadratisch nicht passt
  if (!frameHint && !fits(fw)) for (const [w, h] of [[16, 24], [24, 32], [32, 48], [48, 64]]) if (img.w % w === 0 && img.h % h === 0) { fw = w; fh = h; break; }
  const cols = Math.max(1, Math.floor(img.w / fw)), rows = Math.max(1, Math.floor(img.h / fh));
  const count = [];
  let bottom = 0;
  for (let r = 0; r < rows; r++) {
    let n = 0;
    for (let c = 0; c < cols; c++) {
      let any = false;
      for (let y = r * fh; y < (r + 1) * fh; y++) for (let x = c * fw; x < (c + 1) * fw; x++) if (opaqueAt(img, x, y)) { any = true; bottom = Math.max(bottom, y - r * fh); }
      if (any) n = c + 1; else if (n) break;
    }
    count.push(n);
  }
  const row = (i) => (i < rows && count[i] ? [i, count[i]] : null);
  let anim;
  if (rows >= 6) anim = { idle: { down: row(0), right: row(1), up: row(2), left: 'mirror' }, walk: { down: row(3), right: row(4), up: row(5), left: 'mirror' } };
  else if (rows >= 4) { const d = { down: row(0), left: row(1), right: row(2), up: row(3) }; anim = { walk: d, idle: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v && [v[0], 1]])) }; }
  else if (rows === 3) anim = { walk: { down: row(0), right: row(1), up: row(2), left: 'mirror' } };
  else anim = { walk: { down: row(0), up: row(0), left: row(0), right: row(0) } };
  return { name: slug(baseName(path)), frame: [fw, fh], rows, cols, count, anim, anchor: [fw / 2, Math.min(fh, bottom + 1)] };
}

/** Kompletter Vorschlag für ein Paket: images = [{ path, img }] → Paket-Spezifikation fürs Projekt */
export function autoSpec({ id, name, license }, images) {
  const spec = { id, name, license: license || { name: 'nur lokal (privat)' }, source: 'local', enabled: true, grid: 16, files: {}, tiles: {}, sprites: {}, overrides: {} };
  const grids = {};
  for (const { path, img } of images) {
    const kind = guessKind(path, img);
    const grid = guessGrid(path, img);
    spec.files[path] = { kind, grid, w: img.w, h: img.h };
    if (kind !== 'ignore') grids[grid] = (grids[grid] || 0) + 1;
  }
  spec.grid = +Object.entries(grids).sort((a, b) => b[1] - a[1])[0]?.[0] || 16;
  for (const { path, img } of images) applyFile(spec, path, img);
  return spec;
}

const uniq = (obj, name) => { let k = name, i = 2; while (obj[k]) k = `${name}_${i++}`; return k; };

/** Einträge einer Datei (neu) erzeugen – nach Änderung von Art/Raster im Importer */
export function applyFile(spec, path, img) {
  for (const coll of ['tiles', 'sprites']) for (const [k, v] of Object.entries(spec[coll])) if (v.file === path) delete spec[coll][k];
  const f = spec.files[path];
  if (!f || f.kind === 'ignore') return;
  if (f.kind === 'character') {
    const c = analyzeCharacter(img, path, f.frame);
    f.frame = c.frame;
    spec.sprites[uniq(spec.sprites, c.name)] = { kind: 'character', file: path, frame: c.frame, anim: c.anim, anchor: c.anchor, scale: 16 / spec.grid };
    return;
  }
  const { tiles, objects } = analyzeSheet(img, f.grid, path);
  for (const t of tiles) spec.tiles[uniq(spec.tiles, t.name)] = { file: path, rect: t.rect, like: t.like };
  for (const o of objects) spec.sprites[uniq(spec.sprites, o.name)] = { kind: 'object', file: path, rect: o.rect, solid: o.solid, scale: 16 / f.grid };
}

/** Lizenz-Hinweis aus beiliegenden Texten (nur Anzeige / Vorbelegung) */
export function guessLicense(texts) {
  const all = texts.map((t) => t.text).join('\n');
  if (!all.trim()) return { name: 'nur lokal (privat)' };
  if (/CC0|public domain/i.test(all)) return { name: 'CC0', text: all.slice(0, 2000) };
  if (/CC[- ]BY[- ]SA/i.test(all)) return { name: 'CC-BY-SA', text: all.slice(0, 2000) };
  if (/CC[- ]BY/i.test(all)) return { name: 'CC-BY', text: all.slice(0, 2000) };
  if (/non[- ]?commercial|redistribut/i.test(all)) return { name: 'nicht-kommerziell, keine Weitergabe', text: all.slice(0, 2000) };
  return { name: 'siehe Lizenztext', text: all.slice(0, 2000) };
}
