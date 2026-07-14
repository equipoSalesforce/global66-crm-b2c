import { fetchCaseApi } from "./case-api-client";
import {
  caseFieldDefinitions,
  type CaseEditableFieldKey,
  type CaseFieldDefinition,
} from "./case-field-definitions";

export type CaseMetadata = {
  fields: Record<CaseEditableFieldKey, CaseFieldDefinition>;
};

export async function getCaseMetadata(): Promise<CaseMetadata> {
  try {
    return await fetchCaseApi<CaseMetadata>("/api/cases/metadata");
  } catch {
    return { fields: caseFieldDefinitions };
  }
}
