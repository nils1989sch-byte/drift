// Playwright config for "ABC mit Bruno".
// Chromium only (WebKit is not installed in this sandbox) — real Safari is covered by MANUAL-TEST-iPad.md.
const { defineConfig } = require('@playwright/test');

const PORT = Number(process.env.PORT || 4173);
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const ipad = (width, height) => ({
  viewport: { width, height },
  screen: { width, height },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: IPAD_UA,
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
});

module.exports = defineConfig({
  testDir: './specs',
  outputDir: './results/artifacts',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : 4,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'results/results.json' }],
    ['./support/summary-reporter.js'],
  ],
  use: {
    baseURL: process.env.BASE_URL || `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: process.env.BASE_URL ? undefined : {
    command: `node serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: true,
    timeout: 10_000,
  },
  projects: [
    { name: 'ipad-landscape', use: ipad(1180, 820) },
    { name: 'ipad-portrait', use: ipad(820, 1180) },
    { name: 'ipad-mini', use: ipad(744, 1133) },
  ],
});
