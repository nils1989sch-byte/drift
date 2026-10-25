// Dynamische Shader-Effekte für den HD-2D-Renderer (renderer3d.js):
//  · Wasser: Wellen-Normalen im Pixelraster, Spiegelung der Szene (Planar-Reflexion), Himmel-Fresnel, Sonnenglitzern,
//    Uferschaum, Ringe wo Figuren durchs Wasser laufen, Regentropfen-Ringe
//  · Licht: welche Sprites leuchten (Fackeln, Laternen, Kristalle, Feuer-/Blitz-Monster, Attacken) – Farbe, Stärke, Flackern
//  · Wetter: ziehende Wolkenschatten, Nässe + Pfützen (nur Wege/Erde/Sand/Pflaster), Regen + Spritzer, Gewitterblitze,
//    Morgennebel/Nebel, Glühwürmchen nachts
// Alle beleuchteten Materialien werden per onBeforeCompile gepatcht und teilen sich die Uniforms in FXU.
import * as THREE from 'three';

export const FXU = {
  uFxTime: { value: 0 }, uCloud: { value: 0.2 }, uWet: { value: 0 }, uPuddle: { value: 0 }, uWind: { value: new THREE.Vector2(0.018, 0.007) },
  tPuddle: { value: null }, uMapPx: { value: new THREE.Vector2(1, 1) }, uSkyCol: { value: new THREE.Color('#a8c4e0') },
};

const NOISE = `
  float fxHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float fxNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), f.x), mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + vec2(1.0, 1.0)), f.x), f.y); }
`;
const FRAG_HEAD = `
  varying vec3 vFxPos;
  uniform float uFxTime, uCloud, uWet, uPuddle; uniform vec2 uWind, uMapPx; uniform sampler2D tPuddle; uniform vec3 uSkyCol;
  ${NOISE}
  float fxCloud(){
    vec2 p = vFxPos.xz / 380.0 + uWind * uFxTime;
    float n = fxNoise(p) * 0.6 + fxNoise(p * 2.3 + 7.0) * 0.3 + fxNoise(p * 5.1 + 3.0) * 0.1;
    float thr = 1.0 - uCloud * 0.85;
    return 1.0 - smoothstep(thr - 0.06, thr + 0.1, n) * (0.3 + 0.45 * uCloud);
  }
`;

/** Beleuchtetes Material um Wolkenschatten, Nässe und (Boden) Pfützen erweitern. Idempotent. */
export function patchLit(m, { puddles = false } = {}) {
  if (!m || m.userData.fx3d || m.isShaderMaterial || !(m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshStandardMaterial)) return false;
  m.userData.fx3d = true;
  const orig = m.onBeforeCompile && m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ? m.onBeforeCompile : null;
  m.onBeforeCompile = (sh, r) => {
    orig?.call(m, sh, r);
    for (const k of Object.keys(FXU)) sh.uniforms[k] = FXU[k];
    sh.vertexShader = 'varying vec3 vFxPos;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        vFxPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vFxPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
    const lights = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );',
      'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= fxCloud();');
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader
      .replace('#include <lights_fragment_begin>', lights)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(1.0, 0.74, uWet);
        ${puddles ? `{
          float pm = texture2D(tPuddle, vFxPos.xz / uMapPx).r;
          float pn = fxNoise(vFxPos.xz / 26.0) * 0.7 + fxNoise(vFxPos.xz / 8.0) * 0.3;
          float pud = smoothstep(0.56, 0.6, pn) * pm * uPuddle;
          float rip = step(0.93, fxHash(floor(vFxPos.xz / 3.0) + floor(uFxTime * 5.0))) * 0.25;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.35 + uSkyCol * (0.42 + rip), pud);
        }` : ''}`);
  };
  m.customProgramCacheKey = () => `fx3d|${puddles ? 1 : 0}|${orig ? orig.toString() : ''}`;
  if (m.version > 0) m.needsUpdate = true;
  return true;
}
/** alle Materialien eines Objekts patchen (Bäume, Häuser, Billboards …) */
export function patchTree(root) {
  root.traverse((o) => {
    if (!o.material || o.userData.noFx) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) patchLit(m);
  });
}

/** Pfützen-Maske einer Welt (1 Texel pro Tile): Wege, Erde, Sand, Pflaster, Lichtung */
export function puddleMask(world) {
  const OK = new Set(['path', 'dirt', 'sand', 'stone_floor', 'clearing', 'soil', 'soil_wet', 'bridge', 'dungeon_floor']);
  const data = new Uint8Array(world.w * world.h * 4);
  for (let ty = 0; ty < world.h; ty++) for (let tx = 0; tx < world.w; tx++) {
    const id = world.tileAt(tx, ty);
    const ok = OK.has(id) || (TILE_LIKE(id) && OK.has(TILE_LIKE(id)));
    const i = (ty * world.w + tx) * 4;
    data[i] = data[i + 1] = data[i + 2] = ok ? 255 : 0; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, world.w, world.h, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.flipY = false; t.needsUpdate = true;
  return t;
}
let TILE_LIKE = () => null;
export function setTileLike(fn) { TILE_LIKE = fn; }

// ------------------------------------------------------------------------------------------------ Wasser
export function createWaterMaterial() {
  const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    tRefl: { value: null }, uReflMat: { value: new THREE.Matrix4() }, uReflOn: { value: 0 },
    uSky: { value: new THREE.Color('#a8c4e0') }, uLight: { value: new THREE.Color('#ffffff') },
    uDeep: { value: new THREE.Color('#174f86') }, uShallow: { value: new THREE.Color('#3f9cb8') }, uFoam: { value: new THREE.Color('#e8f4f8') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color('#ffe8c0') }, uDay: { value: 1 }, uRain: { value: 0 },
    uRip: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -99, 0)) },
  }]);
  u.uFxTime = FXU.uFxTime;
  return new THREE.ShaderMaterial({
    uniforms: u, fog: true, transparent: true, depthWrite: false,
    vertexShader: `
      #include <fog_pars_vertex>
      attribute float aDepth; attribute float aShore;
      varying float vDepth, vShore; varying vec3 vW; varying vec4 vRefl;
      uniform mat4 uReflMat;
      void main(){
        vDepth = aDepth; vShore = aShore;
        vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vRefl = uReflMat * wp;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      varying float vDepth, vShore; varying vec3 vW; varying vec4 vRefl;
      uniform sampler2D tRefl; uniform float uReflOn, uFxTime, uDay, uRain;
      uniform vec3 uSky, uLight, uDeep, uShallow, uFoam, uSunDir, uSunCol; uniform vec4 uRip[8];
      ${NOISE}
      vec2 waveGrad(vec2 p){
        float t = uFxTime;
        vec2 g = vec2(cos(p.x * 0.35 + t * 1.3) * 0.35, cos(p.y * 0.29 - t * 1.1) * 0.35);
        float d = cos((p.x + p.y) * 0.21 + t * 0.8) * 0.25; g += vec2(d);
        vec2 q = p * 0.12 + vec2(t * 0.15, -t * 0.1);
        float n0 = fxNoise(q), nx = fxNoise(q + vec2(0.06, 0.0)), ny = fxNoise(q + vec2(0.0, 0.06));
        g += vec2(nx - n0, ny - n0) * 9.0;
        return g;
      }
      void main(){
        vec2 p = floor(vW.xz * 3.0) / 3.0;                       // Pixelraster der HD-Tiles
        vec2 g = waveGrad(p) * 0.12;
        float rip = 0.0;
        for (int i = 0; i < 8; i++) {
          vec4 r = uRip[i]; float age = uFxTime - r.z;
          if (age > 0.0 && age < 2.4) {
            vec2 d = p - r.xy; float dist = length(d);
            float ring = exp(-pow((dist - age * 20.0) / 2.2, 2.0)) * exp(-age * 1.7) * r.w;
            g += d / (dist + 0.001) * ring * 0.9; rip += ring;
          }
        }
        if (uRain > 0.01) {
          vec2 c = floor(p / 5.0); vec2 o = vec2(fxHash(c), fxHash(c + 3.1)) * 5.0;
          float ph = fract(uFxTime * 0.9 + fxHash(c + 7.7)); vec2 d = p - (c * 5.0 + o);
          float ring = exp(-pow((length(d) - ph * 4.0) / 0.7, 2.0)) * (1.0 - ph) * uRain * step(0.35, fxHash(c + floor(uFxTime * 0.9 + fxHash(c + 7.7))));
          g += d / (length(d) + 0.001) * ring * 0.6; rip += ring * 0.7;
        }
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vW);
        float fres = 0.16 + 0.62 * pow(1.0 - max(dot(V, N), 0.0), 4.0);
        vec3 base = mix(uShallow, uDeep, vDepth) * uLight;
        vec3 refl = mix(uSky, uShallow * 1.5, 0.45) * uLight * 0.8;
        if (uReflOn > 0.5) {
          vec2 ruv = vRefl.xy / vRefl.w + N.xz * 0.03;
          vec3 rt = texture2D(tRefl, ruv).rgb;
          refl = mix(refl, rt * mix(vec3(1.0), uShallow * 1.8, 0.35), 0.8);
        }
        vec3 col = mix(base, refl, clamp(fres * 0.7 + 0.12, 0.0, 0.62));
        vec3 H = normalize(uSunDir + V);
        float sp = pow(max(dot(N, H), 0.0), 260.0);
        float glit = step(0.45, sp * (0.4 + 1.2 * fxHash(p + floor(uFxTime * 7.0))));
        col += uSunCol * (sp * 1.4 + glit * 1.6) * uDay;
        float fn = fxNoise(p * 0.45 + vec2(uFxTime * 0.25, -uFxTime * 0.18));
        float foam = vShore > 0.3 ? step(0.92, vShore + (fn - 0.5) * 0.45 + 0.1 * sin(uFxTime * 1.6 + (p.x + p.y) * 0.15)) : 0.0;
        col = mix(col, uFoam * uLight, foam * 0.6);
        col += vec3(0.9, 0.95, 1.0) * rip * 0.35 * uLight;
        float a = mix(0.48, 0.88, vDepth);
        a = clamp(max(a, foam * 0.95) + fres * 0.15 + rip * 0.2, 0.0, 0.97);
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });
}

/** Planare Spiegelung (wie three/addons Reflector, aber mit eigenem Render-Target und Ebenen-Höhe pro Karte) */
export function createReflection() {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const vcam = new THREE.PerspectiveCamera();
  vcam.layers.set(0);
  const texMat = new THREE.Matrix4(), rot = new THREE.Matrix4();
  const camPos = new THREE.Vector3(), refPos = new THREE.Vector3(), view = new THREE.Vector3(), lookAt = new THREE.Vector3(), target = new THREE.Vector3();
  const N = new THREE.Vector3(0, 1, 0), plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  return {
    rt, texMat,
    setSize(w, h) { rt.setSize(Math.max(2, w | 0), Math.max(2, h | 0)); },
    render(gl, scene, camera, y) {
      camPos.setFromMatrixPosition(camera.matrixWorld);
      refPos.set(camPos.x, y, camPos.z);
      rot.extractRotation(camera.matrixWorld);
      view.subVectors(refPos, camPos);
      if (view.dot(N) > 0) return false;
      view.reflect(N).negate().add(refPos);
      lookAt.set(0, 0, -1).applyMatrix4(rot).add(camPos);
      target.subVectors(refPos, lookAt).reflect(N).negate().add(refPos);
      vcam.position.copy(view);
      vcam.up.set(0, 1, 0).applyMatrix4(rot).reflect(N);
      vcam.lookAt(target);
      vcam.far = camera.far; vcam.near = camera.near;
      vcam.updateMatrixWorld();
      vcam.projectionMatrix.copy(camera.projectionMatrix);
      texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      texMat.multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
      plane.setFromNormalAndCoplanarPoint(N, refPos).applyMatrix4(vcam.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const e = vcam.projectionMatrix.elements;
      q.x = (Math.sign(clip.x) + e[8]) / e[0]; q.y = (Math.sign(clip.y) + e[9]) / e[5]; q.z = -1; q.w = (1 + e[10]) / e[14];
      clip.multiplyScalar(2 / clip.dot(q));
      e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1 - 0.003; e[14] = clip.w;
      const prevRT = gl.getRenderTarget(), prevShadow = gl.shadowMap.autoUpdate;
      gl.shadowMap.autoUpdate = false;
      gl.setRenderTarget(rt); gl.clear();
      gl.render(scene, vcam);
      gl.setRenderTarget(prevRT);
      gl.shadowMap.autoUpdate = prevShadow;
      return true;
    },
  };
}

// ------------------------------------------------------------------------------------------------ Licht
// c = Farbe, p = Stärke (relativ), f = Flackern 0..1, n = nur nachts, pulse = langsames Pulsieren
const ELEM = { fire: ['#ff7a30', 1.4, 0.5], spark: ['#fff07a', 1.3, 0.8], water: ['#60b8ff', 0.7, 0.2], leaf: ['#90ff80', 0.6, 0.2], wind: ['#c8f4ff', 0.5, 0.2], rock: null, normal: null };
export function lightFor(key, d) {
  if (d?.elem && ELEM[d.elem]) { const [c, p, f] = ELEM[d.elem]; return { c, p, f, r: 90 }; }
  if (!key) return null;
  if (key === 'torch' || key === 'torch_lit') return { c: '#ff9a40', p: 1, f: 0.35, r: 110 };
  if (key === 'lantern') return { c: '#ffd070', p: 0.9, f: 0.12, n: true, r: 110 };
  if (key === 'crystal') return { c: '#80e8ff', p: 0.9, pulse: 1, r: 100 };
  if (key === 'portal') return { c: '#b088ff', p: 1, pulse: 1.6, r: 110 };
  if (key.startsWith('mon_funkel') || key.startsWith('mon_glutar')) return { c: '#ff8a40', p: key.includes('glutar') ? 0.8 : 0.5, f: 0.4, r: 70, mon: 1 };
  if (key.startsWith('mon_zappi')) return { c: '#fff080', p: 0.45, f: 0.9, r: 60, mon: 1 };
  if (key.startsWith('mon_pilzling')) return { c: '#a0ffd0', p: 0.35, pulse: 0.7, n: true, r: 55, mon: 1 };
  return null;
}

// ------------------------------------------------------------------------------------------------ Wetter
export const WEATHER = {
  clear: { cloud: 0.18, rain: 0, storm: 0, fog: 0 },
  cloudy: { cloud: 0.78, rain: 0, storm: 0, fog: 0.15 },
  rain: { cloud: 0.92, rain: 0.75, storm: 0, fog: 0.25 },
  storm: { cloud: 1, rain: 1, storm: 1, fog: 0.3 },
  fog: { cloud: 0.5, rain: 0, storm: 0, fog: 1 },
};
export const WEATHER_NAMES = { clear: 'Klar', cloudy: 'Bewölkt', rain: 'Regen', storm: 'Gewitter', fog: 'Nebel' };

export function createWeather(scene, { mobile = false } = {}) {
  const S = { kind: 'clear', cloud: 0.18, rain: 0, storm: 0, fog: 0, wet: 0, flash: 0, next: 6, center: new THREE.Vector3() };
  // Regen: Linien, die im Vertex-Shader fallen und um die Kamera „gewickelt“ werden
  const N = mobile ? 900 : 1800;
  const seeds = new Float32Array(N * 2 * 3), ends = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { const sd = [Math.random(), Math.random(), Math.random()]; for (let k = 0; k < 2; k++) { seeds.set(sd, (i * 2 + k) * 3); ends[i * 2 + k] = k; } }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
  rg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  rg.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  const ru = { uCenter: { value: S.center }, uTime: FXU.uFxTime, uRain: { value: 0 }, uCol: { value: new THREE.Color('#c8d8ec') } };
  const WRAP = `
    vec3 wrapPos(vec3 seed, float box){
      vec2 w = seed.xy * box;
      return vec3(uCenter.x + mod(w.x - uCenter.x + box * 0.5, box) - box * 0.5, 0.0, uCenter.z + mod(w.y - uCenter.z + box * 0.5, box) - box * 0.5);
    }`;
  const rain = new THREE.LineSegments(rg, new THREE.ShaderMaterial({
    uniforms: ru, transparent: true, depthWrite: false,
    vertexShader: `attribute vec3 aSeed; attribute float aEnd; uniform vec3 uCenter; uniform float uTime, uRain; varying float vA; ${WRAP}
      void main(){
        vec3 p = wrapPos(aSeed, 620.0);
        float sp = 0.75 + 0.5 * fract(aSeed.x * 7.13);
        float fall = fract(aSeed.z - uTime * 1.1 * sp);
        p.y = uCenter.y - 10.0 + fall * 300.0 + aEnd * 15.0;
        p.x += aEnd * 2.5 + (1.0 - fall) * 18.0;
        vA = step(fract(aSeed.x * 13.7 + aSeed.y * 3.1), uRain) * (0.35 + 0.45 * aEnd);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(uCol, vA); }`,
  }));
  rain.frustumCulled = false; rain.renderOrder = 20; rain.layers.set(1);
  // Spritzer am Boden + Glühwürmchen als Punkte
  const mkPoints = (n, vs, fs, uni, add) => {
    const g = new THREE.BufferGeometry();
    const sd = new Float32Array(n * 3); for (let i = 0; i < sd.length; i++) sd[i] = Math.random();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 3));
    const p = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: uni, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, vertexShader: vs, fragmentShader: fs }));
    p.frustumCulled = false; p.renderOrder = 21;
    return p;
  };
  const su = { uCenter: { value: S.center }, uTime: FXU.uFxTime, uRain: { value: 0 }, uPx: { value: 1 } };
  const splash = mkPoints(mobile ? 160 : 320, `attribute vec3 aSeed; uniform vec3 uCenter; uniform float uTime, uRain, uPx; varying float vA, vPh; ${WRAP}
      void main(){ vec3 p = wrapPos(aSeed, 420.0); p.y = uCenter.y + 0.6;
        float ph = fract(aSeed.z + uTime * 1.7); vPh = ph;
        vA = step(fract(aSeed.x * 9.1), uRain) * step(ph, 0.3) * (1.0 - ph / 0.3);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); gl_PointSize = (2.0 + ph * 18.0) * uPx; }`,
    `varying float vA, vPh; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
      float ring = step(0.32, d) * step(d, 0.48); if (ring * vA < 0.01) discard; gl_FragColor = vec4(0.85, 0.9, 1.0, vA * 0.7); }`, su, false);
  splash.layers.set(1);
  const fu = { uCenter: { value: S.center }, uTime: FXU.uFxTime, uOn: { value: 0 }, uPx: { value: 1 } };
  const flies = mkPoints(mobile ? 40 : 80, `attribute vec3 aSeed; uniform vec3 uCenter; uniform float uTime, uOn, uPx; varying float vA; ${WRAP}
      void main(){ vec3 p = wrapPos(aSeed, 380.0);
        p.x += sin(uTime * 0.6 + aSeed.z * 20.0) * 9.0; p.z += cos(uTime * 0.5 + aSeed.x * 17.0) * 7.0;
        p.y = uCenter.y + 5.0 + aSeed.z * 16.0 + sin(uTime * 1.3 + aSeed.y * 30.0) * 3.0;
        float blink = smoothstep(0.55, 1.0, sin(uTime * (1.2 + aSeed.y) + aSeed.x * 40.0) * 0.5 + 0.5);
        vA = uOn * blink;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); gl_PointSize = 3.0 * uPx; }`,
    `varying float vA; void main(){ if (vA < 0.02) discard; vec2 c = gl_PointCoord - 0.5; if (max(abs(c.x), abs(c.y)) > 0.5) discard;
      gl_FragColor = vec4(vec3(0.85, 1.0, 0.45) * (1.5 * vA), vA); }`, fu, true);
  scene.add(rain, splash, flies);

  const W = {
    S, rain, splash, flies,
    set(kind, instant = false) { if (!WEATHER[kind]) return; S.kind = kind; if (instant) { Object.assign(S, WEATHER[kind]); S.wet = WEATHER[kind].rain > 0.3 ? 1 : 0; } },
    /** pro Frame: dt, Tageszeit h (null = innen), Mittelpunkt (Blickpunkt), Pixelmaßstab, draußen? */
    update(dt, h, look, px, outdoor) {
      const T = outdoor ? WEATHER[S.kind] : { cloud: 0, rain: 0, storm: 0, fog: 0 };
      const k = Math.min(1, dt * 0.35);
      for (const key of ['cloud', 'rain', 'storm', 'fog']) S[key] += (T[key] - S[key]) * k;
      S.wet = Math.max(0, Math.min(1, S.wet + (S.rain > 0.3 ? 0.12 : -0.025) * dt));
      if (!outdoor) S.wet = 0;
      // Morgennebel (5–8 Uhr) zusätzlich, außer bei Gewitter
      const morning = h == null ? 0 : Math.max(0, 1 - Math.abs(h - 6.3) / 1.8) * 0.55 * (1 - S.storm);
      S.fogNow = Math.min(1, S.fog + morning);
      // Blitze
      S.flash = Math.max(0, S.flash - dt * 4.5);
      if (S.storm > 0.6 && outdoor) {
        S.next -= dt;
        if (S.next <= 0) { S.flash = 1; S.next = 4 + Math.random() * 10; S.thunder = 0.25 + Math.random() * 1.2; }
      }
      if (S.thunder != null) { S.thunder -= dt; if (S.thunder <= 0) { S.thunder = null; W.onThunder?.(); } }
      const doubleFlash = S.flash > 0 ? Math.max(S.flash, S.flash > 0.5 ? 0 : Math.max(0, Math.sin(S.flash * 20) * 0.6)) : 0;
      S.light = doubleFlash;
      S.center.copy(look);
      FXU.uCloud.value = S.cloud;
      FXU.uWet.value = S.wet;
      FXU.uPuddle.value = Math.min(1, S.wet * 1.4);
      ru.uRain.value = S.rain; su.uRain.value = S.rain; su.uPx.value = px;
      fu.uPx.value = px;
      const night = h == null ? 0 : h < 5 || h > 21 ? 1 : h < 7 ? (7 - h) / 2 : h > 19 ? (h - 19) / 2 : 0;
      fu.uOn.value = outdoor ? night * (1 - S.rain) * (1 - S.fog * 0.6) : 0;
      rain.visible = splash.visible = S.rain > 0.02;
      flies.visible = fu.uOn.value > 0.02;
      return S;
    },
  };
  return W;
}
