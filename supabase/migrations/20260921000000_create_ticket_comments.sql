create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ticket_comments_content_length
    check (char_length(content) between 1 and 2000)
);

create index if not exists ticket_comments_ticket_created_at_idx
  on public.ticket_comments (ticket_id, created_at);
create index if not exists ticket_comments_user_id_idx
  on public.ticket_comments (user_id);

alter table public.ticket_comments enable row level security;

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
      select 1
      from public.tickets
      join public.project_members
        on project_members.project_id = tickets.project_id
      where tickets.id = check_ticket_id
        and project_members.user_id = (select auth.uid())
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
      select 1
      from public.project_members as current_membership
      join public.project_members as other_membership
        on other_membership.project_id = current_membership.project_id
      where current_membership.user_id = (select auth.uid())
        and other_membership.user_id = profile_user_id
    );
$$;

revoke all on function public.can_access_ticket(uuid) from public, anon;
revoke all on function public.shares_project_with(uuid) from public, anon;
grant execute on function public.can_access_ticket(uuid) to authenticated;
grant execute on function public.shares_project_with(uuid) to authenticated;

create policy "Project members can read ticket comments"
  on public.ticket_comments
  for select
  to authenticated
  using ((select public.can_access_ticket(ticket_id)));

create policy "Project members can create ticket comments"
  on public.ticket_comments
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.can_access_ticket(ticket_id))
  );

create policy "Users can delete their own ticket comments"
  on public.ticket_comments
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Project members can read collaborator profiles"
  on public.profiles
  for select
  to authenticated
  using ((select public.shares_project_with(id)));
