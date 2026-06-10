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

### Phase 4 — Display rebuild (Part 3) — ✅ DONE (2026-06-09)

- **T7 · Ranked-list-with-drilldown + target lines** — ✅ done.
  `lib/analytics/leaks.ts` + `LeakList`: ranked by recoverable/round, three-depth
  drilldown (Raw → Meaning vs target → Impact shots), sample-gated early reads.
- **T8 · Dashboard answer order** — ✅ done. Scoring shape (new
  `computeScoringShape`) → where strokes are lost (categories ranked) → decision
  vs execution (shared `DecisionSplit`) → what to work on (leak list).
- **T9 · Hole-level SG attribution** — ✅ done. `holeAttribution.ts` +
  `HoleAttributionList` lead the Holes page as "Cost by hole" (per-hole SG
  breakdown, drillable).

> **Spec v1 epic COMPLETE (2026-06-09).** All of T1–T10 shipped. Open follow-ups
> below: verify the scratch long-game magnitudes; enable the 2B self-baseline
> blend once cells fill; drop the legacy `situation_created`/`short_sided`
> columns; sanity-check the approximate scratch target rates used for scoring
> shape + leak descriptive stats (all marked VERIFY in code).

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
  6i→Rough) and a holed-out `Make` mid-hole (shot 2, LW→Make). **Now self-fixable:**
  open the round's entry flow, go to hole 8, tap **Clear hole & restart**, and
  re-log the correct sequence.

## Entry & editing

- **"Redo / clear hole" flow** — ✅ done (2026-06-09). The entry wizard's club
  step now has a **Clear hole & restart** action (any hole with shots): wipes the
  hole's shots via `clearHole` (action + `/api/rounds/clear-hole` route, mirroring
  concede) and restarts from the tee. Fixes the append-on-re-tee duplication.
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

## Deployment & security

- **Deploy to Vercel** — ready (2026-06-09). Production build is clean; repo has a
  GitHub remote (`advancedclubstats/golf-tracker`); PWA manifest + icons present.
  Step-by-step in `docs/DEPLOY.md`. Needs you to create/connect the Vercel project
  and set 3 env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `APP_PASSWORD`).
- **Portfolio access model (public read-only + owner write)** — ✅ done
  (2026-06-09). The deployed app is public so people can see it; writes are
  owner-only, enforced server-side via `requireOwner` (`lib/auth/owner.ts`) in all
  18 mutating actions, with owner-only pages (new round, entry flow, setup)
  redirecting visitors and write UI hidden. Owner unlocks via
  `/unlock?key=<OWNER_KEY>` (httpOnly cookie); fail-safe in prod (no key → no
  writes). Replaced the old `APP_PASSWORD`/`proxy.ts` app-wide gate.
  **REQUIRED in Vercel:** set `OWNER_KEY`, then unlock once per device.
- **Intro / welcome screen (next).** First-visit overlay framing the project (it's
  yours, the SG thesis, "explore the data"), dropping visitors into the dashboard;
  plus a small read-only cue. Needs the owner's name/blurb for the copy.
- **Security note.** No client-side DB access — the anon key never reaches the
  browser (verified). RLS stays off by design; writes are gated by `requireOwner`.
  **Proper multi-user fix when ready:** Supabase Auth (email login) → enable RLS
  with `auth.uid()` policies → swap `V1_USER_ID` → drop the `OWNER_KEY` gate.

## Tech debt / data integrity

- **EditShotSheet still writes via server actions (re-render on edit).** The
  wizard now writes through fetch route handlers; `EditShotSheet` still calls the
  server actions directly. It's a cold path and a re-render is wanted there, so
  fine — but if it shows the intermittent save error, migrate it to the route
  handlers too.
- **Drop the legacy enum DB CHECK constraints** — ✅ done (2026-06-09, migration
  013). Dropped the string-enum checks (`result`, `miss_direction`, `putt_side`,
  `putt_length`, and `decision_quality`) so Zod (`ShotInsert/UpdateSchema`, parsed
  in `actions/shots.ts`) is the single source of truth for enum values — no more
  DB/constants drift like the Fringe/Recovery crash. Kept the stable numeric/
  structural guards (`par`, `hole`, `shot_no`, `penalty`, `yardage`, `execution`).
- **Mid-shot edits re-derive downstream lies** — ✅ done (2026-06-09). `updateShot`
  now runs `recompute_hole_start_lie` after the edit (preserves manual overrides).
  Also backfilled the 6 already-stale lies in production via a one-off recompute
  across all holes (0 real mismatches remain; 2 manual overrides preserved).
- **Drop `situation_created` / `short_sided` columns** once T6 has shipped and
  nothing references them (deferred per the T6 decision).

## Open product questions (for the player to decide)

- ~~**Hole 10 par.**~~ Resolved (2026-06-09): hole 10 is a **par 4** — matches the
  app, the logged rounds, and the `course_holes` data. No change needed.
- **Possible features** from the original brief: stroke index / handicap, an
  "un-concede" UI for picked-up holes. *(Showing the loaded tee yardage during
  entry — ✅ done 2026-06-09: the entry header now shows "Par 4 · 354 yd" from the
  round's tee.)*
