alter table if exists public.ai_settings
  add column if not exists auto_reply_enabled boolean default true,
  add column if not exists reply_when_assigned boolean default false,
  add column if not exists max_ai_replies_per_case integer default 3,
  add column if not exists escalation_message text default 'No tengo información suficiente para resolverlo automáticamente. Te derivaré con un ejecutivo para que te ayude.';
