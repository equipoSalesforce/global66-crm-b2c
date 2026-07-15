alter table public.cases
  add column if not exists response_status text;

update public.cases
set response_status = 'NO_AGENT_ACTIVITY'
where response_status is null
   or response_status not in (
     'NO_AGENT_ACTIVITY',
     'NO_CUSTOMER_ACTIVITY_24H',
     'WAITING_AGENT_RESPONSE',
     'UP_TO_DATE'
   );

alter table public.cases
  alter column response_status set default 'NO_AGENT_ACTIVITY',
  alter column response_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cases_response_status_check'
      and conrelid = 'public.cases'::regclass
  ) then
    alter table public.cases
      add constraint cases_response_status_check
      check (response_status in (
        'NO_AGENT_ACTIVITY',
        'NO_CUSTOMER_ACTIVITY_24H',
        'WAITING_AGENT_RESPONSE',
        'UP_TO_DATE'
      ));
  end if;
end
$$;

create or replace function public.recalculate_case_response_status(target_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  last_customer_activity timestamptz;
  last_agent_activity timestamptz;
  calculated_status text;
begin
  select
    max(created_at) filter (
      where upper(coalesce(direction, '')) = 'INBOUND'
        and upper(coalesce(sender_type, '')) = 'CUSTOMER'
        and upper(coalesce(message_type, '')) not in ('NOTE', 'INTERNAL')
    ),
    max(created_at) filter (
      where upper(coalesce(direction, '')) = 'OUTBOUND'
        and upper(coalesce(sender_type, '')) = 'AGENT'
        and upper(coalesce(message_type, '')) not in ('NOTE', 'INTERNAL')
    )
  into last_customer_activity, last_agent_activity
  from public.messages
  where case_id = target_case_id;

  calculated_status := case
    when last_agent_activity is null then 'NO_AGENT_ACTIVITY'
    when last_customer_activity is not null
      and last_customer_activity > last_agent_activity
      then 'WAITING_AGENT_RESPONSE'
    when last_agent_activity < now() - interval '24 hours'
      then 'NO_CUSTOMER_ACTIVITY_24H'
    else 'UP_TO_DATE'
  end;

  update public.cases
  set response_status = calculated_status
  where id = target_case_id
    and response_status is distinct from calculated_status;
end;
$$;

create or replace function public.sync_case_response_status_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_case_response_status(old.case_id);
    return old;
  end if;

  perform public.recalculate_case_response_status(new.case_id);

  if tg_op = 'UPDATE' and old.case_id is distinct from new.case_id then
    perform public.recalculate_case_response_status(old.case_id);
  end if;

  return new;
end;
$$;

create or replace function public.recalculate_all_case_response_statuses()
returns void
language sql
security definer
set search_path = public
as $$
  with activities as (
    select
      case_id,
      max(created_at) filter (
        where upper(coalesce(direction, '')) = 'INBOUND'
          and upper(coalesce(sender_type, '')) = 'CUSTOMER'
          and upper(coalesce(message_type, '')) not in ('NOTE', 'INTERNAL')
      ) as last_customer_activity,
      max(created_at) filter (
        where upper(coalesce(direction, '')) = 'OUTBOUND'
          and upper(coalesce(sender_type, '')) = 'AGENT'
          and upper(coalesce(message_type, '')) not in ('NOTE', 'INTERNAL')
      ) as last_agent_activity
    from public.messages
    group by case_id
  ), calculated as (
    select
      cases.id,
      case
        when activities.last_agent_activity is null then 'NO_AGENT_ACTIVITY'
        when activities.last_customer_activity is not null
          and activities.last_customer_activity > activities.last_agent_activity
          then 'WAITING_AGENT_RESPONSE'
        when activities.last_agent_activity < now() - interval '24 hours'
          then 'NO_CUSTOMER_ACTIVITY_24H'
        else 'UP_TO_DATE'
      end as response_status
    from public.cases
    left join activities on activities.case_id = cases.id
  )
  update public.cases
  set response_status = calculated.response_status
  from calculated
  where cases.id = calculated.id
    and cases.response_status is distinct from calculated.response_status;
$$;

drop trigger if exists sync_case_response_status_from_message on public.messages;
create trigger sync_case_response_status_from_message
after insert or delete or update of case_id, direction, sender_type, message_type, created_at
on public.messages
for each row execute function public.sync_case_response_status_from_message();

select public.recalculate_all_case_response_statuses();

grant execute on function public.recalculate_case_response_status(uuid)
  to anon, authenticated;
grant execute on function public.recalculate_all_case_response_statuses()
  to anon, authenticated;

update public.case_views
set visible_fields = jsonb_build_array('number', 'email', 'response') ||
  coalesce(
    (
      select jsonb_agg(field order by first_position)
      from (
        select field, min(ordinal_position) as first_position
        from jsonb_array_elements_text(visible_fields) with ordinality
          as existing_fields(field, ordinal_position)
        where field not in ('number', 'email', 'response')
        group by field
      ) normalized_fields
    ),
    '[]'::jsonb
  )
where visible_fields is distinct from (
  jsonb_build_array('number', 'email', 'response') ||
  coalesce(
    (
      select jsonb_agg(field order by first_position)
      from (
        select field, min(ordinal_position) as first_position
        from jsonb_array_elements_text(visible_fields) with ordinality
          as existing_fields(field, ordinal_position)
        where field not in ('number', 'email', 'response')
        group by field
      ) normalized_fields
    ),
    '[]'::jsonb
  )
);
