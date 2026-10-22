# data-testid contract – ABC mit Bruno

The automated tests (`tests/run.sh`) find everything in the app **only** through the `data-testid`
attributes listed here. The redesigned app must ship all of them. Styling, structure, class names and
ids are free to change; these attributes (and the few `data-*` state attributes below) are not.

How the switch works: `tests/support/selectors.js` holds one map. If the page contains **any**
`[data-testid]`, the suite uses the contract only; otherwise it falls back to the old prototype
selectors. Verify the redesign strictly with:

```sh
SELECTOR_MODE=testid ./tests/run.sh
```

## Rules

1. One testid per element; put it on the element the child actually taps (the `<button>`), not a wrapper.
2. "Visible" means visible: hidden screens/overlays must be `display:none` / `hidden` (not just
   `opacity:0` or off-screen), so `toBeHidden()` works.
3. Letters are always reported **uppercase A–Z** in `data-letter`, independent of the case setting.
4. Speech goes through `window.speechSynthesis.speak()` with `lang` starting with `de` (the tests stub it).
   If recorded audio files are added later, play them through `HTMLMediaElement.play()` (also recorded).
5. Every child-facing tap target must be at least **64 × 64 CSS px** (tested). Parent-only controls may
   be smaller but are reported.
6. Nothing may be spoken before the first touch; no `console.error`, no uncaught exceptions.
7. Keep localStorage key `abc-bruno-v1` (or change `STORAGE_KEY` in `support/fixtures.js`) and keep
   old saved data readable.

## Screens & navigation

| testid | element | notes |
|---|---|---|
| `screen-home` / `screen-abc` / `screen-find` / `screen-trace` | screen container | exactly one visible at a time |
| `tab-home` / `tab-abc` / `tab-find` / `tab-trace` | tab bar buttons | always fully inside the viewport |
| `star-count` | element whose text is today's star number | may exist on several screens; the **visible** one is read |

## Start

| testid | element | notes |
|---|---|---|
| `home-greeting` | greeting heading | contains the child's name |
| `home-today` | "letter of the day" card (button) | `data-letter="M"`; tap opens the detail for that letter |
| `home-bruno` | mascot button | tap → Bruno speaks |
| `home-bubble` | speech bubble text | optional |
| `home-go-abc` / `home-go-find` / `home-go-trace` | big activity cards | open the screens |

## ABC + letter detail

| testid | element | notes |
|---|---|---|
| `abc-grid` | grid container | |
| `letter-tile-A` … `letter-tile-Z` | 26 tile buttons | also `data-letter`; text shows the letter in the current case mode |
| `detail-overlay` | detail overlay root | `data-letter="A"` of the shown letter |
| `detail-letter` | big letter | fallback if `data-letter` is missing |
| `detail-word` | word ("Affe") | |
| `detail-close` | close button | ≥ 64 px |
| `detail-prev` / `detail-next` | previous / next letter | wraps Z→A and A→Z |
| `detail-say` | "listen again" | speaks "A … A wie Affe" |
| `detail-trace` | "draw this letter" | closes overlay, opens tracing |

## Finden

| testid | element | notes |
|---|---|---|
| `find-prompt` | question bubble (button) | **`data-letter` = target letter**; tap repeats the question |
| `find-choice` | each balloon button (3) | **`data-letter`** on each; exactly one matches the prompt |
| `round-star` | each of the 5 round stars | **`data-filled="true"`** when earned |
| `celebration` | celebration overlay after 5 stars | must only appear while the Finden screen is active |
| `celebration-again` | "play again" | resets round to 0 filled stars |
| `celebration-home` | "back to start" | |

## Nachmalen

| testid | element | notes |
|---|---|---|
| `trace-board` | drawing surface | ≥ 300 × 300 px, `touch-action:none` |
| `trace-guide` | `<canvas>` with the guide letter | the test samples its painted pixels to trace the letter; letter pixels must be non-transparent, the rest transparent |
| `trace-ink` | `<canvas>` with the child's strokes | must be fully transparent after `trace-clear` |
| `trace-clear` / `trace-prev` / `trace-next` / `trace-say` | tool buttons | prev/next change the guide letter |
| `trace-crayon` | colour buttons | ≥ 64 px |
| `trace-progress` | progress meter | optional |

Success = tracing over the letter raises `star-count` by exactly 1 (and only once per letter).

## Parents

| testid | element | notes |
|---|---|---|
| `parent-gate` | lock button | opens `parents-panel` only after a **≥ 2 s continuous** press; short tap, 1 s hold or sliding off do nothing |
| `parents-panel` | parents overlay root | |
| `parents-close` | close button | |
| `setting-name` | text `<input>` | change → greeting updates immediately, persists after reload |
| `setting-case-upper` / `setting-case-both` / `setting-case-lower` | case mode options | selected one has `aria-pressed="true"` (or `aria-checked`/`aria-selected`) |
| `setting-sound-on` / `setting-sound-off` | sound toggle options | same selection rule; off → nothing is spoken |
| `setting-reset` | reset progress | first tap only arms it, second tap resets stars (name/settings kept) |
