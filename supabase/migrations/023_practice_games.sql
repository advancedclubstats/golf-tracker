-- 023_practice_games.sql
-- Practice games (DL-022): SG-scored, repeatable practice drills with a personal
-- leaderboard. DELIBERATELY WALLED OFF from real rounds.
--
-- Hard requirement (DL-022): a practice game must NEVER pollute the round/shot
-- analytics. So practice data lives in its own two tables and the `shots` /
-- `rounds` tables are never touched. No real-round analytic reads these; the
-- practice SG path reads only `practice_*`.
--
-- Walling note vs D-08: D-08 says practice *rounds* (logged in `rounds`) count in
-- all analytics on purpose. This is a DIFFERENT entity — a practice *game* — that
-- deliberately does NOT count in real-round analytics. Different table, not a
-- re-open of D-08.
--
-- Design mirrors the rest of the app:
--   * Games themselves are CODE config (lib/practice/games.ts), so `game_id` here
--     is just a text key — adding a game is a code deploy, not a DB change (D-02).
--   * Derived numbers (score, score-to-par, SG, leaderboard rank) are NOT stored
--     (D-01) — only the raw per-ball strokes. Everything else is computed.
--   * Scoped by user_id like rounds/shots, so sandbox visitors get isolated
--     practice data (enforced in the app query layer; this app has no RLS).

create table if not exists public.practice_sessions (
  id         uuid primary key default extensions.uuid_generate_v4(),
  user_id    uuid not null,
  -- Code-defined game key (lib/practice/games.ts), e.g. 'zone-9'. Text, not an
  -- FK — games live in code (D-02), so there is no games table to reference.
  game_id    text not null,
  -- The day the session was practiced (YYYY-MM-DD). Defaults to today in the UI.
  played_on  date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.practice_results (
  id            uuid primary key default extensions.uuid_generate_v4(),
  session_id    uuid not null references public.practice_sessions (id) on delete cascade,
  -- Index into the game's `stations` array (lib/practice/games.ts), 0-based.
  station_index int not null,
  -- Index of the ball within that station, 0-based.
  ball_index    int not null,
  -- Strokes taken to hole this ball out (the one required input; >= 1).
  strokes       int not null check (strokes >= 1),
  -- Optional color, never required: putts taken and how the ball finished.
  putts         int,
  finish        text
);

-- Leaderboard + entry both read a user's sessions for one game, newest first.
create index if not exists practice_sessions_user_game_idx
  on public.practice_sessions (user_id, game_id, played_on desc);

-- Results are always loaded by their session.
create index if not exists practice_results_session_idx
  on public.practice_results (session_id);
