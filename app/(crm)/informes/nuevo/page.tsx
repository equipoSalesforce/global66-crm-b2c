import { ReportBuilder } from "@/components/informes/report-builder";

export default async function NuevoInformePage({ searchParams }: PageProps<"/informes/nuevo">) {
  const params = await searchParams;
  return <ReportBuilder editId={typeof params.edit === "string" ? params.edit : undefined} />;
}
