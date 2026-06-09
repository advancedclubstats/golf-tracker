# Backlog

Running list of things to do next, so a new session can start with
"take the top item." Newest decisions at the top of each section. Claude keeps
this current — when a session finishes work, move done items out and add any
deferrals. Each item should be self-contained enough to act on cold.

> How to use: if a session starts without a specific ticket, read this, propose
> the top unblocked item, confirm, then follow the normal pre-coding protocol.

---

## Loose ends (do soon)

- **Clean up hole 8 of the in-progress round** (`64c33e46-ae63-423e-92d7-d646a7072a28`).
  A hole restart appended duplicate shots: it currently holds two tee shots
  (shots 1 & 3, both 6i→Rough) and a holed-out `Make` mid-hole (shot 2, LW→Make).
  Needs the player to say what the correct sequence is, then delete the stray
  rows. (Root-cause UX fix is "redo/clear hole" below.)

## Entry & editing

- **Edit the new chain fields after the fact.** `ShotForm` (the bottom-sheet
  editor) only edits core fields — it can't edit `start_lie`, `situation_created`,
  or `short_sided`. Adding them upgrades BOTH the round-detail edit sheet and the
  in-flow "Edit last shot" quick edit in one change. Highest-value editing gap.
- **"Redo / clear hole" flow.** Re-entering a hole from the tee currently appends
  duplicate shots instead of replacing (caused the hole-8 corruption above). Add
  a way to clear a hole's shots and start it over from the entry flow.
- **In-flow edit covers only the last shot.** The wizard's "Edit shot N" handles
  the just-committed shot; earlier shots still go through round detail. Fine for
  now; revisit if it's a pain.

## Analytics (strokes gained)

- **Make dashboard "What to Work On" SG-driven.** It still picks "worst" by
  green% / make% / execution. Swap to worst-SG-by-distance-bucket and
  worst-SG-by-club so the prescription matches the SG diagnosis card above it.
  Needs two new pure analytics (SG by distance bucket, SG by club).
- **Baseline calibration.** SG is vs the PGA Tour benchmark (Broadie), isolated
  in `lib/analytics/sg-baseline.ts` for easy swap. Options: add a scratch table /
  toggle, or recalibrate as more rounds accrue. Direction is trustworthy today;
  magnitudes follow the table.
- **Decision-vs-optimal grade** (the SG plan's "later phase"). Once there's enough
  forward data, grade the actual club/target against the SG-optimal play — the
  objective replacement for a manual decision score.
- **Domino / situation view** populates from new rounds. The SG page section
  exists; it just needs `situation_created` data, which only new (post-wizard)
  rounds capture.

## Design & polish

- **Round Recap screen.** The expressive full-bleed recap from the design handoff
  (the player's favorite "feel," softened). Build additively as a header
  treatment on the existing round-detail page — no nav change.
- **SG hero strip on the dashboard.** The design mockup's full-bleed treatment for
  the headline SG number + biggest leak. Optional polish.
- **Version-control the design handoff.** The Modern Clubhouse token file +
  prototypes currently live only in `/tmp`. Drop into `docs/design/` if we want
  them on disk.

## Tech debt / data integrity

- **EditShotSheet still writes via server actions (re-render on edit).** The
  shot-entry wizard now writes through fetch route handlers (`app/api/shots`,
  `app/api/rounds/concede`) so saves don't trigger an RSC re-render — that was the
  true root cause of the "Server Components render" save crash (a committed shot
  rode back a re-render error and looked like a failure). `EditShotSheet` on the
  round-detail page still calls the server actions directly; a re-render is wanted
  there and it's a cold path, so it's fine — but if it ever shows the same
  intermittent error, migrate it to the route handlers too. Retry
  (`lib/supabase/retry.ts`) + error boundaries (`app/error.tsx`,
  `app/rounds/[id]/log/error.tsx`) remain as defense for the GET render paths.
- **Drop the legacy `result` / `miss_direction` / `putt_*` DB CHECK constraints**
  in favor of Zod-only validation. These drifted from the constants and caused the
  Fringe/Recovery production crash (fixed in migration 009). Either remove them, or
  keep a hard rule: when adding an enum value, update the DB check in the same PR.
- **Mid-shot edits don't re-derive downstream lies.** `recompute_hole_start_lie`
  runs on insert/delete, not on `updateShot`. Editing a middle shot's result
  leaves later shots' `start_lie` stale until an insert/delete. Minor.

## Open product questions (for the player to decide)

- **Hole 10 par.** Course card lists 4/5; the app and logged rounds use par 4.
  Leave as-is unless decided otherwise.
- **Possible features** from the original brief: stroke index / handicap, showing
  the loaded tee yardage during entry, an "un-concede" UI for picked-up holes.
