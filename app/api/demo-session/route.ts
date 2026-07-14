import { cookies } from "next/headers";
import { DEMO_USER_COOKIE } from "@/lib/demo-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DemoSessionRequest = {
  userId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as DemoSessionRequest;
  const userId = body.userId?.trim();

  if (!userId) {
    return Response.json({ error: "Usuario demo requerido." }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(DEMO_USER_COOKIE, userId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  return Response.json({ ok: true, userId });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(DEMO_USER_COOKIE);

  return Response.json({ ok: true });
}
