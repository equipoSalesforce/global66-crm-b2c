create extension if not exists pgcrypto;

create table if not exists public.crm_queues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key text not null unique,
  description text,
  area text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_queue_members (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.crm_queues(id) on delete cascade,
  user_id uuid not null references public.crm_users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(queue_id, user_id)
);

alter table public.cases
  add column if not exists owner_type text not null default 'USER',
  add column if not exists assigned_queue_id uuid references public.crm_queues(id) on delete set null,
  add column if not exists duplicated_from_case_id uuid references public.cases(id) on delete set null;

alter table public.cases
  drop constraint if exists cases_owner_type_check;

alter table public.cases
  add constraint cases_owner_type_check
  check (owner_type in ('USER', 'QUEUE'));

alter table public.cases
  drop constraint if exists cases_owner_reference_check;

alter table public.cases
  add constraint cases_owner_reference_check
  check (
    (owner_type = 'USER' and assigned_queue_id is null)
    or
    (owner_type = 'QUEUE' and assigned_agent_id is null and assigned_queue_id is not null)
  ) not valid;

create index if not exists crm_queues_active_name_idx
  on public.crm_queues (is_active, name);
create index if not exists crm_queue_members_queue_active_idx
  on public.crm_queue_members (queue_id, is_active);
create index if not exists crm_queue_members_user_active_idx
  on public.crm_queue_members (user_id, is_active);
create index if not exists cases_owner_type_idx
  on public.cases (owner_type);
create index if not exists cases_assigned_queue_id_idx
  on public.cases (assigned_queue_id);
create index if not exists cases_duplicated_from_case_id_idx
  on public.cases (duplicated_from_case_id);

insert into public.crm_queues (name, key, description, area, is_active)
values
  ('CX General', 'CX_GENERAL', 'Cola general de atención y experiencia de clientes.', 'CX', true),
  ('Soporte', 'SOPORTE', 'Consultas y solicitudes de soporte.', 'SOPORTE', true),
  ('Compliance', 'COMPLIANCE', 'Revisiones y gestiones de cumplimiento.', 'COMPLIANCE', true),
  ('RET', 'RET', 'Gestiones relacionadas con retención y exchange.', 'RET', true),
  ('Fraude', 'FRAUDE', 'Casos que requieren revisión por posible fraude.', 'FRAUDE', true),
  ('Operaciones', 'OPERACIONES', 'Gestiones operativas y seguimiento de transacciones.', 'OPERACIONES', true)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  area = excluded.area,
  is_active = true,
  updated_at = now();

-- Compatible with the in-app notification center from the case-list branch.
create table if not exists public.case_assignment_notifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  case_number text,
  previous_owner_user_id text,
  previous_owner_name text,
  assigned_to_user_id text not null,
  assigned_to_name text,
  assigned_by_user_id text,
  assigned_by_name text,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint case_assignment_notifications_read_at_check
    check (not is_read or read_at is not null)
);

create index if not exists case_assignment_notifications_assignee_unread_idx
  on public.case_assignment_notifications (assigned_to_user_id, created_at desc)
  where not is_read;
create index if not exists case_assignment_notifications_case_created_idx
  on public.case_assignment_notifications (case_id, created_at desc);

create or replace function public.set_crm_queue_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_crm_queues_updated_at on public.crm_queues;
create trigger set_crm_queues_updated_at
before update on public.crm_queues
for each row execute function public.set_crm_queue_updated_at();

alter table public.crm_queues enable row level security;
alter table public.crm_queue_members enable row level security;
alter table public.case_assignment_notifications enable row level security;

grant select on public.crm_queues to anon, authenticated;
grant select on public.crm_queue_members to anon, authenticated;
grant select, insert, update on public.case_assignment_notifications to anon, authenticated;

-- TODO(Cognito/FastAPI): replace these demo policies with identity-aware
-- authorization when Cognito becomes the source of CRM identity.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_queues'
      and policyname = 'crm_queues_demo_access'
  ) then
    create policy crm_queues_demo_access on public.crm_queues
      for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_queue_members'
      and policyname = 'crm_queue_members_demo_access'
  ) then
    create policy crm_queue_members_demo_access on public.crm_queue_members
      for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'case_assignment_notifications'
      and policyname = 'case_assignment_notifications_demo_access'
  ) then
    create policy case_assignment_notifications_demo_access
      on public.case_assignment_notifications
      for all using (true) with check (true);
  end if;
end
$$;

notify pgrst, 'reload schema';
