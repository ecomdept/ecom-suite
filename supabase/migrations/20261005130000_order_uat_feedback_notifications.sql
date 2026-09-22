create or replace function public.respond_to_ticket_uat(
  target_ticket_id uuid,
  approve boolean,
  client_feedback text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
  requester_id uuid;
  current_approval public.ticket_approval_status;
  assigned_pm_id uuid;
  clean_feedback text := nullif(btrim(client_feedback), '');
begin
  select project_id, created_by, approval_status
    into target_project_id, requester_id, current_approval
  from public.tickets where id = target_ticket_id
  for update;

  if requester_id is distinct from (select auth.uid())
    or current_approval <> 'uat_pending'::public.ticket_approval_status
    or not public.is_project_member(target_project_id) then
    raise exception 'UAT cannot be actioned by the current user';
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
      approval_status = 'uat_approved'::public.ticket_approval_status,
      uat_approved_at = timezone('utc', now()),
      status = 'ready_for_deploy'::public.ticket_status,
      assignee_id = assigned_pm_id
    where id = target_ticket_id;
  else
    if clean_feedback is null then
      raise exception 'Client feedback is required when UAT is rejected';
    end if;

    -- Change the ticket first so both the ticket and subtask notifications use
    -- the new In progress status.
    update public.tickets set
      approval_status = 'changes_requested'::public.ticket_approval_status,
      status = 'in_progress'::public.ticket_status,
      assignee_id = assigned_pm_id
    where id = target_ticket_id;

    insert into public.ticket_subtasks (
      ticket_id, title, description, subtask_type, is_internal, assignee_id, created_by
    ) values (
      target_ticket_id,
      'Client feedback',
      clean_feedback,
      'general'::public.subtask_type,
      false,
      assigned_pm_id,
      (select auth.uid())
    );
  end if;
end;
$$;

revoke all on function public.respond_to_ticket_uat(uuid, boolean, text) from public, anon;
grant execute on function public.respond_to_ticket_uat(uuid, boolean, text) to authenticated;
