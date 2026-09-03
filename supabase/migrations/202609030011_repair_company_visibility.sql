-- Allow every active signed-in employee to read all active repair requests.
-- Workflow mutations remain protected by transition_repair_request, which still
-- enforces role, department, status, and self-approval rules independently.
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
    join public.repair_profiles viewer
      on viewer.id = auth.uid()
      and viewer.is_active = true
    where request.id = p_request_id
      and request.deleted_at is null
  );
$$;

revoke all on function public.repair_can_view_request(uuid) from public, anon, authenticated;
grant execute on function public.repair_can_view_request(uuid) to authenticated;

comment on function public.repair_can_view_request(uuid) is
  'Allows active authenticated employees to read every non-deleted repair request; workflow mutation authorization is enforced separately.';
