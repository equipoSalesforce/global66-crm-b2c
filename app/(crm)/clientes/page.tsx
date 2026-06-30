import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Customer = {
  id: string | number | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export default async function ClientesPage() {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .order("name", { ascending: true })
    .returns<Customer[]>();

  const customers = data ?? [];

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Directorio de clientes conectados a los canales de atención."
      />

      <RoleGuard anyPermission={["viewCustomers"]}>
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-950">Lista de clientes</h2>
        </div>

        {error ? (
          <p className="p-6 text-sm text-[var(--g66-danger)]">
            No se pudieron cargar los clientes.
          </p>
        ) : customers.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {customers.map((customer, index) => {
              const customerKey =
                customer.id ??
                customer.email ??
                customer.phone ??
                `customer-${index}`;

              return (
                <li key={customerKey}>
                  <Link
                    href={`/clientes/${customer.id}`}
                    className="grid gap-2 p-5 transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none sm:grid-cols-3 sm:items-center"
                  >
                    <p className="font-semibold text-gray-950">
                      {customer.name || "Sin nombre"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {customer.email || "Sin email"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {customer.phone || "Sin teléfono"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-6 text-sm text-gray-600">
            No hay clientes para mostrar.
          </p>
        )}
        </section>
      </RoleGuard>
    </>
  );
}
