import type {
  CaseViewColumnKey,
  CaseViewFilters,
  CaseViewSorting,
} from "./case-view-service";

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
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "global66.caseViews";

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

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function safeParseViews(value: string | null): CaseSavedView[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getCaseViews(): CaseSavedView[] {
  if (!canUseStorage()) return [];

  return safeParseViews(window.localStorage.getItem(STORAGE_KEY));
}

export function saveCaseViews(views: CaseSavedView[]) {
  if (!canUseStorage()) return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

export function createCaseView(
  input: Omit<CaseSavedView, "id" | "createdAt" | "updatedAt">,
) {
  const now = new Date().toISOString();
  const newView: CaseSavedView = {
    ...input,
    id: `case-view-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };
  const existingViews = getCaseViews().map((view) => ({
    ...view,
    useAsDefault: input.useAsDefault ? false : view.useAsDefault,
  }));

  saveCaseViews([...existingViews, newView]);

  return newView;
}

export function updateCaseView(
  id: string,
  patch: Partial<Omit<CaseSavedView, "id" | "createdAt">>,
) {
  const views = getCaseViews();
  let updatedView: CaseSavedView | null = null;
  const updatedViews = views.map((view) => {
    if (patch.useAsDefault && view.id !== id) {
      return { ...view, useAsDefault: false };
    }

    if (view.id !== id) return view;

    updatedView = {
      ...view,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    return updatedView;
  });

  saveCaseViews(updatedViews);

  return updatedView;
}

export function getDefaultCaseView() {
  return getCaseViews().find((view) => view.useAsDefault) ?? null;
}
