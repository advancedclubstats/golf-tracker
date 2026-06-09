-- 012_decision_quality.sql
-- spec 1A: the ONE new field SG cannot compute. SG prices outcomes; this flag
-- separates process from outcome, splitting lost strokes into execution loss
-- (Good decision, executed poorly → fix by practice) and decision loss (Bad
-- decision → fix by thinking). One tap in the wizard, default Good so the common
-- case is zero-friction; the player only flags a genuine mental/strategic
-- mistake. Existing rows backfill to 'Good' (NOT NULL DEFAULT).
--
-- Trigger discipline (owner's words): flag Bad only for too-much-risk /
-- wrong-club / wrong-line / acted-hastily. A good decision with a poor result
-- inside normal dispersion stays Good — that is variance, not error.

alter table shots
  add column if not exists decision_quality text not null default 'Good'
    check (decision_quality in ('Good', 'Bad'));
