create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  storage_bucket text default 'email-attachments',
  storage_path text not null,
  source text default 'EMAIL',
  created_at timestamptz default now()
);

create index if not exists idx_message_attachments_case_id
  on public.message_attachments(case_id);

create index if not exists idx_message_attachments_message_id
  on public.message_attachments(message_id);

insert into storage.buckets (id, name, public)
values ('email-attachments', 'email-attachments', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'email_attachments_insert_demo'
  ) then
    create policy email_attachments_insert_demo
      on storage.objects
      for insert
      to anon, authenticated
      with check (bucket_id = 'email-attachments');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'email_attachments_select_demo'
  ) then
    create policy email_attachments_select_demo
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'email-attachments');
  end if;
end $$;
