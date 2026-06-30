alter table public.cases
  add column if not exists email_thread_id text,
  add column if not exists email_subject_key text,
  add column if not exists last_email_message_id text,
  add column if not exists first_response_at timestamptz;

alter table public.messages
  add column if not exists external_message_id text,
  add column if not exists channel text,
  add column if not exists message_type text;

create index if not exists idx_cases_last_email_message_id
  on public.cases(last_email_message_id);

create index if not exists idx_cases_email_subject_key
  on public.cases(email_subject_key);

create index if not exists idx_messages_external_message_id
  on public.messages(external_message_id);
