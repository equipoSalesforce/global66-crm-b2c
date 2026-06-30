create extension if not exists pgcrypto;

create table if not exists public.case_audit_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  actor_user_id uuid,
  actor_name text,
  actor_email text,
  actor_role text,
  event_type text not null,
  field_key text,
  field_label text,
  old_value text,
  new_value text,
  source text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists case_audit_events_case_id_created_at_idx
  on public.case_audit_events (case_id, created_at desc);

create index if not exists case_audit_events_actor_user_id_idx
  on public.case_audit_events (actor_user_id);

create index if not exists case_audit_events_event_type_idx
  on public.case_audit_events (event_type);

alter table public.case_audit_events enable row level security;

grant select, insert on public.case_audit_events to anon, authenticated;

-- TODO(Cognito/FastAPI): this permissive RLS policy is temporary for the
-- Supabase demo. In AWS/RDS, authorization should be enforced in the backend
-- using Cognito/Google SSO identity plus crm_users and CRM permissions.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'case_audit_events'
      and policyname = 'case_audit_events_demo_select_insert'
  ) then
    create policy case_audit_events_demo_select_insert
      on public.case_audit_events
      for all
      using (true)
      with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
