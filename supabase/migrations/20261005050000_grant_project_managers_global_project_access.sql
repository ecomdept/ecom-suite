-- Project managers operate across the full delivery portfolio. Clients and
-- contributors remain limited to projects where they have explicit membership.
create or replace function public.is_project_member(check_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid())
        and role = 'project_manager'::public.app_role
    )
    or exists (
      select 1 from public.project_members
      where project_id = check_project_id
        and user_id = (select auth.uid())
    );
$$;

create or replace function public.can_manage_project_tickets(check_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.current_user_is_admin())
    or exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid())
        and role = 'project_manager'::public.app_role
    );
$$;

create or replace function public.can_access_ticket(check_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.current_user_is_admin())
    or exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid())
        and role = 'project_manager'::public.app_role
    )
    or exists (
      select 1
      from public.tickets
      join public.project_members on project_members.project_id = tickets.project_id
      where tickets.id = check_ticket_id
        and project_members.user_id = (select auth.uid())
    );
$$;

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
      select 1 from public.user_roles
      where user_id = (select auth.uid())
        and role = 'project_manager'::public.app_role
    )
    or exists (
      select 1
      from public.tickets
      join public.project_members on project_members.project_id = tickets.project_id
      join public.user_roles on user_roles.user_id = project_members.user_id
      where tickets.id = check_ticket_id
        and project_members.user_id = (select auth.uid())
        and user_roles.role in ('developer'::public.app_role, 'designer'::public.app_role)
    );
$$;

create or replace function public.shares_project_with(profile_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile_user_id = (select auth.uid())
    or (select public.current_user_is_admin())
    or exists (
      select 1 from public.user_roles
      where user_id = (select auth.uid())
        and role = 'project_manager'::public.app_role
    )
    or exists (
      select 1
      from public.project_members as current_membership
      join public.project_members as other_membership
        on other_membership.project_id = current_membership.project_id
      where current_membership.user_id = (select auth.uid())
        and other_membership.user_id = profile_user_id
    );
$$;

revoke all on function public.is_project_member(uuid) from public, anon;
revoke all on function public.can_manage_project_tickets(uuid) from public, anon;
revoke all on function public.can_access_ticket(uuid) from public, anon;
revoke all on function public.can_work_on_ticket(uuid) from public, anon;
revoke all on function public.shares_project_with(uuid) from public, anon;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.can_manage_project_tickets(uuid) to authenticated;
grant execute on function public.can_access_ticket(uuid) to authenticated;
grant execute on function public.can_work_on_ticket(uuid) to authenticated;
grant execute on function public.shares_project_with(uuid) to authenticated;
