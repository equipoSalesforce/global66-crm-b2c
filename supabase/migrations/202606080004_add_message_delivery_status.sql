alter table if exists public.messages
  add column if not exists delivery_status text;

create index if not exists idx_messages_delivery_status
  on public.messages(delivery_status);
