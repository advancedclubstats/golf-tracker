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

### Remaining — pick up here (B3 → B1 → C → D)

- **B3 · Smart yardage** (NEXT — lower risk, read-only). Yards step: prefill chips
  above the numpad showing the player's **typical** (not raw recent) distances for
  the selected `club`. Decision: typical = most-common, contextual if feasible.
  Plan: in `page.tsx`, derive `clubDistances: Record<club, number[]>` from the
  loaded `shots` (mode/median of recent same-club full-shot yardages; cap ~3,
  dedupe); pass as a prop; render `.ychip` chips (see FlowCSS `.ychips/.ychip`)
  that set `yards` + advance. Prototype seeds from a hardcoded bag — replace with
  history. Putts excluded.
- **B1 · Undo on commit toast** (most delicate — touches commit/rollback). Routine
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
- **Personalize the welcome copy.** `components/WelcomeOverlay.tsx` currently
  reads "I'm Matt, a product manager" with a generic blurb. Swap in the owner's
  sharper positioning line, a one-line *why I built it*, and a LinkedIn/portfolio
  link (add an anchor in the overlay). Pure copy/markup — needs the words.
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
