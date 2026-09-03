-- Local design only. Do not apply to a Supabase project without explicit approval.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'repair-images',
  'repair-images',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy repair_images_insert_own_folder
on storage.objects for insert to authenticated
with check (
  bucket_id = 'repair-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy repair_images_read_authorized
on storage.objects for select to authenticated
using (
  bucket_id = 'repair-images'
  and (
    owner_id = auth.uid()::text
    or exists (
      select 1
      from public.repair_request_attachments attachment
      where attachment.storage_path = storage.objects.name
        and public.repair_can_view_request(attachment.request_id)
    )
  )
);

create policy repair_images_delete_unlinked_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'repair-images'
  and owner_id = auth.uid()::text
  and not exists (
    select 1 from public.repair_request_attachments attachment
    where attachment.storage_path = storage.objects.name
  )
);

