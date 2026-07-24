import { redirect } from "next/navigation";

export default function QuickMessagesPage() {
  redirect("/comunicaciones?tab=quick-messages");
}
