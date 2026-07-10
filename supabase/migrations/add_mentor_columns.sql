-- Migration: Add missing columns to mentor_profiles table
-- Run this in Supabase SQL Editor

-- Add missing columns to mentor_profiles
alter table public.mentor_profiles add column if not exists phone_number text;
alter table public.mentor_profiles add column if not exists country text;
alter table public.mentor_profiles add column if not exists gender text;
alter table public.mentor_profiles add column if not exists date_of_birth text;
alter table public.mentor_profiles add column if not exists github_url text;
alter table public.mentor_profiles add column if not exists linkedin_url text;
alter table public.mentor_profiles add column if not exists twitter_url text;
alter table public.mentor_profiles add column if not exists last_seen timestamptz default now();

-- Add missing columns to mentee_profiles (just in case)
alter table public.mentee_profiles add column if not exists phone_number text;
alter table public.mentee_profiles add column if not exists country text;
alter table public.mentee_profiles add column if not exists gender text;
alter table public.mentee_profiles add column if not exists date_of_birth text;
alter table public.mentee_profiles add column if not exists last_seen timestamptz default now();
