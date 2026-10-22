const { test, expect } = require('../support/fixtures');

test.describe('Finden game', () => {
  test('question offers 3 balloons, exactly one is the asked letter', async ({ app }) => {
    await app.goto();
    await app.go('find');
    await expect(app.$('find-choice')).toHaveCount(3);
    const target = await app.sel.findTarget();
    expect(target).toMatch(/^[A-Z]$/);
    await expect(app.$('find-choice', target)).toHaveCount(1);
    expect(await app.sel.filledRoundStars()).toBe(0);
  });

  test('wrong answer does not advance and does not crash', async ({ app }) => {
    await app.goto();
    await app.go('find');
    const before = await app.questionSignature();
    const target = await app.sel.findTarget();
    const choices = await app.$('find-choice').all();
    let wrong = null;
    for (const c of choices) if ((await app.sel.letterOf(c)) !== target) { wrong = c; break; }
    await app.clearSpoken();
    await wrong.tap();
    await wrong.tap(); // double tap on a wrong balloon must not break anything either
    await app.page.waitForTimeout(1800);
    expect(await app.sel.filledRoundStars()).toBe(0);
    expect(await app.questionSignature()).toBe(before);
    await expect(app.$('celebration')).toBeHidden();
    // Bruno reacts kindly (no "falsch"), and repeats the question
    const said = (await app.spoken()).join(' ');
    expect(said).toContain(target);
    expect(said.toLowerCase()).not.toMatch(/falsch|nein/);
    // the right answer still works afterwards
    await app.answerCorrect();
    expect(await app.sel.filledRoundStars()).toBe(1);
  });

  test('5 correct answers -> celebration, +5 stars, "play again" resets the round', async ({ app }) => {
    await app.goto();
    const starsBefore = await app.sel.starCount();
    await app.go('find');
    for (let i = 0; i < 5; i++) await app.answerCorrect();
    await expect(app.$('celebration')).toBeVisible();
    expect(await app.sel.filledRoundStars()).toBe(5);
    await app.tap('celebration-again');
    await expect(app.$('celebration')).toBeHidden();
    await expect.poll(() => app.sel.filledRoundStars()).toBe(0);
    await expect(app.$('find-choice')).toHaveCount(3);
    expect(await app.sel.starCount()).toBe(starsBefore + 5);
  });

  test('celebration "home" button returns to the start screen', async ({ app }) => {
    await app.goto();
    await app.go('find');
    for (let i = 0; i < 5; i++) await app.answerCorrect();
    await app.tap('celebration-home');
    await expect(app.$('celebration')).toBeHidden();
    await expect(app.$('screen-home')).toBeVisible();
  });

  test('leaving the game right after an answer does not pop up anything on another screen', async ({ app }) => {
    await app.goto();
    await app.go('find');
    for (let i = 0; i < 4; i++) await app.answerCorrect();
    // 5th answer, then immediately switch to the ABC tab
    const target = await app.sel.findTarget();
    await app.$('find-choice', target).tap();
    await app.go('abc');
    await app.page.waitForTimeout(2200);
    await expect(app.$('screen-abc')).toBeVisible();
    await expect(app.$('celebration'), 'celebration must not appear over the ABC screen').toBeHidden();
  });

  test('rapid multi-tap on the right balloon counts only one star', async ({ app }) => {
    await app.goto();
    await app.go('find');
    const target = await app.sel.findTarget();
    const btn = app.$('find-choice', target);
    await btn.tap();
    await btn.tap({ timeout: 1000 }).catch(() => {});
    await btn.tap({ timeout: 1000 }).catch(() => {});
    await app.page.waitForTimeout(300);
    expect(await app.sel.filledRoundStars()).toBe(1);
  });
});
