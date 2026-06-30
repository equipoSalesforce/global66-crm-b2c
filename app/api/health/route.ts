export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "global66-crm-b2c",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
