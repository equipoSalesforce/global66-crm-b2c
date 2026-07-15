create extension if not exists pgcrypto;

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

alter table public.case_assignment_notifications enable row level security;

grant select, insert, update on public.case_assignment_notifications
  to anon, authenticated;

-- TODO(Cognito/FastAPI): this permissive policy is temporary for demo mode.
-- The backend must scope reads and writes to the authenticated CRM user.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'case_assignment_notifications'
      and policyname = 'case_assignment_notifications_demo_access'
  ) then
    create policy case_assignment_notifications_demo_access
      on public.case_assignment_notifications
      for all
      using (true)
      with check (true);
  end if;
end
$$;

notify pgrst, 'reload schema';
