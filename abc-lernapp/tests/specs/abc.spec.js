const { test, expect } = require('../support/fixtures');
const { LETTERS } = require('../support/selectors');

test.describe('ABC grid & letter detail', () => {
  test('grid shows 26 tiles A–Z', async ({ app }) => {
    await app.goto();
    await app.go('abc');
    await expect(app.$('letter-tile')).toHaveCount(26);
    for (const L of LETTERS) await expect(app.$('letter-tile', L)).toHaveCount(1);
  });

  test('tapping a tile opens the detail, close button closes it', async ({ app }) => {
    await app.goto();
    await app.go('abc');
    await app.tap('letter-tile', 'A');
    await expect(app.$('detail-overlay')).toBeVisible();
    expect(await app.sel.detailLetter()).toBe('A');
    await expect(app.$('detail-word')).toContainText(/affe/i);
    await app.tap('detail-close');
    await expect(app.$('detail-overlay')).toBeHidden();
    await expect(app.$('screen-abc')).toBeVisible();
  });

  test('prev / next step through the alphabet and wrap around', async ({ app }) => {
    await app.goto();
    await app.go('abc');
    await app.tap('letter-tile', 'M');
    expect(await app.sel.detailLetter()).toBe('M');
    await app.tap('detail-next');
    await expect.poll(() => app.sel.detailLetter()).toBe('N');
    await app.tap('detail-prev');
    await app.tap('detail-prev');
    await expect.poll(() => app.sel.detailLetter()).toBe('L');
    await app.tap('detail-close');
    await app.tap('letter-tile', 'Z');
    await app.tap('detail-next');
    await expect.poll(() => app.sel.detailLetter()).toBe('A');
    await app.tap('detail-prev');
    await expect.poll(() => app.sel.detailLetter()).toBe('Z');
  });

  test('"Malen" in the detail jumps to tracing', async ({ app }) => {
    await app.goto();
    await app.go('abc');
    await app.tap('letter-tile', 'B');
    await app.tap('detail-trace');
    await expect(app.$('detail-overlay')).toBeHidden();
    await expect(app.$('screen-trace')).toBeVisible();
  });

  test('case setting "A B C" shows only capitals in the grid', async ({ app }) => {
    await app.goto();
    await app.openParents();
    await app.tap('setting-case', 'upper');
    await app.tap('parents-close');
    await app.go('abc');
    const tile = app.$('letter-tile', 'G');
    await expect(tile).toContainText('G');
    await expect(tile).not.toContainText('g');
  });
});
