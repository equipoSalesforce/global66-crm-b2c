import { DashboardOperational } from "@/components/dashboard-operational";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export type DashboardCaseRecord = {
  id: string | number | null;
  case_number: string | null;
  subject: string | null;
  status: string | null;
  lifecycle_status: string | null;
  routing_status: string | null;
  assigned_to: string | null;
  assigned_agent_id: string | null;
  assigned_at: string | null;
  priority: string | null;
  area: string | null;
  channel: string | null;
  contact_type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  first_response_at?: string | null;
  customer:
    | {
        id?: string | number | null;
        name: string | null;
        email?: string | null;
        phone?: string | null;
      }
    | null;
};

export type DashboardMessageRecord = {
  id: string | number | null;
  case_id: string | number | null;
  body: string | null;
  sender_type: string | null;
  direction: string | null;
  channel: string | null;
  message_type: string | null;
  email_subject?: string | null;
  email_text_body?: string | null;
  created_at: string | null;
};

export type DashboardCustomerRecord = {
  id: string | number | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
};

export type DashboardAgentRecord = {
  id: string;
  name: string | null;
  email: string | null;
  role?: string | null;
  availability_status?: string | null;
};

async function loadDashboardData() {
  const [casesResult, messagesResult, customersResult, agentsResult] =
    await Promise.all([
      supabase
        .from("cases")
        .select(
          "id, case_number, subject, status, lifecycle_status, routing_status, assigned_to, assigned_agent_id, assigned_at, priority, area, channel, contact_type, contact_name, contact_email, contact_phone, created_at, updated_at, closed_at, first_response_at, customer:customers(id, name, email, phone)",
        )
        .order("updated_at", { ascending: false })
        .limit(500)
        .returns<DashboardCaseRecord[]>(),
      supabase
        .from("messages")
        .select(
          "id, case_id, body, sender_type, direction, channel, message_type, email_subject, email_text_body, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1000)
        .returns<DashboardMessageRecord[]>(),
      supabase
        .from("customers")
        .select("id, name, email, phone, created_at")
        .order("created_at", { ascending: false })
        .limit(500)
        .returns<DashboardCustomerRecord[]>(),
      supabase
        .from("agents")
        .select("id, name, email, role, availability_status")
        .order("name", { ascending: true })
        .returns<DashboardAgentRecord[]>(),
    ]);

  return {
    cases: casesResult.data ?? [],
    messages: messagesResult.data ?? [],
    customers: customersResult.data ?? [],
    agents: agentsResult.data ?? [],
    errors: [
      casesResult.error?.message,
      messagesResult.error?.message,
      customersResult.error?.message,
      agentsResult.error?.message,
    ].filter((message): message is string => Boolean(message)),
  };
}

export default async function DashboardPage() {
  const dashboardData = await loadDashboardData();

  return <DashboardOperational {...dashboardData} />;
}
