import { cookies } from "next/headers";
import { isAuthOtpEnabled } from "@/lib/auth/auth-config";
import { getAuthenticatedUserFromCookies } from "@/lib/auth/auth-session-service";
import { supabase } from "./supabase";
import type { CrmUserRole } from "./crm-users";

export const DEMO_USER_COOKIE = "demo_user_id";

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: CrmUserRole;
  teamId: string | null;
  teamName: string | null;
  isAdmin: boolean;
};

export const fallbackDemoUsers: DemoUser[] = [
  {
    id: "katherine-admin",
    name: "Katherine",
    email: "katherine@test.com",
    role: "ADMIN",
    teamId: "administracion-crm",
    teamName: "Administracion CRM",
    isAdmin: true,
  },
  {
    id: "sebas",
    name: "Sebas",
    email: "sebas@global66.com",
    role: "AGENT",
    teamId: "cx",
    teamName: "CX",
    isAdmin: false,
  },
  {
    id: "agente-demo",
    name: "Agente Demo",
    email: "agente@test.com",
    role: "AGENT",
    teamId: "atencion-clientes",
    teamName: "Atencion clientes",
    isAdmin: false,
  },
  {
    id: "ejecutivo-prueba",
    name: "Ejecutivo de Prueba",
    email: "ejecutivo.prueba@global66.com",
    role: "AGENT",
    teamId: "cx",
    teamName: "CX",
    isAdmin: false,
  },
  {
    id: "supervisor-demo",
    name: "Supervisor Demo",
    email: "supervisor@test.com",
    role: "SUPERVISOR",
    teamId: "soporte",
    teamName: "Soporte",
    isAdmin: false,
  },
];

type CrmUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string | null;
  area: string | null;
};

function normalizeTeamId(value: string | null | undefined) {
  return value
    ? value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : null;
}

function toDemoUser(user: CrmUserRow): DemoUser {
  const role = ["ADMIN", "SUPERVISOR", "AGENT"].includes(user.role)
    ? (user.role as CrmUserRole)
    : "AGENT";
  const teamName = user.team ?? user.area ?? null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    teamId: normalizeTeamId(teamName),
    teamName,
    isAdmin: role === "ADMIN",
  };
}

export async function getCurrentDemoUser(): Promise<DemoUser> {
  if (isAuthOtpEnabled()) {
    const authenticatedUser = await getAuthenticatedUserFromCookies();
    if (!authenticatedUser) {
      throw new Error("No existe una sesión CRM válida.");
    }
    return {
      id: authenticatedUser.id,
      name: authenticatedUser.name,
      email: authenticatedUser.email,
      role: authenticatedUser.role,
      teamId: normalizeTeamId(authenticatedUser.team ?? authenticatedUser.area),
      teamName: authenticatedUser.team ?? authenticatedUser.area,
      isAdmin: authenticatedUser.isAdmin,
    };
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get(DEMO_USER_COOKIE)?.value;

  if (userId) {
    const fallback = fallbackDemoUsers.find(
      (user) => user.id === userId || user.email === userId,
    );

    if (fallback) return fallback;

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        userId,
      );
    const query = supabase
      .from("crm_users")
      .select("id, name, email, role, team, area");
    const { data } = isUuid
      ? await query.eq("id", userId).maybeSingle<CrmUserRow>()
      : await query.eq("email", userId).maybeSingle<CrmUserRow>();

    if (data) {
      return toDemoUser(data);
    }
  }

  const { data } = await supabase
    .from("crm_users")
    .select("id, name, email, role, team, area")
    .eq("email", "katherine@test.com")
    .maybeSingle<CrmUserRow>();

  return data ? toDemoUser(data) : fallbackDemoUsers[0];
}
