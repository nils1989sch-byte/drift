# DRIFT – Monster- & Farm-Guide (Referenz-Agent)

Gilt zusammen mit `docs/DESIGN.md` und `docs/STYLE_GUIDE.md`. Grundlage ist eine Analyse von Genre-Spielen
(Cassette Beasts, Temtem, Coromon, Monster Sanctuary, Pokémon Legends Arceus, Ni no Kuni, Stardew Valley,
Sun Haven, Fae Farm). **Nichts davon wird kopiert**: keine Namen, Designs, Formeln 1:1, Melodien.
Alle Zahlen sind Startwerte für Playtests. Quellen stehen in `SOURCES.md` (Abschnitt Monster/Farm).

---

## 1. Monster-Design für HD-2D-Pixel

**Größe & Raster (aus DESIGN.md):** kleine Monster 24–32 Weltpx hoch, große ≈ 40, Boss ≈ 80; HD-Dichte ws 0.5.
Ein Sprite-Pixel ist also ein halber Weltpixel, ein 28 px hohes Monster hat ≈ 56 Sprite-Pixel Höhe. Gestaltet
wird so, dass es **auch bei halber Auflösung** (Lesbarkeitstest: Sprite auf 50 % verkleinert, Nearest) erkennbar bleibt.

**Silhouette**
- **Ein dominantes Merkmal** pro Art, das in der Silhouette sichtbar ist (Glutkamm, Muschelkappe, Blattstacheln,
  Steinschale, Funkenflügel, Moos-Haus). Das Merkmal ragt aus dem Körperumriss heraus und ist nicht nur aufgemalt.
- Schwarz-Füll-Test: Alle 14 Arten als Silhouette nebeneinander müssen paarweise unterscheidbar sein, keine
  zwei mit gleicher Grundform plus gleichem Höhen-/Breitenverhältnis.
- Körpermasse unten schwerer als oben (Standfestigkeit). Flieger sind die Ausnahme: Masse in der Mitte, Flügel
  breiter als der Körper.
- Negativraum (Lücke zwischen Beinen, Schwanz, Flügel) mindestens 2 Sprite-Pixel breit, sonst verschwindet er.

**Formsprache je Typ** (Grundform + Akzentform)
| Typ | Grundform | Akzente | Bewegung |
|---|---|---|---|
| Feuer | Tropfen/Dreieck nach oben | Zacken, Flammenzungen, Glut-Pixel | zappelig, hüpfend |
| Wasser | Kreis, Oval | Wellenlinien, Tropfen, Muschel | gleitend, wippend |
| Pflanze | Kreis + Blattformen | Blätter, Knospen, weiche Spitzen | gemächlich, schaukelnd |
| Stein | Quadrat/Trapez, breit unten | Facetten, Risse, Kristall | schwer, wenig Hub, Stampfen |
| Blitz | schmale Dreiecke, Zickzack | Zackenkanten, Funken | ruckartig, Teleport-Zucken |
| Wind | Tropfen liegend, Sichel | Federn, Wirbel, Schweif | schwebend, Bögen |
| Normal | Kreis/Ei | wenig | neutral |

**Farbanteile (60/30/10)**
- 60 % Körpergrundfarbe (Ramp 3–4 Stufen), 30 % Zweitfarbe (Bauch, Merkmal), 10 % **Typ-Akzent** (Feuer `fx_orange`/
  `fx_yellow`, Wasser `water_lt`, Pflanze `grass_lt`, Stein `cliff_lt`/`rock_hi`, Blitz `fx_yellow`/`fx_cyan`,
  Wind `metal_lt`/`white`). Der Akzent sitzt **auf dem dominanten Merkmal**.
- Pro Monster max. 12 Farben inkl. Outline, aus der Masterpalette (neue Ramps beim Referenz-Agenten beantragen).
- Monster heben sich vom Lebensraum ab: Ein Gras-Monster ist nicht `grass_md`-grün, sondern z. B. oliv/braun mit
  hellgrünen Blättern. Wasser-Monster sind nicht wasserblau, sondern hell/warm mit blauem Akzent.
- Die Gesamthelligkeit der Monster liegt eine Stufe **über** der Umgebung (HD-2D-Kontrasthierarchie, REVIEW_HD2D_1).

**Augen & Charme**
- Augen sind das hellste/kontrastreichste Detail: Grundstufe 2×3 bis 3×4 Sprite-Pixel, 1 px Glanzlicht `white`
  oben (Richtung Lichtquelle oben links), Pupille `ink`.
- Position: Augen in der **unteren Hälfte des Kopfs** (Kindchenschema), Abstand mindestens eine Augenbreite.
- Basisstufen: Kopf 45–55 % der Körperhöhe, kurze Gliedmaßen. Entwickelte Stufe: Kopf 30–40 %.
- Jede Art bekommt eine **Persönlichkeits-Idle** (2–4 Frames): Funkel schnippt Funken, Pilzling nickt ein,
  Moosschneck zieht kurz die Fühler ein. Das bringt mehr Charme als zusätzliche Details.
- Böse/aggressive Wildmonster werden über Augenform (Lid-Pixel schräg) und Haltung gezeigt, nicht über eine
  andere Farbe.

**Entwicklungs-Logik**
- Größe ×1,3–1,6, Silhouette-Merkmal bleibt erkennbar und **wächst/eskaliert** (Glutkamm → Lavamähne,
  Muschelkappe → Wirbel-Muschelhelm). Grundfarbe bleibt, der Akzent bekommt mehr Fläche (10 % → 20 %).
- Proportionen reifer (Kopf kleiner, Beine länger), Formen eckiger. Genau **ein** neues Merkmal kommt dazu.
- Zweittyp (z. B. Dornigel Pflanze/Stein) wird als zweiter Akzent mit ≤ 15 % Fläche gezeigt.
- Die Entwicklungs-Sequenz nutzt die Silhouette: weißer Flash-Umriss der alten Form, Wechsel im Takt
  (0,4 → 0,3 → 0,2 → 0,1 s), dann neue Form + `evolve`-FX.

**Lesbarkeit bei 24–40 px Höhe**
- Max. 3 Detailstufen: Umriss, Hauptflächen, 1–2 Detail-Pixel-Gruppen. Keine Texturen im Fell.
- Richtungen: `down`, `up`, `right` gemalt; `left` = gespiegeltes `right`, nur wenn das Merkmal symmetrisch ist.
- Outline 1 px dunkle Materialfarbe (Selout), an der Lichtseite oben links eine Stufe heller.
- Wildmonster in hohem Gras: die oberen 30 % (Kopf/Merkmal) ragen über die Halme. Dafür sorgt die
  Grashöhe (max. 0,6 Einheiten).

**Konkrete Hinweise zum Start-Set** (Abstand zu bekannten Designs, siehe §5)
- `funkel`: **keine Flamme an der Schwanzspitze** und kein orange Körper mit cremefarbenem Bauch (zu nah an einem
  bekannten Feuer-Starter). Besser: dunkel-rotbrauner Salamander mit **Glut-Rückenkamm** (glimmende Platten),
  Akzent `fx_orange`.
- `tropfi`: Otter **ohne Muschel am Bauch** (bekanntes Wasser-Starter-Motiv). Muschel als Kappe/Hut ist ok,
  Körper hell-sandfarben mit blauem Akzent.
- `sprossi`: Igel mit Blattstacheln liegt nah an einem bekannten Pflanzen-Starter (Igel mit Blatt-Kapuze).
  Unterscheiden: Stacheln als **aufrecht stehende Sprossen mit Knospen**, Igelkörper braun-erdig, kein grüner Helm.
- `kiesel`: Krabbe mit Stein-Schale ist ein bekanntes Motiv (Einsiedler mit Steinblock). Besser: Krabbe, deren
  **Scheren** aus Kieselsteinen bestehen, flache Schale mit Moosfleck.
- `boeli`, `zappi`, `moosi`, `pilzling`: Archetypen sind generisch. Bekannte Farbkombinationen meiden
  (z. B. brauner Spatz mit cremefarbener Brust und Federschopf, roter Pilz mit weißen Punkten, Gelb + rote
  Wangen bei Blitzwesen).

## 2. Echtzeit-Kampf: Lesbarkeit

**Telegraph (Vorwarnung) – feste Familien** (gleiche Form = gleiche Bedeutung, überall im Spiel)
| Familie | Windup | Telegraph | Aktiv | Erholung (Strafzeit) |
|---|---|---|---|---|
| Nahangriff `melee` | 0,45 s | Ausholen + 2 Frames Weiß-Flash, Bogen-Decal vor dem Monster | 0,10 s | 0,40 s |
| Sturm `dash` | 0,60 s | Rückwärts-Ducken, Linien-Decal in Laufrichtung (wächst) | 0,25 s | 0,60 s |
| Projektil | 0,50 s | Aufladen-Glühen im Typ-Akzent, Zielrichtung als kurzer Pfeil | Flug 140–200 px/s | 0,35 s |
| Fläche `area` | 0,80 s | Kreis-Decal füllt sich von innen nach außen | 0,15 s | 0,70 s |
| Kegel `cone` | 0,65 s | Kegel-Decal, Rand pulsiert | 0,15 s | 0,50 s |
| Boss schwer | 1,0–1,3 s | Decal + Kamera-Ruck + Sound-Anstieg | 0,2 s | 1,0 s |
- Untergrenze: **kein Angriff unter 0,35 s Windup** (Reaktionszeit 0,2–0,3 s plus Eingabe). Wildmonster mit
  Lv-Vorsprung ≥ 5 dürfen ×0,85 Windup haben, nie darunter.
- Decal-Farbe: Typ-Akzent mit 35 % Deckung, Rand 70 %. Für alle Gegnerangriffe immer **dieselbe Randfarbe**
  (warm-orange `fx_orange`), damit Spieler „Gefahr“ lernen. Eigene Angriffe zeigen keine Decals.
- Pro Wildmonster ist **max. 1 Angriff im Windup**. KI-Angriffsintervall 1,6–3,0 s (zufällig), nach einem
  Treffer gegen den Spieler +0,5 s Pause.

**Treffer-Feedback**
- Hitstop: leicht 50 ms, normal 70 ms, sehr effektiv 110 ms, kritisch 130 ms. Opfer flasht 2 Frames weiß.
- Rückstoß 6–16 px (power-skaliert), ease-out 0,18 s.
- Schadenszahl über dem Ziel (Pixel-Font, steigt 12 px in 0,6 s, Fade). Farbe: normal `white`, sehr effektiv
  `fx_yellow` mit Text „Stark!“, wenig effektiv `metal_md` mit „Schwach…“.
- Typ-FX `type_<typ>_hit` + SFX pro Typ. Bei Effektivität 2.0 zusätzlich 1 Frame Bildschirm-Shake (2 px).
- HP-Balken: Sofort-Abzug, dahinter ein heller „Nachlauf“-Balken, der in 0,4 s nachzieht.

**Abklingzeiten (Spieler-Monster)**
| Slot | Rolle | Abklingzeit | power |
|---|---|---|---|
| Attacke 1 (A) | Basis, Spam-fähig | 0,6–0,9 s | 25–40 |
| Attacke 2 (B) | Typ-Angriff | 2,5–4 s | 50–70 |
| Attacke 3/4 | stark / Buff / Fläche | 6–12 s | 80–110 bzw. Buff +30 % für 6 s |
| Ausweichen | Rolle, 0,25 s unverwundbar | 1,0 s | – |
- Eingabepuffer 0,15 s (Taste kurz vor Ende der Erholung wird ausgeführt). Abklingzeit-Ring am Button im UI.
- Kampfdauer-Ziel gegen ein gleichstarkes Wildmonster: **15–30 s**; Trainerkampf pro Monster 25–45 s.

**Fang-Moment** (der emotionale Höhepunkt, kurz halten)
1. Unter 50 % HP: Hinweis „Fangen!“ + pulsierender Ring um das Wildmonster; Wildmonster wird 20 % langsamer.
2. Wurf: Bogen 0,45 s; Zeitlupe 0,6× für den Flug; bei Fehlwurf kommt die Kugel zurück, 1,5 s Abklingzeit.
3. Treffer: Monster wird als Lichtstreifen eingesogen (0,3 s), Kugel landet.
4. Bis zu **3 Wackler** à 0,5 s (`orb_shake`), jeder mit Klick-SFX und Mini-Pause. Gesamt ≤ 2,5 s bis zum Ergebnis.
5. Erfolg: Sterne-Burst (`capture_success`), Jingle 1,5 s, Name + „gefangen!“ im UI, Lexikon-Eintrag-Toast.
   Ausbruch: `capture_break`, Monster hat 0,8 s Wut-Buff (+15 % Tempo) und greift sofort an.
- Wackel-Logik: Ein Gesamtwurf p wird auf 3 Proben verteilt (`p_wackel = p^(1/3)`). Bricht es bei Wackler k aus,
  sieht der Spieler, wie knapp es war.

## 3. Farming-Takt

**Tagesrhythmus** (Tag 06:00–02:00, 1 Spielminute = 0,7 s → Tag ≈ 14 min real)
- Hof-Routine (gießen, ernten, säen, Versandkiste) soll **≤ 2 min real** dauern (≈ 170 Spielminuten, also bis
  ≈ 09:00). Danach Erkunden und Kämpfen.
- Startfeld 12 Felder (3×4) → bis 2 min Arbeit. Ausbau auf 24–36 nur mit Gießkannen-Upgrade (3er-Linie) und
  Wasser-Monster-Helfer, damit die 2 min halten.
- Gießkanne fasst 20 Felder; Brunnen/Trog am Hof füllt sie wieder. Eine Aktion (hacken/gießen/ernten) dauert
  0,25 s plus Laufweg; Feld-Raster mit Auto-Ausrichtung auf die Kachel vor dem Spieler.
- Belohnungstakt: **jeden Tag** etwas erntereif (gestaffelte Saat), alle 3–4 Tage ein „großer“ Erntetag
  (Kürbis), wöchentlich ein neues Angebot im Shop.

**Pflanzen (Startwerte, Währung „Taler“)**
| id | Wachstum (Tage) | Saat | Verkauf | Gewinn/Tag/Feld | Besonderheit |
|---|---|---|---|---|---|
| `weizen` | 4 | 10 | 25 | 3,8 | Futter für Monster-Zuneigung |
| `ruebe` | 4 | 15 | 35 | 5,0 | Starter-Saat (Bodo schenkt 10) |
| `kartoffel` | 5 | 25 | 55 | 6,0 | 20 % Chance auf 2 Stück |
| `blaubeere` | 6 | 40 | 3× 20 | 3,3 (erste Ernte), danach alle 2 Tage | mehrfach erntbar |
| `erdbeere` | 6 | 60 | 30 je Ernte | ab 2. Ernte hoch | mehrfach, alle 3 Tage nachwachsen |
| `kuerbis` | 8 | 80 | 220 | 17,5 | großer Erntetag |
- Grundregel: höhere Saatkosten → längeres Wachstum → mehr Gewinn pro Tag (Investition lohnt). Mehrfach-
  Ernten lohnen sich erst ab der 3. Ernte (Langzeit-Planung).
- Pflanzen-Monster +10 % Wachstum = alle 10 Tage ein Tag gespart. Kommuniziert wird das als „Wächst schneller“.

**Preise relativ zu Kugeln/Tränken**
| Item | Preis | Wirkung |
|---|---|---|
| Driftkugel | 50 | Kugelfaktor 1,0 |
| Gute Kugel (ab Tag 5) | 150 | 1,6 |
| Meisterkugel-Äquivalent | **nicht im Shop** (nur Belohnung) | 2,5 |
| Trank | 40 | +30 HP (≈ 50 % eines Lv-10-Monsters) |
| Großtrank (ab Tag 8) | 120 | +100 HP |
| Wiederbeleber | 200 | 50 % HP |
- Zielökonomie: 12 Felder Rüben bringen ≈ 240 Taler pro Zyklus (≈ 60/Tag Gewinn). Ein Hof-Tag finanziert
  früh **1 Kugel + 1 Trank**, mittelfristig (24 Felder, Kartoffel/Kürbis) 3–4 Kugeln. Kampfgeld: Wildmonster
  geben 0 Taler, Trainer 60–200 Taler. So bleibt der Hof wichtig, aber nicht Pflicht.
- Ohnmacht: −10 % Geld (DESIGN.md), höchstens 200 Taler, damit Spieler nicht in eine Sackgasse geraten.

## 4. Balancing-Startwerte

**Werte-Wachstum**
- `stat(L) = floor(basis × L / 20) + 5`; `hp(L) = floor(basisHP × L / 15) + L + 10`.
- Basiswerte: Summe hp+atk+def+spd ≈ 200 (Basisstufe), 280 (entwickelt), 320 (Steinwächter). Einzelwert 30–90.

**EP-Kurve**
- EP für den nächsten Level: `xpNext(L) = round(10 × L^1.6)` → L1: 10, L5: 131, L10: 398, L16: 844, L20: 1207.
  Summe bis L16 ≈ 5 600.
- EP-Ausbeute: `xp = round(basisEP × L_gegner / 5)` (basisEP 30–60, Boss 150); gefangene Monster geben **100 %**
  EP (Fangen nicht bestrafen), Team-Mitglieder auf der Bank 50 %.
- Ergibt bei gleichem Level ≈ 1–2 Kämpfe pro Level bis L3, ≈ 3 bei L5, ≈ 5 bei L10, ≈ 6–7 bei L16. Starter-
  Entwicklung (L16) nach ≈ 60–70 Kämpfen, das sind etwa 2–3 h Spielzeit mit Hof.
- Wildmonster-Level pro Gebiet: Dorf-Wiese 2–5, Wald 5–9, Ufer 7–11, Höhle 10–15, Steinwächter 18.

**Fangraten (basis)**
| Seltenheit | basis | Beispiele |
|---|---|---|
| häufig | 0,75 | Böenspatz, Pilzling |
| normal | 0,55 | Kieselkrabbe, Zappfalter, Moosschneck |
| selten | 0,35 | Entwicklungen in freier Wildbahn |
| Boss | 0,15 | Steinwächter (nur nach Sieg-Phase, 1 Versuch je Kugel) |
- Formel-Vorschlag (weicher als DESIGN.md): `p = clamp(basis × (1 − 0,8 × hp%) × kugel × status × lvMod, 0,05, 0,95)`,
  `lvMod = clamp(1 − (L_wild − L_eigen) × 0,04, 0,6, 1,1)`, `status` 1,3 bei Schlaf/Lähmung, sonst 1.
  Beispiel häufig, 30 % HP, Driftkugel: 0,75 × 0,76 = **0,57**. Die Original-Formel aus DESIGN.md
  (`× (1 − hp%)`) gibt 0,53, das liegt nah dran. Der Unterschied: bei 50 % HP ergibt sie nur 0,375 statt 0,45.
  Beides ist spielbar; empfohlen ist der Faktor 0,8, damit „Fangen!“ bei 50 % sich nicht wie eine Falle anfühlt.

**Schadensformel-Check**
- DESIGN.md: `power × (atk/def) × Level-Faktor × Typ × STAB 1,2 × Zufall`. Der Level-Faktor ist entscheidend.
  Ziel: Bei gleichem Level und gleichen Werten erledigt eine power-40-Attacke ein Monster in **≈ 6 Treffern**
  (sehr effektiv ≈ 3, wenig effektiv ≈ 12).
- Passender Level-Faktor zu den Werte-Formeln oben: **`lf = (5 × L_angreifer + 10) / 288`**
  (L5: 0,12 → 5,8 Schaden bei 35 HP; L15: 0,30 → 14 bei 85 HP; L30: 0,56 → 27 bei 160 HP: jeweils ≈ 6 Treffer).
  Ein klassischer Faktor `(2L/5 + 2)` ohne Normierung würde in 1 Treffer töten. Bitte nicht verwenden.
- Untergrenze Schaden 1, kritisch (6 %) ×1,5. Zufall 0,9–1,1 bleibt.
- Sanity-Test für den Gameplay-Agenten: Simulation L5 gegen L5, L10 gegen L12, L16 gegen Steinwächter L18.
  Erwartete Kampfdauer 15–30 s, 30–60 s, 90–150 s.

## 5. Rechtliches & Abstand zu Pokémon (keine Rechtsberatung)

**Vermeiden**
- **Namen/Begriffe:** keine Endungen „-mon“, keine Wörter „Poké“, „Pocket Monster“, „Pokédex“, „Arena-Leiter“ +
  8-Orden-Struktur, „Professor ‹Baumname›“, „Schnapp sie dir alle“-ähnliche Slogans. Unser Vokabular: Monster,
  **Driftkugel**, **Lexikon**, Ranger, Steinwächter. Gut so.
- **Kugel-Design:** **keine horizontal geteilte Kugel rot oben / weiß unten mit Mittelband und rundem Knopf**,
  auch nicht in anderen Farben mit genau dieser Teilung. Vorschlag Driftkugel: **Glas-/Bernsteinkugel in einem
  Messing-Käfig mit drei senkrechten Spangen** oder eine **Samenkapsel** (passt zu Farming), Leuchtkern im
  Typ-Akzent, Öffnen = Spangen klappen auf (`orb_open`). Wurf-/Fang-Animation mit eigenem Rhythmus (Glühen +
  Spangen schließen), nicht „rot aufblitzen + Klick“.
- **Typ-Symbolik:** keine Nachbildung bekannter Typ-Icons (Flamme im Kreis in typischer Typfarbe auf Pill-Badge)
  und nicht exakt deren 18-Typen-Farbsystem. Eigene Icons: **Runen-Plaketten** (Rautenform), Farben aus unserer
  Palette. Die Typen-Tabelle ist mit 6 + Normal eigenständig genug. Die Dreieck-Beziehung Feuer/Pflanze/Wasser
  ist Genre-Allgemeingut.
- **Creature-Motive:** keine gelbe Elektro-Maus, kein Schwanzflammen-Echsen-Starter, kein Otter mit Bauchmuschel,
  kein Igel mit Blattkapuze, keine Krabbe mit Steinblock-Rücken (siehe §1). Keine bekannten Design-Signaturen
  (Blitzschwanz, Knospe auf dem Rücken).
- **UI/Ablauf:** keine Nachbildung bekannter Bildschirme (Kampf-Menü mit 4 Feldern „Kampf/Beutel/Pokémon/Flucht“,
  Heilzentrum mit Krankenschwester-Jingle, Entwicklungs-Jingle-Melodie). Unser Echtzeit-Kampf im Feld unterscheidet
  sich bereits deutlich.
- **Musik/Sound:** keine Melodien oder charakteristischen Jingles nachempfinden (Heil-Jingle, Fang-Jingle, Level-up).
- **Patente:** Nintendo/The Pokémon Company haben 2024 Pocketpair (Palworld) wegen Patenten verklagt. Diese
  betreffen laut Berichten das **Werfen eines Fang-Items auf ein Monster im offenen Feld** mit nahtlosem Übergang
  sowie das Reiten. Für ein privates/nicht kommerzielles Projekt ist das Risiko gering. **Vor einer
  Veröffentlichung juristisch prüfen.** Risikoärmere Alternative für später: Fangen per „Bindung“ im
  Arena-Ring (Knopf halten, Ring schließt sich, Rhythmus-Eingabe) statt Kugelwurf auf das Feldmonster.

**Erlaubt und üblich (Genre-Konventionen):** Monster sammeln, Team mit 6, Typen mit Stärken/Schwächen,
Entwicklung über Level, Starter-Wahl aus 3, Box-System. Cassette Beasts, Temtem und Coromon zeigen, dass das
Genre offen ist, solange **Designs, Namen und Präsentation eigenständig** sind.
