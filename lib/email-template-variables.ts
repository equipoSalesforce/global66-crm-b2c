export type EmailTemplateVariableContext = {
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  case?: {
    case_number?: string | null;
    subject?: string | null;
    status?: string | null;
    lifecycle_status?: string | null;
    priority?: string | null;
    channel?: string | null;
  } | null;
  agent?: {
    name?: string | null;
    email?: string | null;
  } | null;
};

export const supportedEmailTemplateVariables = [
  "{{customer.name}}",
  "{{customer.email}}",
  "{{customer.phone}}",
  "{{case.case_number}}",
  "{{case.subject}}",
  "{{case.status}}",
  "{{case.priority}}",
  "{{case.channel}}",
  "{{agent.name}}",
  "{{agent.email}}",
  "{{email.body}}",
] as const;

export function formatCaseNumberForTemplate(caseNumber?: string | null) {
  return caseNumber ? `#${caseNumber}` : "#TEMP";
}

export function buildEmailTemplateVariables({
  context,
  subject,
  body,
}: {
  context: EmailTemplateVariableContext;
  subject: string;
  body: string;
}) {
  return {
    "customer.name": context.customer?.name || "cliente",
    "customer.email": context.customer?.email || "",
    "customer.phone": context.customer?.phone || "",
    "case.case_number": formatCaseNumberForTemplate(context.case?.case_number),
    "case.subject": context.case?.subject || "tu caso",
    "case.status":
      context.case?.lifecycle_status || context.case?.status || "En revisión",
    "case.priority": context.case?.priority || "",
    "case.channel": context.case?.channel || "",
    "agent.name": context.agent?.name || "Global66 Soporte",
    "agent.email": context.agent?.email || "soporte@global66.com",
    "email.subject": subject,
    "email.body": body,
  };
}
