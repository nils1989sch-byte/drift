// Screenshots of every screen + overlay per viewport -> tests/screens/<project>/
// For human / agent review only (no pixel diffing).
const { test, expect, touch } = require('../support/fixtures');

test.describe('Visual review screenshots', () => {
  test('capture all screens and overlays', async ({ app, page }) => {
    test.setTimeout(180_000); // ~85 s with recorded voice clips and 4 workers
    await app.goto();
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await app.shot('01-home');

    await app.go('abc');
    await app.shot('02-abc-grid');
    await app.tap('letter-tile', 'A');
    await expect(app.$('detail-overlay')).toBeVisible();
    await app.shot('03-detail-A');
    await app.tap('detail-close');

    await app.go('find');
    await app.shot('04-find');
    const target = await app.sel.findTarget();
    for (const c of await app.$('find-choice').all()) {
      if ((await app.sel.letterOf(c)) !== target) { await c.tap(); break; }
    }
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${__dirname}/../screens/${test.info().project.name}/05-find-wrong.png` });
    for (let i = 0; i < 5; i++) await app.answerCorrect();
    await expect(app.$('celebration')).toBeVisible();
    await app.shot('06-celebration');
    await app.tap('celebration-home');

    await app.go('trace');
    await page.waitForTimeout(300);
    await app.shot('07-trace');
    // half-drawn stroke for a realistic look
    const b = await app.$('trace-board').boundingBox();
    await touch.touchStroke(page, [{ x: b.x + b.width * 0.3, y: b.y + b.height * 0.8 }, { x: b.x + b.width * 0.5, y: b.y + b.height * 0.15 }, { x: b.x + b.width * 0.7, y: b.y + b.height * 0.8 }]);
    await app.shot('08-trace-drawing');

    await app.go('home');
    const c = await touch.center(app.$('parent-gate').first());
    await touch.touchDown(page, c.x, c.y);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${__dirname}/../screens/${test.info().project.name}/09-parent-gate-holding.png` });
    await page.waitForTimeout(1500);
    await touch.touchUp(page);
    await expect(app.$('parents-panel')).toBeVisible();
    await app.shot('10-parents');
    await page.screenshot({ path: `${__dirname}/../screens/${test.info().project.name}/11-parents-full.png`, fullPage: true });
  });
});
