import { runAiTriage } from "@/lib/ai-triage";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await runAiTriage(id);

  if (result.status === "error") {
    return Response.json(
      {
        error: result.reason,
      },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    result,
  });
}
