"use client";

import type {
  CaseDetailAvailableField,
  CaseDetailConfiguredField,
  CaseDetailConfiguredSection,
  CaseDetailSectionConfiguration,
  CaseDetailSectionKey,
  CaseDetailSourceType,
} from "@/lib/case-detail-sidebar-types";
import type { CaseAreaLayout } from "@/lib/case-metadata";
import {
  buildCaseDetailLayoutCatalog,
  filterCaseDetailLayoutCatalog,
  type CaseLayoutCatalogSource,
} from "@/lib/case-layout-field-catalog";
import {
  schemaForCaseAreaLayout,
  type CaseFormLayoutItem,
  type CaseFormLayoutSchema,
  type CaseFormLayoutSection,
} from "@/lib/case-form-layout";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Eye,
  FilePenLine,
  GripVertical,
  Plus,
  RotateCcw,
  Save,
  Search,
  Star,
  SquareDashed,
  Tags,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./case-detail-layout-builder.module.css";
import { useToast } from "./toast-provider";

type DraftSection = Omit<CaseDetailConfiguredSection, "fields"> & {
  fields: CaseDetailConfiguredField[];
};
type CanvasView = "SIDEBAR" | "FORM";
type EditorTarget =
  | { view: "SIDEBAR"; sectionKey: CaseDetailSectionKey }
  | { view: "FORM"; sectionId: string };

const sources: Array<{ key: CaseLayoutCatalogSource; label: string }> = [
  { key: "ALL", label: "Todos" },
  { key: "CASE", label: "Caso" },
  { key: "CUSTOMER", label: "Cliente" },
  { key: "FORMULA", label: "Fórmulas" },
  { key: "CSAT", label: "CSAT" },
  { key: "STRUCTURE", label: "Estructura" },
];

const sectionIcons: Record<CaseDetailSectionKey, React.ComponentType<{ className?: string }>> = {
  CUSTOMER_INFO: Users,
  CASE_INFO: BriefcaseBusiness,
  CASE_PROPERTIES: Tags,
  CSAT: Star,
};

function identity(field: Pick<CaseDetailConfiguredField, "sourceType" | "fieldKey">) {
  return `${field.sourceType}:${field.fieldKey}`;
}

function visibleSections(configuration: CaseDetailSectionConfiguration): DraftSection[] {
  return configuration.sections.map((section) => ({
    ...section,
    fields: section.fields.filter((field) => field.isVisible),
  }));
}

function configuredField(definition: CaseDetailAvailableField, sortOrder: number) {
  return {
    fieldKey: definition.fieldKey,
    sourceType: definition.sourceType,
    sortOrder,
    isVisible: true,
    isEditable: definition.sourceType === "CASE" && definition.isEditable,
    isCopyable: definition.isCopyable,
    inheritedFromGeneral: false,
    definition,
  } satisfies CaseDetailConfiguredField;
}

function activeFormLayout(layouts: CaseAreaLayout[], area: string) {
  return layouts.find((layout) => layout.area === area && layout.is_active !== false) ??
    layouts.find((layout) => layout.area === "GENERAL" && layout.is_active !== false) ??
    null;
}

function ownFormLayout(layouts: CaseAreaLayout[], area: string) {
  return layouts.find((layout) => layout.area === area && layout.is_active !== false) ?? null;
}

function formSchemaForArea(layouts: CaseAreaLayout[], area: string) {
  return schemaForCaseAreaLayout(activeFormLayout(layouts, area));
}

async function configurationResponse(response: Response) {
  const payload = (await response.json()) as CaseDetailSectionConfiguration & { error?: string };
  if (!response.ok) throw new Error(payload.error || "No se pudo actualizar el layout.");
  return payload;
}

function sourceClass(source: CaseDetailSourceType) {
  if (source === "CUSTOMER_PROFILE") return styles.sourceCustomer;
  if (source === "FORMULA") return styles.sourceFormula;
  if (source === "CSAT") return styles.sourceCsat;
  return styles.sourceCase;
}

export function CaseDetailSectionBuilder({
  initialConfiguration,
  initialFormLayouts,
}: {
  initialConfiguration: CaseDetailSectionConfiguration;
  initialFormLayouts: CaseAreaLayout[];
}) {
  const toast = useToast();
  const [configuration, setConfiguration] = useState(initialConfiguration);
  const [sections, setSections] = useState<DraftSection[]>(() => visibleSections(initialConfiguration));
  const [formLayouts, setFormLayouts] = useState(initialFormLayouts);
  const [formSections, setFormSections] = useState<CaseFormLayoutSection[]>(() =>
    formSchemaForArea(initialFormLayouts, initialConfiguration.area).sections,
  );
  const [activeSource, setActiveSource] = useState<CaseLayoutCatalogSource>("ALL");
  const [canvasView, setCanvasView] = useState<CanvasView>("SIDEBAR");
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [sidebarDirty, setSidebarDirty] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const layoutCatalog = useMemo(
    () => buildCaseDetailLayoutCatalog(configuration.availableFields),
    [configuration.availableFields],
  );
  const detailOwn = configuration.hasOwnConfiguration;
  const formOwn = configuration.area === "GENERAL" || Boolean(ownFormLayout(formLayouts, configuration.area));

  function replaceConfiguration(next: CaseDetailSectionConfiguration) {
    setConfiguration(next);
    setSections(visibleSections(next));
    setSidebarDirty(false);
  }

  async function loadFormLayouts() {
    const response = await fetch("/api/case-layouts", { cache: "no-store" });
    const payload = (await response.json()) as {
      layouts?: CaseAreaLayout[];
      error?: string;
    };
    if (!response.ok) throw new Error(payload.error || "No se pudo cargar el Tab Form.");
    const nextLayouts = payload.layouts ?? [];
    setFormLayouts(nextLayouts);
    const schema = formSchemaForArea(nextLayouts, configuration.area);
    setFormSections(schema.sections);
    setFormDirty(false);
    return nextLayouts;
  }

  async function selectArea(area: string) {
    if (area === configuration.area || isWorking) return;
    setIsWorking(true);
    try {
      const next = await configurationResponse(
        await fetch(`/api/case-detail-sections?area=${encodeURIComponent(area)}`),
      );
      replaceConfiguration(next);
      const schema = formSchemaForArea(formLayouts, area);
      setFormSections(schema.sections);
      setFormDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el área.");
    } finally {
      setIsWorking(false);
    }
  }

  function openSidebarEditor(sectionKey: CaseDetailSectionKey) {
    setCanvasView("SIDEBAR");
    setActiveSource("ALL");
    setQuery("");
    setEditorTarget({ view: "SIDEBAR", sectionKey });
  }

  function openFormEditor(sectionId: string) {
    setCanvasView("FORM");
    setActiveSource("ALL");
    setQuery("");
    setEditorTarget({ view: "FORM", sectionId });
  }

  function addEditorField(definition: CaseDetailAvailableField) {
    if (!editorTarget) return;
    const fieldIdentity = `${definition.sourceType}:${definition.fieldKey}`;
    if (editorTarget.view === "FORM") {
      setFormSections((current) => current.map((section) => {
        const withoutField = section.items.filter((item) =>
          item.type !== "FIELD" || `${item.sourceType}:${item.fieldKey}` !== fieldIdentity,
        );
        if (section.id !== editorTarget.sectionId) return { ...section, items: withoutField };
        return {
          ...section,
          items: [...withoutField, {
            id: `field-${crypto.randomUUID()}`,
            type: "FIELD",
            sourceType: definition.sourceType,
            fieldKey: definition.fieldKey,
            label: definition.label,
            order: (withoutField.length + 1) * 10,
            required: Boolean(definition.isRequired),
            editable: definition.sourceType === "CASE" && definition.isEditable,
            columnSpan: 1,
          }],
        };
      }));
      setFormDirty(true);
      return;
    }
    setSections((current) => current.map((section) => {
      const withoutField = section.fields.filter((field) => identity(field) !== fieldIdentity);
      if (section.sectionKey !== editorTarget.sectionKey) return { ...section, fields: withoutField };
      return {
        ...section,
        fields: [...withoutField, configuredField(definition, (withoutField.length + 1) * 10)],
      };
    }));
    setSidebarDirty(true);
  }

  function toggleSection(key: string) {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateSidebarField(
    sectionKey: CaseDetailSectionKey,
    fieldIdentity: string,
    patch: Partial<CaseDetailConfiguredField>,
  ) {
    setSections((current) => current.map((section) => section.sectionKey === sectionKey
      ? { ...section, fields: section.fields.map((field) => identity(field) === fieldIdentity ? { ...field, ...patch } : field) }
      : section));
    setSidebarDirty(true);
  }

  function removeSidebarField(sectionKey: CaseDetailSectionKey, fieldIdentity: string) {
    setSections((current) => current.map((section) => section.sectionKey === sectionKey
      ? { ...section, fields: section.fields.filter((field) => identity(field) !== fieldIdentity) }
      : section));
    setSidebarDirty(true);
  }

  function moveSidebarField(sectionKey: CaseDetailSectionKey, fieldIdentity: string, direction: -1 | 1) {
    setSections((current) => current.map((section) => {
      if (section.sectionKey !== sectionKey) return section;
      const fields = [...section.fields];
      const index = fields.findIndex((field) => identity(field) === fieldIdentity);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= fields.length) return section;
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...section, fields: fields.map((field, fieldIndex) => ({ ...field, sortOrder: (fieldIndex + 1) * 10 })) };
    }));
    setSidebarDirty(true);
  }

  function addFormSection() {
    const id = `section-${crypto.randomUUID()}`;
    setFormSections((current) => [...current, {
      id,
      name: `Nueva sección ${current.length + 1}`,
      description: null,
      order: (current.length + 1) * 10,
      items: [],
    }]);
    setFormDirty(true);
    setEditorTarget({ view: "FORM", sectionId: id });
  }

  function addFormSpacer(sectionId?: string) {
    const targetSectionId = sectionId || formSections[0]?.id;
    if (!targetSectionId) {
      toast.error("Crea una sección antes de agregar un espacio en blanco.");
      return;
    }
    setFormSections((current) => current.map((section) => section.id === targetSectionId
      ? {
          ...section,
          items: [...section.items, {
            id: `spacer-${crypto.randomUUID()}`,
            type: "SPACER",
            order: (section.items.length + 1) * 10,
            columnSpan: 1,
          }],
        }
      : section));
    setFormDirty(true);
  }

  function updateFormSection(sectionId: string, patch: Partial<CaseFormLayoutSection>) {
    setFormSections((current) => current.map((section) => section.id === sectionId
      ? { ...section, ...patch }
      : section));
    setFormDirty(true);
  }

  function removeFormSection(sectionId: string) {
    setFormSections((current) => {
      const next = current.filter((section) => section.id !== sectionId);
      return next;
    });
    setFormDirty(true);
  }

  function moveFormSection(sectionId: string, direction: -1 | 1) {
    setFormSections((current) => {
      const sections = [...current];
      const index = sections.findIndex((section) => section.id === sectionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sections.length) return current;
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return sections.map((section, sectionIndex) => ({ ...section, order: (sectionIndex + 1) * 10 }));
    });
    setFormDirty(true);
  }

  function updateFormItem(sectionId: string, itemId: string, patch: Partial<CaseFormLayoutItem>) {
    setFormSections((current) => current.map((section) => section.id === sectionId
      ? { ...section, items: section.items.map((item) => item.id === itemId ? { ...item, ...patch } as CaseFormLayoutItem : item) }
      : section));
    setFormDirty(true);
  }

  function removeFormItem(sectionId: string, itemId: string) {
    setFormSections((current) => current.map((section) => section.id === sectionId
      ? { ...section, items: section.items.filter((item) => item.id !== itemId) }
      : section));
    setFormDirty(true);
  }

  function moveFormItem(sectionId: string, itemId: string, direction: -1 | 1) {
    setFormSections((current) => current.map((section) => {
      if (section.id !== sectionId) return section;
      const items = [...section.items];
      const index = items.findIndex((item) => item.id === itemId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return section;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...section, items: items.map((item, itemIndex) => ({ ...item, order: (itemIndex + 1) * 10 })) };
    }));
    setFormDirty(true);
  }

  async function saveFormLayout(sections: CaseFormLayoutSection[]) {
    const existing = formLayouts.find((layout) => layout.area === configuration.area);
    const source = activeFormLayout(formLayouts, configuration.area);
    const response = await fetch(existing ? `/api/case-layouts/${existing.id}` : "/api/case-layouts", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        area: configuration.area,
        name: existing?.name || `Formulario ${configuration.area}`,
        description: existing?.description || source?.description || `Campos del formulario para ${configuration.area}.`,
        is_active: true,
        layoutSchema: {
          version: 2,
          sections: sections.map((section, sectionIndex) => ({
            ...section,
            order: (sectionIndex + 1) * 10,
            items: section.items.map((item, itemIndex) => ({ ...item, order: (itemIndex + 1) * 10 })),
          })),
        } satisfies CaseFormLayoutSchema,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "No se pudo guardar el Tab Form.");
  }

  async function createOwnConfiguration() {
    if (configuration.area === "GENERAL") return;
    setIsWorking(true);
    try {
      let nextConfiguration = configuration;
      if (!detailOwn) {
        nextConfiguration = await configurationResponse(await fetch("/api/case-detail-sections/area", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ area: configuration.area }),
        }));
      }
      if (!formOwn) await saveFormLayout(formSections);
      replaceConfiguration(nextConfiguration);
      await loadFormLayouts();
      toast.success("✓ Configuración propia creada desde GENERAL");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la configuración.");
    } finally {
      setIsWorking(false);
    }
  }

  async function restoreInheritance() {
    if (configuration.area === "GENERAL") return;
    setIsWorking(true);
    try {
      let nextConfiguration = configuration;
      if (detailOwn) {
        nextConfiguration = await configurationResponse(await fetch("/api/case-detail-sections/area", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ area: configuration.area }),
        }));
      }
      const formLayout = ownFormLayout(formLayouts, configuration.area);
      if (formLayout) {
        const response = await fetch(`/api/case-layouts/${formLayout.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("No se pudo restaurar la herencia del Tab Form.");
      }
      replaceConfiguration(nextConfiguration);
      await loadFormLayouts();
      toast.success("✓ El área vuelve a heredar GENERAL");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo restaurar la herencia.");
    } finally {
      setIsWorking(false);
    }
  }

  async function save() {
    if (!sidebarDirty && !formDirty) {
      toast.success("No hay cambios pendientes.");
      return;
    }
    setIsWorking(true);
    try {
      let savedConfiguration = configuration;
      if (sidebarDirty) {
        if (configuration.area !== "GENERAL" && !detailOwn) {
          savedConfiguration = await configurationResponse(await fetch("/api/case-detail-sections/area", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ area: configuration.area }),
          }));
        }
        for (const section of sections) {
          savedConfiguration = await configurationResponse(await fetch(
            `/api/case-detail-sections/${encodeURIComponent(section.sectionKey)}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                area: configuration.area,
                fields: section.fields.map((field, index) => ({
                  fieldKey: field.fieldKey,
                  sourceType: field.sourceType,
                  sortOrder: (index + 1) * 10,
                  isVisible: true,
                  isEditable: field.isEditable,
                  isCopyable: field.isCopyable,
                })),
              }),
            },
          ));
        }
      }
      if (formDirty) await saveFormLayout(formSections);
      replaceConfiguration(savedConfiguration);
      if (formDirty) await loadFormLayouts();
      toast.success("✓ Layout guardado correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el layout.");
    } finally {
      setIsWorking(false);
    }
  }

  const inheritanceTitle = configuration.area === "GENERAL"
    ? "Este es el layout base (GENERAL)"
    : detailOwn && formOwn
      ? "Esta área usa configuración propia"
      : "Esta área hereda la configuración GENERAL";
  const inheritanceDescription = configuration.area === "GENERAL"
    ? "Las demás áreas heredan esta configuración."
    : detailOwn && formOwn
      ? "Sidebar y Tab Form tienen configuración específica para esta área."
      : "Al guardar cambios se creará una configuración propia.";
  const editorSidebarSection = editorTarget?.view === "SIDEBAR"
    ? sections.find((section) => section.sectionKey === editorTarget.sectionKey) ?? null
    : null;
  const editorFormSection = editorTarget?.view === "FORM"
    ? formSections.find((section) => section.id === editorTarget.sectionId) ?? null
    : null;
  const editorVisibleIdentities = new Set(
    editorSidebarSection
      ? editorSidebarSection.fields.map(identity)
      : editorFormSection?.items.flatMap((item) => item.type === "FIELD"
        ? [`${item.sourceType}:${item.fieldKey}`]
        : []) ?? [],
  );
  const availableForEditor = filterCaseDetailLayoutCatalog({
    catalog: layoutCatalog,
    view: editorTarget?.view ?? canvasView,
    source: activeSource,
    query,
  });

  return (
    <div className={styles.builder}>
      <section className={styles.areaCard}>
        <div className={styles.areaRow}>
          <label>
            <span className={styles.areaLabel}>Área del layout</span>
            <select value={configuration.area} disabled={isWorking} onChange={(event) => void selectArea(event.target.value)} className={styles.areaSelect}>
              {configuration.areas.map((area) => <option key={area}>{area}</option>)}
            </select>
          </label>
          <div className={`${styles.inheritance} ${configuration.area !== "GENERAL" && (!detailOwn || !formOwn) ? styles.inheritanceWarn : ""}`}>
            <span className={styles.inheritanceIcon}><Check className="h-3.5 w-3.5" /></span>
            <div><strong>{inheritanceTitle}</strong><span>{inheritanceDescription}</span></div>
          </div>
          <div className={styles.actionRow}>
            <button type="button" onClick={() => setShowPreview(true)} className={styles.actionButton}><Eye className="h-3.5 w-3.5" />Vista previa</button>
            {configuration.area !== "GENERAL" && (!detailOwn || !formOwn) ? <button type="button" disabled={isWorking} onClick={() => void createOwnConfiguration()} className={styles.actionButton}>Crear configuración propia</button> : null}
            {configuration.area !== "GENERAL" && (detailOwn || formOwn) ? <button type="button" disabled={isWorking} onClick={() => void restoreInheritance()} className={styles.actionButton}><RotateCcw className="h-3.5 w-3.5" />Volver a heredar GENERAL</button> : null}
            <button type="button" disabled={isWorking} onClick={() => void save()} className={`${styles.actionButton} ${styles.primaryButton}`}><Save className="h-3.5 w-3.5" />{isWorking ? "Guardando..." : "Guardar"}</button>
          </div>
        </div>
        <div className={styles.areaTabs}>
          {configuration.areas.map((area) => <button key={area} type="button" disabled={isWorking} onClick={() => void selectArea(area)} className={`${styles.areaTab} ${area === configuration.area ? styles.activeAreaTab : ""}`}>{area}</button>)}
        </div>
      </section>

      <section className={styles.workspace}>
        <main className={styles.canvas}>
          <div className={styles.canvasHeader}><div><h2 className={styles.panelTitle}>Layout del detalle</h2><p className={styles.panelDescription}>Edita cada sección en un espacio amplio y ordena el contenido que verá el ejecutivo.</p></div></div>
          <div className={styles.viewTabs}>
            <button type="button" onClick={() => setCanvasView("SIDEBAR")} className={`${styles.viewTab} ${canvasView === "SIDEBAR" ? styles.activeViewTab : ""}`}>Sidebar del detalle</button>
            <button type="button" onClick={() => setCanvasView("FORM")} className={`${styles.viewTab} ${canvasView === "FORM" ? styles.activeViewTab : ""}`}>Tab Form</button>
          </div>

          {canvasView === "SIDEBAR" ? sections.map((section) => {
            const Icon = sectionIcons[section.sectionKey];
            const collapsed = collapsedSections.has(`sidebar:${section.sectionKey}`);
            return (
              <article key={section.sectionKey} className={styles.section}>
                <header className={styles.sectionHeader}>
                  <div className={styles.sectionIdentity}><span className={styles.sectionIcon}><Icon className="h-3.5 w-3.5" /></span><div className="min-w-0"><span className={styles.sectionName}>{section.name}</span><span className={styles.sectionDescription}>{section.description}</span></div></div>
                  <div className={styles.sectionActions}>
                    <button type="button" onClick={() => openSidebarEditor(section.sectionKey)} className={styles.editFieldsButton}><FilePenLine className="h-3.5 w-3.5" />Editar campos</button>
                    <button type="button" onClick={() => toggleSection(`sidebar:${section.sectionKey}`)} title={collapsed ? "Expandir sección" : "Colapsar sección"} className={`${styles.miniButton} ${collapsed ? styles.collapsedButton : ""}`}><ChevronDown className="h-3.5 w-3.5" /></button>
                  </div>
                </header>
                {!collapsed ? section.fields.length ? <div className={styles.sectionGrid}>{section.fields.map((field) => field.fieldKey === "layout_spacer" ? (
                  <div key={identity(field)} className={styles.layoutSpacer}><SquareDashed className="h-4 w-4" /><span>Espacio en blanco</span></div>
                ) : (
                  <div key={identity(field)} className={styles.layoutField}>
                    <div className={styles.layoutFieldTop}><GripVertical className={`${styles.grip} h-3 w-3`} /><div className="min-w-0"><span className={styles.fieldLabel}>{field.definition.label}</span><span className={styles.fieldKey}>{field.sourceType} · {field.definition.fieldType}</span></div></div>
                    <div className={styles.fieldOptions}><span>{field.isCopyable ? "Copiable" : "No copiable"}</span><span>{field.isEditable ? "Editable" : "Lectura"}</span></div>
                  </div>
                ))}</div> : <button type="button" onClick={() => openSidebarEditor(section.sectionKey)} className={styles.emptySection}>Esta sección está vacía. Edita sus campos para agregar contenido.</button> : null}
              </article>
            );
          }) : (
            <div>
              {formSections.map((section, sectionIndex) => {
                const collapsed = collapsedSections.has(`form:${section.id}`);
                return (
                  <article key={section.id} className={styles.section}>
                    <header className={styles.sectionHeader}>
                      <div className={styles.sectionIdentity}>
                        <span className={styles.sectionIcon}><FilePenLine className="h-3.5 w-3.5" /></span>
                        <div className="min-w-0">
                          <input value={section.name} onChange={(event) => updateFormSection(section.id, { name: event.target.value })} onClick={(event) => event.stopPropagation()} aria-label="Nombre de sección" className={styles.sectionNameInput} />
                          <input value={section.description ?? ""} onChange={(event) => updateFormSection(section.id, { description: event.target.value || null })} onClick={(event) => event.stopPropagation()} placeholder="Descripción opcional" aria-label="Descripción de sección" className={styles.sectionDescriptionInput} />
                        </div>
                      </div>
                      <div className={styles.sectionActions}>
                        <button type="button" onClick={() => openFormEditor(section.id)} className={styles.editFieldsButton}><FilePenLine className="h-3.5 w-3.5" />Editar campos</button>
                        <button type="button" disabled={sectionIndex === 0} onClick={(event) => { event.stopPropagation(); moveFormSection(section.id, -1); }} title="Subir sección" className={styles.miniButton}><ArrowUp className="h-3 w-3" /></button>
                        <button type="button" disabled={sectionIndex === formSections.length - 1} onClick={(event) => { event.stopPropagation(); moveFormSection(section.id, 1); }} title="Bajar sección" className={styles.miniButton}><ArrowDown className="h-3 w-3" /></button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); removeFormSection(section.id); }} title="Eliminar sección" className={`${styles.miniButton} ${styles.trashButton}`}><Trash2 className="h-3 w-3" /></button>
                        <button type="button" onClick={() => toggleSection(`form:${section.id}`)} title={collapsed ? "Expandir sección" : "Colapsar sección"} className={`${styles.miniButton} ${collapsed ? styles.collapsedButton : ""}`}><ChevronDown className="h-3.5 w-3.5" /></button>
                      </div>
                    </header>
                    {!collapsed && section.items.length ? (
                      <div className={styles.formGrid}>
                        {section.items.map((item) => {
                          if (item.type === "SPACER") {
                            return (
                              <div key={item.id} className={`${styles.layoutSpacer} ${item.columnSpan === 2 ? styles.fullSpan : ""}`}>
                                <SquareDashed className="h-4 w-4" />
                                <span>Espacio en blanco</span>
                                <span>{item.columnSpan === 2 ? "Ancho completo" : "1 columna"}</span>
                              </div>
                            );
                          }
                          const definition = configuration.availableFields.find((field) => field.sourceType === item.sourceType && field.fieldKey === item.fieldKey);
                          return (
                            <div key={item.id} className={`${styles.layoutField} ${item.columnSpan === 2 ? styles.fullSpan : ""}`}>
                              <div className={styles.layoutFieldTop}><GripVertical className={`${styles.grip} h-3 w-3`} /><div className="min-w-0"><span className={styles.fieldLabel}>{definition?.label || item.label}</span><span className={styles.fieldKey}>{item.sourceType} · {definition?.fieldType || "TEXT"}</span></div></div>
                              <div className={styles.fieldOptions}><span>{item.required ? "Requerido" : "Opcional"}</span><span>{item.editable ? "Editable" : "Lectura"}</span><span>{item.columnSpan === 2 ? "Ancho completo" : "1 columna"}</span></div>
                            </div>
                          );
                        })}
                      </div>
                    ) : !collapsed ? <button type="button" onClick={() => openFormEditor(section.id)} className={styles.emptySection}>Esta sección está vacía. Edita sus campos para agregar contenido.</button> : null}
                  </article>
                );
              })}
              <button type="button" onClick={addFormSection} className={styles.addSectionButton}><Plus className="h-3.5 w-3.5" />Agregar una sección</button>
            </div>
          )}
        </main>
      </section>

      {editorTarget ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setEditorTarget(null)}>
          <section className={styles.editorDialog} role="dialog" aria-modal="true" aria-labelledby="field-editor-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.editorHeader}>
              <div><span className={styles.modalEyebrow}>{editorTarget.view === "SIDEBAR" ? "SIDEBAR DEL DETALLE" : "TAB FORM"}</span><h2 id="field-editor-title">Editar campos · {editorSidebarSection?.name ?? editorFormSection?.name}</h2><p>Agrega, quita y ordena los campos visibles de esta sección.</p></div>
              <button type="button" onClick={() => setEditorTarget(null)} className={styles.closeButton} aria-label="Cerrar editor"><X className="h-4 w-4" /></button>
            </header>
            <div className={styles.editorToolbar}>
              <div className={styles.search}><Search className={styles.searchIcon} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar campo..." className={styles.searchInput} /></div>
              <div className={styles.sourceTabs}>
                {sources.map((source) => <button key={source.key} type="button" onClick={() => setActiveSource(source.key)} className={`${styles.sourceTab} ${source.key === activeSource ? styles.activeSourceTab : ""}`}>{source.label}</button>)}
              </div>
            </div>
            <div className={styles.editorBody}>
              <section className={styles.transferPanel}>
                <div className={styles.transferTitle}><div><span>DISPONIBLES</span><small>{availableForEditor.length} campos</small></div></div>
                <div className={styles.transferList}>
                  {availableForEditor.map((entry) => {
                    if (entry.kind !== "FIELD") {
                      const alreadyVisible = editorVisibleIdentities.has(entry.id);
                      return <article key={entry.id} className={styles.transferRow}><div className="min-w-0"><span className={styles.fieldLabel}>{entry.label}</span><span className={styles.fieldKey}>{alreadyVisible ? "Ya visible" : entry.kind === "SPACER" ? "Agrega separación visual" : "Agrupa campos del formulario"}</span></div><span className={`${styles.sourcePill} ${styles.sourceForm}`}>ESTRUCTURA</span><button type="button" disabled={alreadyVisible} onClick={() => { if (entry.kind === "SECTION") addFormSection(); else if (editorTarget.view === "FORM") addFormSpacer(editorTarget.sectionId); else if (entry.definition) addEditorField(entry.definition); }} className={styles.transferButton} title={alreadyVisible ? "Ya visible en esta sección" : `Agregar ${entry.label}`}>{alreadyVisible ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}</button></article>;
                    }
                    const field = entry.definition;
                    const alreadyVisible = editorVisibleIdentities.has(field.registryId);
                    const sidebarLocations = sections.filter((section) => section.fields.some((item) => identity(item) === field.registryId)).map((section) => section.name);
                    const formLocations = formSections.filter((section) => section.items.some((item) => item.type === "FIELD" && `${item.sourceType}:${item.fieldKey}` === field.registryId)).map((section) => section.name);
                    const sameViewLocation = editorTarget.view === "SIDEBAR" ? sidebarLocations[0] : formLocations[0];
                    const otherViewUsed = editorTarget.view === "SIDEBAR" ? formLocations.length > 0 : sidebarLocations.length > 0;
                    const usageLabel = alreadyVisible
                      ? "Ya visible"
                      : sameViewLocation
                        ? `Usado en ${sameViewLocation}`
                        : otherViewUsed
                          ? `Usado en ${editorTarget.view === "SIDEBAR" ? "Tab Form" : "Sidebar"}`
                          : null;
                    return <article key={field.registryId} className={styles.transferRow}><div className="min-w-0"><span className={styles.fieldLabel}>{field.label}</span><span className={styles.fieldKey}>{field.fieldKey}{usageLabel ? ` · ${usageLabel}` : ""}</span></div><span className={`${styles.sourcePill} ${sourceClass(field.sourceType)}`}>{field.sourceType === "CUSTOMER_PROFILE" ? "CUSTOMER" : field.sourceType}</span><button type="button" disabled={alreadyVisible} onClick={() => addEditorField(field)} className={styles.transferButton} title={alreadyVisible ? "Ya visible en esta sección" : sameViewLocation ? `Mover desde ${sameViewLocation}` : "Agregar campo"}>{alreadyVisible ? <Check className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}</button></article>;
                  })}
                  {availableForEditor.length === 0 ? <p className={styles.emptyTransfer}>No hay campos disponibles para este filtro.</p> : null}
                </div>
              </section>
              <section className={`${styles.transferPanel} ${styles.visiblePanel}`}>
                <div className={styles.transferTitle}><div><span>VISIBLES</span><small>{editorSidebarSection?.fields.length ?? editorFormSection?.items.length ?? 0} elementos</small></div>{editorTarget.view === "FORM" ? <button type="button" onClick={() => addFormSpacer(editorTarget.sectionId)} className={styles.spacerButton}><SquareDashed className="h-3.5 w-3.5" />Espacio en blanco</button> : null}</div>
                <div className={styles.transferList}>
                  {editorSidebarSection?.fields.map((field, index) => {
                    const fieldId = identity(field);
                    return <article key={fieldId} className={styles.visibleRow}><GripVertical className={`${styles.grip} h-3.5 w-3.5`} /><div className="min-w-0"><span className={styles.fieldLabel}>{field.definition.label}</span><span className={styles.fieldKey}>{field.sourceType} · {field.definition.fieldType}</span><div className={styles.editorOptions}><label><input type="checkbox" checked={field.isCopyable} disabled={!field.definition.isCopyable} onChange={(event) => updateSidebarField(editorSidebarSection.sectionKey, fieldId, { isCopyable: event.target.checked })} />Copiable</label><label><input type="checkbox" checked={field.isEditable} disabled={field.sourceType !== "CASE" || !field.definition.isEditable} onChange={(event) => updateSidebarField(editorSidebarSection.sectionKey, fieldId, { isEditable: event.target.checked })} />Editable</label></div></div><div className={styles.visibleActions}><button type="button" disabled={index === 0} onClick={() => moveSidebarField(editorSidebarSection.sectionKey, fieldId, -1)}><ArrowUp className="h-3 w-3" /></button><button type="button" disabled={index === editorSidebarSection.fields.length - 1} onClick={() => moveSidebarField(editorSidebarSection.sectionKey, fieldId, 1)}><ArrowDown className="h-3 w-3" /></button><button type="button" onClick={() => removeSidebarField(editorSidebarSection.sectionKey, fieldId)}><ArrowLeft className="h-3 w-3" /></button></div></article>;
                  })}
                  {editorFormSection?.items.map((item, index) => {
                    const definition = item.type === "FIELD" ? configuration.availableFields.find((field) => field.sourceType === item.sourceType && field.fieldKey === item.fieldKey) : null;
                    return <article key={item.id} className={styles.visibleRow}><GripVertical className={`${styles.grip} h-3.5 w-3.5`} /><div className="min-w-0"><span className={styles.fieldLabel}>{item.type === "SPACER" ? "Espacio en blanco" : definition?.label || item.label}</span><span className={styles.fieldKey}>{item.type === "SPACER" ? "SPACER" : `${item.sourceType} · ${definition?.fieldType || "TEXT"}`}</span><div className={styles.editorOptions}>{item.type === "FIELD" ? <><label title="La capacidad de copiar proviene de la definición del campo"><input type="checkbox" checked={Boolean(definition?.isCopyable)} disabled />Copiable</label><label><input type="checkbox" checked={item.required} disabled={item.sourceType !== "CASE"} onChange={(event) => updateFormItem(editorFormSection.id, item.id, { required: event.target.checked })} />Requerido</label><label><input type="checkbox" checked={item.editable} disabled={item.sourceType !== "CASE" || !definition?.isEditable} onChange={(event) => updateFormItem(editorFormSection.id, item.id, { editable: event.target.checked })} />Editable</label></> : null}<label><input type="checkbox" checked={item.columnSpan === 2} onChange={(event) => updateFormItem(editorFormSection.id, item.id, { columnSpan: event.target.checked ? 2 : 1 })} />Ancho completo</label></div></div><div className={styles.visibleActions}><button type="button" disabled={index === 0} onClick={() => moveFormItem(editorFormSection.id, item.id, -1)}><ArrowUp className="h-3 w-3" /></button><button type="button" disabled={index === editorFormSection.items.length - 1} onClick={() => moveFormItem(editorFormSection.id, item.id, 1)}><ArrowDown className="h-3 w-3" /></button><button type="button" onClick={() => removeFormItem(editorFormSection.id, item.id)}><ArrowLeft className="h-3 w-3" /></button></div></article>;
                  })}
                  {(editorSidebarSection?.fields.length ?? editorFormSection?.items.length ?? 0) === 0 ? <p className={styles.emptyTransfer}>Agrega campos desde la columna Disponibles.</p> : null}
                </div>
              </section>
            </div>
            <footer className={styles.editorFooter}><p>Los cambios se aplicarán al guardar el layout.</p><button type="button" onClick={() => setEditorTarget(null)} className={`${styles.actionButton} ${styles.primaryButton}`}>Listo</button></footer>
          </section>
        </div>
      ) : null}

      {showPreview ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={() => setShowPreview(false)}>
          <section className={styles.previewDialog} role="dialog" aria-modal="true" aria-labelledby="preview-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.editorHeader}><div><span className={styles.modalEyebrow}>VISTA PREVIA</span><h2 id="preview-title">{canvasView === "SIDEBAR" ? "Sidebar del detalle" : "Tab Form"}</h2><p>Representación del layout con los cambios actuales.</p></div><button type="button" onClick={() => setShowPreview(false)} className={styles.closeButton} aria-label="Cerrar vista previa"><X className="h-4 w-4" /></button></header>
            <div className={styles.previewContent}>
              {canvasView === "SIDEBAR" ? sections.map((section) => { const Icon = sectionIcons[section.sectionKey]; return <article key={section.sectionKey} className={styles.previewCard}><h3 className={styles.previewTitle}><span className={styles.previewIcon}><Icon className="h-3 w-3" /></span>{section.name}</h3>{section.fields.map((field) => field.fieldKey === "layout_spacer" ? <span key={identity(field)} className={styles.previewSpacer} /> : <div key={identity(field)} className={styles.previewRow}><span>{field.definition.label}</span><strong>—</strong></div>)}</article>; }) : formSections.map((section) => <article key={section.id} className={styles.previewCard}><h3 className={styles.previewTitle}><span className={styles.previewIcon}><FilePenLine className="h-3 w-3" /></span>{section.name}</h3><div className={styles.previewFormGrid}>{section.items.map((item) => item.type === "SPACER" ? <span key={item.id} className={`${styles.previewSpacer} ${item.columnSpan === 2 ? styles.fullSpan : ""}`} /> : <div key={item.id} className={`${styles.previewFormField} ${item.columnSpan === 2 ? styles.fullSpan : ""}`}><span>{item.label}</span><strong>{item.editable ? "Input" : "Lectura"}</strong></div>)}</div></article>)}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
