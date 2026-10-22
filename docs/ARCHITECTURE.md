# DRIFT – Architektur & Schnittstellen (Regie-Dokument)

Pixel-Action-Adventure im Stil von *A Link to the Past* (SNES), dargestellt als
2,5D-Diorama: echte Höhenstufen (Plateaus mit Klippen-Frontflächen), Tiefensortierung,
Schlagschatten, Diorama-Sockel mit Erdschnitt, Tilt-Shift, stufenloser Zoom.

Reines HTML5-Canvas + ES-Module, **kein Build-Schritt**. Start: `npm start` → http://localhost:8080

## Ordner & Besitzer (jeder Agent schreibt NUR in seine Ordner)

| Ordner                | Besitzer           | Inhalt |
|-----------------------|--------------------|--------|
| `src/engine/`, `src/main.js`, `src/data/`, `index.html` | Regie | Loop, Renderer, Kamera, Input, Tile-Definitionen |
| `docs/STYLE_GUIDE.md`, `docs/reference/` | Referenz-Agent | Stil-Regeln, Referenzanalyse, Abgleich-Reports |
| `src/art/`            | Pixel-Art-Agent    | Alle Grafiken, prozedural per Code gemalt |
| `src/anim/`, `src/audio/` | Animations-Agent | Animations-Definitionen, Animator, Partikel/FX, SFX |
| `src/game/`           | Gameplay-Agent     | Karten, Entities, Spieler, Gegner, Kampf, Items |
| `src/ui/`             | UI-Agent           | HUD, Dialoge, Menüs, Titelbild, Touch-Steuerung |
| `tools/`, `docs/qa/`  | QA-Agent           | Playwright-Playtests, Bug-Reports |

## Koordinaten & Konventionen

- `TILE = 16` Weltpixel. `LEVEL = 16` Pixel Bildschirmversatz pro Höhenstufe.
- Weltposition einer Entity: `x, y` = **Fußpunkt** auf der Bodenebene in Weltpixeln, `z` = Höhe in Stufen
  (normalerweise = Höhe der Zelle, auf der sie steht), `hop` = Sprunghöhe in Pixeln.
- Bildschirmposition: `sx = x`, `sy = y - z*LEVEL - hop` (Renderer setzt Kamera-Transform vorher).
- Richtung: `'down' | 'up' | 'left' | 'right'`.
- Sprites: Canvas-Objekte. Ankerpunkt = unten-mittig (`canvas.ax ?? floor(w/2)`, `canvas.ay ?? h-1`).
  Charaktere ≈ 16×24, Platz für Schwert: Angriffssprites dürfen größer sein (z. B. 32×32), Anker setzen!

## Asset-Vertrag (`src/art/index.js`)

```js
export function buildAssets() → {
  tiles:   { [tileId]: Canvas[] },   // 16×16, >1 Frame = animiert (Renderer wählt Frame nach Zeit)
  faces:   { [faceId]: Canvas[] },   // 16×16 Klippen-Frontfläche (wird vertikal gekachelt), [0]=oberes Stück, [1]=Mittelstück(e), [2]=Fuß
  sprites: { [key]: Canvas[] },      // Frames; Schlüsselformat siehe unten
  icons:   { [key]: Canvas },        // UI-Icons
  font:    { glyphs: {[char]: Canvas}, w, h }, // Pixel-Font für UI
  palette: { [name]: '#rrggbb' },
}
```
Tile-IDs & Face-IDs sind in `src/data/tiles.js` definiert (Regie). Neue IDs → dort ergänzen und Regie informieren.

Sprite-Schlüssel: `<name>_<action>_<dir>` z. B. `hero_walk_down`, `hero_attack_left`, `hero_idle_up`,
`hero_hurt_down`, `hero_lift_down`, `hero_carry_down`, `hero_fall`, `hero_item_get`,
`octorok_walk_down`, `soldier_walk_left`, `slime_idle`, `bat_fly`, `npc_elder_idle_down`,
Objekte: `tree`, `tree_small`, `bush`, `bush_cut`, `rock`, `pot`, `sign`, `chest_closed`, `chest_open`,
`house`, `fence`, `flower`, `grass_tall`, `heart_pickup`, `rupee_green`, `rupee_blue`, `rupee_red`,
`key_small`, Effekte `fx_slash_*`, `fx_poof`, `fx_leaf`, `fx_spark`, `fx_splash` usw.

## Animation-Vertrag (`src/anim/index.js`)

```js
export class Animator {            // pro Entity eine Instanz
  constructor(assets, name)        // name z. B. 'hero'
  play(action, dir, {restart})     // wechselt Animation, Loop/Once laut defs
  update(dt)                       // dt in Sekunden
  get frame()                      // aktuelles Canvas
  get done()                       // bei Once-Animationen: fertig?
  get event()                      // optionales Frame-Event (z. B. 'hit' im Schlagframe)
}
export function createFX(assets)   → { spawn(type, x, y, opts), update(dt), drawables() }
export const ease                  // Easing-Funktionen
// src/audio/index.js
export function createSFX()        → { play(name), music(name), setVolume(v), unlock() }
```
`fx.drawables()` liefert dieselbe Drawable-Form wie Entities (siehe unten).

## Game-Vertrag (`src/game/index.js`)

```js
export function createGame({ assets, input, camera, fx, sfx, ui }) → {
  world,          // Map-Objekt (siehe unten), kann sich bei Raumwechsel ändern
  entities,       // Array von Drawables (inkl. Spieler)
  player,         // { x, y, z, hp, maxHp, rupees, keys, item, ... }
  update(dt),
  state,          // 'title' | 'play' | 'dialog' | 'pause' | 'gameover'
}
```

### Map-Format
```js
{
  id: 'overworld', w, h,           // Größe in Tiles
  ground: Uint16 / Array(w*h) von tileId-Strings  (Hilfsfunktion parseMap in src/engine/world.js)
  height: Array(w*h) von Ints (0..4)
  face:   faceId für Klippen ('rock', 'dirt', 'brick')
  plinth: 'earth' | 'stone'        // Diorama-Sockel-Material
}
```
`src/engine/world.js` stellt `parseMap({rows, heights, legend})`, `tileAt`, `heightAt`, `isSolid` usw. bereit.

### Drawable (Entities, Objekte, FX)
```js
{ x, y, z, sortBias?, shadow?: radius|false, draw(ctx, r) }
```
`r` = Render-Helfer: `r.sprite(canvas, x, y, z, {flip, alpha, flash, hop})`, `r.time`, `r.assets`, `r.ctx`.
Renderer sortiert nach Reihe & `y` und interleaved mit erhöhten Tiles (korrekte Verdeckung hinter Klippen).

## UI-Vertrag (`src/ui/index.js`)

```js
export function createUI({ root, input, assets, sfx }) → {
  bind(game),
  update(dt), draw(),              // eigenes Overlay-Canvas in Bildschirmauflösung
  dialog(lines) → Promise,         // blockiert Gameplay bis bestätigt
  toast(text), get blocking,
  showTitle(onStart), showGameOver(onRetry),
}
```
Touch: UI erzeugt virtuellen Stick + Buttons (A=Schwert, B=Aktion/Heben, Item, Menü, Zoom ±) und ruft
`input.setVirtualAxis(x, y)` / `input.setVirtual(action, bool)`.

## Input (`src/engine/input.js`)
Aktionen: `attack`, `action`, `item`, `start`, `zoomIn`, `zoomOut`. `input.axis` = {x,y} normiert.
`input.down(a)`, `input.pressed(a)` (nur ein Frame). Tastatur: WASD/Pfeile, J/Space=attack, K/E=action,
L/Q=item, Enter/Esc=start, +/-/Mausrad=Zoom. Pinch-Zoom auf Touch (Renderer/Kamera).

## Ergänzungen zum Asset-Vertrag

- `tiles[id]` Array-Optionen: `arr.fps` (Animationsrate, Default 4), `arr.phase = true` (Phasenversatz pro Zelle),
  `arr.mode = 'variant'` (statt Animation: Variante per Positions-Hash – für Gras-Variationen).
- **Übergänge (Autotile-light):** `assets.edges[`${gruppe}_${seite}`]` = 16×16-Overlay (transparent) bzw. Frame-Array,
  `assets.edgeGroup = { grass_dark: 'grass', ... }`, `assets.edgePriority = { grass: 5, path: 3, water: 1, ... }`.
  Hat eine Nachbarzelle (gleiche Höhe) eine Gruppe mit höherer Priorität, malt der Renderer deren Kanten-Overlay
  auf die zugewandte Seite dieser Zelle. `seite` ∈ n,s,w,e = Seite DIESER Zelle, an der der Nachbar liegt.
  Beispiel: Wasserzelle mit Gras im Norden → `edges.grass_n` wird oben auf die Wasserzelle gemalt (Uferkante).
- `faces.plinth_earth`, `faces.plinth_stone`: [Canvas] horizontal kachelbares Muster (z. B. 32×28) für den Diorama-Sockel.
- Pixel-Font gehört dem UI-Agenten (`src/ui/font.js`), nicht der Art. `assets.font` darf null sein.

## Update Klippen (Regie, nach Review 1)
- `LEVEL = 24` (statt 16): höhere, ALttP-artige Klippen.
- `faces[id] = [top, mid, bottom, single?]`, empfohlen je **16×12** (top = Graslippe + obere Brocken, mid = kachelbar,
  bottom = dunkler Fuß), `single` optional 16×24 für 1-Stufen-Klippen. Renderer: top oben, mid wiederholt, bottom unten, geclippt.
  Mehrere mid-Varianten: `faces[id].mids = [Canvas…]` (Renderer wählt per Hash) – optional.
- Endstücke: `faces[id + '_l']`, `faces[id + '_r']` (gleiches Format) werden genutzt, wenn das Plateau links/rechts abfällt.

## HD-Sprites (Regie)
- `canvas.ws` = Welt-Einheiten pro Sprite-Pixel (Default 1). HD-Figuren werden in doppelter Dichte gemalt (z. B. Held 32×48 px)
  und setzen `ws = 0.5` → Weltgröße bleibt 16×24. `ax/ay` bleiben in Sprite-Pixeln. Beide Renderer unterstützen das.
