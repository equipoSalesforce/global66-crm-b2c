import { fetchCaseApi, getDemoActorUser } from "./case-api-client";
import type { AssignableUser } from "./users-service";

export async function changeCasesOwner({
  caseIds,
  newOwnerId,
}: {
  caseIds: string[];
  newOwnerId: string;
}) {
  return fetchCaseApi<{
    updated: number;
    owner: AssignableUser;
    caseIds: string[];
  }>("/api/cases/change-owner", {
    method: "POST",
    body: JSON.stringify({
      caseIds,
      newOwnerId,
      actorUser: getDemoActorUser(),
    }),
  });
}
