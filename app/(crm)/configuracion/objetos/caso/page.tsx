import { CaseObjectConfigurator } from "@/components/case-object-configurator";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import type {
  CaseFieldDefinition,
  CaseLayoutField,
  CaseLayoutSection,
  CaseLayoutTab,
} from "@/lib/case-metadata";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CaseObjectSettingsPage() {
  const [fieldsResult, tabsResult, sectionsResult, layoutFieldsResult] =
    await Promise.all([
      supabase
        .from("case_field_definitions")
        .select("*")
        .order("field_key", { ascending: true })
        .returns<CaseFieldDefinition[]>(),
      supabase
        .from("case_layout_tabs")
        .select("*")
        .order("sort_order", { ascending: true })
        .returns<CaseLayoutTab[]>(),
      supabase
        .from("case_layout_sections")
        .select("*")
        .order("sort_order", { ascending: true })
        .returns<CaseLayoutSection[]>(),
      supabase
        .from("case_layout_fields")
        .select("*")
        .order("sort_order", { ascending: true })
        .returns<CaseLayoutField[]>(),
    ]);

  const error =
    fieldsResult.error?.message ??
    tabsResult.error?.message ??
    sectionsResult.error?.message ??
    layoutFieldsResult.error?.message ??
    null;

  return (
    <>
      <PageHeader
        title="Objeto Caso"
        description="Administra campos personalizados y layouts metadata-driven para casos."
        action={
          <Link
            href="/configuracion"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--g66-border)] bg-white px-4 text-sm font-semibold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-background)]"
          >
            Volver a configuración
          </Link>
        }
      />

      <RoleGuard anyPermission={["editGlobalSettings"]}>
        {error ? (
          <section className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm text-[var(--g66-danger)] shadow-sm">
            No se pudo cargar metadata de Caso: {error}
          </section>
        ) : (
          <CaseObjectConfigurator
            fields={fieldsResult.data ?? []}
            tabs={tabsResult.data ?? []}
            sections={sectionsResult.data ?? []}
            layoutFields={layoutFieldsResult.data ?? []}
          />
        )}
      </RoleGuard>
    </>
  );
}
