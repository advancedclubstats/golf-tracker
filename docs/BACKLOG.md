# Backlog

Running list of things to do next, so a new session can start with
"take the top item." Newest decisions at the top of each section. Claude keeps
this current — when a session finishes work, move done items out and add any
deferrals. Each item should be self-contained enough to act on cold.

> How to use: if a session starts without a specific ticket, read this, propose
> the top unblocked item, confirm, then follow the normal pre-coding protocol.

---

## DONE — Recent-form beat at the round-recall exit (DL-027) — 2026-07-01

Lane 3 + lane 1 polish. Shipped items 1+2 of the proposal
(`docs/pm-loop/recent-form-proposal.md`), which also closes DL-025's unshipped
half. From a UXR observation: logging a round carries real activation energy, but
the payoff at entry is flat because the all-time SG numbers barely move (a
cumulative-mean denominator problem). The fix: a recent-form lens at the recall
exit, next to the frozen all-time number.

- **Shared primitive** `lib/analytics/recentForm.ts` (pure, D-05): per SG
  category, `{recentMean, priorMean, delta, allTimeMean, sampleCount}` — last-N
  vs prior-N per-round SG, reusing `perShotSG` + momentum's chronological
  ordering. Honesty floor: below N → `recentMean` null; below 2N →
  `priorMean`/`delta` null (never zeros). Plus `topRecentFormMove` (momentum's
  |delta| ≥ 0.15 gate) and `shotsThroughRound` (the as-of-round window).
- **Record detection** `recordsBrokenBy` in `lib/analytics/streaks.ts` (pure).
- **Surface**: `components/rounds/RoundRecall.tsx` shows AT MOST one beat,
  priority-selected in `app/rounds/[id]/page.tsx`: broken record ("◆ New best ·
  5 up-&-downs in a row") outranks a recent-form move ("Approach: +0.27 over
  your last 5, up from −1.51 the 5 before") outranks nothing. Both computed **as
  of the round being viewed**.
- **Key honesty fix (found in live verify):** the literal "current run passed
  prior best" record rule fired on **12/19** of Matt's rounds — Matt rarely
  doubles, so long streaks extend their own record nearly every round
  (wallpaper). Redefined a record as a genuine **comeback** (a prior mark stood,
  broke, then got beaten: `before.current < before.best`). Result: a healthy
  **6 record / 8 move / 5 none** across the 19 rounds.
- build / lint / tsc / **215 tests** green; live-verified across all 19 rounds
  (record + move + none states, no console errors); `PROJECT_CONTEXT.md` updated;
  DL-027 logged in `decisions.json`.

**Item 3 — dual number on `BiggestLeakHero`** — ✅ done (2026-07-01). The hero
now pairs the frozen all-time leak SG with a subordinate mono line: the leak's
parent SG category trended over the last N rounds (prior → recent), labelled
"{category} overall" because the headline is a sub-bucket. Reuses the existing
`recentForm` primitive (threaded through `getDashboardSG` → `Dashboard` →
`BiggestLeakHero`); only renders above the 2N floor, all-time stays the 38px
moment. Live-verified: "Putting overall, last 5 rounds: −1.79 → −0.37" beside
the −0.77/round leak. tsc + lint + tests green.

**Still deferred (proposal item 4):** trajectory/ETA (lane 1, highest honesty
risk — projects a trend forward). **Off-app cheap test first** (compute one ETA
by hand for the putting leak, sit with it); build only if a believable ETA makes
the frozen number feel alive rather than distrusted. Most expendable of the four.

---

## DONE — The Chase: forward streak goals (DL-025) — closed 2026-07-01

Lane 3 (break the wall). Shipped decision 2026-06-28. Reframe the dashboard's
rear-view streak tracker into a forward goal + a quiet "new best" beat when a
record falls. Step 0 (the "{n} to go to your record" line) and the single
forward chase shipped earlier (commits `e5a5269`, `6af812f`); the **remaining
"new best beat on the recall exit"** shipped as part of DL-027 above (with the
comeback-only honesty fix). Nothing left open here — closed.

<details>
<summary>Original full-build notes (for reference)</summary>

**Full build (only after the cheap test pays off):**
- Selection logic in `lib/analytics/streaks.ts` (pure, D-05): pick the streak
  with the smallest positive gap `(personalBest - currentRun)` as the active
  chase; expose `{category, currentRun, personalBest, toGo}`. Ties broken toward
  the higher-stakes mistake category (3-putt / double over up-and-down). Below
  the existing opportunity floor → no chase surfaced (honest empty state).
- Reframe `components/dashboard/StreaksSection.tsx`: one forward chase up top
  (name + "{currentRun}/{personalBest}" + a progress bar toward the record),
  the remaining streak rows below as today. Reuse existing tokens; no hardcoded
  hex.
- "New best" beat on the round recall exit (`components/rounds/RoundRecall.tsx`)
  when a logged round pushes a streak past its prior record. One calm marker,
  consistent with the Tiger 5 RECORD chip; not a celebration interstitial.

**Constraints / acceptance:**
- No schema, no migration, no new engine. Everything derives from real shots.
- D-05: any new selection/gap logic is a pure helper in `lib/analytics/` with
  unit tests (gap math, tie-break, below-floor empty state, record-broken
  detection).
- One place only (anti-goal: scattering trend/streak cues across screens).
- Watch the steelman risk in review: a chase must not be framed in a way that
  rewards conservative, streak-protecting golf over the honest play.
- build / lint / type-check / tests green; live-verify on the dashboard; update
  `PROJECT_CONTEXT.md`.

</details>

---

## NEXT — Hayden Lake career: earned-milestone ladder (DL-026)

Lane 3 (break the wall). Shipped decision 2026-06-28. Consolidate the currently
scattered earned achievements (Tiger 5 clean streaks on the dashboard, course
records, practice PRs, best-SG round) into one "career at this course" surface a
reflector wants to revisit: a calm column of milestones genuinely earned, then a
few not-yet-earned rungs with how close you are. Every item tied to real golf,
zero activity points (DL-023 line: honest-achievement, not engagement-bait).

**Cheap-test-first gate (lane 3, required before the full build):**
Step 0 is off-app. Matt lists his real milestones on paper from what the app
already shows (best round, longest clean streaks, firsts) and sits with it. Go
only if (a) he wants to look at it again and (b) an unearned one makes him want
to chase it. If the list reads as a one-glance trophy case, stop and log the
result. Do NOT build the page before this.

**Full build (only after the cheap test pays off):**
- Pure assembler `lib/analytics/career.ts` (D-05): build a `Milestone[]` from
  existing computed sources only — `streaks.ts` (clean streaks + bests), the
  course-records logic, `roundRecall.ts` (best-round SG), and the
  distance/up-and-down filters in `distanceSummary.ts`. Each milestone:
  `{id, label, earned: boolean, value, achievedOn?, toGo?}`. Sample-gated
  (Principle 3): a milestone that needs more data than exists is absent, never a
  guess.
- Practice records read through the existing `lib/practice/scoring.ts` markers,
  READ-ONLY. Do NOT breach the practice data wall (PROJECT_CONTEXT "Practice
  games — walled-off data path"): `career.ts` may consume already-computed
  practice markers but must not make real-round analytics read `practice_*`.
- New route `app/career/page.tsx` (public read-only, consistent with the rest of
  the portfolio app; owner sees the same). Calm Brief single column, the three
  fonts, CSS-var tokens, no hardcoded hex. Earned milestones first; an
  "on the horizon" group below with "{toGo} to go."
- Add a discoverable but unobtrusive entry point (e.g. from the dashboard
  streak/records area). Do not add a 5th bottom-tab.

**Constraints / acceptance:**
- Derive, don't store (D-01): no new tables/columns; everything from raw shots
  and existing pure analytics.
- D-05: `career.ts` is pure, zero Supabase imports, unit-tested (earned vs.
  unearned classification, sample-gating, toGo math, the practice-wall boundary).
- Honest-achievement only: no milestone for mere activity (logging in, streaks
  just for showing up). Watch the vanity-wall / thin-list risk in review; a
  sparse honest list beats a padded one.
- build / lint / type-check / tests green; live-verify the route; update
  `PROJECT_CONTEXT.md`.
- Sequencing note: The Chase (DL-025) is the cheaper, higher-pull move; if doing
  one first, do that, since it may also satisfy part of the appetite this serves.

---

## DONE — Practice games: SG-scored, personal leaderboard (DL-022) — 2026-06-28, branch `feat/practice-games`

Lane 3 (break the wall). The 90/70/50 practice-ball routine is now a scored,
repeatable game with a personal number-to-beat, real strokes gained on the same
scratch baseline as rounds. Shipped exactly **one** game (the Lane-3 gate): "The
Zone — 9" — 9 balls, 3 each at 90/70/50 yd off the fairway, par 27.

- **Data — walled off.** Migration `023_practice_games.sql` (applied live): two
  new tables `practice_sessions` + `practice_results`, scoped by `user_id` like
  rounds/shots. `lib/db/practice.ts` is the ONLY reader of `practice_*` and never
  touches `shots`/`rounds`; no real-round analytic reads practice data. Only raw
  per-ball `strokes` stored (D-01); everything derived.
- **Registry = code (D-02).** `lib/practice/games.ts` holds the games as config
  objects (`stations[{yards,lie,balls}]`, parPerBall, metric); `game_id` is a
  text key into it. Adding a game = a config object + deploy, no DB change. Entry
  + leaderboard read the registry generically.
- **Scoring — pure + tested (D-05).** `lib/practice/scoring.ts`: per-station +
  total strokes, score-to-par, SG = Σ(`expectedStrokes(yards,lie)` − strokes)
  off `sg-baseline.ts`; `rankLeaderboard` (strokes asc, SG tiebreak) + record /
  clean-sweep markers. 9 tests incl. Matt's `[2,3,3]@90 + [3,3,3]@70` example
  (→ −0.20 SG) and leaderboard ordering/ties.
- **Entry point — FAB menu, not a tab.** Per Matt's call: the bottom-bar **+** is
  now a two-option start menu (Log a round / Practice game); no 5th tab.
  `/practice` = game header + personal leaderboard ("your number to beat" hero,
  record/clean-sweep badges, your best highlighted). `/practice/[gameId]/new` =
  owner-gated light entry (one stepper per ball, live running score). Public
  read-only leaderboard; writes owner-only (`requireOwner`).
- **Badges included (DL-023):** "new personal record" (beat every earlier
  session) + "clean sweep" (every ball ≤ par) — earned achievements only, no
  activity points. Social/multi-player board stays an anti-goal.
- **Baseline caveat (DL-002 posture):** the 90/70/50 wedge cells are marked
  VERIFY, so the board ranks by strokes; SG shown but its magnitude is
  provisional (copy says so). Note: par on every wedge is ~−2 SG vs scratch —
  scratch holes wedges out in under 3 — which reads correctly.
- build / lint / type-check / 193 tests green; live-verified end-to-end (FAB
  menu, entry, two sessions → record + clean-sweep badges, ranking). Test
  sessions cleaned from the owner's data afterward. `PROJECT_CONTEXT.md` updated
  (Layer 1 practice-games shipped; Layer 2 walled-off data path documented).

**Next, before expanding (Lane-3 gate):** confirm the loop pulls Matt — he logs a
couple of real sessions and reaches to beat his number unprompted. If logging
dies after one session, stop before adding more games. Deferred optional color:
per-ball putts/finish (table + schema already support them; entry omits them to
stay light).

---

## DONE — Round Recall rename in UI + metadata (DL-018) — 2026-06-27, branch `chore/round-recall-rename`

Lane 1 (dress it up), portfolio. Closed the visible "Golf Tracker" mismatch a
hiring manager hits in the first seconds. **The code work had already landed
incrementally** (via the OG-card + shared-`TAGLINE` commits): `app/layout.tsx`
metadata (`title` + `openGraph`/`twitter`) all read "Round Recall",
`public/manifest.json` `name`/`short_name` read "Round Recall", and `/stats` +
`/rounds` inherit the root `title` (no per-route override, no title template), so
all three tabs already agreed with the OG card. `grep -ri "golf tracker"` across
`app/`/`components/`/`lib/`/`public/` returns only one code comment
(`lib/constants.ts:2`), which the acceptance criteria explicitly allow. The lone
"golf" in `WelcomeOverlay.tsx` is the sport, not the product name.

So the only remaining work was the bookkeeping the item itself called for:
updated the stale `PROJECT_CONTEXT.md` naming-status line (UI + metadata now
done; only the GitHub repo rename pending) and moved this item to DONE.

**Out of scope (still pending):** the GitHub repo rename
(`advancedclubstats/golf-tracker`) — risky and broad. Do it as the last sweep
right before actively sharing the link, so it happens once after the UI settles.

---

## DONE — First-domino root-cause read (DL-016) — 2026-06-27, branch `feat/first-domino`

The `docs/POSITIONING.md` domino metaphor made real: SG blames each shot
independently, but a blow-up hole is a cascade, so name the one shot the hole
turned on and tag the rest as forced recoveries.

- **Engine** `lib/analytics/firstDomino.ts` (pure, D-05): `firstDominoForHole` +
  `computeFirstDominoes`. Blow-up gate = `vsPar >= +2` OR **gross** SG loss
  `<= -2.0`. Root-cause candidate = first shot materially bad by **either** SG
  (`<= -0.5`) OR a **bad swing** (execution `1`) that didn't reach the green —
  then **walk blame upstream** across forced recoveries (`obstruction != Clear`,
  or a punch-out tell: full shot ≥80y that advanced <35%) to the shot that made
  the trouble. Coverage gap → names nothing (`sgCovered:false`).
- **UI** folded into `roundRecall` (carries `rootCause*` + `recoveryShotNos`);
  `RoundRecall.tsx` renders the calm "The hole turned on shot N — <phrase>" line
  on blow-up rows. Verified live on 2026-06-06 (H3 → the drive; H15 → the
  four-putt). 12 firstDomino + roundRecall tests, full suite/lint/types green.
- Validated against Matt's eyeball read (matched 4/5; H7 settled = blame the
  earliest culpable shot).

**Deferred sub-item:** visually mute the individual recovery shots in
`EditableHoleList` (left untouched per the item's guardrail). `recoveryShotNos`
is already exposed on `RoundRecallHole` for whoever picks this up.

**Tie to DL-017 (the why-layer):** the `obstruction` field is `Clear` on all
historical shots, so "behind a tree" is only *inferred* on history; it becomes
deterministic the moment Matt taps Blocked/Partial at entry — obstruction IS the
structured, tap-based why-layer DL-017 wanted (never a freeform text box). If the
read later proves frequently wrong, that's the path, not free text.

---

## DONE — Owner-only PM-loop dashboard route (`/pm`) — 2026-06-27, branch `feat/pm-dashboard`

Mirrors `docs/pm-loop/dashboard.html` inside the app: the decision log as a
private page, in the app's own design system (Calm Brief column, the three
fonts, CSS-var tokens — no hardcoded hex). Internal tooling, kept out of
`decisions.json`. Both the page and the standalone HTML read the same file.

- `app/pm/page.tsx`, `force-dynamic` server component. **Owner-gated via
  `notFound()` on non-owner** (404 hides the route's existence; chosen over a
  redirect, which would leak that `/pm` exists).
- Reads `docs/pm-loop/decisions.json` live at request time (fs). Added
  `outputFileTracingIncludes` in `next.config.ts` so the file ships to the
  serverless bundle in production (it isn't traced by default).
- Pure summary + types in `lib/pm/decisions.ts` (cards, kill rate, cumulative
  accuracy curve), tested in `__tests__/pm/decisions.test.ts` (4 cases).
- Curve is a dependency-free inline SVG (`components/pm/AccuracyCurve.tsx`); no
  Chart.js. Shows the honest early state until ≥3 predictions accumulate (today:
  2 predictions logged, both missed → "0% · too few for a trend yet").
- Verified live: 17 decisions, 21% kill rate, 11 shipped / 3 deferred, feed with
  ship/kill/defer badges + per-row "model guessed X ✓/✗". No new dependency.

**Deferred (optional):** the standalone HTML's interactive ship/kill/defer filter
buttons were skipped to keep `/pm` a pure server component; add a small client
filter if the feed grows. **One deploy-time check:** confirm the file-tracing
include actually lands the JSON in the Vercel function on first deploy.

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
- **The thinking page (`/thinking`)** — ✅ DONE (2026-06-29). Shipped
  `app/thinking/page.tsx`: a static, server-rendered Calm Brief column (six
  labeled beats — problem / bet / what the engine caught / restraint / honest /
  why I built it), em-dash-free outward copy, the owner shot count + "13
  decisions · 25 migrations" as a quiet by-the-numbers line, and CTAs back to the
  app + LinkedIn. Wired the splash: the credibility chip area now has a "Read the
  thinking behind it →" link (`goThinking` dismisses the intro, then routes), so
  the overlay doesn't re-cover the page. Reconciled the copy against POSITIONING
  (added the putting-leak-was-really-approach beat) and merged the memo's "hard
  part" + "thing I cut" into one restraint beat. Left the "0% decisions" beat out
  (default) and skipped a rounds count (scope-mismatch with the visitor sandbox).
  tsc + eslint + 200 tests green; `PROJECT_CONTEXT.md` updated. **Not yet
  live-verified in a browser** (sandbox couldn't `next build` — the running local
  dev server holds `.next` via FUSE). Eyeball `/thinking` on local/deployed, and
  run it through once after deploy.
  - **Original item (for reference):** merged the memo's "one-screen case study"
    (A4) and the CoWork `roundrecall-case-study.md` draft into this one page;
    `docs/thinking-page-draft.md` is the canonical copy.
  - **The job:** hand a serious evaluator (PM/PMM hiring manager, recruiter) one
    skimmable in-app artifact that proves the *judgment* behind Round Recall, not
    just that the app exists. The splash shows the product; this shows the
    thinking. It's the single best thing to put in front of someone deciding
    whether to interview Matt.
  - **The solution:** one static, designed page at `/thinking` — Calm Brief
    single editorial column (the three fonts, CSS-var tokens, never hardcode hex),
    no analytics engine, ~30–60s read, declarative and numbers-first. Then wire
    the splash credibility chip (today text-only, no link) and/or a hero "the
    thinking →" link to it. Add a back-to-app affordance; a visitor mid-sandbox
    must not lose their place (respect `gt_intro_seen`).
  - **Copy:** ready at `docs/thinking-page-draft.md` (thesis → problem → the bet →
    the hard part → a thing I cut → kept it honest → why I built it). Already
    sharp and in Matt's voice. Reconcile only where the repo is more specific:
    `docs/POSITIONING.md` (the wedge, "memory is the moat", the domino metaphor),
    `PROJECT_CONTEXT.md` Layer 1 (the core decision, the
    putting-leak-was-really-an-approach insight), `DECISIONS.md` (D-01…D-13).
    Strongest beats to keep: SG as the one engine; building a heuristic "Strokes
    Lost / What to Work On" system then deleting it; gating every prescription on
    sample size; adding exactly one field (`decision_quality`) and removing two
    (`situation_created`/`short_sided`) once SG did their job.
  - **Open decision (Matt):** include a short "0% decision errors is honest, not
    broken" beat under "kept it honest" only if that stat is still visible in the
    live app. Default: leave it out unless confirmed.
  - **Optional quiet-proof line:** a small "by the numbers" footnote reusing
    `getOwnerShotCount()` + a rounds count + the decisions/migrations count, as
    understated depth — not a metrics block. Cut it if it tips into vanity.
  - **Voice:** `~/CoWork/ABOUT ME/anti-ai-writing-style.md` + `docs/design/
    the_read_brief.md` banned moves (no hype, no throat-clearing, one number per
    clause). Terse and declarative.
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
