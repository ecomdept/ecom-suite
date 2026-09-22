-- Preserve historical time when a subtask is deleted. The entry remains tied
-- to its parent ticket and project for reporting.
alter table public.ticket_time_entries
  drop constraint if exists ticket_time_entries_subtask_id_fkey;
alter table public.ticket_time_entries
  add constraint ticket_time_entries_subtask_id_fkey
  foreign key (subtask_id) references public.ticket_subtasks (id) on delete set null;

-- Repair any ticket/subtask hour totals that were saved before their ledger
-- triggers were installed. Only the missing delta is inserted, so this is safe
-- to run against databases that already have complete ledger history.
insert into public.ticket_time_entries (
  ticket_id, subtask_id, project_id, hours, recorded_by, worker_id, work_date
)
select
  tickets.id,
  null,
  tickets.project_id,
  tickets.logged_hours - coalesce(ledger.hours, 0),
  null,
  tickets.assignee_id,
  (tickets.updated_at at time zone 'utc')::date
from public.tickets
left join (
  select ticket_id, sum(hours) as hours
  from public.ticket_time_entries
  where subtask_id is null
  group by ticket_id
) as ledger on ledger.ticket_id = tickets.id
where tickets.logged_hours <> coalesce(ledger.hours, 0);

insert into public.ticket_time_entries (
  ticket_id, subtask_id, project_id, hours, recorded_by, worker_id, work_date
)
select
  subtasks.ticket_id,
  subtasks.id,
  tickets.project_id,
  subtasks.logged_hours - coalesce(ledger.hours, 0),
  null,
  subtasks.assignee_id,
  (subtasks.updated_at at time zone 'utc')::date
from public.ticket_subtasks as subtasks
join public.tickets as tickets on tickets.id = subtasks.ticket_id
left join (
  select subtask_id, sum(hours) as hours
  from public.ticket_time_entries
  where subtask_id is not null
  group by subtask_id
) as ledger on ledger.subtask_id = subtasks.id
where subtasks.logged_hours <> coalesce(ledger.hours, 0);

-- Returns the portion of approved estimates that is not yet represented by
-- logged work. Completed/archived tickets no longer reserve sprint capacity.
create or replace function public.get_project_committed_hours(target_project_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(greatest(
    tickets.estimated_hours
      - tickets.logged_hours
      - coalesce(subtask_totals.logged_hours, 0),
    0
  )), 0)::numeric
  from public.tickets
  left join (
    select ticket_id, sum(logged_hours) as logged_hours
    from public.ticket_subtasks
    group by ticket_id
  ) as subtask_totals on subtask_totals.ticket_id = tickets.id
  where tickets.project_id = target_project_id
    and tickets.status not in ('completed'::public.ticket_status, 'archived'::public.ticket_status)
    and (
      tickets.approval_status in (
        'approved'::public.ticket_approval_status,
        'uat_pending'::public.ticket_approval_status,
        'uat_approved'::public.ticket_approval_status
      )
      or (
        tickets.approval_status = 'changes_requested'::public.ticket_approval_status
        and tickets.approved_at is not null
      )
    )
    and (
      (select public.current_user_is_admin())
      or (select public.is_project_member(target_project_id))
    );
$$;

revoke all on function public.get_project_committed_hours(uuid) from public, anon;
grant execute on function public.get_project_committed_hours(uuid) to authenticated;
