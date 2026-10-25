// Real-time battle on the spot (docs/DESIGN.md, MONSTER_FARM_GUIDE §2).
// A ring (arena) is laid on the ground; the player steers the lead monster live (move, 4 attacks with cooldowns,
// dodge roll), the wild/trainer monster runs an AI with visible telegraphs. Capture with a thrown orb (3 shakes).
// Exposed for UI/renderer: g.battle = { active, phase, ally, enemy, arena:{x,y,r}, canCapture, telegraphs, wild,
//   trainer, orb, flee(), result } and camera.battleFocus.
import { makeAnim, playAnim } from '../entities/base.js';
import { move as moveBody, levelUnder, visualZ, cellOf } from '../collision.js';
import { animFrame, rand, clamp, dirFromVec, chance, LEVEL } from '../util.js';
import { MOVES } from './moves.js';
import { effectiveness, effText, TYPE_NAME } from './types.js';
import { captureChance, shakeChance } from './capture.js';

export const ARENA_R = 72;
const BUFFER = 0.15;
// enemy telegraph windup / recovery per attack family (guide §2)
const TELE = { melee: [0.45, 0.4], dash: [0.6, 0.6], projectile: [0.5, 0.35], area: [0.8, 0.7], cone: [0.65, 0.5], buff: [0.4, 0.3] };
const SLOT_KEYS = ['attack', 'action', 'skill3', 'skill4'];

// ---------------------------------------------------------------------------------------------------------------
export class Fighter {
  constructor(g, mon, x, y, side, lvl) {
    this.g = g; this.mon = mon; this.side = side;
    this.kind = 'fighter';
    this.x = x; this.y = y; this.lvl = lvl; this.z = lvl; this.hop = 0;
    const sz = mon.sp.size || 24;
    this.r = Math.max(6, Math.round(sz * 0.32));
    this.foot = { hw: Math.min(7, Math.round(this.r * 0.8)), top: 4, bottom: 1 };
    this.shadow = Math.max(4, Math.round(this.r * 0.9));
    this.anim = makeAnim(g.assets, 'mon_' + mon.id);
    this.animId = mon.id;
    this.dir = side === 'ally' ? 'up' : 'down';
    this.cds = [0, 0, 0, 0];
    this.state = 'idle'; this.t = 0;
    this.buffs = {};
    this.iframes = 0; this.flash = 0; this.kb = null; this.slow = 0;
    this.rollCd = 0; this.aiT = rand(0.8, 1.4); this.strafe = chance(0.5) ? 1 : -1;
    this.hidden = false; this.rage = 0;
    this.noSolids = false;
  }
  get busy() { return ['windup', 'dash', 'recover', 'roll', 'hurt', 'faint'].includes(this.state); }
  buffMult(stat) { const b = this.buffs[stat]; return b && b.t > 0 ? b.mult : 1; }
  hurtbox() { return { x: this.x - this.r, y: this.y - this.r * 2, w: this.r * 2, h: this.r * 2 }; }
  setAnim(action, o) { if (this.anim && this.animId !== this.mon.id) { this.anim = makeAnim(this.g.assets, 'mon_' + this.mon.id); this.animId = this.mon.id; } playAnim(this.anim, action, this.dir, o); }
  draw(ctx, r) {
    if (this.hidden) return;
    const { img, flip } = animFrame(this.anim, `mon_${this.mon.id}_idle_${this.dir}`);
    const tele = this.state === 'windup' && this.side === 'enemy' && Math.floor(this.t * 14) % 2 === 0;
    const blink = this.iframes > 0 && this.state === 'roll' ? 0.55 : 1;
    let alpha = blink;
    if (this.state === 'faint') alpha = Math.max(0, 1 - this.t / 0.9);
    r.sprite(img, this.x, this.y, this.z, { hop: this.hop, flip, flash: this.flash > 0 || tele, alpha });
  }
}

class BattleShot {
  constructor(g, owner, m, ang, speed) {
    this.g = g; this.owner = owner; this.m = m; this.kind = 'bshot';
    this.x = owner.x + Math.cos(ang) * (owner.r + 4); this.y = owner.y + Math.sin(ang) * (owner.r + 4);
    this.lvl = owner.lvl; this.z = owner.z; this.hop = 8;
    this.vx = Math.cos(ang) * speed; this.vy = Math.sin(ang) * speed;
    this.life = (m.range || 140) / speed; this.dead = false; this.shadow = 3; this.t = 0;
  }
  draw(ctx, r) {
    const key = `proj_${this.m.type}`;
    const s = r.assets?.sprites?.[key];
    if (s) r.sprite(Array.isArray(s) ? s[Math.floor(r.time * 10) % s.length] : s, this.x, this.y, this.z, { hop: this.hop });
    else r.sprite(dotSprite(this.m.type), this.x, this.y, this.z, { hop: this.hop });
  }
}
const dots = {};
const DOT_COL = { normal: '#e8e0d0', fire: '#ff8030', water: '#58b0ff', plant: '#70d050', bolt: '#ffe040', stone: '#b09070', wind: '#c0f0ff' };
function dotSprite(type) {
  if (dots[type]) return dots[type];
  const c = document.createElement('canvas'); c.width = c.height = 8;
  const x = c.getContext('2d');
  x.fillStyle = '#201828'; x.fillRect(1, 1, 6, 6); x.fillStyle = DOT_COL[type] || '#fff'; x.fillRect(2, 2, 4, 4); x.fillStyle = '#fff'; x.fillRect(2, 2, 1, 1);
  c.ax = 4; c.ay = 7;
  return (dots[type] = c);
}

class OrbThrow {
  constructor(g, from, to, ballId) {
    this.g = g; this.kind = 'orb'; this.ball = ballId;
    this.fx = from.x; this.fy = from.y; this.tx = to.x; this.ty = to.y;
    this.x = from.x; this.y = from.y; this.lvl = from.lvl; this.z = from.z; this.hop = 10;
    this.t = 0; this.dur = 0.45; this.state = 'fly'; this.shadow = 3; this.shake = 0;
  }
  draw(ctx, r) {
    const sp = r.assets?.sprites;
    let key = 'orb';
    if (this.state === 'shake' && sp?.orb_shake) key = 'orb_shake';
    if (this.state === 'open' && sp?.orb_open) key = 'orb_open';
    let arr = sp?.[key], img;
    if (Array.isArray(arr) && arr.length) img = key === 'orb_shake' ? arr[Math.min(arr.length - 1, this.shake)] : arr[0];
    else img = arr || dotSprite('fire');
    const wob = this.state === 'shake' ? Math.sin(this.t * 30) * 1.5 : 0;
    r.sprite(img, this.x + wob, this.y, this.z, { hop: this.hop });
  }
}

// ---------------------------------------------------------------------------------------------------------------
export function createBattle(g) {
  const B = {
    active: false, phase: 'none', ally: null, enemy: null, arena: null, canCapture: false, telegraphs: [],
    wild: true, trainer: null, wildEntity: null, orb: null, shots: [], result: null, t: 0, enemyTeam: [], boss: false,
    orbCd: 0, msg: null,
  };
  const P = () => g.player;
  const say = (...a) => g.say(...a);
  let pending = null;            // buffered slot press {slot, t}
  let prevFollow = null;

  // ---- start ----------------------------------------------------------------------------------------------
  B.start = (o) => {
    if (B.active) return false;
    const party = g.party;
    const lead = party?.lead;
    if (!lead) return false;
    const p = P();
    const foe = o.wildEntity;
    const ex = foe ? foe.x : o.x ?? p.x, ey = foe ? foe.y : o.y ?? p.y - 40;
    let dx = ex - p.x, dy = ey - p.y; let l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    if (l < 2) { dx = 0; dy = -1; }
    const cx = (p.x + ex) / 2 + dx * 12, cy = (p.y + ey) / 2 + dy * 12;
    Object.assign(B, {
      active: true, phase: 'intro', t: 0, arena: { x: cx, y: cy, r: ARENA_R }, telegraphs: [], shots: [], orb: null, result: null,
      wild: !o.trainer, trainer: o.trainer || null, wildEntity: foe || null, boss: !!o.boss, canCapture: false, orbCd: 0,
      enemyTeam: o.team ? [...o.team] : [], onEnd: o.onEnd || null, noFlee: !!(o.trainer || o.boss), participants: new Set(),
    });
    const lvl = p.lvl;
    B.ally = new Fighter(g, lead, cx - dx * 30, cy - dy * 22, 'ally', lvl);
    B.participants.add(lead);
    const emon = foe ? foe.mon : B.enemyTeam.shift();
    B.enemy = new Fighter(g, emon, cx + dx * 30, cy + dy * 22, 'enemy', lvl);
    if (foe) foe.hidden = true;
    B.ally.hidden = true; B.ally.hop = 18;
    B.enemy.dir = dirFromVec(-dx, -dy);
    party.see(emon.id);
    // trainer (player) steps to the ring's edge
    p.state = 'frozen'; p.carry = null;
    p.dir = dirFromVec(dx, dy);
    playAnim(p.anim, 'idle', p.dir);
    prevFollow = g.camera.follow;
    g.companion && (g.companion.hidden = true);
    g.music(B.boss ? 'boss' : 'battle');
    g.play('battle_start');
    g.spawnFX('monster_summon', B.ally.x, B.ally.y, { z: lvl });
    g.after?.(0.0, () => {});
    return true;
  };

  B.flee = () => {
    if (!B.active || B.phase !== 'fight' || B.noFlee) { if (B.noFlee) g.hint('noflee', 'Aus diesem Kampf gibt es kein Entkommen!'); return false; }
    end('fled');
    g.toast('Du bist entkommen.');
    return true;
  };

  // ---- damage ------------------------------------------------------------------------------------------------
  function hit(att, def, m, mult = 1) {
    if (!def || def.hidden || def.mon.fainted || def.iframes > 0 || def.state === 'faint') return false;
    const A = att.mon, D = def.mon;
    const atk = A.atk * att.buffMult('atk'), dd = D.def * def.buffMult('def');
    const lf = (5 * A.level + 10) / 288;
    const eff = effectiveness(m.type, D.types);
    const stab = A.types.includes(m.type) ? 1.2 : 1;
    const crit = chance(0.06) ? 1.5 : 1;
    const dmg = Math.max(1, Math.round((m.power || 20) * (atk / dd) * lf * eff * stab * crit * rand(0.9, 1.1) * mult));
    D.hp = Math.max(0, D.hp - dmg);
    def.flash = 0.1;
    def.iframes = def.side === 'ally' ? 0.35 : 0.18;
    const kb = 6 + Math.min(10, (m.power || 20) / 7);
    let kx = def.x - att.x, ky = def.y - att.y; const kl = Math.hypot(kx, ky) || 1;
    def.kb = { vx: (kx / kl) * kb / 0.18 * 1.6, vy: (ky / kl) * kb / 0.18 * 1.6, t: 0.18, dur: 0.18 };
    if (def.state === 'windup' && def.side === 'enemy' && (m.power || 0) >= 50) { def.state = 'hurt'; def.t = 0.2; clearTele(def); }
    g.hitstop = Math.max(g.hitstop, crit > 1 ? 0.13 : eff > 1 ? 0.11 : 0.07);
    g.spawnFX('type_' + fxType(m.type), def.x, def.y - def.r, { z: def.z, mode: 'hit', kind: 'hit' });
    g.spawnFX('damage_number', def.x, def.y - def.r * 2, { z: def.z, value: dmg, color: eff > 1 ? '#f8d850' : eff < 1 ? '#9090a0' : '#ffffff', text: eff > 1 ? 'Stark!' : eff < 1 ? 'Schwach…' : undefined });
    if (eff > 1) g.shake(2, 0.08);
    g.play(eff > 1 ? 'hit_strong' : 'enemy_hit');
    if (eff !== 1 && chance(0.6)) g.hint('eff_' + eff, effText(eff), 2);
    if (att.side === 'enemy') att.aiT += 0.5;
    if (D.hp <= 0) faint(def);
    return true;
  }
  const fxType = (t) => ({ fire: 'fire', water: 'water', plant: 'leaf', stone: 'rock', bolt: 'spark', wind: 'wind', normal: 'rock' }[t] || 'rock');

  function faint(f) {
    f.state = 'faint'; f.t = 0; f.kb = null; clearTele(f);
    f.setAnim('faint', { restart: true });
    g.play('faint');
  }

  // ---- move execution ---------------------------------------------------------------------------------------------
  function aimAt(f, target) { return Math.atan2(target.y - f.y, target.x - f.x); }
  function startMove(f, slot, target) {
    const id = f.mon.moves[slot];
    const m = MOVES[id];
    if (!m || f.cds[slot] > 0 || f.busy || f.hidden) return false;
    f.cur = { m, slot, ang: aimAt(f, target) };
    f.dir = dirFromVec(Math.cos(f.cur.ang), Math.sin(f.cur.ang), f.dir);
    let wind = m.windup;
    if (f.side === 'enemy') {
      wind = (TELE[m.form] || TELE.melee)[0];
      if (B.boss && (m.form === 'area' || m.form === 'dash')) wind = 1.15;
      if (f.mon.level - B.ally.mon.level >= 5) wind *= 0.85;
      wind = Math.max(0.35, wind);
      addTele(f, m, wind);
      if (B.boss && wind >= 1) g.shake(1, 0.15);
    }
    f.state = 'windup'; f.t = wind; f.windTotal = wind;
    f.cds[slot] = m.cooldown + (f.side === 'enemy' ? 0 : 0);
    f.setAnim('attack', { restart: true });
    g.play('charge_' + m.form);
    return true;
  }
  function addTele(f, m, wind) {
    const tg = { owner: f, form: m.form, type: m.type, x: f.x, y: f.y, ang: f.cur.ang, r: m.range, angle: m.angle || 0.7, progress: 0, total: wind, color: '#f08030' };
    if (m.form === 'melee') { tg.shape = 'arc'; tg.r = m.range + 6; }
    else if (m.form === 'dash') { tg.shape = 'line'; tg.length = m.range; tg.width = f.r * 2; }
    else if (m.form === 'projectile') { tg.shape = 'arrow'; tg.length = 28; }
    else if (m.form === 'area') { tg.shape = 'circle'; }
    else if (m.form === 'cone') { tg.shape = 'cone'; }
    else tg.shape = 'glow';
    B.telegraphs.push(tg);
  }
  function clearTele(f) { B.telegraphs = B.telegraphs.filter((t) => t.owner !== f); }

  function perform(f, target) {
    const { m, ang } = f.cur;
    clearTele(f);
    const rec = f.side === 'enemy' ? (TELE[m.form] || TELE.melee)[1] : 0.1;
    f.state = 'recover'; f.t = rec;
    const cx = Math.cos(ang), cy = Math.sin(ang);
    switch (m.form) {
      case 'melee': {
        const hx = f.x + cx * (f.r + m.range * 0.5), hy = f.y + cy * (f.r + m.range * 0.5);
        g.spawnFX('slash', f.x, f.y, { z: f.z, dir: f.dir });
        if (Math.hypot(target.x - hx, target.y - hy) < m.range * 0.6 + target.r + 4) hit(f, target, m);
        g.play('swing');
        break;
      }
      case 'dash':
        f.state = 'dash'; f.t = m.range / 230; f.dashV = { x: cx * 230, y: cy * 230 }; f.dashHit = false;
        g.play('dash');
        break;
      case 'projectile':
        B.shots.push(new BattleShot(g, f, m, ang, m.speed || 160));
        g.spawnFX('type_' + fxType(m.type), f.x + cx * f.r, f.y + cy * f.r, { z: f.z, mode: 'projectile', kind: 'projectile' });
        g.play('shoot');
        break;
      case 'area':
        g.spawnFX('type_' + fxType(m.type), f.x, f.y, { z: f.z, mode: 'area', kind: 'area', r: m.range });
        if (Math.hypot(target.x - f.x, target.y - f.y) < m.range + target.r) { if (hit(f, target, m) && m.slow) target.slow = m.slow; }
        if (m.type === 'stone') g.shake(B.boss ? 4 : 2, 0.25);
        g.play('area');
        break;
      case 'cone': {
        const d = Math.hypot(target.x - f.x, target.y - f.y);
        let da = Math.abs(Math.atan2(target.y - f.y, target.x - f.x) - ang); if (da > Math.PI) da = 2 * Math.PI - da;
        g.spawnFX('type_' + fxType(m.type), f.x + cx * m.range * 0.5, f.y + cy * m.range * 0.5, { z: f.z, mode: 'area', kind: 'area', r: m.range * 0.5 });
        if (d < m.range + target.r && da < (m.angle || 0.7) + 0.15) hit(f, target, m);
        g.play('area');
        break;
      }
      case 'buff':
        if (m.heal) { const mx = f.mon.maxHp; f.mon.hp = Math.min(mx, f.mon.hp + Math.round(mx * m.heal)); g.spawnFX('heart_pop', f.x, f.y - f.r, { z: f.z }); }
        if (m.buff) f.buffs[m.buff.stat] = { mult: m.buff.mult, t: m.buff.dur };
        g.spawnFX('sparkle', f.x, f.y - f.r, { z: f.z, count: 5 });
        g.play('buff');
        if (f.side === 'ally') g.toast(`${f.mon.name}: ${m.name}!`);
        break;
    }
  }

  // ---- fighter physics ------------------------------------------------------------------------------------------
  function keepInRing(f) {
    const a = B.arena, dx = f.x - a.x, dy = f.y - a.y, d = Math.hypot(dx, dy), lim = a.r - f.r * 0.5;
    if (d > lim) { f.x = a.x + (dx / d) * lim; f.y = a.y + (dy / d) * lim; }
  }
  function moveF(f, vx, vy, dt) {
    moveBody(g, f, vx * dt, vy * dt, { slide: true });
    keepInRing(f);
    f.z = visualZ(g.world, f.x, f.y, f.lvl);
  }
  function stepFighter(f, other, dt) {
    for (let i = 0; i < 4; i++) if (f.cds[i] > 0) f.cds[i] = Math.max(0, f.cds[i] - dt);
    if (f.rollCd > 0) f.rollCd -= dt;
    if (f.iframes > 0) f.iframes -= dt;
    if (f.flash > 0) f.flash -= dt;
    if (f.slow > 0) f.slow -= dt;
    if (f.rage > 0) f.rage -= dt;
    for (const k in f.buffs) f.buffs[k].t -= dt;
    f.anim?.update(dt);
    if (f.kb && f.kb.t > 0) { const k = f.kb.t / f.kb.dur; moveF(f, f.kb.vx * k, f.kb.vy * k, dt); f.kb.t -= dt; }
    f.t -= dt;
    switch (f.state) {
      case 'windup':
        for (const tg of B.telegraphs) if (tg.owner === f) { tg.progress = 1 - f.t / f.windTotal; tg.x = f.x; tg.y = f.y; }
        if (f.t <= 0) perform(f, other);
        break;
      case 'dash':
        moveF(f, f.dashV.x, f.dashV.y, dt);
        if (!f.dashHit && Math.hypot(other.x - f.x, other.y - f.y) < f.r + other.r + 3) { f.dashHit = true; hit(f, other, f.cur.m); }
        if (f.t <= 0) { f.state = 'recover'; f.t = f.side === 'enemy' ? TELE.dash[1] : 0.12; }
        break;
      case 'recover': case 'hurt':
        if (f.t <= 0) f.state = 'idle';
        break;
      case 'roll':
        moveF(f, f.rollV.x, f.rollV.y, dt);
        f.hop = Math.sin((1 - f.t / 0.25) * Math.PI) * 4;
        if (f.t <= 0) { f.state = 'idle'; f.hop = 0; }
        break;
    }
  }
  const speedOf = (f) => f.mon.speed * (f.slow > 0 ? 0.6 : 1) * (f.rage > 0 ? 1.15 : 1);

  // ---- ally control ----------------------------------------------------------------------------------------------
  function controlAlly(dt) {
    const f = B.ally, e = B.enemy, inp = g.input;
    if (f.hidden || f.state === 'faint') return;
    for (let i = 0; i < 4; i++) if (inp.pressed(SLOT_KEYS[i])) pending = { slot: i, t: BUFFER };
    if (pending) { pending.t -= dt; if (startMove(f, pending.slot, e)) pending = null; else if (pending.t <= 0) pending = null; }
    if (inp.pressed('dodge') && f.rollCd <= 0 && (f.state === 'idle' || f.state === 'recover' || f.state === 'move')) {
      let ax = inp.axis.x, ay = inp.axis.y;
      if (Math.hypot(ax, ay) < 0.2) { ax = f.x - e.x; ay = f.y - e.y; }
      const l = Math.hypot(ax, ay) || 1;
      f.state = 'roll'; f.t = 0.25; f.iframes = 0.25; f.rollCd = 1.0; f.rollV = { x: (ax / l) * 230, y: (ay / l) * 230 };
      clearTele(f); g.play('dodge');
      g.spawnFX('dust', f.x, f.y, { z: f.z });
      return;
    }
    if (inp.pressed('item')) throwOrb();
    if (f.busy) return;
    const ax = inp.axis.x, ay = inp.axis.y, mag = Math.min(1, Math.hypot(ax, ay));
    if (mag > 0.15) {
      f.state = 'move'; f.dir = dirFromVec(ax, ay, f.dir);
      moveF(f, ax * speedOf(f), ay * speedOf(f), dt);
      f.setAnim('walk');
    } else {
      f.state = 'idle';
      f.dir = dirFromVec(e.x - f.x, e.y - f.y, f.dir);
      f.setAnim('idle');
    }
  }

  // ---- enemy AI ------------------------------------------------------------------------------------------------------
  const PREF = { melee: 18, dash: 58, projectile: 86, area: 24, cone: 36, buff: 70 };
  function enemyAI(dt) {
    const f = B.enemy, a = B.ally;
    if (f.hidden || f.state === 'faint' || a.hidden) return;
    if (f.busy) return;
    if (!f.plan || f.plan.done) {
      const ready = f.mon.moves.map((id, i) => ({ id, i, m: MOVES[id] })).filter((o) => o.m && f.cds[o.i] <= 0);
      const pick = ready.length ? ready[Math.floor(Math.random() * ready.length)] : null;
      f.plan = pick ? { ...pick, done: false } : null;
    }
    const d = Math.hypot(a.x - f.x, a.y - f.y);
    const want = f.plan ? PREF[f.plan.m.form] ?? 40 : 50;
    f.aiT -= dt;
    const inRange = f.plan && (f.plan.m.form === 'buff' || d < (f.plan.m.range || 20) + a.r + (f.plan.m.form === 'melee' ? 6 : 0));
    if (f.plan && f.aiT <= 0 && inRange) {
      if (f.plan.m.form === 'buff' && f.plan.m.heal && f.mon.hp > f.mon.maxHp * 0.7) { f.plan.done = true; return; }
      if (startMove(f, f.plan.i, a)) { f.plan.done = true; f.aiT = rand(1.6, 3.0) * (B.boss ? 0.8 : 1); return; }
    }
    // position: approach/retreat to the preferred distance, strafe around
    let vx = 0, vy = 0;
    const ux = (a.x - f.x) / (d || 1), uy = (a.y - f.y) / (d || 1);
    if (d > want + 8) { vx += ux; vy += uy; } else if (d < want - 8) { vx -= ux; vy -= uy; }
    if (Math.random() < dt * 0.4) f.strafe *= -1;
    vx += -uy * f.strafe * 0.6; vy += ux * f.strafe * 0.6;
    const l = Math.hypot(vx, vy);
    const sp = speedOf(f) * (f.mon.hp < f.mon.maxHp * 0.5 && B.wild ? 0.8 : 1) * 0.75;
    if (l > 0.1) { f.state = 'move'; moveF(f, (vx / l) * sp, (vy / l) * sp, dt); f.dir = dirFromVec(ux, uy, f.dir); f.setAnim('walk'); }
    else { f.state = 'idle'; f.setAnim('idle'); }
    // dodge an incoming projectile now and then
    if (f.rollCd <= 0 && chance(dt * 0.6) && B.shots.some((s) => s.owner === a && Math.hypot(s.x - f.x, s.y - f.y) < 40)) {
      f.state = 'roll'; f.t = 0.25; f.iframes = 0.2; f.rollCd = 2.5; f.rollV = { x: -uy * f.strafe * 200, y: ux * f.strafe * 200 };
    }
  }

  // ---- capture --------------------------------------------------------------------------------------------------------
  function orbItem() {
    const inv = g.inventory;
    if (!inv) return (P().orbs || 0) > 0 ? 'orb' : null;
    for (const id of ['orb_master', 'orb_good', 'orb']) if (id === 'orb' && inv.count(id) > 0) return id;
    const a = inv.active?.id;
    if (a && /^orb/.test(a) && inv.count(a) > 0) return a;
    return ['orb', 'orb_good', 'orb_master'].find((id) => inv.count(id) > 0) || null;
  }
  function throwOrb() {
    if (!B.wild) { g.hint('trainerorb', 'Trainer-Monster kann man nicht fangen!'); return; }
    if (B.orb || B.orbCd > 0 || B.phase !== 'fight' || B.enemy.hidden) return;
    const id = orbItem();
    if (!id) { g.hint('noorb', 'Du hast keine Driftkugeln mehr!'); g.play('error'); return; }
    const e = B.enemy;
    const lead = 0.25;          // aim where the monster will be
    const ev = e.state === 'move' ? { x: e.x + (e.x - (e.px ?? e.x)) * 60 * lead, y: e.y + (e.y - (e.py ?? e.y)) * 60 * lead } : { x: e.x, y: e.y };
    B.orb = new OrbThrow(g, P(), ev, id);
    g.play('throw');
    g.spawnFX('capture_throw', P().x, P().y, { z: P().z });
  }
  function updateOrb(dt) {
    const o = B.orb, e = B.enemy;
    o.t += dt;
    if (o.state === 'fly') {
      const k = Math.min(1, o.t / o.dur);
      o.x = o.fx + (o.tx - o.fx) * k; o.y = o.fy + (o.ty - o.fy) * k;
      o.hop = 10 + Math.sin(k * Math.PI) * 30 - k * 4;
      if (k >= 1) {
        if (!e.hidden && e.iframes <= 0.05 && e.state !== 'roll' && Math.hypot(e.x - o.x, e.y - o.y) < e.r + 10) {
          // hit: consume, absorb
          useOrb(o.ball);
          o.state = 'open'; o.t = 0; o.x = e.x; o.y = e.y; o.hop = 6;
          B.phase = 'capture'; clearTele(e); e.hidden = true; e.state = 'idle';
          B.captureP = captureChance(e.mon, B.ally.mon, o.ball);
          g.spawnFX('sparkle', e.x, e.y - e.r, { z: e.z, count: 6 });
          g.play('capture_absorb');
        } else {
          o.state = 'back'; o.t = 0; o.bx = o.x; o.by = o.y;
          g.hint('miss', 'Daneben!', 1);
        }
      }
    } else if (o.state === 'back') {
      const k = Math.min(1, o.t / 0.35);
      o.x = o.bx + (P().x - o.bx) * k; o.y = o.by + (P().y - o.by) * k; o.hop = 6 + Math.sin(k * Math.PI) * 12;
      if (k >= 1) { B.orb = null; B.orbCd = 1.5; }
    } else if (o.state === 'open') {
      o.hop = Math.max(0, 6 - o.t * 30);
      if (o.t > 0.35) { o.state = 'shake'; o.t = 0; o.shake = 0; }
    } else if (o.state === 'shake') {
      if (o.t >= 0.5) {
        o.t = 0;
        g.play('capture_shake'); g.spawnFX('capture_shake', o.x, o.y, { z: o.z });
        if (Math.random() > shakeChance(B.captureP)) return breakFree();
        o.shake++;
        if (o.shake >= 3) return caught();
      }
    }
  }
  function useOrb(id) {
    if (g.inventory) g.inventory.remove(id, 1); else P().orbs = Math.max(0, (P().orbs || 0) - 1);
  }
  function breakFree() {
    const o = B.orb, e = B.enemy;
    B.orb = null; B.orbCd = 0.8;
    e.hidden = false; e.x = o.x; e.y = o.y; e.rage = 0.8; e.aiT = 0; e.iframes = 0.3;
    B.phase = 'fight';
    g.spawnFX('capture_break', e.x, e.y - e.r, { z: e.z });
    g.play('capture_break');
    g.toast(['Oh nein! Es hat sich befreit!', 'Fast! Es ist wieder frei!', 'Argh! So knapp!'][Math.min(2, o.shake)]);
  }
  function caught() {
    const e = B.enemy, o = B.orb;
    B.phase = 'caught'; B.t = 0;
    g.spawnFX('capture_success', o.x, o.y, { z: o.z });
    g.play('capture_success');
    const mon = e.mon;
    mon.caughtAt = g.mapId;
    const where = g.party.add(mon);
    awardXp(mon, 1);          // catching is not punished: full EP
    B.result = 'caught';
    say([`${mon.name} wurde gefangen!`, where === 'box' ? `Dein Team ist voll – ${mon.name} kommt in die Box auf dem Hof.` : `${mon.name} ist jetzt in deinem Team.`]);
    if (g.party.caught[mon.id] === 1) g.toast(`Neuer Lexikon-Eintrag: ${mon.sp.name}`);
  }

  // ---- XP / switching / end -----------------------------------------------------------------------------------------
  const evoQueue = [];
  function awardXp(beaten, mult = 1) {
    const base = Math.round(beaten.sp.xp * beaten.level / 5 * (B.trainer ? 1.5 : 1) * mult);
    for (const m of g.party.team) {
      if (m.fainted || m === beaten) continue;
      const share = B.participants.has(m) ? 1 : 0.5;
      const ev = m.gainXp(base * share);
      for (const x of ev) {
        if (x.type === 'level') { g.toast(`${m.name} erreicht Lv. ${x.level}!`); g.spawnFX('level_up', B.ally?.mon === m ? B.ally.x : P().x, B.ally?.mon === m ? B.ally.y : P().y, { z: P().z }); g.play('level_up'); }
        if (x.type === 'learn') g.toast(x.forgot ? `${m.name} vergisst ${MOVES[x.forgot]?.name} und lernt ${MOVES[x.move]?.name}!` : `${m.name} lernt ${MOVES[x.move]?.name}!`);
      }
      if (m.canEvolve && !evoQueue.includes(m)) evoQueue.push(m);
    }
  }
  function sendNextAlly() {
    const next = g.party.team.find((m) => !m.fainted);
    if (!next) { B.phase = 'lost'; B.t = 0; g.play('defeat'); return; }
    const a = B.ally;
    const nf = new Fighter(g, next, a.x, a.y, 'ally', a.lvl);
    nf.hidden = true; nf.hop = 18;
    B.ally = nf; B.participants.add(next);
    B.phase = 'switch'; B.t = 0;
    g.toast(`Los, ${next.name}!`);
  }
  function sendNextEnemy() {
    const next = B.enemyTeam.shift();
    if (!next) return false;
    const e = B.enemy;
    B.enemy = new Fighter(g, next, e.x, e.y, 'enemy', e.lvl);
    B.enemy.hidden = true; B.enemy.hop = 18;
    g.party.see(next.id);
    B.phase = 'enemySwitch'; B.t = 0;
    g.toast(`${B.trainer?.spec?.name || 'Ranger'} schickt ${next.name}!`);
    return true;
  }
  function end(result) {
    const p = P();
    const wild = B.wildEntity;
    B.result = result;
    B.active = false; B.phase = 'none'; B.telegraphs = []; B.shots = []; B.orb = null;
    g.camera.battleFocus = null;
    if (prevFollow) g.camera.follow = prevFollow;
    g.camera.follow = p;
    p.state = 'normal';
    if (wild) {
      if (result === 'won' || result === 'caught') wild.dead = true;
      else { wild.hidden = false; wild.mon.hp = Math.max(wild.mon.hp, 1); wild.calm = 4; wild.x = B.enemy.x; wild.y = B.enemy.y; }
    }
    if (g.companion) { g.companion.hidden = false; g.companion.x = B.ally?.x ?? p.x; g.companion.y = B.ally?.y ?? p.y; }
    g.battleCooldown = 2.5;
    g.music(g.mapDef?.music || 'overworld');
    const cb = B.onEnd; B.onEnd = null;
    const evo = evoQueue.splice(0);
    (async () => {
      if (result === 'lost') await g.onBlackout?.();
      else if (cb) await cb(result);
      for (const m of evo) await g.evolveMonster?.(m);
      g.save?.();
    })();
  }

  // ---- main update ---------------------------------------------------------------------------------------------------
  B.update = (dt) => {
    if (!B.active) return;
    B.t += dt;
    if (B.orbCd > 0) B.orbCd -= dt;
    const a = B.ally, e = B.enemy;
    if (e) { e.px = e.x; e.py = e.y; }
    switch (B.phase) {
      case 'intro':
        a.hop = Math.max(0, 18 - B.t * 40);
        if (B.t > 0.35 && a.hidden) { a.hidden = false; a.setAnim('idle'); g.play('summon'); }
        if (B.t > 0.9) { B.phase = 'fight'; a.hop = 0; if (B.boss) g.toast(`${e.mon.name} erwacht!`); }
        break;
      case 'switch':
        if (B.t > 0.3 && a.hidden) { a.hidden = false; g.spawnFX('monster_summon', a.x, a.y, { z: a.z }); g.play('summon'); }
        a.hop = Math.max(0, 18 - B.t * 40);
        if (B.t > 0.8) B.phase = 'fight';
        break;
      case 'enemySwitch':
        if (B.t > 0.3 && e.hidden) { e.hidden = false; g.spawnFX('monster_summon', e.x, e.y, { z: e.z }); }
        e.hop = Math.max(0, 18 - B.t * 40);
        if (B.t > 0.8) B.phase = 'fight';
        break;
      case 'fight':
        controlAlly(dt);
        enemyAI(dt);
        break;
      case 'capture':
        break;
      case 'won': case 'lost': case 'caught':
        if (B.t > 1.3) end(B.phase === 'won' ? 'won' : B.phase);
        break;
    }
    if (!B.active) return;
    if (B.phase !== 'capture') { stepFighter(a, e, dt); stepFighter(e, a, dt); }
    else { a.anim?.update(dt); }
    if (B.orb) updateOrb(dt);
    // shots
    for (const s of B.shots) {
      s.t += dt; s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      const tgt = s.owner === a ? e : a;
      if (!tgt.hidden && Math.hypot(tgt.x - s.x, tgt.y - s.y) < tgt.r + 4) { hit(s.owner, tgt, s.m); s.dead = true; }
      const w = g.world;
      const tx = cellOf(s.x), ty = cellOf(s.y - 2);
      if (w.heightAt(tx, ty) > s.lvl || (w.def(tx, ty).solid && !w.def(tx, ty).water) || Math.hypot(s.x - B.arena.x, s.y - B.arena.y) > B.arena.r + 24) s.dead = true;
      if (s.life <= 0) s.dead = true;
      if (s.dead) g.spawnFX('type_' + fxType(s.m.type), s.x, s.y, { z: s.z, mode: 'hit', kind: 'hit', small: true });
    }
    B.shots = B.shots.filter((s) => !s.dead);
    // faint resolution
    if (B.phase === 'fight' || B.phase === 'switch' || B.phase === 'enemySwitch') {
      if (a.state === 'faint' && a.t < -0.9) { a.hidden = true; g.toast(`${a.mon.name} ist erschöpft!`); sendNextAlly(); }
      if (e.state === 'faint' && e.t < -0.9 && !e.hidden) {
        e.hidden = true;
        awardXp(e.mon);
        if (B.trainer && sendNextEnemy()) { /* next trainer monster */ }
        else { B.phase = 'won'; B.t = 0; g.play('victory'); g.toast(B.wild ? `Das wilde ${e.mon.name} wurde besiegt!` : 'Du hast gewonnen!'); }
      }
    }
    B.canCapture = B.wild && B.phase === 'fight' && !e.hidden && e.mon.hp > 0 && e.mon.hp <= e.mon.maxHp * 0.5;
    if (B.canCapture && !B._capHint) { B._capHint = true; g.hint('capture', 'Fangen! Drücke Q/L, um eine Driftkugel zu werfen.', 4); }
    // camera between both monsters, slightly closer
    const fx = (a.x + e.x) / 2, fy = (a.y + e.y) / 2;
    const focus = B.focus || (B.focus = { x: fx, y: fy, z: a.lvl });
    focus.x += (fx - focus.x) * Math.min(1, dt * 6); focus.y += (fy - focus.y) * Math.min(1, dt * 6); focus.z = a.lvl;
    g.camera.battleFocus = { x: focus.x, y: focus.y - a.lvl * LEVEL, z: a.lvl };
    g.camera.follow = focus;
  };

  B.drawables = () => {
    if (!B.active) return [];
    const out = [];
    if (B.ally) out.push(B.ally);
    if (B.enemy) out.push(B.enemy);
    out.push(...B.shots);
    if (B.orb) out.push(B.orb);
    return out;
  };
  // test/QA helpers
  B.debugWin = () => { if (B.active && B.enemy) { B.enemy.mon.hp = 0; faint(B.enemy); } };
  B.debugWeaken = (frac = 0.2) => { if (B.active && B.enemy) B.enemy.mon.hp = Math.max(1, Math.round(B.enemy.mon.maxHp * frac)); };
  return B;
}
