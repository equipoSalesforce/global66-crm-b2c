import { PageHeader } from "@/components/page-header";
import { QuickMessagesAdmin } from "@/components/quick-messages-admin";
import { RoleGuard } from "@/components/role-guard";

export const dynamic = "force-dynamic";

export default function QuickMessagesPage() {
  return (
    <>
      <PageHeader
        title="Mensajes rápidos"
        description="Crea y administra respuestas reutilizables para las conversaciones de WhatsApp."
      />
      <RoleGuard anyPermission={["viewSettings"]}>
        <QuickMessagesAdmin />
      </RoleGuard>
    </>
  );
}
