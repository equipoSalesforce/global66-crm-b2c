"use client";

import { useEffect, useMemo, useState } from "react";

const terminalStatuses = new Set(["CLOSED", "RESOLVED", "MERGED"]);

function timestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatCaseAttentionDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days} ${days === 1 ? "día" : "días"} ${hours} ${hours === 1 ? "hora" : "horas"} ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }
  if (hours > 0) {
    return `${hours} ${hours === 1 ? "hora" : "horas"} ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

export function CaseAttentionTime({
  createdAt,
  closedAt,
  resolvedAt,
  updatedAt,
  status,
  lifecycleStatus,
}: {
  createdAt: string | null | undefined;
  closedAt?: string | null;
  resolvedAt?: string | null;
  updatedAt?: string | null;
  status?: string | null;
  lifecycleStatus?: string | null;
}) {
  const isTerminal = useMemo(
    () =>
      [status, lifecycleStatus].some((value) =>
        terminalStatuses.has(value?.trim().toUpperCase() ?? ""),
      ),
    [lifecycleStatus, status],
  );
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    if (isTerminal) return;

    const initialUpdateId = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const intervalId = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initialUpdateId);
      window.clearInterval(intervalId);
    };
  }, [createdAt, isTerminal]);

  const createdTimestamp = timestamp(createdAt);
  if (createdTimestamp === null) return <>No disponible</>;

  const finalTimestamp = isTerminal
    ? timestamp(closedAt) ?? timestamp(resolvedAt) ?? timestamp(updatedAt)
    : currentTime;

  if (finalTimestamp === null) {
    return <>{isTerminal ? "No disponible" : "Calculando..."}</>;
  }

  return <>{formatCaseAttentionDuration(finalTimestamp - createdTimestamp)}</>;
}
