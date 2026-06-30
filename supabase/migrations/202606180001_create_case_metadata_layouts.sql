create table if not exists public.case_field_definitions (
  id uuid primary key default gen_random_uuid(),
  field_key text unique not null,
  label text not null,
  field_type text not null,
  description text,
  is_required boolean default false,
  is_active boolean default true,
  picklist_values jsonb default '[]'::jsonb,
  default_value text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint case_field_definitions_field_type_check
    check (field_type in (
      'text',
      'textarea',
      'number',
      'currency',
      'date',
      'datetime',
      'boolean',
      'picklist',
      'email',
      'phone',
      'url'
    )),
  constraint case_field_definitions_picklist_values_check
    check (jsonb_typeof(picklist_values) = 'array')
);

create table if not exists public.case_layout_tabs (
  id uuid primary key default gen_random_uuid(),
  tab_key text unique not null,
  label text not null,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.case_layout_sections (
  id uuid primary key default gen_random_uuid(),
  tab_id uuid references public.case_layout_tabs(id) on delete cascade,
  label text not null,
  sort_order int default 0,
  is_active boolean default true,
  constraint case_layout_sections_tab_label_unique unique(tab_id, label)
);

create table if not exists public.case_layout_fields (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references public.case_layout_sections(id) on delete cascade,
  field_definition_id uuid references public.case_field_definitions(id) on delete cascade,
  sort_order int default 0,
  column_span int default 1,
  is_readonly boolean default false,
  constraint case_layout_fields_column_span_check check (column_span in (1, 2)),
  constraint case_layout_fields_section_field_unique unique(section_id, field_definition_id)
);

create table if not exists public.case_custom_values (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  field_definition_id uuid references public.case_field_definitions(id) on delete cascade,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_date date,
  value_datetime timestamptz,
  value_json jsonb,
  updated_at timestamptz default now(),
  unique(case_id, field_definition_id)
);

create index if not exists case_layout_tabs_active_sort_idx
  on public.case_layout_tabs(is_active, sort_order);

create index if not exists case_layout_sections_tab_sort_idx
  on public.case_layout_sections(tab_id, is_active, sort_order);

create index if not exists case_layout_fields_section_sort_idx
  on public.case_layout_fields(section_id, sort_order);

create index if not exists case_custom_values_case_idx
  on public.case_custom_values(case_id);

create or replace function public.set_case_metadata_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_case_field_definitions_updated_at on public.case_field_definitions;
create trigger set_case_field_definitions_updated_at
before update on public.case_field_definitions
for each row execute function public.set_case_metadata_updated_at();

drop trigger if exists set_case_custom_values_updated_at on public.case_custom_values;
create trigger set_case_custom_values_updated_at
before update on public.case_custom_values
for each row execute function public.set_case_metadata_updated_at();

with demo_fields(field_key, label, field_type, description, is_required, picklist_values, default_value) as (
  values
    ('pais_destino', 'País destino', 'picklist', 'País asociado a la operación o reclamo.', false, '["Chile","Perú","Colombia","Argentina","México"]'::jsonb, null),
    ('monto_reclamado', 'Monto reclamado', 'currency', 'Monto informado por el cliente para revisión.', false, '[]'::jsonb, null),
    ('banco_receptor', 'Banco receptor', 'text', 'Banco destino o receptor informado por el cliente.', false, '[]'::jsonb, null),
    ('fecha_operacion', 'Fecha operación', 'date', 'Fecha aproximada de la operación.', false, '[]'::jsonb, null),
    ('requiere_revision_manual', 'Requiere revisión manual', 'boolean', 'Indica si el caso necesita revisión humana adicional.', false, '[]'::jsonb, 'false')
)
insert into public.case_field_definitions (
  field_key,
  label,
  field_type,
  description,
  is_required,
  picklist_values,
  default_value
)
select
  field_key,
  label,
  field_type,
  description,
  is_required,
  picklist_values,
  default_value
from demo_fields
on conflict (field_key) do update
set
  label = excluded.label,
  field_type = excluded.field_type,
  description = excluded.description,
  picklist_values = excluded.picklist_values,
  default_value = excluded.default_value,
  is_active = true,
  updated_at = now();

insert into public.case_layout_tabs (tab_key, label, sort_order, is_active)
values ('datos_adicionales', 'Datos adicionales', 10, true)
on conflict (tab_key) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    is_active = true;

with target_tab as (
  select id from public.case_layout_tabs where tab_key = 'datos_adicionales'
)
insert into public.case_layout_sections (tab_id, label, sort_order, is_active)
select id, 'Información de operación', 10, true
from target_tab
on conflict (tab_id, label) do update
set sort_order = excluded.sort_order,
    is_active = true;

with target_section as (
  select section.id
  from public.case_layout_sections section
  join public.case_layout_tabs tab on tab.id = section.tab_id
  where tab.tab_key = 'datos_adicionales'
    and section.label = 'Información de operación'
),
fields as (
  select id, field_key
  from public.case_field_definitions
  where field_key in (
    'pais_destino',
    'monto_reclamado',
    'banco_receptor',
    'fecha_operacion',
    'requiere_revision_manual'
  )
),
ordered_fields as (
  select id,
    case field_key
      when 'pais_destino' then 10
      when 'monto_reclamado' then 20
      when 'banco_receptor' then 30
      when 'fecha_operacion' then 40
      when 'requiere_revision_manual' then 50
      else 100
    end as sort_order,
    case field_key
      when 'requiere_revision_manual' then 1
      else 1
    end as column_span
  from fields
)
insert into public.case_layout_fields (
  section_id,
  field_definition_id,
  sort_order,
  column_span,
  is_readonly
)
select
  target_section.id,
  ordered_fields.id,
  ordered_fields.sort_order,
  ordered_fields.column_span,
  false
from target_section
cross join ordered_fields
on conflict (section_id, field_definition_id) do update
set sort_order = excluded.sort_order,
    column_span = excluded.column_span;
