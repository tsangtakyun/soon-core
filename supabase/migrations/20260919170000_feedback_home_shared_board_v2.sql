-- SOON product feedback v2: two-person shared home board and auditable engineering hand-off.
-- This migration does not create an engineering runner. execution_status therefore defaults to not_connected.

alter table public.product_feedback_reporter_access
  drop constraint if exists product_feedback_reporter_access_access_scope_check;
alter table public.product_feedback_reporter_access
  add constraint product_feedback_reporter_access_access_scope_check
  check (access_scope in ('feedback_only', 'feedback_shared', 'core_member'));

-- Existing invited feedback-only reporters are the currently approved shared-board users.
update public.product_feedback_reporter_access
set access_scope = 'feedback_shared'
where access_scope = 'feedback_only' and status = 'active';

alter table public.product_feedback_reports
  drop constraint if exists product_feedback_reports_product_check;
alter table public.product_feedback_reports
  add constraint product_feedback_reports_product_check
  check (product in ('soon_creator', 'soon_egg', 'egg_app', 'soon_core'));

alter table public.product_feedback_reports
  add column if not exists reporter_name text,
  add column if not exists ai_response text,
  add column if not exists ai_confirmed_evidence jsonb not null default '[]'::jsonb,
  add column if not exists ai_worth_optimizing boolean,
  add column if not exists ai_optimization_reason text,
  add column if not exists ai_suggested_adjustment text,
  add column if not exists ai_priority text,
  add column if not exists ai_needs_discussion boolean,
  add column if not exists ai_intent text;

alter table public.product_feedback_reports
  drop constraint if exists product_feedback_reports_ai_priority_check;
alter table public.product_feedback_reports
  add constraint product_feedback_reports_ai_priority_check
  check (ai_priority is null or ai_priority in ('low', 'medium', 'high', 'urgent'));

alter table public.product_feedback_reports
  drop constraint if exists product_feedback_reports_ai_intent_check;
alter table public.product_feedback_reports
  add constraint product_feedback_reports_ai_intent_check
  check (ai_intent is null or ai_intent in ('bug', 'suggestion', 'question', 'other'));

alter table public.product_feedback_messages
  add column if not exists ai_analysis_status text not null default 'queued';
alter table public.product_feedback_messages
  drop constraint if exists product_feedback_messages_ai_analysis_status_check;
alter table public.product_feedback_messages
  add constraint product_feedback_messages_ai_analysis_status_check
  check (ai_analysis_status in ('queued', 'processing', 'completed', 'failed', 'not_configured'));

alter table public.product_feedback_attachments
  add column if not exists message_id uuid references public.product_feedback_messages(id) on delete cascade;
alter table public.product_feedback_attachments
  drop constraint if exists product_feedback_attachments_kind_check;
alter table public.product_feedback_attachments
  add constraint product_feedback_attachments_kind_check
  check (kind in ('screenshot', 'audio', 'file'));
create index if not exists product_feedback_attachments_message_idx
  on public.product_feedback_attachments (message_id, created_at);

create table if not exists public.product_feedback_engineering_tasks (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.product_feedback_reports(id) on delete cascade,
  idempotency_key text not null unique,
  disposition text not null check (disposition in ('eligible_auto_fix', 'needs_discussion', 'manual_engineering', 'not_needed')),
  execution_status text not null default 'not_connected' check (execution_status in ('not_connected', 'pending', 'running', 'tested', 'deployed', 'failed', 'completed')),
  eligibility_reason text,
  source_analysis jsonb not null default '{}'::jsonb,
  work_order_id uuid references public.company_work_orders(id) on delete set null,
  commit_sha text,
  diff_summary text,
  test_evidence jsonb not null default '[]'::jsonb,
  deployment_evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_feedback_engineering_tasks_status_idx
  on public.product_feedback_engineering_tasks (execution_status, updated_at desc);

drop trigger if exists product_feedback_engineering_tasks_touch_updated_at on public.product_feedback_engineering_tasks;
create trigger product_feedback_engineering_tasks_touch_updated_at
before update on public.product_feedback_engineering_tasks
for each row execute function public.touch_product_feedback_updated_at();

alter table public.product_feedback_engineering_tasks enable row level security;
revoke all on public.product_feedback_engineering_tasks from public, anon, authenticated;
grant all on public.product_feedback_engineering_tasks to service_role;

-- Keep the private bucket compatible with the home composer file types.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp',
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/webm', 'audio/ogg',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]
where id = 'product-feedback-private';

notify pgrst, 'reload schema';
