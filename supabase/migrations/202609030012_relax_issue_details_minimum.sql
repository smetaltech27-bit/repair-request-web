-- Keep issue details required while allowing concise repair descriptions.
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
  if char_length(trim(p_issue_details)) not between 1 and 1000 then raise exception 'Issue details length is invalid'; end if;
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
