import { redirect } from "next/navigation";
import { AuthOtpLogin } from "@/components/auth-otp-login";
import { DemoLoginAgents } from "@/components/demo-login-agents";
import { isAuthOtpEnabled } from "@/lib/auth/auth-config";
import { getAuthenticatedUserFromCookies } from "@/lib/auth/auth-session-service";
import type { CrmUser } from "@/lib/crm-users";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (isAuthOtpEnabled()) {
    const user = await getAuthenticatedUserFromCookies();
    if (user) redirect("/dashboard");
    const requestedNext = (await searchParams).next;
    const nextPath =
      requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
        ? requestedNext
        : "/dashboard";
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-6 py-12 text-gray-950">
        <AuthOtpLogin nextPath={nextPath} />
      </main>
    );
  }

  const { data, error } = await supabase
    .from("crm_users")
    .select("id, name, email, role, area, team, status, avatar_url, external_auth_provider, external_auth_id, last_login_at, created_at, updated_at")
    .eq("status", "ACTIVE")
    .order("name", { ascending: true })
    .returns<CrmUser[]>();

  const users = data ?? [];

  return (
    <main className="min-h-screen bg-gray-100 px-6 py-12 text-gray-950">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] text-sm font-bold text-white">
              IA
            </div>
            <span className="text-2xl font-bold">CRM</span>
          </div>
          <h1 className="mt-8 text-4xl font-bold tracking-normal">
            Selecciona agente
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">
            Inicio de sesión demo para operar casos sin Supabase Auth.
          </p>
        </div>

        {error ? (
          <section className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm text-[var(--g66-danger)]">
            No se pudieron cargar los usuarios internos.
          </section>
        ) : users.length > 0 ? (
          <DemoLoginAgents users={users} />
        ) : (
          <section className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
            No hay usuarios activos configurados. Crea usuarios en Configuración &gt;
            Usuarios o revisa la tabla crm_users.
          </section>
        )}
      </section>
    </main>
  );
}
