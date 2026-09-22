create table if not exists public.client_accounts (
  project_id uuid primary key references public.projects (id) on delete cascade,
  services text[] not null default array['development']::text[],
  retainer_start_date date,
  retainer_end_date date,
  renewal_date date,
  contract_status text not null default 'active',
  project_manager_id uuid references auth.users (id) on delete set null,
  primary_developer_id uuid references auth.users (id) on delete set null,
  poc_name text,
  poc_email text,
  poc_phone text,
  billing_email text,
  location text,
  timezone text,
  website_url text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint client_accounts_services check (
    services <@ array['development', 'email', 'digital']::text[]
  ),
  constraint client_accounts_contract_status check (
    contract_status in ('active', 'renewal_due', 'paused', 'ended')
  ),
  constraint client_accounts_dates check (
    retainer_end_date is null or retainer_start_date is null or retainer_end_date >= retainer_start_date
  ),
  constraint client_accounts_notes_length check (notes is null or char_length(notes) <= 10000),
  constraint client_accounts_contact_length check (
    char_length(coalesce(poc_name, '')) <= 200
    and char_length(coalesce(poc_email, '')) <= 320
    and char_length(coalesce(poc_phone, '')) <= 100
    and char_length(coalesce(billing_email, '')) <= 320
    and char_length(coalesce(location, '')) <= 300
    and char_length(coalesce(timezone, '')) <= 100
    and char_length(coalesce(website_url, '')) <= 2000
  )
);

create index if not exists client_accounts_project_manager_idx on public.client_accounts (project_manager_id);
create index if not exists client_accounts_primary_developer_idx on public.client_accounts (primary_developer_id);
create index if not exists client_accounts_renewal_idx on public.client_accounts (renewal_date) where renewal_date is not null;

alter table public.client_accounts enable row level security;

create or replace function public.current_user_can_manage_crm()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid())
      and role in ('admin'::public.app_role, 'project_manager'::public.app_role)
  );
$$;

revoke all on function public.current_user_can_manage_crm() from public, anon;
grant execute on function public.current_user_can_manage_crm() to authenticated;

create policy "Administrators and PMs can read client accounts"
  on public.client_accounts for select to authenticated
  using ((select public.current_user_can_manage_crm()));

create policy "Administrators and PMs can create client accounts"
  on public.client_accounts for insert to authenticated
  with check ((select public.current_user_can_manage_crm()));

create policy "Administrators and PMs can update client accounts"
  on public.client_accounts for update to authenticated
  using ((select public.current_user_can_manage_crm()))
  with check ((select public.current_user_can_manage_crm()));

create policy "Administrators can delete client accounts"
  on public.client_accounts for delete to authenticated
  using ((select public.current_user_is_admin()));

drop trigger if exists set_client_accounts_updated_at on public.client_accounts;
create trigger set_client_accounts_updated_at
  before update on public.client_accounts
  for each row execute procedure public.set_profile_updated_at();

drop policy if exists "Project managers can read team roles" on public.user_roles;
create policy "Project managers can read team roles"
  on public.user_roles for select to authenticated
  using ((select public.current_user_can_manage_crm()));

insert into public.client_accounts (project_id)
select id from public.projects
where project_type = 'retainer'::public.project_type
on conflict (project_id) do nothing;
