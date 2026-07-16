export type AiInteractionStatus = "SUCCESS" | "BLOCKED_LIMIT" | "ERROR";

export type AiFeature = {
  id: string;
  feature_key: string;
  name: string;
  description: string | null;
  channel: string | null;
  is_active: boolean;
};

export type AiUserLimit = {
  id: string;
  user_id: string;
  feature_key: string;
  daily_limit: number;
  monthly_limit: number;
  temporary_daily_limit: number | null;
  temporary_expires_at: string | null;
  temporary_reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AiUsageDecision = {
  allowed: boolean;
  reason: string | null;
  feature: AiFeature | null;
  limit: AiUserLimit | null;
  effectiveDailyLimit: number;
  dailyUsage: number;
  monthlyUsage: number;
  remainingDaily: number;
  remainingMonthly: number;
};

export type AiInteraction = {
  id: string;
  user_id: string;
  feature_key: string;
  case_id: string | null;
  case_number: string | null;
  channel: string | null;
  topic: string | null;
  tokens_used: number | null;
  model: string | null;
  status: AiInteractionStatus;
  daily_limit: number | null;
  daily_usage_before: number | null;
  daily_usage_after: number | null;
  monthly_limit: number | null;
  monthly_usage_before: number | null;
  monthly_usage_after: number | null;
  remaining_daily: number | null;
  remaining_monthly: number | null;
  request_metadata: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
};

export type AiGovernanceUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  area: string | null;
  team: string | null;
  status: string;
};

