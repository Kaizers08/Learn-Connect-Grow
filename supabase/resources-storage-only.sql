insert into storage.buckets (id, name, public)
values ('learning-materials', 'learning-materials', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can upload learning materials" on storage.objects;

create policy "Authenticated users can upload learning materials"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'learning-materials'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Public can view learning materials" on storage.objects;

create policy "Public can view learning materials"
on storage.objects
for select
to public
using (bucket_id = 'learning-materials');

drop policy if exists "Users can update own learning materials" on storage.objects;

create policy "Users can update own learning materials"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'learning-materials'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'learning-materials'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own learning materials" on storage.objects;

create policy "Users can delete own learning materials"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'learning-materials'
  and auth.uid()::text = (storage.foldername(name))[1]
);
