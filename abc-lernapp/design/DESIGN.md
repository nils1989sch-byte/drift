# ABC mit Bruno – Design System

**Direction: "Soft clay in a lavender sky".** Every object looks like soft, glossy clay: lit warmly from the upper left, with shading that turns **purple** instead of grey. That single trick keeps 26 differently coloured illustrations, Bruno and the UI in one world. Around them: a lavender gradient sky with halftone dots, fluffy clouds, a warm peach glow at the bottom right, and glassy white cards. The content the child taps (letters, balloons, Bruno) is always the most colourful and the most three-dimensional thing on screen. The chrome stays quiet.

Open `preview.html` to see every asset and seven screen mocks. The PNGs are in `screens/`.

---

## 1. Files

| Path | Content |
|---|---|
| `bruno.svg`, `bruno-<mood>.svg`, `bruno-parts.md` | Mascot. Moods switch through `data-mood`. Part names are in `bruno-parts.md`. |
| `illustrations/a.svg … z.svg` | 26 word pictures, viewBox `0 0 200 200`, 1.5–4.6 KB each |
| `words.json` | `[{letter, word, file}]`: the final word list |
| `scenery/cloud.svg`, `cloud-small.svg` | Fluffy 3D clouds |
| `scenery/hills.svg` | Two-layer hills (lavender + peach). `preserveAspectRatio="none"`, so they stretch to any width. |
| `scenery/star.svg`, `star-empty.svg`, `sparkle.svg`, `heart.svg`, `paw.svg` | Rewards and decoration |
| `scenery/balloon.svg` | Answer balloon. Recolour with `--balloon`. |
| `scenery/crayon.svg` | Crayon. Recolour with `--crayon`. |
| `scenery/tab-start|abc|finden|malen|eltern.svg` | Clay tab-bar icons (64×64) that replace the emoji |
| `scenery/ui-*.svg` | Line glyphs in `currentColor` (32×32): speaker, arrows, close, eraser, replay, home |
| `scenery/dots.svg` | Halftone tile (14×14). The mocks use the pure-CSS version below instead. |

### Rules for inlining (important)
- The app is one HTML file, so **paste the SVG markup inline** (or keep it in JS strings, as the prototype does for Bruno). Do not use `<img>`: the recolour variables and Bruno's moods only work inline.
- **Gradient ids are pre-namespaced per file**: `ia-*` … `iz-*` for illustrations, `br-*` for Bruno, `sc-<name>-*` for scenery. This lets all assets live in one document without colliding. Repeated copies of the same asset have identical defs, which is harmless.
- **Recolouring:** `<div style="--balloon:#4fb3f6">…balloon.svg…</div>`. The same works with `--crayon`. The fallbacks are coral (balloon) and lavender (crayon).
- Every SVG has `width:100%;height:100%` behaviour when you set `svg{display:block;width:100%;height:100%}`. Size the wrapper, not the svg.
- Illustrations have `role="img" aria-label="<Wort>"`. Decoration has `aria-hidden="true"`.

---

## 2. Words (`words.json`)

| | Word | | Word | | Word |
|---|---|---|---|---|---|
| A | Affe | J | Jacke | S | Sonne |
| B | **Banane** (was Bär) | K | Katze | T | Tiger |
| C | **Clown** (was Cowboy) | L | Löwe | U | Ufo |
| D | Dino | M | Maus | V | Vogel |
| E | Elefant | N | **Nashorn** (was Nase) | W | Wal |
| F | Fisch | O | **Oktopus** (was Oma) | X | **Xylofon** (was Taxi) |
| G | Giraffe | P | Pinguin | Y | **Yak** (was Yoga) |
| H | Hund | Q | Qualle | Z | Zebra |
| I | Igel | R | Rakete | | |

Why these changes:
- **Banane, not Bär.** A second bear would compete with Bruno ("Is that Bruno?"). A banana is instantly recognisable, a word every 3-year-old already knows, and gives the set a fruit.
- **Clown, not Cowboy.** A child knows a clown from the circus and from picture books. "Cowboy" is an English loan word, and a hat on its own is ambiguous. The clown is drawn as friendly (soft face, no scary make-up).
- **Nashorn, not Nase.** A nose on its own is a creepy body-part picture. A rhino is an animal and fits the set.
- **Oktopus, not Oma.** Drawing a generic grandmother misses the point (the concept already plans "Oma" as a *real photo* later). An octopus gives a clear initial "O" and is fun to animate.
- **Xylofon, not Taxi.** Taxi teaches X with a word that does not *start* with X, which is confusing. The Xylofon spelling is the current Duden spelling, and kids have one in the playroom.
- **Yak, not Yoga.** Yoga is an activity and hard to draw. A yak is an animal that starts with Y. Weak spot: few toddlers know the word, but there is no better German Y-initial word (Jo-Jo is now spelled with J).

---

## 3. Colour tokens

```css
:root{
  /* ink & neutrals */
  --ink:#2b2158;      /* text, eyes, mouths – purple-black, never #000 */
  --ink-2:#5a5287;    /* secondary text */
  --muted:#8d86b3;    /* labels, inactive tabs */
  /* lavender ramp */
  --lav-700:#5b4bc4; --lav-600:#7b6fe0 /* primary */; --lav-500:#9d8ff5;
  --lav-400:#b9adfc; --lav-300:#d2caff; --lav-200:#e4dfff; --lav-100:#efecff; --lav-50:#f7f5ff;
  --bruno:#a596f6;    /* Bruno's fur */
  /* warm atmosphere */
  --peach:#ffc9b3; --peach-50:#fff3ee;
  /* playful accents (balloons, crayons, confetti) */
  --coral:#ff6f91; --tangerine:#ff9a3c; --sun:#ffc928; --mint:#3ccf8e; --sky:#4fb3f6; --grape:#9b7cf7;
  /* surfaces */
  --glass:rgba(255,255,255,.72); --glass-line:rgba(255,255,255,.85);
}
```

**Balloon colours:** coral, tangerine, mint, sky and grape. **Never sun (yellow)**: white letters on yellow fail contrast. Pick the 3 answer colours randomly without repeats.
**Level colours (ABC dot and parent chips):** new `--lav-200`, seen `#ffd66b`, practised `#ffa86b`, sure `--mint`.

### Gradients
| Name | Value | Use |
|---|---|---|
| Sky (screen background) | `radial-gradient(55% 45% at 92% 104%, rgba(255,196,170,.95), transparent 70%), radial-gradient(45% 35% at -5% 100%, rgba(255,206,226,.7), transparent 70%), radial-gradient(70% 55% at 18% -8%, #9a8af6, transparent 70%), linear-gradient(180deg,#8a7af0 0%,#ab9ffa 22%,#d9d2ff 46%,#f3f0ff 66%,#fbf6f6 100%)` | every screen |
| Halftone dots | `radial-gradient(circle, rgba(255,255,255,.55) 1.3px, transparent 1.8px) 0 0/16px 16px`, masked with `radial-gradient(40% 45% at 88% 6%, #000, transparent 75%)` | top right (white dots) and bottom right (`rgba(123,111,224,.22)` dots) |
| Hero card | `radial-gradient(90% 120% at 100% 0%, #a99cff, transparent 60%), linear-gradient(135deg,#6f5fe6,#8b7cf6 55%,#a497fb)` | Buchstabe des Tages |
| Primary button | `linear-gradient(180deg,#9b8cff,#6f5fe6)` | speaker, "Nochmal" |
| Letter glyph | `linear-gradient(180deg,#9585fb,#5b4bc4)` with `background-clip:text` | big letters |
| Lowercase glyph | `linear-gradient(180deg,#ffa0b8,#ff6f91)` | the "m" next to "M" |
| Meter / bars | `linear-gradient(90deg,#ffd76b,#ff9a3c)` | progress |

### Illustration recipe (for new art)
Each shape is filled with a radial gradient: `cx .36, cy .28, r .85`, with stops `base + 45 % white` → `base` at .55 → `base + 30 % #3b2a8c` at 1. There are **no outlines**. Add one soft white highlight ellipse (radial white .95 → 0) on the top-left of the biggest form. Eyes: `--ink` ellipse 7×8.6 with a gradient down to `#5b49a8`, a big sparkle at the top right and a small one at the bottom left. Cheeks: a radial `#ff6f9c` .6 → 0 blush. Ground shadow: a radial `#3b2a8c` .32 → 0 ellipse at y≈184. The helper code that generated the set applies exactly these rules.

---

## 4. Elevation, radii, spacing

```css
--e1: 0 1px 0 rgba(255,255,255,.9) inset, 0 4px 14px -6px rgba(59,42,140,.22);              /* chips, small cells */
--e2: 0 1px 0 #fff inset, 0 18px 40px -18px rgba(59,42,140,.38), 0 3px 8px -2px rgba(59,42,140,.08); /* cards, tab bar */
--e3: 0 40px 80px -24px rgba(59,42,140,.5), 0 8px 20px -8px rgba(59,42,140,.18);             /* sheets/overlays */
```
- **Shadows are always purple-tinted** (`59,42,140`), never black.
- **Glass surface:** `background:var(--glass); backdrop-filter:blur(20px) saturate(1.5); border:1.5px solid var(--glass-line); box-shadow:var(--e2)`.
- **Clay lip on pressable things:** `box-shadow: 0 -5px 0 rgba(91,75,196,.12) inset` gives a bottom lip, so buttons feel thick and squishy.

Radii: `--r-s 16` · `--r-m 24` · `--r-l 32` · `--r-xl 44` (big cards) · `52` (sheets) · `999` (pills, buttons).
Spacing: an 8-pt grid. Screen gutter is **40px** in landscape and portrait (**24px** below 700px width). Card gap 24, tile gap 14.

---

## 5. Typography

**Display/letters: Fredoka 600** (500/700 available). **UI/parents: Nunito 700/800.**
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@600;700;800&display=swap">
```
Why Fredoka (I rendered all the candidates side by side):
- **Single-story `a` and `g`** (what children see in German Grundschule print and in picture books). Nunito has a double-story `a`, so it is out for letters.
- Its **capital `I` is a plain stroke**, like German Druckschrift and Grundschrift. Andika's serifed I is "correct" for disambiguation but not what Kita and school teach.
- Round terminals, generous counters and heavy weight make it read as friendly and premium, and it matches the clay art. Andika (best literacy design) looked thin and "office-like" next to the illustrations. Baloo 2 is cramped and has very tall line metrics. Sniglet is too blobby: the letter shapes lose detail at tracing size.
- One caveat: lowercase `l` and capital `I` are both plain strokes. This doesn't matter, because they are never shown side by side as answer choices (avoid `I`+`l` in the same Finden round when the setting is "Aa Bb").

| Role | Spec |
|---|---|
| Letter in detail sheet | Fredoka 600, 280px uppercase / 190px lowercase, gradient text |
| Tracing guide | Fredoka 600, ~85 % of board height |
| Letter on balloon | Fredoka 600, 132px, white, `text-shadow:0 3px 0 rgba(0,0,0,.08),0 10px 24px rgba(43,33,88,.18)` |
| Letter tile (ABC) | Fredoka 600, 52px, `--lav-600` |
| Screen greeting | Fredoka 600, 46px/1.05, white, `text-shadow:0 2px 0 rgba(91,75,196,.25),0 10px 30px rgba(59,42,140,.25)` |
| Bruno bubble | Fredoka 600, 24px (Start) / 44px (Finden question) |
| Card title | Fredoka 600, 30px; caption Nunito 700, 15px `--muted` |
| Parents | Nunito 800, 34px heading; 16px uppercase card labels (+.06em); 16px body |

The child can't read: text is only for the parent. Every child-facing action must work from **picture + voice** alone.

---

## 6. Components

**Letter tile (ABC grid)**: 9 columns in landscape (≈114×150) and 5 columns in portrait. White→`#faf8ff` gradient, radius 30, clay lip + `0 14px 26px -16px rgba(59,42,140,.5)`. Glyph 52px on top, 78px illustration below. Level dot 14px at the top right. The letter of the day gets a 4px white outline + an 8px `rgba(255,201,40,.55)` halo. Pressed: squish (see motion).

**Big letter card (detail sheet)**: 900×650 sheet, radius 52, `--e3`, over a scrim `rgba(43,33,88,.38)` + `blur(8px)`. Left: "M" + "m" (lowercase in coral, shown only if the setting allows). Right: a 360px illustration on a soft peach→lavender radial glow. Centre: the word, with its first letter in `--coral`. Bottom row: ‹ prev (80px round) · **🔊 Nochmal** (primary) · Malen (crayon icon) · next › (80px round). Close is a 72px round button at the top right. Tapping the scrim also closes.

**Balloon choice**: 220×330 (`scenery/balloon.svg`) + a Fredoka letter centred in the upper 60 %. Three per round, 70px gap, with the middle one 34px higher (an organic arrangement). Drop shadow `0 22px 22px rgba(59,42,140,.25)`. The **hit target is the whole balloon box** (≥ 200px).

**Tab bar**: a floating glass pill, centred, 22px from the bottom (plus `env(safe-area-inset-bottom)`). Each tab is 118×88 with a 44px clay icon and a Nunito 800 15px label. Inactive: `filter:saturate(.55) opacity(.8)`, colour `--muted`. Active: white bubble, `inset 0 0 0 2px var(--lav-200)` ring, icon lifted 2px and scaled 1.06, label `--lav-600`. **Eltern is not a tab**: it is the lock in the top right (see the parent gate).

**Buttons**: height 80 (minimum 72), pill. Default: `--lav-100` background, `--lav-600` text, clay lip. Primary: the gradient above, white text, `0 -6px 0 rgba(43,33,88,.2) inset, 0 14px 24px -10px rgba(91,75,196,.7)`. Icon-only round buttons are 72–80px. The speaker button is always the primary gradient circle (it is the most important control for a child who can't read).

**Star counter**: a 72px-high glass pill with a 48px `star.svg` (drop shadow `rgba(224,122,0,.35)`) and a Fredoka 34px tabular number. Finden progress: a glass pill with five 50px slots, `star-empty` → `star` as answers are found.

**Speech bubble**: white, radius 28–40, `--e2`. The tail is a 22px rotated square with `border-radius:4px 0 18px 0`, pointing at Bruno's mouth. The **whole bubble is tappable** and repeats the audio.

**Parent gate**: a 72px glass circle with `tab-eltern.svg` (a golden padlock), in the top right of Start only. **Hold for 2 s.** While holding, an SVG ring (4px, white, `stroke-dashoffset` animated linearly over 2 s) draws around the circle. Releasing early rewinds the ring in 250ms ease-out. There is no visible text for the child. Use `aria-label="Elternbereich – 2 Sekunden gedrückt halten"`.

**Activity cards (Start)**: three glass cards (≈357×196, radius 44). Each has a coloured radial halo in the top-right corner, an art cluster (letter blocks / two balloons / outlined letter + crayons), a 52px coloured "go" circle at the top left, and the title + caption at the bottom left. The **whole card** is the target.

---

## 7. Screen layouts (landscape 1180×820 · portrait 820×1180)

See the PNGs in `screens/`.

- **Start**: greeting at the top left; stars + lock at the top right. Row 1: the "Buchstabe des Tages" hero card (640×300: 200×228 white letter tile, eyebrow pill, "M wie Maus", an "Anhören" pill button, the illustration peeking in at the bottom right). Next to it, Bruno (300px, happy, waving) sits on a cloud with a speech bubble. Row 2: three activity cards. Then the tab bar. *Portrait:* Bruno + bubble on top (330px), the hero card at full width, the three cards in a row (236px tall), then the tabs.
- **ABC**: the title "Das ABC" in white at the top left, the star pill at the top right, and a 9×3 tile grid (portrait: 5 columns, scrolls). The tab bar floats over the hills.
- **Letter detail**: the sheet described above, over the blurred grid.
- **Finden**: Bruno (190px) at the top left with a speech bubble "Wo ist das **M**?" (the letter in `--lav-600` at 64px, plus a 72px speaker button inside the bubble). Three balloons centred at y≈250–580. The 5-star progress pill above the tab bar. Stars at the top right. *Portrait:* the balloons stack in a 2+1 triangle, centred vertically.
- **Nachmalen**: Bruno (encourage) + "Mal das M!" at the top. A board card (860×560, dotted paper texture). The guide letter is filled `#f1eeff` with a dotted `#c4baff` outline (dash `1 18`, 7px, round caps). The child's stroke is drawn in the crayon colour, 42px wide, with a 25 % white highlight offset (-6,-6) for a waxy look. A white "pen tip" dot shows the current position, and a dotted arrow shows the next direction. The meter is inside the board at the bottom: a 26px pill with a gradient fill, ending in a star that becomes saturated at 100 %. Right rail (216px glass): speaker, a 2×2 grid of crayons (the selected one lifted 14px), eraser, ‹ ›. *Portrait:* the rail becomes a horizontal row under the board.
- **Celebration (Feier)**: full screen, no sheet. Slowly rotating conic rays behind Bruno (cheer, 360px). "Super gemacht, Mia!" (Fredoka 76, ink, white glow). Five big stars, alternately tilted. Buttons: **Nochmal** (primary, replay icon) and **Start** (home icon). Confetti.
- **Elternbereich**: a 1000×724 sheet in Nunito over a dim scrim: a week of check marks (coral gradient circles), stars per day (bar chart), letter-status chips, and settings (name input, Schreibweise segmented control, Ton An/Aus). Adult density is OK here, but touch targets stay ≥ 44px.

Touch targets: everything a child taps is **≥ 72px** (balloons ≥ 200, tiles ≥ 114×150, cards ≥ 196). Keep ≥ 16px between targets.

---

## 8. Motion spec

Tokens:
```css
--spring:     cubic-bezier(.34,1.56,.64,1);   /* playful overshoot (~10 %) */
--spring-soft:cubic-bezier(.5,1.35,.6,1);     /* gentle overshoot (~4 %) */
--ease-out:   cubic-bezier(.22,1,.36,1);      /* arrivals */
--ease-in-out:cubic-bezier(.45,0,.55,1);      /* loops, breathing */
```
If you use JS springs (e.g. the Web Animations API with precomputed keyframes): **playful = stiffness 260, damping 14, mass 1**; **soft = 180 / 20 / 1**.

| Element | Spec |
|---|---|
| **Bruno idle: breathing** | `.b-body` `scale(1,1) → (1.025,.985)`, 3.2s, ease-in-out, infinite. `.b-head` `translateY(0 → 2.5px)` in sync (built into `bruno.svg` with class `alive`). |
| **Bruno idle: blink** | `.b-eyelid-*` `scaleY(0 → 1 → 0)`, origin top. Built in: a 4.6s cycle with the lid closed from 92–100 % (~140ms). In the app, randomise the interval to 2.5–6s via JS, and make 1 in 5 blinks a double blink (2× 120ms, 90ms apart). |
| **Bruno: happy** (tap, or a correct answer during a round) | Set `data-mood=happy` (arm springs up in 500ms `--spring`). Then wave `.b-arm-r` between `-110deg` and `-140deg`, 3 cycles × 360ms ease-in-out. Body hop: `translateY(0 → -14px → 0)` 420ms with a squash `scale(1.06,.94)` on landing (120ms). Return to neutral after 1.8s. |
| **Bruno: cheer** (round complete) | Anticipation: squash `scale(1.08,.92)` 120ms ease-in. Then jump `translateY(-36px)` 280ms ease-out, with `data-mood=cheer` set at take-off, and fall 260ms ease-in with a landing squash `(1.1,.9)` that springs back in 300ms `--spring`. Repeat the jump twice. `.b-sparkles` twinkle (`scale .6→1.2→1`, `rotate 0→45deg`, staggered 80ms). |
| **Bruno: thinking** (while the question is spoken / idle > 8s) | `data-mood=thinking`. The head tilt and paw-to-chin spring in 500ms. The eyes glance up-right and stay there. A slow head sway of ±2° every 2.4s. |
| **Bruno: encourage** (wrong answer) | `data-mood=encourage`. A gentle nod: `.b-head rotate(6deg → 2deg → 6deg)` 2× 300ms. `.b-heart` floats `translateY(0 → -24px)` and `opacity 1 → 0` over 1.2s ease-out. **No shake, no red, no negative sound.** |
| **Ear wiggle** (tap on Bruno) | `.b-ear-l/r` `rotate(0 → -12deg → 8deg → 0)`, 450ms, staggered 60ms. |
| **Button / tile / card press** | Press-down: `scale(.94)` (cards `.97`) plus the clay lip shrinking (`inset 0 -2px`), 90ms ease-out. Release: back to `scale(1)` in 380ms `--spring`. Trigger on `pointerdown`, not on click. |
| **Balloon float** | `translateY(0 → -12px) rotate(0 → 1.5deg)`, 3.6s ease-in-out, infinite alternate. Each balloon has a phase offset of -1.2s. The string sways ±3° (2.8s). |
| **Balloon appear** (new question) | From `translateY(140px) scale(.7) opacity 0` to rest, 600ms `--spring-soft`, staggered 90ms. |
| **Balloon pop (correct)** | 1) Inflate to `scale(1.12)` over 120ms ease-out. 2) Pop: the balloon goes to `scale(1.35)` and `opacity 0` over 140ms ease-in, while 10 shards (balloon-coloured rounded rects) burst radially 60–140px with rotation over 500ms ease-out. 3) The letter stays, scales 1.2 → 1 in 400ms `--spring`, then flies to the star counter (below). The other balloons drift up and off (`translateY(-900px)`, 900ms ease-in, 80ms stagger). |
| **Balloon "not this one" (wrong)** | A soft wobble, not a shake: `rotate(0 → -6 → 5 → -3 → 0deg)` over 500ms ease-in-out, plus `scale(.96)` at the start. The balloon stays tappable. |
| **Star fly-to-counter** | Spawn `star.svg` at 80px on the popped balloon. It follows a curved path (two-segment keyframes: the control point is 120px above the midpoint) to the counter icon, 700ms `cubic-bezier(.5,0,.75,0)` for x and ease-out for y, scaling 1 → .55 and rotating 0 → 360deg. On arrival the counter pops `scale(1 → 1.25 → 1)` in 400ms `--spring`, the number ticks up, and a 6-sparkle burst plays. The empty slot in the progress pill fills with `scale(0 → 1.2 → 1)`, 450ms `--spring`. |
| **Confetti** | 40 pieces (rounded rects 16×24 and dots 16, in the accent palette). Launched from the screen centre (or the popped balloon) at angles −160° to −20°, with velocity 500–900px/s and gravity 1400px/s². Each piece also does a 3D flip (`rotateX` 0 → 720deg) and fades out over the last 300ms. Lifetime 1.6–2.2s. Max 60 pieces on screen. |
| **Celebration rays** | `rotate(0 → 360deg)` over 40s, linear, infinite. The stars drop in one by one: `translateY(-60px) scale(0)` → rest, 500ms `--spring`, 120ms stagger. |
| **Screen transitions (tabs)** | Cross-fade + depth. The outgoing screen goes to `opacity 0` and `scale(.98)` over 180ms ease-in. The incoming one starts at `opacity 0`, `translateY(16px)`, `scale(1.02)` and settles over 380ms `--ease-out`, 60ms after the outgoing one starts. The background (sky, clouds, hills) **never** transitions: it is shared and persistent. The active tab bubble slides between tabs (FLIP, 420ms `--spring-soft`). |
| **Sheet open / close** | Scrim `opacity 0 → 1`, 240ms. Sheet `translateY(40px) scale(.92)` → rest, 520ms `--spring-soft`. Close: `scale(.96)` + `opacity 0`, 200ms ease-in. |
| **Letter reveal (detail / letter of the day)** | The glyph enters with `scale(.4) rotate(-8deg)` → `scale(1.08) rotate(2deg)` → rest, 650ms `--spring`. The illustration follows after a 150ms delay: `translateY(30px) scale(.8)` → rest, 550ms `--spring-soft`. The word's coloured first letter does a little bounce (`translateY(-8px)`, 300ms) exactly when the voice says it ("**M** wie Maus"). |
| **Tracing feedback** | The stroke appears in real time. On reaching 100 %, the board glows (`box-shadow: 0 0 0 0 → 0 0 0 16px rgba(60,207,142,.0→.35→0)`, 700ms), the meter star saturates and pops (400ms `--spring`), and Bruno cheers. |
| **Clouds / sparkles** | Clouds `translateX(0 → 18px)` over 14s, alternate, ease-in-out, each with a different delay. Sparkles twinkle `scale(1 → .6) rotate(45deg) opacity(1 → .5)` over 2.8s. |

**`prefers-reduced-motion: reduce`**: keep only opacity fades (≤ 200ms). Bruno keeps blinking (it is tiny and humanising) but stops breathing and hopping. Mood changes still swap mouths and arms, but with `transition:none`. Balloons don't float. Pops become a 150ms fade. Stars appear in the counter without flying. No confetti or rays; the celebration shows static stars. Screen transitions become a 150ms cross-fade. `bruno.svg` already disables its own animations under this query.

**Performance:** animate only `transform` and `opacity`. Bruno's parts are CSS-transformed SVG groups, which is fine on iPad Safari. Don't animate `filter` or `backdrop-filter`. Keep at most one `backdrop-filter` layer moving at a time.

---

## 9. Sound/voice pairing (for motion timing)
Fire the Bruno reaction **with** the voice line: the mouth swap at speech start, back to neutral at `utterance.onend`. A simple talking loop works well: alternate `mouth-happy` and `mouth-neutral` every 140ms while speaking.
