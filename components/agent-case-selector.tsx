"use client";

import { useRouter } from "next/navigation";

type AgentOption = {
  id: string;
  name: string | null;
  email: string | null;
  active: boolean | null;
};

export function AgentCaseSelector({
  agents,
  selectedAgentId,
}: {
  agents: AgentOption[];
  selectedAgentId: string;
}) {
  const router = useRouter();

  return (
    <label className="grid gap-2 sm:max-w-sm">
      <span className="text-sm font-semibold text-gray-950">Agente</span>
      <select
        value={selectedAgentId}
        onChange={(event) => {
          const agentId = event.target.value;
          router.push(agentId ? `/mis-casos?agentId=${agentId}` : "/mis-casos");
        }}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
      >
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name || agent.email || agent.id}
            {agent.active === false ? " (inactivo)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
