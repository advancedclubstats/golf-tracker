# Brief: Two-axis flight capture + target-direction offset

**For:** Claude Code (design resolved with the owner; this is the build spec).
**Re:** shot-entry flow (`app/rounds/[id]/log/ShotEntryFlow.tsx`) — the strike/
shape steps and the result/miss steps; constants (`lib/constants.ts`), schema
(`lib/schemas/shot.ts`), and a NEW dispersion analytic. Sibling of
`shotShape.ts` / the Distance "Miss Patterns" read.
**Status:** new data capture. **SG-neutral** — changes no Strokes-Gained number
(see "Why this is diagnostic, not SG"). Additive fields + one new analytic +
entry-flow rework. Not yet built.

---

## The reframe that drove the design

A shot decomposes into two clusters, and today we capture only parts of each:

| Axis | Cluster | Describes | Today |
|---|---|---|---|
| **Strike** (thin / clean / fat) | cause — *how it flew* | contact quality | partial (`shot_contact`: Thin/Chunk, null = ambiguous) |
| **Start line** (pull / straight / push) | cause | where it *launched* vs target | ❌ missing |
| **Curve** (slice…hook) | cause | how it *bent* | ✅ `shot_shape` |
| **Surface** (fairway/green/rough/…) | outcome — *where it finished* | the lie it ended in | ✅ `result` |
| **Target offset** (long/short/left/right) | outcome | where it finished *vs the pin/target* | ⚠️ only on a *missed* surface (`miss_direction`) |

The golfer's own words: *"I hit a pull-cut / push-draw / push-slice that was also
thin, and then there's a result — missed the fairway left, or hit the green short
of the pin."* Cause is a bundle of swing variables; outcome is surface + offset.
Crucially **start line (pull/push) belongs in the cause cluster** next to curve and
contact — not in the outcome cluster. It is *why* (face/aim), distinct from the
offset, which is *what happened* (the leave).

---

## Cluster 1 — Flight (cause): three sequential axes

Replace today's single "shape" step (curve row + Thin/Chunk brackets) with three
**sequential, auto-advancing, single-tap** sub-steps, in the order the owner
thinks them:

1. **Strike** — `Thin · Clean · Fat`  *(3-state; "Clean" is now explicit, not the
   absence of a tag)*
2. **Start** — `Pull · Straight · Push`  *(NEW axis)*
3. **Curve** — `Slice · Fade · Straight · Draw · Hook`  *(existing `SHOT_SHAPES`,
   unchanged)*

### Locked interaction decisions

- **Sequential auto-advance** (flavor A): a tap on each axis advances to the next;
  the curve tap flows on to the result step. This matches "tap through clean →
  push → draw."
- **No "flushed it straight" express chip.** Rationale (owner): pure-straight shots
  are rare, so a center-default express path wouldn't get used. Every shot is
  actively tapped through.
- **Mis-tap recovery = the back arrow** already shipped (the rewind/step-back work):
  within a shot it walks the sub-steps backward without resetting the draft, so one
  `←` returns to the previous axis with selections intact. This is the safety net
  that makes auto-advance acceptable — do not add a separate per-axis undo.
- **Subjective 1–4 strike rating: kept for now, but flagged for removal.** It
  overlaps with Thin/Clean/Fat (a thinned shot is rarely a "4"). When this ships,
  revisit whether the 1–4 step survives — likely cut, since Strike + Curve covers
  "how well did you hit it." Keeping both = 4 flight-ish screens per shot, which is
  the main entry-cost cost; dropping the 1–4 brings it back to 3.

### Data model (Cluster 1)

- `shot_contact` → make **3-state** including `Clean` (today: `Thin | Chunk`,
  null = clean/skipped). Decide: add `Clean` as an explicit value, or keep
  null = clean. Recommend explicit `Clean` so "I logged it and it was clean" is
  distinguishable from "I skipped it." Display label "Fat" maps to stored `Chunk`
  (or rename the value — minor).
- `shot_start` → **NEW** enum `Pull | Straight | Push` (nullable for legacy rows).
- `shot_shape` → unchanged.

---

## Cluster 2 — Outcome: surface + required target offset

Surface stays the existing `result` chips. Add a **target offset** that
generalizes `miss_direction` so it fires on *greens too*, not only on misses.

### The efficiency insight (why offset is one tap, not two)

We already capture the *magnitude* of an on-green leave — the next shot is a putt
and its distance (feet) is logged. So for a shot that finds the green the system
already knows you left 28 feet; the only missing fact is **which way** (long?
left?). So offset captures **direction only** — magnitude is reconstructed from
the resulting distance. One tap.

### The control: one pin-relative grid (8-way), generalized from the miss cross

```
   long-left   long    long-right
   left        AT PIN  right
   short-left  short   short-right
```

This is today's miss cross with the **corners filled in and the center made
selectable**. A missed green picks an outer cell; an on-green shot picks where it
finished vs the pin (center = stuffed it). `miss_direction` becomes a special case
of a general `target_offset`.

### Locked decisions

- **8-way grid** (not the 4-way cross). If the tap is required on every green, it
  should yield full resolution — the diagonals ("over-and-left", "short-right") are
  the most informative and cross-reference the flight cluster (a long-right miss
  ↔ a push-slice).
- **Required, not skippable**, on approaches/greens — including a selectable
  **center ("At pin")** for a stuffed shot. Complete dispersion data is the point.
- **Tee / fairway = side-only**: `Left · Middle · Right`. No long/short — "long"
  off the tee is meaningless. ("Middle" = on line; same center cell, contextual
  label.)

### Which control fires (the approach-vs-advancement switch)

Reuse the existing `categoryOf(lie, yards, par)` (`lib/analytics/sg.ts`) as the
selector — no new heuristic:

- `Approach` / `Short game` → **8-way** pin-relative grid (center selectable).
- `Off the tee` → **side-only** `Left · Middle · Right`.
- `Putting` → N/A (putts already have side/length).

Known caveat: a deliberate layup classifies as `Approach` and would be asked the
8-way grid though you weren't aiming at the pin. Rare; accept as minor noise.

### Data model (Cluster 2)

- `target_offset` → **NEW** enum, the 3×3 grid:
  `LongLeft, Long, LongRight, Left, Center, Right, ShortLeft, Short, ShortRight`.
  Off-the-tee shots only ever use the lateral subset `{Left, Center, Right}`.
  Nullable for legacy rows.
- **Migrate `miss_direction` into it**: `Left→Left, Right→Right, Long→Long,
  Short→Short`. Then deprecate `miss_direction` (drop the column once nothing
  reads it, mirroring the `situation_created` retirement). Confirm no analytic
  still needs the old field before dropping.

---

## Why this is diagnostic, not SG

SG = `baseline(start_lie, start_dist) − baseline(end_lie, end_dist) − penalties`.
An approach that finds the green is **already** priced by the resulting putt
distance (a 6-footer gains more than a 45-footer, automatically). So **target
offset changes no SG number** — there are **no `sg-baseline.ts` / `sg.ts` edits**.
Its entire payoff is a **dispersion / leak read**: "your 100-yd wedges leak
*because you're consistently long-left."* It is a sibling of `shotShape.ts`, not a
new term in the engine. The richest output is **flight × offset cross-reference**
(does the long-right miss track the push-slice?), which turns dispersion into a
practice prescription.

---

## Entry-cost ledger (be honest)

Per shot, vs today:

- Flight: today 1 screen (shape) + the 1–4 step. New: 3 sequential screens (+1 if
  the 1–4 stays). Net **+1–2 taps**, each a fast single tap, auto-advancing.
- Outcome: a **GIR now costs +1 tap** (the offset grid) where "Green" used to be
  terminal. This is the deliberate trade for the distance-control signal.

Mitigation already in place: the back-arrow rewind means none of these taps is a
dead end. The lever if it feels heavy: cut the 1–4 strike rating.

---

## Open items for the build

1. **`shot_contact` 3-state**: add `Clean` value vs keep null=clean (recommend
   explicit `Clean`); "Fat" vs "Chunk" label/value.
2. **Drop the 1–4 strike rating?** Decide at build time; default to keeping it,
   but it's the obvious cut if entry feels long.
3. **`miss_direction` migration + column drop** — confirm no reader remains.
4. **Exact `target_offset` enum naming** + how the side-only tee variant maps onto
   the shared enum (`Left/Center/Right` subset).
5. **The new dispersion analytic + display** — per club-category / distance-bucket
   offset distribution, gated by `gates.ts`, ideally with the flight cross-ref.
   This is the actual payoff; scope it as its own step after capture lands.

## Non-goals

- No SG/baseline changes.
- No new "shot type" picker (start line is a flight property, not a response).
- Don't capture offset magnitude — it's already in the next shot's distance.
