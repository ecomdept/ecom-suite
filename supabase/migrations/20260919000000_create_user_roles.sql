do $$
begin
  create type public.app_role as enum (
    'admin',
    'project_manager',
    'developer',
    'designer',
    'client'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_roles enable row level security;

create or replace function public.current_user_is_admin()
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
      and role = 'admin'::public.app_role
  );
$$;

revoke all on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;

create policy "Users can read their own role"
  on public.user_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id or (select public.current_user_is_admin()));

create policy "Admins can assign roles"
  on public.user_roles
  for insert
  to authenticated
  with check ((select public.current_user_is_admin()));

create policy "Admins can update roles"
  on public.user_roles
  for update
  to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy "Admins can remove roles"
  on public.user_roles
  for delete
  to authenticated
  using ((select public.current_user_is_admin()));

drop trigger if exists set_user_roles_updated_at on public.user_roles;
create trigger set_user_roles_updated_at
  before update on public.user_roles
  for each row execute procedure public.set_profile_updated_at();

-- Bootstrap the first administrator only when exactly one Auth user exists.
-- This deliberately does nothing on fresh databases or databases with multiple users.
insert into public.user_roles (user_id, role, assigned_by)
select users.id, 'admin'::public.app_role, users.id
from auth.users as users
where (select count(*) from auth.users) = 1
on conflict (user_id) do update
set role = excluded.role,
    assigned_by = excluded.assigned_by,
    updated_at = timezone('utc', now());
