do $$
declare
  role_constraint record;
begin
  for role_constraint in
    select constraint_name
    from information_schema.check_constraints checks
    join information_schema.constraint_column_usage columns
      on checks.constraint_name = columns.constraint_name
      and checks.constraint_schema = columns.constraint_schema
    where columns.table_schema = 'public'
      and columns.table_name = 'agents'
      and columns.column_name = 'role'
  loop
    execute format(
      'alter table public.agents drop constraint if exists %I',
      role_constraint.constraint_name
    );
  end loop;
end $$;

alter table public.agents
  alter column role set default 'AGENT';

alter table public.agents
  add constraint agents_role_check
  check (
    role is null
    or role in ('AGENT', 'SUPERVISOR', 'COMPLIANCE', 'ADMIN', 'AUDITOR')
  );

insert into public.agents (name, email, role, active)
select 'Agente Demo', 'agente@test.com', 'AGENT', true
where not exists (
  select 1 from public.agents where email = 'agente@test.com'
);

insert into public.agents (name, email, role, active)
select 'Supervisor Demo', 'supervisor@test.com', 'SUPERVISOR', true
where not exists (
  select 1 from public.agents where email = 'supervisor@test.com'
);

insert into public.agents (name, email, role, active)
select 'Compliance Demo', 'compliance@test.com', 'COMPLIANCE', true
where not exists (
  select 1 from public.agents where email = 'compliance@test.com'
);

insert into public.agents (name, email, role, active)
select 'Auditor Demo', 'auditor@test.com', 'AUDITOR', true
where not exists (
  select 1 from public.agents where email = 'auditor@test.com'
);

insert into public.agents (name, email, role, active)
select 'Katherine', 'katherine@test.com', 'ADMIN', true
where not exists (
  select 1 from public.agents where email = 'katherine@test.com'
);
