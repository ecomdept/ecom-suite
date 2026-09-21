alter table public.tickets
  add column if not exists reference_url text;

alter table public.tickets
  drop constraint if exists tickets_reference_url_length;

alter table public.tickets
  add constraint tickets_reference_url_length
  check (reference_url is null or char_length(reference_url) <= 2000);

notify pgrst, 'reload schema';
