import type {
  CaseViewColumnKey,
  CaseViewFilters,
  CaseViewSorting,
} from "./case-view-service";
import { fetchCaseApi } from "./case-api-client";

export type CaseSavedViewFilters = CaseViewFilters;

export type CaseSavedView = {
  id: string;
  name: string;
  description: string;
  privacy: "Privada" | "Equipo" | "Pública";
  editableByOthers: "Sí" | "No";
  visibleColumns: CaseViewColumnKey[];
  filters: CaseSavedViewFilters;
  sorting: CaseViewSorting;
  useAsDefault: boolean;
  canEdit: boolean;
  ownerUserId: string;
  ownerName: string;
  teamId: string | null;
  createdAt: string;
  updatedAt: string;
};

export const emptyCaseViewFilters: CaseSavedViewFilters = {
  channel: "",
  contactType: "",
  product: "",
  subproduct: "",
  catPrincipal: "",
  catSecondary: "",
  catExtra: "",
  status: "",
};

export async function getCaseViews(): Promise<CaseSavedView[]> {
  const payload = await fetchCaseApi<{ views: CaseSavedView[] }>("/api/case-views");

  return payload.views;
}

export async function createCaseView(
  input: Omit<
    CaseSavedView,
    "id" | "createdAt" | "updatedAt" | "canEdit" | "ownerUserId" | "ownerName" | "teamId"
  >,
) {
  const payload = await fetchCaseApi<{ view: CaseSavedView }>("/api/case-views", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return payload.view;
}

export async function updateCaseView(
  id: string,
  patch: Partial<
    Omit<CaseSavedView, "id" | "createdAt" | "canEdit" | "ownerUserId" | "ownerName" | "teamId">
  >,
) {
  const payload = await fetchCaseApi<{ view: CaseSavedView }>(
    `/api/case-views/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );

  return payload.view;
}

export async function deleteCaseView(id: string) {
  await fetchCaseApi<{ ok: true }>(`/api/case-views/${id}`, {
    method: "DELETE",
  });
}
