// Tiny DOM helpers for tool option bars, inspectors and panels (no framework). Styles are injected once and
// use the core's CSS variables when present (--ed-bg, --ed-fg, --ed-accent …) with sensible fallbacks.
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

const CSS = `
.dt{--a:var(--ed-accent,#e8b04a);--bg:var(--ed-panel,#1e2230);--bg2:var(--ed-panel2,#272c3d);--fg:var(--ed-fg,#e8e4da);--mut:var(--ed-muted,#9a98a8);--ln:var(--ed-line,#3a4056);
  font:13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--fg)}
.dt *{box-sizing:border-box}
.dt .row{display:flex;gap:6px;align-items:center;margin:4px 0;flex-wrap:wrap}
.dt label.f{display:flex;flex-direction:column;gap:2px;font-size:11px;color:var(--mut);min-width:0;flex:1 1 120px}
.dt label.c{display:flex;gap:6px;align-items:center;font-size:12px}
.dt input,.dt select,.dt textarea{background:var(--bg2);color:var(--fg);border:1px solid var(--ln);border-radius:6px;padding:4px 6px;font:inherit;min-width:0;max-width:100%}
.dt input[type=range]{padding:0;accent-color:var(--a)}
.dt input[type=color]{padding:0;width:34px;height:26px}
.dt textarea{width:100%;resize:vertical;min-height:44px}
.dt button{background:var(--bg2);color:var(--fg);border:1px solid var(--ln);border-radius:6px;padding:4px 9px;font:inherit;cursor:pointer;min-height:28px}
.dt button:hover{border-color:var(--a)}
.dt button.pri{background:var(--a);color:#20180a;border-color:var(--a);font-weight:600}
.dt button.on{outline:2px solid var(--a)}
.dt button.sm{padding:2px 6px;min-height:22px;font-size:11px}
.dt h3{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);margin:10px 0 4px}
.dt h2{font-size:15px;margin:4px 0 8px}
.dt .chips{display:flex;flex-wrap:wrap;gap:4px}
.dt .chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:var(--bg2);border:1px solid var(--ln);cursor:pointer;font-size:12px}
.dt .chip.on{border-color:var(--a);box-shadow:inset 0 0 0 1px var(--a)}
.dt .sw{width:12px;height:12px;border-radius:3px;display:inline-block;border:1px solid rgba(0,0,0,.4)}
.dt table{border-collapse:collapse;width:100%;font-size:12px}
.dt td,.dt th{padding:3px 4px;border-bottom:1px solid var(--ln);text-align:left}
.dt td input,.dt td select{width:100%}
.dt .muted{color:var(--mut);font-size:11px}
.dt .card{background:var(--bg2);border:1px solid var(--ln);border-radius:8px;padding:8px;margin:6px 0}
.dt .bad{color:#ff8a7a}.dt .ok{color:#8ad890}.dt .warn{color:#f0c060}
.dt .list{display:flex;flex-direction:column;gap:2px;max-height:240px;overflow:auto}
.dt .li{padding:4px 6px;border-radius:5px;cursor:pointer;display:flex;gap:6px;align-items:center}
.dt .li:hover{background:var(--bg2)}.dt .li.on{background:var(--bg2);box-shadow:inset 3px 0 0 var(--a)}
.dt .tag{font-size:10px;padding:1px 5px;border-radius:4px;color:#111;font-weight:600}
.dt .split{display:grid;grid-template-columns:minmax(120px,170px) 1fr;gap:10px}
@media (max-width:640px){.dt .split{grid-template-columns:1fr}}
`;
export function css(extra = '') {
  if (!document.getElementById('drift-tools-css')) document.head.append(h('style', { id: 'drift-tools-css' }, CSS));
  if (extra) { const id = 'drift-tools-css-' + hashCode(extra); if (!document.getElementById(id)) document.head.append(h('style', { id }, extra)); }
}
function hashCode(s) { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return (x >>> 0).toString(36); }

// form fields bound to an object: field(obj, key, spec) → element; onChange(obj) called after edits
export function field(obj, key, spec = {}, onChange = () => {}) {
  const label = spec.label ?? key;
  const set = (v) => { obj[key] = v; onChange(obj, key); };
  let inp;
  switch (spec.type ?? typeof obj[key]) {
    case 'range': case 'slider': {
      const out = h('span', { class: 'muted' }, String(obj[key]));
      inp = h('input', { type: 'range', min: spec.min ?? 0, max: spec.max ?? 10, step: spec.step ?? 1, value: obj[key],
        oninput: (e) => { out.textContent = e.target.value; set(+e.target.value); } });
      return h('label', { class: 'f' }, h('span', {}, label, ' ', out), inp);
    }
    case 'boolean': case 'check':
      inp = h('input', { type: 'checkbox', checked: !!obj[key], onchange: (e) => set(e.target.checked) });
      return h('label', { class: 'c' }, inp, label);
    case 'select':
      inp = h('select', { onchange: (e) => set(spec.num ? +e.target.value : e.target.value) },
        (typeof spec.options === 'function' ? spec.options() : spec.options).map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(v) === String(obj[key]) }, t); }));
      return h('label', { class: 'f' }, label, inp);
    case 'color':
      inp = h('input', { type: 'color', value: obj[key] || '#888888', oninput: (e) => set(e.target.value) });
      return h('label', { class: 'f', style: { flex: '0 0 auto' } }, label, inp);
    case 'number':
      inp = h('input', { type: 'number', value: obj[key] ?? '', min: spec.min, max: spec.max, step: spec.step ?? 1, onchange: (e) => set(e.target.value === '' ? undefined : +e.target.value) });
      return h('label', { class: 'f' }, label, inp);
    case 'textarea':
      inp = h('textarea', { rows: spec.rows ?? 3, onchange: (e) => set(spec.lines ? e.target.value.split('\n').filter((l) => l.trim()) : e.target.value) });
      inp.value = spec.lines ? (obj[key] || []).join('\n') : obj[key] ?? '';
      return h('label', { class: 'f', style: { flexBasis: '100%' } }, label, inp);
    default:
      inp = h('input', { type: 'text', value: obj[key] ?? '', placeholder: spec.placeholder, onchange: (e) => set(e.target.value) });
      return h('label', { class: 'f' }, label, inp);
  }
}
// option bar from a schema {key: spec}
export function form(obj, schema, onChange) {
  return h('div', { class: 'row' }, Object.entries(schema).map(([k, s]) => field(obj, k, s, onChange)));
}
export function chips(items, isOn, onClick) {
  return h('div', { class: 'chips' }, items.map((it) => h('span', { class: 'chip' + (isOn(it) ? ' on' : ''), onclick: () => onClick(it) }, it.color ? h('span', { class: 'sw', style: { background: it.color } }) : null, it.label ?? it.id)));
}
export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 7);
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
