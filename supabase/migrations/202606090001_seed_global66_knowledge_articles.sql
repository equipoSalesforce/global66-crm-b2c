delete from public.knowledge_articles
where title in (
  'Horarios de atención Global66',
  'Cómo enviar una transferencia internacional',
  'Transferencia no recibida',
  'Comisiones y tipo de cambio',
  'Cuenta bloqueada o problemas de acceso',
  'Movimiento desconocido',
  'Comprobante o archivo adjunto'
);

insert into public.knowledge_articles (id, title, content, category, is_active, created_at, updated_at)
values
(
  gen_random_uuid(),
  'Horarios de atención Global66',
  'El horario de atención de Global66 es de lunes a viernes de 09:00 a 18:00. Si el cliente escribe fuera de horario, se debe informar que un ejecutivo responderá en el próximo horario hábil.',
  'CONSULTA',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'Cómo enviar una transferencia internacional',
  'Para enviar dinero con Global66, el cliente debe iniciar una transferencia, elegir el país destino, ingresar los datos del destinatario, revisar el monto, tipo de cambio y comisión antes de confirmar, y confirmar la operación. Si tiene dudas, preguntar desde qué país hará el envío y hacia qué país enviará.',
  'CONSULTA',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'Transferencia no recibida',
  'Si un cliente indica que una transferencia no fue recibida, solicitar país destino, monto aproximado, fecha de envío, correo asociado y comprobante. Indicar que el tiempo puede variar según país destino, banco receptor y validaciones internas.',
  'PAGO',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'Comisiones y tipo de cambio',
  'Si el cliente consulta por una comisión o tipo de cambio, explicar que antes de confirmar una operación se muestra el monto, comisión y tipo de cambio aplicado. Si desconoce un cobro, derivar a revisión.',
  'FACTURACION',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'Cuenta bloqueada o problemas de acceso',
  'Si el cliente no puede ingresar a su cuenta, pedir correo o teléfono asociado y validar si el problema corresponde a contraseña, verificación de identidad o bloqueo preventivo. No pedir claves ni códigos de seguridad.',
  'ACCESO',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'Movimiento desconocido',
  'Si el cliente reporta una transacción desconocida, marcar prioridad alta, solicitar fecha, monto, moneda y últimos 4 dígitos o referencia visible. Derivar a un ejecutivo.',
  'RECLAMO',
  true,
  now(),
  now()
),
(
  gen_random_uuid(),
  'Comprobante o archivo adjunto',
  'Si el cliente envía imagen, documento o comprobante, confirmar recepción del archivo y derivar a revisión si requiere validación manual.',
  'DOCUMENTACION',
  true,
  now(),
  now()
);
