-- Password-gated Repair Request settings administration.
-- The shared settings password is intentionally separate from Supabase Auth.
create schema if not exists private;

alter table public.repair_requests
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.repair_profiles(id);

create index if not exists repair_requests_deleted_at_idx
  on public.repair_requests (deleted_at, created_at desc);

create table if not exists private.repair_settings_security (
  singleton_id smallint primary key default 1 check (singleton_id = 1),
  password_hash text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists private.repair_settings_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists repair_settings_sessions_user_idx
  on private.repair_settings_sessions (user_id, expires_at desc);

create table if not exists private.repair_settings_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failed_count integer not null default 0 check (failed_count >= 0),
  window_started_at timestamptz not null default now()
);

create table if not exists private.repair_settings_audit (
  id bigint generated always as identity primary key,
  request_id uuid,
  action text not null check (action in ('edit', 'delete', 'restore', 'password_change')),
  actor_id uuid not null references auth.users(id),
  actor_name_snapshot text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists repair_settings_audit_request_idx
  on private.repair_settings_audit (request_id, created_at desc);

-- The initial value is temporary. Changing it replaces this hash and invalidates every unlock session.
insert into private.repair_settings_security (singleton_id, password_hash)
values (1, extensions.crypt('1234', extensions.gen_salt('bf', 12)))
on conflict (singleton_id) do nothing;

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

create or replace function private.repair_settings_session_valid(p_session_token text)
returns boolean
language sql
stable
security definer
set search_path = private, public, extensions
as $$
  select p_session_token is not null
    and exists (
      select 1
      from private.repair_settings_sessions session
      join public.repair_profiles profile
        on profile.id = session.user_id and profile.is_active = true
      where session.user_id = auth.uid()
        and session.token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
        and session.expires_at > now()
    );
$$;

create or replace function private.require_repair_settings_session(p_session_token text)
returns void
language plpgsql
stable
security definer
set search_path = private, public, extensions
as $$
begin
  if not private.repair_settings_session_valid(p_session_token) then
    raise exception 'SETTINGS_SESSION_EXPIRED';
  end if;
end;
$$;

create or replace function public.unlock_repair_settings(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_password_hash text;
  v_token text;
  v_expires_at timestamptz := now() + interval '15 minutes';
  v_attempt private.repair_settings_attempts%rowtype;
  v_retry_after integer;
begin
  if v_user_id is null or not exists (
    select 1 from public.repair_profiles where id = v_user_id and is_active = true
  ) then
    return jsonb_build_object('success', false, 'code', 'AUTH_REQUIRED');
  end if;

  select * into v_attempt
  from private.repair_settings_attempts
  where user_id = v_user_id;

  if found and v_attempt.window_started_at > now() - interval '15 minutes'
    and v_attempt.failed_count >= 5 then
    v_retry_after := greatest(1, ceil(extract(epoch from (
      v_attempt.window_started_at + interval '15 minutes' - now()
    )))::integer);
    return jsonb_build_object(
      'success', false,
      'code', 'TOO_MANY_ATTEMPTS',
      'retry_after_seconds', v_retry_after
    );
  end if;

  select password_hash into v_password_hash
  from private.repair_settings_security
  where singleton_id = 1;

  if v_password_hash is null or extensions.crypt(coalesce(p_password, ''), v_password_hash) <> v_password_hash then
    insert into private.repair_settings_attempts (user_id, failed_count, window_started_at)
    values (v_user_id, 1, now())
    on conflict (user_id) do update
    set failed_count = case
          when private.repair_settings_attempts.window_started_at <= now() - interval '15 minutes' then 1
          else private.repair_settings_attempts.failed_count + 1
        end,
        window_started_at = case
          when private.repair_settings_attempts.window_started_at <= now() - interval '15 minutes' then now()
          else private.repair_settings_attempts.window_started_at
        end
    returning * into v_attempt;

    return jsonb_build_object(
      'success', false,
      'code', 'INVALID_PASSWORD',
      'remaining_attempts', greatest(0, 5 - v_attempt.failed_count)
    );
  end if;

  delete from private.repair_settings_attempts where user_id = v_user_id;
  delete from private.repair_settings_sessions
  where user_id = v_user_id or expires_at <= now();

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.repair_settings_sessions (user_id, token_hash, expires_at)
  values (v_user_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_expires_at);

  return jsonb_build_object(
    'success', true,
    'token', v_token,
    'expires_at', v_expires_at
  );
end;
$$;

create or replace function public.change_repair_settings_password(
  p_session_token text,
  p_current_password text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_actor public.repair_profiles%rowtype;
  v_password_hash text;
begin
  perform private.require_repair_settings_session(p_session_token);

  select * into v_actor
  from public.repair_profiles
  where id = auth.uid() and is_active = true;
  if not found then raise exception 'Active profile is required'; end if;

  select password_hash into v_password_hash
  from private.repair_settings_security
  where singleton_id = 1
  for update;

  if extensions.crypt(coalesce(p_current_password, ''), v_password_hash) <> v_password_hash then
    return jsonb_build_object('success', false, 'code', 'INVALID_CURRENT_PASSWORD');
  end if;
  if char_length(coalesce(p_new_password, '')) not between 6 and 64 then
    return jsonb_build_object('success', false, 'code', 'INVALID_NEW_PASSWORD');
  end if;
  if p_new_password = '1234' then
    return jsonb_build_object('success', false, 'code', 'DEFAULT_PASSWORD_NOT_ALLOWED');
  end if;
  if p_new_password = p_current_password then
    return jsonb_build_object('success', false, 'code', 'PASSWORD_UNCHANGED');
  end if;

  update private.repair_settings_security
  set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 12)),
      updated_at = now(),
      updated_by = auth.uid()
  where singleton_id = 1;

  delete from private.repair_settings_sessions;
  insert into private.repair_settings_audit (
    action, actor_id, actor_name_snapshot, after_data
  ) values (
    'password_change', v_actor.id, v_actor.full_name,
    jsonb_build_object('changed_at', now())
  );

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.list_repair_settings_requests(
  p_session_token text,
  p_include_deleted boolean default true
)
returns table (
  id uuid,
  job_id text,
  requester_name text,
  department_id uuid,
  department_name text,
  machine_id text,
  issue_details text,
  status public.repair_status,
  total_cost numeric,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by_name text
)
language plpgsql
stable
security definer
set search_path = private, public, extensions
as $$
begin
  perform private.require_repair_settings_session(p_session_token);

  return query
  select request.id,
         request.job_id,
         request.requester_name_snapshot,
         request.department_id,
         request.department_name_snapshot,
         request.machine_id,
         request.issue_details,
         request.status,
         request.total_cost,
         request.created_at,
         request.updated_at,
         request.deleted_at,
         deleted_by.full_name
  from public.repair_requests request
  left join public.repair_profiles deleted_by on deleted_by.id = request.deleted_by
  where p_include_deleted or request.deleted_at is null
  order by request.created_at desc
  limit 5000;
end;
$$;

create or replace function public.update_repair_settings_request(
  p_session_token text,
  p_request_id uuid,
  p_department_id uuid,
  p_machine_id text,
  p_issue_details text,
  p_status public.repair_status,
  p_total_cost numeric default null
)
returns void
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_actor public.repair_profiles%rowtype;
  v_department public.repair_departments%rowtype;
  v_before public.repair_requests%rowtype;
  v_after public.repair_requests%rowtype;
begin
  perform private.require_repair_settings_session(p_session_token);

  select * into v_actor from public.repair_profiles
  where id = auth.uid() and is_active = true;
  if not found then raise exception 'Active profile is required'; end if;

  select * into v_before from public.repair_requests
  where id = p_request_id and deleted_at is null
  for update;
  if not found then raise exception 'Repair request not found or is in trash'; end if;

  select * into v_department from public.repair_departments
  where id = p_department_id and is_active = true;
  if not found then raise exception 'Invalid department'; end if;

  if char_length(trim(coalesce(p_machine_id, ''))) < 2 then
    raise exception 'Machine ID is required';
  end if;
  if char_length(trim(coalesce(p_issue_details, ''))) not between 1 and 1000 then
    raise exception 'Issue details length is invalid';
  end if;
  if p_total_cost is not null and p_total_cost < 0 then
    raise exception 'Total cost cannot be negative';
  end if;
  if p_status = 'completed' and p_total_cost is null then
    raise exception 'Completed requests require total cost';
  end if;

  update public.repair_requests
  set department_id = v_department.id,
      department_name_snapshot = v_department.name,
      machine_id = trim(p_machine_id),
      issue_details = trim(p_issue_details),
      status = p_status,
      total_cost = p_total_cost,
      approved_at = case
        when p_status in ('pending_purchasing', 'purchasing_in_progress', 'completed')
          then coalesce(approved_at, now())
        else null
      end,
      closed_at = case
        when p_status = 'completed' then coalesce(closed_at, now())
        else null
      end
  where public.repair_requests.id = p_request_id
  returning * into v_after;

  insert into private.repair_settings_audit (
    request_id, action, actor_id, actor_name_snapshot, before_data, after_data
  ) values (
    p_request_id, 'edit', v_actor.id, v_actor.full_name,
    to_jsonb(v_before), to_jsonb(v_after)
  );
end;
$$;

create or replace function public.soft_delete_repair_settings_request(
  p_session_token text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_actor public.repair_profiles%rowtype;
  v_before public.repair_requests%rowtype;
  v_after public.repair_requests%rowtype;
begin
  perform private.require_repair_settings_session(p_session_token);
  select * into v_actor from public.repair_profiles
  where id = auth.uid() and is_active = true;
  if not found then raise exception 'Active profile is required'; end if;

  select * into v_before from public.repair_requests
  where id = p_request_id and deleted_at is null
  for update;
  if not found then raise exception 'Repair request not found or already deleted'; end if;

  update public.repair_requests
  set deleted_at = now(), deleted_by = v_actor.id
  where public.repair_requests.id = p_request_id
  returning * into v_after;

  insert into private.repair_settings_audit (
    request_id, action, actor_id, actor_name_snapshot, before_data, after_data
  ) values (
    p_request_id, 'delete', v_actor.id, v_actor.full_name,
    to_jsonb(v_before), to_jsonb(v_after)
  );
end;
$$;

create or replace function public.restore_repair_settings_request(
  p_session_token text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_actor public.repair_profiles%rowtype;
  v_before public.repair_requests%rowtype;
  v_after public.repair_requests%rowtype;
begin
  perform private.require_repair_settings_session(p_session_token);
  select * into v_actor from public.repair_profiles
  where id = auth.uid() and is_active = true;
  if not found then raise exception 'Active profile is required'; end if;

  select * into v_before from public.repair_requests
  where id = p_request_id and deleted_at is not null
  for update;
  if not found then raise exception 'Deleted repair request not found'; end if;

  update public.repair_requests
  set deleted_at = null, deleted_by = null
  where public.repair_requests.id = p_request_id
  returning * into v_after;

  insert into private.repair_settings_audit (
    request_id, action, actor_id, actor_name_snapshot, before_data, after_data
  ) values (
    p_request_id, 'restore', v_actor.id, v_actor.full_name,
    to_jsonb(v_before), to_jsonb(v_after)
  );
end;
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
      and request.deleted_at is null
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

create or replace function public.repair_prevent_deleted_request_workflow()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.deleted_at is not null and new.deleted_at is not distinct from old.deleted_at then
    raise exception 'Deleted repair requests must be restored before editing';
  end if;
  return new;
end;
$$;

drop trigger if exists repair_requests_prevent_deleted_workflow on public.repair_requests;
create trigger repair_requests_prevent_deleted_workflow
before update on public.repair_requests
for each row execute function public.repair_prevent_deleted_request_workflow();

revoke all on function private.repair_settings_session_valid(text) from public, anon, authenticated;
revoke all on function private.require_repair_settings_session(text) from public, anon, authenticated;
revoke all on function public.unlock_repair_settings(text) from public, anon, authenticated;
revoke all on function public.change_repair_settings_password(text, text, text) from public, anon, authenticated;
revoke all on function public.list_repair_settings_requests(text, boolean) from public, anon, authenticated;
revoke all on function public.update_repair_settings_request(text, uuid, uuid, text, text, public.repair_status, numeric) from public, anon, authenticated;
revoke all on function public.soft_delete_repair_settings_request(text, uuid) from public, anon, authenticated;
revoke all on function public.restore_repair_settings_request(text, uuid) from public, anon, authenticated;
revoke all on function public.repair_prevent_deleted_request_workflow() from public, anon, authenticated;

grant execute on function public.unlock_repair_settings(text) to authenticated;
grant execute on function public.change_repair_settings_password(text, text, text) to authenticated;
grant execute on function public.list_repair_settings_requests(text, boolean) to authenticated;
grant execute on function public.update_repair_settings_request(text, uuid, uuid, text, text, public.repair_status, numeric) to authenticated;
grant execute on function public.soft_delete_repair_settings_request(text, uuid) to authenticated;
grant execute on function public.restore_repair_settings_request(text, uuid) to authenticated;

comment on table private.repair_settings_security is
  'Server-only bcrypt hash for the shared Settings password.';
comment on table private.repair_settings_audit is
  'Immutable audit trail for password-gated settings changes. Password values are never recorded.';
