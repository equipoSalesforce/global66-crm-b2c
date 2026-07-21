import { getCurrentCrmUser } from "@/lib/current-crm-user";
import { searchGlobalCrm } from "@/lib/global-search-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return Response.json(
      { error: "La búsqueda requiere al menos 2 caracteres." },
      { status: 400 },
    );
  }

  try {
    await getCurrentCrmUser();
    return Response.json(await searchGlobalCrm(query));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo realizar la búsqueda.";
    return Response.json({ error: message }, { status: 500 });
  }
}
