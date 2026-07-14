export type CaseApiActor = {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export function getDemoActorUser(): CaseApiActor {
  if (typeof window === "undefined") {
    return { name: "Usuario demo" };
  }

  return {
    userId: window.localStorage.getItem("agentId"),
    name:
      window.localStorage.getItem("agentName") ||
      window.localStorage.getItem("userName") ||
      "Usuario demo",
    email: window.localStorage.getItem("agentEmail"),
    role: window.localStorage.getItem("agentRole"),
  };
}

export async function fetchCaseApi<TResponse>(
  input: string,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo completar la operación.");
  }

  return payload as TResponse;
}
