import { fetchCaseApi, getDemoActorUser } from "./case-api-client";
import type { CaseFieldChanges } from "./case-bulk-edit-service";
import type { CaseViewRow } from "./case-view-service";

export type CaseMergeInput = {
  masterCaseId: string;
  mergedCaseIds: string[];
  selectedCases: CaseViewRow[];
  fieldResolution: CaseFieldChanges;
  performedBy?: string;
};

export async function mergeCases({
  masterCaseId,
  mergedCaseIds,
  selectedCases,
  fieldResolution,
}: CaseMergeInput) {
  if (selectedCases.length < 2) {
    throw new Error("Selecciona al menos 2 casos para fusionar.");
  }

  return fetchCaseApi<{ masterCaseId: string; mergedCaseIds: string[] }>(
    "/api/cases/merge",
    {
      method: "POST",
      body: JSON.stringify({
        masterCaseId,
        mergedCaseIds,
        fieldResolution,
        actorUser: getDemoActorUser(),
      }),
    },
  );
}
