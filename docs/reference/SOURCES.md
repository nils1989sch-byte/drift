# Quellen & Referenzen (Referenz-Agent)

Nur zum Abgleich. **Keine** fremden Grafiken übernehmen, keine Nintendo-Assets herunterladen oder einbinden.

## ALttP – Raster, Sprites, Hardware
- Grid 8×8 / 16×16, Link ≈ 18×24 (Devlog-Analyse): https://matt-longtrailgames.itch.io/chance-twc/devlog/770479/diving-in-with-pixel-art
- ALttP-Prototyp, Paletten-/Sprite-Analyse: https://tcrf.net/Proto:The_Legend_of_Zelda:_A_Link_to_the_Past/Mid-1991_Overdump
- ALttP Entwicklung, Spieler-Sprite/Animationen: https://tcrf.net/Development:The_Legend_of_Zelda:_A_Link_to_the_Past/Player
- SNES-Sprite-Paletten (16 Farben, Index 0 = transparent): https://archive.nes.science/nesdev-forums/f12/t15953.xhtml
- Pixel-Art-Tutorial, Outline-Regeln (Sprites outlinen, Innenlinien sparsam): https://nesdev.nes.science/f21/t6892.xhtml
- SNES 15-bit BGR555, 32 Stufen/Kanal: https://wiki.superfamicom.org/palettes
- BGR555: https://sneslab.net/wiki/BGR555
- CGRAM (256 Paletteneinträge): https://snes.nesdev.org/wiki/CGRAM
- RGB-Werte der SNES-Palette (Diskussion): https://archive.nes.science/nesdev-forums/f5/t12739.xhtml

## Farbe, Ramps, Hue-Shifting
- Slynyrd Pixelblog 1 – Color Palettes (Hue-Shift statt gerader Ramps): https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes
- Gamedev.net – Color Palettes (Hue-Schritt pro Stufe): https://gamedev.net/tutorials/visual-arts/color-palettes-r4964
- Hue-Shifting-Tutorial (kühle Schatten, warme Lichter): https://www.ascensiongamedev.com/topic/3680-xenogenes-art-tutorials/
- Paletten-Struktur / Ramps nach Helligkeit: https://opengameart.org/node/5493
- Ramp-Generator / Kurs: https://www.wayline.io/color-ramp-generator , https://www.wayline.io/learn/color-palettes

## Diorama / Tilt-Shift
- Tilt-Shift als 2D-Bandmaske (Blur außerhalb eines Streifens): https://doc.qt.io/qt-6.3/qml-qtquick3d-effects-tiltshift.html
- Unity Tilt Shift (Spezialfall Depth of Field): https://docs.unity3d.com/352/Documentation/Components/script-TiltShift.html
- Tilt-Shift-Miniatur aus 2D-Bildern (Fokusband + Sättigung): https://inst.eecs.berkeley.edu/~cs194-26/fa17/upload/files/projFinalAssigned/cs194-26-abq/
- Eastward-Licht-Diskussion (2D-Licht auf dunkler Szene, keine Normal-Maps): https://itch.io/post/9039152
- Licht in Miniatur-Dioramen (eine Lichtquelle, dunkle Basis): https://gameofbricks.eu/blogs/news/the-magic-of-lighting-in-lego-dioramas
- Referenzspiele (Ansicht, nicht Quelle): Octopath Traveler (HD-2D), Tunic, Eastward, Sea of Stars

## Vergleichsmaßstab (freie Assets, nur ansehen)
- ArMM1998 „Zelda-like tilesets and sprites“ (Lizenz als CC0 gelistet, im Kommentar angezweifelt): https://opengameart.org/node/70957
- Deepnight Dungeon Tileset (CC0, 16×16): https://opengameart.org/node/100171
- Kenney (CC0-Assets, u. a. Tiny Town / Tiny Dungeon 16×16): https://kenney.nl/assets

## HD-2D
- HD-2D (Wikipedia: dynamisches Licht, DOF, Tilt-Shift): https://en.wikipedia.org/wiki/HD-2D
- Octopath-Entwickler-Interview (Tiefe, Tile-/Farbvarianz): https://www.siliconera.com/project-octopath-traveler-developers-answer-project-started-troubles-developing-hd-2d/
- HD-2D-Pipeline DX12 (Bokeh-Gather 64 Samples, Contact Shadows, ACES, Sprite-Normalmaps): https://dev.to/gaurav_de/creating-an-hd-2d-rendering-pipeline-on-dx12-205k
- Analyse Octopath-Postprocessing (AO, Lens-Flare, Vignette, DOF, Bloom): https://www.tfgonline.lapinf.ufn.edu.br/media/midias/TCC2_Final_4M2dWJZ.pdf
- Three.js Billboards: https://threejs.org/manual/en/billboards.html
- Three.js Billboard + Depth: https://discourse.threejs.org/t/is-billboard-depth-supported/6504

## Monster / Echtzeit-Kampf / Farming
- Cassette Beasts – visuelle Sprache & Fusion (Interview): https://wireframe.raspberrypi.com/articles/creature-collecting-gets-an-analogue-upgrade-in-cassette-beasts
- Cassette Beasts – Abgrenzung zum Genre-Vorbild: https://www.endlessmode.com/video-games/cassette-beasts/cassette-beasts-is-a-cool-stylish-take-on-the-pokemon-formula
- Legends Arceus – sichtbare Wildmonster, Schleichen, Zielwurf: https://www.thegamer.com/pokemon-legends-arceus-seamless-catching/
- Legends Arceus – Review (aggressive Monster brechen eher aus): https://beacon.betheluniversity.edu/2022/02/pokemon-legends-arceus/
- Fangraten-Mechanik (Genre-Referenz, HP-Faktor, Wackler): https://bulbapedia.bulbagarden.net/wiki/Catch_rate
- Telegraph-Design (Windup, Familien, Konsistenz): https://bugnet.io/blog/how-to-design-enemy-attack-telegraphs
- Telegraph-Formsprache Top-Down: https://gamineai.com/blog/enemy-telegraph-shape-language-top-down-boss-fights-fast-visual-consistency-audit-2026
- Stardew Valley Crops (Wachstum/Preise als Taktreferenz): https://carlsguides.com/stardewvalley/farming/crops.php
- Stardew Spring Crops: https://www.gamerevolution.com/guides/350535-stardew-valley-seasonal-crops-guide
- Nintendo vs. Pocketpair (Patente, Trade Dress): https://asiaiplaw.com/section/in-depth/pikachu-with-guns-nintendo-fires-back
