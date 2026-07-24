-- Manual, idempotent backfill for shared local/CI/DEV databases.
-- This file is not a migration and must be executed explicitly by an operator.
-- It only inserts missing (user_id, feature_key) pairs for ACTIVE users and
-- never updates or deletes an existing limit.

-- Preview users with at least one missing active AI feature.
select
  users.id,
  users.name,
  users.email,
  users.role,
  count(features.feature_key) filter (where limits.id is null) as missing_limits
from public.crm_users users
cross join public.ai_features features
left join public.ai_user_feature_limits limits
  on limits.user_id = users.id
 and limits.feature_key = features.feature_key
where users.status = 'ACTIVE'
  and features.is_active = true
group by users.id, users.name, users.email, users.role
having count(features.feature_key) filter (where limits.id is null) > 0
order by users.name;

with demo_user as (
  select id
  from public.crm_users
  where status = 'ACTIVE'
    and (
      name ilike '%Agente Demo%'
      or email ilike '%agente.demo%'
    )
  order by created_at
  limit 1
),
demo_defaults as (
  select limits.feature_key, limits.daily_limit, limits.monthly_limit, limits.is_active
  from public.ai_user_feature_limits limits
  join demo_user on demo_user.id = limits.user_id
),
inserted as (
  insert into public.ai_user_feature_limits (
    user_id,
    feature_key,
    daily_limit,
    monthly_limit,
    is_active
  )
  select
    users.id,
    features.feature_key,
    case
      when upper(users.role) = 'ADMIN' then 100
      when features.feature_key = 'EMAIL_SUGGESTION' then 5
      when features.feature_key = 'WHATSAPP_SUGGESTION' then 1
      when features.feature_key = 'CASE_SUMMARY' then 10
      when features.feature_key = 'CASE_ANALYSIS' then 5
      when features.feature_key = 'HISTORICAL_CASE_AI_SUMMARY' then 3
      when features.feature_key = 'MACRO_SUGGESTION' then 3
      when features.feature_key = 'RESPONSE_TONE_REWRITE' then 5
      when features.feature_key = 'TICKET_SUGGESTION' then 5
      when features.feature_key = 'AI_DASHBOARD_BUILDER' then 3
      else coalesce(demo_defaults.daily_limit, 1)
    end,
    case
      when upper(users.role) = 'ADMIN' then 3000
      when features.feature_key = 'EMAIL_SUGGESTION' then 150
      when features.feature_key = 'WHATSAPP_SUGGESTION' then 30
      when features.feature_key = 'CASE_SUMMARY' then 300
      when features.feature_key = 'CASE_ANALYSIS' then 150
      when features.feature_key = 'HISTORICAL_CASE_AI_SUMMARY' then 90
      when features.feature_key = 'MACRO_SUGGESTION' then 90
      when features.feature_key = 'RESPONSE_TONE_REWRITE' then 150
      when features.feature_key = 'TICKET_SUGGESTION' then 150
      when features.feature_key = 'AI_DASHBOARD_BUILDER' then 30
      else coalesce(demo_defaults.monthly_limit, 30)
    end,
    case
      when upper(users.role) = 'ADMIN' then true
      else coalesce(demo_defaults.is_active, true)
    end
  from public.crm_users users
  cross join public.ai_features features
  left join demo_defaults
    on demo_defaults.feature_key = features.feature_key
  where users.status = 'ACTIVE'
    and features.is_active = true
  on conflict (user_id, feature_key) do nothing
  returning *
)
insert into public.ai_limit_change_events (
  target_user_id,
  changed_by_user_id,
  change_type,
  feature_key,
  previous_value,
  new_value,
  reason
)
select
  inserted.user_id,
  null,
  'AI_LIMITS_PROVISIONED',
  inserted.feature_key,
  null,
  jsonb_build_object(
    'daily_limit', inserted.daily_limit,
    'monthly_limit', inserted.monthly_limit,
    'is_active', inserted.is_active
  ),
  'Backfill idempotente para usuarios ACTIVE sin límites IA.'
from inserted;

-- Expected result after the backfill: zero rows.
select
  users.id,
  users.name,
  users.email,
  count(features.feature_key) filter (where limits.id is null) as missing_limits
from public.crm_users users
cross join public.ai_features features
left join public.ai_user_feature_limits limits
  on limits.user_id = users.id
 and limits.feature_key = features.feature_key
where users.status = 'ACTIVE'
  and features.is_active = true
group by users.id, users.name, users.email
having count(features.feature_key) filter (where limits.id is null) > 0
order by users.name;
