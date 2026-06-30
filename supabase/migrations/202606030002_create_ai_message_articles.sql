create table if not exists public.ai_message_articles (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  article_id uuid null references public.knowledge_articles(id) on delete set null,
  article_title text not null,
  relevance_score numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_message_articles_case_id_idx
  on public.ai_message_articles(case_id);

create index if not exists ai_message_articles_message_id_idx
  on public.ai_message_articles(message_id);

create index if not exists ai_message_articles_article_id_idx
  on public.ai_message_articles(article_id);
