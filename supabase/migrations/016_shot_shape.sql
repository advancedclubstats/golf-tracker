-- 016_shot_shape.sql
-- Capture ball-flight shape and contact as two orthogonal, optional shot
-- attributes — independent of result, miss_direction, and execution.
--
-- The two axes (you can hit a fat pull, so they can't share one column):
--   shot_shape:   'Slice' | 'Fade' | 'Straight' | 'Draw' | 'Hook'   -- flight curve
--   shot_contact: 'Thin'  | 'Chunk'                                  -- strike fault
--
-- Both NULLable and captured going forward only (no backfill): a tired golfer
-- often tags one axis and not the other ("I chunked it" with no shape recall),
-- so neither is required. Putts never reach the shape step, so putter rows stay
-- NULL on both. The intended payoff is a shape/contact-rate matrix by club
-- category (Driver / Woods / Long iron / Short iron / Wedge).
--
-- No CHECK constraint by design: per migration 013, Zod (lib/schemas/shot.ts)
-- is the single source of truth for shot string-enum values. Every write goes
-- through ShotInsertSchema first.

alter table shots add column shot_shape   text;
alter table shots add column shot_contact text;
