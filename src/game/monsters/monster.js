// Monster instance: species, level, EP, stats, current HP, up to 4 moves, evolution.
import { species, SPECIES } from './species.js';
import { MOVES } from './moves.js';

let uidSeq = 1;
export const MAX_LEVEL = 50;
export const xpForLevel = (l) => Math.floor(6 * l * l + 10 * l);           // total EP needed to REACH level l (from 1)

export class Monster {
  constructor(id, level = 5, o = {}) {
    this.id = id;
    this.level = Math.max(1, Math.min(MAX_LEVEL, level));
    this.xp = o.xp ?? xpForLevel(this.level);
    this.uid = o.uid || `m${Date.now().toString(36)}${(uidSeq++).toString(36)}`;
    this.nick = o.nick || null;
    this.moves = o.moves ? [...o.moves] : Monster.defaultMoves(id, this.level);
    this.hp = o.hp ?? this.maxHp;
    this.caughtAt = o.caughtAt || null;
  }
  static defaultMoves(id, level) {
    const learn = species(id).learn.filter(([l]) => l <= level).map(([, m]) => m);
    return [...new Set(learn)].slice(-4);
  }
  get sp() { return species(this.id); }
  get name() { return this.nick || this.sp.name; }
  get types() { return this.sp.types; }
  stat(k) {
    const b = this.sp.base[k], L = this.level;
    if (k === 'hp') return Math.floor((b * L) / 20 + L + 12);
    return Math.floor((b * L) / 25 + 5);
  }
  get maxHp() { return this.stat('hp'); }
  get atk() { return this.stat('atk'); }
  get def() { return this.stat('def'); }
  get spd() { return this.stat('spd'); }
  get speed() { return 46 + this.sp.base.spd * 0.55; }               // world px/s in battle
  get fainted() { return this.hp <= 0; }
  get xpToNext() { return this.level >= MAX_LEVEL ? 0 : xpForLevel(this.level + 1) - this.xp; }
  heal() { this.hp = this.maxHp; }
  // Adds EP. Returns [{type:'level', level} | {type:'learn', move, forgot}] events.
  gainXp(n) {
    const ev = [];
    if (this.level >= MAX_LEVEL) return ev;
    this.xp += Math.max(1, Math.round(n));
    while (this.level < MAX_LEVEL && this.xp >= xpForLevel(this.level + 1)) {
      const hpFrac = this.hp / this.maxHp;
      this.level++;
      this.hp = Math.max(1, Math.round(this.maxHp * hpFrac) + 2);
      ev.push({ type: 'level', level: this.level });
      for (const [l, m] of this.sp.learn) {
        if (l !== this.level || this.moves.includes(m)) continue;
        let forgot = null;
        if (this.moves.length >= 4) forgot = this.moves.shift();
        this.moves.push(m);
        ev.push({ type: 'learn', move: m, forgot });
      }
    }
    return ev;
  }
  get canEvolve() { const e = this.sp.evolve; return !!(e && this.level >= e.level && SPECIES[e.to]); }
  evolve() {
    if (!this.canEvolve) return null;
    const from = this.sp.name, frac = this.hp / this.maxHp;
    this.id = this.sp.evolve.to;
    this.hp = Math.max(1, Math.round(this.maxHp * frac));
    // learn what the new form knows at this level, keep 4
    for (const [l, m] of this.sp.learn) if (l <= this.level && !this.moves.includes(m)) { if (this.moves.length >= 4) this.moves.shift(); this.moves.push(m); }
    return { from, to: this.sp.name };
  }
  toJSON() { return { id: this.id, level: this.level, xp: this.xp, hp: this.hp, moves: this.moves, uid: this.uid, nick: this.nick, caughtAt: this.caughtAt }; }
  static fromJSON(o) { return new Monster(o.id, o.level, o); }
}
export const moveInfo = (id) => MOVES[id];
