export type Global66SupportIntent =
  | "SALUDO_GENERICO"
  | "HORARIO"
  | "TRANSFERENCIA_INTERNACIONAL"
  | "TRANSFERENCIA_NO_RECIBIDA"
  | "COMISIONES"
  | "ACCESO_CUENTA"
  | "REVISION_MANUAL"
  | "MOVIMIENTO_DESCONOCIDO"
  | "COMPROBANTE_ADJUNTO"
  | "DESCONOCIDO";

export const GLOBAL66_SUPPORT_SYSTEM_PROMPT = `Eres un agente de atención de Global66.

Objetivo:
- Resolver preguntas simples.
- Guiar al cliente.
- Solicitar únicamente los datos necesarios.
- Mantener una conversación natural.

Tono:
- Cercano.
- Profesional.
- Claro.
- Español latino.

Nunca:
- Pedir claves.
- Pedir códigos de seguridad.
- Inventar información.
- Repetir frases idénticas.

Variar redacción.
No derivar inmediatamente.

Solo derivar cuando:
- Hay sospecha de fraude.
- Hay movimientos desconocidos.
- Se requiere revisión manual.
- No entiendes la consulta.
- El cliente está molesto.
- El mensaje no tiene sentido.`;

const openerVariants = [
  "Hola 👋, encantado de ayudarte.",
  "Claro, revisemos tu caso.",
  "Gracias por escribirnos.",
  "Veamos lo ocurrido.",
  "Con gusto revisamos la situación.",
];

export function normalizeGlobal66Text(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickVariant(seed: string) {
  const normalizedSeed = normalizeGlobal66Text(seed);
  const charTotal = [...normalizedSeed].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );

  return openerVariants[charTotal % openerVariants.length];
}

export function classifyGlobal66Intent(
  message: string | null | undefined,
): Global66SupportIntent {
  const text = normalizeGlobal66Text(message ?? "");
  const hasTransferTerms =
    /\b(transferencia|transferir|envio|enviar|mande|mandar|giro|abono|plata|dinero)\b/.test(
      text,
    );

  if (!text) return "DESCONOCIDO";
  if (
    /^(hola|buenas|buenos dias|buenas tardes|buenas noches|necesito ayuda|ayuda|hola necesito ayuda|hola tengo una duda)(\s|$)/.test(
      text,
    ) &&
    !/\b(transferencia|comision|cargo|movimiento|entrar|ingresar|horario|cuenta|tarjeta)\b/.test(
      text,
    )
  ) {
    return "SALUDO_GENERICO";
  }
  if (/\b(horario|atienden|atencion|abren|cierran)\b/.test(text)) return "HORARIO";
  if (
    hasTransferTerms &&
    /\b(no llega|no llego|no ha llegado|demora|demoro|pendiente|no aparece|no recibida|no recibido)\b/.test(
      text,
    )
  ) {
    return "TRANSFERENCIA_NO_RECIBIDA";
  }
  if (
    hasTransferTerms &&
    /\b(transferencia internacional|enviar dinero|mandar dinero|pais destino|destino|argentina|peru|colombia|mexico|chile|brasil|uruguay|ecuador|bolivia)\b/.test(
      text,
    )
  ) {
    return "TRANSFERENCIA_INTERNACIONAL";
  }
  if (/\b(comision|comisiones|cobro|cargos|tarifa|costo|tipo de cambio|cambio)\b/.test(text)) {
    return "COMISIONES";
  }
  if (
    /\b(bloqueada|bloqueado|bloqueo|restringida|restringido|validacion de identidad|validar identidad|kyc|documento rechazado|rechazo de operacion|operacion rechazada|rechazada|rechazado)\b/.test(
      text,
    )
  ) {
    return "REVISION_MANUAL";
  }
  if (
    /\b(entrar|ingresar|acceder|acceso|login|clave|contrasena|codigo|cuenta)\b/.test(
      text,
    )
  ) {
    return "ACCESO_CUENTA";
  }
  if (
    /\b(movimiento|transaccion|operacion|cargo|compra|pago)\b/.test(text) &&
    /\b(desconozco|desconocido|reconozco|reconocer|fraude|sospechoso|no hice|no realice|no autorice)\b/.test(
      text,
    )
  ) {
    return "MOVIMIENTO_DESCONOCIDO";
  }
  if (/\b(comprobante|adjunto|archivo|captura|documento|imagen|foto)\b/.test(text)) {
    return "COMPROBANTE_ADJUNTO";
  }

  return "DESCONOCIDO";
}

export function buildGlobal66SupportReply({
  intent,
  latestMessage,
  forAgent = false,
}: {
  intent: Global66SupportIntent;
  latestMessage?: string | null;
  forAgent?: boolean;
}) {
  const opener = pickVariant(latestMessage ?? intent);

  switch (intent) {
    case "SALUDO_GENERICO":
      return "Hola 👋, con gusto te ayudo. ¿Sobre qué necesitas ayuda?\n\n• Transferencias internacionales\n• Acceso a cuenta\n• Comisiones o tipo de cambio\n• Tarjeta Global66\n• Otro tema";
    case "HORARIO":
      return "Nuestro horario de atención es de lunes a viernes de 09:00 a 18:00. Si nos escribes fuera de ese horario, un ejecutivo te responderá apenas estemos disponibles.";
    case "TRANSFERENCIA_INTERNACIONAL":
      return `${opener}

Para enviar dinero con Global66, inicia una transferencia, elige el país destino, ingresa los datos del destinatario, revisa el monto, tipo de cambio y comisión, y confirma la operación.

¿Desde qué país harás el envío?`;
    case "TRANSFERENCIA_NO_RECIBIDA":
      return `${opener}

¿Me puedes indicar aproximadamente cuándo realizaste la transferencia y si cuentas con el comprobante?

Así podremos revisar el estado de la operación.`;
    case "COMISIONES":
      return `${opener}

Antes de confirmar una operación, Global66 muestra el monto, la comisión y el tipo de cambio aplicado. Si quieres revisar un cobro específico, indícame la fecha y el monto aproximado.`;
    case "ACCESO_CUENTA":
      return `¿Qué mensaje de error aparece?

También puedes indicarme el correo asociado a tu cuenta.

Por seguridad, no compartas claves ni códigos.`;
    case "REVISION_MANUAL":
      return "Para revisar esto necesitamos que lo vea un ejecutivo. Te derivaré para que puedan ayudarte.";
    case "MOVIMIENTO_DESCONOCIDO":
      return `Lamento lo ocurrido.

Para revisarlo con prioridad, ¿me puedes indicar la fecha y el monto aproximado del movimiento?

Un ejecutivo revisará el caso.`;
    case "COMPROBANTE_ADJUNTO":
      return "Recibimos el archivo. Lo dejaremos asociado al caso y revisaremos si requiere validación manual.";
    default:
      return forAgent
        ? "Gracias por escribirnos. Para orientarte mejor, cuéntame qué necesitas revisar de tu cuenta Global66 o de una operación específica."
        : "No logré identificar con seguridad tu consulta. Te derivaré con un ejecutivo para que pueda ayudarte.";
  }
}

export function getGlobal66IntentCaseOverrides(intent: Global66SupportIntent) {
  if (intent === "TRANSFERENCIA_INTERNACIONAL") {
    return { area: "OPERACIONES", category: "CONSULTA", priority: "LOW" };
  }

  if (intent === "TRANSFERENCIA_NO_RECIBIDA") {
    return { area: "OPERACIONES", category: "PAGO", priority: "MEDIUM" };
  }

  if (intent === "COMISIONES") {
    return { area: "FACTURACION", category: "FACTURACION", priority: "MEDIUM" };
  }

  if (intent === "ACCESO_CUENTA") {
    return { area: "SOPORTE", category: "ACCESO", priority: "MEDIUM" };
  }

  if (intent === "REVISION_MANUAL") {
    return { area: "SOPORTE", category: "INCIDENCIA", priority: "MEDIUM" };
  }

  if (intent === "MOVIMIENTO_DESCONOCIDO") {
    return { area: "COMPLIANCE", category: "RECLAMO", priority: "HIGH" };
  }

  if (intent === "COMPROBANTE_ADJUNTO") {
    return { area: "SOPORTE", category: "DOCUMENTACION", priority: "MEDIUM" };
  }

  return null;
}

export function shouldEscalateGlobal66Intent(intent: Global66SupportIntent) {
  return (
    intent === "MOVIMIENTO_DESCONOCIDO" ||
    intent === "REVISION_MANUAL" ||
    intent === "DESCONOCIDO"
  );
}
