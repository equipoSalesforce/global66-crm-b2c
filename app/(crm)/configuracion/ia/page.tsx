import { AiGovernanceDashboard } from "@/components/ai-governance-dashboard";
import { getCurrentAiUser } from "@/lib/ai-current-user";

export const dynamic = "force-dynamic";

export default async function AiGovernancePage() {
  const user = await getCurrentAiUser().catch(() => null);
  if (!user || user.role !== "ADMIN") {
    return <section className="rounded-xl border border-red-200 bg-red-50 p-6"><h1 className="text-xl font-black text-red-800">Acceso restringido</h1><p className="mt-2 text-sm font-semibold text-red-700">Gobierno IA está disponible sólo para administradores.</p></section>;
  }
  return <AiGovernanceDashboard />;
}
