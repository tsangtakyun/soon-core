-- SOON product feedback reporting v1
-- Private-by-default intake shared by SOON Creator, SOON EGG and EGG App.

create table if not exists public.product_feedback_reporter_access (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  role text not null default 'reporter' check (role in ('reporter', 'triage_admin')),
  access_scope text not null default 'feedback_only' check (access_scope in ('feedback_only', 'core_member')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_feedback_reporter_access_email_unique
  on public.product_feedback_reporter_access (lower(email));

create table if not exists public.product_feedback_reports (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique,
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  reporter_email text not null,
  product text not null check (product in ('soon_creator', 'soon_egg', 'egg_app')),
  description text not null check (char_length(description) between 10 and 8000),
  expected_behavior text check (expected_behavior is null or char_length(expected_behavior) <= 4000),
  problem_url text check (problem_url is null or char_length(problem_url) <= 2048),
  app_version text check (app_version is null or char_length(app_version) <= 120),
  source_context jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review' check (status in ('pending_review', 'in_progress', 'pending_verification', 'resolved')),
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  assigned_to_email text,
  ai_status text not null default 'queued' check (ai_status in ('queued', 'processing', 'completed', 'failed', 'not_configured')),
  ai_title text,
  ai_summary text,
  ai_reproduction_steps jsonb not null default '[]'::jsonb,
  ai_impact text,
  ai_missing_information jsonb not null default '[]'::jsonb,
  ai_possible_duplicates jsonb not null default '[]'::jsonb,
  ai_inference_notes jsonb not null default '[]'::jsonb,
  ai_error text,
  audio_transcript text,
  dedupe_hash text not null,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists product_feedback_reports_reporter_created_idx
  on public.product_feedback_reports (reporter_user_id, created_at desc);
create index if not exists product_feedback_reports_status_created_idx
  on public.product_feedback_reports (status, created_at desc);
create index if not exists product_feedback_reports_dedupe_idx
  on public.product_feedback_reports (reporter_user_id, dedupe_hash, created_at desc);

create table if not exists public.product_feedback_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.product_feedback_reports(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  kind text not null check (kind in ('screenshot', 'audio')),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null,
  created_at timestamptz not null default now()
);

create index if not exists product_feedback_attachments_report_idx
  on public.product_feedback_attachments (report_id, created_at);

create table if not exists public.product_feedback_messages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.product_feedback_reports(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete restrict,
  author_email text not null,
  author_role text not null check (author_role in ('reporter', 'admin')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists product_feedback_messages_report_idx
  on public.product_feedback_messages (report_id, created_at);

create table if not exists public.product_feedback_status_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.product_feedback_reports(id) on delete cascade,
  from_status text,
  to_status text not null check (to_status in ('pending_review', 'in_progress', 'pending_verification', 'resolved')),
  changed_by_user_id uuid references auth.users(id) on delete set null,
  changed_by_email text,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists product_feedback_status_history_report_idx
  on public.product_feedback_status_history (report_id, created_at);

create or replace function public.touch_product_feedback_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists product_feedback_reporter_access_touch_updated_at on public.product_feedback_reporter_access;
create trigger product_feedback_reporter_access_touch_updated_at
before update on public.product_feedback_reporter_access
for each row execute function public.touch_product_feedback_updated_at();

drop trigger if exists product_feedback_reports_touch_updated_at on public.product_feedback_reports;
create trigger product_feedback_reports_touch_updated_at
before update on public.product_feedback_reports
for each row execute function public.touch_product_feedback_updated_at();

alter table public.product_feedback_reporter_access enable row level security;
alter table public.product_feedback_reports enable row level security;
alter table public.product_feedback_attachments enable row level security;
alter table public.product_feedback_messages enable row level security;
alter table public.product_feedback_status_history enable row level security;

revoke all on public.product_feedback_reporter_access from anon, authenticated;
revoke all on public.product_feedback_reports from anon, authenticated;
revoke all on public.product_feedback_attachments from anon, authenticated;
revoke all on public.product_feedback_messages from anon, authenticated;
revoke all on public.product_feedback_status_history from anon, authenticated;

grant select on public.product_feedback_reporter_access to authenticated;
grant all on public.product_feedback_reporter_access to service_role;
grant all on public.product_feedback_reports to service_role;
grant all on public.product_feedback_attachments to service_role;
grant all on public.product_feedback_messages to service_role;
grant all on public.product_feedback_status_history to service_role;

drop policy if exists feedback_reporter_access_select_self on public.product_feedback_reporter_access;
create policy feedback_reporter_access_select_self
on public.product_feedback_reporter_access
for select
to authenticated
using (
  status = 'active'
  and (
    user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

-- Attachments are only read or written by server routes after ownership/admin checks.
-- The bucket remains private; clients never receive a public object URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-feedback-private',
  'product-feedback-private',
  false,
  20971520,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/webm', 'audio/ogg'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
