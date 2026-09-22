alter table public.ticket_time_entries
  add column if not exists work_date date,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.ticket_time_entries
set work_date = (created_at at time zone 'utc')::date
where work_date is null;

alter table public.ticket_time_entries
  alter column work_date set default current_date,
  alter column work_date set not null;

create index if not exists ticket_time_entries_user_work_date_idx
  on public.ticket_time_entries (worker_id, work_date desc);

drop trigger if exists set_ticket_time_entries_updated_at on public.ticket_time_entries;
create trigger set_ticket_time_entries_updated_at
  before update on public.ticket_time_entries
  for each row execute procedure public.set_profile_updated_at();

create or replace function public.current_user_is_admin_or_project_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role in ('admin'::public.app_role, 'project_manager'::public.app_role)
  );
$$;

revoke all on function public.current_user_is_admin_or_project_manager() from public, anon;
grant execute on function public.current_user_is_admin_or_project_manager() to authenticated;

drop policy if exists "Project members can view time entries" on public.ticket_time_entries;
drop policy if exists "Users and managers can view timesheet entries" on public.ticket_time_entries;
create policy "Users and managers can view timesheet entries"
  on public.ticket_time_entries
  for select
  to authenticated
  using (
    worker_id = (select auth.uid())
    or (select public.current_user_is_admin_or_project_manager())
  );

create or replace function public.get_project_daily_time_totals(
  period_start date,
  period_end date
)
returns table (
  project_id uuid,
  work_date date,
  hours numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    entries.project_id,
    entries.work_date,
    sum(entries.hours)::numeric as hours
  from public.ticket_time_entries as entries
  where entries.work_date >= period_start
    and entries.work_date < period_end
    and (
      (select public.current_user_is_admin())
      or (select public.is_project_member(entries.project_id))
    )
  group by entries.project_id, entries.work_date;
$$;

revoke all on function public.get_project_daily_time_totals(date, date) from public, anon;
grant execute on function public.get_project_daily_time_totals(date, date) to authenticated;

create or replace function public.update_timesheet_entry(
  target_entry_id uuid,
  next_hours numeric,
  next_work_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_entry public.ticket_time_entries%rowtype;
  hours_delta numeric(10, 2);
  current_role public.app_role;
begin
  if next_hours = 0 or abs(next_hours) > 24 then
    raise exception 'Timesheet entries must be non-zero and between -24 and 24 hours';
  end if;

  select * into target_entry
  from public.ticket_time_entries
  where id = target_entry_id
  for update;

  if target_entry.id is null then
    raise exception 'Timesheet entry not found';
  end if;

  select role into current_role
  from public.user_roles
  where user_id = (select auth.uid());

  if current_role is null or current_role = 'client'::public.app_role then
    raise exception 'Timesheets are only available to agency team members';
  end if;

  if current_role <> 'admin'::public.app_role
    and target_entry.worker_id is distinct from (select auth.uid()) then
    raise exception 'You can only update your own timesheet';
  end if;

  hours_delta := next_hours - target_entry.hours;
  perform set_config('app.adjusting_timesheet', 'true', true);

  update public.ticket_time_entries
  set hours = next_hours,
      work_date = next_work_date,
      updated_at = timezone('utc', now())
  where id = target_entry_id;

  if hours_delta <> 0 then
    if target_entry.subtask_id is not null then
      update public.ticket_subtasks
      set logged_hours = greatest(0, logged_hours + hours_delta)
      where id = target_entry.subtask_id;
    else
      update public.tickets
      set logged_hours = greatest(0, logged_hours + hours_delta)
      where id = target_entry.ticket_id;
    end if;
  end if;
end;
$$;

revoke all on function public.update_timesheet_entry(uuid, numeric, date) from public, anon;
grant execute on function public.update_timesheet_entry(uuid, numeric, date) to authenticated;

create or replace function public.record_ticket_time_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hours_delta numeric(10, 2);
begin
  if current_setting('app.adjusting_timesheet', true) = 'true' then
    return new;
  end if;

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
      worker_id,
      work_date
    ) values (
      new.id,
      new.project_id,
      hours_delta,
      (select auth.uid()),
      coalesce(new.assignee_id, (select auth.uid())),
      current_date
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
  if current_setting('app.adjusting_timesheet', true) = 'true' then
    return new;
  end if;

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
      worker_id,
      work_date
    ) values (
      new.ticket_id,
      new.id,
      parent_project_id,
      hours_delta,
      (select auth.uid()),
      coalesce(new.assignee_id, (select auth.uid())),
      current_date
    );
  end if;

  return new;
end;
$$;
