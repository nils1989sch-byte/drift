// Character materials: 5–6 tone ramps (dark → light) with hue shift (shadows drift towards blue-violet,
// lights towards warm yellow), plus a coloured outline tone (darker than the material, never black) and a
// slightly lighter outline for the lit top-left side. Shared by hero, NPCs and enemies so all figures match.
import { c32, rgbOf, rgb2hsl, hsl2hex } from '../core.js';

function hueToward(h, target, amt) {
  let d = ((target - h + 540) % 360) - 180;
  return h + Math.sign(d) * Math.min(Math.abs(d), amt);
}
// base = mid tone. n tones; mid index = idx.
export function ramp(base, o = {}) {
  const [r, g, b] = rgbOf(c32(base));
  const [h, s, l] = rgb2hsl(r, g, b);
  const n = o.n ?? 6, mid = o.mid ?? 3;
  const dk = o.dk ?? 0.085, lt = o.lt ?? 0.07, hsD = o.hsD ?? 7, hsL = o.hsL ?? 5;
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = i - mid;
    if (k < 0) out.push(hsl2hex(hueToward(h, o.shadowHue ?? 250, -k * hsD), s + (o.sD ?? 0.04) * -k, l + k * dk));
    else if (k === 0) out.push(base);
    else out.push(hsl2hex(hueToward(h, o.lightHue ?? 50, k * hsL), s - (o.sL ?? 0.04) * k, l + k * lt));
  }
  const line = o.line ?? hsl2hex(hueToward(h, o.shadowHue ?? 250, (mid + 1.5) * hsD), Math.min(0.75, s + 0.08), Math.max(0.07, l - (mid + 1.2) * dk));
  return { c: out, line, lineLit: o.lineLit ?? out[0] };
}

export const MAT = [null];
export const M = {};
function def(name, base, o = {}) {
  const r = o.colors ? { c: o.colors, line: o.line ?? o.colors[0], lineLit: o.lineLit ?? o.colors[0] } : ramp(base, o);
  const m = { name, ...o, c: r.c, line: r.line, lineLit: r.lineLit };
  m.u = m.c.map((x) => c32(x));
  m.lineU = c32(m.line); m.lineLitU = c32(m.lineLit);
  M[name] = MAT.length; MAT.push(m);
  return M[name];
}

// --- shared ---
def('skin', '#eab38a', { colors: ['#9a5a52', '#b8705e', '#d69272', '#eab38a', '#f6cba2', '#fde2c0'], line: '#5a2c30', lineLit: '#94564c', amb: 0.42, k: 0.58 });
def('skin_old', '#e0aa8a', { colors: ['#8e5652', '#a86a5e', '#c88670', '#e0aa8a', '#efc2a0', '#f8dabc'], line: '#562c30', lineLit: '#8a524c', amb: 0.42, k: 0.58 });
def('blush', '#e48a7a', { colors: ['#b8564e', '#d06e62', '#e48a7a', '#ec9e88'], noLine: true });
def('eye', '#2a3048', { colors: ['#1e1a2c', '#2a3a5c', '#3e6a8a', '#f4eee2'], noLine: true });
def('eye_brn', '#3a2a28', { colors: ['#22161e', '#4a3024', '#7a5034', '#f4eee2'], noLine: true });
def('white', '#f0ece0', { colors: ['#8a8aa0', '#b8b8c8', '#dcdad8', '#f0ece0', '#fbf8ee'], line: '#4a4660' });
def('steel', '#a3adbd', { dk: 0.11, lt: 0.075, hsD: 6, shadowHue: 240, line: '#2a2c44', lineLit: '#4e5672', spec: 0.9, amb: 0.3, k: 0.78 });
def('iron', '#6e7286', { dk: 0.09, lt: 0.08, line: '#24222e', lineLit: '#3a3a50', spec: 0.92, amb: 0.3, k: 0.7 });
def('brass', '#cf9a3e', { dk: 0.09, lt: 0.08, hsD: 8, shadowHue: 10, line: '#4a2418', lineLit: '#7a4220', spec: 0.88, amb: 0.3, k: 0.78 });
def('glint', '#fbf6e4', { colors: ['#fbf6e4'], noLine: true, noOutline: true });

// --- hero ---
def('hair', '#50342a', { dk: 0.06, lt: 0.075, hsD: 8, hsL: 6, shadowHue: 280, sD: 0.02, line: '#20141e', lineLit: '#3a2228', spec: 0.95, amb: 0.36, k: 0.66 });
def('scarf', '#2b7682', { dk: 0.075, lt: 0.075, hsD: 10, hsL: 8, shadowHue: 235, lightHue: 160, line: '#122236', lineLit: '#1a3a52', amb: 0.38, k: 0.62 });
def('scarf_in', '#1f5868', { dk: 0.07, lt: 0.06, hsD: 10, shadowHue: 240, line: '#101c30', lineLit: '#162c44' });
def('leather', '#8f5a3a', { dk: 0.075, lt: 0.075, hsD: 8, shadowHue: 330, line: '#2e1618', lineLit: '#4e2620', amb: 0.36, k: 0.64 });
def('leather_dk', '#5e3a2c', { dk: 0.06, lt: 0.07, hsD: 8, shadowHue: 300, line: '#1e1016', lineLit: '#36202a' });
def('shirt', '#e4d8bc', { dk: 0.08, lt: 0.045, hsD: 12, shadowHue: 260, sD: -0.02, line: '#4a3a48', lineLit: '#7a6a70', amb: 0.4, k: 0.6 });
def('pants', '#4f4d68', { dk: 0.07, lt: 0.075, hsD: 6, shadowHue: 255, lightHue: 220, line: '#181628', lineLit: '#2a283e' });
def('boot', '#5a3a2e', { dk: 0.07, lt: 0.075, hsD: 8, shadowHue: 320, line: '#22121a', lineLit: '#3a2024', spec: 0.95 });
def('belt', '#44302c', { dk: 0.06, lt: 0.075, hsD: 6, shadowHue: 300, line: '#1a1018', lineLit: '#2a1a20' });
def('pouch', '#a5703f', { dk: 0.08, lt: 0.07, hsD: 8, shadowHue: 340, line: '#3a1c16', lineLit: '#5a3020' });
def('wood', '#9c6436', { dk: 0.08, lt: 0.07, hsD: 8, shadowHue: 340, line: '#341a16', lineLit: '#56301e' });
def('emblem', '#3f8c8a', { dk: 0.08, lt: 0.07, hsD: 10, shadowHue: 235, line: '#14283a', noLine: true });

// --- npcs ---
def('beard', '#e6e0d4', { dk: 0.085, lt: 0.035, hsD: 12, shadowHue: 250, sD: -0.04, line: '#4a4458', lineLit: '#7c7488', amb: 0.4, k: 0.6, spec: 0.95 });
def('robe', '#6a4a8a', { dk: 0.075, lt: 0.075, hsD: 8, shadowHue: 255, lightHue: 330, line: '#1e1430', lineLit: '#2e2044' });
def('robe_trim', '#d8b060', { dk: 0.09, lt: 0.06, hsD: 8, shadowHue: 10, line: '#4a2818', spec: 0.9 });
def('staff', '#8a5a34', { dk: 0.08, lt: 0.08, line: '#2a1612', lineLit: '#46261a' });
def('gem', '#58d0c8', { colors: ['#1e5a70', '#2a8a98', '#58d0c8', '#a8f0e0', '#f0fff8'], line: '#123048', spec: 0.8, amb: 0.5, k: 0.6 });
def('hair_red', '#b0522e', { dk: 0.07, lt: 0.08, hsD: 8, shadowHue: 320, line: '#3a141a', lineLit: '#5a2220', spec: 0.95, amb: 0.36, k: 0.66 });
def('dress', '#b84a48', { dk: 0.08, lt: 0.075, hsD: 8, shadowHue: 300, line: '#3a1426', lineLit: '#5a2032' });
def('apron', '#efe6d0', { dk: 0.075, lt: 0.035, hsD: 12, shadowHue: 250, sD: -0.03, line: '#4e4456', lineLit: '#7e7484' });
def('vest', '#3e5a8a', { dk: 0.075, lt: 0.075, hsD: 6, shadowHue: 255, lightHue: 190, line: '#141c38', lineLit: '#203058' });
def('hat', '#7a5a3a', { dk: 0.075, lt: 0.075, hsD: 8, shadowHue: 320, line: '#261614', lineLit: '#3e261e' });
def('hair_blk', '#3a2e34', { dk: 0.055, lt: 0.08, hsD: 8, shadowHue: 270, line: '#141016', lineLit: '#261c24', spec: 0.95 });
def('pack', '#8a6a44', { dk: 0.08, lt: 0.07, hsD: 8, shadowHue: 330, line: '#2a1a14' });
def('green_cloth', '#5a7a3a', { dk: 0.075, lt: 0.075, hsD: 8, shadowHue: 230, line: '#1a2414', lineLit: '#2a3a20' });

// --- soldier ---
def('tabard', '#3a5c9a', { dk: 0.075, lt: 0.07, hsD: 7, shadowHue: 255, lightHue: 195, line: '#121a3a', lineLit: '#1c2a56' });
def('plume', '#c8443e', { dk: 0.08, lt: 0.07, hsD: 8, shadowHue: 320, line: '#3a1020', lineLit: '#5a1a28' });
def('chain', '#7c8294', { dk: 0.09, lt: 0.07, hsD: 6, line: '#20202e', lineLit: '#363848', amb: 0.3, k: 0.7 });

// --- enemies ---
def('clay', '#c8664a', { dk: 0.08, lt: 0.07, hsD: 9, shadowHue: 320, line: '#3e1420', lineLit: '#6a2428', amb: 0.36, k: 0.64 });
def('clay_belly', '#ecc49a', { dk: 0.075, lt: 0.05, hsD: 10, shadowHue: 340, line: '#6a3028' });
def('leaf', '#5c9a3e', { dk: 0.08, lt: 0.075, hsD: 9, shadowHue: 200, lightHue: 70, line: '#143020', lineLit: '#1e4428' });
def('mouth', '#4a1a2a', { colors: ['#1c0c18', '#2e1222', '#4a1a2a', '#6a2a38'], line: '#1a0c16', noLine: true });
def('slime', '#9a4cc0', { dk: 0.075, lt: 0.08, hsD: 8, shadowHue: 260, lightHue: 320, line: '#2a1040', lineLit: '#46205e', spec: 0.88, amb: 0.36, k: 0.66 });
def('slime_core', '#e07ab8', { dk: 0.07, lt: 0.06, hsD: 6, shadowHue: 290, noLine: true });
def('bat', '#4e3a5e', { dk: 0.06, lt: 0.075, hsD: 8, shadowHue: 260, lightHue: 330, line: '#160e22', lineLit: '#261a36' });
def('membrane', '#8a4a5e', { dk: 0.075, lt: 0.07, hsD: 6, shadowHue: 290, lightHue: 20, line: '#2a1222', lineLit: '#3e1c30', amb: 0.4 });
def('eye_y', '#f0c848', { colors: ['#a86018', '#e09a28', '#f0c848', '#fbf0b0'], noLine: true });
def('stone', '#8e8678', { dk: 0.085, lt: 0.075, hsD: 7, shadowHue: 250, lightHue: 45, line: '#262230', lineLit: '#3c3644', amb: 0.34, k: 0.66 });
def('stone_dk', '#6a6270', { dk: 0.07, lt: 0.07, hsD: 6, shadowHue: 255, line: '#201c2a' });
def('moss', '#6a8e3e', { dk: 0.08, lt: 0.08, hsD: 9, shadowHue: 200, lightHue: 70, line: '#1a2a18', noLine: true });
def('glow', '#7ae8e0', { colors: ['#2a8a98', '#4cc0c8', '#7ae8e0', '#c0fff4', '#f4fffa'], line: '#14384a', noLine: true, amb: 0.7, k: 0.3 });
def('glow_hot', '#f8c860', { colors: ['#c86a20', '#f09a38', '#f8c860', '#fff0a8', '#fffbe8'], line: '#4a2010', noLine: true, amb: 0.7, k: 0.3 });
def('flash', '#fbf6ec', { colors: ['#d8d0e0', '#e8e2ec', '#f4f0f0', '#fbf8f4', '#fffdf8'], line: '#8a7a98', lineLit: '#b0a4bc' });
def('slash', '#c8f4f4', { colors: ['#4a8ab0', '#7ac8dc', '#c8f4f4', '#f8fffc'], noLine: true, noOutline: true });

// --- monsters (type colours: fire = ember/lava orange, water = petrol/turquoise, plant = green/moss,
//     stone = ochre/grey, spark = yellow/violet, wind = white/sky blue) ---
def('ember', '#e2683a', { dk: 0.08, lt: 0.07, hsD: 10, shadowHue: 330, lightHue: 45, line: '#3e1218', lineLit: '#6a2420', amb: 0.38, k: 0.64 });
def('ember_belly', '#f6d08a', { dk: 0.08, lt: 0.05, hsD: 10, shadowHue: 10, line: '#6a2a1e' });
def('basalt', '#4e3e46', { dk: 0.06, lt: 0.075, hsD: 6, shadowHue: 260, lightHue: 20, line: '#160e16', lineLit: '#2a1e26', spec: 0.95 });
def('flame', '#f8a038', { colors: ['#c8401e', '#ea6a26', '#f8a038', '#fcd264', '#fff4c0'], line: '#5a1a10', noLine: true, amb: 0.62, k: 0.36 });
def('otter', '#3a8c98', { dk: 0.075, lt: 0.07, hsD: 9, shadowHue: 240, lightHue: 160, line: '#0e2236', lineLit: '#163a50', amb: 0.38, k: 0.64 });
def('otter_dk', '#2a5e78', { dk: 0.07, lt: 0.07, hsD: 8, shadowHue: 245, line: '#0c1a30', lineLit: '#142a44' });
def('cream', '#f2e4c8', { dk: 0.075, lt: 0.04, hsD: 12, shadowHue: 250, sD: -0.03, line: '#5a4a50', lineLit: '#867680', amb: 0.42, k: 0.58 });
def('seashell', '#f2bca8', { dk: 0.08, lt: 0.05, hsD: 10, shadowHue: 320, line: '#5e2a34', lineLit: '#8a4a50', spec: 0.93 });
def('water', '#5ccad6', { colors: ['#1e6a8a', '#2e94b0', '#5ccad6', '#a2ecee', '#eafffc'], line: '#103a58', noLine: true, amb: 0.5, k: 0.5, spec: 0.85 });
def('spine', '#6aa63e', { dk: 0.08, lt: 0.08, hsD: 10, shadowHue: 200, lightHue: 70, line: '#143018', lineLit: '#1e4a24', amb: 0.36, k: 0.66 });
def('fur_brn', '#a8784e', { dk: 0.08, lt: 0.07, hsD: 8, shadowHue: 330, line: '#3a1e1a', lineLit: '#5a3226' });
def('ochre', '#c49a58', { dk: 0.08, lt: 0.07, hsD: 8, shadowHue: 330, lightHue: 50, line: '#3e2418', lineLit: '#5e3a24', amb: 0.36, k: 0.64 });
def('crystal', '#8ad0e0', { colors: ['#2e5a88', '#4a8ab8', '#8ad0e0', '#c8f4f4', '#ffffff'], line: '#1a2a52', spec: 0.82, amb: 0.45, k: 0.6 });
def('volt', '#f2cc3a', { dk: 0.08, lt: 0.06, hsD: 10, shadowHue: 15, lightHue: 60, line: '#4e2a14', lineLit: '#7a4a18', amb: 0.4, k: 0.62 });
def('violet', '#7a52c0', { dk: 0.075, lt: 0.075, hsD: 8, shadowHue: 260, lightHue: 300, line: '#1c1240', lineLit: '#2c1e5a' });
def('spark', '#fff08a', { colors: ['#a868e8', '#d2a0ff', '#fff08a', '#fffbe0'], line: '#3a1a6a', noLine: true, noOutline: true });
def('feather', '#eef0ee', { colors: ['#8a94b4', '#aab4cc', '#ccd4e0', '#eef0ee', '#fbfcf8'], line: '#34405e', lineLit: '#5a6684', amb: 0.4, k: 0.6 });
def('sky', '#72b2e2', { dk: 0.075, lt: 0.07, hsD: 6, shadowHue: 245, lightHue: 185, line: '#142a52', lineLit: '#1e3c6e', amb: 0.38, k: 0.64 });
def('beak', '#f0b040', { dk: 0.09, lt: 0.06, hsD: 10, shadowHue: 10, line: '#4e2410' });
def('snail', '#d6c48c', { dk: 0.08, lt: 0.05, hsD: 10, shadowHue: 300, lightHue: 60, line: '#4a3a2a', lineLit: '#6e5a40', amb: 0.42, k: 0.58 });
def('cap', '#7a9a3e', { dk: 0.08, lt: 0.075, hsD: 10, shadowHue: 210, lightHue: 65, line: '#1e2a14', lineLit: '#2e3e1e', amb: 0.38, k: 0.64 });
def('stem', '#ece0c0', { dk: 0.08, lt: 0.04, hsD: 12, shadowHue: 270, sD: -0.03, line: '#56485a', lineLit: '#80727e' });
def('petal', '#f2a0b8', { dk: 0.08, lt: 0.05, hsD: 8, shadowHue: 300, line: '#5a2240', noLine: true });
def('bronze', '#b8743a', { dk: 0.09, lt: 0.08, hsD: 8, shadowHue: 340, lightHue: 45, line: '#341810', lineLit: '#5a2a18', spec: 0.86, amb: 0.32, k: 0.76 });
def('petrol', '#2a7682', { dk: 0.08, lt: 0.08, hsD: 9, shadowHue: 240, lightHue: 170, line: '#0e2034', lineLit: '#16364a', spec: 0.9, amb: 0.32, k: 0.74 });
def('ranger', '#4e7a3e', { dk: 0.075, lt: 0.075, hsD: 8, shadowHue: 220, lightHue: 70, line: '#142614', lineLit: '#203a1e' });
def('tool_wood', '#b07c48', { dk: 0.08, lt: 0.07, hsD: 8, shadowHue: 340, line: '#3a1e14', lineLit: '#5a3020' });
def('salamander', '#8e3a2e', { dk: 0.07, lt: 0.075, hsD: 9, shadowHue: 300, lightHue: 30, line: '#2a0e16', lineLit: '#4a1a1e', amb: 0.38, k: 0.64 });
def('sandfur', '#dcbc8a', { dk: 0.08, lt: 0.06, hsD: 10, shadowHue: 330, lightHue: 50, line: '#4e3022', lineLit: '#7a5238', amb: 0.4, k: 0.6 });
def('earthfur', '#7e5638', { dk: 0.07, lt: 0.075, hsD: 8, shadowHue: 320, lightHue: 40, line: '#26140e', lineLit: '#3e2418', amb: 0.38, k: 0.62 });
def('bud', '#f0c050', { dk: 0.09, lt: 0.06, hsD: 10, shadowHue: 10, lightHue: 55, line: '#4a2a14', noLine: true });
def('lid', '#2a1e2a', { colors: ['#1a121c', '#2a1e2a'], noLine: true });
