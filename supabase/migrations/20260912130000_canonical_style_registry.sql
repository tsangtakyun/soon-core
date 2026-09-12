create extension if not exists pgcrypto;

create table if not exists public.content_styles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  format text not null check (format in ('instagram_carousel','instagram_single_feed','human_short_video','ai_short_video')),
  name text not null,
  description text not null default '',
  status text not null default 'active' check (status in ('active','deprecated')),
  scope text not null default 'public_research' check (scope in ('public_research','soon_owned','workspace_private')),
  source_workspace_id uuid not null references public.workspaces(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope = 'workspace_private' or source_workspace_id = 'a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid)
);

create table if not exists public.style_versions (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references public.content_styles(id) on delete restrict,
  version integer not null check (version > 0),
  rules jsonb not null check (jsonb_typeof(rules) = 'object'),
  change_summary text not null,
  status text not null default 'draft' check (status in ('draft','review','published')),
  content_hash text not null,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (style_id, version),
  unique (style_id, id),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table if not exists public.style_references (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references public.content_styles(id) on delete restrict,
  style_version_id uuid,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  reference_type text not null check (reference_type in ('intelligence_inbox','content_direction','external')),
  intelligence_inbox_item_id uuid references public.intelligence_inbox_items(id) on delete restrict,
  content_direction_doc_id uuid references public.docs(id) on delete restrict,
  source_url text,
  source_account text,
  extracted_patterns jsonb not null default '{}'::jsonb check (jsonb_typeof(extracted_patterns) = 'object'),
  evidence_summary text not null default '',
  evidence_level text not null default 'observed' check (evidence_level in ('observed','directional','candidate','confirmed')),
  confirmation_status text not null default 'suggested' check (confirmation_status in ('suggested','review','confirmed','rejected')),
  source_scope text not null check (source_scope in ('public_research','soon_owned','workspace_private')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (style_id, style_version_id) references public.style_versions(style_id, id) on delete restrict,
  check (
    (reference_type = 'intelligence_inbox' and intelligence_inbox_item_id is not null and content_direction_doc_id is null)
    or (reference_type = 'content_direction' and content_direction_doc_id is not null and intelligence_inbox_item_id is null)
    or (reference_type = 'external' and intelligence_inbox_item_id is null and content_direction_doc_id is null and source_url is not null)
  ),
  check ((confirmation_status = 'confirmed' and confirmed_at is not null) or confirmation_status <> 'confirmed')
);

create table if not exists public.style_version_events (
  id uuid primary key default gen_random_uuid(),
  style_version_id uuid not null references public.style_versions(id) on delete restrict,
  from_status text check (from_status is null or from_status in ('draft','review','published')),
  to_status text not null check (to_status in ('draft','review','published')),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists content_styles_format_status_idx on public.content_styles(format,status);
create index if not exists style_versions_published_idx on public.style_versions(style_id,status,version desc);
create index if not exists style_references_style_idx on public.style_references(style_id,style_version_id,confirmation_status);
create index if not exists style_references_workspace_idx on public.style_references(workspace_id,created_at desc);

create or replace function public.prepare_style_version()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'published' then
    raise exception 'Published style versions are immutable';
  end if;
  if tg_op = 'UPDATE' and (new.style_id <> old.style_id or new.version <> old.version) then
    raise exception 'Style version identity is immutable';
  end if;
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status = 'published' then
    raise exception 'Style version must enter review before publication';
  end if;
  if new.status = 'published' then
    if not exists (
      select 1 from public.style_references r
      where r.style_version_id = new.id and r.confirmation_status = 'confirmed'
    ) then
      raise exception 'A published style version requires at least one confirmed reference';
    end if;
    if exists (
      select 1 from public.style_references r
      join public.content_styles s on s.id = new.style_id
      where r.style_version_id = new.id
        and r.confirmation_status = 'confirmed'
        and r.source_scope = 'workspace_private'
        and s.scope <> 'workspace_private'
    ) then
      raise exception 'Private workspace references cannot publish into a shared style';
    end if;
    new.published_at := coalesce(new.published_at, now());
  else
    new.published_at := null;
    new.published_by := null;
  end if;
  new.content_hash := encode(extensions.digest(new.rules::text, 'sha256'), 'hex');
  new.updated_at := now();
  return new;
end
$$;

create or replace function public.log_style_version_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if tg_op = 'INSERT' then
      insert into public.style_version_events(style_version_id,from_status,to_status,actor_id)
      values (new.id,null,new.status,new.created_by);
    else
      insert into public.style_version_events(style_version_id,from_status,to_status,actor_id)
      values (new.id,old.status,new.status,
        case when new.status = 'published' then new.published_by when new.status = 'review' then new.reviewed_by else new.created_by end);
    end if;
  end if;
  return new;
end
$$;

create or replace function public.prevent_style_version_delete()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'published' then raise exception 'Published style versions cannot be deleted'; end if;
  return old;
end
$$;

create or replace function public.prevent_style_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Style version events are immutable';
end
$$;

drop trigger if exists prepare_style_version_trigger on public.style_versions;
create trigger prepare_style_version_trigger before insert or update on public.style_versions for each row execute function public.prepare_style_version();
drop trigger if exists log_style_version_status_trigger on public.style_versions;
create trigger log_style_version_status_trigger after insert or update of status on public.style_versions for each row execute function public.log_style_version_status();
drop trigger if exists prevent_style_version_delete_trigger on public.style_versions;
create trigger prevent_style_version_delete_trigger before delete on public.style_versions for each row execute function public.prevent_style_version_delete();
drop trigger if exists prevent_style_event_mutation_trigger on public.style_version_events;
create trigger prevent_style_event_mutation_trigger before update or delete on public.style_version_events for each row execute function public.prevent_style_event_mutation();

alter table public.content_styles enable row level security;
alter table public.style_versions enable row level security;
alter table public.style_references enable row level security;
alter table public.style_version_events enable row level security;
revoke all on public.content_styles,public.style_versions,public.style_references,public.style_version_events from public,anon,authenticated;
grant all on public.content_styles,public.style_versions,public.style_references,public.style_version_events to service_role;
revoke execute on function public.prepare_style_version(),public.log_style_version_status(),public.prevent_style_version_delete(),public.prevent_style_event_mutation() from public,anon,authenticated;
grant execute on function public.prepare_style_version(),public.log_style_version_status(),public.prevent_style_version_delete(),public.prevent_style_event_mutation() to service_role;

insert into public.content_styles(id,code,format,name,description,status,scope,source_workspace_id)
values (
  'ca000001-0000-4000-8000-000000000001'::uuid,
  'editorial_contrast_carousel',
  'instagram_carousel',
  '反差編輯輪播',
  '用清楚反差、逐頁推進及可保存結論，將文化或產品觀察整理成輪播。',
  'active',
  'public_research',
  'a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid
)
on conflict (code) do nothing;

insert into public.style_versions(id,style_id,version,rules,change_summary,status)
select
  'ca100001-0000-4000-8000-000000000001'::uuid,
  s.id,
  1,
  '{
    "schema_version": 1,
    "format": "instagram_carousel",
    "slide_count": {"min": 4, "recommended": 6, "max": 10},
    "structure": ["cover_hook", "context", "contrast", "evidence", "takeaway", "cta"],
    "cover": {"headline_max_chars_zh": 18, "use_single_tension": true, "preferred_hook_patterns": ["comparison", "surprising_contrast", "contrarian"]},
    "copy": {"one_point_per_slide": true, "body_max_chars_zh": 70, "plain_language": true},
    "visual": {"aspect_ratio": "1:1", "consistent_grid": true, "contrast_pairing": true},
    "cta": {"default": "save_or_share", "avoid_forced_engagement": true},
    "compliance": {"claims_require_source": true, "private_client_data_forbidden": true}
  }'::jsonb,
  'Initial carousel production contract distilled from SOON public content-direction research.',
  'draft'
from public.content_styles s
where s.code = 'editorial_contrast_carousel'
on conflict (style_id,version) do nothing;

insert into public.style_references(
  style_id,style_version_id,workspace_id,reference_type,content_direction_doc_id,source_url,source_account,
  extracted_patterns,evidence_summary,evidence_level,confirmation_status,source_scope,confirmed_at
)
select
  s.id,v.id,d.workspace_id,'content_direction',d.id,
  public.soon_jsonb(d.content)->>'postUrl',public.soon_jsonb(d.content)->>'account',
  jsonb_build_object(
    'hook',public.soon_jsonb(d.content)->'hook',
    'format',public.soon_jsonb(d.content)->'format',
    'visual_pattern',public.soon_jsonb(d.content)->'visualPattern',
    'mechanism',public.soon_jsonb(d.content)->'mechanism',
    'reusable_template',public.soon_jsonb(d.content)->'reusableTemplate'
  ),
  coalesce(public.soon_jsonb(d.content)->>'whySave','Initial public research reference.'),
  'observed','confirmed','public_research',now()
from public.content_styles s
join public.style_versions v on v.style_id=s.id and v.version=1
join lateral (
  select * from public.docs
  where template_type='content_direction'
    and workspace_id='a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid
  order by created_at asc limit 1
) d on true
where s.code='editorial_contrast_carousel'
  and not exists (select 1 from public.style_references r where r.style_version_id=v.id and r.content_direction_doc_id=d.id);

update public.style_versions v set status='review',reviewed_by=null
from public.content_styles s where v.style_id=s.id and s.code='editorial_contrast_carousel' and v.version=1 and v.status='draft';
update public.style_versions v set status='published',published_by=null
from public.content_styles s where v.style_id=s.id and s.code='editorial_contrast_carousel' and v.version=1 and v.status='review';

notify pgrst, 'reload schema';
