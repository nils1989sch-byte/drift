// Ebenen-Codec für das DRIFT-Inhaltsformat (docs/CONTENT_FORMAT.md §Ebenen).
// In Dateien: Zeilen-Strings ["..==~", …] oder { "rle": ".{12}=~{3}" } (Zeichen laut legend, Höhen als Ziffern).
// Im Speicher (normalisiert): ground = string[] (Tile-IDs, Länge w*h), height = number[] (Länge w*h).
import { LEGEND_DEFAULT } from '../data/tiles.js';

export const RLE_MIN = 4;                  // Läufe ab 4 gleichen Zeichen werden als x{n} geschrieben
export const RESERVED_CHARS = '{}';        // dürfen nicht in der Legende vorkommen
// Pool für automatisch vergebene Legenden-Zeichen (neue Tiles, Asset-Paket-Tiles).
const CHAR_POOL = 'ABCDEFGIJKLMNPQRSTUVXYZabdeghijklmnpqrtuvxyz!$%&\'()+/<>?@[]^`|0123456789';

/** "abbbbbc" → "ab{5}c" */
export function rleEncode(str) {
  let out = '';
  for (let i = 0; i < str.length;) {
    const ch = str[i];
    let j = i + 1;
    while (j < str.length && str[j] === ch) j++;
    const n = j - i;
    out += n >= RLE_MIN ? `${ch}{${n}}` : ch.repeat(n);
    i = j;
  }
  return out;
}

/** "ab{5}c" → "abbbbbc". Wirft bei kaputter Syntax (deutsche Meldung). */
export function rleDecode(str) {
  if (typeof str !== 'string') throw new Error('RLE-Daten müssen ein String sein');
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '{' || ch === '}') throw new Error(`RLE: unerwartetes „${ch}“ an Position ${i}`);
    if (str[i + 1] === '{') {
      const end = str.indexOf('}', i + 2);
      const n = end < 0 ? NaN : Number(str.slice(i + 2, end));
      if (!Number.isInteger(n) || n < 1) throw new Error(`RLE: ungültige Wiederholung nach „${ch}“ an Position ${i}`);
      out += ch.repeat(n);
      i = end;
    } else out += ch;
  }
  return out;
}

/** Datei-Form (Zeilen-Array | {rle} | {rows}) → flacher String der Länge w*h. */
export function layerToString(layer, w, h, what = 'Ebene') {
  let s;
  if (Array.isArray(layer)) {
    if (layer.length !== h) throw new Error(`${what}: ${layer.length} Zeilen, erwartet ${h}`);
    s = layer.map((row, y) => {
      if (typeof row !== 'string') throw new Error(`${what}: Zeile ${y} ist kein String`);
      if (row.length !== w) throw new Error(`${what}: Zeile ${y} hat ${row.length} Zeichen, erwartet ${w}`);
      return row;
    }).join('');
  } else if (layer && typeof layer === 'object' && typeof layer.rle === 'string') {
    s = rleDecode(layer.rle);
  } else if (layer && typeof layer === 'object' && Array.isArray(layer.rows)) {
    return layerToString(layer.rows, w, h, what);
  } else if (typeof layer === 'string') {
    s = rleDecode(layer);
  } else throw new Error(`${what}: unbekannte Form (erwartet Zeilen-Array oder { "rle": "…" })`);
  if (s.length !== w * h) throw new Error(`${what}: ${s.length} Zellen, erwartet ${w * h} (${w}×${h})`);
  return s;
}

/** Datei-Ebene „ground“ → Tile-ID-Array. */
export function decodeGround(layer, w, h, legend = {}) {
  const lg = { ...LEGEND_DEFAULT, ...legend };
  const s = layerToString(layer, w, h, 'layers.ground');
  const out = new Array(w * h);
  for (let i = 0; i < s.length; i++) {
    const id = lg[s[i]];
    if (!id) throw new Error(`layers.ground: Zeichen „${s[i]}“ (Spalte ${i % w}, Zeile ${Math.floor(i / w)}) fehlt in der Legende`);
    out[i] = id;
  }
  return out;
}

/** Datei-Ebene „height“ → Zahlen-Array (Ziffern 0–9). */
export function decodeHeight(layer, w, h) {
  if (layer == null) return new Array(w * h).fill(0);
  const s = layerToString(layer, w, h, 'layers.height');
  const out = new Array(w * h);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i) - 48;
    if (c < 0 || c > 9) throw new Error(`layers.height: „${s[i]}“ ist keine Höhe 0–9 (Spalte ${i % w}, Zeile ${Math.floor(i / w)})`);
    out[i] = c;
  }
  return out;
}

/** Baut eine kompakte Legende für die verwendeten Tile-IDs (Standard-Zeichen bevorzugt). */
export function buildLegend(ground, prefer = {}) {
  const used = [...new Set(ground)];
  const rev = {};
  for (const [ch, id] of Object.entries({ ...LEGEND_DEFAULT, ...prefer })) if (!(id in rev) && !RESERVED_CHARS.includes(ch)) rev[id] = ch;
  const legend = {}, taken = new Set();
  for (const id of used) if (rev[id] && !taken.has(rev[id])) { legend[rev[id]] = id; taken.add(rev[id]); }
  let k = 0;
  for (const id of used) {
    if (Object.values(legend).includes(id)) continue;
    while (k < CHAR_POOL.length && (taken.has(CHAR_POOL[k]) || CHAR_POOL[k] in LEGEND_DEFAULT)) k++;
    if (k >= CHAR_POOL.length) throw new Error('Zu viele verschiedene Tiles auf einer Karte (max. ~90)');
    legend[CHAR_POOL[k]] = id; taken.add(CHAR_POOL[k]);
  }
  return legend;
}

/** Tile-ID-Array → { legend, ground: {rle}|rows }. */
export function encodeGround(ground, w, h, { legend: prefer, rle = true } = {}) {
  const legend = buildLegend(ground, prefer);
  const rev = Object.fromEntries(Object.entries(legend).map(([c, id]) => [id, c]));
  const s = ground.map((id) => rev[id]).join('');
  return { legend, layer: rle ? { rle: rleEncode(s) } : toRows(s, w, h) };
}

export function encodeHeight(height, w, h, { rle = true } = {}) {
  const s = height.map((v) => String(Math.max(0, Math.min(9, v | 0)))).join('');
  return rle ? { rle: rleEncode(s) } : toRows(s, w, h);
}

export function toRows(s, w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) rows.push(s.slice(y * w, y * w + w));
  return rows;
}

/** Hilfen für den Editor/das Spiel: Tile-Array → Zeilen-Strings mit Legende (für parseMap). */
export function groundToRows(ground, w, h, legend) {
  const rev = Object.fromEntries(Object.entries(legend).map(([c, id]) => [id, c]));
  return toRows(ground.map((id) => rev[id]).join(''), w, h);
}
export function heightToRows(height, w, h) {
  return toRows(height.map((v) => String(v | 0)).join(''), w, h);
}
