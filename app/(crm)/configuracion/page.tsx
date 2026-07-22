import { PageHeader } from "@/components/page-header";
import { PermissionAction } from "@/components/permission-action";
import { RoleGuard } from "@/components/role-guard";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

type AiSetting = Record<string, unknown>;

function formatSettingValue(value: unknown) {
  if (value === null || value === undefined) {
    return "Sin valor";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export default async function ConfiguracionPage() {
  const { data, error } = await supabase
    .from("ai_settings")
    .select("*")
    .limit(1)
    .returns<AiSetting[]>();

  const settings = data?.[0] ?? null;
  const entries = settings ? Object.entries(settings) : [];

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Parámetros base para la automatización y respuestas con IA."
      />

      <RoleGuard anyPermission={["viewSettings"]}>
        <div className="grid gap-6">
          <section className="rounded-lg border border-[var(--g66-border)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">
              Usuarios internos
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Administra perfiles internos del CRM. Cognito/Google SSO definirá
              la identidad y esta tabla controlará permisos dentro del CRM.
            </p>
            <Link
              href="/configuracion/usuarios"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white hover:bg-[var(--g66-accent-cyan)]"
            >
              Gestionar usuarios
            </Link>
          </section>

          <PermissionAction permission="manage_permissions">
            <section className="rounded-lg border border-[var(--g66-border)] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-950">Permisos</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Configura permisos por rol y controla qué campos del caso puede
                ver o editar cada perfil operativo.
              </p>
              <Link
                href="/configuracion/permisos"
                className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white hover:bg-[var(--g66-accent-cyan)]"
              >
                Gestionar permisos
              </Link>
            </section>
          </PermissionAction>

          <section className="rounded-lg border border-[var(--g66-border)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">
              Objetos y campos
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Administra campos personalizados y layouts metadata-driven del
              objeto Caso sin alterar dinámicamente la tabla principal.
            </p>
            <Link
              href="/configuracion/objetos/caso"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white hover:bg-[var(--g66-accent-cyan)]"
            >
              Configurar Caso
            </Link>
            <Link
              href="/configuracion/layout-builder"
              className="ml-2 mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-[var(--g66-brand-blue)] bg-white px-4 text-sm font-semibold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
            >
              Layout Builder
            </Link>
            <Link
              href="/configuracion/objetos/caso?tab=layout-detalle"
              className="ml-2 mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-[var(--g66-brand-blue)] bg-white px-4 text-sm font-semibold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
            >
              Layout detalle caso
            </Link>
          </section>

          <section className="rounded-lg border border-[var(--g66-border)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">Conocimiento IA</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Administra las fuentes que utiliza la IA para sugerir respuestas,
              clasificar casos y recomendar próximas acciones.
            </p>
            <Link
              href="/configuracion/conocimiento-ia"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white hover:bg-[var(--g66-accent-cyan)]"
            >
              Administrar conocimiento
            </Link>
          </section>

          <section className="rounded-lg border border-[var(--g66-border)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">
              Automatización operacional
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Configura macros visuales para actualizar casos, enviar respuestas
              y registrar acciones operativas.
            </p>
            <Link
              href="/configuracion/macros"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white hover:bg-[var(--g66-accent-cyan)]"
            >
              Gestionar macros
            </Link>
          </section>

          <section className="rounded-lg border border-[var(--g66-border)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">
              Templates de correo
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Administra carpetas, plantillas HTML y el template corporativo
              por defecto para respuestas sugeridas por IA.
            </p>
            <Link
              href="/configuracion/templates-correo"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white hover:bg-[var(--g66-accent-cyan)]"
            >
              Gestionar templates
            </Link>
          </section>

          <section className="rounded-lg border border-[var(--g66-border)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">Mensajes rápidos</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Administra respuestas reutilizables para el composer de WhatsApp.
            </p>
            <Link
              href="/configuracion/mensajes-rapidos"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white hover:bg-[var(--g66-accent-cyan)]"
            >
              Gestionar mensajes rápidos
            </Link>
          </section>

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-bold text-gray-950">Configuración IA</h2>
          </div>

          {error ? (
            <p className="p-6 text-sm text-[var(--g66-danger)]">
              No se pudo cargar la configuración IA.
            </p>
          ) : settings ? (
            <dl className="divide-y divide-gray-200">
              {entries.map(([key, value]) => (
                <div
                  key={key}
                  className="grid gap-2 px-6 py-4 sm:grid-cols-[220px_1fr]"
                >
                  <dt className="text-sm font-semibold text-gray-950">{key}</dt>
                  <dd className="break-words text-sm leading-6 text-gray-600">
                    {formatSettingValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="p-6 text-sm text-gray-600">
              No hay configuración IA registrada.
            </p>
          )}
        </section>
        </div>
      </RoleGuard>
    </>
  );
}
