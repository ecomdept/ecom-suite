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
begin
  select project_id, approval_status
    into target_project_id, current_approval
  from public.tickets where id = target_ticket_id
  for update;

  select role into actor_role
  from public.user_roles where user_id = (select auth.uid());

  if target_project_id is null
    or actor_role <> 'client'::public.app_role
    or current_approval <> 'pending'::public.ticket_approval_status
    or not exists (
      select 1 from public.project_members
      where project_id = target_project_id and user_id = (select auth.uid())
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
      order by members.added_at limit 1
    )
  ) into assigned_pm_id;

  if approve then
    update public.tickets set
      approval_status = 'approved'::public.ticket_approval_status,
      approved_at = timezone('utc', now()),
      status = 'in_progress'::public.ticket_status,
      assignee_id = coalesce(
        (
          select assignee_id from public.ticket_subtasks
          where ticket_id = target_ticket_id
            and subtask_type = 'dev'::public.subtask_type
          order by created_at limit 1
        ),
        assigned_pm_id
      )
    where id = target_ticket_id;
  else
    update public.tickets set
      approval_status = 'changes_requested'::public.ticket_approval_status,
      status = 'backlog'::public.ticket_status,
      assignee_id = assigned_pm_id
    where id = target_ticket_id;
  end if;
end;
$$;

revoke all on function public.respond_to_ticket_estimate(uuid, boolean) from public, anon;
grant execute on function public.respond_to_ticket_estimate(uuid, boolean) to authenticated;
