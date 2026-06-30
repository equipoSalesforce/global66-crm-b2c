alter table public.messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists failure_reason text;

create index if not exists idx_messages_external_delivery_status
  on public.messages(external_message_id, delivery_status);
