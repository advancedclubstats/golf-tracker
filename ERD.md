# Engineering Requirements Document

Ticket tracker for the golf tracker app. Every TODO in code must cite a ticket ID from this file (e.g. `// TODO(P2-T1): wire up real analytics`).

Statuses: `todo` | `in-progress` | `done`

---

## Phase 1 — Foundations + Shot Entry

Goal: a working shot-entry flow on mobile, deployed to Vercel, installable as a PWA. No analytics yet — just capture.

---

### P1-T1 — Project scaffold: directory structure + shadcn/ui `done`

**What:** Clean up the `create-next-app` boilerplate, install shadcn/ui, and create the empty directory skeleton the rest of Phase 1 will fill in.

**Acceptance criteria:**
- [ ] Default `app/page.tsx` boilerplate replaced with a minimal placeholder ("Golf Tracker — coming soon")
- [ ] `app/globals.css` retains only Tailwind directives; all default Next.js demo CSS removed
- [ ] shadcn/ui initialized (`npx shadcn@latest init`) with `slate` base color, CSS variables enabled
- [ ] shadcn components installed: `button`, `card`, `input`, `label`, `select`, `badge`, `toggle`, `separator`, `sonner` (toast)
- [ ] Empty directories created (with `.gitkeep`): `lib/schemas/`, `lib/db/`, `lib/analytics/`, `actions/`, `components/shot-entry/`, `components/dashboard/`, `supabase/migrations/`
- [ ] `npm run type-check` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] `npm test` passes (Vitest placeholder still green)

---

### P1-T2 — Supabase migrations: `rounds`, `shots`, par trigger `done`

**What:** Three migration files that define the complete v1 schema. No application code yet — just SQL.

**Acceptance criteria:**
- [ ] `supabase/migrations/001_create_rounds.sql` creates the `rounds` table per SPEC.md (no `total_score` column — D-01)
- [ ] `supabase/migrations/002_create_shots.sql` creates the `shots` table with all columns per SPEC.md; no `CHECK` constraint on `club` (D-02)
- [ ] `supabase/migrations/003_par_consistency_trigger.sql` adds the trigger that rejects inserts/updates where `par` differs from existing shots on the same `(round_id, hole)` (D-09)
- [ ] All four indexes from the schema plan are present: `rounds_user_date`, `shots_round_id`, `shots_round_hole_sn`, `shots_user_club`, `shots_user_hole`
- [ ] `unique (round_id, hole, shot_no)` constraint exists on `shots`
- [ ] Migrations run cleanly against a fresh Supabase project (`supabase db reset` passes)
- [ ] Hardcoded `user_id` UUID constant is defined in `supabase/seed.sql` and used as the column default in both tables

---

### P1-T3 — Zod schemas: `RoundInsert`, `ShotInsert`, `ShotRow` `done`

**What:** The canonical field definitions for rounds and shots. Everything else in the app derives from these.

**Acceptance criteria:**
- [ ] `lib/schemas/round.ts` exports `RoundInsertSchema` (Zod) and `RoundInsert` (inferred type)
  - Fields: `date`, `session_type` (enum: `Full18` | `Practice9` | `Practice6` | `Practice3` — D-03), `notes` (optional)
  - No `total_score` field (D-01)
- [ ] `lib/schemas/shot.ts` exports `ShotInsertSchema`, `ShotInsert`, `ShotRowSchema`, `ShotRow`
  - `club` is a Zod enum listing all valid clubs; no DB check constraint (D-02)
  - `execution` is `z.number().int().min(1).max(4)`
  - `result` is a Zod enum of the 9 valid values plus null/undefined
  - `miss_direction`, `putt_side`, `putt_length` are optional enums
  - `penalty` defaults to `0`, minimum `0`
- [ ] `lib/schemas/shot.ts` exports `CLUBS` (const array) and `SESSION_TYPES` (const array) for use in UI components
- [ ] No field constraints defined anywhere else — any inline Zod schema in a component is a lint error (enforced by the no-restricted-imports rule)
- [ ] `npm run type-check` and `npm run lint` pass

---

### P1-T4 — `createRound` server action + New Round form `done`

**What:** The entry point for logging a round. A mobile-friendly form that creates a `rounds` row.

**Acceptance criteria:**
- [ ] `actions/rounds.ts` exports `createRound(data: RoundInsert): Promise<{ id: string }>`
  - Validates input with `RoundInsertSchema` before touching the DB
  - Inserts into `rounds` with the hardcoded `user_id`
  - Calls `revalidatePath('/')` after insert
  - Never catches an error silently — throws or surfaces to caller
- [ ] `app/rounds/new/page.tsx` renders a form with: date picker (defaults to today), session type selector (four options from D-03), notes textarea
- [ ] Form uses `RoundInsertSchema` for client-side validation via React Hook Form + Zod resolver
- [ ] Successful submit calls `createRound`, then navigates to `/rounds/[id]/log`
- [ ] All form fields have visible labels (accessibility)
- [ ] Page renders correctly on a 390px-wide screen (iPhone 15 viewport)
- [ ] `npm run type-check` and `npm run lint` pass

---

### P1-T5 — Shot entry flow: components + log page `done`

**What:** The core mobile tap flow. One screen per shot, saves each shot to the DB on "Next Shot."

**Acceptance criteria:**

**Components** (each in `components/shot-entry/`, no business logic in the page):
- [ ] `ClubSelector.tsx` — grid of tap targets for all clubs; Driver and Putter visually prominent; accepts `value` and `onChange`
- [ ] `ExecutionButtons.tsx` — four large buttons labeled 1–4; accepts `value` and `onChange`
- [ ] `ResultChips.tsx` — chip selector for the 9 result values; accepts `club`, `shotNo`, `par`, `value`, `onChange` (club+context props reserved for Phase 4 smart ordering — just render all chips flat for now)
- [ ] `MissDirectionChips.tsx` — Left / Right / Long / Short chips; only rendered when `result` implies a miss (not Fairway, Green, Make, or blank)
- [ ] `YardageInput.tsx` — numeric input with stepper (−1 / +1 buttons); accepts `value` and `onChange`
- [ ] `PuttExtras.tsx` — PuttSide (High / Low) and PuttLength (Short / Long) chips; rendered only when `club === 'Putter'`

**`actions/shots.ts`:**
- [ ] Exports `createShot(data: ShotInsert): Promise<{ id: string }>`
  - Validates with `ShotInsertSchema`
  - Inserts into `shots` with hardcoded `user_id`
  - Calls `revalidatePath('/')` and `revalidatePath('/rounds/[id]')` (D: cache rule)
  - Never silently catches errors

**`app/rounds/[id]/log/page.tsx`:**
- [ ] Client component; imports only from `components/shot-entry/` and `actions/shots.ts` — never from `lib/db/` directly
- [ ] Shows current hole number and par at top of screen
- [ ] Renders all six shot-entry components
- [ ] "Next Shot" button: validates all required fields (club, execution required; result required), calls `createShot`, increments shot number
- [ ] When `result === 'Make'`, shows a minimal per-hole summary (strokes = current shot_no, no analytics yet) with a "Next Hole" button that increments hole and resets shot_no to 1
- [ ] "Finish Round" button available after hole 1 is complete; navigates to `/rounds/[id]`
- [ ] Hole counter auto-stops at 18 for `18 Holes`, 9 for `Practice9`, etc.
- [ ] Renders correctly on a 390px-wide screen
- [ ] `npm run type-check` and `npm run lint` pass

---

### P1-T6 — PWA manifest `done`

**What:** Make the app installable on iOS home screen.

**Acceptance criteria:**
- [ ] `public/manifest.json` exists with `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `background_color`, `theme_color`, `icons` (192×192 and 512×512)
- [ ] Icons exist at the referenced paths in `public/`
- [ ] `app/layout.tsx` links the manifest via `<link rel="manifest">` and sets `<meta name="viewport" content="width=device-width, initial-scale=1">`
- [ ] `<meta name="apple-mobile-web-app-capable" content="yes">` present for iOS install support
- [ ] App can be added to home screen on iOS Safari without errors in the install flow

---

### P1-T7 — Deploy to Vercel `todo`

**What:** Production URL accessible from a phone.

**Acceptance criteria:**
- [ ] App deployed to Vercel; production URL is accessible
- [ ] Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) set in Vercel project settings
- [ ] `supabase/lib/client.ts` and `supabase/lib/server.ts` use env vars (not hardcoded URLs)
- [ ] Full round can be logged end-to-end from a phone on the production URL
- [ ] No TypeScript or lint errors in the deployed build

---

## Phase 2 — Dashboard

Goal: the home screen shows real analytics. Every metric currently visible in the Sheets Dashboard tab is reproduced exactly.

---

### P2-T1 — Analytics core: `aggregateByRoundHole`, `strokesToReachGreen`, helpers `todo`

**What:** Port the foundational `.gs` functions to TypeScript. Everything else in `lib/analytics/` depends on this.

**Acceptance criteria:**
- [ ] `lib/analytics/types.ts` defines `ShotRow`, `RoundHole`, `CompleteHole` (enriched with `strokes`, `putts`, `gir`, etc.)
- [ ] `lib/analytics/core.ts` exports:
  - `penaltyOf(shot)` — returns penalty int, 0 if absent
  - `totalPenalties(shots)` — sum across all shots on a hole
  - `isRealPutt(shot)` — Putter with `result !== 'Green'`
  - `strokesToReachGreen(hole)` — three-path fallback per D-04
  - `aggregateByRoundHole(shots)` — groups and sorts shots, computes `complete` flag
- [ ] Zero Supabase imports in `lib/analytics/` (D-05)
- [ ] `__tests__/analytics/core.test.ts` covers all five exported functions
- [ ] Tests include at least one input/output pair verified against `golf_stats.gs` output for each non-trivial function
- [ ] `strokesToReachGreen` tests cover all three fallback paths (primary, fallback A, fallback B)
- [ ] `npm test` passes

---

### P2-T2 — Analytics: per-hole enrichment + strokes-lost attribution `todo`

**What:** Given a `CompleteHole`, compute all the derived stats used across Dashboard and summary pages.

**Acceptance criteria:**
- [ ] `lib/analytics/hole-stats.ts` exports `enrichHole(hole: RoundHole): CompleteHole` which adds:
  - `strokes` = `lastShotNo + totalPenalties`
  - `putts` = count of `isRealPutt` shots
  - `gir` = boolean per SPEC.md GIR formula
  - `fwHit` = tee shot `result === 'Fairway'` (par 4/5 only)
  - `teeMissTagged` = tee shot has a non-blank `miss_direction`
  - `over` = `max(0, strokes - par)`
  - `puttsLost` = `max(0, putts - 2)`
  - `nonPuttLost` = `max(0, over - puttsLost)`
  - `teeLost` = `nonPuttLost` if `par >= 4 && teeMissTagged && !fwHit`, else `0`
  - `approachLost` = `nonPuttLost - teeLost`
- [ ] `__tests__/analytics/hole-stats.test.ts` covers GIR edge cases: normal GIR, chip-in (no Green tag), Texas wedge, fallback A, par 3
- [ ] Tests include at least one input/output pair verified against `.gs`
- [ ] `npm test` passes

---

### P2-T3 — Analytics: dashboard aggregations `todo`

**What:** The full set of metrics the Dashboard displays, computed from an array of `CompleteHole`.

**Acceptance criteria:**
- [ ] `lib/analytics/dashboard.ts` exports `computeDashboard(holes: CompleteHole[], shots: ShotRow[])` returning:
  - Snapshot: `roundsLogged`, `holesLogged`, `totalVsPar`, `avgVsParPerRound`, `avgVsParPerHole`
  - Stat line: `fwPct`, `girPct`, `scramblePct`, `avgPutts`, `threePuttRate`
  - Strokes lost: `teeLostTotal`, `approachLostTotal`, `puttLostTotal`, `totalLost`
  - What to work on: `worstHole`, `worstApprBucket`, `worstPuttBucket`, `worstClub`
  - Recent rounds: last 5 rounds sorted newest-first
  - Records: `bestRound`, `worstRound`, `bestHole` (cumulative vs-par — D-07), `birdies`, `eagles`
- [ ] `__tests__/analytics/dashboard.test.ts` covers all returned fields; at least one full verified snapshot against `.gs`
- [ ] `npm test` passes

---

### P2-T4 — Dashboard page `todo`

**What:** Replace the placeholder home page with the real Dashboard.

**Acceptance criteria:**
- [ ] `app/page.tsx` is a React Server Component that fetches all shots + round metadata via `lib/db/`, passes to `computeDashboard`, renders the result
- [ ] Components in `components/dashboard/`: `Snapshot`, `StatLine`, `StrokesLost`, `WhatToWorkOn`, `RecentRounds`, `CourseRecords`
- [ ] Page imports nothing from `lib/db/` directly — all DB access through `lib/db/` called from the server component, not from client components (layer boundary: components call server actions, not DB directly)
- [ ] Snapshot + Stat Line + Strokes Lost + What to Work On all visible without scrolling on a 390px screen
- [ ] Recent Rounds rows are tappable links to `/rounds/[id]`
- [ ] Empty state renders gracefully when zero rounds are logged
- [ ] `npm run type-check` and `npm run lint` pass

---

## Phase 3 — Round Browser + Shot Edit

Goal: can view and edit any past round. Required for PRD success criterion #4.

---

### P3-T1 — Rounds list page `todo`

**What:** A list of all rounds, newest first.

**Acceptance criteria:**
- [ ] `app/rounds/page.tsx` renders all rounds sorted by date descending
- [ ] Each row shows: date, session type, holes logged, total score (derived), vs par
- [ ] Each row links to `/rounds/[id]`
- [ ] Empty state if no rounds
- [ ] `lib/db/rounds.ts` exports `getRounds()` returning `RoundRow[]` with derived score attached

---

### P3-T2 — Round detail page `todo`

**What:** See all shots from a round, grouped by hole.

**Acceptance criteria:**
- [ ] `app/rounds/[id]/page.tsx` shows shots grouped by hole
- [ ] Each hole section shows: hole number, par, strokes, putts, GIR indicator, FW indicator
- [ ] Each shot row shows: shot_no, club, yardage, execution, result, miss_direction
- [ ] Tapping a shot navigates to or opens the edit form (P3-T3)
- [ ] Back link to rounds list

---

### P3-T3 — Edit shot `todo`

**What:** Edit any field on any past shot. Aggregates recompute automatically.

**Acceptance criteria:**
- [ ] `actions/shots.ts` exports `updateShot(id: string, data: Partial<ShotInsert>): Promise<void>`
  - Validates with `ShotInsertSchema.partial()`
  - Calls `revalidatePath('/')` and `revalidatePath('/rounds/[id]')` after update
  - Never silently catches errors
- [ ] Edit form pre-populates all fields from the existing shot
- [ ] Save calls `updateShot`; success returns to round detail
- [ ] All six shot-entry components from P1-T5 are reused (not duplicated)

---

### P3-T4 — Delete round `todo`

**What:** Remove a round and all its shots.

**Acceptance criteria:**
- [ ] `actions/rounds.ts` exports `deleteRound(id: string): Promise<void>`
  - Cascades to shots via FK `ON DELETE CASCADE`
  - Calls `revalidatePath('/')` and `revalidatePath('/rounds')` after delete
- [ ] Delete button on round detail page shows a confirmation dialog (shadcn `AlertDialog`) before proceeding
- [ ] After deletion, redirects to `/rounds`

---

## Phase 4 — Logging UX Polish

Goal: 18 holes logged in under 5 minutes of tapping. Removes friction from Phase 1's functional-but-rough entry flow.

---

### P4-T1 — Per-hole summary card `todo`

**What:** After `result = 'Make'`, show a card with the hole's stats before advancing.

**Acceptance criteria:**
- [ ] Hole summary card appears automatically when the current shot's `result` is set to `Make`
- [ ] Card shows: strokes, putts (counted from current in-progress shot list), vs par, GIR (boolean), FW hit (par 4/5 only)
- [ ] "Next Hole" button advances to the next hole
- [ ] "Finish Round" button appears on hole 18 (or the last hole for Practice sessions) in place of "Next Hole"
- [ ] Card dismissable (in case player mis-tapped Make)

---

### P4-T2 — Preset yardage chips `todo`

**What:** Common yardage shortcuts per club to reduce stepper tapping.

**Acceptance criteria:**
- [ ] `lib/constants.ts` exports `CLUB_YARDAGE_PRESETS: Record<Club, number[]>` with 3–5 common yardages per club
- [ ] `YardageInput.tsx` renders preset chips above the stepper when a club is selected
- [ ] Tapping a chip sets the yardage value exactly; stepper still works for fine-tuning

---

### P4-T3 — Smart result chip ordering `todo`

**What:** Highlight the most likely result values based on club + shot context.

**Acceptance criteria:**
- [ ] `ResultChips.tsx` accepts `club`, `shotNo`, `par` and uses them to reorder/highlight chips:
  - Tee shot on par 4/5: Fairway, Rough highlighted first
  - Tee shot on par 3: Green, Rough highlighted first
  - Approach shot: Green, Rough highlighted first
  - Putter: Make highlighted first
  - OB / Hazard / Lost / Unplayable shown but de-emphasized (not hidden)
- [ ] "Highlighted" means visually distinct (filled vs outline), not hidden

---

### P4-T4 — Back / undo during entry `todo`

**What:** Let the player correct the previous shot without finishing the hole.

**Acceptance criteria:**
- [ ] "Undo Last Shot" button available any time `shot_no > 1` during a hole
- [ ] Undo calls `deleteShot` for the last saved shot and decrements the local shot counter
- [ ] `actions/shots.ts` exports `deleteShot(id: string): Promise<void>` with `revalidatePath` calls
- [ ] No undo available once the hole summary card is shown (Make was hit); player must edit from round detail instead

---

## Phase 5 — Summary Pages

Goal: full analytics surface. Every table in the Sheets prototype has a corresponding page.

---

### P5-T1 — Analytics: hole summary `todo`

**Acceptance criteria:**
- [ ] `lib/analytics/hole-summary.ts` exports `computeHoleSummary(holes: CompleteHole[])` returning one row per hole with all columns from the `Hole_Summary` sheet: rounds, avg score, best score, avg vs par, all-time vs par, FW%, GIR%, Scramble%, avg putts, 3-putt%, avg non-putt execution
- [ ] `__tests__/analytics/hole-summary.test.ts` with at least one `.gs`-verified row
- [ ] `npm test` passes

---

### P5-T2 — Analytics: club summary `todo`

**Acceptance criteria:**
- [ ] `lib/analytics/club-summary.ts` exports `computeClubSummary(shots: ShotRow[])` returning one row per club with all columns from the `Club_Summary` sheet: shots, avg quality, avg yds, FW%, Green%, miss directions, Bunker%
- [ ] Club order matches `CLUB_ORDER` in `.gs`
- [ ] Putter excluded (handled in distance summary)
- [ ] `__tests__/analytics/club-summary.test.ts` with at least one `.gs`-verified row
- [ ] `npm test` passes

---

### P5-T3 — Analytics: distance summary `todo`

**Acceptance criteria:**
- [ ] `lib/analytics/distance-summary.ts` exports `computeDistanceSummary(holes: CompleteHole[], shots: ShotRow[])` returning all five sub-tables from the `Distance_Summary` sheet:
  - Putting make rate by distance
  - First-putt performance
  - Around the green
  - Approaches
  - Putt miss patterns
- [ ] Bucket boundaries match SPEC.md exactly (upper-inclusive for putts, half-open lower for ATG/approach)
- [ ] `__tests__/analytics/distance-summary.test.ts` with at least one `.gs`-verified value per sub-table
- [ ] `npm test` passes

---

### P5-T4 — Hole Summary page `todo`

**Acceptance criteria:**
- [ ] `app/stats/holes/page.tsx` renders `computeHoleSummary` output as a sortable table
- [ ] Mobile-readable: horizontal scroll if needed rather than cramped columns
- [ ] Navigable from Dashboard

---

### P5-T5 — Club Summary page `todo`

**Acceptance criteria:**
- [ ] `app/stats/clubs/page.tsx` renders `computeClubSummary` output
- [ ] Clubs shown in `CLUB_ORDER` order
- [ ] Navigable from Dashboard

---

### P5-T6 — Distance Summary page `todo`

**Acceptance criteria:**
- [ ] `app/stats/distance/page.tsx` renders all five sub-tables from `computeDistanceSummary`
- [ ] Each sub-table has a visible section header
- [ ] Navigable from Dashboard

---

## Phase 6 — Historical Data Import

Goal: cut over from Sheets. All historical rounds migrated to Supabase. Analytics match.

---

### P6-T1 — Sheets export → SQL import script `todo`

**Acceptance criteria:**
- [ ] A script at `scripts/import-sheets.ts` accepts a CSV export of the Sheets `Shots` tab and outputs SQL `INSERT` statements
- [ ] Maps Sheets column names (`RoundID`, `Date`, `Hole`, `ShotNo`, etc.) to DB column names
- [ ] Maps legacy `session_type` values (e.g., `Full18`) to the D-03 enum values (e.g., `18 Holes`)
- [ ] Assigns all imported rows the hardcoded `user_id`
- [ ] Produces valid SQL that can be run via `psql` or Supabase SQL editor
- [ ] Script is idempotent (safe to run twice with `ON CONFLICT DO NOTHING`)

---

### P6-T2 — Analytics verification against `.gs` `todo`

**Acceptance criteria:**
- [ ] After import, run `computeDashboard`, `computeHoleSummary`, `computeClubSummary`, `computeDistanceSummary` against imported data
- [ ] Every numeric output matches the corresponding value in the Sheets prototype to within rounding (±0.01 for averages, exact for counts)
- [ ] Discrepancies documented and resolved before Phase 6 is marked done

---

## Phase 7 — PWA Polish

Goal: native-feeling app on iPhone home screen.

---

### P7-T1 — Service worker `todo`

**Acceptance criteria:**
- [ ] Service worker precaches the app shell (HTML, CSS, JS bundles)
- [ ] App loads from cache when offline (shell visible, data fetch may fail gracefully)
- [ ] No stale asset bugs on deploy — cache busted by asset hash

---

### P7-T2 — Install prompt `todo`

**Acceptance criteria:**
- [ ] A dismissable banner appears on first visit on mobile with instructions to add to home screen
- [ ] Banner does not reappear after dismissal (persisted in `localStorage`)
- [ ] Banner does not appear if app is already running in standalone mode

---

### P7-T3 — Touch target audit `todo`

**Acceptance criteria:**
- [ ] All interactive elements in the shot entry flow meet 44×44px minimum tap target (Apple HIG)
- [ ] No unintended horizontal scroll on 390px viewport
- [ ] Club selector, execution buttons, result chips all pass the tap-target check
