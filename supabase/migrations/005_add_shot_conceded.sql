-- Migration 005: pick up / concede a hole (match-play)
--
-- A shot flagged `conceded` marks its hole as intentionally unfinished (the
-- player picked up). The hole still does NOT count toward scoring (it has no
-- 'Make'), so analytics are unaffected — but it can be labelled "Picked up"
-- rather than "In progress", distinguishing a concession from a data-entry gap.
-- The shots that were played still count toward club/distance stats.

alter table shots
  add column conceded boolean not null default false;
