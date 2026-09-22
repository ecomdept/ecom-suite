alter table public.ticket_subtasks
  add column if not exists dev_pr_url text,
  add column if not exists dev_preview_url text,
  add column if not exists dev_notes text;

alter table public.ticket_subtasks
  drop constraint if exists ticket_subtasks_dev_pr_url_length,
  add constraint ticket_subtasks_dev_pr_url_length check (dev_pr_url is null or char_length(dev_pr_url) <= 2000),
  drop constraint if exists ticket_subtasks_dev_preview_url_length,
  add constraint ticket_subtasks_dev_preview_url_length check (dev_preview_url is null or char_length(dev_preview_url) <= 2000),
  drop constraint if exists ticket_subtasks_dev_notes_length,
  add constraint ticket_subtasks_dev_notes_length check (dev_notes is null or char_length(dev_notes) <= 10000);
