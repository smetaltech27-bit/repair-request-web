-- Harden function execution after Supabase default privileges are applied.
alter function public.repair_set_updated_at() set search_path = public;

revoke all on function public.repair_current_user_role() from public, anon, authenticated;
revoke all on function public.repair_current_user_department() from public, anon, authenticated;
revoke all on function public.repair_can_view_request(uuid) from public, anon, authenticated;
revoke all on function public.generate_repair_job_id() from public, anon, authenticated;
revoke all on function public.enqueue_request_notifications(uuid, public.repair_status) from public, anon, authenticated;
revoke all on function public.create_repair_request(uuid, text, text, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.transition_repair_request(uuid, public.repair_action, text, numeric, text) from public, anon, authenticated;
revoke all on function public.repair_mark_notification_read(uuid) from public, anon, authenticated;

-- These functions are intentionally exposed only to signed-in app users.
grant execute on function public.repair_current_user_role() to authenticated;
grant execute on function public.repair_current_user_department() to authenticated;
grant execute on function public.repair_can_view_request(uuid) to authenticated;
grant execute on function public.create_repair_request(uuid, text, text, text, text, text, bigint) to authenticated;
grant execute on function public.transition_repair_request(uuid, public.repair_action, text, numeric, text) to authenticated;
grant execute on function public.repair_mark_notification_read(uuid) to authenticated;

-- Keep extensions out of the exposed public schema.
alter extension citext set schema extensions;
