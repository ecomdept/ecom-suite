do $$
begin
  create type public.subtask_type as enum ('general', 'dev', 'qa', 'deploy');
exception when duplicate_object then null;
end
$$;

alter table public.ticket_subtasks
  add column if not exists subtask_type public.subtask_type not null default 'general',
  add column if not exists is_internal boolean not null default false;

create index if not exists ticket_subtasks_workflow_idx
  on public.ticket_subtasks (ticket_id, subtask_type);

-- Reapply the client visibility boundary in case the original workflow migration
-- stopped before its policy changes were reached.
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
