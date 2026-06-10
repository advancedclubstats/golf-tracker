-- 013_drop_legacy_enum_checks.sql
-- Make Zod the single source of truth for shot enum values (project hard rule).
--
-- These DB CHECK constraints duplicated the enum constants in lib/constants.ts
-- and drifted out of sync: adding 'Fringe'/'Recovery' to RESULTS crashed
-- production until migration 009 hand-patched the check. Removing them kills that
-- drift class entirely. Every write goes through actions/shots.ts, which parses
-- with ShotInsertSchema / ShotUpdateSchema first, so the enums are still enforced
-- — just in one place (the Zod schemas) instead of two that fall out of step.
--
-- Dropped: the string-enum checks (result, miss_direction, putt_side,
-- putt_length, decision_quality). Kept: stable numeric/structural guards
-- (par, hole, shot_no, penalty, yardage, execution range) — those don't grow,
-- so they're cheap DB-level invariants with no drift risk.
--
-- Loosening only; existing rows already satisfy these, so no data changes.

alter table shots drop constraint if exists shots_result_check;
alter table shots drop constraint if exists shots_miss_direction_check;
alter table shots drop constraint if exists shots_putt_side_check;
alter table shots drop constraint if exists shots_putt_length_check;
alter table shots drop constraint if exists shots_decision_quality_check;
