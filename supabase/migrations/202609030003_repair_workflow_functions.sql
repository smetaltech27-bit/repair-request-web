-- Local design only. Do not apply to a Supabase project without explicit approval.
create or replace function public.generate_repair_job_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_date date := (now() at time zone 'Asia/Bangkok')::date;
  v_number integer;
begin
  insert into public.repair_job_sequences (job_date, last_number)
  values (v_job_date, 1)
  on conflict (job_date)
  do update set last_number = public.repair_job_sequences.last_number + 1
  returning last_number into v_number;

  return 'REQ-' || to_char(v_job_date, 'YYMMDD') || '-' || lpad(v_number::text, 3, '0');
end;
$$;

create or replace function public.enqueue_request_notifications(
  p_request_id uuid,
  p_status public.repair_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.repair_requests%rowtype;
  v_target_role public.repair_app_role;
  v_scope_department uuid;
  v_subject text;
  v_body text;
begin
  select * into v_request from public.repair_requests where id = p_request_id;
  if not found then return; end if;

  v_subject := 'อัปเดตงานซ่อม ' || v_request.job_id;
  v_body := 'สถานะปัจจุบัน: ' || p_status::text || ' — ' || v_request.machine_id;

  if p_status = 'pending_supervisor' then
    v_target_role := 'supervisor';
    v_scope_department := v_request.department_id;
  elsif p_status = 'pending_department_manager' then
    v_target_role := 'department_manager';
    v_scope_department := v_request.department_id;
  elsif p_status = 'pending_factory_manager' then
    v_target_role := 'factory_manager';
  elsif p_status = 'pending_purchasing' then
    v_target_role := 'purchasing';
  end if;

  if v_target_role is not null then
    insert into public.repair_notifications (request_id, recipient_profile_id, channel, subject, body)
    select p_request_id, profile.id, 'in_app', v_subject, v_body
    from public.repair_profiles profile
    where profile.is_active = true
      and profile.role = v_target_role
      and (v_scope_department is null or profile.department_id = v_scope_department);

    insert into public.repair_notifications (request_id, recipient_profile_id, channel, subject, body)
    select p_request_id, profile.id, 'email', v_subject, v_body
    from public.repair_profiles profile
    where profile.is_active = true
      and profile.email is not null
      and profile.role = v_target_role
      and (v_scope_department is null or profile.department_id = v_scope_department);
  elsif p_status = 'purchasing_in_progress' then
    insert into public.repair_notifications (request_id, recipient_profile_id, channel, subject, body)
    select distinct p_request_id, profile.id, 'in_app', v_subject, v_body
    from public.repair_profiles profile
    where profile.is_active = true
      and (
        profile.role = 'factory_manager'
        or (profile.department_id = v_request.department_id and profile.role in ('supervisor', 'department_manager'))
      );
  elsif p_status in ('completed', 'rejected') then
    insert into public.repair_notifications (request_id, recipient_profile_id, channel, subject, body)
    select distinct p_request_id, recipient_id, 'in_app', v_subject, v_body
    from (
      select v_request.requester_id as recipient_id
      union
      select actor_id from public.repair_request_actions where request_id = p_request_id and actor_id is not null
    ) recipients;

    insert into public.repair_notifications (request_id, recipient_profile_id, channel, subject, body)
    select distinct p_request_id, profile.id, 'email', v_subject, v_body
    from public.repair_profiles profile
    where profile.email is not null
      and profile.id in (
        select v_request.requester_id
        union
        select actor_id from public.repair_request_actions where request_id = p_request_id and actor_id is not null
      );
  end if;
end;
$$;

create or replace function public.create_repair_request(
  p_department_id uuid,
  p_machine_id text,
  p_issue_details text,
  p_before_storage_path text default null,
  p_original_file_name text default null,
  p_mime_type text default null,
  p_file_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.repair_profiles%rowtype;
  v_department public.repair_departments%rowtype;
  v_request_id uuid;
  v_job_id text;
  v_status public.repair_status;
begin
  select * into v_actor from public.repair_profiles where id = auth.uid() and is_active = true;
  if not found then raise exception 'Active profile is required'; end if;

  select * into v_department from public.repair_departments where id = p_department_id and is_active = true;
  if not found then raise exception 'Invalid department'; end if;

  if v_actor.department_id is distinct from p_department_id and v_actor.role not in ('factory_manager', 'purchasing') then
    raise exception 'Department does not match the current user';
  end if;
  if char_length(trim(p_machine_id)) < 2 then raise exception 'Machine ID is required'; end if;
  if char_length(trim(p_issue_details)) not between 10 and 1000 then raise exception 'Issue details length is invalid'; end if;
  if p_before_storage_path is not null
    and split_part(p_before_storage_path, '/', 1) <> auth.uid()::text then
    raise exception 'Attachment path must belong to the current user';
  end if;

  v_status := case v_actor.role
    when 'factory_manager' then 'pending_purchasing'::public.repair_status
    when 'department_manager' then 'pending_factory_manager'::public.repair_status
    when 'supervisor' then
      case when lower(v_department.code) = 'machine'
        then 'pending_department_manager'::public.repair_status
        else 'pending_factory_manager'::public.repair_status
      end
    else 'pending_supervisor'::public.repair_status
  end;

  v_job_id := public.generate_repair_job_id();

  insert into public.repair_requests (
    job_id, requester_id, requester_name_snapshot, requester_role_snapshot,
    department_id, department_name_snapshot, machine_id, issue_details, status
  ) values (
    v_job_id, v_actor.id, v_actor.full_name, v_actor.role,
    v_department.id, v_department.name, trim(p_machine_id), trim(p_issue_details), v_status
  ) returning id into v_request_id;

  insert into public.repair_request_actions (
    request_id, action, from_status, to_status, actor_id,
    actor_name_snapshot, actor_role_snapshot, note
  ) values (
    v_request_id, 'create', null, v_status, v_actor.id,
    v_actor.full_name, v_actor.role, 'สร้างใบแจ้งซ่อม'
  );

  if p_before_storage_path is not null then
    insert into public.repair_request_attachments (
      request_id, kind, storage_path, original_file_name, mime_type, file_size_bytes, uploaded_by
    ) values (
      v_request_id, 'before', p_before_storage_path, p_original_file_name, p_mime_type, p_file_size_bytes, v_actor.id
    );
  end if;

  perform public.enqueue_request_notifications(v_request_id, v_status);
  return v_request_id;
end;
$$;

create or replace function public.transition_repair_request(
  p_request_id uuid,
  p_action public.repair_action,
  p_note text,
  p_total_cost numeric default null,
  p_after_storage_path text default null
)
returns public.repair_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.repair_profiles%rowtype;
  v_request public.repair_requests%rowtype;
  v_department_code text;
  v_new_status public.repair_status;
  v_authorized boolean := false;
begin
  select * into v_actor from public.repair_profiles where id = auth.uid() and is_active = true;
  if not found then raise exception 'Active profile is required'; end if;

  select * into v_request from public.repair_requests where id = p_request_id for update;
  if not found then raise exception 'Repair request not found'; end if;

  select code into v_department_code from public.repair_departments where id = v_request.department_id;

  if nullif(trim(p_note), '') is null then raise exception 'Action note is required'; end if;
  if p_after_storage_path is not null
    and split_part(p_after_storage_path, '/', 1) <> auth.uid()::text then
    raise exception 'Attachment path must belong to the current user';
  end if;
  if v_request.requester_id = v_actor.id and p_action in ('approve', 'reject', 'acknowledge') then
    raise exception 'Users cannot approve their own request';
  end if;

  if v_request.status = 'pending_supervisor' then
    v_authorized := v_actor.role = 'supervisor' and v_actor.department_id = v_request.department_id and p_action in ('approve', 'reject');
  elsif v_request.status = 'pending_department_manager' then
    v_authorized := v_actor.role = 'department_manager' and v_actor.department_id = v_request.department_id and p_action in ('approve', 'reject');
  elsif v_request.status = 'pending_factory_manager' then
    v_authorized := v_actor.role = 'factory_manager' and p_action in ('approve', 'reject');
  elsif v_request.status = 'pending_purchasing' then
    v_authorized := v_actor.role = 'purchasing' and p_action in ('acknowledge', 'reject');
  elsif v_request.status = 'purchasing_in_progress' then
    v_authorized := p_action = 'complete' and (
      v_actor.role in ('factory_manager', 'purchasing')
      or (v_actor.role in ('supervisor', 'department_manager') and v_actor.department_id = v_request.department_id)
    );
  end if;

  if not v_authorized then raise exception 'Action is not allowed for the current role or status'; end if;

  if p_action = 'reject' then
    v_new_status := 'rejected';
  elsif p_action = 'acknowledge' then
    v_new_status := 'purchasing_in_progress';
  elsif p_action = 'complete' then
    if p_total_cost is null or p_total_cost < 0 then raise exception 'Valid total cost is required'; end if;
    v_new_status := 'completed';
  elsif p_action = 'approve' and v_request.status = 'pending_supervisor' then
    v_new_status := case when lower(v_department_code) = 'machine'
      then 'pending_department_manager'::public.repair_status
      else 'pending_factory_manager'::public.repair_status
    end;
  elsif p_action = 'approve' and v_request.status = 'pending_department_manager' then
    v_new_status := 'pending_factory_manager';
  elsif p_action = 'approve' and v_request.status = 'pending_factory_manager' then
    v_new_status := 'pending_purchasing';
  else
    raise exception 'Invalid workflow transition';
  end if;

  update public.repair_requests
  set status = v_new_status,
      total_cost = case when p_action = 'complete' then p_total_cost else total_cost end,
      approved_at = case when v_request.status = 'pending_factory_manager' and p_action = 'approve' then now() else approved_at end,
      closed_at = case when p_action = 'complete' then now() else closed_at end
  where id = p_request_id;

  insert into public.repair_request_actions (
    request_id, action, from_status, to_status, actor_id,
    actor_name_snapshot, actor_role_snapshot, note
  ) values (
    p_request_id, p_action, v_request.status, v_new_status, v_actor.id,
    v_actor.full_name, v_actor.role, trim(p_note)
  );

  if p_action = 'complete' and p_after_storage_path is not null then
    insert into public.repair_request_attachments (request_id, kind, storage_path, uploaded_by)
    values (p_request_id, 'after', p_after_storage_path, v_actor.id);
  end if;

  perform public.enqueue_request_notifications(p_request_id, v_new_status);
  return v_new_status;
end;
$$;

create or replace function public.repair_mark_notification_read(p_notification_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.repair_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_profile_id = auth.uid();
$$;

revoke all on function public.generate_repair_job_id() from public;
revoke all on function public.enqueue_request_notifications(uuid, public.repair_status) from public;
revoke all on function public.create_repair_request(uuid, text, text, text, text, text, bigint) from public;
revoke all on function public.transition_repair_request(uuid, public.repair_action, text, numeric, text) from public;
revoke all on function public.repair_mark_notification_read(uuid) from public;

grant execute on function public.create_repair_request(uuid, text, text, text, text, text, bigint) to authenticated;
grant execute on function public.transition_repair_request(uuid, public.repair_action, text, numeric, text) to authenticated;
grant execute on function public.repair_mark_notification_read(uuid) to authenticated;

