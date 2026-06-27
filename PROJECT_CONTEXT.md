# Round Recall — Project Context

> Single entry point for anyone (human or Claude) working on this project or
> anything derived from it: case studies, portfolio writeups, related specs,
> new features. Layer 1 is the product story. Layer 2 is the technical map,
> which points into the detailed docs rather than duplicating them.
>
> Keep this file current. When a major decision lands or the state changes,
> update it in the same session.

---

## Layer 1 — The product story

### What this is

A golf analytics app for one player on one course (Hayden Lake CC), built
entirely on recall: no GPS, no sensors, no live entry. After a round, the
player taps through every shot from memory in under 5 minutes and gets a
strokes-gained breakdown of where the round actually went.

The constraint is the moat. Playing the same holes forever means your own
history can eventually become the optimal-reference dataset for these exact
greens. That's what the name points at: **Round Recall** names the
memory-based-input moat and scales beyond one course.

Naming status: the name is **locked as Round Recall** and `roundrecall.com`
is the canonical domain (decided 2026-06-10; see `docs/POSITIONING.md` for the
positioning and name rationale). The app already says Round Recall in the
welcome overlay; the repo, page metadata, and most UI still say "Golf Tracker."
Full rename is a pending backlog item.

### Who it's for

v1 is one user: Matt, a scratch golfer and the developer. No accounts, no
auth screens. The deployed app is public read-only as a portfolio piece;
writes are owner-only behind a cookie gate. Post-v1 audience: any serious
golfer who plays the same course repeatedly and wants precise retrospective
analytics.

### The core decision

Strokes Gained is the single engine. The old heuristic "Strokes Lost" /
"What to Work On" logic was deleted, not deprecated. Everything prescriptive
flows from SG, and every recommendation drills down to its own raw shots
(raw → meaning → impact), so there is no black box to reverse-engineer.

Engine hardening, in the order it shipped:

1. Swapped the PGA Tour baseline for Broadie's scratch baseline, which makes
   magnitudes meaningful and cleans the category ranking.
2. Architected a self-baseline blend seam (the `Baseline` interface) so the
   player's own history can later replace the published tables per cell.
3. Gated all prescriptions on sample size: clubs n≥15, buckets n≥10.
   Below-threshold cuts never drive a recommendation.
4. Deleted the second engine.

### The one field SG can't compute

`decision_quality` (Good/Bad, one tap, default Good) with four triggers: too
much risk, wrong club, wrong line, acted hastily. It splits losses into "fix
by thinking" vs "fix by practice," the variance-vs-error layer. Two old
manual fields were removed because SG now does their job objectively
(`situation_created`) or they were too subjective to mark (`short_sided`).
Everything else is derived: penalties off the tee, three-putts, double-chips,
bogey-from-inside-150, birdie and big-number rates.

### The key diagnostic insight

The putting "leak" was largely an approach-proximity problem wearing a
putting costume. The player putts fine; he's just far away constantly
(100 of ~169 first putts came from 10+ feet). SG attributes the stroke to
the right link in the chain, which is the whole argument for the engine.

### The killer screen

Hole-level SG attribution: per hole, expected vs actual score with a
tee / approach / short-game / putting breakdown. Shipped as "Cost by hole"
on the Holes page. No commercial app can do this, because no commercial app
has clean retrospective shot data for one player on one course.

### The first-domino read

SG grades each shot independently, but a blow-up hole is a cascade. On the
per-round recall ledger, blow-up holes now name **the one shot the round turned
on** — "The round turned on shot N — off the tee / the approach / the putt" —
and treat what follows as forced recovery. It corrects two ways SG's
shot-by-shot view misleads: it walks blame back from a forced punch-out to the
drive that created the trouble (difficulty SG can't see, e.g. a tree), and it
folds in the player's own swing rating so a bad swing with a lucky bounce isn't
forgiven. This is the `docs/POSITIONING.md` domino metaphor made literal, and a
concrete demonstration of where to trust the model vs. where to patch its blind
spots (PM judgment for the portfolio narrative). Engine in
`lib/analytics/firstDomino.ts`; surfaced via `roundRecall`.

### On the horizon

A practice module that is engine-prescribed (diagnose → practice → verify)
rather than a static drill menu, scored against the same scratch baseline as
real rounds, with a personal leaderboard. Lead games: Money Zone ladder, lag
ladder, knee-knockers, wedge ladder, up-and-down random. Not yet specced
into the backlog.

### Why this project exists beyond golf

It's also a portfolio piece for Matt's PM job search. The PM judgment it
demonstrates: framing the right problem (recoverable strokes, not vanity
stats), choosing one rigorous engine and killing a working heuristic system
to get there, gating outputs on sample size instead of overclaiming, and
adding exactly one new input field where the data demanded it. When writing
about this project for an external audience, read
`~/CoWork/ABOUT ME/anti-ai-writing-style.md` first and follow it.

---

## Layer 2 — Technical map

### Stack in one line

Next.js (App Router) + TypeScript + Tailwind/shadcn, Supabase Postgres (no
RLS yet; hardcoded `user_id` UUID), Vercel, mobile-first PWA. All analytics
in TypeScript in `lib/analytics/` (no SQL views, no Supabase imports there).

### State of the project (as of 2026-06-09)

- **Engine & Display Spec v1 epic: complete.** Scratch baseline, sample-size
  gates, second engine deleted, `decision_quality` wired end to end,
  decision/execution split, ranked leak list with three-depth drilldown,
  dashboard answer-order rebuild, hole-level SG attribution.
- **Deployed** on Vercel, public read-only, owner writes via `OWNER_KEY`
  cookie. `requireOwner` enforced server-side in all mutating actions.
- **Welcome overlay** (`components/WelcomeOverlay.tsx`) frames it as a
  portfolio project and houses owner sign-in.
- Open follow-ups live in `docs/BACKLOG.md` (verify scratch long-game
  magnitudes, enable the self-baseline blend when cells fill, drop the two
  retired columns, OG/share metadata, full Round Recall rename).

### Where everything lives

| Question | File |
|---|---|
| What's the name, positioning, and pitch? | `docs/POSITIONING.md` |
| What does the app do and why? | `docs/PRD.md` |
| How is it built (stack, routes, conventions)? | `docs/SPEC.md` |
| What's the schema? | `docs/DATA_MODEL.md`, `ERD.md` |
| What's locked and must not be re-opened casually? | `DECISIONS.md` (D-01…D-10) |
| What's next / current state? | `docs/BACKLOG.md` |
| Analytics source of truth (legacy) | `docs/golf_stats.gs` |
| Design handoffs | `docs/design/` |
| Deploy steps | `docs/DEPLOY.md` |

Conflicts: `DECISIONS.md` beats `SPEC.md` where they disagree (known case:
`total_score`, see D-01). The backlog reflects reality better than either.

### Decisions most likely to bite you

- **D-01**: no `total_score` column anywhere; always derive from shots.
- **D-02 / migration 013**: enum values are enforced by Zod only, never DB
  CHECK constraints. Changing the bag or an enum is a code deploy.
- **D-05**: `lib/analytics/` takes plain typed arrays, zero Supabase
  imports, independently testable.
- **D-08**: practice rounds count in all analytics, on purpose.
- Sample-size gates (`lib/analytics/gates.ts`) govern prescription
  eligibility everywhere. Show the n next to every cut.

### Working conventions

- Sessions without a ticket: read `docs/BACKLOG.md`, propose the top
  unblocked item, confirm before starting. Keep the backlog current.
- The original Engine & Display Spec v1 (`golf-app-spec.md`) was a chat
  artifact and is not in the repo; its content is reflected in the backlog
  epic and in this file.
