# Golf Tracker — Product Requirements Document

> Companion document to `SPEC.md` (technical reference) and `golf_stats.gs` (analytics source-of-truth). This PRD describes *what* the app does and *why*. SPEC.md describes *how*.

## 1. Purpose

A mobile-first web app for a scratch golfer who plays the same course (Hayden Lake CC) over and over and wants to know — with real data — what is actually costing him strokes. Existing golf-tracking apps (Arccos, 18Birdies, etc.) assume GPS, live in-round entry, and either expensive sensor hardware or aggressive battery use. None of that is wanted here.

Instead, this app does retrospective shot logging: after the round is over, the player taps through every shot they remember (which, for a course they know cold, is all of them) and gets back a strokes-gained-style breakdown that tells them where to spend their next practice session.

The Google Sheets prototype the app replaces is functional but slow to enter data into. The point of the app is to make logging 18 holes take under 5 minutes of tapping, and to surface analysis on a mobile device the player already has in their pocket.

## 2. Users

**v1: one user (Matt).** No accounts, no signup flow, no auth screen. Every database row carries a `user_id` column defaulted to a hardcoded UUID, so Supabase Auth + Row Level Security can be added later without a schema migration.

**Future users (post-v1): any serious golfer who wants precise, retrospective analytics on a course they play often.** The single-course assumption matters less than the retrospective-entry assumption — the player needs to remember their shots well enough to log them, which favors people who play the same course repeatedly and care about their stats.

## 3. Design principles

What makes this app different from existing golf apps:

- **Retrospective, not real-time.** No GPS, no in-round entry, no live shot tracking. You log after the round.
- **Fast tap flow.** The mobile UI is optimized for one-handed entry while sitting in the clubhouse or driving home. Big tap targets, smart defaults, minimal typing.
- **Honest analytics, not vanity stats.** Strokes-gained-style breakdowns that point at the weakest part of the game, not a feed of "you played a great round."
- **Execution ratings substitute for shot-tracking hardware.** Every shot gets a 1–4 quality rating from the player. This is subjective but consistent enough over time to surface patterns ("my 6-iron averages 2.25 across 4 shots") that hardware-free apps can't surface.
- **The data model is the source of truth.** Every aggregate is recomputed from the raw shot rows. No cached scores that can drift.
- **Single course, but extensible.** v1 is Hayden Lake CC only. The data model doesn't bake the course in — it's a future field on `rounds`.

## 4. Feature inventory

Everything currently in the Google Sheets prototype that needs to exist in the app.

### 4.1 Data capture

**Round-level entry:**
- Date
- Session type: `Full18` / `Front9` / `Back9` / `Practice<N>`
- Notes (free text)
- Total score is *derived* from the logged shots; not entered manually

**Shot-level entry (one row per ball-strike):**
- Hole number (1–18)
- Par (3, 4, or 5)
- Shot number within the hole (1 = tee shot)
- Club: D, 3W, 5W, 4i, 5i, 6i, 7i, 8i, 9i, PW, GW, SW, LW, Putter
- Yardage (distance to target; putts entered in yards, where 1 yd = 3 ft)
- Execution rating: 1 (bad), 2 (okay), 3 (good), 4 (excellent)
- Result: `Fairway` / `Green` / `Rough` / `Bunker` / `OB` / `Hazard` / `Lost` / `Unplayable` / `Make` / blank
- Miss direction: `Left` / `Right` / `Long` / `Short` / blank
- Putt side (putts only): `High` / `Low` / blank — material misses only
- Putt length (putts only): `Short` / `Long` / blank — material misses only
- Mulligan flag: "I'd materially redo this shot if given another chance"
- Penalty strokes: integer count on the offending shot (typically 0 or 1)
- Notes (free text)

### 4.2 Core conventions

These are baked into the analytics. Changing any of them requires updating both the spec and the code in lockstep.

- **Complete hole.** A hole is included in aggregates only if the highest-ShotNo row has `Result = Make`. Partial holes are excluded from every stat.
- **Stroke count.** `strokes = max(ShotNo) + sum(Penalty)`. Drops do not get their own row.
- **Putt yardage in yards.** Multiplied by 3 to bucket in feet.
- **Material misses only.** PuttSide / PuttLength are tagged only when the miss is materially long/short or materially off-line. Anything inside a roughly 3-foot gimme circle is left blank.
- **Penalty on offending shot.** When a tee shot goes OB or in a hazard, the bad shot's row carries `Result=OB` (or Hazard, etc.) and `Penalty=1`. The next sequential ShotNo is the recovery swing from the drop position.
- **Result=Green means "ball arrived on green and stayed there."** This is the canonical signal that the ball is on the putting surface. It's club-agnostic — a Texas wedge with the putter that lands on the green is tagged `Result=Green`. Subsequent on-green putts have blank Result (or `Make` if holed).
- **Result=Make means "ball ended in the hole."** A made putt has `Result=Make`. A holed chip from off-green has `Result=Make` (no separate Green tag — the ball didn't come to rest on the green).
- **Mulligan is retrospective and personal.** It's the player's judgment, after the round, that they'd redo that swing.

### 4.3 Calculations and formulas

**Bucket definitions:**

| Bucket type | Boundaries | Inclusivity |
|---|---|---|
| Putts (feet) | 0–3, 3–6, 6–10, 10–20, 20+ | upper-inclusive |
| Around-the-green (yards) | 0–10, 10–30 | half-open lower |
| Approaches (yards) | 30–75, 75–125, 125–175, 175+ | half-open lower |

**Per-hole derived stats:**
- `strokes = max(ShotNo) + sum(Penalty)`
- `putts` = count of Putter rows that occur *after* the first `Result=Green` shot (a Texas wedge is not a putt)
- `gir` (Green in Regulation):
  - If a shot has `Result=Green` at ShotNo G: `gir = (G + penalties_through_G) ≤ par − 2`
  - Otherwise (chip-in / hole-out with no green-touching shot logged): `gir = strokes ≤ par − 2`
- `fw_hit` (par 4/5 only): tee shot has `Result=Fairway`
- `scrambled` = GIR missed but `strokes ≤ par`
- `tee_miss_tagged` = tee shot has a non-blank `MissDirection`

**Strokes-lost attribution (per hole):**
1. `over = max(0, strokes − par)`
2. `putting_lost = max(0, putts − 2)`
3. `non_putting_lost = over − putting_lost`
4. If `par ≥ 4` AND `tee_miss_tagged` AND `Result ≠ Fairway` on the tee shot → charge `non_putting_lost` to **Tee / Long Game**
5. Else → charge `non_putting_lost` to **Approach / Short Game**

Penalties roll into `over` automatically because they're added to `strokes`. An OB tee shot with `Result=OB`, `MissDirection=Right`, `Penalty=1` correctly attributes its full cost to the Tee bucket with no special-case logic.

### 4.4 Aggregated views (what the app surfaces)

**Hole Summary** (one row per hole, across all rounds):
- Rounds played, avg score, best score, avg vs par, all-time vs par
- FW%, GIR%, Scramble%
- Avg putts, 3-putt%
- Avg non-putt execution quality

**Club Summary** (one row per club used):
- Shots, avg execution, avg yards
- FW% (tee shots only), Green% (approaches only)
- Miss-direction breakdown: L%, R%, Long%, Short%
- Bunker%

**Distance Summary** (sub-tables, all bucket-based):
- Putting make rate by distance (every Putter shot, including Texas wedges)
- Putting first-putt performance: faced, avg putts to finish, 1-putt%, 3-putt%
- Around the green (under 30 yd, non-putt): shots, quality, on-green%, up-and-down%
- Approach shots (30+ yd, includes par 3 tees): shots, quality, green-hit%, miss directions
- Putt miss patterns: misses, High%, Low%, Short%, Long% by distance bucket

**Dashboard** (the home page):
- **Snapshot:** rounds logged, holes logged, total vs par, avg vs par per round, per hole
- **Stat line:** FW%, GIR%, Scramble%, avg putts per hole, 3-putt%
- **Strokes Lost by Category:** Tee/Long Game, Approach/Short Game, Putting — with stroke count and % of total
- **What to Work On:** worst hole, worst approach distance bucket, worst putt distance bucket, worst club (min 3-shot sample)
- **Recent Rounds:** last 5 rounds with date, holes, strokes, par, vs par
- **Shots You'd Take Back (Mulligans):** total, per-round average, breakdown by category, recent list
- **Course Records:** best/worst round vs par, best hole all-time vs par, total birdies, total eagles or better

## 5. Data model

Two tables. Both have `user_id` from day one for future auth.

### `rounds`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | hardcoded default for v1 |
| `date` | date | round date |
| `session_type` | text | `Full18` / `Front9` / `Back9` / `Practice<N>` |
| `notes` | text | optional |
| `created_at` | timestamptz | default now() |

### `shots`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | hardcoded default for v1 |
| `round_id` | uuid | FK → `rounds.id` |
| `hole` | int | 1–18 |
| `par` | int | 3, 4, or 5 |
| `shot_no` | int | 1 = tee shot |
| `club` | text | enum of clubs above |
| `yardage` | numeric | distance to target; putts in yards |
| `execution` | int | 1–4 |
| `result` | text | enum from §4.1 |
| `miss_direction` | text | enum from §4.1 |
| `putt_side` | text | High / Low / blank |
| `putt_length` | text | Short / Long / blank |
| `mulligan` | bool | default false |
| `penalty` | int | default 0 |
| `notes` | text | optional |
| `created_at` | timestamptz | default now() |

**No `total_score` column on rounds.** Score is always derived from shots. (The Sheets prototype had it; it caused drift.)

**No separate `holes` or `courses` table in v1.** Par lives on the shot row. When a second course is added (post-v1), normalize then. The migration is small.

## 6. User workflows

### Workflow A: Log a round (primary, most-used)

1. Open the app on phone (or installed PWA on home screen).
2. Tap **New Round.** Default date is today; tap to change. Pick session type (default Full18). Optional notes.
3. For each hole:
   - The current hole + par is shown at the top of the screen
   - Tap **Add Shot.** Big tap targets for club selection. Driver and Putter are visually prominent.
   - Yardage: numeric stepper for fine control, plus preset chips for common distances per club
   - Execution: four big buttons labeled 1 / 2 / 3 / 4
   - Result: chip selector with the 9 values from §4.1; only the ones likely-relevant for the club+shot context are highlighted (e.g., a tee shot on a par 4 doesn't highlight `Make`)
   - Miss direction: chips appear only if Result implies a miss
   - For putts: PuttSide and PuttLength chips appear; both default blank ("material miss only")
   - Mulligan: toggle (off by default)
   - Penalty: auto-set to 1 if Result is OB / Hazard / Lost / Unplayable; manually overridable
   - Tap **Next Shot** or swipe right
   - When the hole's last shot is `Result=Make`, the app auto-advances to a **per-hole summary card** (strokes, putts, GIR, fairway hit) and a **Next Hole** button
4. After hole 18 (or earlier if Front9/Back9), submit the round. Round is now visible in Recent Rounds and contributes to all aggregates.

**Target: 18 holes logged in under 5 minutes of tapping.**

### Workflow B: Browse stats

1. Dashboard opens by default. Snapshot, stat line, strokes lost, what to work on — all visible without scrolling on a typical phone.
2. Scroll for Recent Rounds, Mulligans, Course Records.
3. Tap into **Hole Summary**, **Club Summary**, or **Distance Summary** for the deeper cuts.
4. Tap any round in Recent Rounds to see all the shots from that round.

### Workflow C: Edit a past round

1. From the round detail view, tap any shot to open its edit form.
2. Change any field. Save.
3. All aggregates recompute automatically (database trigger, materialized view refresh, or on-demand query — TBD by Claude Code during build).

## 7. Out of scope for v1

These are explicitly *not* being built in v1, even though they're interesting and the data model accommodates several of them:

- **Auth, accounts, signup, login.** Hardcoded user. Schema already supports adding it later.
- **Multiple courses.** Hayden Lake CC only. Par lives on the shot row.
- **Social, sharing, multiplayer.** No friends, no leaderboards, no sharing.
- **Live / in-round entry.** Retrospective only.
- **GPS or distance measurement.** Yardage is entered by the player.
- **Practice session tracker.** Range and putting-green practice are not modeled separately. `session_type` allows `Practice<N>` but the analytics treat practice as just another round.
- **Voice-to-shot entry.** "Driver to fairway, eight-iron to green, two putts" parsed into rows — interesting, deferred.
- **Visual tap-on-target shot entry.** The concentric-rings / quadrant tap UI that mimics the analog yardage book — designed for, but not built in v1.
- **Hardware integrations.** No Arccos, no Garmin sync, no putter sensor.
- **Native mobile apps.** PWA only. Installs to home screen on iOS / Android.
- **Offline support beyond basic PWA caching.** Sync issues, conflict resolution, queueing while offline — not v1.

## 8. Tech stack

The recommended stack, with reasoning.

### Frontend
- **Next.js (App Router) + TypeScript.** Server components for fast initial loads, client components for the tap-heavy entry flow. Strict typing keeps shot-data validation honest.
- **Tailwind CSS + shadcn/ui.** Tailwind for utility-first styling that's fast to iterate on. shadcn for pre-built, accessible components (selects, dialogs, toasts) without locking into a heavy component library.
- **React Hook Form + Zod.** Forms with schema-based validation. The Zod schemas can live in a shared `/lib/schemas` folder and be reused on the server side.
- **TanStack Query (React Query).** Server-state management. Caches, invalidates on mutations, handles loading and error states cleanly.

### Backend
- **Supabase (Postgres).** Single backend service for database, auth (when we add it), and storage. Direct SQL for analytics queries. Row-Level-Security ready when auth lands.
- **Database migrations as SQL files** in `/supabase/migrations`. Version-controlled, reviewable, replayable.
- **Aggregations: SQL views (or RPC functions) over the raw `shots` table.** No caching layer in v1 — the read volume is one user, low frequency. If performance ever matters, add materialized views and refresh on shot insert/update.

### Hosting & deployment
- **Vercel** for the Next.js frontend. Preview branches per pull request, instant production deploys on merge to main.
- **Supabase managed Postgres** — no infrastructure to run.

### Form factor
- **Mobile-first responsive design.** All flows assumed-mobile by default. Desktop layout is a stretched version of mobile, not a separate design.
- **PWA.** `manifest.json`, service worker for offline-friendly caching of the shell. Installable to iOS home screen.

### Why this stack
- **Tight feedback loop:** Vercel preview deployments per PR mean Matt can test on his phone within seconds of a code change.
- **Single language end-to-end:** TypeScript on the client, TypeScript-friendly schemas (Zod) for validation, plain SQL on the backend.
- **Cheap to operate:** Vercel hobby + Supabase free tier covers single-user use indefinitely.
- **Easy to hand off:** if Matt ever wants help building a feature, this stack has the largest possible pool of developers who know it.
- **Future-proof for auth:** Supabase Auth + RLS slots into the existing schema without migration.

## 9. Success criteria for v1

The app is "done with v1" when:

1. Matt can log a full 18-hole round on his phone in under 5 minutes of tapping.
2. Every calculation currently in `golf_stats.gs` is reproduced in the app, with matching numbers when fed the same shot data.
3. The Dashboard is the home screen and shows Snapshot + Stat Line + Strokes Lost + What to Work On without scrolling on a typical phone.
4. He can edit any past shot, and aggregates update.
5. The data lives in Supabase, not in a spreadsheet.
6. The app is installable as a PWA on his iPhone home screen.

## 10. Relationship to existing artifacts

- `SPEC.md` — technical reference. Data model, conventions, formula definitions. Treated as canonical alongside this PRD.
- `golf_stats.gs` — current source-of-truth for all analytics logic. Any port to TypeScript must produce the same numbers across the existing logged rounds.
- Google Sheets prototype — frozen at the point of app launch. The first real round logged in the app is the cut-over. Historical Sheet data may be imported via a one-time SQL migration script (build time).
