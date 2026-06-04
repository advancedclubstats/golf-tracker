-- 006_create_clubs.sql
-- The user's editable club bag. This is the set of clubs offered in the shot
-- entry / edit selectors. `shots.club` is a free string with NO foreign key to
-- this table, so removing a club from the bag never alters logged shots or
-- analytics — historical club strings stay intact.

create table clubs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default '1b3a0171-726e-4c64-a8e0-f97a717f2851'::uuid,
  name        text        not null,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);
create index clubs_user on clubs (user_id);

-- Seed the v1 user's bag from the previous hardcoded CLUBS constant, in order.
insert into clubs (user_id, name, sort_order) values
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', 'D', 0),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', '3W', 1),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', '5W', 2),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', '4i', 3),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', '5i', 4),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', '6i', 5),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', '7i', 6),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', '8i', 7),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', '9i', 8),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', 'PW', 9),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', 'GW', 10),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', 'SW', 11),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', 'LW', 12),
  ('1b3a0171-726e-4c64-a8e0-f97a717f2851', 'Putter', 13);
