import { changeCasesOwnerInSupabase } from "@/lib/case-operations-server-service";
import { supabase } from "@/lib/supabase";
import type { AssignableUser } from "@/lib/users-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChangeOwnerRequest = {
  caseIds?: string[];
  newOwnerId?: string;
  actorUser?: {
    userId?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
};

async function getAssignableUser(ownerId: string): Promise<AssignableUser | null> {
  const { data, error } = await supabase
    .from("crm_users")
    .select("id, name, email, role, team, status")
    .eq("id", ownerId)
    .eq("status", "ACTIVE")
    .maybeSingle<{
      id: string;
      name: string;
      email: string;
      role: string;
      team: string | null;
    }>();

  if (error) {
    throw error;
  }

  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    team: data.team ?? "Sin equipo",
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChangeOwnerRequest;
    const caseIds = body.caseIds?.filter(Boolean) ?? [];

    if (caseIds.length === 0 || !body.newOwnerId) {
      return Response.json(
        { error: "Debes seleccionar casos y un owner válido." },
        { status: 400 },
      );
    }

    const owner = await getAssignableUser(body.newOwnerId);

    if (!owner) {
      return Response.json({ error: "Owner no encontrado." }, { status: 404 });
    }

    const result = await changeCasesOwnerInSupabase({
      supabase,
      caseIds,
      owner,
      actorUser: body.actorUser,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/cases/change-owner] Error changing owner", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cambiar el owner.",
      },
      { status: 500 },
    );
  }
}
