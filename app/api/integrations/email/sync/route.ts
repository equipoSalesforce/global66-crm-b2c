import { syncInboundEmails } from "@/lib/email-sync";

export const runtime = "nodejs";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function POST() {
  console.info("[email-sync] inicio endpoint");

  try {
    console.info("[email-sync] variables presentes", {
      gmailEmailPresent: Boolean(process.env.GMAIL_EMAIL?.trim()),
      gmailAppPasswordPresent: Boolean(process.env.GMAIL_APP_PASSWORD?.trim()),
      imapHost: process.env.GMAIL_IMAP_HOST?.trim() || "imap.gmail.com",
      imapPort: process.env.GMAIL_IMAP_PORT?.trim() || "993",
      secure: (process.env.GMAIL_IMAP_PORT?.trim() || "993") === "993",
    });
    const result = await syncInboundEmails();

    console.info("[email-sync] Manual sync finished", result);

    return Response.json(result);
  } catch (error) {
    console.error("[email-sync] Manual sync error", {
      message: getErrorMessage(error),
      error,
    });

    return Response.json(
      {
        success: false,
        processed: 0,
        inserted: 0,
        skipped: 0,
        createdCases: 0,
        attachmentsSaved: 0,
        errors: [getErrorMessage(error)],
      },
      { status: 500 },
    );
  }
}
