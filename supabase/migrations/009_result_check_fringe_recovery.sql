-- 009_result_check_fringe_recovery.sql
-- The shots.result CHECK (from 002) predated the strokes-gained work, which
-- added the Fringe and Recovery finish zones to the app/Zod enum but not to this
-- constraint. Selecting either threw a check violation (surfaced in production
-- as a redacted "Server Components render" error). Widen the constraint to match
-- RESULTS in lib/constants.ts.

alter table shots drop constraint shots_result_check;
alter table shots add constraint shots_result_check
  check (
    result = any (array[
      'Fairway','Green','Fringe','Rough','Bunker','Recovery',
      'OB','Hazard','Lost','Unplayable','Make'
    ]::text[])
    or result is null
  );
