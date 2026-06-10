# Handoff: Shot-Entry Flow (optimized)

## Overview
This is the in-round **shot-entry flow** for Advanced Club Stats — the screen a golfer uses
after every shot to log it. It is a one-decision-per-screen tap-through wizard:

> **Club → Yards → Strike → Result** (→ miss direction / putt sub-flow as needed)

This handoff covers an **optimization + re-skin** of the existing production flow
(`app/rounds/[id]/log/ShotEntryFlow.tsx`). The flow logic, step order, labels, and the
smart-skip / penalty / lie-carry rules are **unchanged from production** — they are recreated
faithfully here. What changed is (a) the visual system (now the **Modern Clubhouse** design
language, matching the re-skinned Dashboard) and (b) **five specific UX optimizations** listed
under "What's new vs. production" below.

## About the Design Files
The files in `design-reference/` are **design references built in HTML/React-via-Babel** — a
running prototype showing the intended look and behavior. They are **not** production code to copy
directly. The task is to **port these changes into the existing Next.js/React codebase**
(`golf-tracker`), modifying the real `ShotEntryFlow.tsx` and its styles using the app's established
patterns (its component structure, state, API calls, and styling approach). Treat the prototype as
the source of truth for *appearance and interaction*; treat the existing production component as the
source of truth for *data flow, persistence, and API contracts*.

The prototype mounts a single React component, `ShotFlow`, inside an iPhone frame. Ignore the frame,
the Tweaks panel, and the seeded sample-round data — those are prototype scaffolding.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, and interactions are all specified
below and present in the prototype. Recreate pixel-faithfully using the codebase's existing
component library, then verify against the prototype.

---

## What's new vs. production (the 5 optimizations)

Implement these on top of the existing flow. Each is independently shippable.

1. **Undo on the commit toast.**
   Routine (non-terminal) shots commit immediately and show a toast. The toast is now **tappable
   with an "Undo" pill** for ~3.4s. Undo must fully roll back the commit: stroke count, the shot
   record, the lie carry-forward, and return the user to the screen they were on (the Result/miss
   step for through-green shots, the putt-miss step for putts). Implementation in the prototype:
   a full state `snapshot()` is captured *before* commit and restored by `doUndo()`. In production,
   back this with an optimistic-update + rollback (or a DELETE of the just-created shot if already
   persisted).

2. **Skippable Strike step.**
   The Strike (execution 1–4) screen now has a **"Skip — don't rate this one"** text link that
   advances to Result with `execution = null` (unrated). The 1–4 buttons still auto-advance as
   before. Production currently forces a strike value; make it nullable.

3. **Smart yardage defaults.**
   The yardage numpad **prefills the most-recent distance for the selected club**, shown as a
   tappable "Recent {club}" chip (up to 3 recent values). This turns the common case into a one-tap
   "Next →" confirm. Maintain a per-club recent-distances list (last 3, most-recent-first, deduped).
   In production, seed this from the player's shot history for that club rather than the hardcoded
   bag used in the prototype.

4. **Back button is context-aware.**
   At the **root** of the flow (Club step, nothing to undo/edit) the top-left button is a **home/exit
   glyph** that leaves the entry flow back to the round view. On any inner step it is a **back arrow**
   that walks one step back through the wizard. No dead/no-op state. (Prototype navigates to
   `../Dashboard.html` as a stand-in for the round view — wire to the real round route.)

5. **"This hole" recap strip.**
   On the Club step, a collapsible strip at the bottom shows every shot logged on the current hole.
   Collapsed: a row of club tokens (`D 7i SW`, penalties tinted clay). Expanded: a per-shot list
   (`{n} · {club} · {zone}{miss}{+1} · {yds}yd`), with an **Edit** affordance on the **last** shot
   only (re-opens it for editing — same as production's edit-last behavior).

---

## Screens / Views

All screens share a persistent **header + context stack** at top and a **step body** below.
Canvas is a phone viewport; the prototype device screen is **402 × 874** (logical px).

### Persistent chrome (all steps)
- **Header row** (height ~42px content): `[back/home icon button] · [Hole title block] · [score block]`
  - Back/home button: 42×42, radius 13px, bg `--sunk`, icon 20px `--ink-700`. Active: `scale(.94)`.
    Glyph `⌂` at root, `←` on inner steps.
  - Hole block: title "Hole {n}" in **Bricolage Grotesque 800, 23px, -0.02em**; subtitle
    "PAR {p} · {yd} yd" in **Martian Mono 600, 11px, .04em, uppercase**, color `--ink-500`
    (the "· {yd} yd" portion `--ink-300`).
  - Score block (right aligned): vs-par value **Martian Mono 800, 20px, tabular-nums**
    (`--positive` when under, `--negative` when over); below it "thru {k} · shot {n}" in
    **Martian Mono 600, 10px, .03em uppercase**, `--ink-500`. vs-par hidden until ≥1 hole complete.
- **Stepper** (hidden in putt mode): 4 equal segments, 8px gap. Each = a 5px pill bar (radius 999px)
  over a label. Bar: `--line` todo, `--fairway-700` done, **`--lime` current**. Label: Martian Mono
  600, 9px, .06em uppercase; todo `--ink-300`, done `--fairway-700`, current `--ink-900`. A skipped
  step (yardage skipped off the tee) renders the label **struck-through** at 55% opacity.
- **Lie pill** (hidden in putt mode and when lie is "Green"): a pill button, bg `--sunk`, radius 999,
  padding 8×14. "LIE" eyebrow (Martian Mono 600, 10px, uppercase, `--ink-500`) + lie value
  (600/14px) + optional "edited" tag (`--clay`) + chevron. Tapping opens a 3-col grid of lie options
  (each 42px tall, radius 13, 1.5px `--line-strong` border; selected = `--fairway-700` fill, white).
- **Hole strip**: horizontal scroll row of 38×38 chips, 8px gap, radius 12, Martian Mono 600/13px
  tabular. States: current = `--fairway-700`/white; started = inset 1.5px `--line-strong`;
  done = inset 1.5px `--fairway-300`, `--ink-500`; conceded = struck-through. Auto-centers current.

### Step 1 — Club ("Which club?")
- Question heading: **Bricolage 800, 28px, -0.02em**.
- "Driver" full-width button (height `--tap`+6).
- 3-column grid of iron/wedge buttons (`3W 5W 4i 5i 6i 7i 8i 9i PW GW SW LW`), each height `--tap`,
  18px, **Martian Mono 600**.
- "Putter" full-width button.
- Foot: the **"This hole" recap strip** (optimization #5) + a "Pick up hole →" link when the hole
  is in progress.
- All buttons: the `.tap` style (see Design Tokens). Tapping a club advances; Driver/3W/5W off the
  tee on a par 4/5 **skip straight to Strike**; Putter enters **putt mode**.

### Step 2 — Yards ("How far?")
- Big readout: distance in **Bricolage 800, 64px, -0.03em** (em-dash placeholder when empty), with
  "YARDS TO THE HOLE" caption (Martian Mono 600, 11px, .1em uppercase, `--ink-500`).
- **Recent-yardage chips** (optimization #3) above the pad.
- Numpad: 3-col grid, keys 52px tall, radius `--r`, bg `--sunk`, 24px/600; "Clear" and "⌫" function
  keys 14px `--ink-500`. Max 3 digits, leading zeros stripped.
- Footer row: "No yardage" (soft button, clears + advances) | "Next →" (primary CTA).

### Step 3 — Strike ("How'd you strike it?")
- Subtitle "Your honest 1–4 quality rating."
- 2×2 grid of buttons, each 84px tall: big numeral (Martian Mono 800, 26px) over a word label
  (`Bad / Okay / Good / Great`, 13px/600 `--ink-500`). Tapping auto-advances to Result.
- **"Skip — don't rate this one"** link below (optimization #2).

### Step 4 — Result ("Where'd it end up?")
- **Decision control** (demoted): a row with label "Decision" + hint "Tap Bad only for a thinking
  mistake", and a segmented Good/Bad pill control (bg `--sunk`, 34px tall; Good-on = `--fairway-700`,
  Bad-on = `--clay`, both white text). Defaults to Good.
- **Results grid**: 2-col. Zones in order: `Fairway, Green, Fringe, Rough, Bunker, Recovery, OB,
  Hazard, Lost, Unplayable`. Penalty zones (OB/Hazard/Lost/Unplayable) show a clay **`+1`**
  superscript (Martian Mono 9px). Each `.res` button height `--tap`.
- Full-width "● Holed it" CTA (lime dot + primary green) spanning both columns.
- Routing on tap: **Make** → complete hole; **Green** → commit + enter putt mode; **miss zones**
  (Rough/Bunker/Recovery + all penalties) → miss-direction step; everything else → commit + toast.

### Step 4b — Miss direction ("Which way?")
- Subtitle "Tag the miss so dispersion stays honest."
- A **D-pad layout** (3×3 grid, 74px rows): Long (top-center), Left (mid-left), "PIN" label
  (center, Martian Mono 11px .12em uppercase `--ink-300`), Right (mid-right), Short (bottom-center).
- Tapping a direction commits the shot (with `+1` if a penalty zone) and shows the toast.

### Putt mode ("First putt" / "Second putt" / "Putt {n}")
Replaces the stepper/lie/result entirely once on the green.
- **Main phase**: subtitle "How far, in feet? (step off long ones — a pace ≈ 3 ft)". Feet readout
  (Bricolage 800, 50px, with "ft" suffix 22px `--ink-500`). Compact numpad (keys 46px), max 2 digits.
  An **optional Strike** row: "STRIKE" eyebrow + "optional" + four 40px toggle buttons (1–4,
  multi-select-off; tapping the selected one clears it). Footer: "Missed" | "● Holed it" (both 64px,
  disabled until feet entered). Below: **"Putted off the green?"** escape link → returns to Club step.
- **Miss phase**: subtitle "Putt miss — material only. Skip if it was close." Two groups, **Side**
  (High/Low) and **Length** (Short/Long), each a 2-button row (toggle, deselectable). "Next putt →"
  CTA commits the missed putt and increments the putt counter.

### Hole-complete flash (overlay)
On holing out: a full-screen overlay, bg `--fairway-900`, with an 88px lime ring containing a
checkmark (`--fairway-900` glyph on `--lime-500`), big line "Hole {n} · {strokes} ({vs-par})"
(Bricolage 800, 24px) and a sub line "On to hole {next} →" (or "Round complete →"). Auto-dismisses
after ~1.3s and advances to the next unplayed hole.

---

## Interactions & Behavior

- **Auto-advance**: choosing a club, a strike rating, or a result immediately advances — no explicit
  "next" except on the Yards numpad (where the value must be typed/confirmed).
- **Smart-skip yardage**: `effectiveLie === "Tee" && par >= 4 && club ∈ {D,3W,5W}` ⇒ skip Yards;
  the stepper shows "yards" struck-through.
- **Penalty auto-stroke**: zones OB/Hazard/Lost/Unplayable add `+1` to the hole's stroke count.
- **Lie carry-forward**: each shot's finish becomes the next shot's start lie (see `nextLie()` map in
  `data.js`): Fairway→Fairway, Rough→Rough, Fringe→Fringe, Bunker→Greenside bunker,
  Recovery→Recovery, Green→Green; **stroke-and-distance** (OB/Lost) replays from the previous start
  lie; Hazard/Unplayable → previous-or-Fairway. Shot 1 of a hole = "Tee". User can override via the
  lie pill (sets an "edited" flag).
- **Edit last shot**: reopens the most recently committed shot for re-entry (decrements count, pops
  the shot record). Available from the recap strip's last row and via Back at the Club root when an
  edit is eligible.
- **Transitions**: each step body fades/translates in (~0.22s ease, `translateY(6px)→0`).
  IMPORTANT: the entrance must animate **from a visible state** (transform only, never `opacity:0`
  as the resting/hidden base) so non-animated renders (SSR, reduced-motion, screenshots) still show
  content. Respect `prefers-reduced-motion`.
- **Toast**: top-center pill, `--ink-900` bg / `--paper` text, 13px/600, slides down on show.
  3.4s with Undo, 1.6s without.
- **Active feedback**: tappable surfaces use `transform: scale(.93–.97)` on `:active`.

## State Management

Per the prototype `ShotFlow` (map these onto the production round/shot models + API):

- **Round-level**: `logged` (per-hole `{count, complete, conceded, penalties}`), `lastFinish`
  (per-hole `{result, lie}`), `shots` (per-hole array of shot records — drives the recap),
  `clubYards` (per-club recent distances — drives smart defaults), `hole` (current).
- **Draft (current shot)**: `step` (`club|yards|strike|result|miss|putt`), `club`, `yards`,
  `skipYards`, `exec`, `result`, `decision` (Good/Bad), `miss`, `lieOverride`, `lieOpen`,
  plus putt sub-state `puttNo`, `puttPhase` (`main|miss`), `puttFeet`, `puttExec`, `puttSide`,
  `puttLen`.
- **Ephemeral UI**: `flash` (hole-complete overlay), `toast` (message), `undo` (the rollback
  snapshot), `lastCommit` (edit-eligibility), `recapOpen`.
- A shot record = `{club, result, yards, exec, miss, pen, lie}`.
- **Data**: in production, every commit is a POST to the shots API and a stroke-count update;
  Undo is a rollback/DELETE; recent-yardage and lie carry-forward derive from persisted shot history.

## Design Tokens

These come from the **Modern Clubhouse** system (`design-reference/colors_and_type.css`). Light
values below; the prototype also ships a "night" variant (overrides in `.sef.night` in `FlowCSS.jsx`).

**Color**
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F6F3EC` | screen background |
| `--sunk` | `#EFEBE1` | recessed surfaces, numpad keys, pills |
| `--card` | `#FFFFFF` | tap-button surfaces |
| `--fairway-900` | `#0B2E1E` | hole-complete bg, darkest ink-green |
| `--fairway-700` | `#15784A` | primary action / selected fill |
| `--fairway-600` | `#1E8F59` | (lime-off fallback accent) |
| `--fairway-300` | `#8FD9B4` | done-state ring |
| `--lime-500` | `#CDF23E` | **the one accent moment per screen** (current stepper, CTA dot, undo pill, flash ring) |
| `--clay` | `#E07A3E` | penalties, "Bad" decision |
| `--negative` | `#D5443B` | over-par |
| `--positive` | `#1E8F59` | under-par |
| `--ink-900/700/500/300` | `#14201A`/`#36433C`/`#66726B`/`#9AA39D` | text scale |
| `--line` / `--line-strong` | `#E4E0D5` / `#D2CDBE` | hairlines / button borders |

**Type** — UI: **Hanken Grotesk** (400–800). Display: **Bricolage Grotesque** (headings/readouts,
700–800). Numerals/eyebrows: **Martian Mono** (`tabular-nums`). All three are Google Fonts.

**Density / radius (tweakable in prototype; pick defaults for production):**
- `--r` (corner radius): default **18px** (range 8–28).
- `--tap` (primary tap height): compact 52 / **regular 58** / comfy 66 px.
- `--gap`: compact 8 / **regular 10** / comfy 12 px.
- Accent: `--lime` = `--lime-500` (toggleable to the green fallback).

**Shadow:** primary CTA uses `0 8px 22px rgba(21,120,74,.26)`; toast `0 10px 30px rgba(0,0,0,.25)`.

## Assets
None. No raster images or icon files — all glyphs are Unicode (`← ⌂ ▾ ↺ ✓ ●`) or CSS shapes.
Fonts load from Google Fonts (Bricolage Grotesque, Hanken Grotesk, Martian Mono).

## Files
In `design-reference/` — source files carry a **`.txt` suffix** (e.g. `ShotFlow.jsx.txt`) so they
don't get picked up by an automated build; **strip the `.txt`** to restore the real extension before
running them:
- `index.html.txt` — entry point: mounts `ShotFlow` in the iPhone frame, wires the Tweaks panel
  (density / radius / lime / night). Tweaks + frame are prototype-only.
- `ShotFlow.jsx.txt` — **the flow component** (all step logic, state, the 5 optimizations). Primary
  reference.
- `FlowCSS.jsx.txt` — all styles, scoped under `.sef` (and `.sef.night`). Primary style reference.
- `data.js.txt` — clubs, result zones, penalty/miss sets, lie options, `nextLie()` carry-forward map,
  the `TEE_NO_YARDAGE` skip set, and the sample 9-hole round (sample data is prototype-only).
- `colors_and_type.css.txt` — the Modern Clubhouse color + type foundation tokens.

To run the prototype locally: remove the `.txt` from all five files (keeping them in the same folder)
and open `index.html` — it pulls React/Babel from CDN and the fonts from Google Fonts.

**Production component to modify:** `app/rounds/[id]/log/ShotEntryFlow.tsx` (+ its constants in
`lib/constants.ts`). Keep its data flow and API calls; apply the visual system and the 5
optimizations above.
