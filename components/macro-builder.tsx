"use client";

import { supabase } from "@/lib/supabase";
import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useToast } from "./toast-provider";

type MacroRecord = {
  id: string;
  name: string;
  description: string | null;
  target_object: string;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type MacroActionRecord = {
  id?: string;
  macro_id?: string | null;
  action_type: string;
  sort_order: number | null;
  payload: Record<string, unknown>;
  created_at?: string | null;
};

type BuilderAction = {
  id: string;
  action_type: string;
  sort_order: number;
  payload: Record<string, unknown>;
};

type MacroBuilderProps = {
  macro?: MacroRecord | null;
  actions?: MacroActionRecord[];
};

const fieldOptions = [
  "priority",
  "area",
  "category",
  "contact_type",
  "resolution_type",
  "lifecycle_status",
  "routing_status",
  "status",
  "assigned_agent_id",
];

const fieldValueOptions: Record<string, string[]> = {
  priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
  area: ["GENERAL", "SOPORTE", "FACTURACION", "OPERACIONES", "COMPLIANCE", "VENTAS", "FRAUDE"],
  category: ["CONSULTA", "ACCESO", "INCIDENCIA", "PAGO", "DOCUMENTACION", "FACTURACION", "RECLAMO", "OTRO", "ALERTA"],
  contact_type: ["WHATSAPP", "GMAIL", "WEB", "CHATBOT", "PHONE", "MANUAL"],
  resolution_type: ["AI_RESOLVED", "AI_ASSISTED", "HUMAN_RESOLVED", "UNRESOLVED"],
  lifecycle_status: ["NEW", "IN_PROGRESS", "STAND_BY", "RESOLVED", "CLOSED"],
  routing_status: ["UNASSIGNED", "AI_HANDLING", "HUMAN_REQUIRED", "ASSIGNED"],
  status: ["AI_HANDLING", "HUMAN_REQUIRED", "ASSIGNED", "CLOSED"],
};

const manualActionOptions = [
  "UPDATE_CASE_FIELDS",
  "ADD_INTERNAL_NOTE",
  "SEND_REPLY",
  "ESCALATE_CASE",
  "CLOSE_CASE",
];

function createAction(actionType: string): BuilderAction {
  const basePayload =
    actionType === "ADD_INTERNAL_NOTE"
      ? { note: "" }
      : actionType === "SEND_REPLY"
        ? { channel: "INTERNAL", subject: "", body: "" }
        : actionType === "ESCALATE_CASE"
          ? { priority: "HIGH" }
          : {};

  return {
    id: `local-${crypto.randomUUID()}`,
    action_type: actionType,
    sort_order: 0,
    payload: basePayload,
  };
}

function actionSummary(action: BuilderAction) {
  if (action.action_type === "UPDATE_CASE_FIELDS") {
    const fields = Object.entries(action.payload)
      .filter(([, value]) => value !== "" && value !== null && value !== undefined)
      .map(([key, value]) => `${key} = ${String(value)}`);

    return fields.length > 0 ? `Actualizar ${fields.join(", ")}` : "Actualizar campos";
  }

  if (action.action_type === "ADD_INTERNAL_NOTE") {
    return `Agregar nota interna: ${String(action.payload.note || "Sin nota")}`;
  }

  if (action.action_type === "SEND_REPLY") {
    return `Enviar respuesta ${String(action.payload.channel || "INTERNAL")}`;
  }

  if (action.action_type === "ESCALATE_CASE") {
    return `Escalar caso · prioridad ${String(action.payload.priority || "HIGH")}`;
  }

  if (action.action_type === "CLOSE_CASE") return "Cerrar caso";

  return action.action_type;
}

function inputClassName() {
  return "h-9 w-full rounded-md border border-[var(--g66-border)] bg-white px-3 text-sm outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]";
}

function textareaClassName() {
  return "min-h-24 w-full rounded-md border border-[var(--g66-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]";
}

export function MacroBuilder({ macro, actions = [] }: MacroBuilderProps) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(macro?.name ?? "");
  const [description, setDescription] = useState(macro?.description ?? "");
  const [isActive, setIsActive] = useState(macro?.is_active ?? true);
  const [pending, setPending] = useState(false);
  const [builderActions, setBuilderActions] = useState<BuilderAction[]>(
    actions.length > 0
      ? actions.map((action, index) => ({
          id: action.id ?? `local-${index}`,
          action_type: action.action_type,
          sort_order: action.sort_order ?? index,
          payload: action.payload ?? {},
        }))
      : [],
  );

  const updateCaseAction = useMemo(
    () =>
      builderActions.find(
        (action) => action.action_type === "UPDATE_CASE_FIELDS",
      ),
    [builderActions],
  );

  function updateAction(
    actionId: string,
    values: Partial<Pick<BuilderAction, "action_type" | "payload">>,
  ) {
    setBuilderActions((currentActions) =>
      currentActions.map((action) =>
        action.id === actionId ? { ...action, ...values } : action,
      ),
    );
  }

  function updateCaseField(field: string, value: string) {
    setBuilderActions((currentActions) => {
      const currentUpdateAction = currentActions.find(
        (action) => action.action_type === "UPDATE_CASE_FIELDS",
      );

      if (currentUpdateAction) {
        return currentActions.map((action) =>
          action.id === currentUpdateAction.id
            ? {
                ...action,
                payload: {
                  ...action.payload,
                  [field]: value || undefined,
                },
              }
            : action,
        );
      }

      return [
        {
          ...createAction("UPDATE_CASE_FIELDS"),
          payload: {
            [field]: value,
          },
        },
        ...currentActions,
      ];
    });
  }

  function addAction(actionType: string) {
    setBuilderActions((currentActions) => [
      ...currentActions,
      { ...createAction(actionType), sort_order: currentActions.length },
    ]);
  }

  async function saveMacro(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("✗ El nombre de la macro es requerido");
      return;
    }

    setPending(true);

    try {
      const now = new Date().toISOString();
      const macroPayload = {
        name: trimmedName,
        description: description.trim() || null,
        target_object: "CASE",
        is_active: isActive,
        updated_at: now,
      };
      const { data: savedMacro, error: macroError } = macro?.id
        ? await supabase
            .from("macros")
            .update(macroPayload)
            .eq("id", macro.id)
            .select("id")
            .single()
        : await supabase
            .from("macros")
            .insert(macroPayload)
            .select("id")
            .single();

      if (macroError || !savedMacro) {
        throw new Error(macroError?.message || "No se pudo guardar la macro.");
      }

      const macroId = String(savedMacro.id);

      if (macro?.id) {
        const { error: deleteError } = await supabase
          .from("macro_actions")
          .delete()
          .eq("macro_id", macro.id);

        if (deleteError) throw new Error(deleteError.message);
      }

      const actionRows = builderActions
        .map((action, index) => ({
          macro_id: macroId,
          action_type: action.action_type,
          sort_order: index,
          payload: action.payload ?? {},
        }))
        .filter((action) =>
          manualActionOptions.includes(action.action_type),
        );

      if (actionRows.length > 0) {
        const { error: actionError } = await supabase
          .from("macro_actions")
          .insert(actionRows);

        if (actionError) throw new Error(actionError.message);
      }

      toast.success("✓ Macro guardada correctamente");
      router.push(`/configuracion/macros/${macroId}`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.error("[macro-builder] Error saving macro", {
        message,
        error,
      });
      toast.error(`✗ ${message}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={saveMacro} className="grid gap-4">
      <section className="rounded-lg border border-[var(--g66-border)] bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto_auto] lg:items-end">
          <label className="grid gap-1 text-sm font-semibold text-[var(--g66-text-primary)]">
            Nombre macro
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClassName()}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[var(--g66-text-primary)]">
            Descripción
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={inputClassName()}
            />
          </label>
          <label className="flex h-9 items-center gap-2 rounded-md border border-[var(--g66-border)] px-3 text-sm font-semibold text-[var(--g66-text-primary)]">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Activa
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--g66-brand-blue)] px-4 text-sm font-semibold text-white hover:bg-[var(--g66-accent-cyan)] disabled:bg-[var(--g66-border)]"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {pending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-[var(--g66-border)] bg-white shadow-sm">
          <div className="border-b border-[var(--g66-border)] px-4 py-3">
            <h2 className="text-sm font-bold text-[var(--g66-text-primary)]">
              Vista previa tipo caso
            </h2>
            <p className="mt-1 text-xs font-semibold text-[var(--g66-text-secondary)]">
              Cambia campos para crear o actualizar una acción UPDATE_CASE_FIELDS.
            </p>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-2">
            {fieldOptions.map((field) => (
              <label key={field} className="grid gap-1 text-sm font-semibold">
                {field}
                {fieldValueOptions[field] ? (
                  <select
                    value={String(updateCaseAction?.payload?.[field] ?? "")}
                    onChange={(event) => updateCaseField(field, event.target.value)}
                    className={inputClassName()}
                  >
                    <option value="">Sin cambio</option>
                    {fieldValueOptions[field].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={String(updateCaseAction?.payload?.[field] ?? "")}
                    onChange={(event) => updateCaseField(field, event.target.value)}
                    placeholder="Sin cambio"
                    className={inputClassName()}
                  />
                )}
              </label>
            ))}
          </div>
        </section>

        <aside className="grid gap-4">
          <section className="rounded-lg border border-[var(--g66-border)] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[var(--g66-text-primary)]">Instrucciones</h2>
            <ol className="mt-3 grid gap-2">
              {builderActions.map((action, index) => (
                <li
                  key={action.id}
                  className="rounded-md border border-[var(--g66-border)] bg-[var(--g66-background)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-bold text-[var(--g66-text-primary)]">
                      {index + 1}. {actionSummary(action)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setBuilderActions((currentActions) =>
                          currentActions.filter((item) => item.id !== action.id),
                        )
                      }
                      className="rounded border border-[var(--g66-border)] bg-white p-1 text-[var(--g66-text-secondary)] hover:text-[var(--g66-danger)]"
                      aria-label="Eliminar acción"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <select
                      value={action.action_type}
                      onChange={(event) =>
                        updateAction(action.id, {
                          action_type: event.target.value,
                          payload: createAction(event.target.value).payload,
                        })
                      }
                      className={inputClassName()}
                    >
                      {manualActionOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {action.action_type === "UPDATE_CASE_FIELDS" ? (
                      <textarea
                        value={JSON.stringify(action.payload, null, 2)}
                        onChange={(event) => {
                          try {
                            updateAction(action.id, {
                              payload: JSON.parse(event.target.value) as Record<string, unknown>,
                            });
                          } catch {
                            updateAction(action.id, { payload: action.payload });
                          }
                        }}
                        className={textareaClassName()}
                      />
                    ) : null}
                    {action.action_type === "ADD_INTERNAL_NOTE" ? (
                      <textarea
                        value={String(action.payload.note ?? "")}
                        onChange={(event) =>
                          updateAction(action.id, {
                            payload: { note: event.target.value },
                          })
                        }
                        placeholder="Nota interna"
                        className={textareaClassName()}
                      />
                    ) : null}
                    {action.action_type === "SEND_REPLY" ? (
                      <div className="grid gap-2">
                        <select
                          value={String(action.payload.channel ?? "INTERNAL")}
                          onChange={(event) =>
                            updateAction(action.id, {
                              payload: {
                                ...action.payload,
                                channel: event.target.value,
                              },
                            })
                          }
                          className={inputClassName()}
                        >
                          <option value="AUTO">AUTO</option>
                          <option value="INTERNAL">INTERNAL</option>
                          <option value="GMAIL">GMAIL</option>
                          <option value="WHATSAPP">WHATSAPP</option>
                        </select>
                        <input
                          value={String(action.payload.subject ?? "")}
                          onChange={(event) =>
                            updateAction(action.id, {
                              payload: {
                                ...action.payload,
                                subject: event.target.value,
                              },
                            })
                          }
                          placeholder="Asunto opcional"
                          className={inputClassName()}
                        />
                        <textarea
                          value={String(action.payload.body ?? "")}
                          onChange={(event) =>
                            updateAction(action.id, {
                              payload: {
                                ...action.payload,
                                body: event.target.value,
                              },
                            })
                          }
                          placeholder="Respuesta"
                          className={textareaClassName()}
                        />
                      </div>
                    ) : null}
                    {action.action_type === "ESCALATE_CASE" ? (
                      <select
                        value={String(action.payload.priority ?? "HIGH")}
                        onChange={(event) =>
                          updateAction(action.id, {
                            payload: { priority: event.target.value },
                          })
                        }
                        className={inputClassName()}
                      >
                        {fieldValueOptions.priority.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                </li>
              ))}
              {builderActions.length === 0 ? (
                <li className="rounded-md border border-dashed border-[var(--g66-border)] p-4 text-sm font-semibold text-[var(--g66-text-secondary)]">
                  Todavía no hay acciones.
                </li>
              ) : null}
            </ol>
            <div className="mt-4 grid gap-2">
              <select
                onChange={(event) => {
                  if (!event.target.value) return;
                  addAction(event.target.value);
                  event.target.value = "";
                }}
                className={inputClassName()}
                defaultValue=""
              >
                <option value="">Agregar acción</option>
                {manualActionOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[var(--g66-border)] bg-[var(--g66-background)] text-sm font-semibold text-[var(--g66-text-secondary)]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Agregar lógica · Próximamente
              </button>
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}
