import { duplicateCase } from "@/lib/case-duplicate-server-service";
import type { DuplicateCaseInput } from "@/lib/case-ownership-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const [{ id }, body] = await Promise.all([
      params,
      request.json() as Promise<DuplicateCaseInput>,
    ]);
    const duplicatedCase = await duplicateCase(id, body ?? {});
    return Response.json({ ok: true, duplicatedCase }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo duplicar el caso.";
    return Response.json({ ok: false, error: message }, { status: message.includes("permiso") ? 403 : 400 });
  }
}
