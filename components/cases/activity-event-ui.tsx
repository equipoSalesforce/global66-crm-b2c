"use client";

import Image from "next/image";
import { Globe2, MessageCircle, Search } from "lucide-react";
import { useState } from "react";

export type ActivityChannel =
  | "whatsapp"
  | "email"
  | "call"
  | "chat"
  | "rrss"
  | "system";
export type ActivityActor = "customer" | "ai" | "agent" | "system" | "unknown";

const assetByValue = {
  whatsapp: "/icons/activity/whatsapp.svg",
  email: "/icons/activity/email.svg",
  call: "/icons/activity/call.svg",
  system: "/icons/activity/system.svg",
  customer: "/icons/activity/customer.svg",
  ai: "/icons/activity/ai.svg",
  agent: "/icons/activity/agent.svg",
  unknown: "/icons/activity/system.svg",
} as const;

const labelByValue = {
  whatsapp: "WhatsApp",
  email: "Correo",
  call: "Llamada",
  chat: "Chat",
  rrss: "Redes sociales",
  system: "Sistema",
  customer: "Cliente",
  ai: "IA",
  agent: "Ejecutivo",
  unknown: "Desconocido",
} as const;

export function ActivityIconBadge({
  kind,
  value,
}: {
  kind: "channel" | "actor";
  value: ActivityChannel | ActivityActor;
}) {
  const [assetFailed, setAssetFailed] = useState(false);
  const title = `${kind === "channel" ? "Canal" : "Actor"}: ${labelByValue[value]}`;
  const asset = value in assetByValue
    ? assetByValue[value as keyof typeof assetByValue]
    : null;

  return (
    <span
      title={title}
      aria-label={title}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--g66-border-soft)] bg-white"
    >
      {asset && !assetFailed ? (
        <Image
          src={asset}
          alt=""
          width={14}
          height={14}
          onError={() => setAssetFailed(true)}
        />
      ) : value === "rrss" ? (
        <Globe2 className="h-3.5 w-3.5 text-[var(--g66-text-secondary)]" aria-hidden="true" />
      ) : (
        <MessageCircle className="h-3.5 w-3.5 text-[var(--g66-text-secondary)]" aria-hidden="true" />
      )}
    </span>
  );
}

export function ActivityListControls({
  query,
  onQueryChange,
  date,
  onDateChange,
  order,
  onOrderChange,
  placeholder,
  visibleCount,
  totalCount,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  order: "newest" | "oldest";
  onOrderChange: (value: "newest" | "oldest") => void;
  placeholder: string;
  visibleCount: number;
  totalCount: number;
}) {
  const hasFilters = Boolean(query || date);

  return (
    <div className="mb-3 rounded-lg border border-[var(--g66-border)] bg-white p-2">
      <div className="grid gap-2 md:grid-cols-[minmax(160px,1fr)_145px_170px_auto]">
        <label className="flex h-8 items-center gap-2 rounded-md border border-[var(--g66-border)] px-2">
          <Search className="h-3.5 w-3.5 text-[var(--g66-text-muted)]" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </label>
        <input
          type="date"
          aria-label="Filtrar por fecha"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="h-8 rounded-md border border-[var(--g66-border)] px-2 text-xs outline-none focus:border-[var(--g66-secondary-interactive)]"
        />
        <select
          aria-label="Ordenar por fecha"
          value={order}
          onChange={(event) => onOrderChange(event.target.value as "newest" | "oldest")}
          className="h-8 rounded-md border border-[var(--g66-border)] px-2 text-xs outline-none focus:border-[var(--g66-secondary-interactive)]"
        >
          <option value="newest">Más reciente primero</option>
          <option value="oldest">Más antiguo primero</option>
        </select>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              onQueryChange("");
              onDateChange("");
            }}
            className="h-8 rounded-md px-2 text-xs font-medium text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
          >
            Limpiar
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-[10px] text-[var(--g66-text-muted)]">
        Mostrando {visibleCount} de {totalCount} eventos
      </p>
    </div>
  );
}
