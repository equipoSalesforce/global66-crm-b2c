"use client";

import { AgentRole, normalizeRole } from "@/lib/permissions";
import { useEffect, useState } from "react";

export function useDemoRole() {
  const [role, setRole] = useState<AgentRole>("AGENT");
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  useEffect(() => {
    const storedRole = window.localStorage.getItem("agentRole");

    window.setTimeout(() => {
      setRole(normalizeRole(storedRole));
      setIsCheckingRole(false);
    }, 0);
  }, []);

  return { role, isCheckingRole };
}
