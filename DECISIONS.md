# Architecture Decisions

Locked decisions for the golf tracker. Do not re-open without an explicit conversation. Each decision has a number so it can be cited in code comments and TODOs.

---

## D-01 — No `total_score` on `rounds`

The `rounds` table has no `total_score` column. Score is always derived from the `shots` table at query time via `max(shot_no) + sum(penalty)` per hole.

**Why:** The Sheets prototype had a cached `total_score` and it drifted from the actual shot data. The app must never have two sources of truth for the same number.

**What this means in practice:** No `total_score` field in `RoundInsert`, `RoundRow`, or any Zod schema. Any component that needs a round score must derive it. The SPEC.md still lists `total_score` — SPEC.md is wrong; this decision file wins.

---

## D-02 — Club validation in Zod only; no DB `CHECK` constraint

The `club` column on `shots` has no `CHECK` constraint in Postgres. Valid clubs are enforced by the Zod schema in `lib/schemas/shot.ts` only.

**Why:** The player's bag changes. Adding a new club must be a code deploy (edit the Zod enum), not a DB migration. A Postgres `CHECK` constraint would require a migration every time the bag changes.

**What this means in practice:** The Zod `ShotInsert` schema owns the club enum. The DB accepts any non-null text for `club`.

---

## D-03 — `session_type` is a four-value Zod enum; DB stores short keys

DB values (what is stored in Postgres): `Full18`, `Practice9`, `Practice6`, `Practice3`. No free text. Enforced by Zod; no DB constraint.

UI display labels are mapped from DB values in `lib/constants.ts`:
```
Full18    → "18 Holes"
Practice9 → "Practice 9"
Practice6 → "Practice 6"
Practice3 → "Practice 3"
```

**Why:** Short DB keys are easier to match in analytics queries and match the Sheets prototype's `Full18` value exactly, eliminating remapping in the P6-T1 import script. Display labels are separate concerns and belong in the UI layer.

**What this means in practice:** The `rounds` table accepts any text for `session_type` at the DB level. The Zod `RoundInsert` schema restricts it to the four DB key values. UI components import `SESSION_TYPE_LABELS` from `lib/constants.ts` — never hardcode display strings inline.

---

## D-04 — GIR fallback for legacy data is included in the TypeScript port

`strokesToReachGreen()` in `lib/analytics/core.ts` must implement the same three-path fallback as `golf_stats.gs`:

1. **Primary:** first shot with `result = 'Green'` → `shot_no + penalties_through_that_shot`
2. **Fallback A (legacy untagged):** if no `Green` shot exists, find the shot before the first Putter (but only if that Putter's result is not `Make`) → `(firstPutter.shot_no - 1) + penalties_before_first_putter`
3. **Fallback B (chip-in / hole-out):** no Putter at all, or the first Putter holed out from off-green → `strokes` (total)

**Why:** Existing Sheets data has rounds where approaches weren't tagged `Green`. The fallback keeps those rounds correct in the analytics.

**What this means in practice:** The TypeScript function must match the `.gs` output exactly on all existing data. Tests must cover all three paths.

---

## D-05 — Analytics computed in TypeScript; no SQL views

All aggregations live in `lib/analytics/`. The pattern is: fetch raw `shots` rows (joined with round metadata) from Supabase, pass the array to analytics functions, render the results.

**Why:** The `.gs` logic uses multi-pass computation, sorted arrays, and per-hole grouping that is complex to express correctly in SQL. TypeScript is easier to verify against the `.gs` source of truth.

**Constraint:** `lib/analytics/` must have zero Supabase imports. Functions accept plain typed arrays only. This makes them independently testable without a DB connection.

**What this means in practice:** Dashboard and summary pages are React Server Components that call `lib/db/` to fetch, then pass data to `lib/analytics/`. SQL views are deferred indefinitely.

---

## D-06 — "Up and down" definition matches `.gs` exactly

A shot counts as "up and down" if and only if:
- The shot itself has `result = 'Make'` (chip-in), OR
- The immediate next shot is a Putter with `result = 'Make'` (chip to a makeable putt, one-putted)

A chip that leaves a two-footer, which is then holed, does NOT count. The check is `shots[i+1]` only — no lookahead beyond one.

**Why:** This matches the `.gs` implementation. Changing the definition mid-season would break continuity with historical data.

---

## D-07 — "Best Hole" on the Dashboard is cumulative vs-par, not single best score

The "Best Hole" in the Course Records section of the Dashboard is the hole with the lowest total `(strokes - par)` summed across all logged rounds — i.e., the hole where the player consistently plays best.

It is NOT the single lowest score ever recorded on any hole.

**Why:** Cumulative vs-par identifies a genuinely strong hole in your game. Single best score is a one-time outlier (a lucky eagle on a hole you usually bogey).

---

## D-08 — Practice rounds count in all analytics

Rounds with `session_type` of `Practice9`, `Practice6`, or `Practice3` are not filtered out of any aggregation. They contribute to hole stats, club stats, strokes lost, everything.

**Why:** Per PRD §7, "the analytics treat practice as just another round." This is intentional.

**Known implication:** A player who practices the back nine every Tuesday will have inflated round-count for holes 10–18. This is a known, accepted trade-off.

---

## D-09 — Postgres trigger enforces `par` consistency within a hole

A `BEFORE INSERT OR UPDATE` trigger on `shots` rejects any insert where the `par` value differs from existing shots on the same `(round_id, hole)`.

**Why:** `par` is redundant across all shots on the same hole. A fat-finger typo would create an inconsistency that silently corrupts GIR and strokes-lost attribution. The trigger catches this at write time.

**What this means in practice:** The trigger is in `supabase/migrations/003_par_consistency_trigger.sql`. Server actions that create shots will surface a DB error if par is inconsistent — this error must not be caught silently (see hard rule on error handling).

---

## D-10 — No offline entry in v1

The app requires a live network connection to save shots. There is no offline queue, no local draft, and no sync mechanism. This is explicitly out of scope for v1.

**Known implication:** If the player loses cell service during a round, they cannot log shots until connectivity is restored. Acceptable for v1.

**Revisit:** Post-v1, after the core analytics are proven.

---

## D-11 — PGA Tour benchmark columns are static band averages, not per-distance figures

The Distance Summary screen shows a static "Tour" column next to make%, 1-putt%, 3-putt%, up-and-down%, and GIR%, sourced from constants in `lib/benchmarks.ts` (keyed by the exact `PUTT_BUCKETS` / `ATG_BUCKETS` / `APPROACH_BUCKETS` labels). The analytics layer (`distanceSummary.ts`) attaches them as optional `tour*` fields on the relevant rows, so `DataTable`'s serializable columns can read `row[key]` directly (no render fns). The layer stays pure — constants only, no Supabase.

Tour data is published per single distance, but our tables bucket into ranges, so each value is a **representative band average**, not an exact figure. Source: ShotLink / Mark Broadie, "Every Shot Counts".

**Why:** Gives the player "what good looks like" context, like PGA broadcasts. Static constants avoid a data pipeline for figures that move only marginally year-to-year.

**Excluded:** No benchmark on the Miss Patterns table — there's no meaningful tour analogue for a player's own miss-direction distribution.

---

## D-12 — A putt is defined by lie (on the green), not by club

`isRealPutt` (`lib/analytics/core.ts`) counts a stroke as a putt iff it was played from `start_lie = 'Green'` — the PGA-Tour definition, **club-agnostic**. A putter used from the fringe/fairway is **not** a putt; a stroke played from the green is, even with a non-putter. This feeds putt totals, 3-putt rate, and the first-putt-performance table; it does **not** touch the make-rate-by-distance table, which intentionally includes every Putter row (`club = 'Putter'`).

Supersedes the old club+result proxy (Putter whose own `result ≠ 'Green'`), which both miscounted a putter played from off the green *as* a putt and dropped on-green putts whose `result` was tagged `'Green'`. The proxy survives only as a **fallback for legacy rows with a null `start_lie`** (lie was "captured going forward" — see Option A in `constants.ts`).

**Back-fix:** none needed. Analytics are pure functions over raw shots, recomputed per request, and `start_lie` is fully populated in the live data — so every historical round recounts correctly on deploy. Measured impact on current data: total putts 328→335, 3-putt holes 10→9, 13 holes recount.

**Why:** Matches how the SG layer already categorises Putting (`categoryOf`: `lie === 'Green'`), so putt-counting and SG now share one definition; matches the PGA Tour; and fixes a user-visible inflated 3-putt rate.

---

## D-13 — `session_type` removed from round entry; `starting_hole` added (amends D-03)

The New Round form no longer asks "Session" (`Full18` / `Practice9` / `Practice6` / `Practice3`). The player declares a **`starting_hole`** (1–18, default 1) instead — the hole they tee off on. This is the smallest safe change ("Option A" in the design handoff): the field is removed from the **UI only**; the column and the four-value enum stay at the data layer.

**Why:** `session_type` asked the player to predict their round before hitting a shot, and no analytics branch on it (D-08: practice rounds are never filtered). `starting_hole` answers a question the player actually knows at tee-off and supports shotgun / mid-course starts.

**`starting_hole` semantics:** it is a **start position, not a hole count**. Round length stays derived from logged shots (D-01) — the log already treats holes as independent units with a free jump-to-any-hole strip, `pickUpHole`, `clearHole`, and an always-present **Done**. The only behavioural wire is seeding the opening hole from `starting_hole` in `ShotEntryFlow` (first unfinished hole at/after `starting_hole`, else first unfinished, else `starting_hole`).

**What this means in practice:**
- Schema: `starting_hole: z.coerce.number().int().min(1).max(18).default(1)` added to `RoundInsertSchema`. Migration `015_add_starting_hole.sql` adds `int not null default 1` (no backfill — existing rounds default to hole 1). No DB `CHECK` (validation in Zod, per the project pattern).
- `session_type` stays in `RoundInsertSchema` and is written silently as `"Full18"` from the form's `defaultValues`. **`RoundRowSchema` is untouched**, so existing readers — the rounds-list `SESSION_TYPE_LABELS` sub-label and the no-course `SESSION_HOLE_COUNTS` log fallback — keep working unchanged. D-03's stored values and labels still stand.
- Tee now defaults to the **Blue** tee (was: none).

**Deferred (Option B, not done here):** dropping `session_type` from the data — relaxing `RoundRowSchema` to `z.enum(SESSION_TYPES).nullable()`, making the column nullable, and updating the two readers. Out of scope so nothing downstream can break.
