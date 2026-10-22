// 2.5D diorama renderer.
// - Height levels: a cell with height h is drawn LEVEL*h px higher; cliff faces fill the gap to lower south neighbours.
// - Draw order: all floor (h=0) cells first, then row by row: raised cells (tops + faces), then drawables of that row.
//   This gives correct occlusion of things standing behind cliffs while flat floor never hides sprites.
// - Diorama dressing: plinth with earth cross-section, drop shadow, rim lighting, ambient occlusion,
//   tilt-shift blur bands and vignette.
import { TILE, LEVEL } from './constants.js';

export function createRenderer(canvas, assets) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const flashCache = new WeakMap();
  const blurCanvas = document.createElement('canvas');
  const bctx = blurCanvas.getContext('2d');
  const maskCanvas = document.createElement('canvas');
  const mctx = maskCanvas.getContext('2d');
  let time = 0;
  let plinthPattern = null;
  let plinthKey = '';

  const R = {
    ctx, assets, time: 0,
    tiltShift: true,
    vignette: true,
    debug: false,
    stats: { tiles: 0, sprites: 0 },
    sprite(img, x, y, z = 0, o = {}) {
      if (!img) return;
      const ax = img.ax ?? (img.width >> 1);
      const ay = img.ay ?? img.height - 1;
      let dx = Math.round(x - ax), dy = Math.round(y - z * LEVEL - (o.hop || 0) - ay);
      let src = o.flash ? flashOf(img) : img;
      const a = o.alpha ?? 1;
      if (a <= 0) return;
      if (a !== 1) ctx.globalAlpha = a;
      if (o.flip) {
        ctx.save();
        ctx.translate(Math.round(x) * 2, 0);
        ctx.scale(-1, 1);
        dx = Math.round(x - (img.width - ax));
        ctx.drawImage(src, dx, dy);
        ctx.restore();
      } else {
        ctx.drawImage(src, dx, dy);
      }
      if (a !== 1) ctx.globalAlpha = 1;
      R.stats.sprites++;
    },
    shadow(x, y, z = 0, rx = 6, ry, alpha = 0.28) {
      ry = ry ?? Math.max(2, Math.round(rx * 0.45));
      const sy = Math.round(y - z * LEVEL);
      ctx.fillStyle = `rgba(16,12,32,${alpha})`;
      // pixel-ish ellipse: stacked rects instead of antialiased arc
      for (let i = -ry; i <= ry; i++) {
        const w = Math.round(rx * Math.sqrt(1 - (i * i) / ((ry + 0.5) * (ry + 0.5))));
        ctx.fillRect(Math.round(x) - w, sy + i, w * 2, 1);
      }
    },
  };

  function flashOf(img) {
    let c = flashCache.get(img);
    if (!c) {
      c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      c.ax = img.ax; c.ay = img.ay;
      flashCache.set(img, c);
    }
    return c;
  }

  function tileImg(id, tx, ty) {
    const arr = assets.tiles[id];
    if (!arr || !arr.length) return null;
    if (arr.length === 1) return arr[0];
    if (arr.mode === 'variant') return arr[hash(tx, ty) % arr.length];
    const fps = arr.fps || 4;
    // offset phase a little per cell for water shimmer
    return arr[(Math.floor(time * fps) + (arr.phase ? hash(tx, ty) : 0)) % arr.length];
  }
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return (h ^ (h >> 16)) >>> 0; }

  function drawCell(world, tx, ty, h) {
    const id = world.tileAt(tx, ty);
    const img = tileImg(id, tx, ty);
    const px = tx * TILE, py = ty * TILE - h * LEVEL;
    if (img) ctx.drawImage(img, px, py);
    else { ctx.fillStyle = '#f0f'; ctx.fillRect(px, py, TILE, TILE); }
    R.stats.tiles++;
    // ambient occlusion: darken where higher neighbours meet this cell
    const hw = world.heightAt(tx - 1, ty), hn = world.heightAt(tx, ty - 1);
    if (hw > h && world.inside(tx - 1, ty)) { ctx.fillStyle = 'rgba(20,16,40,0.22)'; ctx.fillRect(px, py, 4, TILE); ctx.fillRect(px, py, 2, TILE); }
    if (hn > h && world.inside(tx, ty - 1)) { ctx.fillStyle = 'rgba(20,16,40,0.25)'; ctx.fillRect(px, py, TILE, 3); ctx.fillRect(px, py, TILE, 1); }
    if (h > 0) {
      // rim light on edges dropping off (top-left key light)
      const he = world.heightAt(tx + 1, ty);
      if (hn < h) { ctx.fillStyle = 'rgba(255,250,220,0.35)'; ctx.fillRect(px, py, TILE, 1); }
      if (hw < h) { ctx.fillStyle = 'rgba(255,250,220,0.22)'; ctx.fillRect(px, py, 1, TILE); }
      if (he < h) { ctx.fillStyle = 'rgba(20,16,40,0.35)'; ctx.fillRect(px + TILE - 1, py, 1, TILE); }
    }
  }

  function drawFace(world, tx, ty, h, hs) {
    // cliff face from this cell's raised top down to the south neighbour's level
    const n = h - hs;
    if (n <= 0) return;
    const faces = assets.faces[world.face] || assets.faces.rock;
    const px = tx * TILE;
    for (let i = 0; i < n; i++) {
      const py = (ty + 1) * TILE - h * LEVEL + i * LEVEL;
      let img = faces?.[0];
      if (faces && faces.length >= 3 && n >= 2) img = i === 0 ? faces[0] : i === n - 1 ? faces[2] : faces[1];
      if (img) ctx.drawImage(img, px, py);
      else { ctx.fillStyle = '#6b5a48'; ctx.fillRect(px, py, TILE, LEVEL); }
    }
    // side shading on face ends
    const top = (ty + 1) * TILE - h * LEVEL, hgt = n * LEVEL;
    if (world.heightAt(tx - 1, ty) < h && world.heightAt(tx - 1, ty + 1) <= hs) { ctx.fillStyle = 'rgba(255,240,210,0.12)'; ctx.fillRect(px, top, 1, hgt); }
    if (world.heightAt(tx + 1, ty) < h && world.heightAt(tx + 1, ty + 1) <= hs) { ctx.fillStyle = 'rgba(10,8,24,0.3)'; ctx.fillRect(px + TILE - 1, top, 1, hgt); }
  }

  function ensurePlinth(material) {
    if (plinthPattern && plinthKey === material) return;
    plinthKey = material;
    const art = assets.faces['plinth_' + material];
    if (art && art[0]) { plinthPattern = ctx.createPattern(art[0], 'repeat'); return; }
    // fallback: procedural earth strata
    const c = document.createElement('canvas'); c.width = 32; c.height = 40;
    const g = c.getContext('2d');
    const bands = material === 'stone'
      ? ['#5a5670', '#4a4660', '#3c3852', '#302c44', '#26223a']
      : ['#7a5236', '#6a4630', '#58392a', '#463024', '#36261e'];
    bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 8, 32, 8); });
    for (let i = 0; i < 26; i++) {
      g.fillStyle = i % 3 ? 'rgba(0,0,0,0.18)' : 'rgba(255,230,190,0.16)';
      g.fillRect((i * 13) % 32, (i * 7) % 40, 2 + (i % 3), 1 + (i % 2));
    }
    plinthPattern = ctx.createPattern(c, 'repeat');
  }

  function drawDiorama(world) {
    const PL = 28; // plinth depth in world px
    const W = world.pxW, H = world.pxH;
    ensurePlinth(world.plinth || 'earth');
    // table drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(6, 10, W, H + PL);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(3, 6, W + 6, H + PL + 2);
    // plinth front
    ctx.save();
    ctx.translate(0, H);
    ctx.fillStyle = plinthPattern;
    ctx.fillRect(0, 0, W, PL);
    ctx.restore();
    // lip & bottom edge
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, H, W, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, H + PL - 2, W, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, H + PL - 3, W, 1);
    // side edges
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(W - 1, -LEVEL * 4, 1, H + PL + LEVEL * 4);
  }

  function drawBackground() {
    const w = canvas.width, h = canvas.height;
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.75);
    g.addColorStop(0, '#2d3550');
    g.addColorStop(1, '#0d0f1c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function postFX(cam) {
    const w = canvas.width, h = canvas.height;
    if (R.tiltShift) {
      // strength grows with zoom-in: miniature/diorama look
      const strength = Math.min(1, Math.max(0.25, (cam.scale - 1) / 4));
      const bw = Math.max(1, Math.round(w / 6)), bh = Math.max(1, Math.round(h / 6));
      if (blurCanvas.width !== bw || blurCanvas.height !== bh) { blurCanvas.width = bw; blurCanvas.height = bh; }
      if (maskCanvas.width !== bw || maskCanvas.height !== bh) { maskCanvas.width = bw; maskCanvas.height = bh; }
      bctx.imageSmoothingEnabled = true;
      bctx.globalCompositeOperation = 'source-over';
      bctx.drawImage(canvas, 0, 0, bw, bh);
      bctx.globalCompositeOperation = 'destination-in';
      const g = bctx.createLinearGradient(0, 0, 0, bh);
      g.addColorStop(0, `rgba(0,0,0,${0.95 * strength})`);
      g.addColorStop(0.22, 'rgba(0,0,0,0)');
      g.addColorStop(0.78, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.95 * strength})`);
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, bw, bh);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(blurCanvas, 0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
    }
    if (R.vignette) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(8,6,20,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  R.render = function render(world, drawables, cam, dt, overlay) {
    time += dt; R.time = time;
    R.stats.tiles = R.stats.sprites = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawBackground();
    if (!world) return;
    const s = cam.scale;
    // pixel-snap the camera so world pixels land on device pixels
    const camX = Math.round((cam.x + cam.ox) * s) / s, camY = Math.round((cam.y + cam.oy) * s) / s;
    ctx.setTransform(s, 0, 0, s, Math.round(cam.viewW / 2 - camX * s), Math.round(cam.viewH / 2 - camY * s));
    drawDiorama(world);

    const vw = cam.viewW / s, vh = cam.viewH / s;
    const maxH = world.maxHeight ?? (world.maxHeight = Math.max(0, ...world.height));
    const x0 = Math.max(0, Math.floor((camX - vw / 2) / TILE) - 1);
    const x1 = Math.min(world.w - 1, Math.ceil((camX + vw / 2) / TILE) + 1);
    const y0 = Math.max(0, Math.floor((camY - vh / 2) / TILE) - 1);
    const y1 = Math.min(world.h - 1, Math.ceil((camY + vh / 2) / TILE) + 1 + maxH);

    // pass 1: floor
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (world.heightAt(tx, ty) === 0) drawCell(world, tx, ty, 0);

    // bucket drawables by row
    const rows = new Map();
    const minRow = y0, maxRow = y1;
    for (const d of drawables) {
      if (!d || d.hidden) continue;
      let r = Math.floor(d.y / TILE);
      if (d.layer === 'top') r = maxRow + 1;           // always on top (e.g. flying fx)
      else if (d.layer === 'floor') r = minRow - 1;    // flat decals under everything
      r = Math.max(minRow - 1, Math.min(maxRow + 1, r));
      if (!rows.has(r)) rows.set(r, []);
      rows.get(r).push(d);
    }
    const drawRow = (r) => {
      const list = rows.get(r);
      if (!list) return;
      list.sort((a, b) => (a.y + (a.sortBias || 0)) - (b.y + (b.sortBias || 0)));
      for (const d of list) {
        if (d.shadow) R.shadow(d.x, d.y, d.z || 0, typeof d.shadow === 'number' ? d.shadow : 6);
        d.draw(ctx, R);
      }
    };
    drawRow(minRow - 1);
    // pass 2: rows
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const h = world.heightAt(tx, ty);
        if (h > 0) {
          drawCell(world, tx, ty, h);
          drawFace(world, tx, ty, h, ty + 1 < world.h ? world.heightAt(tx, ty + 1) : 0);
        }
      }
      drawRow(ty);
    }
    drawRow(maxRow + 1);

    if (R.debug) {
      ctx.strokeStyle = 'rgba(255,0,255,0.4)'; ctx.lineWidth = 1 / s;
      for (const d of drawables) if (d.hitbox) { const b = d.hitbox(); ctx.strokeRect(b.x, b.y - (d.z || 0) * LEVEL, b.w, b.h); }
    }
    if (overlay) overlay(ctx, R);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    postFX(cam);
  };

  return R;
}
