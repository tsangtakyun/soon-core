alter table public.docs
add column if not exists invoice_status text default 'draft';

alter table public.docs
add column if not exists invoice_amount numeric default 0;

alter table public.docs
add column if not exists invoice_client text;

alter table public.docs
add column if not exists invoice_date date;

alter table public.docs
add column if not exists invoice_due_date date;

alter table public.docs
add column if not exists invoice_currency text default 'HK$';

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id),
  date date not null default current_date,
  merchant text,
  description text,
  amount numeric not null default 0,
  original_amount numeric,
  original_currency text,
  converted_amount numeric,
  converted_currency text,
  exchange_rate numeric,
  category text default '雜項',
  receipt_images jsonb default '[]',
  ai_extracted boolean default false,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.financial_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id),
  year integer,
  month integer,
  total_income numeric default 0,
  total_expenses numeric default 0,
  net_amount numeric default 0,
  report_data jsonb,
  created_at timestamptz default now()
);

notify pgrst, 'reload schema';
