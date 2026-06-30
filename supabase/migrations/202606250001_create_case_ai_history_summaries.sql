-- Cache portable de resumen IA para historial de casos por cliente.
-- TODO AWS: mover la generación a FastAPI/Cognito y conservar esta tabla en RDS/Aurora PostgreSQL.

create table if not exists public.case_ai_history_summaries (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  customer_id uuid null references public.customers(id) on delete set null,
  summary text null,
  patterns jsonb null,
  next_best_action text null,
  sentiment text null,
  metrics jsonb null,
  source_case_ids jsonb null,
  model text null,
  generated_by uuid null references public.crm_users(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_ai_history_summaries_case_id_key unique (case_id)
);

create index if not exists case_ai_history_summaries_case_id_idx
  on public.case_ai_history_summaries(case_id);

create index if not exists case_ai_history_summaries_customer_id_idx
  on public.case_ai_history_summaries(customer_id);

create index if not exists case_ai_history_summaries_generated_at_idx
  on public.case_ai_history_summaries(generated_at desc);

insert into public.crm_permissions (key, label, description, category)
values
  (
    'view_ai_case_summary',
    'Ver resumen IA de historial',
    'Permite ver la tab IA con resumen de casos históricos del cliente.',
    'ai'
  ),
  (
    'generate_ai_case_summary',
    'Generar resumen IA de historial',
    'Permite actualizar el resumen IA de casos históricos del cliente.',
    'ai'
  )
on conflict (key) do update
set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category;

insert into public.crm_role_permissions (role, permission_key, enabled)
values
  ('ADMIN', 'view_ai_case_summary', true),
  ('ADMIN', 'generate_ai_case_summary', true),
  ('SUPERVISOR', 'view_ai_case_summary', true),
  ('SUPERVISOR', 'generate_ai_case_summary', true),
  ('AGENT', 'view_ai_case_summary', true),
  ('AGENT', 'generate_ai_case_summary', true)
on conflict (role, permission_key) do update
set enabled = excluded.enabled;

alter table public.case_ai_history_summaries enable row level security;

drop policy if exists "case_ai_history_summaries_demo_select" on public.case_ai_history_summaries;
drop policy if exists "case_ai_history_summaries_demo_insert" on public.case_ai_history_summaries;
drop policy if exists "case_ai_history_summaries_demo_update" on public.case_ai_history_summaries;

create policy "case_ai_history_summaries_demo_select"
  on public.case_ai_history_summaries
  for select
  using (true);

create policy "case_ai_history_summaries_demo_insert"
  on public.case_ai_history_summaries
  for insert
  with check (true);

create policy "case_ai_history_summaries_demo_update"
  on public.case_ai_history_summaries
  for update
  using (true)
  with check (true);

grant select, insert, update on public.case_ai_history_summaries to anon, authenticated;

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then null;
end $$;
