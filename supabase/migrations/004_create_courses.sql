-- Migration 004: courses, holes, tees, tee yardages
--
-- Additive and nullable: introduces course metadata so par can be defined once
-- per course and the entry flow can pre-fill it. shots.par REMAINS the source
-- of truth for analytics (the par as actually played); courses only provide
-- entry defaults, so existing data and aggregations are unaffected.
--
-- RLS not enabled in v1; user_id present on `courses` for future auth.

create table courses (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null default '1b3a0171-726e-4c64-a8e0-f97a717f2851'::uuid,
  name        text        not null,
  created_at  timestamptz not null default now()
);

create table course_holes (
  id           uuid primary key default uuid_generate_v4(),
  course_id    uuid not null references courses (id) on delete cascade,
  hole_number  int  not null check (hole_number between 1 and 18),
  par          int  not null check (par in (3, 4, 5)),
  unique (course_id, hole_number)
);
create index course_holes_course on course_holes (course_id);

create table course_tees (
  id          uuid primary key default uuid_generate_v4(),
  course_id   uuid not null references courses (id) on delete cascade,
  name        text not null,             -- tee color / name, e.g. 'Blue', 'White'
  color       text,                      -- optional display colour (hex or name)
  sort_order  int  not null default 0,   -- order by length, back -> forward
  unique (course_id, name)
);
create index course_tees_course on course_tees (course_id);

-- Per-hole yardages are optional and can be filled in over time; a row exists
-- only for holes whose yardage is known.
create table tee_yardages (
  id           uuid primary key default uuid_generate_v4(),
  tee_id       uuid not null references course_tees (id) on delete cascade,
  hole_number  int  not null check (hole_number between 1 and 18),
  yardage      int  not null check (yardage > 0),
  unique (tee_id, hole_number)
);
create index tee_yardages_tee on tee_yardages (tee_id);

-- Rounds may reference a course and a tee. Both nullable for backward compat;
-- on delete we null them out rather than cascade (don't lose round/shot data).
alter table rounds
  add column course_id uuid references courses (id)     on delete set null,
  add column tee_id    uuid references course_tees (id) on delete set null;
