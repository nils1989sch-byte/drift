const { test, expect, touch } = require('../support/fixtures');

/** Guide canvas: data-testid="trace-guide" if present, else the first canvas inside the board. */
async function guideCanvas(app) {
  const g = app.$('trace-guide');
  if (await g.count()) return g.first();
  return app.$('trace-board').locator('canvas').first();
}

/** Number of painted pixels on the guide canvas (0 = nothing drawn yet). */
async function guideInk(app) {
  const c = await guideCanvas(app);
  return c.evaluate((cv) => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++; return n;
  });
}

/** Painted pixels on the drawing canvas (data-testid="trace-ink"). */
async function inkPixels(app) {
  return app.$('trace-ink').first().evaluate((cv) => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return n;
  });
}

async function guideHash(app) {
  const c = await guideCanvas(app);
  return c.evaluate((cv) => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let h = 0; for (let i = 3; i < d.length; i += 64) h = (h * 31 + d[i]) | 0; return h;
  });
}

/**
 * Horizontal runs (viewport CSS px) where the guide letter is painted, every `rowStep` px.
 * Falls back to a dense zig-zag over the middle of the board if the guide cannot be sampled.
 */
async function letterRuns(app, rowStep = 14) {
  const c = await guideCanvas(app);
  const runs = await c.evaluate((cv, step) => {
    const r = cv.getBoundingClientRect();
    let d; try { d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; } catch (e) { return null; }
    const sx = cv.width / r.width, sy = cv.height / r.height, out = [];
    for (let y = step / 2; y < r.height; y += step) {
      const py = Math.floor(y * sy); let start = -1;
      for (let x = 0; x <= r.width; x += 2) {
        const px = Math.floor(x * sx);
        const on = x < r.width && d[(py * cv.width + px) * 4 + 3] > 40;
        if (on && start < 0) start = x;
        if (!on && start >= 0) { if (x - start > 4) out.push({ y: r.top + y, x1: r.left + start, x2: r.left + x }); start = -1; }
      }
    }
    return out;
  }, rowStep);
  return runs && runs.length ? runs : null;
}

async function traceLetter(app) {
  const runs = await letterRuns(app);
  if (runs) {
    for (const r of runs) await touch.touchStroke(app.page, [{ x: r.x1 + 2, y: r.y }, { x: r.x2 - 2, y: r.y }], { stepPx: 30, settleMs: 0 });
    await app.page.waitForTimeout(400);
    return 'guide-sampled';
  }
  const b = await app.$('trace-board').boundingBox();
  const pts = [];
  for (let y = b.y + 10, i = 0; y < b.y + b.height - 10; y += 14, i++) {
    pts.push({ x: i % 2 ? b.x + b.width - 10 : b.x + 10, y });
  }
  await touch.touchStroke(app.page, pts, { stepPx: 30 });
  return 'zigzag';
}

async function openTrace(app) {
  await app.goto();
  await app.go('trace');
  await expect(app.$('trace-board')).toBeVisible();
  await expect.poll(() => guideInk(app), { message: 'guide letter is drawn' }).toBeGreaterThan(50);
}

test.describe('Nachmalen (tracing)', () => {
  test('board shows a guide letter', async ({ app }) => {
    await openTrace(app);
    const b = await app.$('trace-board').boundingBox();
    expect(b.width).toBeGreaterThan(300);
    expect(b.height).toBeGreaterThan(300);
  });

  test('a tiny scribble does not earn a star', async ({ app }) => {
    await openTrace(app);
    const stars = await app.sel.starCount();
    const b = await app.$('trace-board').boundingBox();
    await touch.touchStroke(app.page, [{ x: b.x + b.width / 2 - 20, y: b.y + b.height / 2 }, { x: b.x + b.width / 2 + 20, y: b.y + b.height / 2 }]);
    await app.page.waitForTimeout(300);
    expect(await app.sel.starCount()).toBe(stars);
  });

  test('tracing over the whole letter with a finger earns a star', async ({ app }) => {
    // two complete traces of ~35 finger strokes each via CDP: ~25–30 s each with 4 workers
    test.setTimeout(150_000);
    await openTrace(app);
    const stars = await app.sel.starCount();
    await app.clearSpoken();
    const how = await traceLetter(app);
    app.note('note', `trace strategy: ${how}`);
    await expect.poll(() => app.sel.starCount(), { timeout: 4000 }).toBe(stars + 1);
    await expect.poll(async () => (await app.spoken()).join(' ')).toMatch(/toll|super|prima|klasse/i);
    // tracing again on the finished letter must not farm more stars
    await traceLetter(app);
    await app.page.waitForTimeout(300);
    expect(await app.sel.starCount()).toBe(stars + 1);
  });

  test('clear wipes the drawing; next / prev change the letter', async ({ app }) => {
    await openTrace(app);
    const h0 = await guideHash(app);
    const b = await app.$('trace-board').boundingBox();
    await touch.touchStroke(app.page, [{ x: b.x + 40, y: b.y + 40 }, { x: b.x + b.width - 40, y: b.y + b.height - 40 }]);
    await app.tap('trace-clear');
    // all drawn ink is gone: every canvas except the guide is blank
    await expect.poll(() => inkPixels(app)).toBe(0);
    await app.tap('trace-next');
    await expect.poll(() => guideHash(app)).not.toBe(h0);
    await app.tap('trace-prev');
    await expect.poll(() => guideHash(app)).toBe(h0);
  });

  test('stroke drawn with a finger leaves ink on the board', async ({ app }) => {
    await openTrace(app);
    const b = await app.$('trace-board').boundingBox();
    await touch.touchStroke(app.page, [{ x: b.x + 60, y: b.y + 60 }, { x: b.x + b.width - 60, y: b.y + 60 }]);
    expect(await inkPixels(app)).toBeGreaterThan(0);
  });
});
