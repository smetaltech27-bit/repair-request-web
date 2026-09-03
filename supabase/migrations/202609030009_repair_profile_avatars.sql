-- Approved migration: private employee profile avatars.
alter table public.repair_profiles
  add column if not exists avatar_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'repair_profiles_avatar_path_own_folder'
      and conrelid = 'public.repair_profiles'::regclass
  ) then
    alter table public.repair_profiles
      add constraint repair_profiles_avatar_path_own_folder
      check (
        avatar_path is null
        or split_part(avatar_path, '/', 1) = id::text
      );
  end if;
end;
$$;

comment on column public.repair_profiles.avatar_path is
  'Private Storage object path in the repair-avatars bucket. The first folder is the profile UUID.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'repair-avatars',
  'repair-avatars',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists repair_avatars_read_own on storage.objects;
create policy repair_avatars_read_own
on storage.objects for select to authenticated
using (
  bucket_id = 'repair-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Avatar writes remain server-only. The one-time importer uses the Service API key.
