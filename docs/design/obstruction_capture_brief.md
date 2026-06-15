# Brief: Capture obstruction as a start-state attribute (highest-fidelity SG)

**For:** Claude Design first → then Claude Code
**Re:** shot-entry flow (`app/rounds/[id]/log/ShotEntryFlow.tsx`), the lie
control + the "Where'd it end up?" result step; downstream `start_lie`,
`sg-baseline.ts`.
**Status:** new data capture. Additive and backward-compatible — no existing SG
number changes. This adds one orthogonal field and decides how to ask for it.

---

## Who sees this first, and why

**Design first.** The data model below is *locked* (treat it as a hard
constraint, do not redesign it). The open problem is pure capture-UX: where in
the recall flow this one fact gets asked, how to keep it to ~one tap, how to word
it so a tired golfer answers honestly the same way every time, and how/whether to
expose three levels without adding friction to the ~80% of shots that are Clear.
Hand to Code once the placement, interaction, and copy are locked.

---

## The insight that prompted this

On a short approach, **yardage alone lies.** "100 yards in" from the fairway is a
54° wedge you expect to put on the green. "100 yards in" from the rough behind a
tree is a punched 7i four feet off the ground — you don't expect the green at all.
Same yardage, completely different expected score. The model needs to know the
difference, and right now it can't reliably be told.

## The seam this exposes (why it's not just a missing field)

Today the schema collapses **two independent facts into one enum.** `RESULTS` and
`START_LIES` (`lib/constants.ts`) list `Recovery` next to `Fairway`, `Rough`,
`Bunker`. But `Recovery` isn't a *surface the ball sits on* — it's a statement
about *obstruction*. So the canonical Hayden Lake sequence (drive into rough,
behind a tree, punch out) forces a false either/or: tag the finish **Rough**
(true surface, loses the tree) or **Recovery** (true constraint, loses that
you're sitting down in rough). You're physically both.

The two orthogonal facts:

- **Surface / lie** — what the ball rests in: fairway, rough, sand, fringe.
  Governs contact and control.
- **Obstruction** — what's between ball and target: clear, partially blocked,
  fully blocked. Governs whether a normal shot is even available.

## Why obstruction is SG-load-bearing (not just nice-to-have)

Expected strokes is a function of your **start state.** Behind a tree at 100 yards
genuinely has a higher expected score than clean rough at 100 — which is exactly
why a Recovery baseline exists and why its table is yardage-discounted
(`sg-baseline.ts`, "roughly flat"). Capturing obstruction lets the baseline price
the shot correctly instead of charging the player execution loss for situational
difficulty.

## Why this is obstruction, NOT "shot type" (a trap to avoid)

It is tempting to model this as a shot-type picker (full / punch / obstructed).
**Don't.** A punch is your *response*, not your *situation*:

- You can punch with no obstruction (into wind, knockdown for control).
- You can be obstructed and not punch (chip out sideways with a wedge).

If shot choice feeds the expected-strokes baseline, it would quietly **absolve bad
decisions** (a hero punch you didn't need to attempt) and break the
decision-vs-execution split that is the spine of v1 (see T4/T5, `decision_quality`,
`sg.decisionSplit`). Capture the **situation** (obstruction); leave the **shot**
(punch/full) out of the baseline. A shot-type tag can exist later as optional
curiosity data, but it is out of scope here and must never enter SG.

---

## LOCKED data model (constraint for Design; spec for Code)

**Add one new orthogonal field on the shot's start state:**

```
obstruction: "Clear" | "Partial" | "Blocked"   // default "Clear"
```

- **Clear** — normal shot at the target available. (Default; the ~80% case.)
- **Partial** — can still advance toward the green, but forced into an abnormal
  shot (must flight it down, can't take normal club/loft). *This is the middle
  case the insight is about — the punch-7i from 100.*
- **Blocked** — cannot advance to target; must extricate (chip out
  sideways/backward). This is what `Recovery` means today.

Rules:

1. `obstruction` is **orthogonal to** `start_lie`. `start_lie` goes back to
   meaning pure **surface** (fairway / rough / sand / fringe / …). The two are
   stored and asked as separate facts.
2. **Baseline mapping (keeps every current SG number stable):** in
   `sg-baseline.ts`, `obstruction !== "Clear"` → use the **Recovery** table;
   `obstruction === "Clear"` → use the surface table. (Interim: Partial and
   Blocked both map to Recovery. They are stored distinctly so they can diverge
   later — see moat note.)
3. **Backward-compat:** the existing `Recovery` value in `RESULTS`/`START_LIES`
   stays valid and is read as `{ surface: rough/unknown, obstruction: Blocked }`.
   No migration of historical rows required; no SG output changes on day one.
4. **Moat:** storing surface × obstruction × yardage as separate facts is what
   lets Round Recall's own history eventually build real *obstructed-at-X-yards*
   baseline cells, instead of throwing the surface away every time. This is the
   point of doing it as a field rather than a UX nudge to "just tag Recovery."

Design must not break rules 1–3. Everything below is yours to decide.

---

## The capture-UX problem (Design owns this)

**Context — the flow is recall, post-round, from memory.** Steps today:
`club → yards → strike → result → (miss) → putt` (`Step` type in
`ShotEntryFlow.tsx`). A `LIE ▾` pill at the top shows the current shot's start
lie (inferred from the previous shot's finish via `nextStartLie`, one tap to
override). The result step is the "Where'd it end up?" grid (screenshot grid:
Fairway / Green / Fringe / Rough / Bunker / Recovery / OB / Hazard / Lost /
Unplayable / Holed it).

Because entry is from memory, the player knows the whole sequence — so either
capture point below is viable.

**Decisions to make:**

1. **Where it's asked.** Two natural homes — pick one (or argue a third):
   - *On the prior shot's result step:* decompose today's `Recovery` button into
     a normal surface tag **+** an obstruction level, so the finish records
     `Rough + Blocked` and carries forward automatically as the next shot's
     start state. Keeps everything in one "where'd it end up" mental act.
   - *On the current shot's lie pill:* obstruction rides next to `LIE ▾` as the
     start state of *this* shot, since that's the moment the constraint applies.
2. **Friction.** Default is Clear and most shots are Clear — the control must
   cost **zero taps** when Clear and ideally **one** when not. Don't make every
   shot pay for the rare one.
3. **Three levels vs. progressive disclosure.** Schema stores all three. You
   decide whether the UI shows three at once, or a single "obstructed?" affordance
   that expands to Partial/Blocked only when engaged. Wording matters more than
   the control: "Partial" and "Blocked" are jargon — find words a golfer maps to
   instantly (e.g. "could still go at it" vs "had to chip out"). Test that the
   *same* real situation gets the *same* answer on a tired Sunday.
4. **Consistency with the existing pills/steps.** Reuse the Modern Clubhouse
   `.q/.tap/.cta` step styles and the existing pill pattern; this should feel
   native to the flow, not bolted on.

## What to hand Code

- Chosen placement + interaction (annotated against the current steps).
- Final copy for the three levels (and any default/short labels for the pill).
- The empty/Clear state (what the flow looks like when nothing's obstructed).
- Confirmation that the locked data model above is untouched, so Code wires
  `obstruction` through `constants.ts` → `lib/schemas/shot.ts` →
  `ShotEntryFlow.tsx` → `sg-baseline.ts` mapping → carry-forward in
  `lib/shots/lie.ts`, plus a migration adding the column (default `Clear`).

## Out of scope

Shot-type tagging (full/punch/knockdown); building real obstructed baseline cells
from own-history; deprecating the legacy `Recovery` enum value (keep it for now).
