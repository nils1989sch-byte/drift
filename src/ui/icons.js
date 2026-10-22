// Fallback UI icons (UI-Agent). Used only when assets.icons[key] is missing (art agent paints the real ones).
// Strings + palette letters, '.' = transparent. Colors from STYLE_GUIDE palette.
import { C } from './theme.js';

const P = {
  K: C.ink, R: C.heart_md, r: C.heart_dk, w: C.heart_hi, e: C.night,
  G: '#30c858', g: '#187838', h: '#b8f8c0',
  Y: C.gold_md, y: C.gold_dk, l: C.gold_lt,
  B: '#4868c8', b: '#283070', c: '#90b0f0', f: '#f88830', F: '#f8e058',
  W: '#f8f8f8', s: '#8898b8', S: '#c8d8e8', m: '#485070',
  n: '#985038', N: '#603028', p: '#e0c888', P: '#c8a868', q: '#a87048',
  v: '#c890e0', V: '#8848b8', u: '#502878', t: '#98f0f0',
};

const DEF = {
  heart_full: ['.KK.KK..', 'KwRKRRK.', 'KRRRRRK.', 'KRRRRrK.', '.KRRrK..', '..KrK...', '...K....', '........'],
  rupee: ['..KKK...', '.KhGGK..', 'KhGGGgK.', 'KhGGGgK.', 'KhGGGgK.', 'KGGGGgK.', '.KgGgK..', '..KKK...'],
  key: ['.KKK....', 'KYlYK...', 'KYKYK...', 'KYYyK...', '.KYK....', '.KYYK...', '.KYK....', '.KYYK...', '..KK....'],
  bomb: ['.....F..', '....Kf..', '..KKKK..', '.KcBBBK.', 'KcBBBBBK', 'KBBBBBbK', 'KBBBBbbK', '.KBbbbK.', '..KKKK..'],
  arrow: ['.....KK.', '....KWWK', '...KsWK.', '..KsK...', '.KnK....', 'KnK.....', 'KK......', '........'],
  sword: [
    '..............KK', '.............KWK', '............KWSK', '...........KWSK.', '..........KWSK..',
    '.........KWSK...', '........KWSK....', '.......KWSK.....', '..KK..KWSK......', '..KYKKWSK.......',
    '...KYYSK........', '....KyYK........', '...KnKKyK.......', '..KnK..KYK......', '.KNK....KK......', '.KK.............'],
  shield: [
    '..KKKKKKKKKKKK..', '.KlYYYYYYYYYYyK.', '.KYBBBBBBBBBBYK.', '.KYBcccBBBBBBYK.', '.KYBcBBBYYBBbYK.',
    '.KYBBBBYllYBbYK.', '.KYBBBBYYYYBbYK.', '.KYBBBBBYYBBbYK.', '..KYBBBBBBBbYK..', '..KYBBBBBBbbYK..',
    '...KYBBBBbbYK...', '...KYyBBbbyYK...', '....KYyBbyYK....', '.....KYyyYK.....', '......KYYK......', '.......KK.......'],
  potion: [
    '......KKKK......', '.....KPpppK.....', '......KqqK......', '......KWWK......', '.....KWRRWK.....',
    '....KWRRRRRK....', '...KWRRRRRRRK...', '..KWwRRRRRRRrK..', '..KWwRRRRRRRrK..', '..KRRRRRRRRRrK..',
    '..KRRRRRRRRrrK..', '..KrRRRRRRrrrK..', '...KrrRRRrrrK...', '....KrrrrrrK....', '.....KKKKKK.....', '................'],
  map: [
    '................', '.KKKKKKKKKKKKKK.', '.KppppppppppppK.', '.KpGGGpppqqppPK.', '.KpGGGGppqppqPK.',
    '.KppGGpBBpppqPK.', '.KpppppBBBppqPK.', '.KpqqppBBpRpPPK.', '.KppqpppppRRpPK.', '.KpppqqpppRppPK.',
    '.KpGGppqqppppPK.', '.KpGGGpppqqppPK.', '.KppppppppppPPK.', '.KPPPPPPPPPPPPK.', '.KKKKKKKKKKKKKK.', '................'],
  compass: [
    '................', '.....KKKKKK.....', '...KKYYYYYYKK...', '..KYYSSSSSSYyK..', '..KYSSSSRSSSyK..',
    '.KYSSSSSRSSSSyK.', '.KYSSSSRRSSSSyK.', '.KYSSSSKKSSSSyK.', '.KYSSSSssSSSSyK.', '.KYSSSSSsSSSSyK.',
    '..KYSSSSsSSSyK..', '..KYySSSSSSyyK..', '...KKyyyyyyKK...', '.....KKKKKK.....', '................', '................'],
  boomerang: [
    '................', '...KKKKK........', '..KlYYYYK.......', '..KYyyyYYK......', '..KYK..KYYK.....',
    '..KYK...KYYK....', '...K.....KYYK...', '..........KYyK..', '...........KyK..', '............K...',
    '................', '................', '................', '................', '................', '................'],
  bow: [
    '.......KK.......', '......KnNK......', '.....KnK.KS.....', '....KnK...S.....', '....KnK...S.....',
    '...KnK....S.....', '...KnK....S.....', '...KnK....S.....', '...KnK....S.....', '....KnK...S.....',
    '....KnK...S.....', '.....KnK.KS.....', '......KnNK......', '.......KK.......', '................', '................'],
  lamp: [
    '......KKKK......', '.....KYllYK.....', '.....KKKKKK.....', '....KFFFFFFK....', '...KFfFFFFfFK...',
    '...KFfFWFFfFK...', '...KFfFFFFfFK...', '....KFFFFFFK....', '.....KKKKKK.....', '....KYYYYYYK....',
    '....KyyyyyyK....', '.....KKKKKK.....', '................', '................', '................', '................'],
  heart_container: ['.KK.KK..', 'KwRKRRK.', 'KRRRRRK.', 'KRRRRrK.', '.KRRrK..', '..KrK...', '...K....', '........'],
};

function paint(rows) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = P[r[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  return c;
}

let built = null;
function build() {
  built = {};
  for (const [k, rows] of Object.entries(DEF)) built[k] = paint(rows);
  // half / empty hearts derived from the full heart. Empty = outline heart_dk + night fill (style guide).
  const full = DEF.heart_full;
  built.heart_empty = paint(full.map((r) => r.split('').map((ch) => (ch === 'K' ? 'r' : ch === '.' ? '.' : 'e')).join('')));
  built.heart_half = paint(full.map((r) => r.split('').map((ch, x) => (x >= 4 && ch !== 'K' && ch !== '.' ? 'e' : ch)).join('')));
  return built;
}

export function fallbackIcon(key) { return (built || build())[key] || null; }

/** Lookup icon: art agent's icon first, then fallback. Accepts aliases (e.g. item ids). */
export function getIcon(assets, key) {
  if (!key) return null;
  const ic = assets?.icons;
  const a = ic && (ic[key] || ic['icon_' + key] || ic['item_' + key]);
  if (a && a.width) return a;
  return fallbackIcon(key) || fallbackIcon(String(key).replace(/^item_|^icon_/, ''));
}
