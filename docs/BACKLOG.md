# Backlog

Running list of things to do next, so a new session can start with
"take the top item." Newest decisions at the top of each section. Claude keeps
this current — when a session finishes work, move done items out and add any
deferrals. Each item should be self-contained enough to act on cold.

> How to use: if a session starts without a specific ticket, read this, propose
> the top unblocked item, confirm, then follow the normal pre-coding protocol.

---

## NEXT — First-domino root-cause read (from the PM loop, DL-016)

Source: PM-loop ideation, shipped 2026-06-27 (see `docs/pm-loop/decisions.json`
DL-016). Lane 3 (break the wall). Honor D-05 (analytics are pure TypeScript,
plain typed arrays, zero Supabase imports, tests first) and the sample/coverage
honesty rules. Do not touch the SG engine, the gates, or `EditableHoleList`.

The idea: SG blames each shot on a hole independently, but golf is a cascade. On
a blow-up hole, surface the one shot where the round turned (the first domino)
and de-emphasize the forced recoveries after it. This is the `docs/POSITIONING.md`
domino metaphor made real.

**Step 1 (the gate) — ✅ DONE (2026-06-27, branch `feat/first-domino`).**
- `lib/analytics/firstDomino.ts` (pure, D-05): `firstDominoForHole(shots, sgEntries)`
  + `computeFirstDominoes(shots)`. Output per blow-up hole
  `{ hole, rootCauseShotNo|null, rootCauseCategory, rootCauseSg, recoveryShotNos[], holeSgTotal, sgCovered }`;
  routine holes return null.
- Logic: blow-up gate = `vsPar >= +2` OR **gross** SG loss `<= -2.0` (net SG is
  just the score gate in disguise — gross loss catches the recovered bogey).
  Root-cause candidate = first shot that's materially bad by **either** signal —
  SG `<= -0.5`, OR a **bad swing** (execution `1`) that didn't reach the green /
  hole out (SG forgives a bad swing with a lucky result; Matt thinks in swings).
  Then **walk blame upstream** across forced recoveries to the shot that created
  the trouble: an explicit `obstruction != Clear` tag, OR a structural punch-out
  tell (full shot ≥80y out that advanced <35% of its distance). Coverage gap →
  `rootCauseShotNo: null, sgCovered: false` (never guess).
- Validated against Matt's eyeball read (2026-06-27, 11 unit tests, full
  suite/lint/types green): walk-back flips 06-06 H3 / 06-03 H10 to the
  drive-behind-a-tree; the swing signal flips 06-07 H18 to the bladed bunker
  shot; the green guard keeps 06-06 H15 on the four-putt; par-5 layups stay on
  the leaky lay-up. Matches his gut on 4/5; on the 5th (06-25 H7) Matt confirmed
  he's fine blaming the bad-swing tee shot that found the fescue (the read names
  the *earliest* culpable shot — settled default, do not change).
- **Key finding for Step 2 / DL-017:** the obstruction field is `Clear` on all
  historical shots, so the "behind a tree" cause is only inferred heuristically
  on history. Going forward it's deterministic *iff* Matt taps Blocked/Partial at
  entry — i.e. obstruction IS the structured why-layer DL-017 wanted.

**Step 2 — recall-view surfacing. Awaiting Matt's go-ahead (read now matches his gut).**
- Add a `getFirstDominoes` to `lib/sg-server.ts` (mirror `getHoleAttribution`:
  `getEnrichedShots` → `computeFirstDominoes`) so the UI gets the same tee-filled
  input as every other SG view. Do NOT call `lib/analytics` from a client component.
- Surface on the recall view (`components/rounds/RoundRecall.tsx`): on a blow-up
  hole, a one-line "the round turned on shot N (the <category>)" and visually
  mute the recovery shots. Calm Brief style, CSS vars in `app/globals.css`, no
  hardcoded hex. Keep the existing ledger and editing intact.

If `perShotSG` or the recall data shape differs from the above, stop and flag it
before building. Branch, small commits, run `vitest` + lint, update this backlog
and `PROJECT_CONTEXT.md` in the same pass.

Note: the related freeform "what happened" capture (DL-017) was deferred. If the
read above proves frequently wrong, the fix is a structured, tap-based why-layer
(extend `decision_quality`), never a freeform text box.

---

## NEXT — Owner-only PM-loop dashboard route (tooling, not a product feature)

Source: PM-loop access decision, 2026-06-27. This surfaces the decision log
(`docs/pm-loop/decisions.json`) as a private page inside the app so Matt can check
it without serving a folder. It is internal tooling, deliberately NOT logged in
`decisions.json` (that log stays a clean record of Round Recall product calls).
Keep it owner-only for now; making it public is a separate future decision, worth
revisiting once the accuracy curve has roughly 15 to 20 predictions and a real
trend.

**Goal:** an owner-gated route (suggest `/pm`) that renders the same view as
`docs/pm-loop/dashboard.html`, reading the live `decisions.json`.

**Build**
- `app/pm/page.tsx`, server component, `force-dynamic`. Gate it owner-only the
  same way the other owner pages do (redirect visitors; reuse `requireOwner` /
  the owner check in `lib/auth/owner.ts`). Visitors must never see it.
- Read the log at request time from `docs/pm-loop/decisions.json` (fs read from
  `process.cwd()`, or a JSON import). One source of truth; do not duplicate the
  data into the component.
- Render in the app's own design system (Calm Brief column, the three fonts, CSS
  vars in `app/globals.css`, no hardcoded hex), not the standalone HTML's inline
  styles. Sections: the metric cards (decisions, kill rate, shipped, deferred,
  predictions logged + accuracy), the prediction-accuracy curve, and the decision
  feed (badge, title, reason, source, prediction vs actual).
- Curve: reuse the existing `components/dashboard/Sparkline.tsx` (or a small
  inline SVG) rather than adding a chart dependency. With few predictions, show
  the honest empty/early state (mirror the standalone dashboard's copy): the curve
  fills in only as engine-run predictions accumulate. Never fake points.
- Keep `docs/pm-loop/dashboard.html` as the decoupled/exportable version; both
  read the same `decisions.json`.

**Acceptance:** owner visits `/pm` and sees live metrics from `decisions.json`;
non-owner is redirected; matches the app's look; the curve shows the honest
early state until predictions accumulate. No new heavy dependency.
**Do not:** make it public, or copy the decisions data into the component.

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

## Navigation performance (snappier tab switching)

Goal: make every tab feel as instant as the shot-entry flow. Shot entry is fast
because it's a client island with local state; the tabs were slow because every
destination is `force-dynamic` (cold Supabase fetch per tap), had **no
`loading.tsx`** (so navigation *blocked* on the full server render before the
screen changed), and the nav gave no tap feedback (so taps felt dropped →
multi-tap).

- **Tier 0 + Tier 1 — ✅ done (2026-06-26).** Added route-level `loading.tsx`
  skeletons for every tab (`app/loading`, `app/stats/loading`, `app/rounds/
  loading`, `app/courses/loading`) plus focused-flow guards (`rounds/new`,
  `rounds/[id]/log`) so the list skeleton never bleeds into them; a `Skeleton`
  primitive (`components/ui/skeleton.tsx`). Nav now lights the tapped tab
  instantly via `useLinkStatus().pending` in `BottomNav` (kills the multi-tap).
  Killed redundant enrichment: home page enriched shots 3× sequentially →
  `getDashboardSG` (one enrich); holes page fetched all shots twice → pass
  prefetched to `getHoleAttribution`. Verified: tsc + 168 tests green, every tab
  streams the skeleton fallback, no console/server errors.
- **Measurement (2026-06-26).** Probed the real hosted Supabase: every read has
  a ~60–90ms floor regardless of row count (rounds=18 rows→62ms, shots=959
  rows→87ms). It's **round-trip-bound**, not query/index/Zod/compute. So the
  only big levers are (a) fewer round-trips (caching) and (b) lower RTT (region
  co-location). Ruled out: a composite shots index and Zod cost — not the
  bottleneck at this data size.
- **Tier 2a — course-geometry cache — ✅ done (2026-06-26).** `getAllCourseTees`
  + `getAllTeeYardages` (global, unscoped, feed the SG tee-fill on every
  analytics page) are now `unstable_cache`d under a `course-geometry` tag (1h
  revalidate backstop), invalidated via `revalidateTag(tag, "max")` from
  `revalidateCourseViews` and the sandbox seed. Removes the entire second fetch
  wave (tees+yardages) per analytics page with zero scope-keying complexity. The
  per-course Setup readers stay uncached so Setup edits show live.
- **Tier 2b — user-scoped shots/rounds cache — ✅ done (2026-06-26).**
  `getAllShots`/`getAllRounds` resolve the scope `user_id` (cookie) *outside*
  the cache, then call a `getAll*Cached(userId)` body wrapped in `unstable_cache`
  keyed by `["all-*", userId]`, tagged `userDataTag(userId)`, 60s revalidate
  backstop. `userDataTag` lives in `lib/auth/scope.ts`; owner and each sandbox
  invalidate independently (never cross scopes). Every write busts its own
  scope: `revalidateShotViews(roundId, userId)` covers all 6 shot actions (and
  the `/api/shots` + clear-hole + concede route handlers, which delegate to
  them); `createRound`/`deleteRound` and the sandbox seed bust too. Uses
  `revalidateTag(tag, { expire: 0 })` (read-your-writes — next read refetches;
  works from both Server Actions and Route Handlers, unlike `updateTag`), so
  there's no stale-while-revalidate gap after logging. The 60s backstop covers
  the direct-DB sheet import (can't call revalidateTag). Pages stay
  `force-dynamic` — only the DB reads are cached, so per-request scope is intact.
  Verified end-to-end: created a round → appeared on /rounds immediately (19),
  deleted it → gone immediately (18); tsc + 168 tests green; no errors.
- **Region co-location — still the open lever.** Pending the user's Supabase
  region (Dashboard → Settings → General) to pin Vercel's function region. With
  shots/rounds now cached, this mainly helps cold/backstop refetches + writes.
- **Deeper option (after region):** `cacheComponents` + `unstable_instant`
  (prefetched static shell, truly instant nav, no skeleton) — bigger migration.
- **Tier 3 — HOLD.** SPA-grade client data cache (fetch-once/hydrate or a query
  lib) for instant cross-tab nav from memory. Likely unnecessary now Tier 2 landed.

## Entry & editing

- **"Redo / clear hole" flow** — ✅ done (2026-06-09). The entry wizard's club
  step now has a **Clear hole & restart** action (any hole with shots): wipes the
  hole's shots via `clearHole` (action + `/api/rounds/clear-hole` route, mirroring
  concede) and restarts from the tee. Fixes the append-on-re-tee duplication.
- **In-flow edit covers only the last shot.** The wizard's "Edit shot N" handles
  the just-committed shot; earlier shots still go through round detail. Fine for
  now; revisit if it's a pain.
- **Bunker lie collapsed to a single "Bunker"** — ✅ done (2026-06-22). The three
  sand-family start lies (`Fairway bunker`/`Greenside bunker`/`Sand`) are now one
  `"Bunker"` value, so a tee shot into a fairway bunker no longer mislabels itself
  "Greenside bunker". Was safe because SG never distinguished them (all routed to
  the one Sand baseline table + same category logic). Migration `019_collapse_
  bunker_lie.sql` backfilled the 22 existing rows and updated the
  `recompute_hole_start_lie` carry-forward (dropped the >60yd split). Code:
  `START_LIES` (`constants.ts`), `nextStartLie` (`lib/shots/lie.ts`), `tableFor`
  (`sg-baseline.ts`), `SAND_LIES` (`sg.ts`); tests updated.

## ACTIVE — Flight model + target-direction offset

Design: `docs/design/flight_and_target_offset_brief.md`.

**Capture — ✅ done (2026-06-23).** Entry flow reworked: the shape step became
three sequential, auto-advancing single taps — **Contact** (Thin/Clean/Fat;
Clean stored as null `shot_contact`) → **Start** (Pull/Straight/Push, new
`shot_start`) → **Curve** (existing). After the result, a **required
`target_offset`** step generalizes the old miss step: **8-way** pin-relative grid
(center "At pin") on approaches, **side-only** (Left/Middle/Right) off the tee
(`offsetIsSideOnly` = Tee && par≥4). `miss_direction` is still derived/written for
miss results (`legacyMiss`) so existing analytics are byte-for-byte unchanged.
Migration `020_flight_and_offset.sql` (new columns + backfill from
`miss_direction`). The subjective 1–4 strike rating was KEPT (it feeds
clubSummary/core/holeSummary). Back-arrow rewind extended to the new sub-steps.
Live-verified end-to-end; SG-neutral (no baseline/category changes).

**Dispersion read — ✅ done (2026-06-23).** `lib/analytics/targetDispersion.ts`
(sibling of `shotShape.ts`): per club-category, decomposes `target_offset` into a
**distance-control** axis (short↔long — the headline, the signal nothing else
captures) and a **lateral** axis (left↔right), plus at-pin rate and one-way-style
biases, gated by `gates.ts`. Rendered by `components/stats/DispersionMatrix.tsx`
as a new "Where it finished" section on `/stats/shape` (now "Shape & dispersion").
Off-the-tee drives are excluded from the distance axis (`sideOnly` — they capture
side-only, so they'd otherwise read as perfect distance control); they still count
laterally. SG-neutral. Tests in `targetDispersion.test.ts`.

**Remaining:**
- **Flight×offset cross-reference** — the unique insight: per category, which
  flight cause (push/pull/slice…) tracks the worst offset miss. Deferred: needs
  forward data (today's `target_offset` is backfilled from `miss_direction`, so
  there are no diagonals / on-green / paired-flight rows yet). Build once a few
  rounds of real capture exist.
- Then **deprecate `miss_direction`**: move clubSummary/distanceSummary/leaks to
  read `target_offset` (incrementing both lateral + distance for diagonals), then
  drop the column once nothing reads it.
- Optional: revisit dropping the 1–4 strike rating once the contact axis has data.
- Edit forms (`ShotForm`/`EditShotSheet`) don't yet expose `shot_start`/
  `target_offset` — edits preserve them (not sent = unchanged) but can't change
  them. Add if it becomes a pain.

## ACTIVE — Shot-entry reskin + 5 optimizations

Source: `docs/design/design_handoff_shot_entry/` (Claude Design handoff). Reskin
`app/rounds/[id]/log/ShotEntryFlow.tsx` to the Modern Clubhouse / Calm Brief
system + 5 UX optimizations. Keep production data/API; prototype is source of
truth for look + interaction only. Decisions made: smart-yardage = most-*typical*
distances (not raw recent), contextual if feasible; dark mode shipped (built
dark-ready now, flipped on globally as the LAST step after a dark review);
flash overlay + putt escape link both in scope; follow production for bunker-lie
distinction + idempotent-commit/undo-as-DELETE.

**Implementation notes for the resume:** all flow code is in
`app/rounds/[id]/log/ShotEntryFlow.tsx` (~1300 lines, the live round-logging
wizard — high-stakes, verify each change). Reskin uses Tailwind arbitrary-values
mapped to app tokens via shared consts at module top: `Q`, `QSUB`, `TAP`,
`TAP_SEL`, `TAP_SOFT`, `CTA`, `FOOT_LINK` — reuse these. Step containers carry a
`.step` class (entrance animation in `globals.css`, transform-only so SSR/reduced-
motion still show content). **Verify with the preview MCP** (`.claude/launch.json`
has the `dev` config): `preview_start` → `preview_resize` mobile → navigate to a
real round's `/log` and screenshot. Owner-only page; local dev is owner (no
`OWNER_KEY`). Gotcha: hole-strip chips share digit labels with numpads, so
DOM-clicking by text is ambiguous in eval. Test round with data:
`64c33e46-ae63-423e-92d7-d646a7072a28`.

- **A1 · Token foundation** — ✅ done (2026-06-10). `--clay`, `--fairway-900`,
  `--fairway-300` (light+dark) in `globals.css`; rest of the palette already
  mapped (paper=background, lime=highlight, fairway-700=primary, sunk=muted,
  line=border, ink-700/300, negative=destructive, ink-500=muted-foreground).
- **A2 · Visual reskin** — ✅ done (2026-06-10). Chrome (header w/ ⌂/← glyph,
  stepper, lie pill, hole strip) + all 6 step bodies (Club/Yards/Strike/Result/
  miss/putt). Live-verified. Note: `app/rounds/[id]/log/page.tsx` now passes
  `shotsByHole` (for B5).
- **B2 · Skippable Strike** — ✅ done. "Skip — don't rate this one" link →
  `setExecution(null); setStep("result")`. `execution` state is `number|null`;
  commit sends `execution ?? undefined` (unrated).
- **B4 · Context-aware back** — ✅ done (fell out of A2). ⌂ at Club root, ← inner;
  `back()` already had the logic (exit / reopen-last / walk steps).
- **B5 · "This hole" recap strip** — ✅ done. `RecapShot` type + `shotsByHole`
  prop (built in `page.tsx` from `getShotsByRound`), `holeShots` state appended in
  `commitShot`, reset in `handleClearHole`, last-row re-synced in `saveLastEdit`.
  `recapLabel()` helper. Edit shows on the last row only when `editLastEligible`.

### Remaining — pick up here (B1 → C → D)

- **B3 · Smart yardage** — ✅ done (2026-06-23). Yards step now shows a "Typical
  {club}" row of one-tap chips above the numpad. `lib/analytics/clubYardages.ts`
  (`computeClubYardages`) buckets the player's whole logged full-shot history to
  the nearest 5 yd per club and ranks buckets by frequency (most-typical first,
  ties toward the longer/stock distance), capped at 3; putts and putter-off-green
  (`distance_unit==='ft'`) rows excluded. Wired through `page.tsx` (now also
  fetches `getAllShots()` for career-wide typical distances — this round alone is
  too thin) → `clubYardages` prop → chips in `ShotEntryFlow.tsx` (set `yards`,
  selected-state highlight). Decision: chose career-frequency over "recent" since
  `getAllShots` orders by `round_id` (a UUID, not chronological) so true recency
  would need a round-date join — deferred as not worth it. Read-only / SG-neutral.
  Tests in `__tests__/analytics/clubYardages.test.ts`; live-verified (7i → 180/190/
  185, matching the DB frequency buckets).
- **B1 · Undo on commit toast** (NEXT — most delicate — touches commit/rollback). Routine
  (non-terminal) commits show a toast with a 3.4s **Undo** pill (1.6s without).
  The flow currently uses `toast` from `sonner` (success strings). Plan: capture a
  full state snapshot (`logged`, `lastShot`, `holeShots`, `lastCommitted`, draft)
  before `commitShot`, and on Undo: `deleteShot(id, roundId)` (already exists) +
  restore snapshot + return to the step the user was on (Result/miss for through-
  green, putt-miss for putts). Guard against an in-flight save. Make the toast
  tappable per FlowCSS `.toast/.toast-undo` (lime pill, `--ink-900` bg).
- **C · Hole-complete flash overlay** (net-new). On Make / holed putt: a full-
  screen overlay (`.flash.hole`, `--fairway-900` bg, 88px lime ring + ✓, "Hole n ·
  strokes (vs-par)" + "On to hole {next} →"), auto-dismiss ~1.3s then advance. Today
  `completeHole()` just toasts + advances — wrap it with a `flash` state + timeout.
  (The "Putted off the green?" escape link already ships in the putt step.)
- **D · Flip dark mode ON** (closing step). Dark is built-ready (tokens have dark
  values) but DORMANT — no provider mounts `.dark`. Add a `next-themes`
  ThemeProvider (already a dep; `components/ui/sonner.tsx` uses `useTheme`) in
  `app/layout.tsx`, `attribute="class"`, `defaultTheme="system"`,
  `suppressHydrationWarning` on `<html>`. THEN dark-review every screen
  (dashboard/stats were styled light-first; their dark token values are unreviewed).
  Optional manual toggle later. Do this LAST so the live portfolio never shows
  half-baked dark mid-build.

## DONE — Obstruction capture (highest-fidelity SG)

Shipped the result-step placement from `design_handoff_obstruction`. New
orthogonal `obstruction` start-state field (`Clear | Partial | Blocked`, default
`Clear`), captured as a progressive-disclosure control mirroring Decision on the
"Where'd it end up?" step (copy: Clear · Flighted · Chip out; green→terracotta→red
dots). Non-Clear suppresses non-through-the-green finishes; the tagged finish
carries forward as the next shot's start (read-only chip), its own control
resetting to Clear. `Recovery` removed from the entry grid (`RESULT_GRID`) but
kept in `RESULTS` for legacy rows. Baseline maps `obstruction != Clear` → Recovery
table, so no existing SG number changes. Wired: `constants.ts`,
`lib/schemas/shot.ts`, `ShotEntryFlow.tsx`, `sg-baseline.ts`/`sg.ts`,
`lib/shots/lie.ts` (`nextStartObstruction`), migration `014_obstruction.sql`.

## QUEUED — Dashboard "Momentum" + detail-table trends

Source: `docs/design/design_handoff_momentum/` (Claude Design handoff v2;
`RoundRecall Dashboard.html` is the primary spec, `exploration/` has the
side-by-side directions + early state + `momentum.jsx`/`tables.jsx` components).
Adds the *motion* to the all-time SG picture: "of my known weaknesses, which are
getting better/worse, and is practice paying off?" **Restraint is the product
decision** — momentum lives in exactly ONE dashboard section + ONE compact
in-table treatment; do NOT scatter trend arrows across screens (explicit anti-goal).

**The framework (don't invent another):** every trend = magnitude × direction →
a tag. Big leak + worsening = the headline (Slipping); big leak + improving =
"working, stay the course" (Gaining); fine + declining = "new slip"; strength +
improving = "weapon". Tags cross-reference "What to work on" standing.

**Data contract (non-negotiable):**
- **Native per-metric windowing**, default **N=5**: SG category → last N *rounds*;
  club stat → last N *shots with that club*; hole stat → last N *plays of that hole*.
- A trend needs a **SPLIT** (recent N vs prior N), so the floor is **2N** (10
  rounds / 40 shots / 10 plays), not N.
- **Honesty rule:** below the 2N floor → ABSENT from trend surfaces (never a guess
  or flat line; em-dash + reason in tables, e.g. "— needs 10 plays").
- **Always name the denominator** in copy: "+0.41 / rd · last 5 rounds", never
  "putting improving lately."
- Per category: `{recentMean, priorMean, delta, samplePoints[], sampleCount}`;
  `eligible = sampleCount ≥ 2N && |delta| ≥ ~0.15 SG/rd`. Sort each bucket by
  |delta| desc; a near-empty section is correct (don't pad).

**Ask 1 — dashboard Momentum section** — ✅ DONE (2026-06-10). `lib/analytics/
momentum.ts` (`computeMomentum`: per-category recent-vs-prior split, 2N floor,
±0.15 threshold, tag from all-time leak rank × bucket), `Sparkline.tsx`,
`MomentumSection.tsx` inserted between "Where strokes are lost" and "What to work
on" via `getMomentum` in sg-server. Handles populated / below-floor early / steady
states. Live-verified populated (12 rounds). Original spec below for reference:

**Ask 1 — dashboard Momentum section (shipped direction = B, "sparkline buckets"):**
- New section **between `Where strokes are lost` and `What to work on`** in
  `components/dashboard/Dashboard.tsx`. Head: mono `MOMENTUM` eyebrow + right
  `VS PRIOR 5 ROUNDS`. Two buckets — **▲ Gaining** (positive) / **▼ Slipping**
  (negative) — each 1–N `.m-row` entries: name + tag chip (work/weapon/accel/new),
  bottom row = 92×30 sparkline (last 10 round values, dotted scratch baseline,
  gradient fill, "now" dot; direction color passed in) + signed delta (20px mono) +
  "/rd · last N rounds". Footnote explains the floor. Early state (below floor):
  honest empty treatment with a current/floor progress bar.
- Needs a NEW analytic: per-SG-category recent-vs-prior split over the last 2N
  rounds (build on `lib/analytics/sg.ts` + the rounds ordering). Reuse the
  scratch baseline (=0) as the sparkline reference. Sparkline = a small reusable
  inline-SVG component (algorithm spelled out in the README §Sparkline).

**Ask 2 — detail-table trends (in-cell first, global filter only as fallback):**
- **Clubs** (`/stats/clubs`): in-cell **▲/▼ + signed delta** inside the Carry cell
  (e.g. `162 ▲4`), window last 20 shots vs prior 20, floor 40; sub-floor clubs show
  a faint em-dash. Wrap the (already-overflowing) table in `overflow-x:auto` with a
  right fade. Zero added width — the point.
- **Holes** (`/stats/holes`): 56×20 in-cell mini-sparkline inside the vs-par cell,
  window last 5 plays, floor 10.
- **Distance** (`/stats/distance`): no room for a glyph → ONE global segmented
  control `Last 20 shots / All time` that recomputes every row. No per-row trend.
- Mobile: tables already overflow (Miss L/R clips) — **do not add numeric columns.**

**Notes for the build:** mobile-first ~390px; tokens already in the app (lime =
highlight, clay, fairway-900/300, ink-300/700, positive/negative=destructive); the
tag-fill pastels (`#DDF3E5`/`#FBE0DD`/`#FBE8DA`) are new — add as needed. Verify via
the preview MCP. Sequence suggestion: the per-category trend analytic + Momentum
section first (highest value, self-contained), then the three table treatments.

## Design & polish

- **Dashboard "Clean streaks" (Tiger 5 tracker)** — ✅ done (2026-06-24). New
  celebratory section above Course records: per classic mistake, how long since
  it last happened as **current run + personal best**. Counted **per opportunity**
  (named in the UI), not raw holes, per the project's "name the denominator" rule:
  bogey-free par 5s, double-free holes, 3-putt-free holes, bogey-free approaches
  ≤150y, up-&-downs in a row. `lib/analytics/streaks.ts` (pure; reuses
  `enrichRoundHole` + the distanceSummary approach/up-&-down filters; chronological
  hole ordering like `momentum.ts`), `components/dashboard/StreaksSection.tsx`
  (Calm Brief hairline rows, lime accent + RECORD chip only when current = best,
  em-dash for no-opportunity-yet). Wired via `computeStreaks` in `app/page.tsx`.
  Tests in `__tests__/analytics/streaks.test.ts`; live-verified.
- **Distance Summary "good → great" redesign (gap to Tour)** — ✅ done (2026-06-14).
  Design handoff `docs/design/design_handoff_distance/`. The page now has a point
  of view: a ranked **"Biggest gaps to Tour"** hero (dark fairway card) leading
  with **strokes/round** lost across the three widest gaps, and a consistent
  you-vs-Tour **delta chip** replacing the bare Tour column **everywhere a Tour
  benchmark exists** — make-rate, first-putt 1-putt% AND 3-putt%, around-the-green
  up&down%, and approach GIR%. Severity is driven by OPPORTUNITY (strokes/round),
  not raw points; gated to n≥10 (`gates.ts`) so thin buckets render `—` and never
  drive the headline.
  - Chip is direction-aware: the sign reflects *goodness* (`+` better than Tour,
    `−` worse), so lower-is-better 3-putt% reads the same as higher-is-better
    make% (e.g. 3-putt 14% vs Tour 9% → clay `−5`).
  - In-table cell is **chip-only**; the you-vs-Tour mini-bar (`GapBar`) is reserved
    for the hero headline, the one moment on the page.
  - Analytics: `distanceSummary.ts` gains a pure `GapInfo` (with `lowerIsBetter`)
    per benchmarked row + a ranked `hero: HeroGap[]`. Strokes-vs-Tour isn't
    directly available (baseline is *scratch*, Tour benchmarks are %s), so each
    %-gap is converted with a documented per-shot stroke value (make ≈ 1.0,
    GIR ≈ 0.55, 3-putt/up&down ≈ 1.0). Tests cover gate, gap math, both metric
    directions, severity, and hero ranking.
  - UI: new `components/stats/GapCell.tsx` (`GapBar`/`GapChip`/`TableGapCell`) +
    `DistanceGapHero.tsx`; `DataTable` gains a serializable `gapCell` format. Hero
    ranks make-rate + approach only (first-putt would double-count the putting gap).
  - Minor prototype omissions (intentional): no 3-putt ≥10% warn-tint or
    miss-pattern lead-dot. Row-order / cell-style / dark-hero "tweaks" were design
    forks — shipped chip-only, by-distance, dark-hero.
- **PGA Tour benchmark columns on Distance Summary** — ✅ done (2026-06-12).
  Static "Tour" column beside Make%, 1-Putt%, 3-Putt%, Up&Down%, and Green% on
  the Distance Summary tables (D-11). Values are representative band averages in
  `lib/benchmarks.ts` (ShotLink / Broadie), attached as optional `tour*` fields
  by `distanceSummary.ts` and read by the serializable `DataTable` columns in
  `components/stats/DistanceTables.tsx`. No benchmark on Miss Patterns. Tests +
  lint green.
- **Link-preview metadata (portfolio share card)** — ✅ done (2026-06-10).
  Dynamic branded OG image via the App Router file convention
  (`app/opengraph-image.tsx`, 1200×630, rendered with next/og `ImageResponse` —
  no external screenshot; `app/twitter-image.tsx` shares the renderer). Layout is
  the Modern Clubhouse brand: `#F6F3EC` paper, Bricolage Grotesque "Round Recall"
  wordmark, ball-lime (`#CDF23E`) SG dot + rule, tagline, fairway-green
  `roundrecall.com` footer (font fetched per next/og docs with a fallback so the
  build can't break). `app/layout.tsx` sets `metadataBase`
  (`https://roundrecall.com`), `openGraph` (title/description/url/siteName/type)
  and `twitter` (`summary_large_image`); Next auto-wires the image files to
  absolute URLs. Verified: `/opengraph-image` returns a 1200×630 PNG, homepage
  view-source shows absolute `og:`/`twitter:` tags, `npm run build` clean.
  **After deploy:** run the URL through LinkedIn Post Inspector to bust its cache.
- **Personalize the welcome copy** — ✅ done (2026-06-23). `WelcomeOverlay.tsx`
  now carries Matt's PM/PMM positioning, a "why I built it" line (tour-level data
  without GPS/sensors; own rounds at Hayden Lake CC), the sandbox framing, and a
  LinkedIn link.
- **Elite hiring-manager splash (Direction B, full-screen)** — ✅ done
  (2026-06-25). Rebuilt `WelcomeOverlay.tsx`'s first-visit overlay from a centered
  text modal into a full-screen landing for non-golfers: a dark fairway hero
  (`bg-fairway-900` + fixed `#EAF1EC`/`#CDF23E` per the DistanceGapHero
  convention) with the lime-dot wordmark, "portfolio project by Matt · PM/PMM"
  eyebrow, the problem framed sharp (tour-level stats, no GPS/sensors, from
  memory) → a paper section showing the *product* (a hand-tuned static snapshot
  of the recall view from the 2026-06-19 round: takeaway headline + two SG chips
  + three ledger rows) + a "drills to raw shots / honest about sample size"
  line → the sandbox copy → one-tap "Explore the live demo" (dismiss) + a
  "Connect on LinkedIn" secondary + unobtrusive "Owner sign-in". All the
  existing machinery is unchanged: `gt_intro_seen` first-visit gate, dismissal,
  the password form, and the persistent corner sign-in/out pill. Live-verified
  mobile + desktop (forced-open during local owner dev). *Follow-up option: swap
  the static proof for a live-rendered mini recall once it's worth the data
  plumbing — today a curated example is intentional.*
  *Effort/credibility chip* — ✅ done (2026-06-25). A subtle footer credential on
  the splash (between LinkedIn and Owner sign-in): an outline pill + small lime
  dot reading "{N} shots logged from memory". N is Matt's REAL total via
  `getOwnerShotCount()` (`lib/db/shots.ts`) — always `V1_USER_ID`, never the
  visitor's mutable sandbox count — fetched in `layout.tsx` and passed as
  `shotCount`. Head-only count; hides the chip on 0/error. Deliberately
  understated (a "lived-in" signal, not a metrics block); we explicitly rejected
  coding-hours and tokens-used as effort signals (input/AI-vanity, off-brand for
  a PM portfolio). No link yet — see "The thinking page" below.
- **The thinking page (`/thinking`)** — QUEUED. A short, designed in-app page a
  hiring manager can reach from the splash chip / a "the thinking →" link,
  proving PM judgment (not just that the app exists). It's the single best
  artifact to hand a serious evaluator, and the splash credibility chip is built
  to point at it (today the chip is text-only, no link, until this exists).
  - **Why:** the splash shows the *product*; this shows the *thinking behind it*
    — framing, the hard tradeoffs, what got killed. That's the PM-vs-vibe-coder
    tell. Keep it skimmable (~30–60s read), declarative, numbers-first, on-brand
    (Calm Brief single column, the three fonts, CSS-var tokens — never hardcode).
  - **Raw material (don't re-derive, distill):** `docs/POSITIONING.md` (the
    one-liner, the wedge, "memory is the moat", the domino metaphor),
    `PROJECT_CONTEXT.md` Layer 1 (the core decision, "the one field SG can't
    compute", the key diagnostic insight, the killer screen, "why this exists
    beyond golf"), and `DECISIONS.md` (D-01…D-13). The strongest beats: SG as the
    single engine; **building a heuristic "Strokes Lost"/"What to Work On" system
    then deleting it** to get to one rigorous engine; gating every prescription on
    sample size instead of overclaiming; adding exactly **one** new field
    (`decision_quality`) only where the data demanded it, and removing two
    (`situation_created`/`short_sided`) once SG did their job; the
    putting-leak-was-really-an-approach-problem insight as the argument for the
    engine.
  - **Voice:** follow `~/CoWork/ABOUT ME/anti-ai-writing-style.md` and the
    `docs/design/the_read_brief.md` "banned moves" (no hype/metaphor-as-drama, no
    throat-clearing, one number per clause). Terse and declarative.
  - **Scope/shape (Design to lock first):** likely a single editorial column —
    a one-line thesis, then 3–5 short "decision → why" beats, optionally a small
    "by the numbers" line (reuse `getOwnerShotCount()` + a rounds count + the 13
    decisions / 22 migrations as quiet proof of depth). Static content is fine
    (no analytics engine needed). Then wire the splash chip (and/or a hero "the
    thinking →" link) to `/thinking`. Add a back-to-app affordance; respect that
    a visitor mid-sandbox shouldn't lose their place.
- **Dashboard "Calm Brief" reskin (Direction D)** — ✅ done (2026-06-09). Flat
  editorial single-column dashboard per `docs/design/design_handoff_dashboard/`:
  lime stacked hero + lime New Round pill (the only two lime moments), 40px SG
  total atop "Where strokes are lost", full-width scoring-shape ledger, leak rows
  with early-read chips, two-up Snapshot/Stat line. Covers the old "SG hero strip"
  item. Decision-vs-execution card moved off the dashboard (not in the design;
  still on `/stats/sg`). `.eyebrow` bumped to the handoff spec (12px/0.08em)
  app-wide; new `ink-300`/`ink-700` tokens in `globals.css`.
- **Round Recap screen.** The expressive full-bleed recap from the design handoff,
  built additively as a header treatment on the existing round-detail page.
  *List-level version* — ✅ done (2026-06-15). The Rounds list now expands each
  round inline to a per-round SG-by-category + FW%/GIR%/putts/3-putts/vs-par
  breakdown, each shown as a leave-one-out, hole-count-fair delta vs the player's
  average (`computeRoundBreakdowns` in `lib/analytics/roundCard.ts`, rendered by
  `components/rounds/RoundsList.tsx` + `RoundChips.tsx`).
  *Per-round recall + takeaway* — ✅ done (2026-06-25). `/rounds/[id]` now leads
  with the round's story before the editable hole list: a `roundTakeaway`
  headline (largest eligible SG swing vs your average; a raw non-comparative line
  below the floor), the existing `RoundChips` deltas, then an editorial hole-by-
  hole ledger (hole · par · dominant-SG-loss tag / birdie chip · vs-par, ◆ on
  bad-decision holes). New pure `lib/analytics/roundRecall.ts` (`roundRecall` +
  `roundTakeaway`, tested); new `components/rounds/RoundRecall.tsx`. Degrades
  honestly: conceded/in-progress holes show "—", a hole with an SG coverage gap
  (`sgCovered=false`) drops its tag. In-progress rounds (no complete hole) keep
  the prior layout. Live-verified on a full 18, a 2-hole round, and an
  in-progress round.
  *Deferred — tap-to-expand per hole.* The ledger rows are static. One day:
  tapping a row expands that hole's per-category SG mini-breakdown inline (the
  data is already there — `RoundRecallHole.sgByCategory` carries the signed SG
  per category, and `worstCategory`). Would make `RoundRecall.tsx` a client
  component with a `Record<hole, open>` toggle (mirror `RoundsList.tsx`'s
  expand pattern) and render a small per-category list (reuse the `fmtSg` /
  `sgColorClass` helpers from `lib/format.ts`); keep it gated so a hole with
  `sgCovered=false` shows the covered shots only and a note, never a fake total.
  The expressive full-bleed per-round screen (design handoff) is still open.
  **Label consistency** — ✅ done (2026-06-23). Standardized on **"Off the tee"**
  (the canonical `SgCategory` term used on the dashboard / SG pages); the round
  chips no longer relabel it "Driving". `SG_LABELS` in `roundCard.ts` had become
  an identity map, so it was dropped — the metric `label` is now the category
  itself. "OFF THE TEE" fits the chip on one line; live-verified.
- **Version-control the design handoff** — partially done (2026-06-09): the
  dashboard bundle now lives in `docs/design/design_handoff_dashboard/` (spec
  README, prototype, `colors_and_type.css` token foundation). Drop future
  screens' handoffs there too.

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
- **Intro / welcome screen** — ✅ done (2026-06-09). `WelcomeOverlay` (mounted in
  the root layout): first-visit overlay framing the project (Matt, PM, the SG
  thesis, "explore freely — read-only for visitors") with an **Explore** CTA, plus
  an **Owner sign-in** password form (→ `unlockOwner` action sets the cookie) and a
  persistent bottom-right pill (sign-in for visitors / sign-out for the owner).
  Copy can be personalized further (links, refined positioning) anytime.
- **Security note.** No client-side DB access — the anon key never reaches the
  browser (verified). RLS stays off by design; writes are gated by `requireOwner`.
  **Proper multi-user fix when ready:** Supabase Auth (email login) → enable RLS
  with `auth.uid()` policies → swap `V1_USER_ID` → drop the `OWNER_KEY` gate.

## Tech debt / data integrity

- **Intermittent "Load failed" while entering a shot** — ✅ done (2026-06-22).
  Diagnosed: "Load failed" is WebKit's message for a `fetch()` that rejects at
  the network layer (a TypeError — no HTTP response), distinct from a server
  error (those came through `postJson` as "Request failed (NNN)"). Supabase API
  logs showed every shot write that *reached* the DB succeeding (POST 201 / PATCH
  204 / DELETE 204), so the failing hop is browser→Vercel — the classic mobile
  Safari stale-keepalive blip (a fresh attempt/refresh succeeds). The server was
  already idempotent (createShot upsert) and reads already retried
  (`lib/supabase/retry.ts`); the gap was that the client `fetch` in
  `lib/shots/client.ts` had no retry. Fix: bounded network-error-only retry
  (3 tries, 200/400ms backoff) in `postJson`, surfacing a clear message instead
  of the raw "Load failed" if it still gives up. HTTP error statuses are NOT
  retried (deterministic). Tests in `__tests__/shots/client.test.ts`. *Possible
  follow-up if it ever recurs: optimistic/offline queue + tap-to-retry UX.*
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
- **Drop `situation_created` / `short_sided` columns** — ✅ done (2026-06-23,
  migration `021_drop_legacy_situation_short_sided.sql`, applied live). T6 had
  stopped collecting them and nothing read them anymore (only the Zod schema
  permitted them). Removed both columns, the schema fields (insert/row/update in
  `lib/schemas/shot.ts`), and the now-unused `SITUATIONS`/`Situation` from
  `constants.ts`; updated test fixtures. type-check/lint/149 tests green;
  `/stats/sg` still reads + parses all shots cleanly.

## Open product questions (for the player to decide)

- ~~**Hole 10 par.**~~ Resolved (2026-06-09): hole 10 is a **par 4** — matches the
  app, the logged rounds, and the `course_holes` data. No change needed.
- **Possible features** from the original brief: stroke index / handicap, an
  "un-concede" UI for picked-up holes. *(Showing the loaded tee yardage during
  entry — ✅ done 2026-06-09: the entry header now shows "Par 4 · 354 yd" from the
  round's tee.)*
