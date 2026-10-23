// Team (max. 6), box on the farm (unlimited, the first 4 help on the farm) and the dex (seen/caught).
import { Monster } from './monster.js';

export const TEAM_MAX = 6;
export function createParty() {
  const P = {
    team: [], box: [], seen: {}, caught: {},
    get lead() { return P.team.find((m) => !m.fainted) || null; },
    get size() { return P.team.length; },
    get alive() { return P.team.filter((m) => !m.fainted); },
    add(m) {
      P.see(m.id); P.caught[m.id] = (P.caught[m.id] || 0) + 1;
      if (P.team.length < TEAM_MAX) { P.team.push(m); return 'team'; }
      P.box.push(m); return 'box';
    },
    see(id) { P.seen[id] = true; },
    healAll() { for (const m of [...P.team, ...P.box]) m.heal(); },
    swap(i, j) { const t = P.team; if (t[i] && t[j]) [t[i], t[j]] = [t[j], t[i]]; },
    setLead(i) { const t = P.team; if (t[i]) { const [m] = t.splice(i, 1); t.unshift(m); } },
    toBox(i) { if (P.team.length <= 1) return false; const [m] = P.team.splice(i, 1); if (m) P.box.push(m); return !!m; },
    fromBox(i) { if (P.team.length >= TEAM_MAX) return false; const [m] = P.box.splice(i, 1); if (m) P.team.push(m); return !!m; },
    helpers() { return P.box.slice(0, 4); },
    toJSON() { return { team: P.team.map((m) => m.toJSON()), box: P.box.map((m) => m.toJSON()), seen: P.seen, caught: P.caught }; },
    load(o) {
      P.team = (o?.team || []).map(Monster.fromJSON); P.box = (o?.box || []).map(Monster.fromJSON);
      P.seen = { ...(o?.seen || {}) }; P.caught = { ...(o?.caught || {}) };
    },
    reset() { P.team = []; P.box = []; P.seen = {}; P.caught = {}; },
  };
  return P;
}
