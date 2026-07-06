import { ReportDetailView } from "@/components/informes/report-detail-view";

export default async function ReportDetailPage({ params }: PageProps<"/informes/[id]">) {
  const { id } = await params;
  return <ReportDetailView reportId={id} />;
}
