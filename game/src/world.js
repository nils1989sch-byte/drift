// Umgebung: Boden mit Wolkenschatten-Shader, Haus (Puppenhaus-Schnitt), Umzugswagen, Deko.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { WALLS, TRUCK_WALLS, ROOMS, PROPS, CARGO, RAMP, WALL_HEIGHT, HOUSE } from './config.js';
import { boxFromAABB } from './physics.js';

export const worldUniforms = { uTime: { value: 0 } };

// Wolkenschatten + Farbvariation per onBeforeCompile in Standard-Materialien
function patchGround(mat, { variation = 0.0, stripes = 0.0 } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = worldUniforms.uTime;
    shader.uniforms.uVar = { value: variation };
    shader.uniforms.uStripes = { value: stripes };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uVar; uniform float uStripes; varying vec3 vWPos;
float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y); }
float gFbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * gNoise(p); p *= 2.03; a *= 0.5; } return v; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float v = gFbm(vWPos.xz * 0.6) - 0.5;
  diffuseColor.rgb *= 1.0 + v * uVar;
  float st = step(0.5, fract(vWPos.x * 0.25));
  diffuseColor.rgb *= 1.0 + (st - 0.5) * uStripes;
}`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
{
  vec2 cp = vWPos.xz * 0.06 + vec2(uTime * 0.035, uTime * 0.02);
  float cloud = smoothstep(0.45, 0.75, gFbm(cp));
  gl_FragColor.rgb *= 1.0 - cloud * 0.28;
}`);
  };
  mat.customProgramCacheKey = () => `ground-${variation}-${stripes}`;
  return mat;
}

// ---------------------------------------------------------------------------
// Prozedurale Boden-Texturen
// ---------------------------------------------------------------------------
function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const rnd = (s) => { const x = Math.sin(s * 99.13) * 43758.5453; return x - Math.floor(x); };

const FLOOR_TEX = {
  wood: () => canvasTex(512, (g, s) => {
    const rows = 8, h = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd(r) * 200;
      let i = 0;
      while (x < s) {
        const w = 160 + rnd(r * 7 + i) * 140;
        const l = 62 + rnd(r * 13 + i * 3) * 10;
        g.fillStyle = `hsl(30, 45%, ${l}%)`;
        g.fillRect(x, r * h, w, h);
        g.strokeStyle = 'rgba(80,50,20,0.35)'; g.lineWidth = 3;
        g.strokeRect(x, r * h, w, h);
        for (let k = 0; k < 4; k++) {
          g.strokeStyle = 'rgba(120,80,40,0.12)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(x, r * h + 8 + k * 14); g.lineTo(x + w, r * h + 10 + k * 14); g.stroke();
        }
        x += w; i++;
      }
    }
  }, 1),
  darkwood: () => canvasTex(512, (g, s) => {
    const rows = 6, h = s / rows;
    for (let r = 0; r < rows; r++) for (let i = 0; i < 3; i++) {
      const x = (i + (r % 2) * 0.5) * (s / 2.5) - 100;
      g.fillStyle = `hsl(22, 40%, ${30 + rnd(r * 5 + i) * 8}%)`;
      g.fillRect(x, r * h, s / 2.5, h);
      g.strokeStyle = 'rgba(20,10,5,0.5)'; g.lineWidth = 3; g.strokeRect(x, r * h, s / 2.5, h);
    }
  }, 1),
  tiles: () => canvasTex(256, (g, s) => {
    const n = 4, w = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? '#f2efe8' : '#3d5a80';
      g.fillRect(x * w, y * w, w, w);
    }
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 3;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * w, 0); g.lineTo(i * w, s); g.stroke(); g.beginPath(); g.moveTo(0, i * w); g.lineTo(s, i * w); g.stroke(); }
  }, 1),
  carpet: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#c9b8e8'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${rnd(i) > 0.5 ? '255,255,255' : '90,70,140'},0.12)`; g.fillRect(rnd(i * 3) * s, rnd(i * 7) * s, 2, 2); }
  }, 1),
  herring: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#b07a48'; g.fillRect(0, 0, s, s);
    const w = 32, L = 128;
    g.save();
    for (let y = -s; y < s * 2; y += w) for (let x = -s; x < s * 2; x += L) {
      const odd = ((x / L) | 0) % 2;
      g.fillStyle = `hsl(28, 45%, ${46 + rnd(x * 0.3 + y) * 12}%)`;
      g.setTransform(1, 0, 0, 1, x + (y / w) * w * 0.5, y);
      g.rotate(odd ? Math.PI / 4 : -Math.PI / 4);
      g.fillRect(0, 0, L * 0.7, w);
      g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = 2; g.strokeRect(0, 0, L * 0.7, w);
    }
    g.restore();
  }, 1),
  stone: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#d8d2c4'; g.fillRect(0, 0, s, s);
    const n = 2, w = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = `hsl(40, 12%, ${78 + rnd(x * 3 + y) * 8}%)`;
      g.fillRect(x * w + 3, y * w + 3, w - 6, w - 6);
    }
  }, 1),
  metal: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#9aa3ad'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 32) {
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, i, s, 4);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, i + 4, s, 2);
    }
  }, 1),
};

function textTexture(text, { size = 64, color = 'rgba(60,40,30,0.35)', font = '700', w = 512, h = 128 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.font = `${font} ${size}px Fredoka, "Trebuchet MS", sans-serif`;
  g.fillStyle = color;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------
export function buildWorld(scene) {
  const obstacles = [];
  const animated = [];
  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  // --- Boden ---------------------------------------------------------------
  // große Flächen unterteilen: riesige Dreiecke, die die Near-Plane schneiden, verlieren Tiefengenauigkeit
  const plane = (w, d) => new THREE.PlaneGeometry(w, d, Math.max(1, Math.ceil(w / 2.5)), Math.max(1, Math.ceil(d / 2.5)));
  const grass = new THREE.Mesh(plane(90, 70),
    patchGround(new THREE.MeshStandardMaterial({ color: 0x7cc35a, roughness: 1 }), { variation: 0.45, stripes: 0.08 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.02;
  grass.receiveShadow = true;
  scene.add(grass);

  const flat = (w, d, x, z, mat, y = 0.005) => {
    const m = new THREE.Mesh(plane(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // Straße + Gehweg + Weg zur Haustür
  flat(40, 70, 7.0 + 20, 0, patchGround(new THREE.MeshStandardMaterial({ color: 0x4a4e57, roughness: 0.95 }), { variation: 0.3 }), 0.01);
  const sideTex = FLOOR_TEX.stone(); sideTex.repeat.set(1.5, 70);
  flat(1.4, 70, 6.35, 0, patchGround(new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.9 })), 0.02);
  const curb = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 70, 1, 1, 28), new THREE.MeshStandardMaterial({ color: 0xbfb8aa })));
  curb.position.set(7.05, 0.05, 0);
  scene.add(curb);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e0, roughness: 0.6 });
  for (let z = -34; z < 34; z += 3) flat(0.16, 1.6, 18.6, z, dashMat, 0.015);
  const pathTex = FLOOR_TEX.stone(); pathTex.repeat.set(4.5, 2);
  flat(4.6, 2.2, 3.4, 0, patchGround(new THREE.MeshStandardMaterial({ map: pathTex, roughness: 0.9 })), 0.015);

  // --- Haus -----------------------------------------------------------------
  // Fundament
  const found = new THREE.Mesh(new THREE.BoxGeometry(HOUSE.x2 - HOUSE.x1 + 0.6, 0.12, HOUSE.z2 - HOUSE.z1 + 0.6, 8, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0xa79e8e }));
  found.position.set((HOUSE.x1 + HOUSE.x2) / 2, 0.0, (HOUSE.z1 + HOUSE.z2) / 2);
  found.receiveShadow = true;
  scene.add(found);

  for (const r of ROOMS) {
    const tex = FLOOR_TEX[r.floor]();
    const w = r.x2 - r.x1, d = r.z2 - r.z1;
    tex.repeat.set(w / 2.5, d / 2.5);
    flat(w, d, (r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2,
      patchGround(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), { variation: 0.08 }), 0.065);
    const label = flat(Math.min(w - 0.6, 3.2), 0.8, (r.x1 + r.x2) / 2, r.z2 - 1.15,
      new THREE.MeshBasicMaterial({ map: textTexture(r.name), transparent: true, depthWrite: false }), 0.07);
    label.receiveShadow = false;
  }

  // Teppiche
  const rug = (w, d, x, z, color) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, 0.02, d, 2, 0.01), patchGround(new THREE.MeshStandardMaterial({ color, roughness: 1 }), { variation: 0.15 }));
    m.position.set(x, 0.075, z);
    m.receiveShadow = true;
    scene.add(m);
  };
  rug(3.4, 2.6, -2.6, -5.6, 0xe76f51);
  rug(2.2, 1.6, -9.0, -5.4, 0xf4d58d);
  rug(2.6, 1.4, -2.4, 5.4, 0x8ecae6);
  rug(2.4, 2.4, -14.6, 0, 0x6a4c93);

  // Wände
  const wallMat = { outer: new THREE.MeshStandardMaterial({ color: 0xf6efe4, roughness: 0.85 }),
    house: new THREE.MeshStandardMaterial({ color: 0xfffaf2, roughness: 0.85 }) };
  const capMat = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.6 });
  for (const w of WALLS) {
    const W = w.x2 - w.x1, D = w.z2 - w.z1;
    const m = shadowy(new THREE.Mesh(new THREE.BoxGeometry(W, WALL_HEIGHT, D), wallMat[w.kind] || wallMat.house));
    m.position.set((w.x1 + w.x2) / 2, WALL_HEIGHT / 2, (w.z1 + w.z2) / 2);
    scene.add(m);
    const cap = shadowy(new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.06, D + 0.04), capMat));
    cap.position.set(m.position.x, WALL_HEIGHT + 0.03, m.position.z);
    scene.add(cap);
    obstacles.push(boxFromAABB(w));
  }
  // Fensterbänder auf den Außenwänden
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fdcff, emissive: 0x4fa8e0, emissiveIntensity: 0.5, roughness: 0.1 });
  for (const x of [-15, -9, -3.6]) for (const z of [-9, 9]) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.34), glass);
    g.position.set(x, WALL_HEIGHT + 0.04, z);
    scene.add(g);
  }
  for (const z of [-5, 5]) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 1.6), glass); g.position.set(-17, WALL_HEIGHT + 0.04, z); scene.add(g); }
  // Fußmatte
  rug(0.8, 1.6, 1.7, 0, 0x6b4f3a);

  // --- Umzugswagen ------------------------------------------------------------
  const truck = new THREE.Group();
  scene.add(truck);
  const truckWhite = new THREE.MeshPhysicalMaterial({ color: 0xf7f7f2, roughness: 0.35, clearcoat: 0.6 });
  const truckOrange = new THREE.MeshPhysicalMaterial({ color: 0xff7b29, roughness: 0.35, clearcoat: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x23252b, roughness: 0.8 });
  const metalTex = FLOOR_TEX.metal(); metalTex.repeat.set(3, 3);
  const bed = shadowy(new THREE.Mesh(new THREE.BoxGeometry(6.6, CARGO.floor, 5.7),
    patchGround(new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.5, metalness: 0.4 }))));
  bed.position.set(11.3, CARGO.floor / 2, 0);
  truck.add(bed);
  const wallH = 0.9;
  for (const w of TRUCK_WALLS) {
    obstacles.push(boxFromAABB(w));
    if (w.kind !== 'truck') continue;
    const W = w.x2 - w.x1, D = w.z2 - w.z1;
    const m = shadowy(new THREE.Mesh(new RoundedBoxGeometry(W, wallH, D, 2, 0.04), truckWhite));
    m.position.set((w.x1 + w.x2) / 2, CARGO.floor + wallH / 2, (w.z1 + w.z2) / 2);
    truck.add(m);
    if (D < 0.5 && W > 3) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.01, 0.16, D + 0.01), truckOrange);
      stripe.position.set(m.position.x, CARGO.floor + wallH - 0.15, m.position.z);
      truck.add(stripe);
    }
  }
  // Firmenschriftzug auf der Seite zur Kamera
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.55),
    new THREE.MeshBasicMaterial({ map: textTexture('UMZUG FLINK & HEIL', { size: 70, color: '#ff7b29', w: 1024, h: 128 }), transparent: true }));
  logo.position.set(11.3, CARGO.floor + 0.42, 2.86);
  truck.add(logo);
  // Fahrerhaus
  const cab = shadowy(new THREE.Mesh(new RoundedBoxGeometry(3.0, 2.0, 5.2, 4, 0.3), truckOrange));
  cab.position.set(16.1, 1.0 + 0.25, 0);
  truck.add(cab);
  const wind = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.8, 4.4, 2, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.05, metalness: 0.6, emissive: 0x0a1a2a }));
  wind.position.set(17.55, 1.75, 0);
  truck.add(wind);
  const roof = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.12, 4.4, 2, 0.05), truckWhite);
  roof.position.set(16.0, 2.3, 0);
  truck.add(roof);
  const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xffb703, emissive: 0xffa000, emissiveIntensity: 1.5 }));
  beacon.position.set(16.0, 2.43, 0);
  truck.add(beacon);
  animated.push((t) => { beacon.material.emissiveIntensity = 0.6 + Math.max(0, Math.sin(t * 6)) * 2.5; });
  for (const z of [-1.9, 1.9]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.2 }));
    hl.position.set(17.62, 0.75, z);
    truck.add(hl);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 22);
  for (const x of [9.4, 13.2, 16.2]) for (const z of [-2.75, 2.75]) {
    const w = shadowy(new THREE.Mesh(wheelGeo, darkMat));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.45, z);
    truck.add(w);
  }
  // Rampe
  const rampLen = Math.hypot(RAMP.x2 - RAMP.x1, CARGO.floor);
  const rampTex = FLOOR_TEX.metal(); rampTex.repeat.set(2, 1);
  const ramp = shadowy(new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.06, RAMP.z2 - RAMP.z1),
    new THREE.MeshStandardMaterial({ map: rampTex, metalness: 0.5, roughness: 0.45 })));
  ramp.position.set((RAMP.x1 + RAMP.x2) / 2, CARGO.floor / 2, 0);
  ramp.rotation.z = Math.atan2(CARGO.floor, RAMP.x2 - RAMP.x1);
  truck.add(ramp);

  // Ladezone mit animiertem Shader
  const zoneUniforms = { uTime: worldUniforms.uTime, uActive: { value: 0 }, uFill: { value: 0 } };
  const zone = new THREE.Mesh(new THREE.PlaneGeometry(CARGO.x2 - CARGO.x1, CARGO.z2 - CARGO.z1), new THREE.ShaderMaterial({
    uniforms: zoneUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uActive; uniform float uFill; varying vec2 vUv;
      void main() {
        vec2 p = vUv;
        vec2 e = min(p, 1.0 - p) * vec2(6.0, 5.0);
        float border = 1.0 - smoothstep(0.0, 0.12, min(e.x, e.y));
        // Pfeile, die in den Wagen hineinlaufen
        float chev = fract((p.x * 6.0 - abs(p.y - 0.5) * 3.0) - uTime * 0.9);
        float arrows = smoothstep(0.0, 0.08, chev) * (1.0 - smoothstep(0.18, 0.26, chev));
        arrows *= smoothstep(0.42, 0.2, abs(p.y - 0.5)) * 0.35;
        float pulse = 0.6 + 0.4 * sin(uTime * 4.0);
        vec3 col = vec3(0.25, 1.0, 0.55) * (border * (0.7 + uActive * pulse) + arrows * (0.5 + uActive));
        col += vec3(1.0, 0.85, 0.3) * border * uFill * 0.4;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  zone.rotation.x = -Math.PI / 2;
  zone.position.set((CARGO.x1 + CARGO.x2) / 2, CARGO.floor + 0.012, (CARGO.z1 + CARGO.z2) / 2);
  truck.add(zone);

  // --- Deko / Requisiten ------------------------------------------------------
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.9, flatShading: true });
  const leaf2 = new THREE.MeshStandardMaterial({ color: 0x6fcf5f, roughness: 0.9, flatShading: true });
  const bark = new THREE.MeshStandardMaterial({ color: 0x7a5132, roughness: 1 });
  const blob = new THREE.IcosahedronGeometry(1, 1);
  for (const p of PROPS) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    let solid = null;
    if (p.type === 'tree') {
      const trunk = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.6, 10), bark));
      trunk.position.y = 0.8; g.add(trunk);
      const crown = new THREE.Group(); crown.position.y = 2.1; g.add(crown);
      [[0, 0, 0, 1.2, leaf], [0.6, -0.3, 0.3, 0.8, leaf2], [-0.5, -0.2, -0.3, 0.85, leaf2], [0.1, 0.7, -0.1, 0.75, leaf]].forEach(([x, y, z, s, m]) => {
        const c = shadowy(new THREE.Mesh(blob, m)); c.position.set(x, y, z); c.scale.setScalar(s); crown.add(c);
      });
      const ph = p.x * 0.7;
      animated.push((t) => { crown.rotation.z = Math.sin(t * 1.3 + ph) * 0.04; crown.rotation.x = Math.cos(t * 1.1 + ph) * 0.03; });
      solid = { hx: 0.3, hz: 0.3 };
    } else if (p.type === 'bush') {
      [[0, 0.35, 0, 0.5], [0.35, 0.28, 0.1, 0.38], [-0.3, 0.3, -0.05, 0.4]].forEach(([x, y, z, s], i) => {
        const c = shadowy(new THREE.Mesh(blob, i ? leaf2 : leaf)); c.position.set(x, y, z); c.scale.setScalar(s); g.add(c);
      });
      solid = { hx: 0.6, hz: 0.45 };
    } else if (p.type === 'hedge') {
      const h = shadowy(new THREE.Mesh(new RoundedBoxGeometry(p.w, 0.8, 0.7, 3, 0.2), leaf));
      h.position.y = 0.4; g.add(h);
      solid = { hx: p.w / 2, hz: 0.35 };
    } else if (p.type === 'mailbox') {
      const post = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), bark)); post.position.y = 0.45; g.add(post);
      const box = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.3, 0.3, 2, 0.08), new THREE.MeshStandardMaterial({ color: 0xffd23f })));
      box.position.y = 1.0; g.add(box);
      solid = { hx: 0.2, hz: 0.2 };
    } else if (p.type === 'lamp') {
      const pole = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 10), darkMat)); pole.position.y = 1.6; g.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xffe9a0, emissiveIntensity: 1.2 }));
      head.position.y = 3.25; g.add(head);
      solid = { hx: 0.12, hz: 0.12 };
    } else if (p.type === 'car') {
      const body = shadowy(new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.7, 4.0, 4, 0.25), new THREE.MeshPhysicalMaterial({ color: 0x3a86ff, roughness: 0.3, clearcoat: 1 })));
      body.position.y = 0.6; g.add(body);
      const top = shadowy(new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.6, 2.0, 4, 0.22), new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.1, metalness: 0.5 })));
      top.position.set(0, 1.15, 0.2); g.add(top);
      for (const x of [-0.95, 0.95]) for (const z of [-1.3, 1.3]) {
        const w = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 16), darkMat));
        w.rotation.z = Math.PI / 2; w.position.set(x, 0.33, z); g.add(w);
      }
      solid = { hx: 1.0, hz: 2.0 };
    } else if (p.type === 'cone') {
      const c = shadowy(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 14), new THREE.MeshStandardMaterial({ color: 0xff6b1a })));
      c.position.y = 0.28; g.add(c);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.155, 0.08, 14), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      s.position.y = 0.3; g.add(s);
      solid = { hx: 0.15, hz: 0.15 };
    }
    if (solid && p.solid !== false) obstacles.push({ cx: p.x, cz: p.z, hx: solid.hx, hz: solid.hz, a: 0 });
  }

  // Weltgrenzen (unsichtbar)
  obstacles.push({ cx: 0, cz: -11.6, hx: 30, hz: 0.5, a: 0 }, { cx: 0, cz: 11.6, hx: 30, hz: 0.5, a: 0 },
    { cx: -19.1, cz: 0, hx: 0.5, hz: 20, a: 0 }, { cx: 19.6, cz: 0, hx: 0.5, hz: 20, a: 0 });

  return {
    obstacles,
    zoneUniforms,
    update(dt, t) {
      worldUniforms.uTime.value = t;
      for (const f of animated) f(t);
    },
  };
}
