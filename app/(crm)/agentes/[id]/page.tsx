import { AgentManagementPanel } from "@/components/agent-management-panel";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Agent = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  area: string | null;
  team: string | null;
  status: string | null;
};

type AgentProfile = {
  user_id: string;
  availability: string | null;
  max_open_cases: number | null;
  is_active: boolean | null;
};

type CaseRecord = {
  id: string | number | null;
  subject: string | null;
  status: string | null;
  priority: string | null;
  contact_name: string | null;
  contact_email: string | null;
  created_at: string | null;
  customer: {
    name: string | null;
  } | null;
};

type AgentSkill = {
  id: string | number;
  area: string | null;
  category: string | null;
  channel: string | null;
  status: string | null;
};

function formatDate(date: string | null | undefined) {
  if (!date) {
    return "Sin fecha";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function isClosedCase(status: string | null) {
  return status === "CLOSED";
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-950">{value}</dd>
    </div>
  );
}

function getCaseCustomerLabel(caseItem: CaseRecord) {
  return (
    caseItem.customer?.name ??
    caseItem.contact_name ??
    caseItem.contact_email ??
    "Sin cliente"
  );
}

async function ensureAgentProfile(userId: string) {
  await supabase.from("crm_agent_profiles").upsert(
    {
      user_id: userId,
      availability: "AVAILABLE",
      max_open_cases: 10,
      is_active: true,
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
}

async function getAssignedCases(agent: Pick<Agent, "id" | "email" | "name">) {
  const select =
    "id, subject, status, priority, contact_name, contact_email, created_at, customer:customers(name)";
  const [byId, byEmail, byName] = await Promise.all([
    supabase
      .from("cases")
      .select(select)
      .eq("assigned_agent_id", agent.id)
      .order("created_at", { ascending: false })
      .returns<CaseRecord[]>(),
    supabase
      .from("cases")
      .select(select)
      .eq("assigned_to", agent.email)
      .order("created_at", { ascending: false })
      .returns<CaseRecord[]>(),
    supabase
      .from("cases")
      .select(select)
      .eq("assigned_to", agent.name)
      .order("created_at", { ascending: false })
      .returns<CaseRecord[]>(),
  ]);

  const caseMap = new Map<string, CaseRecord>();
  [byId.data, byEmail.data, byName.data].forEach((rows) => {
    rows?.forEach((caseItem) => {
      if (caseItem.id) {
        caseMap.set(String(caseItem.id), caseItem);
      }
    });
  });

  return {
    cases: [...caseMap.values()].sort((left, right) => {
      const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
      const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;

      return rightTime - leftTime;
    }),
    error: byId.error?.message ?? byEmail.error?.message ?? byName.error?.message ?? null,
  };
}

function CaseList({
  title,
  cases,
  emptyText,
}: {
  title: string;
  cases: CaseRecord[];
  emptyText: string;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-950">{title}</h2>
      </div>

      {cases.length > 0 ? (
        <ul className="divide-y divide-gray-200">
          {cases.map((caseItem, index) => (
            <li key={caseItem.id ?? `case-${index}`}>
              <Link
                href={`/casos/${caseItem.id}`}
                className="grid gap-3 px-6 py-4 transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <p className="font-semibold text-gray-950">
                    {caseItem.subject || "Sin asunto"}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {getCaseCustomerLabel(caseItem)} ·{" "}
                    {formatDate(caseItem.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {caseItem.status ? <Badge>{caseItem.status}</Badge> : null}
                  {caseItem.priority ? <Badge>{caseItem.priority}</Badge> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="p-6 text-sm text-gray-600">{emptyText}</p>
      )}
    </section>
  );
}

export default async function AgenteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: agentData, error: agentError } = await supabase
    .from("crm_users")
    .select("id, name, email, role, area, team, status")
    .eq("id", id)
    .limit(1)
    .returns<Agent[]>();

  if (agentError || !agentData?.[0]) {
    notFound();
  }

  const agent = agentData[0];
  await ensureAgentProfile(agent.id);

  const { cases, error: casesError } = await getAssignedCases(agent);

  const { data: profileData } = await supabase
    .from("crm_agent_profiles")
    .select("user_id, availability, max_open_cases, is_active")
    .eq("user_id", id)
    .limit(1)
    .maybeSingle<AgentProfile>();

  const { data: skillsData, error: skillsError } = await supabase
    .from("crm_agent_skills")
    .select("id, area, category, channel, status")
    .eq("user_id", id)
    .order("area", { ascending: true })
    .returns<AgentSkill[]>();

  const profile = profileData ?? {
    user_id: agent.id,
    availability: "AVAILABLE",
    max_open_cases: 10,
    is_active: true,
  };
  const skills = skillsData ?? [];
  const openCases = cases.filter((caseItem) => !isClosedCase(caseItem.status));
  const closedCases = cases.filter((caseItem) => isClosedCase(caseItem.status));

  return (
    <>
      <PageHeader
        title={agent.name || "Agente sin nombre"}
        description="Detalle de agente y carga de casos asignados."
      />

      <RoleGuard anyPermission={["viewAgents"]}>
        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-950">Datos agente</h2>
              <dl className="mt-5 space-y-4">
                <InfoRow label="Nombre" value={agent.name || "Sin nombre"} />
                <InfoRow label="Email" value={agent.email || "Sin email"} />
                <InfoRow label="Rol" value={agent.role || "AGENT"} />
                <InfoRow
                  label="Área / equipo"
                  value={
                    [agent.area, agent.team].filter(Boolean).join(" · ") ||
                    "Sin área"
                  }
                />
                <InfoRow
                  label="Disponibilidad"
                  value={profile.availability || "AVAILABLE"}
                />
                <InfoRow
                  label="Max casos abiertos"
                  value={String(profile.max_open_cases ?? "Sin límite")}
                />
                <InfoRow
                  label="Estado operativo"
                  value={profile.is_active ? "Activo" : "Inactivo"}
                />
                <InfoRow label="Acceso CRM" value={agent.status || "ACTIVE"} />
              </dl>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-950">Resumen</h2>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-gray-950">
                    {cases.length}
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-500">Casos</p>
                </div>
                <div className="rounded-lg bg-[var(--g66-brand-blue-soft)] p-3 text-center">
                  <p className="text-2xl font-bold text-[var(--g66-brand-blue)]">
                    {openCases.length}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[var(--g66-brand-blue)]">
                    Abiertos
                  </p>
                </div>
                <div className="rounded-lg bg-[var(--g66-success-soft)] p-3 text-center">
                  <p className="text-2xl font-bold text-[var(--g66-success)]">
                    {closedCases.length}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[var(--g66-success)]">
                    Cerrados
                  </p>
                </div>
              </div>
            </section>
          </aside>

          <div className="space-y-6">
            {skillsError ? (
              <section className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] p-6 text-sm text-[var(--g66-danger)]">
                No se pudieron cargar los skills del agente.
              </section>
            ) : (
              <AgentManagementPanel
                agent={{
                  id: agent.id,
                  availability_status: profile.availability,
                  max_open_cases: profile.max_open_cases,
                  active: profile.is_active,
                }}
                skills={skills.map((skill) => ({
                  ...skill,
                  active: skill.status !== "INACTIVE",
                }))}
              />
            )}

            {casesError ? (
              <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-[var(--g66-danger)]">
                  No se pudieron cargar los casos del agente.
                </p>
              </section>
            ) : (
              <>
                <CaseList
                  title="Casos abiertos"
                  cases={openCases}
                  emptyText="No hay casos abiertos para este agente."
                />
                <CaseList
                  title="Casos cerrados"
                  cases={closedCases}
                  emptyText="No hay casos cerrados para este agente."
                />
              </>
            )}
          </div>
        </section>
      </RoleGuard>
    </>
  );
}
