import { PageHeader } from "@/components/page-header";
import { PermissionAction } from "@/components/permission-action";
import { RoleGuard } from "@/components/role-guard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ConfiguracionPage() {
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
            <h2 className="text-lg font-bold text-gray-950">Gobierno IA</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Administra límites, excepciones y controles de uso de IA por
              ejecutivo y funcionalidad.
            </p>
            <Link
              href="/configuracion/ia"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white hover:bg-[var(--g66-secondary-interactive)]"
            >
              Abrir Gobierno IA
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
              href="/comunicaciones?tab=email-templates"
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
              href="/comunicaciones?tab=quick-messages"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white hover:bg-[var(--g66-accent-cyan)]"
            >
              Gestionar mensajes rápidos
            </Link>
          </section>

        </div>
      </RoleGuard>
    </>
  );
}
