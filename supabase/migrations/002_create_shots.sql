-- Migration 002: shots table
-- D-02: no CHECK constraint on club — validation lives in Zod (lib/schemas/shot.ts).
-- D-09: par consistency enforced by trigger in 003_par_consistency_trigger.sql.
-- RLS: user_id column present for future auth; RLS not enabled in v1.

create table shots (
  id             uuid         primary key default uuid_generate_v4(),
  -- v1 hardcoded user. Post-v1: replace default with auth.uid() and enable RLS.
  user_id        uuid         not null default '1b3a0171-726e-4c64-a8e0-f97a717f2851'::uuid,
  round_id       uuid         not null references rounds (id) on delete cascade,
  hole           int          not null check (hole between 1 and 18),
  par            int          not null check (par in (3, 4, 5)),
  shot_no        int          not null check (shot_no >= 1),
  club           text         not null,
  yardage        numeric      check (yardage >= 0),
  execution      int          check (execution between 1 and 4),
  -- result / miss_direction / putt_side / putt_length: CHECK constraints here are
  -- belt-and-suspenders; Zod is the primary validation layer.
  result         text         check (result in (
                                'Fairway', 'Green', 'Rough', 'Bunker',
                                'OB', 'Hazard', 'Lost', 'Unplayable', 'Make'
                              ) or result is null),
  miss_direction text         check (miss_direction in ('Left', 'Right', 'Long', 'Short')
                                or miss_direction is null),
  putt_side      text         check (putt_side in ('High', 'Low')
                                or putt_side is null),
  putt_length    text         check (putt_length in ('Short', 'Long')
                                or putt_length is null),
  mulligan       boolean      not null default false,
  penalty        int          not null default 0 check (penalty >= 0),
  notes          text,
  created_at     timestamptz  not null default now(),

  -- Prevents duplicate shot numbers on the same hole in the same round.
  unique (round_id, hole, shot_no)
);

-- Fetch all shots for a round (most common query).
create index shots_round_id      on shots (round_id);

-- Per-hole aggregation in analytics: group by hole, order by shot_no.
create index shots_round_hole_sn on shots (round_id, hole, shot_no);

-- Club summary page: all shots for this user grouped by club.
create index shots_user_club     on shots (user_id, club);

-- Hole summary page: all shots for this user grouped by hole.
create index shots_user_hole     on shots (user_id, hole);
