-- Local design only. Do not apply to a Supabase project without explicit approval.
create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.repair_app_role as enum (
  'employee',
  'supervisor',
  'department_manager',
  'factory_manager',
  'purchasing'
);

create type public.repair_status as enum (
  'pending_supervisor',
  'pending_department_manager',
  'pending_factory_manager',
  'pending_purchasing',
  'purchasing_in_progress',
  'completed',
  'rejected'
);

create type public.repair_action as enum (
  'create',
  'approve',
  'reject',
  'acknowledge',
  'complete',
  'import'
);

create type public.repair_attachment_kind as enum ('before', 'after');
create type public.repair_notification_channel as enum ('in_app', 'email');
create type public.repair_notification_status as enum ('pending', 'sent', 'failed', 'skipped');

create table public.repair_departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repair_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  legacy_uid text unique,
  legacy_username citext not null unique,
  full_name text not null,
  email citext,
  department_id uuid references public.repair_departments(id),
  role public.repair_app_role not null default 'employee',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repair_job_sequences (
  job_date date primary key,
  last_number integer not null check (last_number > 0)
);

create table public.repair_requests (
  id uuid primary key default gen_random_uuid(),
  legacy_job_id text unique,
  job_id text not null unique,
  requester_id uuid not null references public.repair_profiles(id),
  requester_name_snapshot text not null,
  requester_role_snapshot public.repair_app_role not null,
  department_id uuid not null references public.repair_departments(id),
  department_name_snapshot text not null,
  machine_id text not null,
  issue_details text not null check (char_length(issue_details) between 1 and 1000),
  status public.repair_status not null,
  total_cost numeric(12, 2) check (total_cost >= 0),
  approved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repair_request_actions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.repair_requests(id) on delete cascade,
  action public.repair_action not null,
  from_status public.repair_status,
  to_status public.repair_status not null,
  actor_id uuid references public.repair_profiles(id),
  actor_name_snapshot text not null,
  actor_role_snapshot public.repair_app_role,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (action = 'import' or actor_role_snapshot is not null)
);

create table public.repair_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.repair_requests(id) on delete cascade,
  kind public.repair_attachment_kind not null,
  storage_path text,
  legacy_drive_url text,
  original_file_name text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  uploaded_by uuid references public.repair_profiles(id),
  created_at timestamptz not null default now(),
  check (storage_path is not null or legacy_drive_url is not null)
);

create table public.repair_notifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.repair_requests(id) on delete cascade,
  recipient_profile_id uuid not null references public.repair_profiles(id) on delete cascade,
  channel public.repair_notification_channel not null,
  subject text not null,
  body text not null,
  status public.repair_notification_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repair_legacy_import_rows (
  id bigint generated always as identity primary key,
  source_sheet text not null,
  source_row integer not null,
  legacy_key text,
  payload jsonb not null,
  imported_at timestamptz not null default now(),
  unique (source_sheet, source_row)
);

comment on table public.repair_legacy_import_rows is
  'Raw legacy values excluding plaintext passwords. Access is server-only.';

create index repair_requests_requester_idx on public.repair_requests (requester_id, created_at desc);
create index repair_requests_department_idx on public.repair_requests (department_id, created_at desc);
create index repair_requests_status_idx on public.repair_requests (status, created_at desc);
create index repair_request_actions_request_idx on public.repair_request_actions (request_id, created_at);
create index repair_request_attachments_request_idx on public.repair_request_attachments (request_id, kind);
create index repair_notifications_recipient_idx on public.repair_notifications (recipient_profile_id, read_at, created_at desc);
create index repair_notifications_outbox_idx on public.repair_notifications (status, channel, created_at) where status in ('pending', 'failed');

create or replace function public.repair_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger repair_departments_set_updated_at before update on public.repair_departments
for each row execute function public.repair_set_updated_at();
create trigger repair_profiles_set_updated_at before update on public.repair_profiles
for each row execute function public.repair_set_updated_at();
create trigger repair_requests_set_updated_at before update on public.repair_requests
for each row execute function public.repair_set_updated_at();
create trigger repair_notifications_set_updated_at before update on public.repair_notifications
for each row execute function public.repair_set_updated_at();

revoke all on function public.repair_set_updated_at() from public;

