-- 008_start_lie_manual.sql
-- Lets the entry form mark a start_lie as a manual override. The chain recompute
-- (on insert/delete) then preserves overrides instead of clobbering them with
-- the carry-forward default.

alter table shots add column start_lie_manual boolean not null default false;

create or replace function recompute_hole_start_lie(p_round uuid, p_hole int)
returns void language sql as $$
  with seq as (
    select id, shot_no, club, yardage, start_lie_manual,
           lag(club)   over w as prev_club,
           lag(result) over w as prev_result
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
    when seq.prev_result = 'Bunker' and coalesce(seq.yardage,0) > 60 then 'Fairway bunker'
    when seq.prev_result = 'Bunker'                       then 'Greenside bunker'
    when seq.prev_result = 'Recovery'                     then 'Recovery'
    when seq.prev_result in ('OB','Hazard','Lost','Unplayable') then null
    else null
  end
  from seq where s.id = seq.id and seq.start_lie_manual = false;
$$;
