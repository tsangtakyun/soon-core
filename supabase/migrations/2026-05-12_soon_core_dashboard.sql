create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text default 'youtube',
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id),
  title text not null,
  type text default 'youtube',
  host text,
  owner text,
  shoot_date date,
  status text default '1. 未拍攝',
  current_stage text default '未寫稿',
  pipeline_step text default 'idea',
  languages integer default 3,
  category text default 'youtube',
  output_url text,
  last_visited_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.docs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id),
  title text not null,
  template_type text,
  content text,
  created_at timestamptz default now()
);

notify pgrst, 'reload schema';
