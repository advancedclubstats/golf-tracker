-- Recreate seed_sandbox without the retired situation_created / short_sided
-- columns. Migration 021 dropped those columns from `shots`, but seed_sandbox
-- (last defined in 018) still listed them in its final insert. The function
-- therefore errored at runtime, and because <SandboxBootstrap> swallows seed
-- failures, every visitor landed on a blank sandbox instead of a seeded copy
-- of the owner's rounds. This drops the two columns from the clone; everything
-- else matches 018.

create or replace function public.seed_sandbox(p_target uuid)
returns void
language plpgsql
as $$
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
end;
$$;
