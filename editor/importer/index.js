// DRIFT-Editor – Importer für eigene Grafik-Sets (ZIP oder PNGs). Bilder bleiben lokal im Browser (IndexedDB);
// ins Projekt wandert nur die Zuordnung (project.assets.packs[]): welche Bildausschnitte Tiles, Objekte oder Figuren sind.
// Ablauf: laden → automatisch erkennen (src/assetpack/analyze.js) → hier korrigieren → sofort in Paletten, Vorschau und Spiel.
import { expandFiles } from '../../src/assetpack/zip.js';
import { imgFromBlob, toCanvas, crop, previewCanvas } from '../../src/assetpack/img.js';
import { putPack, getPack, listPacks, deletePack, freePackId } from '../../src/assetpack/store.js';
import { autoSpec, applyFile, guessLicense, LIKES, GRIDS, slug } from '../../src/assetpack/analyze.js';
import { TILE_DEFS } from '../../src/data/tiles.js';

const LIKE_NAMES = {
  grass: 'Gras', grass_dark: 'dunkles Gras', grass_light: 'helles Gras', grass_flowers: 'Blumenwiese', grass_tall: 'hohes Gras (Monster)',
  dirt: 'Erde', path: 'Weg', sand: 'Sand', clearing: 'Lichtung', soil: 'Acker', water: 'Wasser (blockiert)', shallow: 'Flachwasser',
  stone_floor: 'Steinboden', wood_floor: 'Holzboden', dungeon_floor: 'Dungeonboden', dungeon_wall: 'Wand (blockiert)', bridge: 'Brücke',
  stairs: 'Treppe', pit: 'Grube',
};
const KIND_NAMES = { tiles: 'Tiles & Objekte', character: 'Figur (Animation)', ignore: 'ignorieren' };
const DIR_NAMES = { down: '↓ unten', up: '↑ oben', left: '← links', right: '→ rechts' };
const clone = (o) => JSON.parse(JSON.stringify(o));
const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== undefined && v !== null && v !== false) e[k] = v;
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
};
const selectEl = (opts, value, onchange) => {
  const s = el('select', { onchange: (e) => onchange(e.target.value) });
  for (const [k, v] of Object.entries(opts)) s.append(el('option', { value: k, textContent: v, selected: String(k) === String(value) }));
  return s;
};

export default function register(E) {
  const S = { packs: [], packId: null, spec: null, imgs: new Map(), file: null, dirty: false, focus: null, anim: 0 };
  const root = el('div', { id: 'importer', hidden: true });
  document.body.append(root);
  const btn = el('button', { title: 'Eigene Grafik-Sets laden und zuordnen', onclick: () => open() }, '🎨 Eigene Grafiken');
  document.querySelector('#top .spacer')?.before(btn);
  const fileIn = el('input', { type: 'file', multiple: true, accept: '.zip,.png,.gif,.webp,image/png', hidden: true, onchange: (e) => { load([...e.target.files]); e.target.value = ''; } });
  document.body.append(fileIn);

  const projPacks = () => (E.doc.project.assets ||= { packs: [] }).packs || (E.doc.project.assets.packs = []);
  const inProject = (id) => projPacks().find((p) => p.id === id);

  async function open(packId) {
    root.hidden = false;
    S.packs = await listPacks().catch((e) => { E.toast('Browser-Speicher nicht verfügbar: ' + e.message, 'error'); return []; });
    const id = packId || S.packId || projPacks()[0]?.id || S.packs[0]?.id;
    if (id && S.packs.some((p) => p.id === id)) await select(id); else { S.packId = null; S.spec = null; render(); }
  }
  async function close() {
    if (S.dirty) await apply();
    root.hidden = true; cancelAnimationFrame(S.anim);
  }

  async function select(id) {
    S.packId = id; S.file = null; S.imgs.clear();
    const rec = await getPack(id);
    if (!rec) { S.spec = null; render(); return; }
    for (const f of rec.files) S.imgs.set(f.path, { img: await imgFromBlob(f.blob).catch(() => null) });
    for (const [p, v] of S.imgs) if (!v.img) S.imgs.delete(p); else v.canvas = toCanvas(v.img);
    const existing = inProject(id);
    S.spec = existing ? clone(existing) : autoSpec({ id, name: rec.name, license: rec.license }, [...S.imgs].map(([path, v]) => ({ path, img: v.img })));
    S.spec.files ||= {};
    for (const [path, v] of S.imgs) S.spec.files[path] ||= { kind: 'ignore', grid: 16, w: v.img.w, h: v.img.h };
    S.file = Object.keys(S.spec.files).find((p) => S.spec.files[p].kind !== 'ignore') || Object.keys(S.spec.files)[0] || null;
    if (!existing) { S.dirty = true; await apply(); }
    render();
  }

  async function load(files) {
    if (!files.length) return;
    E.toast('Lade und erkenne Grafiken …');
    try {
      const { images, texts } = await expandFiles(files);
      if (!images.length) { E.toast('Keine Bilder gefunden (PNG/GIF/WEBP oder ZIP).', 'error'); return; }
      const zip = files.find((f) => /\.zip$/i.test(f.name));
      const name = (zip?.name || (files.length === 1 ? files[0].name : 'Eigene Grafiken')).replace(/\.(zip|png|gif|webp)$/i, '').replace(/[_-]+/g, ' ');
      const id = await freePackId(name);
      await putPack({ id, name, created: Date.now(), license: guessLicense(texts), files: images.map((i) => ({ path: i.path, blob: i.blob })) });
      S.packs = await listPacks();
      await select(id);
      const sp = S.spec;
      const nC = Object.values(sp.sprites).filter((s) => s.kind === 'character').length;
      E.toast(`„${name}“: ${Object.keys(sp.tiles).length} Tiles, ${Object.keys(sp.sprites).length - nC} Objekte, ${nC} Figuren erkannt.`);
    } catch (e) { console.error(e); E.toast('Import fehlgeschlagen: ' + e.message, 'error'); }
  }

  /** Arbeitskopie ins Projekt schreiben und Grafiken neu einhängen */
  async function apply() {
    if (!S.spec) return;
    const spec = clone(S.spec);
    E.change(`Grafik-Paket „${spec.name}“`, () => {
      const list = projPacks(), i = list.findIndex((p) => p.id === spec.id);
      if (i >= 0) list[i] = spec; else list.push(spec);
    });
    S.dirty = false;
    await E.reloadPacks?.();
    renderHead();
  }
  const touch = () => { S.dirty = true; renderHead(); };

  async function removePack(id) {
    if (!confirm('Paket aus diesem Browser löschen? Karten, die seine Tiles nutzen, zeigen dann Platzhalter.')) return;
    await deletePack(id).catch(() => {});
    E.change('Grafik-Paket entfernt', () => { const l = projPacks(); const i = l.findIndex((p) => p.id === id); if (i >= 0) l.splice(i, 1); });
    S.packId = null; S.spec = null; S.dirty = false;
    await E.reloadPacks?.();
    S.packs = await listPacks().catch(() => []);
    render();
  }

  /** Paket-Teil umbenennen, inkl. aller Verweise in Karten */
  function rename(coll, oldName, newName) {
    newName = slug(newName);
    if (!newName || newName === oldName || S.spec[coll][newName]) return false;
    S.spec[coll][newName] = S.spec[coll][oldName]; delete S.spec[coll][oldName];
    for (const [b, k] of Object.entries(S.spec.overrides || {})) if (k === oldName) S.spec.overrides[b] = newName;
    const o = `${S.spec.id}:${oldName}`, n = `${S.spec.id}:${newName}`;
    E.change('Umbenannt', () => {
      for (const m of Object.values(E.doc.maps)) {
        for (const [c, v] of Object.entries(m.legend || {})) if (v === o) m.legend[c] = n;
        for (const x of m.objects) if (x.type === o) x.type = n;
        for (const x of m.npcs) if (x.character === o) x.character = n;
      }
    });
    touch();
    return true;
  }

  // ------------------------------------------------------------------ Darstellung
  function renderHead() {
    const h = root.querySelector('.imp-head .state');
    if (h) h.textContent = S.dirty ? '● Änderungen werden beim Schließen übernommen' : S.spec ? '✓ im Projekt' : '';
  }
  function render() {
    cancelAnimationFrame(S.anim);
    root.textContent = '';
    root.append(el('div', { class: 'imp-head' },
      el('b', { textContent: '🎨 Eigene Grafiken' }), el('span', { class: 'state muted' }),
      el('div', { style: 'flex:1' }),
      S.spec ? el('button', { onclick: () => apply() }, '✓ Übernehmen') : null,
      el('button', { class: 'primary', onclick: () => close() }, 'Fertig')));
    const body = el('div', { class: 'imp-body' });
    root.append(body);
    // Pakete
    const left = el('div', { class: 'imp-col imp-packs' },
      el('button', { class: 'primary', style: 'width:100%', onclick: () => fileIn.click() }, '＋ ZIP / PNGs laden'),
      el('div', { class: 'hint', textContent: 'Fertige 2D-Sets (z. B. von itch.io) als ZIP oder einzelne PNGs. Die Bilder bleiben nur in diesem Browser – Projekt-Exporte enthalten sie nicht.' }));
    for (const p of S.packs) {
      const inP = !!inProject(p.id);
      left.append(el('div', { class: 'imp-pack' + (p.id === S.packId ? ' on' : ''), onclick: () => select(p.id) },
        el('div', {}, el('b', { textContent: p.name }), el('div', { class: 'muted', textContent: `${p.files} Bilder · ${inP ? 'im Projekt' : 'nicht im Projekt'}` }))));
    }
    if (!S.packs.length) left.append(el('div', { class: 'muted', style: 'margin-top:10px', textContent: 'Noch keine Pakete. Tipp: Dateien einfach auf dieses Fenster ziehen.' }));
    body.append(left);
    if (!S.spec) { body.append(el('div', { class: 'imp-col imp-empty' }, el('div', { class: 'muted', textContent: 'Lade ein Set oder wähle links ein Paket.' }))); renderHead(); return; }
    // Dateien
    const mid = el('div', { class: 'imp-col imp-files' });
    mid.append(el('label', { class: 'field' }, el('span', { textContent: 'Paketname' }), el('input', { value: S.spec.name, onchange: (e) => { S.spec.name = e.target.value || S.spec.name; touch(); } })));
    mid.append(el('label', { class: 'field' }, el('span', { textContent: 'Lizenz' }), el('input', { value: S.spec.license?.name || '', onchange: (e) => { S.spec.license = { ...(S.spec.license || {}), name: e.target.value || 'nur lokal (privat)' }; touch(); } })));
    const lt = S.spec.license?.text;
    if (lt) mid.append(el('details', { class: 'muted' }, el('summary', { textContent: 'Lizenztext' }), el('pre', { textContent: lt })));
    mid.append(el('h3', { textContent: `Bilder (${S.imgs.size})` }));
    const paths = [...S.imgs.keys()].sort((a, b) => (S.spec.files[a]?.kind === 'ignore') - (S.spec.files[b]?.kind === 'ignore') || a.localeCompare(b));
    for (const path of paths) {
      const f = S.spec.files[path], v = S.imgs.get(path);
      const n = Object.values(S.spec.tiles).filter((t) => t.file === path).length, o = Object.values(S.spec.sprites).filter((t) => t.file === path).length;
      mid.append(el('div', { class: 'imp-file' + (path === S.file ? ' on' : '') + (f.kind === 'ignore' ? ' off' : ''), title: path, onclick: () => { S.file = path; render(); } },
        previewCanvas(v.canvas, 40, 40),
        el('div', {}, el('div', { textContent: path.split('/').pop() }),
          el('div', { class: 'muted', textContent: f.kind === 'ignore' ? 'ignoriert' : f.kind === 'character' ? 'Figur' : `${n} Tiles · ${o} Objekte` }))));
    }
    mid.append(el('div', { class: 'row', style: 'margin-top:12px' }, el('button', { class: 'danger', onclick: () => removePack(S.spec.id) }, '🗑 Paket löschen')));
    body.append(mid);
    // Detail
    body.append(detail());
    renderHead();
  }

  function detail() {
    const box = el('div', { class: 'imp-col imp-detail' });
    const path = S.file, v = S.imgs.get(path), f = S.spec.files[path];
    if (!v || !f) { box.append(el('div', { class: 'muted', textContent: 'Bild wählen.' })); return box; }
    const redo = () => { applyFile(S.spec, path, v.img); touch(); render(); };
    box.append(el('div', { class: 'row', style: 'margin-bottom:8px' },
      el('label', { class: 'field' }, el('span', { textContent: 'Art' }), selectEl(KIND_NAMES, f.kind, (k) => { f.kind = k; delete f.frame; redo(); })),
      f.kind === 'tiles' ? el('label', { class: 'field' }, el('span', { textContent: 'Raster (px)' }), selectEl(Object.fromEntries(GRIDS.map((g) => [g, `${g}×${g}`])), f.grid, (g) => { f.grid = +g; redo(); })) : null,
      f.kind !== 'ignore' ? el('button', { title: 'Automatische Erkennung für dieses Bild neu starten', onclick: redo }, '↻ neu erkennen') : null));
    // Vorschau mit Markierungen
    const maxW = Math.min(620, box.clientWidth || 620);
    const sc = Math.max(1, Math.min(6, Math.floor(maxW / v.img.w))) || Math.min(1, maxW / v.img.w);
    const cv = el('canvas', { width: Math.round(v.img.w * sc), height: Math.round(v.img.h * sc), class: 'imp-sheet' });
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    for (let y = 0; y < cv.height; y += 8) for (let x = 0; x < cv.width; x += 8) { g.fillStyle = ((x + y) >> 3) & 1 ? '#2b2f42' : '#23263a'; g.fillRect(x, y, 8, 8); }
    g.drawImage(v.canvas, 0, 0, cv.width, cv.height);
    const marks = [];
    const mark = (r, color, key) => { g.strokeStyle = color; g.lineWidth = key === S.focus ? 3 : 1.5; g.strokeRect(r[0] * sc + 0.5, r[1] * sc + 0.5, r[2] * sc - 1, r[3] * sc - 1); marks.push([r, key]); };
    if (f.kind === 'tiles') {
      for (const [k, t] of Object.entries(S.spec.tiles)) if (t.file === path) mark(t.rect, '#7ad08a', 'tiles:' + k);
      for (const [k, s] of Object.entries(S.spec.sprites)) if (s.file === path) mark(s.rect, '#f0a050', 'sprites:' + k);
    } else if (f.kind === 'character') {
      const ch = Object.values(S.spec.sprites).find((s) => s.file === path);
      if (ch) { g.strokeStyle = 'rgba(106,192,232,.6)'; for (let x = 0; x <= v.img.w; x += ch.frame[0]) { g.beginPath(); g.moveTo(x * sc + 0.5, 0); g.lineTo(x * sc + 0.5, cv.height); g.stroke(); } for (let y = 0; y <= v.img.h; y += ch.frame[1]) { g.beginPath(); g.moveTo(0, y * sc + 0.5); g.lineTo(cv.width, y * sc + 0.5); g.stroke(); } }
    }
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / (r.width / v.img.w), y = (e.clientY - r.top) / (r.height / v.img.h);
      const hit = marks.filter(([q]) => x >= q[0] && y >= q[1] && x < q[0] + q[2] && y < q[1] + q[3]).sort((a, b) => a[0][2] * a[0][3] - b[0][2] * b[0][3])[0];
      if (hit) { S.focus = hit[1]; render(); root.querySelector('.imp-card.focus')?.scrollIntoView({ block: 'nearest' }); }
    });
    box.append(el('div', { class: 'imp-sheetwrap' }, cv));
    if (f.kind === 'tiles') box.append(tileCards(path, v), objectCards(path, v));
    if (f.kind === 'character') box.append(characterCard(path, v));
    if (f.kind === 'ignore') box.append(el('div', { class: 'hint', textContent: 'Dieses Bild wird nicht verwendet. Stelle oben die Art ein, um es zu nutzen.' }));
    return box;
  }

  function thumbOf(v, r, size = 44) { return previewCanvas(toCanvas(crop(v.img, r[0], r[1], r[2], r[3])), size, size); }

  function tileCards(path, v) {
    const wrap = el('div');
    const list = Object.entries(S.spec.tiles).filter(([, t]) => t.file === path);
    wrap.append(el('h3', { textContent: `Boden-Tiles (${list.length})` }));
    if (!list.length && !Object.values(S.spec.sprites).some((x) => x.file === path)) wrap.append(el('div', { class: 'muted', textContent: 'Nichts gefunden. Stimmt das Raster?' }));
    if (!list.length) return wrap;
    const builtins = { '': '– ersetzt nichts –', ...Object.fromEntries(Object.keys(LIKE_NAMES).filter((k) => TILE_DEFS[k]).map((k) => [k, `ersetzt eingebautes ${LIKE_NAMES[k]}`])) };
    const grid = el('div', { class: 'imp-cards' });
    for (const [k, t] of list) {
      const over = Object.entries(S.spec.overrides || {}).find(([, key]) => key === k)?.[0] || '';
      grid.append(el('div', { class: 'imp-card' + (S.focus === 'tiles:' + k ? ' focus' : '') },
        thumbOf(v, t.rect),
        el('div', { class: 'imp-fields' },
          el('input', { value: k, title: 'Name', onchange: (e) => { if (!rename('tiles', k, e.target.value)) e.target.value = k; else render(); } }),
          selectEl(Object.fromEntries(LIKES.map((l) => [l, LIKE_NAMES[l] || l])), t.like, (l) => { t.like = l; touch(); }),
          selectEl(builtins, over, (b) => { S.spec.overrides ||= {}; for (const [bb, key] of Object.entries(S.spec.overrides)) if (key === k) delete S.spec.overrides[bb]; if (b) S.spec.overrides[b] = k; touch(); })),
        el('button', { class: 'mini', title: 'Nicht verwenden', onclick: () => { delete S.spec.tiles[k]; touch(); render(); } }, '✕')));
    }
    wrap.append(grid);
    return wrap;
  }
  function objectCards(path, v) {
    const wrap = el('div');
    const list = Object.entries(S.spec.sprites).filter(([, s]) => s.file === path && s.kind === 'object');
    wrap.append(el('h3', { textContent: `Objekte (${list.length})` }));
    const grid = el('div', { class: 'imp-cards' });
    for (const [k, s] of list) {
      grid.append(el('div', { class: 'imp-card' + (S.focus === 'sprites:' + k ? ' focus' : '') },
        thumbOf(v, s.rect),
        el('div', { class: 'imp-fields' },
          el('input', { value: k, title: 'Name', onchange: (e) => { if (!rename('sprites', k, e.target.value)) e.target.value = k; else render(); } }),
          el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: s.solid !== false, onchange: (e) => { s.solid = e.target.checked; touch(); } }), 'blockiert den Weg'),
          el('div', { class: 'muted', textContent: `${s.rect[2]}×${s.rect[3]} px` })),
        el('button', { class: 'mini', title: 'Nicht verwenden', onclick: () => { delete S.spec.sprites[k]; touch(); render(); } }, '✕')));
    }
    wrap.append(grid);
    return wrap;
  }
  function characterCard(path, v) {
    const wrap = el('div');
    const entry = Object.entries(S.spec.sprites).find(([, s]) => s.file === path && s.kind === 'character');
    if (!entry) { wrap.append(el('div', { class: 'muted', textContent: 'Keine Figur erkannt.' })); return wrap; }
    const [k, s] = entry;
    const [fw, fh] = s.frame, rows = Math.floor(v.img.h / fh), cols = Math.floor(v.img.w / fw);
    wrap.append(el('h3', { textContent: 'Figur' }));
    wrap.append(el('div', { class: 'row' },
      el('label', { class: 'field' }, el('span', { textContent: 'Name' }), el('input', { value: k, onchange: (e) => { if (!rename('sprites', k, e.target.value)) e.target.value = k; else render(); } })),
      el('label', { class: 'field' }, el('span', { textContent: 'Bildgröße B×H' }), el('div', { class: 'row' },
        el('input', { type: 'number', value: fw, min: 8, max: 256, onchange: (e) => { S.spec.files[path].frame = [+e.target.value, fh]; applyFile(S.spec, path, v.img); touch(); render(); } }),
        el('input', { type: 'number', value: fh, min: 8, max: 256, onchange: (e) => { S.spec.files[path].frame = [fw, +e.target.value]; applyFile(S.spec, path, v.img); touch(); render(); } })))));
    const rowOpts = { '': '–', mirror: 'gespiegelt (von rechts/links)', ...Object.fromEntries(Array.from({ length: rows }, (_, i) => [i, `Reihe ${i + 1}`])) };
    const table = el('div', { class: 'imp-anim' });
    table.append(el('span'), el('b', { textContent: 'Stehen' }), el('b', { textContent: 'Laufen' }), el('b', { textContent: 'Bilder' }));
    const countOf = (r) => { let n = 0; for (let c = 0; c < cols; c++) { const cell = crop(v.img, c * fw, r * fh, fw, fh); if (cell.d.some((p) => p >>> 24 > 24)) n = c + 1; else if (n) break; } return Math.max(1, n); };
    for (const dir of ['down', 'up', 'left', 'right']) {
      const cell = (action) => {
        const cur = s.anim?.[action]?.[dir];
        const val = cur === 'mirror' ? 'mirror' : Array.isArray(cur) ? cur[0] : '';
        return selectEl(rowOpts, val, (x) => {
          s.anim ||= {}; s.anim[action] ||= {};
          if (x === '') delete s.anim[action][dir]; else if (x === 'mirror') s.anim[action][dir] = 'mirror';
          else s.anim[action][dir] = [+x, action === 'idle' ? Math.min(countOf(+x), Array.isArray(cur) ? cur[1] : 1) : countOf(+x)];
          touch(); render();
        });
      };
      const w = s.anim?.walk?.[dir];
      table.append(el('span', { textContent: DIR_NAMES[dir] }), cell('idle'), cell('walk'),
        Array.isArray(w) ? el('input', { type: 'number', min: 1, max: cols, value: w[1], onchange: (e) => { w[1] = Math.max(1, Math.min(cols, +e.target.value)); touch(); render(); } }) : el('span', { class: 'muted', textContent: '–' }));
    }
    wrap.append(table);
    // Live-Vorschau: läuft in alle vier Richtungen
    const pv = el('canvas', { width: 4 * 72, height: 80, class: 'imp-anim-prev' });
    wrap.append(el('div', { class: 'muted', textContent: 'Vorschau (Laufen):' }), pv);
    const pg = pv.getContext('2d'); pg.imageSmoothingEnabled = false;
    const t0 = performance.now();
    const tick = () => {
      pg.clearRect(0, 0, pv.width, pv.height);
      ['down', 'left', 'right', 'up'].forEach((dir, i) => {
        let r = s.anim?.walk?.[dir], flip = false;
        if (r === 'mirror') { r = s.anim.walk[dir === 'left' ? 'right' : 'left']; flip = true; }
        if (!Array.isArray(r)) return;
        const fr = Math.floor((performance.now() - t0) / 140) % Math.max(1, r[1]);
        const scale = Math.max(1, Math.floor(Math.min(64 / fw, 72 / fh)));
        pg.save(); pg.translate(i * 72 + 36, 76);
        if (flip) pg.scale(-1, 1);
        pg.drawImage(v.canvas, fr * fw, r[0] * fh, fw, fh, -fw * scale / 2, -fh * scale, fw * scale, fh * scale);
        pg.restore();
      });
      S.anim = requestAnimationFrame(tick);
    };
    tick();
    wrap.append(el('div', { class: 'hint', textContent: `Im Editor unter 🧑 Personen als „${k}“ wählbar. Fehlt „Stehen“, wird das erste Laufbild genommen.` }));
    return wrap;
  }

  // Drag & Drop direkt auf das Importer-Fenster
  root.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
  root.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); load([...e.dataTransfer.files]); });
  window.addEventListener('keydown', (e) => { if (!root.hidden && e.key === 'Escape') close(); }, true);
  E.openImporter = open;
}
