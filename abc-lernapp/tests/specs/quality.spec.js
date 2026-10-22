const { test, expect } = require('../support/fixtures');
const { STATES, CHILD_STATES, smallTargets, horizontalOverflow } = require('../support/states');

let AxeBuilder = null;
try { AxeBuilder = require('@axe-core/playwright').default; } catch (e) { /* optional */ }

test.describe('Layout quality', () => {
  for (const name of Object.keys(STATES)) {
    test(`no horizontal overflow: ${name}`, async ({ app }) => {
      await STATES[name](app);
      await app.page.waitForTimeout(400);
      expect(await horizontalOverflow(app)).toEqual([]);
    });
  }

  for (const name of Object.keys(STATES)) {
    const child = CHILD_STATES.includes(name);
    test(`tap targets >= 64px: ${name}${child ? '' : ' (report only)'}`, async ({ app }) => {
      const layer = await STATES[name](app);
      await app.page.waitForTimeout(400);
      const small = await smallTargets(app, layer, 64);
      if (small.length) app.note(child ? 'tap-offenders' : 'tap-offenders-parent', `${name}: ${small.join('; ')}`);
      if (child) expect(small, 'child-facing targets smaller than 64x64 CSS px').toEqual([]);
    });
  }
});

test.describe('Reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  // test.use alone did not reach the page in this setup (custom context fixture + isMobile), so also emulate explicitly
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

  const infinite = (app) => app.page.evaluate(() => document.getAnimations()
    .filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity)
    .map((a) => `${a.animationName || a.id || 'anim'} on ${a.effect.target ? (a.effect.target.dataset.testid || a.effect.target.id || a.effect.target.className) : '?'}`));

  test('no infinite animations run on any screen', async ({ app }) => {
    const found = [];
    for (const name of ['home', 'abc', 'find', 'trace', 'detail']) {
      await STATES[name](app);
      await app.page.waitForTimeout(300);
      found.push(...(await infinite(app)).map((x) => `${name}: ${x}`));
    }
    expect(found).toEqual([]);
  });

  test('celebration plays no long-running motion', async ({ app }) => {
    await STATES.celebration(app);
    const running = await app.page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
    app.note('metric', `running animations in celebration with reduced motion: ${running}`);
    expect((await infinite(app))).toEqual([]);
  });
});

test.describe('Motion sanity (default motion)', () => {
  test('without reduced motion the mascot does animate (report only)', async ({ app }) => {
    await app.goto();
    const n = await app.page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity).length);
    app.note('metric', `infinite animations on home (motion allowed): ${n}`);
  });
});

test.describe('Accessibility (axe-core)', () => {
  for (const name of ['home', 'abc', 'detail', 'find', 'trace', 'parents']) {
    test(`axe: ${name}`, async ({ app, page }) => {
      test.skip(!AxeBuilder, '@axe-core/playwright not installed');
      const layer = await STATES[name](app);
      await page.waitForTimeout(400);
      let builder = new AxeBuilder({ page });
      if (layer) builder = builder.include(app.sel.mode === 'testid' ? `[data-testid="${layer}"]` : require('../support/selectors').LEGACY[layer]);
      const res = await builder.analyze();
      const by = (impact) => res.violations.filter((v) => v.impact === impact);
      for (const v of res.violations) app.note('a11y', `${name}: [${v.impact}] ${v.id} (${v.nodes.length}x) ${v.help}`);
      expect(by('critical').map((v) => `${v.id}: ${v.help}`), 'critical a11y violations').toEqual([]);
    });
  }
});

test.describe('Offline & home-screen readiness', () => {
  test('works without internet (all external requests blocked)', async ({ app, context }) => {
    await context.unrouteAll({ behavior: 'ignoreErrors' });
    const blocked = [];
    await context.route((u) => !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u.toString()) && !/^(data|blob):/.test(u.toString()),
      (r) => { blocked.push(new URL(r.request().url()).host); return r.abort('internetdisconnected'); });
    app.allowError(/Failed to load resource|ERR_INTERNET_DISCONNECTED/);
    const t0 = Date.now();
    await app.goto();
    await app.go('trace');
    await expect.poll(() => app.$('trace-board').locator('canvas').first().evaluate((cv) => {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 40) n++; return n;
    }), { timeout: 3000 }).toBeGreaterThan(50);
    app.note('metric', `offline: home->trace ready in ${Date.now() - t0}ms`);
    if (blocked.length) app.note('note', `app depends on external hosts (blocked offline): ${[...new Set(blocked)].join(', ')}`);
    await app.go('find');
    await app.answerCorrect();
  });

  test('home-screen web-app meta tags (report missing PWA bits)', async ({ app, page }) => {
    await app.goto();
    const head = await page.evaluate(() => ({
      viewport: document.querySelector('meta[name=viewport]')?.content || '',
      capable: !!document.querySelector('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]'),
      manifest: !!document.querySelector('link[rel=manifest]'),
      icon: !!document.querySelector('link[rel="apple-touch-icon"]'),
      sw: 'serviceWorker' in navigator ? navigator.serviceWorker.controller !== null : false,
      lang: document.documentElement.lang,
    }));
    expect(head.viewport).toContain('width=device-width');
    expect(head.capable).toBe(true);
    expect(head.lang).toMatch(/^de/);
    const missing = ['manifest', 'icon'].filter((k) => !head[k]);
    if (missing.length) app.note('note', `not yet present: ${missing.join(', ')} (needed for phase 3 / offline)`);
  });
});
