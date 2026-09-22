alter table public.user_roles
  add column if not exists additional_roles public.app_role[] not null default '{}';

comment on column public.user_roles.additional_roles is
  'Secondary agency responsibilities. The role column remains the highest-privilege primary role for backward-compatible authorization.';

alter table public.user_roles
  drop constraint if exists user_roles_additional_roles_limit,
  add constraint user_roles_additional_roles_limit check (cardinality(additional_roles) <= 4),
  drop constraint if exists user_roles_primary_not_duplicated,
  add constraint user_roles_primary_not_duplicated check (not (role = any(additional_roles))),
  drop constraint if exists user_roles_client_is_exclusive,
  add constraint user_roles_client_is_exclusive check (
    (role = 'client'::public.app_role and cardinality(additional_roles) = 0)
    or (
      role <> 'client'::public.app_role
      and not ('client'::public.app_role = any(additional_roles))
    )
  );
