// Single source of truth for how the tests find things in the app.
//
// The tests ONLY talk to the app through this file. Every key below is a
// `data-testid` from the contract in ../SELECTORS.md. While the app has no
// data-testid attributes yet (current prototype), a LEGACY fallback selector
// is used instead. Once the redesigned app ships data-testids, the suite
// switches automatically (mode "auto") — or force it with SELECTOR_MODE=testid.
//
//   SELECTOR_MODE=auto    (default) testid if the page contains any [data-testid], else legacy
//   SELECTOR_MODE=testid  contract only, no fallbacks (use this to verify the redesign)
//   SELECTOR_MODE=legacy  prototype selectors only
//
// When the redesign is done, the LEGACY column can be deleted.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// key -> legacy CSS selector (string) or function(arg) -> selector.
// For parametrised testids (letter-tile-A …) see testidFor().
const LEGACY = {
  // screens (visible = active)
  'screen-home': '#s-home',
  'screen-abc': '#s-abc',
  'screen-find': '#s-find',
  'screen-trace': '#s-trace',

  // tab bar
  'tab-home': '.tab[data-go="home"]',
  'tab-abc': '.tab[data-go="abc"]',
  'tab-find': '.tab[data-go="find"]',
  'tab-trace': '.tab[data-go="trace"]',

  // home
  'home-greeting': '#s-home .hello h1',
  'home-today': '#todayCard',
  'home-today-letter': '#todayLetter',
  'home-bruno': '#homeBruno',
  'home-bubble': '#homeBubble',
  'home-go-abc': '.act[data-go="abc"]',
  'home-go-find': '.act[data-go="find"]',
  'home-go-trace': '.act[data-go="trace"]',
  'star-count': 'section:not([hidden]) .starcount',

  // ABC grid + detail
  'abc-grid': '#abcGrid',
  'letter-tile': (L) => (L ? `#abcGrid .tile[data-l="${L}"]` : '#abcGrid .tile'),
  'detail-overlay': '#detail',
  'detail-letter': '#dLetter',
  'detail-word': '#dWord',
  'detail-close': '#detail [data-close]',
  'detail-prev': '#dPrev',
  'detail-next': '#dNext',
  'detail-say': '#dSay',
  'detail-trace': '#dTrace',

  // Finden
  'find-prompt': '#askBubble',
  'find-choice': (L) => (L ? `#choices .choice[data-l="${L}"]` : '#choices .choice'),
  'round-star': '#roundStars span',
  'round-star-filled': '#roundStars span.on',
  'celebration': '#party',
  'celebration-again': '#again',
  'celebration-home': '#party [data-go="home"]',

  // Nachmalen
  'trace-board': '#board',
  'trace-guide': '#guide',
  'trace-ink': '#draw',
  'trace-clear': '#tClear',
  'trace-prev': '#tPrev',
  'trace-next': '#tNext',
  'trace-say': '#tSay',
  'trace-crayon': '#crayons .crayon',
  'trace-progress': '#meter',

  // Eltern
  'parent-gate': '.parent-gate',
  'parents-panel': '#parents',
  'parents-close': '#parents [data-close]',
  'setting-name': '#setName',
  'setting-case': (v) => (v ? `#setCase button[data-v="${v}"]` : '#setCase button'),
  'setting-sound': (v) => (v ? `#setSound button[data-v="${v === 'on' ? '1' : '0'}"]` : '#setSound button'),
  'setting-reset': '#resetBtn',
};

// keys whose testid embeds the argument (e.g. letter-tile-A)
const SUFFIXED = new Set(['letter-tile', 'setting-case', 'setting-sound']);
// keys whose testid is shared and the argument filters by data-letter
const BY_LETTER = new Set(['find-choice']);

function testidFor(key, arg) {
  if (key === 'round-star-filled') return null; // handled specially
  if (SUFFIXED.has(key) && arg) return `${key}-${arg}`;
  return key;
}

async function detectMode(page) {
  const forced = (process.env.SELECTOR_MODE || 'auto').toLowerCase();
  if (forced === 'testid' || forced === 'legacy') return forced;
  const n = await page.locator('[data-testid]').count();
  return n > 0 ? 'testid' : 'legacy';
}

class Sel {
  constructor(page, mode) { this.page = page; this.mode = mode; }

  /** Locator for a contract key. `arg` = letter (A–Z) or option value. */
  get(key, arg) {
    const p = this.page;
    if (this.mode === 'testid') {
      if (key === 'round-star-filled') return p.locator('[data-testid="round-star"][data-filled="true"]');
      if (key === 'star-count') return p.locator('[data-testid="star-count"]').filter({ visible: true }).first();
      if (SUFFIXED.has(key) && !arg) return p.locator(`[data-testid^="${key}-"]`);
      const loc = p.getByTestId(testidFor(key, arg));
      if (BY_LETTER.has(key) && arg) return p.locator(`[data-testid="${key}"][data-letter="${arg}"]`);
      return loc;
    }
    const s = LEGACY[key];
    if (!s) throw new Error(`No legacy selector for "${key}"`);
    const css = typeof s === 'function' ? s(arg) : s;
    if (key === 'star-count') return p.locator(css).first();
    return p.locator(css);
  }

  /** Plain CSS selector for a (non-parametrised) key, for use inside page.evaluate. */
  css(key) {
    if (this.mode === 'testid') return `[data-testid="${key}"]`;
    const s = LEGACY[key];
    return typeof s === 'function' ? s() : s;
  }

  /** Letter (A–Z, uppercase) carried by an element: data-letter, else data-l, else first letter of text. */
  async letterOf(locator) {
    const v = (await locator.getAttribute('data-letter')) || (await locator.getAttribute('data-l'));
    if (v) return v.toUpperCase();
    const t = (await locator.innerText()).trim();
    const m = t.match(/[A-Za-zÄÖÜäöü]/);
    return m ? m[0].toUpperCase() : null;
  }

  /** Target letter of the current "Finden" question. */
  async findTarget() {
    const prompt = this.get('find-prompt');
    if (this.mode === 'testid') return (await prompt.getAttribute('data-letter')).toUpperCase();
    const b = prompt.locator('b');
    return (await b.innerText()).trim()[0].toUpperCase();
  }

  async starCount() {
    const t = await this.get('star-count').innerText();
    return parseInt(t.replace(/\D+/g, ''), 10) || 0;
  }

  async filledRoundStars() { return this.get('round-star-filled').count(); }

  /** The letter shown on the home "letter of the day" card. */
  async todayLetter() {
    if (this.mode === 'testid') {
      const v = await this.get('home-today').getAttribute('data-letter');
      if (v) return v.toUpperCase();
    }
    return this.letterOf(this.get(this.mode === 'testid' ? 'home-today' : 'home-today-letter'));
  }

  /** Letter shown in the detail overlay. */
  async detailLetter() {
    if (this.mode === 'testid') {
      const v = await this.get('detail-overlay').getAttribute('data-letter');
      if (v) return v.toUpperCase();
    }
    return this.letterOf(this.get('detail-letter'));
  }

  /** Is the given setting option currently selected? */
  async isSelected(locator) {
    return locator.evaluate((el) =>
      el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true' ||
      el.getAttribute('aria-selected') === 'true' || el.dataset.selected === 'true' || el.classList.contains('on'));
  }
}

module.exports = { Sel, detectMode, LEGACY, LETTERS, testidFor };
