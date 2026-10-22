// Real touch input via the Chrome DevTools Protocol. Produces touchstart/move/end
// AND pointer events with pointerType "touch" — like a finger on the iPad.
// Playwright's own touchscreen only supports tap(); drags and long-presses need CDP.

const sessions = new WeakMap();
async function cdp(page) {
  if (!sessions.has(page)) sessions.set(page, await page.context().newCDPSession(page));
  return sessions.get(page);
}

const pt = (x, y, id = 1) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 });

async function touchDown(page, x, y) {
  await (await cdp(page)).send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(x, y)] });
}
async function touchMove(page, x, y) {
  await (await cdp(page)).send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(x, y)] });
}
async function touchUp(page) {
  await (await cdp(page)).send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function center(locator) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  if (!b) throw new Error('element has no bounding box');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Press and hold a finger on the element for `ms` milliseconds. */
async function touchHold(page, locator, ms) {
  const c = await center(locator);
  await touchDown(page, c.x, c.y);
  await page.waitForTimeout(ms);
  await touchUp(page);
}

/** One continuous finger stroke through the given viewport points (CSS px). */
async function touchStroke(page, points, { stepPx = 12 } = {}) {
  if (!points.length) return;
  await touchDown(page, points[0].x, points[0].y);
  let prev = points[0];
  for (const p of points.slice(1)) {
    const n = Math.max(1, Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y) / stepPx));
    for (let i = 1; i <= n; i++) await touchMove(page, prev.x + ((p.x - prev.x) * i) / n, prev.y + ((p.y - prev.y) * i) / n);
    prev = p;
  }
  await touchUp(page);
}

module.exports = { touchDown, touchMove, touchUp, touchHold, touchStroke, center };
