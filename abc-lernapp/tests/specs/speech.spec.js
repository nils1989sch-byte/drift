const { test, expect } = require('../support/fixtures');

test.describe('Speech (speechSynthesis stub)', () => {
  test('nothing is spoken before the first touch (iOS would drop it)', async ({ app }) => {
    await app.goto();
    await app.page.waitForTimeout(500);
    expect(await app.spoken()).toEqual([]);
  });

  test('opening letter A says "A wie Affe" in German', async ({ app, page }) => {
    await app.goto();
    await app.go('abc');
    await app.clearSpoken();
    await app.tap('letter-tile', 'A');
    await expect.poll(async () => (await app.spoken()).join(' ')).toContain('A wie');
    const langs = await page.evaluate(() => window.__spoken.filter((s) => s.kind === 'tts').map((s) => s.lang));
    for (const l of langs) expect(l).toMatch(/^de/);
    await app.clearSpoken();
    await app.tap('detail-say');
    await expect.poll(async () => (await app.spoken()).join(' ')).toContain('A wie');
  });

  test('Finden asks "Wo ist das …?" for the target letter', async ({ app }) => {
    await app.goto();
    await app.clearSpoken();
    await app.go('find');
    const t = await app.sel.findTarget();
    await expect.poll(async () => (await app.spoken()).join(' ')).toContain(`Wo ist das ${t}`);
    await app.clearSpoken();
    await app.tap('find-prompt');
    await expect.poll(async () => (await app.spoken()).join(' ')).toContain(t);
  });

  test('tapping Bruno makes him talk', async ({ app }) => {
    await app.goto();
    await app.tapMoving('home-bruno');
    await expect.poll(async () => (await app.spoken()).length).toBeGreaterThan(0);
  });

  test('tracing screen names the letter, speaker button repeats it', async ({ app }) => {
    await app.goto();
    await app.go('trace');
    await expect.poll(async () => (await app.spoken()).join(' ')).toMatch(/[A-Z]/);
    await app.clearSpoken();
    await app.tap('trace-say');
    await expect.poll(async () => (await app.spoken()).join(' ')).toMatch(/wie/);
  });
});
