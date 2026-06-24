# Brief: "The Read" — a plain-English synopsis of your game

**For:** Claude Design first → then Claude Code
**Re:** new dashboard hero block (`app/stats/page.tsx` + a new
`components/stats/TheRead.tsx`), built on existing analytics
**Status:** new feature, additive. The dashboard, distance, and holes pages are
already strong — this sits *on top of* them and changes nothing below it.

---

## Who sees this first, and why

**Design first.** Every number this feature needs is already computed
(`lib/analytics/leaks.ts`, `momentum.ts`, `dashboard.ts`, `distanceSummary.ts`,
`benchmarks.ts`). There is no new data collection and almost no new math. The
hard part is **information design and copy**: choosing which 4–5 facts to say,
in what order, in what voice, so a golfer reads it once and can repeat their own
game back to you. So this is a design + copy pass first, then a thin code pass to
generate the sentences from data.

Hand to Code once the block's structure, the sentence templates, and the gating
rules are locked.

---

## The problem in one line

The app computes the truth but makes the player be the analyst. A good golfer can
scan the dashboard, the distance tables, and the holes page and still not be able
to *say*, in a sentence, what their game is. **The Read does the last mile:** it
turns the strokes-gained data into the paragraph a good coach would say after 30
seconds with your stats.

The test it has to pass: a strong golfer signs up, logs their rounds, reads this
one block, and can walk away and give a correct, specific synopsis of their game —
strength, biggest leak, why it compounds, and the one concrete thing to do.

---

## The vibe (the target output)

Terse, declarative, numbers-first. Lead with the punchline — strength and the
single target in one breath. Every claim carries the comparison so the reader
doesn't compute it. Name the cause, not just the symptom. No metaphors, no
pep-talk, no filler.

Here is the feature rendered against Matt's current data, as a fidelity target
for tone, length, and specificity (numbers from the live app):

> **You hit it far, but need ~2 more makes from 6+ feet a round to beat scratch.**
> That's where your 1.28 strokes a round go: you lose 1.46 on the greens alone,
> and it's trending down. You make 1 in 4 from 6–10 ft and 1 in 14 from 10–20;
> scratch is 1 in 2 and 1 in 5.
>
> It starts with the wedges. From 75–125 yards you miss the green ~9% more than
> scratch, which leaves the long putts you're missing.

That's the whole thing — ~55 words. Shape: **strength + target in line one →
the cost and where → the cause.** Tight is the point; if a sentence isn't
carrying a number or a cause, cut it.

### Banned moves (this is what "AI-sloppy" means here)

- No metaphors or hype: not "the engine of your game," "you're a weapon,"
  "it's running," "claw back."
- No motivational framing: not "you don't need tour numbers," "stay with it,"
  "the number falls fast."
- No throat-clearing: not "the good news is," "nothing here is a thinking
  problem," "let's be honest."
- One number per clause, not three stacked. If two stats say the same thing,
  keep the sharper one.

---

## Matt's three directives (these are requirements, not options)

### 1. Do NOT talk about decision-vs-execution yet — gate it on data

The `decision_quality` field shipped **2026-06-09** (migration 012), five days
before this brief. Every shot logged before then defaults to `Good`, so the
current "0% decisions / 100% execution" reading is an **artifact of a new field**,
not a finding. The Read must never say "all your losses are execution" off
contaminated defaults.

Rule: The Read says nothing about decision vs execution until there is enough
*genuine* decision data. Concretely — Code determines the count of rounds logged
**on or after the decision_quality cutoff** (the date the field went live, or a
per-shot "decision was actively set" signal if cleaner), and The Read only earns
a decision/execution sentence once that count clears a gate (propose **n ≥ 8
rounds** of real decision data; align with the spirit of `gates.ts`). Below the
gate, the line is simply absent — the honesty rule the whole app already follows.
The reassurance line in the example above ("nothing here is a thinking problem")
is exactly the kind of sentence that must stay **out** until the gate is cleared.

### 2. Prescribe a concrete, human, on-course target — not just another number

This is the biggest upgrade over what the app shows today. The current pages
display the gap; The Read must translate the gap into the thing a good playing
partner says: *"pros make these half the time, so you want to be making 4 of 10."*

Every leak sentence should convert rates into **countable, on-course units** and
set an **achievable** target (close part of the gap, not leap straight to elite):

- Express "make%" as **makes per round** or **X of 10**, using `perRound` (already
  on `HeroGap`: "times you face this shot per round") so it's grounded in how
  often they actually face it.
- Anchor the *gap* to the SG engine's baseline (scratch — the spine), and cite
  **Tour** rates (`lib/benchmarks.ts`) as the "what great looks like" context.
  Both are allowed in copy; don't conflate them (say which is which).
- Set the target as an intermediate step: e.g. "make 4 of 10" when they're at 2.6
  and tour is 5 — then tie it to **strokes recovered** (`sgPerRound` from
  `leaks.ts`) so the target is motivated, not arbitrary.

Template to work from (Design to refine the wording):

> "From {distance} you make about {X of 10 now}. {Scratch/Tour} makes {Y of 10}.
> Get to {achievable target of 10} — {one more / two more} per round — and that's
> ~{strokes} a round back."

Avoid false precision: Tour values are band-averages (see header note in
`benchmarks.ts`). Use "about / roughly / ~", never "exactly."

### 3. Momentum-aware, refreshes every round — never static

The Read recomputes on every load and always reflects the **most recent**
context. Use `computeMomentum` (`lib/analytics/momentum.ts`), which already splits
recent N vs prior N rounds and tags each category `working` / `weapon` /
`accel` (accelerating leak) / `new`.

The tone of a leak sentence must change with its direction (this mirrors the
momentum framework already in the codebase):

- Leak **getting worse** (`accel`) → urgency: "and it's trending the wrong way."
- Leak **improving** (`working`) → validation: "and it's already turning — stay
  with it."
- Strength **improving** (`weapon`) → lean in: "and it's still climbing."
- Strength **slipping** (`new`) → heads-up: "watch this one."

Honesty floor: momentum only exists past `computeMomentum`'s data floor (2×N
rounds, meaningful delta ≥ 0.15). Below that, The Read describes the static state
with **no** directional claim — don't fabricate a trend. The block should feel
different after a good round vs a bad one; that's the point.

---

## Structure of the block (proposed — Design to lock)

A single titled card at the **top of the dashboard**, above "Scoring Shape." Title
candidates: **"The Read"** / "Your game, in a sentence." Everything below it
becomes the evidence for it. Suggested internal order, each line optional and
gated:

1. **Headline** — one bold sentence merging the player's strength with the single
   biggest target (directive 2), e.g. "You hit it far, but need ~2 more makes from
   6+ feet to beat scratch." Strength comes from the top + SG category; the target
   from the #1 `prescribable` leak.
2. **Cost line** — the strokes lost and where, with momentum direction folded in
   (directive 3): "1.28 a round, 1.46 on the greens, trending down" — plus the
   sharpest one or two make-rate comparisons.
3. **Cause line** — the one cross-category link (e.g. wedges → long putts) when
   the data supports it. This is the "aha"; see below.

Hard ceiling: **~55–65 words, 3 short sentences plus the headline.** If a line
isn't earned (sample or momentum floor) it disappears — the block shrinks rather
than pads. The decision-vs-execution read is **not** a default line; it appears
only once directive 1's gate is cleared, and only if it adds something.

### The compounding line is worth special effort

The insight a human can't easily pull from the tables is **causation between
categories** — bad wedges create the long putts you then miss. Build one or two of
these links as first-class:

- **Approach → Putting:** when approach proximity (or green% in the 75–175
  buckets) is a leak *and* mid-range putting is a leak, say they're connected.
- **Driving → Scoring:** when off-the-tee SG is a strength, credit it for the
  birdie rate.

These are simple co-occurrence rules over existing leak/category data, not a new
model. Spec 2–3 of them; show at most one per render (the strongest).

---

## What already exists (so Design knows the raw material)

| The Read needs… | Already computed in… |
|---|---|
| Per-category SG, per round, ranked | `lib/analytics/sg.ts` (`byCategory`, `perRound`) |
| The #1 leak, sample-gated, with strokes/round + raw% + scratch target | `lib/analytics/leaks.ts` (`Leak`: `sgPerRound`, `raw`, `target`, `prescribable`) |
| "Times you face this shot per round" + the noun for it | `lib/analytics/distanceSummary.ts` (`HeroGap.perRound`, `.noun`) |
| Tour band-average make% / 3-putt% / GIR% / up-down% | `lib/benchmarks.ts` (`TOUR_*`) |
| Scoring shape: birdie/bogey/double rates vs scratch targets | `lib/analytics/dashboard.ts` (`ScoringShape`, `SCORING_TARGETS`) |
| Direction of travel + tags (`working`/`weapon`/`accel`/`new`) | `lib/analytics/momentum.ts` (`computeMomentum`) |
| Sample-size gates | `lib/analytics/gates.ts` (`isPrescribable`, thresholds) |

Net: this is a **selection + phrasing layer** over data that's already there.

---

## Guardrails (consistent with the codebase's doctrine)

- **One block, one moment.** Restraint is a product decision here (same as the
  momentum and distance work). Do not scatter synopsis snippets across other
  pages. The Read lives in exactly one place.
- **Never overclaim past the sample.** Every sentence is individually gated; an
  unearned line is omitted, not softened. Reuse `gates.ts` thresholds; don't
  invent looser ones.
- **No false precision.** "~", "about", "roughly" for any Tour-anchored number.
- **Strokes Gained stays the spine.** Rankings and the "biggest leak" come from
  SG (`leaks.ts` `sgPerRound`), not raw percentages. Percentages and "X of 10"
  are the *human translation* of the SG fact, not a competing source.
- **Don't restate the whole dashboard.** The Read is the headline; the blocks
  below are the evidence. If a sentence just re-reads a number that's visible two
  inches lower with no added interpretation, cut it.
- **Voice:** warm, declarative, second person, a coach not a spreadsheet. For any
  copy that ships, follow `~/CoWork/ABOUT ME/anti-ai-writing-style.md`.

---

## Handoff to Code (after design + copy lock)

1. Add a pure `computeTheRead(shots, rounds)` to `lib/analytics/` (zero Supabase
   imports, per D-05) that returns a **structured object of candidate lines**,
   each with the data + a `gated`/`eligible` flag — *not* pre-rendered strings.
   The component assembles sentences from templates so copy can change without
   touching analytics.
2. It composes existing outputs (`computeStrokesGained`, `computeLeaks`,
   `computeMomentum`, `computeDashboard.scoringShape`, `computeDistanceSummary`)
   — do not recompute SG from scratch.
3. Implement directive 1's decision-data gate: count rounds since the
   `decision_quality` cutoff; expose the decision line only past the gate.
4. Implement the 2–3 compounding rules as explicit, documented co-occurrence
   checks over leak/category results.
5. Build `components/stats/TheRead.tsx` at the top of `app/stats/page.tsx`, reusing
   existing card/typography tokens
   (`docs/design/design_handoff_dashboard/colors_and_type.css`).
6. Unit-test the gating + template selection: thin-sample player (most lines
   suppressed), strong-putter player (different headline), pre-/post-decision-gate
   states, and each momentum tone. Snapshot the assembled sentences.
```
