do $$
begin
  create type public.project_type as enum ('retainer', 'new_build');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.project_status as enum ('active', 'on_hold', 'completed');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.project_risk as enum ('on_track', 'at_risk', 'off_track');
exception
  when duplicate_object then null;
end
$$;

alter table public.projects
  add column if not exists project_type public.project_type not null default 'retainer',
  add column if not exists client_logo_url text,
  add column if not exists repository_url text,
  add column if not exists hourly_rate numeric(10, 2),
  add column if not exists sprint_start_date date not null default current_date,
  add column if not exists status public.project_status not null default 'active',
  add column if not exists risk public.project_risk not null default 'on_track';

alter table public.projects
  drop constraint if exists projects_hourly_rate_nonnegative,
  add constraint projects_hourly_rate_nonnegative
    check (hourly_rate is null or hourly_rate >= 0),
  drop constraint if exists projects_repository_url_length,
  add constraint projects_repository_url_length
    check (repository_url is null or char_length(repository_url) <= 2048),
  drop constraint if exists projects_client_logo_url_length,
  add constraint projects_client_logo_url_length
    check (client_logo_url is null or char_length(client_logo_url) <= 2048);

create table if not exists public.ticket_time_entries (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  subtask_id uuid references public.ticket_subtasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  hours numeric(10, 2) not null,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ticket_time_entries_nonzero_hours check (hours <> 0)
);

alter table public.ticket_time_entries
  add column if not exists subtask_id uuid references public.ticket_subtasks (id) on delete cascade;

create index if not exists ticket_time_entries_project_created_idx
  on public.ticket_time_entries (project_id, created_at desc);

alter table public.ticket_time_entries enable row level security;

drop policy if exists "Project members can view time entries" on public.ticket_time_entries;
create policy "Project members can view time entries"
  on public.ticket_time_entries
  for select
  to authenticated
  using (
    (select public.current_user_is_admin())
    or (select public.is_project_member(project_id))
  );

insert into public.ticket_time_entries (ticket_id, project_id, hours, recorded_by, created_at)
select id, project_id, logged_hours, null, updated_at
from public.tickets
where logged_hours <> 0
  and not exists (
    select 1
    from public.ticket_time_entries
    where ticket_time_entries.ticket_id = tickets.id
  );

insert into public.ticket_time_entries (ticket_id, subtask_id, project_id, hours, recorded_by, created_at)
select subtasks.ticket_id, subtasks.id, tickets.project_id, subtasks.logged_hours, null, subtasks.created_at
from public.ticket_subtasks as subtasks
join public.tickets on tickets.id = subtasks.ticket_id
where subtasks.logged_hours <> 0
  and not exists (
    select 1
    from public.ticket_time_entries
    where ticket_time_entries.subtask_id = subtasks.id
  );

create or replace function public.record_ticket_time_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hours_delta numeric(10, 2);
begin
  if tg_op = 'INSERT' then
    hours_delta := coalesce(new.logged_hours, 0);
  else
    hours_delta := coalesce(new.logged_hours, 0) - coalesce(old.logged_hours, 0);
  end if;

  if hours_delta <> 0 then
    insert into public.ticket_time_entries (
      ticket_id,
      project_id,
      hours,
      recorded_by
    ) values (
      new.id,
      new.project_id,
      hours_delta,
      (select auth.uid())
    );
  end if;

  return new;
end;
$$;

revoke all on function public.record_ticket_time_change() from public, anon, authenticated;

drop trigger if exists record_ticket_time_on_insert on public.tickets;
create trigger record_ticket_time_on_insert
  after insert on public.tickets
  for each row execute procedure public.record_ticket_time_change();

drop trigger if exists record_ticket_time_on_update on public.tickets;
create trigger record_ticket_time_on_update
  after update of logged_hours on public.tickets
  for each row execute procedure public.record_ticket_time_change();

create or replace function public.record_subtask_time_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hours_delta numeric(10, 2);
  parent_project_id uuid;
begin
  if tg_op = 'INSERT' then
    hours_delta := coalesce(new.logged_hours, 0);
  else
    hours_delta := coalesce(new.logged_hours, 0) - coalesce(old.logged_hours, 0);
  end if;

  if hours_delta <> 0 then
    select project_id into parent_project_id
    from public.tickets
    where id = new.ticket_id;

    insert into public.ticket_time_entries (
      ticket_id,
      subtask_id,
      project_id,
      hours,
      recorded_by
    ) values (
      new.ticket_id,
      new.id,
      parent_project_id,
      hours_delta,
      (select auth.uid())
    );
  end if;

  return new;
end;
$$;

revoke all on function public.record_subtask_time_change() from public, anon, authenticated;

drop trigger if exists record_subtask_time_on_insert on public.ticket_subtasks;
create trigger record_subtask_time_on_insert
  after insert on public.ticket_subtasks
  for each row execute procedure public.record_subtask_time_change();

drop trigger if exists record_subtask_time_on_update on public.ticket_subtasks;
create trigger record_subtask_time_on_update
  after update of logged_hours on public.ticket_subtasks
  for each row execute procedure public.record_subtask_time_change();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-logos',
  'project-logos',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload project logos" on storage.objects;
create policy "Admins can upload project logos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-logos'
    and (select public.current_user_is_admin())
  );

drop policy if exists "Admins can update project logos" on storage.objects;
create policy "Admins can update project logos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'project-logos'
    and (select public.current_user_is_admin())
  )
  with check (
    bucket_id = 'project-logos'
    and (select public.current_user_is_admin())
  );

drop policy if exists "Admins can delete project logos" on storage.objects;
create policy "Admins can delete project logos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-logos'
    and (select public.current_user_is_admin())
  );
