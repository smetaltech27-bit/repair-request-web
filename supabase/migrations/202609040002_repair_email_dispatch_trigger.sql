-- Wake the email dispatcher immediately after a pending email enters the outbox.
-- The dispatch credential remains encrypted in Supabase Vault and is never
-- embedded in the trigger definition or application source.

create extension if not exists pg_net with schema extensions;

create or replace function public.dispatch_repair_email_notification()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_dispatch_secret text;
begin
  select secret.decrypted_secret
  into v_dispatch_secret
  from vault.decrypted_secrets secret
  where secret.name = 'repair_email_dispatch_secret'
  limit 1;

  if nullif(v_dispatch_secret, '') is null then
    raise warning 'Repair email dispatch skipped because Vault secret repair_email_dispatch_secret is missing';
    return new;
  end if;

  perform net.http_post(
    url := 'https://reugwejlyomsjdagynug.supabase.co/functions/v1/repair-email-dispatcher?limit=25',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_dispatch_secret
    ),
    body := '{}'::jsonb
  );

  return new;
end;
$$;

revoke all on function public.dispatch_repair_email_notification() from public, anon, authenticated;

drop trigger if exists repair_email_dispatch_on_insert on public.repair_notifications;

create trigger repair_email_dispatch_on_insert
after insert on public.repair_notifications
for each row
when (new.channel = 'email' and new.status = 'pending')
execute function public.dispatch_repair_email_notification();
