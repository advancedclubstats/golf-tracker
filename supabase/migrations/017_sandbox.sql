-- Sandbox for logged-out visitors.
--
-- Visitors get an isolated copy of the owner's data under a random user_id
-- (the gt_sandbox cookie). They can log/edit/delete freely without touching the
-- owner's rows. Two pieces live in the DB:
--   * seed_sandbox(p_target)  — clone owner rounds+shots into a sandbox (once)
--   * purge_sandboxes()       — reap abandoned sandboxes (pg_cron, hourly)
--
-- Isolation itself is enforced in the app query layer (see lib/auth/scope.ts);
-- this app has no RLS.

-- ── Seed: clone the owner's rounds + shots into a target sandbox user ────────
create or replace function public.seed_sandbox(p_target uuid)
returns void
language plpgsql
as $$
declare
  v_owner uuid := '1b3a0171-726e-4c64-a8e0-f97a717f2851';
begin
  -- Never clone into the owner, and only seed an empty sandbox (idempotent).
  if p_target = v_owner then return; end if;
  if exists (select 1 from rounds where user_id = p_target) then return; end if;

  -- `as materialized` so each owner round's new id is generated once and reused
  -- for both the round insert and its shots' round_id remap.
  with src as materialized (
    select
      id as old_id,
      extensions.uuid_generate_v4() as new_id,
      date, session_type, notes, course_id, tee_id, starting_hole
    from rounds
    where user_id = v_owner
  ),
  ins_rounds as (
    insert into rounds (id, user_id, date, session_type, notes, created_at,
                        course_id, tee_id, starting_hole)
    select new_id, p_target, date, session_type, notes, now(),
           course_id, tee_id, starting_hole
    from src
    returning 1
  )
  insert into shots (id, user_id, round_id, hole, par, shot_no, club, yardage,
                     execution, result, miss_direction, putt_side, putt_length,
                     penalty, notes, created_at, conceded, start_lie,
                     distance_unit, situation_created, short_sided,
                     start_lie_manual, decision_quality, obstruction,
                     shot_shape, shot_contact)
  select extensions.uuid_generate_v4(), p_target, src.new_id, s.hole, s.par,
         s.shot_no, s.club, s.yardage, s.execution, s.result, s.miss_direction,
         s.putt_side, s.putt_length, s.penalty, s.notes, now(), s.conceded,
         s.start_lie, s.distance_unit, s.situation_created, s.short_sided,
         s.start_lie_manual, s.decision_quality, s.obstruction, s.shot_shape,
         s.shot_contact
  from shots s
  join src on src.old_id = s.round_id
  where s.user_id = v_owner;
end;
$$;

-- ── Purge: drop abandoned sandbox data (shots cascade via FK) ────────────────
create or replace function public.purge_sandboxes()
returns void
language sql
as $$
  delete from rounds
  where user_id <> '1b3a0171-726e-4c64-a8e0-f97a717f2851'
    and created_at < now() - interval '24 hours';
$$;

-- ── Schedule the purge hourly via pg_cron ───────────────────────────────────
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('purge-sandboxes');
exception when others then
  null; -- not scheduled yet
end $$;

select cron.schedule('purge-sandboxes', '0 * * * *', $$select public.purge_sandboxes();$$);
