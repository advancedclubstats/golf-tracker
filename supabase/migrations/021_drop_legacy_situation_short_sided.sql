-- 021_drop_legacy_situation_short_sided.sql
-- Drop the two retired capture columns. Collection stopped with T6 (spec v1,
-- Phase 3 "Subtraction"): the wizard no longer writes situation_created or
-- short_sided, the SG situation breakdown was removed, and nothing in the
-- analytics / actions / queries reads them anymore (only the Zod schema still
-- permitted them). The columns held partial legacy data only; this drop is the
-- deferred cleanup from that decision.

alter table shots drop column if exists situation_created;
alter table shots drop column if exists short_sided;
