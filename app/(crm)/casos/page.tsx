import {
  ConsoleAgentRecord,
  ConsoleCaseRecord,
  ConsoleMessageRecord,
} from "@/components/cases-console";
import { CasesListView } from "@/components/cases-list-view";
import { RoleGuard } from "@/components/role-guard";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type CaseRecord = Omit<ConsoleCaseRecord, "id"> & {
  id: string | number | null;
};

type AttachmentCaseRecord = {
  case_id: string | number | null;
};

export default async function CasosPage() {
  const [
    casesResult,
    messagesResult,
    agentsResult,
    attachmentsResult,
    whatsappMediaResult,
  ] = await Promise.all([
    supabase
      .from("cases")
      .select(
        "id, case_number, customer_id, subject, channel, contact_type, status, lifecycle_status, routing_status, priority, area, category, assigned_agent_id, assigned_to, assigned_at, contact_name, contact_email, contact_phone, created_at, updated_at, closed_at, resolution_type, ai_summary, ai_category, ai_sentiment, ai_confidence, ai_resolution, customer:customers(name, email, phone)",
      )
      .order("created_at", { ascending: false })
      .returns<CaseRecord[]>(),
    supabase
      .from("messages")
      .select("id, case_id, body, sender_type, direction, created_at, channel, message_type, media_type, has_media, delivery_status, delivered_at, read_at, failed_at, failure_reason, external_message_id, email_subject, email_from, email_to, email_cc, email_bcc, email_html_body, email_text_body, in_reply_to, email_references, email_message_id")
      .order("created_at", { ascending: false })
      .limit(1200)
      .returns<ConsoleMessageRecord[]>(),
    supabase
      .from("crm_users")
      .select("id, name, email")
      .in("role", ["AGENT", "SUPERVISOR", "ADMIN"])
      .returns<ConsoleAgentRecord[]>(),
    supabase
      .from("message_attachments")
      .select("case_id")
      .returns<AttachmentCaseRecord[]>(),
    supabase
      .from("whatsapp_media_attachments")
      .select("case_id")
      .returns<AttachmentCaseRecord[]>(),
  ]);

  const cases = (casesResult.data ?? [])
    .filter((caseItem): caseItem is CaseRecord & { id: string | number } =>
      Boolean(caseItem.id),
    )
    .map((caseItem) => ({
      ...caseItem,
      id: String(caseItem.id),
    }));
  const error =
    casesResult.error?.message ??
    messagesResult.error?.message ??
    agentsResult.error?.message ??
    attachmentsResult.error?.message ??
    whatsappMediaResult.error?.message ??
    null;
  const attachmentCounts = [
    ...(attachmentsResult.data ?? []),
    ...(whatsappMediaResult.data ?? []),
  ].reduce<
    Record<string, number>
  >((counts, attachment) => {
    if (!attachment.case_id) return counts;

    const caseId = String(attachment.case_id);
    counts[caseId] = (counts[caseId] ?? 0) + 1;

    return counts;
  }, {});

  return (
    <RoleGuard anyPermission={["viewCases"]}>
      {error ? (
        <section className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm text-[var(--g66-danger)] shadow-sm">
          {error}
        </section>
      ) : (
        <CasesListView
          cases={cases}
          messages={messagesResult.data ?? []}
          agents={agentsResult.data ?? []}
          attachmentCounts={attachmentCounts}
        />
      )}
    </RoleGuard>
  );
}
