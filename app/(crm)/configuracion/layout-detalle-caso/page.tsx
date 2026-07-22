import { redirect } from "next/navigation";

export default function CaseDetailLayoutPage() {
  redirect("/configuracion/objetos/caso?tab=layout-detalle");
}
