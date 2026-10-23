# DRIFT – Gameplay (Gameplay-Agent, `src/game/`)

## Steuerung
| Aktion | Tastatur | Touch/Gamepad |
|---|---|---|
| Laufen (8 Richtungen, ~82 px/s, Blick 4-Wege) | WASD / Pfeile | Stick |
| Schwert. Gedrückt halten (0,75 s) und loslassen: **Wirbelattacke** | Leertaste / J | A |
| Aktion: heben/werfen, lesen, reden, Truhe öffnen | E / K | B |
| Item (Bomben legen) | Q / L | Item |
| Pause (gehört der UI) | Enter / Esc / P | ≡ |

Mit einem getragenen Objekt werfen A oder B es. Wer gegen einen Schiebeblock drückt (0,4 s), schiebt ihn um ein Tile.
Wer gegen eine verschlossene Tür drückt und einen Schlüssel hat, öffnet sie. Eine Klippenkante führt nach unten:
Wer gegen sie läuft, springt im Bogen hinunter (nur süd/west/ost, nie nach oben). Nach oben geht es nur über Treppen.

## Story
Der Steingolem hat den **Drift-Kristall** aus dem Schrein von Driftwald geraubt, und das Dorf treibt davon. Der
Ältere Bodo schickt den Helden über die Brücke nach Osten zur **Steinwacht-Ruine**. Mit dem Kristall endet das Spiel:
Es folgen ein Credits-Dialog, der Toast „ENDE“ und ein Portal zurück zur Oberwelt.

## Karten (`src/game/maps/`)
- `overworld` (48×36, Höhen 0–3): Dorf Driftwald (3 Häuser, Platz mit Statue, Garten mit Zaun, NPCs Mia und Lutz
  sowie Fischer Jonte am Teich), Flüsterwiese (Teich, hohes Gras), Nordklippen (Stufe 1–2, Truhe, **rissige
  Felswand** bei Tile 4,13), Fluss mit Brücke, Ostufer mit Hügel, Steinwacht-Höhen (Stufe 1–3, Ruineneingang 40,4).
  Der Waldrand besteht aus Bäumen; unsichtbare `barrier`-Objekte blocken ihn.
- `house_elder`: Startraum, Bodo erzählt das Intro.
- `cave`: Verborgene Grotte (erst nach dem Sprengen offen). Die Truhe enthält einen Herzcontainer.
- `dungeon_1` Eingangshalle → NW-Tür offen, NO-Tür verschlossen.
- `dungeon_2` Rätselraum: Block (4,7) auf den Schalter (7,3) schieben. Dann erscheint eine Truhe mit dem kleinen Schlüssel.
- `dungeon_3` Gegnerraum mit Gruben: Wer alle Gegner besiegt, lässt eine Truhe mit **Bomben** erscheinen. Die Nordwand ist rissig, eine Bombe öffnet sie.
- `dungeon_4` Bossraum: Steingolem. Ein Gitter (`shutter`) schließt den Raum, solange der Kampf läuft. Danach gibt es einen Herzcontainer, den Kristall und das Portal.

Format: Jede Karte ist eine Funktion, die `{ id, name, face, plinth, music, rows, heights, objects, enemies, npcs, warps,
spawns, areas?, update?(g), onEnter?(g) }` liefert. Gezeichnet werden die Karten mit dem Painter in `maps/paint.js`.
Jeder Eintritt baut die Karte neu, deshalb respawnen Gegner. Fortschritt steht in `game.flags`.
Warps sind Rechtecke in Tiles mit `to`, `spawn`, `dirReq` (nur beim Laufen in diese Richtung) und `needFlag`.

## Mechaniken
- **Kollision** (`collision.js`): Fußbox 10×6, Unterschritte ≤ 1 px, Achsen getrennt. Ecken-Rutschen wie in ALttP
  wirkt bis 7 px Überlappung. Höhenregel: Erlaubt sind gleiche Stufe, ein Treppen-Tile eine Stufe höher oder vom
  Treppen-Tile eine Stufe tiefer. Die sichtbare Höhe z wird auf Treppen interpoliert. Flieger (Fledermäuse)
  ignorieren Klippen und Objekte.
- **Kampf** (`combat.js`): AABB-Hitboxen im Bildschirmraum, nur auf gleicher Stufe. Treffer bewirken Hitstop
  (0,05 s), Flash, Funken und Knockback (~24 px, Ease-out). Der Spieler ist danach 1 s unverwundbar und blinkt.
  Schaden: Schwert 1, Wirbel 2, Bombe 2, geworfener Stein 2, Busch/Topf 1. Das Schwert wehrt Gegner-Projektile ab.
- **HP** in Halbherzen (Start 6 = 3 Herzen). Bei 0 HP folgen die Todesanimation und dann `state='gameover'`.
  `retry('continue')` setzt beim letzten Eingang mit mindestens 3 Herzen neu an, `retry('restart')` startet ein neues Spiel.
- **Gruben:** Der Held fällt hinein, verliert 1 Herz und erscheint an der letzten sicheren Stelle. Gegner sterben darin.
- **Wasser:** Tiefes Wasser blockt. Flaches Wasser bremst auf 55 % und erzeugt Splash. Hohes Gras bremst auf 88 %,
  verdeckt die Füße und lässt sich schneiden (Drop-Chance).
- **Objekte:** Bäume, Häuser, Zäune, Statuen und Fackeln sind fest. Büsche lassen sich schneiden und heben. Töpfe und
  Steine lassen sich heben und werfen. Dazu kommen Schilder, Truhen (Flag-persistent, auch `appearFlag`),
  verschlossene Türen, Schiebeblöcke, Bodenschalter, sprengbare Wände/Felsen und Bomben (heb- und werfbar,
  Kettenreaktion).
- **Gegner:** Octorok läuft zufällig und spuckt Steine, wenn er in einer Linie mit dem Helden steht. Soldat
  patrouilliert, verfolgt bei Sicht (Blickkegel + Sichtlinie) und gibt nach 2,5 s ohne Sicht auf. Schleim hüpft auf
  den Helden zu. Fledermaus ruht, bis der Held nah ist, und fliegt dann im Zickzack. **Golem:** gehen → Steinfächer
  werfen → 2–3 Stampfsprünge (Schockwelle r=46, fallende Felsen, Kamerawackeln) → müde Phase (nur jetzt verwundbar,
  sonst „tink“). Bomben treffen ihn immer und machen ihn müde. 12 HP, ab der Hälfte schneller.
- **Treppen:** Die Fußbox darf auf einer Treppe den Absatz darunter bzw. die Kante darüber überlappen, aber nur
  in der Treppenspalte. Beim vertikalen Laufen wird der Held zur Treppenmitte gezogen. Die Stufe sinkt erst, wenn
  keine Fußecke mehr höher steht. Damit gibt es keinen Softlock und kein seitliches Aufsteigen.
- **Schaden:** Kontaktschaden von Soldat und Golem 1 HP, Felsbrocken 1 HP, Golem-Stampfwelle 2 HP. Bei ≤ 2 HP fallen
  häufiger Herzen. Der Golem pulsiert in der müden Phase und funkelt; beim ersten Mal erscheint ein Hinweis-Toast.
- **Gruben:** Nach einem Sturz ist die Eingabe 0,6 s gesperrt; der Respawn hält Abstand zur Grube. Im godMode
  fällt man nicht.
- **Händler:** Ja/Nein-Auswahl über `ui.dialog({choices})`.
- **Türen ohne Innenraum** (Mia, Lutz) zeigen einen Hinweis-Toast (`warps[].hint`).
- **Requisiten:** barrel, crate, sack, hay, cart, well, gravestone, lantern, tools, bench, flowerbox (fest, kleine
  Fußboxen). Sie stehen in Clustern an den Hausfronten, am Brunnenplatz (Karren mit Säcken und Heu) und auf dem
  Friedhof am Fluss; an Kreuzungen stehen Schild und Laterne. Lichtungen nutzen die Tiles `grass_light` und
  `clearing`. Am Südrand stehen nur noch einzelne kleine Bäume und Büsche.
- **Drops:** Herzen, Rupien (1/5/20), Bomben (wenn vorhanden). Händler Lutz verkauft später 5 Bomben für 20 Rupien.
- **Speichern** (`save.js`, localStorage `drift_save_v1`): automatisch bei Raumwechsel, Truhen, Türen und Flags.
  `game.start()` setzt einen Spielstand fort, `game.start('new')` beginnt neu.

## Game-Objekt (für UI/QA)
`game.state` ('title'|'play'|'dialog'|'pause'|'gameover'), `game.player {hp, maxHp, rupees, keys, bombs, item, items, hasSword}`,
`game.areaName`, `game.flags`, `game.world`, `game.entities`, `game.start(mode?)`, `game.retry(mode)`, `game.restart()`,
`game.togglePause()`, `game.drawOverlay` (Blende beim Raumwechsel).

## Debug-API (`window.__drift.game.debug`)
```js
teleport(mapId, tx?, ty?)  // Tile-Koordinaten; ohne x/y → Standard-Spawn; weicht Objekten/Gruben/Wasser aus. Maps: debug.maps
give('bombs'|'key'|'rupees'|'heart'|'heart_container'|'crystal'|'sword'|'all', amount?)
godMode(true|false)
listEntities()             // [{kind, type, x, y, tx, ty, lvl, hp, state}]
player()                   // Position, Stufe, Zustand, HP, Karte
setFlag(k, v), flags(), killAll(), resetSave()
```
Nützliche Flags: `intro`, `d1_door`, `d2_switch`, `d3_clear`, `d3_wall`, `cave_open`, `boss_golem`, `crystal`.

## Wünsche an andere Agenten
- Art: Sprites `wall_cracked` (16×32, Dungeonmauer mit Rissen), `rock_cracked` (16×16 Riss-Overlay für Klippen),
  `cave_entrance` (16×16 Höhlenmund), `shutter` (16×16/32 Gitter), `crystal` (Drift-Kristall), `portal` (Boden-Decal).
  Fehlen sie, zeichnet `src/game/fallback.js` Platzhalter.
- Tiles: Eine eigene Tile-ID für Klippenwände mit Rissen würde helfen. Bisher übernimmt das ein Objekt.
