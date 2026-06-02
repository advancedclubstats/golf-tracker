-- Migration 003: par consistency trigger (D-09)
-- Rejects any insert/update where the par value differs from existing shots
-- on the same (round_id, hole). A fat-finger typo would silently corrupt GIR
-- and strokes-lost calculations, so we catch it at the DB level.

create or replace function check_par_consistency()
returns trigger as $$
declare
  existing_par int;
begin
  select par into existing_par
  from   shots
  where  round_id = new.round_id
    and  hole     = new.hole
    and  id      != new.id   -- exclude the row being updated
  limit 1;

  if existing_par is not null and existing_par <> new.par then
    raise exception
      'Par mismatch on hole %: existing shots have par %, tried to set par %',
      new.hole, existing_par, new.par;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger shots_par_consistency
  before insert or update on shots
  for each row
  execute function check_par_consistency();
