import {
  WorkforceAgentRow,
  WorkforceDashboard,
} from "@/components/workforce-dashboard";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type AgentRecord = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

type AgentProfileRecord = {
  user_id: string | null;
  availability: string | null;
  max_open_cases: number | null;
  is_active: boolean | null;
};

type CaseRecord = {
  assigned_agent_id: string | null;
  status: string | null;
};

type AgentSkillRecord = {
  user_id: string | null;
  area: string | null;
  category: string | null;
  channel: string | null;
  status: string | null;
};

function buildWorkforceRows(
  agents: AgentRecord[],
  profiles: AgentProfileRecord[],
  cases: CaseRecord[],
  skills: AgentSkillRecord[],
): WorkforceAgentRow[] {
  const caseCounts = new Map<
    string,
    {
      openCases: number;
      closedCases: number;
    }
  >();
  const profilesByUser = new Map<string, AgentProfileRecord>();
  const skillsByAgent = new Map<string, AgentSkillRecord[]>();

  profiles.forEach((profile) => {
    if (profile.user_id) {
      profilesByUser.set(profile.user_id, profile);
    }
  });

  cases.forEach((caseItem) => {
    if (!caseItem.assigned_agent_id) {
      return;
    }

    const current = caseCounts.get(caseItem.assigned_agent_id) ?? {
      openCases: 0,
      closedCases: 0,
    };

    if (caseItem.status === "CLOSED") {
      current.closedCases += 1;
    } else {
      current.openCases += 1;
    }

    caseCounts.set(caseItem.assigned_agent_id, current);
  });

  skills.forEach((skill) => {
    if (!skill.user_id) {
      return;
    }

    const current = skillsByAgent.get(skill.user_id) ?? [];
    current.push(skill);
    skillsByAgent.set(skill.user_id, current);
  });

  return agents.map((agent) => {
    const counts = caseCounts.get(agent.id) ?? {
      openCases: 0,
      closedCases: 0,
    };
    const profile = profilesByUser.get(agent.id);

    return {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      availability_status: profile?.availability ?? "AVAILABLE",
      max_open_cases: profile?.max_open_cases ?? 10,
      openCases: counts.openCases,
      closedCases: counts.closedCases,
      skills: (skillsByAgent.get(agent.id) ?? []).map((skill) => ({
        area: skill.area,
        category: skill.category,
        channel: skill.channel,
        active: skill.status !== "INACTIVE",
      })),
    };
  });
}

export default async function WorkforceDashboardPage() {
  const [agentsResult, profilesResult, casesResult, skillsResult] = await Promise.all([
    supabase
      .from("crm_users")
      .select("id, name, email, role")
      .in("role", ["AGENT", "SUPERVISOR", "ADMIN"])
      .eq("status", "ACTIVE")
      .order("name", { ascending: true })
      .returns<AgentRecord[]>(),
    supabase
      .from("crm_agent_profiles")
      .select("user_id, availability, max_open_cases, is_active")
      .eq("is_active", true)
      .returns<AgentProfileRecord[]>(),
    supabase
      .from("cases")
      .select("assigned_agent_id, status")
      .not("assigned_agent_id", "is", null)
      .returns<CaseRecord[]>(),
    supabase
      .from("crm_agent_skills")
      .select("user_id, area, category, channel, status")
      .returns<AgentSkillRecord[]>(),
  ]);

  const rows = buildWorkforceRows(
    agentsResult.data ?? [],
    profilesResult.data ?? [],
    casesResult.data ?? [],
    skillsResult.data ?? [],
  );
  const error =
    agentsResult.error?.message ??
    profilesResult.error?.message ??
    casesResult.error?.message ??
    skillsResult.error?.message ??
    null;

  return (
    <>
      <PageHeader
        title="Workforce Dashboard"
        description="Disponibilidad, capacidad y carga operativa del equipo."
      />

      <RoleGuard anyPermission={["viewWorkforce"]}>
        {error ? (
          <section className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm text-[var(--g66-danger)] shadow-sm">
            {error}
          </section>
        ) : (
          <WorkforceDashboard rows={rows} />
        )}
      </RoleGuard>
    </>
  );
}
