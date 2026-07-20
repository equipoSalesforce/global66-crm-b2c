create table if not exists public.ai_features (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null unique,
  name text not null,
  description text,
  channel text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_user_feature_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.crm_users(id) on delete cascade,
  feature_key text not null references public.ai_features(feature_key) on update cascade,
  daily_limit integer not null check (daily_limit >= 0),
  monthly_limit integer not null check (monthly_limit >= 0),
  temporary_daily_limit integer check (temporary_daily_limit >= 0),
  temporary_expires_at timestamptz,
  temporary_reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_user_feature_limits_user_feature_unique unique (user_id, feature_key),
  constraint ai_user_feature_limits_temporary_fields_check check (
    temporary_daily_limit is null or temporary_expires_at is not null
  )
);

create table if not exists public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.crm_users(id) on delete cascade,
  feature_key text not null references public.ai_features(feature_key) on update cascade,
  case_id uuid references public.cases(id) on delete set null,
  case_number text,
  channel text,
  topic text,
  tokens_used integer check (tokens_used is null or tokens_used >= 0),
  model text,
  status text not null check (status in ('SUCCESS', 'BLOCKED_LIMIT', 'ERROR')),
  daily_limit integer,
  daily_usage_before integer,
  daily_usage_after integer,
  monthly_limit integer,
  monthly_usage_before integer,
  monthly_usage_after integer,
  remaining_daily integer,
  remaining_monthly integer,
  request_metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_limit_change_events (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.crm_users(id) on delete cascade,
  changed_by_user_id uuid references public.crm_users(id) on delete set null,
  change_type text not null,
  feature_key text references public.ai_features(feature_key) on update cascade,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists ai_interactions_user_created_idx
  on public.ai_interactions (user_id, created_at desc);
create index if not exists ai_interactions_user_feature_created_idx
  on public.ai_interactions (user_id, feature_key, created_at desc);
create index if not exists ai_limit_change_events_target_created_idx
  on public.ai_limit_change_events (target_user_id, created_at desc);

insert into public.ai_features (feature_key, name, description, channel)
values
  ('EMAIL_SUGGESTION', 'Sugerencia IA Email', 'Genera una sugerencia de respuesta para email.', 'EMAIL'),
  ('WHATSAPP_SUGGESTION', 'Sugerencia IA WhatsApp', 'Genera una sugerencia de respuesta para WhatsApp.', 'WHATSAPP'),
  ('CASE_SUMMARY', 'Resumen IA del caso', 'Resume el caso actual.', 'CASE'),
  ('CASE_ANALYSIS', 'Análisis IA del caso', 'Analiza contexto, riesgo y próximos pasos.', 'CASE'),
  ('HISTORICAL_CASE_AI_SUMMARY', 'Resumen IA de casos históricos', 'Resume el historial de casos del cliente.', 'CASE'),
  ('MACRO_SUGGESTION', 'Macro sugerida por IA', 'Sugiere una macro operativa.', 'CASE'),
  ('RESPONSE_TONE_REWRITE', 'Reescritura de tono', 'Reescribe una respuesta con el tono solicitado.', 'OMNICHANNEL')
on conflict (feature_key) do update set
  name = excluded.name,
  description = excluded.description,
  channel = excluded.channel,
  updated_at = now();

insert into public.ai_user_feature_limits (
  user_id, feature_key, daily_limit, monthly_limit, is_active
)
select
  users.id,
  features.feature_key,
  case
    when users.role = 'ADMIN' then 100
    when features.feature_key = 'EMAIL_SUGGESTION' then 5
    when features.feature_key = 'WHATSAPP_SUGGESTION' then 1
    when features.feature_key = 'CASE_SUMMARY' then 10
    when features.feature_key = 'CASE_ANALYSIS' then 5
    when features.feature_key = 'HISTORICAL_CASE_AI_SUMMARY' then 3
    when features.feature_key = 'MACRO_SUGGESTION' then 3
    when features.feature_key = 'RESPONSE_TONE_REWRITE' then 5
    else 0
  end,
  case
    when users.role = 'ADMIN' then 3000
    when features.feature_key = 'EMAIL_SUGGESTION' then 150
    when features.feature_key = 'WHATSAPP_SUGGESTION' then 30
    when features.feature_key = 'CASE_SUMMARY' then 300
    when features.feature_key = 'CASE_ANALYSIS' then 150
    when features.feature_key = 'HISTORICAL_CASE_AI_SUMMARY' then 90
    when features.feature_key = 'MACRO_SUGGESTION' then 90
    when features.feature_key = 'RESPONSE_TONE_REWRITE' then 150
    else 0
  end,
  true
from public.crm_users users
cross join public.ai_features features
where users.status = 'ACTIVE'
on conflict (user_id, feature_key) do nothing;

alter table public.ai_features enable row level security;
alter table public.ai_user_feature_limits enable row level security;
alter table public.ai_interactions enable row level security;
alter table public.ai_limit_change_events enable row level security;

grant select on public.ai_features to anon, authenticated;
grant select, insert, update on public.ai_user_feature_limits to anon, authenticated;
grant select, insert on public.ai_interactions to anon, authenticated;
grant select, insert on public.ai_limit_change_events to anon, authenticated;

-- TODO(Cognito): replace demo policies with claims-based user/admin policies.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'ai_features', 'ai_user_feature_limits', 'ai_interactions', 'ai_limit_change_events'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_demo_access'
    ) then
      execute format(
        'create policy %I on public.%I for all using (true) with check (true)',
        table_name || '_demo_access', table_name
      );
    end if;
  end loop;
end
$$;

notify pgrst, 'reload schema';
