// Headless-Smoke-Test für Möbel-Chaos: startet Server + Chromium, spielt Kernabläufe an.
// Aufruf: node tools/smoke-test.mjs   (Screenshots landen in tools/out/)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'game');
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
fs.mkdirSync(out, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const errors = [];
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? '✔' : '✘'} ${msg}`); if (!ok) fails.push(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Spielzeit deterministisch vorspulen (headless rendert mit Software-GL nur wenige fps)
const adv = (sec) => page.evaluate((s) => window.__game.advance(s), sec);
const shot = async (name) => {
  await page.evaluate(() => window.__game.renderNow());
  await page.screenshot({ path: path.join(out, name) });
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

try {
  await page.goto(url);
  await page.waitForFunction(() => window.__game, null, { timeout: 15000 });
  await sleep(500);
  await shot('1-title.png');
  check(await page.evaluate(() => window.__game.state) === 'title', 'Titelbildschirm erscheint');

  await page.keyboard.press('Space');
  await adv(3.6);
  check(await page.evaluate(() => window.__game.state) === 'play', 'Countdown → Spiel läuft');
  await adv(1);
  await shot('2-play.png');

  // Spieler 1 nimmt die Umzugskiste im Schlafzimmer
  await page.evaluate(() => { const p = window.__game.game.players[0]; p.x = -0.1; p.z = 2.25; p.face = Math.PI / 2; });
  await adv(0.1);
  await page.keyboard.press('Space');
  await adv(0.3);
  let s = await page.evaluate(() => window.__game.snapshot());
  check(s.players[0].carry === 'box', `Spieler 1 trägt eine Kiste (trägt: ${s.players[0].carry})`);

  // mit der Kiste laufen
  await page.keyboard.down('KeyA');
  await adv(0.5);
  await page.keyboard.up('KeyA');
  s = await page.evaluate(() => window.__game.snapshot());
  check(s.players[0].x < -1 && s.players[0].carry === 'box', `Mit Kiste gelaufen (x=${s.players[0].x})`);

  // in den Wagen teleportieren und abstellen
  await page.evaluate(() => { const p = window.__game.game.players[0]; p.x = 12.5; p.z = 0; p.face = 0; });
  await adv(0.3);
  await page.keyboard.press('Space');
  await adv(1);
  s = await page.evaluate(() => window.__game.snapshot());
  check(s.delivered >= 1 && s.score > 0, `Kiste abgeliefert (geladen ${s.delivered}, Wert ${s.score} €)`);

  // Koop: Sofa zu zweit anheben
  await page.evaluate(() => {
    const [a, b] = window.__game.game.players;
    a.x = -4.05; a.z = -8.2; a.face = 0; b.x = -1.15; b.z = -8.2; b.face = Math.PI;
  });
  await adv(0.1);
  await page.keyboard.press('Space');
  await adv(0.3);
  s = await page.evaluate(() => window.__game.snapshot());
  check(s.items.find((i) => i.type === 'sofa').carriers === 1, 'Ein Spieler allein kann das Sofa nicht anheben');
  await page.keyboard.press('Enter');
  await adv(0.4);
  s = await page.evaluate(() => window.__game.snapshot());
  const sofa = s.items.find((i) => i.type === 'sofa');
  check(sofa.carriers === 2 && sofa.state === 'carried', `Sofa wird zu zweit getragen (Träger ${sofa.carriers}, Zustand ${sofa.state})`);
  await page.keyboard.down('KeyS'); await page.keyboard.down('ArrowDown');
  await adv(1.2);
  await page.keyboard.up('KeyS'); await page.keyboard.up('ArrowDown');
  s = await page.evaluate(() => window.__game.snapshot());
  const sofa2 = s.items.find((i) => i.type === 'sofa');
  check(sofa2.z > sofa.z + 1, `Sofa bewegt sich mit beiden Spielern (z ${sofa.z} → ${sofa2.z}, HP ${sofa2.hp})`);
  await shot('3-coop.png');

  // Auseinanderziehen erzeugt Spannung → Schaden
  await page.keyboard.down('KeyA'); await page.keyboard.down('ArrowRight');
  await adv(0.6);
  await page.keyboard.up('KeyA'); await page.keyboard.up('ArrowRight');
  s = await page.evaluate(() => window.__game.snapshot());
  const sofa3 = s.items.find((i) => i.type === 'sofa');
  check(sofa3.hp < sofa2.hp, `Auseinanderziehen beschädigt das Sofa (HP ${sofa2.hp} → ${sofa3.hp})`);
  await page.keyboard.press('Space');
  await adv(0.6);

  // Schaden: mit dem Fernseher gegen die Wand rennen
  await page.evaluate(() => { const p = window.__game.game.players[0]; p.x = -2.6; p.z = -2.3; p.face = -Math.PI / 2; });
  await adv(0.1);
  await page.keyboard.press('Space');
  await adv(0.2);
  await page.evaluate(() => { const p = window.__game.game.players[0]; p.x = -0.8; p.z = -4.5; p.face = 0; });
  await page.keyboard.down('KeyD');
  await adv(0.7);
  await page.keyboard.up('KeyD');
  s = await page.evaluate(() => window.__game.snapshot());
  const tv = s.items.find((i) => i.type === 'tv');
  check(s.players[0].carry === 'tv' && tv.hp < 100, `Fernseher nimmt beim Aufprall Schaden (HP ${tv.hp})`);
  await adv(0.05);
  await shot('4-damage.png');

  // Zerbrechen: Fernseher mehrfach gegen die Wand
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => { const p = window.__game.game.players[0]; p.x = -1.6; p.vx = 0; });
    await page.keyboard.down('KeyD'); await adv(0.5); await page.keyboard.up('KeyD'); await adv(0.2);
  }
  s = await page.evaluate(() => window.__game.snapshot());
  check(s.items.find((i) => i.type === 'tv').state === 'broken' && s.players[0].carry === null, 'Fernseher zerbricht nach mehreren Rempler');
  await adv(0.15);
  await shot('5-broken.png');

  // Zeit ablaufen lassen → Ergebnis
  await page.evaluate(() => window.__game.debugSetTime(0.5));
  await adv(1);
  check(await page.evaluate(() => window.__game.state) === 'end', 'Ergebnisbildschirm nach Zeitablauf');
  await sleep(1500);
  await shot('6-results.png');
  console.log(`  FPS (headless, Software-GL): ${(await page.evaluate(() => window.__game.fps)).toFixed(1)}`);
} catch (e) {
  fails.push(String(e));
  console.error(e);
}

check(errors.length === 0, `keine Konsolenfehler${errors.length ? ':\n   ' + errors.join('\n   ') : ''}`);
await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);
