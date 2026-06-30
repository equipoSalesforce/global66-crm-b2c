"use client";

import Link from "next/link";
import { hasPermission } from "@/lib/permissions";
import { useDemoRole } from "./use-demo-role";

export type WorkforceAgentRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  availability_status: string | null;
  max_open_cases: number | null;
  openCases: number;
  closedCases: number;
  skills: {
    area: string | null;
    category: string | null;
    channel: string | null;
    active: boolean | null;
  }[];
};

function getUtilization(row: WorkforceAgentRow) {
  const maxOpenCases = row.max_open_cases ?? 0;

  if (maxOpenCases <= 0) {
    return 0;
  }

  return Math.round((row.openCases / maxOpenCases) * 100);
}

function utilizationStyles(utilization: number) {
  if (utilization > 80) {
    return {
      bg: "bg-[var(--g66-danger)]",
      badge: "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]",
    };
  }

  if (utilization >= 50) {
    return {
      bg: "bg-[var(--g66-brand-blue)]",
      badge: "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-accent-cyan)]",
    };
  }

  return {
    bg: "bg-[var(--g66-success)]",
    badge: "bg-[var(--g66-success-soft)] text-[var(--g66-success)]",
  };
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
      {children}
    </span>
  );
}

function SkillSummary({ skills }: { skills: WorkforceAgentRow["skills"] }) {
  const activeSkills = skills.filter((skill) => skill.active !== false);
  const visibleSkills = activeSkills.slice(0, 3);
  const hiddenCount = activeSkills.length - visibleSkills.length;

  if (activeSkills.length === 0) {
    return <span className="text-sm text-gray-500">Sin skills activos</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visibleSkills.map((skill, index) => (
        <Badge key={`${skill.area}-${skill.category}-${skill.channel}-${index}`}>
          {[skill.area, skill.category, skill.channel].filter(Boolean).join(" · ")}
        </Badge>
      ))}
      {hiddenCount > 0 ? <Badge>+{hiddenCount}</Badge> : null}
    </div>
  );
}

export function WorkforceDashboard({ rows }: { rows: WorkforceAgentRow[] }) {
  const { role, isCheckingRole } = useDemoRole();

  if (isCheckingRole) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
        Validando permisos...
      </section>
    );
  }

  if (!hasPermission(role, "viewWorkforce")) {
    return (
      <section className="rounded-lg border border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue-soft)] p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--g66-brand-blue)]">Acceso restringido</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--g66-brand-blue)]">
          Solo SUPERVISOR y ADMIN pueden ver el Workforce Dashboard.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-950">Carga por agente</h2>
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[1180px]">
            <div className="grid grid-cols-[1.2fr_0.7fr_0.9fr_0.7fr_0.7fr_0.8fr_1fr_1.4fr] gap-4 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase text-gray-500">
              <span>Nombre</span>
              <span>Rol</span>
              <span>Disponibilidad</span>
              <span>Abiertos</span>
              <span>Cerrados</span>
              <span>Max Open</span>
              <span>Utilización</span>
              <span>Skills</span>
            </div>

            <ul className="divide-y divide-gray-200 bg-white">
              {rows.map((row) => {
                const utilization = getUtilization(row);
                const styles = utilizationStyles(utilization);

                return (
                  <li key={row.id}>
                    <Link
                      href={`/agentes/${row.id}`}
                      className="grid grid-cols-[1.2fr_0.7fr_0.9fr_0.7fr_0.7fr_0.8fr_1fr_1.4fr] gap-4 px-5 py-4 text-sm transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    >
                      <span>
                        <span className="block font-semibold text-gray-950">
                          {row.name || "Sin nombre"}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {row.email || "Sin email"}
                        </span>
                      </span>
                      <span className="text-gray-600">{row.role || "AGENT"}</span>
                      <span>
                        <Badge>{row.availability_status || "AVAILABLE"}</Badge>
                      </span>
                      <span className="font-semibold text-gray-950">
                        {row.openCases.toLocaleString("es-CL")}
                      </span>
                      <span className="text-gray-600">
                        {row.closedCases.toLocaleString("es-CL")}
                      </span>
                      <span className="text-gray-600">
                        {row.max_open_cases ?? "Sin límite"}
                      </span>
                      <span>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${styles.badge}`}
                        >
                          {utilization}%
                        </span>
                        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-gray-100">
                          <span
                            className={`block h-full rounded-full ${styles.bg}`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          />
                        </span>
                      </span>
                      <SkillSummary skills={row.skills} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : (
        <p className="p-6 text-sm text-gray-600">
          No hay agentes para mostrar.
        </p>
      )}
    </section>
  );
}
