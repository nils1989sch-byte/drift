const { test, expect, TABS } = require('../support/fixtures');

test.describe('Navigation', () => {
  test('starts on the home screen with greeting, letter of the day and Bruno', async ({ app }) => {
    await app.goto();
    await expect(app.$('screen-home')).toBeVisible();
    await expect(app.$('home-greeting')).toContainText(/\S/);
    await expect(app.$('home-today')).toBeVisible();
    await expect(app.$('home-bruno')).toBeVisible();
    for (const t of ['abc', 'find', 'trace']) await expect(app.$(`screen-${t}`)).toBeHidden();
  });

  test('tab bar switches between all four screens', async ({ app }) => {
    await app.goto();
    for (const tab of ['abc', 'find', 'trace', 'home', 'trace', 'abc', 'home']) {
      await app.go(tab);
      for (const other of TABS.filter((t) => t !== tab)) await expect(app.$(`screen-${other}`)).toBeHidden();
    }
  });

  test('the whole tab bar is inside the viewport on every screen', async ({ app, page }) => {
    await app.goto();
    const vp = page.viewportSize();
    for (const tab of TABS) {
      await app.go(tab);
      for (const t of TABS) {
        const b = await app.$(`tab-${t}`).boundingBox();
        expect(b, `tab-${t} visible`).not.toBeNull();
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5);
        expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 0.5);
      }
    }
  });

  test('home activity cards open ABC, Finden and Nachmalen', async ({ app }) => {
    await app.goto();
    for (const t of ['abc', 'find', 'trace']) {
      await app.tap(`home-go-${t}`);
      await expect(app.$(`screen-${t}`)).toBeVisible();
      await app.go('home');
    }
  });

  test('letter-of-the-day card opens the detail for that letter', async ({ app }) => {
    await app.goto();
    const L = await app.sel.todayLetter();
    await app.tap('home-today');
    await expect(app.$('detail-overlay')).toBeVisible();
    expect(await app.sel.detailLetter()).toBe(L);
  });
});
