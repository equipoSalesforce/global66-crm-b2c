import type {
  CaseDetailAvailableField,
  CaseDetailSourceType,
} from "@/lib/case-detail-sidebar-types";

export type CaseLayoutView = "SIDEBAR" | "FORM";
export type CaseLayoutCatalogSource =
  | "ALL"
  | "CASE"
  | "CUSTOMER"
  | "FORMULA"
  | "CSAT"
  | "STRUCTURE";

export type CaseLayoutNormalizedSource =
  | "CASE"
  | "CUSTOMER"
  | "FORMULA"
  | "CSAT"
  | "SPACER"
  | "SECTION";

export type CaseLayoutFieldCatalogEntry = {
  id: string;
  kind: "FIELD";
  fieldKey: string;
  label: string;
  sourceType: CaseDetailSourceType;
  normalizedSourceType: Exclude<CaseLayoutNormalizedSource, "SPACER" | "SECTION">;
  fieldType: CaseDetailAvailableField["fieldType"];
  editableCapability: boolean;
  copyableCapability: boolean;
  requiredCapability: boolean;
  readonlyReason: string | null;
  supportedViews: CaseLayoutView[];
  definition: CaseDetailAvailableField;
};

export type CaseLayoutStructureCatalogEntry = {
  id: string;
  kind: "SPACER" | "SECTION";
  fieldKey: "SPACER" | "SECTION";
  label: string;
  sourceType: CaseDetailSourceType | null;
  normalizedSourceType: "SPACER" | "SECTION";
  fieldType: null;
  editableCapability: false;
  copyableCapability: false;
  requiredCapability: false;
  readonlyReason: null;
  supportedViews: CaseLayoutView[];
  definition: CaseDetailAvailableField | null;
};

export type CaseLayoutCatalogEntry =
  | CaseLayoutFieldCatalogEntry
  | CaseLayoutStructureCatalogEntry;

export function normalizeCaseLayoutSourceType(
  sourceType: CaseDetailSourceType | "CUSTOMER",
): Exclude<CaseLayoutNormalizedSource, "SPACER" | "SECTION"> {
  return sourceType === "CUSTOMER_PROFILE" || sourceType === "CUSTOMER"
    ? "CUSTOMER"
    : sourceType;
}

export function buildCaseDetailLayoutCatalog(
  availableFields: CaseDetailAvailableField[],
): CaseLayoutCatalogEntry[] {
  const sidebarSpacer = availableFields.find((field) => field.fieldKey === "layout_spacer");
  const fields: CaseLayoutFieldCatalogEntry[] = availableFields
    .filter((field) => field.isActive && field.fieldKey !== "layout_spacer")
    .map((field) => ({
      id: field.registryId,
      kind: "FIELD",
      fieldKey: field.fieldKey,
      label: field.label,
      sourceType: field.sourceType,
      normalizedSourceType: normalizeCaseLayoutSourceType(field.sourceType),
      fieldType: field.fieldType,
      editableCapability: field.isEditable,
      copyableCapability: field.isCopyable,
      requiredCapability: field.sourceType === "CASE",
      readonlyReason: field.isEditable
        ? null
        : field.sourceType === "CUSTOMER_PROFILE"
          ? "Los datos del cliente son de sólo lectura en el detalle."
          : "Este campo es de sólo lectura.",
      supportedViews: ["SIDEBAR", "FORM"],
      definition: field,
    }));

  return [
    ...fields,
    {
      id: sidebarSpacer?.registryId ?? "STRUCTURE:SPACER",
      kind: "SPACER",
      fieldKey: "SPACER",
      label: "Espacio en blanco",
      sourceType: sidebarSpacer?.sourceType ?? null,
      normalizedSourceType: "SPACER",
      fieldType: null,
      editableCapability: false,
      copyableCapability: false,
      requiredCapability: false,
      readonlyReason: null,
      supportedViews: ["SIDEBAR", "FORM"],
      definition: sidebarSpacer ?? null,
    },
    {
      id: "STRUCTURE:SECTION",
      kind: "SECTION",
      fieldKey: "SECTION",
      label: "Nueva sección",
      sourceType: null,
      normalizedSourceType: "SECTION",
      fieldType: null,
      editableCapability: false,
      copyableCapability: false,
      requiredCapability: false,
      readonlyReason: null,
      supportedViews: ["FORM"],
      definition: null,
    },
  ];
}

export function filterCaseDetailLayoutCatalog({
  catalog,
  view,
  source,
  query,
  excludedIds = new Set<string>(),
}: {
  catalog: CaseLayoutCatalogEntry[];
  view: CaseLayoutView;
  source: CaseLayoutCatalogSource;
  query: string;
  excludedIds?: ReadonlySet<string>;
}) {
  const normalizeSearchText = (value: string) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .toLocaleLowerCase()
    .trim();
  const normalizedQuery = normalizeSearchText(query);
  return catalog.filter((entry) => {
    if (!entry.supportedViews.includes(view) || excludedIds.has(entry.id)) return false;
    if (source !== "ALL") {
      if (source === "STRUCTURE" && entry.kind === "FIELD") return false;
      if (source !== "STRUCTURE" && entry.normalizedSourceType !== source) return false;
    }
    const searchableText = normalizeSearchText([
      entry.label,
      entry.fieldKey,
      entry.sourceType ?? "",
      entry.normalizedSourceType,
    ].join(" "));
    return !normalizedQuery || searchableText.includes(normalizedQuery);
  });
}
