import { fetchCaseApi } from "./case-api-client";

export type AssignableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
};

export const fallbackAssignableUsers: AssignableUser[] = [
  {
    id: "sebas",
    name: "Sebas",
    email: "sebas@global66.com",
    role: "ADMIN",
    team: "CX",
  },
  {
    id: "agent-cx",
    name: "Agente CX",
    email: "agente.cx@global66.com",
    role: "AGENT",
    team: "CX",
  },
  {
    id: "supervisor-cx",
    name: "Supervisor CX",
    email: "supervisor.cx@global66.com",
    role: "SUPERVISOR",
    team: "CX",
  },
  {
    id: "katherine-admin",
    name: "Katherine Admin",
    email: "katherine.admin@global66.com",
    role: "ADMIN",
    team: "CRM",
  },
  {
    id: "analista-cmpl",
    name: "Analista CMPL",
    email: "analista.cmpl@global66.com",
    role: "ANALYST",
    team: "CMPL",
  },
];

export async function getAssignableUsers() {
  try {
    const payload = await fetchCaseApi<{ users: AssignableUser[] }>(
      "/api/users/assignable",
    );

    return payload.users.length > 0 ? payload.users : fallbackAssignableUsers;
  } catch {
    return fallbackAssignableUsers;
  }
}
