# Golf Tracker — Product & Technical Spec

## Goal
A mobile-first web app (PWA) for logging golf shots **after** a round and seeing strokes-gained-style analytics. Entry is retrospective — no GPS, no live tracking — designed so I can fly through 18 holes of shot logging in under 5 minutes of tapping. Single user (me) for now.

Origin: this replaces a Google Sheets prototype. The analytics logic in `docs/golf_stats.gs` is the source of truth for all aggregations.

## Out of scope (v1)
- Multi-user / signups (but the schema must support adding auth later)
- Social / sharing features
- A course library beyond Hayden Lake CC (the only course currently logged)
- Real-time / GPS entry

## Tech stack
- **Frontend**: Next.js (App Router) + TypeScript
- **Styling**: Tailwind + shadcn/ui
- **Backend**: Supabase (Postgres). **No auth yet**; every table has a `user_id` column defaulted to a hardcoded UUID, so Supabase Auth + Row Level Security can be bolted on later without schema migration
- **Hosting**: Vercel
- **Form factor**: mobile-first; installable as a PWA on iOS home screen

## Data model

### `rounds`
| column        | type        | notes |
|---------------|-------------|-------|
| id            | uuid        | PK |
| user_id       | uuid        | hardcoded default for now |
| date          | date        | |
| session_type  | text        | Full18 / Front9 / Back9 / Practice<N> |
| total_score   | int         | optional; derived from shots if absent |
| notes         | text        | optional |
| created_at    | timestamptz | default now() |

### `shots`
| column         | type        | notes |
|----------------|-------------|-------|
| id             | uuid        | PK |
| user_id        | uuid        | hardcoded default for now |
| round_id       | uuid        | FK → rounds.id |
| hole           | int         | 1–18 |
| par            | int         | 3, 4, or 5 |
| shot_no        | int         | 1 = tee shot |
| club           | text        | D, 3W, 5W, 3i…9i, PW, GW, SW, LW, Putter |
| yardage        | numeric     | distance to target; putts entered in **yards** (1 yd = 3 ft) |
| execution      | int         | 1–4 quality rating |
| result         | text        | Where the ball ended up: Fairway / Green / Rough / Bunker / OB / Hazard / Lost / Unplayable / **Make** (ball in hole) / blank |
| miss_direction | text        | Left / Right / Long / Short / blank |
| putt_side      | text        | High / Low / blank (putts only) |
| putt_length    | text        | Short / Long / blank (putts only; **material misses only**) |
| mulligan       | bool        | "wish I had this back" |
| penalty        | int         | penalty strokes incurred *on this shot* (typically 0 or 1; default 0) |
| notes          | text        | optional |
| created_at     | timestamptz | default now() |

## Bucket definitions (must match `docs/golf_stats.gs`)

**Putt buckets (feet) — upper-inclusive**: 0–3, 3–6, 6–10, 10–20, 20+

**Around-the-green buckets (yards) — half-open lower**: 0–10, 10–30

**Approach buckets (yards) — half-open lower**: 30–75, 75–125, 125–175, 175+

## Stroke-counting rule

The total strokes on a hole = `max(shot_no) + sum(penalty)`. Penalty strokes are stored on the *shot that caused them*, not as separate rows. Drops do not get their own row — the next sequential ShotNo is the recovery swing from the drop position. This keeps the original swing's data (club, execution, miss direction) intact, avoids inventing synthetic "penalty shot" rows, and means `max(shot_no)` equals the number of physical ball-strikes on the hole.

Example: OB tee shot on a par 5 →
- Row 1: D, exec 1, MissDirection Right, Result OB, Penalty 1
- Row 2: D (re-tee), exec 3, Result Fairway
- Row 3: LW, Green
- Rows 4–5: putts (last one Make)

Score on hole = 5 rows + 1 penalty = 6 (bogey).

## Strokes-lost attribution rule

For each complete hole:
1. `over = max(0, strokes - par)` *(strokes already includes penalties)*
2. `putting_lost = max(0, putts - 2)` — every putt beyond 2 is a putting stroke lost
3. `non_putting_lost = over - putting_lost`
4. If `par ≥ 4` AND tee shot has an explicit `miss_direction` AND `result != 'Fairway'` → charge to **Tee / Long Game**
5. Otherwise charge to **Approach / Short Game**

Penalties roll into `over` automatically, so an OB tee shot (Result=OB, MissDirection tagged) correctly charges its full cost to Tee/Long Game with no special-case logic.

## GIR computation
- The shot that puts the ball on the green is the first row with `result = 'Green'` (this is club-agnostic — a Texas wedge with the putter counts).
- If such a shot exists at shot G: `GIR = (G + penalties_through_shot_G) ≤ par−2`
- If no shot has `result = 'Green'` (chip-in / hole-out): `GIR = strokes ≤ par−2` (penalties already baked into `strokes`)

## Putt counting
- "Putts on the hole" = strokes played with the ball already on the green, i.e. `start_lie = 'Green'`. This is **club-agnostic** (PGA-Tour definition): a putter used from the fringe/fairway is **not** a putt, and a stroke from the green is one even with a non-putter. See D-12.
  - *Legacy fallback* (rows logged before lie capture, `start_lie` null): a Putter row whose own `result` is not `'Green'` — the shot that *reaches* the green (a Texas wedge) is tagged `'Green'` and excluded.
- "Make rate by distance" includes every Putter row, regardless of whether the ball was on the green — but a Texas wedge from 30 yards rarely goes in, so it just naturally appears as a low-make-rate long-distance Putter shot.

## Conventions

- **Complete hole**: counts only if the highest-`shot_no` row has `result = 'Make'`. Partial holes are excluded from all aggregates.
- **Putt yardage**: entered in yards; ×3 for bucketing in feet.
- **Material misses only**: PuttSide / PuttLength tagged only when the miss is *material*. Anything inside a 3-foot gimme circle is left blank, even if technically slightly long/short/high/low.
- **Mulligan**: user-flagged, retrospective judgment. A shot you'd materially redo if given another chance.
- **Penalty strokes**: stored on the offending shot via the `penalty` column. The `result` column records what happened (`OB`, `Hazard`, `Lost`, `Unplayable`). Provisional balls are not tracked — if the provisional ends up in play, log it as the actual ball; otherwise drop it.
- **Result column = lie outcome**: `result` describes where the ball ended up, not what the swing looked like. Direction is captured separately in `miss_direction`. Bunker is a `result` value, not its own column. `Rough` is the catch-all for "missed the fairway / off the green but nothing dramatic." Leaving blank is allowed for backward compatibility but new shots should pick a value.

## UI screens (v1 scope)

1. **Shot Entry** — mobile-first tap flow. One screen per shot. Big tap targets for club selection; numeric stepper / preset chips for yardage; 1–4 buttons for execution; result chips; miss-direction chips (conditional on miss). Swipe (or tap "next") to advance. Per-hole summary screen at end of each hole.
2. **Dashboard** — mirrors the Dashboard tab in the prototype: Snapshot, Stat Line, Strokes Lost, What to Work On, Recent Rounds, Course Records, Mulligans.
3. **Round browser** — list of rounds, newest first; tap a round to see all shots in that round, with edit affordance.
4. **Hole / Club / Distance summaries** — three separate pages, mirroring the existing summary tabs.

## Future (post-v1; design should accommodate, not implement)
- Supabase Auth (email or Google) — schema already has `user_id`
- Multiple courses
- Voice-to-shot entry (dictate the round, parse into rows)
- Practice session tracker (range, putting green) separate from round shots
