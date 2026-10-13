-- Migration: Add scan_status columns for mentor documents
-- Run this in Supabase SQL Editor

-- Diploma and certifications can carry a VirusTotal verdict.
-- 'unscanned' = never scanned, 'trusted' = clean, 'blocked' = infected.
alter table public.mentor_profiles
  add column if not exists diploma_scan_status text default 'unscanned';

alter table public.mentor_profiles
  add column if not exists certifications_scan_status text default 'unscanned';

alter table public.mentor_profiles
  drop constraint if exists mentor_profiles_diploma_scan_status_check;

alter table public.mentor_profiles
  add constraint mentor_profiles_diploma_scan_status_check
  check (diploma_scan_status in ('trusted', 'blocked', 'unscanned'));

alter table public.mentor_profiles
  drop constraint if exists mentor_profiles_certifications_scan_status_check;

alter table public.mentor_profiles
  add constraint mentor_profiles_certifications_scan_status_check
  check (certifications_scan_status in ('trusted', 'blocked', 'unscanned'));