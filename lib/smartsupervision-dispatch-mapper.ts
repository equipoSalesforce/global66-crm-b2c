import "server-only";

import {
  readSmartSupervisionValue,
  smartSupervisionString,
} from "@/lib/smartsupervision-payload";
import type {
  SmartSupervisionCaseSnapshot,
  SmartSupervisionJson,
  SmartSupervisionPayloadBuildResult,
} from "@/lib/smartsupervision-types";

function customValues(snapshot: SmartSupervisionCaseSnapshot) {
  return new Map(
    snapshot.caseCustomFieldValues.map((field) => [field.fieldKey.toLowerCase(), field.value]),
  );
}

function findObjectValue(object: SmartSupervisionJson | null, key: string) {
  if (!object) return null;
  return readSmartSupervisionValue(object, key);
}

function resolveValue(
  snapshot: SmartSupervisionCaseSnapshot,
  fieldKey: string,
  aliases: string[] = [],
) {
  const keys = [fieldKey, ...aliases];
  const custom = customValues(snapshot);
  for (const key of keys) {
    const value = custom.get(key.toLowerCase());
    if (value !== null && value !== undefined && value !== "") return value;
  }
  for (const key of keys) {
    const value = findObjectValue(snapshot.case, key);
    if (value !== null) return value;
  }
  for (const key of keys) {
    const value = findObjectValue(snapshot.customerOperationalProfile, key);
    if (value !== null) return value;
    const sourcePayload = snapshot.customerOperationalProfile?.source_payload;
    if (sourcePayload && typeof sourcePayload === "object") {
      const sourceValue = readSmartSupervisionValue(
        sourcePayload as SmartSupervisionJson,
        key,
      );
      if (sourceValue !== null) return sourceValue;
    }
  }
  return readSmartSupervisionValue(
    snapshot.smartsupervisionComplaint.source_payload,
    ...keys,
  );
}

function commonDispatchPayload(snapshot: SmartSupervisionCaseSnapshot) {
  const source = snapshot.smartsupervisionComplaint.source_payload;
  const customer = snapshot.customer;
  const canal = resolveValue(snapshot, "canal__c");
  const puntoRecepcion = resolveValue(snapshot, "punto_recepcion") ??
    (smartSupervisionString(canal)?.toLowerCase() === "internet" ? "Web" : null);

  return {
    Case_id: snapshot.externalReference.external_system_id ??
      readSmartSupervisionValue(source, "Case_id"),
    Smart_Code__c: snapshot.externalReference.external_reference,
    CreatedDate: snapshot.case.created_at,
    SuppliedName: findObjectValue(customer, "name") ?? resolveValue(snapshot, "SuppliedName", ["contact_name"]),
    SC_id_type__c: resolveValue(snapshot, "SC_id_type__c", ["document_type"]),
    id_number__c: resolveValue(snapshot, "id_number__c", ["document_number"]),
    sc_genero__c: resolveValue(snapshot, "sc_genero__c"),
    tipo_de_persona__c: resolveValue(snapshot, "tipo_de_persona__c", ["customer_type"]),
    sc_LGBTIQ__c: resolveValue(snapshot, "sc_LGBTIQ__c"),
    sc_Condicion_especial__c: resolveValue(snapshot, "sc_Condicion_especial__c"),
    SuppliedPhone: findObjectValue(customer, "phone") ?? resolveValue(snapshot, "SuppliedPhone", ["contact_phone"]),
    SuppliedEmail: findObjectValue(customer, "email") ?? resolveValue(snapshot, "SuppliedEmail", ["contact_email"]),
    direccion__c: resolveValue(snapshot, "direccion__c"),
    Departamento__c: resolveValue(snapshot, "Departamento__c"),
    SC_municipio__c: resolveValue(snapshot, "SC_municipio__c"),
    canal__c: canal,
    punto_recepcion: puntoRecepcion,
    Instancia_de_recepcion__c: resolveValue(snapshot, "Instancia_de_recepcion__c"),
    admision_col__c: resolveValue(snapshot, "admision_col__c") ?? "No Aplica",
    Description: resolveValue(snapshot, "Description", ["description"]),
    smart_anexo_queja__c: resolveValue(snapshot, "smart_anexo_queja__c"),
    Tutela__c: resolveValue(snapshot, "Tutela__c") ?? "No",
    Ente_de_control__c: resolveValue(snapshot, "Ente_de_control__c") ?? "Otros",
    smart_escalamiento_DCF__c: resolveValue(snapshot, "smart_escalamiento_DCF__c"),
    Product__c: resolveValue(snapshot, "Product__c", ["product"]),
    smart_Producto_nombre__c: resolveValue(snapshot, "smart_Producto_nombre__c"),
    Categorias_COL__c: resolveValue(snapshot, "Categorias_COL__c"),
    archivos_s3: resolveValue(snapshot, "archivos_s3") ?? [],
    producto_digital__c: resolveValue(snapshot, "Producto_digital__c", ["producto_digital__c"]) ?? "Si",
    tipo_fraude__c: resolveValue(snapshot, "Tipo_Fraude__c", ["tipo_fraude__c"]),
    modalidad_fraude__c: resolveValue(snapshot, "Modalidad_Fraude__c", ["modalidad_fraude__c"]),
    card_amount__c: resolveValue(snapshot, "card_amount__c"),
    Total_Devuelto_por_Desconocimiento__c: resolveValue(
      snapshot,
      "Total_Devuelto_por_Desconocimiento__c",
    ),
    nombre_archivo_fraude: resolveValue(snapshot, "nombre_archivo_fraude"),
    Favorabilidad__c: resolveValue(snapshot, "Favorabilidad__c"),
    a_favor_de__c: resolveValue(snapshot, "a_favor_de__c"),
    Aceptacion__c: resolveValue(snapshot, "Aceptacion__c"),
    Rectificacion__c: resolveValue(snapshot, "Rectificacion__c"),
    Prorroga__c: resolveValue(snapshot, "Prorroga__c") ?? "No",
  } satisfies SmartSupervisionJson;
}

const requiredDispatchFields = [
  "CreatedDate",
  "SuppliedName",
  "SC_id_type__c",
  "id_number__c",
  "sc_genero__c",
  "tipo_de_persona__c",
  "sc_LGBTIQ__c",
  "sc_Condicion_especial__c",
  "direccion__c",
  "Departamento__c",
  "SC_municipio__c",
  "canal__c",
  "punto_recepcion",
  "Instancia_de_recepcion__c",
  "Description",
  "smart_anexo_queja__c",
  "smart_escalamiento_DCF__c",
  "Product__c",
  "Categorias_COL__c",
] as const;

function validatePayload(payload: SmartSupervisionJson): SmartSupervisionPayloadBuildResult {
  const missingFields = requiredDispatchFields.filter((field) => {
    const value = payload[field];
    return value === null || value === undefined || value === "";
  });
  return missingFields.length > 0
    ? {
        ok: false,
        missingFields: [...missingFields],
        message: `Faltan campos obligatorios: ${missingFields.join(", ")}.`,
      }
    : { ok: true, payload };
}

export function buildSmartSupervisionMoment2Payload(
  snapshot: SmartSupervisionCaseSnapshot,
) {
  return validatePayload({
    ...commonDispatchPayload(snapshot),
    Status: "In Progress",
  });
}

export function buildSmartSupervisionMoment3Payload(
  snapshot: SmartSupervisionCaseSnapshot,
) {
  if (!snapshot.lastOutboundEmailHtml) {
    return {
      ok: false as const,
      missingFields: ["cuerpo_respuesta_final"],
      message: "No existe un correo saliente para construir cuerpo_respuesta_final.",
    };
  }
  const closedAt = smartSupervisionString(snapshot.case.closed_at) ?? new Date().toISOString();
  return validatePayload({
    ...commonDispatchPayload(snapshot),
    Status: "Closed",
    ClosedDate: closedAt.slice(0, 10),
    cuerpo_respuesta_final: snapshot.lastOutboundEmailHtml.html,
  });
}

