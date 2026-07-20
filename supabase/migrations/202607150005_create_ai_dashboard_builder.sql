insert into public.ai_features (feature_key, name, description, channel, is_active)
values (
  'AI_DASHBOARD_BUILDER',
  'AI Dashboard Builder',
  'Creación asistida por IA de dashboards operativos.',
  'ANALYTICS',
  true
)
on conflict (feature_key) do update set
  name = excluded.name,
  description = excluded.description,
  channel = excluded.channel,
  is_active = true,
  updated_at = now();

insert into public.ai_user_feature_limits (
  user_id, feature_key, daily_limit, monthly_limit, is_active
)
select
  id,
  'AI_DASHBOARD_BUILDER',
  case when role = 'ADMIN' then 100 else 3 end,
  case when role = 'ADMIN' then 3000 else 30 end,
  true
from public.crm_users
where status = 'ACTIVE'
on conflict (user_id, feature_key) do nothing;

create table if not exists public.dashboard_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text,
  owner_user_id text not null,
  owner_user_name text,
  visibility text not null default 'PRIVATE'
    check (visibility in ('PRIVATE', 'TEAM', 'PUBLIC')),
  source text not null default 'AI_DASHBOARD_BUILDER',
  prompt text,
  definition jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_name text,
  prompt text not null,
  generated_definition jsonb,
  status text not null check (status in ('SUCCESS', 'ERROR', 'BLOCKED_LIMIT')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists dashboard_definitions_owner_updated_idx
  on public.dashboard_definitions (owner_user_id, updated_at desc)
  where is_active;
create index if not exists dashboard_definitions_visibility_updated_idx
  on public.dashboard_definitions (visibility, updated_at desc)
  where is_active;
create index if not exists dashboard_ai_requests_user_created_idx
  on public.dashboard_ai_requests (user_id, created_at desc);

alter table public.dashboard_definitions enable row level security;
alter table public.dashboard_ai_requests enable row level security;

grant select, insert, update on public.dashboard_definitions to anon, authenticated;
grant select, insert on public.dashboard_ai_requests to anon, authenticated;

-- TODO(Cognito): replace these demo policies with identity-aware policies.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_definitions'
      and policyname = 'dashboard_definitions_demo_access'
  ) then
    create policy dashboard_definitions_demo_access
      on public.dashboard_definitions for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dashboard_ai_requests'
      and policyname = 'dashboard_ai_requests_demo_access'
  ) then
    create policy dashboard_ai_requests_demo_access
      on public.dashboard_ai_requests for all using (true) with check (true);
  end if;
end
$$;

notify pgrst, 'reload schema';
