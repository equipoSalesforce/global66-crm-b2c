alter table public.cases
  add column if not exists case_number text,
  add column if not exists lifecycle_status text,
  add column if not exists routing_status text;

with numbered_cases as (
  select
    id,
    lpad(row_number() over (order by created_at, id)::text, 6, '0') as generated_case_number
  from public.cases
  where case_number is null
)
update public.cases as cases
set case_number = numbered_cases.generated_case_number
from numbered_cases
where cases.id = numbered_cases.id;

update public.cases
set
  lifecycle_status = case
    when status = 'CLOSED' then 'CLOSED'
    when lifecycle_status is not null then lifecycle_status
    else 'NEW'
  end,
  routing_status = case
    when status = 'AI_HANDLING' then 'AI_HANDLING'
    when status = 'HUMAN_REQUIRED' then 'HUMAN_REQUIRED'
    when status = 'ASSIGNED' then 'ASSIGNED'
    when assigned_agent_id is null and status <> 'AI_HANDLING' then 'UNASSIGNED'
    when routing_status is not null then routing_status
    else 'UNASSIGNED'
  end;

alter table public.cases
  add constraint cases_lifecycle_status_check
  check (lifecycle_status in ('NEW', 'IN_PROGRESS', 'STAND_BY', 'RESOLVED', 'CLOSED'))
  not valid;

alter table public.cases
  add constraint cases_routing_status_check
  check (routing_status in ('AI_HANDLING', 'HUMAN_REQUIRED', 'ASSIGNED', 'UNASSIGNED'))
  not valid;
