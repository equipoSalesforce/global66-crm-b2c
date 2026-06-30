create extension if not exists pgcrypto;

create table if not exists public.crm_agent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.crm_users(id) on delete cascade,
  availability text not null default 'AVAILABLE'
    check (availability in ('AVAILABLE', 'BUSY', 'AWAY', 'OFFLINE')),
  max_open_cases integer not null default 10 check (max_open_cases >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_agent_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.crm_users(id) on delete cascade,
  area text,
  category text,
  channel text,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, area, category, channel)
);

create index if not exists crm_agent_profiles_user_id_idx
  on public.crm_agent_profiles (user_id);

create index if not exists crm_agent_profiles_availability_idx
  on public.crm_agent_profiles (availability, is_active);

create index if not exists crm_agent_skills_user_id_idx
  on public.crm_agent_skills (user_id);

insert into public.crm_agent_profiles (user_id, availability, max_open_cases, is_active)
select id, 'AVAILABLE', 10, true
from public.crm_users
where status = 'ACTIVE'
  and role in ('AGENT', 'SUPERVISOR', 'ADMIN')
on conflict (user_id) do nothing;

alter table public.crm_agent_profiles enable row level security;
alter table public.crm_agent_skills enable row level security;

grant select, insert, update, delete on public.crm_agent_profiles to anon, authenticated;
grant select, insert, update, delete on public.crm_agent_skills to anon, authenticated;

-- TODO(Cognito/FastAPI): these permissive RLS policies are temporary for the
-- Supabase demo. In AWS/RDS, authorization should be enforced in the backend
-- using Cognito/Google SSO identity plus crm_users/crm_agent_* metadata.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_agent_profiles'
      and policyname = 'crm_agent_profiles_demo_all'
  ) then
    create policy crm_agent_profiles_demo_all
      on public.crm_agent_profiles
      for all
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_agent_skills'
      and policyname = 'crm_agent_skills_demo_all'
  ) then
    create policy crm_agent_skills_demo_all
      on public.crm_agent_skills
      for all
      using (true)
      with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
