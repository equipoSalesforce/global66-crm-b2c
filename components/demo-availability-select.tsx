"use client";

import { useEffect, useMemo, useState } from "react";

export const demoAvailabilityStatuses = [
  "AVAILABLE",
  "BUSY",
  "AWAY",
  "OFFLINE",
] as const;

export type DemoAvailabilityStatus = (typeof demoAvailabilityStatuses)[number];

const availabilityLabels: Record<DemoAvailabilityStatus, string> = {
  AVAILABLE: "Disponible",
  BUSY: "Ocupado",
  AWAY: "Ausente",
  OFFLINE: "Offline",
};

const availabilityClasses: Record<DemoAvailabilityStatus, string> = {
  AVAILABLE: "text-[var(--g66-success)]",
  BUSY: "text-[var(--g66-warning)]",
  AWAY: "text-[#B77900]",
  OFFLINE: "text-[var(--g66-text-muted)]",
};

const dotClasses: Record<DemoAvailabilityStatus, string> = {
  AVAILABLE: "bg-[var(--g66-success)]",
  BUSY: "bg-[var(--g66-warning)]",
  AWAY: "bg-[#B77900]",
  OFFLINE: "bg-[var(--g66-text-muted)]",
};

function normalizeAvailability(value: string | null): DemoAvailabilityStatus {
  return demoAvailabilityStatuses.includes(value as DemoAvailabilityStatus)
    ? (value as DemoAvailabilityStatus)
    : "AVAILABLE";
}

function storageKey(userId: string) {
  return `crmAvailability:${userId || "demo"}`;
}

export function DemoAvailabilitySelect({
  userId,
  compact = false,
  showLabel = true,
}: {
  userId: string;
  compact?: boolean;
  showLabel?: boolean;
}) {
  const key = useMemo(() => storageKey(userId), [userId]);
  const [availability, setAvailability] =
    useState<DemoAvailabilityStatus>("AVAILABLE");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setAvailability(normalizeAvailability(window.localStorage.getItem(key)));
    }, 0);

    function handleAvailabilityChanged(event: Event) {
      const customEvent = event as CustomEvent<{
        userId: string;
        availability: DemoAvailabilityStatus;
      }>;

      if (customEvent.detail?.userId === userId) {
        setAvailability(normalizeAvailability(customEvent.detail.availability));
      }
    }

    window.addEventListener("crm-availability-changed", handleAvailabilityChanged);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(
        "crm-availability-changed",
        handleAvailabilityChanged,
      );
    };
  }, [key, userId]);

  function updateAvailability(nextAvailability: DemoAvailabilityStatus) {
    setAvailability(nextAvailability);
    window.localStorage.setItem(key, nextAvailability);
    window.dispatchEvent(
      new CustomEvent("crm-availability-changed", {
        detail: { userId, availability: nextAvailability },
      }),
    );
  }

  return (
    <label
      className={`inline-flex items-center gap-2 text-xs font-bold ${availabilityClasses[availability]}`}
    >
      {showLabel ? (
        <>
          <span className={`h-2 w-2 rounded-full ${dotClasses[availability]}`} />
          <span className={compact ? "hidden lg:inline" : ""}>Disponibilidad</span>
        </>
      ) : null}
      <select
        value={availability}
        onChange={(event) =>
          updateAvailability(event.target.value as DemoAvailabilityStatus)
        }
        className={`rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-white font-black text-[var(--g66-text-primary)] outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] ${
          compact ? "h-7 px-2 text-xs" : "h-9 px-3 text-sm"
        }`}
      >
        {demoAvailabilityStatuses.map((status) => (
          <option key={status} value={status}>
            {availabilityLabels[status]}
          </option>
        ))}
      </select>
    </label>
  );
}
