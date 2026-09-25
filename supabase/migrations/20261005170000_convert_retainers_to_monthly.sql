-- Convert the stored retainer allocation from a two-week sprint amount to a
-- calendar-month amount. The marker makes this safe to run more than once.
alter table public.projects
  add column if not exists retainer_hours_period text not null default 'sprint';

update public.projects
set retainer_hours = retainer_hours * 2,
    rollover_cap_hours = case
      when rollover_cap_hours is null then null
      else rollover_cap_hours * 2
    end,
    retainer_hours_period = 'monthly'
where project_type = 'retainer'::public.project_type
  and retainer_hours_period = 'sprint';

update public.projects
set retainer_hours_period = 'monthly'
where retainer_hours_period <> 'monthly';

alter table public.projects
  alter column retainer_hours_period set default 'monthly',
  drop constraint if exists projects_retainer_hours_period_monthly,
  add constraint projects_retainer_hours_period_monthly
    check (retainer_hours_period = 'monthly');

comment on column public.projects.retainer_hours is
  'Contracted hours renewed at the start of each calendar month.';

comment on column public.projects.rollover_cap_hours is
  'Maximum unused hours that may carry from the previous calendar month.';
