// DRIFT-Editor – 2D-Bauansicht: Kacheln (echte Spiel-Texturen), Höhen-Schattierung mit Klippenkanten,
// Objekte/Figuren als Sprites, Zonen/Warps/Events als Rechtecke. Pan/Zoom per Maus, Rad, Leertaste und Zwei-Finger-Geste.
import { TILE, decodeGrid } from './format.js';

const CACHE_PX = 32;                       // Pixel pro Tile im Kachel-Cache
const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

export function createView(canvas, editor) {
  const ctx = canvas.getContext('2d');
  const V = { canvas, ctx, x: 0, y: 0, scale: 2, dpr: 1, cache: null, cacheKey: null, grid: null, showGrid: true, showHeights: false };
  let needs = true;

  V.resize = () => {
    const r = canvas.getBoundingClientRect();
    V.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * V.dpr)); canvas.height = Math.max(1, Math.round(r.height * V.dpr));
    V.redraw();
  };
  // Welt-Pixel ↔ Bildschirm (CSS-Pixel relativ zum Canvas)
  V.worldToScreen = (wx, wy) => ({ x: (wx - V.x) * V.scale, y: (wy - V.y) * V.scale });
  V.screenToWorld = (sx, sy) => { const r = canvas.getBoundingClientRect(); return { x: (sx - r.left) / V.scale + V.x, y: (sy - r.top) / V.scale + V.y }; };
  V.tileToScreen = (tx, ty) => V.worldToScreen(tx * TILE, ty * TILE);
  V.screenToTile = (sx, sy) => { const w = V.screenToWorld(sx, sy); return { x: w.x / TILE, y: w.y / TILE }; };
  V.centerOn = (wx, wy) => { const r = canvas.getBoundingClientRect(); V.x = wx - r.width / 2 / V.scale; V.y = wy - r.height / 2 / V.scale; V.redraw(); };
  V.fit = () => {
    const m = editor.map(); if (!m) return;
    const r = canvas.getBoundingClientRect();
    V.scale = Math.max(0.5, Math.min(4, Math.min(r.width / (m.w * TILE), r.height / (m.h * TILE)) * 0.92));
    V.centerOn((m.w * TILE) / 2, (m.h * TILE) / 2);
  };
  V.zoomAt = (f, sx, sy) => {
    const before = V.screenToWorld(sx, sy);
    V.scale = Math.max(0.35, Math.min(8, V.scale * f));
    const after = V.screenToWorld(sx, sy);
    V.x += before.x - after.x; V.y += before.y - after.y;
    V.redraw();
  };
  V.redraw = () => { needs = true; };
  V.invalidate = (cells) => {
    if (!cells || !V.cache) { V.cacheKey = null; } else { V.grid = decodeGrid(editor.map()); for (const [x, y] of cells) drawCell(x, y); }
    V.redraw();
  };

  // ---------- Kachel-Cache ----------
  function rebuildCache() {
    const m = editor.map();
    V.grid = decodeGrid(m);
    const c = V.cache && V.cache.width === m.w * CACHE_PX && V.cache.height === m.h * CACHE_PX ? V.cache : document.createElement('canvas');
    c.width = m.w * CACHE_PX; c.height = m.h * CACHE_PX;
    V.cache = c;
    const cx = c.getContext('2d'); cx.imageSmoothingEnabled = false;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) drawCell(x, y);
    V.cacheKey = m.id + ':' + m.w + 'x' + m.h;
  }
  function tileImg(id, x, y) {
    const t = editor.assets?.tiles?.[id];
    if (!t) return null;
    return Array.isArray(t) ? t[hash(x, y) % t.length] : t;
  }
  function drawCell(x, y) {
    const G = V.grid, c = V.cache.getContext('2d');
    if (x < 0 || y < 0 || x >= G.w || y >= G.h) return;
    const i = y * G.w + x, id = G.ground[i], h = G.height[i];
    const px = x * CACHE_PX, py = y * CACHE_PX, S = CACHE_PX;
    const img = tileImg(id, x, y);
    c.imageSmoothingEnabled = false;
    if (img) c.drawImage(img, px, py, S, S); else { c.fillStyle = id === 'void' ? '#080910' : '#6a4a8a'; c.fillRect(px, py, S, S); }
    // Höhe: heller je höher, Klippenkanten zu tieferen Nachbarn
    if (h > 0) { c.fillStyle = `rgba(255,240,210,${Math.min(0.32, h * 0.075)})`; c.fillRect(px, py, S, S); }
    const hAt = (xx, yy) => (xx < 0 || yy < 0 || xx >= G.w || yy >= G.h ? h : G.height[yy * G.w + xx]);
    const stairs = id === 'stairs';
    if (hAt(x, y + 1) < h && !stairs) { c.fillStyle = 'rgba(40,24,30,.85)'; c.fillRect(px, py + S - 5, S, 5); c.fillStyle = 'rgba(255,230,190,.35)'; c.fillRect(px, py + S - 6, S, 1); }
    if (hAt(x, y - 1) < h) { c.fillStyle = 'rgba(255,240,210,.55)'; c.fillRect(px, py, S, 2); }
    if (hAt(x - 1, y) < h) { c.fillStyle = 'rgba(30,20,30,.6)'; c.fillRect(px, py, 2, S); }
    if (hAt(x + 1, y) < h) { c.fillStyle = 'rgba(30,20,30,.6)'; c.fillRect(px + S - 2, py, 2, S); }
    if (hAt(x, y + 1) > h) { c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(px, py + S - 4, S, 4); }
  }

  // ---------- Sprites ----------
  const sprite = (key) => { const s = editor.assets?.sprites?.[key]; return Array.isArray(s) ? s[0] : s; };
  function drawSprite(key, wx, wy, alpha = 1, fallback = '#c8a0f0') {
    const img = sprite(key);
    const s = V.worldToScreen(wx, wy);
    if (!img) { ctx.fillStyle = fallback; ctx.beginPath(); ctx.arc(s.x, s.y - 6 * V.scale, 5 * V.scale, 0, 7); ctx.fill(); return; }
    const ws = img.ws || 1, ax = img.ax ?? img.width / 2, ay = img.ay ?? img.height - 1;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, s.x - ax * ws * V.scale, s.y - ay * ws * V.scale, img.width * ws * V.scale, img.height * ws * V.scale);
    ctx.globalAlpha = 1;
  }
  V.spriteFor = (kind, e) => {
    if (kind === 'object') return e.type === 'tree_pine' || e.type === 'tree_autumn' || sprite(e.type) ? e.type : ({ chest: 'chest_closed', switch: 'switch_up' })[e.type] || e.type;
    if (kind === 'item') return e.type === 'chest' ? 'chest_closed' : 'orb';
    if (kind === 'npc') {
      const has = (c) => !!editor.assets?.sprites?.[`npc_${c}_idle_down`];
      const ch = editor.doc.characters?.[e.character];
      const s = has(e.character) ? e.character : has(ch?.sprite) ? ch.sprite : 'elder';
      const d = e.dir || 'down';
      return editor.assets.sprites[`npc_${s}_idle_${d}`] ? `npc_${s}_idle_${d}` : `npc_${s}_idle_${d === 'left' ? 'right' : 'down'}`;
    }
    if (kind === 'trainer') return `soldier_idle_${e.dir || 'down'}`;
    return null;
  };

  // ---------- Zeichnen ----------
  function rectScreen(r) { const a = V.tileToScreen(r[0], r[1]); return [a.x, a.y, r[2] * TILE * V.scale, r[3] * TILE * V.scale]; }
  function label(text, x, y, color = '#fff') {
    ctx.font = '600 12px system-ui, sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function zone(r, color, text, dashed) {
    const [x, y, w, h] = rectScreen(r);
    ctx.fillStyle = color.replace(')', ',.16)').replace('rgb', 'rgba'); ctx.fillRect(x, y, w, h);
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; if (dashed) ctx.setLineDash([6, 4]); ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.restore();
    if (text) label(text, x + 4, y + 14, color);
  }
  function render() {
    const m = editor.map();
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0d18'; ctx.fillRect(0, 0, W, H);
    if (!m) return;
    if (V.cacheKey !== m.id + ':' + m.w + 'x' + m.h) rebuildCache();
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const o = V.worldToScreen(0, 0), S = V.scale;
    // Sockel-Schatten
    ctx.fillStyle = '#05060c'; ctx.fillRect(o.x + 6, o.y + 6, m.w * TILE * S, m.h * TILE * S);
    ctx.drawImage(V.cache, o.x, o.y, m.w * TILE * S, m.h * TILE * S);
    // Raster
    if (V.showGrid && S >= 1.5) {
      ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= m.w; x++) { const sx = Math.round(o.x + x * TILE * S) + 0.5; ctx.moveTo(sx, o.y); ctx.lineTo(sx, o.y + m.h * TILE * S); }
      for (let y = 0; y <= m.h; y++) { const sy = Math.round(o.y + y * TILE * S) + 0.5; ctx.moveTo(o.x, sy); ctx.lineTo(o.x + m.w * TILE * S, sy); }
      ctx.stroke();
    }
    if (V.showHeights && S >= 1.2) {
      ctx.font = `600 ${Math.round(Math.min(14, 7 * S))}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const h = V.grid.height[y * m.w + x]; if (!h) continue;
        const s = V.tileToScreen(x + 0.5, y + 0.5); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(h, s.x + 1, s.y + 1); ctx.fillStyle = '#ffe9b0'; ctx.fillText(h, s.x, s.y);
      }
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
    const layers = editor.layersVisible;
    // Zonen
    if (layers.zones) {
      for (const z of m.encounters) zone(z.rect, 'rgb(110,220,120)', `🐾 ${z.id}`, true);
      for (const e of m.events) if (e.trigger?.rect) zone(e.trigger.rect, 'rgb(200,140,240)', `⚡ ${e.id}`, true);
      if (m.farm?.rect) zone(m.farm.rect, 'rgb(230,180,90)', '🌱 Hof', true);
      for (const w of m.warps) zone(w.rect, 'rgb(100,200,240)', `➜ ${w.to?.map || '?'}${w.to?.spawn ? ':' + w.to.spawn : ''}`);
    }
    // Sprites, nach y sortiert
    const list = [];
    for (const e of m.objects) if (e.x != null) list.push(['object', e]);
    for (const e of m.items) list.push(['item', e]);
    for (const e of m.npcs) list.push(['npc', e]);
    for (const e of m.trainers) list.push(['trainer', e]);
    list.sort((a, b) => a[1].y - b[1].y);
    if (layers.objects) for (const [k, e] of list) drawSprite(V.spriteFor(k, e), e.x, e.y, editor.ghost && editor.ghost === e ? 0.5 : 1);
    // Trainer-Sichtlinie
    if (layers.objects) for (const t of m.trainers) {
      const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[t.dir || 'down'];
      const a = V.worldToScreen(t.x, t.y - 6), b = V.worldToScreen(t.x + d[0] * (t.sight ?? 64), t.y - 6 + d[1] * (t.sight ?? 64));
      ctx.save(); ctx.strokeStyle = 'rgba(255,120,90,.8)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
    }
    // Spawns
    for (const [name, s] of Object.entries(m.spawns)) {
      const p = V.worldToScreen(s.x, s.y);
      ctx.fillStyle = name === editor.doc.project.start?.spawn && m.id === editor.doc.project.start?.map ? '#f0c060' : '#9ad0ff';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 18); ctx.lineTo(p.x + 11, p.y - 14); ctx.lineTo(p.x, p.y - 10); ctx.fill();
      ctx.strokeStyle = '#000a'; ctx.lineWidth = 1; ctx.stroke();
      label(name, p.x + 4, p.y + 12, ctx.fillStyle);
    }
    // Auswahl
    const sel = editor.sel;
    if (sel) {
      const b = editor.boundsOf(sel);
      if (b) { ctx.save(); ctx.strokeStyle = '#f0c060'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); const a = V.worldToScreen(b.x, b.y); ctx.strokeRect(a.x - 2, a.y - 2, b.w * S + 4, b.h * S + 4); ctx.restore(); }
    }
    // Werkzeug-Overlay (Pinsel-Vorschau, Rechteck ziehen …)
    try { editor.tool?.overlay?.(ctx, V); } catch (e) { console.warn(e); }
    for (const fn of editor.overlays) { try { fn(ctx, V); } catch (e) { console.warn('[editor] overlay', e); } }
  }
  function loop() { if (needs) { needs = false; render(); } requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  window.addEventListener('resize', V.resize);
  new ResizeObserver(() => V.resize()).observe(canvas);
  V.resize();
  return V;
}
