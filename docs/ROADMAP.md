# DRIFT – Roadmap

## Jetzt (Version 0.1, Vorabversion)
- HD-2D-Renderer (Three.js): 3D-Gelände mit Pixel-Texturen, Billboards, Sonnenlicht, Schatten, DOF, Bloom, Grading
- Oberwelt Driftwald, 2 Innenräume, Höhle, Dungeon mit 4 Räumen, Golem-Boss, Ende
- HD-Figuren, Gras-Halmfeld, organische Wege, 3D-Bäume/Häuser, X-Ray-Silhouetten (Held blau, Gegner rot)
- PC (Tastatur/Gamepad) + Touch, Zoom, adaptive Grafikqualität
- QA-Playtests: `npm run playtest`

## Als Nächstes (Version 0.2 – Feinschliff)
- QA-Regressionsrunde 2, Fixes
- Requisiten (Brunnen, Karren, Bänke) feiner und stimmiger zur Umgebung
- Performance auf echten Handys messen und abstimmen
- Ladebildschirm, Einstellungen (Grafikqualität manuell)

## In Arbeit (Version 0.3 – Baukasten zum Umgestalten)
**Stand:** `editor.html` läuft – Boden malen/füllen, Höhen formen, Objekte, Personen (mit Dialog), Trainer (Team, Texte),
Truhen, Übergänge zwischen Karten, Begegnungs-Zonen (Monster, Level, Tag/Nacht), Ereignisse (Text, Flag, Monster schenken,
Starter wählen, Reise), Startpunkte, mehrere Karten, Rückgängig/Wiederholen, Autosave im Browser, Export/Import,
Prüfen, **▶ Probe spielen** und **Live-HD-2D-Vorschau**. Das Spiel lädt Projekte mit `index.html?content=local`
(eigener Spielstand pro Projekt). **Eigene Grafik-Sets** (🎨 im Editor): ZIP/PNGs laden → automatische Erkennung von Raster, Boden-Tiles (mit Bodenart),
Objekten und Figuren-Sheets (Stehen/Laufen je Richtung, Spiegeln) → im Importer korrigieren → sofort in Paletten, Vorschau
und Spiel. Bilder bleiben lokal (IndexedDB), ins Projekt kommt nur die Zuordnung. Tiles können eingebaute Böden ersetzen.
**Szenen-Generator** (✨ im Editor): 6 Vorlagen (Wiesen-Route, Waldweg, Flusstal, Küste, Dorf, Höhle), Seed + Regler
(Wasser, Wald, Hügel, hohes Gras, Monster-Level, Truhen, Ausgänge), Live-Minikarte, als neue Karte oder Ersatz, Ausgänge mit
vorhandenen Karten verbinden. **Bildstil** im Pausenmenü: Klar (Standard) / Diorama / Pur.
Offen: HD-Aufwertung importierter Grafik (Detail/Licht), Autotile-Übergänge aus Sets, Smart-Brushes/Generatoren, Figuren-Baukasten, Monster-Werkstatt.

1. **Inhalte als Daten:** Karten, Objekte, NPCs, Dialoge, Truhen, Warps und Gegner-Spawns als JSON in `content/`
   (statt im Code). Das Spiel lädt sie beim Start; Code nur noch für Verhalten.
2. **Level-Editor im Browser** (`editor.html`): Kacheln malen, Höhen setzen, Objekte/NPCs/Gegner per Klick platzieren,
   Warps verbinden, Dialoge eintippen, Live-Vorschau im HD-2D-Renderer, „Probe spielen“-Knopf, Speichern als JSON.
3. **Figuren-Baukasten** (`characters.html`): neue Personen aus Bausteinen zusammenklicken (Kopf, Haare, Kleidung,
   Farben, Accessoires) – Licht/Schatten/Animationen entstehen automatisch über das bestehende Rig-System.
4. **Verhaltens-Vorlagen** für NPCs (steht, läuft umher, folgt Weg, Händler, Questgeber) und Gegner
   (wandert, verfolgt, schießt, hüpft, fliegt) – im Editor wählbar.
5. **Quests & Flags** einfach im Editor: „Wenn Flag X, dann Dialog Y / Tür öffnet / Item“.
6. **Anleitung** `docs/MODDING.md`: Schritt für Schritt neue Person, Gegner, Raum, Dungeon hinzufügen.
