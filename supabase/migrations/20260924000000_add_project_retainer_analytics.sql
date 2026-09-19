alter table public.projects
  add column if not exists retainer_hours numeric(10, 2),
  add column if not exists budget_amount numeric(12, 2),
  add column if not exists currency text not null default 'USD',
  add column if not exists retainer_period_start date,
  add column if not exists retainer_period_end date;

alter table public.projects
  add constraint projects_retainer_hours_nonnegative
    check (retainer_hours is null or retainer_hours >= 0),
  add constraint projects_budget_amount_nonnegative
    check (budget_amount is null or budget_amount >= 0),
  add constraint projects_currency_format
    check (currency ~ '^[A-Z]{3}$'),
  add constraint projects_retainer_period_order
    check (
      retainer_period_start is null
      or retainer_period_end is null
      or retainer_period_end >= retainer_period_start
    );

alter table public.tickets
  add column if not exists estimated_hours numeric(8, 2) not null default 0,
  add column if not exists logged_hours numeric(8, 2) not null default 0,
  add column if not exists billable_amount numeric(12, 2) not null default 0;

alter table public.tickets
  add constraint tickets_estimated_hours_nonnegative check (estimated_hours >= 0),
  add constraint tickets_logged_hours_nonnegative check (logged_hours >= 0),
  add constraint tickets_billable_amount_nonnegative check (billable_amount >= 0);

-- Any assigned member, including a client, can submit a new request to Backlog.
-- Workflow and usage updates remain restricted by the existing manager update policy.
create policy "Project members can request tickets"
  on public.tickets
  for insert
  to authenticated
  with check (
    (select public.is_project_member(project_id))
    and created_by = (select auth.uid())
    and status = 'backlog'::public.ticket_status
    and estimated_hours = 0
    and logged_hours = 0
    and billable_amount = 0
  );
