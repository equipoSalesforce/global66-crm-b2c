import { getCaseDetailSidebarViewModel } from "@/lib/case-detail-sidebar-service";
import { getCurrentCrmUser } from "@/lib/current-crm-user";
import { hasPermission, type CrmRolePermissionRecord } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const [currentUser, permissionsResult] = await Promise.all([
      getCurrentCrmUser(),
      supabase.from("crm_role_permissions").select("role, permission_key, enabled")
        .returns<CrmRolePermissionRecord[]>(),
    ]);
    if (!hasPermission(currentUser.role, "viewCases", permissionsResult.data ?? [])) {
      return Response.json({ error: "No tienes permiso para ver este caso." }, { status: 403 });
    }
    return Response.json(await getCaseDetailSidebarViewModel(id));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el sidebar." },
      { status: 500 },
    );
  }
}
