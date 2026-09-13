create table if not exists public.content_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{2,79}$'),
  format text not null check (format in ('instagram_carousel','instagram_single_feed','human_short_video','ai_short_video')),
  name text not null,
  description text not null default '',
  status text not null default 'active' check (status in ('active','deprecated')),
  scope text not null default 'soon_owned' check (scope in ('public_research','soon_owned','workspace_private')),
  source_workspace_id uuid not null references public.workspaces(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope = 'workspace_private' or source_workspace_id = 'a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid)
);

create table if not exists public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.content_templates(id) on delete restrict,
  version integer not null check (version > 0),
  renderer_code text not null check (renderer_code ~ '^[a-z][a-z0-9-]{2,119}$'),
  contract jsonb not null check (jsonb_typeof(contract) = 'object'),
  change_summary text not null,
  status text not null default 'draft' check (status in ('draft','review','published')),
  content_hash text not null,
  creator_commit text,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id,version),
  unique (renderer_code),
  unique (template_id,id),
  check ((status='published' and published_at is not null) or status<>'published')
);

create table if not exists public.style_template_bindings (
  id uuid primary key default gen_random_uuid(),
  style_version_id uuid not null references public.style_versions(id) on delete restrict,
  template_version_id uuid not null references public.template_versions(id) on delete restrict,
  status text not null default 'active' check (status in ('active','deprecated')),
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  unique (style_version_id,template_version_id)
);

create index if not exists template_versions_published_idx on public.template_versions(template_id,status,version desc);
create index if not exists style_template_bindings_style_idx on public.style_template_bindings(style_version_id,status,priority);

create or replace function public.prepare_template_version()
returns trigger
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
begin
  if tg_op='UPDATE' and old.status='published' then
    raise exception 'Published template versions are immutable';
  end if;
  if tg_op='UPDATE' and (new.template_id<>old.template_id or new.version<>old.version or new.renderer_code<>old.renderer_code) then
    raise exception 'Template version identity is immutable';
  end if;
  if tg_op='UPDATE' and old.status='draft' and new.status='published' then
    raise exception 'Template version must enter review before publication';
  end if;
  if new.status='published' then
    new.published_at:=coalesce(new.published_at,now());
  else
    new.published_at:=null;
    new.published_by:=null;
  end if;
  new.content_hash:=encode(extensions.digest(new.contract::text,'sha256'),'hex');
  new.updated_at:=now();
  return new;
end
$$;

create or replace function public.prevent_published_template_delete()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if old.status='published' then raise exception 'Published template versions cannot be deleted'; end if;
  return old;
end
$$;

drop trigger if exists prepare_template_version_trigger on public.template_versions;
create trigger prepare_template_version_trigger before insert or update on public.template_versions for each row execute function public.prepare_template_version();
drop trigger if exists prevent_published_template_delete_trigger on public.template_versions;
create trigger prevent_published_template_delete_trigger before delete on public.template_versions for each row execute function public.prevent_published_template_delete();

alter table public.content_templates enable row level security;
alter table public.template_versions enable row level security;
alter table public.style_template_bindings enable row level security;
revoke all on public.content_templates,public.template_versions,public.style_template_bindings from public,anon,authenticated;
grant all on public.content_templates,public.template_versions,public.style_template_bindings to service_role;
revoke execute on function public.prepare_template_version(),public.prevent_published_template_delete() from public,anon,authenticated;
grant execute on function public.prepare_template_version(),public.prevent_published_template_delete() to service_role;

insert into public.content_templates(id,code,format,name,description,status,scope,source_workspace_id)
values (
  'cb000001-0000-4000-8000-000000000001'::uuid,
  'clear_magazine_carousel','instagram_carousel','Clear Magazine Carousel Template',
  'Creator renderer contract for clear magazine carousel output and square selection preview.',
  'active','soon_owned','a5c7750e-1b3b-495b-8cd3-6e1d47d05ef2'::uuid
)
on conflict (code) do nothing;

insert into public.template_versions(id,template_id,version,renderer_code,contract,change_summary,status,creator_commit)
select
  'cb100001-0000-4000-8000-000000000001'::uuid,t.id,1,'clear-magazine-carousel-v1',
  '{
    "schema_version": 1,
    "output": {"width": 1080, "height": 1350, "aspect_ratio": "4:5"},
    "page_roles": [
      {"position": "01", "role": "cover"},
      {"position": "02", "role": "longform"},
      {"position": "03", "role": "split"},
      {"position": "04", "role": "comparison"},
      {"position": "05", "role": "feature"},
      {"position": "06", "role": "end"}
    ],
    "preview": {"width": 1200, "height": 1200, "aspect_ratio": "1:1"},
    "body_punctuation": "line-breaks-only",
    "brand_bindings": {
      "logo": "workspace.logo_url",
      "font": "workspace.font_style",
      "colors": "brand_profiles.brand_colors",
      "fallback": "template_defaults"
    }
  }'::jsonb,
  'Template v1 registered from Creator production implementation 5d42b26. Future changes require a new version.',
  'draft','5d42b26'
from public.content_templates t where t.code='clear_magazine_carousel'
on conflict (template_id,version) do nothing;

update public.template_versions v set status='review'
from public.content_templates t where v.template_id=t.id and t.code='clear_magazine_carousel' and v.version=1 and v.status='draft';
update public.template_versions v set status='published'
from public.content_templates t where v.template_id=t.id and t.code='clear_magazine_carousel' and v.version=1 and v.status='review';

insert into public.style_template_bindings(style_version_id,template_version_id,status,priority)
select sv.id,tv.id,'active',10
from public.style_versions sv
join public.content_styles s on s.id=sv.style_id and s.code='clear_magazine_carousel'
join public.content_templates t on t.code='clear_magazine_carousel'
join public.template_versions tv on tv.template_id=t.id and tv.version=1 and tv.status='published'
where sv.version=1 and sv.status='published'
on conflict (style_version_id,template_version_id) do nothing;

notify pgrst,'reload schema';
