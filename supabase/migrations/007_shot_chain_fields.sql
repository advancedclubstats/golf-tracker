-- 007_shot_chain_fields.sql
-- Strokes-gained groundwork (Option A, additive). Adds the shot-chain capture
-- fields + hole trouble geometry. All nullable; legacy analytics untouched.
-- `yardage` stays canonical in YARDS; `distance_unit` is a display hint
-- ('ft' => show yardage*3, for putts / on the green).

alter table shots
  add column start_lie         text,
  add column distance_unit     text,
  add column situation_created text,
  add column short_sided       boolean;

alter table course_holes
  add column trouble_left  text[] not null default '{}',
  add column trouble_right text[] not null default '{}';

-- Per-hole start-lie recompute: used by the initial backfill below and by
-- insert/delete (actions/shots.ts) to keep the chain consistent when shot
-- positions shift. NOTE (step 4): once the entry form lets a player OVERRIDE
-- start_lie, this must preserve overrides rather than overwrite.
create or replace function recompute_hole_start_lie(p_round uuid, p_hole int)
returns void language sql as $$
  with seq as (
    select id, shot_no, club, yardage,
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
  from seq where s.id = seq.id;
$$;

grant execute on function recompute_hole_start_lie(uuid, int) to anon, authenticated, service_role;

-- Initial backfill across all holes (same carry-forward + "untagged shot before
-- a putt reached the green" inference, validated by scripts/sg-prototype.mjs).
with seq as (
  select id, round_id, hole, shot_no, club, yardage,
         lag(club)   over w as prev_club,
         lag(result) over w as prev_result
  from shots
  window w as (partition by round_id, hole order by shot_no)
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
from seq where s.id = seq.id;

-- distance_unit: putts display in feet (= yardage*3), full shots in yards.
update shots set distance_unit = case when club = 'Putter' then 'ft' else 'yd' end
where distance_unit is null;
