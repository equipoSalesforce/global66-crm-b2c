create extension if not exists pgcrypto;

create table if not exists public.crm_quick_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  channel text default 'WHATSAPP',
  category text,
  is_active boolean not null default true,
  created_by uuid references public.crm_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint crm_quick_messages_title_check check (length(trim(title)) > 0),
  constraint crm_quick_messages_content_check check (length(trim(content)) > 0),
  constraint crm_quick_messages_channel_check check (
    channel is null or channel in ('WHATSAPP', 'GLOBAL')
  )
);

create table if not exists public.crm_user_chat_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.crm_users(id) on delete cascade,
  enter_to_send boolean not null default false,
  my_conversation_border_color text not null default '#22BA48',
  my_conversation_text_color text not null default '#FFFFFF',
  my_notes_border_color text not null default '#08DEFA',
  my_notes_text_color text not null default '#FFFFFF',
  customer_conversation_border_color text not null default '#D7D7D7',
  customer_conversation_text_color text not null default '#000000',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_user_chat_settings_user_unique unique (user_id),
  constraint crm_user_chat_settings_color_check check (
    my_conversation_border_color ~ '^#[0-9A-Fa-f]{6}$'
    and my_conversation_text_color ~ '^#[0-9A-Fa-f]{6}$'
    and my_notes_border_color ~ '^#[0-9A-Fa-f]{6}$'
    and my_notes_text_color ~ '^#[0-9A-Fa-f]{6}$'
    and customer_conversation_border_color ~ '^#[0-9A-Fa-f]{6}$'
    and customer_conversation_text_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

create index if not exists crm_quick_messages_active_channel_idx
  on public.crm_quick_messages (is_active, channel, updated_at desc)
  where deleted_at is null;
create index if not exists crm_quick_messages_created_by_idx
  on public.crm_quick_messages (created_by, updated_at desc);

create or replace function public.set_whatsapp_chat_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_crm_quick_messages_updated_at on public.crm_quick_messages;
create trigger set_crm_quick_messages_updated_at
before update on public.crm_quick_messages
for each row execute function public.set_whatsapp_chat_updated_at();

drop trigger if exists set_crm_user_chat_settings_updated_at on public.crm_user_chat_settings;
create trigger set_crm_user_chat_settings_updated_at
before update on public.crm_user_chat_settings
for each row execute function public.set_whatsapp_chat_updated_at();

alter table public.crm_quick_messages enable row level security;
alter table public.crm_user_chat_settings enable row level security;

grant select, insert, update on public.crm_quick_messages to anon, authenticated;
grant select, insert, update on public.crm_user_chat_settings to anon, authenticated;

-- TODO(Cognito): replace these demo policies with identity-aware policies.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_quick_messages'
      and policyname = 'crm_quick_messages_demo_access'
  ) then
    create policy crm_quick_messages_demo_access on public.crm_quick_messages
      for all using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_user_chat_settings'
      and policyname = 'crm_user_chat_settings_demo_access'
  ) then
    create policy crm_user_chat_settings_demo_access on public.crm_user_chat_settings
      for all using (true) with check (true);
  end if;
end
$$;

notify pgrst, 'reload schema';
