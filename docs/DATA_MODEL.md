# Golf Tracker — Data & Analytics Reference

A complete, accurate snapshot of the app's data model and analytics, pulled from
the code. Intended as a shareable reference for strategy work on what data we
collect and how we display it.

> Keep this current when the schema, entry flow, or analytics change.

---

## 1. What the user inputs

### Per round (once)
- **Date**, **Session type** (`18 Holes` / `Practice 9` / `Practice 6` / `Practice 3`), optional **Notes**, optional **Course**, optional **Tee**.

### Per shot (the core loop)
Entered via a wizard, one shot at a time. Fields collected:

| Field | Values | When asked |
|---|---|---|
| **Club** | D, 3W, 5W, 4i–9i, PW, GW, SW, LW, Putter | Always |
| **Start lie** | Tee, Fairway, First cut, Rough, Fairway bunker, Greenside bunker, Sand, Recovery, Fringe, Green, Native | Auto-carried forward from previous shot's finish; one tap to override |
| **Distance to hole** | yards (putts entered in **feet**, stored as yards = ft/3) | Always, **except skipped** for a tee shot with D/3W/5W on a par 4/5. The entry header shows the hole's tee yardage (from the round's tee) as reference, e.g. "Par 4 · 354 yd". |
| **Strike quality** | 1 Bad / 2 Okay / 3 Good / 4 Great | Every full shot; optional on putts |
| **Result** | Fairway, Green, Fringe, Rough, Bunker, Recovery, OB, Hazard, Lost, Unplayable, Make | Always (full shots) |
| **Shot shape** | Slice / Fade / Straight / Draw / Hook | Optional, full shots only. Dedicated **shape step** after strike quality. |
| **Shot contact** | Thin / Chunk | Optional, full shots only. Same step as shape; orthogonal axis (a shot can be a fat pull). |
| **Miss direction** | Left / Right / Long / Short | Only if result ∈ {Rough, Bunker, Recovery, OB, Hazard, Lost, Unplayable} |
| **Decision quality** | Good / Bad (default Good) | One-tap toggle on the result step (full shots); putts default Good. Flag Bad only for a process error (risk / club / line / commitment) — spec 1A |
| **Penalty** | integer (auto +1 for OB/Hazard/Lost/Unplayable) | Automatic |

### Putt sub-flow (club = Putter)
- **Distance** in feet → **Holed** or **Missed**. If missed: **Side** (High/Low) + **Length** (Short/Long), then repeat for next putt.

### Conditional logic worth knowing
- **OB / Lost = "stroke and distance"**: +1 penalty, next shot replays from the *same lie* (re-tee stays "Tee").
- **Green** result → jumps straight into the putt sub-flow.
- **Make** → hole complete. A hole "counts" only when its last shot = Make.
- Holes can be **picked up / conceded** (flagged, excluded from scoring).

### Course setup data (optional, entered once)
- Per hole: **par**, **handicap index**; per side: **hole trouble** (None/Trees/Rough/Bunker/Water/OB/Native). Per tee: **yardage per hole** (used to fill tee-shot distance for SG when the wizard skipped it).

---

## 2. Derived per-hole values (the basis for everything)
- **strokes** = max(shot_no) + Σ penalties
- **putts** = count of shots played from `start_lie = Green` ("real putts"; club-agnostic, D-12). Legacy rows with a null lie fall back to Putter-rows-whose-result-≠-Green.
- **strokes-to-reach-green** = (1) shot_no of first `Green` result + penalties through it; else (2) firstPutter.shot_no − 1 + penalties before it; else (3) total strokes
- **GIR** = strokes-to-reach-green ≤ par − 2
- **tee result** = result of shot 1; **fairway hit** = par≥4 and tee result = Fairway
- **scramble** = (GIR missed) and strokes ≤ par
- **3-putt** = putts ≥ 3
- **shot quality** = mean execution across non-putter shots

---

## 3. What the app displays

### Dashboard (`/`)
Top-to-bottom **answer order** (spec Part 3), then reference cards:
1. **Scoring shape**: hole-outcome distribution (eagle+/birdie/par/bogey/double+) with scratch target rates and the headline **birdie − double+** net. Tails first.
2. **Where strokes are lost**: the four SG categories ranked by recoverable/round (worst first), each vs the scratch target (0); links to the SG page.
3. **Decision vs execution**: of lost strokes, decision-loss (Bad → thinking) vs execution-loss (Good → practice) — shared with the SG page.
4. **What to work on**: the ranked leak list (`lib/analytics/leaks.ts`) — approach/putt/around-green buckets + clubs by recoverable/round, each row drillable to its qualifying shots; sample-gated (below threshold → "early read", never prescribed).
- **Snapshot**: rounds logged, holes logged, total vs par, avg vs par / round, avg vs par / hole *(complete holes only)*.
- **Stat line**: FW% (par 4/5 only), GIR%, Scramble%, avg putts, 3-putt%.
- **Recent rounds**: last 5 (date, holes, strokes, vs par).
- **Records**: best/worst round (by vs par), best hole (lowest cumulative vs par), birdie count (=par−1), eagle+ count (≤par−2).

### Strokes Gained (`/stats/sg`)
- Per-shot: **SG = E[start_lie, start_dist] − E[finish] − 1 − penalty**, where E[finish]=0 if holed, else E[next shot's start]. A shot is "covered" only if both ends resolve to a baseline (missing distance drops the shot *and* its predecessor's finish term).
- **Baseline** = Mark Broadie's published **scratch (0-handicap)** expected-strokes tables (piecewise-linear interpolated), behind a swappable `Baseline` interface (`activeBaseline` in `sg-baseline.ts`; seam for the future self-baseline blend). 0 = played like a scratch golfer; negative = below that standard. Putting table matches the spec's scratch make-rate anchors; long-game tables are the scratch level. Lie→table map: Tee→Tee; Fairway/First cut/Fringe→Fairway; Rough→Rough; Sand/both bunkers→Sand; Recovery/Native→Recovery; Green→Green (feet).
- Outputs: **total SG**, **SG per round**, and per **category** (SG, SG/round, shots): *Off the tee* (Tee & par≥4), *Approach*, *Short game* (≤30y, or sand ≤50y), *Putting* (Green). Plus **biggest leak** (most-negative category), covered/total shot count, and a **decision/execution split** (spec 2E): lost strokes (negative SG) partitioned by `decision_quality` into a decision-loss pool (Bad → fix by thinking) and an execution-loss pool (Good → fix by practice), with each pool's share of total loss.

### Holes (`/stats/holes`)
- **Cost by hole** (spec Part 3 "killer screen", `lib/analytics/holeAttribution.ts`): per hole, ranked worst-first — avg score, cost/round vs par, total SG/round, and the **per-hole SG breakdown** (tee/approach/short/putt) with each losing category's share. Drillable. Score average + SG are over the same complete-hole set.
- **Per-hole table**: par, rounds, avg score, best, avg vs par, all-time cumulative vs par, FW%, GIR%, scramble%, avg putts, 3-putt%, shot quality. (+ count of excluded incomplete holes.)

### Clubs (`/stats/clubs`) — every shot, Putter excluded
shots, avg quality, avg yards, FW% (par4/5 tee shots), green% (approaches), miss L/R/Long/Short %, bunker%.

### Shape & Contact (`/stats/shape`) — tendencies by club category
Clubs roll up into **Driver / Woods / Long iron / Short iron / Wedge** (`clubCategory`, pattern-based so it survives bag edits). Per category: a left→right dispersion bar (Hook · Draw · Straight · Fade · Slice) over **tagged** shots, the **one-way vs two-way miss** read (with an aim-away suggestion), Thin/Chunk contact rates, and the tagged `n`. Rates are over tagged shots only (blank ≠ flush); sample-gated as "early read" below 15 (`lib/analytics/shotShape.ts`).

### Distance (`/stats/distance`) — five tables
1. **Putt make rate** by distance bucket.
2. **First-putt performance** by bucket (complete holes): faced, avg putts, 1-putt%, 3-putt%.
3. **Putt miss patterns** by bucket: misses, High/Low/Short/Long %.
4. **Around the green** (<30y, non-putt, complete holes) by ATG bucket: shots, avg quality, on-green%, up-&-down%.
5. **Approaches** (≥30y, incl. par-3 tees) by approach bucket: shots, avg quality, green-hit%, miss L/R/Long/Short %.

### Rounds list (`/rounds`) — one row per round
date, session type, shots logged, complete holes, strokes, vs par (or "In progress").

### Distance buckets used everywhere
- **Putt** (feet, upper-inclusive): 0–3, 3–6, 6–10, 10–20, 20+
- **Around-the-green** (yards, [min,max)): 0–10, 10–30
- **Approach** (yards, [min,max)): 30–75, 75–125, 125–175, 175+

---

## 4. Notable gaps (useful context for strategy)
- **One engine now.** The heuristic "Strokes Lost" + green%/make% "What to Work On" were deleted (spec 2D); everything prescriptive flows from SG. The SG-driven ranked-list/target-line display rebuild (spec Part 3) is still pending.
- **SG baseline is Broadie scratch** (spec 2A). Absolute magnitude is now meaningful (0 = scratch-level). Long-game cell values are a best-effort scratch reconstruction pending source verification; putting is anchored to the spec's make-rate targets.
- **`situation_created` / `short_sided` are retired** (spec 1C/1D): no longer collected, displayed, or analyzed. The DB columns remain (nullable, unused) until a later drop migration.

---

## 5. Stored shot fields (DB columns, for reference)
`round_id, hole, par, shot_no, club, yardage (yards; putts = ft/3),
distance_unit (yd|ft), start_lie, start_lie_manual, decision_quality (Good|Bad,
default Good), execution (1–4), result, miss_direction, shot_shape
(Slice|Fade|Straight|Draw|Hook, nullable), shot_contact (Thin|Chunk, nullable),
putt_side, putt_length, penalty (int), notes, conceded (bool, pickups), id,
user_id, created_at`.
*(Legacy, retained but unused: `situation_created`, `short_sided` — spec 1C/1D.)*
