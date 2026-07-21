import "server-only";

import { supabase } from "@/lib/supabase";
import {
  defaultChatSettings,
  type CrmQuickMessage,
  type CrmUserChatSettings,
  type QuickMessageInput,
} from "@/lib/whatsapp-chat-types";

const hexColorPattern = /^#[0-9a-f]{6}$/i;

function normalizeQuickMessageInput(input: QuickMessageInput) {
  const title = input.title?.trim();
  const content = input.content?.trim();
  const channel = input.channel?.trim().toUpperCase() || "WHATSAPP";

  if (!title || !content) {
    throw new Error("Título y contenido son requeridos.");
  }
  if (!["WHATSAPP", "GLOBAL"].includes(channel)) {
    throw new Error("Canal de mensaje rápido inválido.");
  }

  return {
    title,
    content,
    channel,
    category: input.category?.trim() || null,
    is_active: input.is_active ?? true,
  };
}

export async function listQuickMessages(includeInactive = false) {
  let query = supabase
    .from("crm_quick_messages")
    .select("*")
    .is("deleted_at", null)
    .or("channel.eq.WHATSAPP,channel.eq.GLOBAL,channel.is.null")
    .order("updated_at", { ascending: false });

  if (!includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query.returns<CrmQuickMessage[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createQuickMessage(input: QuickMessageInput, userId: string) {
  const payload = normalizeQuickMessageInput(input);
  const { data, error } = await supabase
    .from("crm_quick_messages")
    .insert({ ...payload, created_by: userId })
    .select("*")
    .single<CrmQuickMessage>();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateQuickMessage(id: string, input: QuickMessageInput) {
  const payload = normalizeQuickMessageInput(input);
  const { data, error } = await supabase
    .from("crm_quick_messages")
    .update(payload)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single<CrmQuickMessage>();

  if (error) throw new Error(error.message);
  return data;
}

export async function softDeleteQuickMessage(id: string) {
  const { error } = await supabase
    .from("crm_quick_messages")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

export async function getChatSettings(userId: string) {
  const { data, error } = await supabase
    .from("crm_user_chat_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<CrmUserChatSettings>();

  if (error) throw new Error(error.message);
  return data ? { ...defaultChatSettings, ...data } : defaultChatSettings;
}

export async function updateChatSettings(
  userId: string,
  input: Partial<CrmUserChatSettings>,
) {
  const colorKeys = [
    "my_conversation_border_color",
    "my_conversation_text_color",
    "my_notes_border_color",
    "my_notes_text_color",
    "customer_conversation_border_color",
    "customer_conversation_text_color",
  ] as const;
  const current = await getChatSettings(userId);
  const payload: CrmUserChatSettings = {
    ...current,
    enter_to_send: input.enter_to_send ?? current.enter_to_send,
  };

  for (const key of colorKeys) {
    const value = input[key] ?? current[key];
    if (!hexColorPattern.test(value)) {
      throw new Error(`Color inválido para ${key}.`);
    }
    payload[key] = value.toUpperCase();
  }

  const values = {
    enter_to_send: payload.enter_to_send,
    my_conversation_border_color: payload.my_conversation_border_color,
    my_conversation_text_color: payload.my_conversation_text_color,
    my_notes_border_color: payload.my_notes_border_color,
    my_notes_text_color: payload.my_notes_text_color,
    customer_conversation_border_color: payload.customer_conversation_border_color,
    customer_conversation_text_color: payload.customer_conversation_text_color,
  };
  const { data, error } = await supabase
    .from("crm_user_chat_settings")
    .upsert({ ...values, user_id: userId }, { onConflict: "user_id" })
    .select("*")
    .single<CrmUserChatSettings>();

  if (error) throw new Error(error.message);
  return data;
}
