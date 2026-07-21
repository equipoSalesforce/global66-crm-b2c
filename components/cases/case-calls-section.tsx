"use client";

import type { CaseCallRecord } from "@/lib/case-info-links-types";
import { PhoneCall, X } from "lucide-react";
import { useState } from "react";

function formatCallDate(value: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function callTitle(call: CaseCallRecord) {
  if (call.direction?.toLowerCase() === "inbound") return "Llamado entrante";
  if (call.direction?.toLowerCase() === "outbound") return "Llamado saliente";
  return "Llamado";
}

function isEffective(call: CaseCallRecord) {
  const status = `${call.status ?? ""} ${call.result ?? ""}`.toLowerCase();
  return Boolean(call.answered_at) || ["answered", "completed", "success", "connected"].some((value) => status.includes(value));
}

export function CaseCallsSection({ calls }: { calls: CaseCallRecord[] }) {
  const [selectedCall, setSelectedCall] = useState<CaseCallRecord | null>(null);

  return (
    <>
      <div className="grid gap-2">
        {calls.map((call) => (
          <button
            key={call.id}
            type="button"
            onClick={() => setSelectedCall(call)}
            className="rounded-lg border border-[var(--g66-border)] bg-white p-3 text-left transition hover:border-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--g66-text-primary)]">
                <PhoneCall className="h-3.5 w-3.5 text-[var(--g66-brand-blue)]" aria-hidden="true" />
                {callTitle(call)}
              </span>
              <span className={`text-[10px] font-semibold ${isEffective(call) ? "text-[var(--g66-success)]" : "text-[var(--g66-text-muted)]"}`}>
                {isEffective(call) ? "Efectivo" : "No efectivo"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--g66-text-secondary)]">
              {formatCallDate(call.started_at || call.created_at)}
            </p>
            <p className="mt-1 truncate text-[11px] text-[var(--g66-text-muted)]">
              {call.notes || call.result || call.status || "Sin detalle adicional"}
            </p>
          </button>
        ))}
        {calls.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--g66-border)] bg-[var(--g66-background)] p-3 text-sm text-[var(--g66-text-secondary)]">
            No hay llamados asociados a este caso.
          </p>
        ) : null}
      </div>

      {selectedCall ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-labelledby="call-detail-title">
          <div className="w-full max-w-md rounded-xl border border-[var(--g66-border)] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--g66-border)] px-4 py-3">
              <h3 id="call-detail-title" className="text-sm font-semibold text-[var(--g66-text-primary)]">Detalle del llamado</h3>
              <button type="button" onClick={() => setSelectedCall(null)} aria-label="Cerrar detalle del llamado" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--g66-background)]">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <dl className="grid gap-3 p-4 text-xs">
              <div><dt className="text-[var(--g66-text-muted)]">Fecha y hora</dt><dd className="mt-0.5 font-medium text-[var(--g66-text-primary)]">{formatCallDate(selectedCall.started_at || selectedCall.created_at)}</dd></div>
              <div><dt className="text-[var(--g66-text-muted)]">Número de salida</dt><dd className="mt-0.5 font-medium text-[var(--g66-text-primary)]">{selectedCall.aircall_number || selectedCall.phone_number || "No disponible"}</dd></div>
              <div><dt className="text-[var(--g66-text-muted)]">Número de destino</dt><dd className="mt-0.5 font-medium text-[var(--g66-text-primary)]">{selectedCall.customer_phone || "No disponible"}</dd></div>
              <div><dt className="text-[var(--g66-text-muted)]">Resultado</dt><dd className="mt-0.5 font-medium text-[var(--g66-text-primary)]">{selectedCall.result || selectedCall.status || "No disponible"}</dd></div>
              <div>
                <dt className="text-[var(--g66-text-muted)]">Grabación</dt>
                <dd className="mt-1">
                  {selectedCall.recording_url ? (
                    <a href={selectedCall.recording_url} download className="font-medium text-[var(--g66-brand-blue)] hover:underline">Descargar grabación</a>
                  ) : (
                    <span className="text-[var(--g66-text-secondary)]">No disponible</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </>
  );
}
