import { CasesListView } from "@/components/cases-list-view";
import { RoleGuard } from "@/components/role-guard";
import { getCaseViewData } from "@/lib/case-view-service";

export const dynamic = "force-dynamic";

export default async function CasosPage() {
  const { data, error } = await getCaseViewData();

  return (
    <RoleGuard anyPermission={["viewCases"]}>
      {error ? (
        <section className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm text-[var(--g66-danger)] shadow-sm">
          {error}
        </section>
      ) : (
        <CasesListView data={data} />
      )}
    </RoleGuard>
  );
}
