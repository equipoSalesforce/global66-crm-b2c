create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  source_type text not null default 'MANUAL',
  current_version_id uuid,
  status text not null default 'ACTIVE',
  created_by uuid references public.crm_users(id) on delete set null,
  updated_by uuid references public.crm_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.knowledge_source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  version_label text not null,
  file_name text,
  file_url text,
  raw_text text,
  status text not null default 'DRAFT',
  published_at timestamptz,
  published_by uuid references public.crm_users(id) on delete set null,
  created_by uuid references public.crm_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_source_versions_source_label_unique unique (source_id, version_label),
  constraint knowledge_source_versions_status_check check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);

alter table public.knowledge_sources
  add column if not exists updated_by uuid references public.crm_users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_sources_current_version_fkey'
  ) then
    alter table public.knowledge_sources
      add constraint knowledge_sources_current_version_fkey
      foreign key (current_version_id)
      references public.knowledge_source_versions(id)
      on delete set null;
  end if;
end
$$;

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_articles
  add column if not exists source_id uuid references public.knowledge_sources(id) on delete set null,
  add column if not exists version_id uuid references public.knowledge_source_versions(id) on delete set null,
  add column if not exists product text,
  add column if not exists country text,
  add column if not exists plan text,
  add column if not exists customer_type text,
  add column if not exists section text,
  add column if not exists visibility text not null default 'CUSTOMER_ALLOWED',
  add column if not exists created_by uuid references public.crm_users(id) on delete set null,
  add column if not exists updated_by uuid references public.crm_users(id) on delete set null,
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'knowledge_articles_visibility_check'
  ) then
    alter table public.knowledge_articles
      add constraint knowledge_articles_visibility_check
      check (visibility in ('CUSTOMER_ALLOWED', 'AGENT_GUIDANCE', 'INTERNAL_ONLY'));
  end if;
end
$$;

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.knowledge_articles(id) on delete cascade,
  version_id uuid references public.knowledge_source_versions(id) on delete cascade,
  chunk_index integer not null default 0,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(content, ''))) stored,
  created_at timestamptz not null default now(),
  constraint knowledge_chunks_article_index_unique unique (article_id, chunk_index)
);

create table if not exists public.knowledge_publication_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.knowledge_sources(id) on delete set null,
  version_id uuid references public.knowledge_source_versions(id) on delete set null,
  event_type text not null,
  notes text,
  created_by uuid references public.crm_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_feedback (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete set null,
  article_id uuid references public.knowledge_articles(id) on delete set null,
  chunk_id uuid references public.knowledge_chunks(id) on delete set null,
  user_id uuid references public.crm_users(id) on delete set null,
  rating text,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_sources_status_idx on public.knowledge_sources (status);
create index if not exists knowledge_sources_deleted_idx on public.knowledge_sources (deleted_at);
create index if not exists knowledge_source_versions_source_idx on public.knowledge_source_versions (source_id);
create index if not exists knowledge_source_versions_status_idx on public.knowledge_source_versions (status);
create index if not exists knowledge_articles_source_idx on public.knowledge_articles (source_id);
create index if not exists knowledge_articles_version_idx on public.knowledge_articles (version_id);
create index if not exists knowledge_articles_product_idx on public.knowledge_articles (product);
create index if not exists knowledge_articles_country_idx on public.knowledge_articles (country);
create index if not exists knowledge_articles_plan_idx on public.knowledge_articles (plan);
create index if not exists knowledge_articles_category_idx on public.knowledge_articles (category);
create index if not exists knowledge_articles_visibility_idx on public.knowledge_articles (visibility);
create index if not exists knowledge_articles_active_idx on public.knowledge_articles (is_active);
create index if not exists knowledge_articles_created_idx on public.knowledge_articles (created_at desc);
create index if not exists knowledge_articles_deleted_idx on public.knowledge_articles (deleted_at);
create index if not exists knowledge_chunks_version_idx on public.knowledge_chunks (version_id);
create index if not exists knowledge_chunks_search_idx on public.knowledge_chunks using gin (search_vector);
create index if not exists knowledge_publication_events_source_created_idx
  on public.knowledge_publication_events (source_id, created_at desc);

create or replace function public.touch_knowledge_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists knowledge_sources_touch_updated_at on public.knowledge_sources;
create trigger knowledge_sources_touch_updated_at
before update on public.knowledge_sources
for each row execute function public.touch_knowledge_updated_at();

drop trigger if exists knowledge_source_versions_touch_updated_at on public.knowledge_source_versions;
create trigger knowledge_source_versions_touch_updated_at
before update on public.knowledge_source_versions
for each row execute function public.touch_knowledge_updated_at();

drop trigger if exists knowledge_articles_touch_updated_at on public.knowledge_articles;
create trigger knowledge_articles_touch_updated_at
before update on public.knowledge_articles
for each row execute function public.touch_knowledge_updated_at();

create or replace function public.publish_knowledge_version(
  p_version_id uuid,
  p_user_id uuid,
  p_event_type text default 'PUBLISH',
  p_notes text default null
)
returns void
language plpgsql
security invoker
as $$
declare
  v_source_id uuid;
begin
  select source_id into v_source_id
  from public.knowledge_source_versions
  where id = p_version_id;

  if v_source_id is null then
    raise exception 'Knowledge version not found';
  end if;

  update public.knowledge_source_versions
  set status = 'ARCHIVED', updated_at = now()
  where source_id = v_source_id
    and status = 'PUBLISHED'
    and id <> p_version_id;

  update public.knowledge_source_versions
  set status = 'PUBLISHED', published_at = now(), published_by = p_user_id, updated_at = now()
  where id = p_version_id;

  update public.knowledge_sources
  set current_version_id = p_version_id, status = 'ACTIVE', deleted_at = null,
      updated_by = p_user_id, updated_at = now()
  where id = v_source_id;

  insert into public.knowledge_publication_events (
    source_id, version_id, event_type, notes, created_by
  ) values (
    v_source_id,
    p_version_id,
    case when p_event_type = 'ROLLBACK' then 'ROLLBACK' else 'PUBLISH' end,
    p_notes,
    p_user_id
  );
end;
$$;

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_source_versions enable row level security;
alter table public.knowledge_articles enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_publication_events enable row level security;
alter table public.knowledge_feedback enable row level security;

grant select, insert, update on public.knowledge_sources to anon, authenticated;
grant select, insert, update on public.knowledge_source_versions to anon, authenticated;
grant select, insert, update on public.knowledge_articles to anon, authenticated;
grant select, insert, update, delete on public.knowledge_chunks to anon, authenticated;
grant select, insert on public.knowledge_publication_events to anon, authenticated;
grant select, insert on public.knowledge_feedback to anon, authenticated;
grant execute on function public.publish_knowledge_version(uuid, uuid, text, text) to anon, authenticated;

-- TODO(Cognito): reemplazar estas políticas demo por claims y autorización real.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'knowledge_sources',
    'knowledge_source_versions',
    'knowledge_articles',
    'knowledge_chunks',
    'knowledge_publication_events',
    'knowledge_feedback'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_demo_access'
    ) then
      execute format(
        'create policy %I on public.%I for all using (true) with check (true)',
        table_name || '_demo_access', table_name
      );
    end if;
  end loop;
end
$$;

notify pgrst, 'reload schema';
