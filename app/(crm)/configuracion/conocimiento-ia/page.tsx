import { AiKnowledgeAdmin } from "@/components/ai-knowledge-admin";
import { PageHeader } from "@/components/page-header";
import { RoleGuard } from "@/components/role-guard";

export const dynamic = "force-dynamic";

export default function ConocimientoIaPage() {
  return (
    <>
      <PageHeader
        title="Conocimiento IA"
        description="Administra fuentes, versiones y artículos publicados que utiliza la IA del CRM."
      />
      <RoleGuard
        allowedRoles={["ADMIN", "SUPERVISOR"]}
        anyPermission={["editKnowledgeBase"]}
      >
        <AiKnowledgeAdmin />
      </RoleGuard>
    </>
  );
}
