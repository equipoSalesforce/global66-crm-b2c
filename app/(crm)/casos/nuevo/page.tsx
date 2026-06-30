import { NewCaseForm } from "@/components/new-case-form";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type CustomerOption = {
  id: string | number;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export default async function NuevoCasoPage() {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .order("name", { ascending: true })
    .returns<CustomerOption[]>();

  const customers = data ?? [];

  return (
    <>
      <PageHeader
        title="Crear caso"
        description="Registra un nuevo caso con cliente relacionado o contacto manual."
      />

      <RoleGuard anyPermission={["takeQueueCases"]}>
        {error ? (
          <section className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm text-[var(--g66-danger)]">
            No se pudieron cargar los clientes.
          </section>
        ) : (
          <NewCaseForm customers={customers} />
        )}
      </RoleGuard>
    </>
  );
}
