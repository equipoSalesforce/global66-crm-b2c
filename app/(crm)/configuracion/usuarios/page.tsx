import {
  CrmUsersAdmin,
  type CrmAircallUserMapping,
} from "@/components/crm-users-admin";
import { RoleGuard } from "@/components/role-guard";
import type { CrmUser } from "@/lib/crm-users";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ConfiguracionUsuariosPage() {
  const [usersResult, aircallMappingsResult] = await Promise.all([
    supabase
      .from("crm_users")
      .select(
        "id, name, email, role, area, team, status, avatar_url, external_auth_provider, external_auth_id, last_login_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .returns<CrmUser[]>(),
    supabase
      .from("crm_aircall_users")
      .select(
        "id, crm_user_id, aircall_user_id, aircall_email, aircall_name, default_aircall_number_id, default_aircall_number, is_active",
      )
      .returns<CrmAircallUserMapping[]>(),
  ]);

  return (
    <RoleGuard anyPermission={["manageUsers"]}>
      {usersResult.error ? (
        <section className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm font-semibold text-[var(--g66-danger)] shadow-[var(--g66-shadow-card)]">
          No se pudieron cargar los usuarios internos: {usersResult.error.message}
        </section>
      ) : (
        <CrmUsersAdmin
          initialUsers={usersResult.data ?? []}
          initialAircallMappings={aircallMappingsResult.data ?? []}
        />
      )}
    </RoleGuard>
  );
}
