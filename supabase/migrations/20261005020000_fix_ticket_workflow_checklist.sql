create or replace function public.prepare_ticket_for_approval(
  target_ticket_id uuid,
  target_project_id uuid,
  next_work_category text,
  next_estimated_hours numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid;
begin
  if next_work_category not in ('admin_work', 'dev_work') then
    raise exception 'Invalid work category';
  end if;

  if next_estimated_hours is null or next_estimated_hours <= 0 or next_estimated_hours > 100000 then
    raise exception 'Estimate must be greater than zero';
  end if;

  if not public.can_manage_project_tickets(target_project_id) then
    raise exception 'Only project managers can prepare ticket approval';
  end if;

  select created_by into requester_id
  from public.tickets
  where id = target_ticket_id and project_id = target_project_id
  for update;

  if requester_id is null then
    raise exception 'Ticket not found';
  end if;

  if next_work_category = 'dev_work' then
    insert into public.ticket_subtasks (
      ticket_id,
      title,
      subtask_type,
      is_internal,
      created_by
    )
    select
      target_ticket_id,
      workflow_step.title,
      workflow_step.subtask_type,
      true,
      (select auth.uid())
    from (
      values
        ('Development', 'dev'::public.subtask_type),
        ('Internal QA', 'qa'::public.subtask_type),
        ('Deploy to production', 'deploy'::public.subtask_type)
    ) as workflow_step(title, subtask_type)
    where not exists (
      select 1 from public.ticket_subtasks as existing_step
      where existing_step.ticket_id = target_ticket_id
        and existing_step.subtask_type = workflow_step.subtask_type
    );
  end if;

  update public.tickets
  set work_category = next_work_category::public.ticket_work_category,
      estimated_hours = next_estimated_hours,
      approval_status = 'pending'::public.ticket_approval_status,
      approval_requested_at = timezone('utc', now()),
      status = 'pending_approval'::public.ticket_status,
      assignee_id = requester_id
  where id = target_ticket_id and project_id = target_project_id;
end;
$$;

revoke all on function public.prepare_ticket_for_approval(uuid, uuid, text, numeric) from public, anon;
grant execute on function public.prepare_ticket_for_approval(uuid, uuid, text, numeric) to authenticated;
