-- Aircall Everywhere + webhook persistence.
-- Portable PostgreSQL tables. Supabase RLS policies below are temporary for the
-- current demo stage; in AWS this authorization should move to FastAPI using
-- Cognito/Google SSO claims plus crm_users/crm_role_permissions.

create table if not exists public.crm_aircall_users (
  id uuid primary key default gen_random_uuid(),
  crm_user_id uuid not null references public.crm_users(id) on delete cascade,
  aircall_user_id text not null,
  aircall_email text,
  aircall_name text,
  default_aircall_number_id text,
  default_aircall_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crm_user_id),
  unique (aircall_user_id)
);

create table if not exists public.aircall_calls (
  id uuid primary key default gen_random_uuid(),
  aircall_call_id text not null unique,
  case_id uuid references public.cases(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  crm_user_id uuid references public.crm_users(id) on delete set null,
  aircall_user_id text,
  aircall_user_name text,
  aircall_user_email text,
  direction text,
  phone_number text,
  customer_phone text,
  aircall_number_id text,
  aircall_number text,
  status text,
  result text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  recording_url text,
  asset_url text,
  voicemail_url text,
  tags jsonb,
  notes text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aircall_call_events (
  id uuid primary key default gen_random_uuid(),
  aircall_call_id text,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create table if not exists public.pending_aircall_call_contexts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  crm_user_id uuid references public.crm_users(id) on delete set null,
  aircall_user_id text,
  phone_number text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists crm_aircall_users_crm_user_id_idx
  on public.crm_aircall_users (crm_user_id);
create index if not exists crm_aircall_users_active_idx
  on public.crm_aircall_users (is_active);
create index if not exists aircall_calls_case_id_started_at_idx
  on public.aircall_calls (case_id, started_at desc);
create index if not exists aircall_calls_customer_id_idx
  on public.aircall_calls (customer_id);
create index if not exists aircall_calls_phone_number_idx
  on public.aircall_calls (phone_number);
create index if not exists aircall_calls_customer_phone_idx
  on public.aircall_calls (customer_phone);
create index if not exists aircall_calls_aircall_user_id_idx
  on public.aircall_calls (aircall_user_id);
create index if not exists aircall_call_events_call_id_idx
  on public.aircall_call_events (aircall_call_id);
create index if not exists aircall_call_events_received_at_idx
  on public.aircall_call_events (received_at desc);
create index if not exists pending_aircall_contexts_lookup_idx
  on public.pending_aircall_call_contexts (aircall_user_id, phone_number, expires_at desc);
create index if not exists pending_aircall_contexts_case_id_idx
  on public.pending_aircall_call_contexts (case_id);

insert into public.crm_permissions (key, label, category, description)
values
  ('use_aircall', 'Usar Aircall', 'aircall', 'Permite iniciar llamadas desde casos usando Aircall Everywhere.'),
  ('view_call_history', 'Ver historial de llamadas', 'aircall', 'Permite ver llamadas registradas por Aircall en el caso.'),
  ('manage_aircall_settings', 'Configurar Aircall', 'aircall', 'Permite administrar el mapeo entre usuarios CRM y usuarios Aircall.')
on conflict (key) do update set
  label = excluded.label,
  category = excluded.category,
  description = excluded.description;

insert into public.crm_role_permissions (role, permission_key, enabled)
values
  ('ADMIN', 'use_aircall', true),
  ('ADMIN', 'view_call_history', true),
  ('ADMIN', 'manage_aircall_settings', true),
  ('SUPERVISOR', 'use_aircall', true),
  ('SUPERVISOR', 'view_call_history', true),
  ('SUPERVISOR', 'manage_aircall_settings', false),
  ('AGENT', 'use_aircall', true),
  ('AGENT', 'view_call_history', true),
  ('AGENT', 'manage_aircall_settings', false)
on conflict (role, permission_key) do nothing;

alter table public.crm_aircall_users enable row level security;
alter table public.aircall_calls enable row level security;
alter table public.aircall_call_events enable row level security;
alter table public.pending_aircall_call_contexts enable row level security;

grant select, insert, update on public.crm_aircall_users to anon, authenticated;
grant select, insert, update on public.aircall_calls to anon, authenticated;
grant select, insert on public.aircall_call_events to anon, authenticated;
grant select, insert, update, delete on public.pending_aircall_call_contexts to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_aircall_users'
      and policyname = 'crm_aircall_users_demo_all'
  ) then
    create policy crm_aircall_users_demo_all
      on public.crm_aircall_users
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'aircall_calls'
      and policyname = 'aircall_calls_demo_all'
  ) then
    create policy aircall_calls_demo_all
      on public.aircall_calls
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'aircall_call_events'
      and policyname = 'aircall_call_events_demo_insert_select'
  ) then
    create policy aircall_call_events_demo_insert_select
      on public.aircall_call_events
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pending_aircall_call_contexts'
      and policyname = 'pending_aircall_contexts_demo_all'
  ) then
    create policy pending_aircall_contexts_demo_all
      on public.pending_aircall_call_contexts
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.aircall_calls;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.aircall_call_events;
  exception when duplicate_object then null;
  end;
end $$;

notify pgrst, 'reload schema';
