alter table public.messages
  add column if not exists email_message_id text;

create index if not exists idx_messages_email_message_id
  on public.messages(email_message_id);
