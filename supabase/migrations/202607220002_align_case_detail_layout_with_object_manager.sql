-- Alinea el layout lateral con Object Manager sin eliminar configuración existente.

with missing_case_fields(
  field_key, label, field_type, description, is_required, picklist_values, default_value, is_standard
) as (
  values
    ('attachment_link', 'Adjunto', 'url', 'Último adjunto asociado al caso. Campo de presentación no editable.', false, '[]'::jsonb, null, true),
    ('rrss', 'RRSS', 'boolean', 'Control operativo RRSS del caso.', false, '[]'::jsonb, 'false', false),
    ('check_qa', 'Check QA', 'boolean', 'Control de revisión QA.', false, '[]'::jsonb, 'false', false),
    ('check_tl', 'Check TL', 'boolean', 'Control de revisión TL.', false, '[]'::jsonb, 'false', false),
    ('check_adv', 'Check ADV', 'boolean', 'Control de revisión ADV.', false, '[]'::jsonb, 'false', false),
    ('check_ssv', 'Check SSV', 'boolean', 'Control de revisión SSV.', false, '[]'::jsonb, 'false', false)
)
insert into public.case_field_definitions (
  field_key,
  label,
  field_type,
  description,
  is_required,
  is_active,
  picklist_values,
  default_value,
  is_standard,
  updated_at
)
select
  field_key,
  label,
  field_type,
  description,
  is_required,
  true,
  picklist_values,
  default_value,
  is_standard,
  now()
from missing_case_fields
on conflict (field_key) do update
set
  label = excluded.label,
  field_type = excluded.field_type,
  description = excluded.description,
  is_active = true,
  picklist_values = excluded.picklist_values,
  default_value = excluded.default_value,
  is_standard = excluded.is_standard,
  updated_at = now();

alter table public.case_detail_section_fields
  add column if not exists area text not null default 'GENERAL',
  add column if not exists source_type text,
  add column if not exists is_editable boolean not null default false,
  add column if not exists is_copyable boolean not null default true;

-- El FK anterior obligaba a que todos los campos vivieran en el registry legacy.
alter table public.case_detail_section_fields
  drop constraint if exists case_detail_section_fields_field_key_fkey;

update public.case_detail_section_fields section_field
set source_type = legacy.source_type,
    is_copyable = legacy.is_copyable
from public.case_detail_field_definitions legacy
where legacy.field_key = section_field.field_key
  and section_field.source_type is null;

-- Claves de CUSTOMER_PROFILE inequívocas y separadas de los campos CASE.
update public.case_detail_section_fields
set field_key = case field_key
      when 'tipo_cliente' then 'customer_type'
      when 'segmentacion' then 'customer_segment'
      when 'nombre_completo' then 'customer_name'
      when 'id_cuenta' then 'customer_public_id'
      when 'email' then 'customer_email'
      when 'numero_completo' then 'customer_phone'
      when 'pais' then 'customer_country'
      when 'geolocalizacion' then 'customer_geolocation'
      when 'estado_compliance' then 'customer_compliance_status'
      when 'paid_plan' then 'customer_paid_plan'
      when 'account_manager' then 'customer_account_manager'
      else field_key
    end,
    source_type = 'CUSTOMER_PROFILE',
    is_editable = false
where section_key = 'CUSTOMER_INFO';

-- El correo de Información del caso es el correo de contacto del objeto CASE.
update public.case_detail_section_fields
set field_key = 'contact_email',
    source_type = 'CASE',
    is_editable = true
where section_key = 'CASE_INFO'
  and field_key = 'email';

update public.case_detail_section_fields
set field_key = case field_key
      when 'whatsapp' then 'contact_phone'
      when 'case_owner' then 'assigned_to'
      when 'cat_extra' then 'ai_category'
      when 'caso_borde' then 'is_edge_case'
      else field_key
    end,
    source_type = 'CASE'
where source_type = 'CASE'
   or field_key in ('whatsapp', 'case_owner', 'cat_extra', 'caso_borde');

update public.case_detail_section_fields
set is_editable = true
where source_type = 'CASE'
  and field_key in (
    'subject',
    'description',
    'numero_caso_seguimiento',
    'contact_email',
    'contact_phone',
    'contact_type',
    'category',
    'cat_secundaria',
    'ai_category',
    'product',
    'subproduct',
    'is_edge_case',
    'rrss',
    'check_qa',
    'check_tl',
    'check_adv',
    'check_ssv'
  );

update public.case_detail_section_fields
set is_editable = false
where source_type <> 'CASE'
   or field_key in ('case_number', 'assigned_to', 'attachment_link');

update public.case_detail_section_fields
set source_type = case
      when field_key = 'wsp_registrado' then 'FORMULA'
      when field_key like 'csat_%' then 'CSAT'
      else 'CASE'
    end
where source_type is null;

alter table public.case_detail_section_fields
  alter column source_type set not null;

alter table public.case_detail_section_fields
  drop constraint if exists case_detail_section_fields_source_type_check;
alter table public.case_detail_section_fields
  add constraint case_detail_section_fields_source_type_check
  check (source_type in ('CASE', 'CUSTOMER_PROFILE', 'FORMULA', 'CSAT'));

alter table public.case_detail_section_fields
  drop constraint if exists case_detail_section_fields_unique;
alter table public.case_detail_section_fields
  add constraint case_detail_section_fields_area_source_unique
  unique (area, section_key, source_type, field_key);

create index if not exists case_detail_section_fields_area_section_idx
  on public.case_detail_section_fields (area, section_key, is_visible, sort_order);

comment on table public.case_detail_field_definitions is
  'LEGACY: conservada por compatibilidad. Los campos CASE se resuelven desde case_field_definitions; CUSTOMER_PROFILE, FORMULA y CSAT usan registries de sistema.';

notify pgrst, 'reload schema';
