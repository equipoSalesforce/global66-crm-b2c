-- Seed demo para probar la tab IA de historial de casos.
-- Ejecutar manualmente en Supabase SQL Editor.
-- No es migración productiva.

begin;

delete from public.case_ai_history_summaries
where case_id in (
  select c.id
  from public.cases c
  join public.customers cu on cu.id = c.customer_id
  where cu.email = 'cliente.ia.demo@global66.test'
);

delete from public.messages
where case_id in (
  select c.id
  from public.cases c
  join public.customers cu on cu.id = c.customer_id
  where cu.email = 'cliente.ia.demo@global66.test'
);

delete from public.cases
where customer_id in (
  select id
  from public.customers
  where email = 'cliente.ia.demo@global66.test'
);

delete from public.customers
where email = 'cliente.ia.demo@global66.test';

create temp table seed_ai_history_customer (
  id uuid not null default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null
) on commit drop;

insert into seed_ai_history_customer (name, email, phone)
values (
  'Cliente Demo IA Historial',
  'cliente.ia.demo@global66.test',
  '+56955550123'
);

insert into public.customers (id, name, email, phone, created_at)
select id, name, email, phone, now() - interval '8 months'
from seed_ai_history_customer;

create temp table seed_ai_history_cases (
  case_key text primary key,
  id uuid not null default gen_random_uuid(),
  case_number text not null,
  subject text not null,
  channel text not null,
  contact_type text not null,
  lifecycle_status text not null,
  routing_status text not null,
  status text not null,
  priority text not null,
  area text not null,
  category text not null,
  resolution_type text,
  ai_summary text,
  ai_category text,
  ai_sentiment text,
  ai_confidence numeric,
  ai_resolution text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  closed_at timestamptz
) on commit drop;

insert into seed_ai_history_cases (
  case_key,
  case_number,
  subject,
  channel,
  contact_type,
  lifecycle_status,
  routing_status,
  status,
  priority,
  area,
  category,
  resolution_type,
  ai_summary,
  ai_category,
  ai_sentiment,
  ai_confidence,
  ai_resolution,
  created_at,
  updated_at,
  closed_at
) values
(
  'current',
  '990001',
  'Nueva consulta por transferencia no acreditada',
  'WHATSAPP',
  'WHATSAPP',
  'IN_PROGRESS',
  'ASSIGNED',
  'ASSIGNED',
  'HIGH',
  'SOPORTE',
  'RECLAMO',
  null,
  'Cliente indica que nuevamente una transferencia enviada a proveedor no aparece acreditada y pide revisión urgente porque ya le ha ocurrido antes.',
  'TRANSFERENCIAS',
  'NEGATIVE',
  0.82,
  'HUMAN_REQUIRED',
  now() - interval '2 hours',
  now() - interval '15 minutes',
  null
),
(
  'hist_1',
  '990002',
  'Transferencia a proveedor no acreditada',
  'WHATSAPP',
  'WHATSAPP',
  'CLOSED',
  'ASSIGNED',
  'CLOSED',
  'HIGH',
  'SOPORTE',
  'RECLAMO',
  'HUMAN_RESOLVED',
  'Se validó que la transferencia estaba en revisión bancaria y fue acreditada al día siguiente.',
  'TRANSFERENCIAS',
  'NEUTRAL',
  0.76,
  'HUMAN_REQUIRED',
  now() - interval '35 days',
  now() - interval '34 days 3 hours',
  now() - interval '34 days'
),
(
  'hist_2',
  '990003',
  'Transferencia demorada por validación de datos',
  'WHATSAPP',
  'WHATSAPP',
  'CLOSED',
  'ASSIGNED',
  'CLOSED',
  'HIGH',
  'SOPORTE',
  'RECLAMO',
  'HUMAN_RESOLVED',
  'Se detectó inconsistencia en datos del destinatario. Cliente corrigió información y se reprocesó correctamente.',
  'TRANSFERENCIAS',
  'NEGATIVE',
  0.81,
  'HUMAN_REQUIRED',
  now() - interval '62 days',
  now() - interval '61 days 4 hours',
  now() - interval '61 days'
),
(
  'hist_3',
  '990004',
  'Consulta por comprobante de transferencia',
  'EMAIL',
  'EMAIL',
  'CLOSED',
  'ASSIGNED',
  'CLOSED',
  'MEDIUM',
  'GENERAL',
  'CONSULTA',
  'HUMAN_RESOLVED',
  'Se envió comprobante actualizado y se explicó cómo descargarlo desde la plataforma.',
  'COMPROBANTES',
  'NEUTRAL',
  0.72,
  'HUMAN_REQUIRED',
  now() - interval '92 days',
  now() - interval '91 days 2 hours',
  now() - interval '91 days'
),
(
  'hist_4',
  '990005',
  'Duda sobre tiempos de abono',
  'WHATSAPP',
  'WHATSAPP',
  'CLOSED',
  'ASSIGNED',
  'CLOSED',
  'LOW',
  'GENERAL',
  'CONSULTA',
  'HUMAN_RESOLVED',
  'Se explicó plazo según banco receptor y horario de corte.',
  'TRANSFERENCIAS',
  'POSITIVE',
  0.7,
  'HUMAN_REQUIRED',
  now() - interval '128 days',
  now() - interval '127 days 5 hours',
  now() - interval '127 days'
),
(
  'hist_5',
  '990006',
  'Actualización de datos de proveedor',
  'EMAIL',
  'EMAIL',
  'CLOSED',
  'ASSIGNED',
  'CLOSED',
  'MEDIUM',
  'SOPORTE',
  'DOCUMENTACION',
  'HUMAN_RESOLVED',
  'Se actualizaron datos bancarios y se recomendó verificar datos antes de futuras transferencias.',
  'PROVEEDORES',
  'NEUTRAL',
  0.74,
  'HUMAN_REQUIRED',
  now() - interval '171 days',
  now() - interval '170 days 6 hours',
  now() - interval '170 days'
);

insert into public.cases (
  id,
  customer_id,
  case_number,
  subject,
  channel,
  contact_type,
  status,
  lifecycle_status,
  routing_status,
  priority,
  area,
  category,
  assigned_agent_id,
  assigned_to,
  contact_name,
  contact_email,
  contact_phone,
  created_at,
  updated_at,
  closed_at,
  resolution_type,
  ai_summary,
  ai_category,
  ai_sentiment,
  ai_confidence,
  ai_resolution
)
select
  sc.id,
  customer.id,
  sc.case_number,
  sc.subject,
  sc.channel,
  sc.contact_type,
  sc.status,
  sc.lifecycle_status,
  sc.routing_status,
  sc.priority,
  sc.area,
  sc.category,
  null,
  'Katherine',
  customer.name,
  customer.email,
  customer.phone,
  sc.created_at,
  sc.updated_at,
  sc.closed_at,
  sc.resolution_type,
  sc.ai_summary,
  sc.ai_category,
  sc.ai_sentiment,
  sc.ai_confidence,
  sc.ai_resolution
from seed_ai_history_cases sc
cross join seed_ai_history_customer customer;

create temp table seed_ai_history_messages (
  case_key text not null references seed_ai_history_cases(case_key),
  msg_order integer not null,
  direction text not null,
  sender_type text not null,
  body text not null
) on commit drop;

insert into seed_ai_history_messages (case_key, msg_order, direction, sender_type, body) values
('current', 1, 'INBOUND', 'CUSTOMER', 'Hola, necesito ayuda urgente con una transferencia a proveedor. Se debitó de mi cuenta pero el destinatario dice que no le llegó.'),
('current', 2, 'OUTBOUND', 'AGENT', 'Hola, reviso el caso. ¿Me puedes confirmar el monto, fecha y comprobante?'),
('current', 3, 'INBOUND', 'CUSTOMER', 'Fue ayer por 1.250.000 CLP. Ya adjunté el comprobante. Esto mismo me pasó el mes pasado.'),
('current', 4, 'OUTBOUND', 'AGENT', 'Gracias, vamos a validar el estado de la operación y te actualizamos por este mismo canal.'),
('current', 5, 'INBOUND', 'CUSTOMER', 'Me preocupa porque el proveedor necesita liberar el pedido hoy.'),
('current', 6, 'OUTBOUND', 'AGENT', 'Entiendo la urgencia. Dejaremos el caso con prioridad alta y revisaremos estado bancario, datos del destinatario y comprobante.'),

('hist_1', 1, 'INBOUND', 'CUSTOMER', 'Hola, hice una transferencia a un proveedor y todavía no aparece. Me urge porque necesito liberar un pedido.'),
('hist_1', 2, 'OUTBOUND', 'AGENT', 'Hola, revisaremos el estado de la operación. ¿Tienes el comprobante y el monto?'),
('hist_1', 3, 'INBOUND', 'CUSTOMER', 'Sí, lo adjunto. El monto fue 980.000 CLP.'),
('hist_1', 4, 'OUTBOUND', 'AGENT', 'Gracias. La operación está en revisión bancaria por validación del banco receptor.'),
('hist_1', 5, 'INBOUND', 'CUSTOMER', '¿Cuánto puede tardar? El proveedor me está presionando.'),
('hist_1', 6, 'OUTBOUND', 'AGENT', 'El plazo estimado es hasta el siguiente día hábil. Dejaremos seguimiento activo.'),
('hist_1', 7, 'INBOUND', 'CUSTOMER', 'Necesito que me avisen apenas se acredite.'),
('hist_1', 8, 'OUTBOUND', 'AGENT', 'Te confirmamos que la transferencia fue acreditada correctamente.'),
('hist_1', 9, 'INBOUND', 'CUSTOMER', 'Perfecto, gracias. Avisaré al proveedor.'),

('hist_2', 1, 'INBOUND', 'CUSTOMER', 'Tengo otra transferencia detenida, no entiendo por qué pasa tanto.'),
('hist_2', 2, 'OUTBOUND', 'AGENT', 'Revisaremos el detalle. ¿Es la transferencia a Servicios Patagonia?'),
('hist_2', 3, 'INBOUND', 'CUSTOMER', 'Sí, esa misma.'),
('hist_2', 4, 'OUTBOUND', 'AGENT', 'Detectamos una diferencia entre el nombre del destinatario y los datos bancarios.'),
('hist_2', 5, 'INBOUND', 'CUSTOMER', '¿Qué tengo que corregir?'),
('hist_2', 6, 'OUTBOUND', 'AGENT', 'Debes actualizar el nombre legal del destinatario y volver a enviar la operación.'),
('hist_2', 7, 'INBOUND', 'CUSTOMER', 'Listo, ya corregí los datos.'),
('hist_2', 8, 'OUTBOUND', 'AGENT', 'Perfecto, la operación fue reprocesada correctamente.'),
('hist_2', 9, 'INBOUND', 'CUSTOMER', 'Gracias. Igual me preocupa que vuelva a pasar.'),
('hist_2', 10, 'OUTBOUND', 'AGENT', 'Te recomendamos validar razón social, banco y número de cuenta antes de enviar transferencias a proveedores nuevos.'),

('hist_3', 1, 'INBOUND', 'CUSTOMER', 'Necesito el comprobante de una transferencia del viernes, el proveedor me pide respaldo.'),
('hist_3', 2, 'OUTBOUND', 'AGENT', 'Claro, por favor indícanos el monto o destinatario.'),
('hist_3', 3, 'INBOUND', 'CUSTOMER', 'Fue a Comercial Los Andes por 750.000 CLP.'),
('hist_3', 4, 'OUTBOUND', 'AGENT', 'Encontramos la operación. Te enviamos el comprobante actualizado.'),
('hist_3', 5, 'INBOUND', 'CUSTOMER', '¿Dónde puedo descargarlo yo después?'),
('hist_3', 6, 'OUTBOUND', 'AGENT', 'Puedes descargarlo desde Movimientos > Detalle de operación > Descargar comprobante.'),
('hist_3', 7, 'INBOUND', 'CUSTOMER', 'Gracias, con eso me sirve.'),
('hist_3', 8, 'OUTBOUND', 'AGENT', 'Perfecto. Dejamos el caso cerrado.'),

('hist_4', 1, 'INBOUND', 'CUSTOMER', 'Hola, ¿cuánto tarda normalmente una transferencia a otro banco?'),
('hist_4', 2, 'OUTBOUND', 'AGENT', 'Depende del banco receptor y horario de corte. Normalmente puede ser el mismo día o siguiente hábil.'),
('hist_4', 3, 'INBOUND', 'CUSTOMER', 'Entonces si la envío tarde puede quedar para mañana.'),
('hist_4', 4, 'OUTBOUND', 'AGENT', 'Exacto. Si se envía después del horario de corte, puede procesarse al día hábil siguiente.'),
('hist_4', 5, 'INBOUND', 'CUSTOMER', 'Entendido, gracias.'),
('hist_4', 6, 'OUTBOUND', 'AGENT', 'De nada. Te recomendamos revisar el horario de corte antes de transferencias urgentes.'),

('hist_5', 1, 'INBOUND', 'CUSTOMER', 'Necesito actualizar los datos bancarios de un proveedor frecuente.'),
('hist_5', 2, 'OUTBOUND', 'AGENT', 'Podemos ayudarte. Envíanos los nuevos datos para validarlos.'),
('hist_5', 3, 'INBOUND', 'CUSTOMER', 'El proveedor cambió razón social y cuenta bancaria.'),
('hist_5', 4, 'OUTBOUND', 'AGENT', 'Recibido. Validaremos razón social, banco y número de cuenta.'),
('hist_5', 5, 'INBOUND', 'CUSTOMER', '¿Esto afecta transferencias futuras?'),
('hist_5', 6, 'OUTBOUND', 'AGENT', 'Sí, si los datos anteriores ya no coinciden, futuras transferencias podrían quedar en revisión o rechazarse.'),
('hist_5', 7, 'OUTBOUND', 'AGENT', 'Datos actualizados correctamente. Te recomendamos verificar razón social y banco antes de próximas transferencias.'),
('hist_5', 8, 'INBOUND', 'CUSTOMER', 'Gracias, eso debería evitar errores.');

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
  sc.id,
  sm.direction,
  sm.sender_type,
  sm.body,
  sc.created_at + ((sm.msg_order * 9) || ' minutes')::interval,
  sc.channel,
  case when sc.channel in ('EMAIL', 'GMAIL') then 'EMAIL' else 'TEXT' end,
  'demo-ai-history-' || sc.case_key || '-' || sm.msg_order,
  case when sm.direction = 'OUTBOUND' then 'SENT' else 'DELIVERED' end
from seed_ai_history_messages sm
join seed_ai_history_cases sc on sc.case_key = sm.case_key;

commit;

select
  c.id as case_id,
  c.case_number,
  c.subject,
  c.lifecycle_status,
  c.status,
  c.priority,
  c.channel,
  c.created_at,
  case
    when c.case_number = '990001' then 'CASO ACTUAL ABIERTO - copiar este ID para /casos/[id]'
    else 'Histórico'
  end as demo_note
from public.cases c
join public.customers cu on cu.id = c.customer_id
where cu.email = 'cliente.ia.demo@global66.test'
order by c.created_at desc;
