import {
  CasesConsole,
  ConsoleAgentRecord,
  ConsoleCaseRecord,
  ConsoleMessageRecord,
} from "@/components/cases-console";
import { RoleGuard } from "@/components/role-guard";
import type {
  CrmCaseFieldPermissionRecord,
  CrmRolePermissionRecord,
} from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

type CaseRecord = Omit<ConsoleCaseRecord, "id"> & {
  id: string | number | null;
};

export default async function CasoExpedientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [
    casesResult,
    messagesResult,
    agentsResult,
    rolePermissionsResult,
    caseFieldPermissionsResult,
  ] = await Promise.all([
    supabase
      .from("cases")
      .select(
        "id, case_number, customer_id, subject, channel, contact_type, status, lifecycle_status, routing_status, priority, area, category, product, subproduct, is_edge_case, assigned_agent_id, owner_type, assigned_queue_id, assigned_to, assigned_at, duplicated_from_case_id, contact_name, contact_email, contact_phone, created_at, updated_at, closed_at, resolution_type, ai_summary, ai_category, ai_sentiment, ai_confidence, ai_resolution, customer:customers(name, email, phone, public_id), owner_queue:crm_queues(name, key)",
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
      .from("crm_role_permissions")
      .select("role, permission_key, enabled")
      .returns<CrmRolePermissionRecord[]>(),
    supabase
      .from("crm_case_field_permissions")
      .select("role, field_key, can_view, can_edit")
      .returns<CrmCaseFieldPermissionRecord[]>(),
  ]);

  let cases = (casesResult.data ?? [])
    .filter((caseItem): caseItem is CaseRecord & { id: string | number } =>
      Boolean(caseItem.id),
    )
    .map((caseItem) => ({
      ...caseItem,
      id: String(caseItem.id),
    }));
  let selectedCase = cases.find((caseItem) => caseItem.id === id);

  if (
    selectedCase &&
    (selectedCase.lifecycle_status === "MERGED" || selectedCase.status === "MERGED")
  ) {
    const { data: mergeMetadata, error: mergeMetadataError } = await supabase
      .from("cases")
      .select("is_merged, merged_into_case_id")
      .eq("id", selectedCase.id)
      .maybeSingle<{
        is_merged: boolean | null;
        merged_into_case_id: string | null;
      }>();

    if (mergeMetadataError) {
      console.warn("[case-detail] Merge metadata is not available", {
        caseId: selectedCase.id,
        message: mergeMetadataError.message,
      });
    } else if (mergeMetadata) {
      selectedCase = { ...selectedCase, ...mergeMetadata };

      if (mergeMetadata.merged_into_case_id) {
        const { data: mergedIntoCase, error: mergedIntoCaseError } = await supabase
          .from("cases")
          .select("id, case_number")
          .eq("id", mergeMetadata.merged_into_case_id)
          .maybeSingle<{ id: string; case_number: string | null }>();

        if (mergedIntoCaseError) {
          console.warn("[case-detail] Could not load merged destination case", {
            caseId: selectedCase.id,
            mergedIntoCaseId: mergeMetadata.merged_into_case_id,
            message: mergedIntoCaseError.message,
          });
        } else if (mergedIntoCase) {
          selectedCase = { ...selectedCase, merged_into_case: mergedIntoCase };
        }
      }

      const resolvedSelectedCase = selectedCase;
      cases = cases.map((caseItem) =>
        caseItem.id === resolvedSelectedCase.id ? resolvedSelectedCase : caseItem,
      );
    }
  }
  const error =
    casesResult.error?.message ??
    messagesResult.error?.message ??
    agentsResult.error?.message ??
    rolePermissionsResult.error?.message ??
    caseFieldPermissionsResult.error?.message ??
    null;

  return (
    <RoleGuard anyPermission={["viewCases"]}>
      {error ? (
        <section className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm text-[var(--g66-danger)] shadow-sm">
          {error}
        </section>
      ) : !selectedCase ? (
        <section className="flex h-full min-h-0 items-center justify-center bg-[var(--g66-background)] px-6">
          <div className="rounded-md border border-[var(--g66-border)] bg-white p-8 text-center shadow-sm">
            <h1 className="text-lg font-bold text-[var(--g66-text-primary)]">
              Caso no encontrado
            </h1>
            <p className="mt-2 text-sm font-semibold text-[var(--g66-text-secondary)]">
              El caso solicitado no existe o no está disponible.
            </p>
            <Link
              href="/casos"
              className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white hover:bg-[var(--g66-accent-cyan)]"
            >
              Volver a casos
            </Link>
          </div>
        </section>
      ) : (
        <CasesConsole
          key={id}
          cases={cases}
          messages={messagesResult.data ?? []}
          agents={agentsResult.data ?? []}
          rolePermissions={rolePermissionsResult.data ?? []}
          caseFieldPermissions={caseFieldPermissionsResult.data ?? []}
          initialSelectedCaseId={id}
        />
      )}
    </RoleGuard>
  );
}
