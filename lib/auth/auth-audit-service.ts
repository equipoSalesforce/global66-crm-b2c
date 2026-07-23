import "server-only";

import type {
  AuthLoginEventType,
  AuthRequestContext,
} from "@/lib/auth/auth-types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type JsonObject = Record<string, unknown>;

export async function recordAuthLoginEvent(input: {
  email?: string | null;
  userId?: string | null;
  eventType: AuthLoginEventType;
  success?: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  context: AuthRequestContext;
  metadata?: JsonObject;
}) {
  const { error } = await getSupabaseAdmin().from("auth_login_events").insert({
    email: input.email ?? null,
    user_id: input.userId ?? null,
    event_type: input.eventType,
    success: input.success ?? false,
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage ?? null,
    ip_hash: input.context.ipHash,
    user_agent: input.context.userAgent,
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

export async function recordAuditEvent(input: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  beforeData?: JsonObject | null;
  afterData?: JsonObject | null;
  metadata?: JsonObject;
  context: AuthRequestContext;
}) {
  const { error } = await getSupabaseAdmin().from("audit_events").insert({
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    before_data: input.beforeData ?? null,
    after_data: input.afterData ?? null,
    metadata: input.metadata ?? {},
    ip_hash: input.context.ipHash,
    user_agent: input.context.userAgent,
  });
  if (error) throw error;
}
