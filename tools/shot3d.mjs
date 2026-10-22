import { chromium } from '/home/user/drift/tools/pw.mjs';
import { spawn } from 'node:child_process';
const [out, q = '', tp = '', W = 1280, H = 720] = process.argv.slice(2);
const port = 8200 + Math.floor(Math.random() * 500);
const srv = spawn('npx', ['http-server', '/home/user/drift', '-p', String(port), '-c-1', '--silent'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: +W, height: +H } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(`http://localhost:${port}/index.html${q}`); await p.waitForTimeout(5000);
await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
for (let i=0;i<8;i++){ await p.keyboard.press('Space'); await p.waitForTimeout(250);} 
if (tp) { await p.evaluate((tp) => { const [m,x,y]=tp.split(','); __drift.game.debug?.teleport(m,+x,+y); }, tp); await p.waitForTimeout(2500); }
await p.keyboard.press('Enter'); await p.waitForTimeout(400); await p.keyboard.press('Enter'); await p.waitForTimeout(1500); await p.screenshot({ path: out });
console.log(await p.evaluate(() => JSON.stringify({ st: __drift.game.state, map: __drift.game.world?.id, x: __drift.game.player.x|0, y: __drift.game.player.y|0, s: __drift.camera.scale, sprites: __drift.renderer.stats.sprites })));
console.log(errs.join('\n') || 'no errors'); await b.close(); srv.kill();
