do $$
begin
  create type public.notification_type as enum ('ticket_assignment', 'comment_mention');
exception
  when duplicate_object then null;
end
$$;

alter table public.ticket_comments
  add column if not exists mentioned_user_ids uuid[] not null default '{}';

alter table public.ticket_comments
  add constraint ticket_comments_mention_limit check (cardinality(mentioned_user_ids) <= 20);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  notification_type public.notification_type not null,
  project_id uuid not null references public.projects (id) on delete cascade,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  comment_id uuid references public.ticket_comments (id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint notifications_message_length check (char_length(message) between 1 and 300)
);

create index if not exists notifications_recipient_created_at_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "Users can read their own notifications"
  on public.notifications
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create policy "Users can mark their own notifications read"
  on public.notifications
  for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

revoke all on public.notifications from anon;
revoke insert, delete, update on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify_ticket_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_actor uuid := (select auth.uid());
begin
  if new.assignee_id is null
    or new.assignee_id is not distinct from notification_actor then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    project_id,
    ticket_id,
    message
  ) values (
    new.assignee_id,
    notification_actor,
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
    if mentioned_user_id is not distinct from new.user_id then
      continue;
    end if;

    if not exists (
      select 1
      from public.project_members
      where project_members.project_id = mentioned_project_id
        and project_members.user_id = mentioned_user_id
    ) then
      raise exception 'Mentioned users must belong to the ticket project';
    end if;

    insert into public.notifications (
      recipient_id,
      actor_id,
      notification_type,
      project_id,
      ticket_id,
      comment_id,
      message
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
  notification_actor uuid := (select auth.uid());
  parent_project_id uuid;
begin
  if new.assignee_id is null
    or new.assignee_id is not distinct from notification_actor then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;

  select tickets.project_id into parent_project_id
  from public.tickets
  where tickets.id = new.ticket_id;

  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    project_id,
    ticket_id,
    message
  ) values (
    new.assignee_id,
    notification_actor,
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

drop trigger if exists notify_ticket_assignment on public.tickets;
create trigger notify_ticket_assignment
  after insert or update of assignee_id on public.tickets
  for each row execute procedure public.notify_ticket_assignment();

drop trigger if exists notify_comment_mentions on public.ticket_comments;
create trigger notify_comment_mentions
  after insert on public.ticket_comments
  for each row execute procedure public.notify_comment_mentions();

drop trigger if exists notify_subtask_assignment on public.ticket_subtasks;
create trigger notify_subtask_assignment
  after insert or update of assignee_id on public.ticket_subtasks
  for each row execute procedure public.notify_subtask_assignment();

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end
$$;
