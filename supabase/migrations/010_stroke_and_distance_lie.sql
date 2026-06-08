-- 010_stroke_and_distance_lie.sql
-- Stroke-and-distance penalties (OB / Lost) are replayed from the same spot, so
-- the next shot's start lie is the penalised shot's *own* start lie — a re-tee
-- stays on the Tee, an approach replayed from the fairway stays Fairway.
-- Previously these fell into the null "unknown drop" bucket and showed "Set lie".
-- Hazard / Unplayable still get a drop of an ambiguous lie → null (prompt).
-- Mirrors nextStartLie() in lib/shots/lie.ts.

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
    when seq.prev_result = 'Bunker' and coalesce(seq.yardage,0) > 60 then 'Fairway bunker'
    when seq.prev_result = 'Bunker'                       then 'Greenside bunker'
    when seq.prev_result = 'Recovery'                     then 'Recovery'
    when seq.prev_result in ('OB','Lost')                 then seq.prev_start_lie
    when seq.prev_result in ('Hazard','Unplayable')       then null
    else null
  end
  from seq where s.id = seq.id and seq.start_lie_manual = false;
$$;
