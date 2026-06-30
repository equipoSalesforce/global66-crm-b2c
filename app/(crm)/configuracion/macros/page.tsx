import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import type { MacroActionRecord, MacroRecord } from "@/lib/macros";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

type MacroWithActions = MacroRecord & {
  macro_actions?: MacroActionRecord[] | null;
};

export default async function MacrosPage() {
  const { data, error } = await supabase
    .from("macros")
    .select(
      "id, name, description, target_object, is_active, created_at, updated_at, macro_actions(id, action_type, sort_order, payload, created_at)",
    )
    .order("updated_at", { ascending: false })
    .returns<MacroWithActions[]>();

  return (
    <>
      <PageHeader
        title="Macros"
        description="Automatizaciones visuales para ejecutar acciones sobre casos."
        action={
          <Link
            href="/configuracion/macros/nueva"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white hover:bg-[var(--g66-accent-cyan)]"
          >
            Nueva macro
          </Link>
        }
      />

      <RoleGuard anyPermission={["viewSettings"]}>
        <section className="overflow-hidden rounded-lg border border-[var(--g66-border)] bg-white shadow-sm">
          <div className="border-b border-[var(--g66-border)] bg-[var(--g66-background)] px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
              Macros configuradas
            </h2>
          </div>
          {error ? (
            <p className="p-6 text-sm text-[var(--g66-danger)]">
              No se pudieron cargar las macros: {error.message}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--g66-background)] text-xs uppercase tracking-wide text-[var(--g66-text-secondary)]">
                <tr className="border-b border-[var(--g66-border)]">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Objeto</th>
                  <th className="px-4 py-3">Acciones</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Actualizada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--g66-border)]">
                {(data ?? []).map((macro) => (
                  <tr key={macro.id} className="hover:bg-[var(--g66-background)]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/configuracion/macros/${macro.id}`}
                        className="font-bold text-[var(--g66-brand-blue)] hover:underline"
                      >
                        {macro.name}
                      </Link>
                      {macro.description ? (
                        <p className="mt-1 text-xs font-semibold text-[var(--g66-text-secondary)]">
                          {macro.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {macro.target_object}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {(macro.macro_actions ?? []).length}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[var(--g66-brand-blue-soft)] px-2 py-1 text-xs font-bold text-[var(--g66-brand-blue)]">
                        {macro.is_active ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--g66-text-secondary)]">
                      {macro.updated_at
                        ? new Intl.DateTimeFormat("es-CL", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(macro.updated_at))
                        : "Sin fecha"}
                    </td>
                  </tr>
                ))}
                {(data ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm font-semibold text-[var(--g66-text-secondary)]"
                    >
                      No hay macros configuradas todavía.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </section>
      </RoleGuard>
    </>
  );
}
