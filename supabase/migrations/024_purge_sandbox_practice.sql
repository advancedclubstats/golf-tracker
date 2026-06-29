-- 024_purge_sandbox_practice.sql
-- Practice games (DL-022) added two sandbox-scoped tables AFTER purge_sandboxes
-- was written (017/018), so abandoned sandboxes' practice sessions were never
-- reaped. Extend the hourly purge to drop them too, matching rounds/courses/clubs
-- (practice_results cascade via the session FK). Owner rows are never touched.

create or replace function public.purge_sandboxes()
returns void
language sql
as $$
  delete from rounds            where user_id <> '1b3a0171-726e-4c64-a8e0-f97a717f2851' and created_at < now() - interval '24 hours';
  delete from courses           where user_id <> '1b3a0171-726e-4c64-a8e0-f97a717f2851' and created_at < now() - interval '24 hours';
  delete from clubs             where user_id <> '1b3a0171-726e-4c64-a8e0-f97a717f2851' and created_at < now() - interval '24 hours';
  delete from practice_sessions where user_id <> '1b3a0171-726e-4c64-a8e0-f97a717f2851' and created_at < now() - interval '24 hours';
$$;
