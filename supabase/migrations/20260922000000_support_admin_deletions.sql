-- Preserve project and ticket history when an administrator removes a user.
alter table public.projects alter column created_by drop not null;
alter table public.projects drop constraint if exists projects_created_by_fkey;
alter table public.projects
  add constraint projects_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.tickets alter column created_by drop not null;
alter table public.tickets drop constraint if exists tickets_created_by_fkey;
alter table public.tickets
  add constraint tickets_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.ticket_comments alter column user_id drop not null;
alter table public.ticket_comments drop constraint if exists ticket_comments_user_id_fkey;
alter table public.ticket_comments
  add constraint ticket_comments_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;
