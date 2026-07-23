"use client";

import {
  caseFieldTypes,
  isCustomValueCaseField,
  normalizeFieldKey,
  type CaseFieldDefinition,
  type CaseAreaLayout,
  type CaseFieldType,
  type CaseLayoutField,
  type CaseLayoutSection,
  type CaseLayoutTab,
} from "@/lib/case-metadata";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Columns2,
  FileText,
  GitBranch,
  GripVertical,
  Layers3,
  ListChecks,
  Pencil,
  Plus,
  Settings2,
  Shield,
  SlidersHorizontal,
  Tags,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useToast } from "./toast-provider";
import { CaseDetailSectionBuilder } from "./case-detail-section-builder";
import type { CaseDetailSectionConfiguration } from "@/lib/case-detail-sidebar-types";

type CaseObjectConfiguratorProps = {
  fields: CaseFieldDefinition[];
  tabs: CaseLayoutTab[];
  sections: CaseLayoutSection[];
  layoutFields: CaseLayoutField[];
  detailConfiguration: CaseDetailSectionConfiguration;
  formLayouts: CaseAreaLayout[];
  initialManagerTab?: ManagerTab;
};

type ManagerTab = "summary" | "fields" | "layouts" | "detail-layout" | "picklists" | "validations";
type FieldModalMode = "create" | "edit";
type FieldDraft = {
  id?: string;
  label: string;
  fieldKey: string;
  fieldType: CaseFieldType;
  description: string;
  isRequired: boolean;
  isActive: boolean;
  isStandard: boolean;
  defaultValue: string;
  picklistValues: string[];
};

const managerTabs: {
  key: ManagerTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "summary", label: "Resumen", icon: FileText },
  { key: "fields", label: "Campos", icon: Settings2 },
  { key: "layouts", label: "Layouts", icon: Layers3 },
  { key: "detail-layout", label: "Layout detalle", icon: Columns2 },
  { key: "picklists", label: "Picklists", icon: Tags },
  { key: "validations", label: "Validaciones simples", icon: ListChecks },
];

const inputClassName =
  "h-9 rounded-md border border-[var(--g66-border)] bg-white px-3 text-sm font-semibold text-[var(--g66-text-primary)] outline-none transition focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:bg-[var(--g66-background)] disabled:text-[var(--g66-text-secondary)]";
const textareaClassName =
  "min-h-20 rounded-md border border-[var(--g66-border)] bg-white px-3 py-2 text-sm font-semibold leading-5 text-[var(--g66-text-primary)] outline-none transition focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:bg-[var(--g66-background)] disabled:text-[var(--g66-text-secondary)]";

function emptyFieldDraft(): FieldDraft {
  return {
    label: "",
    fieldKey: "",
    fieldType: "text",
    description: "",
    isRequired: false,
    isActive: true,
    isStandard: false,
    defaultValue: "",
    picklistValues: [],
  };
}

function draftFromField(field: CaseFieldDefinition): FieldDraft {
  return {
    id: field.id,
    label: field.label,
    fieldKey: field.field_key,
    fieldType: field.field_type,
    description: field.description ?? "",
    isRequired: Boolean(field.is_required),
    isActive: field.is_active !== false,
    isStandard: Boolean(field.is_standard),
    defaultValue: field.default_value ?? "",
    picklistValues: field.picklist_values ?? [],
  };
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "blue" | "green" | "amber" | "red";
}) {
  const className =
    tone === "blue"
      ? "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]"
      : tone === "green"
        ? "bg-[var(--g66-success-soft)] text-[var(--g66-success)]"
        : tone === "amber"
          ? "bg-[var(--g66-warning-soft)] text-[var(--g66-warning-text)]"
          : tone === "red"
            ? "bg-[var(--g66-danger-soft)] text-[var(--g66-danger)]"
            : "bg-[var(--g66-background)] text-[var(--g66-text-secondary)]";

  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-bold ${className}`}>
      {children}
    </span>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--g66-accent-cyan)] shadow-sm">
        <Layers3 className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-bold text-[var(--g66-text-primary)]">{title}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--g66-text-secondary)]">{description}</p>
    </div>
  );
}

export function CaseObjectConfigurator({
  fields,
  tabs,
  sections,
  layoutFields,
  detailConfiguration,
  formLayouts,
  initialManagerTab = "fields",
}: CaseObjectConfiguratorProps) {
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ManagerTab>(initialManagerTab);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [fieldModalMode, setFieldModalMode] = useState<FieldModalMode>("create");
  const [fieldDraft, setFieldDraft] = useState<FieldDraft>(emptyFieldDraft());
  const [selectedTabId, setSelectedTabId] = useState(
    tabs.find((tab) => tab.tab_key === "ticket")?.id ?? tabs[0]?.id ?? "",
  );
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [newSectionLabel, setNewSectionLabel] = useState("");

  const isSystemField = (field: CaseFieldDefinition) =>
    Boolean(field.is_system) || field.is_editable === false;
  const systemFields = fields.filter(isSystemField);
  const standardFields = fields.filter((field) => field.is_standard && !isSystemField(field));
  const customFields = fields.filter((field) => isCustomValueCaseField(field) && !isSystemField(field));
  const fieldById = useMemo(
    () => new Map(fields.map((field) => [field.id, field])),
    [fields],
  );
  const sectionsByTab = useMemo(
    () =>
      sections
        .filter((section) => section.tab_id === selectedTabId)
        .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0)),
    [sections, selectedTabId],
  );
  const activeSelectedSectionId =
    selectedSectionId || sectionsByTab[0]?.id || "";
  const assignedFieldIds = useMemo(
    () =>
      new Set(
        layoutFields
          .filter((layoutField) => layoutField.section_id === activeSelectedSectionId)
          .map((layoutField) => layoutField.field_definition_id),
      ),
    [layoutFields, activeSelectedSectionId],
  );
  const availableFields = fields.filter(
    (field) => field.is_active !== false && !assignedFieldIds.has(field.id),
  );

  function closeFieldModal() {
    setIsFieldModalOpen(false);
    setFieldModalMode("edit");
    setFieldDraft({
      ...emptyFieldDraft(),
      id: undefined,
      label: "",
    });
  }

  function openCreateFieldModal() {
    setIsFieldModalOpen(true);
    setFieldModalMode("create");
    setFieldDraft(emptyFieldDraft());
  }

  function openEditFieldModal(field: CaseFieldDefinition) {
    setIsFieldModalOpen(true);
    setFieldModalMode("edit");
    setFieldDraft(draftFromField(field));
  }

  async function saveField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fieldKey = normalizeFieldKey(fieldDraft.fieldKey || fieldDraft.label);

    if (!fieldDraft.label.trim() || !fieldKey) {
      toast.error("✗ Label y field key son obligatorios");
      return;
    }

    const payload = {
      label: fieldDraft.label.trim(),
      field_type: fieldDraft.isStandard ? undefined : fieldDraft.fieldType,
      description: fieldDraft.description.trim() || null,
      is_required: fieldDraft.isRequired,
      is_active: fieldDraft.isStandard ? true : fieldDraft.isActive,
      picklist_values:
        fieldDraft.fieldType === "picklist" ? fieldDraft.picklistValues : [],
      default_value: fieldDraft.defaultValue.trim() || null,
    };

    const result =
      fieldModalMode === "edit" && fieldDraft.id
        ? await supabaseBrowser
            .from("case_field_definitions")
            .update(payload)
            .eq("id", fieldDraft.id)
        : await supabaseBrowser.from("case_field_definitions").insert({
            ...payload,
            field_key: fieldKey,
            field_type: fieldDraft.fieldType,
            is_standard: false,
            storage_type: "CUSTOM_VALUE",
            column_name: null,
            is_editable: true,
            is_filterable: true,
            is_list_visible: true,
            is_form_eligible: true,
            is_detail_eligible: true,
            is_system: false,
            sort_order: Math.max(1000, ...fields.map((field) => field.sort_order ?? 0)) + 10,
          });

    if (result.error) {
      console.error("[case-object-manager] Error saving field", result.error);
      toast.error(`✗ ${result.error.message}`);
      return;
    }

    toast.success(
      fieldModalMode === "edit"
        ? "✓ Campo actualizado correctamente"
        : "✓ Campo creado correctamente",
    );
    closeFieldModal();
    router.refresh();
  }

  async function deactivateField(field: CaseFieldDefinition) {
    if (!isCustomValueCaseField(field) || isSystemField(field)) return;

    const { error } = await supabaseBrowser
      .from("case_field_definitions")
      .update({ is_active: false })
      .eq("id", field.id);

    if (error) {
      console.error("[case-object-manager] Error deactivating field", error);
      toast.error(`✗ ${error.message}`);
      return;
    }

    toast.success("✓ Campo desactivado");
    router.refresh();
  }

  async function deleteField(field: CaseFieldDefinition) {
    if (!isCustomValueCaseField(field) || isSystemField(field)) return;

    const { error } = await supabaseBrowser
      .from("case_field_definitions")
      .delete()
      .eq("id", field.id);

    if (error) {
      console.error("[case-object-manager] Error deleting field", error);
      toast.error(`✗ ${error.message}`);
      return;
    }

    toast.success("✓ Campo eliminado");
    router.refresh();
  }

  async function createSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTabId || !newSectionLabel.trim()) {
      toast.error("✗ Selecciona una tab y escribe una sección");
      return;
    }

    const { error } = await supabaseBrowser.from("case_layout_sections").insert({
      tab_id: selectedTabId,
      label: newSectionLabel.trim(),
      sort_order: (sectionsByTab.length + 1) * 10,
      is_active: true,
    });

    if (error) {
      console.error("[case-object-manager] Error creating section", error);
      toast.error(`✗ ${error.message}`);
      return;
    }

    toast.success("✓ Sección agregada");
    setNewSectionLabel("");
    router.refresh();
  }

  async function assignField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fieldId = String(formData.get("field_definition_id") || "");

    if (!activeSelectedSectionId || !fieldId) {
      toast.error("✗ Selecciona sección y campo");
      return;
    }

    const sectionFieldCount = layoutFields.filter(
      (layoutField) => layoutField.section_id === activeSelectedSectionId,
    ).length;

    const { error } = await supabaseBrowser.from("case_layout_fields").insert({
      section_id: activeSelectedSectionId,
      field_definition_id: fieldId,
      sort_order: (sectionFieldCount + 1) * 10,
      column_span: Number(formData.get("column_span") || 1),
      is_readonly: false,
    });

    if (error) {
      console.error("[case-object-manager] Error assigning field", error);
      toast.error(`✗ ${error.message}`);
      return;
    }

    toast.success("✓ Campo agregado al layout");
    router.refresh();
  }

  async function updateLayoutField(
    layoutField: CaseLayoutField,
    values: Partial<CaseLayoutField>,
  ) {
    const { error } = await supabaseBrowser
      .from("case_layout_fields")
      .update(values)
      .eq("id", layoutField.id);

    if (error) {
      console.error("[case-object-manager] Error updating layout field", error);
      toast.error(`✗ ${error.message}`);
      return;
    }

    toast.success("✓ Layout actualizado");
    router.refresh();
  }

  async function removeLayoutField(layoutField: CaseLayoutField) {
    const { error } = await supabaseBrowser
      .from("case_layout_fields")
      .delete()
      .eq("id", layoutField.id);

    if (error) {
      console.error("[case-object-manager] Error removing layout field", error);
      toast.error(`✗ ${error.message}`);
      return;
    }

    toast.success("✓ Campo quitado del layout");
    router.refresh();
  }

  function renderFieldRows(fieldItems: CaseFieldDefinition[]) {
    if (fieldItems.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="px-4 py-10">
            <EmptyState
              title="No hay campos personalizados todavía."
              description="Crea un campo para extender el expediente de Caso sin tocar el esquema principal."
            />
          </td>
        </tr>
      );
    }

    return fieldItems.map((field) => (
      <tr key={field.id} className="border-b border-[var(--g66-border)] hover:bg-[var(--g66-background)]">
        <td className="px-4 py-3">
          <p className="text-sm font-bold text-[var(--g66-text-primary)]">{field.label}</p>
          {field.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-[var(--g66-text-secondary)]">
              {field.description}
            </p>
          ) : null}
        </td>
        <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--g66-text-primary)]">
          {field.field_key}
        </td>
        <td className="px-4 py-3 text-xs font-bold uppercase text-[var(--g66-text-secondary)]">
          {field.field_type}
        </td>
        <td className="px-4 py-3">
          <Badge tone={isSystemField(field) ? "amber" : field.is_standard ? "blue" : "green"}>
            {isSystemField(field) ? "Sistema / sólo lectura" : field.is_standard ? "Estándar" : "Personalizado"}
          </Badge>
        </td>
        <td className="px-4 py-3">
          {field.is_required ? (
            <CheckCircle2 className="h-4 w-4 text-[var(--g66-success)]" />
          ) : (
            <XCircle className="h-4 w-4 text-[var(--g66-text-secondary)]" />
          )}
        </td>
        <td className="px-4 py-3">
          <Badge tone={field.is_active !== false ? "green" : "red"}>
            {field.is_active !== false ? "Activo" : "Inactivo"}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openEditFieldModal(field)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--g66-border)] bg-white px-2 text-xs font-bold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-background)]"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
            {isCustomValueCaseField(field) && !isSystemField(field) ? (
              <>
                <button
                  type="button"
                  onClick={() => void deactivateField(field)}
                  disabled={field.is_active === false}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--g66-border)] bg-white px-2 text-xs font-bold text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)] disabled:opacity-40"
                >
                  Desactivar
                </button>
                <button
                  type="button"
                  onClick={() => void deleteField(field)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--g66-danger-soft)] bg-white px-2 text-xs font-bold text-[var(--g66-danger)] hover:bg-[var(--g66-danger-soft)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </button>
              </>
            ) : null}
          </div>
        </td>
      </tr>
    ));
  }

  return (
    <div className={`grid ${activeTab === "detail-layout" ? "gap-3 lg:grid-cols-[180px_minmax(0,1fr)]" : "gap-5 lg:grid-cols-[220px_minmax(0,1fr)]"}`}>
      <aside className="h-fit rounded-lg border border-[var(--g66-border)] bg-white p-2 shadow-sm">
        <div className="border-b border-[var(--g66-border)] px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--g66-text-secondary)]">
            Object Manager
          </p>
          <p className="mt-1 text-sm font-bold text-[var(--g66-text-primary)]">Caso</p>
        </div>
        <nav className="mt-2 grid gap-1">
          {managerTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex h-10 items-center gap-2 rounded-md px-3 text-left text-sm font-bold transition ${
                  isActive
                    ? "bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]"
                    : "text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)] hover:text-[var(--g66-text-primary)]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0">
        {activeTab === "summary" ? (
          <section className="rounded-lg border border-[var(--g66-border)] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--g66-text-primary)]">Resumen</h2>
                <p className="text-sm font-semibold text-[var(--g66-text-secondary)]">
                  Configuración metadata-driven del objeto Caso.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Campos estándar", standardFields.length],
                ["Campos personalizados", customFields.length],
                ["Sistema / sólo lectura", systemFields.length],
                ["Tabs", tabs.length],
                ["Secciones", sections.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[var(--g66-border)] bg-[var(--g66-background)] p-4">
                  <p className="text-xs font-bold uppercase text-[var(--g66-text-secondary)]">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-[var(--g66-text-primary)]">{value}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "fields" ? (
          <div className="grid gap-4">
            <section className="flex flex-col gap-3 rounded-lg border border-[var(--g66-border)] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--g66-text-primary)]">Campos</h2>
                <p className="text-sm font-semibold text-[var(--g66-text-secondary)]">
                  Catálogo único de campos estándar, personalizados y de sistema.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateFieldModal}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--g66-brand-blue)] px-4 text-sm font-bold text-white hover:bg-[var(--g66-accent-cyan)]"
              >
                <Plus className="h-4 w-4" />
                Nuevo campo
              </button>
            </section>

            <section className="overflow-hidden rounded-lg border border-[var(--g66-border)] bg-white shadow-sm">
              <div className="border-b border-[var(--g66-border)] px-4 py-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--g66-brand-blue)]">
                  Campos estándar del caso
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--g66-border)] bg-[var(--g66-background)] text-xs uppercase tracking-wide text-[var(--g66-text-secondary)]">
                    <tr>
                      <th className="px-4 py-2">Label</th>
                      <th className="px-4 py-2">Field Key</th>
                      <th className="px-4 py-2">Tipo</th>
                      <th className="px-4 py-2">Origen</th>
                      <th className="px-4 py-2">Requerido</th>
                      <th className="px-4 py-2">Activo</th>
                      <th className="px-4 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>{renderFieldRows(standardFields)}</tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-[var(--g66-border)] bg-white shadow-sm">
              <div className="border-b border-[var(--g66-border)] px-4 py-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--g66-brand-blue)]">
                  Campos personalizados
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--g66-border)] bg-[var(--g66-background)] text-xs uppercase tracking-wide text-[var(--g66-text-secondary)]">
                    <tr>
                      <th className="px-4 py-2">Label</th>
                      <th className="px-4 py-2">Field Key</th>
                      <th className="px-4 py-2">Tipo</th>
                      <th className="px-4 py-2">Origen</th>
                      <th className="px-4 py-2">Requerido</th>
                      <th className="px-4 py-2">Activo</th>
                      <th className="px-4 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>{renderFieldRows(customFields)}</tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-[var(--g66-border)] bg-white shadow-sm">
              <div className="border-b border-[var(--g66-border)] px-4 py-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--g66-warning-text)]">
                  Campos de sistema / sólo lectura
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--g66-border)] bg-[var(--g66-background)] text-xs uppercase tracking-wide text-[var(--g66-text-secondary)]">
                    <tr>
                      <th className="px-4 py-2">Label</th>
                      <th className="px-4 py-2">Field Key</th>
                      <th className="px-4 py-2">Tipo</th>
                      <th className="px-4 py-2">Origen</th>
                      <th className="px-4 py-2">Requerido</th>
                      <th className="px-4 py-2">Activo</th>
                      <th className="px-4 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>{renderFieldRows(systemFields)}</tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "layouts" ? (
          <div className="grid gap-4">
            <section className="rounded-lg border border-[var(--g66-border)] bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue-soft)] text-[var(--g66-brand-blue)]">
                  <Layers3 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--g66-text-primary)]">Layout Builder</h2>
                  <p className="text-sm font-semibold text-[var(--g66-text-secondary)]">
                    Configura secciones y campos con controles compactos. Sin drag & drop todavía.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-3 rounded-lg border border-[var(--g66-border)] bg-white p-4 shadow-sm">
              <FieldLabel label="Layout principal del caso">
                <select
                  value={selectedTabId}
                  onChange={(event) => {
                    setSelectedTabId(event.target.value);
                    setSelectedSectionId("");
                  }}
                  className={inputClassName}
                >
                  {tabs
                    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
                    .map((tab) => (
                      <option key={tab.id} value={tab.id}>
                        {tab.label} {tab.is_system ? "(Sistema)" : ""}
                      </option>
                    ))}
                </select>
              </FieldLabel>

              <div className="flex flex-col gap-2 rounded-md border border-[var(--g66-border)] bg-[var(--g66-background)] p-3 lg:flex-row lg:items-end">
                <form onSubmit={createSection} className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <input
                    value={newSectionLabel}
                    onChange={(event) => setNewSectionLabel(event.target.value)}
                    placeholder="Nueva sección"
                    className={inputClassName}
                  />
                  <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--g66-brand-blue)] px-3 text-sm font-bold text-white">
                    <Plus className="h-4 w-4" />
                    Agregar sección
                  </button>
                </form>

                <form onSubmit={assignField} className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <select
                    value={activeSelectedSectionId}
                    onChange={(event) => setSelectedSectionId(event.target.value)}
                    className={inputClassName}
                  >
                    {sectionsByTab.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.label}
                      </option>
                    ))}
                  </select>
                  <select name="field_definition_id" className={inputClassName}>
                    {availableFields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                  <select name="column_span" defaultValue={1} className={inputClassName}>
                    <option value={1}>1 col</option>
                    <option value={2}>2 col</option>
                  </select>
                  <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--g66-border)] bg-white px-3 text-sm font-bold text-[var(--g66-brand-blue)] hover:bg-white">
                    <Plus className="h-4 w-4" />
                    Agregar campo
                  </button>
                </form>
              </div>
            </section>

            <div className="grid gap-4">
              {tabs
                .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))
                .map((tab) => {
                  const tabSections = sections
                    .filter((section) => section.tab_id === tab.id)
                    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));

                  return (
                    <section
                      key={tab.id}
                      className={`rounded-lg border bg-white shadow-sm ${
                        selectedTabId === tab.id ? "border-[var(--g66-brand-blue)]" : "border-[var(--g66-border)]"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-[var(--g66-border)] bg-[var(--g66-background)] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-white text-[var(--g66-accent-cyan)] shadow-sm">
                            {tab.is_system ? (
                              <Shield className="h-4 w-4" />
                            ) : (
                              <GitBranch className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-[var(--g66-text-primary)]">{tab.label}</h3>
                            <p className="text-xs font-semibold text-[var(--g66-text-secondary)]">{tab.tab_key}</p>
                          </div>
                        </div>
                        <Badge tone={tab.is_system ? "blue" : "green"}>
                          {tab.is_system ? "Sistema" : "Configurable"}
                        </Badge>
                      </div>

                      <div className="grid gap-3 p-4">
                        {tabSections.length === 0 ? (
                          <EmptyState
                            title="Agrega una sección para comenzar."
                            description="Las secciones agrupan campos dentro del layout del caso."
                          />
                        ) : (
                          tabSections.map((section) => {
                            const sectionFields = layoutFields
                              .filter((layoutField) => layoutField.section_id === section.id)
                              .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));

                            return (
                              <article
                                key={section.id}
                                className="rounded-lg border border-[var(--g66-border)] bg-white p-4 shadow-sm"
                              >
                                <div className="mb-3 flex items-center justify-between">
                                  <div>
                                    <h4 className="text-sm font-bold text-[var(--g66-brand-blue)]">
                                      {section.label}
                                    </h4>
                                    <p className="text-xs font-semibold text-[var(--g66-text-secondary)]">
                                      {sectionFields.length} campos
                                    </p>
                                  </div>
                                  <Columns2 className="h-4 w-4 text-[var(--g66-brand-blue)]" />
                                </div>

                                {sectionFields.length === 0 ? (
                                  <EmptyState
                                    title="Esta sección está vacía."
                                    description="Usa Agregar campo para comenzar a construir el layout."
                                  />
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {sectionFields.map((layoutField, index) => {
                                      const field = fieldById.get(layoutField.field_definition_id);

                                      return (
                                        <div
                                          key={layoutField.id}
                                          className="group inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--g66-border)] bg-[var(--g66-background)] px-3 py-2 text-sm font-bold text-[var(--g66-text-primary)] transition hover:border-[var(--g66-brand-blue)] hover:bg-white"
                                        >
                                          <GripVertical className="h-3.5 w-3.5 shrink-0 text-[var(--g66-brand-blue)]" />
                                          <span className="truncate">{field?.label ?? "Campo eliminado"}</span>
                                          <Badge tone={field?.is_standard ? "blue" : "green"}>
                                            {field?.is_standard ? "Std" : "Custom"}
                                          </Badge>
                                          {layoutField.is_readonly ? (
                                            <Badge tone="amber">Readonly</Badge>
                                          ) : null}
                                          <button
                                            type="button"
                                            disabled={index === 0}
                                            onClick={() =>
                                              void updateLayoutField(layoutField, {
                                                sort_order: (layoutField.sort_order ?? 0) - 15,
                                              })
                                            }
                                            className="rounded p-1 text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)] disabled:opacity-30"
                                            title="Mover arriba"
                                          >
                                            <ChevronUp className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            disabled={index === sectionFields.length - 1}
                                            onClick={() =>
                                              void updateLayoutField(layoutField, {
                                                sort_order: (layoutField.sort_order ?? 0) + 15,
                                              })
                                            }
                                            className="rounded p-1 text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)] disabled:opacity-30"
                                            title="Mover abajo"
                                          >
                                            <ChevronDown className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              void updateLayoutField(layoutField, {
                                                is_readonly: !layoutField.is_readonly,
                                              })
                                            }
                                            className="rounded p-1 text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)] hover:text-[var(--g66-brand-blue)]"
                                            title="Readonly"
                                          >
                                            <SlidersHorizontal className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void removeLayoutField(layoutField)}
                                            className="rounded p-1 text-[var(--g66-danger)] hover:bg-[var(--g66-danger-soft)]"
                                            title="Quitar del layout"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </article>
                            );
                          })
                        )}
                      </div>
                    </section>
                  );
                })}
            </div>
          </div>
        ) : null}

        {activeTab === "detail-layout" ? (
          <CaseDetailSectionBuilder
            initialConfiguration={detailConfiguration}
            initialFormLayouts={formLayouts}
          />
        ) : null}

        {activeTab === "picklists" ? (
          <section className="rounded-lg border border-[var(--g66-border)] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Tags className="h-5 w-5 text-[var(--g66-accent-cyan)]" />
              <div>
                <h2 className="text-lg font-bold text-[var(--g66-text-primary)]">Picklists</h2>
                <p className="text-sm font-semibold text-[var(--g66-text-secondary)]">
                  Las opciones se administran desde el modal de cada campo tipo picklist.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "validations" ? (
          <section className="rounded-lg border border-[var(--g66-border)] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <ListChecks className="h-5 w-5 text-[var(--g66-accent-cyan)]" />
              <div>
                <h2 className="text-lg font-bold text-[var(--g66-text-primary)]">Validaciones simples</h2>
                <p className="text-sm font-semibold text-[var(--g66-text-secondary)]">
                  Requerido, number/currency y picklists ya se validan al editar el caso.
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {isFieldModalOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <form
            onSubmit={saveField}
            className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--g66-border)] px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--g66-text-primary)]">
                  {fieldModalMode === "edit" ? "Editar campo" : "Nuevo campo"}
                </h2>
                <p className="text-sm font-semibold text-[var(--g66-text-secondary)]">
                  {fieldDraft.isStandard
                    ? "Campo estándar: field key y tipo están protegidos."
                    : "Define metadata portable para el objeto Caso."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeFieldModal}
                className="rounded p-1 text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid gap-4">
                <FieldLabel label="Label">
                  <input
                    value={fieldDraft.label}
                    onChange={(event) => {
                      const label = event.target.value;
                      setFieldDraft((current) => ({
                        ...current,
                        label,
                        fieldKey:
                          current.isStandard || current.fieldKey
                            ? current.fieldKey
                            : normalizeFieldKey(label),
                      }));
                    }}
                    className={inputClassName}
                  />
                </FieldLabel>

                <FieldLabel label="Field key">
                  <input
                    value={fieldDraft.fieldKey}
                    onChange={(event) =>
                      setFieldDraft((current) => ({
                        ...current,
                        fieldKey: normalizeFieldKey(event.target.value),
                      }))
                    }
                    disabled={fieldDraft.isStandard || fieldModalMode === "edit"}
                    className={inputClassName}
                  />
                </FieldLabel>

                <FieldLabel label="Tipo">
                  <select
                    value={fieldDraft.fieldType}
                    onChange={(event) =>
                      setFieldDraft((current) => ({
                        ...current,
                        fieldType: event.target.value as CaseFieldType,
                      }))
                    }
                    disabled={fieldDraft.isStandard}
                    className={inputClassName}
                  >
                    {caseFieldTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </FieldLabel>

                <FieldLabel label="Descripción">
                  <textarea
                    value={fieldDraft.description}
                    onChange={(event) =>
                      setFieldDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className={textareaClassName}
                  />
                </FieldLabel>

                <FieldLabel label="Default value">
                  <input
                    value={fieldDraft.defaultValue}
                    onChange={(event) =>
                      setFieldDraft((current) => ({
                        ...current,
                        defaultValue: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </FieldLabel>

                {fieldDraft.fieldType === "picklist" ? (
                  <section className="rounded-lg border border-[var(--g66-border)] bg-[var(--g66-background)] p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[var(--g66-text-primary)]">Opciones picklist</h3>
                      <button
                        type="button"
                        onClick={() =>
                          setFieldDraft((current) => ({
                            ...current,
                            picklistValues: [...current.picklistValues, ""],
                          }))
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--g66-border)] bg-white px-2 text-xs font-bold text-[var(--g66-brand-blue)]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Agregar opción
                      </button>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {fieldDraft.picklistValues.length === 0 ? (
                        <p className="text-sm font-semibold text-[var(--g66-text-secondary)]">
                          Agrega al menos una opción para este picklist.
                        </p>
                      ) : (
                        fieldDraft.picklistValues.map((option, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              value={option}
                              onChange={(event) =>
                                setFieldDraft((current) => ({
                                  ...current,
                                  picklistValues: current.picklistValues.map(
                                    (currentOption, currentIndex) =>
                                      currentIndex === index
                                        ? event.target.value
                                        : currentOption,
                                  ),
                                }))
                              }
                              className={inputClassName}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setFieldDraft((current) => ({
                                  ...current,
                                  picklistValues: current.picklistValues.filter(
                                    (_, currentIndex) => currentIndex !== index,
                                  ),
                                }))
                              }
                              className="h-9 rounded-md border border-[var(--g66-danger-soft)] bg-white px-3 text-[var(--g66-danger)]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-md border border-[var(--g66-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--g66-text-primary)]">
                    <input
                      type="checkbox"
                      checked={fieldDraft.isRequired}
                      onChange={(event) =>
                        setFieldDraft((current) => ({
                          ...current,
                          isRequired: event.target.checked,
                        }))
                      }
                    />
                    Requerido
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-[var(--g66-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--g66-text-primary)]">
                    <input
                      type="checkbox"
                      checked={fieldDraft.isActive}
                      disabled={fieldDraft.isStandard}
                      onChange={(event) =>
                        setFieldDraft((current) => ({
                          ...current,
                          isActive: event.target.checked,
                        }))
                      }
                    />
                    Activo
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--g66-border)] px-5 py-4">
              <button
                type="button"
                onClick={closeFieldModal}
                className="h-9 rounded-md border border-[var(--g66-border)] bg-white px-4 text-sm font-bold text-[var(--g66-brand-blue)]"
              >
                Cancelar
              </button>
              <button className="h-9 rounded-md bg-[var(--g66-brand-blue)] px-4 text-sm font-bold text-white">
                {fieldModalMode === "edit" ? "Guardar cambios" : "Crear campo"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
