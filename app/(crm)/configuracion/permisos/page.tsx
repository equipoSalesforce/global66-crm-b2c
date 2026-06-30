import { CrmPermissionsAdmin } from "@/components/crm-permissions-admin";
import { RoleGuard } from "@/components/role-guard";
import type {
  CrmCaseFieldPermissionRecord,
  CrmPermissionCategory,
  CrmPermissionKey,
  CrmRolePermissionRecord,
} from "@/lib/permissions";
import { standardCaseFieldKeys } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type PermissionCatalogRow = {
  key: CrmPermissionKey;
  label: string;
  description: string | null;
  category: CrmPermissionCategory;
};

type CaseFieldPermissionDefinition = {
  field_key: string;
  label: string;
  field_type: string;
  is_standard: boolean;
  is_active: boolean;
};

const fallbackStandardCaseFields: CaseFieldPermissionDefinition[] =
  standardCaseFieldKeys.map((fieldKey) => ({
    field_key: fieldKey,
    label: fieldKey,
    field_type: "text",
    is_standard: true,
    is_active: true,
  }));

function mergeCaseFieldDefinitions(
  metadataFields: CaseFieldPermissionDefinition[],
) {
  const fieldsByKey = new Map<string, CaseFieldPermissionDefinition>();

  fallbackStandardCaseFields.forEach((field) => {
    fieldsByKey.set(field.field_key, field);
  });
  metadataFields
    .filter((field) => field.is_active !== false)
    .forEach((field) => {
      fieldsByKey.set(field.field_key, field);
    });

  return [...fieldsByKey.values()].sort((left, right) => {
    if (left.is_standard !== right.is_standard) {
      return left.is_standard ? -1 : 1;
    }

    return left.label.localeCompare(right.label, "es");
  });
}

export default async function ConfiguracionPermisosPage() {
  const [
    permissionsResult,
    rolePermissionsResult,
    caseFieldDefinitionsResult,
  ] =
    await Promise.all([
      supabase
        .from("crm_permissions")
        .select("key, label, description, category")
        .order("category", { ascending: true })
        .order("key", { ascending: true })
        .returns<PermissionCatalogRow[]>(),
      supabase
        .from("crm_role_permissions")
        .select("role, permission_key, enabled")
        .returns<CrmRolePermissionRecord[]>(),
      supabase
        .from("case_field_definitions")
        .select("field_key, label, field_type, is_standard, is_active")
        .eq("is_active", true)
        .returns<CaseFieldPermissionDefinition[]>(),
    ]);

  const caseFields = mergeCaseFieldDefinitions(
    caseFieldDefinitionsResult.data ?? [],
  );
  const missingPermissionRows = caseFields.flatMap((field) =>
    (["ADMIN", "SUPERVISOR", "AGENT"] as const).map((role) => ({
      role,
      field_key: field.field_key,
      can_view: true,
      can_edit: role === "ADMIN",
      updated_at: new Date().toISOString(),
    })),
  );
  const backfillResult =
    missingPermissionRows.length > 0
      ? await supabase
          .from("crm_case_field_permissions")
          .upsert(missingPermissionRows, {
            onConflict: "role,field_key",
            ignoreDuplicates: true,
          })
      : { error: null };
  const caseFieldPermissionsResult = await supabase
    .from("crm_case_field_permissions")
    .select("role, field_key, can_view, can_edit")
    .returns<CrmCaseFieldPermissionRecord[]>();

  const error =
    permissionsResult.error?.message ??
    rolePermissionsResult.error?.message ??
    caseFieldDefinitionsResult.error?.message ??
    backfillResult.error?.message ??
    caseFieldPermissionsResult.error?.message ??
    null;

  return (
    <RoleGuard anyPermission={["manage_permissions"]}>
      {error ? (
        <section className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm font-semibold text-[var(--g66-danger)] shadow-[var(--g66-shadow-card)]">
          No se pudieron cargar los permisos: {error}
        </section>
      ) : (
        <CrmPermissionsAdmin
          permissions={permissionsResult.data ?? []}
          initialRolePermissions={rolePermissionsResult.data ?? []}
          initialCaseFieldPermissions={caseFieldPermissionsResult.data ?? []}
          caseFields={caseFields}
        />
      )}
    </RoleGuard>
  );
}
