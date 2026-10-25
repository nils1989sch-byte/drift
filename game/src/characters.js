// Die Figuren: Vinyl-Körper, Röhrenfernseher-Kopf mit Shader-Gesicht, Aufziehschlüssel.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';

export const MOOD = { happy: 0, strain: 1, shock: 2, joy: 3 };

const FACE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FACE_FRAG = /* glsl */ `
uniform float uTime;
uniform float uMood;
uniform float uBlink;
uniform float uGlitch;
uniform vec3 uColor;
uniform vec2 uLook;
varying vec2 vUv;

float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float sdEllipse(vec2 p, vec2 r) { return (length(p / r) - 1.0) * min(r.x, r.y); }
float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  // Glitch: horizontale Zeilenversätze bei Schreck
  float row = floor(uv.y * 18.0);
  uv.x += (hash(row + floor(uTime * 20.0)) - 0.5) * 0.12 * uGlitch;

  vec2 p = (uv - 0.5) * vec2(1.3, 1.0);
  vec2 q = p - uLook * vec2(0.06, 0.04);
  float d = 1e3;
  vec2 eL = vec2(-0.19, 0.06), eR = vec2(0.19, 0.06);

  if (uMood < 0.5) {               // happy
    float bl = mix(1.0, 0.08, uBlink);
    d = min(sdEllipse(q - eL, vec2(0.065, 0.11 * bl)), sdEllipse(q - eR, vec2(0.065, 0.11 * bl)));
    vec2 m = q - vec2(0.0, -0.06);
    float arc = abs(length(m) - 0.11) - 0.016;
    arc = max(arc, m.y + 0.07);
    d = min(d, arc);
  } else if (uMood < 1.5) {        // strain  > <
    float w = 0.022;
    d = min(sdSeg(q, eL + vec2(-0.07, 0.07), eL + vec2(0.05, 0.0)), sdSeg(q, eL + vec2(-0.07, -0.07), eL + vec2(0.05, 0.0))) - w;
    d = min(d, min(sdSeg(q, eR + vec2(0.07, 0.07), eR + vec2(-0.05, 0.0)), sdSeg(q, eR + vec2(0.07, -0.07), eR + vec2(-0.05, 0.0))) - w);
    float wave = abs(q.y + 0.2 + 0.025 * sin(q.x * 55.0 + uTime * 25.0)) - 0.016;
    wave = max(wave, abs(q.x) - 0.13);
    d = min(d, wave);
  } else if (uMood < 2.5) {        // shock  O O  o
    d = min(abs(length(q - eL) - 0.085) - 0.02, abs(length(q - eR) - 0.085) - 0.02);
    d = min(d, min(length(q - eL) - 0.025, length(q - eR) - 0.025));
    d = min(d, abs(length(q - vec2(0.0, -0.2)) - 0.055) - 0.018);
  } else {                         // joy  ^ ^  D
    float w = 0.022;
    d = min(sdSeg(q, eL + vec2(-0.07, -0.03), eL + vec2(0.0, 0.05)), sdSeg(q, eL + vec2(0.07, -0.03), eL + vec2(0.0, 0.05))) - w;
    d = min(d, min(sdSeg(q, eR + vec2(-0.07, -0.03), eR + vec2(0.0, 0.05)), sdSeg(q, eR + vec2(0.07, -0.03), eR + vec2(0.0, 0.05))) - w);
    vec2 m = q - vec2(0.0, -0.1);
    d = min(d, max(length(m) - 0.12, m.y));
  }

  float shape = 1.0 - smoothstep(0.0, 0.012, d);
  float glow = exp(-max(d, 0.0) * 40.0) * 0.35;

  vec3 bg = mix(vec3(0.01, 0.015, 0.03), uColor * 0.12, uv.y);
  vec3 ink = mix(vec3(1.0), uColor, 0.35) * 2.2;
  vec3 col = bg + ink * (shape + glow);

  // Röhren-Look: Scanlines, Flackern, abgerundete Bildränder
  col *= 0.82 + 0.18 * sin(uv.y * 140.0 - uTime * 8.0);
  col *= 0.95 + 0.05 * sin(uTime * 60.0);
  vec2 e = abs(vUv - 0.5) * 2.0;
  float corner = smoothstep(1.0, 0.82, pow(pow(e.x, 6.0) + pow(e.y, 6.0), 1.0 / 6.0));
  col *= corner;
  gl_FragColor = vec4(col, 1.0);
}`;

const vinyl = (color) => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.25,
});

export function createCharacter(def, index) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // wird für Squash & Stretch skaliert
  const visual = new THREE.Group(); // Figur etwas größer als ihr Kollisionskreis – liest sich besser von oben
  visual.scale.setScalar(1.25);
  visual.add(body);
  root.add(visual);

  const main = vinyl(def.color);
  const dark = vinyl(0x2b2b33);
  const light = vinyl(new THREE.Color(def.color).lerp(new THREE.Color(0xffffff), 0.55));

  // Beine
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.1, 4, 8);
  const legs = [-0.11, 0.11].map((x) => {
    const leg = new THREE.Mesh(legGeo, dark);
    leg.position.set(x, 0.12, 0);
    leg.castShadow = true;
    body.add(leg);
    return leg;
  });

  // Rumpf
  const torso = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.34, 0.36, 4, 0.12), light);
  torso.position.y = 0.36;
  torso.castShadow = true;
  body.add(torso);
  // Gürtel-Streifen in Spielerfarbe
  const belt = new THREE.Mesh(new RoundedBoxGeometry(0.47, 0.07, 0.37, 2, 0.03), main);
  belt.position.y = 0.27;
  body.add(belt);

  // Arme (Pivot an der Schulter)
  const armGeo = new THREE.CapsuleGeometry(0.06, 0.16, 4, 8);
  armGeo.translate(0, -0.1, 0);
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.27, 0.46, 0);
    const arm = new THREE.Mesh(armGeo, main);
    arm.castShadow = true;
    pivot.add(arm);
    body.add(pivot);
    return pivot;
  });

  // Fernseher-Kopf
  const head = new THREE.Group();
  head.position.y = 0.82;
  body.add(head);
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.56, 0.58, 5, 0.14), main);
  shell.castShadow = true;
  head.add(shell);
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.44, 0.08, 4, 0.06), dark);
  bezel.position.z = 0.27;
  head.add(bezel);

  const faceUniforms = {
    uTime: { value: 0 }, uMood: { value: 0 }, uBlink: { value: 0 }, uGlitch: { value: 0 },
    uColor: { value: new THREE.Color(def.screen) }, uLook: { value: new THREE.Vector2() },
  };
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.36),
    new THREE.ShaderMaterial({ vertexShader: FACE_VERT, fragmentShader: FACE_FRAG, uniforms: faceUniforms }),
  );
  screen.position.z = 0.315;
  head.add(screen);

  // Aufziehschlüssel
  const key = new THREE.Group();
  key.position.y = 0.3;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10), dark);
  stem.position.y = 0.05;
  key.add(stem);
  const loopGeo = new THREE.TorusGeometry(0.075, 0.035, 8, 18);
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(loopGeo, dark);
    loop.position.set(s * 0.085, 0.15, 0);
    loop.castShadow = true;
    key.add(loop);
  }
  head.add(key);

  // Spielerring am Boden + Pfeil-Marker
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.46, 40),
    new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  root.add(ring);

  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.18, 4),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(1.6) }),
  );
  marker.rotation.x = Math.PI;
  marker.position.y = 1.55;
  visual.add(marker);

  root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

  return {
    root, body, head, legs, arms, key, ring, marker, faceUniforms,
    phase: index * 1.7, blinkT: 2 + Math.random() * 2, keySpin: 0, squash: 0,
    update(dt, t, state) {
      const { speed, carrying, mood, lookX, lookZ, stun } = state;
      faceUniforms.uTime.value = t;
      faceUniforms.uMood.value = mood;
      faceUniforms.uLook.value.set(lookX, lookZ);
      faceUniforms.uGlitch.value = Math.max(0, faceUniforms.uGlitch.value - dt * 2);
      if (mood === MOOD.shock) faceUniforms.uGlitch.value = Math.max(faceUniforms.uGlitch.value, 0.6);

      // Blinzeln
      this.blinkT -= dt;
      if (this.blinkT < 0) { this.blinkT = 2.5 + Math.random() * 3; }
      faceUniforms.uBlink.value = this.blinkT < 0.12 ? 1 : 0;

      // Laufanimation
      const walk = Math.min(1, speed / 4);
      this.phase += dt * (6 + speed * 2.6);
      const sw = Math.sin(this.phase);
      legs[0].position.z = sw * 0.09 * walk;
      legs[1].position.z = -sw * 0.09 * walk;
      legs[0].position.y = 0.12 + Math.max(0, sw) * 0.05 * walk;
      legs[1].position.y = 0.12 + Math.max(0, -sw) * 0.05 * walk;
      const bob = Math.abs(Math.sin(this.phase)) * 0.05 * walk;
      body.position.y = bob;
      body.rotation.z = Math.sin(this.phase) * 0.06 * walk + (stun > 0 ? Math.sin(t * 40) * 0.2 : 0);

      // Arme: tragen = nach vorne gestreckt
      const lift = carrying ? -1.35 : 0;
      arms.forEach((a, i) => {
        const swing = carrying ? Math.sin(t * 9 + i) * 0.04 : (i ? sw : -sw) * 0.55 * walk;
        a.rotation.x += (lift + swing - a.rotation.x) * Math.min(1, dt * 14);
        a.rotation.z = (i ? -1 : 1) * (carrying ? 0.12 : 0.18);
      });

      // Squash & Stretch (Landung, Greifen, Treffer)
      this.squash *= Math.exp(-dt * 9);
      const sq = Math.sin(t * 30) * this.squash;
      body.scale.set(1 + sq * 0.15, 1 - sq * 0.2, 1 + sq * 0.15);

      // Kopf leicht neigen bei Anstrengung
      head.rotation.x = mood === MOOD.strain ? 0.12 + Math.sin(t * 30) * 0.03 : 0;

      // Schlüssel dreht sich beim Laufen
      this.keySpin += dt * (1 + speed * 3);
      key.rotation.y = this.keySpin;

      marker.position.y = 1.55 + Math.sin(t * 4 + this.phase * 0.1) * 0.06;
      marker.rotation.y = t * 2;
      ring.scale.setScalar(1 + Math.sin(t * 5) * 0.04);
    },
    pop(v = 1) { this.squash = Math.max(this.squash, v); },
  };
}
