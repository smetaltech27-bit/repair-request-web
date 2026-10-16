-- Allow password-gated Settings users to edit approver comments without
-- changing approver identity, decision, timestamps, or workflow ordering.

create or replace function public.list_repair_settings_approval_comments(
  p_session_token text,
  p_request_id uuid
)
returns table (
  source text,
  action_id uuid,
  step_code text,
  step_label text,
  actor_name text,
  decision text,
  note text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = private, public, extensions
as $$
begin
  perform private.require_repair_settings_session(p_session_token);

  if not exists (
    select 1
    from public.repair_requests request
    where request.id = p_request_id
      and request.deleted_at is null
  ) then
    raise exception 'Repair request not found or is in trash';
  end if;

  return query
  with current_actions as (
    select 'action'::text as source,
           action.id as action_id,
           case action.from_status
             when 'pending_supervisor' then 'supervisor'
             when 'pending_department_manager' then 'department_manager'
             when 'pending_factory_manager' then 'factory_manager'
           end::text as step_code,
           case action.from_status
             when 'pending_supervisor' then 'หัวหน้างาน'
             when 'pending_department_manager' then 'ผู้จัดการฝ่าย'
             when 'pending_factory_manager' then 'ผู้จัดการโรงงาน'
           end::text as step_label,
           action.actor_name_snapshot as actor_name,
           action.action::text as decision,
           coalesce(action.note, '') as note,
           action.created_at,
           case action.from_status
             when 'pending_supervisor' then 10
             when 'pending_department_manager' then 20
             when 'pending_factory_manager' then 30
           end as sort_order
    from public.repair_request_actions action
    where action.request_id = p_request_id
      and action.action in ('approve', 'reject')
      and action.from_status in (
        'pending_supervisor',
        'pending_department_manager',
        'pending_factory_manager'
      )
  ),
  legacy_actions as (
    select 'legacy'::text as source,
           action.id as action_id,
           history.step_code,
           history.step_label,
           nullif(trim(history.actor_name), '') as actor_name,
           'import'::text as decision,
           coalesce(history.note, '') as note,
           action.created_at,
           history.sort_order
    from public.repair_request_actions action
    cross join lateral (
      values
        (
          'supervisor'::text,
          'หัวหน้างาน'::text,
          action.metadata ->> 'supervisor_info',
          action.metadata ->> 'supervisor_note',
          10
        ),
        (
          'department_manager'::text,
          'ผู้จัดการฝ่าย'::text,
          action.metadata ->> 'department_manager_info',
          action.metadata ->> 'department_manager_note',
          20
        ),
        (
          'factory_manager'::text,
          'ผู้จัดการโรงงาน'::text,
          action.metadata ->> 'factory_manager_info',
          action.metadata ->> 'factory_manager_note',
          30
        )
    ) as history(step_code, step_label, actor_name, note, sort_order)
    where action.request_id = p_request_id
      and action.action = 'import'
      and (
        nullif(trim(history.actor_name), '') is not null
        or nullif(trim(history.note), '') is not null
      )
  ),
  combined as (
    select * from current_actions
    union all
    select * from legacy_actions
  )
  select combined.source,
         combined.action_id,
         combined.step_code,
         combined.step_label,
         combined.actor_name,
         combined.decision,
         combined.note,
         combined.created_at
  from combined
  order by combined.sort_order, combined.created_at, combined.action_id;
end;
$$;

create or replace function public.update_repair_settings_request_with_comments(
  p_session_token text,
  p_request_id uuid,
  p_department_id uuid,
  p_machine_id text,
  p_issue_details text,
  p_status public.repair_status,
  p_total_cost numeric,
  p_approval_comments jsonb
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
  v_action public.repair_request_actions%rowtype;
  v_comment jsonb;
  v_source text;
  v_action_id uuid;
  v_step_code text;
  v_note text;
  v_metadata_key text;
  v_info_key text;
  v_comments_before jsonb;
  v_comments_after jsonb;
begin
  perform private.require_repair_settings_session(p_session_token);

  select * into v_actor
  from public.repair_profiles
  where id = auth.uid() and is_active = true;
  if not found then raise exception 'Active profile is required'; end if;

  select * into v_before
  from public.repair_requests
  where id = p_request_id and deleted_at is null
  for update;
  if not found then raise exception 'Repair request not found or is in trash'; end if;

  select * into v_department
  from public.repair_departments
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
  if p_approval_comments is null or jsonb_typeof(p_approval_comments) <> 'array' then
    raise exception 'Approval comments must be a JSON array';
  end if;
  if jsonb_array_length(p_approval_comments) > 100 then
    raise exception 'Too many approval comments';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'action_id', action.id,
        'action', action.action,
        'from_status', action.from_status,
        'note', action.note,
        'metadata', action.metadata
      ) order by action.created_at, action.id
    ),
    '[]'::jsonb
  )
  into v_comments_before
  from public.repair_request_actions action
  where action.request_id = p_request_id
    and (
      (
        action.action in ('approve', 'reject')
        and action.from_status in (
          'pending_supervisor',
          'pending_department_manager',
          'pending_factory_manager'
        )
      )
      or action.action = 'import'
    );

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

  for v_comment in
    select value from jsonb_array_elements(p_approval_comments)
  loop
    v_source := v_comment ->> 'source';
    v_step_code := v_comment ->> 'step_code';
    v_note := coalesce(v_comment ->> 'note', '');

    begin
      v_action_id := (v_comment ->> 'action_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid approval action ID';
    end;

    if char_length(v_note) > 5000 then
      raise exception 'Approval comment is too long';
    end if;

    select * into v_action
    from public.repair_request_actions action
    where action.id = v_action_id
      and action.request_id = p_request_id
    for update;
    if not found then raise exception 'Approval action does not belong to this request'; end if;

    if v_source = 'action' then
      if v_action.action not in ('approve', 'reject')
        or not (
          (v_step_code = 'supervisor' and v_action.from_status = 'pending_supervisor')
          or (v_step_code = 'department_manager' and v_action.from_status = 'pending_department_manager')
          or (v_step_code = 'factory_manager' and v_action.from_status = 'pending_factory_manager')
        ) then
        raise exception 'Approval comment target is invalid';
      end if;

      update public.repair_request_actions
      set note = nullif(trim(v_note), '')
      where id = v_action.id;
    elsif v_source = 'legacy' then
      if v_action.action <> 'import' then
        raise exception 'Legacy approval comment target is invalid';
      end if;

      v_metadata_key := case v_step_code
        when 'supervisor' then 'supervisor_note'
        when 'department_manager' then 'department_manager_note'
        when 'factory_manager' then 'factory_manager_note'
        else null
      end;
      v_info_key := case v_step_code
        when 'supervisor' then 'supervisor_info'
        when 'department_manager' then 'department_manager_info'
        when 'factory_manager' then 'factory_manager_info'
        else null
      end;

      if v_metadata_key is null
        or not (v_action.metadata ? v_metadata_key or v_action.metadata ? v_info_key) then
        raise exception 'Legacy approval step is invalid';
      end if;

      update public.repair_request_actions
      set metadata = case
        when nullif(trim(v_note), '') is null then metadata - v_metadata_key
        else jsonb_set(metadata, array[v_metadata_key], to_jsonb(trim(v_note)), true)
      end
      where id = v_action.id;
    else
      raise exception 'Approval comment source is invalid';
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'action_id', action.id,
        'action', action.action,
        'from_status', action.from_status,
        'note', action.note,
        'metadata', action.metadata
      ) order by action.created_at, action.id
    ),
    '[]'::jsonb
  )
  into v_comments_after
  from public.repair_request_actions action
  where action.request_id = p_request_id
    and (
      (
        action.action in ('approve', 'reject')
        and action.from_status in (
          'pending_supervisor',
          'pending_department_manager',
          'pending_factory_manager'
        )
      )
      or action.action = 'import'
    );

  insert into private.repair_settings_audit (
    request_id, action, actor_id, actor_name_snapshot, before_data, after_data
  ) values (
    p_request_id,
    'edit',
    v_actor.id,
    v_actor.full_name,
    to_jsonb(v_before) || jsonb_build_object('approval_comments', v_comments_before),
    to_jsonb(v_after) || jsonb_build_object('approval_comments', v_comments_after)
  );
end;
$$;

revoke all on function public.list_repair_settings_approval_comments(text, uuid)
  from public, anon, authenticated;
revoke all on function public.update_repair_settings_request_with_comments(
  text, uuid, uuid, text, text, public.repair_status, numeric, jsonb
) from public, anon, authenticated;

grant execute on function public.list_repair_settings_approval_comments(text, uuid)
  to authenticated;
grant execute on function public.update_repair_settings_request_with_comments(
  text, uuid, uuid, text, text, public.repair_status, numeric, jsonb
) to authenticated;

comment on function public.list_repair_settings_approval_comments(text, uuid) is
  'Lists editable supervisor, department-manager, and factory-manager comments for an unlocked Settings session.';
comment on function public.update_repair_settings_request_with_comments(
  text, uuid, uuid, text, text, public.repair_status, numeric, jsonb
) is
  'Atomically updates a repair request and its existing approver comments while preserving approval identity and workflow evidence.';
