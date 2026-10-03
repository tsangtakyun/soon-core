-- Feedback v3 separates an auditable engineering hand-off from actual code execution.
-- company_work_orders is a passive queue; no remote/local engineering runner is connected.

alter table public.product_feedback_engineering_tasks
  drop constraint if exists product_feedback_engineering_tasks_execution_status_check;
alter table public.product_feedback_engineering_tasks
  add constraint product_feedback_engineering_tasks_execution_status_check
  check (execution_status in ('not_connected', 'awaiting_engineering', 'pending', 'running', 'tested', 'deployed', 'failed', 'completed'));

alter table public.product_feedback_engineering_tasks
  add column if not exists runner_status text not null default 'not_connected',
  add column if not exists handed_off_at timestamptz;

alter table public.product_feedback_engineering_tasks
  drop constraint if exists product_feedback_engineering_tasks_runner_status_check;
alter table public.product_feedback_engineering_tasks
  add constraint product_feedback_engineering_tasks_runner_status_check
  check (runner_status in ('not_connected', 'connected', 'disabled'));

update public.product_feedback_engineering_tasks
set execution_status = 'awaiting_engineering',
    runner_status = 'not_connected',
    handed_off_at = coalesce(handed_off_at, updated_at)
where execution_status = 'not_connected';

notify pgrst, 'reload schema';
