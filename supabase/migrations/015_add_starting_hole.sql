-- Migration 015: starting_hole on rounds
-- D-13: the round-entry form drops "Session" and adds the hole the player tees
--       off on. It seeds the opening hole in the log (shotgun / mid-course
--       starts). Round length stays derived from logged shots (D-01) — this is
--       a start position, not a hole count. Validation lives in Zod
--       (lib/schemas/round.ts: int().min(1).max(18)); no DB CHECK, consistent
--       with the project's "constraints in Zod" pattern.
-- No backfill needed: every existing round starts on hole 1 (default).

alter table rounds add column starting_hole int not null default 1;
