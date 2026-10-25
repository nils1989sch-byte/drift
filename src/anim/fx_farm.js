// Farming effects: till, water_splash, harvest, sparkle_crop. Registered into createFX via the kit.
import { C, dot, sparkleSprite, ember } from './bake.js';
import { ease } from './tween.js';

export function registerFarmFX(kit) {
  const { get, anim, bit, handle, frames, baked, SPAWN, rnd, pick, DIRV, B } = kit;
  const imgOf = (v) => (!v ? null : typeof v === 'string' ? frames(v)?.[0] || null : Array.isArray(v) ? v[0] : v);

  // hoe hits the ground: dirt clods hop out, dust puff, short scratch
  SPAWN.till = (x, y, o) => {
    const [dx, dy] = DIRV[o.dir] || [0, 1];
    for (let k = 0; k < (o.count ?? 7); k++) {
      bit('clod', x, y, o, {
        ang: Math.atan2(dy, dx) + Math.PI + rnd(-1.4, 1.4), speed: [18, 42], vh: [55, 95], g: 420, bounce: 0.3, hop: [1, 3],
        life: [0.45, 0.7], img: B.chunk(pick([C.dirt_md, C.dirt_dk, C.dirt_lt]), C.dirt_ink), shadow: 1, spread: 3,
      });
    }
    SPAWN.dust(x - 3, y, {}); SPAWN.dust(x + 3, y + 1, {});
  };

  // watering can: arcing drops from the can (in front of the hero) onto the tile, small splashes on landing
  SPAWN.water_splash = (x, y, o) => {
    const [dx, dy] = DIRV[o.dir] || [0, 1];
    const ox = o.from?.x ?? x - dx * 10, oy = o.from?.y ?? y - dy * 8, oh = o.fromHop ?? 12;
    const n = o.count ?? 9;
    for (let k = 0; k < n; k++) {
      const T = rnd(0.2, 0.3), g = 380;
      const tx = x + rnd(-5, 5), ty = y + rnd(-3, 3);
      const p = bit('drop', ox, oy, o, { speed: [0, 0], vh: [0, 0], g, hop: [0, 0], life: [T + 0.05, T + 0.05], fade: 0.05, img: dot(pick([C.foam, C.water_hi, C.water_lt]), 1), shadow: 0, delay: k * (0.32 / n) });
      p.hop = oh; p.vx = (tx - ox) / T; p.vy = (ty - oy) / T; p.vh = (0.5 * g * T * T - oh) / T; p.drag = 0;
      p.onUpdate = (q) => {
        if (q.landed && !q.data) {
          q.data = 1;
          const d = kit.decal('ripple', baked('ripple', B.ripple), q.x, q.y, { z: q.z, alpha: 0.8 }, 0.35);
          d.sortBias = -9;
          for (let i = 0; i < 2; i++) bit('drop2', q.x, q.y, { z: q.z }, { speed: [8, 20], vh: [30, 50], g: 420, hop: [0, 1], life: [0.15, 0.25], img: dot(C.foam, 1), shadow: 0 });
        }
      };
    }
    // wet spot darkening the soil a moment (the tile itself becomes soil_wet in gameplay)
    const w = kit.decal('wet', [baked('wetspot', () => kit.B.scorch())], x, y, { z: o.z, alpha: 0.35, delay: 0.25, fade: 0.6 }, 0.9);
    w.sortBias = -11;
  };

  // harvest: pop + leaves, the item flies up out of the plant, hovers, then fades (or flies to opts.to)
  SPAWN.harvest = (x, y, o) => {
    SPAWN.leaves(x, y, { z: o.z, count: 5, grass: false });
    anim('pop', baked('poof', B.poof), x, y, { z: o.z, sortBias: 3, alpha: 0.7 }, 50);
    const img = imgOf(o.item);
    const p = get();
    p.kind = 'custom'; p.type = 'harvest'; p.x = x; p.y = y; p.z = o.z || 0; p.life = o.life ?? 1.0; p.sortBias = 12; p.layer = 'top';
    const to = o.to;
    p.onUpdate = (q) => {
      const t = q.t;
      if (t < 0.35) q.hop = ease.backOut(t / 0.35) * 20;
      else if (to && t > 0.6) { const k = ease.quadIn(Math.min(1, (t - 0.6) / 0.4)); q.x = x + (to.x - x) * k; q.y = y + (to.y - y) * k; q.hop = 20 + 10 * k; }
      else q.hop = 20 + Math.round(Math.sin((t - 0.35) * 8));
      if (Math.random() < 0.15) SPAWN.sparkle(q.x, q.y, { z: q.z, hop: q.hop + 2, count: 1, radius: 5 });
    };
    p.onDraw = (q, r) => {
      const a = q.t > q.life - 0.2 ? (q.life - q.t) / 0.2 : 1;
      r.shadow?.(q.x, q.y, q.z, 3, 1.5, 0.2 * a);
      if (img) r.sprite(img, q.x, q.y, q.z, { hop: q.hop, alpha: a });
      else r.sprite(ember(C.gold_lt, C.fx_orange, 2.5), q.x, q.y, q.z, { hop: q.hop, alpha: a });
    };
    if (o.onDone) p.onEnd = () => o.onDone();
    return handle(p);
  };

  // ripe crop glitter: a couple of twinkles; { loop: true } keeps twinkling until handle.close()
  SPAWN.sparkle_crop = (x, y, o) => {
    const tw = () => {
      const s = anim('sparkle_crop', null, x + rnd(-6, 6), y + rnd(-2, 2), { z: o.z, hop: rnd(3, (o.height ?? 14)), sortBias: 9, glow: true }, 60);
      s.img = sparkleSprite(pick([C.white, C.gold_lt, C.fx_yellow]), 2.5); s.kind = 'bit'; s.g = 0; s.life = 0.45; s.fade = 0.5; s.fadeIn = 0.15; s.shadowR = 0;
    };
    if (!o.loop) { tw(); setTimeoutFx(kit, 0.25, tw); return null; }
    const p = get();
    p.kind = 'custom'; p.type = 'sparkle_crop'; p.x = x; p.y = y; p.z = o.z || 0; p.life = 1e9; p.keep = true; p.hidden = true;
    let next = 0;
    p.onUpdate = (q) => { if (q.t >= next) { tw(); next = q.t + rnd(0.6, 1.3); } };
    p.onDraw = () => {};
    return handle(p);
  };
}

// timer that lives inside the fx system (pauses with it)
export function setTimeoutFx(kit, sec, fn) {
  const p = kit.get();
  p.kind = 'custom'; p.type = 'timer'; p.life = sec; p.onDraw = () => {}; p.onEnd = () => fn();
  return p;
}
