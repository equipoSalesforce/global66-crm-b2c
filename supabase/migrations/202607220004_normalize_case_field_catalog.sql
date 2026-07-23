-- Normaliza el catálogo del objeto Caso sin mover ni eliminar datos.

alter table public.case_field_definitions
  add column if not exists storage_type text,
  add column if not exists column_name text,
  add column if not exists is_editable boolean not null default true,
  add column if not exists is_filterable boolean not null default true,
  add column if not exists is_list_visible boolean not null default true,
  add column if not exists is_form_eligible boolean not null default true,
  add column if not exists is_detail_eligible boolean not null default true,
  add column if not exists is_system boolean not null default false,
  add column if not exists sort_order integer not null default 0;

update public.case_field_definitions
set
  storage_type = case
    when is_standard is true and exists (
      select 1
      from information_schema.columns columns
      where columns.table_schema = 'public'
        and columns.table_name = 'cases'
        and columns.column_name = case_field_definitions.field_key
    ) then 'COLUMN'
    when is_standard is true then 'VIRTUAL'
    else 'CUSTOM_VALUE'
  end,
  column_name = case
    when is_standard is true and exists (
      select 1
      from information_schema.columns columns
      where columns.table_schema = 'public'
        and columns.table_name = 'cases'
        and columns.column_name = case_field_definitions.field_key
    ) then field_key
    else null
  end
where storage_type is null
   or (is_standard is true and column_name is null);

update public.case_field_definitions
set
  column_name = null,
  is_editable = false,
  is_list_visible = false,
  is_form_eligible = false,
  is_system = true
where storage_type = 'VIRTUAL';

alter table public.case_field_definitions
  alter column storage_type set default 'CUSTOM_VALUE',
  alter column storage_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_field_definitions_storage_type_check'
      and conrelid = 'public.case_field_definitions'::regclass
  ) then
    alter table public.case_field_definitions
      add constraint case_field_definitions_storage_type_check
      check (storage_type in ('COLUMN', 'CUSTOM_VALUE', 'VIRTUAL'));
  end if;
end
$$;

-- Una clave de columna física no puede apropiarse silenciosamente de valores custom.
-- Si existiera esa colisión, se detiene la migración para resolverla explícitamente
-- sin borrar ni desconectar datos de case_custom_values.
do $$
begin
  if exists (
    select 1
    from public.case_field_definitions definitions
    join public.case_custom_values custom_values
      on custom_values.field_definition_id = definitions.id
    join information_schema.columns columns
      on columns.table_schema = 'public'
     and columns.table_name = 'cases'
     and columns.column_name = definitions.field_key
    where definitions.is_standard is not true
      and definitions.storage_type = 'CUSTOM_VALUE'
  ) then
    raise exception
      'Hay field_key personalizados con valores que colisionan con columnas físicas de public.cases.';
  end if;
end
$$;

with standard_fields(
  field_key, label, field_type, description, is_required, picklist_values,
  is_editable, is_filterable, is_list_visible, is_form_eligible,
  is_detail_eligible, is_system, sort_order
) as (
  values
    ('id', 'ID interno', 'text', 'UUID interno del caso.', true, '[]'::jsonb, false, true, false, false, false, true, 10),
    ('customer_id', 'Cliente', 'text', 'Referencia interna al cliente.', false, '[]'::jsonb, false, true, false, false, true, true, 20),
    ('case_number', 'Número Caso', 'text', 'Identificador visible del caso.', false, '[]'::jsonb, false, true, true, false, true, true, 30),
    ('subject', 'Asunto', 'text', 'Asunto principal del caso.', true, '[]'::jsonb, true, true, true, true, true, false, 40),
    ('description', 'Descripción', 'textarea', 'Descripción detallada del caso.', false, '[]'::jsonb, true, false, false, true, true, false, 50),
    ('status', 'Estado', 'picklist', 'Estado de compatibilidad del caso.', false, '["AI_HANDLING","HUMAN_REQUIRED","ASSIGNED","CLOSED"]'::jsonb, true, true, true, true, true, false, 60),
    ('lifecycle_status', 'Etapa', 'picklist', 'Etapa del ciclo de vida.', false, '["NEW","IN_PROGRESS","STAND_BY","RESOLVED","CLOSED","MERGED"]'::jsonb, true, true, true, true, true, false, 70),
    ('routing_status', 'Estado de asignación', 'picklist', 'Estado de enrutamiento o asignación.', false, '["AI_HANDLING","HUMAN_REQUIRED","ASSIGNED","UNASSIGNED"]'::jsonb, true, true, true, true, true, false, 80),
    ('priority', 'Prioridad', 'picklist', 'Prioridad operativa.', false, '["LOW","MEDIUM","HIGH","URGENT"]'::jsonb, true, true, true, true, true, false, 90),
    ('channel', 'Canal', 'picklist', 'Canal principal del caso.', false, '["WHATSAPP","GMAIL","WEB","MANUAL"]'::jsonb, false, true, true, false, true, false, 100),
    ('contact_type', 'Tipo de contacto', 'picklist', 'Tipo de contacto del caso.', false, '["WHATSAPP","GMAIL","WEB","MANUAL"]'::jsonb, true, true, true, true, true, false, 110),
    ('category', 'Categoría', 'picklist', 'Categoría principal.', false, '["CONSULTA","ACCESO","INCIDENCIA","PAGO","DOCUMENTACION","FACTURACION","RECLAMO","OTRO"]'::jsonb, true, true, true, true, true, false, 120),
    ('area', 'Área', 'picklist', 'Área responsable.', false, '["GENERAL","SOPORTE","FACTURACION","OPERACIONES","COMPLIANCE","VENTAS"]'::jsonb, true, true, true, true, true, false, 130),
    ('product', 'Producto', 'text', 'Producto asociado al caso.', false, '[]'::jsonb, true, true, true, true, true, false, 140),
    ('subproduct', 'Subproducto', 'text', 'Subproducto asociado al caso.', false, '[]'::jsonb, true, true, true, true, true, false, 150),
    ('contact_name', 'Nombre contacto', 'text', 'Nombre del contacto.', false, '[]'::jsonb, true, true, true, true, true, false, 160),
    ('contact_email', 'Correo', 'email', 'Correo del contacto.', false, '[]'::jsonb, true, true, true, true, true, false, 170),
    ('contact_phone', 'Teléfono', 'phone', 'Teléfono del contacto.', false, '[]'::jsonb, true, true, true, true, true, false, 180),
    ('response_status', 'Respuesta', 'picklist', 'Estado calculado de respuesta.', false, '["NO_AGENT_ACTIVITY","NO_CUSTOMER_ACTIVITY_24H","WAITING_AGENT_RESPONSE","UP_TO_DATE"]'::jsonb, false, true, true, false, true, true, 190),
    ('owner_type', 'Tipo de propietario', 'picklist', 'Tipo de owner del caso.', false, '["USER","QUEUE"]'::jsonb, false, true, false, false, true, true, 200),
    ('assigned_agent_id', 'Owner', 'text', 'Referencia al ejecutivo asignado.', false, '[]'::jsonb, false, true, true, false, true, true, 210),
    ('assigned_queue_id', 'Cola', 'text', 'Referencia a la cola asignada.', false, '[]'::jsonb, false, true, true, false, true, true, 220),
    ('assigned_to', 'Asignado a', 'text', 'Nombre visible del propietario.', false, '[]'::jsonb, false, true, true, false, true, true, 230),
    ('assigned_at', 'Fecha asignación', 'datetime', 'Fecha de asignación.', false, '[]'::jsonb, false, true, false, false, true, true, 240),
    ('first_response_at', 'Primera respuesta', 'datetime', 'Fecha de primera respuesta.', false, '[]'::jsonb, false, true, false, false, true, true, 250),
    ('created_at', 'Fecha creación', 'datetime', 'Fecha de creación.', false, '[]'::jsonb, false, true, true, false, true, true, 260),
    ('updated_at', 'Última modificación', 'datetime', 'Fecha de última modificación.', false, '[]'::jsonb, false, true, true, false, true, true, 270),
    ('closed_at', 'Fecha cierre', 'datetime', 'Fecha de cierre.', false, '[]'::jsonb, false, true, true, false, true, true, 280),
    ('email_thread_id', 'ID hilo correo', 'text', 'Identificador del hilo de correo.', false, '[]'::jsonb, false, true, false, false, false, true, 290),
    ('last_email_message_id', 'Último mensaje correo', 'text', 'Último mensaje del hilo de correo.', false, '[]'::jsonb, false, true, false, false, false, true, 300),
    ('numero_caso_seguimiento', 'Número Caso Seguimiento', 'text', 'Referencia de seguimiento.', false, '[]'::jsonb, true, true, true, true, true, false, 310),
    ('cat_secundaria', 'CAT Secundaria', 'text', 'Categoría secundaria.', false, '[]'::jsonb, true, true, true, true, true, false, 320),
    ('is_edge_case', 'Caso Borde', 'boolean', 'Indica si el caso es borde.', false, '[]'::jsonb, true, true, true, true, true, false, 330),
    ('is_merged', 'Caso fusionado', 'boolean', 'Indica si el caso fue fusionado.', false, '[]'::jsonb, false, true, false, false, true, true, 340),
    ('merged_into_case_id', 'Fusionado en caso', 'text', 'Referencia al caso destino de la fusión.', false, '[]'::jsonb, false, true, false, false, true, true, 350),
    ('merged_at', 'Fecha fusión', 'datetime', 'Fecha de fusión.', false, '[]'::jsonb, false, true, false, false, true, true, 360),
    ('merged_by', 'Fusionado por', 'text', 'Usuario que realizó la fusión.', false, '[]'::jsonb, false, true, false, false, true, true, 370),
    ('duplicated_from_case_id', 'Duplicado desde caso', 'text', 'Referencia al caso de origen.', false, '[]'::jsonb, false, true, false, false, true, true, 380),
    ('ai_category', 'CAT Extra', 'text', 'Categoría adicional sugerida o administrada.', false, '[]'::jsonb, true, true, true, true, true, false, 390),
    ('resolution_type', 'Contexto Contención', 'text', 'Tipo o contexto de resolución.', false, '[]'::jsonb, false, true, true, false, true, true, 400)
)
insert into public.case_field_definitions (
  field_key, label, field_type, description, is_required, is_active,
  picklist_values, is_standard, storage_type, column_name, is_editable,
  is_filterable, is_list_visible, is_form_eligible, is_detail_eligible,
  is_system, sort_order, updated_at
)
select
  field_key, label, field_type, description, is_required, true,
  picklist_values, true, 'COLUMN', field_key, is_editable,
  is_filterable, is_list_visible, is_form_eligible, is_detail_eligible,
  is_system, sort_order, now()
from standard_fields
where exists (
  select 1
  from information_schema.columns columns
  where columns.table_schema = 'public'
    and columns.table_name = 'cases'
    and columns.column_name = standard_fields.field_key
)
on conflict (field_key) do update
set
  label = case
    when nullif(btrim(public.case_field_definitions.label), '') is null then excluded.label
    else public.case_field_definitions.label
  end,
  field_type = excluded.field_type,
  description = coalesce(nullif(public.case_field_definitions.description, ''), excluded.description),
  is_required = coalesce(public.case_field_definitions.is_required, excluded.is_required),
  is_active = true,
  picklist_values = case
    when jsonb_array_length(excluded.picklist_values) > 0 then excluded.picklist_values
    else coalesce(public.case_field_definitions.picklist_values, '[]'::jsonb)
  end,
  is_standard = true,
  storage_type = 'COLUMN',
  column_name = excluded.column_name,
  is_editable = excluded.is_editable,
  is_filterable = excluded.is_filterable,
  is_list_visible = excluded.is_list_visible,
  is_form_eligible = excluded.is_form_eligible,
  is_detail_eligible = excluded.is_detail_eligible,
  is_system = excluded.is_system,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Cualquier otra columna física queda registrada de forma conservadora como sistema/solo lectura.
insert into public.case_field_definitions (
  field_key, label, field_type, description, is_required, is_active,
  picklist_values, is_standard, storage_type, column_name, is_editable,
  is_filterable, is_list_visible, is_form_eligible, is_detail_eligible,
  is_system, sort_order, updated_at
)
select
  columns.column_name,
  initcap(replace(columns.column_name, '_', ' ')),
  case
    when columns.data_type = 'boolean' then 'boolean'
    when columns.data_type in ('timestamp with time zone', 'timestamp without time zone') then 'datetime'
    when columns.data_type in ('smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision') then 'number'
    else 'text'
  end,
  'Columna física de public.cases registrada automáticamente.',
  columns.is_nullable = 'NO' and columns.column_default is null,
  true,
  '[]'::jsonb,
  true,
  'COLUMN',
  columns.column_name,
  false,
  true,
  false,
  false,
  false,
  true,
  1000 + columns.ordinal_position,
  now()
from information_schema.columns columns
where columns.table_schema = 'public'
  and columns.table_name = 'cases'
  and not exists (
    select 1
    from public.case_field_definitions definitions
    where definitions.field_key = columns.column_name
  );

-- Los campos no estándar existentes continúan guardándose en case_custom_values.
update public.case_field_definitions
set
  storage_type = 'CUSTOM_VALUE',
  column_name = null,
  is_editable = true,
  is_system = false
where is_standard is not true
  and storage_type = 'CUSTOM_VALUE';

create index if not exists case_field_definitions_catalog_idx
  on public.case_field_definitions (is_active, storage_type, sort_order, field_key);

notify pgrst, 'reload schema';
