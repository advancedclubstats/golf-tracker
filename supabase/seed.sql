-- Seed file: v1 constants
--
-- V1_USER_ID is the hardcoded user identity for all rows until Supabase Auth
-- is added post-v1. It is referenced in:
--   - supabase/migrations/001_create_rounds.sql  (column default)
--   - supabase/migrations/002_create_shots.sql   (column default)
--   - lib/supabase/client.ts                     (used in server actions)
--
-- To add real auth post-v1:
--   1. Enable RLS on rounds and shots
--   2. Add policies: using (user_id = auth.uid())
--   3. Create a real Supabase Auth user, note their UUID
--   4. Run: update rounds set user_id = '<real-uuid>' where user_id = '1b3a0171-726e-4c64-a8e0-f97a717f2851';
--           update shots  set user_id = '<real-uuid>' where user_id = '1b3a0171-726e-4c64-a8e0-f97a717f2851';
--   5. Remove the hardcoded defaults from the migration files

-- No rows to insert in v1 seed — the default UUID is baked into the table definitions.
-- This file exists to document the constant and the migration path.

-- V1_USER_ID = '1b3a0171-726e-4c64-a8e0-f97a717f2851'
