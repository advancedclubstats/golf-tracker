# Handoff: Dashboard “Momentum” section + detail-table trend treatment

## Overview
RoundRecall (Advanced Club Stats) is a mobile-first golf strokes-gained (SG) tracker.
Every stat today is all-time/aggregated — the dashboard shows **where** a player is
losing strokes but never **which way those numbers are moving**. This work adds a
sense of **momentum** so a player can answer one question:

> “Of my known weaknesses, which are getting better and which are getting worse —
> and where is my practice paying off?”

Two deliverables:
1. **Ask 1 — a new dashboard “Momentum” section** (the shipped direction is **option B,
   “sparkline buckets”**) that sits directly between the existing **“Where strokes are
   lost”** block (the static state) and **“What to work on”** (the prescription).
   Momentum is the *motion* paired with that static state — they are a set.
2. **Ask 2 — a trend treatment for the detail tables** (Clubs / Distance / Holes):
   a compact **in-cell** trend (delta glyph or mini-sparkline), with a single global
   **“Last N / All” filter** as the fallback only where a glyph can’t fit.

**Restraint is the product decision.** Momentum lives in ONE dashboard section and
ONE compact treatment in tables. Do not scatter trend arrows across every screen or
every stat — that is the explicit anti-goal.

## About the design files
The files in this bundle are **design references created in HTML** — prototypes that
show intended look and behavior. They are **not production code to copy directly**.
The task is to **recreate these designs in RoundRecall’s real codebase**
(Next.js 16 + React + shadcn/ui + Tailwind, per the project’s `reskin/` notes) using its
established components, tokens, and patterns. Where the real app already has a
“Where strokes are lost” and “What to work on” block, **insert the new Momentum
section between them** and reuse the existing card/typography primitives rather than
re-implementing them.

If you are working outside that stack, port the same structure and tokens into the
target environment’s idioms.

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy, and the sparkline rendering are
final and intended to be matched. `RoundRecall Dashboard.html` is a faithful rebuild
of the current production dashboard with the new Momentum section integrated, so it
doubles as a spec for the surrounding context. Recreate pixel-for-pixel using the
codebase’s existing libraries.

---

## The framework (use this — do not invent another)
Every trend is read as **magnitude × direction**, which maps to four pieces of advice:

| Situation | Reading | Bucket |
|---|---|---|
| Big leak **+ getting worse** | Urgent — *the headline* | Slipping (strongest emphasis) |
| Big leak **+ improving** | “Stay the course, it’s working” (validation) | Gaining |
| Fine **+ declining** | Emerging issue — heads-up | Slipping |
| Strength **+ improving** | Your weapon — lean in | Gaining |

This is why a known leak that is improving must read as **different advice** from the
same leak still sliding. The Momentum entries cross-reference “What to work on” via a
tag (e.g. Putting = `#1 leak · working`, Approach = `#2 leak · accelerating`).

## Data contract (non-negotiable rules)
1. **Native per-metric windowing.** Each metric trends on its own unit:
   - SG category → **last N rounds**
   - club stat → **last N shots with that club**
   - hole stat → **last N times that hole was played**
   The shipped default is **N = 5**.
2. **A trend requires a SPLIT, not just a window** — a recent slice AND a prior slice to
   compare (last N vs the N before). The minimum data floor is therefore **~2N**
   (i.e. **10 rounds**, **40 shots**, **10 plays**), not N.
3. **Honesty rule.** Any metric below the 2N floor is **ABSENT** from trend surfaces —
   never a guess, never a flat line. Reuse the existing “not enough data yet” treatment
   where a placeholder is needed (in tables, render an em-dash + reason, not a zero).
4. **Always name the denominator in copy.** Never “putting improving lately.” Always
   **“+0.41 / rd · last 5 rounds”** / **“−0.3 over your last 5 times you played hole 7.”**
   The unit is what makes the stat credible.

## Mobile constraint
Mobile-first; canvas width ~390–430 px. The detail tables **already overflow
horizontally** (Miss L/R clips today). **Do not add wide numeric columns.** Any trend
must ride inside an existing cell or be replaced by one global control.

---

## Screens / Views

### 1. Dashboard — Momentum section (Ask 1, shipped: option B)
- **Purpose:** Show where the player is gaining and slipping in SG terms, with enough
  context to know whether practice is working.
- **Placement:** A standard dashboard section inserted **between “Where strokes are
  lost” and “What to work on.”**
- **Layout (top → bottom):**
  - **Section head row:** mono eyebrow `MOMENTUM` on the left; right-aligned mono
    label `VS PRIOR 5 ROUNDS`. (`display:flex; justify-content:space-between; align-items:baseline`.)
  - **Bucket: Gaining** — label row `▲ Gaining` (mono, uppercase, color `--positive`
    green), then 1–N entries.
  - **Bucket: Slipping** — label row `▼ Slipping` (mono, uppercase, color `--negative`
    red), then 1–N entries. ~22 px gap between buckets.
  - **Footnote** (13 px, `--ink-500`): “Sparkline = your last 10 rounds in that category;
    the dotted line is scratch. Only categories past the **10-round floor** that moved
    meaningfully appear — momentum lives only here.”
- **Entry component** (`.m-row`, 14 px vertical padding, 1 px top hairline `--line`):
  - **Top row** (`.m-top`, `display:flex; align-items:center; gap:10px`):
    - **Name** — Hanken Grotesk 700, 16 px, `--ink-900`, `white-space:nowrap`
      (e.g. “Putting”, “Off the tee”).
    - **Tag chip** (`.m-tag`) — Martian Mono 600, 10 px, uppercase, letter-spacing .03em,
      `padding:3px 8px`, `border-radius:999px`. Four variants:
      - `tag-work` (improving known leak): bg `#DDF3E5`, text `--positive` — copy `#1 leak · working`
      - `tag-weapon` (strength improving): bg `--lime-500` `#CDF23E`, text `--fairway-900` — copy `weapon`
      - `tag-accel` (worsening known leak): bg `#FBE0DD`, text `--negative` — copy `#2 leak · accelerating`
      - `tag-new` (fine but declining): bg `#FBE8DA`, text `#B8511F` — copy `new slip`
  - **Bottom row** (`.m-bot`, `display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:10px`):
    - **Sparkline** (left, 92 × 30 px) — last 10 round values, line color = direction
      (`--positive` green when gaining, `--negative` red when slipping), 2 px stroke,
      rounded joins; a faint dotted **zero/scratch baseline** (currentColor, 35 % opacity,
      `2 2` dash); a soft 0.16→0 vertical gradient fill under the line; a 2.8 r filled
      end dot (“now”). Algorithm below.
    - **Delta** (right, right-aligned): signed value `.d` — Martian Mono 700, 20 px,
      letter-spacing −.02em, colored `--positive` / `--negative`; below it `.w` —
      Martian Mono 11 px `--ink-500` reading `/rd · last 5 rounds`.
- **Shipped data (illustrative — wire to the real split):**
  - Gaining → **Putting +0.41** (`#1 leak · working`); **Off the tee +0.30** (`weapon`)
  - Slipping → **Approach −0.48** (`#2 leak · accelerating`); **Short game −0.22** (`new slip`)
- **Selection logic:** include a category only if it (a) clears the 2N floor AND
  (b) moved by a meaningful threshold (|delta| ≥ ~0.15 SG/rd). Do **not** pad to look
  full. Sort each bucket by |delta| descending. A near-empty section is correct.
- **Early state** (player below the floor): replace both buckets with the honest empty
  treatment — heading “Not enough rounds yet”, body “Momentum compares your last 5
  rounds with the 5 before — it needs about **10 rounds** per category. You have **4**.”,
  a progress bar (current/floor), and a mono caption `4 / 10 rounds · we’ll never guess
  a trend from too little data.” (See `Momentum & Table Trends.html` → “Early state”.)

### 2. Detail tables — trend treatment (Ask 2)
Primary = **in-cell**, never a new numeric column. Fallback = **one global filter**.

- **Clubs table — in-cell delta glyph.** Columns: Club · Carry · Total · Smash · Disp ·
  Miss L/R (this table already overflows; Miss L/R clips — keep it, wrap in an
  `overflow-x:auto` scroller with a right fade). Append a colored **▲/▼ + signed value**
  *inside the Carry cell* (e.g. `162 ▲4`), Martian Mono 700, 0.72 rem, `--positive` /
  `--negative`. Window = last 20 shots vs prior 20; **floor = 40 shots** → clubs below it
  show a faint em-dash, no glyph. Caption: `▲▼ = vs prior 20 shots`. The glyph adds
  **zero width** — that’s the whole point.
- **Holes table — in-cell mini-sparkline.** Fewer columns (Hole · Par · Avg ·
  vs Par · last 5), so tuck a 56 × 20 px sparkline **inside the vs-par cell** next to the
  signed value. Window = last 5 plays; **floor = 10 plays** → holes below it show
  `— needs 10 plays`.
- **Distance (gapping) — filter fallback.** Five numeric columns (Club · Carry · Roll ·
  Total · Gap) leave no room for a per-cell glyph. Provide ONE global segmented control
  at the top — **`Last 20 shots` / `All time`** — that re-computes every row. No per-row
  trend, no per-section control, no extra column. (See `tables.jsx → DistanceFallback`.)
- **Breakpoint rule:** use in-cell whenever a glyph/sparkline fits an existing cell;
  fall back to the single global filter only when it cannot. Same 2N floor applies to
  every row.

---

## Sparkline algorithm (used in Momentum + Holes)
Given `points` (oldest→newest), width `w`, height `h`, `pad = 3`:
1. Include `0` (scratch) in the min/max domain so the baseline is always in range.
2. `min = Math.min(...points, 0)`, `max = Math.max(...points, 0)`, `range = (max-min)||1`.
3. `step = (w - 2*pad) / (points.length - 1)`; for each point
   `x = pad + i*step`, `y = pad + (h - 2*pad) * (1 - (p - min)/range)`.
4. Draw: dotted zero line at the y for value 0; gradient area fill under the polyline;
   the polyline (2 px, round caps/joins); a filled “now” dot at the last point.
Direction (green/red) is passed in, not derived from the path. Exact implementation is
the inline `<script>` at the bottom of `RoundRecall Dashboard.html` and the `Sparkline`
component in `momentum.jsx`.

## Interactions & behavior
- **Momentum section:** static read; entries may deep-link to the relevant detail
  screen (Clubs/Holes/SG) on tap — match the existing row tap behavior.
- **Distance filter:** segmented control toggles `Last 20 shots` ⇄ `All time`,
  swapping the rendered values. Selected segment = white pill on `--paper-sunk` track,
  `--shadow-sm`.
- **Entrance (optional, on-brand):** staggered fade-up, 10 px rise, 0.5 s,
  `cubic-bezier(0.22, 1, 0.36, 1)`, ~30 ms stagger. **Gate the hidden start-state behind
  a JS-added class** (e.g. `.js-anim .fade`) so server render / print / capture / no-JS
  always show content. Respect `prefers-reduced-motion`. Numbers may count-up on first
  reveal (odometer) per the brand, but never leave a persistent `opacity:0` resting state.
- **Press (mobile):** scale 0.97 + slight darken, ~120 ms.

## State management
- `windowN` (default 5) — rounds/shots/plays per slice; the floor is `2 * windowN`.
- Per category: `{ recentMean, priorMean, delta = recentMean - priorMean, samplePoints[], sampleCount }`.
- Derived: `bucket = delta >= 0 ? 'gaining' : 'slipping'`; `eligible = sampleCount >= 2*windowN && Math.abs(delta) >= MEANINGFUL` (≈0.15 SG/rd).
- Tag is derived from the category’s standing in “What to work on” (is it a ranked leak?
  a strength?) crossed with `bucket`.
- Distance table holds two value sets (`recent`, `all`) selected by the filter control.

## Design tokens (from `colors_and_type.css`)
**Color (warm paper system):**
- `--paper #F6F3EC` (app bg) · `--paper-sunk #EFEBE1` · `--card #FFFFFF`
- `--ink-900 #14201A` (text) · `--ink-700 #36433C` · `--ink-500 #66726B` · `--ink-300 #9AA39D`
- `--line #E4E0D5` (hairline)
- `--fairway-900 #0B2E1E` · `--fairway-700 #15784A` (primary) · `--fairway-600 #1E8F59`
- `--lime-500 #CDF23E` (signature accent / “now” / weapon) · `--clay-500 #E07A3E`
- `--positive #1E8F59` (improving / under-par) · `--negative #D5443B` (declining / over-par)
- Tag fills: work `#DDF3E5`, accel `#FBE0DD`, new `#FBE8DA` (text `#B8511F`)
- Scoring-shape bar: eagle `--fairway-600`, birdie `#6FC58C`, par `#C7C2B4`, bogey `--clay-500`, double `--negative`

**Type:**
- Display: **Bricolage Grotesque** 700, tracking −0.02em (page H1, hero title)
- UI/body: **Hanken Grotesk** 400–800 (labels, names; 16 px floor)
- Data/eyebrows: **Martian Mono** 400–700, tabular figures (all stats, the tracked
  uppercase eyebrows/labels). Hero stat 58 px; section stats 40–46 px; row values 16 px;
  momentum delta 20 px; eyebrow 12 px uppercase, letter-spacing .07em.

**Radius:** card 24 px · chips/pills 999 px · sparkline cell unstyled.
**Spacing:** 8 pt base; section gap 32 px; card padding 20–22 px; side gutters 20 px.
**Shadow:** `--shadow-sm 0 1px 2px rgba(20,32,26,.06)`; lime hero gets a green-tinted pop
`0 10px 30px rgba(150,180,30,.30)`.

## Assets
- No raster assets required for this feature. Sparklines are inline SVG generated at
  render time. The em-dash `—`, middle dot `·`, and `▲ ▼` arrows are typographic.
- Icons elsewhere in the app use **Lucide** (1.75 px stroke) via CDN — match if you add any.
- Fonts load from Google Fonts CDN (Bricolage Grotesque, Hanken Grotesk, Martian Mono);
  the design system also self-hosts them in `fonts/`.

## Files in this bundle
- **`RoundRecall Dashboard.html`** — the production dashboard rebuilt with the Momentum
  section (option B) integrated in place. Primary reference for Ask 1 + surrounding
  context, tokens, and the sparkline script.
- **`exploration/Momentum & Table Trends.html`** — the original side-by-side exploration:
  Momentum directions **A (paired ledger)**, **B (sparkline buckets, shipped)**,
  **C (movement-map dumbbell)**, the **early state**, and all three **table treatments**
  (Clubs in-cell glyph, Holes in-cell sparkline, Distance filter fallback). Open this to
  see Ask 2 in full and to compare the directions that were considered.
- **`exploration/momentum.jsx`** — React components + data model + `Sparkline` for the
  Momentum directions and early state.
- **`exploration/tables.jsx`** — React components for the three table treatments.
- **`exploration/design-canvas.jsx`** — canvas host for the exploration file (not needed
  for production).
