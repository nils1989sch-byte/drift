# DRIFT – QA-Report 1

QA-Agent, 2026-10-22 (abgelegt durch die Regie). Werkzeug: `npm run playtest` (`tools/playtest.mjs`; Optionen `--only=a,b`, `--no3d`, `--seed=N`, `--frames=N`, `--headed`).
Logik-Tests mit `?r=2d` und synchronem Frame-Stepping, 3D-Stichproben mit SwiftShader. Ergebnisse: `docs/qa/playtest-results.json`, Screenshots: `docs/qa/shots/`.
Stand: 29 Szenarien, 256 Checks. Echte Fehlschläge nur durch P0-1, P0-2, P1-1.

## Bestanden (Auszug)
Titel → Start → Intro; 8-Wege-Laufen + Ecken-Rutschen; 12 × 2000 Frames Random-Walk ohne Steckenbleiben in soliden Tiles;
Treppen 0→1→2, Klippensprung; Schwert/Wirbelattacke gegen alle Gegner; Schaden/i-Frames/Knockback; Tod → Game Over;
Büsche schneiden/heben/werfen; Truhen, Schilder, NPCs; kompletter Dungeon inkl. Rätsel und Boss (godMode); 10 Warps hin/zurück;
Pause, Zoom; Touch 390×844 und 844×390; Speichern/Fortsetzen; keine Speicherlecks nach 36 Raumwechseln.

## P0 – Absturz / Softlock
- **P0-1 Treppen-Softlock** (`src/game/collision.js`): Treppe 4–7 px neben der Mitte hinunter → Fußecke steckt in Plateauzelle, keine Richtung geht mehr (Nordklippen 9,13; Hügel 42,20; auch Gegner). Fix: Ebene erst absenken, wenn keine Fußecke höher steht; auf Treppen zur Tile-Mitte ziehen; Bewegungen erlauben, die Überlappung verkleinern.
- **P0-2 Bombenwurf friert das Spiel ein** (`src/game/entities/projectiles.js` `throwObject()`, `Bomb.explode()`): `carry.obj` existiert nicht → TypeError in `game.update()`. Fix: `const b = carry`; in `explode()` `if (p.carry === this) p.carry = null`. Regie: `game.update` absichern.

## P1 – Falsches Verhalten
- **P1-1 Kurze Tastendrücke gehen verloren** (`src/engine/input.js`, Regie): keydown+keyup im selben Frame unsichtbar. Fix: Taps einen Poll lang halten.
- **P1-2 3D-Innenräume verdeckt** (`src/engine/renderer3d.js`, Regie): Südwand wird mit hochgezogen, Fackel-Licht + Bloom überstrahlen.
- **P1-3 Händler bucht ohne Rückfrage ab** (`src/game/dialog.js` `merchant()`): Ja/Nein-Auswahl anbieten.
- **P1-4** Gruben ignorieren godMode; `debug.teleport` landet in Bäumen/Büschen.
- **P1-5** Nach Grubensturz mit gehaltener Richtung sofort erneuter Sturz (4 Herzen in 3 s): Eingabe kurz sperren, `lastSafe` mit Abstand.
- **P1-6** Getragene Bombe tickt nicht weiter.

## P2 – Gefühl / Balance / Lesbarkeit
1. Kontaktschaden Soldat/Golem (2 HP) bei 3 Herzen zu hoch → auf 1 senken; bei ≤ 2 HP mehr Herz-Drops.
2. Müde Phase des Golems schwer erkennbar → Kern-Glühen + Ton.
3. Wegführung Oberwelt: Treppe zu den Höhen versteckt → Schild „↑ Steinwacht-Ruine“.
4. Häuser von Mia/Lutz wirken begehbar → Hinweis oder Innenräume.
5. Kein „Neues Spiel“ auf dem Titel bei vorhandenem Spielstand.
6. Touch: ≡ im Pausemenü ausgeblendet.
7. 3D-Hochformat zeigt nur ~7 Tiles Breite → Basis-Zoom kleiner (Regie).
8. Baumkronen im 3D-Vordergrund decken bis 25 % des Bildes.
9. Performance unter SwiftShader nicht repräsentativ (3D Oberwelt 0,2–0,7 fps) – auf echter Hardware prüfen.
10. Spawn vor Bodos Haus liegt im Tür-Warp-Rechteck → `spawns.house.y` +4.

## Regressionstest
`npm run playtest` (alle 29 Szenarien grün) bzw. gezielt `--only=stairs_side,bomb_throw,bomb_cave,input_quick_tap,pits_fall`.
