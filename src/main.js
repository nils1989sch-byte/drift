// Bootstrap & main loop (Regie). Wires art, animation, audio, gameplay and UI together.
import { createInput } from './engine/input.js';
import { createCamera } from './engine/camera.js';
import { createRenderer } from './engine/renderer.js';
import { createRenderer3D, webglAvailable } from './engine/renderer3d.js';
import { buildAssets } from './art/index.js';
import { createFX } from './anim/index.js';
import { createSFX } from './audio/index.js';
import { createGame } from './game/index.js';
import { createUI } from './ui/index.js';
import { setSaveSlot } from './game/save.js';
import { loadContentSource, installContent } from './content/runtime.js';
import { installPacks } from './assetpack/install.js';

const STEP = 1 / 60;

function boot() {
  const root = document.getElementById('app');
  const canvas = document.getElementById('game');
  const input = createInput(window);
  const camera = createCamera();
  const assets = buildAssets();
  const params = new URLSearchParams(location.search);
  const use3D = params.get('r') !== '2d' && webglAvailable();
  const renderer = use3D ? createRenderer3D(canvas, assets) : createRenderer(canvas, assets);
  const fx = createFX(assets);
  const sfx = createSFX();
  const ui = createUI({ root, input, assets, sfx, camera });
  const game = createGame({ assets, input, camera, fx, sfx, ui });
  ui.bind(game);

  // resize: canvas in device pixels
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.floor(window.innerWidth * dpr), h = Math.floor(window.innerHeight * dpr);
    canvas.width = w; canvas.height = h;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    camera.resize(w, h);
    ui.resize?.(w, h, dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // zoom: wheel + pinch
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); camera.zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  const pts = new Map();
  let pinch0 = 0, scale0 = 0;
  canvas.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, e);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); scale0 = camera.target; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e);
    if (pts.size === 2 && pinch0 > 0) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      camera.target = Math.min(camera.maxScale, Math.max(0.5, scale0 * (d / pinch0)));
      camera.scale = camera.target;
    }
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2 && pinch0) { pinch0 = 0; camera.zoomTo(Math.max(0.5, Math.round(camera.target))); }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  // unlock audio on first interaction
  const unlock = () => sfx.unlock?.();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  let acc = 0, last = performance.now();
  let errShown = false;
  // adaptive quality: if the frame rate stays low, the 3D renderer steps down its effects
  let slowT = 0, fastT = 0;
  const debug = new URLSearchParams(location.search).has('debug');
  renderer.debug = debug;
  if (new URLSearchParams(location.search).get('tilt') === '0') renderer.tiltShift = false;
  if (params.get('look') && renderer.setLook) renderer.setLook(params.get('look'));

  function frame(now) {
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      input.poll();
      if (input.pressed('zoomIn')) camera.zoom(1);
      if (input.pressed('zoomOut')) camera.zoom(-1);
      if (!ui.blocking) {
        try { game.update(STEP); fx.update(STEP); }
        catch (e) { if (!errShown) { console.error(e); errShown = true; } }
      }
      ui.update(STEP);
      camera.update(STEP, game.world);
      acc -= STEP; steps++;
    }
    if (steps === 6) acc = 0;
    const drawables = game.world ? [...game.entities, ...fx.drawables()] : [];
    renderer.setTime?.(game.world?.outdoor === false ? null : game.clock?.hours ?? null);
    renderer.render(game.world, drawables, camera, dt, game.drawOverlay);
    if (renderer.degrade && game.world) {
      if (dt > 1 / 40) { slowT += dt; fastT = 0; } else { fastT += dt; slowT = Math.max(0, slowT - dt * 0.5); }
      if (slowT > 2) { renderer.degrade(); slowT = 0; }
    }
    ui.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // debug/QA hook
  window.__drift = { game, camera, renderer, input, ui, fx, sfx, assets };

  // eigene Inhalte (Editor): ?content=local | ?content=<url> [&map=<id>&x=<tx>&y=<ty>] – Probe spielen startet direkt
  const src = params.get('content');
  if (src) startContent(game, ui, src, params);
}

async function startContent(game, ui, src, params) {
  const direct = params.has('map') || params.has('play');
  try {
    const raw = await loadContentSource(src);
    await game.farmReady?.catch(() => {});
    if (raw?.project?.assets?.packs?.length) {
      const packs = await installPacks(raw.project, game.assets).catch((e) => { console.warn('[content] Pakete', e); return null; });
      if (packs?.missing.length) ui.toast?.(`Grafik-Paket fehlt in diesem Browser: ${packs.missing.join(', ')}`, { time: 6 });
    }
    setSaveSlot(direct ? null : `content:${raw?.project?.id || raw?.project?.name || src}`);
    const n = (k) => (params.has(k) ? Number(params.get(k)) : undefined);
    const res = installContent(game, raw, { map: params.get('map') || undefined, x: n('x'), y: n('y') });
    window.__drift.content = res;
    if (!res.ok) {
      console.error('[content]', res.errors);
      ui.toast?.(`Projekt fehlerhaft: ${res.errors[0]?.path}: ${res.errors[0]?.message}`, { time: 8 });
      return;
    }
    if (res.warnings.length) console.info('[content] Hinweise', res.warnings.map(String));
    if (direct) game.newGame();
  } catch (e) {
    console.error('[content]', e);
    ui.toast?.(`Eigene Inhalte nicht ladbar: ${e.message}`, { time: 8 });
  }
}

boot();
