import { DashboardDetail } from "@/components/ai-dashboards/dashboard-detail";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: PageProps<"/dashboards/[id]">) {
  const { id } = await params;
  return <DashboardDetail dashboardId={id} />;
}
