create or replace function public.move_ticket_status(
  target_ticket_id uuid,
  next_status public.ticket_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
begin
  select tickets.project_id
    into target_project_id
  from public.tickets
  where tickets.id = target_ticket_id;

  if target_project_id is null then
    raise exception 'Ticket not found';
  end if;

  if not (select public.current_user_is_admin()) and not exists (
    select 1
    from public.project_members
    join public.user_roles on user_roles.user_id = project_members.user_id
    where project_members.project_id = target_project_id
      and project_members.user_id = (select auth.uid())
      and user_roles.role in (
        'project_manager'::public.app_role,
        'developer'::public.app_role,
        'designer'::public.app_role
      )
  ) then
    raise exception 'Only assigned agency team members can update ticket status';
  end if;

  update public.tickets
  set status = next_status
  where id = target_ticket_id;
end;
$$;

revoke all on function public.move_ticket_status(uuid, public.ticket_status) from public, anon;
grant execute on function public.move_ticket_status(uuid, public.ticket_status) to authenticated;
