"use client";

import { supabase } from "@/lib/supabase";
import { assignCaseAutomatically } from "@/lib/assignment";
import { generateNextCaseNumber } from "@/lib/case-number";
import {
  normalizeLifecycleStatus,
  normalizeRoutingStatus,
} from "@/lib/case-status";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useToast } from "./toast-provider";

const channels = ["WHATSAPP", "GMAIL", "WEB", "CHATBOT", "PHONE", "MANUAL"];
const contactTypes = ["WHATSAPP", "GMAIL", "WEB", "CHATBOT", "PHONE", "MANUAL"];
const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const areas = [
  "SOPORTE",
  "VENTAS",
  "FACTURACION",
  "OPERACIONES",
  "COMPLIANCE",
  "OTROS",
];
const categories = [
  "ACCESO",
  "PAGOS",
  "FACTURACION",
  "DOCUMENTACION",
  "INTEGRACION",
  "RECLAMO",
  "CONSULTA",
  "OTROS",
];
const statuses = ["AI_HANDLING", "HUMAN_REQUIRED", "ASSIGNED", "CLOSED"];

type CustomerOption = {
  id: string | number;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type CreatedCase = {
  id: string | number;
};

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-gray-950">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
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

export function NewCaseForm({ customers }: { customers: CustomerOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [customerId, setCustomerId] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [subject, setSubject] = useState("");
  const [channel, setChannel] = useState("WHATSAPP");
  const [contactType, setContactType] = useState("WHATSAPP");
  const [priority, setPriority] = useState("MEDIUM");
  const [area, setArea] = useState("SOPORTE");
  const [category, setCategory] = useState("CONSULTA");
  const [status, setStatus] = useState("HUMAN_REQUIRED");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchedCustomer = useMemo(() => {
    if (customerId) {
      return customers.find((customer) => String(customer.id) === customerId);
    }

    const normalizedEmail = contactEmail.trim().toLowerCase();
    const normalizedPhone = contactPhone.replace(/\D/g, "");

    if (normalizedEmail) {
      const emailMatch = customers.find(
        (customer) => customer.email?.trim().toLowerCase() === normalizedEmail,
      );

      if (emailMatch) {
        return emailMatch;
      }
    }

    if (normalizedPhone) {
      return customers.find(
        (customer) => customer.phone?.replace(/\D/g, "") === normalizedPhone,
      );
    }

    return undefined;
  }, [contactEmail, contactPhone, customerId, customers]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedSubject = subject.trim();
    const trimmedEmail = contactEmail.trim();
    const trimmedPhone = contactPhone.trim();
    const trimmedName = contactName.trim();
    const resolvedCustomerId = matchedCustomer?.id
      ? String(matchedCustomer.id)
      : "";

    if (!trimmedSubject) {
      setError("Escribe un asunto para el caso.");
      toast.error("✗ No se pudieron guardar los cambios");
      return;
    }

    if (!resolvedCustomerId && !trimmedEmail && !trimmedPhone) {
      setError("Selecciona un cliente o ingresa email o teléfono de contacto.");
      toast.error("✗ No se pudieron guardar los cambios");
      return;
    }

    setIsCreating(true);
    setError(null);

    const now = new Date().toISOString();
    const caseNumber = await generateNextCaseNumber();
    const lifecycleStatus = normalizeLifecycleStatus(null, status);
    const routingStatus = normalizeRoutingStatus({
      routingStatus: null,
      status,
      assignedAgentId: null,
    });
    const { data, error: insertError } = await supabase
      .from("cases")
      .insert({
        case_number: caseNumber,
        customer_id: resolvedCustomerId || null,
        contact_email: trimmedEmail || null,
        contact_phone: trimmedPhone || null,
        contact_name: trimmedName || null,
        subject: trimmedSubject,
        channel,
        contact_type: contactType,
        priority,
        area,
        category,
        status,
        lifecycle_status: lifecycleStatus,
        routing_status: routingStatus,
        updated_at: now,
        closed_at: status === "CLOSED" ? now : null,
      })
      .select("id")
      .single<CreatedCase>();

    if (insertError || !data?.id) {
      console.error("[new-case-form] Error creating case", {
        message: insertError?.message ?? "No case id returned",
        supabaseError: insertError,
      });
      setError(insertError?.message ?? "No se pudo crear el caso.");
      toast.error("✗ No se pudieron guardar los cambios");
      setIsCreating(false);
      return;
    }

    toast.success("✓ Cambios guardados correctamente");

    if (status !== "CLOSED") {
      const assignmentResult = await assignCaseAutomatically(String(data.id));

      if (assignmentResult.status === "assigned") {
        toast.success("✓ Caso asignado automáticamente");
      } else if (assignmentResult.status === "no_agent") {
        toast.info("No hay agentes disponibles para este caso");
      } else {
        console.error("[new-case-form] Error assigning case automatically", {
          reason: assignmentResult.reason,
          error: assignmentResult.error,
        });
        toast.error("✗ No se pudo asignar automáticamente");
      }
    }

    router.push(`/casos/${data.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <label className="grid gap-2 lg:col-span-2">
          <span className="text-sm font-semibold text-gray-950">
            Cliente existente
          </span>
          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
          >
            <option value="">Sin cliente relacionado</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name || customer.email || customer.phone || customer.id}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            Si el email o teléfono coincide con un cliente, se relacionará
            automáticamente.
          </span>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-gray-950">
            Contact Email
          </span>
          <input
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder="cliente@empresa.com"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none placeholder:text-gray-400 focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold text-gray-950">
            Contact Phone
          </span>
          <input
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="+56 9 1234 5678"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none placeholder:text-gray-400 focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
          />
        </label>

        <label className="grid gap-2 lg:col-span-2">
          <span className="text-sm font-semibold text-gray-950">
            Contact Name
          </span>
          <input
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="Nombre de contacto"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none placeholder:text-gray-400 focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
          />
        </label>

        {matchedCustomer ? (
          <div className="rounded-lg border border-[var(--g66-border)] bg-[var(--g66-brand-blue-soft)] px-4 py-3 text-sm font-medium text-[var(--g66-brand-blue)] lg:col-span-2">
            Cliente relacionado:{" "}
            {matchedCustomer.name ||
              matchedCustomer.email ||
              matchedCustomer.phone ||
              matchedCustomer.id}
          </div>
        ) : null}

        <label className="grid gap-2 lg:col-span-2">
          <span className="text-sm font-semibold text-gray-950">Subject</span>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Ej: Cliente necesita ayuda con acceso"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-950 outline-none placeholder:text-gray-400 focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)]"
          />
        </label>

        <SelectField
          label="Channel"
          value={channel}
          onChange={setChannel}
          options={channels}
        />
        <SelectField
          label="Contact Type"
          value={contactType}
          onChange={setContactType}
          options={contactTypes}
        />
        <SelectField
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={priorities}
        />
        <SelectField label="Area" value={area} onChange={setArea} options={areas} />
        <SelectField
          label="Category"
          value={category}
          onChange={setCategory}
          options={categories}
        />
        <SelectField
          label="Status"
          value={status}
          onChange={setStatus}
          options={statuses}
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-h-5 text-sm text-[var(--g66-danger)]">{error}</p>
        <button
          type="submit"
          disabled={isCreating}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--g66-brand-blue)] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--g66-accent-cyan)] focus:outline-none focus:ring-2 focus:ring-[var(--g66-brand-blue)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isCreating ? "Guardando..." : "Crear caso"}
        </button>
      </div>
    </form>
  );
}
