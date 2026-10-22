# DRIFT – Style Guide (verbindlich)

Besitzer: Referenz-Agent. Gilt für alle Grafiken in `src/art/`, Animationen in `src/anim/` und HUD in `src/ui/`.
Vorbild: *A Link to the Past* (SNES, 1991) in Lesbarkeit und Proportionen, aber eigenes Design. Wir übernehmen
keine Nintendo-Grafiken und kopieren keine Sprites Pixel für Pixel. Alles wird per Code gemalt.
Prüfkriterien: `docs/reference/CHECKLIST.md`, Quellen: `docs/reference/SOURCES.md`.

---

## 1. Grundraster & Perspektive

- **Tile 16×16** Weltpixel, intern aus **4 Subtiles à 8×8** gedacht (wie SNES-Hardware). Details und Muster
  wiederholen sich höchstens im 8er- oder 16er-Raster; Übergangs-Tiles werden aus 8×8-Vierteln komponiert.
- **3/4-Top-Down** („Draufsicht mit Frontflächen“): Böden sieht man von oben, alles Aufrechte (Bäume, Häuser,
  Klippen, Figuren) zeigt zusätzlich seine **Südseite/Front**. Keine echten Seitenflächen nach Ost/West, nur
  1 px Kantenschattierung.
- **Höhe:** 1 Stufe = `LEVEL = 16` px Bildschirmversatz. Eine Klippe ist pro Stufe genau ein 16 px hohes
  Face-Stück. Die Oberkante eines Plateaus bekommt eine **1 px helle Lichtkante** (der Renderer setzt sie
  zusätzlich), die Unterkante einen **2–3 px dunklen Fuß** (Kontaktschatten).
- **Pixel-Grid ist heilig:** keine Subpixel-Positionen, kein Antialiasing, keine Rotation/Skalierung von Sprites
  zur Laufzeit (Ausnahme: Kamera-Zoom ganzzahlig oder Nearest-Neighbor). `imageSmoothingEnabled = false`.

## 2. Licht

- **Hauptlicht kommt von oben links** (ca. 10–11 Uhr, leicht von vorne).
  - Oberkanten und linke Kanten: hellste Stufe der Ramp (Lichtkante, 1 px).
  - Unterkanten und rechte Kanten: dunkle Stufe. Volumen-Schatten fallen nach **unten rechts**.
- **Schlagschatten** von Figuren/Objekten: der Renderer zeichnet eine flache Pixel-Ellipse unter dem Fußpunkt
  (`rgba(16,12,32,0.28)`). Sprites malen **keinen eigenen Bodenschatten**, außer bei großen, statischen
  Objekten (Haus, Baum), die einen nach rechts unten versetzten Schatten (Farbe `shadow`, 30–40 % Deckung,
  Pixel-Kante, keine Weichzeichnung) als eigenes Element mitbringen dürfen.
- Ambient Occlusion (Klippenfuß, Wandansatz) macht der Renderer; Tiles dürfen sie nicht doppelt einbacken.
- **Schatten sind farbig:** nie mit Schwarz oder Grau abdunkeln, sondern zur nächstdunkleren Ramp-Stufe oder
  zum Schattenton `shadow` (violett-blau) gehen.

## 3. Outlines

- **Kein reines Schwarz (#000000)** irgendwo im Spiel, auch nicht als Outline. Dunkelste erlaubte Farbe: `ink` #181020.
- **Figuren & bewegliche Objekte:** geschlossene 1 px Outline. Außen in `ink` oder der dunkelsten Stufe
  des angrenzenden Materials („Selout“: an beleuchteten Stellen oben links darf die Outline eine Stufe heller
  sein). Innenlinien nur für wichtige Trennungen (Gesicht/Haar, Arm/Körper, Schild), in der dunklen
  Materialfarbe, nie in `ink`.
- **Boden-Tiles:** keine Outline. Formen entstehen nur über Ramp-Stufen. Gras-Büschel, Steine und Blumen auf
  Tiles haben höchstens einen 1 px dunklen Schatten unten rechts.
- **Aufrechte Objekte** (Baum, Busch, Fels, Topf, Schild, Truhe, Haus): Outline in der dunkelsten Materialstufe
  (`grass_ink`, `rock_ink`, `wood_ink` …), damit sie vom Boden abheben, aber nicht wie Figuren wirken.
- Keine Doppellinien, keine „Treppchen“-Jaggies: Linienverläufe 1-2-3 oder 3-2-1 statt 1-3-1.

## 4. Farbe

### 4.1 Hardware-Anmutung
SNES = 15-bit BGR555, 32 Stufen pro Kanal. Darum liegen **alle Kanalwerte auf 8er-Schritten** (0, 8, …, 248),
höchster Wert 248 (#f8). Pro Sprite höchstens **15 Farben + Transparenz** (eine SNES-Subpalette), Ziel: 8–12.
Tiles: höchstens 8 Farben pro 16×16-Tile.

### 4.2 Ramp-Regeln
- Jedes Material ist eine **Ramp aus 3–5 Stufen** (`_ink` → `_dk` → `_md` → `_lt` → `_hi`).
- **Hue-Shift:** Schatten wandern Richtung **Blau/Violett** (kälter), Lichter Richtung **Gelb/Orange** (wärmer),
  pro Stufe ca. 10–25° Farbton. Sättigung ist in der Mitte am höchsten, an beiden Enden geringer.
- Helligkeitsabstand zwischen Nachbarstufen deutlich (≥ 12 % Luminanz), sonst Stufe streichen.
- Nur Farben der Masterpalette verwenden. Neue Farbe nötig → Referenz-Agent fragen, er ergänzt sie hier.
- Transparenz per Alpha nur für Renderer-Effekte (Schatten, AO, Tilt-Shift, Flash) und FX-Fades; Sprites und
  Tiles selbst sind **voll deckend** (Alpha 0 oder 1).

### 4.3 Masterpalette (74 Farben)
Schreibweise `name #rrggbb` – so in `assets.palette` übernehmen.

```
# Neutral / Tinte (3)
ink          #181020   dunkelste Farbe im Spiel (Outlines, Text-Schatten)
shadow       #302848   Schlagschatten-/Schattenton (violett)
night        #283048   UI-Panel-Grund, Dunkelheit

# Gras (5)               Blaugrün im Schatten -> Gelbgrün im Licht
grass_ink    #183828
grass_dk     #286840
grass_md     #48a050
grass_lt     #88c858
grass_hi     #d0e888

# Erde / Pfad / Sand (6)
dirt_ink     #402028
dirt_dk      #784838
dirt_md      #a87048
dirt_lt      #d0a068
dirt_hi      #f0d098
sand         #e0c888

# Klippe / Oberwelt-Fels (5)   warm ocker/khaki – für Face `rock` (ALttP-Look), NICHT grau
cliff_ink    #402830
cliff_dk     #705040
cliff_md     #a08058
cliff_lt     #c8a870
cliff_hi     #e8d098

# Fels / Stein-Objekte (5)  violettgrau -> warmgrau/beige (hebbare Steine, Golem, Statue)
rock_ink     #282038
rock_dk      #504860
rock_md      #807880
rock_lt      #b0a898
rock_hi      #e0d8c0

# Wasser (6)
water_ink    #102050
water_dk     #184888
water_md     #2878c0
water_lt     #58b0e0
water_hi     #a8e0f0
foam         #e8f8f8

# Holz (5)
wood_ink     #301820
wood_dk      #603028
wood_md      #985038
wood_lt      #c88048
wood_hi      #e8b870

# Stein / Dungeon (5)     kühles Blaugrau
stone_ink    #181830
stone_dk     #303858
stone_md     #506080
stone_lt     #8090a8
stone_hi     #b8c8d0

# Haut / Haar (5)
skin_dk      #b05838
skin_md      #e89868
skin_lt      #f8d0a0
hair_dk      #a85820
hair_md      #e8a838

# Held-Tunika (4)         gelbstichiger und satter als Gras -> hebt sich vom Boden ab
tunic_ink    #183010
tunic_dk     #307818
tunic_md     #58b828
tunic_lt     #a8e048

# Metall / Gold (7)
metal_dk     #485070
metal_md     #8898b8
metal_lt     #c8d8e8
white        #f8f8f8
gold_dk      #a86010
gold_md      #e8b028
gold_lt      #f8e878      (gold_lt zählt doppelt als Highlight-Gelb)

# UI (5)
heart_dk     #901828
heart_md     #e03030
heart_hi     #f8a088
magic        #40c860
ui_frame     #d8c8a0

# Gegner (9)
red_dk       #702030      Octorok
red_md       #c84040
red_lt       #f08060
blue_dk      #283070      Soldat
blue_md      #4868c8
blue_lt      #90b0f0
purple_dk    #502878      Schleim, Fledermaus
purple_md    #8848b8
purple_lt    #c890e0

# Effekte & Pickups (4)
fx_yellow    #f8e058
fx_orange    #f88830
fx_cyan      #98f0f0
rupee_green  #30c858      (rupee_blue = blue_md/blue_lt, rupee_red = red_md/red_lt)
```

**Kontrast Held ↔ Boden:** Tunika `tunic_md` (#58b828) ist gelber und heller als `grass_md` (#48a050); Outline
`ink` trennt zusätzlich. Gegner nutzen Rot/Blau/Violett und dürfen nie überwiegend grün sein.

## 5. Tile-Katalog (`src/data/tiles.js`)

Alle 16×16, deckend, ohne Outline, nahtlos kachelbar. „Varianten“ = mehrere Canvases mit `arr.mode='variant'`
(Renderer wählt per Zellen-Hash). „Animiert“ = Frames mit `arr.fps`, optional `arr.phase=true`.

| ID | Beschreibung | Farben | Frames |
|----|--------------|--------|--------|
| `grass` | Grundgras: `grass_md`-Fläche, 6–10 kleine 2–3 px „V“-Halme in `grass_dk`, 2–4 Glanzpixel `grass_lt`. Muster nicht im 8er-Raster spiegeln. | grass_dk/md/lt | 3 Varianten |
| `grass_dark` | Schattiges Gras (unter Bäumen, Waldrand): Basis `grass_dk`, Halme `grass_ink`, kaum Lichter. | grass_ink/dk/md | 2 Varianten |
| `grass_flowers` | Gras + 2–3 Blüten (3 px Kreuz) in `white`/`fx_yellow`/`heart_hi`, Mitte `gold_md`. | + Blüten | 2 Frames, fps 2 (leichtes Wippen) |
| `grass_tall` | Hohes Gras/Busch-Gras, schneidbar. Büschel wirken 3–4 px hoch (dunkler Fuß `grass_ink`, ragen optisch über die Tile-Oberkante), Spitzen `grass_lt`. Verdeckt untere Hälfte der Füße (Renderer/Game). | grass_ink..lt | 1 (+ `fx_leaf` beim Schnitt) |
| `dirt` | Erdfläche: `dirt_md`, Kiesel 1–2 px `dirt_lt` mit Schattenpixel `dirt_dk`. | dirt_dk/md/lt | 2 Varianten |
| `path` | Festgetretener Weg, heller als dirt: Basis `dirt_lt`, wenige Kiesel `dirt_md`/`dirt_hi`. Ränder zu Gras über Edge-Overlays. | dirt_md/lt/hi | 2 Varianten |
| `sand` | Sand/Ufer: `sand`, feine Punktstreuung `dirt_lt`, gelegentlich Glanz `dirt_hi`. | sand, dirt_lt/hi | 2 Varianten |
| `water` | Tiefes Wasser: `water_dk`, horizontale Glanzstriche (3–5 px) `water_md`/`water_lt`, die über die Frames wandern. | water_ink..lt | 4 Frames, fps 4, phase |
| `water_edge_n` | Wasser mit Uferkante oben: obere 3 px `water_ink` (Kantenschatten unter dem Ufer), darunter `foam`-Wellenlinie, Rest wie `water`. | + foam | 4 Frames, fps 4 |
| `shallow` | Flachwasser (begehbar): `water_lt` über durchscheinendem Sand-Muster (Pixel aus `sand`), Wellenringe `foam`. | water_md/lt, sand, foam | 3 Frames, fps 3 |
| `stairs` | Treppe in der Klippe: 4 Stufen à 4 px; jede Stufe oben 1 px `rock_hi`, Front `rock_md`, Fuge `rock_ink`. Seitenwangen 2 px `rock_dk`. | rock-Ramp | 1 |
| `bridge` | Holzbrücke, Planken quer (je 4 px), Fugen `wood_ink`, Nagelpixel `metal_md`, Kanten links/rechts `wood_dk`. | wood-Ramp | 1 |
| `stone_floor` | Gepflasterter Platz/Burghof: 8×8-Platten, Fuge `stone_dk`, Oberkante jeder Platte 1 px `stone_hi`. | stone_dk..hi | 2 Varianten |
| `dungeon_floor` | Dungeonboden: dunkler als stone_floor, Basis `stone_dk`, 8×8-Raster mit Fuge `stone_ink`, vereinzelte Risse. | stone_ink..md | 2 Varianten |
| `dungeon_wall` | Wand-Oberseite (solid): Mauerkrone `stone_md` mit Ziegelversatz, innen dunkler Rand `stone_ink` 2 px. Front kommt über Face `brick`. | stone-Ramp | 1 |
| `pit` | Loch: Rand oben 3 px Bodenfarbe → Stufe in `stone_ink`, Inneres `ink` mit 1–2 px `night`-Verlauf. Kein Schwarz. | ink, night, stone_ink | 1 |
| `wood_floor` | Innenraum-Dielen längs (4 px breit, versetzte Stöße), Fugen `wood_dk`, Maserung `wood_lt`. | wood_dk..lt | 1 |
| `void` | Außerhalb der Karte; wird nicht gezeichnet (Diorama-Hintergrund sichtbar). Falls nötig: `night`. | – | – |

**Faces** (`assets.faces[faceId]`, 16×16, vertikal gekachelt; `[0]` oberes Stück, `[1]` Mittelstück, `[2]` Fuß):
- `rock` – Oberwelt-Klippe wie ALttP, **cliff-Ramp (warm ocker), nicht rock/grau**. Aufbau aus
  **unregelmäßigen Felsbrocken/Platten** (4–10 px breit, 5–12 px hoch, verschiedene Größen), deren Fugen
  **überwiegend vertikal/schräg** verlaufen (Strukturrillen), nie als durchgehende horizontale Reihe
  (sonst wirkt es wie Mauer/Palisade). Jeder Brocken: Lichtkante links/oben `cliff_hi`/`cliff_lt`, Fläche
  `cliff_md`, rechte/untere Seite `cliff_dk`, Fuge `cliff_ink`. Helligkeit nimmt **nach unten ab** (`[0]` hellste
  Brocken, `[2]` überwiegend `cliff_dk`). Mittelstück in ≥ 3 Varianten (Zellen-Hash), damit kein 16-px-Takt
  sichtbar ist. `[0]` mit Grasüberhang (`grass_md`, unregelmäßige Zacken 1–3 px, Schatten `grass_ink`),
  `[2]` Fuß: Geröll + 2 px `cliff_ink`.
- `dirt` – Erdkante: horizontale Schichtbänder `dirt_dk`/`dirt_md`, einzelne Steine `rock_md`, Wurzeln `wood_dk`;
  `[0]` mit Grasüberhang wie bei rock.
- `brick` – Dungeon-/Burgmauer: Ziegel 8×4, halber Versatz, Fuge `stone_ink`, Ziegeloberkante `stone_lt`.
- optional `plinth_earth`, `plinth_stone` – Sockel-Erdschnitt (kachelbar, z. B. 32×40): Erdschichten mit Steinen,
  Wurzeln; dunkler als Spielfläche (dirt_ink..dirt_md bzw. stone_ink..stone_md), damit die Spielfläche führt.
- **Edges** (`assets.edges['<gruppe>_<n|s|w|e>']`, transparente 16×16-Overlays): weiche, unregelmäßige Ränder
  (Gras über Erde/Pfad/Sand, Sand über Wasser). Ränder unregelmäßig mit 2–4 px Zacken, Gras-Rand oben dunkler.
  Zacken nie im festen Takt (kein „Reißverschluss“): Zackenbreite/-tiefe per Seed variieren.
- **Jede Material-/Helligkeitsgrenze braucht einen Übergang** – auch `grass` ↔ `grass_dark` (eigene Edge-Gruppe
  oder Dither-Saum 2–4 px). Harte 16-px-Rechteckkanten zwischen Bodenarten sind verboten.

## 6. Objekte & Sprites

### 6.1 Proportionen
- **Held:** 16×24 Bounding-Box (Anker unten-mittig). Kopf ≈ 10–11 px breit, 9–10 px hoch (≈ 40 % der Höhe,
  „chibi“), Körper 8–9 px, Beine 4–5 px. Augen 1×2 px, im Blick nach oben unsichtbar.
  Angriffs-Frames 32×32 (Schwert ragt bis 12 px über Körper hinaus), Anker `ax`,`ay` auf den Fußpunkt setzen.
- **Menschliche NPCs/Soldaten:** 16×24 bis 16×28. **Kleine Gegner** (Schleim, Octorok, Fledermaus): 16×16.
- Figuren-Silhouette muss in jeder Richtung eindeutig sein (Gesicht/Rücken/Profil). `left` darf gespiegeltes
  `right` sein – dann Schild/Schwerthand im Spiegel prüfen (Schild zeigt immer nach vorn zur Kamera-Seite).

### 6.2 Objekt-Schlüssel (Anker unten-mittig, Maße Richtwert)
| Schlüssel | Maße | Kurzbeschreibung |
|-----------|------|------------------|
| `tree` | 32×40 | Runde Krone aus 3–4 Blattballen (grass-Ramp, Licht oben links), Stamm `wood_dk/md` 6 px, Wurzelfuß; Kronenschatten unten rechts. |
| `tree_small` | 16×24 | Junger Baum/Strauch-Baum, 1 Kronenballen. |
| `bush` | 16×16 | Kugeliger Busch, dunkler als Gras (grass_ink-Outline, `grass_dk/md/lt`), hebbar/schneidbar. |
| `bush_cut` | 16×16 | Stumpf nach Schnitt: flacher Rest mit hellen Schnittkanten. |
| `rock` | 16×16 | Hebbarer Stein, rock-Ramp, Lichtkante oben links, 2–3 Kanten-Facetten. |
| `pot` | 16×16 | Tontopf: dirt-/wood-Ramp, Rand oben oval `dirt_hi`, Öffnung `dirt_ink`. |
| `sign` | 16×16 | Holztafel auf Pfosten, Schriftandeutung 3 Linien `wood_dk`. |
| `chest_closed` / `chest_open` | 16×16 | Holztruhe mit Gold-Beschlägen (`gold_dk/md/lt`); offen: Deckel nach hinten, Inneres `wood_ink`. |
| `house` | 48–64 breit | Fachwerkhaus: Dach `red_dk/md` oder `wood`, Front mit Tür (`wood_ink`), Fenster `water_lt`/`fx_yellow`; Dachüberstand wirft Schatten. |
| `fence` | 16×16 | Pfosten + 2 Querlatten, wood-Ramp. |
| `flower` | 8×8 | Einzelblume, 2 Frames Wippen. |
| `grass_tall` | 16×16 | Sprite-Variante des Tiles für Verdeckung (Vordergrund-Halme). |
| `heart_pickup` | 8×8 | Herz `heart_md`, Highlight `heart_hi` oben links, Outline `heart_dk`. |
| `rupee_green/blue/red` | 8×14 | Sechseck-Kristall, 3 Facetten (dk/md/lt) + 1 `white`-Glanz; 3–4 Frames Funkeln. |
| `key_small` | 8×16 | Schlüssel `gold`-Ramp. |

### 6.3 Gegner
- `octorok_*` – rundlich, Rüssel in Blickrichtung, `red`-Ramp. `soldier_*` – Helm + Rüstung `blue`-Ramp,
  Speer/Schwert `metal`. `slime_idle` – Tropfenform, `purple`-Ramp, Glanzfleck `white`. `bat_fly` – `purple_dk`
  Flügel, Augen `fx_yellow`. `npc_elder_*` – Bart `white`/`metal_lt`, Robe `wood` oder `stone`-Ramp.

## 7. Animation

Basis: Game-Loop in Sekunden; Frame-Dauern in ms. „Once“ = einmal, dann `done`. Events per Frame.

| Animation | Frames | Dauer/Frame | Modus | Hinweise |
|-----------|--------|-------------|-------|----------|
| `hero_idle_<dir>` | 1–2 | 600 ms | Loop | optional Atem-Pixel (Kopf 1 px). |
| `hero_walk_<dir>` | 6 (min. 4) | 90 ms | Loop | Kontakt–Pass–Kontakt; Kopf hüpft 1 px auf den Pass-Frames. Laufgeschw. ≈ 80–90 px/s. |
| `hero_attack_<dir>` | 5 | 40/40/50/60/80 ms | Once | F0 Ausholen, F1–F2 Schwung (Bogen 90–180° vor dem Körper), `event:'hit'` auf F2, F3–F4 Nachschwingen. Gesamt ≈ 270 ms. Dazu `fx_slash_<dir>`. |
| `hero_hurt_<dir>` | 2 | 60 ms | Loop während Knockback | Renderer-Flash weiß; Rückstoß 200–250 ms, danach 1,0 s Unverwundbarkeit mit Blinken (10 Hz). |
| `hero_lift_<dir>` | 3 | 80 ms | Once | Bücken – Greifen – Objekt über Kopf. |
| `hero_carry_<dir>` | 4 | 110 ms | Loop | Laufen mit Armen oben; Objekt 1 px Mitwippen. |
| `hero_fall` | 4 | 120 ms | Once | Figur wird pro Frame kleiner (gemalt, nicht skaliert), dreht sich. |
| `hero_item_get` | 1 | (1200 ms halten) | Once | Beide Arme hoch, Item über Kopf. |
| `octorok_walk_<dir>` | 2 | 150 ms | Loop | Rüssel pumpt. |
| `soldier_walk_<dir>` | 4 | 125 ms | Loop | |
| `slime_idle` | 3 | 180 ms | Loop | Squash & Stretch (±2 px Höhe, Volumen bleibt). |
| `bat_fly` | 2–3 | 80 ms | Loop | Flügel oben/unten. |
| `npc_*_idle_<dir>` | 2 | 500 ms | Loop | |
| `fx_slash_<dir>` | 3 | 40 ms | Once | Bogen `white` → `metal_lt` → `metal_md`, wird dünner. |
| `fx_poof` | 4 | 60 ms | Once | Rauchwolke `white`/`rock_lt`/`rock_md`, wächst & zerfällt. |
| `fx_leaf` | Partikel | 600–900 ms Leben | – | 2×2/3×2 Blätter grass-Ramp, fallen trudelnd. |
| `fx_spark` | 3 | 40 ms | Once | Treffer-Stern `white`/`fx_yellow`/`fx_orange`. |
| `fx_splash` | 4 | 70 ms | Once | Tropfen `foam`/`water_lt`. |
| Tiles `water` | 4 | fps 4 | Loop | phase pro Zelle. |
| `rupee_*` | 3–4 | 120 ms | Loop | Glanzpixel wandert. |

Regeln: Easing für Bewegungen (Knockback ease-out, Sprung/hop Parabel); keine Animation unter 33 ms pro Frame;
Treffer-Feedback = 2 Frames Hitstop (≈ 50 ms) + Flash + `fx_spark` + SFX.

## 8. UI / HUD

- Layout wie ALttP, aber eigenes Design: **oben links** Item-Box (20×20, Rahmen `ui_frame` mit `ink`-Outline,
  darin aktuelles Item-Icon), daneben **Magie-/Ausdauer-Leiste** optional (`magic`); **oben Mitte**
  Rupien-Zähler (Icon + 3-stellig) und Schlüssel; **oben rechts** Herzen in Reihen à 10, Überschrift-Zeile
  „LEBEN“ optional.
- Herzen 8×8 (voll / halb / leer: leer = nur Outline `heart_dk` + Füllung `night`). Rupien-Icon 8×8.
- HUD sitzt auf transparentem Grund oder auf schmalem Band `night` mit 70 % Deckung; nie über Spielfiguren-
  Höhe hinaus (max. 24 px logische Höhe bei 1×).
- **Pixel-Font** 5×7 bzw. 6×8 Glyphen (Großbuchstaben + Ziffern + Umlaute ÄÖÜß + Satzzeichen), Text `white` mit
  1 px Schatten `ink` nach unten rechts. Dialogbox unten, 3 Zeilen, Rahmen `ui_frame` 2 px + `ink`-Outline,
  Grund `night` 90 %, Textanimation 30–40 Zeichen/s, Weiter-Pfeil blinkend (2 Hz).
- HUD wird in ganzzahligem Vielfachen skaliert (2×, 3×, 4×) und ist **nicht** vom Tilt-Shift/Zoom betroffen.
- **Touch:** Stick links unten (Ø ≈ 22 % der kurzen Bildschirmseite), Buttons rechts unten (A groß, B, Item),
  Menü/Zoom klein oben rechts. Halbtransparent (`white` 25–35 %, aktiv 55 %), Beschriftung im Pixel-Font,
  Mindestgröße 44×44 CSS-px. Buttons im Diamant-Layout wie SNES-Pad.

## 9. Diorama-Regeln (2,5D-Look)

Ziel: Die Welt wirkt wie ein **handgebautes Miniaturmodell auf einem Tisch** (vgl. HD-2D/Octopath, Tunic,
Eastward, Sea of Stars), bleibt aber reines Pixel-Art. In 2D-Canvas umsetzbare Mittel:

1. **Sockel/Erdschnitt** unter der Spielfläche (Renderer `drawDiorama`): Erdschichten dunkler als die
   Spielfläche, 1–2 px helle Oberlippe, Schlagschatten des Modells auf den „Tisch“ nach unten rechts.
2. **Echte Höhenstufen** mit Faces, Lichtkante oben/links, dunkle Kante rechts, AO am Fuß (Renderer).
3. **Tilt-Shift:** scharfes Band in der Bildmitte, oben/unten weich unscharf (Downsample-Blur, Stärke steigt
   mit Zoom). HUD bleibt scharf. Spielfiguren im Fokusband nie unscharf.
4. **Leicht erhöhte Sättigung & warmes Licht:** Palette ist bewusst etwas satter als ALttP; Schatten kühl
   violett. Kein globaler Farbfilter, der Palette-Farben verfälscht (max. Vignette 25 % am Rand).
5. **Vignette** dunkel-blau (`night`), nicht schwarz.
6. **Hintergrund außerhalb des Dioramas:** dunkler radialer Verlauf (`#2d3550` → `#0d0f1c`), keine Details.
7. **Kleine Lebendigkeit:** wippendes Gras, Wasserschimmer, Partikel (Blätter, Glühwürmchen), Figuren-Schatten –
   das verkauft „Miniatur“ mehr als Effekte.
8. **Nicht umsetzen:** echte Normal-Maps, Bloom auf allem, Chromatic Aberration, Antialiasing auf Pixel-Kanten.

## 10. Lesbarkeit

- Bei **Zoom 1×** (16 px Tile = 16 Bildschirmpixel) müssen Held, Gegner, Pickups und begehbar/blockiert sofort
  unterscheidbar sein: Figuren haben Outline, Boden nicht; Hindernisse haben dunklen Fuß/Kontaktschatten.
- Wichtiges (Pickups, Gegner, interaktive Objekte) ist **heller oder satter** als der Hintergrund; Böden
  bleiben mittlere Helligkeit und kontrastarm (keine Muster mit ≥ 3 harten Kontrastsprüngen pro 8 px).
- Graustufen-Test: Silhouette und Wertgruppen müssen auch ohne Farbe lesbar sein.

## 11. HD-2D (Three.js-Renderer, Richtung „Octopath Traveler“)

3D-Gelände aus Blöcken mit Pixel-Texturen, Figuren/Objekte als Pixel-Billboards, echtes Sonnenlicht mit
Schatten, Tiefenunschärfe, Bloom, Grading. Alle Pixel-Regeln aus §1–§10 gelten weiter für die **Texturen**; Licht
und Post-FX dürfen die Palette im Bild modulieren (das ist der HD-2D-Look), aber nicht ersetzen.
Zahlen = **Startwerte** (Three.js ≥ r160, `renderer.outputColorSpace = SRGBColorSpace`), danach nach Auge tunen.

**Einheiten & Texel-Dichte**
- 1 Welteinheit = 1 Tile = **16 Texel**. Gilt ausnahmslos für Boden, Klippen, Wände, Sprites (Held 16×24 px →
  Quad 1 × 1,5). Höhenstufe = 1 Einheit. Nie Texturen strecken oder verschiedene Dichten mischen.
- UVs weltausgerichtet: Oberseiten über x/z, Frontflächen (Klippen-Faces) über x/y – Faces aus §5 direkt nutzbar.
- Texturen: `magFilter = NearestFilter`, `minFilter = NearestMipmapNearestFilter` (Mipmaps gegen Flimmern in der
  Ferne), `anisotropy = 4`, `colorSpace = SRGBColorSpace`. Kein Linear-Filter auf Pixel-Texturen.
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`, `antialias: false` (Kanten bleiben pixelig; DOF
  übernimmt die Weichheit).

**Kamera**
- `PerspectiveCamera`, **FOV 30°** (Tele-Look = Miniatur; Bereich 25–35°), Neigung **40° nach unten** (35–45°),
  Yaw fest 0 (Blick nach Norden, keine Drehung → Billboards/Schatten konsistent).
- Abstand zum Fokuspunkt ≈ **23 Einheiten** → ca. 22×12 Tiles sichtbar (16:9). Zoom = Abstand 14–32, FOV bleibt.
- Kamera folgt dem Spieler gedämpft (lerp 6/s), Fokuspunkt 0,5 Einheiten über dem Fußpunkt.

**Billboards (Sprites)**
- Quads stehen **senkrecht** (Y-Achse), Unterkante = Fußpunkt, Yaw zur Kamera. Gegen die Verkürzung durch die
  Neigung Höhe mit `1/cos(pitch)` skalieren (bei 40°: ×1,31) **oder** Quad um `pitch × 0,5` nach hinten kippen.
- Material: `MeshLambertMaterial`, `alphaTest 0.5`, `transparent: false`, Normale zur Kamera; Mindesthelligkeit
  über `emissive` = 0,25 × Albedo (bzw. emissiveMap = Sprite, emissiveIntensity 0.25), damit Figuren im Schatten
  lesbar bleiben.
- Sprites **werfen Schatten** (`castShadow`, `customDepthMaterial` mit `alphaTest 0.5`). Renderer-Ellipsenschatten
  aus §2 entfällt dann; optional schwacher Kontakt-Blob (Alpha 0,2, Radius 0,35).
- Pixelschärfe: Sprite-Position auf 1/16 Einheit runden (Bewegung im Texelraster).

**Licht**
- Sonne: `DirectionalLight` Farbe **#fff0d8** (≈ 5200 K, warm), Intensität **2.6**, Richtung **von oben-links-vorne**:
  Position relativ zum Ziel `(-6, 10, 5)` (Elevation ≈ 50°). Bei Abend: #ffc890, Intensität 1.8, Elevation 25°.
- Ambient: `HemisphereLight` Himmel **#9ec4e8**, Boden **#5a4a3a**, Intensität **0.9** → kühle, leicht teal Schatten.
  Kein reines Ambient-Weiß.
- Schatten: `PCFSoftShadowMap`, `mapSize 2048`, Shadow-Kamera orthografisch ±14 Einheiten um den Spieler
  (mitführen, auf Texelgröße snappen gegen Flimmern), `bias -0.0005`, `normalBias 0.02`, `radius 2`.
  Schatten mittelhart (Kante ≈ 1–2 Texel weich), nie schwarz: Schattenbereich behält ≥ 45 % Helligkeit
  (Hemi-Licht; optional `shadow.intensity 0.75`).
- Fackeln/Feuer: `PointLight` **#ff9a40**, Intensität 6, `distance 5`, `decay 2`, Flackern ±12 % mit 8–12 Hz
  (Rauschen, nicht Sinus). Max. 6 Punktlichter gleichzeitig (Performance Mobil).
- Kontaktschatten/AO: SSAO optional (Desktop), sonst eingebackenes AO an Klippenfuß (§2-Regel gilt umgekehrt:
  in HD-2D backt die Textur KEIN AO, das kommt aus Licht/AO-Pass bzw. einer dunklen Vertex-Farbe am Fuß, 25 %).

**Tone-Mapping & Grading**
- `toneMapping = NeutralToneMapping` (farbtreuer als ACES für Pixel-Paletten), `toneMappingExposure 1.0`.
- Grading (eigener ShaderPass am Ende): Schatten-Lift Richtung **teal** `+(-0.01, 0.02, 0.04)`, Lichter-Gain
  Richtung **warm** `×(1.04, 1.01, 0.96)`, Sättigung **1.10**, Kontrast **1.06** (Pivot 0.5).
- Kein LUT, das Hauttöne grünlich oder Gras gelb kippt; Abgleich: `grass_md` und `tunic_md` müssen unterscheidbar
  bleiben.

**Tiefenschärfe (DOF) & Tilt-Shift**
- Fokus = Kameraabstand zum Spieler (jeden Frame). **Scharfbereich ±3 Einheiten** Tiefe um den Spieler,
  volle Unschärfe ab ±12. Max. Blur-Radius **4 px bei 1080p** (skaliert mit Auflösung), Vordergrund (näher an
  der Kamera, unterer Bildrand) stärker als Hintergrund (Faktor 1,3).
- Umsetzung: `BokehPass` (focus = Distanz, `aperture ≈ 0.0006`, `maxblur 0.008`) oder eigener Gather-Blur über
  Tiefentextur (Depth-gewichtet, damit scharfe Sprites nicht in den Hintergrund ausbluten).
- Fallback Mobil/niedrige Qualität: Bildschirm-Tilt-Shift: Fokusband **40 % Bildhöhe** um die Spieler-Bildzeile,
  Übergang über 20 %, max. Blur 3 px.
- HUD und Dialoge nie geblurrt.

**Bloom**
- `UnrealBloomPass` **strength 0.35**, **radius 0.4**, **threshold 0.85** (nur Sonnenglanz, Wasserglitzer, Feuer,
  Kristalle, Glühwürmchen). Emissive-Objekte mit Intensität 1.5–3 über die Schwelle heben. Kein Bloom auf Gras/Haut.

**Vignette & Atmosphäre**
- Vignette: offset **1.0**, darkness **1.15**, Farbe Richtung `night` (#283048), Randabdunklung max. 25 %.
- Nebel: `THREE.Fog` **#b8c8d8**, near = Kameraabstand + 6 (≈ 29), far = Kameraabstand + 45 (≈ 68); Dungeon:
  #283048, near 18, far 45. Höhennebel in Tälern/Wasser optional (Plane mit Alpha 0,15).
- Lichtstrahlen (God-Rays): 2–4 additive Quads mit weichem Verlauf, Alpha 0,06–0,10, warm #fff0c8, langsam
  wandernd – nur im Wald/Innenräumen mit Fenstern.

**Partikel**
- Staub/Pollen (Tag): 40–80 pro Bildschirm, Größe 1 Texel (1/16 Einheit, `Points` mit sizeAttenuation),
  #fff0c8 Alpha 0,5, Drift 0,1–0,3 Einh./s, Leben 4–8 s, nur im Sonnenlicht sichtbar (Alpha × Lichtanteil).
- Glühwürmchen (Abend/Wald): 10–20, #d8f870, Emissive 2.5 (→ Bloom), Blinken 0,5–1,5 Hz, Schwebeweg Perlin.
- Blätter: 2–5 gleichzeitig, 3×2 Texel, grass-Ramp, fallen mit 0,4 Einh./s, Trudeln 1–2 Hz.
- Effekte aus §7 (Slash, Poof, Spark …) bleiben Pixel-Billboards; Spark/Slash dürfen emissiv sein (Bloom).

**Vegetation & Wind**
- Hohes Gras: **gekreuzte Billboard-Quads** (2 Quads à 1 × 0,75, 45° versetzt, oder kamerafacing), 3–6 Büschel pro
  Tile, Farbe je Büschel ±1 Ramp-Stufe variieren, `alphaTest 0.5`, wirft Schatten.
- Wind im Vertex-Shader: `offsetX = sin(t·1.6 + x·0.7 + z·0.4) · 0.04 · h²` (h = 0 am Fuß … 1 an der Spitze),
  Böen alle 4–8 s mit Amplitude ×2 über 1,5 s; Offset auf 1/16 Einheit runden (pixelig bleiben).
- Bäume: Kronen als 1–3 gestaffelte Billboards (Tiefenversatz 0,3) über Stamm-Billboard, Kronen schwingen mit
  Amplitude 0,015. Büsche/Blumen gleiche Wind-Funktion mit halber Amplitude.

**Wasser**
- Wasseroberfläche **0,15 Einheiten unter** Bodenhöhe, eigenes Material: Pixel-Textur aus §5 (`water`, 4 Frames
  à 4 fps oder UV-Scroll 0,05 Einh./s), `MeshStandardMaterial` roughness **0.25**, metalness 0, opacity **0.85**.
  Darunter Sand-/Grund-Plane, damit `shallow` durchscheint (opacity 0.55 bei Flachwasser).
- Sonnenglitzer: Highlights der Textur leicht emissiv (0.6) → Bloom. Uferlinie: `foam`-Streifen als eigener Quad,
  animiert. Keine echten Reflexionen nötig; optional gespiegelte Sprite-Kopien mit Alpha 0,2.

**Klippen & Gelände in 3D**
- Plateaus = extrudierte Blöcke, Frontflächen mit Face-Texturen aus §5 (oben/mitte/fuß), Seitenflächen (Ost/West)
  mit derselben Face-Textur, Licht macht den Hell/Dunkel-Unterschied (links hell, rechts im Schatten).
- Grasüberhang `[0]` zusätzlich als kleiner Billboard-/Lippenstreifen 2 Texel vor der Kante (Silhouette).
- Kanten nicht abrunden (Blocklook bleibt), aber Kantenvariation über Texturen und Deko-Billboards (Steine,
  Grasbüschel am Klippenfuß).
