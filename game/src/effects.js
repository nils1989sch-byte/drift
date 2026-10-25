// Post-Processing, Screen-Shake und Partikel.
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Post-Processing: eigener Fullscreen-Pass
// ---------------------------------------------------------------------------
const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const POST_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uTrauma;
uniform float uDanger;
uniform float uFlash;
uniform float uTime;
uniform float uTilt;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 fetchCA(vec2 uv, vec2 dir) {
  return vec3(
    texture2D(tDiffuse, uv + dir).r,
    texture2D(tDiffuse, uv).g,
    texture2D(tDiffuse, uv - dir).b);
}

void main() {
  vec2 c = vUv - 0.5;
  // leichte Linsenverzerrung, die mit dem Shake-Trauma wächst
  vec2 uv = vUv + c * dot(c, c) * uTrauma * 0.12;
  vec2 caDir = c * (0.0015 + uTrauma * 0.02);

  // Tilt-Shift: oben und unten unscharf -> Miniatur-/Spielzeug-Look
  float blur = smoothstep(0.24, 0.5, abs(vUv.y - 0.5)) * uTilt;
  vec2 px = 1.0 / uRes;
  vec3 col = fetchCA(uv, caDir) * 2.0;
  float wsum = 2.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398 + 0.39;
    vec2 o = vec2(cos(a), sin(a)) * blur * px * (i < 4 ? 1.5 : 3.0);
    col += fetchCA(uv + o, caDir);
    wsum += 1.0;
  }
  col /= wsum;

  // Farbgebung: etwas wärmer und satter
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, 1.12) * vec3(1.03, 1.0, 0.96);

  // Vignette
  float vig = smoothstep(0.95, 0.3, length(c * vec2(1.0, 1.15)));
  col *= mix(0.62, 1.0, vig);

  // Schadens-Puls am Rand
  float edge = 1.0 - vig;
  col = mix(col, vec3(1.4, 0.12, 0.08) * (0.4 + luma), clamp(edge * edge * uDanger * 1.6, 0.0, 0.6));
  col += vec3(1.0, 0.95, 0.85) * uFlash;

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb += (hash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.03;
}`;

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.material = new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      uniforms: {
        tDiffuse: { value: this.rt.texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTrauma: { value: 0 },
        uDanger: { value: 0 },
        uFlash: { value: 0 },
        uTime: { value: 0 },
        uTilt: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(geo, this.material);
    quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.danger = 0;
    this.flash = 0;
  }

  setSize(w, h, pr) {
    this.rt.setSize(Math.floor(w * pr), Math.floor(h * pr));
    this.material.uniforms.uRes.value.set(w * pr, h * pr);
  }

  pulseDanger(v) { this.danger = Math.min(1.2, this.danger + v); }
  pulseFlash(v) { this.flash = Math.min(0.3, this.flash + v); }

  render(scene, camera, dt, trauma, time) {
    this.danger = Math.max(0, this.danger - dt * 1.6);
    this.flash = Math.max(0, this.flash - dt * 3.5);
    const u = this.material.uniforms;
    u.uTrauma.value = trauma;
    u.uDanger.value = this.danger;
    u.uFlash.value = this.flash;
    u.uTime.value = time;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}

// ---------------------------------------------------------------------------
// Screen-Shake (Trauma-Modell: Stärke = trauma², klingt ab)
// ---------------------------------------------------------------------------
export class Shaker {
  constructor() { this.trauma = 0; this.t = 0; }
  add(amount) { this.trauma = Math.min(1, this.trauma + amount); }
  update(dt) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.15);
  }
  get power() { return this.trauma * this.trauma; }
  // weiches Pseudo-Rauschen aus überlagerten Sinuswellen
  n(seed) {
    const t = this.t * 28;
    return (Math.sin(t * 1.0 + seed) * 0.5 + Math.sin(t * 2.31 + seed * 3.1) * 0.3 + Math.sin(t * 4.77 + seed * 7.7) * 0.2);
  }
  apply(camera, basePos, target) {
    const p = this.power;
    camera.position.copy(basePos);
    camera.position.x += this.n(1.3) * p * 0.9;
    camera.position.y += this.n(4.1) * p * 0.5;
    camera.position.z += this.n(7.9) * p * 0.6;
    camera.lookAt(target);
    camera.rotateZ(this.n(11.2) * p * 0.05);
  }
}

// ---------------------------------------------------------------------------
// Partikel (InstancedMesh-Pools)
// ---------------------------------------------------------------------------
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

class Pool {
  constructor(scene, geometry, material, capacity, shadows = false) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = shadows;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10; // nach der Szene zeichnen
    for (let i = 0; i < capacity; i++) {
      this.mesh.setColorAt(i, _c.set(0xffffff));
      _m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, _m);
    }
    scene.add(this.mesh);
    this.cap = capacity;
    this.items = [];
    this.next = 0;
  }
  spawn(o) {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    const p = {
      i, x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6,
      sx: o.spin ?? (Math.random() - 0.5) * 12, sy: (Math.random() - 0.5) * 12,
      size: o.size || 0.1, sxs: o.sxs || 1, sys: o.sys || 1, szs: o.szs || 1,
      life: 0, max: o.life || 1, g: o.g ?? -18, drag: o.drag ?? 0.5, bounce: o.bounce ?? 0.35,
      floor: o.floor ?? 0, mode: o.mode || 'shrink', flutter: o.flutter || 0,
    };
    this.items = this.items.filter((q) => q.i !== i);
    this.items.push(p);
    this.mesh.setColorAt(i, _c.set(o.color ?? 0xffffff));
    this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt) {
    const alive = [];
    for (const p of this.items) {
      p.life += dt;
      if (p.life >= p.max) {
        _m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(p.i, _m);
        continue;
      }
      p.vy += p.g * dt;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vz *= dr; if (p.g > -1) p.vy *= dr;
      if (p.flutter) {
        p.vx += Math.sin(p.life * 9 + p.i) * p.flutter * dt;
        p.vz += Math.cos(p.life * 7 + p.i) * p.flutter * dt;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.floor + p.size * 0.5) {
        p.y = p.floor + p.size * 0.5;
        if (p.vy < 0) p.vy *= -p.bounce;
        p.vx *= 0.7; p.vz *= 0.7; p.sx *= 0.6; p.sy *= 0.6;
      }
      p.rx += p.sx * dt; p.ry += p.sy * dt;
      const t = p.life / p.max;
      let k;
      if (p.mode === 'puff') k = Math.sin(Math.min(1, t * 1.4) * Math.PI) * (1 + t);
      else k = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      const sc = p.size * k;
      _s.set(sc * p.sxs, sc * p.sys, sc * p.szs);
      _q.setFromEuler(_e.set(p.rx, p.ry, p.rz));
      _m.compose(_p.set(p.x, p.y, p.z), _q, _s);
      this.mesh.setMatrixAt(p.i, _m);
      alive.push(p);
    }
    this.items = alive;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class Particles {
  constructor(scene) {
    this.debris = new Pool(scene, new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.6 }), 500, true);
    this.puffs = new Pool(scene, new THREE.IcosahedronGeometry(0.5, 1),
      new THREE.MeshStandardMaterial({ roughness: 1, emissive: 0x333333, flatShading: true }), 300);
    this.confetti = new Pool(scene, new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: 0x222222, side: THREE.DoubleSide }), 400);
  }
  update(dt) { this.debris.update(dt); this.puffs.update(dt); this.confetti.update(dt); }

  dust(x, y, z, n = 3, color = 0xe8e0d0, strength = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.3 + Math.random() * 0.8) * strength;
      this.puffs.spawn({ x: x + Math.cos(a) * 0.1, y: y + 0.05, z: z + Math.sin(a) * 0.1,
        vx: Math.cos(a) * sp, vy: 0.4 + Math.random() * 0.6, vz: Math.sin(a) * sp,
        g: 0, drag: 3, size: (0.12 + Math.random() * 0.12) * strength, life: 0.45 + Math.random() * 0.4,
        mode: 'puff', color, floor: y - 1 });
    }
  }

  explode(x, y, z, colors, floor = 0, count = 70) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 5;
      this.debris.spawn({ x: x + (Math.random() - 0.5) * 0.6, y: y + Math.random() * 0.5, z: z + (Math.random() - 0.5) * 0.6,
        vx: Math.cos(a) * sp, vy: 3 + Math.random() * 6, vz: Math.sin(a) * sp,
        size: 0.06 + Math.random() * 0.16, sxs: 0.5 + Math.random(), szs: 0.5 + Math.random(),
        life: 2 + Math.random() * 1.5, color: colors[i % colors.length], floor });
    }
    this.dust(x, y, z, 14, 0xd9d2c5, 2.2);
  }

  sparks(x, y, z, color = 0xfff1a8, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 3;
      this.debris.spawn({ x, y, z, vx: Math.cos(a) * sp, vy: 2 + Math.random() * 3, vz: Math.sin(a) * sp,
        size: 0.05 + Math.random() * 0.05, life: 0.5 + Math.random() * 0.3, color, floor: y - 0.4, bounce: 0.2 });
    }
  }

  celebrate(x, y, z, n = 50) {
    const cols = [0xff4d6d, 0xffd23f, 0x3bceac, 0x5e60ce, 0xff9f1c, 0x7ae582];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      this.confetti.spawn({ x, y: y + 0.5, z, vx: Math.cos(a) * sp, vy: 4 + Math.random() * 4, vz: Math.sin(a) * sp,
        g: -6, drag: 2.2, flutter: 6, size: 0.12, sxs: 1, sys: 0.08, szs: 0.6,
        life: 1.8 + Math.random(), color: cols[i % cols.length], floor: y, bounce: 0 });
    }
  }
}
