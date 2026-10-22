// HD-2D renderer (Three.js): 3D terrain with pixel textures, upright pixel-sprite billboards,
// sun light with shadow maps, wind-swept foliage, 3D houses, depth-of-field, bloom and color grading.
// Keeps the 2D renderer's API: render(world, drawables, cam, dt, overlay) and the drawable helper r.sprite/r.shadow,
// so gameplay, animation and FX code draw exactly as before.
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { TILE, LEVEL } from './constants.js';
import { TILE_DEFS } from '../data/tiles.js';

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
  const SUN_DIR = new THREE.Vector3(-0.6, 1.0, 0.3).normalize(); // top-left, slightly from the front
  const torchLights = [];
  for (let i = 0; i < 4; i++) {
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

  // ---------- state per world ----------
  let cur = null; // { world, group, groundCanvas, groundTex, animCells, deco }
  let time = 0;

  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return (h ^ (h >> 16)) >>> 0; }
  const isWall = (id) => id === 'dungeon_wall';
  const effH = (world, tx, ty) => {
    if (!world.inside(tx, ty)) return -Infinity;
    const id = world.tileAt(tx, ty);
    if (id === 'void') return -Infinity;
    return world.heightAt(tx, ty) + (isWall(id) ? WALL_LEVELS : 0);
  };

  // ----- ground texture (top faces), composited in 2D with terrain edge overlays -----
  function tileFrame(id, tx, ty) {
    const arr = assets.tiles[id];
    if (!arr || !arr.length) return null;
    if (arr.length === 1) return arr[0];
    if (arr.mode === 'variant') return arr[hash(tx, ty) % arr.length];
    return arr[(Math.floor(time * (arr.fps || 4)) + (arr.phase ? hash(tx, ty) : 0)) % arr.length];
  }
  const SIDES = [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]];
  function paintCell(world, g, tx, ty) {
    const id = world.tileAt(tx, ty);
    const px = tx * TILE, py = ty * TILE;
    g.clearRect(px, py, TILE, TILE);
    const img = tileFrame(id, tx, ty);
    if (img) g.drawImage(img, px, py); else { g.fillStyle = '#58a838'; g.fillRect(px, py, TILE, TILE); }
    const edges = assets.edges;
    if (!edges) return;
    const grp = assets.edgeGroup || {}, pri = assets.edgePriority || {};
    const g0 = grp[id] || id, p0 = pri[g0] ?? 0, h = world.heightAt(tx, ty);
    for (const [side, dx, dy] of SIDES) {
      const nx = tx + dx, ny = ty + dy;
      if (!world.inside(nx, ny) || world.heightAt(nx, ny) !== h) continue;
      const nid = world.tileAt(nx, ny), g1 = grp[nid] || nid;
      if (g1 === g0 || (pri[g1] ?? 0) <= p0) continue;
      let e = edges[`${g1}_${side}`];
      if (Array.isArray(e)) e = e[Math.floor(time * (e.fps || 4)) % e.length];
      if (e) g.drawImage(e, px, py);
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
    const H = maxN * LEVEL;
    const cols = ids.length * maxN * V;
    faceAtlas = document.createElement('canvas');
    faceAtlas.width = cols * TILE; faceAtlas.height = H;
    const g = faceAtlas.getContext('2d');
    let col = 0;
    for (const id of ids) {
      const faces = assets.faces?.[id] || assets.faces?.rock;
      for (let n = 1; n <= maxN; n++) for (let v = 0; v < V; v++) {
        const x = col * TILE, hgt = n * LEVEL;
        if (!faces || !faces.length) { g.fillStyle = '#6b5a48'; g.fillRect(x, 0, TILE, hgt); }
        else if (n === 1 && faces[3]) g.drawImage(faces[3], x, 0);
        else {
          const fTop = faces[0], fMid = faces[1] || faces[0], fBot = faces[2] || null;
          g.save(); g.beginPath(); g.rect(x, 0, TILE, hgt); g.clip();
          let y = fTop.height, k = 0;
          const yEnd = hgt - (fBot ? fBot.height : 0);
          while (y < yEnd) { const m = faces.mids ? faces.mids[(v + k++) % faces.mids.length] : fMid; g.drawImage(m, x, y); y += m.height; }
          if (fBot) g.drawImage(fBot, x, hgt - fBot.height);
          g.drawImage(fTop, x, 0);
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
    const W = world.w, Hh = world.h;
    const gc = document.createElement('canvas'); gc.width = W * TILE; gc.height = Hh * TILE;
    const g = gc.getContext('2d');
    const animCells = [];
    for (let ty = 0; ty < Hh; ty++) for (let tx = 0; tx < W; tx++) {
      paintCell(world, g, tx, ty);
      if (isAnimatedCell(world, tx, ty)) animCells.push([tx, ty]);
    }
    const groundTex = new THREE.CanvasTexture(gc);
    groundTex.magFilter = THREE.NearestFilter;
    groundTex.minFilter = THREE.LinearMipmapLinearFilter;
    groundTex.anisotropy = gl.capabilities.getMaxAnisotropy();
    groundTex.colorSpace = THREE.SRGBColorSpace;

    let maxN = 1;
    for (let ty = 0; ty < Hh; ty++) for (let tx = 0; tx < W; tx++) { const e = effH(world, tx, ty); if (e > -Infinity) maxN = Math.max(maxN, e + 1); }
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
      const y = e * LEVEL, x0 = tx * TILE, x1 = x0 + TILE, z0 = ty * TILE, z1 = z0 + TILE;
      const u0 = tx / W, u1 = (tx + 1) / W, v0 = 1 - ty / Hh, v1 = 1 - (ty + 1) / Hh;
      quad(top, [x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0], [0, 1, 0], [u0, v0], [u0, v1], [u1, v1], [u1, v0]);
      const fid = isWall(world.tileAt(tx, ty)) ? 'brick' : (assets.faces?.[world.face] ? world.face : 'rock');
      // sides: [dx, dz, corner a, corner b, normal]
      const sides = [
        [0, 1, [x0, z1], [x1, z1], [0, 0, 1]],
        [0, -1, [x1, z0], [x0, z0], [0, 0, -1]],
        [-1, 0, [x0, z0], [x0, z1], [-1, 0, 0]],
        [1, 0, [x1, z1], [x1, z0], [1, 0, 0]],
      ];
      for (const [dx, dz, a, b, nrm] of sides) {
        let en = effH(world, tx + dx, ty + dz);
        const outside = en === -Infinity;
        if (outside) en = 0;
        if (en < e) {
          const n = e - en;
          const col = faceStrips.get(`${fid}:${Math.min(n, maxN)}:${hash(tx, ty + dx * 7) % 3}`) ?? 0;
          const ua = col / atlas.cols, ub = (col + 1) / atlas.cols;
          const vt = 1, vb = 1 - (n * LEVEL) / atlas.H;
          const yb = en * LEVEL;
          quad(side, [a[0], y, a[1]], [a[0], yb, a[1]], [b[0], yb, b[1]], [b[0], y, b[1]], nrm, [ua, vt], [ua, vb], [ub, vb], [ub, vt]);
        }
        if (outside) {
          // diorama plinth below ground level on the map border
          const len = TILE / pl.w, along = (dx !== 0 ? ty : tx) * len;
          const yTop = Math.min(0, e * LEVEL);
          quad(base, [a[0], yTop, a[1]], [a[0], -PLINTH, a[1]], [b[0], -PLINTH, b[1]], [b[0], yTop, b[1]], nrm,
            [along, 1], [along, 1 - PLINTH / pl.h], [along + len, 1 - PLINTH / pl.h], [along + len, 1]);
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
    mk(side, new THREE.MeshLambertMaterial({ map: faceTex }));
    mk(base, new THREE.MeshLambertMaterial({ map: pl.t, color: '#b0a090' }));
    // table under the diorama
    const table = new THREE.Mesh(new THREE.PlaneGeometry(world.pxW + 4000, world.pxH + 4000), new THREE.MeshLambertMaterial({ color: '#1a2030' }));
    table.rotation.x = -Math.PI / 2; table.position.set(world.pxW / 2, -PLINTH - 0.5, world.pxH / 2);
    table.receiveShadow = true;
    group.add(table);

    scene.add(group);
    const dark = world.dark ?? (world.face === 'brick' || world.plinth === 'stone');
    cur = { world, group, groundCanvas: gc, groundCtx: g, groundTex, animCells, deco: null, frameKey: -1, dark, version: world.version };
    buildDeco(world, drawables);
    world.dirty.length = 0;
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
    const m = new THREE.MeshLambertMaterial({ map: tex(img), alphaTest: 0.5, side: THREE.DoubleSide });
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
      if (id === 'grass_tall') { n = 5; keys = ['deco_grass_1', 'deco_grass_2', 'deco_grass_3', 'deco_grass_4']; }
      else if (id === 'grass') { n = (h0 % 100) < 22 * dense ? 1 + (h0 % 2) : 0; keys = ['deco_grass_1', 'deco_grass_2', 'deco_grass_3']; }
      else if (id === 'grass_dark') { n = (h0 % 100) < 45 * dense ? 2 : 0; keys = ['deco_grass_dark_1', 'deco_grass_dark_2', 'deco_fern_1']; }
      else if (id === 'grass_flowers') { n = 2; keys = ['deco_flower_white', 'deco_flower_yellow', 'deco_flower_pink', 'deco_flower_purple', 'deco_grass_1']; }
      if (nearWater && (id === 'grass' || id === 'sand' || id === 'grass_dark') && (h0 % 3) === 0) { n = Math.max(n, 2); keys = ['deco_reed_1', 'deco_reed_2', 'deco_grass_2']; }
      n = Math.round(n * (id === 'grass_tall' ? 1 : dense));
      for (let i = 0; i < n; i++) {
        let key = keys[hash(tx + i * 13, ty) % keys.length];
        if (!sp(key) && key.startsWith('deco_')) key = key.includes('dark') || key.includes('fern') ? 'deco_grass_dark_1' : 'deco_grass_1';
        add(key, tx * TILE + 2 + rnd(i) * 12, ty * TILE + 2 + rnd(i + 5) * 12, z, 0.8 + rnd(i + 9) * 0.45);
      }
    }
    cur.deco = [];
    const dummy = new THREE.Object3D();
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
  function buildHouse(d, img) {
    const fw = d.footprint?.w ?? 60, fd = d.footprint?.h ?? 36;
    const wallH = 30, roofH = 24, over = 4;
    const g = new THREE.Group();
    const wallTex = sp('tex_wall_plaster');
    const wall = new THREE.Mesh(new THREE.BoxGeometry(fw, wallH, fd), houseMat('tex_wall_plaster', '#e8dcc0', true));
    if (wallTex) { const geo = wall.geometry; uvScale(geo, 1, 1); geo.attributes.uv.needsUpdate = true; wall.material.map.repeat.set(fw / wallTex.width / 1.5, wallH / wallTex.height); }
    wall.position.y = wallH / 2; wall.castShadow = wall.receiveShadow = true; g.add(wall);
    // gable roof (triangular prism)
    const hw = fw / 2 + over, hd = fd / 2 + over;
    const roofGeo = new THREE.BufferGeometry();
    const P = [
      // south slope
      -hw, wallH, hd, hw, wallH, hd, hw, wallH + roofH, 0, -hw, wallH, hd, hw, wallH + roofH, 0, -hw, wallH + roofH, 0,
      // north slope
      hw, wallH, -hd, -hw, wallH, -hd, -hw, wallH + roofH, 0, hw, wallH, -hd, -hw, wallH + roofH, 0, hw, wallH + roofH, 0,
      // gables
      -fw / 2, wallH, fd / 2, -fw / 2, wallH + roofH - 2, 0, -fw / 2, wallH, -fd / 2,
      fw / 2, wallH, -fd / 2, fw / 2, wallH + roofH - 2, 0, fw / 2, wallH, fd / 2,
    ];
    const rs = Math.hypot(hd, roofH) / 32, ra = (2 * hw) / 32;
    const UV = [0, 0, ra, 0, ra, rs, 0, 0, ra, rs, 0, rs, 0, 0, ra, 0, ra, rs, 0, 0, ra, rs, 0, rs, 0, 0, 0.5, 1, 1, 0, 0, 0, 0.5, 1, 1, 0];
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    roofGeo.computeVertexNormals();
    const roofM = houseMat('tex_roof', '#c0603a', true);
    const roof = new THREE.Mesh(roofGeo, roofM); roof.castShadow = roof.receiveShadow = true;
    roof.geometry.addGroup(0, 12, 0); roof.geometry.addGroup(12, 6, 1);
    roof.material = [roofM, houseMat('tex_wall_plaster', '#e8dcc0', true)];
    g.add(roof);
    // door + windows as decals on the south wall
    const decal = (key, w, h, x, y, color) => {
      const im = sp(key);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), im ? new THREE.MeshLambertMaterial({ map: tex(im), alphaTest: 0.5 }) : new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, y, fd / 2 + 0.3); m.receiveShadow = true; g.add(m); return m;
    };
    decal('tex_door', 14, 22, 0, 11, '#6a4028');
    decal('tex_window', 11, 11, -fw / 2 + 12, 17, '#f0d880');
    decal('tex_window', 11, 11, fw / 2 - 12, 17, '#f0d880');
    if (!wallTex && img) {
      // no house textures yet: wrap the sprite onto the front as a fallback
      const fm = new THREE.Mesh(new THREE.PlaneGeometry(img.width, img.height), new THREE.MeshLambertMaterial({ map: tex(img), alphaTest: 0.5 }));
      fm.position.set(0, img.height / 2, fd / 2 + 0.6); g.add(fm);
    }
    // the drawable's foot is the front-centre of the house; box offset from it
    const box = d.box || d.def?.box;
    g.userData.offZ = box ? box[1] + box[3] / 2 : -fd / 2 - 2;
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
      float c = clamp(abs(z - uFocus) / uRange - 0.15, 0.0, 1.0);
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
          c = mix(vec3(l), c, 1.12);                                  // saturation
          c += (1.0 - l) * vec3(-0.012, 0.004, 0.022) * 1.4;           // teal shadows
          c *= mix(vec3(1.0), vec3(1.06, 1.0, 0.9), smoothstep(0.35, 0.9, l)); // warm highlights
          c = clamp(c, 0.0, 1.0);
        }
        vec3 o = toSRGB(c);
        if (uVignette > 0.5) {
          vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
          float v = smoothstep(0.95, 0.35, length(q));
          o *= mix(vec3(0.16, 0.13, 0.26), vec3(1.0), v);
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
    if (!bloom) bloom = new UnrealBloomPass(new THREE.Vector2(sw, sh), 0.32, 0.55, 0.82);
    else bloom.setSize(sw, sh);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  // ---------- drawable helper (same API as the 2D renderer) ----------
  let order = 0, curDrawable = null, stretch = 1;
  const torchSpots = [];
  const R = {
    three: { THREE, scene, camera, gl },
    assets, time: 0, is3D: true,
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
      if (key === 'torch' || key === 'torch_lit') torchSpots.push([x, y, z]);
      const floor = d?.layer === 'floor';
      const kind = floor ? 'floor' : a < 1 ? 'trans' : 'solid';
      const m = getBB(kind);
      const mat = m.material;
      const t = tex(img);
      if (mat.map !== t) { mat.map = t; mat.emissiveMap = t; mat.needsUpdate = mat._hadMap !== true; mat._hadMap = true; if (m.customDepthMaterial) { m.customDepthMaterial.map = t; m.customDepthMaterial.needsUpdate = true; } }
      mat.opacity = a;
      mat.emissiveIntensity = o.flash ? 1.6 : 0;
      const w = img.width, h = img.height;
      const ax = img.ax ?? (w >> 1), ay = img.ay ?? h - 1;
      const hop = o.hop || 0;
      const yUp = z * LEVEL + hop;
      if (floor) {
        m.scale.set(o.flip ? -w : w, 1, h);
        // rotated quad spans z = pos.z .. pos.z + h with the image top towards north
        m.position.set(o.flip ? x + ax : x - ax, yUp + 0.15 + order * 0.002, y - ay);
      } else {
        const sy = stretch;
        m.scale.set(o.flip ? -w : w, h * sy, 1);
        m.position.set(o.flip ? x + ax : x - ax, yUp - (h - 1 - ay) * sy, y + 0.6 + order * 0.004);
        if (d?.layer === 'top') { mat.depthTest = false; m.renderOrder = 10; } else { mat.depthTest = true; m.renderOrder = 0; }
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

  // ---------- camera ----------
  const look = new THREE.Vector3(), camY = { v: 0, init: false };
  function placeCamera(cam, world) {
    const base = cam.base || 3;
    const zf = cam.scale / base;                         // 1 = default zoom
    const elev = THREE.MathUtils.clamp(52 - (zf - 1) * 12 + (zf < 1 ? (1 - zf) * 22 : 0), 36, 72) * DEG;
    stretch = THREE.MathUtils.clamp(Math.tan(elev), 1, 1.5);
    const fov = 30;
    camera.fov = fov;
    const dist = 120 / Math.tan((fov / 2) * DEG) / zf * (H / Math.max(W, H) < 0.7 ? 1 : 1.15);
    const f = cam.follow;
    const fy = f ? ((f.z || 0) * LEVEL) : 0;
    if (!camY.init) { camY.v = fy; camY.init = true; }
    camY.v += (fy - camY.v) * 0.12;
    const tz = cam.y + (f ? (f.z || 0) * LEVEL + 8 : 0) + cam.oy;
    look.set(cam.x + cam.ox, camY.v, tz);
    camera.position.set(look.x, look.y + Math.sin(elev) * dist, look.z + Math.cos(elev) * dist);
    camera.lookAt(look);
    camera.near = Math.max(4, dist * 0.2); camera.far = dist * 6 + 1500;
    camera.updateProjectionMatrix();
    scene.fog.near = dist * 1.25; scene.fog.far = dist * 4.5;
    // sun follows the view so the shadow map stays sharp where we look
    const span = Math.min(1100, dist * 1.4 + 120);
    sun.position.copy(look).addScaledVector(SUN_DIR, 900);
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
    if (!cur || cur.world !== world) { houses.forEach((g) => scene.remove(g)); houses.clear(); camY.init = false; buildWorld(world, drawables); }
    // tile changes (cut grass, bombed walls...)
    if (world.dirty.length) {
      for (const i of world.dirty) { const tx = i % world.w, ty = (i / world.w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (world.inside(tx + dx, ty + dy)) paintCell(world, cur.groundCtx, tx + dx, ty + dy); }
      world.dirty.length = 0;
      cur.groundTex.needsUpdate = true;
      buildDeco(world, drawables);
    }
    // animated ground cells
    const fk = Math.floor(time * 4);
    if (fk !== cur.frameKey) {
      cur.frameKey = fk;
      for (const [tx, ty] of cur.animCells) paintCell(world, cur.groundCtx, tx, ty);
      if (cur.animCells.length) cur.groundTex.needsUpdate = true;
    }
    const dist = placeCamera(cam, world);
    if (Math.abs(stretch - (cur.decoStretch || 1)) > 0.04) buildDeco(world, drawables);

    // lighting mood per map
    if (cur.dark) { hemi.intensity = 0.55; hemi.color.set('#8090c8'); sun.intensity = 0.9; sun.color.set('#c8c8ff'); }
    else { hemi.intensity = 0.9; hemi.color.set('#9ec4e8'); sun.intensity = 2.1; sun.color.set('#fff0d8'); }

    // collect billboards
    used.solid = used.trans = used.floor = 0; blobUsed = 0; order = 0; torchSpots.length = 0;
    seenHouses.clear();
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
    houses.forEach((g, d) => { if (!seenHouses.has(d)) g.visible = false; });

    // torches -> point lights (nearest to the view centre)
    torchSpots.sort((a, b) => Math.hypot(a[0] - look.x, a[1] - look.z) - Math.hypot(b[0] - look.x, b[1] - look.z));
    torchLights.forEach((l, i) => {
      const t = torchSpots[i];
      if (!t) { l.intensity = 0; return; }
      l.position.set(t[0], t[2] * LEVEL + 18, t[1] + 2);
      l.intensity = (cur.dark ? 9000 : 3500) * (0.85 + 0.15 * Math.sin(time * 13 + i * 2.1) * Math.sin(time * 7.3 + i));
    });

    // scene -> rtScene
    gl.setRenderTarget(rtScene);
    gl.render(scene, camera);

    const post = R.tiltShift || R.bloom || R.grade || R.vignette;
    const u = { uNear: camera.near, uFar: camera.far, uFocus: dist, uRange: dist * 0.55, uTilt: R.tiltShift ? 0.9 : 0, uMaxCoc: (mobile ? 4 : 6) * (rtBlur.width / 640) };
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
      bloom.strength = cur.dark ? 0.55 : 0.3;
      bloom.render(gl, null, src, dt, false);
    }
    gradeMat.uniforms.tColor.value = src.texture;
    gradeMat.uniforms.uVignette.value = R.vignette ? 1 : 0;
    gradeMat.uniforms.uGrade.value = R.grade ? 1 : 0;
    gradeMat.uniforms.uTime.value = time % 10;
    gradeMat.uniforms.uAspect.value = W / H;
    gradeMat.uniforms.uExposure.value = cur.dark ? 1.1 : 0.92;
    pass(gradeMat, null);
    void post;

    // 2D overlay (screen space)
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, ov.width, ov.height);
    if (overlay) overlay(octx, R);
  };
  R.resize = resize;
  return R;
}

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2')); } catch { return false; }
}
