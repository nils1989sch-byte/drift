# Abgleich-Checkliste (Phase 2)

Prüfung von Screenshots/Renderings gegen `docs/STYLE_GUIDE.md`. Jeder Punkt: ✔ / ✘ / n.a. + Fundstelle.
Automatisch prüfbare Punkte sind mit **[auto]** markiert (Pixel-Analyse der Canvases aus `buildAssets()`).

## A. Raster & Technik
- [ ] **[auto]** Alle Tiles exakt 16×16, Faces 16×16, Edges 16×16.
- [ ] **[auto]** Tiles und Sprites haben nur Alpha 0 oder 255 (keine Halbtransparenz, kein Antialiasing).
- [ ] **[auto]** Jedes Sprite hat `ax`/`ay` oder ist korrekt unten-mittig verankert; Angriffssprites mit Anker.
- [ ] Kein verschwommenes Pixel bei Zoom (imageSmoothing aus, ganzzahlige Positionen).
- [ ] Tiles kacheln nahtlos (3×3-Kachelung ohne sichtbare Naht oder auffälliges 16er-Raster).
- [ ] Varianten-Tiles (grass, dirt, path …) erzeugen kein erkennbares Wiederholungsmuster auf 10×10 Tiles.

## B. Farbe
- [ ] **[auto]** Kein reines Schwarz `#000000` und kein reines Weiß `#ffffff` in Tiles/Sprites.
- [ ] **[auto]** Alle Farben stammen aus der Masterpalette (Abweichung ≤ 0 nach 8er-Quantisierung).
- [ ] **[auto]** Max. 15 Farben (+Transparenz) pro Sprite-Frame; max. 8 Farben pro Tile.
- [ ] Ramps hue-geshiftet: Schatten kühler (blau/violett), Lichter wärmer (gelb) – kein reines Abdunkeln mit Grau.
- [ ] Held hebt sich klar vom Gras ab (Tunika gelber/heller, Outline vorhanden).
- [ ] Gegner nicht überwiegend grün; Pickups heller/satter als Boden.
- [ ] Graustufen-Test: Figuren und Hindernisse lesbar ohne Farbe.

## C. Licht & Schatten
- [ ] Lichtkante oben links (hellste Stufe an Ober-/Linkskanten), Schatten unten rechts – an jedem Objekt.
- [ ] Keine Sprites mit eigenem Boden-Ellipsenschatten (macht der Renderer); große Objekte nur versetzter Pixel-Schatten.
- [ ] AO/Kontaktschatten nicht doppelt (Tile + Renderer).
- [ ] Schatten farbig (`shadow`/Ramp), nicht schwarz.

## D. Outlines
- [ ] Figuren: geschlossene 1 px Outline in `ink`/dunkler Materialfarbe, keine Doppellinien.
- [ ] Boden-Tiles ohne Outline.
- [ ] Aufrechte Objekte mit Outline in der dunkelsten Materialstufe (nicht `ink`).
- [ ] Innenlinien sparsam und in Materialfarbe; Linien ohne 1-3-1-Jaggies.

## E. Höhen & Klippen
- [ ] Face `rock` hat **vertikale Strukturrillen** (Rippen hell links / dunkel rechts).
- [ ] Face `[0]` mit Grasüberhang, `[2]` mit dunklem Fuß; Mittelstück kachelt vertikal nahtlos.
- [ ] Stufenhöhe 16 px pro Level korrekt, Plateau-Oberkante mit Lichtkante.
- [ ] Treppen klar als begehbar erkennbar (horizontale Stufenlinien).
- [ ] Verdeckung: Figur hinter Klippe/Baum wird korrekt verdeckt.

## F. Proportionen
- [ ] Held 16×24 (±2 px), Kopf ≈ 40 % der Höhe; Richtungen eindeutig unterscheidbar.
- [ ] Kleine Gegner 16×16, Soldaten/NPC ≤ 16×28.
- [ ] Objekte im Maßstab: Busch/Stein/Topf = 1 Tile, Baum 2×2,5 Tiles, Haus ≥ 3 Tiles breit.

## G. Animation
- [ ] Framezahlen und -dauern gemäß Tabelle (Guide §7), keine Frames < 33 ms.
- [ ] Laufzyklus ohne Rutschen (Schrittweite passt zur Geschwindigkeit), Kopf-Bob 1 px.
- [ ] Schwertschlag: Ausholen sichtbar, `hit`-Event auf Schwungframe, `fx_slash` deckungsgleich mit Schwert.
- [ ] Treffer-Feedback: Flash + Hitstop + Funke; Unverwundbarkeits-Blinken.
- [ ] Wasser/Blumen animiert, Wasser mit Phasenversatz (kein synchrones Flimmern).

## H. UI
- [ ] HUD-Layout: Item-Box oben links, Rupien/Schlüssel oben Mitte, Herzen oben rechts.
- [ ] HUD ganzzahlig skaliert, scharf, nicht vom Tilt-Shift betroffen.
- [ ] Pixel-Font lesbar, Umlaute vorhanden, Text mit `ink`-Schatten.
- [ ] Herzen voll/halb/leer eindeutig unterscheidbar.
- [ ] Touch-Buttons ≥ 44×44 CSS-px, halbtransparent, verdecken den Held nicht.

## I. Diorama
- [ ] Sockel mit Erdschnitt sichtbar, dunkler als die Spielfläche; Modell-Schatten unten rechts.
- [ ] Tilt-Shift: Fokusband scharf um den Held, Ränder weich; Stärke wächst mit Zoom.
- [ ] Vignette dunkelblau, ≤ 25 %; kein Farbfilter, der Paletten-Farben verfälscht.
- [ ] Lebendigkeit: mind. 2 animierte Umgebungselemente pro Screen (Wasser, Gras, Partikel).

## J. Lesbarkeit bei Zoom 1×
- [ ] Held, Gegner, Pickups, Hindernisse in < 1 s unterscheidbar.
- [ ] Boden kontrastarm (keine harten Muster), Interaktives hebt sich ab.
- [ ] Begehbar vs. blockiert eindeutig (Kontaktschatten/Fuß an Hindernissen).
