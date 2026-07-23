create table if not exists public.auth_login_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  used_at timestamptz null,
  ip_hash text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.crm_users(id) on delete cascade,
  session_token_hash text unique not null,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz null,
  ip_hash text null,
  user_agent text null
);

create table if not exists public.auth_login_events (
  id uuid primary key default gen_random_uuid(),
  email text null,
  user_id uuid null references public.crm_users(id) on delete set null,
  event_type text not null,
  success boolean not null default false,
  error_code text null,
  error_message text null,
  ip_hash text null,
  user_agent text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references public.crm_users(id) on delete set null,
  actor_email text null,
  action text not null,
  entity_type text null,
  entity_id text null,
  before_data jsonb null,
  after_data jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_settings (
  key text primary key,
  value text not null,
  description text null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.crm_users(id) on delete set null
);

create table if not exists public.auth_user_email_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.crm_users(id) on delete cascade,
  email text not null unique,
  is_primary boolean not null default false,
  verified_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists auth_user_email_aliases_email_lower_uidx
  on public.auth_user_email_aliases (lower(email));
create index if not exists auth_user_email_aliases_user_id_idx
  on public.auth_user_email_aliases (user_id);
create index if not exists auth_login_codes_email_created_idx
  on public.auth_login_codes (lower(email), created_at desc);
create index if not exists auth_login_codes_ip_created_idx
  on public.auth_login_codes (ip_hash, created_at desc)
  where ip_hash is not null;
create index if not exists auth_sessions_user_active_idx
  on public.auth_sessions (user_id, expires_at desc)
  where revoked_at is null;
create index if not exists auth_login_events_email_created_idx
  on public.auth_login_events (lower(email), created_at desc);
create index if not exists auth_login_events_user_created_idx
  on public.auth_login_events (user_id, created_at desc);
create index if not exists audit_events_action_created_idx
  on public.audit_events (action, created_at desc);

insert into public.auth_settings (key, value, description)
values
  ('AUTH_OTP_MAX_REQUESTS_PER_IP_PER_DAY', '3', 'Máximo diario de solicitudes OTP por IP.'),
  ('AUTH_OTP_MAX_REQUESTS_PER_EMAIL_PER_WINDOW', '1', 'Máximo de solicitudes OTP por correo dentro de la ventana.'),
  ('AUTH_OTP_EMAIL_WINDOW_MINUTES', '15', 'Duración de la ventana de rate limit por correo.'),
  ('AUTH_OTP_MAX_REQUESTS_PER_EMAIL_PER_DAY', '5', 'Máximo diario de solicitudes OTP por correo.'),
  ('AUTH_OTP_EXPIRES_MINUTES', '10', 'Minutos de vigencia de un código OTP.'),
  ('AUTH_OTP_MAX_ATTEMPTS', '5', 'Máximo de intentos permitidos por código OTP.'),
  ('AUTH_SESSION_DAYS', '7', 'Días de vigencia de una sesión propia.')
on conflict (key) do nothing;

alter table public.auth_login_codes enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.auth_login_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.auth_settings enable row level security;
alter table public.auth_user_email_aliases enable row level security;

revoke all on public.auth_login_codes from public, anon, authenticated;
revoke all on public.auth_sessions from public, anon, authenticated;
revoke all on public.auth_login_events from public, anon, authenticated;
revoke all on public.audit_events from public, anon, authenticated;
revoke all on public.auth_settings from public, anon, authenticated;
revoke all on public.auth_user_email_aliases from public, anon, authenticated;

grant select, insert, update, delete on public.auth_login_codes to service_role;
grant select, insert, update, delete on public.auth_sessions to service_role;
grant select, insert on public.auth_login_events to service_role;
grant select, insert on public.audit_events to service_role;
grant select, insert, update on public.auth_settings to service_role;
grant select, insert, update, delete on public.auth_user_email_aliases to service_role;

notify pgrst, 'reload schema';
