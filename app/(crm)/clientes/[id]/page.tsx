import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Customer = {
  id: string | number | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
};

type CaseRecord = {
  id: string | number | null;
  subject: string | null;
  channel: string | null;
  status: string | null;
  resolution_type: string | null;
  created_at: string | null;
};

type MessageRecord = {
  id: string | number | null;
  case_id: string | number | null;
  direction: string | null;
  sender_type: string | null;
  body: string | null;
  created_at: string | null;
};

function formatDate(date: string | null) {
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

function formatDateTime(date: string | null) {
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

function getMessageBody(message: MessageRecord) {
  return message.body ?? "Mensaje sin contenido";
}

function isClosedCase(status: string | null) {
  const normalizedStatus = status?.toLowerCase() ?? "";

  return [
    "closed",
    "cerrado",
    "resuelto",
    "resolved",
    "done",
    "finalizado",
  ].includes(normalizedStatus);
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
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
                    {caseItem.channel || "Sin canal"} ·{" "}
                    {formatDate(caseItem.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {caseItem.status ? <Badge>{caseItem.status}</Badge> : null}
                  {caseItem.resolution_type ? (
                    <Badge>{caseItem.resolution_type}</Badge>
                  ) : null}
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

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: customerData, error: customerError } = await supabase
    .from("customers")
    .select("id, name, email, phone, created_at")
    .eq("id", id)
    .limit(1)
    .returns<Customer[]>();

  if (customerError || !customerData?.[0]) {
    notFound();
  }

  const customer = customerData[0];

  const { data: casesData, error: casesError } = await supabase
    .from("cases")
    .select("id, subject, channel, status, resolution_type, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .returns<CaseRecord[]>();

  const cases = casesData ?? [];
  const openCases = cases.filter((caseItem) => !isClosedCase(caseItem.status));
  const closedCases = cases.filter((caseItem) => isClosedCase(caseItem.status));
  const caseIds = cases
    .map((caseItem) => caseItem.id)
    .filter((caseId): caseId is string | number => caseId !== null);

  const { data: messagesData, error: messagesError } =
    caseIds.length > 0
      ? await supabase
          .from("messages")
          .select("id, case_id, direction, sender_type, body, created_at")
          .in("case_id", caseIds)
          .order("created_at", { ascending: false })
          .limit(10)
          .returns<MessageRecord[]>()
      : { data: [], error: null };

  const messages = messagesData ?? [];

  return (
    <>
      <PageHeader
        title={customer.name || "Cliente sin nombre"}
        description="Cliente 360: perfil, historial de casos y últimos mensajes."
      />

      <RoleGuard anyPermission={["viewCustomer360"]}>
        <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">Datos del cliente</h2>
            <dl className="mt-5 space-y-4">
              <InfoRow label="Nombre" value={customer.name || "Sin nombre"} />
              <InfoRow label="Email" value={customer.email || "Sin email"} />
              <InfoRow label="Teléfono" value={customer.phone || "Sin teléfono"} />
              <InfoRow
                label="Creación"
                value={formatDateTime(customer.created_at)}
              />
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
          {casesError ? (
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-[var(--g66-danger)]">
                No se pudieron cargar los casos del cliente.
              </p>
            </section>
          ) : (
            <>
              <CaseList
                title="Casos abiertos"
                cases={openCases}
                emptyText="No hay casos abiertos para este cliente."
              />
              <CaseList
                title="Casos cerrados"
                cases={closedCases}
                emptyText="No hay casos cerrados para este cliente."
              />
            </>
          )}

          <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-950">
                Últimos mensajes
              </h2>
            </div>

            {messagesError ? (
              <p className="p-6 text-sm text-[var(--g66-danger)]">
                No se pudieron cargar los mensajes del cliente:{" "}
                {messagesError.message}
              </p>
            ) : messages.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {messages.map((message, index) => (
                  <li key={message.id ?? `message-${index}`} className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{message.sender_type || "Sin remitente"}</Badge>
                          <Badge>{message.direction || "Sin dirección"}</Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-gray-700">
                          {getMessageBody(message)}
                        </p>
                      </div>
                      <div className="shrink-0 text-sm text-gray-500">
                        {formatDateTime(message.created_at)}
                      </div>
                    </div>
                    {message.case_id ? (
                      <Link
                        href={`/casos/${message.case_id}`}
                        className="mt-3 inline-flex text-sm font-semibold text-[var(--g66-brand-blue)] hover:text-[var(--g66-brand-blue)]"
                      >
                        Ver caso
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-sm text-gray-600">
                No hay mensajes asociados a los casos de este cliente.
              </p>
            )}
          </section>
        </div>
        </section>
      </RoleGuard>
    </>
  );
}
