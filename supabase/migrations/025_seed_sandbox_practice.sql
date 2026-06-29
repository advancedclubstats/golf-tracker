-- 025_seed_sandbox_practice.sql
-- A new sandbox is a full copy of the owner's current app state (courses, clubs,
-- rounds, shots) that the visitor can edit freely and which resets after 24h.
-- Practice games (DL-022) were added after seed_sandbox, so a guest's practice
-- leaderboard started empty instead of mirroring the owner's. Clone the owner's
-- practice_sessions + practice_results into the target too, for parity.
--
-- created_at is set to now() on the clones (like rounds/shots) so purge timing is
-- based on when the sandbox was seeded, not the owner's original timestamps
-- (otherwise the copy would be reaped on the next hourly purge). played_on keeps
-- the owner's original date so the leaderboard reads realistically.

create or replace function public.seed_sandbox(p_target uuid)
returns void
language plpgsql
as $function$
declare
  v_owner uuid := '1b3a0171-726e-4c64-a8e0-f97a717f2851';
begin
  if p_target = v_owner then return; end if;
  if exists (select 1 from rounds where user_id = p_target) then return; end if;

  with
  cmap as materialized (
    select id as old_id, extensions.uuid_generate_v4() as new_id
    from courses where user_id = v_owner
  ),
  ins_courses as (
    insert into courses (id, user_id, name, created_at)
    select cmap.new_id, p_target, c.name, now()
    from courses c join cmap on cmap.old_id = c.id
    returning 1
  ),
  ins_holes as (
    insert into course_holes (id, course_id, hole_number, par, trouble_left, trouble_right)
    select extensions.uuid_generate_v4(), cmap.new_id, h.hole_number, h.par,
           h.trouble_left, h.trouble_right
    from course_holes h join cmap on cmap.old_id = h.course_id
    returning 1
  ),
  tmap as materialized (
    select t.id as old_id, extensions.uuid_generate_v4() as new_id, cmap.new_id as new_course
    from course_tees t join cmap on cmap.old_id = t.course_id
  ),
  ins_tees as (
    insert into course_tees (id, course_id, name, color, sort_order)
    select tmap.new_id, tmap.new_course, t.name, t.color, t.sort_order
    from course_tees t join tmap on tmap.old_id = t.id
    returning 1
  ),
  ins_yard as (
    insert into tee_yardages (id, tee_id, hole_number, yardage)
    select extensions.uuid_generate_v4(), tmap.new_id, y.hole_number, y.yardage
    from tee_yardages y join tmap on tmap.old_id = y.tee_id
    returning 1
  ),
  ins_clubs as (
    insert into clubs (id, user_id, name, sort_order, created_at)
    select extensions.uuid_generate_v4(), p_target, c.name, c.sort_order, now()
    from clubs c where c.user_id = v_owner
    returning 1
  ),
  rmap as materialized (
    select id as old_id, extensions.uuid_generate_v4() as new_id
    from rounds where user_id = v_owner
  ),
  ins_rounds as (
    insert into rounds (id, user_id, date, session_type, notes, created_at,
                        course_id, tee_id, starting_hole)
    select rmap.new_id, p_target, r.date, r.session_type, r.notes, now(),
           cmap.new_id, tmap.new_id, r.starting_hole
    from rounds r
    join rmap on rmap.old_id = r.id
    left join cmap on cmap.old_id = r.course_id
    left join tmap on tmap.old_id = r.tee_id
    where r.user_id = v_owner
    returning 1
  )
  insert into shots (id, user_id, round_id, hole, par, shot_no, club, yardage,
                     execution, result, miss_direction, putt_side, putt_length,
                     penalty, notes, created_at, conceded, start_lie,
                     distance_unit, start_lie_manual, decision_quality,
                     obstruction, shot_shape, shot_contact)
  select extensions.uuid_generate_v4(), p_target, rmap.new_id, s.hole, s.par,
         s.shot_no, s.club, s.yardage, s.execution, s.result, s.miss_direction,
         s.putt_side, s.putt_length, s.penalty, s.notes, now(), s.conceded,
         s.start_lie, s.distance_unit, s.start_lie_manual, s.decision_quality,
         s.obstruction, s.shot_shape, s.shot_contact
  from shots s
  join rmap on rmap.old_id = s.round_id
  where s.user_id = v_owner;

  -- Practice games (DL-022): clone the owner's sessions + per-ball results.
  with pmap as materialized (
    select id as old_id, extensions.uuid_generate_v4() as new_id
    from practice_sessions where user_id = v_owner
  ),
  ins_sessions as (
    insert into practice_sessions (id, user_id, game_id, played_on, created_at)
    select pmap.new_id, p_target, ps.game_id, ps.played_on, now()
    from practice_sessions ps join pmap on pmap.old_id = ps.id
    returning 1
  )
  insert into practice_results (id, session_id, station_index, ball_index,
                                strokes, putts, finish)
  select extensions.uuid_generate_v4(), pmap.new_id, pr.station_index,
         pr.ball_index, pr.strokes, pr.putts, pr.finish
  from practice_results pr
  join pmap on pmap.old_id = pr.session_id;
end;
$function$;
