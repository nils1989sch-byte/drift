// Performance smoke. TTI is gating (< 2 s locally), FPS is reported only.
const { test, expect } = require('../support/fixtures');

test.describe('Performance smoke', () => {
  test('time to interactive < 2 s', async ({ app, page }) => {
    const t0 = Date.now();
    await app.goto();
    await app.go('abc'); // first real interaction works
    const tti = Date.now() - t0;
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      return n ? { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), size: n.transferSize } : null;
    });
    app.note('metric', `TTI ${tti}ms (goto -> first tab switch); DOMContentLoaded ${nav && nav.dcl}ms; load ${nav && nav.load}ms`);
    expect(tti).toBeLessThan(2000);
  });

  test('FPS during the Finden celebration (report only)', async ({ app, page }) => {
    await app.goto();
    await app.go('find');
    for (let i = 0; i < 4; i++) await app.answerCorrect();
    const startCounter = () => page.evaluate(() => {
      window.__frames = []; window.__fpsOn = true;
      const tick = (t) => { if (!window.__fpsOn) return; window.__frames.push(t); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const stopCounter = () => page.evaluate(() => {
      window.__fpsOn = false; const f = window.__frames;
      if (f.length < 2) return { fps: 0, worst: 0 };
      let worst = 0; for (let i = 1; i < f.length; i++) worst = Math.max(worst, f[i] - f[i - 1]);
      return { fps: Math.round(((f.length - 1) * 1000) / (f[f.length - 1] - f[0])), worst: Math.round(worst) };
    });
    await startCounter();
    const target = await app.sel.findTarget();
    await app.$('find-choice', target).tap();
    await page.waitForTimeout(1200);
    const burst = await stopCounter();
    await expect(app.$('celebration')).toBeVisible({ timeout: 5000 });
    await startCounter();
    await page.waitForTimeout(1000);
    const party = await stopCounter();
    app.note('metric', `FPS confetti burst ${burst.fps} (worst frame ${burst.worst}ms); celebration overlay ${party.fps} (worst ${party.worst}ms) [headless Chromium, not iPad]`);
  });

  test('tracing: long tasks while drawing (report only)', async ({ app, page }) => {
    await app.goto();
    await app.go('trace');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      window.__lt = [];
      try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch (e) { /* unsupported */ }
    });
    const b = await app.$('trace-board').boundingBox();
    const { touchStroke } = require('../support/touch');
    const t0 = Date.now();
    for (let i = 0; i < 3; i++) await touchStroke(page, [{ x: b.x + 50, y: b.y + 50 + i * 40 }, { x: b.x + b.width - 50, y: b.y + b.height - 50 - i * 40 }]);
    await page.waitForTimeout(200);
    const lt = await page.evaluate(() => window.__lt);
    app.note('metric', `3 strokes in ${Date.now() - t0}ms; long tasks (>50ms): ${lt.length ? lt.join(',') + 'ms' : 'none'}`);
  });
});
