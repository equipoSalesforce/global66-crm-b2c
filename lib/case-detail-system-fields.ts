import type { CaseDetailAvailableField } from "@/lib/case-detail-sidebar-types";

function systemField(
  field: Omit<
    CaseDetailAvailableField,
    "registryId" | "isActive" | "isRequired" | "caseDefinition"
  >,
): CaseDetailAvailableField {
  return {
    ...field,
    registryId: `${field.sourceType}:${field.fieldKey}`,
    isActive: true,
    isRequired: false,
    caseDefinition: null,
  };
}

export const caseDetailSystemFields: CaseDetailAvailableField[] = [
  systemField({ fieldKey: "customer_type", label: "Tipo de cliente", sourceType: "CUSTOMER_PROFILE", sourcePath: "customerType", fieldType: "TEXT", formulaKey: null, isCopyable: true, isEditable: false }),
  systemField({ fieldKey: "customer_segment", label: "Segmentación", sourceType: "CUSTOMER_PROFILE", sourcePath: "segment", fieldType: "BADGE", formulaKey: null, isCopyable: true, isEditable: false }),
  systemField({ fieldKey: "customer_name", label: "Nombre completo", sourceType: "CUSTOMER_PROFILE", sourcePath: "fullName", fieldType: "TEXT", formulaKey: null, isCopyable: true, isEditable: false }),
  systemField({ fieldKey: "customer_public_id", label: "ID Cuenta", sourceType: "CUSTOMER_PROFILE", sourcePath: "publicId", fieldType: "TEXT", formulaKey: null, isCopyable: true, isEditable: false }),
  systemField({ fieldKey: "customer_email", label: "Email cliente", sourceType: "CUSTOMER_PROFILE", sourcePath: "email", fieldType: "EMAIL", formulaKey: null, isCopyable: true, isEditable: false }),
  systemField({ fieldKey: "customer_phone", label: "Número completo", sourceType: "CUSTOMER_PROFILE", sourcePath: "phone", fieldType: "PHONE", formulaKey: null, isCopyable: true, isEditable: false }),
  systemField({ fieldKey: "customer_country", label: "País", sourceType: "CUSTOMER_PROFILE", sourcePath: "country", fieldType: "TEXT", formulaKey: null, isCopyable: true, isEditable: false }),
  systemField({ fieldKey: "customer_geolocation", label: "Geolocalización", sourceType: "CUSTOMER_PROFILE", sourcePath: "geolocation", fieldType: "TEXT", formulaKey: null, isCopyable: true, isEditable: false }),
  systemField({ fieldKey: "customer_compliance_status", label: "Estado compliance", sourceType: "CUSTOMER_PROFILE", sourcePath: "complianceStatus", fieldType: "BADGE", formulaKey: null, isCopyable: true, isEditable: false }),
  systemField({ fieldKey: "customer_paid_plan", label: "Paid plan", sourceType: "CUSTOMER_PROFILE", sourcePath: "plan", fieldType: "BADGE", formulaKey: null, isCopyable: true, isEditable: false }),
  systemField({ fieldKey: "customer_account_manager", label: "Account manager", sourceType: "CUSTOMER_PROFILE", sourcePath: "accountManager", fieldType: "TEXT", formulaKey: null, isCopyable: true, isEditable: false }),
  systemField({ fieldKey: "customer_document_number", label: "Documento", sourceType: "CUSTOMER_PROFILE", sourcePath: "documentNumber", fieldType: "TEXT", formulaKey: null, isCopyable: true, isEditable: false }),
  systemField({ fieldKey: "wsp_registrado", label: "N° WSP Registrado", sourceType: "FORMULA", sourcePath: null, fieldType: "CHECK", formulaKey: "WHATSAPP_MATCHES_CUSTOMER_PHONE", isCopyable: false, isEditable: false }),
  systemField({ fieldKey: "layout_spacer", label: "Espacio en blanco", sourceType: "FORMULA", sourcePath: null, fieldType: "TEXT", formulaKey: "LAYOUT_SPACER", isCopyable: false, isEditable: false }),
  systemField({ fieldKey: "csat_resolution_score", label: "CSAT Resolución", sourceType: "CSAT", sourcePath: "resolution_score", fieldType: "STARS", formulaKey: null, isCopyable: false, isEditable: false }),
  systemField({ fieldKey: "csat_service_score", label: "CSAT Servicio", sourceType: "CSAT", sourcePath: "service_score", fieldType: "STARS", formulaKey: null, isCopyable: false, isEditable: false }),
  systemField({ fieldKey: "csat_feedback", label: "CSAT Feedback", sourceType: "CSAT", sourcePath: "feedback", fieldType: "TEXT", formulaKey: null, isCopyable: false, isEditable: false }),
];
