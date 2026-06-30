import { generateAgentAiSuggestion } from "@/lib/ai-triage";

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const result = await generateAgentAiSuggestion(id);

    return Response.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("[api/cases/ai-suggestion] Error generating suggestion", {
      caseId: id,
      message: getErrorMessage(error),
      error,
    });

    return Response.json(
      {
        ok: false,
        error: getErrorMessage(error),
      },
      { status: 500 },
    );
  }
}
