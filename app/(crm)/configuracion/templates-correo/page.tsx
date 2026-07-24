import { redirect } from "next/navigation";

export default function EmailTemplatesPage() {
  redirect("/comunicaciones?tab=email-templates");
}
