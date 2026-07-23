import { CrmShell } from "@/components/crm-shell";
import { redirect } from "next/navigation";
import { isAuthOtpEnabled } from "@/lib/auth/auth-config";
import { getAuthenticatedUserFromCookies } from "@/lib/auth/auth-session-service";

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isAuthOtpEnabled()) {
    const user = await getAuthenticatedUserFromCookies();
    if (!user) redirect("/login");
  }

  return <CrmShell>{children}</CrmShell>;
}
