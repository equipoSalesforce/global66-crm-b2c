alter table public.cases
  add column if not exists assigned_at timestamptz;

create table if not exists public.case_sla_snapshots (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  notification_status text,
  frt_seconds int,
  aht_total_seconds int,
  aht_agent_seconds int,
  ttc_seconds int,
  last_customer_message_at timestamptz,
  last_agent_message_at timestamptz,
  computed_at timestamptz default now()
);

create index if not exists case_sla_snapshots_case_computed_idx
  on public.case_sla_snapshots(case_id, computed_at desc);
