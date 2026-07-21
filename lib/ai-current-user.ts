import "server-only";

import { getCurrentCrmUser } from "@/lib/current-crm-user";
import type { AiGovernanceUser } from "@/lib/ai-governance-types";

export async function getCurrentAiUser() {
  return getCurrentCrmUser();
}

export function requireAiAdmin(user: AiGovernanceUser) {
  if (user.role !== "ADMIN") {
    throw new Error("No tienes permisos para administrar Gobierno IA.");
  }
}
