// Möbel-Modelle aus Grundkörpern + Schadens-Shader (Risse, Treffer-Blitz, Auswahl-Glühen).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

// ---------------------------------------------------------------------------
// Material mit dynamischem Schadens-Shader
// ---------------------------------------------------------------------------
const NOISE = /* glsl */ `
float fHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fHash(i), fHash(i + vec3(1,0,0)), f.x), mix(fHash(i + vec3(0,1,0)), fHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fHash(i + vec3(0,0,1)), fHash(i + vec3(1,0,1)), f.x), mix(fHash(i + vec3(0,1,1)), fHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

export function makeFurnitureMaterial(uniforms, params) {
  const mat = new THREE.MeshStandardMaterial(params);
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFurnPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFurnPos = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uDamage; uniform float uFlash; uniform float uSelect; uniform vec3 uSelColor; uniform float uTime;
varying vec3 vFurnPos;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  // Risse: dünne Linien entlang von Rauschen-Isolinien, werden mit dem Schaden breiter und zahlreicher
  float n = fNoise(vFurnPos * 9.0) * 0.65 + fNoise(vFurnPos * 23.0) * 0.35;
  float width = 0.012 + uDamage * 0.03;
  float crack = 1.0 - smoothstep(0.0, width, abs(n - 0.5));
  crack *= smoothstep(0.15, 0.7, uDamage);
  float grime = fNoise(vFurnPos * 4.0);
  diffuseColor.rgb *= 1.0 - uDamage * 0.3 * grime;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.05, 0.04), crack * 0.9);
}`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
{
  vec3 V = normalize(vViewPosition);
  float rim = pow(1.0 - abs(dot(normalize(normal), V)), 2.0);
  float pulse = 0.55 + 0.45 * sin(uTime * 7.0);
  gl_FragColor.rgb += uSelColor * uSelect * (0.12 + rim * 1.2) * pulse;
  gl_FragColor.rgb += vec3(1.6, 0.35, 0.2) * uFlash * (0.4 + rim);
  // kritischer Zustand: rotes Pulsieren
  float crit = smoothstep(0.6, 0.9, uDamage);
  gl_FragColor.rgb += vec3(1.0, 0.1, 0.05) * crit * rim * (0.5 + 0.5 * sin(uTime * 12.0));
}`);
  };
  mat.customProgramCacheKey = () => 'furniture-damage-v1';
  return mat;
}

// ---------------------------------------------------------------------------
// Bau-Helfer
// ---------------------------------------------------------------------------
const geoCache = new Map();
function rbox(w, h, d, r) {
  const k = `rb${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}_${r}`;
  if (!geoCache.has(k)) {
    const rad = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    geoCache.set(k, rad > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, rad) : new THREE.BoxGeometry(w, h, d));
  }
  return geoCache.get(k);
}

class Builder {
  constructor(uniforms) {
    this.group = new THREE.Group();
    this.uniforms = uniforms;
    this.mats = new Map();
    this.colors = [];
  }
  mat(color, extra = {}) {
    const key = color + JSON.stringify(extra);
    if (!this.mats.has(key)) {
      this.mats.set(key, makeFurnitureMaterial(this.uniforms, { color, roughness: 0.6, ...extra }));
      if (!extra.transparent) this.colors.push(color);
    }
    return this.mats.get(key);
  }
  add(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }
  box(w, h, d, x, y, z, color, r = 0.03, extra) {
    return this.add(rbox(w, h, d, r), this.mat(color, extra), x, y, z);
  }
  cyl(rt, rb, h, x, y, z, color, seg = 16, extra) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), this.mat(color, extra), x, y, z);
  }
}

// Beine an den vier Ecken
function legs(b, len, dep, h, color, inset = 0.08, r = 0.03) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.cyl(r, r * 0.8, h, sx * (len / 2 - inset), h / 2, sz * (dep / 2 - inset), color, 8);
  }
}

const BUILDERS = {
  sofa(b, { len, dep }) {
    const fabric = 0x2f9c95, dark = 0x1f6f6a;
    legs(b, len, dep, 0.1, 0x3a2a20, 0.12, 0.035);
    b.box(len, 0.28, dep, 0, 0.24, 0, dark, 0.06);
    const n = 3, cw = (len - 0.4) / n;
    for (let i = 0; i < n; i++) b.box(cw - 0.03, 0.14, dep - 0.28, -len / 2 + 0.2 + cw * (i + 0.5), 0.44, 0.1, fabric, 0.06);
    b.box(len, 0.42, 0.24, 0, 0.58, -dep / 2 + 0.12, fabric, 0.09);
    for (const s of [-1, 1]) b.box(0.2, 0.5, dep, s * (len / 2 - 0.1), 0.42, 0, dark, 0.08);
    b.box(0.34, 0.26, 0.1, -0.5, 0.6, -0.12, 0xffc857, 0.06); // Kissen
  },
  armchair(b, { len, dep }) {
    const fabric = 0xe9a23b, dark = 0xb87a22;
    legs(b, len, dep, 0.1, 0x3a2a20, 0.1, 0.03);
    b.box(len, 0.28, dep, 0, 0.24, 0, dark, 0.06);
    b.box(len - 0.4, 0.14, dep - 0.28, 0, 0.44, 0.1, fabric, 0.06);
    b.box(len, 0.42, 0.24, 0, 0.58, -dep / 2 + 0.12, fabric, 0.09);
    for (const s of [-1, 1]) b.box(0.2, 0.5, dep, s * (len / 2 - 0.1), 0.42, 0, dark, 0.08);
  },
  tv(b, { len, dep }) {
    b.box(0.36, 0.04, dep * 0.8, 0, 0.02, 0, 0x222228, 0.015);
    b.cyl(0.03, 0.03, 0.12, 0, 0.1, -0.02, 0x333340, 8);
    b.box(len, 0.62, 0.07, 0, 0.47, 0, 0x16161c, 0.025);
    b.box(len - 0.07, 0.55, 0.01, 0, 0.47, 0.037, 0x1a3555, 0, { roughness: 0.15, metalness: 0.2, emissive: 0x0b2a4a, emissiveIntensity: 0.6 });
  },
  plant(b) {
    b.cyl(0.2, 0.15, 0.32, 0, 0.16, 0, 0xc8643c, 18);
    b.cyl(0.21, 0.21, 0.04, 0, 0.32, 0, 0xa64f2c, 18);
    const leaf = 0x3e9e4a, leaf2 = 0x5cc463;
    const blob = new THREE.IcosahedronGeometry(0.17, 0);
    const pos = [[0, 0.62, 0, 1.3], [0.12, 0.5, 0.08, 1], [-0.12, 0.52, -0.06, 1], [0.04, 0.82, -0.04, 0.9], [-0.06, 0.72, 0.1, 0.8]];
    pos.forEach(([x, y, z, s], i) => {
      const m = b.add(blob, b.mat(i % 2 ? leaf : leaf2, { flatShading: true }), x, y, z, i, i * 2, 0);
      m.scale.setScalar(s);
    });
  },
  lamp(b) {
    b.cyl(0.18, 0.2, 0.04, 0, 0.02, 0, 0x2a2a30, 20);
    b.cyl(0.02, 0.02, 1.05, 0, 0.55, 0, 0xb08d57, 8, { metalness: 0.8, roughness: 0.3 });
    b.cyl(0.12, 0.22, 0.28, 0, 1.18, 0, 0xfff1d0, 20, { emissive: 0xffd58a, emissiveIntensity: 0.9 });
  },
  fridge(b, { len, dep, h }) {
    b.box(len, h, dep, 0, h / 2, 0, 0x9fd8cb, 0.08, { roughness: 0.35 });
    b.box(len - 0.04, 0.012, 0.01, 0, h * 0.68, dep / 2 + 0.002, 0x5a8f84, 0);
    b.box(0.04, 0.32, 0.05, len / 2 - 0.12, h * 0.82, dep / 2 + 0.02, 0xe0e0e0, 0.015, { metalness: 0.9, roughness: 0.2 });
    b.box(0.04, 0.5, 0.05, len / 2 - 0.12, h * 0.42, dep / 2 + 0.02, 0xe0e0e0, 0.015, { metalness: 0.9, roughness: 0.2 });
    b.box(0.12, 0.12, 0.012, -0.15, h * 0.5, dep / 2 + 0.006, 0xff5d73, 0.02); // Magnet
  },
  table(b, { len, dep, h }) {
    legs(b, len, dep, h - 0.05, 0x8a5a34, 0.1, 0.04);
    b.box(len, 0.06, dep, 0, h - 0.03, 0, 0xb87d4b, 0.02);
    b.cyl(0.1, 0.08, 0.06, 0.25, h + 0.03, 0.1, 0xffffff, 16); // Vase
    b.cyl(0.03, 0.03, 0.12, 0.25, h + 0.1, 0.1, 0xff6b9a, 8);
  },
  chair(b, { len, dep, h }) {
    legs(b, len, dep, 0.45, 0x7a4b2a, 0.06, 0.025);
    b.box(len, 0.05, dep, 0, 0.47, 0, 0xc98b55, 0.02);
    b.box(len, 0.42, 0.05, 0, 0.7, -dep / 2 + 0.03, 0xc98b55, 0.02);
  },
  dishes(b, { len, dep, h }) {
    b.box(len, h, dep, 0, h / 2, 0, 0xc9a26b, 0.02, { roughness: 0.9 });
    b.box(len + 0.005, 0.08, dep + 0.005, 0, h * 0.5, 0, 0xe63946, 0.005); // "Zerbrechlich"-Band
    const plate = new THREE.CylinderGeometry(0.13, 0.13, 0.02, 20);
    for (let i = 0; i < 4; i++) b.add(plate, b.mat(0xf8f8f8, { roughness: 0.2 }), -0.2 + i * 0.13, h + 0.06, 0, Math.PI / 2, 0, 0.1);
    b.cyl(0.05, 0.04, 0.14, 0.2, h + 0.04, 0.15, 0x8ecae6, 10, { roughness: 0.1 });
  },
  box(b, { len, dep, h }) {
    b.box(len, h, dep, 0, h / 2, 0, 0xc9a26b, 0.02, { roughness: 0.9 });
    b.box(0.12, 0.006, dep + 0.01, 0, h + 0.002, 0, 0xe8d8b0, 0);
    b.box(0.2, 0.12, 0.006, -0.12, h * 0.55, dep / 2 + 0.003, 0xffffff, 0);
  },
  bed(b, { len, dep }) {
    b.box(len, 0.25, dep, 0, 0.17, 0, 0x8a5a34, 0.04);
    b.box(len - 0.1, 0.18, dep - 0.08, 0.02, 0.38, 0, 0xf4f1ea, 0.07);
    b.box(len * 0.62, 0.06, dep - 0.04, len * 0.17, 0.48, 0, 0x6c63ff, 0.04);
    b.box(len * 0.6, 0.03, dep - 0.02, len * 0.17, 0.5, 0, 0x847dff, 0.02);
    for (const s of [-1, 1]) b.box(0.32, 0.1, dep * 0.4, -len / 2 + 0.3, 0.52, s * dep * 0.22, 0xffffff, 0.05);
    b.box(0.1, 0.75, dep, -len / 2 + 0.05, 0.38, 0, 0x6e4426, 0.04);
  },
  wardrobe(b, { len, dep, h }) {
    b.box(len, h, dep, 0, h / 2, 0, 0xd6b38a, 0.03);
    b.box(0.012, h - 0.12, 0.01, 0, h / 2, dep / 2 + 0.003, 0x7a5a3a, 0);
    for (const s of [-1, 1]) b.cyl(0.025, 0.025, 0.04, s * 0.07, h * 0.52, dep / 2 + 0.02, 0x333333, 8).rotation.x = Math.PI / 2;
    b.box(len + 0.04, 0.05, dep + 0.04, 0, h + 0.02, 0, 0xa67c52, 0.02);
  },
  bookshelf(b, { len, dep, h }) {
    const wood = 0x6b4f3a;
    for (const s of [-1, 1]) b.box(0.04, h, dep, s * (len / 2 - 0.02), h / 2, 0, wood, 0.01);
    b.box(len, h, 0.02, 0, h / 2, -dep / 2 + 0.01, 0x5a4230, 0);
    const shelves = 5;
    const cols = [0xe63946, 0xf1c453, 0x2a9d8f, 0x457b9d, 0xf4a261, 0x9b5de5, 0xffffff];
    let k = 0;
    for (let i = 0; i <= shelves; i++) {
      const y = 0.02 + (i * (h - 0.04)) / shelves;
      b.box(len, 0.03, dep, 0, y, 0, wood, 0.01);
      if (i < shelves) {
        let x = -len / 2 + 0.06;
        while (x < len / 2 - 0.12) {
          const w = 0.04 + ((k * 37) % 5) * 0.012;
          const bh = 0.2 + ((k * 13) % 4) * 0.03;
          b.box(w, bh, dep * 0.7, x + w / 2, y + 0.015 + bh / 2, 0.02, cols[k % cols.length], 0.004);
          x += w + 0.008;
          k++;
        }
      }
    }
  },
  aquarium(b, { len, dep, h }) {
    b.box(len, 0.4, dep, 0, 0.2, 0, 0x2d3142, 0.03);
    b.box(len - 0.04, 0.42, dep - 0.04, 0, 0.62, 0, 0x55c1ff, 0.01,
      { transparent: true, opacity: 0.45, roughness: 0.05, emissive: 0x0a4a7a, emissiveIntensity: 0.6, depthWrite: false });
    b.box(len - 0.06, 0.06, dep - 0.06, 0, 0.43, 0, 0xe9d8a6, 0.01);
    const fish = new THREE.ConeGeometry(0.04, 0.12, 6);
    [[-0.3, 0.6, 0.05, 0xff8c42], [0.1, 0.7, -0.08, 0xffd23f], [0.35, 0.55, 0.06, 0xff4d6d]].forEach(([x, y, z, c]) =>
      b.add(fish, b.mat(c, { emissive: c, emissiveIntensity: 0.3 }), x, y, z, 0, 0, Math.PI / 2));
    for (const x of [-0.4, -0.1, 0.25]) b.cyl(0.015, 0.03, 0.22, x, 0.56, -0.08, 0x2a9d4a, 6);
    b.box(len, 0.04, dep, 0, 0.85, 0, 0x2d3142, 0.01);
  },
  piano(b, { len, dep, h }) {
    const black = 0x151519;
    b.box(len, h, dep * 0.55, 0, h / 2, -dep * 0.22, black, 0.03, { roughness: 0.15, metalness: 0.1 });
    b.box(len, 0.08, dep * 0.45, 0, 0.72, dep * 0.27, black, 0.02, { roughness: 0.15 });
    b.box(len - 0.12, 0.03, dep * 0.32, 0, 0.775, dep * 0.3, 0xfaf7f0, 0.005);
    for (let i = 0; i < 18; i++) {
      if (i % 7 === 2 || i % 7 === 6) continue;
      b.box(0.035, 0.03, dep * 0.18, -len / 2 + 0.14 + i * ((len - 0.28) / 18), 0.795, dep * 0.24, black, 0.004);
    }
    for (const s of [-1, 1]) b.box(0.07, 0.72, 0.07, s * (len / 2 - 0.06), 0.36, dep * 0.4, black, 0.02);
    b.cyl(0.05, 0.05, 0.06, len * 0.3, h + 0.03, -0.15, 0xd4af37, 10, { metalness: 1, roughness: 0.3 });
  },
  guitar(b, { len, dep }) {
    const wood = 0xd08c3c;
    const body1 = b.cyl(0.19, 0.19, 0.1, -0.28, 0.06, 0, wood, 24); body1.scale.z = 0.95;
    b.cyl(0.14, 0.14, 0.1, -0.02, 0.06, 0, wood, 20);
    b.cyl(0.06, 0.06, 0.012, -0.12, 0.112, 0, 0x2b1a10, 16);
    b.box(0.52, 0.04, 0.06, 0.3, 0.09, 0, 0x5a3820, 0.01);
    b.box(0.12, 0.04, 0.09, 0.6, 0.09, 0, 0x2b1a10, 0.01);
  },
};

export function buildFurniture(type, def, uniforms) {
  const b = new Builder(uniforms);
  (BUILDERS[type] || BUILDERS.box)(b, def);
  return { group: b.group, colors: b.colors.length ? b.colors : [0xc9a26b] };
}
