// Spiellogik: Spieler, Tragen (allein / zu zweit), Kollisionen, Schaden, Saugroboter, Wertung.
import * as THREE from 'three';
import { ITEMS, ITEM_TYPES, PLAYERS, TUNING, CARGO, ROUND_TIME, ROOMBA_START, TIME_BONUS_PER_SEC } from './config.js';
import { circleVsBox, distToBox, resolveCircle, insideRect, groundHeight, angleDiff, damp } from './physics.js';
import { buildFurniture } from './furniture.js';
import { createCharacter, MOOD } from './characters.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KEYNAME = { Space: 'Leertaste', Enter: 'Enter' };

export class Game {
  constructor({ scene, fx, audio, hud, input, world }) {
    Object.assign(this, { scene, fx, audio, hud, input, world });
    this.timeU = { value: 0 };
    this.players = PLAYERS.map((def, i) => this.makePlayer(def, i));
    this.roomba = this.makeRoomba();
    this.items = [];
    this.reset();
  }

  // -------------------------------------------------------------------------
  // Aufbau
  // -------------------------------------------------------------------------
  makePlayer(def, i) {
    const model = createCharacter(def, i);
    this.scene.add(model.root);
    return { def, i, model, x: def.x, z: def.z, vx: 0, vz: 0, face: Math.PI, carry: null, side: 0,
      stun: 0, kx: 0, kz: 0, moodT: 0, mood: MOOD.happy, stepT: 0, speed: 0, candidate: null, needT: 0 };
  }

  makeRoomba() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.12, 28),
      new THREE.MeshPhysicalMaterial({ color: 0x2b2d42, roughness: 0.3, clearcoat: 1 }));
    body.position.y = 0.09; body.castShadow = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 24),
      new THREE.MeshStandardMaterial({ color: 0x8d99ae, metalness: 0.6, roughness: 0.3 }));
    top.position.y = 0.16;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 2 }));
    eye.position.set(0, 0.15, 0.27);
    const bumper = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 6, 28, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x555b6e }));
    bumper.rotation.x = Math.PI / 2; bumper.position.y = 0.08;
    g.add(body, top, eye, bumper);
    this.scene.add(g);
    return { g, eye, x: 0, z: 0, dir: 0, turn: 0, beepT: 3, r: 0.36 };
  }

  makeItem(spec, id) {
    const def = ITEM_TYPES[spec.type];
    const uniforms = {
      uDamage: { value: 0 }, uFlash: { value: 0 }, uSelect: { value: 0 },
      uSelColor: { value: new THREE.Color(1, 1, 1) }, uTime: this.timeU,
    };
    const { group, colors } = buildFurniture(spec.type, def, uniforms);
    const root = new THREE.Group();
    const tilt = new THREE.Group();
    root.add(tilt);
    tilt.add(group);
    this.scene.add(root);
    const r = (Math.min(def.len, def.dep) / 2) * 0.98;
    const n = def.len - 2 * r < 0.05 ? 1 : Math.ceil((def.len - 2 * r) / (r * 1.2)) + 1;
    const circles = [];
    for (let k = 0; k < n; k++) circles.push(n === 1 ? 0 : -(def.len / 2 - r) + (k * (def.len - 2 * r)) / (n - 1));
    return {
      id, type: spec.type, def, uniforms, colors, root, tilt,
      x: spec.x, z: spec.z, a: spec.a, y: 0, lift: 0, vy: 0, liftTarget: 0,
      hp: 100, state: 'floor', carriers: [], r, circles, prevCircles: [],
      contactCD: 0, lastContact: 9, flash: 0, wobble: 0, wobbleT: 0, tension: 0,
      highlight: false, highlightColor: '#fff', delivered: false, vx: 0, vz: 0, forced: false,
      box: { cx: spec.x, cz: spec.z, hx: def.len / 2, hz: def.dep / 2, a: spec.a },
    };
  }

  reset() {
    for (const it of this.items) this.scene.remove(it.root);
    this.items = ITEMS.map((s, i) => this.makeItem(s, i));
    this.totalValue = this.items.reduce((s, it) => s + it.def.value, 0);
    PLAYERS.forEach((def, i) => {
      const p = this.players[i];
      Object.assign(p, { x: def.x, z: def.z, vx: 0, vz: 0, face: Math.PI, carry: null, side: 0, stun: 0, kx: 0, kz: 0, moodT: 0 });
    });
    Object.assign(this.roomba, { x: ROOMBA_START.x, z: ROOMBA_START.z, dir: Math.PI, turn: 0 });
    this.time = ROUND_TIME;
    this.broken = 0;
    this.score = 0;
    this.delivered = 0;
    this.finished = null;
    this.lastTick = 99;
    this.hud.clearLabels();
    this.syncVisuals(0, 0);
  }

  // -------------------------------------------------------------------------
  // Hilfsfunktionen
  // -------------------------------------------------------------------------
  floorObstacles(exclude) {
    const out = this.world.obstacles.slice();
    for (const it of this.items) {
      if (it === exclude || it.state === 'broken' || it.state === 'carried') continue;
      it.box.cx = it.x; it.box.cz = it.z; it.box.a = it.a;
      out.push(it.box);
    }
    return out;
  }

  circleWorld(it, k) {
    const off = it.circles[k];
    return { x: it.x + Math.cos(it.a) * off, z: it.z + Math.sin(it.a) * off };
  }

  storeCircles(it) {
    it.prevCircles = it.circles.map((_, k) => this.circleWorld(it, k));
  }

  // Möbel aus Hindernissen schieben; meldet stärksten Aufprall
  resolveItem(it, obs, dt) {
    let cx = 0, cz = 0, impact = 0, point = null, nx = 0, nz = 0;
    for (let iter = 0; iter < 3; iter++) {
      let any = false;
      for (let k = 0; k < it.circles.length; k++) {
        const w = this.circleWorld(it, k);
        for (const b of obs) {
          const h = circleVsBox(w.x, w.z, it.r, b);
          if (!h) continue;
          any = true;
          if (iter === 0 && it.prevCircles[k] && dt > 0) {
            const pv = it.prevCircles[k];
            const imp = -(((w.x - pv.x) / dt) * h.nx + ((w.z - pv.z) / dt) * h.nz);
            if (imp > impact) { impact = imp; point = { x: w.x - h.nx * it.r, z: w.z - h.nz * it.r }; }
          }
          it.x += h.nx * h.depth; it.z += h.nz * h.depth;
          w.x += h.nx * h.depth; w.z += h.nz * h.depth;
          cx += h.nx * h.depth; cz += h.nz * h.depth;
        }
      }
      if (!any) break;
    }
    const l = Math.hypot(cx, cz);
    if (l > 1e-6) { nx = cx / l; nz = cz / l; }
    return { x: cx, z: cz, nx, nz, impact, point, hit: l > 1e-6 };
  }

  handleImpact(it, res, dt) {
    if (!res.hit) { it.lastContact += dt; return; }
    const fresh = it.lastContact > 0.12;
    it.lastContact = 0;
    if (it.contactCD > 0) return;
    if ((fresh && res.impact > TUNING.impactThreshold) || res.impact > TUNING.impactThreshold * 2.2) {
      const dmg = (res.impact - TUNING.impactThreshold) * TUNING.impactDamage * it.def.fragility;
      this.damageItem(it, dmg, res.point);
      it.contactCD = TUNING.impactCooldown;
    } else if (fresh && res.impact > 0.6) {
      this.audio.play('bump', 0.3);
      it.wobble = Math.max(it.wobble, 0.05);
    }
  }

  damageItem(it, amount, point, quiet = false) {
    if (it.state === 'broken' || amount <= 0) return;
    it.hp -= amount;
    if (quiet) {
      if (it.hp <= 0) this.breakItem(it);
      return;
    }
    it.flash = 1;
    it.wobble = Math.min(0.35, it.wobble + 0.04 + amount * 0.01);
    const p = point || { x: it.x, z: it.z };
    const y = it.y + it.def.h * 0.5;
    this.fx.shaker.add(clamp(amount / 55, 0.12, 0.5));
    this.fx.post.pulseDanger(clamp(amount / 45, 0.15, 0.8));
    this.fx.particles.sparks(p.x, y, p.z, 0xfff1a8, 8 + Math.round(amount / 3));
    this.fx.particles.dust(p.x, y, p.z, 4, 0xe0d8c8, 1.2);
    this.audio.play('bump', clamp(amount / 25, 0.4, 1.2));
    for (const c of it.carriers) { c.p.mood = MOOD.shock; c.p.moodT = 0.7; c.p.model.pop(0.6); }
    if (amount >= 4 && it.hp > 0) this.hud.popup(it.x, y + 0.6, it.z, `-${Math.round(amount)}%`, 'dmg');
    if (it.hp <= 0) this.breakItem(it);
  }

  breakItem(it) {
    it.hp = 0;
    this.releaseAll(it);
    it.state = 'broken';
    this.broken++;
    this.scene.remove(it.root);
    const floor = groundHeight(it.x, it.z);
    this.fx.particles.explode(it.x, floor + it.lift + it.def.h * 0.4, it.z, it.colors, floor, 40 + Math.round(it.def.len * it.def.dep * 40));
    this.fx.shaker.add(0.75);
    this.fx.post.pulseFlash(0.18);
    this.fx.post.pulseDanger(1.0);
    this.audio.play('crash');
    this.hud.popup(it.x, floor + 1.4, it.z, `KAPUTT! −${it.def.value} €`, 'broken');
    this.hud.message(`💥 ${it.def.label} ist hin!`, 1.4, 'bad');
    for (const p of this.players) {
      if (Math.hypot(p.x - it.x, p.z - it.z) < 4) { p.mood = MOOD.shock; p.moodT = 1.6; p.model.pop(1); }
    }
  }

  releaseAll(it) {
    for (const c of it.carriers) { c.p.carry = null; c.p.side = 0; }
    it.carriers = [];
    it.tension = 0;
  }

  // sanft absetzen (gentle) oder fallen lassen (forced)
  putDown(it, forced = false) {
    this.releaseAll(it);
    const obs = this.floorObstacles(it);
    it.prevCircles = [];
    this.resolveItem(it, obs, 0);
    it.state = 'falling';
    it.forced = forced;
    it.vy = forced ? 1.5 : 0;
    this.audio.play('drop');
  }

  // -------------------------------------------------------------------------
  // Greifen
  // -------------------------------------------------------------------------
  findCandidate(p) {
    const fx = p.x + Math.cos(p.face) * 0.25, fz = p.z + Math.sin(p.face) * 0.25;
    let best = null, bestD = TUNING.reach;
    for (const it of this.items) {
      if (it.state !== 'floor') continue;
      if (!it.def.heavy && it.carriers.length) continue;
      if (it.def.heavy && it.carriers.length >= 2) continue;
      it.box.cx = it.x; it.box.cz = it.z; it.box.a = it.a;
      const d = Math.min(distToBox(fx, fz, it.box), distToBox(p.x, p.z, it.box) + 0.1);
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  handleGrab(p) {
    if (p.carry) {
      const it = p.carry;
      if (it.def.heavy && it.carriers.length < 2) {
        // nur festgehalten, noch nicht angehoben -> loslassen
        it.carriers = it.carriers.filter((c) => c.p !== p);
        p.carry = null; p.side = 0;
        return;
      }
      this.putDown(it, false);
      p.model.pop(0.5);
      return;
    }
    const it = p.candidate;
    if (!it) return;
    p.model.pop(0.7);
    if (!it.def.heavy) {
      it.carriers = [{ p, side: 0 }];
      it.state = 'carried';
      p.carry = it;
      p.face = Math.atan2(it.z - p.z, it.x - p.x);
      it.prevCircles = [];
      this.audio.play('pickup');
      this.fx.particles.dust(it.x, it.y, it.z, 4);
      return;
    }
    // schwer: an das nähere freie Ende
    const lx = (p.x - it.x) * Math.cos(it.a) + (p.z - it.z) * Math.sin(it.a);
    let side = lx >= 0 ? 1 : -1;
    if (it.carriers.some((c) => c.side === side)) side = -side;
    it.carriers.push({ p, side });
    p.carry = it;
    p.side = side;
    if (it.carriers.length === 2) {
      it.state = 'carried';
      it.prevCircles = [];
      this.audio.play('pickup');
      this.hud.message('Hau ruck! 💪', 0.9);
      this.fx.particles.dust(it.x, it.y, it.z, 8, 0xe8e0d0, 1.4);
      for (const c of it.carriers) c.p.model.pop(1);
    } else {
      this.audio.play('need');
      this.hud.popup(it.x, it.y + it.def.h + 0.8, it.z, 'Zu schwer! Hilfe! 👥', 'need');
    }
  }

  handleOf(it, side) {
    const hd = it.def.len / 2 + TUNING.handleGap;
    return { x: it.x + Math.cos(it.a) * side * hd, z: it.z + Math.sin(it.a) * side * hd };
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  update(dt, t) {
    this.timeU.value = t;
    this.time -= dt;
    if (this.time <= 10 && Math.ceil(this.time) !== this.lastTick && this.time > 0) {
      this.lastTick = Math.ceil(this.time);
      this.audio.play('tick');
    }

    // 1) Eingabe -> Geschwindigkeit
    for (const p of this.players) {
      p.ox = p.x; p.oz = p.z;
      const m = p.stun > 0 ? { x: 0, z: 0 } : this.input.move(p.i, p.def.keys);
      const it = p.carry;
      const heavyLifted = it && it.def.heavy && it.carriers.length === 2;
      const sp = heavyLifted ? TUNING.speedHeavy : it ? TUNING.speedLight : TUNING.speedFree;
      const k = damp(TUNING.accel, dt);
      p.vx += (m.x * sp - p.vx) * k;
      p.vz += (m.z * sp - p.vz) * k;
      p.stun = Math.max(0, p.stun - dt);
      p.kx *= Math.exp(-dt * 6); p.kz *= Math.exp(-dt * 6);
      p.x += (p.vx + p.kx) * dt;
      p.z += (p.vz + p.kz) * dt;
      if (Math.hypot(m.x, m.z) > 0.1 && !heavyLifted) {
        const target = Math.atan2(m.z, m.x);
        const rate = it ? 7 : TUNING.turnRate;
        p.face += clamp(angleDiff(p.face, target), -rate * dt, rate * dt);
      }
      if (!p.carry) p.candidate = this.findCandidate(p);
      else p.candidate = null;
      if (this.input.grab(p.i, p.def.keys)) this.handleGrab(p);
    }

    // 2) Getragene Möbel
    for (const it of this.items) {
      it.contactCD = Math.max(0, it.contactCD - dt);
      if (it.state !== 'carried' && !(it.def.heavy && it.carriers.length === 1)) continue;
      if (it.def.heavy && it.carriers.length === 1) {
        // Einer hält fest und wartet – an den Griff gebunden
        const c = it.carriers[0];
        const h = this.handleOf(it, c.side);
        const dx = c.p.x - h.x, dz = c.p.z - h.z, d = Math.hypot(dx, dz);
        if (d > 0.45) { c.p.x = h.x + (dx / d) * 0.45; c.p.z = h.z + (dz / d) * 0.45; }
        c.p.face = Math.atan2(it.z - c.p.z, it.x - c.p.x);
        c.p.needT -= dt;
        if (c.p.needT < 0) { c.p.needT = 2.2; this.audio.play('need'); }
        continue;
      }
      if (it.def.heavy) this.updateHeavy(it, dt);
      else this.updateLight(it, dt);
      it.lift += (it.liftTarget - it.lift) * damp(10, dt);
    }

    // 3) Spieler gegen Welt + gegeneinander
    const floorObs = this.floorObstacles(null);
    for (const p of this.players) {
      const c = resolveCircle(p, TUNING.playerRadius, floorObs);
      const l = Math.hypot(c.x, c.z);
      if (l > 1e-5) {
        const nx = c.x / l, nz = c.z / l, vn = p.vx * nx + p.vz * nz;
        if (vn < 0) { p.vx -= vn * nx; p.vz -= vn * nz; }
      }
    }
    const [A, B] = this.players;
    const sameHeavy = A.carry && A.carry === B.carry;
    if (!sameHeavy) {
      const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), min = TUNING.playerRadius * 2;
      if (d < min && d > 1e-4) {
        const push = (min - d) / 2;
        A.x -= (dx / d) * push; A.z -= (dz / d) * push;
        B.x += (dx / d) * push; B.z += (dz / d) * push;
      }
    }
    // Leichte Möbel nach der Spielerkorrektur wieder in die Hände
    for (const p of this.players) {
      if (p.carry && !p.carry.def.heavy) { this.poseLight(p.carry, p); this.storeCircles(p.carry); }
      p.speed = Math.hypot(p.x - p.ox, p.z - p.oz) / Math.max(dt, 1e-4);
    }

    // 4) Fallende / abgesetzte Möbel
    for (const it of this.items) {
      if (it.state !== 'falling') continue;
      if (it.forced) {
        it.vy -= 22 * dt;
        it.lift += it.vy * dt;
      } else {
        it.lift += (0 - it.lift) * damp(14, dt) - 0.4 * dt;
      }
      if (it.lift <= 0) {
        const hard = it.forced;
        it.lift = 0; it.vy = 0; it.state = 'floor'; it.forced = false;
        it.wobble = Math.max(it.wobble, hard ? 0.25 : 0.08);
        const y = groundHeight(it.x, it.z);
        this.fx.particles.dust(it.x, y, it.z, hard ? 10 : 5, 0xe8e0d0, hard ? 1.6 : 1);
        if (hard) this.damageItem(it, TUNING.dropDamage * it.def.fragility, null);
        else this.audio.play('bump', 0.3);
        if (it.state === 'floor' && insideRect(it.x, it.z, CARGO) && !it.delivered) {
          it.delivered = true;
          const val = Math.round((it.def.value * it.hp) / 100);
          this.hud.popup(it.x, y + 1.3, it.z, `+${val} €`, 'gain');
          this.fx.particles.celebrate(it.x, y + it.def.h, it.z);
          this.audio.play('deliver');
          this.fx.shaker.add(0.12);
          for (const p of this.players) if (Math.hypot(p.x - it.x, p.z - it.z) < 4) { p.mood = MOOD.joy; p.moodT = 1.6; }
        }
      }
    }

    // 5) Saugroboter
    this.updateRoomba(dt);

    // 6) Schritte, Stimmung, Status
    for (const p of this.players) {
      p.stepT -= dt * p.speed;
      if (p.stepT < 0) {
        p.stepT = 0.9;
        this.fx.particles.dust(p.x, groundHeight(p.x, p.z), p.z, 1, 0xdcd6c8, 0.6);
      }
      p.moodT -= dt;
      if (p.moodT <= 0) {
        const it = p.carry;
        if (it && it.def.heavy && (it.carriers.length < 2 || it.tension > 0.05 || p.speed > 0.5)) p.mood = MOOD.strain;
        else p.mood = MOOD.happy;
      }
      this.updateStatus(p);
    }

    // 7) Wertung + Ende
    let score = 0, delivered = 0, open = 0;
    for (const it of this.items) {
      if (it.state === 'broken') continue;
      if (it.state === 'floor' && insideRect(it.x, it.z, CARGO)) {
        score += (it.def.value * it.hp) / 100; delivered++;
      } else open++;
      it.highlight = false;
    }
    for (const p of this.players) {
      if (p.candidate) { p.candidate.highlight = true; p.candidate.highlightColor = `#${new THREE.Color(p.def.color).getHexString()}`; }
    }
    this.score = score;
    this.delivered = delivered;
    if (!this.finished) {
      if (this.time <= 0) this.finished = { reason: 'time', bonus: 0 };
      else if (open === 0) this.finished = { reason: 'done', bonus: Math.round(this.time * TIME_BONUS_PER_SEC) };
    }

    const nearZone = this.items.some((it) => it.state === 'carried' && Math.abs(it.x - (CARGO.x1 + CARGO.x2) / 2) < 7 && Math.abs(it.z) < 6);
    const zu = this.world.zoneUniforms;
    zu.uActive.value += ((nearZone ? 1 : 0) - zu.uActive.value) * damp(5, dt);
    zu.uFill.value = delivered / this.items.length;

    this.syncVisuals(dt, t);
  }

  poseLight(it, p) {
    const dist = TUNING.playerRadius + it.def.dep / 2 + 0.06;
    it.x = p.x + Math.cos(p.face) * dist;
    it.z = p.z + Math.sin(p.face) * dist;
    it.a = p.face + Math.PI / 2;
  }

  updateLight(it, dt) {
    const p = it.carriers[0].p;
    it.liftTarget = TUNING.liftLight;
    const px = it.x, pz = it.z;
    this.poseLight(it, p);
    const res = this.resolveItem(it, this.floorObstacles(it), dt);
    if (res.hit) {
      p.x += res.x; p.z += res.z;
      const vn = p.vx * res.nx + p.vz * res.nz;
      if (vn < 0) { p.vx -= vn * res.nx; p.vz -= vn * res.nz; }
    }
    this.handleImpact(it, res, dt);
    it.vx = (it.x - px) / dt; it.vz = (it.z - pz) / dt;
  }

  updateHeavy(it, dt) {
    it.liftTarget = TUNING.liftHeavy;
    const [c1, c2] = it.carriers;
    const plus = c1.side > 0 ? c1.p : c2.p;
    const minus = c1.side > 0 ? c2.p : c1.p;
    const ta = Math.atan2(plus.z - minus.z, plus.x - minus.x);
    const tx = (plus.x + minus.x) / 2, tz = (plus.z + minus.z) / 2;
    const rot = 2.4;
    it.a += clamp(angleDiff(it.a, ta) * damp(10, dt), -rot * dt, rot * dt);
    const px = it.x, pz = it.z;
    it.x += (tx - it.x) * damp(12, dt);
    it.z += (tz - it.z) * damp(12, dt);
    const res = this.resolveItem(it, this.floorObstacles(it), dt);
    if (res.hit) {
      for (const c of it.carriers) {
        const vn = c.p.vx * res.nx + c.p.vz * res.nz;
        if (vn < 0) { c.p.vx -= vn * res.nx; c.p.vz -= vn * res.nz; }
      }
    }
    this.handleImpact(it, res, dt);
    this.storeCircles(it);
    it.vx = (it.x - px) / dt; it.vz = (it.z - pz) / dt;

    // Träger zu ihren Griffen ziehen
    for (const c of it.carriers) {
      const h = this.handleOf(it, c.side);
      const k = damp(16, dt);
      c.p.x += (h.x - c.p.x) * k;
      c.p.z += (h.z - c.p.z) * k;
      c.p.face = Math.atan2(it.z - c.p.z, it.x - c.p.x);
    }

    // Spannung: beide ziehen auseinander
    const ux = Math.cos(it.a), uz = Math.sin(it.a);
    const sep = (plus.vx - minus.vx) * ux + (plus.vz - minus.vz) * uz;
    if (sep > TUNING.tensionSpeed) {
      it.tension += dt;
      this.damageItem(it, TUNING.tensionDamage * it.def.fragility * dt, null, true);
      this.fx.shaker.add(dt * 0.6);
      it.flash = Math.max(it.flash, 0.4);
      if (Math.random() < dt * 8) this.audio.play('strain');
      if (it.tension > 0.25 && Math.random() < dt * 2) this.hud.popup(it.x, it.y + it.def.h + 0.6, it.z, 'Nicht ziehen!', 'need');
      if (it.state !== 'broken' && it.tension > TUNING.tensionDrop) {
        this.hud.message('Auseinandergezogen – runtergefallen!', 1.4, 'bad');
        this.putDown(it, true);
      }
    } else {
      it.tension = Math.max(0, it.tension - dt * 2);
    }
  }

  updateRoomba(dt) {
    const r = this.roomba;
    r.beepT -= dt;
    if (r.turn > 0) {
      r.turn -= dt;
      r.dir += dt * 3.2;
    } else {
      const sp = TUNING.roombaSpeed;
      r.x += Math.cos(r.dir) * sp * dt;
      r.z += Math.sin(r.dir) * sp * dt;
    }
    const obs = this.floorObstacles(null);
    const c = resolveCircle(r, r.r, obs, 2);
    if ((Math.hypot(c.x, c.z) > 1e-4 || r.x > 0.4) && r.turn <= 0) {
      if (r.x > 0.4) r.x = 0.4;
      r.turn = 0.3 + Math.random() * 0.7;
    }
    for (const p of this.players) {
      const dx = p.x - r.x, dz = p.z - r.z, d = Math.hypot(dx, dz);
      if (d < r.r + TUNING.playerRadius) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        p.x = r.x + nx * (r.r + TUNING.playerRadius);
        p.z = r.z + nz * (r.r + TUNING.playerRadius);
        if (p.stun <= 0) {
          p.kx = nx * 5; p.kz = nz * 5; p.stun = 0.45;
          p.mood = MOOD.shock; p.moodT = 0.9; p.model.pop(1);
          this.audio.play('roomba');
          this.fx.shaker.add(0.25);
          r.turn = 0.6;
          const it = p.carry;
          if (it && it.carriers.length && it.state === 'carried') {
            this.hud.popup(p.x, 1.6, p.z, 'Saugi-Attacke! 🤖', 'need');
            if (it.def.heavy) this.damageItem(it, TUNING.roombaDamage * 0.6 * it.def.fragility, null);
            else { this.damageItem(it, TUNING.roombaDamage * it.def.fragility, null); if (it.state !== 'broken') this.putDown(it, true); }
          } else {
            this.hud.popup(p.x, 1.6, p.z, 'Huch!', 'need');
          }
        }
      }
    }
    if (r.beepT < 0) { r.beepT = 4 + Math.random() * 4; }
  }

  updateStatus(p) {
    const key = KEYNAME[p.def.keys.grab[0]] || p.def.keys.grab[0];
    const it = p.carry;
    if (p.stun > 0) return this.hud.setPlayer(p.i, 'Uff! 😵', 'bad');
    if (it && it.def.heavy && it.carriers.length < 2) return this.hud.setPlayer(p.i, `hält ${it.def.label} – Hilfe holen! 👥`, 'warn');
    if (it && it.def.heavy) return this.hud.setPlayer(p.i, `schleppt ${it.def.label} (${Math.round(it.hp)}%)`, it.tension > 0 ? 'bad' : 'busy');
    if (it) return this.hud.setPlayer(p.i, `trägt ${it.def.label} (${Math.round(it.hp)}%)`, 'busy');
    if (p.candidate) return this.hud.setPlayer(p.i, `${key}: ${p.candidate.def.label} ${p.candidate.def.heavy ? 'anpacken 👥' : 'nehmen'}`, 'hint');
    this.hud.setPlayer(p.i, 'bereit', '');
  }

  // -------------------------------------------------------------------------
  // Darstellung
  // -------------------------------------------------------------------------
  syncVisuals(dt, t) {
    for (const it of this.items) {
      if (it.state === 'broken') continue;
      const g = groundHeight(it.x, it.z);
      it.y = g;
      it.root.position.set(it.x, g + it.lift, it.z);
      it.root.rotation.y = -it.a;
      // Wackeln nach Treffern (gedämpfte Schwingung) + Schwanken beim Tragen
      it.wobble *= Math.exp(-dt * 3.5);
      it.wobbleT += dt;
      const carried = it.state === 'carried';
      const sway = carried ? Math.sin(t * 8 + it.id) * 0.025 : 0;
      it.tilt.rotation.z = Math.sin(it.wobbleT * 22) * it.wobble + sway;
      it.tilt.rotation.x = Math.cos(it.wobbleT * 19) * it.wobble * 0.6 + (carried ? clamp(-it.vx * 0.01, -0.05, 0.05) : 0);
      it.flash = Math.max(0, it.flash - dt * 4);
      const u = it.uniforms;
      u.uDamage.value = 1 - it.hp / 100;
      u.uFlash.value = it.flash;
      u.uSelect.value += ((it.highlight ? 1 : 0) - u.uSelect.value) * Math.min(1, dt * 12);
      if (it.highlight) u.uSelColor.value.set(it.highlightColor);
    }
    for (const p of this.players) {
      const m = p.model;
      m.root.position.set(p.x, groundHeight(p.x, p.z), p.z);
      m.root.rotation.y = Math.PI / 2 - p.face;
      m.update(dt, t, {
        speed: p.speed || 0, carrying: !!p.carry, mood: p.mood, stun: p.stun,
        lookX: clamp((p.vx || 0) / 5, -1, 1) * 0.5, lookZ: 0,
      });
    }
    const r = this.roomba;
    r.g.position.set(r.x, 0.06, r.z);
    r.g.rotation.y = Math.PI / 2 - r.dir;
    r.eye.material.emissiveIntensity = 1 + Math.max(0, Math.sin(t * 5)) * 2;
  }

  results() {
    const bonus = this.finished?.bonus || 0;
    const total = this.score + bonus;
    const ratio = this.score / this.totalValue;
    return { score: Math.round(this.score), bonus, total: Math.round(total), ratio, delivered: this.delivered,
      broken: this.broken, items: this.items.length, reason: this.finished?.reason };
  }
}
