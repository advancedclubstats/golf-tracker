# Proposal: the recent-form lens and the round-recall exit beat

Status: proposal (not yet a decision). Written from a UXR observation: logging a
round carries real activation energy ("nice, I get to enter this"), but the
payoff at entry is flat. The all-time SG numbers barely move, so the moment of
excitement lands on a frozen number.

This memo develops the four directions picked out of that conversation
(tonight's effect, dual number on the hero, trajectory/ETA, and finishing The
Chase's exit beat) into one sequenced plan. They are not four features. They are
one idea with a shared primitive and one shared surface.

---

## The read

The frozen number is a denominator problem, not a display problem. All-time SG
for putting 10-20ft is a cumulative mean over a large, growing N. By
construction each new round moves it 0.03-0.05 and it sits near -0.70 for a long
time. That stability is honest and correct for the question "where do I actually
stand." It is dead weight for the question you feel at entry: "did tonight
matter, and what is happening with my game right now."

Those are two denominators. The all-time number answers the first. Nothing at
the moment of entry answers the second.

Two facts about the current code sharpen this:

1. The machine for the second denominator already exists. `momentum.ts` computes
   per-round, per-category SG and splits last-N against prior-N. A 5-round
   denominator moves visibly. But it lives on the dashboard, and it only
   surfaces categories that crossed a meaningfulness threshold, so on any given
   entry it can be silent about the exact thing you just did.

2. The round-recall exit is empty of recent-form signal. `RoundRecall.tsx` is a
   server component: a takeaway headline, RoundChips (deltas vs your average),
   and the hole-by-hole ledger. No recent-form read, no record beat. The Chase
   hero and `selectChase` shipped on the dashboard (DL-025), but the "new best
   beat on the recall exit" from that same decision never landed.

So the seam is a recent-form beat, surfaced at the recall exit, framed as "here
is what tonight did / here is what we are seeing lately," sitting deliberately
next to the barely-moving all-time number rather than replacing it.

---

## The one discipline that protects this

The anti-goal is scattering trend cues across every screen; momentum lives in
one place. Three of these four directions want to speak at the recall exit
(tonight's effect, the record beat, and arguably the ETA). If each ships as its
own block, the exit becomes a stack of three competing celebrations and the
calm-brief identity breaks.

Rule for the build: the recall exit gets at most ONE recent-form beat per round.
A small selector decides what that round earned, in priority order, and renders a
single line. A record broken outranks a recent-form move outranks nothing. Most
rounds show one calm line; some show none. That restraint is the product, the
same way a near-empty momentum section is correct.

---

## Shared primitive: `lib/analytics/recentForm.ts` (D-05)

A pure helper the exit beat, the hero dual number, and the ETA all read from, so
there is one definition of "recent form" and nothing drifts.

```
recentForm(shots, rounds, { windowN = 5 }) -> {
  byCategory: Record<SgCategory, {
    recentMean: number | null   // mean per-round SG over last N (null below N)
    priorMean:  number | null   // mean over the prior N (null below 2N)
    delta:      number | null   // recentMean - priorMean (null below 2N)
    allTimeMean: number         // the cumulative figure the hero shows today
    sampleCount: number         // rounds of data in this category
  }>
}
```

Reuse `perShotSG` and the chronological round ordering `momentum.ts` already
uses. This is a refactor-friendly extraction: `momentum.ts` can later consume it
rather than recomputing the series. Unit tests per D-05: mean math, the 2N floor
returning nulls (not zeros), single-round and empty inputs.

Every consumer names the denominator in copy (the momentum honesty rule): never
"putting improving lately," always "last 5 rounds." No number appears without
the unit that makes it credible.

---

## The plan, sequenced

Ordered by your loop: the already-decided piece first, then recent movement,
then the dashboard-side number, then the one with the real honesty risk last.

### 1. Finish The Chase: the new-best beat at the recall exit (lane 3, decided)

This is not new scope. It is the unshipped half of DL-025, and it establishes
the single exit-beat surface the next items reuse. It is also the closest thing
to a binary "nice" hit, because a streak clicking to a record is visible in a
way 0.03 SG never is.

- Detection: a pure helper (extend `streaks.ts`, D-05) that, given the shots
  before this round and after, reports any streak whose current run passed its
  prior personal best on this round: `recordsBrokenBy(round) -> Streak[]`. Tests:
  a record broken, a record tied (not broken), nothing.
- Surface: one calm marker at the top of `RoundRecall.tsx`, consistent with the
  Tiger 5 RECORD chip. Lime, one line, e.g. "New best: 7 bogey-free par 5s."
  Not a celebration interstitial.
- Acceptance: fires only on a genuine pass of the prior best; never on a tie or
  a first-ever run below the CHASE_MIN_BEST floor; server component stays server;
  no hardcoded hex.
- Steelman risk to watch in review: a beat that quietly rewards streak-protecting
  golf over honest play. The copy states the fact, it never says "keep it going."

### 2. Tonight's effect beat (lane 3 / tighten)

The recent-form movement, in the same exit surface, only when no record beat
outranks it.

- Reads `recentForm`. For the categories that moved most this round, show what
  the round did to the last-5 read: "10-20ft putting: -0.48 over your last 5, up
  from -0.55 the 5 before." A 5-round denominator moves; that is the point.
- Selection: reuse momentum's meaningfulness gate (|delta| >= 0.15) and the 2N
  floor. Below floor, or nothing moved meaningfully, the beat is absent. Do not
  pad. One line, the single most meaningful mover, not a list.
- Placement: the exit beat slot, priority below a broken record. If a record
  broke this round, that shows and this waits for next time. One beat per round.
- Acceptance: never renders below the 2N floor; always names the denominator;
  reuses `recentForm`, no parallel computation; degrades to nothing honestly.
- Steelman risk: a 5-round window is noisy. Keep the copy descriptive ("what we
  are seeing lately"), never predictive ("you have fixed your putting").

### 3. Dual number on `BiggestLeakHero` (lane 1 / dress it up)

The dashboard-side companion. Pair the frozen all-time figure with a fast
last-5 read so the hero carries both jobs: all-time is where you stand, lately is
where you are trending.

- The hero shows `allTimeMean` (as today) plus, when the category clears the 2N
  floor, a small secondary line: "last 5: -0.48" colored by direction. Below
  floor, the secondary line is absent (no guess).
- This is the one place the dual treatment is allowed. It does not spread to the
  leak list or the tables. Containment is what keeps it inside the one-place
  rule; the hero is a single surface, not a scattering.
- Acceptance: secondary read only above floor; reuses `recentForm`; the 38px
  all-time number stays the type moment, the last-5 line is visibly secondary; no
  hardcoded hex.
- Steelman risk: two numbers can read as clutter or as implying the small one is
  the "real" trend. The hierarchy has to make all-time dominant and lately a
  quiet companion, not a competing headline.

### 4. Trajectory / ETA (lane 1 / dress it up): highest honesty risk, build last

Turn a stuck number into a slope: "at your recent rate, this reaches -0.60 in
about 8 rounds." Honest movement without faking that the all-time figure moved.

Handle carefully. This is the one direction that projects a trend forward, which
is exactly the false-precision your principles guard against (statistical
fairness, no implied precision the data does not support). Build only after the
cheap test, and gate it hard.

- Math is deterministic, not a forecast of your golf: given `allTimeMean` over N
  rounds and a `recentMean`, how many additional rounds at that recent rate move
  the cumulative mean across a threshold. It is arithmetic on the mean, stated
  conditionally.
- Copy must carry the condition every time: "if your recent 5-round rate holds."
  Never a bare "8 rounds to -0.60." If `recentMean` is not clearly better than
  `allTimeMean`, show nothing rather than an infinite or negative ETA.
- Acceptance: only renders when recent clearly beats all-time and both clear the
  floor; always conditional copy; caps the horizon (no "in 240 rounds"); a pure,
  tested helper (monotonic cases, the no-progress case, the already-there case).
- Steelman risk: this is the feature most likely to overclaim. If the cheap test
  reads as "cute but I do not trust it," kill it and keep 1-3. It is the most
  expendable of the four.

---

## Cheap tests first (do not skip to the full builds)

Per the loop, each lane-3 item earns its polished build only after the dumb
version pulls you.

- Item 1: it is already decided; the dumb version is the single record line. Ship
  just that and watch whether the beat lands at entry.
- Item 2: before wiring selection and copy, hardcode one recent-form line on your
  own next entry and see if you look at it. If you do, build the selector.
- Item 3: mock the dual number in the hero once. If the last-5 line pulls your
  eye in a good way (not a cluttered way), build it.
- Item 4: off-app. Compute one ETA by hand for the 10-20ft putting leak and sit
  with it. Only build if a believable ETA makes the frozen number feel alive
  rather than makes you distrust the app.

## What this explicitly is not

Not a second engine (all reads derive from SG via `recentForm`). Not scattered
trend arrows (one exit beat, one hero companion, nothing on the tables). Not
manufactured engagement (every beat is real golf just played; the record beat is
honest-achievement, DL-023). Not a required field or added entry friction (all
of it is display on data you already logged).

## Suggested next step

Take items 1 and 2 together as the first build, since they share the exit surface
and the `recentForm` extraction, and they are the two that speak to the entry
moment where the activation energy actually is. Fold this into `BACKLOG.md` as
the next ticket if it survives your read, and log a decision for the sequencing.
