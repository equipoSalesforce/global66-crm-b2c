import { fallbackAssignableUsers } from "@/lib/users-service";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CrmUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string | null;
};

export async function GET() {
  const { data, error } = await supabase
    .from("crm_users")
    .select("id, name, email, role, team")
    .eq("status", "ACTIVE")
    .order("name", { ascending: true })
    .returns<CrmUserRow[]>();

  if (error) {
    return Response.json({ users: fallbackAssignableUsers, source: "fallback" });
  }

  return Response.json({
    users: (data ?? []).map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team: user.team ?? "Sin equipo",
    })),
    source: "supabase",
  });
}
