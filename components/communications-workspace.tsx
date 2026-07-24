"use client";

import { EmailTemplatesAdmin } from "@/components/email-templates-admin";
import { QuickMessagesAdmin } from "@/components/quick-messages-admin";
import { Mail, MessageCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

const tabs = [
  { value: "email-templates", label: "Templates de correo", icon: Mail },
  { value: "quick-messages", label: "Mensajes rápidos", icon: MessageCircle },
] as const;

export function CommunicationsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab =
    searchParams.get("tab") === "quick-messages" ? "quick-messages" : "email-templates";

  return (
    <div className="grid gap-4">
      <header className="border-b border-[var(--g66-border)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g66-secondary-interactive)]">
          CRM
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--g66-text-primary)]">
          Comunicaciones
        </h1>
        <p className="mt-1 text-sm text-[var(--g66-text-secondary)]">
          Administra templates de correo y mensajes rápidos reutilizables.
        </p>
        <div className="mt-4 flex gap-6" role="tablist" aria-label="Contenido de comunicaciones">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => router.replace(`/comunicaciones?tab=${tab.value}`, { scroll: false })}
                className={`inline-flex h-10 items-center gap-2 border-b-2 px-1 text-sm font-medium transition ${
                  selected
                    ? "border-[var(--g66-brand-blue)] text-[var(--g66-brand-blue)]"
                    : "border-transparent text-[var(--g66-text-secondary)] hover:text-[var(--g66-secondary-interactive)]"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>
      <div role="tabpanel">
        {activeTab === "email-templates" ? <EmailTemplatesAdmin /> : <QuickMessagesAdmin />}
      </div>
    </div>
  );
}
