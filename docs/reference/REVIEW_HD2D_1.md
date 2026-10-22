# REVIEW HD2D 1 – Art-Direction „Stimmigkeit“

Verglichen: unser 3D-Screenshot `scratchpad/h13.png` (960×540, Dorf „Driftwald“) mit zwei Zielbildern
(Octopath-Stil: Friedhof unter gelbem Baum, Dorfladen mit Party).

## 0. Messwerte (Bildstatistik, PIL)

| | Ø RGB | Ø Sättigung (0–255) | Luminanz-σ | Anteil dunkel (L<50) | Anteil hell (L>200) |
|---|---|---|---|---|---|
| **DRIFT h13** | 53 / 68 / 48 (grünstichig) | **195** | 52 | **54 %** | **0 %** |
| Ziel Friedhof | 79 / 70 / 29 (warm) | 177 | 58 | 47 % | 1 % |
| Ziel Dorf | 88 / 82 / 54 (warm-neutral) | 147 | 58 | 35 % | 4 % |

Kurz: Unser Bild ist **zu dunkel, zu satt und zu grün, und es hat keine Lichter**. Die Ziele sind warm
(R ≥ G), haben echte Spitzlichter (1–4 % über L 200) und mehr Kontrast bei geringerer Sättigung.

## 1. Was die Zielbilder stimmig macht

1. **Zweiklang Warm/Kalt:** Sonnenlicht gold-ocker (#e8c060-Bereich), Schatten und Wasser kühl teal-oliv
   (#1c3030 bis #304838), der Himmel/Dunst blaugrau. Jede Fläche liegt klar auf einer der beiden Seiten.
   Bei uns ist alles grün-gelb, ohne kühles Gegengewicht.
2. **Licht-Inseln:** Die Figuren stehen in einer **sonnenbeschienenen, ruhigen Fläche** (Erdlichtung,
   Ladenvorplatz). Drumherum liegen 30–50 % des Bildes in tiefem, aber nicht schwarzem Schatten
   (Baumkrone, Hausschatten). Das Auge landet sofort bei der Figur. Bei uns ist das Licht gleichmäßig
   verteilt, und nur der Rand ist dunkel (Vignette und Büsche).
3. **Wertverteilung:** dunkler Vordergrund, heller Mittelgrund mit den Figuren, mittelheller dunstiger Hintergrund.
   Bei uns: dunkler Vordergrund, mittlerer Mittelgrund, dunkler Hintergrund. Es fehlt ein heller Bereich.
4. **Sättigung dosiert:** Gesättigt sind nur die Lichtflächen (gelbes Laub, Gras im Licht, Dächer).
   Schatten sind entsättigt. Bei uns ist alles überall gesättigt.
5. **Detaildichte:** Die Umgebungstexturen sind feinkörnig, aber **kontrastarm**. Die Figuren haben die
   höchsten Kontraste (Outline, helles Gesicht) und stehen auf ruhigem Grund. Bei uns ist der Boden
   unruhig: Das Kopfsteinpflaster ist fotorealistisch fein und kontraststark, das Gras weich verwaschen.
6. **Tiefenstaffelung:** Vordergrund-Rahmen (Baum, Gras) ist unscharf und dunkel, die Bühne scharf, der
   Hintergrund (Baumreihe, Häuser, Himmel) weich und **atmosphärisch aufgehellt/bläulich**. Bei uns gibt es
   keinen Hintergrund: Der Boden läuft bis an die Oberkante, die Vordergrund-Büsche sind riesige schwarze Blobs.
7. **Kamera:** flacher Winkel (≈ 30–35°), man sieht Horizont, Baumreihen und Hausfassaden frontal. Die
   Figuren sind **≈ 10–12 % der Bildhöhe** hoch. Bei uns ist der Winkel steil (≈ 55°, eher Draufsicht), und
   der Held misst ≈ 4 % der Bildhöhe, wirkt also verloren.
8. **Vegetation:** Hohe Grasbüschel stehen als klare, helle Billboards **in Gruppen** an Kanten (Wegrand,
   Grabsteine, Hausecken). Blumen sind kleine weiße und rosa Tupfer in Nestern. Bei uns sind die Büsche
   formlose dunkle Massen, die Grasbillboards stehen teils fast schwarz im Gegenlicht.
9. **Requisiten erzählen:** Sie stehen in **Clustern mit Funktion** (Säcke, Fässer, Karren und Werkzeug vor
   der Scheune; Kisten und Fass vor dem Laden). Bei uns sind die Requisiten einzeln und gleichmäßig
   gestreut (Topfpaar, Schilder, Pilz, Stumpf, Zaunstücke).
10. **Architektur plastisch:** Dachziegel als **Relief mit Kantenlicht**, Fachwerk, Fensterläden,
    Steinsockel. Häuser sind ≈ 4–5 Figurenhöhen hoch. Unsere Häuser passen im Maßstab, die Dächer sind aber
    flach orange ohne Relief und Glanzkante.

## 2. Abweichungen nach Verantwortlichem

### (a) Regie / Renderer
| Thema | Ist (h13) | Soll (Startwert) |
|---|---|---|
| Kamera-Neigung | ≈ 55° | **32°** (30–35°) |
| Bildausschnitt | Held ≈ 4 % Bildhöhe | Held **9–11 %** Bildhöhe (Abstand entsprechend auf ≈ ⅖ verringern), sichtbare Tiefe ≈ 14 Tiles bis zum Horizont-Dunst |
| Grading | starker Gelbgrün-Stich, Schwarz gequetscht | Grün-Stich entfernen (Gain G ×0.96), warm: Lichter ×(1.06, 1.00, 0.90), Schatten-Lift teal +(0.00, 0.025, 0.035), **Schwarzpunkt ≥ 0.04** |
| Sättigung | Ø 195 | global **0.92**, Lichter (L > 0.6) **1.10**, Schatten (L < 0.3) **0.80** → Ziel Ø 150–175 |
| Belichtung | 0 % Lichter | Exposure **+0.3 EV** (≈ 1.25), Ziel: 1–4 % Pixel L > 200 |
| Licht-Verhältnis | Sonne:Ambient ≈ 1.5:1 | **4:1**: Sonne #ffd8a0 Intensität 3.2, Elevation **38°** (längere Schatten); Hemi 0.45 (Himmel #8fb0c8, Boden #4a4030) |
| Schatten | kurz, wenig Fläche | lange Schatten, 30–45 % Bildfläche im Schatten; Baumkronen werfen Schatten (castShadow auf Kronen-Billboards), optional Wolken-Cookie (große Rauschtextur, 0.02 Einh./s Drift, 15 % Abdunklung) |
| Billboard-Licht | Grasbüschel/Statue fast schwarz | Normalen der Billboards **zur Sonne hin mitteln** (Normal = normalize(camDir·0.5 + up·0.5)) oder Lambert-Wrap 0.5; Mindesthelligkeit emissive 0.3 |
| DOF/Tilt-Shift | Band ≈ 35 %, max. Blur ≈ 8 px; auch Ortstitel geblurrt | Schärfe **±6 Einheiten** um den Spieler, max. Blur **3 px @540p / 5 px @1080p**, Vordergrund ×1.3; Bloom und DOF **vor** UI; Ortstitel ins UI-Overlay |
| Bloom | Halos um dunkles Laub, grünlicher Schleier | strength **0.22**, radius 0.35, threshold **0.9**; nur Sonnenkanten, Fenster, Feuer, Wasserglitzer |
| Vignette | sepia/teal, stark (Ecken fast schwarz) | neutral-dunkel #182028, offset 1.0, darkness **0.9**, max. 18 % |
| Nebel/Atmosphäre | keiner sichtbar | Höhen-/Distanznebel ab 1.2× Fokusdistanz, Farbe **#a8bcc8**, bis 35 % Deckung am Horizont; Hintergrund dadurch heller und kühler |
| Himmel/Hintergrund | fehlt | Himmel-Gradient #8fb0c8 → #d8e0d8 am Horizont, sichtbar in den oberen 10–15 % |
| Texturfilter | Gras-Boden wirkt weich/verwaschen | Boden-Texturen **Nearest** prüfen (sieht nach Linear/Mip-Blur aus); anisotropy 4 + NearestMipmapNearest |

### (b) Umgebungs-Art
1. **Boden-Texturen beruhigen:** Gras und Erde mit max. 3 Werten pro Fläche und Kontrast ≤ 15 % L. Pflaster
   (Platz) gröber (Steine 6–8 Texel statt ≈ 3), Fugen `stone_dk` statt fast schwarz, Kontrast halbieren.
   Texel-Dichte 16/Einheit wie die Figuren, keine feinere Foto-Körnung.
2. **Licht-Lichtung:** eine helle, ruhige Untergrund-Variante (`dirt_lt`/`sand`) für Plätze, auf denen
   Figuren stehen (Ziel: Erdlichtung im Friedhofsbild).
3. **Büsche:** Silhouette mit 5–7 klaren Blattballen, Oberseite `grass_lt`/`grass_hi` (Sonnenkante), Unterseite
   `grass_dk`. Kein `grass_ink` als Füllung. Max. 1 Tile hoch im Mittelgrund. Vordergrund-Büsche nur an den
   unteren Ecken, ≤ 12 % der Bildfläche.
4. **Grasbüschel-Billboards:** hellere Ramp (`grass_md` bis `grass_hi`), 5–9 Halme mit klarer Spitze,
   Gegenlicht-Rand 1 Texel `grass_hi`.
5. **Dächer:** Ziegelreihen als Relief: jede Reihe Unterkante 1 Texel `wood_ink`/`red_dk`, Oberkante 1 Texel
   `gold_lt`/`wood_hi`. Firstkante mit Glanz, Ortgang-Brett. Farbe Richtung **gold-ocker** (`gold_md`/`wood_lt`),
   wie im Zielbild, statt Orange. Fensterläden (`water_md` oder `wood_md`), Steinsockel `rock_md`.
6. **Hintergrund-Assets:** Baumreihe als 2–3 Billboard-Ebenen (dunkelgrün, durch Nebel aufgehellt),
   Zaun/Mauer als Grenzlinie, Hügel/Klippenstufe.
7. **Requisiten-Set ergänzen:** Fass, Kiste, Sack, Karren, Werkzeug (Schaufel/Heugabel), Brunnen, Grabstein,
   Laterne. Alles im Cluster-tauglichen Stil.

### (c) Figuren-Art
1. Figuren skalieren mit der neuen Kamera (≈ 10 % Bildhöhe), Pixel bleiben 16×24. Größer wird das Bild, nicht die Texel.
2. **Kontrast-Hierarchie:** Gesicht/Haare des Helden sind die hellsten Werte im Mittelgrund (`skin_lt`,
   `hair_md` mit Glanz `gold_lt`). Outline `ink` bleibt. Tunika eine Stufe heller (`tunic_lt` als
   Flächenlicht oben links), damit der Held gegen das Gras besteht.
3. Statue: steinfarben warm (`rock_md`/`rock_lt`) statt blauschwarz, damit sie nicht wie ein Loch wirkt.
4. NPCs: mindestens 1 kräftige Akzentfarbe pro NPC (rot/blau/violett), nie grün. Bestand passt.

### (d) Gameplay / Level-Design
1. **Bühne statt Teppich:** pro Bildschirm **eine ruhige, helle Freifläche** (Platz, Lichtung) mit ≈ 25–35 %
   der Fläche. Dichte (Vegetation, Requisiten) an den Rändern und entlang der Wege staffeln.
2. **Requisiten in Clustern** zu 3–6 Objekten mit Funktion: vor jedem Haus Fässer/Kisten und Schild; Scheune
   mit Säcken und Karren; Brunnen am Platz. Keine Einzelobjekte in der Wiese verstreuen.
3. **Höhenstufen nutzen:** mindestens eine Klippen-/Terrassenstufe pro Screen (Zielbild: Terrasse hinter dem
   Wasser), Häuser leicht erhöht. Das gibt Tiefenstaffelung.
4. **Schattenspender:** große Bäume an den Bildrändern platzieren, deren Schatten auf den Weg fallen (Licht-Inseln).
5. Grasbüschel-Gruppen an Weg- und Hauskanten, Blumennester (5–9 Tupfer) statt Einzelblumen.
6. Wasser (Teich/Bach) als kühles Gegengewicht in Dorf-Screens.

### (e) UI
1. Ortstitel „Driftwald“ als **scharfes UI-Overlay** (Pixel-Font, `white` mit `ink`-Schatten, Fade 0.4 s
   ein, 2 s halten, 0.6 s aus), nicht in der 3D-Szene/DOF.
2. Leere Item-Box oben links: Platzhalter-Icon oder ausblenden, solange kein Item da ist.
3. HUD-Panels: dunkles Glas ist ok. Für Dialoge Pergament-/Steinoptik wie im Zielbild (Grund `ui_frame` hell,
   Text `ink`, Namensschild-Reiter). Panels 85 % deckend.
4. Herz-Leiste „LEBEN“: Herzen 1 Stufe größer skalieren; Rupien/Bomben/Schlüssel-Leiste passt.

## 3. Top 10 (nach Wirkung)

1. **Kamera flacher und näher:** Neigung 32°, Held 9–11 % Bildhöhe, Horizont/Hintergrund sichtbar. *(Regie)*
2. **Grading reparieren:** Grünstich raus, warme Lichter / teal Schatten, Sättigung 0.92 global (Lichter 1.1),
   Schwarzpunkt 0.04, Exposure +0.3 EV, Ziel 1–4 % Spitzlichter. *(Regie)*
3. **Licht-Inseln:** Sonne:Ambient 4:1, Elevation 38°, lange Schatten, schattenwerfende Baumkronen und
   optional Wolken-Cookie. Die Figur steht im Licht. *(Regie + Level)*
4. **Atmosphäre/Hintergrund:** Distanznebel #a8bcc8 bis 35 %, Himmel-Gradient, Baumreihen-Billboards. *(Regie + Umgebungs-Art)*
5. **DOF/Vignette/Bloom zurücknehmen:** Schärfe ±6, Blur max. 3 px @540p, Vignette 0.9 neutral, Bloom 0.22 /
   threshold 0.9. Vordergrund-Büsche ≤ 12 % Fläche. *(Regie + Level)*
6. **Billboard-Beleuchtung:** keine schwarzen Grasbüschel/Statuen mehr: Normalen zur Sonne mitteln,
   Wrap-Lighting, emissive 0.3. *(Regie)*
7. **Boden beruhigen und Texel-Dichte vereinheitlichen:** Pflaster gröber und kontrastärmer, Gras-Nearest-Filter
   prüfen, helle Lichtungs-Variante. *(Umgebungs-Art + Regie)*
8. **Requisiten in Funktions-Clustern** plus neue Props (Fass, Kiste, Sack, Karren, Brunnen, Laterne). *(Umgebungs-Art + Level)*
9. **Vegetation lesbar:** Büsche mit Sonnenkante und klaren Ballen, helle Grasbüschel in Gruppen an Kanten,
   Blumennester. *(Umgebungs-Art + Level)*
10. **Dächer/Architektur plastisch:** Ziegelrelief mit Kantenlicht, gold-ocker statt orange, Fensterläden. Dazu
    Ortstitel ins scharfe UI-Overlay. *(Umgebungs-Art + UI)*
