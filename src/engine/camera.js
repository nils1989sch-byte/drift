import { LEVEL } from './constants.js';
// Camera with smooth follow, stepped pixel-perfect zoom (integer scales), and screen shake.
export function createCamera() {
  const cam = {
    x: 0, y: 0,            // world-pixel center
    scale: 3,              // current (animated) screen px per world px
    target: 3,             // target zoom scale
    minScale: 1, maxScale: 6,
    viewW: 0, viewH: 0,    // screen size in device px
    shakeT: 0, shakeAmp: 0, ox: 0, oy: 0,
    follow: null,
    resize(w, h) {
      cam.viewW = w; cam.viewH = h;
      // Default: about 15 tiles visible vertically (SNES = 224px).
      const base = Math.max(1, Math.round(Math.min(w, h * 1.25) / 270));
      cam.base = base;
      cam.minScale = Math.max(1, Math.floor(base / 2));
      cam.maxScale = Math.max(base + 3, 4);
      if (!cam._init) { cam.scale = cam.target = base; cam._init = true; }
      cam.target = Math.min(cam.maxScale, Math.max(cam.minScale, cam.target));
    },
    zoom(dir) {
      // finer steps at low scale: halves below 2
      const steps = [];
      for (let s = cam.minScale; s <= cam.maxScale + 1e-6; s += 1) steps.push(s);
      if (cam.minScale <= 1) steps.unshift(0.5);
      let i = steps.findIndex((s) => Math.abs(s - cam.target) < 1e-3);
      if (i < 0) i = steps.findIndex((s) => s > cam.target) - 1;
      i = Math.max(0, Math.min(steps.length - 1, i + dir));
      cam.target = steps[i];
    },
    zoomTo(s) { cam.target = Math.min(cam.maxScale, Math.max(cam.minScale <= 1 ? 0.5 : cam.minScale, s)); },
    shake(amp = 2, t = 0.2) { cam.shakeAmp = Math.max(cam.shakeAmp, amp); cam.shakeT = Math.max(cam.shakeT, t); },
    update(dt, world) {
      // zoom tween (exponential), snap when close so pixels are crisp at rest
      const d = cam.target - cam.scale;
      cam.scale += d * Math.min(1, dt * 12);
      if (Math.abs(d) < 0.01) cam.scale = cam.target;
      // battleFocus (set by gameplay during fights) overrides the follow target
      const f = cam.battleFocus || cam.follow;
      if (f) {
        const tx = f.x, ty = f.y - (f.z || 0) * LEVEL - 8;
        const k = Math.min(1, dt * 10);
        cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
      }
      if (world) {
        // clamp so the diorama stays in view; if the map is smaller than the view, center it
        const vw = cam.viewW / cam.scale, vh = cam.viewH / cam.scale;
        const pad = 48; // allow seeing the diorama plinth & edges
        const minX = vw / 2 - pad, maxX = world.pxW - vw / 2 + pad;
        const minY = vh / 2 - pad - 32, maxY = world.pxH - vh / 2 + pad + 32;
        cam.x = minX > maxX ? world.pxW / 2 : Math.min(maxX, Math.max(minX, cam.x));
        cam.y = minY > maxY ? world.pxH / 2 : Math.min(maxY, Math.max(minY, cam.y));
      }
      if (cam.shakeT > 0) {
        cam.shakeT -= dt;
        cam.ox = (Math.random() * 2 - 1) * cam.shakeAmp;
        cam.oy = (Math.random() * 2 - 1) * cam.shakeAmp;
        if (cam.shakeT <= 0) { cam.ox = cam.oy = 0; cam.shakeAmp = 0; }
      }
    },
    snap() { if (cam.follow) { cam.x = cam.follow.x; cam.y = cam.follow.y; } },
    // screen (css px * dpr) -> world
    toWorld(sx, sy) {
      return { x: (sx - cam.viewW / 2) / cam.scale + cam.x, y: (sy - cam.viewH / 2) / cam.scale + cam.y };
    },
  };
  return cam;
}
