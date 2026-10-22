# REVIEW 1 – Abgleich Pixel-Art gegen STYLE_GUIDE (Phase 2)

Grundlage: Screenshots von `src/art/gallery.html` (alle Assets, Skalen 1/3/4×, Diorama-Szene mit echtem Renderer).
`window.__gallery.issues` = **0** zum Prüfzeitpunkt (Palette, Alpha, Farbanzahl automatisch OK).
Gesamturteil: Figuren, Gegner, NPCs, Objekte, Icons und Wasser sind **gut und stimmig** (ALttP-nah, saubere
Outlines, Licht oben links). Die Schwächen liegen im **Terrain**: Klippen und Gras-Helligkeitszonen.

**Guide-Änderung dazu:** STYLE_GUIDE §4.3 hat eine neue warme **cliff-Ramp** (5 Farben, Palette jetzt 74):
`cliff_ink #402830, cliff_dk #705040, cliff_md #a08058, cliff_lt #c8a870, cliff_hi #e8d098` → bitte in
`src/art/palette.js` ergänzen (`R.cliff`). §5 Face `rock` und die Edge-Regeln sind präzisiert.

---

## P1 – Muss (bestimmt den Gesamteindruck)

### 1. Face `rock` (tiles.js `rockFace`) – wirkt wie graue Palisade/Steinmauer
**Problem:** 3 gleich breite Säulen (RIBS 4/3/3 px) in kühlem Grau, Bruchstellen bilden über die Kachelung
durchgehende **horizontale Fugen** → liest sich als gemauerte Wand. Jede 16-px-Kachel identisch → harter Takt.
Kein Helligkeitsverlauf nach unten. In der Szene ist der Unterschied zur `brick`-Mauer kaum erkennbar.
**Anweisung:**
- Farben: komplett auf `R.cliff` umstellen. Fläche `cliff_md`, Lichtkanten `cliff_lt`/`cliff_hi`, Schattenseiten
  `cliff_dk`, Fugen `cliff_ink`. Kein `rock_*` mehr in der Klippe.
- Form: statt Säulen **4–6 unregelmäßige Brocken pro 16×16**, Breite 4–10 px, Höhe 5–12 px, Umriss mit
  abgeschrägten Ecken (1–2 px Diagonale), Fugen 1 px `cliff_ink`, überwiegend **senkrecht oder schräg**
  (Strukturrillen); horizontale Fugen nur kurz (≤ 5 px) und versetzt, nie über die ganze Breite.
- Shading pro Brocken: obere Kante 1 px `cliff_hi`, linke Kante 1 px `cliff_lt`, rechte 1–2 px `cliff_dk`,
  Unterkante 1 px `cliff_ink`; 1–2 Riss-Pixel `cliff_dk` innen.
- Vertikaler Verlauf: `[0]` Grundton `cliff_md` mit viel `cliff_lt`; `[1]` ausgeglichen; `[2]` Grundton
  `cliff_dk`, Brocken kleiner (Geröll), unterste 2 px `cliff_ink`.
- Varianten: `[1]` als **Array von 3 Varianten** (oder per x-Hash im Generator), damit benachbarte Spalten
  nicht identisch sind (falls Renderer nur 1 Mittelstück kennt: Regie fragen, `faces.rock.mid = [..]` o. ä.).
- Grasüberhang `[0]`: Zacken unregelmäßig (Tiefe 1–3 px per Seed, nicht `x % 4`), einzelne Halme 1 px
  `grass_lt` vorne, Schatten unter dem Überhang 1 px `cliff_ink` + 1 px `cliff_dk`.

### 2. `grass_dark`-Zonen wirken blockig
**Problem:** `edgeGroup` ordnet `grass_dark` der Gruppe `grass` zu → **keine Übergänge**; die Zonen erscheinen
als harte 16-px-Rechtecke/Treppen (Szene oben links). Helligkeitssprung `grass_md`→`grass_dk` ist groß, und die
großen „Y“-Halme in `grass_ink` wiederholen sich sichtbar.
**Anweisung:**
- Eigene Edge-Gruppe `grass_dark` mit Priorität **8** (über `grass`), Overlays `grass_dark_n/s/w/e`:
  unregelmäßiger Saum 2–4 px in `grass_dk`, davor 1 px Dither-Reihe (jedes 2. Pixel `grass_dk` auf `grass_md`).
  Ecken: wenn zwei Seiten aktiv, Zacken abrunden (1–2 px Ecke weglassen).
- Textur: Halme kleiner (2–3 px „V“, nicht 5-px-„Y“), max. 5 pro Tile, 30 % davon `grass_md` statt `grass_ink`;
  1–2 Lichtpixel `grass_md` oben links. Ziel: weicher Halbschatten, kein Muster.
- Map-seitig (Gameplay, nur Hinweis): `grass_dark` nur unter Baumkronen/Waldrand, nicht als ganzes Plateau.

### 3. Klippen-Enden (Ost/West) fehlen
**Problem:** Plateaus enden seitlich mit glattem senkrechten Schnitt; ALttP rundet Klippenecken mit
Felsabschluss ab. Wirkt wie ausgeschnittener Block.
**Anweisung (Regie-Entscheid nötig):** Face-Vertrag um Endstücke erweitern, z. B. `faces.rock_l/rock_r` (je
`[0..2]`): 4–5 px schmaler werdender Brocken, Außenkante `cliff_dk` (rechts) bzw. `cliff_lt` (links), Grasüberhang
rundet 2 px um die Ecke. Bis dahin: rechte Spalte jeder Face-Kachel mit 1 px `cliff_ink` (ist bei rock als
`rock_ink` schon vorhanden – auf cliff umstellen).

## P2 – Sollte

### 4. `shallow` wirkt wie Eis
**Problem:** sehr helles Cyan mit weißem Saum (shallow-Edge `rimLt: foam`) → liest sich als Eisscholle.
**Anweisung:** Grundton `water_lt` zu ~50 % mit `sand`/`dirt_lt`-Pixeln (Kiesel-Muster, 2×1) durchsetzen, damit
der Boden durchscheint; Saum zu tiefem Wasser `water_md` statt `foam`; `foam` nur für 2–3 kurze Wellenstriche
pro Tile (animiert).

### 5. Sand↔Wasser- und Gras↔Sand-Ränder: Reißverschluss-Zacken
**Problem:** Zacken in festem Abstand/gleicher Tiefe (Edge-Sets `teeth: true`) → maschinelles Sägeblatt.
**Anweisung:** Zackenposition per Seed jittern (Abstand 2–5 px, Tiefe 1–3 px), alle 6–10 px eine Lücke ohne
Zacke; Wasserrand zusätzlich 1 px `water_ink`-Linie direkt unter dem Ufer (Uferschatten, Licht oben links).

### 6. Felsfundament unter Steinplatz / Haus
**Problem:** Unter `stone_floor`-Plateau steht die (graue) rock-Klippe → zwei graue Flächen verschmelzen.
**Anweisung:** Nach Fix 1 (warm) erledigt sich der Kontrast. Map-seitig gemauerte Plätze besser mit Face `brick`.

### 7. `house` – Dach flach und gleichförmig
**Problem:** Ziegelreihen exakt gleich, keine Firstkante, kein Dachüberstand-Schatten auf der Fassade.
**Anweisung:** Firstlinie oben 1 px `red_lt` + 1 px `heart_hi`-Glanz links; jede 2. Ziegelreihe um 2 px versetzt;
rechte Dachhälfte eine Stufe dunkler (`red_dk` als Grundton) für Volumen; unter der Traufe 2 px `shadow` auf der
Fassade. Außenkontur Dach `wood_ink`/`red_dk`, nicht offen zum Hintergrund.

### 8. `tree` – Stammfuß
**Problem:** Stammfuß als symmetrisches Dreieck („Zelt“), wirkt starr.
**Anweisung:** 2 asymmetrische Wurzeln (links 3 px, rechts 2 px), Wurzelschatten `wood_ink` rechts, 1 px
`grass_dk`-Kontaktsaum am Boden.

## P3 – Kann

9. **`plinth_earth`:** Steine gleichmäßig verteilt; 2–3 größere Brocken (5×3) und Gruppen bilden, oberste 2 px
   Lichtkante statt einer Doppellinie. Wurzeln dürfen 1–2 px aus der Oberkante ragen.
10. **`grass_tall` / Hecke (Szene oben rechts):** wirkt als gleichförmiger Streifen; Oberkante mit 3 Höhen
    (2/3/4 px) variieren, Spitzen `grass_lt`, Fußlinie `grass_ink`.
11. **`stairs`:** in der Szene nicht verbaut – Prüfung ausstehend; Stufen bitte ebenfalls auf cliff-Ramp umstellen
    (Oberkante `cliff_hi`, Front `cliff_md`, Fuge `cliff_ink`), damit sie zur Klippe passen.
12. **Bridge-Nutzung:** `bridge` auf trockenem Pfad (Szene Mitte) wirkt wie Fremdkörper – Map-Hinweis an Gameplay.

## Geprüft und OK
- **Held** (alle 44 Sprites): 16×24, Kopf ≈ 40 %, Outline `ink`, Tunika hebt sich vom Gras ab, Richtungen
  eindeutig, Angriff 32×32 mit Anker, Framezahlen gemäß §7 (walk 6f/11fps, attack 5f/18fps). Sehr ALttP-nah.
- **Soldat, Octorok, Schleim, Fledermaus, Golem, NPCs:** Silhouetten klar, Farbcodierung rot/blau/violett,
  nicht grün. Golem-Hurt als Weißflash OK.
- **Objekte/Pickups/Icons:** Truhe, Topf, Schild, Rupien, Herzen, Schlüssel, Bombe – sauber, Lichtkante oben links.
- **Wasser (tief):** gute Glanzstriche, Phasenversatz. **Pfad/Erde/Sand-Tiles:** ruhig, lesbar.
- **FX:** Slash-Bögen, Poof, Spark entsprechen §7.
- **Schatten:** Renderer-Ellipsen unter Entities, keine eingebackenen Bodenschatten. Kein `#000000`.
- Magenta-Pixel unter Sprites in der Galerie = Anker-Markierung der Galerie (kein Asset-Fehler).
