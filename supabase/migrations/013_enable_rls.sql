-- 013_enable_rls.sql
-- Make the data private again. Re-enable Row Level Security on every table.
--
-- No policies are created, so RLS denies everything by default for the public
-- anon key — the only key shipped to the browser can now read/write NOTHING.
-- The server (lib/supabase/server.ts) uses the service_role key, which BYPASSES
-- RLS, so the app keeps working. Combined with the proxy.ts password gate, this
-- makes the deployed single-user data private even though there is no per-user
-- auth yet.
--
-- PRECONDITION: SUPABASE_SERVICE_ROLE_KEY must be set in every environment
-- (.env.local and Vercel) before this is applied, or the app (falling back to
-- the anon key) will be denied. See docs/DEPLOY.md.
--
-- Reverse: alter table <t> disable row level security;

alter table rounds        enable row level security;
alter table shots         enable row level security;
alter table courses       enable row level security;
alter table course_holes  enable row level security;
alter table course_tees   enable row level security;
alter table tee_yardages  enable row level security;
alter table clubs         enable row level security;
