create table if not exists public.ai_case_articles (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  article_id uuid null references public.knowledge_articles(id) on delete set null,
  article_title text not null,
  relevance_score numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_case_articles_case_id_idx
  on public.ai_case_articles(case_id);

create index if not exists ai_case_articles_article_id_idx
  on public.ai_case_articles(article_id);
