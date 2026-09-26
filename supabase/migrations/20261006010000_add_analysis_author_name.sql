alter table public.ticket_ai_analyses
  add column if not exists author_name text;

alter table public.ticket_ai_analyses
  drop constraint if exists ticket_ai_analyses_author_name_length;

alter table public.ticket_ai_analyses
  add constraint ticket_ai_analyses_author_name_length
  check (author_name is null or char_length(author_name) <= 120);

notify pgrst, 'reload schema';
