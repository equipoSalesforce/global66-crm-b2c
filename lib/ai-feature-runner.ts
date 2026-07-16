import "server-only";

import { checkAiUsageLimit, registerAiInteraction } from "@/lib/ai-usage-control-service";
import type { AiGovernanceUser } from "@/lib/ai-governance-types";

export class AiUsageLimitError extends Error {
  status = 429;

  constructor(message: string) {
    super(message);
    this.name = "AiUsageLimitError";
  }
}

function getBlockedMessage(decision: Awaited<ReturnType<typeof checkAiUsageLimit>>) {
  const featureName = decision.feature?.name ?? "esta funcionalidad IA";
  if (!decision.limit) {
    return `No tienes un límite configurado para ${featureName}. Solicita habilitación a tu supervisor.`;
  }
  if (decision.dailyUsage >= decision.effectiveDailyLimit) {
    return `Alcanzaste el límite diario para ${featureName}. Vuelve a intentarlo mañana o solicita aumento a tu supervisor.`;
  }
  if (decision.monthlyUsage >= decision.limit.monthly_limit) {
    return `Alcanzaste el límite mensual para ${featureName}. Solicita aumento a tu supervisor.`;
  }
  return decision.reason ?? `No puedes usar ${featureName} en este momento.`;
}

export async function runAiFeature<T>(input: {
  featureKey: string;
  user: Pick<AiGovernanceUser, "id">;
  caseId?: string | null;
  caseNumber?: string | null;
  channel?: string | null;
  topic?: string | null;
  requestMetadata?: Record<string, unknown>;
  execute: () => Promise<T>;
  getUsageMetadata?: (result: T) => { tokensUsed?: number | null; model?: string | null };
}) {
  const decision = await checkAiUsageLimit(input.user.id, input.featureKey);
  const common = {
    userId: input.user.id,
    featureKey: input.featureKey,
    decision,
    caseId: input.caseId,
    caseNumber: input.caseNumber,
    channel: input.channel,
    topic: input.topic,
    requestMetadata: input.requestMetadata,
  };

  if (!decision.allowed) {
    const blockedMessage = getBlockedMessage(decision);
    await registerAiInteraction({
      ...common,
      status: "BLOCKED_LIMIT",
      errorMessage: blockedMessage,
    });
    throw new AiUsageLimitError(blockedMessage);
  }

  try {
    const result = await input.execute();
    const usage = input.getUsageMetadata?.(result) ?? {};
    await registerAiInteraction({ ...common, status: "SUCCESS", ...usage });
    return result;
  } catch (error) {
    await registerAiInteraction({
      ...common,
      status: "ERROR",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
