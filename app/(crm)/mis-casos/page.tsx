import { MyCasesTable } from "@/components/my-cases-table";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";

export default function MisCasosPage() {
  return (
    <>
      <PageHeader
        title="Mis Casos"
        description="Bandeja operativa con los casos asignados a tu sesión demo."
      />

      <RoleGuard anyPermission={["viewMyCases"]}>
        <MyCasesTable />
      </RoleGuard>
    </>
  );
}
