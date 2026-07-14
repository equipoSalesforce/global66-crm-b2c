create extension if not exists pgcrypto;

create table if not exists public.case_views (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_user_id text not null,
  owner_name text,
  privacy text not null default 'PRIVATE'
    check (privacy in ('PRIVATE', 'TEAM', 'PUBLIC')),
  team_id text,
  is_editable_by_others boolean not null default false,
  visible_fields jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  sort_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint case_views_visible_fields_array
    check (jsonb_typeof(visible_fields) = 'array'),
  constraint case_views_filters_object
    check (jsonb_typeof(filters) = 'object'),
  constraint case_views_sort_config_object
    check (jsonb_typeof(sort_config) = 'object')
);

create index if not exists case_views_owner_user_id_idx
  on public.case_views (owner_user_id)
  where deleted_at is null;

create index if not exists case_views_privacy_team_idx
  on public.case_views (privacy, team_id)
  where deleted_at is null;

create table if not exists public.case_view_user_preferences (
  user_id text primary key,
  default_case_view_id uuid references public.case_views(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_view_audit_events (
  id uuid primary key default gen_random_uuid(),
  case_view_id uuid references public.case_views(id) on delete set null,
  actor_user_id text,
  actor_name text,
  event_type text not null,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists case_view_audit_events_case_view_created_idx
  on public.case_view_audit_events (case_view_id, created_at desc);

create or replace function public.set_case_views_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_case_views_updated_at on public.case_views;
create trigger set_case_views_updated_at
before update on public.case_views
for each row execute function public.set_case_views_updated_at();

drop trigger if exists set_case_view_user_preferences_updated_at on public.case_view_user_preferences;
create trigger set_case_view_user_preferences_updated_at
before update on public.case_view_user_preferences
for each row execute function public.set_case_views_updated_at();

insert into public.crm_users (name, email, role, area, team, status)
values
  ('Sebas', 'sebas@global66.com', 'AGENT', 'CX', 'CX', 'ACTIVE'),
  ('Ejecutivo de Prueba', 'ejecutivo.prueba@global66.com', 'AGENT', 'CX', 'CX', 'ACTIVE')
on conflict (email) do update
set
  name = excluded.name,
  role = excluded.role,
  area = coalesce(public.crm_users.area, excluded.area),
  team = coalesce(public.crm_users.team, excluded.team),
  status = 'ACTIVE',
  updated_at = now();

alter table public.case_views enable row level security;
alter table public.case_view_user_preferences enable row level security;
alter table public.case_view_audit_events enable row level security;

grant select, insert, update, delete on public.case_views to anon, authenticated;
grant select, insert, update, delete on public.case_view_user_preferences to anon, authenticated;
grant select, insert, update, delete on public.case_view_audit_events to anon, authenticated;

-- TODO(Cognito/FastAPI): permissive RLS is temporary for demo mode. The API
-- routes enforce visibility and edit permissions using the demo_user_id cookie.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'case_views'
      and policyname = 'case_views_demo_all'
  ) then
    create policy case_views_demo_all
      on public.case_views
      for all
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'case_view_user_preferences'
      and policyname = 'case_view_user_preferences_demo_all'
  ) then
    create policy case_view_user_preferences_demo_all
      on public.case_view_user_preferences
      for all
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'case_view_audit_events'
      and policyname = 'case_view_audit_events_demo_all'
  ) then
    create policy case_view_audit_events_demo_all
      on public.case_view_audit_events
      for all
      using (true)
      with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
