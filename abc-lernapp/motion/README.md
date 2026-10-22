# Motion – ABC mit Bruno

Kurze animierte Clips mit der vorhandenen Art (Bruno, Szenerie, Illustrationen), gebaut mit **HyperFrames 0.8.140** (HTML-Komposition → Chromium → ffmpeg). 1180×820, 30 fps, ohne Ton.

## Clips (`out/`)

| Clip | Dauer | Inhalt | MP4 (H.264) | WebM (VP9) | Poster |
|---|---|---|---|---|---|
| `intro` | 4,0 s | Himmel mit treibenden Wolken. Bruno taucht hinter einer Wolke auf (Stretch beim Aufsteigen, sanftes Nachfedern), wackelt mit den Ohren und winkt (happy). „ABC" und „mit Bruno" fallen Buchstabe für Buchstabe herein, mit Squash & Stretch, danach Funkeln. Der letzte Frame ist ruhig und eignet sich als Splash. | 159 KB | 73 KB | 25 KB webp / 397 KB png |
| `feier` | 3,0 s | Bruno jubelt (cheer) und springt zweimal (Ausholen, Sprung, Landung mit Squash). Dazu Sternen-Burst, Konfetti mit Schwerkraft und 3D-Flip, „Super gemacht!" und fünf Sterne, die nacheinander hereinfallen. Langsame Strahlen im Hintergrund. | 376 KB | 196 KB | 30 KB webp / 504 KB png |
| `buchstabe-m` | 4,0 s | Buchstaben-Karte: Karte öffnet sich, großes „M" springt herein, dann „m". Die Maus gleitet herein und schwebt sanft, dann erscheint „M wie Maus". Das farbige „M" hüpft bei 2,1 s (Sync-Punkt für die Stimme). | 170 KB | 67 KB | 21 KB webp / 356 KB png |
| `buchstabe-a` | 4,0 s | Dasselbe Template mit „A wie Affe". | 169 KB | 71 KB | 22 KB webp / 361 KB png |

Bewegung nach DESIGN.md §8: Federn mit 260/14 und 180/20 sowie die Kurven `--spring`, `--spring-soft` und `--ease-out`. Es gibt kein Blinken und keine harten Schnitte; Bruno wird nur über seine eigenen SVG-Gruppen animiert und bleibt so on-model.

## Rendern

```bash
cd motion
npm install                          # hyperframes, gsap, Fredoka (lokal, kein CDN)
./render.sh                          # alles  (= npm run render)
./render.sh intro                    # nur ein Clip
LETTERS="A B K" ./render.sh buchstabe   # beliebige Buchstaben aus words.json
```

- `render.sh` sucht Chromium unter `/opt/pw-browsers/…/headless_shell`. Anderswo setzt du `HYPERFRAMES_BROWSER_PATH`. Ein Browser wird nie heruntergeladen.
- Ablauf: `build.mjs` erzeugt aus `src/*.html` eigenständige Kompositionen in `build/`. Dabei werden die SVGs aus `../design` inline eingesetzt, und für das Buchstaben-Template kommen alle 26 Wörter und Bilder dazu. Danach rendert `hyperframes render` einen Master (CRF 16), und ffmpeg erzeugt daraus MP4 (CRF 23, yuv420p, faststart), WebM (VP9 2-pass, CRF 36) und das Poster (letzter Frame, PNG und WebP).
- Das Buchstaben-Template nutzt HyperFrames-Variablen: `--variables '{"letter":"K"}'`. Mit `"lower": false` wird der Kleinbuchstabe ausgeblendet. Zur Vorschau im Browser öffnest du `build/buchstabe.html?letter=K&t=2` über einen beliebigen Static-Server; `?t=` springt zu einem Zeitpunkt.
- Alle Animationen sind eine reine Funktion der Zeit (`assets/kit.js`, Seeded-PRNG statt `Math.random`). Jeder Frame ist dadurch reproduzierbar.

## Einbau in die App

```html
<!-- Splash beim Start -->
<video class="splash" playsinline muted autoplay preload="auto" poster="…intro-poster.webp">
  <source src="data:video/mp4;base64,…" type="video/mp4">
</video>
<script>
  splash.addEventListener('ended', () => splash.classList.add('fade-out')); // letzter Frame = ruhiger Splash
</script>
```

- **Intro**: als Splash beim ersten Öffnen, danach per CSS-Fade (200 ms) zum Start-Screen. Der letzte Frame entspricht dem Poster; man kann ihn stehen lassen, bis die App bereit ist.
- **Feier**: nach 5 gefundenen Sternen, als Vollbild-Overlay vor den Buttons „Nochmal / Start". Die Buttons sollten erst bei ca. 2,4 s erscheinen. Den Satz „Super gemacht, Mia!" kann die App als Stimme abspielen.
- **Buchstabe**: optional als „Buchstabe des Tages"-Intro. Die Detail-Karte der App animiert schon live per CSS, also lohnt sich das Video nur, wo es keine Interaktion braucht.
- Immer `playsinline muted` setzen, sonst startet iPad-Safari kein Autoplay. Bei `prefers-reduced-motion: reduce` statt des Videos das Poster zeigen.
- **Format**: H.264-MP4 läuft auf jedem iPad. VP9-WebM ist etwa 50 % kleiner, wird aber erst von neueren iPadOS-Versionen unterstützt. Am sichersten ist MP4 allein. Mit `<source>` WebM + MP4 als Fallback sparst du nur dann, wenn beide nicht inline im HTML landen.

### Größen für die Single-File-Variante (data: URI, base64 ≈ +33 %)

| Datei | Roh | als data: URI |
|---|---|---|
| intro.mp4 | 159 KB | ≈ 213 KB |
| intro.webm | 73 KB | ≈ 98 KB |
| feier.mp4 | 376 KB | ≈ 502 KB |
| feier.webm | 196 KB | ≈ 262 KB |
| buchstabe-m.mp4 | 170 KB | ≈ 228 KB |
| intro-poster.webp | 25 KB | ≈ 34 KB |

Empfehlung: Inline lohnen sich **intro.mp4** und **feier.mp4** (zusammen ≈ 715 KB base64). Buchstaben-Videos besser nicht für alle 26 Buchstaben einbetten (26 × ~230 KB); das Live-CSS-Reveal der App reicht dafür. Kleiner geht es mit `WEBM_W=884 ./render.sh` (0,75×) oder einem höheren `WEBM_CRF`.

## Dateien

- `src/` enthält die Kompositionen (Quelle) und `common.css`.
- `build/` enthält die generierten, eigenständigen Kompositionen.
- `assets/` enthält `kit.js` (Easing, Federn, Bruno-Steuerung, Clock-Bindung an HyperFrames), GSAP und Fredoka (woff2).
- `out/` enthält die Ergebnisse.
