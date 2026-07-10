-- EdTech Mentoring — database schema v2
-- Run this in your Supabase dashboard: SQL Editor -> New query -> paste & run.
-- NOTE: Disable "Confirm email" under Authentication -> Providers -> Email for dev.

-- ── Mentees ────────────────────────────────────────────────────────────────
create table if not exists public.mentee_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  full_name text,
  type text,
  university text,
  job_position text,
  company text,
  looking_for_job text,
  desired_expertise text,
  desired_skills text[],
  profile_picture text,
  phone_number text,
  country text,
  gender text,
  date_of_birth text,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.mentee_profiles enable row level security;

drop policy if exists "Public read mentee_profiles" on public.mentee_profiles;
create policy "Public read mentee_profiles"
  on public.mentee_profiles for select using (true);

drop policy if exists "Owner insert mentee_profiles" on public.mentee_profiles;
create policy "Owner insert mentee_profiles"
  on public.mentee_profiles for insert with check (auth.uid() = user_id);

drop policy if exists "Owner update mentee_profiles" on public.mentee_profiles;
create policy "Owner update mentee_profiles"
  on public.mentee_profiles for update using (auth.uid() = user_id);

-- ── Mentors ─────────────────────────────────────────────────────────────────
create table if not exists public.mentor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  full_name text,
  job_position text,
  company text,
  expertise text not null default '',
  years_experience integer,
  bio text,
  skills text[],
  profile_picture text,
  looking_for_mentee boolean default true,
  status text default 'pending',
  diploma text,
  certifications text[],
  phone_number text,
  country text,
  gender text,
  date_of_birth text,
  github_url text,
  linkedin_url text,
  twitter_url text,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.mentor_profiles enable row level security;

drop policy if exists "Public read mentor_profiles" on public.mentor_profiles;
create policy "Public read mentor_profiles"
  on public.mentor_profiles for select using (true);

drop policy if exists "Owner insert mentor_profiles" on public.mentor_profiles;
create policy "Owner insert mentor_profiles"
  on public.mentor_profiles for insert with check (auth.uid() = user_id);

drop policy if exists "Owner update mentor_profiles" on public.mentor_profiles;
create policy "Owner update mentor_profiles"
  on public.mentor_profiles for update using (auth.uid() = user_id);

-- ── Connections ──────────────────────────────────────────────────────────────
-- Tracks mentor ↔ mentee connections (connect / disconnect)
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  mentee_user_id uuid references auth.users(id) on delete cascade,
  mentor_user_id uuid references auth.users(id) on delete cascade,
  status text default 'connected',   -- 'connected' | 'disconnected'
  created_at timestamptz default now(),
  unique(mentee_user_id, mentor_user_id)
);

alter table public.connections enable row level security;

drop policy if exists "Read own connections" on public.connections;
create policy "Read own connections"
  on public.connections for select using (
    auth.uid() = mentee_user_id or auth.uid() = mentor_user_id
  );

drop policy if exists "Insert own connections" on public.connections;
create policy "Insert own connections"
  on public.connections for insert with check (
    auth.uid() = mentee_user_id or auth.uid() = mentor_user_id
  );

drop policy if exists "Update own connections" on public.connections;
create policy "Update own connections"
  on public.connections for update using (
    auth.uid() = mentee_user_id or auth.uid() = mentor_user_id
  );

-- ── Messages ──────────────────────────────────────────────────────────────────
-- Real-time chat messages between connected users
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) on delete cascade,
  receiver_id uuid references auth.users(id) on delete cascade,
  message text not null,
  status text default 'sent', -- 'sent', 'delivered', 'seen'
  seen_at timestamptz,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

drop policy if exists "Read own messages" on public.messages;
create policy "Read own messages"
  on public.messages for select using (
    auth.uid() = sender_id or auth.uid() = receiver_id
  );

drop policy if exists "Insert own messages" on public.messages;
create policy "Insert own messages"
  on public.messages for insert with check (
    auth.uid() = sender_id
  );

drop policy if exists "Update own messages" on public.messages;
create policy "Update own messages"
  on public.messages for update using (
    auth.uid() = sender_id or auth.uid() = receiver_id
  );

-- ── Admins ───────────────────────────────────────────────────────────────────
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

alter table public.admins enable row level security;

drop policy if exists "Admins read own" on public.admins;
create policy "Admins read own"
  on public.admins for select using (auth.uid() = user_id);

drop policy if exists "Admins insert" on public.admins;
create policy "Admins insert"
  on public.admins for insert with check (auth.role() = 'authenticated');

-- Admin can update mentor status
drop policy if exists "Admin update mentor_profiles" on public.mentor_profiles;
create policy "Admin update mentor_profiles"
  on public.mentor_profiles for update
  using (auth.uid() in (select user_id from public.admins))
  with check (auth.uid() in (select user_id from public.admins));

-- ── Alter existing tables (run if tables already exist) ──────────────────────
alter table public.mentee_profiles add column if not exists full_name text;
alter table public.mentee_profiles add column if not exists phone_number text;
alter table public.mentee_profiles add column if not exists country text;
alter table public.mentee_profiles add column if not exists gender text;
alter table public.mentee_profiles add column if not exists date_of_birth text;
alter table public.mentee_profiles add column if not exists last_seen timestamptz default now();

alter table public.mentor_profiles add column if not exists phone_number text;
alter table public.mentor_profiles add column if not exists country text;
alter table public.mentor_profiles add column if not exists gender text;
alter table public.mentor_profiles add column if not exists date_of_birth text;
alter table public.mentor_profiles add column if not exists github_url text;
alter table public.mentor_profiles add column if not exists linkedin_url text;
alter table public.mentor_profiles add column if not exists twitter_url text;
alter table public.mentor_profiles add column if not exists last_seen timestamptz default now();

-- Add message status columns if not exists
alter table public.messages add column if not exists status text default 'sent';
alter table public.messages add column if not exists seen_at timestamptz;
