import { getCurrentAiUser } from "@/lib/ai-current-user";
import { deleteDashboard, getDashboardWithData, updateDashboard, type DashboardVisibility } from "@/lib/analytics/dashboard-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user] = await Promise.all([params, getCurrentAiUser()]);
    const result = await getDashboardWithData(id, user);
    if (!result) return Response.json({ ok: false, error: "Dashboard no encontrado." }, { status: 404 });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo cargar el dashboard." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user, body] = await Promise.all([
      params,
      getCurrentAiUser(),
      request.json() as Promise<{ definition?: unknown; visibility?: DashboardVisibility }>,
    ]);
    if (!body.definition) return Response.json({ ok: false, error: "La definición es requerida." }, { status: 400 });
    const dashboard = await updateDashboard({ id, user, definition: body.definition, visibility: body.visibility });
    if (!dashboard) return Response.json({ ok: false, error: "Dashboard no encontrado." }, { status: 404 });
    return Response.json({ ok: true, dashboard });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el dashboard.";
    return Response.json({ ok: false, error: message }, { status: message.includes("permiso") ? 403 : 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, user] = await Promise.all([params, getCurrentAiUser()]);
    const deleted = await deleteDashboard(id, user);
    if (!deleted) return Response.json({ ok: false, error: "Dashboard no encontrado." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo eliminar el dashboard.";
    return Response.json({ ok: false, error: message }, { status: message.includes("permiso") ? 403 : 400 });
  }
}
