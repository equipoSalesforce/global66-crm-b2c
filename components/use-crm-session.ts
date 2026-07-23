"use client";

import {
  clearDemoCrmSession,
  getStoredDemoCrmSession,
  normalizeCrmUserRole,
  normalizeCrmUserStatus,
  persistDemoCrmSession,
  type DemoCrmSession,
} from "@/lib/crm-users";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SessionState = {
  user: DemoCrmSession | null;
  isChecking: boolean;
  warning: string | null;
};

type CrmUserSessionRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  area: string | null;
  team: string | null;
  status: string | null;
};

export function useCrmSession({ redirectInactive = true } = {}) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({
    user: null,
    isChecking: true,
    warning: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function resolveSession() {
      try {
        const authResponse = await fetch("/api/auth/me", { cache: "no-store" });
        const authPayload = (await authResponse.json()) as {
          enabled?: boolean;
          user?: CrmUserSessionRow | null;
        };

        if (authPayload.enabled) {
          if (!isMounted) return;
          if (!authResponse.ok || !authPayload.user) {
            clearDemoCrmSession();
            if (redirectInactive) router.replace("/login");
            setState({
              user: null,
              isChecking: false,
              warning: "No hay una sesión CRM activa.",
            });
            return;
          }

          clearDemoCrmSession();
          setState({
            user: {
              id: authPayload.user.id,
              name: authPayload.user.name,
              email: authPayload.user.email,
              role: normalizeCrmUserRole(authPayload.user.role),
              area: authPayload.user.area,
              team: authPayload.user.team,
              status: normalizeCrmUserStatus(authPayload.user.status),
            },
            isChecking: false,
            warning: null,
          });
          return;
        }
      } catch {
        if (!isMounted) return;
        setState({
          user: null,
          isChecking: false,
          warning: "No se pudo validar la sesión CRM.",
        });
        return;
      }

      const storedSession = getStoredDemoCrmSession();

      if (!storedSession) {
        if (redirectInactive) router.replace("/login");
        if (isMounted) {
          setState({
            user: null,
            isChecking: false,
            warning: "No hay sesión demo activa.",
          });
        }
        return;
      }

      const query = supabaseBrowser
        .from("crm_users")
        .select("id, name, email, role, area, team, status")
        .limit(1);

      const { data, error } = storedSession.email
        ? await query
            .eq("email", storedSession.email.toLowerCase())
            .maybeSingle<CrmUserSessionRow>()
        : await query.eq("id", storedSession.id).maybeSingle<CrmUserSessionRow>();

      if (!isMounted) return;

      if (!error && data) {
        const resolvedSession: DemoCrmSession = {
          id: data.id,
          name: data.name,
          email: data.email,
          role: normalizeCrmUserRole(data.role),
          area: data.area,
          team: data.team,
          status: normalizeCrmUserStatus(data.status),
        };

        if (resolvedSession.status === "INACTIVE") {
          clearDemoCrmSession();
          if (redirectInactive) router.replace("/login");
          setState({
            user: null,
            isChecking: false,
            warning: "El usuario interno está inactivo.",
          });
          return;
        }

        persistDemoCrmSession(resolvedSession);
        setState({ user: resolvedSession, isChecking: false, warning: null });
        return;
      }

      // TODO(Cognito): remove this fallback when Cognito/Google SSO is the source of identity.
      setState({
        user: storedSession,
        isChecking: false,
        warning: "El usuario no existe en crm_users. Usando fallback demo.",
      });
    }

    void resolveSession();

    return () => {
      isMounted = false;
    };
  }, [redirectInactive, router]);

  return state;
}
