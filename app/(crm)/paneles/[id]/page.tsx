import { PanelDetailView } from "@/components/paneles/panel-detail-view";

export default async function PanelDetailPage({ params }: PageProps<"/paneles/[id]">) {
  const { id } = await params;
  return <PanelDetailView panelId={id} />;
}
