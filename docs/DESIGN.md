# DRIFT – Spielkonzept 2.0: Monster, Echtzeit-Kämpfe, Hof

Entscheidungen des Nutzers: **Echtzeit-Action-Kämpfe**, bestehender Zelda-Inhalt wird **umgebaut**,
**Monster im Fokus** (Farming als schöne Nebenaktivität), Umbau **sofort**.
Eigene Monster und Namen – nichts von Pokémon/Nintendo übernehmen (keine Namen, Designs, Melodien).

## Spielschleife
1. Erkunden (Oberwelt, Höhlen) → wilde Monster laufen **sichtbar** in ihren Lebensräumen herum (hohes Gras, Ufer, Höhle).
2. Nähert man sich, beginnt ein **Echtzeit-Kampf an Ort und Stelle** (kein eigener Bildschirm): ein Arena-Ring legt sich
   auf den Boden, dein Leit-Monster springt aus der Driftkugel, **du steuerst dein Monster live**.
3. Wildes Monster schwächen → **fangen** (Driftkugel werfen) → Team (max. 6) bzw. Box auf dem Hof.
4. Monster sammeln EP, steigen auf, lernen Attacken, **entwickeln** sich.
5. Hof: Felder hacken, säen, gießen, ernten, verkaufen → Geld für Kugeln, Tränke, Saatgut, Hof-Ausbau.
   Monster in der Hof-Box helfen (Wasser-Monster gießen, Pflanzen-Monster beschleunigen Wachstum).
6. Trainer-NPCs und der **Steinwächter** (umgebauter Golem-Boss, fangbar) in der Monster-Höhle.

## Steuerung
| Aktion | PC | Touch | Gamepad |
|---|---|---|---|
| Laufen | WASD/Pfeile | Stick | Stick |
| A: Werkzeug benutzen / im Kampf Attacke 1 | Leertaste/J | A | A |
| B: Sprechen/Heben / im Kampf Attacke 2 | E/K | B | B |
| Item: Hotbar wechseln / im Kampf Kugel werfen bzw. Item | Q/L | Item | X |
| Ausweichen (nur Kampf) | Shift | Ausweich-Knopf | Y |
| Attacke 3/4 (nur Kampf) | 1 / 2 | lang drücken A / B | LB / RB |
| Menü (Team, Lexikon, Inventar) | Enter/Esc | ≡ | Start |

## Kampf (Echtzeit)
- Arena: Kreis r = 72 px um den Kampfbeginn; Monster können ihn nicht verlassen; Spieler-Trainer steht am Rand und
  bleibt sichtbar. Kamera zentriert zwischen beiden Monstern, leicht näher.
- Gesteuertes Monster: Bewegung mit monster.speed, 4 Attacken mit **Abklingzeit** (keine AP), Ausweichrolle mit
  0,25 s Unverwundbarkeit (Abklingzeit 1 s). Wildes Monster: KI mit sichtbarer **Vorwarnung** (Telegraph) vor Angriffen.
- Attacken-Formen: `melee` (Nahangriff vor dem Monster), `dash` (Sturmangriff), `projectile`, `area` (Kreis um sich),
  `cone`, `buff`. Jede hat type, power, cooldown, windup, range.
- Schaden = power × (atk/def) × Level-Faktor × Typ-Effektivität (2.0 / 1.0 / 0.5) × STAB 1.2 × Zufall 0.9–1.1.
- Fangen: wildes Monster unter 50 % HP → "Fangen!"-Hinweis; Item-Taste wirft Kugel (Bogen, Treffer nötig). Chance
  = basis × (1 − hp%) × Kugelfaktor; 3 Wackler, dann Erfolg/Ausbruch.
- Monster besiegt (0 HP) → nächstes Team-Monster springt heraus. Alle besiegt → Ohnmacht, Aufwachen zu Hause, Geld −10 %.
- Flucht: aus dem Ring laufen mit dem Trainer (Trainer-Steuerung über Menü "Zurück") – bei Trainerkämpfen nicht möglich.
- Außerhalb des Kampfs folgt das Leit-Monster dem Spieler (Begleiter), hilft nicht aktiv.

## Typen (6 + Normal)
Feuer > Pflanze > Wasser > Feuer; Blitz > Wasser, Wind; Stein > Feuer, Blitz, Wind; Wind > Pflanze; Pflanze > Stein.
Umgekehrt jeweils 0.5. Normal neutral. Tabelle in `src/game/monsters/types.js`.

## Monster-Arten (Start-Set, IDs verbindlich für Art & Gameplay)
| id | Name | Typ | Idee | Entwickelt zu (Lv) |
|---|---|---|---|---|
| `funkel` | Funkel | Feuer | kleiner Salamander mit Glutschwanz (Starter) | `glutar` (16) |
| `glutar` | Glutar | Feuer | aufrechter Lava-Salamander | – |
| `tropfi` | Tropfi | Wasser | Otterjunges mit Muschelkappe (Starter) | `strudelott` (16) |
| `strudelott` | Strudelott | Wasser | großer Otter mit Wasserwirbel | – |
| `sprossi` | Sprossi | Pflanze | Igel mit Blattstacheln (Starter) | `dornigel` (16) |
| `dornigel` | Dornigel | Pflanze/Stein | Igel mit Dornenpanzer | – |
| `kiesel` | Kieselkrabbe | Stein | Krabbe mit Steinschale (Ufer, Höhle) | `felspanzer` (20) |
| `felspanzer` | Felspanzer | Stein | massiger Felskrebs | – |
| `zappi` | Zappfalter | Blitz | Schmetterling mit Funkenflügeln (Wiese) | – |
| `boeli` | Böenspatz | Wind | rundlicher Spatz (Wiese, Klippen) | `sturmfalk` (18) |
| `sturmfalk` | Sturmfalk | Wind | Falke mit Sturmschweif | – |
| `moosi` | Moosschneck | Pflanze | Schnecke mit Moosgarten-Haus (Wald) | – |
| `pilzling` | Pilzling | Pflanze | wandernder Pilz, schläfrig (Wald, Nacht) | – |
| `steinwaechter` | Steinwächter | Stein | der alte Golem, Boss in der Höhle, fangbar | – |

Werte: hp, atk, def, spd (Basis), Attacken-Lernliste, Fangrate, EP-Ausbeute, Lebensraum, Tageszeit.

## Hof & Zeit
- Uhr: Tag 06:00–02:00, 1 Spielminute = 0,7 s real (ein Tag ≈ 14 min). Nachts dunkler (Renderer), Schlafen im Bett → nächster Tag.
- Jahreszeiten optional später (Frühling zuerst).
- Felder: Hacke auf Gras/Erde im Hof-Bereich → `soil`; Saat → Pflanze Stufe 0; gießen → `soil_wet` (bis Tagesende);
  gegossene Pflanzen wachsen 1 Stufe pro Tag; reif → ernten (Aktion) → Item.
- Pflanzen (Start): `ruebe` (4 Tage), `kartoffel` (5), `erdbeere` (6, mehrfach erntbar), `kuerbis` (8), `blaubeere` (6), `weizen` (4).
- Verkaufen: Versandkiste am Hof (abends ausgezahlt) oder Händler Lutz. Shop: Saatgut, Driftkugeln, Tränke.
- Monster-Helfer: Monster in der Hof-Box (max. 4) helfen täglich: Wasser gießt 6 Felder, Pflanze +10 % Wachstum, Stein findet Erz.

## Umbau des Bestands
- Driftwald = Heimatdorf; Bodos Haus = Spielerhaus mit Bett; Hof-Fläche östlich davon; Bodo gibt den Starter (Wahl aus 3).
- Hohes Gras/Wald/Ufer = Monster-Lebensräume; Schwert entfällt (Büsche/Gras schneidet man mit der Sichel-Hotbar).
- Dungeon = Monster-Höhle (Rätsel bleiben, Gegner → wilde Stein-/Blitz-Monster), Golem → Steinwächter-Kampf.
- Soldaten → Trainer (Ranger), die herausfordern.

## Schnittstellen (verbindlich)
- Monster-Daten: `src/game/monsters/` (species.js, moves.js, types.js, monster.js [Instanz: level, xp, hp, stats, moves],
  battle.js [Echtzeit-Kampf], capture.js, party.js). Gameplay-Agent A.
- Hof/Zeit/Inventar: `src/game/farm/` (clock.js, farm.js, crops.js, inventory.js, shop.js). Gameplay-Agent B.
- Integration in `src/game/index.js`: Gameplay-Agent A (B liefert Funktionen `createFarm(game)` usw.).
- Art-Schlüssel Monster: `mon_<id>_<action>_<dir>` mit action ∈ idle (2–4), walk (4), attack (3–4), hurt (1–2), faint (3),
  plus `mon_<id>_icon` (32×32 Porträt für UI). HD-Dichte ws 0.5. Kleine Monster ~24–32 Weltpx hoch, große ~40, Boss ~80.
- Art Kugel/Farm: `orb` (+ `orb_open`, `orb_shake` 3), `crop_<id>_<stage>` (stage 0..n, letzte = reif), Tiles `soil`, `soil_wet`,
  Requisiten `shipping_bin`, `scarecrow`, `bed`, `barn`, `trough`, Icons `icon_<item>` (hoe, can, sickle, seeds_<id>, crop_<id>, orb, potion).
- FX (Animation): `type_fire|water|leaf|rock|spark|wind` je für hit/projectile/area, `capture_throw`, `capture_shake`,
  `capture_success`, `capture_break`, `level_up`, `evolve`, `till`, `water_splash`, `harvest`, `monster_summon`.
- UI: Kampf-HUD (eigenes + gegnerisches Monster: Name, Level, Typ-Icon, HP-Balken, Attacken mit Abklingzeit-Ring),
  Fang-Hinweis, Team-Menü, Lexikon, Box, Inventar/Hotbar, Shop, Uhr/Tag, Starter-Auswahl, Entwicklungs-Sequenz.
- Renderer (Regie): Tag/Nacht-Licht über `game.clock` (`renderer.setTime(hours)`), Arena-Ring als Boden-Decal,
  Kampfkamera (`camera.battleFocus = {x,y}`).
