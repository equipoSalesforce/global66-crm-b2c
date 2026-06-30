import { supabase } from "./supabase";

type CaseForAssignment = {
  id: string | number;
  area: string | null;
  category: string | null;
  channel: string | null;
  contact_type: string | null;
  status: string | null;
  lifecycle_status: string | null;
  routing_status: string | null;
  assigned_agent_id: string | null;
  assigned_to: string | null;
};

type AgentForAssignment = {
  id: string;
  name: string | null;
  email: string | null;
  max_open_cases: number | null;
};

type AgentSkill = {
  agent_id: string | null;
  area: string | null;
  category: string | null;
  channel: string | null;
};

type OpenCase = {
  assigned_agent_id: string | null;
};

export type AssignmentResult =
  | {
      status: "assigned";
      agentId: string;
      agentName: string;
      reason: string;
    }
  | {
      status: "no_agent";
      reason: string;
    }
  | {
      status: "error";
      reason: string;
      error: unknown;
    };

function normalizeValue(value: string | null) {
  return value?.trim().toUpperCase() || "";
}

function isSkillCompatible(skill: AgentSkill, caseItem: CaseForAssignment) {
  const caseArea = normalizeValue(caseItem.area);
  const caseCategory = normalizeValue(caseItem.category);
  const caseChannel = normalizeValue(caseItem.channel);
  const caseContactType = normalizeValue(caseItem.contact_type);
  const skillChannel = normalizeValue(skill.channel);

  return (
    normalizeValue(skill.area) === caseArea &&
    normalizeValue(skill.category) === caseCategory &&
    (skillChannel === caseChannel || skillChannel === caseContactType)
  );
}

function buildOpenCaseCounts(openCases: OpenCase[]) {
  const counts = new Map<string, number>();

  openCases.forEach((caseItem) => {
    if (!caseItem.assigned_agent_id) {
      return;
    }

    counts.set(
      caseItem.assigned_agent_id,
      (counts.get(caseItem.assigned_agent_id) ?? 0) + 1,
    );
  });

  return counts;
}

async function markCaseHumanRequired(caseId: string) {
  const { error } = await supabase
    .from("cases")
    .update({
      status: "HUMAN_REQUIRED",
      routing_status: "HUMAN_REQUIRED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId);

  if (error) {
    console.error("[assignment] Error marking case as HUMAN_REQUIRED", {
      message: error.message,
      supabaseError: error,
    });
  }
}

export async function assignCaseAutomatically(
  caseId: string,
): Promise<AssignmentResult> {
  try {
    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select(
        "id, area, category, channel, contact_type, status, lifecycle_status, routing_status, assigned_agent_id, assigned_to",
      )
      .eq("id", caseId)
      .limit(1)
      .returns<CaseForAssignment[]>();

    if (caseError || !caseData?.[0]) {
      console.error("[assignment] Error loading case", {
        message: caseError?.message ?? "Case not found",
        supabaseError: caseError,
      });

      return {
        status: "error",
        reason: caseError?.message ?? "Case not found",
        error: caseError,
      };
    }

    const caseItem = caseData[0];

    console.info("[assignment] Current case agent", {
      caseId,
      assignedAgentId: caseItem.assigned_agent_id,
      assignedTo: caseItem.assigned_to,
    });

    if (caseItem.assigned_agent_id) {
      const reason = "Case already assigned. Skipping auto assignment.";

      console.info("[assignment] Case already assigned. Skipping auto assignment.", {
        caseId,
        assignedAgentId: caseItem.assigned_agent_id,
        assignedTo: caseItem.assigned_to,
        reason,
      });

      return {
        status: "no_agent",
        reason,
      };
    }

    if (caseItem.status === "CLOSED" || caseItem.lifecycle_status === "CLOSED") {
      return {
        status: "no_agent",
        reason: "El caso está cerrado y no puede asignarse automáticamente.",
      };
    }

    const [agentsResult, skillsResult] = await Promise.all([
      supabase
        .from("agents")
        .select("id, name, email, max_open_cases")
        .eq("active", true)
        .eq("availability_status", "AVAILABLE")
        .returns<AgentForAssignment[]>(),
      supabase
        .from("agent_skills")
        .select("agent_id, area, category, channel")
        .eq("active", true)
        .returns<AgentSkill[]>(),
    ]);

    if (agentsResult.error) {
      console.error("[assignment] Error loading agents", {
        message: agentsResult.error.message,
        supabaseError: agentsResult.error,
      });

      return {
        status: "error",
        reason: agentsResult.error.message,
        error: agentsResult.error,
      };
    }

    if (skillsResult.error) {
      console.error("[assignment] Error loading skills", {
        message: skillsResult.error.message,
        supabaseError: skillsResult.error,
      });

      return {
        status: "error",
        reason: skillsResult.error.message,
        error: skillsResult.error,
      };
    }

    const agents = agentsResult.data ?? [];
    const skills = skillsResult.data ?? [];
    const skilledAgentIds = new Set(
      skills
        .filter((skill) => isSkillCompatible(skill, caseItem))
        .map((skill) => skill.agent_id)
        .filter((agentId): agentId is string => Boolean(agentId)),
    );
    const skilledAgents = agents.filter((agent) => skilledAgentIds.has(agent.id));

    if (skilledAgents.length === 0) {
      const reason = "No hay agentes disponibles con skill compatible.";
      await markCaseHumanRequired(caseId);

      return {
        status: "no_agent",
        reason,
      };
    }

    const candidateIds = skilledAgents.map((agent) => agent.id);
    const { data: openCasesData, error: openCasesError } = await supabase
      .from("cases")
      .select("assigned_agent_id")
      .in("assigned_agent_id", candidateIds)
      .neq("status", "CLOSED")
      .returns<OpenCase[]>();

    if (openCasesError) {
      console.error("[assignment] Error loading open case counts", {
        message: openCasesError.message,
        supabaseError: openCasesError,
      });

      return {
        status: "error",
        reason: openCasesError.message,
        error: openCasesError,
      };
    }

    const openCaseCounts = buildOpenCaseCounts(openCasesData ?? []);
    const candidates = skilledAgents
      .map((agent) => ({
        ...agent,
        openCases: openCaseCounts.get(agent.id) ?? 0,
      }))
      .filter((agent) => {
        if (agent.max_open_cases === null) {
          return true;
        }

        return agent.openCases < agent.max_open_cases;
      })
      .sort((agentA, agentB) => agentA.openCases - agentB.openCases);

    if (candidates.length === 0) {
      const reason = "No hay agentes disponibles bajo capacidad máxima.";
      await markCaseHumanRequired(caseId);

      return {
        status: "no_agent",
        reason,
      };
    }

    const selectedAgent = candidates[0];
    const selectedAgentName =
      selectedAgent.name ?? selectedAgent.email ?? selectedAgent.id;
    const now = new Date().toISOString();
    const reason = `Autoasignado por skill (${caseItem.area || "sin área"} / ${
      caseItem.category || "sin categoría"
    } / ${caseItem.channel || caseItem.contact_type || "sin canal"}) y menor carga (${
      selectedAgent.openCases
    } casos abiertos).`;

    const { error: updateError } = await supabase
      .from("cases")
      .update({
        assigned_agent_id: selectedAgent.id,
        assigned_to: selectedAgentName,
        assigned_at: now,
        status: "ASSIGNED",
        routing_status: "ASSIGNED",
        updated_at: now,
      })
      .eq("id", caseId);

    if (updateError) {
      console.error("[assignment] Error assigning case", {
        message: updateError.message,
        supabaseError: updateError,
      });

      return {
        status: "error",
        reason: updateError.message,
        error: updateError,
      };
    }

    const { error: logError } = await supabase.from("assignment_logs").insert({
      case_id: caseId,
      agent_id: selectedAgent.id,
      reason,
    });

    if (logError) {
      console.error("[assignment] Error inserting assignment log", {
        message: logError.message,
        supabaseError: logError,
      });
    }

    return {
      status: "assigned",
      agentId: selectedAgent.id,
      agentName: selectedAgentName,
      reason,
    };
  } catch (error) {
    console.error("[assignment] Unexpected assignment error", {
      message: error instanceof Error ? error.message : "Unknown error",
      error,
    });

    return {
      status: "error",
      reason: error instanceof Error ? error.message : "Unknown error",
      error,
    };
  }
}
