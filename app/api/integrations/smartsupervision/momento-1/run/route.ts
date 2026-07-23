import { runSmartSupervisionMoment1Import } from "@/lib/smartsupervision-flow-service";
import {
  authorizeSmartSupervisionRoute,
  smartSupervisionErrorResponse,
} from "@/lib/smartsupervision-route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await authorizeSmartSupervisionRoute();
    const body = await request.json().catch(() => ({})) as { mode?: string };
    const mode = body.mode === "MOMENTO_1_DAILY" ? "MOMENTO_1_DAILY" : "MANUAL_TEST";
    const result = await runSmartSupervisionMoment1Import({ mode });
    return Response.json(result, { status: result.ok ? 200 : 207 });
  } catch (error) {
    return smartSupervisionErrorResponse(
      error,
      "/api/integrations/smartsupervision/momento-1/run",
    );
  }
}
