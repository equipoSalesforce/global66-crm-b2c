import { MacroBuilder } from "@/components/macro-builder";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import type { MacroActionRecord, MacroRecord } from "@/lib/macros";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EditarMacroPage({
  params,
}: {
  params: Promise<{ macroId: string }>;
}) {
  const { macroId } = await params;
  const [macroResult, actionsResult] = await Promise.all([
    supabase
      .from("macros")
      .select("id, name, description, target_object, is_active, created_at, updated_at")
      .eq("id", macroId)
      .single<MacroRecord>(),
    supabase
      .from("macro_actions")
      .select("id, macro_id, action_type, sort_order, payload, created_at")
      .eq("macro_id", macroId)
      .order("sort_order", { ascending: true })
      .returns<MacroActionRecord[]>(),
  ]);

  return (
    <>
      <PageHeader
        title={macroResult.data?.name ?? "Editar macro"}
        description="Edita instrucciones y acciones de la macro."
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
        {macroResult.error || !macroResult.data ? (
          <section className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm text-[var(--g66-danger)] shadow-sm">
            No se pudo cargar la macro.
          </section>
        ) : actionsResult.error ? (
          <section className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm text-[var(--g66-danger)] shadow-sm">
            No se pudieron cargar las acciones: {actionsResult.error.message}
          </section>
        ) : (
          <MacroBuilder
            macro={macroResult.data}
            actions={actionsResult.data ?? []}
          />
        )}
      </RoleGuard>
    </>
  );
}
