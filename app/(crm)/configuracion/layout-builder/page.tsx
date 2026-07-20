import { CaseLayoutBuilder } from "@/components/case-layout-builder";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { listCaseAreaLayouts } from "@/lib/case-area-layout-service";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LayoutBuilderPage() {
  const { layouts, availableFields } = await listCaseAreaLayouts();
  return (
    <>
      <PageHeader
        title="Layout Builder"
        description="Configura los campos del formulario de caso para cada área."
        action={<Link href="/configuracion/objetos/caso" className="inline-flex h-10 items-center rounded-lg border border-[var(--g66-border)] bg-white px-4 text-sm font-semibold text-[var(--g66-brand-blue)]">Administrar campos</Link>}
      />
      <RoleGuard anyPermission={["editGlobalSettings"]}>
        <CaseLayoutBuilder
          initialLayouts={layouts}
          initialAvailableFields={availableFields}
        />
      </RoleGuard>
    </>
  );
}
