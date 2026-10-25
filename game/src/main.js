// Einstieg: Renderer, Kamera, Licht, Spielzustände und Hauptschleife.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { buildWorld } from './world.js';
import { PostFX, Shaker, Particles } from './effects.js';
import { Game } from './game.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { STAR_THRESHOLDS, ROUND_TIME } from './config.js';

const $ = (id) => document.getElementById(id);

// --- Renderer ----------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7cc35a);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

// --- Licht -------------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xe3f3ff, 0x7a6a50, 1.1));
const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
sun.position.set(-9, 24, 12);
sun.target.position.set(0, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 19, bottom: -19, near: 1, far: 70 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// --- Kamera ------------------------------------------------------------------
// Dynamische Kamera: rahmt beide Spieler (+ getragene Möbel) ein und zoomt weich.
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
const camTarget = new THREE.Vector3(0.2, 0, 0.6);
const camBase = new THREE.Vector3();
const ELEV = THREE.MathUtils.degToRad(60);
const MAP = { x1: -18.6, x2: 18.8, z1: -11, z2: 11.2 };
const cam = { x: 0.2, z: 0.6, D: 60 };

function fovs() {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  return { vfov, hfov: 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect) };
}
function distanceFor(needW, needD) {
  const { vfov, hfov } = fovs();
  return Math.max(needW / 2 / Math.tan(hfov / 2), (needD * Math.sin(ELEV)) / 2 / Math.tan(vfov / 2));
}
const fullD = () => distanceFor(MAP.x2 - MAP.x1, MAP.z2 - MAP.z1 + 2);

function updateCamera(dt, focus) {
  let tx = (MAP.x1 + MAP.x2) / 2, tz = (MAP.z1 + MAP.z2) / 2 + 0.6, tD = fullD();
  if (focus && focus.length) {
    let x1 = Infinity, x2 = -Infinity, z1 = Infinity, z2 = -Infinity;
    for (const f of focus) { x1 = Math.min(x1, f.x); x2 = Math.max(x2, f.x); z1 = Math.min(z1, f.z); z2 = Math.max(z2, f.z); }
    tD = Math.min(fullD(), distanceFor(Math.max(19, x2 - x1 + 10), Math.max(11, z2 - z1 + 8)));
    const { vfov, hfov } = fovs();
    const vw = 2 * tD * Math.tan(hfov / 2), vd = (2 * tD * Math.tan(vfov / 2)) / Math.sin(ELEV);
    const clampAxis = (c, a, b, v) => (v >= b - a ? (a + b) / 2 : Math.max(a + v / 2, Math.min(b - v / 2, c)));
    tx = clampAxis((x1 + x2) / 2, MAP.x1, MAP.x2, vw);
    tz = clampAxis((z1 + z2) / 2 + 0.4, MAP.z1, MAP.z2, vd);
  }
  const k = dt < 0 ? 1 : 1 - Math.exp(-dt * 2.6);
  cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k; cam.D += (tD - cam.D) * k;
  camTarget.set(cam.x, 0, cam.z);
  camBase.set(cam.x, Math.sin(ELEV) * cam.D, cam.z + Math.cos(ELEV) * cam.D);
  camera.far = cam.D * 3;
  camera.updateProjectionMatrix();
}

function fitCamera() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  renderer.setSize(w, h);
  post.setSize(w, h, renderer.getPixelRatio());
  updateCamera(-1, cameraFocus());
}

// --- Systeme -----------------------------------------------------------------
const post = new PostFX(renderer);
const shaker = new Shaker();
const particles = new Particles(scene);
const fx = { post, shaker, particles };
const world = buildWorld(scene);
const hud = new HUD(camera);
const input = new Input();
const audio = new Audio();
const game = new Game({ scene, fx, audio, hud, input, world });
hud.setCount(0, game.items.length);
hud.setScore(0);
hud.setTime(ROUND_TIME);
addEventListener('resize', fitCamera);

// --- Zustände ----------------------------------------------------------------
let state = 'title';
let countdown = 0;
let lastCount = 0;
let endT = 0;

function show(id, on) { $(id).classList.toggle('hidden', !on); }

function startRound() {
  audio.unlock();
  game.reset();
  hud.setCount(0, game.items.length);
  show('title', false);
  show('results', false);
  show('pause', false);
  state = 'countdown';
  countdown = 3.2;
  lastCount = 4;
}

function endRound() {
  state = 'end';
  endT = time;
  const r = game.results();
  const stars = STAR_THRESHOLDS.filter((s) => r.ratio >= s).length;
  const titles = ['Totalschaden… 🙈', 'Na ja, Hauptsache weg 📦', 'Solide Schlepperei 💪', 'Umzugsprofis! 🏆'];
  $('r-title').textContent = r.reason === 'done' ? 'Alles erledigt!' : 'Feierabend!';
  $('r-rank').textContent = titles[stars];
  $('r-stars').innerHTML = [0, 1, 2].map((i) => `<span class="star ${i < stars ? 'on' : ''}" style="--d:${i * 0.25}s">★</span>`).join('');
  $('r-delivered').textContent = `${r.delivered} / ${r.items}`;
  $('r-broken').textContent = r.broken;
  $('r-score').textContent = `${r.score.toLocaleString('de-DE')} €`;
  $('r-bonus').textContent = `${r.bonus.toLocaleString('de-DE')} €`;
  $('r-total').textContent = `${r.total.toLocaleString('de-DE')} €`;
  show('results', true);
  audio.play(stars >= 2 ? 'win' : 'end');
  if (stars >= 2) for (let i = 0; i < 4; i++) particles.celebrate(9 + i * 1.3, 0.5, (i - 1.5) * 1.2, 40);
}

function togglePause() {
  if (state === 'play') { state = 'paused'; show('pause', true); }
  else if (state === 'paused') { state = 'play'; show('pause', false); }
}

$('start-btn').addEventListener('click', startRound);
$('again-btn').addEventListener('click', startRound);
$('mute-btn').addEventListener('click', () => { $('mute-btn').textContent = audio.toggleMute() ? '🔇' : '🔊'; });

// --- Hauptschleife -------------------------------------------------------------
const clock = new THREE.Clock();
let time = 0;
let fpsAcc = 0, fpsFrames = 0, fps = 60, slowTime = 0;
let pixelRatio = renderer.getPixelRatio();
if (new URLSearchParams(location.search).get('q') === 'low') pixelRatio = 0.75;
renderer.setPixelRatio(pixelRatio);
fitCamera();

// Spiellogik (unabhängig vom Rendern, damit Tests sie deterministisch vorspulen können)
function simulate(dt) {
  time += dt;
  input.poll();

  const confirm = input.hit(['Space', 'Enter', 'NumpadEnter']) || input.padStart || input.padPressed[0];
  if (state === 'title' && confirm) startRound();
  else if (state === 'end' && time - endT > 1.2 && (input.hit(['KeyR', 'Enter', 'NumpadEnter']) || input.padStart)) startRound();
  else if ((state === 'play' || state === 'paused') && (input.hit(['Escape', 'KeyP']) || input.padStart)) togglePause();
  if (input.hit(['KeyM'])) $('mute-btn').click();

  if (state === 'countdown') {
    countdown -= dt;
    const n = Math.ceil(countdown);
    if (n !== lastCount && n >= 1) { lastCount = n; hud.message(`<span class="big">${n}</span>`, 0.9, 'count'); audio.play('tick'); }
    if (countdown <= 0) {
      state = 'play';
      hud.message('<span class="big">LOS!</span>', 0.9, 'count go');
      audio.play('go');
      shaker.add(0.3);
    }
    game.syncVisuals(dt, time);
  } else if (state === 'play') {
    game.update(dt, time);
    hud.setTime(game.time);
    hud.setScore(game.score);
    hud.setCount(game.delivered, game.items.length);
    if (game.finished) endRound();
  } else {
    game.syncVisuals(state === 'paused' ? 0 : dt, time);
  }

  hud.update(dt);
  particles.update(state === 'paused' ? 0 : dt);
  world.update(dt, time);
  shaker.update(dt);
  updateCamera(state === 'countdown' ? dt * 0.6 : dt, cameraFocus());
  input.endFrame();
}

function cameraFocus() {
  if (state !== 'play' && state !== 'paused' && state !== 'countdown') return null;
  const f = game.players.map((p) => ({ x: p.x, z: p.z }));
  for (const p of game.players) if (p.carry) f.push({ x: p.carry.x, z: p.carry.z });
  return f;
}

function render(dt) {
  hud.updateLabels(game.items, game.players);
  shaker.apply(camera, camBase, camTarget);
  post.render(scene, camera, dt, shaker.trauma, time);
}

// Adaptive Auflösung: bei dauerhaft niedriger Bildrate Pixeldichte senken
function adaptQuality(realDt) {
  fpsAcc += realDt; fpsFrames++;
  if (fpsAcc < 1) return;
  fps = fpsFrames / fpsAcc;
  fpsAcc = 0; fpsFrames = 0;
  slowTime = fps < 45 ? slowTime + 1 : 0;
  if (slowTime >= 2 && pixelRatio > 0.75) {
    pixelRatio = Math.max(0.75, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio);
    fitCamera();
    slowTime = 0;
  }
}

function frame() {
  requestAnimationFrame(frame);
  const realDt = clock.getDelta();
  const dt = Math.min(realDt, 1 / 30);
  try {
    simulate(dt);
    render(dt);
  } catch (e) { console.error(e); }
  adaptQuality(realDt);
}
frame();

// --- Debug-Schnittstelle für Tests (tools/smoke-test.mjs) ---------------------
window.__game = {
  get state() { return state; },
  get fps() { return fps; },
  get pixelRatio() { return pixelRatio; },
  game,
  renderer,
  start: startRound,
  scene,
  renderNow() { render(0); return renderer.domElement.toDataURL('image/png'); },
  debugSetTime(s) { game.time = s; },
  setPixelRatio(pr) { pixelRatio = pr; renderer.setPixelRatio(pr); fitCamera(); },
  // Simulation um `seconds` vorspulen (feste 60-Hz-Schritte, ohne Rendern)
  advance(seconds) {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) simulate(1 / 60);
  },
  snapshot() {
    return {
      state, time: game.time, score: Math.round(game.score), delivered: game.delivered,
      players: game.players.map((p) => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), carry: p.carry?.type || null })),
      items: game.items.map((it) => ({ type: it.type, state: it.state, hp: Math.round(it.hp), x: +it.x.toFixed(2), z: +it.z.toFixed(2), carriers: it.carriers.length })),
    };
  },
};
