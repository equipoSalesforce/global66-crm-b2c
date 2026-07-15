import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CaseAssignmentNotification,
  CaseAssignmentNotificationsResponse,
} from "./case-assignment-notifications";

type NotificationRow = {
  id: string;
  case_id: string;
  case_number: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
};

function toNotification(row: NotificationRow): CaseAssignmentNotification {
  return {
    id: row.id,
    caseId: row.case_id,
    caseNumber: row.case_number,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function listCaseAssignmentNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<CaseAssignmentNotificationsResponse> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const [notificationsResult, unreadResult] = await Promise.all([
    supabase
      .from("case_assignment_notifications")
      .select("id, case_id, case_number, title, message, is_read, created_at, read_at")
      .eq("assigned_to_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(safeLimit)
      .returns<NotificationRow[]>(),
    supabase
      .from("case_assignment_notifications")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to_user_id", userId)
      .eq("is_read", false),
  ]);

  if (notificationsResult.error) throw notificationsResult.error;
  if (unreadResult.error) throw unreadResult.error;

  return {
    unreadCount: unreadResult.count ?? 0,
    notifications: (notificationsResult.data ?? []).map(toNotification),
  };
}

export async function markCaseAssignmentNotificationRead(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string,
) {
  const { data, error } = await supabase
    .from("case_assignment_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("assigned_to_user_id", userId)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) throw error;
  return Boolean(data);
}

export async function markAllCaseAssignmentNotificationsRead(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("case_assignment_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("assigned_to_user_id", userId)
    .eq("is_read", false)
    .select("id")
    .returns<Array<{ id: string }>>();

  if (error) throw error;
  return data?.length ?? 0;
}

