// Event-Interpreter für das DRIFT-Inhaltsformat (Aktionen `do` und Bedingungen `if`, Katalog: schema.js ACTIONS/CONDITIONS).
// Läuft gegen das Game-Objekt aus src/game/index.js. Unbekannte Aktionen werden übersprungen (Warnung), nie geworfen.
const isStr = (v) => typeof v === 'string';
const STOP = Symbol('stop');

/** Bedingung prüfen. c: "flag" | "!flag" | { flag, hasItem, … } | Array (alle). */
export function test(g, c) {
  if (c == null || c === true) return true;
  if (c === false) return false;
  if (isStr(c)) return c.startsWith('!') ? !g.flags[c.slice(1)] : !!g.flags[c];
  if (Array.isArray(c)) return c.every((x) => test(g, x));
  for (const [k, v] of Object.entries(c)) {
    let ok = true;
    switch (k) {
      case 'flag': ok = test(g, String(v)); break;
      case 'notFlag': ok = !g.flags[v]; break;
      case 'flags': ok = [].concat(v).every((f) => test(g, String(f))); break;
      case 'var': {
        const n = Number(g.flags[v] || 0);
        for (const [op, x] of Object.entries(c)) {
          if (op === 'var') continue;
          if (op === '==' && !(n === x)) ok = false; if (op === '!=' && !(n !== x)) ok = false;
          if (op === '>' && !(n > x)) ok = false; if (op === '>=' && !(n >= x)) ok = false;
          if (op === '<' && !(n < x)) ok = false; if (op === '<=' && !(n <= x)) ok = false;
        }
        return ok;
      }
      case 'hasItem': { const id = isStr(v) ? v : v.item, n = isStr(v) ? 1 : v.count ?? 1; ok = (g.inventory?.count?.(id) ?? 0) >= n; break; }
      case 'hasMonster': { const all = [...(g.party?.team || []), ...(g.party?.box || [])]; ok = v === true ? all.length > 0 : all.some((m) => m.id === v); break; }
      case 'time': { const h = g.clock?.hours ?? 12; ok = v === 'night' ? h >= 20 || h < 6 : v === 'day' ? h >= 6 && h < 20 : v === 'morning' ? h >= 5 && h < 11 : v === 'evening' ? h >= 17 && h < 21 : true; break; }
      case 'money>=': ok = (g.player?.rupees ?? 0) >= v; break;
      case 'money<': ok = (g.player?.rupees ?? 0) < v; break;
      case 'hurt': ok = !!(g.party?.team || []).some((m) => m.hp < m.maxHp) === !!v; break;
      case 'defeated': ok = !g.enemies.some((e) => !e.dead) && !g.wilds.some((w) => !w.dead); break;
      case 'check': ok = !!g.content?.checks?.[isStr(v) ? v : v.name]?.(g, v.args); break;
      case 'all': ok = [].concat(v).every((x) => test(g, x)); break;
      case 'any': ok = [].concat(v).some((x) => test(g, x)); break;
      case 'not': ok = !test(g, v); break;
      default: if (/^[<>!=]=?$/.test(k)) continue;
    }
    if (!ok) return false;
  }
  return true;
}

/** Dialog-Objekt { speaker, lines, choices, do, if/else } abspielen. */
export async function playDialog(g, d, ctx = {}, depth = 0) {
  if (!d || depth > 24) return;
  if (isStr(d)) d = g.content?.dialogs?.[d] || { lines: [d] };
  if (Array.isArray(d)) d = { lines: d };
  if (d.if != null && !test(g, d.if)) { if (d.else) await playDialog(g, d.else, ctx, depth + 1); return; }
  const lines = [].concat(d.lines || []);
  const choices = (d.choices || []).filter((c) => c.if == null || test(g, c.if));
  if (choices.length) {
    if (lines.length > 1) await g.say(lines.slice(0, -1), { speaker: d.speaker });
    const idx = await g.say({ text: lines[lines.length - 1] || '…', speaker: d.speaker, choices: choices.map((c) => c.label) });
    const c = choices[typeof idx === 'number' && idx >= 0 ? idx : 0];
    if (c?.do) await run(g, c.do, ctx, depth + 1);
    if (c?.goto) await playDialog(g, c.goto, ctx, depth + 1);
  } else if (lines.length) await g.say(lines, { speaker: d.speaker });
  if (d.do) await run(g, d.do, ctx, depth + 1);
  if (d.next) await playDialog(g, d.next, ctx, depth + 1);
}

/** Aktionsliste ausführen. Gibt STOP zurück, wenn `end`/`goto` die Liste beendet hat. */
export async function run(g, list, ctx = {}, depth = 0) {
  if (!list || depth > 24) return;
  for (const a of [].concat(list)) {
    if (a == null) continue;
    try {
      const r = await step(g, a, ctx, depth);
      if (r === STOP) return STOP;
    } catch (e) { console.warn('[content] Aktion fehlgeschlagen', a, e); }
  }
}

async function step(g, a, ctx, depth) {
  if (isStr(a)) { await g.say([a]); return; }
  if (a.if != null && (a.then || a.else)) return run(g, test(g, a.if) ? a.then : a.else, ctx, depth + 1);
  if (a.if != null && !test(g, a.if)) return;
  const [k, v] = Object.entries(a).find(([key]) => key !== 'if') || [];
  switch (k) {
    case 'say': await g.say([].concat(v.lines ?? v.text ?? v), { speaker: a.speaker ?? v.speaker }); break;
    case 'dialog': await playDialog(g, v, ctx, depth + 1); break;
    case 'goto': await playDialog(g, v, ctx, depth + 1); return STOP;
    case 'choice': await playDialog(g, { lines: [v.text], speaker: v.speaker, choices: (v.options || []).map((o) => ({ label: o.label, if: o.if, do: o.do, goto: o.goto })) }, ctx, depth + 1); break;
    case 'setFlag': { const o = isStr(v) ? { name: v } : v; g.setFlag(o.name, o.value ?? true, o.save !== false); break; }
    case 'clearFlag': delete g.flags[v]; g.save?.(); break;
    case 'toggleFlag': g.setFlag(v, !g.flags[v]); break;
    case 'add': { const o = isStr(v) ? { var: v } : v; g.setFlag(o.var, Number(g.flags[o.var] || 0) + (o.value ?? 1)); break; }
    case 'give': { const o = isStr(v) ? { item: v } : v; await g.giveItem(o.item, o.count ?? 1, o.text || [`Du hast ${itemName(g, o.item)}${(o.count ?? 1) > 1 ? ` ×${o.count}` : ''} bekommen!`]); break; }
    case 'take': { const o = isStr(v) ? { item: v } : v; g.inventory?.remove?.(o.item, o.count ?? 1); break; }
    case 'money': g.player.rupees = Math.max(0, Math.min(99999, (g.player.rupees || 0) + Number(v || 0))); g.player.syncInventory?.(); g.play(v >= 0 ? 'rupee' : 'buy'); break;
    case 'heal': g.healParty?.(); g.play('heal'); break;
    case 'battle': await startTrainer(g, isStr(v) ? { trainer: v } : v, ctx, depth); break;
    case 'wildBattle': await wildBattle(g, v, ctx, depth); break;
    case 'giveMonster': g.debug?.giveMonster?.(v.species ?? v, v.level ?? 5); g.play('item_get'); await g.say([`Du hast ${g.species?.[v.species ?? v]?.name ?? v.species ?? v} bekommen!`]); break;
    case 'giveStarter': await g.chooseStarter?.(Array.isArray(v) ? v : undefined); break;
    case 'warp': g.warpTo(v.map, v.spawn ?? 'entry'); return STOP;
    case 'shop': await (g.openShop?.(v) ?? g.farm?.openShop?.(v?.name)); break;
    case 'talk': { const n = g.npcs.find((x) => x.spec?.id === v); if (n) await n.interact(g, g.player); break; }
    case 'music': g.music?.(v); break;
    case 'sound': g.play?.(v); break;
    case 'toast': g.toast(String(v)); break;
    case 'wait': await new Promise((res) => g.after(Number(v) || 0.5, res)); break;
    case 'call': await g.content?.calls?.[isStr(v) ? v : v.name]?.(g, v.args); break;
    case 'end': return STOP;
    default: console.warn('[content] unbekannte Aktion', k);
  }
}

const itemName = (g, id) => g.content?.items?.[id]?.name || g.itemName?.(id) || id;

async function startTrainer(g, o, ctx, depth) {
  const t = g.npcs.find((n) => n.trainer && (n.spec.id === o.trainer || n.flag === o.trainer));
  if (!t) { console.warn('[content] Trainer nicht gefunden', o.trainer); return; }
  await t.interact(g, g.player);
  await run(g, g.flags[t.flag] ? o.win : o.lose, ctx, depth + 1);
}

function wildBattle(g, v, ctx, depth) {
  return new Promise((resolve) => {
    if (!g.party?.lead) { resolve(); return; }
    const ok = g.debug?.battle?.(v.species, v.level ?? 5);
    if (!ok) { resolve(); return; }
    const poll = () => (g.battle.active ? g.after(0.2, poll) : resolve());
    g.after(0.2, poll);
  }).then(() => run(g, v.win, ctx, depth + 1));
}

/** Pro Frame aufgerufen: „enter“-Trigger (Rechteck in Tiles) und „auto“-Trigger (Bedingung wird wahr). */
export function updateEvents(g, events, state) {
  if (!events?.length || g.state !== 'play' || g.trans || g.battle?.active || state.busy) return;
  const p = g.player, tx = p.x / 16, ty = (p.y - 2) / 16;
  for (const e of events) {
    const tr = e.trigger || {};
    if (tr.type !== 'enter' && tr.type !== 'auto') continue;
    if (e.once && g.flags[`event_${g.mapId}_${e.id}`]) continue;
    let hit;
    if (tr.type === 'enter') {
      const r = tr.rect || [0, 0, 0, 0];
      hit = tx >= r[0] && ty >= r[1] && tx < r[0] + r[2] && ty < r[1] + r[3];
      const was = state.inside.has(e.id);
      if (hit) state.inside.add(e.id); else state.inside.delete(e.id);
      if (!hit || was) continue;
    } else hit = true;
    if (e.if != null && !test(g, e.if)) continue;
    fire(g, e, state);
    return;
  }
}

export function fire(g, e, state = {}) {
  if (e.once) g.flags[`event_${g.mapId}_${e.id}`] = true;
  state.busy = true;
  const p = g.player, was = p.state;
  if (p.state === 'normal') p.state = 'frozen';
  return run(g, e.do, { event: e }).finally(() => {
    state.busy = false;
    if (p.state === 'frozen' && !g.trans) p.state = was === 'frozen' ? 'normal' : was;
  });
}
