-- ── Learning Materials ──────────────────────────────────────────────────────
-- Stores learning materials uploaded by mentors
create table if not exists public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  module_number integer not null, -- e.g., 1, 2, 3
  lesson_number integer not null, -- e.g., 1, 2, 3 (1.1, 1.2, 2.1, etc.)
  file_url text not null,
  file_type text not null, -- 'video', 'pdf', 'document', 'image', etc.
  file_size integer, -- in bytes
  order_index integer not null, -- for sorting within module
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(mentor_user_id, module_number, lesson_number)
);

alter table public.learning_materials enable row level security;

-- Mentor can CRUD their own materials
drop policy if exists "Mentor read own materials" on public.learning_materials;
create policy "Mentor read own materials"
  on public.learning_materials for select using (
    auth.uid() = mentor_user_id
  );

drop policy if exists "Mentor insert own materials" on public.learning_materials;
create policy "Mentor insert own materials"
  on public.learning_materials for insert with check (
    auth.uid() = mentor_user_id
  );

drop policy if exists "Mentor update own materials" on public.learning_materials;
create policy "Mentor update own materials"
  on public.learning_materials for update using (
    auth.uid() = mentor_user_id
  );

drop policy if exists "Mentor delete own materials" on public.learning_materials;
create policy "Mentor delete own materials"
  on public.learning_materials for delete using (
    auth.uid() = mentor_user_id
  );

-- Mentees can read materials from their connected mentors
drop policy if exists "Mentee read connected mentor materials" on public.learning_materials;
create policy "Mentee read connected mentor materials"
  on public.learning_materials for select using (
    mentor_user_id in (
      select mentor_user_id from public.connections
      where mentee_user_id = auth.uid() and status = 'connected'
    )
  );

-- ── Material Progress ────────────────────────────────────────────────────────
-- Tracks mentee progress on learning materials
create table if not exists public.material_progress (
  id uuid primary key default gen_random_uuid(),
  mentee_user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.learning_materials(id) on delete cascade,
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(mentee_user_id, material_id)
);

alter table public.material_progress enable row level security;

-- Mentee can read/update their own progress
drop policy if exists "Mentee read own progress" on public.material_progress;
create policy "Mentee read own progress"
  on public.material_progress for select using (
    auth.uid() = mentee_user_id
  );

drop policy if exists "Mentee insert own progress" on public.material_progress;
create policy "Mentee insert own progress"
  on public.material_progress for insert with check (
    auth.uid() = mentee_user_id
  );

drop policy if exists "Mentee update own progress" on public.material_progress;
create policy "Mentee update own progress"
  on public.material_progress for update using (
    auth.uid() = mentee_user_id
  );

-- Mentor can read progress of their mentees
drop policy if exists "Mentor read mentee progress" on public.material_progress;
create policy "Mentor read mentee progress"
  on public.material_progress for select using (
    auth.uid() = mentor_user_id
  );

-- Indexes for performance
create index if not exists material_mentor_idx on public.learning_materials(mentor_user_id);
create index if not exists material_module_lesson_idx on public.learning_materials(module_number, lesson_number);
create index if not exists progress_mentee_idx on public.material_progress(mentee_user_id);
create index if not exists progress_material_idx on public.material_progress(material_id);
create index if not exists progress_mentor_idx on public.material_progress(mentor_user_id);

-- View for mentor to see aggregated progress per mentee
create or replace view public.mentee_material_progress as
select 
  mp.mentor_user_id,
  mp.mentee_user_id,
  mentee.full_name as mentee_name,
  mentee.profile_picture as mentee_picture,
  count(lm.id) as total_materials,
  count(case when mp.completed = true then 1 end) as completed_materials,
  round((count(case when mp.completed = true then 1 end)::numeric / nullif(count(lm.id), 0)) * 100, 1) as progress_percentage
from public.learning_materials lm
left join public.material_progress mp on lm.id = mp.material_id
left join public.mentee_profiles mentee on mp.mentee_user_id = mentee.user_id
where lm.mentor_user_id = auth.uid()
group by mp.mentor_user_id, mp.mentee_user_id, mentee.full_name, mentee.profile_picture;
