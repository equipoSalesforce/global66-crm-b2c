import { normalizeAircallPhone } from "@/lib/aircall";
import { hasPermission, type CrmRolePermissionRecord } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

type DialPayload = {
  case_id?: string;
  phone_number?: string;
  crm_user_id?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as DialPayload;
    const caseId = payload.case_id?.trim();
    const phoneNumber = normalizeAircallPhone(payload.phone_number);
    const crmUserId = payload.crm_user_id?.trim();

    if (!caseId) {
      return Response.json({ ok: false, error: "case_id es obligatorio." }, { status: 400 });
    }
    if (!phoneNumber) {
      return Response.json({ ok: false, error: "phone_number es obligatorio." }, { status: 400 });
    }
    if (!crmUserId) {
      return Response.json(
        { ok: false, error: "Usuario CRM no encontrado en sesión demo." },
        { status: 401 },
      );
    }

    const { data: user, error: userError } = await supabase
      .from("crm_users")
      .select("id, name, email, role, status")
      .eq("id", crmUserId)
      .maybeSingle<{
        id: string;
        name: string;
        email: string;
        role: string;
        status: string;
      }>();

    if (userError || !user || user.status !== "ACTIVE") {
      return Response.json(
        { ok: false, error: "Usuario CRM inválido o inactivo." },
        { status: 403 },
      );
    }

    const { data: rolePermissions } = await supabase
      .from("crm_role_permissions")
      .select("role, permission_key, enabled")
      .returns<CrmRolePermissionRecord[]>();

    if (!hasPermission(user.role, "use_aircall", rolePermissions ?? [])) {
      return Response.json(
        { ok: false, error: "No tienes permiso para usar Aircall." },
        { status: 403 },
      );
    }

    const { data: mapping, error: mappingError } = await supabase
      .from("crm_aircall_users")
      .select(
        "id, crm_user_id, aircall_user_id, aircall_email, aircall_name, default_aircall_number_id, default_aircall_number, is_active",
      )
      .eq("crm_user_id", crmUserId)
      .eq("is_active", true)
      .maybeSingle<{
        id: string;
        crm_user_id: string;
        aircall_user_id: string;
        aircall_email: string | null;
        aircall_name: string | null;
        default_aircall_number_id: string | null;
        default_aircall_number: string | null;
        is_active: boolean;
      }>();

    if (mappingError || !mapping) {
      return Response.json(
        {
          ok: false,
          error:
            "Este usuario no tiene mapeo activo de Aircall. Configúralo en Usuarios.",
        },
        { status: 400 },
      );
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data: context, error: contextError } = await supabase
      .from("pending_aircall_call_contexts")
      .insert({
        case_id: caseId,
        crm_user_id: crmUserId,
        aircall_user_id: mapping.aircall_user_id,
        phone_number: phoneNumber,
        expires_at: expiresAt,
      })
      .select("id")
      .single<{ id: string }>();

    if (contextError || !context) {
      console.error("[aircall-dial] pending context error", contextError);
      return Response.json(
        { ok: false, error: "No se pudo preparar el contexto Aircall." },
        { status: 500 },
      );
    }

    console.info("[aircall-dial] context created", {
      caseId,
      crmUserId,
      aircallUserId: mapping.aircall_user_id,
      phoneNumber,
    });

    return Response.json({
      ok: true,
      normalized_phone_number: phoneNumber,
      aircall_user_id: mapping.aircall_user_id,
      pending_context_id: context.id,
    });
  } catch (error) {
    console.error("[aircall-dial] unexpected error", error);

    return Response.json(
      { ok: false, error: "No se pudo preparar la llamada Aircall." },
      { status: 500 },
    );
  }
}
