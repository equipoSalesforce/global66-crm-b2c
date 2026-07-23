import { getSmartSupervisionQueueStatus } from "@/lib/smartsupervision-client";
import {
  authorizeSmartSupervisionRoute,
  smartSupervisionErrorResponse,
} from "@/lib/smartsupervision-route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await authorizeSmartSupervisionRoute();
    const queue = await getSmartSupervisionQueueStatus();
    return Response.json({ ok: true, queue: queue.data });
  } catch (error) {
    return smartSupervisionErrorResponse(
      error,
      "/api/integrations/smartsupervision/queue",
    );
  }
}
