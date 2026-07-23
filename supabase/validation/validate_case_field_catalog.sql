-- Ejecutar después de 202607220004_normalize_case_field_catalog.sql.
-- Todas las consultas son de solo lectura.

-- 1A. Asunto registrado.
select field_key, label, is_standard, storage_type, column_name, is_editable
from public.case_field_definitions
where field_key = 'subject';

-- Esperado: subject / Asunto / true / COLUMN / subject / true.

-- 1B. Número Caso registrado.
select field_key, label, is_standard, storage_type, column_name, is_editable
from public.case_field_definitions
where field_key = 'case_number';

-- Esperado: case_number / Número Caso / true / COLUMN / case_number / false.

-- 1C. Campos mínimos requeridos por Vistas, Layout Builder y Form.
select
  field_key,
  label,
  field_type,
  storage_type,
  column_name,
  is_standard,
  is_editable,
  is_filterable,
  is_list_visible,
  is_form_eligible,
  is_detail_eligible,
  is_system,
  is_active,
  sort_order
from public.case_field_definitions
where field_key in ('subject', 'case_number', 'status', 'channel', 'priority')
order by sort_order, field_key;

-- 2A. Consulta solicitada: debe devolver cero filas.
select
  columns.column_name
from information_schema.columns columns
left join public.case_field_definitions definitions
  on definitions.field_key = columns.column_name
where columns.table_schema = 'public'
  and columns.table_name = 'cases'
  and definitions.field_key is null
order by columns.ordinal_position;

-- 2B. Validación adicional del contrato de almacenamiento: también debe devolver cero.
select
  columns.column_name,
  columns.data_type,
  columns.is_nullable
from information_schema.columns columns
left join public.case_field_definitions definitions
  on definitions.storage_type = 'COLUMN'
 and definitions.column_name = columns.column_name
where columns.table_schema = 'public'
  and columns.table_name = 'cases'
  and definitions.id is null
order by columns.ordinal_position;

-- 3A. Conteo solicitado por origen.
select is_standard, storage_type, count(*)
from public.case_field_definitions
where is_active = true
group by is_standard, storage_type
order by storage_type, is_standard;

-- 3B. Totales que muestra Object Manager > Caso > Campos.
select
  count(*) filter (
    where is_active
      and storage_type = 'COLUMN'
      and not is_system
      and is_editable
  ) as standard_active_editable,
  count(*) filter (
    where is_active
      and storage_type = 'CUSTOM_VALUE'
      and not is_system
  ) as custom_active,
  count(*) filter (
    where is_active
      and (is_system or not is_editable)
  ) as system_or_readonly_active,
  count(*) filter (where is_active) as total_active
from public.case_field_definitions;

-- 4. Debe devolver cero filas: referencias CASE huérfanas en consumidores.
with view_field_aliases(view_key, field_key) as (
  values
    ('number', 'case_number'),
    ('subject', 'subject'),
    ('email', 'contact_email'),
    ('response', 'response_status'),
    ('contactType', 'contact_type'),
    ('catPrincipal', 'area'),
    ('catSecondary', 'category'),
    ('catExtra', 'ai_category'),
    ('status', 'lifecycle_status'),
    ('containmentContext', 'resolution_type'),
    ('owner', 'assigned_to'),
    ('priority', 'priority'),
    ('isEdgeCase', 'is_edge_case'),
    ('channel', 'channel'),
    ('product', 'product'),
    ('subproduct', 'subproduct')
), referenced_fields(source, owner_key, field_key) as (
  select
    'case_layout_fields',
    layout_fields.section_id::text,
    definitions.field_key
  from public.case_layout_fields layout_fields
  left join public.case_field_definitions definitions
    on definitions.id = layout_fields.field_definition_id
  where definitions.id is null

  union all

  select
    'case_detail_section_fields',
    section_fields.area || ':' || section_fields.section_key,
    section_fields.field_key
  from public.case_detail_section_fields section_fields
  where section_fields.source_type = 'CASE'

  union all

  select
    'case_area_layouts.fields',
    layouts.area,
    field_item ->> 'fieldKey'
  from public.case_area_layouts layouts
  cross join lateral jsonb_array_elements(coalesce(layouts.fields, '[]'::jsonb)) field_item

  union all

  select
    'case_area_layouts.layout_schema',
    layouts.area,
    item ->> 'fieldKey'
  from public.case_area_layouts layouts
  cross join lateral jsonb_array_elements(
    coalesce(layouts.layout_schema -> 'sections', '[]'::jsonb)
  ) section_item
  cross join lateral jsonb_array_elements(
    coalesce(section_item -> 'items', '[]'::jsonb)
  ) item
  where item ->> 'type' = 'FIELD'
    and coalesce(item ->> 'sourceType', 'CASE') = 'CASE'

  union all

  select
    'case_views.visible_fields',
    views.id::text,
    coalesce(aliases.field_key, visible_field)
  from public.case_views views
  cross join lateral jsonb_array_elements_text(views.visible_fields) visible_field
  left join view_field_aliases aliases on aliases.view_key = visible_field
  where views.deleted_at is null
)
select
  referenced.source,
  referenced.owner_key,
  referenced.field_key
from referenced_fields referenced
left join public.case_field_definitions definitions
  on definitions.field_key = referenced.field_key
 and definitions.is_active
where referenced.field_key is null
   or definitions.id is null
order by referenced.source, referenced.owner_key, referenced.field_key;

-- 5. Campos personalizados preservados en case_custom_values.
select
  count(*) filter (where is_active) as custom_active,
  count(*) as custom_total
from public.case_field_definitions
where storage_type = 'CUSTOM_VALUE';
