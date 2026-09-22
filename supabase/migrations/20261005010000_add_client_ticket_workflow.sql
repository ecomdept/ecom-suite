do $$
begin
  create type public.ticket_work_category as enum ('admin_work', 'dev_work');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.ticket_approval_status as enum (
    'draft', 'pending', 'approved', 'changes_requested', 'uat_pending', 'uat_approved'
  );
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.subtask_type as enum ('general', 'dev', 'qa', 'deploy');
exception when duplicate_object then null;
end
$$;

alter table public.tickets
  add column if not exists work_category public.ticket_work_category,
  add column if not exists approval_status public.ticket_approval_status not null default 'draft',
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists uat_requested_at timestamptz,
  add column if not exists uat_approved_at timestamptz;

alter table public.ticket_subtasks
  add column if not exists subtask_type public.subtask_type not null default 'general',
  add column if not exists is_internal boolean not null default false;

create index if not exists ticket_subtasks_workflow_idx
  on public.ticket_subtasks (ticket_id, subtask_type);

-- A client account represents one client workspace. Team members may belong to many projects.
create or replace function public.enforce_single_client_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.user_roles
    where user_id = new.user_id and role = 'client'::public.app_role
  ) and exists (
    select 1 from public.project_members
    where user_id = new.user_id and project_id <> new.project_id
  ) then
    raise exception 'Client accounts can only be assigned to one project';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_single_client_project on public.project_members;
create trigger enforce_single_client_project
  before insert or update of project_id, user_id on public.project_members
  for each row execute procedure public.enforce_single_client_project();

create or replace function public.enforce_client_role_project_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'client'::public.app_role and (
    select count(*) from public.project_members where user_id = new.user_id
  ) > 1 then
    raise exception 'Remove extra project assignments before changing this account to client';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_client_role_project_limit on public.user_roles;
create trigger enforce_client_role_project_limit
  before insert or update of role on public.user_roles
  for each row execute procedure public.enforce_client_role_project_limit();

-- A newly submitted client request enters the assigned project's PM intake queue.
create or replace function public.assign_client_request_to_project_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.user_roles
    where user_id = new.created_by and role = 'client'::public.app_role
  ) then
    update public.tickets
    set assignee_id = (
      select members.user_id
      from public.project_members as members
      join public.user_roles as roles on roles.user_id = members.user_id
      where members.project_id = new.project_id
        and roles.role = 'project_manager'::public.app_role
      order by members.added_at
      limit 1
    )
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_client_request_to_project_manager on public.tickets;
create trigger assign_client_request_to_project_manager
  after insert on public.tickets
  for each row execute procedure public.assign_client_request_to_project_manager();

-- Internal delivery steps must not be readable by client sessions, including through the API.
drop policy if exists "Project members can read ticket subtasks" on public.ticket_subtasks;
drop policy if exists "Project members can read permitted ticket subtasks" on public.ticket_subtasks;
create policy "Project members can read permitted ticket subtasks"
  on public.ticket_subtasks
  for select
  to authenticated
  using (
    (select public.can_access_ticket(ticket_id))
    and (
      not is_internal
      or not exists (
        select 1 from public.user_roles
        where user_id = (select auth.uid()) and role = 'client'::public.app_role
      )
    )
  );

create or replace function public.respond_to_ticket_estimate(target_ticket_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
  requester_id uuid;
  current_approval public.ticket_approval_status;
begin
  select project_id, created_by, approval_status
    into target_project_id, requester_id, current_approval
  from public.tickets where id = target_ticket_id;

  if requester_id is distinct from (select auth.uid())
    or current_approval <> 'pending'::public.ticket_approval_status
    or not public.is_project_member(target_project_id) then
    raise exception 'This estimate cannot be actioned by the current user';
  end if;

  if approve then
    update public.tickets set
      approval_status = 'approved'::public.ticket_approval_status,
      approved_at = timezone('utc', now()),
      status = 'in_progress'::public.ticket_status,
      assignee_id = (
        select assignee_id from public.ticket_subtasks
        where ticket_id = target_ticket_id and subtask_type = 'dev'::public.subtask_type
        order by created_at limit 1
      )
    where id = target_ticket_id;
  else
    update public.tickets set
      approval_status = 'changes_requested'::public.ticket_approval_status,
      status = 'backlog'::public.ticket_status,
      assignee_id = (
        select members.user_id from public.project_members as members
        join public.user_roles as roles on roles.user_id = members.user_id
        where members.project_id = target_project_id
          and roles.role = 'project_manager'::public.app_role
        order by members.added_at limit 1
      )
    where id = target_ticket_id;
  end if;
end;
$$;

create or replace function public.respond_to_ticket_uat(target_ticket_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
  requester_id uuid;
  current_approval public.ticket_approval_status;
begin
  select project_id, created_by, approval_status
    into target_project_id, requester_id, current_approval
  from public.tickets where id = target_ticket_id;

  if requester_id is distinct from (select auth.uid())
    or current_approval <> 'uat_pending'::public.ticket_approval_status
    or not public.is_project_member(target_project_id) then
    raise exception 'UAT cannot be actioned by the current user';
  end if;

  if approve then
    update public.tickets set
      approval_status = 'uat_approved'::public.ticket_approval_status,
      uat_approved_at = timezone('utc', now()),
      status = 'in_progress'::public.ticket_status,
      assignee_id = (
        select assignee_id from public.ticket_subtasks
        where ticket_id = target_ticket_id and subtask_type = 'deploy'::public.subtask_type
        order by created_at limit 1
      )
    where id = target_ticket_id;
  else
    update public.tickets set
      approval_status = 'changes_requested'::public.ticket_approval_status,
      status = 'in_progress'::public.ticket_status,
      assignee_id = (
        select members.user_id from public.project_members as members
        join public.user_roles as roles on roles.user_id = members.user_id
        where members.project_id = target_project_id
          and roles.role = 'project_manager'::public.app_role
        order by members.added_at limit 1
      )
    where id = target_ticket_id;
  end if;
end;
$$;

revoke all on function public.respond_to_ticket_estimate(uuid, boolean) from public, anon;
revoke all on function public.respond_to_ticket_uat(uuid, boolean) from public, anon;
grant execute on function public.respond_to_ticket_estimate(uuid, boolean) to authenticated;
grant execute on function public.respond_to_ticket_uat(uuid, boolean) to authenticated;
