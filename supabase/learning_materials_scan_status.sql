-- ── Virus-scan status for learning materials ────────────────────────────────
-- Adds a scan_status column so the UI can show which materials passed the
-- ClamAV check ("trusted") versus which were uploaded before scanning existed.
--
-- Run this once in the Supabase SQL Editor.

-- 1) New column. Existing rows are marked 'trusted' (they predate the scanner)
--    so nothing appears broken for data that is already public.
alter table public.learning_materials
  add column if not exists scan_status text not null default 'trusted';

-- 2) Convenience: an index is not needed for a low-cardinality flag, but a
--    check constraint keeps bad values out.
alter table public.learning_materials
  drop constraint if exists learning_materials_scan_status_check;

alter table public.learning_materials
  add constraint learning_materials_scan_status_check
  check (scan_status in ('trusted', 'blocked', 'unscanned'));

-- 3) Backfill: anything uploaded before the scanner existed stays 'trusted'.
update public.learning_materials
set scan_status = 'trusted'
where scan_status is null or scan_status = '';

-- 4) Verify
-- select scan_status, count(*) from public.learning_materials group by scan_status;
