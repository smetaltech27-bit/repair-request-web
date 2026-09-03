-- Password-gated employee administration for the Repair Request application.
-- Credentials remain in Supabase Auth; this audit table never stores passwords.
create table if not exists private.repair_employee_admin_audit (
  id bigint generated always as identity primary key,
  target_profile_id uuid not null references public.repair_profiles(id),
  action text not null check (action in ('create', 'update')),
  actor_id uuid not null references auth.users(id),
  actor_name_snapshot text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists repair_employee_admin_audit_target_idx
  on private.repair_employee_admin_audit (target_profile_id, created_at desc);

revoke all on table private.repair_employee_admin_audit from public, anon, authenticated;

create or replace function public.authorize_repair_employee_admin(p_session_token text)
returns table (actor_id uuid, actor_name text)
language plpgsql
security definer
set search_path = private, public, extensions
as $$
begin
  perform private.require_repair_settings_session(p_session_token);

  return query
  select profile.id, profile.full_name
  from public.repair_profiles profile
  where profile.id = auth.uid()
    and profile.is_active = true;
end;
$$;

create or replace function public.record_repair_employee_admin_audit(
  p_actor_id uuid,
  p_target_profile_id uuid,
  p_action text,
  p_before_data jsonb default null,
  p_after_data jsonb default null
)
returns void
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_actor public.repair_profiles%rowtype;
begin
  if p_action not in ('create', 'update') then
    raise exception 'INVALID_EMPLOYEE_AUDIT_ACTION';
  end if;

  select * into v_actor
  from public.repair_profiles
  where id = p_actor_id and is_active = true;

  if not found then
    raise exception 'AUTH_REQUIRED';
  end if;

  insert into private.repair_employee_admin_audit (
    target_profile_id,
    action,
    actor_id,
    actor_name_snapshot,
    before_data,
    after_data
  ) values (
    p_target_profile_id,
    p_action,
    v_actor.id,
    v_actor.full_name,
    p_before_data - 'password' - 'avatar_data_url',
    p_after_data - 'password' - 'avatar_data_url'
  );
end;
$$;

revoke all on function public.authorize_repair_employee_admin(text) from public, anon, authenticated;
revoke all on function public.record_repair_employee_admin_audit(uuid, uuid, text, jsonb, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.authorize_repair_employee_admin(text) to authenticated;
grant execute on function public.record_repair_employee_admin_audit(uuid, uuid, text, jsonb, jsonb) to service_role;

comment on table private.repair_employee_admin_audit is
  'Audit trail for employee account creation and updates made through a valid Settings session. Password values are never stored.';
