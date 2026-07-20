"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Edit3,
  Filter,
  Flag,
  GitMerge,
  Hourglass,
  List,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  UserCog,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildCaseViewModel,
  mandatoryCaseViewColumns,
  normalizeCaseViewColumns,
  type CaseViewColumnKey,
  type CaseViewData,
  type CaseViewMetricKey,
  type CaseViewRow,
} from "@/lib/case-view-service";
import {
  getCaseResponseLabel,
  type CaseResponseStatus,
} from "@/lib/case-response-status-service";
import {
  createCaseView,
  emptyCaseViewFilters,
  getCaseViews,
  updateCaseView,
  type CaseSavedView,
  type CaseSavedViewFilters,
} from "@/lib/case-views-storage-service";
import { updateCasesBulk } from "@/lib/case-bulk-edit-service";
import { mergeCases } from "@/lib/case-merge-service";
import { changeCasesOwner } from "@/lib/case-owner-service";
import { getAssignableUsers, type AssignableUser } from "@/lib/users-service";
import { getCaseMetadata, type CaseMetadata } from "@/lib/case-metadata-service";
import {
  caseFieldDefinitions,
  formatCaseStatusForView,
  getEditableFieldByColumn,
  normalizeCaseStatusForStorage,
  type CaseEditableFieldKey,
  type CaseFieldDefinition,
} from "@/lib/case-field-definitions";

type CasesListViewProps = {
  data: CaseViewData | null;
};

type ModalMode = "create" | "edit";
type OperationModal = "merge" | "owner" | null;
type CaseFieldChanges = Partial<
  Record<CaseEditableFieldKey, string | boolean | null>
>;
type EditDrafts = Record<string, CaseFieldChanges>;

type CaseViewDraft = {
  name: string;
  description: string;
  privacy: CaseSavedView["privacy"];
  editableByOthers: CaseSavedView["editableByOthers"];
  visibleColumns: CaseViewColumnKey[];
  filters: CaseSavedViewFilters;
  sorting: CaseSavedView["sorting"];
  useAsDefault: boolean;
};

const sortingLabels: Record<CaseSavedView["sorting"], string> = {
  updated_desc: "Actualización descendente",
  updated_asc: "Actualización ascendente",
  number_desc: "Número descendente",
  number_asc: "Número ascendente",
};

const metricIcons: Record<
  CaseViewMetricKey,
  { icon: ReactNode; className: string }
> = {
  total: {
    icon: <BarChart3 className="h-3.5 w-3.5" />,
    className: "bg-[#EAF1FF] text-[#205EEF]",
  },
  pending: {
    icon: <Clock3 className="h-3.5 w-3.5" />,
    className: "bg-[#FFF6DD] text-[#B77900]",
  },
  waiting: {
    icon: <Hourglass className="h-3.5 w-3.5" />,
    className: "bg-[#F4E8FF] text-[#8A3FFC]",
  },
  risk: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    className: "bg-[#FDECEC] text-[#DC2626]",
  },
  edge: {
    icon: <Flag className="h-3.5 w-3.5" />,
    className: "bg-[#FFF1E5] text-[#F97316]",
  },
  standBy: {
    icon: <PauseCircle className="h-3.5 w-3.5" />,
    className: "bg-[#EEF1F6] text-[#64748B]",
  },
  resolved: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: "bg-[#D9F6E8] text-[#0E9F6E]",
  },
};

function buildDraft({
  columns,
  currentFilters,
  visibleColumns,
  sorting,
  view,
}: {
  columns: CaseViewData["columns"];
  currentFilters: CaseSavedViewFilters;
  visibleColumns: CaseViewColumnKey[];
  sorting: CaseSavedView["sorting"];
  view?: CaseSavedView | null;
}): CaseViewDraft {
  return {
    name: view?.name ?? "Nueva vista de casos",
    description: view?.description ?? "",
    privacy: view?.privacy ?? "Privada",
    editableByOthers: view?.editableByOthers ?? "No",
    visibleColumns: normalizeCaseViewColumns(
      view?.visibleColumns.length
        ? view.visibleColumns
        : visibleColumns.length
          ? visibleColumns
          : columns.map((column) => column.key),
    ),
    filters: view?.filters ?? currentFilters,
    sorting: view?.sorting ?? sorting,
    useAsDefault: view?.useAsDefault ?? false,
  };
}

function responseBadgeClass(status: CaseResponseStatus) {
  if (status === "NO_AGENT_ACTIVITY") return "bg-[#FEF6E0] text-[#B45309]";
  if (status === "NO_CUSTOMER_ACTIVITY_24H") return "bg-[#FFF1E5] text-[#C2410C]";
  if (status === "WAITING_AGENT_RESPONSE") return "bg-[#FDECEC] text-[#DC2626]";
  return "bg-[#D9F6E8] text-[#0E9F6E]";
}

function getCellValue(row: CaseViewRow, column: CaseViewColumnKey) {
  const values: Record<CaseViewColumnKey, string> = {
    number: row.number,
    email: row.email,
    contactType: row.contactType,
    response: getCaseResponseLabel(row.responseStatus),
    catPrincipal: row.catPrincipal,
    catSecondary: row.catSecondary,
    catExtra: row.catExtra,
    status: row.statusLabel,
    containmentContext: row.containmentContext,
    owner: row.ownerName,
    priority: row.priority,
    isEdgeCase: row.isEdgeCase ? "Sí" : "No",
    channel: row.channel,
    product: row.product,
    subproduct: row.subproduct,
  };

  return values[column];
}

function getRowEditableValue(row: CaseViewRow, field: CaseEditableFieldKey) {
  if (field === "responseStatus") return row.responseStatus;
  if (field === "ownerId") return row.ownerId ?? "";

  return row[field];
}

function getDraftValue(
  row: CaseViewRow,
  changes: CaseFieldChanges | undefined,
  field: CaseEditableFieldKey,
) {
  const value = changes?.[field] ?? getRowEditableValue(row, field);

  return typeof value === "boolean" ? value : String(value ?? "");
}

function uniqueOptions(rows: CaseViewRow[], getter: (row: CaseViewRow) => string) {
  return Array.from(new Set(rows.map(getter).filter(Boolean))).sort();
}

function formatShowingCount(count: number, total: number) {
  if (count === 0) return "Mostrando 0 casos";

  return `Mostrando 1 a ${count.toLocaleString("es-CL")} de ${total.toLocaleString("es-CL")} casos`;
}

function ToolbarButton({
  children,
  variant = "secondary",
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        variant === "primary"
          ? "inline-flex h-9 items-center gap-2 rounded-[9px] bg-[#205EEF] px-4 text-xs font-bold text-white shadow-[0_12px_22px_rgba(32,94,239,.22)] hover:bg-[#1548c7] disabled:cursor-not-allowed disabled:opacity-45"
          : "inline-flex h-9 items-center gap-2 rounded-[9px] border border-[#D6E0F5] bg-white px-3.5 text-xs font-bold text-[#205EEF] shadow-[0_1px_2px_rgba(15,23,42,.04)] hover:bg-[#F5F8FF] disabled:cursor-not-allowed disabled:opacity-45"
      }
    >
      {children}
    </button>
  );
}

function ViewConfigModal({
  columns,
  draft,
  mode,
  options,
  setDraft,
  onClose,
  onSave,
}: {
  columns: CaseViewData["columns"];
  draft: CaseViewDraft;
  mode: ModalMode;
  options: FilterOptions;
  setDraft: (draft: CaseViewDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const title = "Seleccionar los campos que se visualizarán";
  const modeLabel = mode === "create" ? "Crear Vista" : "Editar Vista";
  const actionLabel = mode === "create" ? "Crear vista" : "Guardar cambios";

  function addColumn(column: CaseViewColumnKey) {
    setDraft({
      ...draft,
      visibleColumns: normalizeCaseViewColumns([...draft.visibleColumns, column]),
    });
  }

  function removeColumn(column: CaseViewColumnKey) {
    if (mandatoryCaseViewColumns.includes(column)) return;
    setDraft({
      ...draft,
      visibleColumns: draft.visibleColumns.filter((item) => item !== column),
    });
  }

  function moveColumn(column: CaseViewColumnKey, direction: -1 | 1) {
    const currentIndex = draft.visibleColumns.indexOf(column);
    const nextIndex = currentIndex + direction;
    if (
      currentIndex < mandatoryCaseViewColumns.length ||
      nextIndex < mandatoryCaseViewColumns.length ||
      nextIndex >= draft.visibleColumns.length
    ) return;

    const visibleColumns = [...draft.visibleColumns];
    [visibleColumns[currentIndex], visibleColumns[nextIndex]] = [
      visibleColumns[nextIndex],
      visibleColumns[currentIndex],
    ];
    setDraft({ ...draft, visibleColumns });
  }

  function updateFilter(key: keyof CaseSavedViewFilters, value: string) {
    setDraft({ ...draft, filters: { ...draft.filters, [key]: value } });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6">
      <section className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-[#E4E9F0] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#EEF1F6] px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">{title}</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {modeLabel} · Configura filtros, privacidad y columnas de la vista guardada.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#E4E9F0] p-1.5 text-slate-500 hover:bg-slate-50"
            aria-label={`Cerrar ${title}`}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="grid max-h-[68vh] gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">
            Nombre de la vista
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="h-10 rounded-lg border border-[#DDE5F1] px-3 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-[#205EEF] focus:ring-2 focus:ring-blue-100"
              placeholder="Ej: Casos resueltos"
            />
          </label>
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">
            Privacidad
            <select
              value={draft.privacy}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  privacy: event.target.value as CaseViewDraft["privacy"],
                })
              }
              className="h-10 rounded-lg border border-[#DDE5F1] px-3 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-[#205EEF]"
            >
              <option>Privada</option>
              <option>Equipo</option>
              <option>Pública</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-slate-500 md:col-span-2">
            Descripción opcional
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              className="min-h-20 rounded-lg border border-[#DDE5F1] px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-800 outline-none focus:border-[#205EEF] focus:ring-2 focus:ring-blue-100"
              placeholder="Describe para qué sirve esta vista."
            />
          </label>
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">
            Modificable por terceros
            <select
              value={draft.editableByOthers}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  editableByOthers:
                    event.target.value as CaseViewDraft["editableByOthers"],
                })
              }
              className="h-10 rounded-lg border border-[#DDE5F1] px-3 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-[#205EEF]"
            >
              <option>Sí</option>
              <option>No</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">
            Ordenamiento
            <select
              value={draft.sorting}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  sorting: event.target.value as CaseViewDraft["sorting"],
                })
              }
              className="h-10 rounded-lg border border-[#DDE5F1] px-3 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-[#205EEF]"
            >
              {Object.entries(sortingLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="grid gap-3 rounded-xl border border-[#E4E9F0] p-3 md:col-span-2">
            <legend className="px-1 text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">
              Filtros de la vista
            </legend>
            <div className="grid gap-2 md:grid-cols-4">
              <ModalFilter label="Canal" value={draft.filters.channel} options={options.channel} onChange={(value) => updateFilter("channel", value)} />
              <ModalFilter label="Tipo de Contacto" value={draft.filters.contactType} options={options.contactType} onChange={(value) => updateFilter("contactType", value)} />
              <ModalFilter label="Producto" value={draft.filters.product} options={options.product} onChange={(value) => updateFilter("product", value)} />
              <ModalFilter label="Subproducto" value={draft.filters.subproduct} options={options.subproduct} onChange={(value) => updateFilter("subproduct", value)} />
              <ModalFilter label="CAT Principal" value={draft.filters.catPrincipal} options={options.catPrincipal} onChange={(value) => updateFilter("catPrincipal", value)} />
              <ModalFilter label="CAT Secundaria" value={draft.filters.catSecondary} options={options.catSecondary} onChange={(value) => updateFilter("catSecondary", value)} />
              <ModalFilter label="CAT Extra" value={draft.filters.catExtra} options={options.catExtra} onChange={(value) => updateFilter("catExtra", value)} />
              <ModalFilter label="Estado" value={draft.filters.status} options={options.status} onChange={(value) => updateFilter("status", value)} />
            </div>
          </fieldset>
          <fieldset className="grid gap-3 rounded-xl border border-[#E4E9F0] p-3 md:col-span-2">
            <legend className="px-1 text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">
              Columnas de la vista
            </legend>
            <p className="text-xs font-medium text-slate-500">
              Número Caso, Correo y Respuesta son obligatorias. Agrega, quita y ordena las demás columnas.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">Disponibles</p>
                <div className="min-h-52 space-y-1.5 rounded-lg border border-[#DDE5F1] bg-[#FBFCFE] p-2">
                  {columns.filter((column) => !draft.visibleColumns.includes(column.key)).map((column) => (
                    <button key={column.key} type="button" onClick={() => addColumn(column.key)} className="flex w-full items-center justify-between rounded-md border border-[#EEF1F6] bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-[#BFD0F5] hover:text-[#205EEF]">
                      {column.label}<ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">Visibles</p>
                <div className="min-h-52 space-y-1.5 rounded-lg border border-[#BFD0F5] bg-[#F5F8FF] p-2">
                  {draft.visibleColumns.map((columnKey, index) => {
                    const column = columns.find((item) => item.key === columnKey);
                    if (!column) return null;
                    const mandatory = mandatoryCaseViewColumns.includes(columnKey);
                    return (
                      <div key={columnKey} className="flex items-center gap-1 rounded-md border border-[#D6E0F5] bg-white px-2 py-1.5 text-xs font-semibold text-slate-700">
                        <span className="w-5 text-[10px] font-black text-slate-400">{index + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{column.label}</span>
                        {mandatory ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-500">Fija</span>
                        ) : (
                          <>
                            <button type="button" onClick={() => moveColumn(columnKey, -1)} disabled={index === mandatoryCaseViewColumns.length} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-25" aria-label={`Subir ${column.label}`}><ChevronUp className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => moveColumn(columnKey, 1)} disabled={index === draft.visibleColumns.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-25" aria-label={`Bajar ${column.label}`}><ChevronDown className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => removeColumn(columnKey)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Quitar ${column.label}`}><ArrowLeft className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={draft.useAsDefault}
              onChange={(event) =>
                setDraft({ ...draft, useAsDefault: event.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 accent-[#205EEF]"
            />
            Usar como vista por defecto
          </label>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-[#EEF1F6] bg-[#FBFCFE] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#DDE5F1] bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="h-9 rounded-lg bg-[#205EEF] px-4 text-xs font-bold text-white shadow-[0_10px_20px_rgba(32,94,239,.2)] hover:bg-[#1548c7]"
          >
            {actionLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

function MergeCasesModal({
  selectedCases,
  metadata,
  onClose,
  onMerge,
}: {
  selectedCases: CaseViewRow[];
  metadata: CaseMetadata;
  onClose: () => void;
  onMerge: (input: {
    masterCaseId: string;
    fieldResolution: CaseFieldChanges;
  }) => void;
}) {
  const [masterCaseId, setMasterCaseId] = useState(selectedCases[0]?.id ?? "");
  const fieldKeys: Array<{
    key: CaseEditableFieldKey;
    label: string;
    getValue: (row: CaseViewRow) => string | boolean | null;
  }> = [
    { key: "contactType", label: "Tipo de contacto", getValue: (row) => row.contactType },
    { key: "catPrincipal", label: "CAT Principal", getValue: (row) => row.catPrincipal },
    { key: "catSecondary", label: "CAT Secundaria", getValue: (row) => row.catSecondary },
    { key: "catExtra", label: "CAT Extra", getValue: (row) => row.catExtra },
    { key: "status", label: "Estado", getValue: (row) => row.status },
    { key: "containmentContext", label: "Contexto Contención", getValue: (row) => row.containmentContext },
    { key: "ownerId", label: "Owner", getValue: (row) => row.ownerId ?? "" },
    { key: "product", label: "Producto", getValue: (row) => row.product },
    { key: "subproduct", label: "Subproducto", getValue: (row) => row.subproduct },
    { key: "priority", label: "Prioridad", getValue: (row) => row.priority },
  ];
  const [fieldResolution, setFieldResolution] = useState<CaseFieldChanges>(() => {
    const master = selectedCases[0];

    if (!master) return {};

    return fieldKeys.reduce<CaseFieldChanges>((values, field) => {
      values[field.key] = field.getValue(master);
      return values;
    }, {});
  });

  function setResolvedValue(field: CaseEditableFieldKey, value: string | boolean) {
    setFieldResolution((current) => ({ ...current, [field]: value }));
  }

  function confirmMerge() {
    const shouldMerge = window.confirm(
      "Esta acción fusionará los casos seleccionados y ocultará los casos secundarios de la vista normal. ¿Quieres continuar?",
    );

    if (!shouldMerge) return;

    onMerge({ masterCaseId, fieldResolution });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6">
      <section className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-[#E4E9F0] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#EEF1F6] px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Fusionar casos</h2>
            <p className="mt-1 text-xs font-bold text-amber-700">
              Esta acción combinará los casos seleccionados y dejará un caso principal.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#E4E9F0] p-1.5 text-slate-500 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="overflow-x-auto rounded-xl border border-[#E6EBF3]">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-[#FBFCFE] text-[10px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Principal</th>
                  <th className="px-3 py-2">Número</th>
                  <th className="px-3 py-2">Correo</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Tipo contacto</th>
                  <th className="px-3 py-2">Categoría</th>
                </tr>
              </thead>
              <tbody>
                {selectedCases.map((caseItem) => (
                  <tr key={caseItem.id} className="border-t border-[#F1F4F8]">
                    <td className="px-3 py-2">
                      <input
                        type="radio"
                        checked={masterCaseId === caseItem.id}
                        onChange={() => setMasterCaseId(caseItem.id)}
                        className="accent-[#205EEF]"
                      />
                    </td>
                    <td className="px-3 py-2 font-black text-[#205EEF]">{caseItem.number.replace("Caso ", "")}</td>
                    <td className="px-3 py-2">{caseItem.email}</td>
                    <td className="px-3 py-2">{caseItem.statusLabel}</td>
                    <td className="px-3 py-2">{caseItem.ownerName}</td>
                    <td className="px-3 py-2">{caseItem.contactType}</td>
                    <td className="px-3 py-2">{caseItem.catPrincipal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {fieldKeys.map((field) => (
              <label key={field.key} className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Conservar {metadata.fields[field.key]?.label ?? field.label}
                <select
                  value={String(fieldResolution[field.key] ?? "")}
                  onChange={(event) => setResolvedValue(field.key, event.target.value)}
                  className="h-9 rounded-lg border border-[#DDE5F1] bg-white px-2 text-xs font-semibold normal-case tracking-normal text-slate-700 outline-none focus:border-[#205EEF]"
                >
                  {selectedCases.map((caseItem) => {
                    const value = field.getValue(caseItem);
                    const label =
                      field.key === "ownerId"
                        ? caseItem.ownerName
                        : String(value ?? "Sin valor");

                    return (
                      <option key={`${field.key}-${caseItem.id}`} value={String(value ?? "")}>
                        {caseItem.number.replace("Caso ", "")} · {label}
                      </option>
                    );
                  })}
                </select>
              </label>
            ))}
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#EEF1F6] bg-[#FBFCFE] px-5 py-4">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#DDE5F1] bg-white px-4 text-xs font-bold text-slate-600">
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmMerge}
            className="h-9 rounded-lg bg-[#205EEF] px-4 text-xs font-bold text-white shadow-[0_10px_20px_rgba(32,94,239,.2)]"
          >
            Fusionar casos
          </button>
        </footer>
      </section>
    </div>
  );
}

function ChangeOwnerModal({
  selectedCases,
  users,
  onClose,
  onChangeOwner,
}: {
  selectedCases: CaseViewRow[];
  users: AssignableUser[];
  onClose: () => void;
  onChangeOwner: (ownerId: string, notifyOwner: boolean) => void;
}) {
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? "");
  const [notifyOwner, setNotifyOwner] = useState(false);
  const selectedOwnerId = ownerId || users[0]?.id || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6">
      <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E4E9F0] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#EEF1F6] px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Cambiar owner</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {selectedCases.length} caso(s) seleccionados
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#E4E9F0] p-1.5 text-slate-500 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="grid gap-4 p-5">
          <div className="rounded-xl border border-[#E6EBF3] bg-[#FBFCFE] p-3 text-xs font-semibold text-slate-600">
            {selectedCases.slice(0, 6).map((caseItem) => (
              <span key={caseItem.id} className="mr-2 inline-flex rounded-full bg-white px-2 py-1 text-[#205EEF]">
                {caseItem.number.replace("Caso ", "")}
              </span>
            ))}
            {selectedCases.length > 6 ? <span>+{selectedCases.length - 6} más</span> : null}
          </div>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Usuario asignable
            <select
              value={selectedOwnerId}
              onChange={(event) => setOwnerId(event.target.value)}
              className="h-10 rounded-lg border border-[#DDE5F1] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none focus:border-[#205EEF]"
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.email} · {user.role}/{user.team}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-[#E6EBF3] bg-[#FBFCFE] px-3 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={notifyOwner}
              onChange={(event) => setNotifyOwner(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-[#205EEF]"
            />
            Notificar al nuevo owner
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#EEF1F6] bg-[#FBFCFE] px-5 py-4">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#DDE5F1] bg-white px-4 text-xs font-bold text-slate-600">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedOwnerId}
            onClick={() => onChangeOwner(selectedOwnerId, notifyOwner)}
            className="h-9 rounded-lg bg-[#205EEF] px-4 text-xs font-bold text-white disabled:opacity-45"
          >
            Cambiar owner
          </button>
        </footer>
      </section>
    </div>
  );
}

type FilterOptions = {
  channel: string[];
  contactType: string[];
  product: string[];
  subproduct: string[];
  catPrincipal: string[];
  catSecondary: string[];
  catExtra: string[];
  status: string[];
};

export function CasesListView({ data }: CasesListViewProps) {
  const router = useRouter();
  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const columns = useMemo(() => data?.columns ?? [], [data?.columns]);
  const [activeMetric, setActiveMetric] = useState<CaseViewMetricKey>("total");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(100);
  const [filters, setFilters] = useState<CaseSavedViewFilters>(emptyCaseViewFilters);
  const [sorting, setSorting] = useState<CaseSavedView["sorting"]>("updated_desc");
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<CaseViewColumnKey[]>(
    () => normalizeCaseViewColumns(columns.map((column) => column.key)),
  );
  const [savedViews, setSavedViews] = useState<CaseSavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [isViewListOpen, setIsViewListOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [operationModal, setOperationModal] = useState<OperationModal>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [operationStatus, setOperationStatus] = useState("");
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editDrafts, setEditDrafts] = useState<EditDrafts>({});
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [metadata, setMetadata] = useState<CaseMetadata>({
    fields: caseFieldDefinitions,
  });
  const [draft, setDraft] = useState<CaseViewDraft>(() =>
    buildDraft({
      columns,
      currentFilters: emptyCaseViewFilters,
      visibleColumns: columns.map((column) => column.key),
      sorting: "updated_desc",
    }),
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void getCaseViews()
        .then((views) => {
          const defaultView = views.find((view) => view.useAsDefault) ?? null;

          setSavedViews(views);
          if (!defaultView) return;

          setActiveViewId(defaultView.id);
          setFilters(defaultView.filters);
          setSorting(defaultView.sorting);
          setVisibleColumnKeys(normalizeCaseViewColumns(defaultView.visibleColumns));
          setDraft(
            buildDraft({
              columns,
              currentFilters: defaultView.filters,
              visibleColumns: defaultView.visibleColumns,
              sorting: defaultView.sorting,
              view: defaultView,
            }),
          );
        })
        .catch((error) =>
          showStatus(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las vistas.",
          ),
        );
      void getAssignableUsers().then(setAssignableUsers);
      void getCaseMetadata().then(setMetadata);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [columns]);

  const activeView = savedViews.find((view) => view.id === activeViewId) ?? null;
  const currentViewName = activeView?.name ?? "Vista de Casos";

  const options: FilterOptions = useMemo(
    () => ({
      channel: uniqueOptions(rows, (row) => row.channel),
      contactType: uniqueOptions(rows, (row) => row.contactType),
      product: uniqueOptions(rows, (row) => row.product),
      subproduct: uniqueOptions(rows, (row) => row.subproduct),
      catPrincipal: uniqueOptions(rows, (row) => row.catPrincipal),
      catSecondary: uniqueOptions(rows, (row) => row.catSecondary),
      catExtra: uniqueOptions(rows, (row) => row.catExtra),
      status: uniqueOptions(rows, (row) => row.statusLabel),
    }),
    [rows],
  );

  const viewModel = useMemo(
    () =>
      buildCaseViewModel({
        allCases: rows,
        activeFilters: filters,
        searchTerm: search,
        activeKpiFilter: activeMetric,
        sorting,
        pageSize,
      }),
    [activeMetric, filters, pageSize, rows, search, sorting],
  );
  const metrics = viewModel.metrics;
  const visibleRows = viewModel.paginatedCases;
  const visibleColumns = visibleColumnKeys
    .map((key) => columns.find((column) => column.key === key))
    .filter((column): column is CaseViewData["columns"][number] => Boolean(column));
  const selectedRows = rows.filter((row) => selectedCaseIds.has(row.id));
  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((row) => selectedCaseIds.has(row.id));

  function showStatus(message: string) {
    setSaveStatus(message);
    window.setTimeout(() => setSaveStatus(""), 2200);
  }

  function showOperationStatus(message: string) {
    setOperationStatus(message);
    window.setTimeout(() => setOperationStatus(""), 2600);
  }

  function refreshOperations() {
    router.refresh();
  }

  function toggleCaseSelection(caseId: string) {
    setSelectedCaseIds((current) => {
      const next = new Set(current);

      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }

      return next;
    });
  }

  function toggleVisibleSelection() {
    setSelectedCaseIds((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        visibleRows.forEach((row) => next.delete(row.id));
      } else {
        visibleRows.forEach((row) => next.add(row.id));
      }

      return next;
    });
  }

  function updateEditDraft(
    caseId: string,
    field: CaseEditableFieldKey,
    value: string | boolean,
  ) {
    setEditDrafts((current) => {
      const nextValue =
        field === "status"
          ? {
              status: normalizeCaseStatusForStorage(String(value)),
            }
          : { [field]: value };

      return {
        ...current,
        [caseId]: {
          ...(current[caseId] ?? {}),
          ...nextValue,
        },
      };
    });
  }

  async function saveInlineChanges() {
    const updates = Object.entries(editDrafts).filter(
      ([, changes]) => Object.keys(changes).length > 0,
    );

    if (updates.length === 0) {
      setIsInlineEditing(false);
      return;
    }

    setOperationStatus("Guardando cambios...");
    try {
      await updateCasesBulk(
        updates.map(([caseId, fieldChanges]) => ({ caseId, fieldChanges })),
      );
      setEditDrafts({});
      setIsInlineEditing(false);
      refreshOperations();
      showOperationStatus("Cambios guardados correctamente");
    } catch (error) {
      showOperationStatus(
        error instanceof Error ? error.message : "Error al guardar cambios.",
      );
    }
  }

  function cancelInlineChanges() {
    setEditDrafts({});
    setIsInlineEditing(false);
  }

  async function executeMerge(input: {
    masterCaseId: string;
    fieldResolution: CaseFieldChanges;
  }) {
    setOperationStatus("Fusionando casos...");
    try {
      await mergeCases({
        masterCaseId: input.masterCaseId,
        mergedCaseIds: selectedRows.map((row) => row.id),
        selectedCases: selectedRows,
        fieldResolution: input.fieldResolution,
        performedBy: "Usuario demo",
      });
      setSelectedCaseIds(new Set());
      setOperationModal(null);
      refreshOperations();
      showOperationStatus("Casos fusionados correctamente");
    } catch (error) {
      showOperationStatus(
        error instanceof Error ? error.message : "Error al fusionar casos.",
      );
    }
  }

  async function executeOwnerChange(ownerId: string, notifyOwner: boolean) {
    setOperationStatus("Cambiando owner...");
    try {
      const result = await changeCasesOwner({
        caseIds: selectedRows.map((row) => row.id),
        newOwnerId: ownerId,
        notifyOwner,
      });
      setSelectedCaseIds(new Set());
      setOperationModal(null);
      refreshOperations();
      if (result.notificationStatus === "failed") {
        showOperationStatus(
          "Owner actualizado, pero no se pudo crear la notificación.",
        );
      } else if (result.notificationStatus === "sent") {
        showOperationStatus("Owner actualizado y notificación enviada.");
      } else {
        showOperationStatus("Owner actualizado.");
      }
    } catch (error) {
      showOperationStatus(
        error instanceof Error ? error.message : "Error al cambiar owner.",
      );
    }
  }

  function getPicklistOptions(definition: CaseFieldDefinition) {
    const dynamicOptions: string[] =
      definition.key === "channel"
        ? options.channel
        : definition.key === "contactType"
          ? options.contactType
          : definition.key === "product"
            ? options.product
            : definition.key === "subproduct"
              ? options.subproduct
              : definition.key === "catPrincipal"
                ? options.catPrincipal
                : definition.key === "catSecondary"
                  ? options.catSecondary
                  : definition.key === "catExtra"
                    ? options.catExtra
                    : definition.key === "status"
                      ? options.status
                      : definition.key === "responseStatus"
                        ? definition.options ?? []
                      : definition.key === "priority"
                        ? uniqueOptions(rows, (row) => row.priority)
                        : [];

    return Array.from(
      new Set([...(definition.options ?? []), ...dynamicOptions].filter(Boolean)),
    );
  }

  function renderCaseCell(
    row: CaseViewRow,
    column: CaseViewData["columns"][number],
  ) {
    if (column.key === "number") {
      return (
        <Link
          href={`/casos/${row.id}`}
          className="font-black text-[#205EEF] hover:underline"
        >
          {row.number.replace("Caso ", "")}
        </Link>
      );
    }

    if (column.key === "response") {
      return (
        <span
          className={`inline-flex rounded-md px-2.5 py-1 text-[10.5px] font-bold ${responseBadgeClass(row.responseStatus)}`}
        >
          {getCaseResponseLabel(row.responseStatus)}
        </span>
      );
    }

    const editableField = getEditableFieldByColumn(column.key);

    if (!isInlineEditing || !editableField) {
      return getCellValue(row, column.key);
    }

    const fieldDefinition = metadata.fields[editableField.key] ?? editableField;

    if (fieldDefinition.type === "picklist") {
      const currentValue = getDraftValue(row, editDrafts[row.id], editableField.key);
      const selectValue =
        editableField.key === "status"
          ? formatCaseStatusForView(String(currentValue))
          : String(currentValue);

      return (
        <select
          value={selectValue}
          onChange={(event) =>
            updateEditDraft(row.id, editableField.key, event.target.value)
          }
          className="h-8 w-full min-w-[120px] rounded-lg border border-[#D6E0F5] bg-white px-2 text-xs font-bold text-slate-700 outline-none"
        >
          {getPicklistOptions(fieldDefinition).map((option) => (
            <option key={option} value={option}>
              {editableField.key === "responseStatus"
                ? getCaseResponseLabel(option as CaseResponseStatus)
                : option}
            </option>
          ))}
        </select>
      );
    }

    if (fieldDefinition.type === "user") {
      return (
        <select
          value={String(getDraftValue(row, editDrafts[row.id], editableField.key))}
          onChange={(event) =>
            updateEditDraft(row.id, editableField.key, event.target.value)
          }
          className="h-8 w-full min-w-[150px] rounded-lg border border-[#D6E0F5] bg-white px-2 text-xs font-bold text-slate-700 outline-none"
        >
          <option value="">Sin owner</option>
          {assignableUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      );
    }

    if (fieldDefinition.type === "boolean") {
      return (
        <input
          type="checkbox"
          checked={Boolean(getDraftValue(row, editDrafts[row.id], editableField.key))}
          onChange={(event) =>
            updateEditDraft(row.id, editableField.key, event.target.checked)
          }
          aria-label={`Editar caso borde ${row.number}`}
          className="h-4 w-4 rounded border-[#CBD5E1] text-[#205EEF]"
        />
      );
    }

    return (
      <input
        value={String(getDraftValue(row, editDrafts[row.id], editableField.key) ?? "")}
        onChange={(event) =>
          updateEditDraft(row.id, editableField.key, event.target.value)
        }
        className="h-8 w-full min-w-[120px] rounded-lg border border-[#D6E0F5] bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
      />
    );
  }

  function applyView(view: CaseSavedView, sourceViews = savedViews) {
    setActiveViewId(view.id);
    setFilters(view.filters);
    setSorting(view.sorting);
    setVisibleColumnKeys(normalizeCaseViewColumns(view.visibleColumns));
    setDraft(
      buildDraft({
        columns,
        currentFilters: view.filters,
        visibleColumns: view.visibleColumns,
        sorting: view.sorting,
        view,
      }),
    );
    setSavedViews(sourceViews);
    setIsViewListOpen(false);
    setActiveMetric("total");
  }

  function resetView() {
    setSearch("");
    setActiveMetric("total");
    setFilters(emptyCaseViewFilters);
    setSorting("updated_desc");
    setVisibleColumnKeys(normalizeCaseViewColumns(columns.map((column) => column.key)));
    setActiveViewId(null);
    setIsViewListOpen(false);
    setSelectedCaseIds(new Set());
    setEditDrafts({});
    setIsInlineEditing(false);
    router.refresh();
  }

  function openModal(mode: ModalMode) {
    setDraft(
      buildDraft({
        columns,
        currentFilters: filters,
        visibleColumns: visibleColumnKeys,
        sorting,
        view: mode === "create" ? null : activeView,
      }),
    );
    setModalMode(mode);
  }

  async function reloadCaseViews(preferredView?: CaseSavedView) {
    const views = await getCaseViews();
    const viewToApply =
      preferredView && views.some((view) => view.id === preferredView.id)
        ? views.find((view) => view.id === preferredView.id)
        : views.find((view) => view.id === activeViewId) ??
          views.find((view) => view.useAsDefault) ??
          null;

    setSavedViews(views);
    if (viewToApply) applyView(viewToApply, views);

    return views;
  }

  async function saveModalDraft() {
    try {
      if (modalMode === "create" || !activeViewId) {
        const created = await createCaseView({
          ...draft,
          name: draft.name.trim() || "Vista sin nombre",
        });

        await reloadCaseViews(created);
        setModalMode(null);
        showStatus("Vista creada y guardada");
        return;
      }

      if (activeView && !activeView.canEdit) {
        showStatus("Esta vista es de solo lectura para tu usuario.");
        return;
      }

      const updated = await updateCaseView(activeViewId, {
        ...draft,
        name: draft.name.trim() || "Vista sin nombre",
      });

      await reloadCaseViews(updated);
      setModalMode(null);
      showStatus("Vista actualizada");
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : "No se pudo guardar la vista.",
      );
    }
  }

  async function saveCurrentView() {
    try {
      if (activeViewId) {
        if (activeView && !activeView.canEdit) {
          showStatus("Esta vista es de solo lectura para tu usuario.");
          return;
        }

        const updated = await updateCaseView(activeViewId, {
          filters,
          sorting,
          visibleColumns: visibleColumnKeys,
        });

        await reloadCaseViews(updated);
        showStatus("Vista actual guardada");
        return;
      }

      const created = await createCaseView({
        name: "Vista de Casos personalizada",
        description: "Vista creada desde Guardar Vista.",
        privacy: "Privada",
        editableByOthers: "No",
        visibleColumns: visibleColumnKeys,
        filters,
        sorting,
        useAsDefault: false,
      });

      await reloadCaseViews(created);
      showStatus("Vista creada y guardada");
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : "No se pudo guardar la vista.",
      );
    }
  }

  function updateFilter(key: keyof CaseSavedViewFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const isActiveViewReadOnly = Boolean(activeView && !activeView.canEdit);

  return (
    <section className="min-h-full bg-[#F4F6FA] px-5 py-5 text-slate-800 lg:px-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-3 py-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[31px] font-black leading-tight tracking-[-.035em] text-[#08111F]">
                {currentViewName}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToolbarButton onClick={() => openModal("create")}>
                <Plus className="h-3.5 w-3.5" />
                Crear Vista
              </ToolbarButton>
              <ToolbarButton
                disabled={isActiveViewReadOnly}
                onClick={() => openModal("edit")}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar Vista
              </ToolbarButton>
              <ToolbarButton disabled={isActiveViewReadOnly} onClick={saveCurrentView}>
                <Bookmark className="h-3.5 w-3.5" />
                Guardar Vista
              </ToolbarButton>
              <Link
                href="/casos/nuevo"
                className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-[#205EEF] px-4 text-xs font-bold text-white shadow-[0_12px_22px_rgba(32,94,239,.24)] hover:bg-[#1548c7]"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear Caso
              </Link>
            </div>
          </div>
        </header>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsViewListOpen((current) => !current)}
              className="inline-flex h-9 items-center gap-2 rounded-[9px] bg-[#205EEF] px-4 text-xs font-bold text-white shadow-[0_8px_18px_rgba(32,94,239,.18)] hover:bg-[#1548c7]"
            >
              <List className="h-3.5 w-3.5" />
              Lista de Vistas
            </button>
            {isViewListOpen ? (
              <div className="absolute left-0 top-12 z-30 w-72 overflow-hidden rounded-xl border border-[#E4E9F0] bg-white shadow-xl">
                <button
                  type="button"
                  onClick={resetView}
                  className="block w-full px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-[#F5F8FF]"
                >
                  Vista de Casos estándar
                </button>
                {savedViews.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => applyView(view)}
                    className={`block w-full px-4 py-3 text-left text-xs font-bold hover:bg-[#F5F8FF] ${
                      activeViewId === view.id
                        ? "bg-[#F5F8FF] text-[#205EEF]"
                        : "text-slate-700"
                    }`}
                  >
                    {view.name}
                    {view.useAsDefault ? (
                      <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                        default
                      </span>
                    ) : null}
                  </button>
                ))}
                {savedViews.length === 0 ? (
                  <p className="px-4 py-3 text-xs font-semibold text-slate-400">
                    Aún no hay vistas guardadas.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <ToolbarButton onClick={resetView}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </ToolbarButton>
          {saveStatus ? (
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              {saveStatus}
            </span>
          ) : null}
          {operationStatus ? (
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
              {operationStatus}
            </span>
          ) : null}
        </div>

        <div className="mb-4 grid gap-2.5 md:grid-cols-4 xl:grid-cols-7">
          {metrics.map((metric) => {
            const isActive = activeMetric === metric.key;
            const visual = metricIcons[metric.key];

            return (
              <button
                key={metric.key}
                type="button"
                onClick={() =>
                  setActiveMetric((current) =>
                    current === metric.key && metric.key !== "total"
                      ? "total"
                      : metric.key,
                  )
                }
                className={`min-h-[72px] rounded-xl border bg-white px-3.5 py-2.5 text-left shadow-[0_3px_10px_rgba(15,23,42,.04)] transition hover:-translate-y-0.5 ${
                  isActive
                    ? "border-[#205EEF] bg-[#F5F8FF] shadow-[0_12px_26px_rgba(32,94,239,.13)]"
                    : "border-[#E6EBF3] hover:border-[#D6E0F5]"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[.09em] text-slate-500">
                    {metric.label}
                  </span>
                  <span className={`grid h-6 w-6 place-items-center rounded-md ${visual.className}`}>
                    {visual.icon}
                  </span>
                </span>
                <span className="mt-1.5 block text-[22px] font-black leading-none text-[#08111F]">
                  {metric.value.toLocaleString("es-CL")}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-black text-[#08111F]">
            {viewModel.totalForPagination.toLocaleString("es-CL")} casos
          </p>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex h-9 min-w-[250px] flex-1 items-center gap-2 rounded-[9px] border border-[#E4E9F0] bg-white px-3 text-xs text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,.03)] md:max-w-[290px]">
            <Search className="h-3.5 w-3.5" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar casos"
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {isInlineEditing ? (
              <>
                <ToolbarButton onClick={saveInlineChanges}>
                  <Edit3 className="h-3.5 w-3.5" />
                  Guardar cambios
                </ToolbarButton>
                <ToolbarButton onClick={cancelInlineChanges}>
                  Cancelar edición
                </ToolbarButton>
              </>
            ) : (
              <ToolbarButton
                variant="primary"
                onClick={() => setIsInlineEditing(true)}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Modo edición
              </ToolbarButton>
            )}
            <ToolbarButton
              disabled={selectedCaseIds.size < 2}
              onClick={() => setOperationModal("merge")}
            >
              <GitMerge className="h-3.5 w-3.5" />
              Fusionar
            </ToolbarButton>
            <ToolbarButton
              disabled={selectedCaseIds.size === 0}
              onClick={() => setOperationModal("owner")}
            >
              <UserCog className="h-3.5 w-3.5" />
              Cambiar Owner
            </ToolbarButton>
          </div>
        </div>

        {selectedCaseIds.size > 0 || isInlineEditing ? (
          <div className="mb-3 rounded-xl border border-[#D6E0F5] bg-[#F5F8FF] px-4 py-2.5 text-xs font-bold text-[#205EEF]">
            {selectedCaseIds.size > 0 ? (
              <span>
                {selectedCaseIds.size.toLocaleString("es-CL")} caso
                {selectedCaseIds.size === 1 ? "" : "s"} seleccionado
                {selectedCaseIds.size === 1 ? "" : "s"}.
              </span>
            ) : null}
            {isInlineEditing ? (
              <span className={selectedCaseIds.size > 0 ? "ml-2" : ""}>
                Tabla en modo edición inline.
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <FilterSelect label="Canal" value={filters.channel} onChange={(value) => updateFilter("channel", value)} options={options.channel} />
          <FilterSelect label="Tipo de Contacto" value={filters.contactType} onChange={(value) => updateFilter("contactType", value)} options={options.contactType} />
          <FilterSelect label="Producto" value={filters.product} onChange={(value) => updateFilter("product", value)} options={options.product} />
          <FilterSelect label="Subproducto" value={filters.subproduct} onChange={(value) => updateFilter("subproduct", value)} options={options.subproduct} />
          <FilterSelect label="CAT Principal" value={filters.catPrincipal} onChange={(value) => updateFilter("catPrincipal", value)} options={options.catPrincipal} />
          <FilterSelect label="CAT Secundaria" value={filters.catSecondary} onChange={(value) => updateFilter("catSecondary", value)} options={options.catSecondary} />
          <FilterSelect label="CAT Extra" value={filters.catExtra} onChange={(value) => updateFilter("catExtra", value)} options={options.catExtra} />
          <FilterSelect label="Estado" value={filters.status} onChange={(value) => updateFilter("status", value)} options={options.status} />
          <button
            type="button"
            onClick={() => openModal("edit")}
            className="inline-flex h-9 items-center gap-2 rounded-[9px] border border-[#D6E0F5] bg-[#F5F8FF] px-3.5 text-xs font-bold text-[#205EEF] shadow-[0_1px_2px_rgba(15,23,42,.03)]"
          >
            <Filter className="h-3.5 w-3.5" />
            Más filtros
          </button>
        </div>

        <section className="overflow-hidden rounded-xl border border-[#E6EBF3] bg-white shadow-[0_3px_10px_rgba(15,23,42,.04)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="bg-[#FBFCFE]">
                  <th className="w-12 border-b border-[#EEF1F6] px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleSelection}
                      aria-label="Seleccionar casos visibles"
                      className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#205EEF]"
                    />
                  </th>
                  {visibleColumns.map((column) => (
                    <th
                      key={column.key}
                      className="border-b border-[#EEF1F6] px-3 py-2.5 text-[10px] font-black uppercase tracking-[.06em] text-slate-400"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="bg-white hover:bg-[#FBFCFE]">
                    <td className="border-b border-[#F1F4F8] px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedCaseIds.has(row.id)}
                        onChange={() => toggleCaseSelection(row.id)}
                        aria-label={`Seleccionar ${row.number}`}
                        className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#205EEF]"
                      />
                    </td>
                    {visibleColumns.map((column) => (
                      <td
                        key={`${row.id}-${column.key}`}
                        className="max-w-[220px] truncate border-b border-[#F1F4F8] px-3 py-2.5 text-[11.5px] font-medium text-slate-600"
                        title={getCellValue(row, column.key)}
                      >
                        {renderCaseCell(row, column)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleRows.length === 0 ? (
              <div className="grid place-items-center px-6 py-14 text-sm font-semibold text-slate-400">
                No hay casos para los filtros seleccionados.
              </div>
            ) : null}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF1F6] bg-[#FBFCFE] px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-medium text-slate-500">
                {formatShowingCount(visibleRows.length, viewModel.totalForPagination)}
              </span>
              <div className="flex items-center gap-1.5">
                {[100, 200, 300].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPageSize(size)}
                    className={`h-6 rounded-md px-3 text-[11px] font-bold ${
                      pageSize === size
                        ? "bg-slate-300 text-slate-900"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E9F0] text-slate-400">
                <ChevronLeft className="h-3.5 w-3.5" />
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#205EEF] text-[11px] font-bold text-white">
                1
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#E4E9F0] text-slate-400">
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </footer>
        </section>
      </div>

      {modalMode ? (
        <ViewConfigModal
          columns={columns}
          draft={draft}
          mode={modalMode}
          options={options}
          setDraft={setDraft}
          onClose={() => setModalMode(null)}
          onSave={saveModalDraft}
        />
      ) : null}
      {operationModal === "merge" ? (
        <MergeCasesModal
          selectedCases={selectedRows}
          metadata={metadata}
          onClose={() => setOperationModal(null)}
          onMerge={executeMerge}
        />
      ) : null}
      {operationModal === "owner" ? (
        <ChangeOwnerModal
          selectedCases={selectedRows}
          users={assignableUsers}
          onClose={() => setOperationModal(null)}
          onChangeOwner={executeOwnerChange}
        />
      ) : null}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative inline-flex h-9 items-center rounded-[9px] border border-[#E4E9F0] bg-white text-[11.5px] font-semibold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,.03)]">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-full appearance-none rounded-[9px] bg-transparent py-0 pl-3 pr-8 outline-none"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-slate-400" />
    </label>
  );
}

function ModalFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-lg border border-[#DDE5F1] bg-white px-2 text-xs font-semibold normal-case tracking-normal text-slate-700 outline-none focus:border-[#205EEF]"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
