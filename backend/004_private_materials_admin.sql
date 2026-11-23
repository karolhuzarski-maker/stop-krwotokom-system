-- STOP KRWOTOKOM SYSTEM
-- SK-01, SK-02 and SK-03: private instructor materials in Supabase Storage.
-- Run AFTER 001_invite_only_access.sql and 003_centrala_sks.sql.
-- The PDF files are uploaded separately from the Central SKS admin UI.
-- Do not copy protected PDFs to the public GitHub Pages repository.
begin;

insert into storage.buckets (id, name, public)
values ('instructor-materials', 'instructor-materials', false)
on conflict (id) do update set public = false;

-- The sole verified Central SKS administrator can read even if their own
-- instructor licence temporarily becomes inactive. Other readers must
-- hold an active instructor authorisation.
drop policy if exists sk_read_private_materials on storage.objects;
create policy sk_read_private_materials on storage.objects
  for select to authenticated
  using (
    bucket_id = 'instructor-materials'
    and (
      (select public.portal_has_access())
      or (select public.portal_is_admin())
    )
  );

-- Browser-side upload and replacement are reserved for the sole admin.
drop policy if exists sk_admin_materials_insert on storage.objects;
create policy sk_admin_materials_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'instructor-materials'
    and (select public.portal_is_admin())
    and name ~ '^SK-[0-9]{2}_[A-Za-z0-9._-]+[.]pdf$'
  );

drop policy if exists sk_admin_materials_update on storage.objects;
create policy sk_admin_materials_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'instructor-materials'
    and (select public.portal_is_admin())
  )
  with check (
    bucket_id = 'instructor-materials'
    and (select public.portal_is_admin())
    and name ~ '^SK-[0-9]{2}_[A-Za-z0-9._-]+[.]pdf$'
  );

commit;
