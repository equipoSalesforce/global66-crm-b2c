import type { ReportFieldType, ReportVisibility } from "@/lib/informes-api";
import type { ReportRunResult } from "@/lib/informes-engine";

export const reportVisibilityLabels: Record<ReportVisibility, string> = { private: "Privado", shared: "Compartido", internal: "Público interno" };

export function ReportVisibilityBadge({ visibility }: { visibility: ReportVisibility }) {
  const styles = { private: "bg-slate-100 text-slate-600", shared: "bg-violet-50 text-violet-700", internal: "bg-emerald-50 text-emerald-700" }[visibility];
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${styles}`}>{reportVisibilityLabels[visibility]}</span>;
}

function formatPreviewValue(value: string | number | boolean | null, type: ReportFieldType) {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if ((type === "currency" || type === "number") && typeof value === "number") return new Intl.NumberFormat("es-CL", { minimumFractionDigits: type === "currency" ? 2 : 0, maximumFractionDigits: 2 }).format(value);
  return String(value);
}

export function ReportPreviewTable({ columns, rows }: { columns: Array<{ key: string; label: string; type: ReportFieldType }>; rows: Array<Record<string, string | number | boolean | null>> }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[620px] text-left"><thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-wide text-slate-400"><tr>{columns.map((column) => <th key={column.key} className="px-3 py-2.5">{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-slate-100 text-[10px] text-slate-600">{columns.map((column) => <td key={column.key} className="max-w-48 truncate px-3 py-2.5">{formatPreviewValue(row[column.key], column.type)}</td>)}</tr>)}</tbody></table></div>;
}

export function ReportRunPreview({ result, groupLabel, metricLabel }: { result: ReportRunResult; groupLabel?: string; metricLabel: string }) {
  if (result.groups.length) {
    return <div className="space-y-3">{result.groups.map((group) => <section key={group.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between bg-slate-50 px-3 py-2"><div><p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">{groupLabel || "Grupo"}</p><p className="text-xs font-extrabold text-slate-800">{group.label}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">{group.count} fila(s)</span></div><div className="border-y border-slate-100"><ReportPreviewTable columns={result.columns} rows={group.rows} /></div><div className="flex items-center justify-end gap-3 bg-slate-50 px-3 py-2 text-[10px]"><span className="font-semibold text-slate-500">Subtotal · {metricLabel}</span><strong className="text-slate-900">{formatPreviewValue(Object.values(group.metrics)[0] ?? 0, "number")}</strong></div></section>)}<div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white"><div><p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">Total general</p><p className="text-xs font-bold">{result.summary.totalRows} registros</p></div><div className="text-right"><p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">{result.summary.metricLabel}</p><p className="text-sm font-black">{formatPreviewValue(result.summary.metricValue, "number")}</p></div></div></div>;
  }
  if (!result.rows.length) return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center text-xs font-semibold text-slate-400">No hay datos para esta definición y sus filtros.</div>;
  return <ReportPreviewTable columns={result.columns} rows={result.rows} />;
}
