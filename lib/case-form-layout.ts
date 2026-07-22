import type { CaseAreaLayout, CaseAreaLayoutField } from "@/lib/case-metadata";
import type { CaseDetailSourceType } from "@/lib/case-detail-sidebar-types";

export type CaseFormFieldItem = {
  id: string;
  type: "FIELD";
  sourceType: CaseDetailSourceType;
  fieldKey: string;
  label: string;
  order: number;
  required: boolean;
  editable: boolean;
  columnSpan: 1 | 2;
};

export type CaseFormSpacerItem = {
  id: string;
  type: "SPACER";
  order: number;
  columnSpan: 1 | 2;
};

export type CaseFormLayoutItem = CaseFormFieldItem | CaseFormSpacerItem;

export type CaseFormLayoutSection = {
  id: string;
  name: string;
  description: string | null;
  order: number;
  items: CaseFormLayoutItem[];
};

export type CaseFormLayoutSchema = {
  version: 2;
  sections: CaseFormLayoutSection[];
};

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function order(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
}

function span(value: unknown): 1 | 2 {
  return value === 2 ? 2 : 1;
}

function source(value: unknown): CaseDetailSourceType {
  return value === "CUSTOMER_PROFILE" || value === "FORMULA" || value === "CSAT"
    ? value
    : "CASE";
}

export function normalizeCaseFormLayoutSchema(value: unknown): CaseFormLayoutSchema | null {
  if (!value || typeof value !== "object") return null;
  const sectionsValue = (value as { sections?: unknown }).sections;
  if (!Array.isArray(sectionsValue)) return null;

  const sections = sectionsValue.map((sectionValue, sectionIndex) => {
    const section = sectionValue && typeof sectionValue === "object"
      ? sectionValue as Record<string, unknown>
      : {};
    const itemsValue = Array.isArray(section.items) ? section.items : [];
    const items = itemsValue.flatMap((itemValue, itemIndex): CaseFormLayoutItem[] => {
      const item = itemValue && typeof itemValue === "object"
        ? itemValue as Record<string, unknown>
        : {};
      const itemOrder = order(item.order, (itemIndex + 1) * 10);
      if (item.type === "SPACER") {
        return [{
          id: text(item.id, `spacer-${sectionIndex}-${itemIndex}`),
          type: "SPACER",
          order: itemOrder,
          columnSpan: span(item.columnSpan),
        }];
      }
      if (item.type !== "FIELD" || typeof item.fieldKey !== "string" || !item.fieldKey.trim()) {
        return [];
      }
      return [{
        id: text(item.id, `field-${sectionIndex}-${itemIndex}`),
        type: "FIELD",
        sourceType: source(item.sourceType),
        fieldKey: item.fieldKey.trim(),
        label: text(item.label, item.fieldKey.trim()),
        order: itemOrder,
        required: Boolean(item.required),
        editable: Boolean(item.editable),
        columnSpan: span(item.columnSpan),
      }];
    }).sort((left, right) => left.order - right.order);

    return {
      id: text(section.id, `section-${sectionIndex}`),
      name: text(section.name, `Sección ${sectionIndex + 1}`),
      description: typeof section.description === "string" && section.description.trim()
        ? section.description.trim()
        : null,
      order: order(section.order, (sectionIndex + 1) * 10),
      items,
    };
  }).sort((left, right) => left.order - right.order);

  return { version: 2, sections };
}

export function legacyFieldsToCaseFormSchema(
  fields: CaseAreaLayoutField[],
  name: string,
  description: string | null,
): CaseFormLayoutSchema {
  return {
    version: 2,
    sections: [{
      id: "legacy-general",
      name: name || "Formulario general",
      description,
      order: 10,
      items: [...fields]
        .sort((left, right) => left.order - right.order)
        .map((field, index) => ({
          id: `field-${field.fieldKey}`,
          type: "FIELD" as const,
          sourceType: "CASE" as const,
          fieldKey: field.fieldKey,
          label: field.label,
          order: (index + 1) * 10,
          required: field.required,
          editable: field.editable,
          columnSpan: 1 as const,
        })),
    }],
  };
}

export function schemaForCaseAreaLayout(layout: CaseAreaLayout | null): CaseFormLayoutSchema {
  if (!layout) return { version: 2, sections: [] };
  return normalizeCaseFormLayoutSchema(layout.layout_schema) ??
    legacyFieldsToCaseFormSchema(layout.fields, layout.name, layout.description);
}

export function projectLegacyCaseFields(schema: CaseFormLayoutSchema): CaseAreaLayoutField[] {
  return schema.sections.flatMap((section) => section.items).flatMap((item) =>
    item.type === "FIELD" && item.sourceType === "CASE"
      ? [{
          fieldKey: item.fieldKey,
          label: item.label,
          order: item.order,
          required: item.required,
          editable: item.editable,
        }]
      : [],
  );
}
