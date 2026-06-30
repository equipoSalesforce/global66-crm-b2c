alter table if exists public.ai_settings
  alter column max_ai_replies_per_case set default 6;

update public.ai_settings
set
  max_ai_replies_per_case = 6,
  escalation_message = 'Un ejecutivo revisará el caso y te ayudará con el siguiente paso.'
where
  coalesce(max_ai_replies_per_case, 3) <= 3
  or escalation_message ilike '%No tengo información suficiente%';
