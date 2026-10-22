// Resolves playwright from a local install or the globally installed copy.
let pw;
try { pw = await import('playwright'); }
catch { const { execSync } = await import('node:child_process'); const root = execSync('npm root -g').toString().trim(); pw = await import(root + '/playwright/index.mjs'); }
export const { chromium } = pw.default || pw;
