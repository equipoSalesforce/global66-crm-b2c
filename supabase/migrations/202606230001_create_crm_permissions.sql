create extension if not exists pgcrypto;

create table if not exists public.crm_permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null,
  description text,
  category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  permission_key text not null references public.crm_permissions(key) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(role, permission_key)
);

create table if not exists public.crm_case_field_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  field_key text not null,
  can_view boolean not null default true,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(role, field_key)
);

create index if not exists crm_role_permissions_role_idx
  on public.crm_role_permissions (role);

create index if not exists crm_case_field_permissions_role_idx
  on public.crm_case_field_permissions (role);

insert into public.crm_permissions (key, label, description, category)
values
  ('view_dashboard', 'Ver dashboard', 'Permite acceder al panel principal del CRM.', 'navigation'),
  ('view_cases', 'Ver casos', 'Permite listar y abrir casos.', 'cases'),
  ('manage_cases', 'Gestionar casos', 'Permite ejecutar acciones operativas sobre casos.', 'cases'),
  ('edit_case_fields', 'Editar campos de caso', 'Permite editar campos estándar del caso según permisos por campo.', 'cases'),
  ('assign_cases', 'Asignar casos', 'Permite tomar o reasignar casos.', 'cases'),
  ('close_cases', 'Cerrar casos', 'Permite cerrar casos.', 'cases'),
  ('view_customers', 'Ver clientes', 'Permite ver clientes y Cliente 360.', 'customers'),
  ('view_reports', 'Ver reportes', 'Permite ver reportes operativos.', 'reports'),
  ('view_configuration', 'Ver configuración', 'Permite acceder al área de configuración.', 'configuration'),
  ('manage_users', 'Administrar usuarios', 'Permite crear y editar usuarios internos.', 'users'),
  ('manage_permissions', 'Administrar permisos', 'Permite configurar permisos por rol y campos.', 'users'),
  ('manage_macros', 'Administrar macros', 'Permite configurar macros operativas.', 'macros'),
  ('manage_knowledge', 'Administrar conocimiento', 'Permite editar base de conocimiento.', 'knowledge'),
  ('sync_email', 'Sincronizar email', 'Permite sincronizar correo desde el módulo Ticket.', 'cases'),
  ('use_ai', 'Usar IA', 'Permite ejecutar funcionalidades asistidas por IA.', 'ai')
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  updated_at = now();

insert into public.crm_role_permissions (role, permission_key, enabled)
select 'ADMIN', key, true
from public.crm_permissions
on conflict (role, permission_key) do update
set enabled = excluded.enabled, updated_at = now();

insert into public.crm_role_permissions (role, permission_key, enabled)
values
  ('SUPERVISOR', 'view_dashboard', true),
  ('SUPERVISOR', 'view_cases', true),
  ('SUPERVISOR', 'manage_cases', true),
  ('SUPERVISOR', 'edit_case_fields', true),
  ('SUPERVISOR', 'assign_cases', true),
  ('SUPERVISOR', 'close_cases', true),
  ('SUPERVISOR', 'view_customers', true),
  ('SUPERVISOR', 'view_reports', true),
  ('SUPERVISOR', 'manage_knowledge', true),
  ('SUPERVISOR', 'use_ai', true),
  ('AGENT', 'view_dashboard', true),
  ('AGENT', 'view_cases', true),
  ('AGENT', 'manage_cases', true),
  ('AGENT', 'edit_case_fields', true),
  ('AGENT', 'close_cases', true),
  ('AGENT', 'view_customers', true),
  ('AGENT', 'sync_email', true),
  ('AGENT', 'use_ai', true)
on conflict (role, permission_key) do update
set enabled = excluded.enabled, updated_at = now();

insert into public.crm_role_permissions (role, permission_key, enabled)
values
  ('AGENT', 'view_configuration', false),
  ('AGENT', 'manage_users', false),
  ('AGENT', 'manage_permissions', false),
  ('AGENT', 'manage_macros', false),
  ('AGENT', 'view_reports', false),
  ('AGENT', 'manage_knowledge', false),
  ('SUPERVISOR', 'view_configuration', false),
  ('SUPERVISOR', 'manage_users', false),
  ('SUPERVISOR', 'manage_permissions', false),
  ('SUPERVISOR', 'manage_macros', false)
on conflict (role, permission_key) do nothing;

insert into public.crm_case_field_permissions (role, field_key, can_view, can_edit)
select role_name, field_key, true, true
from (
  values ('ADMIN'), ('SUPERVISOR')
) as roles(role_name)
cross join (
  values
    ('subject'),
    ('area'),
    ('category'),
    ('priority'),
    ('lifecycle_status'),
    ('routing_status'),
    ('resolution_type'),
    ('contact_type'),
    ('assigned_agent_id'),
    ('assigned_to')
) as fields(field_key)
on conflict (role, field_key) do update
set can_view = excluded.can_view, can_edit = excluded.can_edit, updated_at = now();

insert into public.crm_case_field_permissions (role, field_key, can_view, can_edit)
values
  ('AGENT', 'subject', true, true),
  ('AGENT', 'area', true, true),
  ('AGENT', 'category', true, true),
  ('AGENT', 'priority', true, true),
  ('AGENT', 'lifecycle_status', true, true),
  ('AGENT', 'routing_status', true, true),
  ('AGENT', 'resolution_type', true, true),
  ('AGENT', 'contact_type', true, true),
  ('AGENT', 'assigned_agent_id', true, false),
  ('AGENT', 'assigned_to', true, false)
on conflict (role, field_key) do update
set can_view = excluded.can_view, can_edit = excluded.can_edit, updated_at = now();

alter table public.crm_permissions enable row level security;
alter table public.crm_role_permissions enable row level security;
alter table public.crm_case_field_permissions enable row level security;

grant select, insert, update, delete on public.crm_permissions to anon, authenticated;
grant select, insert, update, delete on public.crm_role_permissions to anon, authenticated;
grant select, insert, update, delete on public.crm_case_field_permissions to anon, authenticated;

-- TODO(Cognito/FastAPI): these permissive RLS policies are temporary for the
-- Supabase demo. In AWS/RDS, authorization should be enforced in the backend
-- using Cognito/Google SSO identity plus these CRM metadata tables.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_permissions'
      and policyname = 'crm_permissions_demo_all'
  ) then
    create policy crm_permissions_demo_all
      on public.crm_permissions
      for all
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_role_permissions'
      and policyname = 'crm_role_permissions_demo_all'
  ) then
    create policy crm_role_permissions_demo_all
      on public.crm_role_permissions
      for all
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_case_field_permissions'
      and policyname = 'crm_case_field_permissions_demo_all'
  ) then
    create policy crm_case_field_permissions_demo_all
      on public.crm_case_field_permissions
      for all
      using (true)
      with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
