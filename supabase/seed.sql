-- Development/demo data for the ecom-suite portal.
-- Apply all migrations first, then run this file in the Supabase SQL Editor.
-- This script is idempotent: fixed IDs and ON CONFLICT keep reruns safe.

do $$
declare
  seed_owner uuid;
  seed_pm uuid;
  seed_dev uuid;
  seed_client uuid;
  retainer_project constant uuid := '10000000-0000-4000-8000-000000000001';
  build_project constant uuid := '10000000-0000-4000-8000-000000000002';
begin
  select user_id into seed_owner
  from public.user_roles
  where role = 'admin'::public.app_role
  order by assigned_at
  limit 1;

  if seed_owner is null then
    select id into seed_owner from auth.users order by created_at limit 1;
  end if;

  if seed_owner is null then
    raise exception 'Create at least one authenticated user before running the sample seed.';
  end if;

  select user_id into seed_pm
  from public.user_roles
  where role = 'project_manager'::public.app_role
    or 'project_manager'::public.app_role = any(additional_roles)
  order by assigned_at
  limit 1;

  select user_id into seed_dev
  from public.user_roles
  where role = 'developer'::public.app_role
    or 'developer'::public.app_role = any(additional_roles)
  order by assigned_at
  limit 1;

  -- Client accounts are limited to one project. Only use an unassigned client.
  select roles.user_id into seed_client
  from public.user_roles as roles
  where roles.role = 'client'::public.app_role
    and not exists (
      select 1 from public.project_members
      where project_members.user_id = roles.user_id
    )
  order by roles.assigned_at
  limit 1;

  seed_pm := coalesce(seed_pm, seed_owner);
  seed_dev := coalesce(seed_dev, seed_pm, seed_owner);

  insert into public.projects (
    id,
    name,
    description,
    created_by,
    project_type,
    retainer_hours,
    hourly_rate,
    sprint_start_date,
    status,
    risk,
    repository_url,
    rollover_enabled,
    rollover_cap_hours,
    retainer_period_start,
    retainer_period_end
  ) values (
    retainer_project,
    '[Sample] Northstar Commerce Retainer',
    'Demo retainer workspace for validating sprint capacity, approvals, UAT, workload, time tracking, and archived delivery history.',
    seed_owner,
    'retainer'::public.project_type,
    80,
    175,
    current_date - 7,
    'active'::public.project_status,
    'at_risk'::public.project_risk,
    'https://github.com/example/northstar-commerce',
    true,
    12,
    current_date - 60,
    current_date + 305
  ), (
    build_project,
    '[Sample] Atlas Storefront Rebuild',
    'Demo new-build project covering design, development, QA, deployment, completed work, and archived tasks.',
    seed_owner,
    'new_build'::public.project_type,
    null,
    190,
    current_date - 7,
    'active'::public.project_status,
    'on_track'::public.project_risk,
    'https://github.com/example/atlas-storefront',
    false,
    null,
    null,
    null
  )
  on conflict (id) do nothing;

  insert into public.project_members (project_id, user_id, added_by)
  values
    (retainer_project, seed_owner, seed_owner),
    (build_project, seed_owner, seed_owner),
    (retainer_project, seed_pm, seed_owner),
    (build_project, seed_pm, seed_owner),
    (retainer_project, seed_dev, seed_owner),
    (build_project, seed_dev, seed_owner)
  on conflict (project_id, user_id) do nothing;

  if seed_client is not null then
    insert into public.project_members (project_id, user_id, added_by)
    values (retainer_project, seed_client, seed_owner)
    on conflict (project_id, user_id) do nothing;
  end if;

  insert into public.client_accounts (
    project_id,
    services,
    retainer_start_date,
    retainer_end_date,
    renewal_date,
    contract_status,
    project_manager_id,
    primary_developer_id,
    poc_name,
    poc_email,
    billing_email,
    location,
    timezone,
    website_url,
    notes
  ) values (
    retainer_project,
    array['development', 'email', 'digital'],
    current_date - 60,
    current_date + 305,
    current_date + 275,
    'active',
    seed_pm,
    seed_dev,
    'Morgan Lee',
    'morgan@example.com',
    'billing@example.com',
    'New York, NY',
    'America/New_York',
    'https://example.com',
    'Sample CRM account. Use this record to test retainer reporting and client account administration.'
  )
  on conflict (project_id) do nothing;

  insert into public.tickets (
    id, project_id, title, description, status, priority, ticket_type,
    work_category, approval_status, estimated_hours, logged_hours,
    billable_amount, assignee_id, due_date, created_by, created_at,
    updated_at, acceptance_criteria, reference_url, preview_url,
    repository_url, design_url, dev_notes
  ) values
    (
      '20000000-0000-4000-8000-000000000001', retainer_project,
      'Investigate intermittent checkout failures',
      'Review failed checkout sessions and identify why valid cards occasionally return a generic payment error.',
      'backlog', 'high', 'bug', 'dev_work', 'draft', 5, 0, 0,
      seed_dev, current_date - 2, seed_owner, now() - interval '5 days',
      now() - interval '5 days', null, 'https://example.com/checkout-report',
      null, 'https://github.com/example/northstar-commerce', null,
      'Start with payment-provider response codes and checkout session logs.'
    ),
    (
      '20000000-0000-4000-8000-000000000002', retainer_project,
      'Add loyalty balance to customer account',
      'Show the available loyalty balance and recent earning activity in the customer account.',
      'pending_approval', 'medium', 'new_feature', 'dev_work', 'pending', 12, 0, 0,
      coalesce(seed_client, seed_owner), current_date + 5, seed_owner,
      now() - interval '4 days', now() - interval '1 day',
      'Customers can see their current point balance and the five most recent balance changes.',
      'https://example.com/loyalty-brief', null,
      'https://github.com/example/northstar-commerce',
      'https://www.figma.com/design/sample-loyalty', null
    ),
    (
      '20000000-0000-4000-8000-000000000003', retainer_project,
      'Improve collection-page filtering',
      'Make active filters easier to review and remove on mobile collection pages.',
      'in_progress', 'high', 'feature_update', 'dev_work', 'approved', 16, 2.5, 437.50,
      seed_dev, current_date, seed_owner, now() - interval '8 days',
      now() - interval '2 hours',
      'Active filters remain visible, removable, and keyboard accessible at all responsive breakpoints.',
      'https://example.com/filter-notes', 'https://preview.example.com/filters',
      'https://github.com/example/northstar-commerce',
      'https://www.figma.com/design/sample-filters',
      'The existing filter drawer can be extended without replacing its query-state logic.'
    ),
    (
      '20000000-0000-4000-8000-000000000004', retainer_project,
      'Review redesigned subscription selector',
      'Validate the new purchase-option selector across product templates.',
      'client_uat', 'medium', 'feature_update', 'dev_work', 'uat_pending', 8, 1, 175,
      coalesce(seed_client, seed_owner), current_date + 2, seed_owner,
      now() - interval '10 days', now() - interval '6 hours',
      'One-time and subscription options update price, cadence, and add-to-cart attributes correctly.',
      null, 'https://preview.example.com/subscriptions',
      'https://github.com/example/northstar-commerce',
      'https://www.figma.com/design/sample-subscriptions', null
    ),
    (
      '20000000-0000-4000-8000-000000000005', retainer_project,
      'Deploy cart drawer accessibility fixes',
      'Release the approved focus-management and screen-reader improvements.',
      'ready_for_deploy', 'high', 'bug', 'dev_work', 'uat_approved', 6, 1, 175,
      seed_pm, current_date + 1, seed_owner, now() - interval '12 days',
      now() - interval '3 hours', null, null,
      'https://preview.example.com/cart-accessibility',
      'https://github.com/example/northstar-commerce', null,
      'UAT passed. Coordinate the production deployment with the PM.'
    ),
    (
      '20000000-0000-4000-8000-000000000006', retainer_project,
      'Update seasonal homepage campaign',
      'Publish the approved seasonal campaign modules and promotional messaging.',
      'completed', 'low', 'feature_update', 'admin_work', 'uat_approved', 4, 4, 700,
      seed_pm, current_date - 5, seed_owner, now() - interval '18 days',
      now() - interval '5 days',
      'Approved campaign modules are live and scheduled content is verified.',
      null, 'https://example.com', null,
      'https://www.figma.com/design/sample-campaign', null
    ),
    (
      '20000000-0000-4000-8000-000000000007', retainer_project,
      'Replace legacy product badges',
      'Archived example from the previous delivery month.',
      'archived', 'low', 'feature_update', 'dev_work', 'uat_approved', 7.5, 1.5, 262.50,
      null, current_date - 22, seed_owner, now() - interval '35 days',
      now() - interval '22 days',
      'All legacy badges are replaced with the shared badge component.',
      null, 'https://example.com',
      'https://github.com/example/northstar-commerce', null, null
    ),
    (
      '20000000-0000-4000-8000-000000000008', retainer_project,
      'Remove deprecated tracking script',
      'Archived example from an earlier delivery month.',
      'archived', 'medium', 'admin_work', 'admin_work', 'uat_approved', 2, 2, 350,
      null, current_date - 55, seed_owner, now() - interval '65 days',
      now() - interval '55 days',
      'The deprecated script no longer loads and replacement analytics remain operational.',
      null, null, null, null, null
    ),
    (
      '20000000-0000-4000-8000-000000000009', build_project,
      'Build product-card component system',
      'Create responsive product cards for collection, recommendations, and search surfaces.',
      'in_progress', 'high', 'new_feature', 'dev_work', 'approved', 20, 3, 570,
      seed_dev, current_date + 3, seed_owner, now() - interval '6 days',
      now() - interval '1 hour',
      'Cards support product imagery, badges, pricing, ratings, variants, and keyboard interaction.',
      null, 'https://preview.example.com/product-cards',
      'https://github.com/example/atlas-storefront',
      'https://www.figma.com/design/sample-product-cards', null
    ),
    (
      '20000000-0000-4000-8000-000000000010', build_project,
      'Define storefront analytics events',
      'Document and implement the analytics event contract for the rebuilt storefront.',
      'backlog', 'medium', 'new_feature', 'dev_work', 'draft', 10, 0, 0,
      seed_dev, current_date + 8, seed_owner, now() - interval '2 days',
      now() - interval '2 days',
      'Core commerce events use a documented, testable payload schema.',
      'https://example.com/analytics-plan', null,
      'https://github.com/example/atlas-storefront', null, null
    ),
    (
      '20000000-0000-4000-8000-000000000011', build_project,
      'Complete navigation prototype',
      'Completed new-build example ready to archive from the board.',
      'completed', 'medium', 'new_feature', 'dev_work', 'uat_approved', 14, 2, 380,
      seed_dev, current_date - 1, seed_owner, now() - interval '16 days',
      now() - interval '1 day',
      'Desktop and mobile navigation prototypes pass the agreed interaction review.',
      null, 'https://preview.example.com/navigation',
      'https://github.com/example/atlas-storefront',
      'https://www.figma.com/design/sample-navigation', null
    ),
    (
      '20000000-0000-4000-8000-000000000012', build_project,
      'Archive initial discovery spike',
      'Archived new-build discovery and technical feasibility work.',
      'archived', 'low', 'new_feature', 'dev_work', 'uat_approved', 9, 2, 380,
      null, current_date - 88, seed_owner, now() - interval '95 days',
      now() - interval '88 days',
      'Discovery findings and implementation recommendations are documented.',
      null, null, 'https://github.com/example/atlas-storefront', null,
      'Findings were incorporated into the build plan.'
    )
  on conflict (id) do nothing;

  insert into public.ticket_subtasks (
    id, ticket_id, title, description, is_completed, due_date, assignee_id,
    created_by, estimated_hours, logged_hours, subtask_type, is_internal,
    dev_pr_url, dev_preview_url, dev_notes, created_at, updated_at
  ) values
    (
      '30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000003',
      'Development', 'Implement responsive active-filter chips and removal behavior.',
      false, current_date, seed_dev, seed_owner, 8, 3.5, 'dev', true,
      null, null, null, now() - interval '6 days', now() - interval '2 hours'
    ),
    (
      '30000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000003',
      'Internal QA', 'Test filtering behavior across supported breakpoints.',
      false, current_date + 1, seed_dev, seed_owner, 4, 0, 'qa', true,
      null, null, null, now() - interval '6 days', now() - interval '6 days'
    ),
    (
      '30000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000003',
      'Deploy to production', 'Release after QA and client acceptance.',
      false, current_date + 3, seed_pm, seed_owner, 1, 0, 'deploy', true,
      null, null, null, now() - interval '6 days', now() - interval '6 days'
    ),
    (
      '30000000-0000-4000-8000-000000000004',
      '20000000-0000-4000-8000-000000000004',
      'Development', 'Implement subscription selector styling and state synchronization.',
      true, current_date - 2, seed_dev, seed_owner, 5, 5,
      'dev', true, 'https://github.com/example/northstar-commerce/pull/42',
      'https://preview.example.com/subscriptions',
      'Reused the existing selling-plan state and added keyboard selection.',
      now() - interval '9 days', now() - interval '3 days'
    ),
    (
      '30000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000004',
      'Internal QA', 'Regression test purchase options and cart attributes.',
      true, current_date - 1, seed_dev, seed_owner, 2, 2, 'qa', true,
      null, null, null, now() - interval '8 days', now() - interval '2 days'
    ),
    (
      '30000000-0000-4000-8000-000000000006',
      '20000000-0000-4000-8000-000000000007',
      'Development', 'Replace templates with the shared product-badge component.',
      true, current_date - 26, seed_dev, seed_owner, 5, 5, 'dev', true,
      'https://github.com/example/northstar-commerce/pull/31',
      'https://preview.example.com/product-badges',
      'Removed duplicate badge snippets after verifying theme references.',
      now() - interval '32 days', now() - interval '24 days'
    ),
    (
      '30000000-0000-4000-8000-000000000007',
      '20000000-0000-4000-8000-000000000009',
      'Development', 'Build the product-card primitives and responsive variants.',
      false, current_date + 2, seed_dev, seed_owner, 12, 4, 'dev', true,
      null, 'https://preview.example.com/product-cards',
      'Base component is ready; variant selection remains.',
      now() - interval '5 days', now() - interval '1 hour'
    ),
    (
      '30000000-0000-4000-8000-000000000008',
      '20000000-0000-4000-8000-000000000009',
      'Internal QA', 'Validate accessibility, image loading, and price states.',
      false, current_date + 4, seed_dev, seed_owner, 5, 0, 'qa', true,
      null, null, null, now() - interval '5 days', now() - interval '5 days'
    )
  on conflict (id) do nothing;

  insert into public.ticket_comments (
    id, ticket_id, user_id, content, is_internal, created_at
  ) values
    (
      '40000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000003', seed_owner,
      'The mobile filter interaction is the highest priority. Please keep the current desktop query behavior unchanged.',
      false, now() - interval '3 days'
    ),
    (
      '40000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000003', seed_pm,
      'Internal note: verify the final estimate after QA covers the edge cases in the collection templates.',
      true, now() - interval '2 days'
    ),
    (
      '40000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000004', seed_owner,
      'The preview is ready for client UAT on both desktop and mobile.',
      false, now() - interval '8 hours'
    )
  on conflict (id) do nothing;
end
$$;
