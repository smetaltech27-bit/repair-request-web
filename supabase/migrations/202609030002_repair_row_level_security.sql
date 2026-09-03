-- Local design only. Do not apply to a Supabase project without explicit approval.
alter table public.repair_departments enable row level security;
alter table public.repair_profiles enable row level security;
alter table public.repair_job_sequences enable row level security;
alter table public.repair_requests enable row level security;
alter table public.repair_request_actions enable row level security;
alter table public.repair_request_attachments enable row level security;
alter table public.repair_notifications enable row level security;
alter table public.repair_legacy_import_rows enable row level security;

revoke all on table public.repair_job_sequences from anon, authenticated;
revoke all on table public.repair_legacy_import_rows from anon, authenticated;

create or replace function public.repair_current_user_role()
returns public.repair_app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.repair_profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.repair_current_user_department()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_id from public.repair_profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.repair_can_view_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.repair_requests request
    join public.repair_profiles viewer on viewer.id = auth.uid() and viewer.is_active = true
    where request.id = p_request_id
      and (
        request.requester_id = viewer.id
        or viewer.role in ('factory_manager', 'purchasing')
        or (
          viewer.role in ('supervisor', 'department_manager')
          and viewer.department_id = request.department_id
        )
      )
  );
$$;

revoke all on function public.repair_current_user_role() from public;
revoke all on function public.repair_current_user_department() from public;
revoke all on function public.repair_can_view_request(uuid) from public;
grant execute on function public.repair_current_user_role() to authenticated;
grant execute on function public.repair_current_user_department() to authenticated;
grant execute on function public.repair_can_view_request(uuid) to authenticated;

create policy departments_read_authenticated
on public.repair_departments for select to authenticated
using (is_active = true);

create policy profiles_read_scoped
on public.repair_profiles for select to authenticated
using (
  id = auth.uid()
  or public.repair_current_user_role() in ('factory_manager', 'purchasing')
  or (
    public.repair_current_user_role() in ('supervisor', 'department_manager')
    and department_id = public.repair_current_user_department()
  )
);

create policy repair_requests_read_scoped
on public.repair_requests for select to authenticated
using (public.repair_can_view_request(id));

create policy request_actions_read_scoped
on public.repair_request_actions for select to authenticated
using (public.repair_can_view_request(request_id));

create policy request_attachments_read_scoped
on public.repair_request_attachments for select to authenticated
using (public.repair_can_view_request(request_id));

create policy notifications_read_own
on public.repair_notifications for select to authenticated
using (recipient_profile_id = auth.uid());

-- There are deliberately no direct insert/update/delete policies for protected workflow tables.
-- Authenticated clients must use the approved database functions in the next migration.

