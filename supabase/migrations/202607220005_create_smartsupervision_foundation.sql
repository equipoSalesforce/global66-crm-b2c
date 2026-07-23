-- Base operacional incremental para SmartSupervisión/SFC.
-- No crea vistas, reportes ni columnas SFC en public.cases.

create extension if not exists pgcrypto;

create table if not exists public.smartsupervision_sync_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null default 'MOMENTO_1_DAILY',
  status text not null default 'RUNNING',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_received integer not null default 0,
  total_imported integer not null default 0,
  total_acknowledged integer not null default 0,
  total_errors integer not null default 0,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  constraint smartsupervision_sync_runs_type_check
    check (run_type in ('MOMENTO_1_DAILY', 'MANUAL_TEST')),
  constraint smartsupervision_sync_runs_status_check
    check (status in ('RUNNING', 'SUCCESS', 'ERROR', 'PARTIAL_SUCCESS'))
);

create table if not exists public.customer_operational_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers(id),
  redshift_customer_id text,
  country text,
  country_code text,
  document_type text,
  document_number text,
  customer_type text,
  segment text,
  plan text,
  compliance_status text,
  risk_level text,
  source text not null default 'REDSHIFT',
  source_payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_external_references (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id),
  external_source text not null,
  external_reference text not null,
  external_system_id text,
  external_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_external_references_source_reference_key
    unique (external_source, external_reference)
);

create table if not exists public.smartsupervision_complaints (
  id uuid primary key default gen_random_uuid(),
  smart_code text not null unique,
  case_id uuid references public.cases(id),
  sync_run_id uuid references public.smartsupervision_sync_runs(id),
  source_payload jsonb not null,
  import_status text not null default 'PENDING',
  import_error text,
  ack_status text not null default 'PENDING',
  ack_error text,
  received_at timestamptz not null default now(),
  imported_at timestamptz,
  acked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smartsupervision_complaints_import_status_check
    check (import_status in ('PENDING', 'IMPORTED', 'ERROR', 'SKIPPED')),
  constraint smartsupervision_complaints_ack_status_check
    check (ack_status in ('PENDING', 'ACKED', 'ERROR', 'NOT_REQUIRED'))
);

create table if not exists public.smartsupervision_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id),
  smart_code text not null,
  event_type text not null,
  status text not null default 'PENDING',
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  triggered_by text,
  triggered_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smartsupervision_case_events_type_check
    check (event_type in ('MOMENTO_1_IMPORT', 'MOMENTO_1_ACK', 'MOMENTO_2_SENT', 'MOMENTO_3_SENT')),
  constraint smartsupervision_case_events_status_check
    check (status in ('PENDING', 'SUCCESS', 'ERROR', 'SKIPPED'))
);

create index if not exists customer_operational_profiles_customer_idx
  on public.customer_operational_profiles (customer_id);
create index if not exists customer_operational_profiles_redshift_idx
  on public.customer_operational_profiles (redshift_customer_id);
create index if not exists customer_operational_profiles_country_idx
  on public.customer_operational_profiles (country_code);
create index if not exists customer_operational_profiles_document_idx
  on public.customer_operational_profiles (document_number);

create index if not exists case_external_references_case_idx
  on public.case_external_references (case_id);
create index if not exists case_external_references_source_idx
  on public.case_external_references (external_source);
create index if not exists case_external_references_reference_idx
  on public.case_external_references (external_reference);

create index if not exists smartsupervision_complaints_case_idx
  on public.smartsupervision_complaints (case_id);
create index if not exists smartsupervision_complaints_import_idx
  on public.smartsupervision_complaints (import_status);
create index if not exists smartsupervision_complaints_ack_idx
  on public.smartsupervision_complaints (ack_status);
create index if not exists smartsupervision_complaints_received_idx
  on public.smartsupervision_complaints (received_at desc);

create index if not exists smartsupervision_case_events_case_idx
  on public.smartsupervision_case_events (case_id);
create index if not exists smartsupervision_case_events_smart_code_idx
  on public.smartsupervision_case_events (smart_code);
create index if not exists smartsupervision_case_events_type_idx
  on public.smartsupervision_case_events (event_type);
create index if not exists smartsupervision_case_events_status_idx
  on public.smartsupervision_case_events (status);
create index if not exists smartsupervision_case_events_sent_idx
  on public.smartsupervision_case_events (sent_at desc);
create unique index if not exists smartsupervision_case_events_success_key
  on public.smartsupervision_case_events (case_id, event_type)
  where status = 'SUCCESS';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.case_custom_values'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (case_id, field_definition_id)'
  ) then
    alter table public.case_custom_values
      add constraint case_custom_values_case_field_key
      unique (case_id, field_definition_id);
  end if;
end
$$;

drop trigger if exists customer_operational_profiles_touch_updated_at
  on public.customer_operational_profiles;
create trigger customer_operational_profiles_touch_updated_at
before update on public.customer_operational_profiles
for each row execute function public.set_case_metadata_updated_at();

drop trigger if exists case_external_references_touch_updated_at
  on public.case_external_references;
create trigger case_external_references_touch_updated_at
before update on public.case_external_references
for each row execute function public.set_case_metadata_updated_at();

drop trigger if exists smartsupervision_complaints_touch_updated_at
  on public.smartsupervision_complaints;
create trigger smartsupervision_complaints_touch_updated_at
before update on public.smartsupervision_complaints
for each row execute function public.set_case_metadata_updated_at();

drop trigger if exists smartsupervision_case_events_touch_updated_at
  on public.smartsupervision_case_events;
create trigger smartsupervision_case_events_touch_updated_at
before update on public.smartsupervision_case_events
for each row execute function public.set_case_metadata_updated_at();

-- Catálogo derivado de docs/smartsupervision/equivalencias_codigos.csv.
-- Las opciones son Equivalencia de Valores SF, nunca los códigos SFC.
-- sc_genero__c y SC_id_type__c son Account y se guardan en el perfil operacional.
-- Status se resuelve contra el ciclo CRM; ol__ queda pendiente por clave ambigua.
do $$
begin
  if exists (
    select 1
    from public.case_field_definitions
    where field_key in (
      'tipo_de_persona__c', 'sc_LGBTIQ__c', 'sc_Condicion_especial__c',
      'canal__c', 'Product__c', 'Categorias_COL__c', 'Ente_de_control__c',
      'Instancia_de_recepcion__c', 'admision_col__c', 'Producto_digital__c',
      'Favorabilidad__c', 'Aceptacion__c', 'Rectificacion__c',
      'Desistimiento__c', 'Prorroga__c', 'Tutela__c', 'Quejas_express__c',
      'Tipo_Fraude__c', 'Modalidad_Fraude__c', 'Country__c',
      'punto_recepcion', 'marcacion__c', 'replica__c',
      'smart_escalamiento_DCF__c'
    )
      and is_standard is true
  ) then
    raise exception 'Un campo SFC custom colisiona con un campo CASE estándar.';
  end if;
end
$$;

with sfc_fields(field_key, label, picklist_values, sort_order) as (
  values
    ('tipo_de_persona__c', 'Tipo de persona', '["B2C","B2B"]'::jsonb, 2010),
    ('sc_LGBTIQ__c', 'Identidad LGBTIQ+', '["Si","No"]'::jsonb, 2020),
    ('sc_Condicion_especial__c', 'Condición especial', '["Adulto mayor","Pensionado","Receptor de subsidio","Discapacidad auditiva","Discapacidad física","Menor de edad","Indígena","Mujer embarazada","Reinsertado","Víctima del conflicto armado","Afrocolombiano","Desplazado","Madre cabeza de familia","Sordomudo","Discapacidad cognitiva","Discapacidad visual","Periodista","Otra","No aplica"]'::jsonb, 2030),
    ('canal__c', 'Canal de atención por donde se subió la queja', '["Aplicaciones móviles","Cajeros automáticos administrados","Cajeros automáticos no propios","Cajeros automáticos propios","Centro de atención telefónica (Call center/Contac center)","Asistente virtual","Corresponsales digitales propios","Corresponsales digitales tercerizados","Corresponsales físicos propios","Corresponsales físicos tercerizados","Corresponsales móviles propios","Corresponsales móviles tercerizados","Internet","Oficinas","POS administrados","POS no propios","POS propios","Sistema de acceso remoto para clientes (RAS)","Sistema de Audio Respuesta (IVR)"]'::jsonb, 2040),
    ('Product__c', 'Código del producto', '["Cuenta perfil","Wallet","Exchange","Transactions","P2P","Tarjeta Digital","Tarjeta Fisica","Otro"]'::jsonb, 2050),
    ('Categorias_COL__c', 'Código del motivo', '["Publicidad engañosa","Dificultad en el acceso a la información","Información o asesoría incompleta y/o errada","Información inoportuna","Dificultad en la comunicación con la entidad","Mal trato por parte de un funcionario","Mal trato por parte del asesor comercial o proveedor","Presunta actuación fraudulenta o no ética del personal","Incumplimiento de los términos del contrato","Eliminada","Cotización errada","Demora o no entrega de la cotización y/o simulación","Demora o no entrega del contrato o de la póliza","Error o falta de claridad en las cláusulas del contrato o de la póliza","Diferencia del producto expedido con el solicitado o cotizado o simulado","Vinculación no autorizada","Condicionamiento a la adquisición de productos o servicios","No cancelación o terminación de los productos","Fallas en débito automático","No entrega de paz y salvo","Demora o no devolución de saldos, aportes o primas","Presuntos timbres, sellos, adhesivos o billetes y/o monedas falsos","Negación injustificada a la apertura del producto","Negación a la apertura de productos por condiciones de segmentos particulares de la población","No recepción de billetes y/o monedas","No disponibilidad o fallas de los canales de atención","Obstáculo para la interposición de quejas, reclamos o peticiones","Demora en la respuesta a quejas, reclamos o peticiones","Errores en la resolución de quejas, reclamos o peticiones.","No resolución a quejas, peticiones y reclamos","Reporte injustificado a centrales de riesgo","No levantamiento de reporte negativo a centrales de riesgo","Demora o no modificación de datos personales","Actualización equivocada de datos personales","Inadecuado tratamiento de datos personales","Información incompleta y/o errada en la ejecución","No aplicación de los protocolos especiales de atención","Inconsistencias en los pagos a terceros","Transacción mal aplicada","Transacción no reconocida","Cobro por transacciones en internet","Demora o no aplicación del pago","Error en la aplicación del pago","Inconformidad por cobros de terceros","Dificultad o imposibilidad para realizar transacciones o consulta de información por el canal","Demora en la atención o en el servicio requerido","Seguridad en canales","Omisión o envío tardío o inoportuno de informes, extractos o reportes a los que esté obligada la entidad.","Errores en el contenido de la información en informes, extractos o reportes.","Limitación en la expedición de certificaciones","Inconformidad en procesos - Constitución, Modificación y Levantamiento -  de garantía","Producto terminado o cancelado sin justificación","Inconformidad por bloqueo de productos","Incrementos de tarifas no pactadas o informadas","Error en la facturación o cobro no pactado","Modificación de condiciones en contratos","Inconsistencia en el cobro de comisiones - Descuentos injustificados","Inconsistencia en el cobro de gastos","Inconsistencia en el cálculo y/o aplicación de impuestos","Inoportunidad en la aplicación o cobro de comisiones o gastos bancarios","Inconsistencias en el movimiento y saldo total del producto","Inconformidad con procesos internos de conocimiento del cliente y SARLAFT","Fallas o inoportunidad en el proceso de vinculación","Información sujeta a reserva","Indebido deber de asesoría","Fallas en operaciones en moneda extranjera","Diferencias en monetización","Distribución de portafolio","Remesas"]'::jsonb, 2060),
    ('Ente_de_control__c', 'Ente de control', '["Procuraduría","Contraloría","Defensoría del pueblo","Personerías","Otros"]'::jsonb, 2070),
    ('Instancia_de_recepcion__c', 'Instancia de recepción', '["Superintendencia Financiera de Colombia","Entidad vigilada","Defensor del consumidor financiero","Otra (remisión por competencia)"]'::jsonb, 2080),
    ('admision_col__c', 'Admisión / Estado admisión', '["Queja o reclamo inadmitida y/o rechazada por el DCF","Queja o reclamo admitida por el DCF","No Aplica"]'::jsonb, 2090),
    ('Producto_digital__c', 'Indica si es producto digital', '["Si","No"]'::jsonb, 2100),
    ('Favorabilidad__c', 'Sentido de la decisión', '["Favorable","Parcialmente favrable","No favorable"]'::jsonb, 2110),
    ('Aceptacion__c', 'Aceptación por la entidad', '["Respuesta final a favor del consumidor financiero aceptadas por la entidad","Respuesta final a favor del consumidor financiero no aceptadas por la entidad"]'::jsonb, 2120),
    ('Rectificacion__c', 'Rectificación de información', '["Queja o reclamo rectificada por la entidad vigilada antes de la decisión del DCF","Queja o reclamo no rectificada por la entidad vigilada antes de la decisión del DCF","Queja o reclamo rectificada por la entidad vigilada después de la decisión del DCF","Queja o reclamo no rectificada por la entidad vigilada después de la decisión del DCF"]'::jsonb, 2130),
    ('Desistimiento__c', 'Desistimiento del consumidor', '["Queja o reclamo desistida por el CF","Queja o reclamo no desistida por el CF"]'::jsonb, 2140),
    ('Prorroga__c', 'Uso de prórroga', '["Si"]'::jsonb, 2150),
    ('Tutela__c', 'Relación con tutela', '["Si","No"]'::jsonb, 2160),
    ('Quejas_express__c', 'Marca queja exprés', '["Si","No"]'::jsonb, 2170),
    ('Tipo_Fraude__c', 'Clasificación del fraude', '["Interno","Externo"]'::jsonb, 2180),
    ('Modalidad_Fraude__c', 'Modalidad detectada', '["Suplantación de identidad","Sim Swapping","Vulneración de cuenta o producto","Phishing","Vishing","Smishing","Pharming","Enumeración","Malware","Skimming","Ataque BIN","Fraude amigable","Cambiazo","Falsificación","Pérdida de elementos (como Tarjetas, chequeras, tokens)","Suplantación de elementos suministrados por la entidad (como QRs de pagos, corresponsales, datafonos)","Estafa","Errores operativos de la entidad que hayan propiciado o facilitado el fraude","Otras técnicas de ingeniería social","Otras"]'::jsonb, 2190),
    ('Country__c', 'Código de país', '["Colombia"]'::jsonb, 2200),
    ('punto_recepcion', 'Punto de recepción de queja', '["Web","WhatsApp","Email","Activate B2C","Form: Change Data","UpdateCOM"]'::jsonb, 2210),
    ('marcacion__c', 'Marcaciones adicionales', '["1","2","3","4","5","6","7","8","9"]'::jsonb, 2220),
    ('replica__c', 'Hubo replica', '["Si","No"]'::jsonb, 2230),
    ('smart_escalamiento_DCF__c', 'Indica si hubo escalamiento con la DCF', '["Si","No"]'::jsonb, 2240)
)
insert into public.case_field_definitions (
  field_key, label, field_type, description, is_required, is_active,
  picklist_values, is_standard, storage_type, column_name, is_editable,
  is_filterable, is_list_visible, is_form_eligible, is_detail_eligible,
  is_system, sort_order, updated_at
)
select
  field_key, label, 'picklist', '[SmartSupervisión/SFC] ' || label, false, true,
  picklist_values, false, 'CUSTOM_VALUE', null, true,
  true, true, true, true, false, sort_order, now()
from sfc_fields
on conflict (field_key) do update
set
  label = case
    when nullif(btrim(public.case_field_definitions.label), '') is null then excluded.label
    else public.case_field_definitions.label
  end,
  field_type = 'picklist',
  description = excluded.description,
  is_active = true,
  picklist_values = excluded.picklist_values,
  is_standard = false,
  storage_type = 'CUSTOM_VALUE',
  column_name = null,
  is_editable = true,
  is_filterable = true,
  is_list_visible = true,
  is_form_eligible = true,
  is_detail_eligible = true,
  is_system = false,
  sort_order = excluded.sort_order,
  updated_at = now()
where public.case_field_definitions.is_standard is not true;

alter table public.customer_operational_profiles enable row level security;
alter table public.case_external_references enable row level security;
alter table public.smartsupervision_complaints enable row level security;
alter table public.smartsupervision_sync_runs enable row level security;
alter table public.smartsupervision_case_events enable row level security;

drop policy if exists customer_operational_profiles_demo_all
  on public.customer_operational_profiles;
drop policy if exists case_external_references_demo_all
  on public.case_external_references;
drop policy if exists smartsupervision_complaints_demo_all
  on public.smartsupervision_complaints;
drop policy if exists smartsupervision_sync_runs_demo_all
  on public.smartsupervision_sync_runs;
drop policy if exists smartsupervision_case_events_demo_all
  on public.smartsupervision_case_events;

revoke all on public.customer_operational_profiles from public, anon, authenticated;
revoke all on public.case_external_references from public, anon, authenticated;
revoke all on public.smartsupervision_complaints from public, anon, authenticated;
revoke all on public.smartsupervision_sync_runs from public, anon, authenticated;
revoke all on public.smartsupervision_case_events from public, anon, authenticated;

grant select, insert, update on public.customer_operational_profiles to service_role;
grant select, insert, update on public.case_external_references to service_role;
grant select, insert, update on public.smartsupervision_complaints to service_role;
grant select, insert, update on public.smartsupervision_sync_runs to service_role;
grant select, insert, update on public.smartsupervision_case_events to service_role;

notify pgrst, 'reload schema';
