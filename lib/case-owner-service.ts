import { fetchCaseApi, getDemoActorUser } from "./case-api-client";
import type { AssignableUser } from "./users-service";

export async function changeCasesOwner({
  caseIds,
  newOwnerId,
  notifyOwner = false,
}: {
  caseIds: string[];
  newOwnerId: string;
  notifyOwner?: boolean;
}) {
  return fetchCaseApi<{
    updated: number;
    owner: AssignableUser;
    caseIds: string[];
    notificationStatus: "not_requested" | "sent" | "failed";
    notificationsCreated: number;
  }>("/api/cases/change-owner", {
    method: "POST",
    body: JSON.stringify({
      caseIds,
      newOwnerId,
      notifyOwner,
      actorUser: getDemoActorUser(),
    }),
  });
}
