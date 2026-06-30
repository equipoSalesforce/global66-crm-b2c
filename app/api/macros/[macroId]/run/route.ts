import { runMacro } from "@/lib/macros";

export const runtime = "nodejs";

type RunMacroPayload = {
  targetObject?: unknown;
  targetId?: unknown;
  executedBy?: unknown;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ macroId: string }> },
) {
  const { macroId } = await params;
  let payload: RunMacroPayload;

  try {
    payload = (await request.json()) as RunMacroPayload;
  } catch (error) {
    console.error("[macro-run] Error parsing JSON", {
      macroId,
      message: getErrorMessage(error),
      error,
    });

    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const targetObject = getString(payload.targetObject) || "CASE";
  const targetId = getString(payload.targetId);
  const executedBy = getString(payload.executedBy);

  if (!targetId) {
    return Response.json({ error: "targetId es requerido." }, { status: 400 });
  }

  try {
    const result = await runMacro({
      macroId,
      targetObject,
      targetId,
      executedBy,
    });

    return Response.json(result);
  } catch (error) {
    console.error("[macro-run] Error executing macro", {
      macroId,
      targetObject,
      targetId,
      message: getErrorMessage(error),
      error,
    });

    return Response.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
