-- Storage Bucket Setup for Learning Materials
-- Run this in Supabase SQL Editor after creating the 'learning-materials' bucket

-- Note: First create the bucket manually in Supabase Dashboard:
-- Storage -> New Bucket -> Name: "learning-materials" -> Public: Yes

-- Then run these policies:

-- Allow authenticated users to upload files
insert into storage.buckets (id, name, public)
values ('learning-materials', 'learning-materials', true)
on conflict (id) do nothing;

-- Policy: Authenticated users can upload their own files
create policy "Authenticated users can upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'learning-materials' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Public can view/download files
create policy "Public can view files"
on storage.objects for select
to public
using (bucket_id = 'learning-materials');

-- Policy: Users can update their own files
create policy "Users can update own files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'learning-materials' 
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own files
create policy "Users can delete own files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'learning-materials' 
  and auth.uid()::text = (storage.foldername(name))[1]
);
