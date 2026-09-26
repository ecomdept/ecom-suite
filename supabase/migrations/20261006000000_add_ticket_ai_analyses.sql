alter table public.projects
  add column if not exists repo_owner text;

alter table public.projects
  add column if not exists repo_name text;

alter table public.projects
  drop constraint if exists projects_repo_owner_length;

alter table public.projects
  add constraint projects_repo_owner_length
  check (repo_owner is null or char_length(repo_owner) <= 100);

alter table public.projects
  drop constraint if exists projects_repo_name_length;

alter table public.projects
  add constraint projects_repo_name_length
  check (repo_name is null or char_length(repo_name) <= 120);

update public.projects
set
  repo_owner = (regexp_match(repository_url, '^https?://(?:www\.)?github\.com/([^/]+)/([^/#?]+)'))[1],
  repo_name = regexp_replace(
    (regexp_match(repository_url, '^https?://(?:www\.)?github\.com/([^/]+)/([^/#?]+)'))[2],
    '\.git$',
    ''
  )
where repository_url is not null
  and repo_owner is null
  and repository_url ~ '^https?://(?:www\.)?github\.com/[^/]+/[^/#?]+';

alter table public.tickets
  add column if not exists client_summary text;

alter table public.tickets
  drop constraint if exists tickets_client_summary_length;

alter table public.tickets
  add constraint tickets_client_summary_length
  check (client_summary is null or char_length(client_summary) <= 4000);

create table if not exists public.ticket_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  status text not null default 'running',
  repo_owner text,
  repo_name text,
  git_ref text,
  commit_sha text,
  result jsonb,
  error_message text,
  model text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  constraint ticket_ai_analyses_status_valid
    check (status in ('running', 'complete', 'failed')),
  constraint ticket_ai_analyses_error_length
    check (error_message is null or char_length(error_message) <= 2000)
);

create index if not exists ticket_ai_analyses_ticket_created_at_idx
  on public.ticket_ai_analyses (ticket_id, created_at desc);

alter table public.ticket_ai_analyses enable row level security;

drop policy if exists "Delivery team can read ticket analyses" on public.ticket_ai_analyses;
create policy "Delivery team can read ticket analyses"
  on public.ticket_ai_analyses
  for select
  to authenticated
  using ((select public.can_work_on_ticket(ticket_id)));

drop policy if exists "Ticket managers can delete ticket analyses" on public.ticket_ai_analyses;
create policy "Ticket managers can delete ticket analyses"
  on public.ticket_ai_analyses
  for delete
  to authenticated
  using ((select public.can_manage_project_tickets(project_id)));

notify pgrst, 'reload schema';
