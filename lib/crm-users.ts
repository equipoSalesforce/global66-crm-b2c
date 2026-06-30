export const crmUserRoles = ["ADMIN", "SUPERVISOR", "AGENT"] as const;
export const crmUserStatuses = ["ACTIVE", "INACTIVE"] as const;

export type CrmUserRole = (typeof crmUserRoles)[number];
export type CrmUserStatus = (typeof crmUserStatuses)[number];

export type CrmPermission =
  | "view_dashboard"
  | "view_cases"
  | "manage_cases"
  | "edit_case_fields"
  | "assign_cases"
  | "close_cases"
  | "view_customers"
  | "view_agents"
  | "manage_agents"
  | "view_reports"
  | "view_configuration"
  | "manage_users"
  | "manage_permissions"
  | "manage_macros"
  | "manage_knowledge"
  | "sync_email"
  | "use_ai"
  | "view_ai_case_summary"
  | "generate_ai_case_summary"
  | "use_aircall"
  | "view_call_history"
  | "manage_aircall_settings";

export type CrmUser = {
  id: string;
  name: string;
  email: string;
  role: CrmUserRole;
  area: string | null;
  team: string | null;
  status: CrmUserStatus;
  avatar_url: string | null;
  external_auth_provider: string | null;
  external_auth_id: string | null;
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DemoCrmSession = {
  id: string;
  name: string;
  email: string;
  role: CrmUserRole;
  area: string | null;
  team: string | null;
  status: CrmUserStatus;
};

export const crmPermissionsByRole: Record<CrmUserRole, CrmPermission[]> = {
  ADMIN: [
    "view_dashboard",
    "view_cases",
    "manage_cases",
    "edit_case_fields",
    "assign_cases",
    "close_cases",
    "view_customers",
    "view_agents",
    "manage_agents",
    "view_reports",
    "view_configuration",
    "manage_users",
    "manage_permissions",
    "manage_macros",
    "manage_knowledge",
    "sync_email",
    "use_ai",
    "view_ai_case_summary",
    "generate_ai_case_summary",
    "use_aircall",
    "view_call_history",
    "manage_aircall_settings",
  ],
  SUPERVISOR: [
    "view_dashboard",
    "view_cases",
    "manage_cases",
    "edit_case_fields",
    "assign_cases",
    "close_cases",
    "view_customers",
    "view_agents",
    "view_reports",
    "manage_knowledge",
    "sync_email",
    "use_ai",
    "view_ai_case_summary",
    "generate_ai_case_summary",
    "use_aircall",
    "view_call_history",
  ],
  AGENT: [
    "view_dashboard",
    "view_cases",
    "manage_cases",
    "edit_case_fields",
    "close_cases",
    "view_customers",
    "sync_email",
    "use_ai",
    "view_ai_case_summary",
    "generate_ai_case_summary",
    "use_aircall",
    "view_call_history",
  ],
};

export function normalizeCrmUserRole(role: string | null | undefined): CrmUserRole {
  return crmUserRoles.includes(role as CrmUserRole)
    ? (role as CrmUserRole)
    : "AGENT";
}

export function normalizeCrmUserStatus(
  status: string | null | undefined,
): CrmUserStatus {
  return crmUserStatuses.includes(status as CrmUserStatus)
    ? (status as CrmUserStatus)
    : "ACTIVE";
}

export function hasCrmPermission(
  role: string | null | undefined,
  permission: CrmPermission,
) {
  return crmPermissionsByRole[normalizeCrmUserRole(role)].includes(permission);
}

export function getCrmPermissions(role: string | null | undefined) {
  return crmPermissionsByRole[normalizeCrmUserRole(role)];
}

// TODO(Cognito): resolve this from Cognito/Google SSO claims, then lookup crm_users.email.
export function getDemoUserEmailFromStorage() {
  if (typeof window === "undefined") return "";

  return window.localStorage.getItem("agentEmail") ?? "";
}

export function persistDemoCrmSession(user: Pick<CrmUser, "id" | "name" | "email" | "role" | "area" | "team" | "status">) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem("agentId", user.id);
  window.localStorage.setItem("agentName", user.name);
  window.localStorage.setItem("agentEmail", user.email);
  window.localStorage.setItem("agentRole", user.role);
  window.localStorage.setItem("crmUserId", user.id);
}

export function clearDemoCrmSession() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem("agentId");
  window.localStorage.removeItem("agentName");
  window.localStorage.removeItem("agentEmail");
  window.localStorage.removeItem("agentRole");
  window.localStorage.removeItem("crmUserId");
}

export function getStoredDemoCrmSession(): DemoCrmSession | null {
  if (typeof window === "undefined") return null;

  const id =
    window.localStorage.getItem("crmUserId") ??
    window.localStorage.getItem("agentId") ??
    "";
  const email = window.localStorage.getItem("agentEmail") ?? "";
  const name = window.localStorage.getItem("agentName") ?? "";

  if (!id && !email) return null;

  return {
    id,
    email,
    name: name || email || "Agente",
    role: normalizeCrmUserRole(window.localStorage.getItem("agentRole")),
    area: null,
    team: null,
    status: "ACTIVE",
  };
}
