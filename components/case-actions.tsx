"use client";

import { assignCaseAutomatically } from "@/lib/assignment";
import {
  normalizeLifecycleStatus,
  normalizeRoutingStatus,
} from "@/lib/case-status";
import { hasPermission } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "./toast-provider";
import { useDemoRole } from "./use-demo-role";

const caseStatuses = [
  "AI_HANDLING",
  "HUMAN_REQUIRED",
  "ASSIGNED",
  "CLOSED",
] as const;

type CaseStatus = (typeof caseStatuses)[number];

const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const areas = [
  "SOPORTE",
  "VENTAS",
  "FACTURACION",
  "OPERACIONES",
  "COMPLIANCE",
  "OTROS",
] as const;
const categories = [
  "ACCESO",
  "PAGOS",
  "FACTURACION",
  "DOCUMENTACION",
  "INTEGRACION",
  "RECLAMO",
  "CONSULTA",
  "OTROS",
] as const;
const contactTypes = [
  "WHATSAPP",
  "GMAIL",
  "WEB",
  "CHATBOT",
  "PHONE",
  "MANUAL",
] as const;

type Priority = (typeof priorities)[number];
type Area = (typeof areas)[number];
type Category = (typeof categories)[number];
type ContactType = (typeof contactTypes)[number];
type PendingAction = "save" | "assign" | "auto-assign" | "close" | null;

type AgentOption = {
  id: string;
  name: string | null;
  email: string | null;
  active: boolean | null;
};

export function CaseActions({
  caseId,
  agents,
  currentStatus,
  currentAssignedAgentId,
  currentPriority,
  currentArea,
  currentCategory,
  currentContactType,
  currentClosedAt,
  currentResolutionType,
}: {
  caseId: string;
  agents: AgentOption[];
  currentStatus: string | null;
  currentAssignedAgentId: string | null;
  currentPriority: string | null;
  currentArea: string | null;
  currentCategory: string | null;
  currentContactType: string | null;
  currentClosedAt: string | null;
  currentResolutionType: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const { role, isCheckingRole } = useDemoRole();
  const [status, setStatus] = useState<CaseStatus>(
    caseStatuses.includes(currentStatus as CaseStatus)
      ? (currentStatus as CaseStatus)
      : "HUMAN_REQUIRED",
  );
  const [priority, setPriority] = useState<Priority>(
    priorities.includes(currentPriority as Priority)
      ? (currentPriority as Priority)
      : "MEDIUM",
  );
  const [area, setArea] = useState<Area>(
    areas.includes(currentArea as Area) ? (currentArea as Area) : "SOPORTE",
  );
  const [category, setCategory] = useState<Category>(
    categories.includes(currentCategory as Category)
      ? (currentCategory as Category)
      : "CONSULTA",
  );
  const [contactType, setContactType] = useState<ContactType>(
    contactTypes.includes(currentContactType as ContactType)
      ? (currentContactType as ContactType)
      : "MANUAL",
  );
  const [assignedAgentId, setAssignedAgentId] = useState(
    currentAssignedAgentId ?? "",
  );
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const canEditCaseFields = hasPermission(role, "editCaseFields");
  const canTakeCases = hasPermission(role, "takeQueueCases");
  const canReassignCases = hasPermission(role, "reassignCases");
  const canAutoAssignCases = hasPermission(role, "autoAssignCases");
  const canCloseCases = hasPermission(role, "closeCases");

  async function updateCase(
    values: Record<string, string | null>,
    action: Exclude<PendingAction, null>,
    successMessage: string,
  ) {
    setPendingAction(action);
    setError(null);

    const { error: updateError } = await supabase
      .from("cases")
      .update({
        ...values,
        updated_at: new Date().toISOString(),
      })
      .eq("id", caseId);

    if (updateError) {
      console.error("[case-actions] Error updating case", {
        message: updateError.message,
        supabaseError: updateError,
      });
      setError(updateError.message);
      toast.error("✗ No se pudieron guardar los cambios");
      setPendingAction(null);
      return;
    }

    toast.success(successMessage);
    setPendingAction(null);
    router.refresh();
  }

  function saveCaseFields() {
    if (!canEditCaseFields) {
      setError("Tu perfil no puede editar datos operativos del caso.");
      toast.error("✗ No se pudieron guardar los cambios");
      return;
    }

    const values: Record<string, string | null> = {
      status,
      lifecycle_status: normalizeLifecycleStatus(null, status),
      routing_status: normalizeRoutingStatus({
        routingStatus: null,
        status,
        assignedAgentId: assignedAgentId || null,
      }),
      priority,
      area,
      category,
      contact_type: contactType,
    };

    if (status === "CLOSED") {
      values.closed_at = currentClosedAt ?? new Date().toISOString();
      values.resolution_type = currentResolutionType ?? "HUMAN_RESOLVED";
    }

    updateCase(values, "save", "✓ Cambios guardados correctamente");
  }

  function assignCase() {
    if (!canReassignCases) {
      setError("Tu perfil no puede reasignar casos.");
      toast.error("✗ No se pudieron guardar los cambios");
      return;
    }

    if (!assignedAgentId) {
      setError("Selecciona un agente para reasignar el caso.");
      toast.error("✗ No se pudieron guardar los cambios");
      return;
    }

    const selectedAgent = agents.find((agent) => agent.id === assignedAgentId);

    updateCase(
      {
        status: "ASSIGNED",
        routing_status: "ASSIGNED",
        owner_type: "USER",
        assigned_agent_id: assignedAgentId,
        assigned_queue_id: null,
        assigned_to: selectedAgent?.name ?? selectedAgent?.email ?? null,
        assigned_at: new Date().toISOString(),
      },
      "assign",
      "✓ Caso asignado correctamente",
    );
  }

  function assignToCurrentAgent() {
    if (!canTakeCases) {
      setError("Tu perfil no puede tomar casos.");
      toast.error("✗ No se pudieron guardar los cambios");
      return;
    }

    const agentId = window.localStorage.getItem("agentId");
    const agentName = window.localStorage.getItem("agentName");

    if (!agentId) {
      setError("No hay agente en sesión demo.");
      toast.error("✗ No se pudieron guardar los cambios");
      return;
    }

    setAssignedAgentId(agentId);
    updateCase(
      {
        status: "ASSIGNED",
        routing_status: "ASSIGNED",
        owner_type: "USER",
        assigned_agent_id: agentId,
        assigned_queue_id: null,
        assigned_to: agentName || "Agente",
        assigned_at: new Date().toISOString(),
      },
      "assign",
      "✓ Caso asignado correctamente",
    );
  }

  async function assignAutomatically() {
    if (!canAutoAssignCases) {
      setError("Tu perfil no puede asignar automáticamente.");
      toast.error("✗ No se pudieron guardar los cambios");
      return;
    }

    setPendingAction("auto-assign");
    setError(null);

    const result = await assignCaseAutomatically(caseId);

    if (result.status === "assigned") {
      toast.success("✓ Caso asignado automáticamente");
      setAssignedAgentId(result.agentId);
      setPendingAction(null);
      router.refresh();
      return;
    }

    if (result.status === "no_agent") {
      setStatus("HUMAN_REQUIRED");
      toast.info("No hay agentes disponibles para este caso");
      setPendingAction(null);
      router.refresh();
      return;
    }

    console.error("[case-actions] Error assigning case automatically", {
      reason: result.reason,
      error: result.error,
    });
    setError(result.reason);
    toast.error("✗ No se pudo asignar automáticamente");
    setPendingAction(null);
  }

  function closeCase() {
    if (!canCloseCases) {
      setError("Tu perfil no puede cerrar casos.");
      toast.error("✗ No se pudieron guardar los cambios");
      return;
    }

    const values: Record<string, string | null> = {
      status: "CLOSED",
      lifecycle_status: "CLOSED",
      closed_at: new Date().toISOString(),
    };

    if (!currentResolutionType) {
      values.resolution_type = "HUMAN_RESOLVED";
    }

    updateCase(values, "close", "✓ Caso cerrado correctamente");
  }

  const isUpdating = pendingAction !== null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-950">Acciones</h2>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-950">Estado</span>
            <select
              value={status}
              disabled={isCheckingRole || !canEditCaseFields}
              onChange={(event) => setStatus(event.target.value as CaseStatus)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {caseStatuses.map((caseStatus) => (
                <option key={caseStatus} value={caseStatus}>
                  {caseStatus}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-950">
              Prioridad
            </span>
            <select
              value={priority}
              disabled={isCheckingRole || !canEditCaseFields}
              onChange={(event) => setPriority(event.target.value as Priority)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {priorities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-950">Área</span>
            <select
              value={area}
              disabled={isCheckingRole || !canEditCaseFields}
              onChange={(event) => setArea(event.target.value as Area)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {areas.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-950">
              Categoría
            </span>
            <select
              value={category}
              disabled={isCheckingRole || !canEditCaseFields}
              onChange={(event) => setCategory(event.target.value as Category)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-950">
              Tipo de contacto
            </span>
            <select
              value={contactType}
              disabled={isCheckingRole || !canEditCaseFields}
              onChange={(event) =>
                setContactType(event.target.value as ContactType)
              }
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {contactTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={isCheckingRole || !canEditCaseFields || isUpdating}
            onClick={saveCaseFields}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--g66-accent-cyan)] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {pendingAction === "save" ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

        <div className="grid gap-3">
          <button
            type="button"
            disabled={isCheckingRole || !canTakeCases || isUpdating}
            onClick={assignToCurrentAgent}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--g66-accent-cyan)] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--g66-brand-blue)] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {pendingAction === "assign" ? "Asignando..." : "Asignarme"}
          </button>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-950">
              Agente asignado
            </span>
            <select
              value={assignedAgentId}
              disabled={isCheckingRole || !canReassignCases}
              onChange={(event) => setAssignedAgentId(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-gray-400"
            >
              <option value="">Sin agente</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name || agent.email || agent.id}
                  {agent.active === false ? " (inactivo)" : ""}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={isCheckingRole || !canReassignCases || isUpdating || agents.length === 0}
            onClick={assignCase}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-950 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          >
            {pendingAction === "assign" ? "Asignando..." : "Asignar agente"}
          </button>
          <button
            type="button"
            disabled={isCheckingRole || !canAutoAssignCases || isUpdating}
            onClick={assignAutomatically}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue-soft)] px-4 text-sm font-semibold text-[var(--g66-brand-blue)] shadow-sm transition-colors hover:bg-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          >
            {pendingAction === "auto-assign"
              ? "Asignando..."
              : "Asignar automáticamente"}
          </button>
          <button
            type="button"
            disabled={isCheckingRole || !canCloseCases || isUpdating}
            onClick={closeCase}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {pendingAction === "close" ? "Cerrando..." : "Cerrar caso"}
          </button>
        </div>

        {error ? (
          <p className="rounded-md bg-[var(--g66-danger-soft)] px-3 py-2 text-sm text-[var(--g66-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
