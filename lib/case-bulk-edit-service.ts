import { fetchCaseApi, getDemoActorUser } from "./case-api-client";
import type { CaseEditableFieldKey } from "./case-field-definitions";

export type CaseFieldChanges = Partial<
  Record<CaseEditableFieldKey, string | boolean | null>
>;

export type CaseBulkUpdate = {
  caseId: string;
  fieldChanges: CaseFieldChanges;
};

export async function updateCasesBulk(caseUpdates: CaseBulkUpdate[]) {
  return fetchCaseApi<{ updated: number; caseIds: string[] }>(
    "/api/cases/bulk-update",
    {
      method: "PATCH",
      body: JSON.stringify({
        updates: caseUpdates.map((update) => ({
          caseId: update.caseId,
          changes: update.fieldChanges,
        })),
        actorUser: getDemoActorUser(),
      }),
    },
  );
}
