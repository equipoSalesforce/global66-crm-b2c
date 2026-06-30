create table if not exists public.whatsapp_media_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  whatsapp_media_id text,
  media_type text not null,
  mime_type text,
  filename text,
  caption text,
  sha256 text,
  size_bytes bigint,
  storage_bucket text default 'whatsapp-media',
  storage_path text,
  public_url text,
  created_at timestamptz default now()
);

create index if not exists idx_whatsapp_media_attachments_case_id
  on public.whatsapp_media_attachments(case_id);

create index if not exists idx_whatsapp_media_attachments_message_id
  on public.whatsapp_media_attachments(message_id);

alter table if exists public.messages
  add column if not exists media_type text,
  add column if not exists has_media boolean default false,
  add column if not exists delivery_status text,
  add column if not exists external_message_id text;

insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'whatsapp_media_insert_demo'
  ) then
    create policy whatsapp_media_insert_demo
      on storage.objects
      for insert
      to anon, authenticated
      with check (bucket_id = 'whatsapp-media');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'whatsapp_media_select_demo'
  ) then
    create policy whatsapp_media_select_demo
      on storage.objects
      for select
      to anon, authenticated
      using (bucket_id = 'whatsapp-media');
  end if;
end $$;
