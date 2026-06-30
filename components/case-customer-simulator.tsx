"use client";

import { supabase } from "@/lib/supabase";
import { hasPermission } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useDemoRole } from "./use-demo-role";

type ChatResponse = {
  ok?: boolean;
  error?: string;
};

export function CaseCustomerSimulator({ caseId }: { caseId: string }) {
  const router = useRouter();
  const { role, isCheckingRole } = useDemoRole();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const canSimulate = hasPermission(role, "simulateCustomerMessages");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSimulate) {
      setError("Tu perfil no puede simular mensajes de cliente.");
      return;
    }

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      setError("Escribe un mensaje de cliente antes de simular la entrada.");
      return;
    }

    setIsSending(true);
    setError(null);

    const { error: insertError } = await supabase.from("messages").insert({
      case_id: caseId,
      direction: "INBOUND",
      sender_type: "CUSTOMER",
      body: trimmedMessage,
    });

    if (insertError) {
      setError("No se pudo guardar el mensaje del cliente.");
      setIsSending(false);
      return;
    }

    try {
      const aiResponse = await fetch(`/api/cases/${caseId}/triage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const payload = (await aiResponse.json()) as ChatResponse;

      if (!aiResponse.ok || !payload.ok) {
        setError(payload.error ?? "La IA no pudo evaluar el caso.");
        router.refresh();
        return;
      }

      setMessage("");
      router.refresh();
    } catch {
      setError("La IA no pudo evaluar el caso. Revisa la configuración o intenta de nuevo.");
      router.refresh();
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-gray-200 bg-gray-50 p-4 sm:p-6"
    >
      <label
        htmlFor="customer-simulator"
        className="text-sm font-semibold text-gray-950"
      >
        Simular mensaje de cliente
      </label>
      <textarea
        id="customer-simulator"
        value={message}
        disabled={isCheckingRole || !canSimulate}
        onChange={(event) => {
          setMessage(event.target.value);
          if (error) {
            setError(null);
          }
        }}
        rows={4}
        placeholder={
          canSimulate
            ? "Escribe un mensaje entrante del cliente..."
            : "Tu perfil tiene acceso de solo lectura."
        }
        className="mt-3 w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-gray-400"
      />

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-h-5 text-sm text-[var(--g66-danger)]">{error}</p>
        <button
          type="submit"
          disabled={isCheckingRole || !canSimulate || isSending || message.trim().length === 0}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-gray-950 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isSending ? "Simulando..." : "Simular entrada"}
        </button>
      </div>
    </form>
  );
}
