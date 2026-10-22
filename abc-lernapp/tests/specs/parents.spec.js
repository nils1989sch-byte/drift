const { test, expect, touch } = require('../support/fixtures');

test.describe('Parent gate & settings', () => {
  test('a short tap on the gate does NOT open the parents area', async ({ app }) => {
    await app.goto();
    await app.$('parent-gate').first().tap();
    await app.page.waitForTimeout(2500);
    await expect(app.$('parents-panel')).toBeHidden();
  });

  test('holding only 1 second does NOT open it', async ({ app }) => {
    await app.goto();
    await app.hold('parent-gate', 1000);
    await app.page.waitForTimeout(1800);
    await expect(app.$('parents-panel')).toBeHidden();
  });

  test('holding 2 seconds opens it; close button closes it', async ({ app }) => {
    await app.goto();
    await app.openParents(2600);
    await app.tap('parents-close');
    await expect(app.$('parents-panel')).toBeHidden();
  });

  test('changing the name updates the greeting and persists after reload', async ({ app }) => {
    await app.goto();
    await app.openParents();
    await app.$('setting-name').fill('Lotta');
    await app.tap('parents-close');
    await expect(app.$('home-greeting')).toContainText('Lotta');
    await app.reload();
    await expect(app.$('home-greeting')).toContainText('Lotta');
    await app.openParents();
    await expect(app.$('setting-name')).toHaveValue('Lotta');
  });

  test('case + sound settings persist after reload', async ({ app }) => {
    await app.goto();
    await app.openParents();
    await app.tap('setting-case', 'lower');
    await app.tap('setting-sound', 'off');
    await app.reload();
    await app.openParents();
    expect(await app.sel.isSelected(app.$('setting-case', 'lower'))).toBe(true);
    expect(await app.sel.isSelected(app.$('setting-sound', 'off'))).toBe(true);
  });

  test('sound off: opening a letter says nothing', async ({ app }) => {
    await app.goto();
    await app.openParents();
    await app.tap('setting-sound', 'off');
    await app.tap('parents-close');
    await app.go('abc');
    await app.clearSpoken();
    await app.tap('letter-tile', 'A');
    await expect(app.$('detail-overlay')).toBeVisible();
    await app.page.waitForTimeout(300);
    expect(await app.spoken()).toEqual([]);
  });

  test('reset needs two taps; the first tap alone changes nothing', async ({ app }) => {
    await app.goto();
    await app.go('find');
    await app.answerCorrect(); // earn one star through the UI
    await app.go('home');
    expect(await app.sel.starCount()).toBe(1);
    await app.openParents();
    await app.tap('setting-reset');
    await app.tap('parents-close');
    expect(await app.sel.starCount(), 'one tap must not reset').toBe(1);
    await app.openParents();
    await app.tap('setting-reset');
    await app.tap('setting-reset');
    await app.tap('parents-close');
    await expect.poll(() => app.sel.starCount()).toBe(0);
    await app.reload();
    expect(await app.sel.starCount()).toBe(0);
  });

  test('gate is reachable from every screen (report only)', async ({ app }) => {
    await app.goto();
    const missing = [];
    for (const t of ['abc', 'find', 'trace']) {
      await app.go(t);
      if (!(await app.$('parent-gate').first().isVisible())) missing.push(t);
    }
    if (missing.length) app.note('note', `parent gate not visible on: ${missing.join(', ')}`);
  });

  test('keyboard Enter on the gate should not bypass the hold (report only)', async ({ app }) => {
    await app.goto();
    await app.$('parent-gate').first().focus();
    await app.page.keyboard.press('Enter');
    await app.page.waitForTimeout(300);
    if (await app.$('parents-panel').isVisible()) app.note('note', 'Enter key on the gate opens the parents area instantly (hold bypass with a hardware keyboard)');
  });
});

test.describe('Parent gate under touch-move', () => {
  test('finger sliding off the gate cancels the hold', async ({ app, page }) => {
    await app.goto();
    const c = await touch.center(app.$('parent-gate').first());
    await touch.touchDown(page, c.x, c.y);
    await page.waitForTimeout(500);
    await touch.touchMove(page, c.x, c.y + 250);
    await page.waitForTimeout(2200);
    await touch.touchUp(page);
    await expect(app.$('parents-panel')).toBeHidden();
  });
});
