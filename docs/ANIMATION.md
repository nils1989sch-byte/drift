# DRIFT – Animation, FX & Audio (Animations-Agent)

Module: `src/anim/index.js` (re-exportiert alles), `src/anim/defs.js` (Timing-Daten), `src/audio/index.js`.
Testseite: `src/anim/demo.html` (alle Animationen aller Sprites, FX-/SFX-/Musik-Buttons, Klick = FX spawnen;
`?snap=0.2` friert nach 0,2 s ein, `?fx=1000` spawnt alle FX zyklisch, `?scale=4`, `?events` zeigt alle Frame-Events).
Timing folgt `docs/STYLE_GUIDE.md` §7 (min. 33 ms/Frame).

## Animator

```js
import { Animator } from '../anim/index.js';
const anim = new Animator(assets, 'hero');      // optional 3. Arg: { onEvent(ev, anim), action, dir }
anim.play('walk', 'left');                      // gleiche Aktion+Richtung → no-op; Richtungswechsel behält die Laufphase
anim.play('attack', dir, { restart: true, speed: 1 });
anim.update(dt);                                // dt in Sekunden
anim.frame / anim.flip                          // Canvas + ob gespiegelt (nur wenn eine Richtung fehlt)
anim.draw(r, x, y, z, { flash, alpha, hop })    // = r.sprite(frame, …, {flip}) – bevorzugt nutzen (Flip automatisch)
anim.done                                       // once-Animation fertig (letzter Frame bleibt stehen)
anim.event                                      // erstes Event dieses update() (oder des play()), sonst null
anim.events / anim.hasEvent('hit')              // alle Events dieses update()
anim.frameIndex, anim.frameCount, anim.progress (0..1), anim.duration (s), anim.action, anim.dir
anim.has('spin')                                // gibt es echte Art (ohne Fallback)?
```
Sprite-Suche: `name_action_dir` → `name_action` → gespiegelte Gegenrichtung → beliebige Richtung →
`fallback`-Aktionen aus defs → `idle`/`walk`/`fly` → `name` → `name_idle_down` → irgendein `name_*` → Platzhalter.
Crasht nie. **Timing/Events kommen immer von der angeforderten Aktion**, auch wenn Sprites per Fallback geliehen
werden – `attack` feuert also `'hit'` und wird `done`, selbst ohne Angriffs-Art.

| Entity | Aktionen (ms/Frame, Modus, Events) |
|---|---|
| hero | idle 4×300 loop · walk 8×68 loop `step`@0,4 · attack 40/40/50/60/80 once `swing`@0 `hit`@2 · spin 8×40 once `hit`@0,2,4,6 · charge · hurt 2×60 loop · lift 3×80 once `lifted`@2 · carry 4×110 loop `step` · carry_idle (1. Carry-Frame, `pick:[0]`) · throw 60/120 once `release`@0 · push 4×130 `step` · item_get 1200 once · fall 4×120 once · dead 150/150/900 once · swim `stroke` |
| octorok | walk 2×150 · idle · attack once `shoot`@1 · hurt |
| soldier | walk 4×125 `step` · idle 2×500 · attack 120/260 once `hit`@1 · hurt |
| slime | idle 3×180 `hop`@1 · walk · hurt |
| bat | fly 2×80 `flap` · hurt (idle → fly per generischem Fallback) |
| boss_golem | idle 2×420 `stomp` · walk `stomp` · attack 360/90/520 once `hit`@1 · hurt |
| npc_elder/girl/merchant | idle 2×500 · walk 4×140 loop `step`@0,2 (alle 4 Richtungen) |
| Objekte | flower, torch, bomb, rupee_green/blue/red, heart_container (`new Animator(assets,'torch')` → Key `torch`) |

`TIMING` (aus defs): `hitstop 0.05, knockback 0.22, knockbackDist 20, invuln 1.0, blinkHz 10, flash 0.12, itemGetHold 1.2, walkSpeed 85`.

## FX

```js
const fx = createFX(assets);                    // main.js ruft fx.update(dt) und fx.drawables()
fx.spawn(type, x, y, { z, hop, dir, ... });     // x,y = Fußpunkt auf dem Boden (Weltpixel), z = Höhenstufe
fx.ambient(world, camera, { outdoor?, density? })  // pro Frame aufrufen (Gameplay-update) – dezentes Umgebungsleben
fx.clear(keepAmbient?)                          // z. B. beim Raumwechsel
fx.count, fx.types
```
`fx.update(dt)` treibt auch den globalen `tween`-Manager.

| Typ | Beschreibung / Optionen |
|---|---|
| `slash` | `fx_slash_<dir>`; **x,y = Fußpunkt des Helden** (Sprite teilt den Anker mit `hero_attack_*`). `dir` |
| `poof` (`death`) | Tod-Rauchwolke + Rauchbällchen |
| `leaves` (`bush`) | 6–8 `fx_leaf` fliegen im Bogen (hop + Schwerkraft, trudeln, Schatten) + Grasschnipsel. `count`, `colors`, `grass:false` |
| `grass` | `fx_grass_bit` Schnipsel (hohes Gras schneiden). `count` |
| `spark` (`hit`) | Treffer-Stern + 4 Funken. `hop` (Default 8 = Körpermitte) |
| `splash` | `fx_splash` + Tropfen + Ring |
| `ripple` | Wasserring auf dem Boden (Waten im Flachwasser) |
| `dust` | Lauf-Staub hinter den Füßen. `dir` = Laufrichtung (bei `step`-Event spawnen) |
| `sparkle` | Funkeln (Item, Geheimnis). `count`(3), `radius`(8), `hop`, `stagger` |
| `explosion` | Explosion + Rauch + Trümmer + Brandfleck. `camera` → `camera.shake(3, .3)` |
| `heart_pop` | Herz-Aufsammeln |
| `rocks` | Stein zerbricht (springende Brocken) |
| `shards` (`pot`) | Topf zerbricht |
| `damage_number` (`damage`) | `value`, `color` |
| `text` | `text`, `color`, `life`, `rise` (3×5-Pixelfont) |

Fehlt ein Sprite, zeichnet jeder Typ einen Pixel-Fallback in Palettenfarben. Ambiente: Schmetterlinge (bevorzugt
über `grass_flowers`, fliegen über Klippen), Pollen-/Staubglitzern (`layer:'top'`), fallende Blätter; innen/Dungeon
(`plinth:'stone'` oder id ~ dungeon/cave/house) nur Staubglitzern. `world.ambient = false` schaltet ab, `world.outdoor` erzwingt innen/außen.

## Juice-Helfer (`src/anim/juice.js`, `tween.js`)

```js
ease.linear/quadIn/quadOut/quadInOut/cubicIn/cubicOut/cubicInOut/sineIn/sineOut/sineInOut/expoOut/backIn/backOut/elasticOut/bounceOut/arc
tween.to(obj, { x: 10 }, 0.3, { ease: 'backOut', delay, onUpdate, onDone, yoyo, repeat }) → { cancel() }
tween.after(sec, fn); tween.kill(obj); createTweens() für eigene Manager
new Wobble()   .hit(dir, strength)  .update(dt)  .draw(r, img, x, y, z)  .px     // Busch/Schild wackelt (Zeilen-Skew, pixeltreu)
new Squash()   .pop(a) .land(a) .jump(a) .update(dt) .draw(r, img, x, y, z, {hop}) .s  // Squash&Stretch per Zeilen-Resampling
new HitFlash() .trigger() .update(dt) .on      → r.sprite(…, { flash: flash.on })
new Blink()    .start(1.0) .update(dt) .visible // i-Frames 10 Hz
new Knockback().start(x, y, fromX, fromY, {dist, dur, hop, axis}) ; const d = kb.update(dt) → {dx, dy, hop}; .active
new HitStop()  .trigger(0.05) ; if (hitstop.update(dt)) return;   // Gameplay einfrieren
new Hop()      .launch(v0) .update(dt) .px .landed .justLanded     // geworfene Töpfe, springende Drops
itemGetArc(t) → {hop, alpha}   dropArc(t) → hop   chestPop(t) → {hop, squash}   bob(time)   pulse(time)   shake(camera, 'small'|'medium'|'big')
drawWobble(r, img, x, y, z, amount, o) · drawSquash(r, img, x, y, z, s, o) · drawPixelText(ctx, text, x, y, col)
```

## Audio (`createSFX()`)

```js
sfx.unlock()          // bei erster Interaktion (main.js macht das); vorher sind play/music stumm, music() wird gemerkt
sfx.play(name)        // → true/false
sfx.music('overworld' | 'dungeon' | 'boss' | 'title' | null)   // Crossfade, Loop
sfx.setVolume(0..1), sfx.setMusicVolume(0..1), sfx.mute(bool?), sfx.setLowHealth(bool)  // Piepen alle 0,9 s
sfx.names, sfx.songs, sfx.has(name)
```
Ohne AudioContext (headless/Node) sind alle Aufrufe No-Ops.

SFX: `sword, sword_spin, sword_charge, hit` (Schwert trifft Hartes), `enemy_hit, enemy_die, hurt, cut_grass, lift,
throw, shatter, rupee, rupee_big, heart, key, pickup, chest_open, item_get, secret, door, stairs, splash, bomb_fuse,
explosion, menu_move, menu_select, menu_open, menu_close, text_blip, error, low_health, fall, boss_roar, shoot, bounce,
push, switch, dash, heart_container, save`.

Musik ist eigene Komposition (Akkordfolge + Melodie, Bass/Arpeggio/Drums prozedural): title (Am, 76 bpm),
overworld (F-Dur, 120), dungeon (d-Moll, 84, Echo), boss (e-Moll, 150).
