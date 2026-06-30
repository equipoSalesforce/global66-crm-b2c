import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

type MessageRecord = {
  id?: string | number | null;
  direction?: string | null;
  sender_type?: string | null;
  role?: string | null;
  author_type?: string | null;
  content?: string | null;
  body?: string | null;
  text?: string | null;
  message?: string | null;
  created_at?: string | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("case_id", id)
    .order("created_at", { ascending: true })
    .returns<MessageRecord[]>();

  if (error) {
    console.error("[api/cases/messages] Error loading case messages", {
      caseId: id,
      message: error.message,
      supabaseError: error,
    });

    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    messages: data ?? [],
  });
}
