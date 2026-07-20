export type CaseOwnerType = "USER" | "QUEUE";

export type CaseOwnerUserOption = {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string | null;
  area: string | null;
};

export type CaseOwnerQueueOption = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  area: string | null;
  memberCount: number;
};

export type ResolvedCaseOwner = {
  type: CaseOwnerType;
  id: string | null;
  name: string;
  email?: string | null;
  role?: string | null;
  team?: string | null;
  key?: string | null;
  area?: string | null;
};

export type CaseAssignmentOptionsResponse = {
  users: CaseOwnerUserOption[];
  queues: CaseOwnerQueueOption[];
  currentOwner: ResolvedCaseOwner;
};

export type CaseAssignmentResult = {
  id: string;
  caseNumber: string | null;
  ownerType: CaseOwnerType;
  assignedAgentId: string | null;
  assignedQueueId: string | null;
  assignedTo: string | null;
  owner: ResolvedCaseOwner;
  notificationStatus: "not_requested" | "sent" | "failed";
};

export type DuplicateCaseCustomValueInput = {
  fieldDefinitionId: string;
  value: string | boolean | null;
};

export type DuplicateCaseInput = {
  fields?: {
    area?: string | null;
    channel?: string | null;
    product?: string | null;
    priority?: string | null;
    category?: string | null;
    contactType?: string | null;
    contact_type?: string | null;
    description?: string | null;
    customValues?: DuplicateCaseCustomValueInput[];
  };
  assignment?: {
    ownerType: CaseOwnerType;
    assignedAgentId?: string | null;
    assignedQueueId?: string | null;
  } | null;
};

export type DuplicateCaseResult = {
  caseId: string;
  caseNumber: string;
  url: string;
};
