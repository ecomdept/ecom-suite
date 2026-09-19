do $$
begin
  create type public.ticket_status as enum (
    'backlog',
    'in_progress',
    'completed'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.ticket_priority as enum ('low', 'medium', 'high');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint projects_name_length check (char_length(name) between 2 and 100),
  constraint projects_description_length check (char_length(description) <= 2000)
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, user_id)
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  status public.ticket_status not null default 'backlog',
  priority public.ticket_priority not null default 'medium',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tickets_title_length check (char_length(title) between 2 and 140),
  constraint tickets_description_length check (char_length(description) <= 2000)
);

create index if not exists project_members_user_id_idx
  on public.project_members (user_id);
create index if not exists tickets_project_status_idx
  on public.tickets (project_id, status);
create index if not exists tickets_created_at_idx
  on public.tickets (created_at desc);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tickets enable row level security;

create or replace function public.is_project_member(check_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members
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
      select 1
      from public.project_members
      join public.user_roles on user_roles.user_id = project_members.user_id
      where project_members.project_id = check_project_id
        and project_members.user_id = (select auth.uid())
        and user_roles.role = 'project_manager'::public.app_role
    );
$$;

revoke all on function public.is_project_member(uuid) from public, anon;
revoke all on function public.can_manage_project_tickets(uuid) from public, anon;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.can_manage_project_tickets(uuid) to authenticated;

create policy "Members can view projects"
  on public.projects
  for select
  to authenticated
  using (
    (select public.current_user_is_admin())
    or (select public.is_project_member(id))
  );

create policy "Admins can create projects"
  on public.projects
  for insert
  to authenticated
  with check (
    (select public.current_user_is_admin())
    and created_by = (select auth.uid())
  );

create policy "Admins can update projects"
  on public.projects
  for update
  to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy "Admins can delete projects"
  on public.projects
  for delete
  to authenticated
  using ((select public.current_user_is_admin()));

create policy "Members can view project membership"
  on public.project_members
  for select
  to authenticated
  using (
    (select public.current_user_is_admin())
    or (select public.is_project_member(project_id))
  );

create policy "Admins can add project members"
  on public.project_members
  for insert
  to authenticated
  with check ((select public.current_user_is_admin()));

create policy "Admins can remove project members"
  on public.project_members
  for delete
  to authenticated
  using ((select public.current_user_is_admin()));

create policy "Members can view project tickets"
  on public.tickets
  for select
  to authenticated
  using (
    (select public.current_user_is_admin())
    or (select public.is_project_member(project_id))
  );

create policy "Managers can create project tickets"
  on public.tickets
  for insert
  to authenticated
  with check (
    (select public.can_manage_project_tickets(project_id))
    and created_by = (select auth.uid())
  );

create policy "Managers can update project tickets"
  on public.tickets
  for update
  to authenticated
  using ((select public.can_manage_project_tickets(project_id)))
  with check ((select public.can_manage_project_tickets(project_id)));

create policy "Managers can delete project tickets"
  on public.tickets
  for delete
  to authenticated
  using ((select public.can_manage_project_tickets(project_id)));

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_profile_updated_at();

drop trigger if exists set_tickets_updated_at on public.tickets;
create trigger set_tickets_updated_at
  before update on public.tickets
  for each row execute procedure public.set_profile_updated_at();
