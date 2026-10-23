// HD-2D renderer (Three.js): 3D terrain with pixel textures, upright pixel-sprite billboards,
// sun light with shadow maps, wind-swept foliage, 3D houses, depth-of-field, bloom and color grading.
// Keeps the 2D renderer's API: render(world, drawables, cam, dt, overlay) and the drawable helper r.sprite/r.shadow,
// so gameplay, animation and FX code draw exactly as before.
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { TILE, LEVEL } from './constants.js';
import { TILE_DEFS } from '../data/tiles.js';
import { createModelFactory, houseTextures as houseTexturesFallback } from './models3d.js';

const WALL_LEVELS = 2;      // solid wall tiles are raised blocks of this many levels
const PLINTH = 40;          // diorama base depth (world px)
const DEG = Math.PI / 180;

export function createRenderer3D(canvas, assets, opts = {}) {
  const mobile = opts.mobile ?? matchMedia('(pointer: coarse)').matches;
  const gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  gl.setPixelRatio(1);
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  gl.toneMapping = THREE.NoToneMapping;
  gl.autoClear = true;

  // overlay canvas for screen-space 2D (fades etc.)
  const ov = document.createElement('canvas');
  ov.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;image-rendering:pixelated';
  canvas.after(ov);
  const octx = ov.getContext('2d');

  const scene = new THREE.Scene();
  const BG = new THREE.Color('#141a2c');
  const HAZE = new THREE.Color('#a8bcc8');
  // sky gradient behind the haze (screen-space background)
  const SKY = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 128;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#8fb0c8'); gr.addColorStop(0.55, '#c8d4d0'); gr.addColorStop(1, '#d8e0d8');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 600, 1800);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 8, 4000);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight('#9ec4e8', '#5a4a3a', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe2b0', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 1.2;
  sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  const SUN_DIR = new THREE.Vector3(-0.6, 0.52, 0.3).normalize(); // top-left, slightly from the front, ~38° high: long shadows
  const torchLights = [];
  for (let i = 0; i < 6; i++) {
    const l = new THREE.PointLight('#ffa040', 0, 110, 1.6);
    scene.add(l); torchLights.push(l);
  }

  // ---------- textures ----------
  const texCache = new WeakMap();
  function tex(c, repeat = false) {
    let t = texCache.get(c);
    if (!t) {
      t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      texCache.set(c, t);
    }
    return t;
  }
  const spriteKey = new Map(); // canvas -> sprite key
  for (const [k, arr] of Object.entries(assets.sprites || {})) for (const c of arr || []) if (c && !spriteKey.has(c)) spriteKey.set(c, k);
  const sp = (k) => assets.sprites?.[k]?.[0];
  const models3d = createModelFactory({ tex, sp, mobile });
  const MODEL_KEYS = { tree: ['tree', 'green', 0.82], tree_autumn: ['tree', 'autumn', 0.85], tree_pine: ['tree', 'pine', 0.85], tree_small: ['tree', 'green', 0.55], bush: ['bush', null, 1] };

  // ---------- state per world ----------
  let cur = null;
  let waterAnim = null; // { world, group, groundCanvas, groundTex, animCells, deco }
  let time = 0;

  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return (h ^ (h >> 16)) >>> 0; }
  const isWall = (id) => id === 'dungeon_wall';
  const effH = (world, tx, ty) => {
    if (!world.inside(tx, ty)) return -Infinity;
    const id = world.tileAt(tx, ty);
    if (id === 'void') return -Infinity;
    if (!isWall(id)) return world.heightAt(tx, ty);
    // south-facing room walls (floor behind them to the north) stay low so the room stays visible
    const nid = world.inside(tx, ty - 1) ? world.tileAt(tx, ty - 1) : 'void';
    const southWall = !isWall(nid) && nid !== 'void' && !TILE_DEFS[nid]?.solid;
    const below = world.inside(tx, ty + 1) ? world.tileAt(tx, ty + 1) : 'void';
    const outerSouth = !world.inside(tx, ty + 1) || below === 'void';
    return world.heightAt(tx, ty) + (southWall || outerSouth ? 0.42 : WALL_LEVELS);
  };
  // top surface height in world units; water beds are recessed so banks get little earth walls
  const topY = (world, tx, ty) => {
    const e = effH(world, tx, ty);
    if (e === -Infinity) return -Infinity;
    const d = TILE_DEFS[world.tileAt(tx, ty)];
    return e * LEVEL - (d?.water ? 7 : d?.shallow ? 3 : 0);
  };

  // ----- ground texture (top faces), composited in 2D with terrain edge overlays -----
  function tileFrame(id, tx, ty) {
    const arr = assets.tiles[id];
    if (!arr || !arr.length) return null;
    if (arr.length === 1) return arr[0];
    if (arr.mode === 'variant') return arr[hash(tx, ty) % arr.length];
    return arr[0];
  }
  const RES = assets.tileRes || 16;        // texels per tile in art
  const KF = RES / TILE;                    // texels per world unit
  const SIDES = [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]];
  // Ground is composed in a plain RGBA buffer (no canvas read-backs): tile pixels + art edge overlays.
  function paintCell(world, buf, tx, ty) {
    const id = world.tileAt(tx, ty);
    const d = buf.data, W = buf.width;
    const img = tileFrame(id, tx, ty);
    const src = img ? pixelsOf(img) : null;
    for (let y = 0; y < RES; y++) {
      const row = ((ty * RES + y) * W + tx * RES) * 4;
      if (src) d.set(src.subarray(y * RES * 4, (y + 1) * RES * 4), row);
      else for (let x = 0; x < RES; x++) { const k = row + x * 4; d[k] = 88; d[k + 1] = 168; d[k + 2] = 56; d[k + 3] = 255; }
    }
    const edges = assets.edges;
    if (!edges) return;
    const grp = assets.edgeGroup || {}, pri = assets.edgePriority || {};
    const g0 = grp[id] || id, p0 = pri[g0] ?? 0, h = world.heightAt(tx, ty);
    for (const [side, dx, dy] of SIDES) {
      const nx = tx + dx, ny = ty + dy;
      if (!world.inside(nx, ny) || world.heightAt(nx, ny) !== h) continue;
      const nid = world.tileAt(nx, ny), g1 = grp[nid] || nid;
      if (g1 === g0 || (pri[g1] ?? 0) <= p0) continue;
      if (SOFT.has(g0) && SOFT.has(g1)) continue; // organic blend handles these
      let e = edges[`${g1}_${side}@${g0}`] || edges[`${g1}_${side}`];
      if (Array.isArray(e)) e = e[0];
      if (!e) continue;
      const ep = pixelsOf(e);
      for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
        const sk = (y * RES + x) * 4, a = ep[sk + 3];
        if (!a) continue;
        const k = ((ty * RES + y) * W + tx * RES + x) * 4, f = a / 255;
        d[k] += (ep[sk] - d[k]) * f; d[k + 1] += (ep[sk + 1] - d[k + 1]) * f; d[k + 2] += (ep[sk + 2] - d[k + 2]) * f;
      }
    }
  }
  // ----- organic terrain blending -----
  const SOFT = new Set(['grass', 'grass_dark', 'grass_light', 'grass_flowers', 'grass_tall', 'path', 'dirt', 'sand', 'clearing', 'stone_floor']);
  const NEIGH8 = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  const vn = (x, y) => { // value noise in [0,1]
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const r = (a, b) => (hash(a, b) % 10000) / 10000;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (r(xi, yi) * (1 - u) + r(xi + 1, yi) * u) * (1 - v) + (r(xi, yi + 1) * (1 - u) + r(xi + 1, yi + 1) * u) * v;
  };
  const fbm = (x, y) => vn(x, y) * 0.6 + vn(x * 2.3 + 17, y * 2.3 + 5) * 0.3 + vn(x * 5.1 + 3, y * 5.1 + 11) * 0.1;
  // Pixel cache of tile images at RES×RES
  const pixCache = new WeakMap();
  let pixC = null, pixG = null;
  function pixelsOf(img) {
    let a = pixCache.get(img);
    if (a) return a;
    if (!pixC) { pixC = document.createElement('canvas'); pixC.width = pixC.height = RES; pixG = pixC.getContext('2d', { willReadFrequently: true }); }
    pixG.clearRect(0, 0, RES, RES); pixG.drawImage(img, 0, 0, RES, RES);
    a = pixG.getImageData(0, 0, RES, RES).data;
    pixCache.set(img, a);
    return a;
  }
  // Blend soft transitions for cells in [x0..x1]×[y0..y1] into the ground canvas (one read-back + write per call)
  function blendRegion(world, buf, x0, y0, x1, y1) {
    const grp = assets.edgeGroup || {}, pri = assets.edgePriority || {};
    const W = buf.width, d = buf.data;
    const depthG = RES * 0.62, depthO = RES * 0.5, rimW = Math.max(1, RES / 24);
    // precomputed noise field (one sample per 3 texels) for the whole map
    const NS = 3, nw = Math.ceil((world.w * RES) / NS) + 1;
    if (!world._blendNoise) {
      const nh = Math.ceil((world.h * RES) / NS) + 1, f = new Float32Array(nw * nh);
      for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
        const gx = x * NS, gy = y * NS;
        f[y * nw + x] = vn(gx / (RES * 0.33), gy / (RES * 0.33)) * 0.7 + vn(gx / (RES * 0.12) + 7, gy / (RES * 0.12) + 3) * 0.3;
      }
      world._blendNoise = f;
    }
    const NF = world._blendNoise;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const id = world.tileAt(tx, ty), g0 = grp[id] || id;
      if (!SOFT.has(g0)) continue;
      const p0 = pri[g0] ?? 0, h = world.heightAt(tx, ty);
      for (const [dx, dy] of NEIGH8) {
        const nx = tx + dx, ny = ty + dy;
        if (!world.inside(nx, ny) || world.heightAt(nx, ny) !== h) continue;
        const nid = world.tileAt(nx, ny), g1 = grp[nid] || nid;
        if (g1 === g0 || !SOFT.has(g1) || (pri[g1] ?? 0) <= p0) continue;
        if (dx && dy) {
          const ia = world.tileAt(tx + dx, ty), ib = world.tileAt(tx, ty + dy);
          if ((grp[ia] || ia) === g1 || (grp[ib] || ib) === g1) continue;
        }
        const src = pixelsOf(tileFrame(nid, nx, ny));
        const isGrass = g1.startsWith('grass'), depth = isGrass ? depthG : depthO;
        const ox = tx * RES, oy = ty * RES;
        for (let y = 0; y < RES; y++) {
          const ddy = dy < 0 ? y : RES - 1 - y;
          if (!dx && ddy > depth + rimW) continue;
          for (let x = 0; x < RES; x++) {
            const ddx = dx < 0 ? x : RES - 1 - x;
            const dist = dx && dy ? Math.hypot(ddx, ddy) * 1.15 : dx ? ddx : ddy;
            if (dist > depth + rimW) continue;
            const n = NF[(((ty * RES + y) / NS) | 0) * nw + (((tx * RES + x) / NS) | 0)];
            const reach = depth * (0.15 + 0.95 * n);
            const k = ((oy + y) * W + ox + x) * 4;
            if (dist < reach) { const sk = (y * RES + x) * 4; d[k] = src[sk]; d[k + 1] = src[sk + 1]; d[k + 2] = src[sk + 2]; }
            else if (dist < reach + rimW) {
              if (isGrass) { d[k] = d[k] * 0.62 + 6; d[k + 1] = d[k + 1] * 0.62 + 8; d[k + 2] = d[k + 2] * 0.62; }
              else { d[k] = d[k] * 0.85 + 34; d[k + 1] = d[k + 1] * 0.85 + 30; d[k + 2] = d[k + 2] * 0.85 + 22; }
            }
          }
        }
      }
    }
  }
  function isAnimatedCell(world, tx, ty) {
    const a = assets.tiles[world.tileAt(tx, ty)];
    if (a && a.length > 1 && a.mode !== 'variant') return true;
    for (const [, dx, dy] of SIDES) {
      const b = assets.tiles[world.tileAt(tx + dx, ty + dy)];
      if (b && b.length > 1 && b.mode !== 'variant') return true; // animated edge overlays
    }
    return false;
  }

  // ----- cliff face atlas: one strip per (face id, n levels, variant) -----
  const faceStrips = new Map();
  let faceAtlas = null, faceTex = null;
  function buildFaceAtlas(maxN) {
    const ids = ['rock', 'dirt', 'brick'];
    const V = 3;
    const H = maxN * LEVEL * KF;
    if (assets.faces?.stairs) ids.push('stairs');
    const cols = ids.length * maxN * V;
    faceAtlas = document.createElement('canvas');
    faceAtlas.width = cols * RES; faceAtlas.height = H;
    const g = faceAtlas.getContext('2d');
    let col = 0;
    for (const id of ids) {
      const faces = assets.faces?.[id] || assets.faces?.rock;
      for (let n = 1; n <= maxN; n++) for (let v = 0; v < V; v++) {
        const x = col * RES, hgt = n * LEVEL * KF;
        const dh = (im) => im.height * (RES / im.width); // scale pieces to the strip width
        if (!faces || !faces.length) { g.fillStyle = '#6b5a48'; g.fillRect(x, 0, RES, hgt); }
        else if (n === 1 && faces[3]) g.drawImage(faces[3], x, 0, RES, dh(faces[3]));
        else {
          const fTop = faces[0], fMid = faces[1] || faces[0], fBot = faces[2] || null;
          g.save(); g.beginPath(); g.rect(x, 0, RES, hgt); g.clip();
          let y = dh(fTop), k = 0;
          const yEnd = hgt - (fBot ? dh(fBot) : 0);
          while (y < yEnd) { const m = faces.mids ? faces.mids[(v + k++) % faces.mids.length] : fMid; g.drawImage(m, x, y, RES, dh(m)); y += dh(m); }
          if (fBot) g.drawImage(fBot, x, hgt - dh(fBot), RES, dh(fBot));
          g.drawImage(fTop, x, 0, RES, dh(fTop));
          g.restore();
        }
        faceStrips.set(`${id}:${n}:${v}`, col);
        col++;
      }
    }
    faceTex = new THREE.CanvasTexture(faceAtlas);
    faceTex.magFilter = THREE.NearestFilter; faceTex.minFilter = THREE.NearestFilter; faceTex.generateMipmaps = false;
    faceTex.colorSpace = THREE.SRGBColorSpace;
    return { cols, H };
  }

  function plinthTexture(material) {
    const art = assets.faces?.['plinth_' + material]?.[0];
    let c = art;
    if (!c) {
      c = document.createElement('canvas'); c.width = 32; c.height = 40;
      const g = c.getContext('2d');
      const bands = material === 'stone' ? ['#5a5670', '#4a4660', '#3c3852', '#302c44', '#26223a'] : ['#7a5236', '#6a4630', '#58392a', '#463024', '#36261e'];
      bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 8, 32, 8); });
    }
    const t = tex(c, true);
    return { t, w: c.width, h: c.height };
  }

  // ----- terrain mesh -----
  function buildWorld(world, drawables) {
    if (cur) { scene.remove(cur.group); cur.group.traverse((o) => { o.geometry?.dispose?.(); }); cur.groundTex.dispose(); }
    const group = new THREE.Group();
    waterAnim = null;
    const W = world.w, Hh = world.h;
    const gc = document.createElement('canvas'); gc.width = W * RES; gc.height = Hh * RES;
    const g = gc.getContext('2d');
    const buf = g.createImageData(gc.width, gc.height);
    const animCells = [];
    for (let ty = 0; ty < Hh; ty++) for (let tx = 0; tx < W; tx++) {
      paintCell(world, buf, tx, ty);
      // ground is static (animated tiles use frame 0; water animates on its own surface, foliage via blades)
    }
    blendRegion(world, buf, 0, 0, W - 1, Hh - 1);
    g.putImageData(buf, 0, 0);
    const groundTex = new THREE.CanvasTexture(gc);
    groundTex.magFilter = THREE.NearestFilter;
    groundTex.minFilter = THREE.LinearMipmapLinearFilter;
    groundTex.anisotropy = gl.capabilities.getMaxAnisotropy();
    groundTex.colorSpace = THREE.SRGBColorSpace;

    let maxN = 1;
    for (let ty = 0; ty < Hh; ty++) for (let tx = 0; tx < W; tx++) { const e = effH(world, tx, ty); if (e > -Infinity) maxN = Math.max(maxN, Math.ceil(e) + 1); }
    const atlas = buildFaceAtlas(maxN);

    const top = { p: [], n: [], uv: [] }, side = { p: [], n: [], uv: [] }, base = { p: [], n: [], uv: [] };
    const quad = (o, a, b, c, d, nrm, ua, ub, uc, ud) => {
      o.p.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let i = 0; i < 6; i++) o.n.push(...nrm);
      o.uv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
    };
    const pl = plinthTexture(world.plinth || 'earth');
    for (let ty = 0; ty < Hh; ty++) for (let tx = 0; tx < W; tx++) {
      const e = effH(world, tx, ty);
      if (e === -Infinity) continue;
      const y = topY(world, tx, ty), x0 = tx * TILE, x1 = x0 + TILE, z0 = ty * TILE, z1 = z0 + TILE;
      const u0 = tx / W, u1 = (tx + 1) / W, v0 = 1 - ty / Hh, v1 = 1 - (ty + 1) / Hh;
      quad(top, [x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], [0, 1, 0], [u0, v0], [u0, v1], [u1, v1], [u1, v0]);
      const tid = world.tileAt(tx, ty);
      const fid = isWall(tid) ? 'brick' : TILE_DEFS[tid]?.stairs && assets.faces?.stairs ? 'stairs' : (assets.faces?.[world.face] ? world.face : 'rock');
      // sides: [dx, dz, corner a, corner b, normal]
      const sides = [
        [0, 1, [x0, z1], [x1, z1], [0, 0, 1]],
        [0, -1, [x1, z0], [x0, z0], [0, 0, -1]],
        [-1, 0, [x0, z0], [x0, z1], [-1, 0, 0]],
        [1, 0, [x1, z1], [x1, z0], [1, 0, 0]],
      ];
      for (const [dx, dz, a, b, nrm] of sides) {
        let yb = topY(world, tx + dx, ty + dz);
        const outside = yb === -Infinity;
        if (outside) yb = 0;
        if (yb < y - 0.01) {
          const dyU = y - yb, n = Math.max(1, Math.ceil(dyU / LEVEL - 0.01));
          const ffid = dyU < LEVEL * 0.5 && fid !== 'brick' ? (assets.faces?.dirt ? 'dirt' : fid) : fid;
          const col = faceStrips.get(`${ffid}:${Math.min(n, maxN)}:${hash(tx, ty + dx * 7) % 3}`) ?? 0;
          const ua = col / atlas.cols, ub = (col + 1) / atlas.cols;
          const vt = 1, vb = 1 - (dyU * KF) / atlas.H;
          quad(side, [a[0], y, a[1]], [a[0], yb, a[1]], [b[0], yb, b[1]], [b[0], y, b[1]], nrm, [ua, vt], [ua, vb], [ub, vb], [ub, vt]);
        }
        if (outside) {
          // diorama plinth below ground level on the map border
          const len = (TILE * KF) / pl.w, along = (dx !== 0 ? ty : tx) * len;
          const yTop = Math.min(0, y);
          quad(base, [a[0], yTop, a[1]], [a[0], -PLINTH, a[1]], [b[0], -PLINTH, b[1]], [b[0], yTop, b[1]], nrm,
            [along, 1], [along, 1 - (PLINTH * KF) / pl.h], [along + len, 1 - (PLINTH * KF) / pl.h], [along + len, 1]);
        }
      }
    }
    const mk = (o, mat) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      return m;
    };
    mk(top, new THREE.MeshLambertMaterial({ map: groundTex }));
    // glossy translucent water surface over recessed water beds
    const wat = { p: [], n: [], uv: [] };
    for (let ty = 0; ty < Hh; ty++) for (let tx = 0; tx < W; tx++) {
      const d = TILE_DEFS[world.tileAt(tx, ty)];
      if (!d?.water && !d?.shallow) continue;
      const y = effH(world, tx, ty) * LEVEL - 1.5, x0 = tx * TILE, z0 = ty * TILE;
      quad(wat, [x0, y, z0], [x0, y, z0 + TILE], [x0 + TILE, y, z0 + TILE], [x0 + TILE, y, z0], [0, 1, 0], [tx, -ty], [tx, -ty - 1], [tx + 1, -ty - 1], [tx + 1, -ty]);
    }
    if (wat.p.length) {
      const frames = (assets.tiles.water || []).map((c) => { const t = tex(c, true).clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t; });
      const wmat = new THREE.MeshPhongMaterial({ map: frames[0] || null, color: frames.length ? '#b0c8d8' : '#1c4878', specular: '#ffe8c0', shininess: 110, transparent: true, opacity: 0.72, depthWrite: false });
      const wm = mk(wat, wmat);
      wm.castShadow = false; wm.renderOrder = 2;
      waterAnim = { mat: wmat, frames, fps: assets.tiles.water?.fps || 4 };
    }
    mk(side, new THREE.MeshLambertMaterial({ map: faceTex }));
    mk(base, new THREE.MeshLambertMaterial({ map: pl.t, color: '#b0a090' }));
    // table under the diorama
    const table = new THREE.Mesh(new THREE.PlaneGeometry(world.pxW + 4000, world.pxH + 4000), new THREE.MeshLambertMaterial({ color: '#1a2030' }));
    table.rotation.x = -Math.PI / 2; table.position.set(world.pxW / 2, -PLINTH - 0.5, world.pxH / 2);
    table.receiveShadow = true;
    group.add(table);

    const dark = world.dark ?? (world.face === 'brick' || world.plinth === 'stone');
    // open world look: the land continues beyond the map edge (grass + forest ring, fading into haze)
    const surround = !dark && world.surround !== false;
    if (surround) buildSurround(world, group);
    table.visible = !surround;

    scene.add(group);
    cur = { world, group, groundCanvas: gc, groundCtx: g, groundBuf: buf, groundTex, animCells, deco: null, frameKey: -1, dark, version: world.version };
    buildDeco(world, drawables);
    world.dirty.length = 0;
  }

  function buildSurround(world, group) {
    const W = world.pxW, H = world.pxH, M = 1400;
    const gimg = assets.tiles.grass_dark?.[0] || assets.tiles.grass?.[0];
    const gt = gimg ? tex(gimg, true).clone() : null;
    if (gt) { gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set((W + 2 * M) / 16, (H + 2 * M) / 16); gt.needsUpdate = true; }
    // four strips around the map (a single plane would cover recessed water inside the map)
    const gmat = new THREE.MeshLambertMaterial(gt ? { map: gt, color: '#c8c8b0' } : { color: '#3a5a2a' });
    for (const [x0, z0, x1, z1] of [[-M, -M, W + M, 0], [-M, H, W + M, H + M], [-M, 0, 0, H], [W, 0, W + M, H]]) {
      const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + M + uv.getX(i) * (x1 - x0)) / (W + 2 * M), (M + (H + M - z1) + uv.getY(i) * (z1 - z0)) / (H + 2 * M));
      const ground = new THREE.Mesh(geo, gmat);
      ground.rotation.x = -Math.PI / 2; ground.position.set((x0 + x1) / 2, -0.6, (z0 + z1) / 2);
      ground.receiveShadow = true;
      group.add(ground);
    }
    // forest ring: instanced 3D trees around the map (templates expanded per child mesh)
    const kinds = ['pine', 'green', 'green', 'autumn'];
    const groups = kinds.map(() => []);
    for (let i = 0; i < (mobile ? 260 : 520); i++) {
      const r1 = (hash(i, 17) % 10000) / 10000, r2 = (hash(i, 29) % 10000) / 10000;
      const x = -300 + r1 * (W + 600), z = -320 + r2 * (H + 340);
      if ((x > -14 && x < W + 14 && z > -10) || z > H - 40) continue; // keep map + camera side open
      groups[hash(i, 5) % kinds.length].push([x, z, 0.9 + (hash(i, 9) % 60) / 100, (hash(i, 11) % 628) / 100]);
    }
    const mtx = new THREE.Matrix4(), pm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    kinds.forEach((kind, ki) => {
      const pts = groups[ki];
      if (!pts.length) return;
      const tpl = models3d.tree(kind, 17 + ki * 31, 1);
      tpl.position.set(0, 0, 0); tpl.rotation.set(0, 0, 0); tpl.scale.setScalar(1); tpl.updateMatrixWorld(true);
      tpl.traverse((o) => {
        if (!o.isMesh) return;
        const im = new THREE.InstancedMesh(o.geometry, o.material, pts.length);
        pts.forEach(([x, z, s, rot], k) => {
          q.setFromAxisAngle(up, rot); sc.setScalar(s);
          pm.compose(new THREE.Vector3(x, -0.6, z), q, sc);
          mtx.multiplyMatrices(pm, o.matrixWorld);
          im.setMatrixAt(k, mtx);
        });
        im.castShadow = true; im.receiveShadow = true;
        if (o.customDepthMaterial) im.customDepthMaterial = o.customDepthMaterial;
        group.add(im);
      });
    });
  }

  // ----- foliage: instanced, wind-swept billboards scattered on grass -----
  const decoFallback = {};
  function fallbackTuft(kind) {
    if (decoFallback[kind]) return decoFallback[kind];
    const c = document.createElement('canvas'); c.width = 12; c.height = 16;
    const g = c.getContext('2d');
    const cols = kind === 'dark' ? ['#183828', '#286840', '#48a050'] : ['#286840', '#58b030', '#a8d848', '#e0f088'];
    for (let i = 0; i < 7; i++) {
      const bx = 1 + ((i * 5) % 10), bh = 7 + ((i * 7) % 9), lean = (i % 3) - 1;
      for (let y = 0; y < bh; y++) {
        const col = cols[Math.min(cols.length - 1, Math.floor((y / bh) * cols.length))];
        g.fillStyle = col; g.fillRect(bx + Math.round((lean * y) / 5), 15 - y, 1, 1);
      }
    }
    c.ax = 6; c.ay = 15;
    return (decoFallback[kind] = c);
  }
  const windUniforms = { uTime: { value: 0 } };
  function decoMaterial(img) {
    const t = img._tex || tex(img);
    const m = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.22 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = windUniforms.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sway = sin(uTime * 1.7 + ip.x * 0.05 + ip.z * 0.07) + 0.5 * sin(uTime * 3.1 + ip.x * 0.11);
        transformed.x += sway * 0.09 * position.y * position.y;
      `);
    };
    return m;
  }
  function buildDeco(world, drawables) {
    if (cur.deco) { for (const m of cur.deco) { cur.group.remove(m); m.geometry.dispose(); } }
    const blocked = new Set();
    for (const d of drawables || []) if (d && !d.layer && d.solid !== false) blocked.add(Math.floor(d.x / TILE) + ',' + Math.floor(d.y / TILE));
    const kinds = {};
    const add = (key, x, y, z, s) => {
      const img = sp(key) || (key.includes('dark') ? fallbackTuft('dark') : key.startsWith('deco_grass') ? fallbackTuft('light') : null);
      if (!img) return;
      (kinds[key] ||= { img, list: [] }).list.push([x, y, z, s]);
    };
    const dense = mobile ? 0.6 : 1;
    for (let ty = 0; ty < world.h; ty++) for (let tx = 0; tx < world.w; tx++) {
      const id = world.tileAt(tx, ty);
      if (blocked.has(tx + ',' + ty)) continue;
      const h0 = hash(tx, ty), z = world.heightAt(tx, ty) * LEVEL;
      const rnd = (i) => (hash(tx * 31 + i, ty * 17 - i) % 1000) / 1000;
      const nearWater = SIDES.some(([, dx, dy]) => TILE_DEFS[world.tileAt(tx + dx, ty + dy)]?.water);
      let n = 0, keys = [];
      if (id === 'grass_tall') { n = 3; keys = ['deco_grass_1', 'deco_grass_2', 'deco_grass_3', 'deco_grass_4']; }
      else if (id === 'grass') { n = (h0 % 100) < 7 * dense ? 1 : 0; keys = ['deco_grass_1', 'deco_grass_2', 'deco_grass_3']; }
      else if (id === 'grass_dark') { n = (h0 % 100) < 14 * dense ? 1 : 0; keys = ['deco_grass_dark_1', 'deco_grass_dark_2', 'deco_fern_1']; }
      else if (id === 'grass_flowers') { n = 2; keys = ['deco_flower_white', 'deco_flower_yellow', 'deco_flower_pink', 'deco_flower_purple', 'deco_grass_1']; }
      if (nearWater && (id === 'grass' || id === 'sand' || id === 'grass_dark') && (h0 % 3) === 0) { n = Math.max(n, 2); keys = ['deco_reed_1', 'deco_reed_2', 'deco_grass_2']; }
      n = Math.round(n * (id === 'grass_tall' ? 1 : dense));
      for (let i = 0; i < n; i++) {
        let key = keys[hash(tx + i * 13, ty) % keys.length];
        if (!sp(key) && key.startsWith('deco_')) key = key.includes('dark') || key.includes('fern') ? 'deco_grass_dark_1' : 'deco_grass_1';
        add(key, tx * TILE + 2 + rnd(i) * 12, ty * TILE + 2 + rnd(i + 5) * 12, z, (key.startsWith('deco_flower') ? 0.6 : 0.42) + rnd(i + 9) * 0.22);
      }
    }
    cur.deco = [];
    const dummy = new THREE.Object3D();
    buildBlades(world, blocked, dummy);
    for (const [key, { img, list }] of Object.entries(kinds)) {
      const w = img.width, h = img.height, ax = img.ax ?? w / 2, ay = img.ay ?? h - 1;
      const geo = new THREE.PlaneGeometry(1, 1);
      geo.translate(0.5 - ax / w, 0.5 - (ay + 1 - h) / h - 1 + 1, 0); // origin at anchor (feet)
      geo.translate(0, -(h - 1 - ay) / h, 0);
      billboardNormals(geo);
      const mesh = new THREE.InstancedMesh(geo, decoMaterial(img), list.length);
      list.forEach(([x, y, z, s], i) => {
        dummy.position.set(x, z, y);
        dummy.scale.set(w * s * (hash(i, 3) & 1 ? -1 : 1), h * s * stretch, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.receiveShadow = true;
      mesh.castShadow = !mobile;
      mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex(img), alphaTest: 0.5 });
      mesh.userData.key = key;
      cur.group.add(mesh);
      cur.deco.push(mesh);
    }
    cur.decoStretch = stretch;
  }
  // ----- grass blades: thousands of thin, individually swaying blades (one instanced draw call) -----
  let bladeTex = null;
  function buildBlades(world, blocked, dummy) {
    if (!bladeTex) {
      const c = document.createElement('canvas'); c.width = 3; c.height = 10;
      const g = c.getContext('2d');
      const col = ['#f0f4c8', '#d8e890', '#b8d468', '#98bc50', '#78a040', '#5c8434', '#46682a', '#36522a', '#2a4224', '#22361e'];
      for (let y = 0; y < 10; y++) { g.fillStyle = col[y]; y < 3 ? g.fillRect(1, y, 1, 1) : g.fillRect(y < 6 ? 0 : 0, y, y < 6 ? 2 : 3, 1); }
      bladeTex = tex(c);
    }
    const pts = [];
    const per = mobile ? 16 : 40;
    for (let ty = 0; ty < world.h; ty++) for (let tx = 0; tx < world.w; tx++) {
      const id = world.tileAt(tx, ty);
      const grp = (assets.edgeGroup || {})[id] || id;
      if (grp !== 'grass' && grp !== 'grass_dark' && !id.startsWith('grass')) continue;
      if (blocked.has(tx + ',' + ty)) continue;
      const tall = id === 'grass_tall', dark = id === 'grass_dark';
      const n = tall ? per * 2 : dark ? per : Math.round(per * 0.8);
      const z = world.heightAt(tx, ty) * LEVEL;
      for (let i = 0; i < n; i++) {
        const r = (k) => (hash(tx * 97 + i * 7 + k, ty * 61 - i * 3) % 1000) / 1000;
        const hgt = tall ? 6 + r(1) * 6 : 2.5 + r(1) * 3.5 + (r(5) < 0.08 ? 3 : 0);
        pts.push([tx * TILE + r(2) * TILE, ty * TILE + r(3) * TILE, z, hgt, (r(4) - 0.5) * 1.6, dark ? 0.62 + r(6) * 0.2 : 0.8 + r(6) * 0.35]);
      }
    }
    if (!pts.length) return;
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0); billboardNormals(geo);
    const mat = decoMaterial({ width: 3, height: 10, _tex: bladeTex });
    const mesh = new THREE.InstancedMesh(geo, mat, pts.length);
    const color = new THREE.Color();
    pts.forEach(([x, y, z, hgt, rot, tone], i) => {
      dummy.position.set(x, z, y); dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1.1 + (i % 3) * 0.25, hgt * stretch, 1);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      // slight hue/value variation per blade (olive ↔ yellow-green)
      color.setRGB(tone * (0.95 + ((i * 7) % 10) / 60), tone, tone * (0.85 + ((i * 3) % 10) / 70));
      mesh.setColorAt(i, color);
    });
    dummy.rotation.set(0, 0, 0);
    mesh.receiveShadow = true; mesh.castShadow = false;
    cur.group.add(mesh); cur.deco.push(mesh);
  }
  function billboardNormals(geo) {
    // upright sprites are lit like the ground (soft top light) instead of by their facing direction
    const n = geo.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 0.92, 0.38);
    n.needsUpdate = true;
  }

  // ---------- billboards (sprites from drawables) ----------
  const bbGeo = new THREE.PlaneGeometry(1, 1); bbGeo.translate(0.5, 0.5, 0); billboardNormals(bbGeo);
  const floorGeo = new THREE.PlaneGeometry(1, 1); floorGeo.translate(0.5, -0.5, 0); floorGeo.rotateX(-Math.PI / 2);
  const pools = { solid: [], trans: [], floor: [] };
  const used = { solid: 0, trans: 0, floor: 0 };
  function getBB(kind) {
    const pool = pools[kind];
    let m = pool[used[kind]];
    if (!m) {
      const trans = kind !== 'solid';
      const mat = new THREE.MeshLambertMaterial({
        alphaTest: trans ? 0.02 : 0.5, transparent: trans, depthWrite: !trans || kind === 'floor', side: THREE.DoubleSide,
        emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0,
      });
      m = new THREE.Mesh(kind === 'floor' ? floorGeo : bbGeo, mat);
      if (kind === 'solid') {
        m.castShadow = true;
        m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.5 });
      }
      m.receiveShadow = kind !== 'trans';
      m.frustumCulled = false;
      scene.add(m);
      pool.push(m);
    }
    used[kind]++;
    m.visible = true;
    return m;
  }

  // ----- x-ray silhouettes (drawn only where something is in front: depthFunc = greater) -----
  const xrayPool = []; let xrayUsed = 0;
  const _toCam = new THREE.Vector3();
  const XRAY_PLAYER = [new THREE.Color('#2c4a8c'), new THREE.Color('#bcd8ff')];
  const XRAY_ENEMY = [new THREE.Color('#7a2030'), new THREE.Color('#ffb0a0')];
  function xraySprite(src, t, colors) {
    let m = xrayPool[xrayUsed];
    if (!m) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { map: { value: null }, uColor: { value: new THREE.Color('#2c4a8c') }, uRim: { value: new THREE.Color('#bcd8ff') }, uTexel: { value: new THREE.Vector2() } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `varying vec2 vUv; uniform sampler2D map; uniform vec3 uColor, uRim; uniform vec2 uTexel;
          void main(){
            float a = texture2D(map, vUv).a;
            if (a < 0.5) discard;
            // light rim where a neighbouring texel is empty -> readable outline
            float e = texture2D(map, vUv + vec2(uTexel.x, 0.0)).a * texture2D(map, vUv - vec2(uTexel.x, 0.0)).a
                    * texture2D(map, vUv + vec2(0.0, uTexel.y)).a * texture2D(map, vUv - vec2(0.0, uTexel.y)).a;
            vec3 c = mix(uRim, uColor, step(0.5, e));
            gl_FragColor = vec4(c, mix(0.9, 0.55, step(0.5, e)));
          }`,
        transparent: true, depthWrite: false, depthTest: true, depthFunc: THREE.GreaterDepth,
      });
      m = new THREE.Mesh(bbGeo, mat);
      m.renderOrder = 20; m.frustumCulled = false;
      scene.add(m); xrayPool.push(m);
    }
    xrayUsed++;
    m.visible = true;
    m.material.uniforms.map.value = t;
    m.material.uniforms.uColor.value.copy(colors[0]); m.material.uniforms.uRim.value.copy(colors[1]);
    const img = t.image;
    m.material.uniforms.uTexel.value.set(1 / img.width, 1 / img.height);
    m.scale.copy(src.scale);
    // pull towards the camera so nearby grass/props at the player's feet don't trigger the effect
    _toCam.copy(camera.position).sub(src.position).normalize();
    m.position.copy(src.position).addScaledVector(_toCam, 14);
    // compensate the size change from moving closer (keeps the silhouette over the sprite)
    const dist = camera.position.distanceTo(src.position), k = (dist - 14) / dist;
    m.scale.multiplyScalar(k);
    m.position.x = src.position.x + (m.position.x - src.position.x);
  }

  // blob contact shadows
  const blobTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 2, 16, 16, 16);
    gr.addColorStop(0, 'rgba(20,12,40,0.9)'); gr.addColorStop(0.6, 'rgba(20,12,40,0.5)'); gr.addColorStop(1, 'rgba(20,12,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  const blobs = []; let blobUsed = 0;
  function getBlob() {
    let m = blobs[blobUsed++];
    if (!m) {
      m = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.5 }));
      m.renderOrder = 1; m.frustumCulled = false;
      scene.add(m); blobs.push(m);
    }
    m.visible = true;
    return m;
  }

  // 3D houses
  const houses = new Map(); // drawable -> group
  const houseMats = {};
  function houseMat(key, color, repeat) {
    if (houseMats[key]) return houseMats[key];
    const img = sp(key);
    const m = new THREE.MeshLambertMaterial(img ? { map: tex(img, repeat) } : { color });
    return (houseMats[key] = m);
  }
  function uvScale(geo, sx, sy) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); }
  let houseTex = null;
  function hmat(key, fallbackCanvas, opts = {}) {
    if (houseMats[key]) return houseMats[key];
    const img = sp(key) || fallbackCanvas;
    return (houseMats[key] = new THREE.MeshLambertMaterial({ map: tex(img, true), ...opts }));
  }
  function buildHouse(d, img) {
    houseTex ||= houseTexturesFallback();
    const fw = d.footprint?.w ?? 56, fd = d.footprint?.h ?? 34;
    const baseH = 5, wallH = 30, roofH = 22, over = 4;
    const g = new THREE.Group();
    const wallM = hmat('tex_wall_plaster', houseTex.wall), roofM = hmat('tex_roof', houseTex.roof, { side: THREE.DoubleSide });
    const stoneM = hmat('tex_wall_stone', houseTex.stone);
    const worldUV = (geo, axisU, axisV, su = 32, sv = 32) => {
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let k = 0; k < p.count; k++) uv.setXY(k, p.getComponent(k, axisU) / su, p.getComponent(k, axisV) / sv);
    };
    // stone base + plaster walls (box faces get world-scaled UVs per side)
    const box = (w, h, dd, y, mat, su, sv) => {
      const geo = new THREE.BoxGeometry(w, h, dd);
      geo.translate(0, y + h / 2, 0);
      const p = geo.attributes.position, uv = geo.attributes.uv, n = geo.attributes.normal;
      for (let k = 0; k < p.count; k++) {
        const ax = Math.abs(n.getX(k)) > 0.5 ? 2 : 0; // side faces use z, front/back use x
        uv.setXY(k, (p.getComponent(k, ax) + w) / su, (p.getY(k) - y) / sv);
      }
      const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); return m;
    };
    box(fw + 2, baseH, fd + 2, 0, stoneM, 32, 16);
    box(fw, wallH, fd, baseH, wallM, 64, 32);
    // gable roof, ridge running north-south so the gable faces the camera
    const y0 = baseH + wallH, hw = fw / 2 + over, hd = fd / 2 + over, top = y0 + roofH;
    const slope = Math.hypot(hw, roofH);
    const roofGeo = new THREE.BufferGeometry();
    const P = [
      -hw, y0, -hd, -hw, y0, hd, 0, top, hd, -hw, y0, -hd, 0, top, hd, 0, top, -hd, // west slope
      hw, y0, hd, hw, y0, -hd, 0, top, -hd, hw, y0, hd, 0, top, -hd, 0, top, hd,     // east slope
    ];
    const su = (2 * hd) / 32, sv = slope / 32;
    const UV = [0, 0, su, 0, su, sv, 0, 0, su, sv, 0, sv, 0, 0, su, 0, su, sv, 0, 0, su, sv, 0, sv];
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    roofGeo.computeVertexNormals();
    const roof = new THREE.Mesh(roofGeo, roofM); roof.castShadow = roof.receiveShadow = true; g.add(roof);
    // gables (front + back) in plaster with timber
    const gab = new THREE.BufferGeometry();
    const G = [-fw / 2, y0, fd / 2, fw / 2, y0, fd / 2, 0, top - 2, fd / 2, fw / 2, y0, -fd / 2, -fw / 2, y0, -fd / 2, 0, top - 2, -fd / 2];
    gab.setAttribute('position', new THREE.Float32BufferAttribute(G, 3));
    gab.setAttribute('uv', new THREE.Float32BufferAttribute(G.map(() => 0).slice(0, 12), 2));
    worldUV(gab, 0, 1, 64, 32);
    gab.computeVertexNormals();
    const gm = new THREE.Mesh(gab, wallM); gm.castShadow = gm.receiveShadow = true; g.add(gm);
    // ridge beam + eave boards
    const wood = new THREE.MeshLambertMaterial({ color: '#4a2e1c' });
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 2 * hd + 2), wood); ridge.position.set(0, top + 0.5, 0); ridge.castShadow = true; g.add(ridge);
    for (const sx of [-1, 1]) {
      const eave = new THREE.Mesh(new THREE.BoxGeometry(2, 2, slope + 2), wood);
      eave.position.set(sx * hw / 2, (y0 + top) / 2, hd + 0.5); eave.rotation.x = 0; eave.rotation.y = 0;
      eave.rotation.order = 'YXZ'; eave.lookAt(new THREE.Vector3(0, top, hd + 0.5).add(g.position));
      g.add(eave);
    }
    // chimney
    const ch = new THREE.Mesh(new THREE.BoxGeometry(6, 16, 6), stoneM); ch.position.set(fw * 0.22, top - 4, -fd * 0.15); ch.castShadow = true; g.add(ch);
    // door + windows as decals
    const decal = (key, fb, w, h, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex(sp(key) || fb), alphaTest: 0.5, emissive: key === 'tex_window' ? '#ffb040' : '#000000', emissiveIntensity: key === 'tex_window' ? 0.35 : 0 }));
      m.emissiveMap = m.material.map; m.material.emissiveMap = m.material.map;
      m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m); return m;
    };
    const fz = fd / 2 + 0.3;
    decal('tex_door', houseTex.door, 14, 21, 0, baseH + 10.5, fz + 1.1);
    decal('tex_window', houseTex.win, 14, 12, -fw / 2 + 12, baseH + 17, fz);
    decal('tex_window', houseTex.win, 14, 12, fw / 2 - 12, baseH + 17, fz);
    decal('tex_window', houseTex.win, 10, 9, 0, y0 + 8, fz);
    decal('tex_window', houseTex.win, 14, 12, fw / 2 + 0.3, baseH + 17, 0, Math.PI / 2);
    decal('tex_window', houseTex.win, 14, 12, -fw / 2 - 0.3, baseH + 17, 0, -Math.PI / 2);
    // step in front of the door
    const step = new THREE.Mesh(new THREE.BoxGeometry(18, 2, 5), stoneM); step.position.set(0, 1, fd / 2 + 3); step.receiveShadow = step.castShadow = true; g.add(step);
    // the drawable's foot is the front-centre of the house; box offset from it
    const bx = d.box || d.def?.box;
    g.userData.offZ = bx ? bx[1] + bx[3] / 2 : -fd / 2 - 2;
    scene.add(g);
    return g;
  }

  // ---------- post-processing ----------
  let W = 1, H = 1;
  const rtScene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1) });
  const rtBlur = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const rtComp = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsGeo = new THREE.PlaneGeometry(2, 2);
  const fsScene = new THREE.Scene();
  const fsQuad = new THREE.Mesh(fsGeo); fsScene.add(fsQuad);
  const pass = (mat, target) => { fsQuad.material = mat; gl.setRenderTarget(target); gl.render(fsScene, fsCam); };
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const COC = `
    uniform sampler2D tDepth; uniform float uNear, uFar, uFocus, uRange, uTilt, uMaxCoc;
    float viewZ(vec2 uv){ float d = texture2D(tDepth, uv).x; return (uNear * uFar) / ((uFar - uNear) * d - uFar); }
    float coc(vec2 uv){
      float z = -viewZ(uv);
      float c = clamp((abs(z - uFocus) - uRange * 0.3) / uRange, 0.0, 1.0);
      float t = clamp((abs(uv.y - 0.47) - 0.2) * 2.6, 0.0, 1.0) * uTilt;
      return clamp(max(c, t), 0.0, 1.0);
    }`;
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: null }, tDepth: { value: null }, uNear: { value: 1 }, uFar: { value: 1 }, uFocus: { value: 1 }, uRange: { value: 1 }, uTilt: { value: 1 }, uMaxCoc: { value: 1 }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: VERT,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uTexel; ${COC}
      void main(){
        float c = coc(vUv);
        vec3 acc = texture2D(tColor, vUv).rgb; float wsum = 1.0;
        float r = c * uMaxCoc;
        for (int i = 0; i < 20; i++) {
          float fi = float(i);
          float a = fi * 2.39996; float rr = sqrt((fi + 0.5) / 20.0) * r;
          vec2 o = vec2(cos(a), sin(a)) * rr * uTexel;
          float cs = coc(vUv + o);
          float w = mix(0.25, 1.0, cs); // keep sharp foreground from bleeding too much
          acc += texture2D(tColor, vUv + o).rgb * w; wsum += w;
        }
        gl_FragColor = vec4(acc / wsum, c);
      }`,
    depthTest: false, depthWrite: false,
  });
  const compMat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: null }, tBlur: { value: null }, tDepth: { value: null }, uNear: { value: 1 }, uFar: { value: 1 }, uFocus: { value: 1 }, uRange: { value: 1 }, uTilt: { value: 1 }, uMaxCoc: { value: 1 }, uDof: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tColor, tBlur; uniform float uDof; ${COC}
      void main(){
        vec3 s = texture2D(tColor, vUv).rgb;
        vec3 b = texture2D(tBlur, vUv).rgb;
        float c = smoothstep(0.0, 0.6, coc(vUv)) * uDof;
        gl_FragColor = vec4(mix(s, b, c), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const gradeMat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: null }, uExposure: { value: 1.0 }, uVignette: { value: 1 }, uGrade: { value: 1 }, uTime: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tColor; uniform float uExposure, uVignette, uGrade, uTime, uAspect;
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec3 c = texture2D(tColor, vUv).rgb * uExposure;
        c = aces(c);
        if (uGrade > 0.5) {
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c.g *= 0.96;                                                 // remove green cast
          c = clamp((c - 0.45) * 1.08 + 0.45, 0.0, 1.0);             // contrast
          float hl = smoothstep(0.4, 0.85, l), sh = 1.0 - smoothstep(0.08, 0.4, l);
          c = mix(vec3(l), c, 0.92 + 0.18 * hl - 0.12 * sh);          // saturation: richer lights, calmer shadows
          c += sh * vec3(0.0, 0.025, 0.035);                          // teal shadows
          c *= mix(vec3(1.0), vec3(1.06, 1.0, 0.9), hl);              // warm highlights
          c = 0.04 + c * 0.96;                                         // lifted black point
          c = clamp(c, 0.0, 1.0);
        }
        vec3 o = toSRGB(c);
        if (uVignette > 0.5) {
          vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
          float v = smoothstep(1.0, 0.45, length(q));
          o *= mix(vec3(0.82, 0.84, 0.86), vec3(1.0), v);
        }
        // fine film grain keeps gradients from banding
        float n = fract(sin(dot(vUv * (uTime + 1.0), vec2(12.9898, 78.233))) * 43758.5453);
        o += (n - 0.5) / 255.0 * 2.0;
        gl_FragColor = vec4(o, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  let bloom = null;
  function resize(w, h) {
    W = w; H = h;
    gl.setSize(w, h, false);
    const s = R.resScale;
    const sw = Math.max(1, Math.round(w * s)), sh = Math.max(1, Math.round(h * s));
    rtScene.setSize(sw, sh);
    rtComp.setSize(sw, sh);
    rtBlur.setSize(Math.max(1, sw >> 1), Math.max(1, sh >> 1));
    ov.width = w; ov.height = h;
    if (!bloom) bloom = new UnrealBloomPass(new THREE.Vector2(sw, sh), 0.22, 0.5, 0.9);
    else bloom.setSize(sw, sh);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // ---------- drawable helper (same API as the 2D renderer) ----------
  let order = 0, curDrawable = null, stretch = 1;
  const torchSpots = [];
  const R = {
    three: { THREE, scene, camera, gl },
    assets, time: 0, is3D: true,
    models3d: true,
    xray: true,
    tiltShift: true, vignette: true, grade: true, bloom: !mobile, dof: true, debug: false,
    resScale: mobile ? 0.75 : 1,
    stats: { tiles: 0, sprites: 0 },
    ctx: null,
    sprite(img, x, y, z = 0, o = {}) {
      if (!img) return;
      const a = o.alpha ?? 1;
      if (a <= 0) return;
      const key = spriteKey.get(img);
      const d = curDrawable;
      if (d && (d.model === 'house' || key === 'house')) { houseSeen(d, img, x, y, z); return; }
      if (d && MODEL_KEYS[key] && R.models3d) { modelSeen(d, key, x, y, z, o.hop || 0); return; }
      if (key === 'torch' || key === 'torch_lit' || (key === 'lantern' && R.night > 0.2)) torchSpots.push([x, y, z]);
      const floor = d?.layer === 'floor';
      const kind = floor ? 'floor' : a < 1 ? 'trans' : 'solid';
      const m = getBB(kind);
      const mat = m.material;
      const t = tex(img);
      if (mat.map !== t) { mat.map = t; mat.emissiveMap = t; mat.needsUpdate = mat._hadMap !== true; mat._hadMap = true; if (m.customDepthMaterial) { m.customDepthMaterial.map = t; m.customDepthMaterial.needsUpdate = true; } }
      mat.opacity = a;
      mat.emissiveIntensity = o.flash ? 1.6 : 0.2;
      // img.ws = world units per sprite pixel (high-density HD sprites use 0.5); anchors stay in sprite pixels
      const ws = img.ws ?? 1;
      const w = img.width * ws, h = img.height * ws;
      const ax = (img.ax ?? (img.width >> 1)) * ws, ay = (img.ay ?? img.height - 1) * ws;
      const hop = o.hop || 0;
      const yUp = z * LEVEL + hop;
      if (floor) {
        m.scale.set(o.flip ? -w : w, 1, h);
        // rotated quad spans z = pos.z .. pos.z + h with the image top towards north
        m.position.set(o.flip ? x + ax : x - ax, yUp + 0.15 + order * 0.002, y - ay);
      } else {
        const sy = stretch;
        m.scale.set(o.flip ? -w : w, h * sy, 1);
        m.position.set(o.flip ? x + ax : x - ax, yUp - (h - ws - ay) * sy, y + 0.6 + order * 0.004);
        if (d?.layer === 'top') { mat.depthTest = false; m.renderOrder = 10; } else { mat.depthTest = true; m.renderOrder = 0; }
        // x-ray silhouette: the player stays visible as a shadow when trees, houses or walls hide them
        if (d && R.xray && (d === R.player || d.kind === 'enemy') && !(d.hp <= 0)) xraySprite(m, t, d === R.player ? XRAY_PLAYER : XRAY_ENEMY);
      }
      order++;
      R.stats.sprites++;
    },
    shadow(x, y, z = 0, rx = 6, ry, alpha = 0.28) {
      const m = getBlob();
      m.scale.set(rx * 2.4, 1, (ry ?? rx * 0.6) * 2.6);
      m.position.set(x, z * LEVEL + 0.2, y);
      m.material.opacity = Math.min(0.7, alpha * 1.6);
    },
    worldToScreen(x, y, z = 0) {
      const v = new THREE.Vector3(x, z * LEVEL, y).project(camera);
      return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
    },
  };
  // fake 2D context for drawables that still poke at ctx directly
  R.ctx = new Proxy({}, { get: (t, k) => (k === 'canvas' ? ov : typeof k === 'string' ? () => {} : undefined), set: () => true });

  const seenHouses = new Set();
  function houseSeen(d, img, x, y, z) {
    let g = houses.get(d);
    if (!g) { g = buildHouse(d, img); houses.set(d, g); }
    g.position.set(x, z * LEVEL, y + g.userData.offZ);
    g.visible = true;
    seenHouses.add(d);
  }

  const models = new Map(); // drawable -> 3D prop group
  const seenModels = new Set();
  // Static props are drawn as instanced batches (one draw call per template part);
  // only props that currently hide the player get an individual, fadeable copy.
  const batches = new Map();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function batchFor(type, kind, variant) {
    const key = `${type}_${kind}_${variant}`;
    let b = batches.get(key);
    if (b) return b;
    const tpl = type === 'tree' ? models3d.tree(kind, variant * 977 + 1, 1) : models3d.bush(variant * 31 + 1, 1);
    tpl.rotation.set(0, 0, 0); tpl.scale.setScalar(1); tpl.position.set(0, 0, 0); tpl.updateMatrixWorld(true);
    b = { parts: [], list: [] };
    tpl.traverse((o) => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, 700);
      im.count = 0; im.castShadow = im.receiveShadow = true; im.frustumCulled = false;
      if (o.customDepthMaterial) im.customDepthMaterial = o.customDepthMaterial;
      scene.add(im);
      b.parts.push({ im, local: o.matrixWorld.clone() });
    });
    batches.set(key, b);
    return b;
  }
  function flushBatches() {
    batches.forEach((b) => {
      for (const { im, local } of b.parts) {
        const n = Math.min(b.list.length, 700);
        for (let i = 0; i < n; i++) im.setMatrixAt(i, _m.multiplyMatrices(b.list[i], local));
        im.count = n; im.instanceMatrix.needsUpdate = true;
      }
      b.list.length = 0;
    });
  }
  const matPool = []; let matUsed = 0;
  function modelSeen(d, key, x, y, z, hop) {
    const [type, kind, size0] = MODEL_KEYS[key];
    const seed = hash(Math.round(d.x0 ?? x), Math.round(d.y0 ?? y)) % 100000;
    d.x0 ??= x; d.y0 ??= y;
    const pl = R.player;
    const occ = pl && type === 'tree' && d.y - pl.y > 2 && d.y - pl.y < 64 && Math.abs(d.x - pl.x) < 30;
    if (!occ && !models.has(d)) {
      const size = type === 'tree' ? size0 * (0.9 + (seed % 20) / 100) : size0;
      const m = matPool[matUsed] || (matPool[matUsed] = new THREE.Matrix4()); matUsed++;
      _q.setFromAxisAngle(_up, (seed % 628) / 100); _s.setScalar(size); _p.set(x, z * LEVEL + hop, y - 1);
      m.compose(_p, _q, _s);
      batchFor(type, kind, seed % 3).list.push(m);
      return;
    }
    let g = models.get(d);
    if (!g) {
      const [type, kind, size] = MODEL_KEYS[key];
      const seed = hash(Math.round(x), Math.round(y)) % 100000;
      const v = seed % 3;
      g = type === 'tree' ? models3d.tree(kind, v * 977 + 1, size0 * (0.9 + (seed % 20) / 100)) : models3d.bush(v * 31 + 1, size0);
      g.rotation.y = (seed % 628) / 100;
      scene.add(g); models.set(d, g);
    }
    g.position.set(x, z * LEVEL + hop, y - 1);
    g.visible = true;
    seenModels.add(d);
  }
  function fadeOccluders(player) {
    if (!player) return;
    models.forEach((g, d) => {
      if (!g.visible || !g.userData.crown) return;
      const dz = d.y - player.y, dx = Math.abs(d.x - player.x);
      const occ = dz > 2 && dz < 64 && dx < 30;
      if (!occ && g.userData.fadeMat && g.children.every((o) => !o.material?.transparent || o.material.opacity > 0.97)) { scene.remove(g); models.delete(d); return; }
      const target = occ ? 0.35 : 1;
      if (!g.userData.fadeMat && occ) {
        g.traverse((o) => { if (o.isMesh && o !== g.children[0]) { o.material = o.material.clone(); o.material.transparent = true; } });
        g.userData.fadeMat = true;
      }
      if (!g.userData.fadeMat) return;
      g.traverse((o) => { if (o.isMesh && o.material.transparent) { o.material.opacity += (target - o.material.opacity) * 0.15; o.material.depthWrite = o.material.opacity > 0.9; } });
    });
  }

  // ---------- time of day (overworld) ----------
  // Keyframes: hour -> sun colour/intensity, ambient, haze. Sun swings from east (morning) to west (evening).
  const DAY = [
    [0, '#5070c0', 0.55, '#304068', 0.32, '#1a2440'],
    [5, '#7088c8', 0.6, '#384870', 0.36, '#2a3450'],
    [6.5, '#ffb890', 1.8, '#a0a8c8', 0.6, '#c8a8a0'],
    [9, '#ffe0b0', 3.0, '#a8c4e0', 0.8, '#a8bcc8'],
    [15, '#ffd8a0', 3.2, '#a8c4e0', 0.8, '#a8bcc8'],
    [18, '#ffa060', 2.6, '#a8a0c0', 0.65, '#d0a888'],
    [19.5, '#e07850', 1.4, '#6870a0', 0.45, '#6a5a78'],
    [21, '#5070c0', 0.6, '#344070', 0.34, '#1e2848'],
    [24, '#5070c0', 0.55, '#304068', 0.32, '#1a2440'],
  ];
  const _c1 = new THREE.Color(), _c2 = new THREE.Color();
  const sunDir = SUN_DIR.clone();
  R.hours = null; R.night = 0;
  R.setTime = (h) => { R.hours = h == null ? null : ((h % 24) + 24) % 24; };
  function applyDaylight() {
    const h = R.hours;
    hemi.groundColor.set('#4a4030');
    if (h == null) {
      hemi.intensity = 0.8; hemi.color.set('#a8c4e0'); sun.intensity = 3.2; sun.color.set('#ffd8a0');
      scene.fog.color.copy(HAZE); scene.background = SKY; sunDir.copy(SUN_DIR); R.night = 0; return;
    }
    let i = 0; while (i < DAY.length - 2 && h >= DAY[i + 1][0]) i++;
    const a = DAY[i], b = DAY[i + 1], t = (h - a[0]) / (b[0] - a[0]);
    sun.color.copy(_c1.set(a[1])).lerp(_c2.set(b[1]), t); sun.intensity = a[2] + (b[2] - a[2]) * t;
    hemi.color.copy(_c1.set(a[3])).lerp(_c2.set(b[3]), t); hemi.intensity = a[4] + (b[4] - a[4]) * t;
    scene.fog.color.copy(_c1.set(a[5])).lerp(_c2.set(b[5]), t);
    const day = h >= 6 && h <= 20;
    R.night = h < 5 || h > 21 ? 1 : h < 7 ? (7 - h) / 2 : h > 19 ? (h - 19) / 2 : 0;
    scene.background = R.night > 0.5 ? scene.fog.color : SKY;
    // sun (or moon at night) path: azimuth east -> west, low in the morning/evening
    const p = day ? (h - 6) / 14 : ((h + 4) % 24) / 10;            // 0..1 across the sky
    const az = (-0.9 + p * 1.8), el = 0.25 + Math.sin(p * Math.PI) * 0.6;
    sunDir.set(Math.sin(az) * -0.9, el, 0.3 + Math.cos(az) * 0.2).normalize();
  }

  // ---------- camera ----------
  const look = new THREE.Vector3(), camY = { v: 0, init: false };
  function placeCamera(cam, world) {
    const base = cam.base || 3;
    const zf = cam.scale / base;                         // 1 = default zoom
    const elev = THREE.MathUtils.clamp(32 - (zf - 1) * 8 + (zf < 1 ? (1 - zf) * 44 : 0), 24, 70) * DEG;
    stretch = THREE.MathUtils.clamp(Math.tan(elev) * 1.25, 1, 1.5);
    const fov = 30;
    camera.fov = fov;
    const dist = 120 / Math.tan((fov / 2) * DEG) / zf * 0.6 * (cam.battleFocus ? 0.88 : 1) * (W >= H ? (H / W < 0.7 ? 1 : 1.25) : Math.min(2.2, (H / W) * 0.9));
    const f = cam.battleFocus || cam.follow;
    const fy = f ? ((f.z || 0) * LEVEL) : 0;
    if (!camY.init) { camY.v = fy; camY.init = true; }
    camY.v += (fy - camY.v) * 0.12;
    const tz = cam.y + (f ? (f.z || 0) * LEVEL + 8 : 0) + cam.oy;
    look.set(cam.x + cam.ox, camY.v, tz);
    camera.position.set(look.x, look.y + Math.sin(elev) * dist, look.z + Math.cos(elev) * dist);
    camera.lookAt(look);
    camera.near = Math.max(4, dist * 0.2); camera.far = dist * 6 + 1500;
    camera.updateProjectionMatrix();
    scene.fog.near = dist * 1.2; scene.fog.far = dist * 4.2;
    // sun follows the view so the shadow map stays sharp where we look
    const span = Math.min(1100, dist * 1.4 + 120);
    sun.position.copy(look).addScaledVector(sunDir, 900);
    sun.target.position.copy(look);
    const sc = sun.shadow.camera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 100; sc.far = 2200;
    sc.updateProjectionMatrix();
    return dist;
  }

  // ---------- main render ----------
  R.render = function render(world, drawables, cam, dt, overlay) {
    time += dt; R.time = time;
    windUniforms.uTime.value = time;
    if (canvas.width !== W || canvas.height !== H) resize(canvas.width, canvas.height);
    if (!world) { gl.setRenderTarget(null); gl.setClearColor(BG); gl.clear(); return; }
    if (!cur || cur.world !== world) { houses.forEach((g) => scene.remove(g)); houses.clear(); models.forEach((g) => scene.remove(g)); models.clear(); camY.init = false; buildWorld(world, drawables); }
    // tile changes (cut grass, bombed walls...)
    if (world.dirty.length) {
      for (const i of world.dirty) {
        const tx = i % world.w, ty = (i / world.w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (world.inside(tx + dx, ty + dy)) paintCell(world, cur.groundBuf, tx + dx, ty + dy);
        const x0 = Math.max(0, tx - 1), y0 = Math.max(0, ty - 1), x1 = Math.min(world.w - 1, tx + 1), y1 = Math.min(world.h - 1, ty + 1);
        blendRegion(world, cur.groundBuf, x0, y0, x1, y1);
        cur.groundCtx.putImageData(cur.groundBuf, 0, 0, x0 * RES, y0 * RES, (x1 - x0 + 1) * RES, (y1 - y0 + 1) * RES);
      }
      world.dirty.length = 0;
      cur.groundTex.needsUpdate = true;
      buildDeco(world, drawables);
    }
    if (waterAnim?.frames.length > 1) waterAnim.mat.map = waterAnim.frames[Math.floor(time * waterAnim.fps) % waterAnim.frames.length];
    // animated ground cells
    const fk = Math.floor(time * 4);
    if (fk !== cur.frameKey) {
      cur.frameKey = fk;
      // (ground no longer animates)
      if (cur.animCells.length) cur.groundTex.needsUpdate = true;
    }
    const dist = placeCamera(cam, world);
    if (Math.abs(stretch - (cur.decoStretch || 1)) > 0.04) buildDeco(world, drawables);

    // lighting mood per map
    if (cur.dark) { hemi.intensity = 0.55; hemi.color.set('#8090c8'); sun.intensity = 0.9; sun.color.set('#c8c8ff'); scene.fog.color.copy(BG); scene.background = BG; }
    else applyDaylight();

    // collect billboards
    used.solid = used.trans = used.floor = 0; blobUsed = 0; xrayUsed = 0; order = 0; torchSpots.length = 0;
    seenHouses.clear(); seenModels.clear(); matUsed = 0; R.player = cam.follow;
    R.stats.sprites = 0;
    const list = drawables.filter((d) => d && !d.hidden).sort((a, b) => a.y + (a.sortBias || 0) - (b.y + (b.sortBias || 0)));
    for (const d of list) {
      curDrawable = d;
      if (d.shadow) R.shadow(d.x, d.y, d.z || 0, typeof d.shadow === 'number' ? d.shadow : 6);
      try { d.draw(R.ctx, R); } catch (e) { if (R.debug) console.warn(e); }
    }
    curDrawable = null;
    for (const k of Object.keys(pools)) for (let i = used[k]; i < pools[k].length; i++) pools[k][i].visible = false;
    for (let i = blobUsed; i < blobs.length; i++) blobs[i].visible = false;
    for (let i = xrayUsed; i < xrayPool.length; i++) xrayPool[i].visible = false;
    houses.forEach((g, d) => { if (!seenHouses.has(d)) g.visible = false; });
    models.forEach((g, d) => { if (!seenModels.has(d)) g.visible = false; else if (g.userData.crown) g.userData.crown.rotation.z = Math.sin(time * 1.3 + g.userData.sway) * 0.025; });
    fadeOccluders(cam.follow);
    flushBatches();

    // torches -> point lights (nearest to the view centre)
    torchSpots.sort((a, b) => Math.hypot(a[0] - look.x, a[1] - look.z) - Math.hypot(b[0] - look.x, b[1] - look.z));
    torchLights.forEach((l, i) => {
      const t = torchSpots[i];
      if (!t) { l.intensity = 0; return; }
      l.position.set(t[0], t[2] * LEVEL + 18, t[1] + 2);
      l.intensity = (cur.dark ? 4200 : 1500 * Math.max(0.35, R.night)) * (0.85 + 0.15 * Math.sin(time * 13 + i * 2.1) * Math.sin(time * 7.3 + i));
    });

    // scene -> rtScene
    gl.setRenderTarget(rtScene);
    gl.render(scene, camera);

    const post = R.tiltShift || R.bloom || R.grade || R.vignette;
    const u = { uNear: camera.near, uFar: camera.far, uFocus: dist, uRange: dist * 0.5, uTilt: R.tiltShift ? 0.45 : 0, uMaxCoc: 3.5 * (rtScene.height / 540) };
    let src = rtScene;
    if (R.tiltShift && R.dof) {
      Object.entries(u).forEach(([k, v]) => { blurMat.uniforms[k].value = v; compMat.uniforms[k].value = v; });
      blurMat.uniforms.tColor.value = rtScene.texture; blurMat.uniforms.tDepth.value = rtScene.depthTexture;
      blurMat.uniforms.uTexel.value.set(1 / rtScene.width, 1 / rtScene.height);
      pass(blurMat, rtBlur);
      compMat.uniforms.tColor.value = rtScene.texture; compMat.uniforms.tBlur.value = rtBlur.texture; compMat.uniforms.tDepth.value = rtScene.depthTexture;
      compMat.uniforms.uDof.value = 1;
      pass(compMat, rtComp);
      src = rtComp;
    }
    if (R.bloom && bloom) {
      bloom.strength = cur.dark ? 0.28 : 0.22; bloom.threshold = cur.dark ? 0.95 : 0.9;
      bloom.render(gl, null, src, dt, false);
    }
    gradeMat.uniforms.tColor.value = src.texture;
    gradeMat.uniforms.uVignette.value = R.vignette ? 1 : 0;
    gradeMat.uniforms.uGrade.value = R.grade ? 1 : 0;
    gradeMat.uniforms.uTime.value = time % 10;
    gradeMat.uniforms.uAspect.value = W / H;
    gradeMat.uniforms.uExposure.value = cur.dark ? 1.15 : 1.23;
    pass(gradeMat, null);
    void post;

    // 2D overlay (screen space)
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, ov.width, ov.height);
    if (overlay) overlay(octx, R);
  };
  R.resize = resize;
  // step effects down when the device can't keep up (called by main.js)
  R.quality = 5;
  R.degrade = function () {
    if (R.quality <= 0) return;
    R.quality--;
    if (R.quality === 4) R.dof = false;
    else if (R.quality === 3) { R.resScale = Math.min(R.resScale, 0.75); resize(W, H); }
    else if (R.quality === 2) R.bloom = false;
    else if (R.quality === 1) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    else { R.resScale = 0.5; resize(W, H); }
    console.info('[drift] render quality', R.quality);
  };
  return R;
}

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2')); } catch { return false; }
}
