import { getSmartSupervisionCaseSnapshot } from "@/lib/smartsupervision-case-snapshot";
import {
  authorizeSmartSupervisionRoute,
  smartSupervisionErrorResponse,
} from "@/lib/smartsupervision-route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const [{ caseId }] = await Promise.all([params, authorizeSmartSupervisionRoute()]);
    return Response.json({
      ok: true,
      snapshot: await getSmartSupervisionCaseSnapshot(caseId),
    });
  } catch (error) {
    return smartSupervisionErrorResponse(
      error,
      "/api/integrations/smartsupervision/cases/[caseId]/snapshot",
    );
  }
}
