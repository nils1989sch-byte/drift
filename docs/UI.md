# DRIFT – UI (HUD, Dialoge, Menüs, Touch)

Besitzer: UI-Agent (`src/ui/`). Basis: UI-Vertrag in `docs/ARCHITECTURE.md`, Stil in `docs/STYLE_GUIDE.md` §8.
Isolierter Prüfstand: `src/ui/demo.html` (Fake-Game). Parameter: `?screen=title|pause|dialog|choice|gameover|area|low`,
`?art` (echte Icons laden), `?touch=1` (Touch-UI auf dem PC erzwingen). Tasten in der Demo: 1 Dialog, 2 Ja/Nein,
3 Schaden, 4 Heilen, 5 Gebietsname, 6 Game Over, 7 Titel, 8 Rupien, 9 Toast, 0 Herzcontainer.

## Dateien

| Datei | Inhalt |
|-------|--------|
| `index.js` | `createUI()`, Overlay-Canvas, Skalierung, Safe-Area, Tipp-Weiterleitung, Zustände |
| `font.js` | Pixel-Font 5×7 (proportional, Unterlängen, ÄÖÜäöüß, Satzzeichen, Pfeile ▶▼◀, ×, ♥, ≡), gecachtes Rendering |
| `hud.js` | Item-Box, Zähler, Herzen, Low-Health-Puls, Gebietsname-Banner, Toasts |
| `dialog.js` | Pergament-Sprechblase mit Zeiger (anchor), Schreibmaschine, Seiten, Namensreiter, Auswahl |
| `screens.js` | Titelbild (Logo „DRIFT“), Pause-Menü (Inventar, Optionen, Steuerung), Game Over |
| `touch.js` | Virtueller Stick und Buttons (DOM-Trefferflächen, Grafik auf dem UI-Canvas) |
| `icons.js` | Ersatz-Icons, falls in `assets.icons` ein Schlüssel fehlt |
| `theme.js` | Palette, `panel()` (dunkel, edel), `plaque()` (HUD), `bubble()` (Pergament mit unregelmäßigem Rand), Kreise |

## API

```js
const ui = createUI({ root, input, assets, sfx, camera });
ui.bind(game);              // game.player / game.state / game.areaName werden jedes Frame gelesen
ui.resize(w, h, dpr);       // Gerätepixel; UI-Skala S = ganzzahlig, ≈ kurze Seite / 260 (kurze Seite mind. 200 UI-px)
ui.update(dt); ui.draw();   // update nach input.poll() (je Fixed-Step), draw einmal pro Frame
ui.blocking                 // true, solange Titel, Pause, Game Over oder ein Dialog offen ist
await ui.dialog(lines, opts?)
ui.toast(text, { id?, time? })   // gleiche id ersetzt einen Toast (z. B. 'zoom')
ui.showArea(name)           // Gebietsname von Hand einblenden (sonst automatisch bei Änderung von game.areaName)
ui.showTitle(onStart)       // onStart(), sonst game.start?.()
ui.showGameOver(onRetry)    // onRetry('continue' | 'restart'); ohne Callback: game.retry/continue/start bzw. game.restart / reload
ui.openPause(); ui.closePause(); ui.closeDialog(); ui.closeTitle();
ui.state                    // 'title' | 'pause' | 'gameover' | 'dialog' | 'hud'
ui.touchMode, ui.hideHud, ui.scale
// Font für andere Module:
import { drawText, measure, wrap, rasterize, buildFontAtlas } from './ui/index.js';
drawText(ctx, 'Hallo', x, y, { color, outline, shadow, scale, align, alpha });   // color darf ein Array mit einer Farbe pro Zeile sein
```

### Dialog-Eingabe
```js
ui.dialog('Ein Text.');                                         // → true
ui.dialog(['Seite 1 …', 'Seite 2 …']);                          // jedes Element beginnt eine neue Seite
ui.dialog({ text: 'Truhe öffnen?', speaker: 'Ältester', choices: ['Ja', 'Nein'] });  // → 0 | 1
ui.dialog(lines, { speaker: 'Wache', choices: ['Ja', 'Nein'] });
// Sprechblase mit Zeiger zur Figur (anchor, auch pro Zeile als {text, anchor}):
ui.dialog('Hallo!', { speaker: 'Ältester', anchor: { x, y } });                   // Gerätepixel des Game-Canvas
ui.dialog('Hallo!', { anchor: { x, y, space: 'css' } });                        // CSS-Pixel
ui.dialog('Hallo!', { anchor: { x: npc.x, y: npc.y, z: npc.z, world: true } }); // über renderer.worldToScreen(x,y,z)
ui.dialog('Hallo!', { anchor: () => ({ x, y, bottom }) });                       // Funktion, jedes Frame neu ausgewertet
```
Mit `anchor` steht die Blase über der Figur und der Zeiger zeigt auf den Ankerpunkt (am besten den Kopf). Ist darüber
zu wenig Platz, rutscht die Blase unter die Figur, nämlich unter `bottom` (Füße, sonst `y + 30` UI-px), damit sie die
Figur nicht verdeckt. Ohne `anchor` sitzt die Blase unten in der Mitte. `worldToScreen` darf `{x, y}` oder `[x, y]` in
Gerätepixeln zurückgeben, bei `{space: 'css'}` in CSS-Pixeln.
`\n` erzwingt einen Zeilenumbruch. Die Box zeigt 3 Zeilen und bricht automatisch auf die nächste Seite um.
Text läuft mit 36 Zeichen/s, bei gehaltener Taste dreimal so schnell. Bei jedem zweiten Zeichen spielt
`sfx.play('text_blip')`. A/B bzw. ein Tippen zeigt die Seite sofort ganz und blättert dann weiter. Sind mehrere
Dialoge offen, kommen sie in eine Warteschlange. Gibt das Spiel `state === 'play'` an, setzt die UI während des
Dialogs `'dialog'` und danach wieder `'play'`.

### Was die UI vom Spiel liest (alles optional)
- `player.hp`, `player.maxHp` in **halben Herzen** (2 hp = 1 Herz), `player.rupees`, `player.bombs`, `player.keys`,
  `player.item` (Icon-Schlüssel des aktuellen Items).
- Inventar: `player.inventory` / `player.items` / `player.owned` (Array, Set oder Objekt mit Wahrheitswerten) sowie
  `player.sword`/`hasSword` und `player.shield`/`hasShield`. Ab `bombs > 0` zählt `bomb` als vorhanden.
- `game.areaName` (oder `game.world.name`): Ändert sich der Wert, blendet die UI ein Banner ein.
- `game.state`: Bei `'title'` öffnet sich der Titel, bei `'gameover'` der Game-Over-Bildschirm (jeweils beim Wechsel).
  **Der Titel schließt sich sofort ohne Callback**, sobald `game.state !== 'title'` ist (z. B. nach `debug.teleport`),
  wenn er im Zustand `'title'` geöffnet wurde oder gerade ausblendet. Manuell geht das mit `ui.closeTitle()`.
- `game.start()`, `game.retry()`, `game.restart()`, `game.onPause(bool)`.

### Pause
**Die UI wertet `start` (Enter, Esc, P, Menü-Button) aus.** Im Zustand `state === 'play'` öffnet sie damit das
Pause-Menü und setzt `game.state = 'pause'`; beim Schließen geht es auf `'play'` zurück. Das Gameplay sollte
`start` deshalb nicht selbst für eine Pause verwenden.

Im Menü stehen das Inventar (ein Tipp auf ein Slot wählt das Item), Fortsetzen, Item ◀▶, Zoom ◀▶ (`camera.zoom`),
Ton An/Aus (`sfx.setVolume(0|1)`, gespeichert in `localStorage`), Tilt-Shift An/Aus
(`window.__drift.renderer.tiltShift`) und eine Steuerungshilfe. Ab einer Breite von 360 UI-px ist das Menü zweispaltig.

### Icons
`assets.icons[key]` hat Vorrang (auch `icon_<key>` und `item_<key>`), sonst greift ein eingebautes Ersatz-Icon.
Benutzt werden `heart_full`, `heart_half`, `heart_empty`, `rupee`, `bomb` und `key` sowie als Items `sword`, `shield`,
`bomb`, `bow`, `boomerang`, `lamp`, `potion`, `map` und `compass`. Icons bis 8 px werden in der 16er-Item-Box doppelt
so groß gezeichnet.

### SFX-Namen, die die UI abspielt
`text_blip`, `text_next`, `menu_open`, `menu_close`, `menu_move`, `menu_select`, `menu_start`, `game_over`,
`music('title')`. Unbekannte Namen sollten keinen Fehler auslösen.

## Look (HD-2D / Octopath-Stil)
- **Dialog:** Die Sprechblase ist leicht transparentes Pergament bzw. Stein in warmem Grau-Beige (`#d9cfbd`, 94 %) mit
  Papierkorn und Licht von oben. Der Rand ist dunkel (`#3a2e2a`), 2–3 px breit und unregelmäßig gezackt (fester Seed,
  dadurch flackert nichts). Die Form ist an den Ecken abgeschrägt und hat links und rechts flache Spitzen. Oben links sitzt ein
  sechseckiger, taupefarbener Namensreiter mit heller Schrift, der Zeiger zur Figur ist eine dünne dunkle Linie. Der Text ist dunkel
  (`#2a2026`) auf hellem Grund, der Weiter-Pfeil rotbraun. Die Auswahl steht in einer eigenen kleinen Blase.
- **HUD:** kleine, dunkle Glas-Plaketten (`#141019`, ca. 40 %) mit feiner goldener Haarlinie, Zahlen in Elfenbein,
  dazu ein zurückhaltendes Label „LEBEN“. Die Item-Box (20×20) bleibt **ausgeblendet, solange `player.item` leer
  ist**; die Zähler rücken dann nach. Herzen erscheinen auf breiten Bildschirmen (Querformat oder Desktop, ab 400 UI-px
  Breite und wenn eine volle Reihe passt) eine Stufe größer (2×), im Hochformat in 1×. Die Menü- und Zoom-Buttons
  rutschen automatisch unter die Herzleiste.
- **Menüs und Game Over:** dunkles, durchscheinendes Panel mit goldener Haarlinie und kleinen Eck-Nieten, über dem
  Spiel eine weiche Vignette.
- **Titel:** Das 3D-Diorama läuft sichtbar weiter (nur oben und unten eine leichte Vignette). Das Logo ist elfenbein
  bis hellgold, hat einen Glanz-Sweep und einen **weichen, pulsierenden Glow**. Der Glow entsteht durch Herunter- und
  wieder Hochskalieren mit Glättung und funktioniert daher auch ohne `ctx.filter`. Die Logo-Pixel selbst bleiben scharf.
- **Ortstitel (`game.areaName`):** wie in Octopath ohne Box. Er steht zentriert im oberen Drittel (20 % der Höhe) im
  Pixel-Font in 2× (zu schmal: 1×), elfenbein mit dunkler `ink`-Kontur. Links und rechts laufen feine Ornament-Linien
  mit Raute aus, die nach außen ausblenden. Blendet 0,4 s ein, hält 2 s und blendet 0,6 s aus. Gezeichnet wird er
  scharf auf dem UI-Overlay, also nicht in der 3D-Szene und ohne DOF.

## Darstellung
- Ein eigenes Canvas `.drift-ui` liegt über `#game`, hat volle Gerätepixel und `pointer-events: none`.
  Gezeichnet wird mit `setTransform(S)` für ein ganzzahliges S und nur an ganzzahligen UI-Koordinaten, ohne
  Glättung. Die Pixel bleiben dadurch immer scharf, Zoom und Tilt-Shift wirken nicht auf die UI.
- Die Farben kommen aus dem Style Guide (`ink` #181020 ist die dunkelste Farbe, kein reines Schwarz), ergänzt um die
  HD-2D-Materialtöne in `theme.js`.
- Safe-Area: Ein Mess-`div` liest `env(safe-area-inset-*)` aus. HUD, Dialog, Menüs und Touch-Elemente halten diesen
  Abstand ein.

## Steuerung

| Aktion | Tastatur | Gamepad | Touch |
|--------|----------|---------|-------|
| Laufen | WASD / Pfeile | Stick / Steuerkreuz | Stick links (erscheint dort, wo der Daumen aufsetzt) |
| Schwert | J / Leertaste | A (0) | **A** |
| Aktion / Heben / Reden | K / E | B (1) | **B** |
| Item | L / Q | X (2) | Item-Button (zeigt das aktuelle Item) |
| Menü | Enter / Esc / P | Start | ≡ oben rechts |
| Zoom | + / − / Mausrad | LB / RB | + / − oben rechts, Pinch auf dem Spielfeld |
| Dialog weiter | J / K / Leertaste | A / B | irgendwo tippen |
| Menü-Navigation | Pfeile + J/K | Steuerkreuz/Stick + A | Einträge antippen (◀ ▶ links/rechts auf der Zeile) |

### Touch-Details
- Die Touch-Steuerung erscheint, sobald das Gerät `pointer: coarse` meldet oder ein Touch-Ereignis eintrifft. Nach
  einem Tastendruck wird sie ausgeblendet. Während Titel, Pause, Game Over und Dialog ist sie ausgeblendet; getippt
  wird dann direkt auf den Bildschirm.
- **Stick:** Er liegt in der Zone unten links (unterhalb von 33 % der Höhe und links von den Buttons). Der Mittelpunkt
  ist dort, wo der Daumen aufsetzt. Der Radius beträgt etwa 11 % der kurzen Seite, mindestens 46 CSS-px. Die Totzone
  liegt bei 20 %, die Ausgabe ist danach linear. Zieht man über den Rand hinaus, wandert der Stick mit. Die UI ruft
  `input.setVirtualAxis(x, y)` auf.
- **Buttons:** A, B und Item sind wie ein SNES-Pad als Raute angeordnet und mindestens 44 CSS-px groß; Menü und
  Zoom ± sitzen unter den Herzen. Sie sind halbtransparent weiß (30 %, gedrückt 55 %). Halte-Buttons rufen
  `input.setVirtual(action, bool)` auf und bleiben mindestens einen Poll lang gedrückt, damit auch ein kurzer Tipp
  ankommt. Menü und Zoom nutzen `input.pulse()`. Multitouch läuft über `setPointerCapture` je Pointer.
- Jedes DOM-Element fängt nur seine eigene Fläche ab. Pinch-Zoom aus `main.js` auf `#game` funktioniert überall
  sonst. Text-Selektion, Kontextmenü und Doppeltipp-Zoom sind auf den Steuerelementen abgeschaltet
  (`touch-action: none`, `preventDefault` auf `touchstart`).
- Haptik: Bei Schaden ruft die UI `navigator.vibrate(35)` auf, bei Game Over ein Muster (nur im Touch-Modus).

## Tests
Playwright mit 1280×720 (Desktop), 390×844 und 844×390 (DPR 3, `hasTouch`, `isMobile`). Getestet wurden Titel per
Tipp, Stick und A gleichzeitig (Multitouch), Menü-Button, Pause, Dialoge mit Seitenumbruch und Umlauten, Ja/Nein,
Game Over, Gebietsbanner und Low Health. Es traten keine Konsolenfehler auf, weder in der Demo noch in `index.html`.
