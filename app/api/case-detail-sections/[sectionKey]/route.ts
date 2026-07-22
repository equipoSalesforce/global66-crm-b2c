import {
  CaseDetailSectionConfigError,
  updateCaseDetailSectionFields,
} from "@/lib/case-detail-section-config-service";
import { canConfigureCaseDetailSections } from "@/lib/case-detail-section-authorization";
import type { CaseDetailSectionFieldInput } from "@/lib/case-detail-sidebar-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sectionKey: string }> },
) {
  try {
    if (!(await canConfigureCaseDetailSections())) {
      return Response.json({ error: "No tienes permiso para editar esta configuración." }, { status: 403 });
    }
    const { sectionKey } = await params;
    const payload = (await request.json()) as {
      area?: string;
      fields?: CaseDetailSectionFieldInput[];
    };
    if (!Array.isArray(payload.fields)) {
      return Response.json({ error: "La lista de campos es obligatoria." }, { status: 400 });
    }
    return Response.json(
      await updateCaseDetailSectionFields(
        sectionKey,
        payload.area ?? "GENERAL",
        payload.fields,
      ),
    );
  } catch (error) {
    const status = error instanceof CaseDetailSectionConfigError ? 400 : 500;
    const message = error instanceof Error ? error.message : "Error guardando configuración.";
    return Response.json({ error: message }, { status });
  }
}
