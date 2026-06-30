"use client";

import { hasPermission } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useToast } from "./toast-provider";
import { useCrmPermissions } from "./use-crm-permissions";

const availabilityStatuses = [
  "AVAILABLE",
  "BUSY",
  "AWAY",
  "OFFLINE",
] as const;
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
const channels = ["WHATSAPP", "GMAIL", "WEB", "CHATBOT", "PHONE", "MANUAL"] as const;

type AgentConfig = {
  id: string;
  availability_status: string | null;
  max_open_cases: number | null;
  active: boolean | null;
};

type AgentSkill = {
  id: string | number;
  area: string | null;
  category: string | null;
  channel: string | null;
  active: boolean | null;
};

type PendingAction = "config" | "create-skill" | `skill-${string | number}` | null;

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
      {children}
    </span>
  );
}

function SelectField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-gray-950">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-gray-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AgentManagementPanel({
  agent,
  skills,
}: {
  agent: AgentConfig;
  skills: AgentSkill[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { permissions: rolePermissions } = useCrmPermissions();
  const [role, setRole] = useState("AGENT");
  const [availability, setAvailability] = useState(
    agent.availability_status || "AVAILABLE",
  );
  const [maxOpenCases, setMaxOpenCases] = useState(
    String(agent.max_open_cases ?? 10),
  );
  const [isActive, setIsActive] = useState(agent.active ?? true);
  const [skillArea, setSkillArea] = useState("SOPORTE");
  const [skillCategory, setSkillCategory] = useState("CONSULTA");
  const [skillChannel, setSkillChannel] = useState("WHATSAPP");
  const [skillActive, setSkillActive] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit = hasPermission(role, "editAgentConfig", rolePermissions);
  const canViewSkills = hasPermission(role, "viewAgentSkills", rolePermissions);

  useEffect(() => {
    const storedRole = window.localStorage.getItem("agentRole");
    window.setTimeout(() => setRole(storedRole || "AGENT"), 0);
  }, []);

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      return;
    }

    const parsedMaxOpenCases = Number(maxOpenCases);

    if (!Number.isFinite(parsedMaxOpenCases) || parsedMaxOpenCases < 0) {
      setError("Max open cases debe ser un número válido.");
      toast.error("✗ No se pudieron guardar los cambios");
      return;
    }

    setPendingAction("config");
    setError(null);

    const { error: updateError } = await supabase
      .from("crm_agent_profiles")
      .update({
        availability,
        max_open_cases: parsedMaxOpenCases,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", agent.id);

    if (updateError) {
      console.error("[agent-management] Error updating agent config", {
        message: updateError.message,
        supabaseError: updateError,
      });
      setError(updateError.message);
      toast.error("✗ No se pudieron guardar los cambios");
      setPendingAction(null);
      return;
    }

    toast.success("✓ Cambios guardados correctamente");
    setPendingAction(null);
    router.refresh();
  }

  async function createSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      return;
    }

    setPendingAction("create-skill");
    setError(null);

    const { error: insertError } = await supabase.from("crm_agent_skills").insert({
      user_id: agent.id,
      area: skillArea,
      category: skillCategory,
      channel: skillChannel,
      status: skillActive ? "ACTIVE" : "INACTIVE",
    });

    if (insertError) {
      console.error("[agent-management] Error creating skill", {
        message: insertError.message,
        supabaseError: insertError,
      });
      setError(insertError.message);
      toast.error("✗ No se pudieron guardar los cambios");
      setPendingAction(null);
      return;
    }

    toast.success("✓ Skill creado correctamente");
    setPendingAction(null);
    router.refresh();
  }

  async function toggleSkill(skill: AgentSkill) {
    if (!canEdit) {
      return;
    }

    setPendingAction(`skill-${skill.id}`);
    setError(null);

    const { error: updateError } = await supabase
      .from("crm_agent_skills")
      .update({
        status: skill.active ? "INACTIVE" : "ACTIVE",
        updated_at: new Date().toISOString(),
      })
      .eq("id", skill.id);

    if (updateError) {
      console.error("[agent-management] Error updating skill", {
        message: updateError.message,
        supabaseError: updateError,
      });
      setError(updateError.message);
      toast.error("✗ No se pudieron guardar los cambios");
      setPendingAction(null);
      return;
    }

    toast.success("✓ Skill actualizado correctamente");
    setPendingAction(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-950">
              Configuración operativa
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {canEdit
                ? "Puedes editar disponibilidad, capacidad y estado."
                : "Modo lectura. Solo ADMIN puede editar configuración."}
            </p>
          </div>
          <Badge>{role}</Badge>
        </div>

        <form onSubmit={saveConfig} className="mt-5 grid gap-4 md:grid-cols-3">
          <SelectField
            label="Disponibilidad"
            value={availability}
            options={availabilityStatuses}
            disabled={!canEdit || pendingAction === "config"}
            onChange={setAvailability}
          />

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-950">
              Max open cases
            </span>
            <input
              type="number"
              min="0"
              value={maxOpenCases}
              disabled={!canEdit || pendingAction === "config"}
              onChange={(event) => setMaxOpenCases(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-gray-400"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-950">Activo</span>
            <select
              value={isActive ? "true" : "false"}
              disabled={!canEdit || pendingAction === "config"}
              onChange={(event) => setIsActive(event.target.value === "true")}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-gray-400"
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </label>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={!canEdit || pendingAction === "config"}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--g66-accent-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--g66-brand-blue)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {pendingAction === "config" ? "Guardando..." : "Guardar configuración"}
            </button>
          </div>
        </form>
      </section>

      {canViewSkills ? (
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-950">Skills</h2>
        </div>

        {skills.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {skills.map((skill) => (
              <li
                key={skill.id}
                className="grid gap-4 px-6 py-4 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge>{skill.area || "Sin área"}</Badge>
                  <Badge>{skill.category || "Sin categoría"}</Badge>
                  <Badge>{skill.channel || "Sin canal"}</Badge>
                  <Badge>{skill.active ? "Activo" : "Inactivo"}</Badge>
                </div>
                <button
                  type="button"
                  disabled={!canEdit || pendingAction === `skill-${skill.id}`}
                  onClick={() => toggleSkill(skill)}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[var(--g66-brand-blue)] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {pendingAction === `skill-${skill.id}`
                    ? "Guardando..."
                    : skill.active
                      ? "Desactivar"
                      : "Activar"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-gray-600">
            Este agente aún no tiene skills configurados.
          </p>
        )}

        <form
          onSubmit={createSkill}
          className="grid gap-4 border-t border-gray-200 p-6 md:grid-cols-4"
        >
          <SelectField
            label="Área"
            value={skillArea}
            options={areas}
            disabled={!canEdit || pendingAction === "create-skill"}
            onChange={setSkillArea}
          />
          <SelectField
            label="Categoría"
            value={skillCategory}
            options={categories}
            disabled={!canEdit || pendingAction === "create-skill"}
            onChange={setSkillCategory}
          />
          <SelectField
            label="Canal"
            value={skillChannel}
            options={channels}
            disabled={!canEdit || pendingAction === "create-skill"}
            onChange={setSkillChannel}
          />
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-gray-950">Estado</span>
            <select
              value={skillActive ? "true" : "false"}
              disabled={!canEdit || pendingAction === "create-skill"}
              onChange={(event) => setSkillActive(event.target.value === "true")}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-gray-400"
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </label>

          <div className="md:col-span-4">
            <button
              type="submit"
              disabled={!canEdit || pendingAction === "create-skill"}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--g66-accent-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--g66-brand-blue)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {pendingAction === "create-skill" ? "Guardando..." : "Crear skill"}
            </button>
          </div>
        </form>
      </section>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-[var(--g66-danger-soft)] bg-[var(--g66-danger-soft)] px-4 py-3 text-sm text-[var(--g66-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
