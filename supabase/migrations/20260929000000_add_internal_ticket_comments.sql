alter table public.ticket_comments
  add column if not exists is_internal boolean not null default false;

drop policy if exists "Project members can read ticket comments" on public.ticket_comments;
create policy "Project members can read permitted ticket comments"
  on public.ticket_comments
  for select
  to authenticated
  using (
    (select public.can_access_ticket(ticket_id))
    and (
      not is_internal
      or (select public.can_work_on_ticket(ticket_id))
    )
  );

drop policy if exists "Project members can create ticket comments" on public.ticket_comments;
create policy "Project members can create permitted ticket comments"
  on public.ticket_comments
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.can_access_ticket(ticket_id))
    and (
      not is_internal
      or (select public.can_work_on_ticket(ticket_id))
    )
  );

-- Internal notes never notify a client. This also protects direct API callers
-- that bypass the application form.
create or replace function public.notify_comment_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mentioned_user_id uuid;
  mentioned_project_id uuid;
  mentioned_ticket_title text;
begin
  select tickets.project_id, tickets.title
    into mentioned_project_id, mentioned_ticket_title
  from public.tickets
  where tickets.id = new.ticket_id;

  for mentioned_user_id in
    select distinct unnest(new.mentioned_user_ids)
  loop
    if not exists (
      select 1
      from public.project_members
      where project_members.project_id = mentioned_project_id
        and project_members.user_id = mentioned_user_id
    ) then
      raise exception 'Mentioned users must belong to the ticket project';
    end if;

    if new.is_internal and not exists (
      select 1
      from public.user_roles
      where user_roles.user_id = mentioned_user_id
        and user_roles.role in (
          'admin'::public.app_role,
          'project_manager'::public.app_role,
          'developer'::public.app_role,
          'designer'::public.app_role
        )
    ) then
      raise exception 'Clients cannot be mentioned in internal notes';
    end if;

    insert into public.notifications (
      recipient_id, actor_id, notification_type, project_id, ticket_id, comment_id, message
    ) values (
      mentioned_user_id,
      new.user_id,
      'comment_mention'::public.notification_type,
      mentioned_project_id,
      new.ticket_id,
      new.id,
      left('You were mentioned in a comment on "' || mentioned_ticket_title || '".', 300)
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_comment_mentions() from public, anon, authenticated;

notify pgrst, 'reload schema';
