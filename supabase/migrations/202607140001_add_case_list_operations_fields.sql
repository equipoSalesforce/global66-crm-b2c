alter table public.cases
  add column if not exists product text,
  add column if not exists subproduct text,
  add column if not exists is_edge_case boolean not null default false,
  add column if not exists is_merged boolean not null default false,
  add column if not exists merged_into_case_id uuid references public.cases(id) on delete set null,
  add column if not exists merged_at timestamptz,
  add column if not exists merged_by text;

alter table public.cases
  drop constraint if exists cases_lifecycle_status_check;

alter table public.cases
  add constraint cases_lifecycle_status_check
  check (lifecycle_status in ('NEW', 'IN_PROGRESS', 'STAND_BY', 'RESOLVED', 'CLOSED', 'MERGED'))
  not valid;

create index if not exists cases_is_merged_idx
  on public.cases (is_merged);

create index if not exists cases_merged_into_case_id_idx
  on public.cases (merged_into_case_id);

with operation_fields(field_key, label, field_type, description, is_required, picklist_values, default_value) as (
  values
    ('product', 'Producto', 'picklist', 'Producto asociado al caso.', false, '["Global66","Cuenta","Transferencias","Tarjeta","Remesas"]'::jsonb, null),
    ('subproduct', 'Subproducto', 'picklist', 'Subproducto asociado al caso.', false, '["Carga de dinero","Envío en curso","Retiro","KYC","Soporte General"]'::jsonb, null),
    ('ai_category', 'CAT Extra', 'picklist', 'Categoría extra usada por Vista de Casos.', false, '["Soporte General","Escalado a Tech","Seguimiento para Retención","Valor 129","Valor 157","Valor 164","Valor 171"]'::jsonb, null),
    ('resolution_type', 'Contexto Contención', 'text', 'Contexto de contención usado por Vista de Casos.', false, '[]'::jsonb, null),
    ('is_edge_case', 'Caso Borde', 'boolean', 'Indica si el caso fue marcado como borde.', false, '[]'::jsonb, 'false')
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
  true,
  now()
from operation_fields
on conflict (field_key) do update
set
  label = excluded.label,
  field_type = excluded.field_type,
  description = excluded.description,
  is_active = true,
  picklist_values = excluded.picklist_values,
  default_value = excluded.default_value,
  is_standard = true,
  updated_at = now();

update public.case_field_definitions
set
  picklist_values = (
    select jsonb_agg(distinct value)
    from jsonb_array_elements_text(
      coalesce(public.case_field_definitions.picklist_values, '[]'::jsonb) || '["MERGED"]'::jsonb
    ) as options(value)
  ),
  updated_at = now()
where field_key = 'lifecycle_status';

notify pgrst, 'reload schema';
