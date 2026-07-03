export const agentRoles = [
  "AGENT",
  "SUPERVISOR",
  "COMPLIANCE",
  "ADMIN",
  "AUDITOR",
] as const;

export type AgentRole = (typeof agentRoles)[number];

export type Permission =
  | "viewDashboard"
  | "viewMyCases"
  | "viewQueue"
  | "viewCustomers"
  | "viewCases"
  | "viewAgents"
  | "viewWorkforce"
  | "viewReports"
  | "viewKnowledgeBase"
  | "viewSettings"
  | "viewAiLogs"
  | "viewAudit"
  | "viewCustomer360"
  | "respondToCustomers"
  | "simulateCustomerMessages"
  | "takeQueueCases"
  | "closeCases"
  | "editCaseFields"
  | "reassignCases"
  | "autoAssignCases"
  | "triggerAiTriage"
  | "editAgentConfig"
  | "viewAgentSkills"
  | "editKnowledgeBase"
  | "editGlobalSettings"
  | "manageUsers"
  | "managePermissions"
  | CrmPermissionKey;

export const crmPermissionCategories = [
  "navigation",
  "cases",
  "customers",
  "agents",
  "configuration",
  "users",
  "macros",
  "knowledge",
  "reports",
  "ai",
  "aircall",
] as const;

export type CrmPermissionCategory = (typeof crmPermissionCategories)[number];

export const crmPermissionCatalog = [
  {
    key: "view_dashboard",
    label: "Ver dashboard",
    category: "navigation",
    description: "Permite acceder al panel principal del CRM.",
  },
  {
    key: "view_cases",
    label: "Ver casos",
    category: "cases",
    description: "Permite listar y abrir casos.",
  },
  {
    key: "manage_cases",
    label: "Gestionar casos",
    category: "cases",
    description: "Permite ejecutar acciones operativas sobre casos.",
  },
  {
    key: "edit_case_fields",
    label: "Editar campos de caso",
    category: "cases",
    description: "Permite editar campos estándar del caso según permisos por campo.",
  },
  {
    key: "assign_cases",
    label: "Asignar casos",
    category: "cases",
    description: "Permite tomar o reasignar casos.",
  },
  {
    key: "close_cases",
    label: "Cerrar casos",
    category: "cases",
    description: "Permite cerrar casos.",
  },
  {
    key: "view_customers",
    label: "Ver clientes",
    category: "customers",
    description: "Permite ver clientes y Cliente 360.",
  },
  {
    key: "view_agents",
    label: "Ver agentes",
    category: "agents",
    description: "Permite ver agentes, disponibilidad, skills y carga operativa.",
  },
  {
    key: "manage_agents",
    label: "Gestionar agentes",
    category: "agents",
    description: "Permite editar configuración operativa, disponibilidad y skills de agentes.",
  },
  {
    key: "view_reports",
    label: "Ver reportes",
    category: "reports",
    description: "Permite ver reportes operativos.",
  },
  {
    key: "view_configuration",
    label: "Ver configuración",
    category: "configuration",
    description: "Permite acceder al área de configuración.",
  },
  {
    key: "manage_users",
    label: "Administrar usuarios",
    category: "users",
    description: "Permite crear y editar usuarios internos.",
  },
  {
    key: "manage_permissions",
    label: "Administrar permisos",
    category: "users",
    description: "Permite configurar permisos por rol y campos.",
  },
  {
    key: "manage_macros",
    label: "Administrar macros",
    category: "macros",
    description: "Permite configurar macros operativas.",
  },
  {
    key: "manage_knowledge",
    label: "Administrar conocimiento",
    category: "knowledge",
    description: "Permite editar base de conocimiento.",
  },
  {
    key: "sync_email",
    label: "Sincronizar email",
    category: "cases",
    description: "Permite sincronizar correo desde el módulo Ticket.",
  },
  {
    key: "use_ai",
    label: "Usar IA",
    category: "ai",
    description: "Permite ejecutar funcionalidades asistidas por IA.",
  },
  {
    key: "view_ai_case_summary",
    label: "Ver resumen IA de historial",
    category: "ai",
    description: "Permite ver la tab IA con resumen de casos históricos del cliente.",
  },
  {
    key: "generate_ai_case_summary",
    label: "Generar resumen IA de historial",
    category: "ai",
    description: "Permite actualizar el resumen IA de casos históricos del cliente.",
  },
  {
    key: "use_aircall",
    label: "Usar Aircall",
    category: "aircall",
    description: "Permite iniciar llamadas desde casos usando Aircall Everywhere.",
  },
  {
    key: "view_call_history",
    label: "Ver historial de llamadas",
    category: "aircall",
    description: "Permite ver llamadas registradas por Aircall en el caso.",
  },
  {
    key: "manage_aircall_settings",
    label: "Configurar Aircall",
    category: "aircall",
    description: "Permite administrar el mapeo entre usuarios CRM y usuarios Aircall.",
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  category: CrmPermissionCategory;
  description: string;
}>;

export type CrmPermissionKey = (typeof crmPermissionCatalog)[number]["key"];

export type CrmRolePermissionRecord = {
  role: string;
  permission_key: string;
  enabled: boolean;
};

export type CrmCaseFieldPermissionRecord = {
  role: string;
  field_key: string;
  can_view: boolean;
  can_edit: boolean;
};

export const standardCaseFieldKeys = [
  "subject",
  "area",
  "category",
  "priority",
  "lifecycle_status",
  "routing_status",
  "resolution_type",
  "contact_type",
  "assigned_agent_id",
  "assigned_to",
] as const;

export type StandardCaseFieldKey = (typeof standardCaseFieldKeys)[number];

export type NavigationItem = {
  label: string;
  href: string;
  icon: string;
  permission: Permission;
  roles: AgentRole[];
};

export const navigationItems: NavigationItem[] = [
  {
    label: "Inicio",
    href: "/dashboard",
    icon: "IN",
    permission: "view_dashboard",
    roles: ["AGENT", "SUPERVISOR", "COMPLIANCE", "ADMIN", "AUDITOR"],
  },
  {
    label: "Casos",
    href: "/casos",
    icon: "CA",
    permission: "view_cases",
    roles: ["AGENT", "SUPERVISOR", "COMPLIANCE", "ADMIN", "AUDITOR"],
  },
  {
    label: "Cuentas",
    href: "/cuentas",
    icon: "CL",
    permission: "view_customers",
    roles: ["AGENT", "SUPERVISOR", "COMPLIANCE", "ADMIN", "AUDITOR"],
  },
  {
    label: "Agentes",
    href: "/agentes",
    icon: "AG",
    permission: "view_agents",
    roles: ["AGENT", "SUPERVISOR", "ADMIN"],
  },
  {
    label: "Conversaciones",
    href: "/conversaciones",
    icon: "CO",
    permission: "view_cases",
    roles: ["AGENT", "SUPERVISOR", "COMPLIANCE", "ADMIN", "AUDITOR"],
  },
  {
    label: "Correos",
    href: "/casos?channel=GMAIL",
    icon: "EM",
    permission: "sync_email",
    roles: ["AGENT", "SUPERVISOR", "COMPLIANCE", "ADMIN", "AUDITOR"],
  },
  {
    label: "IA & Automatizaciones",
    href: "/logs-ia",
    icon: "IA",
    permission: "use_ai",
    roles: ["COMPLIANCE", "ADMIN", "AUDITOR"],
  },
  {
    label: "Reportes",
    href: "/sla",
    icon: "RP",
    permission: "view_reports",
    roles: ["SUPERVISOR", "COMPLIANCE", "ADMIN", "AUDITOR"],
  },
  {
    label: "Conocimiento",
    href: "/base-conocimiento",
    icon: "BC",
    permission: "manage_knowledge",
    roles: ["SUPERVISOR", "ADMIN"],
  },
  {
    label: "Configuración",
    href: "/configuracion",
    icon: "CF",
    permission: "view_configuration",
    roles: ["ADMIN"],
  },
  {
    label: "Auditoría",
    href: "/auditoria",
    icon: "AU",
    permission: "viewAudit",
    roles: ["COMPLIANCE", "AUDITOR"],
  },
];

const permissionsByRole: Record<AgentRole, Permission[]> = {
  AGENT: [
    "viewDashboard",
    "viewMyCases",
    "viewQueue",
    "viewCustomers",
    "viewCases",
    "viewCustomer360",
    "respondToCustomers",
    "simulateCustomerMessages",
    "takeQueueCases",
    "closeCases",
  ],
  SUPERVISOR: [
    "viewDashboard",
    "viewMyCases",
    "viewQueue",
    "viewCustomers",
    "viewCases",
    "viewAgents",
    "viewWorkforce",
    "viewCustomer360",
    "respondToCustomers",
    "simulateCustomerMessages",
    "takeQueueCases",
    "closeCases",
    "editCaseFields",
    "reassignCases",
    "autoAssignCases",
    "triggerAiTriage",
    "viewAgentSkills",
  ],
  COMPLIANCE: [
    "viewDashboard",
    "viewQueue",
    "viewCustomers",
    "viewCases",
    "viewAiLogs",
    "viewAudit",
    "viewCustomer360",
    "viewAgentSkills",
  ],
  ADMIN: [
    "viewDashboard",
    "viewMyCases",
    "viewQueue",
    "viewCustomers",
    "viewCases",
    "viewAgents",
    "viewWorkforce",
    "viewKnowledgeBase",
    "viewSettings",
    "viewCustomer360",
    "respondToCustomers",
    "simulateCustomerMessages",
    "takeQueueCases",
    "closeCases",
    "editCaseFields",
    "reassignCases",
    "autoAssignCases",
    "triggerAiTriage",
    "editAgentConfig",
    "viewAgentSkills",
    "editKnowledgeBase",
    "editGlobalSettings",
    "manageUsers",
    "managePermissions",
  ],
  AUDITOR: [
    "viewDashboard",
    "viewCustomers",
    "viewCases",
    "viewAiLogs",
    "viewAudit",
    "viewCustomer360",
  ],
};

const crmPermissionAliasByLegacyPermission: Partial<Record<Permission, CrmPermissionKey>> = {
  viewDashboard: "view_dashboard",
  viewCases: "view_cases",
  viewCustomers: "view_customers",
  viewAgents: "view_agents",
  viewWorkforce: "view_agents",
  viewReports: "view_reports",
  viewSettings: "view_configuration",
  manageUsers: "manage_users",
  managePermissions: "manage_permissions",
  editCaseFields: "edit_case_fields",
  takeQueueCases: "assign_cases",
  reassignCases: "assign_cases",
  autoAssignCases: "assign_cases",
  closeCases: "close_cases",
  editAgentConfig: "manage_agents",
  viewAgentSkills: "view_agents",
  editKnowledgeBase: "manage_knowledge",
  editGlobalSettings: "view_configuration",
  respondToCustomers: "manage_cases",
  triggerAiTriage: "use_ai",
};

export const defaultCrmRolePermissions: Record<"ADMIN" | "SUPERVISOR" | "AGENT", CrmPermissionKey[]> = {
  ADMIN: crmPermissionCatalog.map((permission) => permission.key),
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

export const defaultCaseFieldPermissions: Record<
  "ADMIN" | "SUPERVISOR" | "AGENT",
  Record<string, { can_view: boolean; can_edit: boolean }>
> = {
  ADMIN: Object.fromEntries(
    standardCaseFieldKeys.map((fieldKey) => [
      fieldKey,
      { can_view: true, can_edit: true },
    ]),
  ),
  SUPERVISOR: Object.fromEntries(
    standardCaseFieldKeys.map((fieldKey) => [
      fieldKey,
      { can_view: true, can_edit: true },
    ]),
  ),
  AGENT: Object.fromEntries(
    standardCaseFieldKeys.map((fieldKey) => [
      fieldKey,
      {
        can_view: true,
        can_edit: !["assigned_agent_id", "assigned_to"].includes(fieldKey),
      },
    ]),
  ),
};

const menuOrderByRole: Record<AgentRole, string[]> = {
  AGENT: [
    "/dashboard",
    "/casos",
    "/cuentas",
    "/agentes",
    "/conversaciones",
    "/casos?channel=GMAIL",
  ],
  SUPERVISOR: [
    "/dashboard",
    "/casos",
    "/cuentas",
    "/agentes",
    "/conversaciones",
    "/casos?channel=GMAIL",
    "/sla",
    "/base-conocimiento",
  ],
  COMPLIANCE: [
    "/dashboard",
    "/casos",
    "/cuentas",
    "/conversaciones",
    "/casos?channel=GMAIL",
    "/logs-ia",
    "/sla",
    "/auditoria",
  ],
  ADMIN: [
    "/dashboard",
    "/casos",
    "/cuentas",
    "/agentes",
    "/conversaciones",
    "/casos?channel=GMAIL",
    "/logs-ia",
    "/sla",
    "/base-conocimiento",
    "/configuracion",
  ],
  AUDITOR: [
    "/dashboard",
    "/casos",
    "/cuentas",
    "/conversaciones",
    "/casos?channel=GMAIL",
    "/logs-ia",
    "/sla",
    "/auditoria",
  ],
};

export function normalizeRole(role: string | null | undefined): AgentRole {
  const normalizedRole = role?.trim().toUpperCase();

  return agentRoles.includes(normalizedRole as AgentRole)
    ? (normalizedRole as AgentRole)
    : "AGENT";
}

function normalizeConfigurableRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);

  return ["ADMIN", "SUPERVISOR", "AGENT"].includes(normalizedRole)
    ? (normalizedRole as "ADMIN" | "SUPERVISOR" | "AGENT")
    : "AGENT";
}

function normalizePermissionKey(permission: Permission): CrmPermissionKey | null {
  if (crmPermissionCatalog.some((item) => item.key === permission)) {
    return permission as CrmPermissionKey;
  }

  return crmPermissionAliasByLegacyPermission[permission] ?? null;
}

export function getRolePermissions(
  role: string | null | undefined,
  configuredPermissions?: CrmRolePermissionRecord[] | null,
) {
  const normalizedRole = normalizeConfigurableRole(role);
  const roleRows = configuredPermissions?.filter(
    (permission) => normalizeConfigurableRole(permission.role) === normalizedRole,
  );
  const defaults = defaultCrmRolePermissions[normalizedRole];

  if (roleRows && roleRows.length > 0) {
    const permissions = new Set<CrmPermissionKey>(defaults);

    roleRows.forEach((permission) => {
      const permissionKey = permission.permission_key as CrmPermissionKey;

      if (permission.enabled) {
        permissions.add(permissionKey);
      } else {
        permissions.delete(permissionKey);
      }
    });

    return [...permissions];
  }

  return defaults;
}

export function hasPermission(
  role: string | null | undefined,
  permission: Permission,
  configuredPermissions?: CrmRolePermissionRecord[] | null,
) {
  const permissionKey = normalizePermissionKey(permission);

  if (permissionKey) {
    return getRolePermissions(role, configuredPermissions).includes(permissionKey);
  }

  return permissionsByRole[normalizeRole(role)].includes(permission);
}

export function getPermissions(role: string | null | undefined) {
  return permissionsByRole[normalizeRole(role)];
}

export function getNavigationItems(
  role: string | null | undefined,
  configuredPermissions?: CrmRolePermissionRecord[] | null,
) {
  const normalizedRole = normalizeRole(role);
  const allowedHrefs = menuOrderByRole[normalizedRole];

  return allowedHrefs
    .map((href) => navigationItems.find((item) => item.href === href))
    .filter((item): item is NavigationItem =>
      Boolean(
        item &&
          item.roles.includes(normalizedRole) &&
          hasPermission(normalizedRole, item.permission, configuredPermissions),
      ),
    );
}

export function canViewCaseField(
  role: string | null | undefined,
  fieldKey: string,
  configuredFieldPermissions?: CrmCaseFieldPermissionRecord[] | null,
) {
  const normalizedRole = normalizeConfigurableRole(role);
  const configured = configuredFieldPermissions?.find(
    (permission) =>
      normalizeConfigurableRole(permission.role) === normalizedRole &&
      permission.field_key === fieldKey,
  );

  if (configured) {
    return configured.can_view;
  }

  if (fieldKey in defaultCaseFieldPermissions[normalizedRole]) {
    return defaultCaseFieldPermissions[normalizedRole][fieldKey].can_view;
  }

  if (normalizedRole === "ADMIN") return true;

  return true;
}

export function canEditCaseField(
  role: string | null | undefined,
  fieldKey: string,
  configuredFieldPermissions?: CrmCaseFieldPermissionRecord[] | null,
) {
  const normalizedRole = normalizeConfigurableRole(role);
  const configured = configuredFieldPermissions?.find(
    (permission) =>
      normalizeConfigurableRole(permission.role) === normalizedRole &&
      permission.field_key === fieldKey,
  );

  if (configured) {
    return configured.can_edit;
  }

  if (fieldKey in defaultCaseFieldPermissions[normalizedRole]) {
    return defaultCaseFieldPermissions[normalizedRole][fieldKey].can_edit;
  }

  if (normalizedRole === "ADMIN") return true;

  return false;
}
