-- 011_drop_mulligan.sql
-- Remove the retired "mulligan" / "shots you'd take back" feature. The flag was
-- a standalone, player-judged display stat (a dashboard card + an entry toggle);
-- it never fed scoring or strokes-gained, so dropping it is data-only and safe.
-- Originally added in 002_create_shots.sql.

alter table shots drop column if exists mulligan;
