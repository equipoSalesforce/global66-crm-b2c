import { PageHeader } from "@/components/page-header";
import { PermissionAction } from "@/components/permission-action";
import { RoleGuard } from "@/components/role-guard";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Agent = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  area: string | null;
  team: string | null;
  status: string | null;
};

type AgentWithCount = Agent & {
  availability: string | null;
  maxOpenCases: number | null;
  isOperationalActive: boolean | null;
  assignedCases: number;
  countError: string | null;
};

type AgentProfile = {
  user_id: string;
  availability: string | null;
  max_open_cases: number | null;
  is_active: boolean | null;
};

async function getAssignedCaseCount(agent: Pick<Agent, "id" | "email" | "name">) {
  const [byId, byEmail, byName] = await Promise.all([
    supabase
      .from("cases")
      .select("id")
      .eq("assigned_agent_id", agent.id),
    supabase
      .from("cases")
      .select("id")
      .eq("assigned_to", agent.email),
    supabase
      .from("cases")
      .select("id")
      .eq("assigned_to", agent.name),
  ]);

  const caseIds = new Set<string>();
  [byId.data, byEmail.data, byName.data].forEach((rows) => {
    rows?.forEach((row) => {
      if (row.id) {
        caseIds.add(String(row.id));
      }
    });
  });

  return {
    count: caseIds.size,
    error: byId.error?.message ?? byEmail.error?.message ?? byName.error?.message ?? null,
  };
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
        active
          ? "bg-[var(--g66-success-soft)] text-[var(--g66-success)]"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

async function ensureAgentProfiles(agentIds: string[]) {
  if (agentIds.length === 0) {
    return;
  }

  await supabase
    .from("crm_agent_profiles")
    .upsert(
      agentIds.map((userId) => ({
        user_id: userId,
        availability: "AVAILABLE",
        max_open_cases: 10,
        is_active: true,
      })),
      { onConflict: "user_id", ignoreDuplicates: true },
    );
}

export default async function AgentesPage() {
  const { data, error } = await supabase
    .from("crm_users")
    .select("id, name, email, role, area, team, status")
    .in("role", ["AGENT", "SUPERVISOR", "ADMIN"])
    .eq("status", "ACTIVE")
    .order("name", { ascending: true })
    .returns<Agent[]>();

  const agents = data ?? [];
  await ensureAgentProfiles(agents.map((agent) => agent.id));

  const { data: profilesData } = await supabase
    .from("crm_agent_profiles")
    .select("user_id, availability, max_open_cases, is_active")
    .in(
      "user_id",
      agents.length > 0 ? agents.map((agent) => agent.id) : ["00000000-0000-0000-0000-000000000000"],
    )
    .returns<AgentProfile[]>();

  const profilesByUser = new Map(
    (profilesData ?? []).map((profile) => [profile.user_id, profile]),
  );

  const agentsWithCounts: AgentWithCount[] = await Promise.all(
    agents.map(async (agent) => {
      const { count, error: countError } = await getAssignedCaseCount(agent);
      const profile = profilesByUser.get(agent.id);

      return {
        ...agent,
        availability: profile?.availability ?? "AVAILABLE",
        maxOpenCases: profile?.max_open_cases ?? 10,
        isOperationalActive: profile?.is_active ?? true,
        assignedCases: count,
        countError,
      };
    }),
  );

  return (
    <>
      <PageHeader
        title="Agentes"
        description="Administra el equipo que atiende casos y conversaciones."
        action={
          <PermissionAction permission="viewWorkforce">
            <Link
              href="/agentes/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--g66-accent-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--g66-brand-blue)] focus:ring-offset-2"
            >
              Workforce Dashboard
            </Link>
          </PermissionAction>
        }
      />

      <RoleGuard anyPermission={["viewAgents"]}>
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-bold text-gray-950">Lista de agentes</h2>
          </div>

          {error ? (
            <p className="p-6 text-sm text-[var(--g66-danger)]">
              No se pudieron cargar los agentes.
            </p>
          ) : agentsWithCounts.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {agentsWithCounts.map((agent) => (
                <li key={agent.id}>
                  <Link
                    href={`/agentes/${agent.id}`}
                    className="grid gap-3 p-5 transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none lg:grid-cols-[1.1fr_1.3fr_0.7fr_0.9fr_0.7fr_0.8fr_0.8fr] lg:items-center"
                  >
                    <p className="font-semibold text-gray-950">
                      {agent.name || "Sin nombre"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {agent.email || "Sin email"}
                    </p>
                    <p className="text-sm font-semibold text-gray-700">
                      {agent.role || "AGENT"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {[agent.area, agent.team].filter(Boolean).join(" · ") ||
                        "Sin área"}
                    </p>
                    <StatusBadge active={agent.isOperationalActive ?? true} />
                    <p className="text-sm text-gray-600">
                      {agent.availability || "AVAILABLE"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {agent.countError
                        ? "Error"
                        : `${agent.assignedCases.toLocaleString("es-CL")} / ${
                            agent.maxOpenCases ?? 10
                          } casos`}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-gray-600">
              No hay agentes activos para mostrar.
            </p>
          )}
        </section>
      </RoleGuard>
    </>
  );
}
