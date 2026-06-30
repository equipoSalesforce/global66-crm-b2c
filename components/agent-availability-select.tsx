"use client";

import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useToast } from "./toast-provider";

const availabilityStatuses = [
  "AVAILABLE",
  "BUSY",
  "AWAY",
  "OFFLINE",
] as const;

type AvailabilityStatus = (typeof availabilityStatuses)[number];

function normalizeAvailability(status: string | null): AvailabilityStatus {
  if (availabilityStatuses.includes(status as AvailabilityStatus)) {
    return status as AvailabilityStatus;
  }

  return "AVAILABLE";
}

export function AgentAvailabilitySelect({
  agentId,
  compact = false,
}: {
  agentId: string;
  compact?: boolean;
}) {
  const toast = useToast();
  const [availability, setAvailability] =
    useState<AvailabilityStatus>("AVAILABLE");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadAvailability() {
      const { data, error } = await supabase
        .from("crm_agent_profiles")
        .select("availability")
        .eq("user_id", agentId)
        .limit(1)
        .single<{ availability: string | null }>();

      if (error) {
        console.error("[agent-availability] Error loading availability", {
          message: error.message,
          supabaseError: error,
        });
        toast.error("✗ No se pudo cargar disponibilidad");
        setIsLoading(false);
        return;
      }

      setAvailability(normalizeAvailability(data?.availability ?? null));
      setIsLoading(false);
    }

    loadAvailability();
  }, [agentId, toast]);

  async function updateAvailability(nextAvailability: AvailabilityStatus) {
    const previousAvailability = availability;

    setAvailability(nextAvailability);
    setIsSaving(true);

    const { error } = await supabase
      .from("crm_agent_profiles")
      .update({
        availability: nextAvailability,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", agentId);

    if (error) {
      console.error("[agent-availability] Error updating availability", {
        message: error.message,
        supabaseError: error,
      });
      setAvailability(previousAvailability);
      toast.error("✗ No se pudo actualizar disponibilidad");
      setIsSaving(false);
      return;
    }

    toast.success("✓ Disponibilidad actualizada");
    setIsSaving(false);
  }

  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
      <span className="hidden sm:inline">Disponibilidad</span>
      <select
        value={availability}
        disabled={isLoading || isSaving}
        onChange={(event) =>
          updateAvailability(event.target.value as AvailabilityStatus)
        }
        className={`rounded-lg border border-[var(--g66-border)] bg-[var(--g66-background)] text-xs font-bold text-[var(--g66-text-primary)] outline-none transition-colors focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-[var(--g66-text-secondary)] ${
          compact ? "h-7 px-2" : "h-9 px-3"
        }`}
      >
        {availabilityStatuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </label>
  );
}
