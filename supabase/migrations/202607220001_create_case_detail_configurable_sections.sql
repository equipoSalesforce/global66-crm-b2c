create extension if not exists pgcrypto;

create table if not exists public.case_detail_section_configs (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_detail_section_configs_key_check
    check (section_key in ('CUSTOMER_INFO', 'CASE_INFO', 'CASE_PROPERTIES', 'CSAT'))
);

create table if not exists public.case_detail_field_definitions (
  id uuid primary key default gen_random_uuid(),
  field_key text not null unique,
  label text not null,
  source_type text not null,
  source_path text,
  field_type text not null default 'TEXT',
  formula_key text,
  is_copyable boolean not null default true,
  is_required boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_detail_field_definitions_source_check
    check (source_type in ('CUSTOMER_PROFILE', 'CASE', 'FORMULA', 'CSAT', 'STATIC', 'SYSTEM')),
  constraint case_detail_field_definitions_type_check
    check (field_type in ('TEXT', 'EMAIL', 'PHONE', 'LINK', 'BOOLEAN', 'NUMBER', 'BADGE', 'STARS', 'CHECK')),
  constraint case_detail_field_definitions_formula_check
    check (
      (source_type = 'FORMULA' and formula_key is not null)
      or (source_type <> 'FORMULA')
    )
);

create table if not exists public.case_detail_section_fields (
  id uuid primary key default gen_random_uuid(),
  section_key text not null references public.case_detail_section_configs(section_key) on delete cascade,
  field_key text not null references public.case_detail_field_definitions(field_key) on delete cascade,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_detail_section_fields_unique unique (section_key, field_key),
  constraint case_detail_section_fields_order_check check (sort_order >= 0)
);

create table if not exists public.case_csat (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  resolution_score smallint,
  service_score smallint,
  feedback text,
  source text,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_csat_case_unique unique (case_id),
  constraint case_csat_resolution_score_check
    check (resolution_score is null or resolution_score between 1 and 5),
  constraint case_csat_service_score_check
    check (service_score is null or service_score between 1 and 5)
);

create index if not exists case_detail_section_configs_active_idx
  on public.case_detail_section_configs (is_active, section_key);
create index if not exists case_detail_field_definitions_active_idx
  on public.case_detail_field_definitions (is_active, source_type);
create index if not exists case_detail_section_fields_order_idx
  on public.case_detail_section_fields (section_key, is_visible, sort_order);
create index if not exists case_csat_received_idx
  on public.case_csat (case_id, received_at desc nulls last);

create or replace function public.touch_case_detail_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists case_detail_section_configs_touch_updated_at on public.case_detail_section_configs;
create trigger case_detail_section_configs_touch_updated_at
before update on public.case_detail_section_configs
for each row execute function public.touch_case_detail_config_updated_at();

drop trigger if exists case_detail_field_definitions_touch_updated_at on public.case_detail_field_definitions;
create trigger case_detail_field_definitions_touch_updated_at
before update on public.case_detail_field_definitions
for each row execute function public.touch_case_detail_config_updated_at();

drop trigger if exists case_detail_section_fields_touch_updated_at on public.case_detail_section_fields;
create trigger case_detail_section_fields_touch_updated_at
before update on public.case_detail_section_fields
for each row execute function public.touch_case_detail_config_updated_at();

drop trigger if exists case_csat_touch_updated_at on public.case_csat;
create trigger case_csat_touch_updated_at
before update on public.case_csat
for each row execute function public.touch_case_detail_config_updated_at();

insert into public.case_detail_section_configs (section_key, name, description)
values
  ('CUSTOMER_INFO', 'Información del cliente', 'Perfil operacional del cliente asociado al caso.'),
  ('CASE_INFO', 'Información del caso', 'Identificación y datos de contacto del caso.'),
  ('CASE_PROPERTIES', 'Propiedades Caso', 'Clasificación y controles operativos del caso.'),
  ('CSAT', 'CSAT', 'Resultados de satisfacción asociados al caso.')
on conflict (section_key) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

insert into public.case_detail_field_definitions (
  field_key, label, source_type, source_path, field_type, formula_key, is_copyable
)
values
  ('tipo_cliente', 'Tipo de cliente', 'CUSTOMER_PROFILE', 'customerType', 'TEXT', null, true),
  ('segmentacion', 'Segmentación', 'CUSTOMER_PROFILE', 'segment', 'BADGE', null, true),
  ('nombre_completo', 'Nombre completo', 'CUSTOMER_PROFILE', 'fullName', 'TEXT', null, true),
  ('id_cuenta', 'ID Cuenta', 'CUSTOMER_PROFILE', 'publicId', 'TEXT', null, true),
  ('email', 'Email', 'CUSTOMER_PROFILE', 'email', 'EMAIL', null, true),
  ('numero_completo', 'Número completo', 'CUSTOMER_PROFILE', 'phone', 'PHONE', null, true),
  ('pais', 'País', 'CUSTOMER_PROFILE', 'country', 'TEXT', null, true),
  ('geolocalizacion', 'Geolocalización', 'CUSTOMER_PROFILE', 'geolocation', 'TEXT', null, true),
  ('estado_compliance', 'Estado compliance', 'CUSTOMER_PROFILE', 'complianceStatus', 'BADGE', null, true),
  ('paid_plan', 'Paid plan', 'CUSTOMER_PROFILE', 'plan', 'BADGE', null, true),
  ('account_manager', 'Account manager', 'CUSTOMER_PROFILE', 'accountManager', 'TEXT', null, true),
  ('case_number', 'Número de caso', 'CASE', 'case_number', 'TEXT', null, true),
  ('numero_caso_seguimiento', 'Número caso seguimiento', 'CASE', 'numero_caso_seguimiento', 'TEXT', null, true),
  ('subject', 'Asunto', 'CASE', 'subject', 'TEXT', null, true),
  ('description', 'Descripción', 'CASE', 'description', 'TEXT', null, true),
  ('attachment_link', 'Adjunto', 'CASE', 'attachment_link', 'LINK', null, false),
  ('whatsapp', 'WhatsApp', 'CASE', 'contact_phone', 'PHONE', null, true),
  ('wsp_registrado', 'N° WSP Registrado', 'FORMULA', null, 'CHECK', 'WHATSAPP_MATCHES_CUSTOMER_PHONE', false),
  ('case_owner', 'Case owner', 'CASE', 'case_owner', 'TEXT', null, true),
  ('contact_type', 'Tipo de contacto', 'CASE', 'contact_type', 'TEXT', null, true),
  ('category', 'CAT Principal', 'CASE', 'category', 'TEXT', null, true),
  ('cat_secundaria', 'CAT Secundaria', 'CASE', 'cat_secundaria', 'TEXT', null, true),
  ('cat_extra', 'CAT Extra', 'CASE', 'cat_extra', 'TEXT', null, true),
  ('product', 'Producto', 'CASE', 'product', 'TEXT', null, true),
  ('subproduct', 'Subproducto', 'CASE', 'subproduct', 'TEXT', null, true),
  ('caso_borde', 'Caso borde', 'CASE', 'is_edge_case', 'CHECK', null, false),
  ('rrss', 'RRSS', 'CASE', 'custom.rrss', 'CHECK', null, false),
  ('check_qa', 'Check QA', 'CASE', 'custom.check_qa', 'CHECK', null, false),
  ('check_tl', 'Check TL', 'CASE', 'custom.check_tl', 'CHECK', null, false),
  ('check_adv', 'Check ADV', 'CASE', 'custom.check_adv', 'CHECK', null, false),
  ('check_ssv', 'Check SSV', 'CASE', 'custom.check_ssv', 'CHECK', null, false),
  ('csat_resolution_score', 'Resolución', 'CSAT', 'resolution_score', 'STARS', null, false),
  ('csat_service_score', 'Servicio', 'CSAT', 'service_score', 'STARS', null, false),
  ('csat_feedback', 'Feedback', 'CSAT', 'feedback', 'TEXT', null, false)
on conflict (field_key) do update
set label = excluded.label,
    source_type = excluded.source_type,
    source_path = excluded.source_path,
    field_type = excluded.field_type,
    formula_key = excluded.formula_key,
    is_copyable = excluded.is_copyable,
    is_active = true,
    updated_at = now();

with initial_fields(section_key, field_key, sort_order) as (
  values
    ('CUSTOMER_INFO', 'tipo_cliente', 10),
    ('CUSTOMER_INFO', 'segmentacion', 20),
    ('CUSTOMER_INFO', 'nombre_completo', 30),
    ('CUSTOMER_INFO', 'id_cuenta', 40),
    ('CUSTOMER_INFO', 'email', 50),
    ('CUSTOMER_INFO', 'numero_completo', 60),
    ('CUSTOMER_INFO', 'pais', 70),
    ('CUSTOMER_INFO', 'geolocalizacion', 80),
    ('CUSTOMER_INFO', 'estado_compliance', 90),
    ('CUSTOMER_INFO', 'paid_plan', 100),
    ('CUSTOMER_INFO', 'account_manager', 110),
    ('CASE_INFO', 'case_number', 10),
    ('CASE_INFO', 'numero_caso_seguimiento', 20),
    ('CASE_INFO', 'email', 30),
    ('CASE_INFO', 'subject', 40),
    ('CASE_INFO', 'description', 50),
    ('CASE_INFO', 'attachment_link', 60),
    ('CASE_INFO', 'whatsapp', 70),
    ('CASE_INFO', 'wsp_registrado', 80),
    ('CASE_PROPERTIES', 'case_owner', 10),
    ('CASE_PROPERTIES', 'contact_type', 20),
    ('CASE_PROPERTIES', 'category', 30),
    ('CASE_PROPERTIES', 'cat_secundaria', 40),
    ('CASE_PROPERTIES', 'cat_extra', 50),
    ('CASE_PROPERTIES', 'product', 60),
    ('CASE_PROPERTIES', 'subproduct', 70),
    ('CASE_PROPERTIES', 'caso_borde', 80),
    ('CASE_PROPERTIES', 'rrss', 90),
    ('CASE_PROPERTIES', 'check_qa', 100),
    ('CASE_PROPERTIES', 'check_tl', 110),
    ('CASE_PROPERTIES', 'check_adv', 120),
    ('CASE_PROPERTIES', 'check_ssv', 130),
    ('CSAT', 'csat_resolution_score', 10),
    ('CSAT', 'csat_service_score', 20),
    ('CSAT', 'csat_feedback', 30)
)
insert into public.case_detail_section_fields (section_key, field_key, sort_order, is_visible)
select section_key, field_key, sort_order, true
from initial_fields
on conflict (section_key, field_key) do nothing;

alter table public.case_detail_section_configs enable row level security;
alter table public.case_detail_field_definitions enable row level security;
alter table public.case_detail_section_fields enable row level security;
alter table public.case_csat enable row level security;

grant select, insert, update on public.case_detail_section_configs to anon, authenticated;
grant select, insert, update on public.case_detail_field_definitions to anon, authenticated;
grant select, insert, update, delete on public.case_detail_section_fields to anon, authenticated;
grant select, insert, update on public.case_csat to anon, authenticated;

-- TODO(Cognito): reemplazar estas políticas demo por autorización basada en claims.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'case_detail_section_configs',
    'case_detail_field_definitions',
    'case_detail_section_fields',
    'case_csat'
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
