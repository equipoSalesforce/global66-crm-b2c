create table if not exists public.crm_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role text not null check (role in ('ADMIN', 'SUPERVISOR', 'AGENT')),
  area text,
  team text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  avatar_url text,
  external_auth_provider text,
  external_auth_id text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_users_email_idx on public.crm_users (email);
create index if not exists crm_users_role_status_idx on public.crm_users (role, status);

insert into public.crm_users (name, email, role, area, team, status)
values
  ('Katherine', 'katherine@test.com', 'ADMIN', 'Operaciones', 'Administracion CRM', 'ACTIVE'),
  ('Supervisor Demo', 'supervisor@test.com', 'SUPERVISOR', 'Soporte', 'Supervision', 'ACTIVE'),
  ('Agente Demo', 'agente@test.com', 'AGENT', 'Soporte', 'Atencion clientes', 'ACTIVE')
on conflict (email) do update
set
  name = excluded.name,
  role = excluded.role,
  area = coalesce(public.crm_users.area, excluded.area),
  team = coalesce(public.crm_users.team, excluded.team),
  updated_at = now();
