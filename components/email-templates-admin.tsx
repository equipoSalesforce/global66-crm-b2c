"use client";

import { defaultAiEmailTemplateHtml } from "@/lib/default-ai-email-template";
import { renderEmailTemplate } from "@/lib/email-template-renderer";
import { supportedEmailTemplateVariables } from "@/lib/email-template-variables";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Copy, Eye, FileText, FolderPlus, Plus, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type EmailTemplateFolderRecord = {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type EmailTemplateRecord = {
  id: string;
  folder_id: string | null;
  name: string;
  description: string | null;
  channel: string;
  template_type: string;
  subject: string | null;
  html_body: string | null;
  text_body: string | null;
  variables: string[] | null;
  tags: string[] | null;
  is_active: boolean;
  is_default_ai_template: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type TemplateFormState = {
  id: string | null;
  folder_id: string;
  name: string;
  description: string;
  channel: string;
  template_type: string;
  subject: string;
  html_body: string;
  text_body: string;
  tags: string;
  is_active: boolean;
  is_default_ai_template: boolean;
};

const emptyTemplateForm: TemplateFormState = {
  id: null,
  folder_id: "",
  name: "",
  description: "",
  channel: "EMAIL",
  template_type: "HTML",
  subject: "",
  html_body: "",
  text_body: "",
  tags: "",
  is_active: true,
  is_default_ai_template: false,
};

const sampleContext = {
  customer: {
    name: "Katherine",
    email: "katherine@test.com",
    phone: "+56995722817",
  },
  case: {
    case_number: "000014",
    subject: "Información sobre tu transferencia",
    status: "IN_PROGRESS",
    lifecycle_status: "IN_PROGRESS",
    priority: "MEDIUM",
    channel: "EMAIL",
  },
  agent: {
    name: "Global66 Soporte",
    email: "soporte@global66.com",
  },
};

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTemplateForm(template: EmailTemplateRecord): TemplateFormState {
  return {
    id: template.id,
    folder_id: template.folder_id || "",
    name: template.name,
    description: template.description || "",
    channel: template.channel || "EMAIL",
    template_type: template.template_type || "HTML",
    subject: template.subject || "",
    html_body: template.html_body || "",
    text_body: template.text_body || "",
    tags: (template.tags || []).join(", "),
    is_active: template.is_active,
    is_default_ai_template: template.is_default_ai_template,
  };
}

export function EmailTemplatesAdmin() {
  const [folders, setFolders] = useState<EmailTemplateFolderRecord[]>([]);
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderParentId, setFolderParentId] = useState("");
  const [folderActive, setFolderActive] = useState(true);
  const [form, setForm] = useState<TemplateFormState>(emptyTemplateForm);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplateRecord | TemplateFormState | null>(null);

  async function loadData() {
    const [foldersResult, templatesResult] = await Promise.all([
      supabaseBrowser
        .from("email_template_folders")
        .select("*")
        .order("name", { ascending: true })
        .returns<EmailTemplateFolderRecord[]>(),
      supabaseBrowser
        .from("email_templates")
        .select("*")
        .order("updated_at", { ascending: false })
        .returns<EmailTemplateRecord[]>(),
    ]);

    if (foldersResult.error || templatesResult.error) {
      console.error("[email-templates-admin] load error", {
        foldersError: foldersResult.error,
        templatesError: templatesResult.error,
      });
      setMessage("No se pudieron cargar los templates.");
      return;
    }

    setFolders(foldersResult.data ?? []);
    setTemplates(templatesResult.data ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesFolder =
        selectedFolderId === "all" || template.folder_id === selectedFolderId;
      const matchesSearch =
        !query ||
        template.name.toLowerCase().includes(query) ||
        (template.subject || "").toLowerCase().includes(query) ||
        (template.description || "").toLowerCase().includes(query);

      return matchesFolder && matchesSearch;
    });
  }, [search, selectedFolderId, templates]);

  const previewHtml = useMemo(() => {
    if (!previewTemplate) return "";

    return renderEmailTemplate({
      htmlTemplate:
        previewTemplate.html_body || defaultAiEmailTemplateHtml,
      subject: previewTemplate.subject || "Preview template",
      body:
        previewTemplate.text_body ||
        "Hola Katherine,\n\nEste es un ejemplo de respuesta usando el cuerpo dinámico del template.",
      context: sampleContext,
    }).html;
  }, [previewTemplate]);

  async function createFolder() {
    if (!folderName.trim()) {
      setMessage("El nombre de la carpeta es requerido.");
      return;
    }

    const { error } = await supabaseBrowser.from("email_template_folders").insert({
      name: folderName.trim(),
      description: folderDescription.trim() || null,
      parent_id: folderParentId || null,
      is_active: folderActive,
    });

    if (error) {
      console.error("[email-templates-admin] create folder error", error);
      setMessage("No se pudo crear la carpeta.");
      return;
    }

    setFolderName("");
    setFolderDescription("");
    setFolderParentId("");
    setFolderActive(true);
    setMessage("Carpeta creada.");
    await loadData();
  }

  async function saveTemplate() {
    if (!form.name.trim() || !form.subject.trim()) {
      setMessage("Nombre y asunto son requeridos.");
      return;
    }

    setIsSaving(true);
    const payload = {
      folder_id: form.folder_id || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      channel: form.channel.trim().toUpperCase() || "EMAIL",
      template_type: form.template_type,
      subject: form.subject.trim(),
      html_body: form.html_body.trim() || null,
      text_body: form.text_body.trim() || null,
      variables: supportedEmailTemplateVariables.map((variable) =>
        variable.replace("{{", "").replace("}}", ""),
      ),
      tags: parseCommaList(form.tags),
      is_active: form.is_active,
      is_default_ai_template: form.is_default_ai_template,
      updated_at: new Date().toISOString(),
    };

    const result = form.id
      ? await supabaseBrowser.from("email_templates").update(payload).eq("id", form.id)
      : await supabaseBrowser.from("email_templates").insert(payload);

    setIsSaving(false);

    if (result.error) {
      console.error("[email-templates-admin] save template error", result.error);
      setMessage("No se pudo guardar el template.");
      return;
    }

    setForm(emptyTemplateForm);
    setMessage("Template guardado.");
    await loadData();
  }

  async function duplicateTemplate(template: EmailTemplateRecord) {
    const { error } = await supabaseBrowser.from("email_templates").insert({
      folder_id: template.folder_id,
      name: `Copia de ${template.name}`,
      description: template.description,
      channel: template.channel,
      template_type: template.template_type,
      subject: template.subject,
      html_body: template.html_body,
      text_body: template.text_body,
      variables: template.variables || [],
      tags: template.tags || [],
      is_active: true,
      is_default_ai_template: false,
    });

    if (error) {
      console.error("[email-templates-admin] duplicate template error", error);
      setMessage("No se pudo duplicar el template.");
      return;
    }

    setMessage("Template duplicado.");
    await loadData();
  }

  function insertVariable(variable: string) {
    setForm((current) => ({
      ...current,
      html_body: `${current.html_body}${current.html_body ? "\n" : ""}${variable}`,
    }));
  }

  return (
    <div className="grid gap-5">
      {message ? (
        <div className="rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-[var(--g66-surface-soft)] px-4 py-3 text-sm font-bold text-[var(--g66-text-primary)]">
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="grid content-start gap-4">
          <section className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
            <h2 className="flex items-center gap-2 text-sm font-black text-[var(--g66-text-primary)]">
              <FolderPlus className="h-4 w-4 text-[var(--g66-brand-blue)]" />
              Carpetas
            </h2>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => setSelectedFolderId("all")}
                className={`rounded-[var(--g66-radius-sm)] px-3 py-2 text-left text-sm font-bold ${
                  selectedFolderId === "all"
                    ? "bg-[var(--g66-brand-blue)] text-white"
                    : "bg-[var(--g66-surface-soft)] text-[var(--g66-text-secondary)]"
                }`}
              >
                Todas
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`rounded-[var(--g66-radius-sm)] px-3 py-2 text-left text-sm font-bold ${
                    selectedFolderId === folder.id
                      ? "bg-[var(--g66-brand-blue)] text-white"
                      : "bg-[var(--g66-surface-soft)] text-[var(--g66-text-secondary)]"
                  }`}
                >
                  {folder.name}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
            <h2 className="text-sm font-black text-[var(--g66-text-primary)]">
              Nueva carpeta
            </h2>
            <div className="mt-3 grid gap-2">
              <input
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                placeholder="Nombre"
                className="h-10 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]"
              />
              <input
                value={folderDescription}
                onChange={(event) => setFolderDescription(event.target.value)}
                placeholder="Descripción"
                className="h-10 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]"
              />
              <select
                value={folderParentId}
                onChange={(event) => setFolderParentId(event.target.value)}
                className="h-10 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]"
              >
                <option value="">Sin carpeta padre</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs font-bold text-[var(--g66-text-secondary)]">
                <input
                  type="checkbox"
                  checked={folderActive}
                  onChange={(event) => setFolderActive(event.target.checked)}
                />
                Activa
              </label>
              <button
                type="button"
                onClick={createFolder}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-4 text-sm font-black text-white hover:bg-[var(--g66-brand-blue-hover)]"
              >
                <Plus className="h-4 w-4" />
                Crear carpeta
              </button>
            </div>
          </section>
        </aside>

        <section className="grid gap-4">
          <div className="rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-[var(--g66-text-primary)]">
                  Templates
                </h2>
                <p className="text-sm font-semibold text-[var(--g66-text-secondary)]">
                  Crea, edita, duplica y previsualiza respuestas de correo.
                </p>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar template..."
                className="h-10 w-full rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)] sm:w-72"
              />
            </div>
            <div className="mt-4 overflow-hidden rounded-[var(--g66-radius-md)] border border-[var(--g66-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--g66-surface-soft)] text-xs uppercase text-[var(--g66-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Asunto</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Actualizado</th>
                    <th className="px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g66-border-soft)]">
                  {filteredTemplates.map((template) => (
                    <tr key={template.id} className="hover:bg-[var(--g66-surface-soft)]">
                    <td className="px-3 py-2 font-black text-[var(--g66-text-primary)]">
                      {template.name}
                      {template.is_default_ai_template ? (
                        <span className="ml-2 rounded-full bg-[var(--g66-brand-blue-soft)] px-2 py-0.5 text-[10px] text-[var(--g66-brand-blue)]">
                          Default IA
                        </span>
                      ) : null}
                      <span className="ml-2 rounded-full bg-[var(--g66-surface-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--g66-text-secondary)]">
                        {template.html_body?.includes("{{email.body}}")
                          ? "Tiene bloque dinámico"
                          : "HTML editable completo"}
                      </span>
                    </td>
                      <td className="px-3 py-2 text-[var(--g66-text-secondary)]">
                        {template.subject}
                      </td>
                      <td className="px-3 py-2">{template.template_type}</td>
                      <td className="px-3 py-2">
                        {template.is_active ? "Activo" : "Inactivo"}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--g66-text-muted)]">
                        {template.updated_at
                          ? new Date(template.updated_at).toLocaleString("es-CL")
                          : "Sin fecha"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => setForm(getTemplateForm(template))}
                            className="rounded-md border border-[var(--g66-border)] px-2 py-1 text-xs font-bold text-[var(--g66-brand-blue)]"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateTemplate(template)}
                            className="rounded-md border border-[var(--g66-border)] px-2 py-1 text-xs font-bold text-[var(--g66-text-secondary)]"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewTemplate(template)}
                            className="rounded-md border border-[var(--g66-border)] px-2 py-1 text-xs font-bold text-[var(--g66-text-secondary)]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white p-4 shadow-[var(--g66-shadow-card)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-black text-[var(--g66-text-primary)]">
                <FileText className="h-5 w-5 text-[var(--g66-brand-blue)]" />
                {form.id ? "Editar template" : "Nuevo template"}
              </h2>
              <button
                type="button"
                onClick={() => setForm(emptyTemplateForm)}
                className="rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-3 py-2 text-xs font-black text-[var(--g66-text-secondary)]"
              >
                Limpiar
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nombre" className="h-10 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]" />
              <select value={form.folder_id} onChange={(event) => setForm({ ...form, folder_id: event.target.value })} className="h-10 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]">
                <option value="">Sin carpeta</option>
                {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
              <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Asunto" className="h-10 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)] md:col-span-2" />
              <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Descripción" className="h-10 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)] md:col-span-2" />
              <select value={form.template_type} onChange={(event) => setForm({ ...form, template_type: event.target.value })} className="h-10 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]">
                <option value="HTML">HTML</option>
                <option value="TEXT">Texto</option>
              </select>
              <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Tags separados por coma" className="h-10 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] px-3 text-sm font-semibold outline-none focus:border-[var(--g66-brand-blue)]" />
            </div>
            <textarea value={form.html_body} onChange={(event) => setForm({ ...form, html_body: event.target.value })} placeholder="Cuerpo HTML" className="min-h-56 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] p-3 font-mono text-xs outline-none focus:border-[var(--g66-brand-blue)]" />
            <textarea value={form.text_body} onChange={(event) => setForm({ ...form, text_body: event.target.value })} placeholder="Cuerpo texto opcional" className="min-h-24 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] p-3 text-sm outline-none focus:border-[var(--g66-brand-blue)]" />
            <div className="flex flex-wrap gap-2">
              {supportedEmailTemplateVariables.map((variable) => (
                <button key={variable} type="button" onClick={() => insertVariable(variable)} className="rounded-full border border-[var(--g66-border)] px-2 py-1 font-mono text-[11px] font-bold text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]">
                  {variable}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-4 text-xs font-bold text-[var(--g66-text-secondary)]">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Activo</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_default_ai_template} onChange={(event) => setForm({ ...form, is_default_ai_template: event.target.checked })} /> Template por defecto IA</label>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPreviewTemplate(form)} className="inline-flex h-10 items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] px-4 text-sm font-black text-[var(--g66-brand-blue)]">
                  <Eye className="h-4 w-4" /> Previsualizar
                </button>
                <button type="button" onClick={saveTemplate} disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-4 text-sm font-black text-white hover:bg-[var(--g66-brand-blue-hover)] disabled:bg-[var(--g66-border)]">
                  <Save className="h-4 w-4" /> {isSaving ? "Guardando..." : "Guardar template"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {previewTemplate ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(16,33,63,0.32)] p-4">
          <div className="flex max-h-[90vh] w-[min(900px,100%)] flex-col overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-soft)]">
            <div className="flex items-center justify-between border-b border-[var(--g66-border)] px-4 py-3">
              <h3 className="text-base font-black text-[var(--g66-text-primary)]">
                Preview template
              </h3>
              <button type="button" onClick={() => setPreviewTemplate(null)} className="rounded-full px-3 py-1 text-xs font-black text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)]">
                Cerrar
              </button>
            </div>
            <iframe title="Preview template correo" srcDoc={previewHtml} sandbox="" className="h-[75vh] w-full bg-white" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
