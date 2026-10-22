// Shared test fixtures: network routing, speech stub, console-error guard and an
// `app` helper that wraps the selector contract.
const base = require('@playwright/test');
const { Sel, detectMode } = require('./selectors');
const { installNetwork } = require('./network');
const touch = require('./touch');

const APP_PATH = process.env.APP_PATH || '/index.html';
const STORAGE_KEY = process.env.STORAGE_KEY || 'abc-bruno-v1';
const TABS = ['home', 'abc', 'find', 'trace'];

// Runs before any app script: records everything the app tries to say.
function speechStub() {
  window.__spoken = [];
  window.__speechCancels = 0;
  const rec = (kind, text, extra) => window.__spoken.push({ kind, text: String(text || ''), t: performance.now(), ...extra });
  if ('speechSynthesis' in window) {
    const ss = window.speechSynthesis;
    const fire = (u, type, ms) => setTimeout(() => {
      try { u.dispatchEvent(new SpeechSynthesisEvent(type, { utterance: u })); } catch (e) { /* ignore */ }
    }, ms);
    ss.speak = function (u) { rec('tts', u.text, { lang: u.lang, rate: u.rate }); fire(u, 'start', 0); fire(u, 'end', 30); };
    ss.cancel = function () { window.__speechCancels++; };
  }
  HTMLMediaElement.prototype.play = function () { rec('audio', this.currentSrc || this.src); return Promise.resolve(); };
}

class App {
  constructor(page, testInfo) {
    this.page = page;
    this.testInfo = testInfo;
    this.sel = null;
    this.errors = [];
    this.allowed = [];
    page.on('pageerror', (e) => this.errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') this.errors.push(`console.error: ${m.text()}`); });
  }

  get mode() { return this.sel && this.sel.mode; }
  $(key, arg) { return this.sel.get(key, arg); }

  async goto({ waitReady = true } = {}) {
    await this.page.goto(APP_PATH, { waitUntil: 'domcontentloaded' });
    this.sel = new Sel(this.page, await detectMode(this.page));
    if (waitReady) await base.expect(this.$('tab-home')).toBeVisible();
    return this;
  }

  async reload() {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await base.expect(this.$('tab-home')).toBeVisible();
  }

  /** Write app state into localStorage and reload so the app picks it up. */
  async seed(state) {
    await this.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [STORAGE_KEY, state]);
    await this.reload();
  }
  async storage() {
    return this.page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, STORAGE_KEY);
  }

  async tap(key, arg) { await this.$(key, arg).tap(); }
  /** Tap without waiting for the element to be "stable" (for permanently animated things like the mascot). */
  async tapMoving(key, arg) { await this.$(key, arg).tap({ force: true }); }

  async go(tab) {
    await this.tap(`tab-${tab}`);
    await base.expect(this.$(`screen-${tab}`)).toBeVisible();
  }

  async spoken() { return this.page.evaluate(() => window.__spoken.filter((s) => s.kind === 'tts').map((s) => s.text)); }
  async clearSpoken() { await this.page.evaluate(() => { window.__spoken.length = 0; }); }

  async hold(key, ms, arg) { await touch.touchHold(this.page, this.$(key, arg), ms); }

  /** Opens the parents' area via the 2-second hold gate (goes home first if the gate is not on screen). */
  async openParents(holdMs = 2600) {
    if (!(await this.$('parent-gate').first().isVisible())) await this.go('home');
    await touch.touchHold(this.page, this.$('parent-gate').first(), holdMs);
    await base.expect(this.$('parents-panel')).toBeVisible();
  }

  /** Signature of the current "Finden" question (prompt + offered letters). */
  async questionSignature() {
    const letters = [];
    for (const c of await this.$('find-choice').all()) letters.push(await this.sel.letterOf(c));
    return `${await this.sel.findTarget()}|${letters.join('')}`;
  }

  /** Answers the current Finden question correctly; waits for the next question or the celebration. */
  async answerCorrect() {
    const before = await this.questionSignature();
    const filled = await this.sel.filledRoundStars();
    const target = await this.sel.findTarget();
    const btn = this.$('find-choice', target);
    await base.expect(btn).toHaveCount(1);
    const handle = await btn.elementHandle();
    await btn.tap();
    await base.expect.poll(() => this.sel.filledRoundStars()).toBe(filled + 1);
    await base.expect.poll(async () => {
      if (await this.$('celebration').isVisible()) return 'celebration';
      const gone = await handle.evaluate((el) => !el.isConnected).catch(() => true);
      if (gone) return 'next';
      return (await this.questionSignature()) !== before ? 'next' : 'waiting';
    }, { timeout: 6000 }).not.toBe('waiting');
    return target;
  }

  allowError(re) { this.allowed.push(re); }
  unexpectedErrors() { return this.errors.filter((e) => !this.allowed.some((re) => re.test(e))); }

  async shot(name) {
    const dir = require('node:path').join(__dirname, '..', 'screens', this.testInfo.project.name);
    await this.page.waitForTimeout(450); // let entry animations settle
    await this.page.screenshot({ path: `${dir}/${name}.png`, fullPage: false, animations: 'disabled', caret: 'hide' });
  }

  note(type, description) { this.testInfo.annotations.push({ type, description: String(description) }); }
}

const test = base.test.extend({
  context: async ({ context }, use, testInfo) => {
    const external = await installNetwork(context);
    await context.addInitScript(speechStub);
    await use(context);
    if (external.length) testInfo.annotations.push({ type: 'external-requests', description: [...new Set(external.map((u) => new URL(u).host))].join(', ') });
  },
  app: async ({ page }, use, testInfo) => {
    const app = new App(page, testInfo);
    await use(app);
    // Every test also asserts: no uncaught page errors and no console.error output.
    const errs = app.unexpectedErrors();
    if (errs.length) testInfo.annotations.push({ type: 'console-errors', description: errs.join(' | ') });
    base.expect(errs, 'console / page errors during the test').toEqual([]);
  },
});

module.exports = { test, expect: base.expect, TABS, STORAGE_KEY, touch };
