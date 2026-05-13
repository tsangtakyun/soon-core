alter table public.expenses enable row level security;
alter table public.financial_reports enable row level security;

drop policy if exists "soon_core_public_select_expenses" on public.expenses;
drop policy if exists "soon_core_public_insert_expenses" on public.expenses;
drop policy if exists "soon_core_public_update_expenses" on public.expenses;
drop policy if exists "soon_core_public_delete_expenses" on public.expenses;

create policy "soon_core_public_select_expenses"
  on public.expenses for select
  to anon, authenticated
  using (true);

create policy "soon_core_public_insert_expenses"
  on public.expenses for insert
  to anon, authenticated
  with check (true);

create policy "soon_core_public_update_expenses"
  on public.expenses for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "soon_core_public_delete_expenses"
  on public.expenses for delete
  to anon, authenticated
  using (true);

drop policy if exists "soon_core_public_select_financial_reports" on public.financial_reports;
drop policy if exists "soon_core_public_insert_financial_reports" on public.financial_reports;
drop policy if exists "soon_core_public_update_financial_reports" on public.financial_reports;
drop policy if exists "soon_core_public_delete_financial_reports" on public.financial_reports;

create policy "soon_core_public_select_financial_reports"
  on public.financial_reports for select
  to anon, authenticated
  using (true);

create policy "soon_core_public_insert_financial_reports"
  on public.financial_reports for insert
  to anon, authenticated
  with check (true);

create policy "soon_core_public_update_financial_reports"
  on public.financial_reports for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "soon_core_public_delete_financial_reports"
  on public.financial_reports for delete
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';
