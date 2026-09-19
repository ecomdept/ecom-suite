alter table public.ticket_subtasks
  add column if not exists estimated_hours numeric(8, 2) not null default 0,
  add column if not exists logged_hours numeric(8, 2) not null default 0;

alter table public.ticket_subtasks
  add constraint ticket_subtasks_estimated_hours_nonnegative check (estimated_hours >= 0),
  add constraint ticket_subtasks_logged_hours_nonnegative check (logged_hours >= 0);

create index if not exists ticket_subtasks_assignee_due_date_idx
  on public.ticket_subtasks (assignee_id, due_date)
  where assignee_id is not null and is_completed = false;
