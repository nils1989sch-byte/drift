// Drives the app into each reviewable state. Used by quality + visual specs.
// Each state returns the contract key of the "top layer" (overlay) or null for a plain screen.
const { expect } = require('@playwright/test');

const STATES = {
  home: async (app) => { await app.goto(); return null; },
  abc: async (app) => { await app.goto(); await app.go('abc'); return null; },
  detail: async (app) => {
    await app.goto(); await app.go('abc'); await app.tap('letter-tile', 'A');
    await expect(app.$('detail-overlay')).toBeVisible(); return 'detail-overlay';
  },
  find: async (app) => { await app.goto(); await app.go('find'); return null; },
  celebration: async (app) => {
    await app.goto(); await app.go('find');
    for (let i = 0; i < 5; i++) await app.answerCorrect();
    await expect(app.$('celebration')).toBeVisible(); return 'celebration';
  },
  trace: async (app) => { await app.goto(); await app.go('trace'); await app.page.waitForTimeout(300); return null; },
  parents: async (app) => { await app.goto(); await app.openParents(); return 'parents-panel'; },
};

// States meant for the child (strict 64px rule). The parents panel is report-only.
const CHILD_STATES = ['home', 'abc', 'detail', 'find', 'celebration', 'trace'];

/** Interactive elements in the top layer that are smaller than `min` CSS px in either dimension. */
async function smallTargets(app, layerKey, min = 64) {
  const scope = layerKey ? app.$(layerKey) : app.page.locator('body');
  return scope.evaluate((root, min) => {
    const q = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=link], [role=switch], [role=radio], [tabindex]:not([tabindex="-1"])';
    const out = [];
    for (const el of root.querySelectorAll(q)) {
      if (el.closest('[hidden], [aria-hidden="true"], [inert]')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.width < min - 0.5 || r.height < min - 0.5) {
        const name = el.dataset.testid || (el.id && `#${el.id}`) || `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`;
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20);
        out.push(`${name}${label ? ` "${label}"` : ''} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return [...new Set(out)];
  }, min);
}

/** Horizontal overflow: page wider than viewport, or any scroll container scrolling sideways. */
async function horizontalOverflow(app) {
  return app.page.evaluate(() => {
    const out = [];
    const vw = window.innerWidth;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`document ${document.documentElement.scrollWidth}px > ${vw}px`);
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[hidden]')) continue;
      const cs = getComputedStyle(el);
      if (['auto', 'scroll'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) {
        out.push(`${el.dataset.testid || el.id || el.className || el.tagName} scrolls sideways (${el.scrollWidth} > ${el.clientWidth})`);
      }
    }
    return out;
  });
}

module.exports = { STATES, CHILD_STATES, smallTargets, horizontalOverflow };
