-- Cut over repair notifications to production recipients without releasing
-- pending or failed messages that were created while test routing was active.
-- Existing rows are preserved; the claim function below only releases email
-- notifications created on or after this production cutover timestamp.

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
  v_action public.repair_request_actions%rowtype;
  v_target_role public.repair_app_role;
  v_target_department uuid;
  v_target_recipient uuid;
  v_recipient_id uuid;
  v_subject text;
  v_body text;
begin
  select * into v_request
  from public.repair_requests
  where id = p_request_id;
  if not found then return; end if;

  select * into v_action
  from public.repair_request_actions action
  where action.request_id = p_request_id
    and action.to_status = p_status
  order by action.created_at desc, action.id desc
  limit 1;
  if not found then return; end if;

  if p_status = 'pending_supervisor' then
    v_target_role := 'supervisor';
    v_target_department := v_request.department_id;
  elsif p_status = 'pending_department_manager' then
    v_target_role := 'department_manager';
    v_target_department := v_request.department_id;
  elsif p_status = 'pending_factory_manager' then
    v_target_role := 'factory_manager';
  elsif p_status = 'pending_purchasing' then
    v_target_role := 'purchasing';
  end if;

  if v_target_role is not null then
    if v_action.action = 'create' then
      perform public.enqueue_repair_notification_for_recipient(
        p_request_id,
        v_action.id,
        v_request.requester_id,
        'รับรายการแจ้งซ่อม ' || v_request.job_id || ' แล้ว',
        'ระบบรับรายการของคุณแล้ว สถานะปัจจุบัน: ' || p_status::text
      );
    end if;

    v_target_recipient := public.resolve_required_repair_recipient(v_target_role, v_target_department);
    v_subject := case p_status
      when 'pending_supervisor' then '🔔 รอหัวหน้างานอนุมัติ: ' || v_request.job_id
      when 'pending_department_manager' then '🔔 รอผู้จัดการฝ่ายอนุมัติ: ' || v_request.job_id
      when 'pending_factory_manager' then '🔔 รอผู้จัดการโรงงานอนุมัติ: ' || v_request.job_id
      when 'pending_purchasing' then '🟢 รอจัดซื้อดำเนินการ: ' || v_request.job_id
      else 'อัปเดตงานซ่อม ' || v_request.job_id
    end;
    v_body := case p_status
      when 'pending_supervisor' then 'มีรายการแจ้งซ่อมใหม่จาก ' || v_request.requester_name_snapshot || ' รอการพิจารณาจากคุณ'
      when 'pending_department_manager' then 'รายการผ่านขั้นตอนหัวหน้างานแล้ว รอการพิจารณาจากคุณ'
      when 'pending_factory_manager' then 'รายการผ่านการอนุมัติระดับต้นแล้ว รอการพิจารณาขั้นถัดไปจากคุณ'
      when 'pending_purchasing' then 'รายการได้รับการอนุมัติครบแล้ว รอฝ่ายจัดซื้อรับดำเนินการ'
      else 'สถานะปัจจุบัน: ' || p_status::text
    end;

    perform public.enqueue_repair_notification_for_recipient(
      p_request_id, v_action.id, v_target_recipient, v_subject, v_body
    );
    return;
  end if;

  if p_status = 'purchasing_in_progress' then
    v_subject := '✅ จัดซื้อรับดำเนินการแล้ว: ' || v_request.job_id;
    v_body := 'ฝ่ายจัดซื้อได้รับรายการและกำลังดำเนินการสั่งซื้อหรือออก PO แล้ว';
  elsif p_status = 'rejected' then
    v_subject := '❌ รายการแจ้งซ่อมถูกตีกลับ: ' || v_request.job_id;
    v_body := 'ตีกลับโดย ' || v_action.actor_name_snapshot || ' — เหตุผล: ' || coalesce(nullif(trim(v_action.note), ''), '-');
  elsif p_status = 'completed' then
    v_subject := '🎉 ปิดงานแจ้งซ่อมแล้ว: ' || v_request.job_id;
    v_body := 'ปิดงานโดย ' || v_action.actor_name_snapshot || ' — รายละเอียด: ' || coalesce(nullif(trim(v_action.note), ''), '-');
  else
    return;
  end if;

  -- Notify the requester and every workflow participant, including the person
  -- who performed the current action. UNION keeps one notification per profile.
  for v_recipient_id in
    select recipients.recipient_id
    from (
      select v_request.requester_id as recipient_id
      union
      select action.actor_id
      from public.repair_request_actions action
      where action.request_id = p_request_id
        and action.actor_id is not null
    ) recipients
  loop
    perform public.enqueue_repair_notification_for_recipient(
      p_request_id, v_action.id, v_recipient_id, v_subject, v_body
    );
  end loop;
end;
$$;

revoke all on function public.enqueue_request_notifications(uuid, public.repair_status)
from public, anon, authenticated, service_role;

create or replace function public.claim_repair_email_notifications(p_limit integer default 10)
returns table (
  notification_id uuid,
  recipient_email text,
  email_subject text,
  notification_body text,
  request_id uuid,
  job_id text,
  requester_name text,
  department_name text,
  machine_id text,
  issue_details text,
  repair_status public.repair_status,
  total_cost numeric,
  action_code public.repair_action,
  actor_name text,
  action_note text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.repair_notifications notification
  set status = 'skipped',
      last_error = 'Recipient is inactive or has no notification email',
      locked_at = null,
      updated_at = now()
  where notification.channel = 'email'
    and notification.status in ('pending', 'failed')
    and not exists (
      select 1
      from public.repair_profiles recipient
      where recipient.id = notification.recipient_profile_id
        and recipient.is_active = true
        and nullif(trim(recipient.email::text), '') is not null
    );

  update public.repair_notifications notification
  set status = 'skipped',
      last_error = 'Workflow has already moved past this notification event',
      locked_at = null,
      updated_at = now()
  from public.repair_request_actions action,
       public.repair_requests request
  where notification.channel = 'email'
    and notification.status in ('pending', 'failed')
    and notification.event_action_id = action.id
    and notification.request_id = request.id
    and action.to_status is distinct from request.status;

  update public.repair_notifications notification
  set status = 'skipped',
      last_error = 'Repair request is in the settings recycle bin',
      locked_at = null,
      updated_at = now()
  from public.repair_requests request
  where notification.channel = 'email'
    and notification.status in ('pending', 'failed')
    and notification.request_id = request.id
    and request.deleted_at is not null;

  return query
  with candidates as (
    select notification.id
    from public.repair_notifications notification
    join public.repair_profiles recipient
      on recipient.id = notification.recipient_profile_id
     and recipient.is_active = true
     and nullif(trim(recipient.email::text), '') is not null
    join public.repair_request_actions action on action.id = notification.event_action_id
    join public.repair_requests request
      on request.id = notification.request_id
     and request.status = action.to_status
     and request.deleted_at is null
    where notification.channel = 'email'
      and notification.status in ('pending', 'failed')
      and notification.event_action_id is not null
      and notification.created_at >= timestamptz '2026-09-12 15:10:15+00'
      and notification.attempt_count < 5
      and notification.next_attempt_at <= now()
      and (notification.locked_at is null or notification.locked_at < now() - interval '15 minutes')
    order by notification.created_at, notification.id
    for update of notification skip locked
    limit least(greatest(coalesce(p_limit, 10), 1), 25)
  ), claimed as (
    update public.repair_notifications notification
    set status = 'pending',
        attempt_count = notification.attempt_count + 1,
        locked_at = now(),
        last_error = null,
        updated_at = now()
    from candidates
    where notification.id = candidates.id
    returning notification.*
  )
  select
    claimed.id,
    recipient.email::text,
    claimed.subject,
    claimed.body,
    request.id,
    request.job_id,
    request.requester_name_snapshot,
    request.department_name_snapshot,
    request.machine_id,
    request.issue_details,
    coalesce(action.to_status, request.status),
    request.total_cost,
    action.action,
    action.actor_name_snapshot,
    action.note
  from claimed
  join public.repair_profiles recipient on recipient.id = claimed.recipient_profile_id
  join public.repair_requests request on request.id = claimed.request_id
  left join public.repair_request_actions action on action.id = claimed.event_action_id;
end;
$$;
