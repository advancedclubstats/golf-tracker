-- 020_flight_and_offset.sql
-- Two new capture fields (design: docs/design/flight_and_target_offset_brief.md):
--   shot_start   — ball start-line (Pull/Straight/Push), the cause axis paired
--                  with shot_shape (curve).
--   target_offset — where the shot finished vs the pin/target (3×3 grid;
--                  generalizes miss_direction). Diagnostic only, not an SG input.
-- Both are plain text (Zod is the source of truth for enum values, like the rest
-- of the shot fields after migration 013). Nullable; putts and legacy rows stay
-- null.

alter table shots add column if not exists shot_start text;
alter table shots add column if not exists target_offset text;

-- Backfill: a legacy miss_direction (Left/Right/Long/Short) IS a valid
-- target_offset value, so seed the new field from it. miss_direction stays
-- populated for now — existing analytics still read it; deprecate later once the
-- dispersion analytic moves to target_offset.
update shots
set target_offset = miss_direction
where miss_direction is not null and target_offset is null;
