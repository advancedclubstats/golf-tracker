-- 019_collapse_bunker_lie.sql
-- Collapse the three sand-family start lies (Fairway bunker / Greenside bunker /
-- Sand) into a single "Bunker". The distinction was never analytical — all three
-- already routed to the one Sand baseline table and the same SG category logic
-- (sg-baseline.ts `tableFor`, sg.ts `SAND_LIES`). But the carry-forward defaulted
-- every bunker finish to "Greenside bunker", mislabelling fairway bunkers off the
-- tee. `start_lie` is plain text (no CHECK constraint); Zod (`START_LIES`) is the
-- source of truth and now offers only "Bunker".

-- 1) Backfill existing rows to the single value.
update shots
set start_lie = 'Bunker'
where start_lie in ('Fairway bunker', 'Greenside bunker', 'Sand');

-- 2) Carry-forward recompute: a Bunker finish now leaves a plain "Bunker" lie
-- (drop the >60yd fairway/greenside split). Mirrors nextStartLie() in
-- lib/shots/lie.ts. Everything else is unchanged from migration 010.
create or replace function recompute_hole_start_lie(p_round uuid, p_hole int)
returns void language sql as $$
  with seq as (
    select id, shot_no, club, yardage, start_lie_manual,
           lag(club)      over w as prev_club,
           lag(result)    over w as prev_result,
           lag(start_lie) over w as prev_start_lie
    from shots
    where round_id = p_round and hole = p_hole
    window w as (order by shot_no)
  )
  update shots s set start_lie = case
    when seq.shot_no = 1                                  then 'Tee'
    when seq.prev_club = 'Putter'                         then 'Green'
    when seq.prev_result is null and seq.club = 'Putter'  then 'Green'
    when seq.prev_result = 'Fairway'                      then 'Fairway'
    when seq.prev_result = 'Green'                        then 'Green'
    when seq.prev_result = 'Fringe'                       then 'Fringe'
    when seq.prev_result = 'Rough'                        then 'Rough'
    when seq.prev_result = 'Bunker'                       then 'Bunker'
    when seq.prev_result = 'Recovery'                     then 'Recovery'
    when seq.prev_result in ('OB','Lost')                 then seq.prev_start_lie
    when seq.prev_result in ('Hazard','Unplayable')       then null
    else null
  end
  from seq where s.id = seq.id and seq.start_lie_manual = false;
$$;
