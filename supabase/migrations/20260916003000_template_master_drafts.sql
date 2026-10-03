create table if not exists public.template_master_drafts (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.content_templates(id) on delete restrict,
  base_template_version_id uuid not null references public.template_versions(id) on delete restrict,
  style_id uuid not null references public.content_styles(id) on delete restrict,
  style_version_id uuid not null references public.style_versions(id) on delete restrict,
  target_version integer not null check (target_version > 0),
  status text not null default 'draft' check (status in ('draft','review','published','abandoned')),
  page_designs jsonb not null default '{}'::jsonb check (jsonb_typeof(page_designs) = 'object'),
  change_summary text not null default '',
  edit_token_hash text not null,
  created_by uuid references auth.users(id) on delete set null,
  published_template_version_id uuid references public.template_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (template_id, target_version)
);

create index if not exists template_master_drafts_status_idx
  on public.template_master_drafts(template_id,status,updated_at desc);

alter table public.template_master_drafts enable row level security;
revoke all on public.template_master_drafts from public,anon,authenticated;
grant all on public.template_master_drafts to service_role;

notify pgrst,'reload schema';
