alter table public.intelligence_inbox_items
  add column if not exists primary_industry_code text,
  add column if not exists secondary_industry_codes text[] not null default '{}',
  add column if not exists industry_confidence numeric(4,3),
  add column if not exists industry_classification_status text not null default 'needs_review',
  add column if not exists industry_classified_at timestamptz;

alter table public.intelligence_inbox_items
  drop constraint if exists intelligence_inbox_items_industry_classification_status_check;

alter table public.intelligence_inbox_items
  add constraint intelligence_inbox_items_industry_classification_status_check
  check (industry_classification_status in ('classified', 'needs_review'));

create index if not exists intelligence_inbox_items_primary_industry_idx
  on public.intelligence_inbox_items (workspace_id, primary_industry_code, captured_at desc);

comment on column public.intelligence_inbox_items.industry_codes is
  'Source-level industry hints inherited from the watchlist. Do not use as the item primary classification.';
comment on column public.intelligence_inbox_items.primary_industry_code is
  'AI-classified primary industry for this individual content item.';
