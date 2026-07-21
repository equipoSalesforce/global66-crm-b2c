alter table public.cases
  add column if not exists numero_caso_seguimiento text,
  add column if not exists cat_secundaria text,
  add column if not exists description text;

with report_fields(field_key, label, field_type, description, is_required) as (
  values
    ('numero_caso_seguimiento', 'Número Caso Seguimiento', 'text', 'Número de caso usado para seguimiento o referencia relacionada.', false),
    ('cat_secundaria', 'CAT Secundaria', 'text', 'Categoría secundaria del caso. Su dependencia se configurará en una etapa futura.', false),
    ('description', 'Descripción', 'textarea', 'Descripción detallada del caso.', false)
)
insert into public.case_field_definitions (
  field_key,
  label,
  field_type,
  description,
  is_required,
  is_active,
  picklist_values,
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
  '[]'::jsonb,
  true,
  now()
from report_fields
on conflict (field_key) do update
set
  label = excluded.label,
  field_type = excluded.field_type,
  description = excluded.description,
  is_active = true,
  is_standard = true,
  updated_at = now();

notify pgrst, 'reload schema';
