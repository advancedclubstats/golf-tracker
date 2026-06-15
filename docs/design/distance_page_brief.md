# Brief: Make the Distance Summary page maximally useful

**For:** Claude Design first → then Claude Code
**Re:** `app/stats/distance/page.tsx` + `components/stats/DistanceTables.tsx`
**Status:** the page works and is clean. This is a "good → great" pass, not a rescue.

---

## Who sees this first, and why

**Design first.** The thing holding this page back is not engineering — every
number it needs is already computed (`lib/analytics/distanceSummary.ts`) and the
Tour benchmarks already exist (`lib/benchmarks.ts`). The gap is an
**information-design** gap: the page presents data faithfully but takes no point
of view. It asks the player to be the analyst. So the first pass should be a
design pass that decides *what the page is trying to say*, and only then a code
pass to build it on the existing data.

Hand to Code once the layout, hierarchy, and the "gap" treatment are locked.

---

## What the page is

Six stacked tables (putting make-rate, first-putt performance, miss patterns,
around-the-green, approach) bucketed by distance, with a global **Last 5 / All
time** toggle. Most tables carry a **Tour** column so the player can see the gap
to elite play. The player (Matt, a scratch golfer) built the Tour column
specifically to *"visualize the biggest gap between myself and elite players."*

## What's already good — keep it

- The bucketing and the six-table structure are the right spine. Don't collapse them.
- The single global Recent/All toggle is the correct restraint (it's a deliberate
  decision from the momentum handoff — no per-cell trend glyphs here).
- Warm, editorial, mono-numeral aesthetic. Stay in the existing token system
  (`docs/design/design_handoff_dashboard/colors_and_type.css`).

---

## The core problem

The Tour column states the gap but makes the player *compute* it, and treats
every gap as equal. Two failures:

1. **The math is left to the reader.** "26% vs 50%" and "99% vs 98%" sit in the
   same visual weight, so the eye can't find the gap that matters. The player's
   own stated goal — *find the biggest gap* — is exactly the job the page
   currently outsources back to him.

2. **No prioritization, and no sense of stakes.** A gap only matters if it's
   *big* **and** *frequent* **and** *costs strokes*. Right now nothing weights
   these. Looking at the real data: 6–10 ft putting (26% vs Tour 50%) and
   10–20 ft (7% vs 20%) are screaming, while 0–3 ft (99% vs 98%) is a
   non-event — yet they read identically. And the player faces some buckets far
   more than others (e.g. 63 first-putts from 20+ ft vs 20 from 0–3 ft), which
   should change which gap to chase first.

This matters extra because the whole app runs on one engine: **Strokes Gained is
the spine** (`PROJECT_CONTEXT.md`). A gap page that talks in raw percentages is
slightly off-doctrine. The most on-brand version expresses the gap in *strokes*,
or at least ranks gaps the way SG would.

---

## Design goals (in priority order)

1. **Surface the gap, don't just show it.** The page should answer "where am I
   furthest from elite, and does it matter?" in the first second of looking —
   before the player reads a single table.
2. **Rank by what to fix.** Some explicit ordering of buckets by opportunity
   (gap × frequency, ideally in strokes), so the page has an opinion.
3. **Encode magnitude visually.** Make the size of each gap legible at a glance
   (bar, color ramp, delta chip) instead of two numbers the eye must subtract.
4. **Keep the detail.** The six tables stay as the drill-down. The new treatment
   sits *on top of* them, it doesn't replace them.
5. **Restraint.** One prioritization moment, consistent gap treatment in the
   tables. Don't scatter arrows and badges everywhere — that's an explicit
   anti-goal in this codebase.

## Directions worth exploring (pick, don't do all)

- **A "biggest gap" header / hero.** A small ranked summary above the tables:
  the top 2–3 buckets where the player trails Tour most, weighted by how often
  he faces them. This is the most direct answer to his stated goal.
- **Gap as a single encoded cell.** Replace (or augment) the bare Tour number
  with a delta treatment — e.g. `−24 pts` chip or a you-vs-Tour mini-bar —
  colored by severity, so each row self-reports its gap. Then the toggle/sort
  can rank rows by gap.
- **Express gaps in strokes.** Since the SG engine and baselines already exist,
  the strongest version converts each bucket's gap into strokes-per-round lost
  vs Tour. That turns "26% vs 50%" into "≈ X strokes/round" — the currency the
  rest of the app speaks. Confirm feasibility with Code before committing.
- **Sample-size honesty.** Buckets with thin data shouldn't drive the
  headline. The codebase already gates prescriptions on sample size
  (`lib/analytics/gates.ts`, buckets n≥10) — mirror that here so a 5-shot bucket
  isn't crowned the top priority.

---

## Constraints & what already exists (for the design pass)

- **Data is all there.** Every per-bucket figure and its Tour benchmark is
  computed server-side. Adding "gap" or "gap-weighted-by-frequency" columns is
  arithmetic on existing fields, not new data collection.
- **Strokes-gained currency exists.** `activeBaseline` / the `Baseline` interface
  can value a gap in strokes; check with Code how cleanly per-bucket SG-vs-Tour
  can be derived before designing around it.
- **Tour values are band-averages, not exact** (see header note in
  `benchmarks.ts`). The design copy shouldn't imply false precision —
  "≈ Tour" framing, not "exactly."
- Mobile-first; tables already live in `DataTable` with sortable columns and
  `pct`/`num` formats. New cell treatments should fit that primitive.

## Out of scope / guardrails

- Don't add per-cell trend sparklines (owned by the momentum work; deliberately
  excluded here).
- Don't break the single global Recent/All toggle into per-table controls.
- Don't collapse the six tables into one mega-table.

---

## Handoff to Code (after design locks)

1. Confirm whether per-bucket **SG-vs-Tour in strokes** is cleanly derivable from
   `activeBaseline`; if yes, that becomes the ranking metric, if no, fall back to
   gap × frequency in raw points.
2. Add the gap/priority computation to `distanceSummary.ts` (keep it pure, zero
   Supabase imports — matches the file's existing layer rules).
3. Build the new hero/cell treatment as additions to `DistanceTables.tsx` /
   `DataTable`, reusing existing tokens and the `pct`/`num` formatters.
4. Respect the n≥10 bucket gate for anything that drives the headline.
