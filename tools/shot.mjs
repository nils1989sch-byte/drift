// Regie-Hilfsskript: Screenshot(s) des laufenden Spiels. node tools/shot.mjs [out.png] [query] [width] [height]
import { chromium } from './pw.mjs';
import { spawn } from 'node:child_process';
const out = process.argv[2] || 'shot.png', q = process.argv[3] || '', W = +(process.argv[4] || 1280), H = +(process.argv[5] || 720);
const port = 8000 + Math.floor(Math.random() * 900);
const srv = spawn('npx', ['http-server', '.', '-p', String(port), '-c-1', '--silent'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:${port}/index.html${q}`);
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close(); srv.kill();
