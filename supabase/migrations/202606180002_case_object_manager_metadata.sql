alter table public.case_field_definitions
  add column if not exists is_standard boolean default false;

alter table public.case_layout_tabs
  add column if not exists is_system boolean default false;

with standard_fields(field_key, label, field_type, description, is_required, picklist_values) as (
  values
    ('subject', 'Asunto', 'text', 'Asunto principal del caso.', true, '[]'::jsonb),
    ('priority', 'Prioridad', 'picklist', 'Prioridad operativa del caso.', false, '["LOW","MEDIUM","HIGH","URGENT"]'::jsonb),
    ('area', 'Área', 'picklist', 'Área responsable o funcional.', false, '["GENERAL","SOPORTE","FACTURACION","OPERACIONES","COMPLIANCE","VENTAS"]'::jsonb),
    ('category', 'Categoría', 'picklist', 'Categoría operacional.', false, '["CONSULTA","ACCESO","INCIDENCIA","PAGO","DOCUMENTACION","FACTURACION","RECLAMO","OTRO"]'::jsonb),
    ('status', 'Estado compatibilidad', 'picklist', 'Estado legacy usado por compatibilidad.', false, '["AI_HANDLING","HUMAN_REQUIRED","ASSIGNED","CLOSED"]'::jsonb),
    ('lifecycle_status', 'Estado del caso', 'picklist', 'Estado operativo del ciclo de vida.', false, '["NEW","IN_PROGRESS","STAND_BY","RESOLVED","CLOSED"]'::jsonb),
    ('routing_status', 'Estado de atención', 'picklist', 'Estado de enrutamiento o atención.', false, '["AI_HANDLING","HUMAN_REQUIRED","ASSIGNED","UNASSIGNED"]'::jsonb),
    ('contact_name', 'Nombre contacto', 'text', 'Nombre del contacto no relacionado.', false, '[]'::jsonb),
    ('contact_email', 'Correo contacto', 'email', 'Correo del contacto no relacionado.', false, '[]'::jsonb),
    ('contact_phone', 'Teléfono contacto', 'phone', 'Teléfono del contacto no relacionado.', false, '[]'::jsonb),
    ('channel', 'Canal', 'picklist', 'Canal principal del caso.', false, '["WHATSAPP","GMAIL","EMAIL","WEB","TICKET"]'::jsonb),
    ('contact_type', 'Tipo de contacto', 'picklist', 'Tipo de origen del contacto.', false, '["WHATSAPP","GMAIL","EMAIL","WEB","CHATBOT","PHONE","MANUAL"]'::jsonb),
    ('assigned_to', 'Propietario', 'text', 'Nombre visible del agente asignado.', false, '[]'::jsonb),
    ('assigned_agent_id', 'Agente asignado', 'text', 'ID del agente asignado.', false, '[]'::jsonb),
    ('case_number', 'Número de caso', 'text', 'Identificador humano del caso.', false, '[]'::jsonb)
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
  picklist_values,
  true,
  now()
from standard_fields
on conflict (field_key) do update
set
  label = excluded.label,
  field_type = excluded.field_type,
  description = excluded.description,
  picklist_values = excluded.picklist_values,
  is_standard = true,
  is_active = true,
  updated_at = now();

insert into public.case_layout_tabs (tab_key, label, sort_order, is_active, is_system)
values
  ('whatsapp', 'WhatsApp', 0, true, true),
  ('ticket', 'Ticket', 10, true, true),
  ('actividad', 'Actividad', 90, true, true),
  ('historial', 'Historial', 100, true, true)
on conflict (tab_key) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_active = true,
  is_system = true;

with ticket_tab as (
  select id from public.case_layout_tabs where tab_key = 'ticket'
)
insert into public.case_layout_sections (tab_id, label, sort_order, is_active)
select id, 'Información general', 10, true from ticket_tab
on conflict (tab_id, label) do update
set sort_order = excluded.sort_order,
    is_active = true;

with ticket_tab as (
  select id from public.case_layout_tabs where tab_key = 'ticket'
)
insert into public.case_layout_sections (tab_id, label, sort_order, is_active)
select id, 'Datos de contacto', 20, true from ticket_tab
on conflict (tab_id, label) do update
set sort_order = excluded.sort_order,
    is_active = true;

with target_sections as (
  select section.id, section.label
  from public.case_layout_sections section
  join public.case_layout_tabs tab on tab.id = section.tab_id
  where tab.tab_key = 'ticket'
    and section.label in ('Información general', 'Datos de contacto')
),
field_order(section_label, field_key, sort_order, column_span, readonly) as (
  values
    ('Información general', 'subject', 10, 2, false),
    ('Información general', 'priority', 20, 1, false),
    ('Información general', 'area', 30, 1, false),
    ('Información general', 'category', 40, 1, false),
    ('Información general', 'lifecycle_status', 50, 1, false),
    ('Información general', 'routing_status', 60, 1, false),
    ('Datos de contacto', 'contact_name', 10, 1, false),
    ('Datos de contacto', 'contact_email', 20, 1, false),
    ('Datos de contacto', 'contact_phone', 30, 1, false),
    ('Datos de contacto', 'channel', 40, 1, false),
    ('Datos de contacto', 'contact_type', 50, 1, false)
)
insert into public.case_layout_fields (
  section_id,
  field_definition_id,
  sort_order,
  column_span,
  is_readonly
)
select
  target_sections.id,
  field_definitions.id,
  field_order.sort_order,
  field_order.column_span,
  field_order.readonly
from field_order
join target_sections on target_sections.label = field_order.section_label
join public.case_field_definitions field_definitions
  on field_definitions.field_key = field_order.field_key
on conflict (section_id, field_definition_id) do update
set
  sort_order = excluded.sort_order,
  column_span = excluded.column_span,
  is_readonly = excluded.is_readonly;
