import { PageHeader } from "@/components/page-header";
import { PermissionAction } from "@/components/permission-action";
import { RoleGuard } from "@/components/role-guard";
import { QueueCasesTable } from "@/components/queue-cases-table";
import Link from "next/link";

export default function ColaPage() {
  return (
    <>
      <PageHeader
        title="Cola General"
        description="Casos pendientes, sin asignar o gestionados por IA que requieren visibilidad operativa."
        action={
          <PermissionAction permission="takeQueueCases">
            <Link
              href="/casos/nuevo"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--g66-accent-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--g66-brand-blue)] focus:ring-offset-2"
            >
              Crear caso
            </Link>
          </PermissionAction>
        }
      />

      <RoleGuard anyPermission={["viewQueue"]}>
        <QueueCasesTable />
      </RoleGuard>
    </>
  );
}
