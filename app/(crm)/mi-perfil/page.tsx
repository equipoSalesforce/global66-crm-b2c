import { ProfileWorkspace } from "@/components/profile-workspace";
import { getCrmProfile } from "@/lib/profile-service";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function MyProfilePage() {
  const profile = await getCrmProfile();
  return (
    <Suspense fallback={<p className="text-sm text-[var(--g66-text-muted)]">Cargando perfil...</p>}>
      <ProfileWorkspace profile={profile} />
    </Suspense>
  );
}
