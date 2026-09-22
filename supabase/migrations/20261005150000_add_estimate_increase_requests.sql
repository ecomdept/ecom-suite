alter table public.tickets
  add column if not exists previous_estimated_hours numeric,
  add column if not exists estimate_change_previous_status public.ticket_status,
  add column if not exists estimate_change_previous_assignee_id uuid references auth.users (id) on delete set null;

alter table public.tickets
  drop constraint if exists tickets_previous_estimated_hours_nonnegative,
  add constraint tickets_previous_estimated_hours_nonnegative
    check (previous_estimated_hours is null or previous_estimated_hours >= 0);

comment on column public.tickets.previous_estimated_hours is
  'The last client-approved estimate while a higher total estimate is awaiting approval.';

create or replace function public.request_ticket_estimate_increase(
  target_ticket_id uuid,
  target_project_id uuid,
  next_estimated_hours numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_estimate numeric;
  current_approval public.ticket_approval_status;
  current_status public.ticket_status;
  current_assignee_id uuid;
  requester_id uuid;
begin
  if not public.can_manage_project_tickets(target_project_id) then
    raise exception 'Only project managers can request an estimate increase';
  end if;

  select
    estimated_hours,
    approval_status,
    status,
    assignee_id,
    created_by
  into
    current_estimate,
    current_approval,
    current_status,
    current_assignee_id,
    requester_id
  from public.tickets
  where id = target_ticket_id
    and project_id = target_project_id
  for update;

  if not found then
    raise exception 'Ticket not found';
  end if;

  if current_approval <> 'approved'::public.ticket_approval_status
    or current_status <> 'in_progress'::public.ticket_status then
    raise exception 'Estimate increases can only be requested during active delivery';
  end if;

  if next_estimated_hours is null
    or next_estimated_hours <= current_estimate
    or next_estimated_hours > 100000 then
    raise exception 'The revised estimate must be greater than the current estimate';
  end if;

  update public.tickets
  set previous_estimated_hours = current_estimate,
      estimate_change_previous_status = current_status,
      estimate_change_previous_assignee_id = current_assignee_id,
      estimated_hours = next_estimated_hours,
      approval_status = 'pending'::public.ticket_approval_status,
      approval_requested_at = timezone('utc', now()),
      status = 'pending_approval'::public.ticket_status,
      assignee_id = requester_id
  where id = target_ticket_id
    and project_id = target_project_id;
end;
$$;

revoke all on function public.request_ticket_estimate_increase(uuid, uuid, numeric) from public, anon;
grant execute on function public.request_ticket_estimate_increase(uuid, uuid, numeric) to authenticated;

create or replace function public.respond_to_ticket_estimate(target_ticket_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
  current_approval public.ticket_approval_status;
  actor_role public.app_role;
  assigned_pm_id uuid;
  prior_estimate numeric;
  prior_status public.ticket_status;
  prior_assignee_id uuid;
begin
  select
    project_id,
    approval_status,
    previous_estimated_hours,
    estimate_change_previous_status,
    estimate_change_previous_assignee_id
  into
    target_project_id,
    current_approval,
    prior_estimate,
    prior_status,
    prior_assignee_id
  from public.tickets
  where id = target_ticket_id
  for update;

  select role into actor_role
  from public.user_roles
  where user_id = (select auth.uid());

  if target_project_id is null
    or actor_role <> 'client'::public.app_role
    or current_approval <> 'pending'::public.ticket_approval_status
    or not exists (
      select 1
      from public.project_members
      where project_id = target_project_id
        and user_id = (select auth.uid())
    ) then
    raise exception 'This estimate cannot be actioned by the current user';
  end if;

  select coalesce(
    (
      select accounts.project_manager_id
      from public.client_accounts as accounts
      join public.project_members as assigned_member
        on assigned_member.project_id = accounts.project_id
        and assigned_member.user_id = accounts.project_manager_id
      where accounts.project_id = target_project_id
    ),
    (
      select members.user_id
      from public.project_members as members
      join public.user_roles as roles on roles.user_id = members.user_id
      where members.project_id = target_project_id
        and roles.role = 'project_manager'::public.app_role
      order by members.added_at
      limit 1
    )
  ) into assigned_pm_id;

  if approve then
    update public.tickets
    set approval_status = 'approved'::public.ticket_approval_status,
        approved_at = timezone('utc', now()),
        status = coalesce(prior_status, 'in_progress'::public.ticket_status),
        assignee_id = coalesce(
          prior_assignee_id,
          (
            select assignee_id
            from public.ticket_subtasks
            where ticket_id = target_ticket_id
              and subtask_type = 'dev'::public.subtask_type
            order by created_at
            limit 1
          ),
          assigned_pm_id
        ),
        previous_estimated_hours = null,
        estimate_change_previous_status = null,
        estimate_change_previous_assignee_id = null
    where id = target_ticket_id;
  elsif prior_estimate is not null then
    update public.tickets
    set estimated_hours = prior_estimate,
        approval_status = 'approved'::public.ticket_approval_status,
        approval_requested_at = null,
        status = coalesce(prior_status, 'in_progress'::public.ticket_status),
        assignee_id = coalesce(prior_assignee_id, assigned_pm_id),
        previous_estimated_hours = null,
        estimate_change_previous_status = null,
        estimate_change_previous_assignee_id = null
    where id = target_ticket_id;
  else
    update public.tickets
    set approval_status = 'changes_requested'::public.ticket_approval_status,
        status = 'backlog'::public.ticket_status,
        assignee_id = assigned_pm_id
    where id = target_ticket_id;
  end if;
end;
$$;

revoke all on function public.respond_to_ticket_estimate(uuid, boolean) from public, anon;
grant execute on function public.respond_to_ticket_estimate(uuid, boolean) to authenticated;
