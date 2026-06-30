import { EmailTemplatesAdmin } from "@/components/email-templates-admin";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";

export const dynamic = "force-dynamic";

export default function EmailTemplatesPage() {
  return (
    <>
      <PageHeader
        title="Templates de correo"
        description="Administra carpetas y respuestas HTML reutilizables para Ticket y sugerencias IA."
      />

      <RoleGuard anyPermission={["viewSettings"]}>
        <EmailTemplatesAdmin />
      </RoleGuard>
    </>
  );
}
