-- 014_obstruction.sql
-- Capture obstruction as a start-state attribute, ORTHOGONAL to start_lie.
--
-- The schema used to collapse two independent facts into one enum: `Recovery`
-- sat next to `Fairway`/`Rough`/`Bunker` in result/start_lie, forcing a false
-- either/or for "in the rough behind a tree". This adds a separate field so the
-- ball can be recorded as Rough (surface) + Blocked (obstruction).
--
--   obstruction: 'Clear' | 'Partial' | 'Blocked'   -- default 'Clear', the ~80% case
--
-- Backward-compat (no backfill): historical rows carry the column default
-- 'Clear', and their legacy `start_lie = 'Recovery'` still maps to the Recovery
-- baseline table — so no existing SG number changes. New obstructed shots are
-- stored as surface + obstruction:Blocked instead. Recovery rows therefore read
-- as { surface: rough/unknown, obstruction: Blocked } at query time.
--
-- No CHECK constraint by design: per migration 013, Zod (lib/schemas/shot.ts) is
-- the single source of truth for shot string-enum values. Every write goes
-- through ShotInsertSchema first.

alter table shots
  add column if not exists obstruction text not null default 'Clear';
