export type GlobalSearchCaseResult = {
  id: string;
  caseNumber: string | null;
  subject: string | null;
  customerName: string | null;
  customerEmail: string | null;
  status: string | null;
};

export type GlobalSearchCustomerResult = {
  id: string;
  publicId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type GlobalSearchMessageResult = {
  id: string;
  caseId: string;
  caseNumber: string | null;
  snippet: string;
  createdAt: string | null;
};

export type GlobalSearchResponse = {
  cases: GlobalSearchCaseResult[];
  customers: GlobalSearchCustomerResult[];
  messages: GlobalSearchMessageResult[];
};
