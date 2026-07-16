insert into public.ai_features (feature_key, name, description, channel, is_active)
values (
  'TICKET_SUGGESTION',
  'Sugerencia IA Ticket',
  'Sugerencia de respuesta IA desde el módulo Ticket.',
  'TICKET',
  true
)
on conflict (feature_key) do update set
  name = excluded.name,
  description = excluded.description,
  channel = excluded.channel,
  is_active = true,
  updated_at = now();

insert into public.ai_user_feature_limits (
  user_id,
  feature_key,
  daily_limit,
  monthly_limit,
  is_active
)
select
  id,
  'TICKET_SUGGESTION',
  case when role = 'ADMIN' then 100 else 5 end,
  case when role = 'ADMIN' then 3000 else 150 end,
  true
from public.crm_users
where status = 'ACTIVE'
on conflict (user_id, feature_key) do nothing;

notify pgrst, 'reload schema';
