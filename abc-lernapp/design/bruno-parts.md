# Bruno – parts & moods

`bruno.svg` is the master file (viewBox `0 0 240 240`, ~12 KB). It holds **every** mood as swappable groups plus its own `<style>`, so moods switch with **one attribute** on the root `<svg>`:

```html
<svg class="bruno alive" data-mood="happy" …>   <!-- neutral | happy | cheer | thinking | encourage -->
```

`bruno-neutral.svg`, `bruno-happy.svg`, `bruno-cheer.svg`, `bruno-thinking.svg`, `bruno-encourage.svg` are the same file with `data-mood` preset and no idle animation (`alive` removed), for `<img>` or static use. Inline the master in the app; don't use the pose files there.

- `class="alive"` turns on idle breathing, head bob and blinking (built in, disabled under `prefers-reduced-motion`).
- Changing `data-mood` animates the arms and head with the built-in spring transition (`.5s cubic-bezier(.34,1.56,.64,1)`).

## Group names

Each group has an `id` (as specified) **and** a matching class `b-<id>`. **When Bruno is inlined more than once on the page (Start, Finden, Feier), target the classes, not the ids.** Duplicate ids are tolerated by browsers, and the gradient ids (`br-*`) are identical in every copy, so they resolve correctly.

| Group (id / class) | What it is | Transform origin (set in CSS) | Used for |
|---|---|---|---|
| `aura` / `.b-aura` | soft white-lavender glow behind Bruno | – | hide with `display:none` on busy backgrounds |
| `shadow` | ground contact shadow | – | scale it down when Bruno jumps |
| `body` | torso + pink belly | `120px 232px` (feet) | breathing (`scale(1.025,.985)`) and squash/stretch |
| `foot-l`, `foot-r` | feet with pink toe beans | – | – |
| `head` | everything above the shoulders (ears, face) | `120px 150px` (neck) | bob, tilt (thinking −5°, encourage +6°) |
| `ear-l`, `ear-r` | ears | add your own at ear base: `52px 70px` / `188px 70px` | ear wiggle when tapped |
| `eye-l`, `eye-r` | pupils + sparkles | `transform-box:fill-box; center` | look direction (`translate(4px,-4px)` = look up and right) |
| `eyelid-l`, `eyelid-r` | lid + lash line, **default `scaleY(0)`**, origin top | `fill-box`, `50% 0` | blink: `scaleY(0) → 1 → 0` |
| `eyes-happy` | closed "^ ^" eyes | – | cheer (replaces the eyes) |
| `brows` → `brow-l`, `brow-r` | eyebrows | – | thinking (right brow raised) and encourage |
| `blush` | cheek glow | – | can pulse its opacity when happy |
| `mouth-neutral` | the classic bear "w" smile | – | default |
| `mouth-happy` | open smile with tongue | – | happy |
| `mouth-cheer` | big open "Yay" mouth | – | cheer |
| `mouth-thinking` | small wavy "hmm" | – | thinking |
| `mouth-encourage` | soft open smile | – | encourage |
| `arm-l`, `arm-r` | arms (with drop shadow) | `62px 150px` / `178px 150px` (shoulders) | wave, cheer, think |
| `sparkles` | 5 sparkles around the head | – | cheer (animate twinkle) |
| `heart` | small heart top right | – | encourage (float up) |

## What each mood sets (all in the embedded CSS)

| Mood | Mouth | Eyes | Arms | Extras |
|---|---|---|---|---|
| neutral | `mouth-neutral` | open | down | – |
| happy | `mouth-happy` | open | right arm waving: `arm-r rotate(-125deg)` | – |
| cheer | `mouth-cheer` | `eyes-happy` | both arms up: `±125deg`, head −3px | `sparkles` |
| thinking | `mouth-thinking` | look up and right | paw at chin: `arm-r rotate(104deg)`, head −5° | `brows`, right brow raised |
| encourage | `mouth-encourage` | open | left arm raised: `arm-l rotate(128deg)`, head +6° | `brows`, `heart` |

Wave = keep `data-mood="happy"` and add a keyframe that oscillates `.b-arm-r` between `rotate(-110deg)` and `rotate(-140deg)` (see the motion spec in DESIGN.md).
