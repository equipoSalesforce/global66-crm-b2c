import { buildEmailHtmlFromText } from "./email-html";
import { sendEmail } from "./email-send";
import {
  normalizeEmailSubject,
  normalizeMessageId,
} from "./email-threading";
import { getCaseWhatsappTarget } from "./case-whatsapp";
import { supabase } from "./supabase";
import { sendWhatsappMessage } from "./whatsapp-send";

export const macroActionTypes = [
  "UPDATE_CASE_FIELDS",
  "ADD_INTERNAL_NOTE",
  "SEND_REPLY",
  "CLOSE_CASE",
  "ESCALATE_CASE",
] as const;

export type MacroActionType = (typeof macroActionTypes)[number];

export type MacroRecord = {
  id: string;
  name: string;
  description: string | null;
  target_object: string;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MacroActionRecord = {
  id?: string;
  macro_id?: string | null;
  action_type: MacroActionType | string;
  sort_order: number | null;
  payload: Record<string, unknown>;
  created_at?: string | null;
};

type MacroCaseRecord = {
  id: string;
  subject: string | null;
  channel: string | null;
  contact_type: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string | null;
  lifecycle_status: string | null;
  routing_status: string | null;
  assigned_at?: string | null;
  first_response_at: string | null;
  email_thread_id?: string | null;
  email_subject_key?: string | null;
  last_email_message_id?: string | null;
  customer:
    | {
        email: string | null;
        phone: string | null;
      }
    | {
        email: string | null;
        phone: string | null;
      }[]
    | null;
};

type MacroActionResult = {
  action_type: string;
  sort_order: number | null;
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
};

const editableCaseFields = [
  "priority",
  "area",
  "category",
  "contact_type",
  "resolution_type",
  "lifecycle_status",
  "routing_status",
  "status",
  "assigned_agent_id",
] as const;

const validCaseStatuses = [
  "AI_HANDLING",
  "HUMAN_REQUIRED",
  "ASSIGNED",
  "CLOSED",
];

const validRoutingStatuses = [
  "UNASSIGNED",
  "AI_HANDLING",
  "HUMAN_REQUIRED",
  "ASSIGNED",
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getCustomerEmail(caseItem: MacroCaseRecord) {
  const customer = Array.isArray(caseItem.customer)
    ? caseItem.customer[0]
    : caseItem.customer;

  return customer?.email || caseItem.contact_email || "";
}

function normalizeReplyChannel(channel: string, caseItem: MacroCaseRecord) {
  const upperChannel = channel.toUpperCase();

  if (upperChannel === "AUTO") {
    const caseChannel = (caseItem.channel || caseItem.contact_type || "").toUpperCase();

    return caseChannel === "WHATSAPP" ? "WHATSAPP" : "GMAIL";
  }

  return upperChannel;
}

function buildUpdatePayload(payload: Record<string, unknown>) {
  const updatePayload: Record<string, unknown> = {};

  for (const field of editableCaseFields) {
    const value = payload[field];

    if (value === undefined) continue;

    if (field === "status") {
      const status = getString(value).toUpperCase();

      if (validCaseStatuses.includes(status)) {
        updatePayload.status = status;
      }
      continue;
    }

    if (field === "routing_status") {
      const routingStatus = getString(value).toUpperCase();

      if (validRoutingStatuses.includes(routingStatus)) {
        updatePayload.routing_status = routingStatus;
      }
      continue;
    }

    updatePayload[field] = typeof value === "string" ? value.trim() || null : value;
  }

  if (updatePayload.lifecycle_status === "CLOSED") {
    updatePayload.status = "CLOSED";
    updatePayload.closed_at = new Date().toISOString();
  }

  if (updatePayload.assigned_agent_id) {
    updatePayload.assigned_at = new Date().toISOString();
  }

  updatePayload.updated_at = new Date().toISOString();

  return updatePayload;
}

async function insertInternalMessage(caseId: string, body: string) {
  const { error } = await supabase.from("messages").insert({
    case_id: caseId,
    channel: "INTERNAL",
    message_type: "NOTE",
    direction: "OUTBOUND",
    sender_type: "AGENT",
    body,
  });

  if (error) throw new Error(error.message);
}

async function sendMacroEmail({
  caseItem,
  body,
  subject,
}: {
  caseItem: MacroCaseRecord;
  body: string;
  subject: string;
}) {
  const to = getCustomerEmail(caseItem);

  if (!to) {
    throw new Error("El caso no tiene email de contacto para enviar correo.");
  }

  const sendResult = await sendEmail({
    to,
    subject,
    body,
    inReplyTo: normalizeMessageId(caseItem.last_email_message_id),
    references: normalizeMessageId(caseItem.last_email_message_id),
  });
  const now = new Date().toISOString();
  const providerMessageId = sendResult.provider_message_id;
  const normalizedProviderMessageId = normalizeMessageId(providerMessageId);
  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      case_id: caseItem.id,
      channel: "GMAIL",
      message_type: "EMAIL",
      direction: "OUTBOUND",
      sender_type: "AGENT",
      body,
      email_text_body: body,
      email_html_body: buildEmailHtmlFromText(body),
      email_subject: subject,
      email_from: process.env.GMAIL_EMAIL?.trim() || null,
      email_to: to,
      in_reply_to: normalizeMessageId(caseItem.last_email_message_id),
      email_references: caseItem.last_email_message_id
        ? [normalizeMessageId(caseItem.last_email_message_id)]
        : null,
      external_message_id: providerMessageId,
      email_message_id: normalizedProviderMessageId,
      created_at: now,
    })
    .select("id")
    .single();

  if (messageError) throw new Error(messageError.message);

  const { error: caseError } = await supabase
    .from("cases")
    .update({
      updated_at: now,
      first_response_at: caseItem.first_response_at || now,
      email_thread_id:
        caseItem.email_thread_id || normalizedProviderMessageId || caseItem.id,
      email_subject_key:
        caseItem.email_subject_key || normalizeEmailSubject(subject),
      last_email_message_id:
        normalizedProviderMessageId || caseItem.last_email_message_id || null,
    })
    .eq("id", caseItem.id);

  if (caseError) throw new Error(caseError.message);

  return {
    providerMessageId,
    messageId: message?.id ?? null,
  };
}

async function sendMacroWhatsapp(caseItem: MacroCaseRecord, body: string) {
  const target = await getCaseWhatsappTarget(caseItem.id);

  if (!target.ok) throw new Error(target.error);
  if (!target.isWhatsapp || !target.phone) {
    throw new Error("El caso no tiene teléfono WhatsApp disponible.");
  }

  const sendResult = await sendWhatsappMessage(target.phone, body);

  if (!sendResult.ok) throw new Error(sendResult.error);

  const { error } = await supabase.from("messages").insert({
    case_id: caseItem.id,
    channel: "WHATSAPP",
    message_type: "TEXT",
    direction: "OUTBOUND",
    sender_type: "AGENT",
    body,
  });

  if (error) throw new Error(error.message);

  return {
    phone: target.phone,
    metaResponse: sendResult.response,
  };
}

export async function runMacro({
  macroId,
  targetObject,
  targetId,
  executedBy,
}: {
  macroId: string;
  targetObject: string;
  targetId: string;
  executedBy?: string;
}) {
  const { data: macro, error: macroError } = await supabase
    .from("macros")
    .select("id, name, description, target_object, is_active, created_at, updated_at")
    .eq("id", macroId)
    .single<MacroRecord>();

  if (macroError || !macro) {
    throw new Error(macroError?.message || "Macro no encontrada.");
  }

  const { data: actions, error: actionsError } = await supabase
    .from("macro_actions")
    .select("id, macro_id, action_type, sort_order, payload, created_at")
    .eq("macro_id", macroId)
    .order("sort_order", { ascending: true })
    .returns<MacroActionRecord[]>();

  if (actionsError) throw new Error(actionsError.message);
  if (targetObject !== "CASE" || macro.target_object !== "CASE") {
    throw new Error("Esta macro solo soporta casos.");
  }

  const { data: caseItem, error: caseError } = await supabase
    .from("cases")
    .select(
      "id, subject, channel, contact_type, contact_email, contact_phone, status, lifecycle_status, routing_status, assigned_at, first_response_at, email_thread_id, email_subject_key, last_email_message_id, customer:customers(email, phone)",
    )
    .eq("id", targetId)
    .single<MacroCaseRecord>();

  if (caseError || !caseItem) {
    throw new Error(caseError?.message || "Caso no encontrado.");
  }

  const results: MacroActionResult[] = [];

  for (const action of actions ?? []) {
    try {
      if (action.action_type === "UPDATE_CASE_FIELDS") {
        const updatePayload = buildUpdatePayload(action.payload ?? {});
        const { error } = await supabase
          .from("cases")
          .update(updatePayload)
          .eq("id", targetId);

        if (error) throw new Error(error.message);

        Object.assign(caseItem, updatePayload);
        results.push({
          action_type: action.action_type,
          sort_order: action.sort_order,
          ok: true,
          message: "Campos del caso actualizados.",
          details: updatePayload,
        });
        continue;
      }

      if (action.action_type === "ADD_INTERNAL_NOTE") {
        const note = getString(action.payload?.note);

        if (!note) throw new Error("La nota interna está vacía.");

        await insertInternalMessage(targetId, note);
        results.push({
          action_type: action.action_type,
          sort_order: action.sort_order,
          ok: true,
          message: "Nota interna agregada.",
        });
        continue;
      }

      if (action.action_type === "SEND_REPLY") {
        const body = getString(action.payload?.body);
        const subject =
          getString(action.payload?.subject) ||
          caseItem.subject ||
          "Respuesta de soporte";
        const channel = normalizeReplyChannel(
          getString(action.payload?.channel) || "INTERNAL",
          caseItem,
        );

        if (!body) throw new Error("La respuesta está vacía.");

        if (channel === "INTERNAL") {
          await insertInternalMessage(targetId, body);
          results.push({
            action_type: action.action_type,
            sort_order: action.sort_order,
            ok: true,
            message: "Respuesta interna registrada.",
          });
          continue;
        }

        if (channel === "GMAIL") {
          const details = await sendMacroEmail({ caseItem, body, subject });
          results.push({
            action_type: action.action_type,
            sort_order: action.sort_order,
            ok: true,
            message: "Correo enviado.",
            details,
          });
          continue;
        }

        if (channel === "WHATSAPP") {
          const details = await sendMacroWhatsapp(caseItem, body);
          results.push({
            action_type: action.action_type,
            sort_order: action.sort_order,
            ok: true,
            message: "WhatsApp enviado.",
            details,
          });
          continue;
        }

        throw new Error(`Canal no soportado: ${channel}`);
      }

      if (action.action_type === "CLOSE_CASE") {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from("cases")
          .update({
            lifecycle_status: "CLOSED",
            status: "CLOSED",
            closed_at: now,
            updated_at: now,
          })
          .eq("id", targetId);

        if (error) throw new Error(error.message);

        caseItem.lifecycle_status = "CLOSED";
        caseItem.status = "CLOSED";
        results.push({
          action_type: action.action_type,
          sort_order: action.sort_order,
          ok: true,
          message: "Caso cerrado.",
        });
        continue;
      }

      if (action.action_type === "ESCALATE_CASE") {
        const priority = getString(action.payload?.priority) || "HIGH";
        const { error } = await supabase
          .from("cases")
          .update({
            routing_status: "HUMAN_REQUIRED",
            status: "HUMAN_REQUIRED",
            priority,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetId);

        if (error) throw new Error(error.message);

        caseItem.routing_status = "HUMAN_REQUIRED";
        caseItem.status = "HUMAN_REQUIRED";
        results.push({
          action_type: action.action_type,
          sort_order: action.sort_order,
          ok: true,
          message: "Caso escalado.",
          details: { priority },
        });
        continue;
      }

      throw new Error(`Tipo de acción no soportado: ${action.action_type}`);
    } catch (error) {
      results.push({
        action_type: action.action_type,
        sort_order: action.sort_order,
        ok: false,
        message: getErrorMessage(error),
      });
    }
  }

  const failedActions = results.filter((result) => !result.ok);
  const status = failedActions.length > 0 ? "PARTIAL_ERROR" : "SUCCESS";

  await insertInternalMessage(targetId, `Macro ejecutada: ${macro.name}`);

  const { data: run, error: runError } = await supabase
    .from("macro_runs")
    .insert({
      macro_id: macroId,
      target_object: targetObject,
      target_id: targetId,
      executed_by: executedBy || null,
      status,
      result: {
        macro_name: macro.name,
        actions: results,
      },
    })
    .select("id, status, result, created_at")
    .single();

  if (runError) throw new Error(runError.message);

  return {
    ok: failedActions.length === 0,
    status,
    macro,
    run,
    results,
  };
}
