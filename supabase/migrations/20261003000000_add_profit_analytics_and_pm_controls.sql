alter table public.projects
  add column if not exists rollover_enabled boolean not null default false,
  add column if not exists rollover_cap_hours numeric(10, 2);

alter table public.projects
  drop constraint if exists projects_rollover_cap_nonnegative,
  add constraint projects_rollover_cap_nonnegative
    check (rollover_cap_hours is null or rollover_cap_hours >= 0);

create table if not exists public.team_cost_rates (
  user_id uuid primary key references auth.users (id) on delete cascade,
  hourly_cost numeric(10, 2) not null default 0,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint team_cost_rates_hourly_cost_nonnegative check (hourly_cost >= 0)
);

alter table public.team_cost_rates enable row level security;

drop policy if exists "Admins can view team cost rates" on public.team_cost_rates;
create policy "Admins can view team cost rates"
  on public.team_cost_rates
  for select
  to authenticated
  using ((select public.current_user_is_admin()));

drop policy if exists "Admins can create team cost rates" on public.team_cost_rates;
create policy "Admins can create team cost rates"
  on public.team_cost_rates
  for insert
  to authenticated
  with check ((select public.current_user_is_admin()));

drop policy if exists "Admins can update team cost rates" on public.team_cost_rates;
create policy "Admins can update team cost rates"
  on public.team_cost_rates
  for update
  to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

drop trigger if exists set_team_cost_rates_updated_at on public.team_cost_rates;
create trigger set_team_cost_rates_updated_at
  before update on public.team_cost_rates
  for each row execute procedure public.set_profile_updated_at();

alter table public.ticket_time_entries
  add column if not exists worker_id uuid references auth.users (id) on delete set null;

create index if not exists ticket_time_entries_worker_created_idx
  on public.ticket_time_entries (worker_id, created_at desc);

update public.ticket_time_entries as entries
set worker_id = coalesce(subtasks.assignee_id, tickets.assignee_id, entries.recorded_by)
from public.ticket_subtasks as subtasks, public.tickets as tickets
where entries.subtask_id = subtasks.id
  and tickets.id = entries.ticket_id
  and entries.worker_id is null;

update public.ticket_time_entries as entries
set worker_id = coalesce(tickets.assignee_id, entries.recorded_by)
from public.tickets as tickets
where entries.subtask_id is null
  and tickets.id = entries.ticket_id
  and entries.worker_id is null;

create or replace function public.record_ticket_time_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hours_delta numeric(10, 2);
begin
  if tg_op = 'INSERT' then
    hours_delta := coalesce(new.logged_hours, 0);
  else
    hours_delta := coalesce(new.logged_hours, 0) - coalesce(old.logged_hours, 0);
  end if;

  if hours_delta <> 0 then
    insert into public.ticket_time_entries (
      ticket_id,
      project_id,
      hours,
      recorded_by,
      worker_id
    ) values (
      new.id,
      new.project_id,
      hours_delta,
      (select auth.uid()),
      coalesce(new.assignee_id, (select auth.uid()))
    );
  end if;

  return new;
end;
$$;

create or replace function public.record_subtask_time_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hours_delta numeric(10, 2);
  parent_project_id uuid;
begin
  if tg_op = 'INSERT' then
    hours_delta := coalesce(new.logged_hours, 0);
  else
    hours_delta := coalesce(new.logged_hours, 0) - coalesce(old.logged_hours, 0);
  end if;

  if hours_delta <> 0 then
    select project_id into parent_project_id
    from public.tickets
    where id = new.ticket_id;

    insert into public.ticket_time_entries (
      ticket_id,
      subtask_id,
      project_id,
      hours,
      recorded_by,
      worker_id
    ) values (
      new.ticket_id,
      new.id,
      parent_project_id,
      hours_delta,
      (select auth.uid()),
      coalesce(new.assignee_id, (select auth.uid()))
    );
  end if;

  return new;
end;
$$;

drop policy if exists "Project managers can update assigned projects" on public.projects;
create policy "Project managers can update assigned projects"
  on public.projects
  for update
  to authenticated
  using ((select public.can_manage_project_tickets(id)))
  with check ((select public.can_manage_project_tickets(id)));

drop policy if exists "Project managers can add members to assigned projects" on public.project_members;
create policy "Project managers can add members to assigned projects"
  on public.project_members
  for insert
  to authenticated
  with check ((select public.can_manage_project_tickets(project_id)));

drop policy if exists "Project managers can remove members from assigned projects" on public.project_members;
create policy "Project managers can remove members from assigned projects"
  on public.project_members
  for delete
  to authenticated
  using ((select public.can_manage_project_tickets(project_id)));
