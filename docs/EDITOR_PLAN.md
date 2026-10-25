# DRIFT-Editor – Plan & Agenten (Regie)

Ziel: Ein innovativer Welt-Editor im Browser, mit dem man ohne Programmieren ein eigenes HD-2D-Monster-Fang-Spiel
(Pokémon-ähnlich, mit Echtzeit-Kämpfen und Hof) baut – am PC und am Tablet. Ergebnis ist reines JSON
(`docs/CONTENT_FORMAT.md`), das das Spiel direkt lädt („▶ Probe spielen“).

## Agenten
| Agent | Ordner | Aufgabe |
|---|---|---|
| **Content-Agent** | `src/content/`, `content/`, `tools/convert-maps.mjs` | JSON-Format (Schema, Validierung, Migration), Loader/Serializer, Event-Interpreter, Konvertierung der bestehenden Welt Driftwald nach JSON |
| **Editor-Core-Agent** | `editor/` (ohne tools/inspectors) | App-Shell, 2D-Bauansicht + **Live-HD-2D-Vorschau** mit dem echten Renderer, Undo/Redo, Autosave, Import/Export, Basis-Pinsel, Höhen-Sculpting, Objekt-Palette, Zonen, Plugin-API, „Probe spielen“ |
| **Editor-Werkzeug-Agent** | `editor/tools/`, `editor/inspectors/` | Smart-Brushes (Terrain mit Auto-Übergängen, Spline-Wege, Flüsse mit Brücken, Klippen mit Auto-Treppen, Wald-Streuer), Stempel/Vorlagen, Generatoren (Route, Biom/Insel, Dorf, Höhle), Inspektoren (NPC, Dialog-Graph, Encounter-Zonen, Trainer, Warps, Events), Monster-Werkstatt, Figuren-Baukasten, Prüfer/Minimap/Welt-Graph |
| Gameplay A | `src/game/` | lädt Content-Projekte (`index.html?content=local`), bindet Events an |
| QA | `tools/`, `docs/qa/` | Editor-Tests: bauen → speichern → spielen |

## Innovative Kernideen
1. **Live-HD-2D beim Bauen** – man malt in 2D und sieht sofort das Octopath-artige 3D-Diorama mit Licht, Tageszeit, Wind.
2. **Organische Werkzeuge statt Kacheln** – Wege und Flüsse als Kurven, Klippen als Plateaus mit Auto-Treppen, Wälder streuen.
3. **Generatoren mit Seed** – „Route generieren“ erzeugt Weg, Grasflächen mit passenden Monstern, Trainer und Items; danach frei nachbearbeiten.
4. **Spieldesign-Hilfen** – Encounter-Vorschau, Level-Kurve der Route, Prüfer für unerreichbare Stellen, Welt-Graph der Karten.
5. **Monster-Werkstatt & Figuren-Baukasten** – eigene Monster (Werte, Typen, Attacken, Entwicklung) und NPCs zusammenklicken.
6. **Sofort spielen** – ein Klick startet das Spiel genau an der Stelle, an der man gerade baut.

## Eigene Assets & automatische Umwandlung (Asset-Import-Agent, `src/assetpack/`, `editor/importer/`)
- Import fertiger 2D-Sets (ZIP oder PNGs): Raster-/Autotile-Erkennung, Sprite-Sheets → Animationen, automatische Zuordnung zu Tiles/Objekten/Figuren/Monstern mit manueller Korrektur.
- **2D → HD-2D**: kantenscharfe Hochskalierung auf 48 px/Tile bzw. doppelte Sprite-Dichte, Detail- und Farbrampen-Anreicherung, Licht-Ausgleich, automatische Übergänge, Klippen-Faces, Bäume als 3D-Laubkronen, Grasbüschel aus Gras-Tiles.
- Pixel-Editor zum Selbermalen (Frames, Onion-Skin, Palette).
- **Lizenzen**: Pakete bleiben lokal beim Nutzer (IndexedDB) und werden nie ins Repo oder in veröffentlichte Versionen übernommen (z. B. „Cute Fantasy Free“: nicht-kommerziell, keine Weitergabe).
