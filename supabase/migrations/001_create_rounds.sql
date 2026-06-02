-- Migration 001: rounds table
-- D-01: no total_score column — score is always derived from shots at query time.
-- D-03: session_type stored as short key (Full18 / Practice9 / Practice6 / Practice3).
--       No CHECK constraint — validation lives in Zod (lib/schemas/round.ts).
-- RLS: user_id column present for future auth; RLS not enabled in v1.

create extension if not exists "uuid-ossp";

create table rounds (
  id            uuid         primary key default uuid_generate_v4(),
  -- v1 hardcoded user. Post-v1: replace default with auth.uid() and enable RLS.
  user_id       uuid         not null default '1b3a0171-726e-4c64-a8e0-f97a717f2851'::uuid,
  date          date         not null,
  session_type  text         not null,
  notes         text,
  created_at    timestamptz  not null default now()
);

-- Supports "all rounds for this user, newest first" — used by dashboard + round list.
create index rounds_user_date on rounds (user_id, date desc);
