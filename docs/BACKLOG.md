# Backlog

Running list of things to do next, so a new session can start with
"take the top item." Newest decisions at the top of each section. Claude keeps
this current — when a session finishes work, move done items out and add any
deferrals. Each item should be self-contained enough to act on cold.

> How to use: if a session starts without a specific ticket, read this, propose
> the top unblocked item, confirm, then follow the normal pre-coding protocol.

---

## ACTIVE EPIC — Engine & Display Spec v1

Source: `golf-app-spec.md` (Engine & Display Spec v1). Governing principle:
**Strokes Gained is the spine — one engine, one source of truth.** Build order
below is from the spec and is deliberate (each step removes a contradiction or
unlocks the next). Decisions already made this session are inlined.

### Phase 1 — Engine truth — ✅ DONE (2026-06-09)

- **T1 · 2A Scratch baseline swap** — ✅ done. `sg-baseline.ts` now computes vs
  the Broadie scratch baseline behind a `Baseline` interface (`activeBaseline`,
  the T10 seam). Putting unchanged (matches spec anchors); long-game tables
  shifted to scratch and marked VERIFY — *open: sanity-check the long-game cell
  magnitudes if/when exact Broadie scratch tables are available; ranking is robust
  regardless.*
- **T2 · 2C Sample-size gates** — ✅ done. `lib/analytics/gates.ts`: thresholds
  (club 15, bucket 10), `tierFor`, `isPrescribable`. Awaiting consumers (T7/T8).
- **T3 · 2D Delete the second engine** — ✅ done. Heuristic StrokesLost +
  green%/make%/quality WhatToWorkOn removed from `dashboard.ts` and the Dashboard
  component. SG is the only prescriptive source now.

### Phase 2 — The new signal — ✅ DONE (2026-06-09)

- **T4 · 1A `decision_quality` {Good,Bad}, default Good** — ✅ done. Migration 012
  (applied live). Wired through constants/schema/entry-wizard (default-Good toggle
  on the result step)/in-flow edit/EditShotSheet. Putts commit Good.
- **T5 · 2E Decision/execution split** — ✅ done. `sg.decisionSplit` partitions
  negative SG into decision-loss (Bad → thinking) vs execution-loss (Good →
  practice); card on the SG page. *Will also feed the dashboard reorder (T8).*

### Phase 3 — Subtraction — ✅ DONE (2026-06-09)

- **T6 · 1C/1D Retire `situation_created` + `short_sided`** — ✅ done. Stopped
  collecting (wizard step + short-sided toggle removed), dropped the SG situation
  breakdown. DB columns retained (nullable, unused); drop deferred (see tech debt).
  Resolved the domino-view / edit-chain-fields / short-sided-editing items.

### Phase 4 — Display rebuild (Part 3) — NEXT

- **T7 · Ranked-list-with-drilldown + target lines.** Replace the four-parallel-
  facts "What to Work On" with a single list ranked by **strokes recoverable per
  round**, each item drillable through three depths (Raw → Meaning vs target →
  Impact: the qualifying shots). Every displayed stat shows its scratch-baseline
  target as a signed gap. Non-negotiable: user can always tap down to raw shots.
- **T8 · Dashboard answer order.** Top-to-bottom: (1) Scoring shape — birdie/par/
  bogey/double+ distribution with target lines (DECADE steal; show the tails),
  (2) Where strokes are lost (SG categories ranked, each vs target, drillable),
  (3) Decision vs execution, (4) Specifics gated by sample.
- **T9 · Hole-level SG attribution screen** (the "killer screen"). Per hole:
  player's own expected score, actual avg, the gap, and SG breakdown
  (tee/approach/short/putt). "Hole 7 costs +0.89/round — 70% approach, 30% tee."
  New route under `app/stats/`.

### Phase 5 — Deferred seam

- **T10 · 2B Self-baseline blend.** Seam ✅ in place (T1): `Baseline` interface +
  `activeBaseline` in `sg-baseline.ts`. To enable later: add a blending `Baseline`
  impl (weighted Broadie-scratch × player's own per-cell expected strokes; n≥30 →
  50% self, n≥75 → mostly self) and point `activeBaseline` at it — one file, no
  caller changes. Don't enable until cells are populated.

### Anti-noise rules (apply throughout)
1. Sample count shown next to every cut; the count governs prescription eligibility.
2. Putt buckets stay at current resolution — do not widen.
3. Absolute SG magnitude is legible only after T1; until then rank only.
4. Below-threshold cuts never drive "biggest leak" or any recommendation.

---

## Loose ends (do soon)

- **Clean up hole 8 of the in-progress round** (`64c33e46-ae63-423e-92d7-d646a7072a28`).
  A hole restart appended duplicate shots: two tee shots (shots 1 & 3, both
  6i→Rough) and a holed-out `Make` mid-hole (shot 2, LW→Make). Needs the player
  to say the correct sequence, then delete the stray rows.

## Entry & editing

- **"Redo / clear hole" flow.** Re-entering a hole from the tee currently appends
  duplicate shots instead of replacing (caused the hole-8 corruption above). Add
  a way to clear a hole's shots and start it over from the entry flow.
- **In-flow edit covers only the last shot.** The wizard's "Edit shot N" handles
  the just-committed shot; earlier shots still go through round detail. Fine for
  now; revisit if it's a pain.

## Design & polish

- **Round Recap screen.** The expressive full-bleed recap from the design handoff,
  built additively as a header treatment on the existing round-detail page.
- **SG hero strip on the dashboard.** Full-bleed treatment for the headline SG
  number + biggest leak. (Folds into T8.)
- **Version-control the design handoff.** The Modern Clubhouse token file +
  prototypes live only in `/tmp`. Drop into `docs/design/` if we want them on disk.

## Tech debt / data integrity

- **EditShotSheet still writes via server actions (re-render on edit).** The
  wizard now writes through fetch route handlers; `EditShotSheet` still calls the
  server actions directly. It's a cold path and a re-render is wanted there, so
  fine — but if it shows the intermittent save error, migrate it to the route
  handlers too.
- **Drop the legacy `result` / `miss_direction` / `putt_*` DB CHECK constraints**
  in favor of Zod-only validation. They drifted from the constants and caused the
  Fringe/Recovery crash (fixed in migration 009). Either remove them, or keep a
  hard rule: when adding an enum value, update the DB check in the same PR.
- **Mid-shot edits don't re-derive downstream lies.** `recompute_hole_start_lie`
  runs on insert/delete, not on `updateShot`. Editing a middle shot's result
  leaves later shots' `start_lie` stale until an insert/delete. Minor.
- **Drop `situation_created` / `short_sided` columns** once T6 has shipped and
  nothing references them (deferred per the T6 decision).

## Open product questions (for the player to decide)

- **Hole 10 par.** Course card lists 4/5; the app and logged rounds use par 4.
  Leave as-is unless decided otherwise.
- **Possible features** from the original brief: stroke index / handicap, showing
  the loaded tee yardage during entry, an "un-concede" UI for picked-up holes.
