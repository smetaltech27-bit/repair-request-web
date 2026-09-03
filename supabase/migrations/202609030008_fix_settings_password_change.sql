-- Supabase enables safe-update protection for API requests. The explicit
-- predicate keeps the intended all-session invalidation while satisfying it.
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

  delete from private.repair_settings_sessions where true;
  insert into private.repair_settings_audit (
    action, actor_id, actor_name_snapshot, after_data
  ) values (
    'password_change', v_actor.id, v_actor.full_name,
    jsonb_build_object('changed_at', now())
  );

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function public.change_repair_settings_password(text, text, text)
  from public, anon, authenticated;
grant execute on function public.change_repair_settings_password(text, text, text)
  to authenticated;
