# DRIFT – Inhaltsformat (Welt-Daten für Spiel und Editor) · Entwurf v1 (Regie)

Ziel: Alles, was man im **DRIFT-Editor** baut, ist reines JSON und wird vom Spiel ohne Code geladen.
Ordner `content/` (im Repo) bzw. `localStorage`/Datei-Export aus dem Editor.

```
content/
  project.json            Projekt: Name, Startkarte + Spawn, Starter-Auswahl, Version
  maps/<id>.json          Karten (eine pro Gebiet/Raum)
  species/<id>.json       Monster-Arten (optional – überschreibt/ergänzt src/game/monsters/species.js)
  moves/<id>.json         Attacken (optional)
  characters/<id>.json    Figuren-Bausteine für NPCs (Figuren-Baukasten)
  dialogs/<id>.json       Dialogbäume (optional; können auch inline in maps stehen)
```

## project.json
```json
{ "format": "drift-content@1", "name": "Mein Abenteuer", "start": { "map": "driftwald", "spawn": "start" },
  "starters": ["funkel", "tropfi", "sprossi"], "flags": {}, "music": { "default": "overworld" } }
```

## maps/<id>.json
```json
{
  "id": "driftwald", "name": "Driftwald", "w": 48, "h": 36,
  "outdoor": true, "face": "rock", "plinth": "earth", "music": "overworld", "ambient": true,
  "layers": {
    "ground": "RLE- oder Zeilen-Strings: eine Zeile pro Reihe, Zeichen laut legend",
    "height": "Zeilen-Strings mit Ziffern 0–9"
  },
  "legend": { ".": "grass", "=": "path", "~": "water" },
  "objects": [ { "type": "tree", "x": 120, "y": 88 }, { "type": "house", "x": 128, "y": 351, "id": "bodo", "door": "house_bodo" } ],
  "npcs": [ { "id": "elder", "character": "elder", "x": 200, "y": 300, "dir": "down",
              "behavior": { "type": "wander", "radius": 32 }, "dialog": "elder_intro" } ],
  "trainers": [ { "id": "ranger_1", "character": "ranger", "x": 500, "y": 200, "sight": 64,
                  "team": [ { "species": "boeli", "level": 6 } ], "dialog": { "before": ["…"], "after": ["…"] }, "reward": 120 } ],
  "encounters": [ { "id": "wiese_n", "rect": [10, 4, 12, 6], "tiles": ["grass_tall"], "density": 3,
                    "table": [ { "species": "zappi", "levels": [3, 6], "weight": 40, "time": "day" },
                               { "species": "pilzling", "levels": [4, 7], "weight": 20, "time": "night" } ] } ],
  "items": [ { "type": "chest", "x": 300, "y": 120, "contents": { "item": "orb", "count": 3 }, "flag": "chest_1" } ],
  "warps": [ { "rect": [5, 8.4, 1, 0.6], "to": { "map": "house_bodo", "spawn": "door" }, "dirReq": "up" } ],
  "spawns": { "start": { "x": 88, "y": 120, "dir": "down" } },
  "events": [ { "id": "intro", "trigger": { "type": "enter", "rect": [4, 4, 3, 2] }, "if": { "flag": "!intro_done" },
                "do": [ { "dialog": "intro" }, { "setFlag": "intro_done" } ] } ],
  "farm": { "rect": [30, 18, 10, 8] }
}
```
Koordinaten: `x/y` in Welt-Pixeln (16 pro Tile, Fußpunkt), `rect` in Tiles `[x, y, w, h]`.

## Dialoge
```json
{ "id": "elder_intro", "speaker": "Ältester", "lines": ["Willkommen in Driftwald!", "Wähle dein erstes Monster."],
  "choices": [ { "label": "Ja", "goto": "elder_yes" }, { "label": "Nein", "goto": "elder_no" } ],
  "do": [ { "giveStarter": true } ] }
```
Aktionen (`do`): `dialog`, `setFlag`, `clearFlag`, `give {item,count}`, `take`, `money`, `heal`, `battle {trainer}`,
`giveMonster {species, level}`, `warp {map, spawn}`, `giveStarter`, `shop {stock}`, `music`, `wait`. Bedingungen (`if`):
`flag`, `!flag`, `hasItem`, `hasMonster`, `time` (day/night), `money>=`.

## characters/<id>.json (Figuren-Baukasten)
```json
{ "id": "baeckerin", "base": "human", "body": "slim", "skin": "#e8b896", "hair": { "style": "bun", "color": "#6a3a20" },
  "top": { "style": "apron_dress", "color": "#c86050" }, "bottom": { "style": "skirt", "color": "#5a4038" },
  "accessories": ["scarf"], "eyes": "#3a2a20" }
```
Wird von `src/art/chars/` (Rig) zu Sprites `npc_<id>_idle/walk_<dir>` gebaut.

## Versionierung
`format` muss `drift-content@1` sein; der Loader migriert ältere Versionen. Unbekannte Felder werden ignoriert, aber erhalten.
