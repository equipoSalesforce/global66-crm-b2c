-- Ejecutar manualmente después de 202607230001_create_auth_otp_login.sql.
-- Todas las consultas son de solo lectura.

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'auth_login_codes',
    'auth_sessions',
    'auth_login_events',
    'audit_events',
    'auth_settings',
    'auth_user_email_aliases'
  )
order by table_name;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'auth_login_codes',
    'auth_sessions',
    'auth_login_events',
    'audit_events',
    'auth_settings',
    'auth_user_email_aliases'
  )
order by tablename;

select
  table_name,
  has_table_privilege('anon', format('public.%I', table_name), 'SELECT') as anon_select,
  has_table_privilege('anon', format('public.%I', table_name), 'INSERT') as anon_insert,
  has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT') as authenticated_insert
from unnest(array[
  'auth_login_codes',
  'auth_sessions',
  'auth_login_events',
  'audit_events',
  'auth_settings',
  'auth_user_email_aliases'
]) as auth_tables(table_name)
order by table_name;

select key, value
from public.auth_settings
order by key;

select id, email, role, status
from public.crm_users
where lower(email) = 'ka@test.com';

select id, user_id, email, is_primary, verified_at
from public.auth_user_email_aliases
where lower(email) = 'katherine.araya@global66.com';

select
  legacy.id as legacy_user_id,
  legacy.email as legacy_email,
  alias.user_id as alias_user_id,
  alias.email as alias_email,
  legacy.id = alias.user_id as same_user
from public.crm_users legacy
left join public.auth_user_email_aliases alias
  on lower(alias.email) = 'katherine.araya@global66.com'
where lower(legacy.email) = 'ka@test.com';

select id, email
from public.crm_users
where lower(email) = 'katherine.araya@global66.com';
