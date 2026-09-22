alter table public.notifications
  add column if not exists ticket_status public.ticket_status;

create or replace function public.ticket_status_label(value public.ticket_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case value
    when 'backlog'::public.ticket_status then 'Backlog'
    when 'pending_approval'::public.ticket_status then 'Pending approval'
    when 'in_progress'::public.ticket_status then 'In progress'
    when 'client_uat'::public.ticket_status then 'UAT needs approval'
    when 'ready_for_deploy'::public.ticket_status then 'Ready for deploy'
    when 'completed'::public.ticket_status then 'Completed'
    when 'archived'::public.ticket_status then 'Archived'
  end;
$$;

update public.notifications as notifications
set ticket_status = tickets.status,
    message = left(public.ticket_status_label(tickets.status) || ' — ' || notifications.message, 300)
from public.tickets as tickets
where tickets.id = notifications.ticket_id
  and notifications.ticket_status is null;

create or replace function public.notify_ticket_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_actor uuid := (select auth.uid());
begin
  if new.assignee_id is null or new.assignee_id is not distinct from notification_actor then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.assignee_id is not distinct from old.assignee_id
    and new.status is not distinct from old.status then
    return new;
  end if;

  insert into public.notifications (
    recipient_id, actor_id, notification_type, project_id, ticket_id, ticket_status, message
  ) values (
    new.assignee_id,
    notification_actor,
    'ticket_assignment'::public.notification_type,
    new.project_id,
    new.id,
    new.status,
    left(public.ticket_status_label(new.status) || ' — You were assigned to "' || new.title || '".', 300)
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
  mentioned_ticket_status public.ticket_status;
begin
  select tickets.project_id, tickets.title, tickets.status
    into mentioned_project_id, mentioned_ticket_title, mentioned_ticket_status
  from public.tickets where tickets.id = new.ticket_id;

  for mentioned_user_id in select distinct unnest(new.mentioned_user_ids)
  loop
    if mentioned_user_id is not distinct from new.user_id then continue; end if;
    if not exists (
      select 1 from public.project_members
      where project_id = mentioned_project_id and user_id = mentioned_user_id
    ) then
      raise exception 'Mentioned users must belong to the ticket project';
    end if;

    insert into public.notifications (
      recipient_id, actor_id, notification_type, project_id, ticket_id, comment_id, ticket_status, message
    ) values (
      mentioned_user_id,
      new.user_id,
      'comment_mention'::public.notification_type,
      mentioned_project_id,
      new.ticket_id,
      new.id,
      mentioned_ticket_status,
      left(public.ticket_status_label(mentioned_ticket_status) || ' — You were mentioned on "' || mentioned_ticket_title || '".', 300)
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
  notification_actor uuid := (select auth.uid());
  parent_project_id uuid;
  parent_status public.ticket_status;
begin
  if new.assignee_id is null or new.assignee_id is not distinct from notification_actor then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  select tickets.project_id, tickets.status into parent_project_id, parent_status
  from public.tickets where tickets.id = new.ticket_id;

  insert into public.notifications (
    recipient_id, actor_id, notification_type, project_id, ticket_id, ticket_status, message
  ) values (
    new.assignee_id,
    notification_actor,
    'ticket_assignment'::public.notification_type,
    parent_project_id,
    new.ticket_id,
    parent_status,
    left(public.ticket_status_label(parent_status) || ' — You were assigned the subtask "' || new.title || '".', 300)
  );
  return new;
end;
$$;

revoke all on function public.ticket_status_label(public.ticket_status) from public, anon;
revoke all on function public.notify_ticket_assignment() from public, anon, authenticated;
revoke all on function public.notify_comment_mentions() from public, anon, authenticated;
revoke all on function public.notify_subtask_assignment() from public, anon, authenticated;

drop trigger if exists notify_ticket_assignment on public.tickets;
create trigger notify_ticket_assignment
  after insert or update of assignee_id, status on public.tickets
  for each row execute procedure public.notify_ticket_assignment();
