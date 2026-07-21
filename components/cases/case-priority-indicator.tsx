import { Flag } from "lucide-react";

type PriorityTone = "high" | "medium" | "low" | "none";

function resolvePriority(priority: string | null | undefined): {
  label: string;
  tone: PriorityTone;
} {
  const normalized = priority?.trim().toLocaleUpperCase();

  if (["HIGH", "URGENT", "ALTO", "ALTA"].includes(normalized ?? "")) {
    return { label: "Alto", tone: "high" };
  }
  if (["MEDIUM", "MEDIO", "MEDIA"].includes(normalized ?? "")) {
    return { label: "Medio", tone: "medium" };
  }
  if (["LOW", "BAJO", "BAJA"].includes(normalized ?? "")) {
    return { label: "Bajo", tone: "low" };
  }
  return { label: "Sin prioridad", tone: "none" };
}

const toneClasses: Record<PriorityTone, string> = {
  high: "text-[var(--g66-danger)]",
  medium: "text-amber-600",
  low: "text-emerald-600",
  none: "text-[var(--g66-text-muted)]",
};

export function CasePriorityIndicator({ priority }: { priority: string | null | undefined }) {
  const resolved = resolvePriority(priority);

  return (
    <span className={`inline-flex items-center gap-1 ${toneClasses[resolved.tone]}`}>
      <span>{resolved.label}</span>
      {resolved.tone !== "none" ? (
        <Flag className="h-3 w-3 fill-current" aria-hidden="true" />
      ) : null}
    </span>
  );
}
