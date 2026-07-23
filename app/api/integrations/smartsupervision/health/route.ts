import {
  getSmartSupervisionHealth,
  isSmartSupervisionEnabled,
} from "@/lib/smartsupervision-client";
import {
  authorizeSmartSupervisionRoute,
  smartSupervisionErrorResponse,
} from "@/lib/smartsupervision-route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await authorizeSmartSupervisionRoute();
    if (!isSmartSupervisionEnabled()) {
      return Response.json({ ok: false, enabled: false, error: "SmartSupervisión está deshabilitado." }, { status: 503 });
    }
    const health = await getSmartSupervisionHealth();
    return Response.json({ ok: true, enabled: true, upstream: health.data });
  } catch (error) {
    return smartSupervisionErrorResponse(
      error,
      "/api/integrations/smartsupervision/health",
    );
  }
}
