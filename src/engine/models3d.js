// Procedural 3D props for the HD-2D renderer: volumetric trees and bushes built from leaf cards.
// Leaf-card normals point away from the crown centre, so the sun shades the crown like a soft sphere
// (the trick that makes HD-2D foliage read as volume while keeping pixel textures).
import * as THREE from 'three';

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function leafTexture(tones, seed = 1, size = 32) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const r = rng(seed);
  // many small pixel leaves; brighter towards the top-left
  for (let i = 0; i < size * 5; i++) {
    const x = Math.floor(r() * size), y = Math.floor(r() * size);
    const dx = x - size / 2, dy = y - size / 2;
    if (dx * dx + dy * dy > (size / 2 - 1) ** 2 * (0.7 + r() * 0.3)) continue;
    const light = 1 - (x + y) / (2 * size);
    const ti = Math.max(0, Math.min(tones.length - 1, Math.floor(light * tones.length + (r() - 0.5) * 2)));
    g.fillStyle = tones[ti];
    const w = 1 + Math.floor(r() * 3), h = 1 + Math.floor(r() * 2);
    g.fillRect(x, y, w, h);
  }
  return c;
}

export function barkTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d');
  const r = rng(7);
  const tones = ['#2a1a14', '#3c2618', '#503420', '#644430', '#7a5638'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = Math.sin(x * 1.7 + r() * 0.8) * 0.5 + 0.5;
    g.fillStyle = tones[Math.min(4, Math.floor(v * 3 + r() * 2))];
    g.fillRect(x, y, 1, 1);
  }
  return c;
}

const TONES = {
  green: ['#1c3418', '#29481e', '#3a6224', '#507a28', '#6c9430', '#8cb03c', '#b4cc58', '#d8e47c'],
  autumn: ['#4a3010', '#6c4a10', '#946c14', '#b88c18', '#d8ac24', '#ecc838', '#f8e070'],
  pine: ['#10241c', '#183428', '#20463a', '#2c5a44', '#3c7050', '#56885c'],
  bush: ['#1c3418', '#2a4a1e', '#3c6626', '#548230', '#74a03a', '#9cc04c', '#c4dc6c'],
};

// One crown geometry = many crossed leaf cards distributed in an ellipsoid shell.
function crownGeometry(seed, { rx, ry, rz, cards, card }) {
  const r = rng(seed);
  const pos = [], nrm = [], uv = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
  for (let i = 0; i < cards; i++) {
    // point in shell, biased upward/outward
    const th = r() * Math.PI * 2, ph = Math.acos(1 - 2 * Math.pow(r(), 0.8));
    const k = 0.55 + r() * 0.45;
    const cx = Math.sin(ph) * Math.cos(th) * rx * k, cy = Math.cos(ph) * ry * k, cz = Math.sin(ph) * Math.sin(th) * rz * k;
    const n = new THREE.Vector3(cx / rx, cy / ry, cz / rz).normalize();
    e.set(r() * Math.PI, r() * Math.PI, r() * Math.PI); q.setFromEuler(e);
    const s = card * (0.75 + r() * 0.5);
    for (let j = 0; j < 6; j++) {
      v.set(corners[j][0] * s, corners[j][1] * s, 0).applyQuaternion(q);
      pos.push(cx + v.x, cy + v.y, cz + v.z);
      nrm.push(n.x, n.y, n.z);
      uv.push(...uvs[j]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

export function createModelFactory({ tex, sp, mobile }) {
  const cache = {};
  const leafMat = (key, tones, seed) => {
    if (cache['m_' + key]) return cache['m_' + key];
    const img = sp(key) || leafTexture(tones, seed);
    const t = tex(img);
    const m = new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide });
    const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.5 });
    return (cache['m_' + key] = { m, d });
  };
  const bark = () => cache.bark || (cache.bark = new THREE.MeshLambertMaterial({ map: tex(sp('tex_bark') || barkTexture(), true) }));
  const geoCache = (key, make) => cache['g_' + key] || (cache['g_' + key] = make());

  function tree(kind, seed, size = 1) {
    const g = new THREE.Group();
    const variant = seed % 3;
    if (kind === 'pine') {
      const trunk = new THREE.Mesh(geoCache('pinetrunk', () => new THREE.CylinderGeometry(1.6, 2.6, 22, 6).translate(0, 11, 0)), bark());
      trunk.castShadow = trunk.receiveShadow = true; g.add(trunk);
      const { m, d } = leafMat('tex_needles', TONES.pine, 11);
      for (let i = 0; i < 4; i++) {
        const geo = geoCache(`pine${variant}_${i}`, () => crownGeometry(seed * 7 + i, { rx: 15 - i * 3.2, ry: 7, rz: 15 - i * 3.2, cards: mobile ? 22 : 34, card: 12 - i }));
        const c = new THREE.Mesh(geo, m); c.customDepthMaterial = d;
        c.position.y = 16 + i * 10; c.castShadow = c.receiveShadow = true; g.add(c);
      }
    } else {
      const tones = kind === 'autumn' ? TONES.autumn : TONES.green;
      const trunkH = 20;
      const trunk = new THREE.Mesh(geoCache('trunk', () => new THREE.CylinderGeometry(2.2, 3.6, trunkH + 6, 7).translate(0, (trunkH + 6) / 2, 0)), bark());
      trunk.castShadow = trunk.receiveShadow = true; g.add(trunk);
      // roots
      for (let i = 0; i < 3; i++) {
        const rt = new THREE.Mesh(geoCache('root', () => new THREE.CylinderGeometry(0.6, 1.8, 8, 5).translate(0, 4, 0)), bark());
        rt.rotation.z = 1.1; rt.rotation.y = (i / 3) * Math.PI * 2 + seed; rt.position.y = 0.5;
        rt.castShadow = true; g.add(rt);
      }
      const { m, d } = leafMat(kind === 'autumn' ? 'tex_leaf_autumn' : 'tex_leaf_cluster_' + (1 + variant), tones, 3 + variant);
      const crown = new THREE.Mesh(
        geoCache(`crown_${kind}_${variant}`, () => crownGeometry(seed * 13 + 5, { rx: 21, ry: 16, rz: 19, cards: mobile ? 70 : 120, card: 13 })), m);
      crown.customDepthMaterial = d;
      crown.position.y = trunkH + 14; crown.castShadow = crown.receiveShadow = true;
      g.add(crown);
      // a couple of secondary lobes for an irregular silhouette
      for (let i = 0; i < 2; i++) {
        const lobe = new THREE.Mesh(geoCache(`lobe_${kind}_${variant}_${i}`, () => crownGeometry(seed * 5 + i * 3, { rx: 12, ry: 10, rz: 11, cards: mobile ? 26 : 40, card: 11 })), m);
        lobe.customDepthMaterial = d;
        const a = seed * 1.7 + i * 2.6;
        lobe.position.set(Math.cos(a) * 14, trunkH + 8 + i * 6, Math.sin(a) * 10);
        lobe.castShadow = lobe.receiveShadow = true; g.add(lobe);
      }
      g.userData.crown = crown;
    }
    g.scale.setScalar(size);
    g.rotation.y = (seed % 628) / 100;
    g.userData.sway = (seed % 100) / 16;
    return g;
  }

  function bush(seed, size = 1) {
    const g = new THREE.Group();
    const { m, d } = leafMat('tex_leaf_cluster_2', TONES.bush, 9);
    const c = new THREE.Mesh(geoCache('bush' + (seed % 3), () => crownGeometry(seed * 3 + 1, { rx: 9, ry: 6.5, rz: 8, cards: mobile ? 20 : 30, card: 8 })), m);
    c.customDepthMaterial = d;
    c.position.y = 6; c.castShadow = c.receiveShadow = true;
    g.add(c);
    g.scale.setScalar(size);
    g.rotation.y = seed % 6;
    return g;
  }

  return { tree, bush };
}

// ---- procedural fallback textures for 3D houses (art can override with tex_* sprites) ----
function noiseFill(g, w, h, tones, seed, density = 1) {
  const r = rng(seed);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (r() > density) continue;
    g.fillStyle = tones[Math.floor(r() * tones.length)];
    g.fillRect(x, y, 1, 1);
  }
}
export function houseTextures() {
  const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d')); return c; };
  const beam = ['#3a2416', '#4a3020', '#5a3a26'];
  const wall = mk(64, 64, (g) => {
    g.fillStyle = '#e4d6b8'; g.fillRect(0, 0, 64, 64);
    noiseFill(g, 64, 64, ['#d8c8a8', '#ece0c4', '#cfbf9e', '#f2e8d0'], 3, 0.55);
    const r = rng(5);
    const b = (x, y, w, h) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { g.fillStyle = beam[Math.floor(r() * 3)]; g.fillRect(x + i, y + j, 1, 1); } };
    b(0, 0, 64, 4); b(0, 60, 64, 4); b(0, 30, 64, 3); b(0, 0, 4, 64); b(31, 0, 3, 64);
    for (let i = 0; i < 26; i++) { b(4 + i, 4 + i, 2, 1); b(59 - i, 34 + i * 0.95 | 0, 2, 1); }
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 4, 64, 1); g.fillRect(0, 33, 64, 1);
  });
  const roof = mk(64, 64, (g) => {
    const r = rng(9);
    const tones = ['#8a4e22', '#a8642a', '#c07a32', '#d29240', '#e0a854', '#ecc070'];
    for (let row = 0; row < 8; row++) {
      const off = (row % 2) * 4;
      for (let col = -1; col < 9; col++) {
        const x0 = col * 8 + off, y0 = row * 8;
        const base = 1 + Math.floor(r() * 3);
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          const t = Math.max(0, Math.min(5, base + (y < 2 ? 2 : y > 5 ? -1 : 0) + (r() < 0.25 ? 1 : 0) - (r() < 0.15 ? 1 : 0)));
          g.fillStyle = x === 7 || y === 7 ? '#4a2810' : tones[t];
          g.fillRect(x0 + x, y0 + y, 1, 1);
        }
      }
    }
  });
  const door = mk(16, 24, (g) => {
    g.fillStyle = '#3a2416'; g.fillRect(0, 2, 16, 22); g.fillRect(2, 0, 12, 2);
    const r = rng(2);
    for (let x = 2; x < 14; x++) for (let y = 3; y < 24; y++) { g.fillStyle = x % 4 === 1 ? '#4a2c18' : ['#6a4428', '#7a5030', '#86603a'][Math.floor(r() * 3)]; g.fillRect(x, y, 1, 1); }
    g.fillStyle = '#e0b850'; g.fillRect(11, 13, 2, 2);
    g.fillStyle = '#2a1a10'; g.fillRect(2, 8, 12, 1); g.fillRect(2, 18, 12, 1);
  });
  const win = mk(16, 14, (g) => {
    g.fillStyle = '#4a7a7a'; g.fillRect(0, 1, 3, 12); g.fillRect(13, 1, 3, 12);
    g.fillStyle = '#3a2416'; g.fillRect(3, 0, 10, 14);
    const gr = g.createLinearGradient(0, 2, 0, 12); gr.addColorStop(0, '#fff0a0'); gr.addColorStop(1, '#e8a040');
    g.fillStyle = gr; g.fillRect(4, 2, 8, 10);
    g.fillStyle = '#3a2416'; g.fillRect(7, 2, 2, 10); g.fillRect(4, 6, 8, 1);
    g.fillStyle = '#5a8a8a'; g.fillRect(0, 1, 1, 12); g.fillRect(15, 1, 1, 12);
  });
  const stone = mk(32, 16, (g) => {
    g.fillStyle = '#5a5650'; g.fillRect(0, 0, 32, 16);
    const r = rng(4);
    for (let row = 0; row < 2; row++) for (let i = -1; i < 4; i++) {
      const x0 = i * 10 + (row ? 5 : 0), y0 = row * 8;
      const t = ['#7a766c', '#8a8478', '#9a9486', '#6e6a62'][Math.floor(r() * 4)];
      g.fillStyle = t; g.fillRect(x0 + 1, y0 + 1, 8, 6);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x0 + 1, y0 + 1, 8, 1);
    }
  });
  return { wall, roof, door, win, stone };
}
