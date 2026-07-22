-- ============================================================================
-- DEMO DATA ONLY
-- Ejecutar sólo en local/dev/ci.
-- No ejecutar en producción.
-- Idempotente: puede correrse varias veces sin duplicar datos.
-- No sobrescribe valores reales existentes.
-- ============================================================================
--
-- Objetivo
-- --------
-- Enriquecer clientes existentes y crear un conjunto pequeño de casos,
-- conversaciones, CSAT y valores de Form que permitan validar el detalle del
-- caso. Los registros generados se identifican con DEMO_SEED en description,
-- source o external_message_id.
--
-- Cómo ejecutar
-- -------------
-- 1. Abrir Supabase SQL Editor.
-- 2. Confirmar que el proyecto corresponde a local/dev/ci.
-- 3. Ejecutar el archivo completo.
-- 4. Refrescar el CRM.
-- 5. Probar /casos/{id} y
--    /configuracion/objetos/caso?tab=layout-detalle.
--
-- Notas del esquema inspeccionado
-- ------------------------------
-- - customers garantiza id, customer_id, public_id, name, email y phone.
-- - country, customer_type, segmentation/segment, compliance_status,
--   paid_plan, account_manager, geolocation y document_number no son creados
--   por las migraciones actuales. Se completan sólo si ya existen como
--   columnas de texto; este seed nunca crea columnas.
-- - El perfil operacional ampliado prioriza Account 360 mediante
--   getCustomerProfileForCase(). Para identidades demo, la aplicación completa
--   lo faltante con el generador determinístico de demo-customer-profile.
-- - messages usa INBOUND/OUTBOUND y CUSTOMER/AGENT, tal como los servicios y
--   seeds actuales. case_csat tiene unique(case_id) y scores entre 1 y 5.

begin;

do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'customers',
    'cases',
    'messages',
    'case_csat',
    'crm_users',
    'crm_queues',
    'case_custom_values',
    'case_field_definitions'
  ]
  loop
    if to_regclass(format('public.%I', required_table)) is null then
      raise exception 'Falta la tabla requerida public.%', required_table;
    end if;
  end loop;
end
$$;

create temp table demo_customer_enrichment on commit drop as
with ranked_customers as (
  select
    customer.id,
    (row_number() over (order by customer.created_at nulls last, customer.id))::integer as demo_index
  from public.customers customer
)
select
  ranked.id,
  ranked.demo_index,
  (array[
    'Antonia Demo',
    'Matías Demo',
    'Valentina Demo',
    'Benjamín Demo',
    'Camila Demo',
    'Diego Demo',
    'Francisca Demo',
    'Joaquín Demo',
    'Catalina Demo',
    'Nicolás Demo'
  ])[((ranked.demo_index - 1) % 10) + 1] as demo_name,
  'demo.' || substr(md5(ranked.id::text), 1, 12) || '@global66.test' as demo_email,
  (array['Chile', 'Colombia', 'Perú', 'Argentina', 'México'])[
    ((ranked.demo_index - 1) % 5) + 1
  ] as country,
  (array['B2C', 'B2B', 'B2X'])[((ranked.demo_index - 1) % 3) + 1] as customer_type,
  (array['Masivo', 'High', 'Ultra High', 'Empresas', 'Premium'])[
    ((ranked.demo_index - 1) % 5) + 1
  ] as segmentation,
  (array['NORMAL', 'NORMAL', 'REVIEW', 'NORMAL', 'BLOCKED'])[
    ((ranked.demo_index - 1) % 5) + 1
  ] as compliance_status,
  (array['Start', 'Pro', 'Ultra', 'None'])[((ranked.demo_index - 1) % 4) + 1] as paid_plan,
  (array['Equipo CX Demo', 'Mesa Operaciones Demo', 'Equipo Compliance Demo'])[
    ((ranked.demo_index - 1) % 3) + 1
  ] as account_manager,
  (array['Santiago', 'Bogotá', 'Lima', 'Buenos Aires', 'Ciudad de México'])[
    ((ranked.demo_index - 1) % 5) + 1
  ] as geolocation,
  'DEMO-DOC-' || upper(substr(md5(ranked.id::text), 1, 10)) as document_number,
  case ((ranked.demo_index - 1) % 5)
    when 0 then '+569' || lpad((81000000 + ranked.demo_index)::text, 8, '0')
    when 1 then '+573' || lpad((100000000 + ranked.demo_index)::text, 9, '0')
    when 2 then '+519' || lpad((10000000 + ranked.demo_index)::text, 8, '0')
    when 3 then '+54911' || lpad((10000000 + ranked.demo_index)::text, 8, '0')
    else '+52155' || lpad((10000000 + ranked.demo_index)::text, 8, '0')
  end as demo_phone
from ranked_customers ranked;

-- Sólo completa identidad básica ausente o placeholders inequívocos.
update public.customers customer
set name = demo.demo_name
from demo_customer_enrichment demo
where customer.id = demo.id
  and (
    customer.name is null
    or btrim(customer.name) = ''
    or lower(btrim(customer.name)) in ('cliente', 'cliente demo', 'demo', 'sin nombre', 'n/a')
  );

update public.customers customer
set email = demo.demo_email
from demo_customer_enrichment demo
where customer.id = demo.id
  and nullif(btrim(customer.email), '') is null;

update public.customers customer
set phone = demo.demo_phone
from demo_customer_enrichment demo
where customer.id = demo.id
  and nullif(btrim(customer.phone), '') is null;

update public.customers customer
set customer_id = 'DEMO-CUSTOMER-' || upper(substr(md5(customer.id::text), 1, 16))
where nullif(btrim(customer.customer_id), '') is null;

update public.customers customer
set public_id = 'cus_' || upper(substr(md5('crm-public:' || customer.id::text), 1, 20))
where nullif(btrim(customer.public_id), '') is null;

-- Completa atributos opcionales sólo si la columna ya existe y es textual.
-- No crea ni modifica el esquema de customers.
do $$
declare
  target_column text;
  demo_column text;
begin
  for target_column, demo_column in
    select *
    from (values
      ('country', 'country'),
      ('customer_type', 'customer_type'),
      ('segmentation', 'segmentation'),
      ('segment', 'segmentation'),
      ('compliance_status', 'compliance_status'),
      ('paid_plan', 'paid_plan'),
      ('account_manager', 'account_manager'),
      ('geolocation', 'geolocation'),
      ('document_number', 'document_number')
    ) as optional_columns(target_column, demo_column)
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'customers'
        and column_name = target_column
        and data_type in ('text', 'character varying', 'character')
    ) then
      execute format(
        'update public.customers customer
         set %1$I = demo.%2$I
         from demo_customer_enrichment demo
         where customer.id = demo.id
           and nullif(btrim(customer.%1$I::text), '''') is null',
        target_column,
        demo_column
      );
    end if;
  end loop;
end
$$;

-- Determina qué clientes necesitan casos para llegar a un mínimo de dos.
create temp table demo_cases_to_insert on commit drop as
with customer_case_counts as (
  select
    demo.id as customer_id,
    demo.demo_index,
    demo.demo_name,
    demo.demo_email,
    demo.demo_phone,
    count(case_item.id)::integer as existing_case_count
  from demo_customer_enrichment demo
  left join public.cases case_item on case_item.customer_id = demo.id
  group by demo.id, demo.demo_index, demo.demo_name, demo.demo_email, demo.demo_phone
), available_slots as (
  select
    counts.*,
    slot,
    (row_number() over (partition by counts.customer_id order by slot))::integer as missing_position
  from customer_case_counts counts
  cross join generate_series(1, 2) slot
  where not exists (
    select 1
    from public.cases existing_demo
    where existing_demo.customer_id = counts.customer_id
      and existing_demo.description like
        'DEMO_SEED:customer=' || counts.customer_id::text || ';slot=' || slot::text || '%'
  )
)
select
  gen_random_uuid() as id,
  slots.customer_id,
  slots.demo_index,
  slots.slot,
  slots.demo_name,
  slots.demo_email,
  slots.demo_phone
from available_slots slots
where slots.missing_position <= greatest(0, 2 - slots.existing_case_count);

insert into public.cases (
  id,
  customer_id,
  case_number,
  subject,
  description,
  channel,
  contact_type,
  status,
  lifecycle_status,
  routing_status,
  response_status,
  priority,
  area,
  category,
  cat_secundaria,
  product,
  subproduct,
  contact_name,
  contact_email,
  contact_phone,
  resolution_type,
  created_at,
  updated_at,
  closed_at
)
select
  demo_case.id,
  demo_case.customer_id,
  'DEMO-' || upper(substr(md5(demo_case.customer_id::text), 1, 10)) || '-' || demo_case.slot,
  (array[
    'Transferencia internacional pendiente',
    'Validación de Cuenta Global',
    'Compra con tarjeta rechazada',
    'Carga local aún no acreditada',
    'Revisión de operación con stablecoins'
  ])[((demo_case.demo_index + demo_case.slot - 2) % 5) + 1],
  'DEMO_SEED:customer=' || demo_case.customer_id::text || ';slot=' || demo_case.slot || E'\n' ||
    (array[
      'El cliente solicita revisar una transferencia que todavía no figura como recibida.',
      'El cliente necesita orientación para completar una validación de su Cuenta Global.',
      'El cliente reporta una compra rechazada y solicita confirmar el motivo.',
      'El cliente informa que una carga local sigue pendiente de acreditación.',
      'El cliente solicita revisar el estado y comprobante de una operación con stablecoins.'
    ])[((demo_case.demo_index + demo_case.slot - 2) % 5) + 1],
  (array['WHATSAPP', 'EMAIL', 'PHONE'])[
    ((demo_case.demo_index + demo_case.slot - 2) % 3) + 1
  ],
  (array['WHATSAPP', 'EMAIL', 'PHONE'])[
    ((demo_case.demo_index + demo_case.slot - 2) % 3) + 1
  ],
  case
    when ((demo_case.demo_index + demo_case.slot - 2) % 5) in (3, 4) then 'ASSIGNED'
    else 'HUMAN_REQUIRED'
  end,
  (array['NEW', 'IN_PROGRESS', 'STAND_BY', 'RESOLVED', 'CLOSED'])[
    ((demo_case.demo_index + demo_case.slot - 2) % 5) + 1
  ],
  case
    when ((demo_case.demo_index + demo_case.slot - 2) % 5) in (3, 4) then 'ASSIGNED'
    else 'UNASSIGNED'
  end,
  case
    when ((demo_case.demo_index + demo_case.slot - 2) % 2) = 0
      then 'WAITING_AGENT_RESPONSE'
    else 'UP_TO_DATE'
  end,
  (array['LOW', 'MEDIUM', 'HIGH'])[
    ((demo_case.demo_index + demo_case.slot - 2) % 3) + 1
  ],
  (array['SOPORTE', 'OPERACIONES', 'COMPLIANCE', 'FRAUDE', 'CX'])[
    ((demo_case.demo_index + demo_case.slot - 2) % 5) + 1
  ],
  (array['TRANSFERENCIAS', 'CUENTA', 'TARJETA', 'CARGAS', 'STABLECOINS'])[
    ((demo_case.demo_index + demo_case.slot - 2) % 5) + 1
  ],
  (array['Seguimiento', 'Validación', 'Compra rechazada', 'Acreditación', 'Revisión interna'])[
    ((demo_case.demo_index + demo_case.slot - 2) % 5) + 1
  ],
  (array['Transferencias', 'Cuenta Global', 'Tarjeta', 'Cargas locales', 'Stablecoins'])[
    ((demo_case.demo_index + demo_case.slot - 2) % 5) + 1
  ],
  (array['Envío internacional', 'Validación de cuenta', 'Compra online', 'Carga bancaria', 'Operación USDC'])[
    ((demo_case.demo_index + demo_case.slot - 2) % 5) + 1
  ],
  coalesce(customer.name, demo_case.demo_name),
  coalesce(customer.email, demo_case.demo_email),
  case ((demo_case.demo_index + demo_case.slot - 2) % 3)
    when 0 then customer.phone
    when 1 then '+5697000' || lpad(demo_case.demo_index::text, 4, '0')
    else null
  end,
  case
    when ((demo_case.demo_index + demo_case.slot - 2) % 5) in (3, 4)
      then 'HUMAN_RESOLVED'
    else null
  end,
  now() - ((demo_case.demo_index + demo_case.slot) || ' days')::interval,
  now() - ((demo_case.demo_index + demo_case.slot - 1) || ' days')::interval,
  case
    when ((demo_case.demo_index + demo_case.slot - 2) % 5) in (3, 4)
      then now() - ((demo_case.demo_index + demo_case.slot - 1) || ' days')::interval
    else null
  end
from demo_cases_to_insert demo_case
join public.customers customer on customer.id = demo_case.customer_id
where not exists (
  select 1
  from public.cases existing_demo
  where existing_demo.customer_id = demo_case.customer_id
    and existing_demo.description like
      'DEMO_SEED:customer=' || demo_case.customer_id::text || ';slot=' || demo_case.slot::text || '%'
);

-- Conversaciones de seis mensajes sólo para casos creados por este seed que
-- todavía no tienen conversación. No agrega mensajes a casos reales.
with demo_cases_without_messages as (
  select case_item.*
  from public.cases case_item
  where case_item.description like 'DEMO_SEED:customer=%'
    and not exists (
      select 1 from public.messages message where message.case_id = case_item.id
    )
), demo_conversation(message_order, direction, sender_type, body) as (
  values
    (1, 'INBOUND', 'CUSTOMER', 'Hola, necesito ayuda para revisar una operación que todavía no se refleja.'),
    (2, 'OUTBOUND', 'AGENT', 'Hola. Revisaré el caso. ¿Puedes confirmar el monto y el país de destino?'),
    (3, 'INBOUND', 'CUSTOMER', 'El monto fue 250.000 y la operación fue realizada desde la aplicación.'),
    (4, 'OUTBOUND', 'AGENT', 'Gracias. Validaremos el estado, los datos de destino y el comprobante.'),
    (5, 'INBOUND', 'CUSTOMER', '¿Me pueden avisar apenas tengan una actualización?'),
    (6, 'OUTBOUND', 'AGENT', 'Sí. Dejaremos seguimiento activo y responderemos por este mismo canal.')
)
insert into public.messages (
  id,
  case_id,
  direction,
  sender_type,
  body,
  created_at,
  channel,
  message_type,
  external_message_id,
  delivery_status
)
select
  gen_random_uuid(),
  case_item.id,
  conversation.direction,
  conversation.sender_type,
  conversation.body,
  case_item.created_at + (conversation.message_order * interval '11 minutes'),
  case when case_item.channel = 'EMAIL' then 'EMAIL' else 'WHATSAPP' end,
  case when case_item.channel = 'EMAIL' then 'EMAIL' else 'TEXT' end,
  'demo-enrichment-' || case_item.id::text || '-' || conversation.message_order,
  case when conversation.direction = 'OUTBOUND' then 'SENT' else 'DELIVERED' end
from demo_cases_without_messages case_item
cross join demo_conversation conversation
where not exists (
  select 1
  from public.messages existing_message
  where existing_message.external_message_id =
    'demo-enrichment-' || case_item.id::text || '-' || conversation.message_order
);

-- CSAT sólo para casos demo resueltos/cerrados y sólo cuando no existe CSAT.
insert into public.case_csat (
  case_id,
  resolution_score,
  service_score,
  feedback,
  source,
  received_at
)
select
  case_item.id,
  ((abs(hashtext(case_item.id::text)) % 3) + 3)::smallint,
  ((abs(hashtext('service:' || case_item.id::text)) % 3) + 3)::smallint,
  (array[
    'La atención fue clara y rápida.',
    'Recibí seguimiento y pude resolver mi consulta.',
    'Buena atención; sería útil tener más actualizaciones automáticas.'
  ])[((abs(hashtext(case_item.id::text)) % 3) + 1)],
  'DEMO_SEED',
  coalesce(case_item.closed_at, case_item.updated_at, now())
from public.cases case_item
where case_item.description like 'DEMO_SEED:customer=%'
  and case_item.lifecycle_status in ('RESOLVED', 'CLOSED')
on conflict (case_id) do nothing;

-- Valores de campos personalizados para validar inputs reales del Tab Form.
-- Sólo toca casos identificados como DEMO_SEED y nunca actualiza conflictos.
insert into public.case_custom_values (case_id, field_definition_id, value_text)
select
  case_item.id,
  definition.id,
  case definition.field_key
    when 'pais_destino' then (array['Chile', 'Perú', 'Colombia', 'Argentina', 'México'])[
      ((abs(hashtext(case_item.id::text)) % 5) + 1)
    ]
    when 'banco_receptor' then (array['Banco Demo Uno', 'Banco Demo Dos', 'Banco Demo Tres'])[
      ((abs(hashtext('bank:' || case_item.id::text)) % 3) + 1)
    ]
  end
from public.cases case_item
join public.case_field_definitions definition
  on definition.field_key in ('pais_destino', 'banco_receptor')
where case_item.description like 'DEMO_SEED:customer=%'
on conflict (case_id, field_definition_id) do nothing;

insert into public.case_custom_values (case_id, field_definition_id, value_number)
select
  case_item.id,
  definition.id,
  50000 + (abs(hashtext(case_item.id::text)) % 950000)
from public.cases case_item
join public.case_field_definitions definition on definition.field_key = 'monto_reclamado'
where case_item.description like 'DEMO_SEED:customer=%'
on conflict (case_id, field_definition_id) do nothing;

insert into public.case_custom_values (case_id, field_definition_id, value_date)
select
  case_item.id,
  definition.id,
  (current_date - ((abs(hashtext(case_item.id::text)) % 20) + 1))::date
from public.cases case_item
join public.case_field_definitions definition on definition.field_key = 'fecha_operacion'
where case_item.description like 'DEMO_SEED:customer=%'
on conflict (case_id, field_definition_id) do nothing;

insert into public.case_custom_values (case_id, field_definition_id, value_boolean)
select
  case_item.id,
  definition.id,
  (abs(hashtext(case_item.id::text)) % 2) = 0
from public.cases case_item
join public.case_field_definitions definition
  on definition.field_key = 'requiere_revision_manual'
where case_item.description like 'DEMO_SEED:customer=%'
on conflict (case_id, field_definition_id) do nothing;

commit;

-- ============================================================================
-- QUERIES DE VALIDACIÓN (ejecutar manualmente después del seed)
-- ============================================================================

-- Total de customers con identidad básica completa.
select
  count(*) as total_customers,
  count(*) filter (
    where nullif(btrim(name), '') is not null
      and nullif(btrim(email), '') is not null
      and nullif(btrim(phone), '') is not null
      and nullif(btrim(customer_id), '') is not null
      and nullif(btrim(public_id), '') is not null
  ) as customers_con_identidad_completa
from public.customers;

-- Si country existe en customers:
-- select country, count(*) from public.customers group by country order by country;

-- Si segmentation existe en customers:
-- select segmentation, count(*) from public.customers group by segmentation order by segmentation;

-- Casos por área, lifecycle y status.
select area, lifecycle_status, status, count(*)
from public.cases
group by area, lifecycle_status, status
order by area, lifecycle_status, status;

-- Casos demo con CSAT.
select count(*) as casos_demo_con_csat
from public.case_csat csat
join public.cases case_item on case_item.id = csat.case_id
where csat.source = 'DEMO_SEED';

-- Casos demo con mensajes.
select
  count(distinct case_item.id) as casos_demo_con_mensajes,
  count(message.id) as mensajes_demo
from public.cases case_item
join public.messages message on message.case_id = case_item.id
where case_item.description like 'DEMO_SEED:customer=%'
  and message.external_message_id like 'demo-enrichment-%';

-- Ejemplos por cliente y URL lista para abrir en el CRM.
select
  customer.name as customer_name,
  customer.public_id,
  case_item.id as case_id,
  case_item.case_number,
  case_item.area,
  case_item.lifecycle_status,
  '/casos/' || case_item.id::text as crm_path
from public.customers customer
join public.cases case_item on case_item.customer_id = customer.id
where case_item.description like 'DEMO_SEED:customer=%'
order by customer.name, case_item.created_at desc
limit 30;

-- Variedad para probar WHATSAPP_MATCHES_CUSTOMER_PHONE.
select
  count(*) filter (where case_item.contact_phone = customer.phone) as coincide,
  count(*) filter (
    where case_item.contact_phone is not null
      and case_item.contact_phone is distinct from customer.phone
  ) as no_coincide,
  count(*) filter (where case_item.contact_phone is null) as sin_numero
from public.cases case_item
join public.customers customer on customer.id = case_item.customer_id
where case_item.description like 'DEMO_SEED:customer=%';
