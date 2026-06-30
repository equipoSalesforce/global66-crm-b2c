alter table public.messages
  add column if not exists email_subject text,
  add column if not exists email_from text,
  add column if not exists email_to text,
  add column if not exists email_cc text,
  add column if not exists email_bcc text,
  add column if not exists email_html_body text,
  add column if not exists email_text_body text,
  add column if not exists in_reply_to text,
  add column if not exists email_references text[];

create index if not exists idx_messages_in_reply_to
  on public.messages(in_reply_to);
