create table if not exists public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  mentor_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  order_number text not null,
  file_url text,
  file_type text,
  file_name text,
  duration_minutes integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.learning_materials enable row level security;

drop policy if exists "Mentor can manage own materials" on public.learning_materials;

create policy "Mentor can manage own materials"
on public.learning_materials
for all
using (auth.uid() = mentor_user_id)
with check (auth.uid() = mentor_user_id);

drop policy if exists "Connected mentees can view materials" on public.learning_materials;

create policy "Connected mentees can view materials"
on public.learning_materials
for select
using (
  auth.uid() = mentor_user_id
  or exists (
    select 1
    from public.connections
    where connections.mentor_user_id = learning_materials.mentor_user_id
      and connections.mentee_user_id = auth.uid()
      and connections.status = 'connected'
  )
);

create table if not exists public.material_progress (
  id uuid primary key default gen_random_uuid(),
  mentee_user_id uuid not null references auth.users(id) on delete cascade,
  material_id uuid not null references public.learning_materials(id) on delete cascade,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(mentee_user_id, material_id)
);

alter table public.material_progress enable row level security;

drop policy if exists "Mentee can manage own progress" on public.material_progress;

create policy "Mentee can manage own progress"
on public.material_progress
for all
using (auth.uid() = mentee_user_id)
with check (auth.uid() = mentee_user_id);

drop policy if exists "Mentor can view mentee progress" on public.material_progress;

create policy "Mentor can view mentee progress"
on public.material_progress
for select
using (
  exists (
    select 1
    from public.connections c
    join public.learning_materials lm on lm.id = material_progress.material_id
    where c.mentee_user_id = material_progress.mentee_user_id
      and c.mentor_user_id = auth.uid()
      and c.status = 'connected'
      and lm.mentor_user_id = auth.uid()
  )
);

create index if not exists learning_materials_mentor_idx on public.learning_materials(mentor_user_id);
create index if not exists learning_materials_order_idx on public.learning_materials(order_number);
create index if not exists material_progress_mentee_idx on public.material_progress(mentee_user_id);
create index if not exists material_progress_material_idx on public.material_progress(material_id);
