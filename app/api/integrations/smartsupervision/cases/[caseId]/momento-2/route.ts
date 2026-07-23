import { sendSmartSupervisionMoment2ForCase } from "@/lib/smartsupervision-flow-service";
import {
  authorizeSmartSupervisionRoute,
  smartSupervisionErrorResponse,
} from "@/lib/smartsupervision-route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const [{ caseId }, user] = await Promise.all([params, authorizeSmartSupervisionRoute()]);
    const result = await sendSmartSupervisionMoment2ForCase(caseId, user.email);
    return Response.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    return smartSupervisionErrorResponse(
      error,
      "/api/integrations/smartsupervision/cases/[caseId]/momento-2",
    );
  }
}
