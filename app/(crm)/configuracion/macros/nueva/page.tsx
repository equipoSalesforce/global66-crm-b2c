import { MacroBuilder } from "@/components/macro-builder";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import Link from "next/link";

export default function NuevaMacroPage() {
  return (
    <>
      <PageHeader
        title="Nueva macro"
        description="Construye una macro visual para casos."
        action={
          <Link
            href="/configuracion/macros"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--g66-border)] bg-white px-4 text-sm font-semibold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-background)]"
          >
            Volver a macros
          </Link>
        }
      />

      <RoleGuard anyPermission={["viewSettings"]}>
        <MacroBuilder />
      </RoleGuard>
    </>
  );
}
