-- Ejecutar después de 202607220005_create_smartsupervision_foundation.sql.
-- Todas las consultas son de solo lectura.

-- A. Debe devolver las cinco tablas requeridas.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'customer_operational_profiles',
    'case_external_references',
    'smartsupervision_complaints',
    'smartsupervision_sync_runs',
    'smartsupervision_case_events'
  )
order by table_name;

-- Seguridad: RLS habilitado en las cinco tablas.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'customer_operational_profiles',
    'case_external_references',
    'smartsupervision_complaints',
    'smartsupervision_sync_runs',
    'smartsupervision_case_events'
  )
order by tablename;

-- Debe devolver cero: no hay policies permisivas para frontend.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'customer_operational_profiles',
    'case_external_references',
    'smartsupervision_complaints',
    'smartsupervision_sync_runs',
    'smartsupervision_case_events'
  );

-- Todas las columnas anon_* y authenticated_* deben ser false.
select
  table_name,
  has_table_privilege('anon', format('public.%I', table_name), 'SELECT') as anon_select,
  has_table_privilege('anon', format('public.%I', table_name), 'INSERT') as anon_insert,
  has_table_privilege('anon', format('public.%I', table_name), 'UPDATE') as anon_update,
  has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE') as authenticated_update
from unnest(array[
  'customer_operational_profiles',
  'case_external_references',
  'smartsupervision_complaints',
  'smartsupervision_sync_runs',
  'smartsupervision_case_events'
]) as integration_tables(table_name)
order by table_name;

-- El cliente interno conserva sólo los permisos usados por los servicios.
select
  table_name,
  has_table_privilege('service_role', format('public.%I', table_name), 'SELECT') as service_select,
  has_table_privilege('service_role', format('public.%I', table_name), 'INSERT') as service_insert,
  has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE') as service_update,
  has_table_privilege('service_role', format('public.%I', table_name), 'DELETE') as service_delete
from unnest(array[
  'customer_operational_profiles',
  'case_external_references',
  'smartsupervision_complaints',
  'smartsupervision_sync_runs',
  'smartsupervision_case_events'
]) as integration_tables(table_name)
order by table_name;

-- B. Checks de estados y tipos de evento.
select
  conrelid::regclass as table_name,
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.smartsupervision_complaints'::regclass,
  'public.smartsupervision_sync_runs'::regclass,
  'public.smartsupervision_case_events'::regclass
)
  and contype = 'c'
order by conrelid::regclass::text, conname;

-- C. Debe devolver el índice único parcial de eventos exitosos.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'smartsupervision_case_events'
  and indexname = 'smartsupervision_case_events_success_key';

-- D. Debe devolver cero: no se agregaron columnas SFC a public.cases.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cases'
  and (
    column_name ~* '__c$'
    or column_name in ('Smart_Code__c', 'punto_recepcion', 'marcacion__c')
  );

-- E. Debe devolver cero duplicados de referencias externas.
select external_source, external_reference, count(*)
from public.case_external_references
group by external_source, external_reference
having count(*) > 1;

-- F/G. Debe devolver 24 campos custom picklist con opciones Salesforce.
select
  field_key,
  label,
  field_type,
  storage_type,
  is_standard,
  jsonb_array_length(picklist_values) as value_count,
  picklist_values
from public.case_field_definitions
where description like '[SmartSupervisión/SFC]%'
order by sort_order, field_key;

-- Debe devolver cero: definiciones SFC sin contrato custom/picklist.
select field_key, field_type, storage_type, is_standard, picklist_values
from public.case_field_definitions
where description like '[SmartSupervisión/SFC]%'
  and (
    field_type <> 'picklist'
    or storage_type <> 'CUSTOM_VALUE'
    or is_standard
    or jsonb_array_length(picklist_values) = 0
  );

-- H. Últimas complaints.
select smart_code, case_id, import_status, ack_status, received_at
from public.smartsupervision_complaints
order by received_at desc
limit 20;

-- I. Últimos eventos.
select case_id, smart_code, event_type, status, sent_at, error_message
from public.smartsupervision_case_events
order by created_at desc
limit 20;

-- J. Reemplazar <CASE_ID> antes de ejecutar.
select
  fields.field_key,
  fields.label,
  fields.field_type,
  fields.picklist_values,
  values.value_text,
  values.value_number,
  values.value_boolean,
  values.value_date,
  values.value_datetime,
  values.value_json
from public.case_custom_values values
join public.case_field_definitions fields
  on fields.id = values.field_definition_id
where values.case_id = '<CASE_ID>'
  and fields.description like '[SmartSupervisión/SFC]%'
order by fields.field_key;
