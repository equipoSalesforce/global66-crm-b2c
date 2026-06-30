"use client";

import { useRouter } from "next/navigation";
import {
  persistDemoCrmSession,
  type CrmUser,
} from "@/lib/crm-users";

export function DemoLoginAgents({ users }: { users: CrmUser[] }) {
  const router = useRouter();

  function selectUser(user: CrmUser) {
    persistDemoCrmSession(user);
    router.push("/dashboard");
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {users.map((user) => (
        <button
          key={user.id}
          type="button"
          onClick={() => selectUser(user)}
          className="rounded-lg border border-gray-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--g66-brand-blue)]"
        >
          <p className="text-lg font-bold text-gray-950">
            {user.name || "Sin nombre"}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            {user.email || "Sin email"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-[var(--g66-brand-blue-soft)] px-3 py-1 text-xs font-semibold text-[var(--g66-brand-blue)]">
              {user.role || "AGENT"}
            </span>
            {user.area ? (
              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                {user.area}
              </span>
            ) : null}
            {user.team ? (
              <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                {user.team}
              </span>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
}
