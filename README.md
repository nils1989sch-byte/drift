DRIFT Updates

## Möbel-Chaos 🛋️📦🚚

Koop-Top-Down-Spiel für zwei Spieler an einer Tastatur (Three.js, ohne Build-Step).
Zwei Aufzieh-Figuren mit Röhrenfernseher-Kopf räumen ein Haus aus und tragen die Möbel
heil in den Umzugswagen – schwere Möbel nur zu zweit.

**Starten** (ES-Module brauchen einen lokalen Server):

```bash
cd game && python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

| | Laufen | Greifen / Abstellen |
|---|---|---|
| Spieler 1 (Grüni) | `W A S D` | `Leertaste` |
| Spieler 2 (Orangi) | Pfeiltasten | `Enter` |

`P` Pause · `M` Ton · Gamepads werden unterstützt · `?q=low` erzwingt niedrige Auflösung.

**Technik:** eigener Post-Processing-Pass (Tilt-Shift, chromatische Aberration und Linsenverzerrung
abhängig vom Screen-Shake-Trauma, Vignette, Schadens-Puls), Shader-Gesichter auf den Fernsehköpfen,
Riss-/Treffer-Shader auf Möbeln, wandernde Wolkenschatten, animierte Ladezone, Partikel und
trauma-basierter Screen-Shake.

**Test:** `node tools/smoke-test.mjs` (Playwright, headless) – spielt Tragen, Koop, Schaden und
Ergebnis durch und legt Screenshots in `tools/out/` ab.

**Agenten** für die Weiterentwicklung liegen in `.claude/agents/`: `game-designer`,
`threejs-graphics`, `gameplay-physics`, `playtester`.
