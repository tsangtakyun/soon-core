alter table public.settings
  add column if not exists invoice_prefix text default 'INV',
  add column if not exists invoice_start_number integer default 1,
  add column if not exists invoice_current_number integer default 0;

notify pgrst, 'reload schema';
