do $$
begin
  create type public.ticket_type as enum (
    'new_feature',
    'feature_update',
    'bug'
  );
exception
  when duplicate_object then null;
end
$$;

alter table public.tickets
  add column if not exists ticket_type public.ticket_type not null default 'new_feature',
  add column if not exists acceptance_criteria text,
  add column if not exists reproduction_steps text,
  add column if not exists expected_behavior text,
  add column if not exists actual_behavior text,
  add column if not exists affected_platforms text[] not null default '{}',
  add column if not exists preview_url text,
  add column if not exists repository_url text,
  add column if not exists design_url text,
  add column if not exists dev_notes text,
  add column if not exists assignee_id uuid references auth.users (id) on delete set null,
  add column if not exists due_date date;

alter table public.tickets
  add constraint tickets_acceptance_criteria_length check (char_length(acceptance_criteria) <= 5000),
  add constraint tickets_reproduction_steps_length check (char_length(reproduction_steps) <= 5000),
  add constraint tickets_expected_behavior_length check (char_length(expected_behavior) <= 3000),
  add constraint tickets_actual_behavior_length check (char_length(actual_behavior) <= 3000),
  add constraint tickets_dev_notes_length check (char_length(dev_notes) <= 10000),
  add constraint tickets_preview_url_length check (char_length(preview_url) <= 2000),
  add constraint tickets_repository_url_length check (char_length(repository_url) <= 2000),
  add constraint tickets_design_url_length check (char_length(design_url) <= 2000),
  add constraint tickets_affected_platforms_values check (
    affected_platforms <@ array['desktop', 'mobile', 'tablet']::text[]
  );

create index if not exists tickets_assignee_id_idx on public.tickets (assignee_id);
create index if not exists tickets_due_date_idx on public.tickets (due_date) where due_date is not null;

create table if not exists public.ticket_subtasks (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  title text not null,
  description text,
  is_completed boolean not null default false,
  due_date date,
  assignee_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ticket_subtasks_title_length check (char_length(title) between 2 and 200),
  constraint ticket_subtasks_description_length check (char_length(description) <= 2000)
);

create index if not exists ticket_subtasks_ticket_id_idx on public.ticket_subtasks (ticket_id, created_at);
create index if not exists ticket_subtasks_assignee_id_idx on public.ticket_subtasks (assignee_id);

alter table public.ticket_subtasks enable row level security;

create or replace function public.can_work_on_ticket(check_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.current_user_is_admin())
    or exists (
      select 1
      from public.tickets
      join public.project_members on project_members.project_id = tickets.project_id
      join public.user_roles on user_roles.user_id = project_members.user_id
      where tickets.id = check_ticket_id
        and project_members.user_id = (select auth.uid())
        and user_roles.role in (
          'project_manager'::public.app_role,
          'developer'::public.app_role,
          'designer'::public.app_role
        )
    );
$$;

create or replace function public.validate_ticket_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_project_id uuid;
begin
  if new.assignee_id is null then
    return new;
  end if;

  if tg_table_name = 'tickets' then
    assigned_project_id := new.project_id;
  else
    select tickets.project_id into assigned_project_id
    from public.tickets
    where tickets.id = new.ticket_id;
  end if;

  if not exists (
    select 1 from public.project_members
    where project_members.project_id = assigned_project_id
      and project_members.user_id = new.assignee_id
  ) then
    raise exception 'Assignee must be a member of the ticket project';
  end if;

  return new;
end;
$$;

revoke all on function public.can_work_on_ticket(uuid) from public, anon;
grant execute on function public.can_work_on_ticket(uuid) to authenticated;
revoke all on function public.validate_ticket_assignee() from public, anon, authenticated;

drop trigger if exists validate_ticket_assignee on public.tickets;
create trigger validate_ticket_assignee
  before insert or update of assignee_id, project_id on public.tickets
  for each row execute procedure public.validate_ticket_assignee();

drop trigger if exists validate_subtask_assignee on public.ticket_subtasks;
create trigger validate_subtask_assignee
  before insert or update of assignee_id, ticket_id on public.ticket_subtasks
  for each row execute procedure public.validate_ticket_assignee();

drop trigger if exists set_ticket_subtasks_updated_at on public.ticket_subtasks;
create trigger set_ticket_subtasks_updated_at
  before update on public.ticket_subtasks
  for each row execute procedure public.set_profile_updated_at();

create policy "Project members can read ticket subtasks"
  on public.ticket_subtasks
  for select
  to authenticated
  using ((select public.can_access_ticket(ticket_id)));

create policy "Project contributors can create ticket subtasks"
  on public.ticket_subtasks
  for insert
  to authenticated
  with check (
    (select public.can_work_on_ticket(ticket_id))
    and created_by = (select auth.uid())
  );

create policy "Project contributors can update ticket subtasks"
  on public.ticket_subtasks
  for update
  to authenticated
  using ((select public.can_work_on_ticket(ticket_id)))
  with check ((select public.can_work_on_ticket(ticket_id)));

create policy "Project contributors can delete ticket subtasks"
  on public.ticket_subtasks
  for delete
  to authenticated
  using ((select public.can_work_on_ticket(ticket_id)));

-- Clients can describe requested work, but cannot assign it or add internal notes.
drop policy if exists "Project members can request tickets" on public.tickets;
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
    and assignee_id is null
    and dev_notes is null
  );
