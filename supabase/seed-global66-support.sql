-- Seed demo B2C Global66 para CRM.
-- Ejecutar manualmente en Supabase SQL Editor.
-- No toca agents, agent_skills ni ai_settings.

begin;

delete from public.ai_message_articles;
delete from public.ai_case_articles;
delete from public.assignment_logs;
delete from public.messages;
delete from public.cases;
delete from public.customers;
delete from public.knowledge_articles;

create temp table seed_customers (
  idx integer primary key,
  id uuid not null default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null
) on commit drop;

insert into seed_customers (idx, name, email, phone) values
(1, 'Camila Rojas', 'camila.rojas@example.com', '+56981234501'),
(2, 'Matias Fernandez', 'matias.fernandez@example.com', '+56981234502'),
(3, 'Valentina Soto', 'valentina.soto@example.com', '+56981234503'),
(4, 'Benjamin Castillo', 'benjamin.castillo@example.com', '+56981234504'),
(5, 'Francisca Morales', 'francisca.morales@example.com', '+56981234505'),
(6, 'Diego Herrera', 'diego.herrera@example.com', '+56981234506'),
(7, 'Antonia Vargas', 'antonia.vargas@example.com', '+56981234507'),
(8, 'Joaquin Silva', 'joaquin.silva@example.com', '+56981234508'),
(9, 'Catalina Munoz', 'catalina.munoz@example.com', '+56981234509'),
(10, 'Nicolas Paredes', 'nicolas.paredes@example.com', '+56981234510'),
(11, 'Josefina Torres', 'josefina.torres@example.com', '+56981234511'),
(12, 'Sebastian Araya', 'sebastian.araya@example.com', '+56981234512'),
(13, 'Fernanda Lagos', 'fernanda.lagos@example.com', '+56981234513'),
(14, 'Ignacio Reyes', 'ignacio.reyes@example.com', '+56981234514'),
(15, 'Daniela Fuentes', 'daniela.fuentes@example.com', '+56981234515'),
(16, 'Pablo Contreras', 'pablo.contreras@example.com', '+56981234516'),
(17, 'Isidora Medina', 'isidora.medina@example.com', '+56981234517'),
(18, 'Tomas Navarro', 'tomas.navarro@example.com', '+56981234518'),
(19, 'Mariana Riquelme', 'mariana.riquelme@example.com', '+56981234519'),
(20, 'Felipe Alvarado', 'felipe.alvarado@example.com', '+56981234520');

insert into public.customers (id, name, email, phone, created_at)
select id, name, email, phone, now() - ((21 - idx) || ' days')::interval
from seed_customers;

create temp table seed_cases (
  case_number text primary key,
  customer_idx integer not null references seed_customers(idx),
  subject text not null,
  channel text not null,
  contact_type text not null,
  lifecycle_status text not null,
  routing_status text not null,
  status text not null,
  priority text not null,
  area text not null,
  category text not null,
  ai_summary text,
  ai_category text,
  ai_sentiment text,
  ai_resolution text,
  resolution_type text,
  created_offset interval not null
) on commit drop;

insert into seed_cases values
('000001', 1, 'Transferencia a Peru no recibida', 'WHATSAPP', 'WHATSAPP', 'IN_PROGRESS', 'ASSIGNED', 'ASSIGNED', 'HIGH', 'SOPORTE', 'RECLAMO', 'Cliente consulta por transferencia a Peru pendiente de abono.', 'RECLAMO', 'NEUTRAL', 'HUMAN_REQUIRED', null, interval '9 days'),
('000002', 1, 'Consulta por comision aplicada', 'EMAIL', 'EMAIL', 'CLOSED', 'ASSIGNED', 'ASSIGNED', 'LOW', 'GENERAL', 'FACTURACION', 'Cliente solicita detalle de comision de transferencia.', 'CONSULTA', 'NEUTRAL', 'AUTO_RESOLVED', 'AI_RESOLVED', interval '38 days'),
('000003', 2, 'Transferencia demoro mas de lo esperado', 'WHATSAPP', 'WHATSAPP', 'NEW', 'HUMAN_REQUIRED', 'HUMAN_REQUIRED', 'MEDIUM', 'SOPORTE', 'RECLAMO', 'Transferencia enviada aun dentro del plazo bancario estimado.', 'RECLAMO', 'NEUTRAL', 'HUMAN_REQUIRED', null, interval '1 days'),
('000004', 2, 'Problema para iniciar sesion', 'WHATSAPP', 'WHATSAPP', 'RESOLVED', 'ASSIGNED', 'ASSIGNED', 'MEDIUM', 'SOPORTE', 'CONSULTA', 'Usuario no podia acceder por verificacion del dispositivo.', 'CONSULTA', 'NEUTRAL', 'HUMAN_REQUIRED', 'HUMAN_RESOLVED', interval '23 days'),
('000005', 3, 'Dinero abonado con monto distinto', 'WHATSAPP', 'WHATSAPP', 'IN_PROGRESS', 'ASSIGNED', 'ASSIGNED', 'HIGH', 'SOPORTE', 'RECLAMO', 'Cliente reporta diferencia entre monto esperado y monto abonado.', 'RECLAMO', 'NEGATIVE', 'HUMAN_REQUIRED', null, interval '3 days'),
('000006', 3, 'Actualizacion de telefono', 'EMAIL', 'EMAIL', 'CLOSED', 'ASSIGNED', 'ASSIGNED', 'LOW', 'GENERAL', 'DOCUMENTACION', 'Solicitud de actualizacion de telefono completada.', 'CONSULTA', 'NEUTRAL', 'AUTO_RESOLVED', 'AI_RESOLVED', interval '45 days'),
('000007', 4, 'Diferencia de tipo de cambio', 'WHATSAPP', 'WHATSAPP', 'STAND_BY', 'ASSIGNED', 'ASSIGNED', 'MEDIUM', 'GENERAL', 'CONSULTA', 'Cliente pregunta por variacion de tipo de cambio aplicado.', 'CONSULTA', 'NEUTRAL', 'HUMAN_REQUIRED', null, interval '5 days'),
('000008', 4, 'Recepcion desde Argentina pendiente', 'WHATSAPP', 'WHATSAPP', 'CLOSED', 'ASSIGNED', 'ASSIGNED', 'MEDIUM', 'SOPORTE', 'RECLAMO', 'Abono recibido desde el extranjero fue confirmado.', 'RECLAMO', 'NEUTRAL', 'HUMAN_REQUIRED', 'HUMAN_RESOLVED', interval '52 days'),
('000009', 5, 'Cuenta bloqueada por seguridad', 'WHATSAPP', 'WHATSAPP', 'IN_PROGRESS', 'HUMAN_REQUIRED', 'HUMAN_REQUIRED', 'HIGH', 'SOPORTE', 'RECLAMO', 'Cuenta bloqueada preventivamente por alerta de seguridad.', 'RECLAMO', 'NEGATIVE', 'HUMAN_REQUIRED', null, interval '2 days'),
('000010', 5, 'Consulta horario de atencion', 'WHATSAPP', 'WHATSAPP', 'CLOSED', 'AI_HANDLING', 'AI_HANDLING', 'LOW', 'GENERAL', 'CONSULTA', 'Cliente consulto horario de atencion.', 'CONSULTA', 'NEUTRAL', 'AUTO_RESOLVED', 'AI_RESOLVED', interval '60 days'),
('000011', 6, 'Documento KYC rechazado', 'WHATSAPP', 'WHATSAPP', 'NEW', 'HUMAN_REQUIRED', 'HUMAN_REQUIRED', 'MEDIUM', 'SOPORTE', 'DOCUMENTACION', 'Documento de identidad fue rechazado por imagen borrosa.', 'DOCUMENTACION', 'NEUTRAL', 'HUMAN_REQUIRED', null, interval '1 hours'),
('000012', 6, 'Limites para enviar a Colombia', 'EMAIL', 'EMAIL', 'RESOLVED', 'AI_HANDLING', 'AI_HANDLING', 'LOW', 'GENERAL', 'CONSULTA', 'Cliente consulta limites disponibles para transferencia.', 'CONSULTA', 'NEUTRAL', 'AUTO_RESOLVED', 'AI_RESOLVED', interval '30 days'),
('000013', 7, 'Cuenta en revision', 'WHATSAPP', 'WHATSAPP', 'STAND_BY', 'ASSIGNED', 'ASSIGNED', 'MEDIUM', 'SOPORTE', 'DOCUMENTACION', 'Cuenta se encuentra en revision por validacion adicional.', 'DOCUMENTACION', 'NEUTRAL', 'HUMAN_REQUIRED', null, interval '6 days'),
('000014', 7, 'Tarjeta rechazada en comercio', 'WHATSAPP', 'WHATSAPP', 'CLOSED', 'ASSIGNED', 'ASSIGNED', 'MEDIUM', 'SOPORTE', 'RECLAMO', 'Transaccion fue rechazada por validacion del comercio.', 'RECLAMO', 'NEUTRAL', 'HUMAN_REQUIRED', 'HUMAN_RESOLVED', interval '18 days'),
('000015', 8, 'Tarjeta perdida', 'WHATSAPP', 'WHATSAPP', 'IN_PROGRESS', 'ASSIGNED', 'ASSIGNED', 'HIGH', 'SOPORTE', 'RECLAMO', 'Cliente reporta tarjeta perdida y solicita bloqueo.', 'RECLAMO', 'NEGATIVE', 'HUMAN_REQUIRED', null, interval '8 hours'),
('000016', 8, 'Comision no entendida', 'EMAIL', 'EMAIL', 'CLOSED', 'AI_HANDLING', 'AI_HANDLING', 'LOW', 'GENERAL', 'FACTURACION', 'Se explico comision de servicio y conversion.', 'CONSULTA', 'NEUTRAL', 'AUTO_RESOLVED', 'AI_RESOLVED', interval '43 days'),
('000017', 9, 'Limite de transferencia insuficiente', 'WHATSAPP', 'WHATSAPP', 'NEW', 'HUMAN_REQUIRED', 'HUMAN_REQUIRED', 'MEDIUM', 'SOPORTE', 'CONSULTA', 'Cliente requiere revisar limite para transferencia mayor.', 'CONSULTA', 'NEUTRAL', 'HUMAN_REQUIRED', null, interval '2 hours'),
('000018', 9, 'Recepcion de dinero desde Espana', 'WHATSAPP', 'WHATSAPP', 'RESOLVED', 'ASSIGNED', 'ASSIGNED', 'LOW', 'GENERAL', 'CONSULTA', 'Cliente necesitaba instrucciones para recibir dinero desde Espana.', 'CONSULTA', 'NEUTRAL', 'HUMAN_REQUIRED', 'HUMAN_RESOLVED', interval '25 days'),
('000019', 10, 'Actualizar email de cuenta', 'EMAIL', 'EMAIL', 'IN_PROGRESS', 'ASSIGNED', 'ASSIGNED', 'MEDIUM', 'GENERAL', 'DOCUMENTACION', 'Cliente solicita cambio de email registrado.', 'DOCUMENTACION', 'NEUTRAL', 'HUMAN_REQUIRED', null, interval '4 days'),
('000020', 10, 'Transferencia a Mexico no recibida', 'WHATSAPP', 'WHATSAPP', 'CLOSED', 'ASSIGNED', 'ASSIGNED', 'HIGH', 'SOPORTE', 'RECLAMO', 'Transferencia fue localizada y abonada por banco receptor.', 'RECLAMO', 'NEUTRAL', 'HUMAN_REQUIRED', 'HUMAN_RESOLVED', interval '72 days'),
('000021', 11, 'Posible fraude en cuenta', 'WHATSAPP', 'WHATSAPP', 'IN_PROGRESS', 'HUMAN_REQUIRED', 'HUMAN_REQUIRED', 'HIGH', 'SOPORTE', 'RECLAMO', 'Cliente desconoce movimiento y requiere bloqueo preventivo.', 'RECLAMO', 'NEGATIVE', 'HUMAN_REQUIRED', null, interval '5 hours'),
('000022', 11, 'Estado de transferencia a Uruguay', 'WHATSAPP', 'WHATSAPP', 'CLOSED', 'AI_HANDLING', 'AI_HANDLING', 'LOW', 'GENERAL', 'CONSULTA', 'Cliente consulto significado del estado en proceso.', 'CONSULTA', 'NEUTRAL', 'AUTO_RESOLVED', 'AI_RESOLVED', interval '36 days'),
('000023', 12, 'Desconocimiento de transaccion', 'WHATSAPP', 'WHATSAPP', 'NEW', 'HUMAN_REQUIRED', 'HUMAN_REQUIRED', 'HIGH', 'SOPORTE', 'RECLAMO', 'Cliente reporta cargo no reconocido en tarjeta.', 'RECLAMO', 'NEGATIVE', 'HUMAN_REQUIRED', null, interval '3 hours'),
('000024', 12, 'Documento KYC vencido', 'EMAIL', 'EMAIL', 'RESOLVED', 'ASSIGNED', 'ASSIGNED', 'MEDIUM', 'SOPORTE', 'DOCUMENTACION', 'Cliente actualizo documento de identidad vencido.', 'DOCUMENTACION', 'NEUTRAL', 'HUMAN_REQUIRED', 'HUMAN_RESOLVED', interval '28 days'),
('000025', 13, 'No puedo iniciar sesion', 'WHATSAPP', 'WHATSAPP', 'IN_PROGRESS', 'ASSIGNED', 'ASSIGNED', 'MEDIUM', 'SOPORTE', 'CONSULTA', 'Usuario no recibe codigo de verificacion para iniciar sesion.', 'CONSULTA', 'NEUTRAL', 'HUMAN_REQUIRED', null, interval '10 hours'),
('000026', 13, 'Diferencia tipo de cambio final', 'EMAIL', 'EMAIL', 'CLOSED', 'AI_HANDLING', 'AI_HANDLING', 'LOW', 'GENERAL', 'CONSULTA', 'Se explico que el tipo de cambio puede variar hasta confirmar.', 'CONSULTA', 'NEUTRAL', 'AUTO_RESOLVED', 'AI_RESOLVED', interval '33 days'),
('000027', 14, 'Transferencia a Ecuador pendiente', 'WHATSAPP', 'WHATSAPP', 'STAND_BY', 'ASSIGNED', 'ASSIGNED', 'MEDIUM', 'SOPORTE', 'RECLAMO', 'Transferencia pendiente por validacion del banco receptor.', 'RECLAMO', 'NEUTRAL', 'HUMAN_REQUIRED', null, interval '7 days'),
('000028', 14, 'Consulta de comisiones a Argentina', 'WHATSAPP', 'WHATSAPP', 'CLOSED', 'AI_HANDLING', 'AI_HANDLING', 'LOW', 'GENERAL', 'FACTURACION', 'Cliente recibio detalle de comisiones antes de enviar.', 'CONSULTA', 'NEUTRAL', 'AUTO_RESOLVED', 'AI_RESOLVED', interval '40 days'),
('000029', 15, 'Cuenta en revision por KYC', 'WHATSAPP', 'WHATSAPP', 'IN_PROGRESS', 'HUMAN_REQUIRED', 'HUMAN_REQUIRED', 'MEDIUM', 'SOPORTE', 'DOCUMENTACION', 'Cuenta en revision por datos inconsistentes de identidad.', 'DOCUMENTACION', 'NEUTRAL', 'HUMAN_REQUIRED', null, interval '2 days'),
('000030', 15, 'Tarjeta rechazada online', 'WHATSAPP', 'WHATSAPP', 'RESOLVED', 'ASSIGNED', 'ASSIGNED', 'MEDIUM', 'SOPORTE', 'RECLAMO', 'Se explico rechazo por comercio no habilitado.', 'RECLAMO', 'NEUTRAL', 'HUMAN_REQUIRED', 'HUMAN_RESOLVED', interval '21 days'),
('000031', 16, 'Recepcion desde Peru no aparece', 'WHATSAPP', 'WHATSAPP', 'NEW', 'HUMAN_REQUIRED', 'HUMAN_REQUIRED', 'MEDIUM', 'SOPORTE', 'RECLAMO', 'Cliente espera recepcion desde Peru aun no reflejada.', 'RECLAMO', 'NEUTRAL', 'HUMAN_REQUIRED', null, interval '6 hours'),
('000032', 16, 'Actualizacion de datos personales', 'EMAIL', 'EMAIL', 'CLOSED', 'ASSIGNED', 'ASSIGNED', 'LOW', 'GENERAL', 'DOCUMENTACION', 'Datos personales actualizados correctamente.', 'DOCUMENTACION', 'NEUTRAL', 'HUMAN_REQUIRED', 'HUMAN_RESOLVED', interval '48 days'),
('000033', 17, 'Transferencia internacional no recibida', 'WHATSAPP', 'WHATSAPP', 'IN_PROGRESS', 'ASSIGNED', 'ASSIGNED', 'HIGH', 'SOPORTE', 'RECLAMO', 'Transferencia enviada a Colombia aun no recibida.', 'RECLAMO', 'NEGATIVE', 'HUMAN_REQUIRED', null, interval '12 hours'),
('000034', 17, 'Limite diario de transferencia', 'WHATSAPP', 'WHATSAPP', 'CLOSED', 'AI_HANDLING', 'AI_HANDLING', 'LOW', 'GENERAL', 'CONSULTA', 'Cliente consulto limite diario disponible.', 'CONSULTA', 'NEUTRAL', 'AUTO_RESOLVED', 'AI_RESOLVED', interval '55 days'),
('000035', 18, 'Bloqueo preventivo de cuenta', 'WHATSAPP', 'WHATSAPP', 'STAND_BY', 'HUMAN_REQUIRED', 'HUMAN_REQUIRED', 'HIGH', 'SOPORTE', 'RECLAMO', 'Bloqueo preventivo por actividad inusual.', 'RECLAMO', 'NEGATIVE', 'HUMAN_REQUIRED', null, interval '1 days'),
('000036', 18, 'No entiendo estado en revision', 'EMAIL', 'EMAIL', 'RESOLVED', 'AI_HANDLING', 'AI_HANDLING', 'LOW', 'GENERAL', 'CONSULTA', 'Cliente consulto significado de cuenta en revision.', 'CONSULTA', 'NEUTRAL', 'AUTO_RESOLVED', 'AI_RESOLVED', interval '29 days'),
('000037', 19, 'Tarjeta perdida durante viaje', 'WHATSAPP', 'WHATSAPP', 'IN_PROGRESS', 'ASSIGNED', 'ASSIGNED', 'HIGH', 'SOPORTE', 'RECLAMO', 'Cliente solicita bloqueo urgente de tarjeta perdida.', 'RECLAMO', 'NEGATIVE', 'HUMAN_REQUIRED', null, interval '7 hours'),
('000038', 19, 'Transferencia demorada a Bolivia', 'WHATSAPP', 'WHATSAPP', 'CLOSED', 'ASSIGNED', 'ASSIGNED', 'MEDIUM', 'SOPORTE', 'RECLAMO', 'Transferencia demorada fue confirmada como abonada.', 'RECLAMO', 'NEUTRAL', 'HUMAN_REQUIRED', 'HUMAN_RESOLVED', interval '62 days'),
('000039', 20, 'Cargo desconocido en tarjeta', 'WHATSAPP', 'WHATSAPP', 'NEW', 'HUMAN_REQUIRED', 'HUMAN_REQUIRED', 'HIGH', 'SOPORTE', 'RECLAMO', 'Cliente desconoce cargo y solicita investigacion.', 'RECLAMO', 'NEGATIVE', 'HUMAN_REQUIRED', null, interval '30 minutes'),
('000040', 20, 'Como recibir dinero desde el extranjero', 'EMAIL', 'EMAIL', 'CLOSED', 'AI_HANDLING', 'AI_HANDLING', 'LOW', 'GENERAL', 'CONSULTA', 'Cliente recibio instrucciones para recepcion internacional.', 'CONSULTA', 'NEUTRAL', 'AUTO_RESOLVED', 'AI_RESOLVED', interval '50 days');

create temp table seed_case_ids (
  case_number text primary key,
  id uuid not null default gen_random_uuid()
) on commit drop;

insert into seed_case_ids (case_number)
select case_number from seed_cases;

insert into public.cases (
  id, customer_id, case_number, subject, channel, contact_type, status,
  lifecycle_status, routing_status, priority, area, category, assigned_agent_id,
  assigned_to, contact_name, contact_email, contact_phone, created_at, updated_at,
  closed_at, resolution_type, ai_summary, ai_category, ai_sentiment,
  ai_confidence, ai_resolution
)
select
  sci.id,
  scust.id,
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
  case when sc.routing_status = 'ASSIGNED' then 'Katherine' else null end,
  scust.name,
  scust.email,
  scust.phone,
  now() - sc.created_offset,
  now() - (sc.created_offset - interval '2 hours'),
  case when sc.lifecycle_status in ('CLOSED', 'RESOLVED') then now() - (sc.created_offset - interval '1 days') else null end,
  sc.resolution_type,
  sc.ai_summary,
  sc.ai_category,
  sc.ai_sentiment,
  case when sc.ai_resolution = 'AUTO_RESOLVED' then 0.91 else 0.64 end,
  sc.ai_resolution
from seed_cases sc
join seed_case_ids sci on sci.case_number = sc.case_number
join seed_customers scust on scust.idx = sc.customer_idx;

create temp table seed_messages (
  case_number text not null references seed_cases(case_number),
  msg_order integer not null,
  direction text not null,
  sender_type text not null,
  body text not null
) on commit drop;

insert into seed_messages values
('000001', 1, 'INBOUND', 'CUSTOMER', 'Hola, hice una transferencia a Peru ayer y todavia no llega. Me pueden ayudar?'),
('000001', 2, 'OUTBOUND', 'AGENT', 'Revisare el estado con el equipo de pagos y dejare el caso escalado para validacion.'),
('000002', 1, 'INBOUND', 'CUSTOMER', 'No entiendo por que me cobraron una comision en mi envio.'),
('000002', 2, 'OUTBOUND', 'AI', 'La comision se muestra antes de confirmar la operacion y puede incluir costo de servicio y conversion.'),
('000003', 1, 'INBOUND', 'CUSTOMER', 'Mi transferencia a Colombia lleva mas de dos dias y sigue en proceso.'),
('000003', 2, 'OUTBOUND', 'AGENT', 'Las transferencias pueden tardar entre 1 y 3 dias habiles segun el banco receptor. Revisare si hay observaciones.'),
('000004', 1, 'INBOUND', 'CUSTOMER', 'No puedo entrar a mi cuenta, el codigo no me llega.'),
('000004', 2, 'OUTBOUND', 'AGENT', 'Validamos tu telefono y reenviamos el codigo. Por favor intenta iniciar sesion nuevamente.'),
('000005', 1, 'INBOUND', 'CUSTOMER', 'Me abonaron menos dinero del que decia la simulacion.'),
('000005', 2, 'OUTBOUND', 'AGENT', 'Revisare el detalle del tipo de cambio y las comisiones aplicadas para explicarte la diferencia.'),
('000006', 1, 'INBOUND', 'CUSTOMER', 'Necesito cambiar mi numero de telefono registrado.'),
('000006', 2, 'OUTBOUND', 'AI', 'Para actualizar tu telefono debes validar identidad y confirmar el nuevo numero desde tu cuenta.'),
('000007', 1, 'INBOUND', 'CUSTOMER', 'El tipo de cambio final fue distinto al que vi al principio.'),
('000007', 2, 'OUTBOUND', 'AGENT', 'El tipo de cambio puede variar hasta confirmar la operacion. Revisare el comprobante para darte detalle.'),
('000008', 1, 'INBOUND', 'CUSTOMER', 'Me enviaron dinero desde Argentina y no aparece en mi cuenta.'),
('000008', 2, 'OUTBOUND', 'AGENT', 'Confirmamos la recepcion y el abono ya fue aplicado en tu cuenta Global66.'),
('000009', 1, 'INBOUND', 'CUSTOMER', 'Mi cuenta aparece bloqueada y necesito enviar dinero urgente.'),
('000009', 2, 'OUTBOUND', 'AGENT', 'Tu cuenta esta con bloqueo preventivo. Te pediremos validacion adicional para proteger tus fondos.'),
('000010', 1, 'INBOUND', 'CUSTOMER', 'Cual es el horario de atencion?'),
('000010', 2, 'OUTBOUND', 'AI', 'Nuestro horario de atencion es de lunes a viernes en horario habil. Tambien puedes dejar tu solicitud por WhatsApp.'),
('000011', 1, 'INBOUND', 'CUSTOMER', 'Subi mi carnet y me lo rechazaron, no entiendo por que.'),
('000011', 2, 'OUTBOUND', 'AGENT', 'El documento fue rechazado por baja nitidez. Sube una foto completa, vigente y sin reflejos.'),
('000012', 1, 'INBOUND', 'CUSTOMER', 'Cuanto puedo enviar a Colombia en una transferencia?'),
('000012', 2, 'OUTBOUND', 'AI', 'Los limites dependen de tu nivel de verificacion y del pais destino. Puedes revisar tu limite disponible antes de enviar.'),
('000013', 1, 'INBOUND', 'CUSTOMER', 'Mi cuenta esta en revision hace varios dias.'),
('000013', 2, 'OUTBOUND', 'AGENT', 'La revision puede requerir validaciones adicionales. Mantendremos el caso en seguimiento hasta tener respuesta.'),
('000014', 1, 'INBOUND', 'CUSTOMER', 'Mi tarjeta fue rechazada en un comercio aunque tenia saldo.'),
('000014', 2, 'OUTBOUND', 'AGENT', 'Revisamos la operacion y el rechazo vino desde el comercio. Puedes intentar nuevamente o usar otro medio.'),
('000015', 1, 'INBOUND', 'CUSTOMER', 'Perdi mi tarjeta Global66, necesito bloquearla ahora.'),
('000015', 2, 'OUTBOUND', 'AGENT', 'Bloquearemos preventivamente la tarjeta y te indicaremos los pasos para solicitar una reposicion.'),
('000016', 1, 'INBOUND', 'CUSTOMER', 'Me aparece una comision que no entiendo.'),
('000016', 2, 'OUTBOUND', 'AI', 'La comision puede corresponder al servicio de envio o conversion. Siempre se informa antes de confirmar.'),
('000017', 1, 'INBOUND', 'CUSTOMER', 'Necesito enviar un monto mayor y mi limite no alcanza.'),
('000017', 2, 'OUTBOUND', 'AGENT', 'Podemos revisar tu nivel de verificacion y solicitar antecedentes para evaluar aumento de limite.'),
('000018', 1, 'INBOUND', 'CUSTOMER', 'Como puedo recibir dinero desde Espana?'),
('000018', 2, 'OUTBOUND', 'AGENT', 'Te comparto los datos necesarios para recibir dinero y las condiciones de abono segun moneda y pais.'),
('000019', 1, 'INBOUND', 'CUSTOMER', 'Quiero actualizar el email de mi cuenta.'),
('000019', 2, 'OUTBOUND', 'AGENT', 'Por seguridad debemos validar tu identidad antes de cambiar el email registrado.'),
('000020', 1, 'INBOUND', 'CUSTOMER', 'Envie dinero a Mexico y mi familiar dice que no lo recibio.'),
('000020', 2, 'OUTBOUND', 'AGENT', 'Localizamos la transferencia y el banco receptor confirmo el abono. Te enviaremos el comprobante.'),
('000021', 1, 'INBOUND', 'CUSTOMER', 'Creo que alguien entro a mi cuenta, veo una operacion rara.'),
('000021', 2, 'OUTBOUND', 'AGENT', 'Bloquearemos preventivamente la cuenta y escalaremos el caso al equipo de seguridad.'),
('000022', 1, 'INBOUND', 'CUSTOMER', 'Que significa que mi transferencia este en proceso?'),
('000022', 2, 'OUTBOUND', 'AI', 'En proceso significa que la operacion esta siendo validada o enviada al banco receptor.'),
('000023', 1, 'INBOUND', 'CUSTOMER', 'Tengo un cargo en la tarjeta que no reconozco.'),
('000023', 2, 'OUTBOUND', 'AGENT', 'Registramos el desconocimiento de transaccion y revisaremos el movimiento con el equipo correspondiente.'),
('000024', 1, 'INBOUND', 'CUSTOMER', 'Me piden renovar mi documento, el anterior vencio.'),
('000024', 2, 'OUTBOUND', 'AGENT', 'Recibimos tu nuevo documento y la verificacion fue aprobada.'),
('000025', 1, 'INBOUND', 'CUSTOMER', 'No puedo iniciar sesion, no llega el SMS.'),
('000025', 2, 'OUTBOUND', 'AGENT', 'Revisare el envio del codigo y validare que el numero registrado este correcto.'),
('000026', 1, 'INBOUND', 'CUSTOMER', 'Por que cambio el tipo de cambio al finalizar?'),
('000026', 2, 'OUTBOUND', 'AI', 'El tipo de cambio puede actualizarse hasta la confirmacion final segun mercado y disponibilidad.'),
('000027', 1, 'INBOUND', 'CUSTOMER', 'Mi transferencia a Ecuador sigue pendiente.'),
('000027', 2, 'OUTBOUND', 'AGENT', 'El banco receptor esta validando el abono. Mantendremos el caso en stand by hasta recibir confirmacion.'),
('000028', 1, 'INBOUND', 'CUSTOMER', 'Cuanto cuesta enviar dinero a Argentina?'),
('000028', 2, 'OUTBOUND', 'AI', 'La comision se calcula antes de confirmar y depende del monto, moneda y pais destino.'),
('000029', 1, 'INBOUND', 'CUSTOMER', 'Mi cuenta quedo en revision despues de subir documentos.'),
('000029', 2, 'OUTBOUND', 'AGENT', 'Estamos revisando tus antecedentes KYC. Te avisaremos si necesitamos informacion adicional.'),
('000030', 1, 'INBOUND', 'CUSTOMER', 'Mi tarjeta fue rechazada comprando online.'),
('000030', 2, 'OUTBOUND', 'AGENT', 'El rechazo se origino por reglas del comercio. Puedes intentar nuevamente o bloquear la tarjeta si sospechas fraude.'),
('000031', 1, 'INBOUND', 'CUSTOMER', 'Me enviaron dinero desde Peru y no aparece.'),
('000031', 2, 'OUTBOUND', 'AGENT', 'Revisaremos la recepcion y si el banco emisor ya libero los fondos.'),
('000032', 1, 'INBOUND', 'CUSTOMER', 'Necesito actualizar mis datos personales.'),
('000032', 2, 'OUTBOUND', 'AGENT', 'Tus datos fueron actualizados luego de validar tu identidad.'),
('000033', 1, 'INBOUND', 'CUSTOMER', 'Hice una transferencia a Colombia y no ha llegado.'),
('000033', 2, 'OUTBOUND', 'AGENT', 'Revisare tu transferencia y pedire confirmacion al area de pagos.'),
('000034', 1, 'INBOUND', 'CUSTOMER', 'Cual es mi limite diario de transferencia?'),
('000034', 2, 'OUTBOUND', 'AI', 'Tu limite diario depende del nivel de verificacion y se muestra antes de iniciar la operacion.'),
('000035', 1, 'INBOUND', 'CUSTOMER', 'Mi cuenta fue bloqueada por actividad inusual.'),
('000035', 2, 'OUTBOUND', 'AGENT', 'El bloqueo es preventivo. Necesitamos validar algunos datos para reactivar la cuenta.'),
('000036', 1, 'INBOUND', 'CUSTOMER', 'Que significa cuenta en revision?'),
('000036', 2, 'OUTBOUND', 'AI', 'Cuenta en revision significa que estamos validando informacion para cumplir medidas de seguridad y normativa.'),
('000037', 1, 'INBOUND', 'CUSTOMER', 'Perdi mi tarjeta durante un viaje.'),
('000037', 2, 'OUTBOUND', 'AGENT', 'Bloquearemos tu tarjeta de inmediato para evitar usos no autorizados.'),
('000038', 1, 'INBOUND', 'CUSTOMER', 'Mi transferencia a Bolivia se demoro varios dias.'),
('000038', 2, 'OUTBOUND', 'AGENT', 'El abono fue confirmado por el banco receptor. Te enviaremos el comprobante actualizado.'),
('000039', 1, 'INBOUND', 'CUSTOMER', 'No reconozco un cargo hecho con mi tarjeta.'),
('000039', 2, 'OUTBOUND', 'AGENT', 'Registramos el desconocimiento y recomendamos bloquear la tarjeta mientras investigamos.'),
('000040', 1, 'INBOUND', 'CUSTOMER', 'Como recibo dinero desde otro pais en mi cuenta?'),
('000040', 2, 'OUTBOUND', 'AI', 'Puedes recibir dinero desde el extranjero siguiendo las instrucciones de recepcion y validando los datos de tu cuenta.');

insert into public.messages (
  id, case_id, direction, sender_type, body, created_at, channel, message_type,
  external_message_id
)
select
  gen_random_uuid(),
  sci.id,
  sm.direction,
  sm.sender_type,
  sm.body,
  c.created_at + ((sm.msg_order * 12) || ' minutes')::interval,
  c.channel,
  'TEXT',
  'demo-g66-' || sm.case_number || '-' || sm.msg_order
from seed_messages sm
join seed_case_ids sci on sci.case_number = sm.case_number
join public.cases c on c.id = sci.id;

insert into public.knowledge_articles (
  id, title, content, category, is_active, created_at, updated_at
) values
(gen_random_uuid(), 'Horario de atención', 'El equipo de soporte atiende solicitudes por canales digitales. Las consultas pueden quedar registradas fuera de horario y serán revisadas por orden de ingreso.', 'CONSULTA', true, now(), now()),
(gen_random_uuid(), 'Cuánto demora una transferencia internacional', 'Las transferencias internacionales pueden tardar entre 1 y 3 días hábiles dependiendo del país destino, moneda, banco receptor y validaciones adicionales.', 'CONSULTA', true, now(), now()),
(gen_random_uuid(), 'Estados de una transferencia', 'Una transferencia puede estar creada, en revisión, en proceso, enviada, abonada o rechazada. En proceso indica que aún se están completando validaciones o comunicación con el banco receptor.', 'CONSULTA', true, now(), now()),
(gen_random_uuid(), 'Qué hacer si una transferencia no llega', 'Si una transferencia no llega dentro del plazo estimado, se debe revisar comprobante, datos del destinatario, banco receptor y eventuales validaciones pendientes.', 'RECLAMO', true, now(), now()),
(gen_random_uuid(), 'Por qué una cuenta queda en revisión', 'Una cuenta puede quedar en revisión por controles de seguridad, validación de identidad, actividad inusual o requerimientos regulatorios.', 'DOCUMENTACION', true, now(), now()),
(gen_random_uuid(), 'Documentos válidos para verificación', 'Para verificar identidad se aceptan documentos vigentes, legibles, completos y sin reflejos. La imagen debe mostrar todos los datos solicitados.', 'DOCUMENTACION', true, now(), now()),
(gen_random_uuid(), 'Tarjeta rechazada', 'Una tarjeta puede ser rechazada por comercio no habilitado, fondos insuficientes, validaciones de seguridad o restricciones del procesador.', 'RECLAMO', true, now(), now()),
(gen_random_uuid(), 'Bloqueo de tarjeta', 'Ante pérdida, robo o transacción sospechosa, se recomienda bloquear la tarjeta de inmediato y contactar soporte para revisión.', 'RECLAMO', true, now(), now()),
(gen_random_uuid(), 'Límites de transferencia', 'Los límites de transferencia dependen del nivel de verificación, perfil de riesgo, país destino y políticas internas.', 'CONSULTA', true, now(), now()),
(gen_random_uuid(), 'Comisiones', 'Las comisiones se informan antes de confirmar la operación y pueden depender del monto, moneda, destino y método utilizado.', 'FACTURACION', true, now(), now()),
(gen_random_uuid(), 'Tipo de cambio', 'El tipo de cambio puede variar hasta el momento de confirmación. El valor final se muestra antes de aceptar la operación.', 'CONSULTA', true, now(), now()),
(gen_random_uuid(), 'Actualización de datos personales', 'Para actualizar teléfono, email u otros datos personales puede requerirse validación de identidad por seguridad.', 'DOCUMENTACION', true, now(), now()),
(gen_random_uuid(), 'Seguridad y transacciones desconocidas', 'Si un cliente desconoce una transacción, se debe registrar el caso, recomendar bloqueo preventivo y escalar a revisión de seguridad.', 'RECLAMO', true, now(), now()),
(gen_random_uuid(), 'Recepción de dinero desde el extranjero', 'Para recibir dinero desde el extranjero se deben usar los datos correctos de la cuenta y considerar tiempos de procesamiento del banco emisor y receptor.', 'CONSULTA', true, now(), now()),
(gen_random_uuid(), 'Soporte para problemas de acceso', 'Los problemas de inicio de sesión pueden deberse a códigos no recibidos, teléfono desactualizado o validación de dispositivo. Se debe confirmar identidad antes de modificar datos.', 'CONSULTA', true, now(), now());

commit;

select count(*) from public.customers;
select count(*) from public.cases;
select count(*) from public.messages;
select count(*) from public.knowledge_articles;
