-- Assignment and mention events should notify the recipient even when the
-- recipient is also the actor. This makes self-assignment and self-mention
-- useful during planning and matches the "whenever assigned or mentioned"
-- notification contract.
create or replace function public.notify_ticket_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  insert into public.notifications (
    recipient_id, actor_id, notification_type, project_id, ticket_id, message
  ) values (
    new.assignee_id,
    (select auth.uid()),
    'ticket_assignment'::public.notification_type,
    new.project_id,
    new.id,
    left('You were assigned to "' || new.title || '".', 300)
  );

  return new;
end;
$$;

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

create or replace function public.notify_subtask_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_project_id uuid;
begin
  if new.assignee_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  select tickets.project_id into parent_project_id
  from public.tickets
  where tickets.id = new.ticket_id;

  insert into public.notifications (
    recipient_id, actor_id, notification_type, project_id, ticket_id, message
  ) values (
    new.assignee_id,
    (select auth.uid()),
    'ticket_assignment'::public.notification_type,
    parent_project_id,
    new.ticket_id,
    left('You were assigned the subtask "' || new.title || '".', 300)
  );

  return new;
end;
$$;

revoke all on function public.notify_ticket_assignment() from public, anon, authenticated;
revoke all on function public.notify_comment_mentions() from public, anon, authenticated;
revoke all on function public.notify_subtask_assignment() from public, anon, authenticated;
