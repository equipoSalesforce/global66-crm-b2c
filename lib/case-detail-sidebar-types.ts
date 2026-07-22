import type { CaseFieldDefinition } from "@/lib/case-metadata";

export const caseDetailSectionKeys = [
  "CUSTOMER_INFO",
  "CASE_INFO",
  "CASE_PROPERTIES",
  "CSAT",
] as const;

export const caseDetailSourceTypes = [
  "CASE",
  "CUSTOMER_PROFILE",
  "FORMULA",
  "CSAT",
] as const;

export type CaseDetailSectionKey = (typeof caseDetailSectionKeys)[number];
export type CaseDetailSourceType = (typeof caseDetailSourceTypes)[number];

export type CaseDetailFieldType =
  | "TEXT"
  | "EMAIL"
  | "PHONE"
  | "LINK"
  | "BOOLEAN"
  | "NUMBER"
  | "BADGE"
  | "STARS"
  | "CHECK";

export type CaseDetailSectionConfigRecord = {
  id: string;
  section_key: CaseDetailSectionKey;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CaseDetailSectionFieldRecord = {
  id: string;
  area: string;
  section_key: CaseDetailSectionKey;
  source_type: CaseDetailSourceType;
  field_key: string;
  sort_order: number;
  is_visible: boolean;
  is_editable: boolean;
  is_copyable: boolean;
  created_at: string;
  updated_at: string;
};

export type CaseDetailAvailableField = {
  registryId: string;
  fieldKey: string;
  label: string;
  sourceType: CaseDetailSourceType;
  sourcePath: string | null;
  fieldType: CaseDetailFieldType;
  formulaKey: string | null;
  isCopyable: boolean;
  isEditable: boolean;
  isRequired: boolean;
  isActive: boolean;
  caseDefinition: CaseFieldDefinition | null;
};

export type CaseDetailConfiguredField = {
  fieldKey: string;
  sourceType: CaseDetailSourceType;
  sortOrder: number;
  isVisible: boolean;
  isEditable: boolean;
  isCopyable: boolean;
  inheritedFromGeneral: boolean;
  definition: CaseDetailAvailableField;
};

export type CaseDetailConfiguredSection = {
  id: string;
  sectionKey: CaseDetailSectionKey;
  name: string;
  description: string | null;
  isActive: boolean;
  fields: CaseDetailConfiguredField[];
};

export type CaseDetailSectionConfiguration = {
  area: string;
  areas: string[];
  hasOwnConfiguration: boolean;
  sections: CaseDetailConfiguredSection[];
  availableFields: CaseDetailAvailableField[];
};

export type CaseDetailSectionFieldInput = {
  fieldKey: string;
  sourceType: CaseDetailSourceType;
  sortOrder: number;
  isVisible: boolean;
  isEditable: boolean;
  isCopyable: boolean;
};

export type CaseDetailSidebarFieldStatus =
  | "positive"
  | "negative"
  | "neutral"
  | null;

export type CaseDetailSidebarField = {
  fieldKey: string;
  label: string;
  value: string | number | boolean | null;
  displayValue: string;
  fieldType: CaseDetailFieldType;
  sourceType: CaseDetailSourceType;
  isEditable: boolean;
  isCopyable: boolean;
  copyValue: string | null;
  href: string | null;
  status: CaseDetailSidebarFieldStatus;
  caseDefinition: CaseFieldDefinition | null;
};

export type CaseDetailSidebarSection = {
  sectionKey: CaseDetailSectionKey;
  title: string;
  fields: CaseDetailSidebarField[];
};

export type CaseDetailFormFieldItem = {
  id: string;
  type: "FIELD";
  required: boolean;
  editable: boolean;
  columnSpan: 1 | 2;
  field: CaseDetailSidebarField;
};

export type CaseDetailFormSpacerItem = {
  id: string;
  type: "SPACER";
  columnSpan: 1 | 2;
};

export type CaseDetailFormItem = CaseDetailFormFieldItem | CaseDetailFormSpacerItem;

export type CaseDetailFormSection = {
  id: string;
  name: string;
  description: string | null;
  items: CaseDetailFormItem[];
};

export type CaseDetailSidebarViewModel = {
  caseId: string;
  area: string;
  customerPublicId: string | null;
  customerPhone: string | null;
  sections: CaseDetailSidebarSection[];
  formSections: CaseDetailFormSection[];
};
