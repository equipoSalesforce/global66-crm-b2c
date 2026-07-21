import type { CaseInfoSlaSummary } from "@/lib/case-info-links-types";
import { formatDuration } from "@/lib/case-sla";

const metrics = [
  {
    key: "ftrSeconds",
    label: "FTR",
    description: "Desde la creación del caso hasta la primera respuesta humana del agente.",
  },
  {
    key: "artSeconds",
    label: "ART",
    description: "Promedio de espera entre cada mensaje del cliente y la respuesta humana siguiente.",
  },
  {
    key: "ahtSeconds",
    label: "AHT",
    description: "Tiempo gestionado por el agente con el que se cerró el caso, según su historial de asignaciones.",
  },
  {
    key: "ttrSeconds",
    label: "TTR",
    description: "Desde la apertura del caso hasta su resolución o cierre.",
  },
] as const;

export function CaseSlaSection({ summary }: { summary: CaseInfoSlaSummary }) {
  return (
    <div className="grid gap-2">
      {metrics.map((metric) => {
        const value = summary[metric.key];

        return (
          <article key={metric.key} className="rounded-lg border border-[var(--g66-border)] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-[var(--g66-text-primary)]">{metric.label}</h3>
              <span className="text-sm font-semibold text-[var(--g66-brand-blue)]">
                {value === null ? "No disponible" : formatDuration(value)}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-[var(--g66-text-secondary)]">
              {metric.description}
            </p>
            {metric.key === "artSeconds" && summary.responsePairs > 0 ? (
              <p className="mt-1 text-[10px] text-[var(--g66-text-muted)]">
                Calculado con {summary.responsePairs} {summary.responsePairs === 1 ? "respuesta" : "respuestas"}.
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
