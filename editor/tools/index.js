// DRIFT-Editor – Szenen-Generator (UI). Vorlage wählen, Regler schieben, Live-Minikarte ansehen, dann als neue Karte
// anlegen oder die aktuelle ersetzen (ein Rückgängig-Schritt). Logik: ./generator.js
import { TEMPLATES, SIDES, defaults, generate, writeInto } from './generator.js';
import { MAT_COLOR } from './lib/terrain.js';
import { newMap, charFor, TILE } from '../src/format.js';

const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== undefined && v !== null && v !== false) e[k] = v;
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
};
const TREE = new Set(['tree', 'tree_pine', 'tree_autumn', 'tree_small']);

export default function register(E) {
  let O = defaults('route'), res = null, timer = 0;
  const targets = {};      // Ausgang → Zielkarte
  const root = el('div', { id: 'generator', hidden: true });
  document.body.append(root);
  const btn = el('button', { title: 'Szenen-Generator: komplette Karte erzeugen', onclick: () => open() }, '✨ Generator');
  document.querySelector('#top .spacer')?.before(btn);
  E.openGenerator = () => open();

  function open() { root.hidden = false; render(); regen(); }
  function close() { root.hidden = true; }
  const regenSoon = () => { clearTimeout(timer); timer = setTimeout(regen, 60); };
  function regen() {
    try { res = generate(O); } catch (e) { console.error(e); E.toast('Generator-Fehler: ' + e.message, 'error'); return; }
    drawPreview(); renderInfo();
  }

  function slider(label, key, lo = 0, hi = 1, step = 0.05) {
    const out = el('b', { textContent: fmt(O[key]) });
    function fmt(v) { return step < 1 ? Math.round(v * 100) + ' %' : v; }
    return el('label', { class: 'gen-sl' }, el('span', { textContent: label }),
      el('input', { type: 'range', min: lo, max: hi, step, value: O[key], oninput: (e) => { O[key] = +e.target.value; out.textContent = fmt(O[key]); regenSoon(); } }), out);
  }
  function render() {
    root.textContent = '';
    const head = el('div', { class: 'imp-head' }, el('b', { textContent: '✨ Szenen-Generator' }), el('span', { class: 'muted', textContent: 'Gleicher Seed = gleiche Karte' }), el('div', { style: 'flex:1' }),
      el('button', { onclick: close }, 'Schließen'));
    const form = el('div', { class: 'gen-form' });
    const tpl = el('div', { class: 'gen-tpl' }, ...Object.entries(TEMPLATES).map(([k, t]) => el('button', { class: O.template === k ? 'on' : '', onclick: () => {
      const keep = { seed: O.seed, name: O.name, levels: O.levels, chests: O.chests };
      O = { ...defaults(k), ...keep }; render(); regen();
    } }, t.label)));
    form.append(tpl);
    form.append(el('div', { class: 'row' },
      el('label', { class: 'field' }, el('span', { textContent: 'Name der Karte' }), el('input', { value: O.name, placeholder: TEMPLATES[O.template].label.slice(3), oninput: (e) => { O.name = e.target.value; } })),
      el('label', { class: 'field', style: 'max-width:120px' }, el('span', { textContent: 'Seed' }), el('div', { class: 'row' },
        el('input', { type: 'number', value: O.seed, onchange: (e) => { O.seed = +e.target.value | 0; regen(); } }),
        el('button', { class: 'mini', title: 'Neu würfeln', onclick: () => { O.seed = Math.floor(Math.random() * 99999); render(); regen(); } }, '🎲')))));
    form.append(el('div', { class: 'row' },
      el('label', { class: 'field' }, el('span', { textContent: 'Breite' }), el('input', { type: 'number', min: 16, max: 128, value: O.w, onchange: (e) => { O.w = +e.target.value; regen(); } })),
      el('label', { class: 'field' }, el('span', { textContent: 'Höhe' }), el('input', { type: 'number', min: 14, max: 128, value: O.h, onchange: (e) => { O.h = +e.target.value; regen(); } }))));
    if (O.template !== 'cave') {
      form.append(slider('Wasser', 'water'), slider('Wald', 'forest'), slider('Hügel', 'hills'), slider('Hohes Gras', 'grass'));
      form.append(el('div', { class: 'field' }, el('span', { textContent: 'Ausgänge (Wege führen dorthin)' }), el('div', { class: 'row wrap' },
        ...Object.entries(SIDES).map(([k, v]) => el('label', { class: 'chk' }, el('input', { type: 'checkbox', checked: O.exits.includes(k), onchange: (e) => {
          O.exits = e.target.checked ? [...O.exits, k] : O.exits.filter((x) => x !== k); if (!O.exits.length) O.exits = [k]; render(); regen();
        } }), v)))));
    } else form.append(slider('Hohes Gras', 'grass'));
    form.append(el('div', { class: 'row' },
      el('label', { class: 'field' }, el('span', { textContent: 'Monster-Level von' }), el('input', { type: 'number', min: 1, max: 60, value: O.levels[0], onchange: (e) => { O.levels = [Math.max(1, +e.target.value), Math.max(+e.target.value, O.levels[1])]; regen(); } })),
      el('label', { class: 'field' }, el('span', { textContent: 'bis' }), el('input', { type: 'number', min: 1, max: 60, value: O.levels[1], onchange: (e) => { O.levels = [O.levels[0], Math.max(O.levels[0], +e.target.value)]; regen(); } })),
      el('label', { class: 'field' }, el('span', { textContent: 'Truhen' }), el('input', { type: 'number', min: 0, max: 6, value: O.chests, onchange: (e) => { O.chests = Math.max(0, Math.min(6, +e.target.value)); regen(); } }))));
    // Ausgänge mit vorhandenen Karten verbinden
    const maps = Object.values(E.doc.maps);
    const exitList = O.template === 'cave' ? ['s'] : O.exits;
    form.append(el('div', { class: 'field' }, el('span', { textContent: 'Ausgang verbinden mit (optional)' }),
      ...exitList.map((k) => el('div', { class: 'row', style: 'margin-bottom:4px' }, el('span', { textContent: SIDES[k], style: 'flex:0 0 70px' }),
        selectEl({ '': '– später –', ...Object.fromEntries(maps.map((m) => [m.id, m.name])) }, targets[k] || '', (v) => { targets[k] = v; })))));
    form.append(el('div', { class: 'row wrap', style: 'margin-top:10px' },
      el('button', { class: 'primary', onclick: () => commit(false) }, '＋ Als neue Karte'),
      el('button', { onclick: () => { if (confirm('Aktuelle Karte durch die erzeugte ersetzen? (Rückgängig möglich)')) commit(true); } }, '↻ Aktuelle Karte ersetzen')));
    form.append(el('div', { class: 'gen-info muted' }));
    const prev = el('div', { class: 'gen-prev' }, el('canvas', { id: 'genCanvas' }), el('div', { class: 'gen-legend muted', innerHTML: '🌲 Bäume · <span style="color:#6ee07a">▢</span> Monster-Zonen · <span style="color:#f0c060">■</span> Truhen · <span style="color:#9ad0ff">●</span> Ankunft · helle Flächen = Plateaus' }));
    root.append(head, el('div', { class: 'gen-body' }, form, prev));
  }
  function selectEl(opts, value, onchange) {
    const s = el('select', { onchange: (e) => onchange(e.target.value) });
    for (const [k, v] of Object.entries(opts)) s.append(el('option', { value: k, textContent: v, selected: k === value }));
    return s;
  }
  function renderInfo() {
    const i = res?.info; const box = root.querySelector('.gen-info'); if (!box || !i) return;
    box.textContent = `${i.trees} Bäume · ${i.zones} Monster-Zonen · ${i.chests} Truhen · Ausgänge: ${i.exits.join(', ')} · ${i.reachable} begehbare Felder`;
  }
  function drawPreview() {
    const cv = root.querySelector('#genCanvas'); if (!cv || !res) return;
    const G = res.grid;
    const box = cv.parentElement.getBoundingClientRect();
    const s = Math.max(2, Math.floor(Math.min((box.width - 20) / G.w, (Math.max(260, box.height - 60)) / G.h)));
    cv.width = G.w * s; cv.height = G.h * s;
    const g = cv.getContext('2d');
    for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) {
      const i = y * G.w + x, h = G.hm[i];
      g.fillStyle = MAT_COLOR[G.t[i]] || '#888'; g.fillRect(x * s, y * s, s, s);
      if (h > 0) { g.fillStyle = `rgba(255,240,200,${Math.min(0.35, h * 0.14)})`; g.fillRect(x * s, y * s, s, s); }
      if (G.H(x, y + 1) >= 0 && G.H(x, y + 1) < h && G.t[i] !== 'stairs') { g.fillStyle = 'rgba(40,20,20,.75)'; g.fillRect(x * s, y * s + s - Math.max(1, s / 4), s, Math.max(1, s / 4)); }
      if (G.t[i] === 'stairs') { g.fillStyle = 'rgba(80,50,30,.8)'; for (let k = 1; k < 4; k++) g.fillRect(x * s, y * s + (k * s) / 4, s, 1); }
    }
    for (const o of res.map.objects) {
      const x = (o.x / TILE) * s, y = (o.y / TILE) * s;
      if (TREE.has(o.type)) { g.fillStyle = o.type === 'tree_pine' ? '#1f4a2a' : '#285c2c'; g.beginPath(); g.arc(x, y - s * 0.4, s * 0.62, 0, 7); g.fill(); }
      else if (o.type === 'house') { g.fillStyle = '#b05a3a'; g.fillRect(x - 2.5 * s, y - 3.6 * s, 5 * s, 3.6 * s); g.fillStyle = '#f0d8a8'; g.fillRect(x - 0.4 * s, y - s, 0.8 * s, s); }
      else if (o.type !== 'flower' && o.type !== 'lilypad' && o.type !== 'mushroom') { g.fillStyle = '#5a5048'; g.fillRect(x - s * 0.3, y - s * 0.6, s * 0.6, s * 0.5); }
    }
    for (const z of res.map.encounters) { g.strokeStyle = '#6ee07a'; g.lineWidth = 1.5; g.setLineDash([4, 3]); g.strokeRect(z.rect[0] * s + 0.5, z.rect[1] * s + 0.5, z.rect[2] * s, z.rect[3] * s); g.setLineDash([]); }
    for (const it of res.map.items) { g.fillStyle = '#f0c060'; g.fillRect((it.x / TILE) * s - s * 0.4, (it.y / TILE) * s - s * 0.8, s * 0.8, s * 0.6); }
    for (const n of res.map.npcs) { g.fillStyle = '#e08ad0'; g.beginPath(); g.arc((n.x / TILE) * s, (n.y / TILE) * s - s * 0.3, s * 0.35, 0, 7); g.fill(); }
    for (const sp of Object.values(res.map.spawns)) { g.fillStyle = '#9ad0ff'; g.beginPath(); g.arc((sp.x / TILE) * s, (sp.y / TILE) * s - s * 0.3, s * 0.45, 0, 7); g.fill(); }
  }

  function commit(replace) {
    if (!res) return;
    const name = (O.name || TEMPLATES[O.template].label.slice(3)).trim();
    const cur = E.map();
    let id;
    E.change(replace ? 'Karte neu erzeugt' : 'Karte erzeugt', (doc) => {
      if (replace) id = cur.id;
      else {
        const base = name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'karte';
        id = base; let i = 2; while (doc.maps[id]) id = `${base}_${i++}`;
      }
      const m = newMap({ id, name, w: res.grid.w, h: res.grid.h });
      writeInto(m, structuredClone({ ...res, grid: res.grid }), charFor);
      // Ausgänge verbinden
      const G = res.grid;
      for (const [side, target] of Object.entries(targets)) {
        if (!target || !doc.maps[target]) continue;
        const sp = m.spawns[{ n: 'nord', s: 'sued', w: 'west', e: 'ost' }[side]]; if (!sp) continue;
        const tx = Math.floor(sp.x / TILE), ty = Math.floor(sp.y / TILE);
        const rect = { w: [0, ty - 1, 1, 3], e: [G.w - 1, ty - 1, 1, 3], n: [tx - 1, 0, 3, 1], s: [tx - 1, G.h - 1, 3, 1] }[side];
        m.warps.push({ rect, to: { map: target, spawn: Object.keys(doc.maps[target].spawns)[0] || 'start' }, dirReq: { w: 'left', e: 'right', n: 'up', s: 'down' }[side] });
      }
      Object.assign(doc.dialogs, structuredClone(res.dialogs));
      doc.maps[id] = m;
    });
    close();
    E.openMap(id);
    E.toast(`„${name}“ erzeugt – mit ▶ Probe spielen direkt ausprobieren.`);
  }
  window.addEventListener('resize', () => { if (!root.hidden) drawPreview(); });
}
