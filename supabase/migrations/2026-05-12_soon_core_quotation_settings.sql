alter table public.settings
  add column if not exists quote_prefix text default 'QUO',
  add column if not exists quote_current_number integer default 0,
  add column if not exists cheque_payable_to text,
  add column if not exists cheque_address text,
  add column if not exists fps_id text,
  add column if not exists paypal_email text,
  add column if not exists payment_days integer default 30,
  add column if not exists interest_rate numeric default 5,
  add column if not exists authorized_name text default 'Tommy',
  add column if not exists bank_transfer_enabled boolean default true,
  add column if not exists cheque_enabled boolean default false,
  add column if not exists fps_enabled boolean default false,
  add column if not exists paypal_enabled boolean default false;

notify pgrst, 'reload schema';
