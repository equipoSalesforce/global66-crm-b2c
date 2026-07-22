export const knowledgeVisibilities = [
  "CUSTOMER_ALLOWED",
  "AGENT_GUIDANCE",
  "INTERNAL_ONLY",
] as const;

export type KnowledgeVisibility = (typeof knowledgeVisibilities)[number];
export type KnowledgeVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type KnowledgeSourceStatus = "ACTIVE" | "ARCHIVED";

export type KnowledgeSourceVersion = {
  id: string;
  sourceId: string;
  versionLabel: string;
  fileName: string | null;
  status: KnowledgeVersionStatus;
  publishedAt: string | null;
  createdAt: string;
};

export type KnowledgeSource = {
  id: string;
  title: string;
  description: string | null;
  sourceType: string;
  currentVersionId: string | null;
  status: KnowledgeSourceStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  articleCount: number;
  chunkCount: number;
  versions: KnowledgeSourceVersion[];
};

export type KnowledgeArticle = {
  id: string;
  sourceId: string | null;
  versionId: string | null;
  title: string;
  content: string;
  product: string | null;
  country: string | null;
  plan: string | null;
  customerType: string | null;
  category: string | null;
  section: string | null;
  visibility: KnowledgeVisibility;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sourceTitle?: string | null;
  versionLabel?: string | null;
  versionStatus?: KnowledgeVersionStatus | null;
};

export type KnowledgeSearchResult = {
  articleId: string;
  chunkId: string | null;
  title: string;
  snippet: string;
  product: string | null;
  country: string | null;
  plan: string | null;
  customerType: string | null;
  category: string | null;
  section: string | null;
  visibility: KnowledgeVisibility;
  source: string;
  sourceId: string | null;
  version: string;
  versionId: string | null;
  score: number;
};

export type KnowledgeRetrievalRequest = {
  query: string;
  caseId?: string | null;
  product?: string | null;
  country?: string | null;
  plan?: string | null;
  category?: string | null;
  customerType?: string | null;
  includeInternal?: boolean;
  limit?: number;
};

export type KnowledgeSuggestionPayload = {
  customerReply: string;
  agentSummary: string;
  nextActions: string[];
  sources: Array<{
    title: string;
    source: string;
    version: string;
    metadata: Record<string, string | null>;
  }>;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  missingInfo: string[];
  warnings: string[];
};

export type ParsedKnowledgeArticle = {
  title: string;
  content: string;
  section: string | null;
  visibility: KnowledgeVisibility;
};
