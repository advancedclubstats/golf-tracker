# Distance Summary — design pass (good → great)

Redesign of `app/stats/distance/page.tsx` + `components/stats/DistanceTables.tsx`.
The page presented six faithful tables but took no point of view — it asked the
player to be the analyst. This pass gives it an opinion: **it answers "where am I
furthest from elite, and does it matter?" in the first second.**

**Files**
- `Distance Summary.html` — the prototype (mobile, 430px). Toggle Tweaks for the forks.
- `distance-data.js` — data layer (mirrors `lib/analytics/distanceSummary.ts` shape).
- `distance-hero.jsx` — the ranked "Biggest gaps to Tour" headline.
- `distance-tables.jsx` — the six drill-down tables + the one gap-cell primitive.

---

## The decisions (locked)

1. **A ranked "Biggest gaps to Tour" hero.** Top-3 buckets where the player trails
   Tour most, **weighted by how often he faces them**, expressed in **strokes/round**
   — the SG currency the rest of the app already speaks (Dashboard, momentum). It
   answers his own stated goal ("visualize the biggest gap to elite players") directly
   instead of outsourcing the subtraction back to him.

2. **Strokes are the headline; points are the detail.** Only the hero talks in
   strokes — keeping it the special currency and avoiding double-counting across the
   overlapping putting tables. In the tables, each row self-reports its gap in *points*.

3. **One consistent gap cell, everywhere a Tour benchmark exists.** A you-vs-Tour
   mini-bar where the **shortfall is the striped, severity-colored space** (the gap is
   literally the highlighted absence), plus a signed points chip. Used identically in
   make-rate, first-putt, and approach. Miss-patterns and around-the-green carry no
   Tour band, so they stay plain (no scattered badges — an explicit anti-goal here).

4. **Severity is driven by OPPORTUNITY (strokes), not raw points.** This is the whole
   thesis made visible: Approach **175+ yds** has the widest *percentage* gap (−24)
   but it's a low-expectation range — **75–125 yds** (−17) costs more strokes and
   gets the redder treatment + the higher hero rank. A footnote on the approach table
   says so in words.

5. **Sample-size honesty (n≥10 gate).** Mirrors `lib/analytics/gates.ts`. Thin buckets
   never drive the headline and never get a severity color — they render a `THIN` tag
   or a `—` cell. Visible immediately on the **Last 5** window, where many buckets fall
   below the floor.

**Kept from the existing page:** the six-table spine, the single global Last-5/All-time
toggle (not split per-table), and the warm editorial mono aesthetic
(`colors_and_type.css` tokens). No per-cell trend sparklines — those belong to the
momentum work.

## Tweaks (design forks to review)
- **In-table cell:** Bar + chip (default) / Chip only / Heat number.
- **Row order:** By distance (default — hero carries the ranking) / Biggest gap first.
- **Dark hero card:** on (default) / off — the dark fairway card marks the one
  "headline" moment on the page.

---

## Handoff to Code

1. **Confirm SG-vs-Tour in strokes is cleanly derivable** from `activeBaseline` /
   the `Baseline` interface, per bucket. If yes (recommended), the `sgRd` field in
   `distance-data.js` is the ranking + severity metric. If not, fall back to
   `gap × frequency` in raw points — the hero and severity logic are unchanged, only
   the input number differs.
2. **Add the gap/priority computation to `distanceSummary.ts`** — keep it pure, zero
   Supabase imports (matches the file's layer rules). Needed per benchmarked bucket:
   `gap = you − tour`, `sgRd` (strokes/round vs Tour), `sev` (0–3 from `sgRd`),
   `thin = n < 10`. Hero = top-3 by `sgRd`, gated to `n ≥ 10`.
3. **Build the gap cell into `DistanceTables.tsx` / `DataTable`** as the `vs Tour`
   column renderer, reusing the existing `pct`/`num` formatters and tokens. The bar is
   plain divs (fill / striped-gap / tick); no new chart dep.
4. **Respect the n≥10 gate** for anything that drives the headline (the hero filters on
   it; thin cells render `—`).

**Numbers in the prototype are mock**, constructed from the real screenshot figures and
calibrated to match the Dashboard's stated SG values (Putts 10–20 ft ≈ −0.93/rd,
Approach 75–125 ≈ −0.60/rd, Putts 6–10 ft ≈ −0.58/rd). Tour values are band averages →
copy uses "≈ Tour", never false precision.
