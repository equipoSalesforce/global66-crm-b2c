import { CommunicationsWorkspace } from "@/components/communications-workspace";
import { RoleGuard } from "@/components/role-guard";
import { Suspense } from "react";

export default function CommunicationsPage() {
  return (
    <RoleGuard anyPermission={["viewSettings"]}>
      <Suspense fallback={<p className="text-sm text-[var(--g66-text-muted)]">Cargando comunicaciones...</p>}>
        <CommunicationsWorkspace />
      </Suspense>
    </RoleGuard>
  );
}
