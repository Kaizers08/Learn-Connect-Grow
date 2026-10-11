-- ── ClamAV virus-scan support for learning materials ─────────────────────────
-- Mentor uploads are staged under a "quarantine/" prefix in the SAME public
-- bucket and are NOT publicly readable there. The Edge Function
-- `scan-learning-material` streams them to ClamAV via a short-lived signed URL.
-- On a clean verdict the object is *renamed* to its published path (a cheap
-- server-side move, no bytes are re-uploaded — this matters on the Supabase
-- free tier where an Edge Function has only 256MB of memory). Infected files are
-- deleted from quarantine and never published.
--
-- Run this once in the Supabase SQL Editor (after supabase/storage-setup.sql).

-- 0) Clean up an earlier two-bucket version of this file, if it was run.
--    Policy drops are guarded with `if exists`, so re-running is safe.
--    NOTE: the old `learning-materials-quarantine` bucket is NOT deleted here —
--    Supabase blocks direct DELETEs on storage tables ("Direct deletion from
--    storage tables is not allowed"). Remove it in the Dashboard instead:
--    Storage -> learning-materials-quarantine -> Delete. It is unused by the
--    current design and harmless if left behind.
drop policy if exists "Mentors stage own quarantine files" on storage.objects;
drop policy if exists "Mentors read own quarantine files" on storage.objects;
drop policy if exists "Mentors delete own quarantine files" on storage.objects;

-- 1) The published bucket (public). Created by storage-setup.sql; recreated
--    here so this file works standalone.
insert into storage.buckets (id, name, public)
values ('learning-materials', 'learning-materials', true)
on conflict (id) do nothing;

-- 2) Quarantine is a PREFIX inside that bucket:
--      learning-materials/quarantine/<user-id>/<file-name>   (not public)
--      learning-materials/<user-id>/<file-name>              (public)
--
--    Any path that is not under "quarantine/" stays readable by the public.

-- ── INSERT: a mentor may only stage/publish inside their own user folder ──────
drop policy if exists "Mentors insert own materials" on storage.objects;
create policy "Mentors insert own materials"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'learning-materials'
    and (
      -- published file:               <uid>/<name>
      (storage.foldername(name))[1] = auth.uid()::text
      -- quarantined file: quarantine/<uid>/<name>
      or (
        (storage.foldername(name))[1] = 'quarantine'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- ── SELECT: published files are public, quarantine files are not ─────────────
drop policy if exists "Public can view files" on storage.objects;
create policy "Public can view files"
  on storage.objects for select
  using (
    bucket_id = 'learning-materials'
    and (storage.foldername(name))[1] <> 'quarantine'
  );

-- The owner (and therefore the scanning Edge Function, which uses the mentor's
-- JWT) can still read their own quarantined staging copy.
drop policy if exists "Mentors read own quarantine files" on storage.objects;
create policy "Mentors read own quarantine files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'learning-materials'
    and (storage.foldername(name))[1] = 'quarantine'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ── UPDATE / DELETE: mentors manage only their own files, both locations ─────
drop policy if exists "Mentors manage own materials" on storage.objects;
create policy "Mentors manage own materials"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'learning-materials'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'quarantine'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists "Mentors delete own materials" on storage.objects;
create policy "Mentors delete own materials"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'learning-materials'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'quarantine'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- Note: "Mentors manage own materials" on UPDATE is what permits the Edge
-- Function's move() from quarantine/<uid>/<name> to <uid>/<name> using the
-- mentor's own token (move = rename the source, create the destination).
