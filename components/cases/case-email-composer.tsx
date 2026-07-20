"use client";

import {
  Bold,
  Braces,
  ChevronDown,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Sparkles,
  Underline,
  X,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  HtmlEmailTemplateEditor,
  type HtmlEmailTemplateEditorHandle,
  type HtmlEmailTemplateEditorSnapshot,
} from "@/components/cases/html-email-template-editor";
import {
  renderEmailTemplateWithBodyHtml,
  stripEditorOnlyMarkup,
  textToEmailHtml,
} from "@/lib/email-template-renderer";
import type { EmailTemplateVariableContext } from "@/lib/email-template-variables";
import { supportedEmailTemplateVariables } from "@/lib/email-template-variables";
import { supabaseBrowser } from "@/lib/supabase-browser";

export type CaseEmailComposerState = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  bodyText?: string;
  bodyHtml?: string;
  htmlBody?: string;
  attachments?: EmailComposerAttachmentPayload[];
};

export type EmailComposerAttachmentPayload = {
  filename: string;
  contentType?: string;
  size?: number;
  contentBase64: string;
};

type EmailComposerSnapshot = CaseEmailComposerState & {
  bodyText: string;
  finalHtml: string;
  bodyTextLength: number;
  bodyHtmlLength: number;
  finalHtmlLength: number;
  endpointPayloadBodyLength: number;
  attachmentsCount: number;
  selectedTemplateName: string;
  canPreview: boolean;
  canSend: boolean;
  lastSyncAt: string;
  syncStatus: "OK" | "ERROR" | "PENDING";
  editorMode: "iframe" | "contentEditable" | "iframe-full-html" | "fallback";
  editorNodeFound: boolean;
  syncError?: string;
};

type ComposerCase = {
  id: string;
  case_number: string | null;
  subject: string | null;
  status: string | null;
  lifecycle_status: string | null;
  priority?: string | null;
  contact_email: string | null;
  contact_name: string | null;
  contact_phone?: string | null;
  channel?: string | null;
  customer: {
    name: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

type CurrentUser = {
  name: string;
  email: string;
};

type CaseEmailComposerProps = {
  caseItem: ComposerCase;
  currentUser: CurrentUser;
  composer: CaseEmailComposerState;
  isDirty: boolean;
  isSending: boolean;
  isSyncing: boolean;
  disabled: boolean;
  onComposerChange: (composer: CaseEmailComposerState) => void;
  onDirtyChange: (isDirty: boolean) => void;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
    composerSnapshot?: CaseEmailComposerState,
  ) => void;
  onSyncEmails: () => void;
};

type EmailTemplateFolderRecord = {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
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
  updated_at: string | null;
};

type RewriteAction = "formalize" | "clarify" | "shorten" | "empathetic";

const formatToolbarButtons = [
  { label: "Negrita", command: "bold", icon: <Bold className="h-4 w-4" aria-hidden="true" /> },
  { label: "Cursiva", command: "italic", icon: <Italic className="h-4 w-4" aria-hidden="true" /> },
  { label: "Subrayado", command: "underline", icon: <Underline className="h-4 w-4" aria-hidden="true" /> },
  { label: "Lista", command: "insertUnorderedList", icon: <List className="h-4 w-4" aria-hidden="true" /> },
  { label: "Lista numerada", command: "insertOrderedList", icon: <ListOrdered className="h-4 w-4" aria-hidden="true" /> },
];
const maxAttachmentCount = 10;
const maxAttachmentSizeBytes = 20 * 1024 * 1024;

function getCustomerName(caseItem: ComposerCase) {
  return (
    caseItem.customer?.name ||
    caseItem.contact_name ||
    caseItem.customer?.email ||
    caseItem.contact_email ||
    "cliente"
  );
}

function getCustomerEmail(caseItem: ComposerCase) {
  return caseItem.customer?.email || caseItem.contact_email || "";
}

function getCustomerPhone(caseItem: ComposerCase) {
  return caseItem.customer?.phone || caseItem.contact_phone || "";
}

function getCaseNumber(caseItem: ComposerCase) {
  return caseItem.case_number ? `#${caseItem.case_number}` : "#TEMP";
}

function resolveVariables(
  value: string,
  caseItem: ComposerCase,
  currentUser: CurrentUser,
) {
  return value
    .replaceAll("{{customer.name}}", getCustomerName(caseItem))
    .replaceAll("{{customer.email}}", getCustomerEmail(caseItem))
    .replaceAll("{{customer.phone}}", getCustomerPhone(caseItem))
    .replaceAll("{{case.case_number}}", getCaseNumber(caseItem))
    .replaceAll("{{case.subject}}", caseItem.subject || "tu caso")
    .replaceAll("{{agent.name}}", currentUser.name || "Global66 Soporte")
    .replaceAll("{{agent.email}}", currentUser.email || "soporte@global66.com")
    .replaceAll("{{case.status}}", caseItem.lifecycle_status || caseItem.status || "En revisión")
    .replaceAll("{{case.priority}}", caseItem.priority || "")
    .replaceAll("{{case.channel}}", caseItem.channel || "");
}

function htmlToEditableText(html: string) {
  return html
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitRecipients(value: string) {
  return value
    .split(/[;,]/)
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

function htmlToPlainText(html: string) {
  return htmlToEditableText(html).trim();
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToAttachmentPayload(file: File): Promise<EmailComposerAttachmentPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el adjunto."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const [, contentBase64 = ""] = result.split(",");

      if (!contentBase64) {
        reject(new Error(`No se pudo preparar el adjunto ${file.name}.`));
        return;
      }

      resolve({
        filename: file.name,
        contentType: file.type || undefined,
        size: file.size,
        contentBase64,
      });
    };
    reader.readAsDataURL(file);
  });
}

function insertHtmlAfterBodyStart(html: string, insertedHtml: string) {
  if (/<body\b[^>]*>/i.test(html)) {
    return html.replace(/<body\b([^>]*)>/i, `<body$1>${insertedHtml}`);
  }

  return `${insertedHtml}${html}`;
}

function cleanFinalEmailHtml(html: string) {
  return stripEditorOnlyMarkup(html);
}

function countOccurrences(value: string, needle: string) {
  if (!value || !needle) return 0;

  return value.split(needle).length - 1;
}

function ComposerField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-black text-[var(--g66-text-secondary)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmailAttachmentChips({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (file: File) => void;
}) {
  if (files.length === 0) {
    return (
      <span className="text-[11px] font-bold text-[var(--g66-text-secondary)]">
        Arrastra archivos aquí o haz clic para adjuntar · Máx. 10 archivos · 20 MB por archivo
      </span>
    );
  }

  return (
    <>
      {files.map((file) => (
        <span
          key={`${file.name}-${file.size}-${file.lastModified}`}
          className="inline-flex h-8 max-w-[260px] items-center gap-1 rounded-full border border-[var(--g66-border)] bg-white px-2.5 text-[11px] font-bold text-[var(--g66-text-secondary)]"
        >
          <span className="truncate">{file.name}</span>
          <span className="shrink-0 text-[var(--g66-text-muted)]">
            · {formatFileSize(file.size)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(file)}
            className="shrink-0 rounded-full p-0.5 text-[var(--g66-text-muted)] hover:bg-[var(--g66-danger-soft)] hover:text-[var(--g66-danger)]"
            aria-label={`Quitar ${file.name}`}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}
    </>
  );
}

export function CaseEmailComposer({
  caseItem,
  currentUser,
  composer,
  isDirty,
  isSending,
  isSyncing,
  disabled,
  onComposerChange,
  onDirtyChange,
  onSubmit,
  onSyncEmails,
}: CaseEmailComposerProps) {
  const [openMenu, setOpenMenu] = useState<"template" | "variable" | "attach" | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<EmailComposerSnapshot | null>(null);
  const [, setDebugSnapshot] = useState<EmailComposerSnapshot | null>(null);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [templateFolders, setTemplateFolders] = useState<EmailTemplateFolderRecord[]>([]);
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateFolderFilter, setTemplateFolderFilter] = useState("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [, setBodySource] = useState<"manual" | "template" | "ai">("manual");
  const [aiModalTab, setAiModalTab] = useState<"suggest" | "rewrite">("suggest");
  const [rawRewriteMessage, setRawRewriteMessage] = useState("");
  const [rewrittenText, setRewrittenText] = useState("");
  const [rewriteWarnings, setRewriteWarnings] = useState<string[]>([]);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [rewriteAction, setRewriteAction] = useState<RewriteAction | null>(null);
  const [aiDraft, setAiDraft] = useState("");
  const [isGeneratingAiSuggestion, setIsGeneratingAiSuggestion] = useState(false);
  const htmlEditorRef = useRef<HtmlEmailTemplateEditorHandle | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const wasSendingRef = useRef(isSending);
  const customerEmail = getCustomerEmail(caseItem);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const aiReplyTemplate = templates.find((template) => {
    const templateType = template.template_type?.toUpperCase().trim();
    const name = template.name.toLowerCase();
    const tags = template.tags?.map((tag) => tag.toLowerCase()) ?? [];

    return (
      template.is_active &&
      (templateType === "AI_REPLY" ||
        template.is_default_ai_template ||
        name.includes("respuesta ia") ||
        tags.includes("ai"))
    );
  });
  const emailTemplateContext = useMemo<EmailTemplateVariableContext>(
    () => ({
      customer: {
        name: getCustomerName(caseItem),
        email: getCustomerEmail(caseItem),
        phone: getCustomerPhone(caseItem),
      },
      case: {
        case_number: caseItem.case_number,
        subject: caseItem.subject,
        status: caseItem.status,
        lifecycle_status: caseItem.lifecycle_status,
        priority: caseItem.priority,
        channel: caseItem.channel,
      },
      agent: currentUser,
    }),
    [caseItem, currentUser],
  );
  const activeHtmlTemplate = selectedTemplate?.html_body || "";
  const canRenderTemplateEditor = Boolean(activeHtmlTemplate);
  const draftSavedLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date()),
    [],
  );
  const previewHtml = useMemo(
    () => {
      if (composer.htmlBody) return composer.htmlBody;
      if (!activeHtmlTemplate) return textToEmailHtml(composer.bodyText || composer.body);

      return renderEmailTemplateWithBodyHtml({
        htmlTemplate: activeHtmlTemplate,
        subject: composer.subject,
        body: composer.body,
        bodyHtml: composer.bodyHtml || textToEmailHtml(composer.body),
        context: emailTemplateContext,
      }).html;
    },
    [
      activeHtmlTemplate,
      composer.body,
      composer.bodyText,
      composer.bodyHtml,
      composer.htmlBody,
      composer.subject,
      emailTemplateContext,
    ],
  );
  const filteredTemplates = templates.filter((template) => {
    const matchesFolder =
      templateFolderFilter === "all" || template.folder_id === templateFolderFilter;
    const query = templateSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      template.name.toLowerCase().includes(query) ||
      (template.subject || "").toLowerCase().includes(query) ||
      (template.description || "").toLowerCase().includes(query);

    return template.is_active && matchesFolder && matchesSearch;
  });

  useEffect(() => {
    let isMounted = true;

    async function loadTemplates() {
      setTemplateError(null);

      const [foldersResult, templatesResult] = await Promise.all([
        supabaseBrowser
          .from("email_template_folders")
          .select("id,name,description,parent_id,is_active")
          .order("name", { ascending: true })
          .returns<EmailTemplateFolderRecord[]>(),
        supabaseBrowser
          .from("email_templates")
          .select("id,folder_id,name,description,channel,template_type,subject,html_body,text_body,variables,tags,is_active,is_default_ai_template,updated_at")
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .returns<EmailTemplateRecord[]>(),
      ]);

      if (!isMounted) return;

      if (foldersResult.error || templatesResult.error) {
        console.error("[case-email-composer] Error loading templates", {
          foldersError: foldersResult.error,
          templatesError: templatesResult.error,
        });
        setTemplateError("No se pudieron cargar los templates.");
        return;
      }

      setTemplateFolders(foldersResult.data ?? []);
      setTemplates(templatesResult.data ?? []);
    }

    loadTemplates();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (wasSendingRef.current && !isSending && (composer.attachments?.length ?? 0) === 0) {
      setLocalFiles([]);
    }
    wasSendingRef.current = isSending;
  }, [composer.attachments?.length, isSending]);

  function updateComposer(nextComposer: CaseEmailComposerState) {
    onComposerChange(nextComposer);
    onDirtyChange(true);
    setFieldErrors({});
    setComposerNotice(null);
  }

  function renderAiTemplateHtml(template: EmailTemplateRecord, body: string, bodyHtml: string) {
    const htmlTemplate = template.html_body || "";
    const hasEditableSlot = /\{\{\s*email\.body\s*\}\}/.test(htmlTemplate);
    const subject = resolveVariables(template.subject || composer.subject, caseItem, currentUser);

    if (!htmlTemplate) {
      return {
        subject,
        bodyHtml: cleanFinalEmailHtml(bodyHtml),
        finalHtml: cleanFinalEmailHtml(bodyHtml),
      };
    }

    if (hasEditableSlot) {
      const finalHtml = renderEmailTemplateWithBodyHtml({
        htmlTemplate,
        subject,
        body,
        bodyHtml,
        context: emailTemplateContext,
      }).html;

      return {
        subject,
        bodyHtml: cleanFinalEmailHtml(bodyHtml),
        finalHtml: cleanFinalEmailHtml(finalHtml),
      };
    }

    const renderedTemplate = renderEmailTemplateWithBodyHtml({
      htmlTemplate,
      subject,
      body,
      bodyHtml,
      context: emailTemplateContext,
    }).html;
    const finalHtml = cleanFinalEmailHtml(insertHtmlAfterBodyStart(renderedTemplate, bodyHtml));

    return {
      subject,
      bodyHtml: finalHtml,
      finalHtml,
    };
  }

  function applyAiDraftToComposer(aiText: string) {
    const body = aiText.trim();
    if (!body) return;

    const bodyHtml = textToEmailHtml(body);
    const template = aiReplyTemplate;
    const rendered = template
      ? renderAiTemplateHtml(template, body, bodyHtml)
      : {
          subject: composer.subject,
          bodyHtml,
          finalHtml: bodyHtml,
        };
    const nextComposer = {
      ...composer,
      subject: rendered.subject,
      body,
      bodyText: body,
      bodyHtml: rendered.bodyHtml,
      htmlBody: rendered.finalHtml,
    };

    setSelectedTemplateId(template?.id ?? null);
    updateComposer(nextComposer);
    setDebugSnapshot({
      ...buildDebugSnapshotFromEditor(nextComposer),
      selectedTemplateName: template?.name || "ninguno",
      syncStatus: "OK",
      syncError: undefined,
    });
    setPreviewSnapshot(null);
    setBodySource("ai");
    setEditorVersion((version) => version + 1);
    if (!template) {
      setComposerNotice("No hay template AI_REPLY activo. Se insertó la respuesta IA como contenido simple.");
    }
    setIsAiModalOpen(false);
  }

  function applyTemplate(template: EmailTemplateRecord) {
    const subject = resolveVariables(template.subject || composer.subject, caseItem, currentUser);
    const textBody = template.text_body?.trim()
      ? resolveVariables(template.text_body, caseItem, currentUser)
      : "";
    const hasEditableSlot = Boolean(template.html_body && /\{\{\s*email\.body\s*\}\}/.test(template.html_body));
    const renderedHtml = template.html_body
      ? renderEmailTemplateWithBodyHtml({
          htmlTemplate: template.html_body,
          subject,
          body: textBody || composer.body,
          bodyHtml: textToEmailHtml(textBody || composer.body),
          context: emailTemplateContext,
        }).html
      : "";
    const resolvedBody = hasEditableSlot
      ? textBody.trim() && textBody.trim() !== "{{email.body}}"
        ? textBody
        : composer.body
      : textBody || htmlToEditableText(renderedHtml || resolveVariables(template.html_body || "", caseItem, currentUser));

    updateComposer({
      ...composer,
      subject,
      body: resolvedBody,
      bodyHtml: hasEditableSlot ? undefined : renderedHtml,
      htmlBody: renderedHtml || undefined,
    });
    setSelectedTemplateId(template.id);
    setBodySource("template");
    setOpenMenu(null);
  }

  function insertVariable(variable: string) {
    if (canRenderTemplateEditor && htmlEditorRef.current) {
      htmlEditorRef.current.insertHtml(`<span>${variable}</span>`);
      setBodySource("manual");
      setOpenMenu(null);
      return;
    }

    updateComposer({
      ...composer,
      body: `${composer.body.trimEnd()}${composer.body.trim() ? "\n" : ""}${variable}`,
      bodyText: `${(composer.bodyText || composer.body).trimEnd()}${
        (composer.bodyText || composer.body).trim() ? "\n" : ""
      }${variable}`,
      bodyHtml: undefined,
      htmlBody: undefined,
    });
    setBodySource("manual");
    setOpenMenu(null);
  }

  function buildDebugSnapshotFromEditor(
    nextComposer: CaseEmailComposerState,
    editorSnapshot?: HtmlEmailTemplateEditorSnapshot,
  ): EmailComposerSnapshot {
    const bodyHtml =
      editorSnapshot?.bodyHtml ??
      nextComposer.bodyHtml ??
      (nextComposer.body ? textToEmailHtml(nextComposer.body) : "");
    const bodyText =
      editorSnapshot?.bodyText?.trim() ||
      nextComposer.bodyText?.trim() ||
      nextComposer.body.trim() ||
      htmlToPlainText(bodyHtml || nextComposer.htmlBody || "");
    const hasAnyContent = Boolean(bodyText.trim() || bodyHtml.trim() || nextComposer.htmlBody?.trim());
    const finalHtml = (() => {
      if (editorSnapshot?.finalHtml) return editorSnapshot.finalHtml;
      if (nextComposer.htmlBody) return nextComposer.htmlBody;
      if (activeHtmlTemplate) {
        return renderEmailTemplateWithBodyHtml({
          htmlTemplate: activeHtmlTemplate,
          subject: nextComposer.subject,
          body: bodyText,
          bodyHtml: bodyHtml || textToEmailHtml(bodyText),
          context: emailTemplateContext,
        }).html;
      }
      return bodyText || bodyHtml ? textToEmailHtml(bodyText || htmlToPlainText(bodyHtml)) : "";
    })();
    const cleanBodyHtml = cleanFinalEmailHtml(bodyHtml);
    const cleanFinalHtml = cleanFinalEmailHtml(finalHtml);
    const canUseContent = Boolean(
      bodyText.trim() ||
        cleanBodyHtml.trim() ||
        cleanFinalHtml.trim(),
    );

    return {
      ...nextComposer,
      body: bodyText,
      bodyText,
      bodyHtml: cleanBodyHtml,
      htmlBody: cleanFinalHtml,
      finalHtml: cleanFinalHtml,
      bodyTextLength: bodyText.trim().length,
      bodyHtmlLength: cleanBodyHtml.trim().length,
      finalHtmlLength: cleanFinalHtml.trim().length,
      endpointPayloadBodyLength: bodyText.trim().length,
      attachmentsCount: localFiles.length,
      selectedTemplateName: selectedTemplate?.name || "ninguno",
      canPreview: canUseContent,
      canSend: Boolean(nextComposer.to.trim() && nextComposer.subject.trim() && hasAnyContent),
      lastSyncAt:
        editorSnapshot?.lastSyncAt ||
        new Date().toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      syncStatus: editorSnapshot?.syncStatus || "OK",
      editorMode: editorSnapshot?.editorMode || "fallback",
      editorNodeFound: editorSnapshot?.editorNodeFound ?? false,
      syncError: canUseContent ? undefined : editorSnapshot?.error,
    };
  }

  // Single source of truth for Preview and Send:
  // 1. read the visible iframe/contentEditable editor with syncNow()
  // 2. keep editor HTML in bodyHtml
  // 3. derive plain text from the editor HTML
  // 4. keep final rendered email HTML in htmlBody/finalHtml
  async function getCurrentComposerSnapshot(): Promise<EmailComposerSnapshot> {
    const editorSnapshot = htmlEditorRef.current?.syncNow();
    const attachments = await Promise.all(localFiles.map(fileToAttachmentPayload));
    const snapshot = {
      ...buildDebugSnapshotFromEditor(composer, editorSnapshot),
      attachments,
      attachmentsCount: attachments.length,
    };

    setDebugSnapshot(snapshot);
    return snapshot;
  }

  async function validateBeforeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let currentComposer: EmailComposerSnapshot;

    try {
      currentComposer = await getCurrentComposerSnapshot();
    } catch (error) {
      setFieldErrors({
        attachments:
          error instanceof Error
            ? error.message
            : "No se pudieron preparar los adjuntos.",
      });
      return;
    }

    const nextErrors: Record<string, string> = {};
    const bodyText = currentComposer.bodyText.trim();
    const bodyHtml = currentComposer.bodyHtml?.trim() || "";
    const finalHtml = currentComposer.finalHtml?.trim() || "";

    if (!currentComposer.to.trim()) nextErrors.to = "Agrega al menos un destinatario.";
    if (!currentComposer.subject.trim()) nextErrors.subject = "El asunto es requerido.";
    if (currentComposer.syncStatus === "ERROR" && !bodyText && !bodyHtml && !finalHtml) {
      nextErrors.body =
        currentComposer.syncError ||
        "No se pudo leer el contenido del editor. Revisa syncNow().";
    }
    if (!bodyText && !bodyHtml && !finalHtml && !nextErrors.body) {
      nextErrors.body = "El cuerpo del correo está vacío.";
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      const htmlForSend = currentComposer.htmlBody || currentComposer.finalHtml || "";

      console.log("[email html compare - client]", {
        subject: currentComposer.subject,
        htmlBodyLength: htmlForSend.length,
        hasGlobal66Footer: htmlForSend.includes("Sé Global"),
        global66FooterCount: countOccurrences(htmlForSend, "Sé Global"),
      });
    }

    onComposerChange(currentComposer);
    onSubmit(event, currentComposer);
  }

  async function openPreview() {
    try {
      const snapshot = await getCurrentComposerSnapshot();
      if (snapshot.syncStatus === "ERROR" && !snapshot.canPreview) {
        setFieldErrors({
          body:
            snapshot.syncError ||
            "No se pudo leer el contenido del editor. Revisa syncNow().",
        });
        return;
      }
      if (!snapshot.canPreview) {
        setFieldErrors({
          body: "El cuerpo del correo está vacío.",
        });
        return;
      }
      setPreviewSnapshot(snapshot);
      onComposerChange(snapshot);
      setIsPreviewOpen(true);
    } catch (error) {
      setFieldErrors({
        attachments:
          error instanceof Error
            ? error.message
            : "No se pudieron preparar los adjuntos.",
      });
    }
  }

  function openAttachmentPicker() {
    if (disabled || isSending || isSyncing) return;

    setOpenMenu(null);
    attachmentInputRef.current?.click();
  }

  function handleAttachmentFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const selectedFiles = Array.from(files);
    const oversizedFile = selectedFiles.find((file) => file.size > maxAttachmentSizeBytes);

    if (oversizedFile) {
      setFieldErrors({
        attachments: `${oversizedFile.name} supera el máximo de 20 MB.`,
      });
      return;
    }

    setLocalFiles((currentFiles) => {
      const fileMap = new Map<string, File>();
      for (const file of currentFiles) {
        fileMap.set(`${file.name}-${file.size}-${file.lastModified}`, file);
      }
      for (const file of selectedFiles) {
        fileMap.set(`${file.name}-${file.size}-${file.lastModified}`, file);
      }

      const nextFiles = [...fileMap.values()].slice(0, maxAttachmentCount);
      if (fileMap.size > maxAttachmentCount) {
        setFieldErrors({
          attachments: `Solo se permiten ${maxAttachmentCount} adjuntos por correo.`,
        });
      } else {
        setFieldErrors({});
      }

      return nextFiles;
    });
    onDirtyChange(true);
    setOpenMenu(null);
  }

  function removeLocalFile(fileToRemove: File) {
    setLocalFiles((currentFiles) =>
      currentFiles.filter(
        (file) =>
          `${file.name}-${file.size}-${file.lastModified}` !==
          `${fileToRemove.name}-${fileToRemove.size}-${fileToRemove.lastModified}`,
      ),
    );
    onDirtyChange(true);
  }

  async function rewriteMessage(action: RewriteAction) {
    if (!rawRewriteMessage.trim()) {
      setRewriteError("Escribe un mensaje para mejorarlo.");
      return;
    }

    setRewriteAction(action);
    setRewriteError(null);
    setRewriteWarnings([]);

    try {
      const response = await fetch("/api/ai/email-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawMessage: rawRewriteMessage,
          action,
          context: {
            customer: {
              name: getCustomerName(caseItem),
              email: getCustomerEmail(caseItem),
            },
            case: {
              id: caseItem.id,
              case_number: caseItem.case_number,
              subject: caseItem.subject,
              status: caseItem.lifecycle_status || caseItem.status,
              priority: caseItem.priority,
            },
            agent: currentUser,
          },
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        rewrittenText?: string;
        warnings?: string[];
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.rewrittenText) {
        setRewriteError(payload.error || "No se pudo mejorar el texto.");
        return;
      }

      setRewrittenText(payload.rewrittenText);
      setRewriteWarnings(payload.warnings || []);
    } catch (error) {
      setRewriteError(error instanceof Error ? error.message : "No se pudo mejorar el texto.");
    } finally {
      setRewriteAction(null);
    }
  }

  async function openAiSuggestion() {
    if (isGeneratingAiSuggestion) return;
    setIsGeneratingAiSuggestion(true);
    setComposerNotice(null);
    try {
      const response = await fetch(`/api/cases/${caseItem.id}/ticket-suggestion`, {
        method: "POST",
      });
      const payload = (await response.json()) as { ok?: boolean; suggestion?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.suggestion) {
        throw new Error(payload.error || "No se pudo generar la sugerencia IA Ticket.");
      }
      setAiDraft(payload.suggestion);
      setAiModalTab("suggest");
      setIsAiModalOpen(true);
    } catch (error) {
      setComposerNotice(error instanceof Error ? error.message : "No se pudo generar la sugerencia IA Ticket.");
    } finally {
      setIsGeneratingAiSuggestion(false);
    }
  }

  const recipients = splitRecipients(composer.to || customerEmail);

  return (
    <form
      ref={formRef}
      key={`${caseItem.case_number || caseItem.subject}-email-composer`}
      onSubmit={validateBeforeSubmit}
      className="flex min-h-0 flex-1 flex-col bg-[var(--g66-background)]"
    >
      <input
        ref={attachmentInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(event) => {
          handleAttachmentFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto p-3 pb-3">
        <div className="overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-card)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] px-3 py-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "template" ? null : "template")}
                className="inline-flex h-9 items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-black text-[var(--g66-brand-blue)] transition hover:bg-[var(--g66-brand-blue-soft)]"
              >
                Template
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              {openMenu === "template" ? (
                <div className="absolute left-0 top-10 z-20 w-80 overflow-hidden rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-soft)]">
                  <div className="grid gap-2 border-b border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] p-2">
                    <input
                      value={templateSearch}
                      onChange={(event) => setTemplateSearch(event.target.value)}
                      placeholder="Buscar template..."
                      className="h-8 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-white px-2 text-xs font-semibold text-[var(--g66-text-primary)] outline-none focus:border-[var(--g66-brand-blue)]"
                    />
                    <select
                      value={templateFolderFilter}
                      onChange={(event) => setTemplateFolderFilter(event.target.value)}
                      className="h-8 rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-white px-2 text-xs font-semibold text-[var(--g66-text-primary)] outline-none focus:border-[var(--g66-brand-blue)]"
                    >
                      <option value="all">Todas las carpetas</option>
                      {templateFolders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {templateError ? (
                      <p className="px-3 py-3 text-xs font-bold text-[var(--g66-danger)]">
                        {templateError}
                      </p>
                    ) : null}
                    {filteredTemplates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="block w-full border-b border-[var(--g66-border-soft)] px-3 py-2 text-left hover:bg-[var(--g66-brand-blue-soft)]"
                      >
                        <span className="block text-xs font-black text-[var(--g66-text-primary)]">
                          {template.name}
                          {template.is_default_ai_template ? (
                            <span className="ml-2 rounded-full bg-[var(--g66-brand-blue-soft)] px-2 py-0.5 text-[10px] text-[var(--g66-brand-blue)]">
                              IA default
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] font-semibold text-[var(--g66-text-secondary)]">
                          {template.subject || "Sin asunto"}
                        </span>
                      </button>
                    ))}
                    {!templateError && filteredTemplates.length === 0 ? (
                      <p className="px-3 py-3 text-xs font-semibold text-[var(--g66-text-muted)]">
                        No hay templates activos para este filtro.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "variable" ? null : "variable")}
                className="inline-flex h-9 items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-black text-[var(--g66-brand-blue)] transition hover:bg-[var(--g66-brand-blue-soft)]"
              >
                <Braces className="h-4 w-4" aria-hidden="true" />
                Insertar variable
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              {openMenu === "variable" ? (
                <div className="absolute left-0 top-10 z-20 w-56 overflow-hidden rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-soft)]">
                  {supportedEmailTemplateVariables.map((variable) => (
                    <button
                      key={variable}
                      type="button"
                      onClick={() => insertVariable(variable)}
                      className="block w-full px-3 py-2 text-left font-mono text-xs font-bold text-[var(--g66-text-primary)] hover:bg-[var(--g66-brand-blue-soft)]"
                    >
                      {variable}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "attach" ? null : "attach")}
                className="inline-flex h-9 items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-black text-[var(--g66-brand-blue)] transition hover:bg-[var(--g66-brand-blue-soft)]"
              >
                <Paperclip className="h-4 w-4" aria-hidden="true" />
                Adjuntar
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              {openMenu === "attach" ? (
                <button
                  type="button"
                  onClick={openAttachmentPicker}
                  className="absolute left-0 top-10 z-20 block w-72 rounded-[var(--g66-radius-md)] border border-dashed border-[var(--g66-brand-blue)] bg-white p-3 text-left text-xs font-bold text-[var(--g66-text-secondary)] shadow-[var(--g66-shadow-soft)] hover:bg-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:border-[var(--g66-border)] disabled:text-[var(--g66-text-muted)]"
                  disabled={disabled || isSending || isSyncing}
                >
                  Seleccionar archivos locales para este borrador
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void openAiSuggestion()}
              disabled={isGeneratingAiSuggestion}
              className="ml-auto inline-flex h-9 items-center gap-2 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-black text-[var(--g66-brand-blue)] transition hover:bg-[var(--g66-brand-blue-soft)]"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {isGeneratingAiSuggestion ? "Generando..." : "Sugerencia IA"}
            </button>
          </div>

          <div className="grid gap-3 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <ComposerField label="De">
                <select
                  disabled={disabled}
                  className="h-11 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-sm font-bold text-[var(--g66-text-primary)] outline-none transition focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:bg-[var(--g66-background)]"
                >
                  <option>Global66 Soporte &lt;soporte@global66.com&gt;</option>
                  <option>{currentUser.name || "Agente"} &lt;{currentUser.email || "agente@global66.com"}&gt;</option>
                </select>
              </ComposerField>

              <ComposerField label="Para">
                <div
                  className={`min-h-11 rounded-[var(--g66-radius-md)] border bg-white px-2 py-1.5 transition focus-within:border-[var(--g66-brand-blue)] focus-within:ring-2 focus-within:ring-[var(--g66-brand-blue-soft)] ${
                    fieldErrors.to ? "border-[var(--g66-danger)]" : "border-[var(--g66-border)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {recipients.map((recipient) => (
                      <span
                        key={recipient}
                        className="inline-flex items-center rounded-full bg-[var(--g66-brand-blue-soft)] px-2 py-1 text-xs font-black text-[var(--g66-brand-blue)]"
                      >
                        {recipient}
                      </span>
                    ))}
                    <input
                      value={composer.to}
                      onChange={(event) =>
                        updateComposer({ ...composer, to: event.target.value })
                      }
                      disabled={disabled}
                      placeholder="Agregar destinatario..."
                      className="min-w-[180px] flex-1 border-0 bg-transparent px-1 py-1 text-sm font-semibold text-[var(--g66-text-primary)] outline-none placeholder:text-[var(--g66-text-muted)] disabled:text-[var(--g66-text-muted)]"
                    />
                  </div>
                </div>
                {fieldErrors.to ? (
                  <span className="text-[11px] font-bold text-[var(--g66-danger)]">
                    {fieldErrors.to}
                  </span>
                ) : null}
              </ComposerField>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <ComposerField label="CC">
                <input
                  value={composer.cc}
                  onChange={(event) =>
                    updateComposer({ ...composer, cc: event.target.value })
                  }
                  disabled={disabled}
                  placeholder="Agregar copia..."
                  className="h-10 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-sm font-semibold text-[var(--g66-text-primary)] outline-none transition focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:bg-[var(--g66-background)]"
                />
              </ComposerField>
              <ComposerField label="CCO">
                <input
                  value={composer.bcc}
                  onChange={(event) =>
                    updateComposer({ ...composer, bcc: event.target.value })
                  }
                  disabled={disabled}
                  placeholder="Agregar copia oculta..."
                  className="h-10 rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-sm font-semibold text-[var(--g66-text-primary)] outline-none transition focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:bg-[var(--g66-background)]"
                />
              </ComposerField>
            </div>

            <ComposerField label="Asunto">
              <input
                value={composer.subject}
                onChange={(event) =>
                  updateComposer({ ...composer, subject: event.target.value })
                }
                disabled={disabled}
                placeholder="Asunto del correo"
                className={`h-10 rounded-[var(--g66-radius-md)] border bg-white px-3 text-sm font-semibold text-[var(--g66-text-primary)] outline-none transition focus:border-[var(--g66-brand-blue)] focus:ring-2 focus:ring-[var(--g66-brand-blue-soft)] disabled:bg-[var(--g66-background)] ${
                  fieldErrors.subject ? "border-[var(--g66-danger)]" : "border-[var(--g66-border)]"
                }`}
              />
              {fieldErrors.subject ? (
                <span className="text-[11px] font-bold text-[var(--g66-danger)]">
                  {fieldErrors.subject}
                </span>
              ) : null}
            </ComposerField>

            <div className="overflow-hidden rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white">
              <div className="flex h-10 items-center gap-1 border-b border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] px-2">
                <select
                  aria-label="Formato de párrafo"
                  disabled={disabled}
                  defaultValue="p"
                  onChange={(event) => {
                    htmlEditorRef.current?.execCommand("formatBlock", event.target.value);
                    event.currentTarget.value = "p";
                  }}
                  className="h-8 rounded-md border border-[var(--g66-border)] bg-white px-2 text-xs font-bold text-[var(--g66-text-secondary)] outline-none hover:text-[var(--g66-brand-blue)] disabled:cursor-not-allowed disabled:text-[var(--g66-text-muted)]"
                >
                  <option value="p">Párrafo</option>
                  <option value="h2">Título</option>
                  <option value="h3">Subtítulo</option>
                </select>
                {formatToolbarButtons.map((button) => (
                  <button
                    key={button.label}
                    type="button"
                    title={button.label}
                    disabled={disabled}
                    onClick={() => htmlEditorRef.current?.execCommand(button.command)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--g66-text-secondary)] hover:bg-white hover:text-[var(--g66-brand-blue)]"
                  >
                    {button.icon}
                  </button>
                ))}
                <button
                  type="button"
                  title="Insertar link"
                  disabled={disabled}
                  onClick={() => {
                    const url = window.prompt("URL del enlace");
                    if (!url) return;
                    htmlEditorRef.current?.execCommand("createLink", url);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--g66-text-secondary)] hover:bg-white hover:text-[var(--g66-brand-blue)] disabled:cursor-not-allowed disabled:text-[var(--g66-text-muted)]"
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {canRenderTemplateEditor ? (
                <HtmlEmailTemplateEditor
                  key={`${selectedTemplateId || "manual"}-${editorVersion}`}
                  ref={htmlEditorRef}
                  htmlTemplate={activeHtmlTemplate}
                  subject={composer.subject}
                  body={composer.body}
                  bodyHtml={composer.bodyHtml}
                  finalHtml={composer.htmlBody}
                  context={emailTemplateContext}
                  disabled={disabled}
                  hasError={Boolean(fieldErrors.body)}
                  onBodyChange={(body, bodyHtml, finalHtml, editorSnapshot) => {
                    const nextComposer = {
                      ...composer,
                      body,
                      bodyText: body,
                      bodyHtml,
                      htmlBody: finalHtml,
                    };
                    updateComposer(nextComposer);
                    setDebugSnapshot(buildDebugSnapshotFromEditor(nextComposer, editorSnapshot));
                    setBodySource(selectedTemplate ? "template" : "manual");
                  }}
                />
              ) : (
                <>
                  <textarea
                    value={composer.body}
                    onChange={(event) => {
                      updateComposer({
                        ...composer,
                        body: event.target.value,
                        bodyText: event.target.value,
                        bodyHtml: event.target.value ? textToEmailHtml(event.target.value) : "",
                        htmlBody: undefined,
                      });
                      setBodySource("manual");
                    }}
                    disabled={disabled}
                    placeholder="Escribe tu mensaje aquí..."
                    className={`min-h-[250px] w-full resize-y border-0 bg-white px-4 py-3 text-sm font-semibold leading-6 text-[var(--g66-text-primary)] outline-none placeholder:text-[var(--g66-text-muted)] disabled:bg-[var(--g66-background)] ${
                      fieldErrors.body ? "ring-2 ring-[var(--g66-danger-soft)]" : ""
                    }`}
                  />
                </>
              )}
            </div>
            {fieldErrors.body ? (
              <span className="text-[11px] font-bold text-[var(--g66-danger)]">
                {fieldErrors.body}
              </span>
            ) : null}
            {composerNotice ? (
              <span className="text-[11px] font-bold text-[var(--g66-warning)]">
                {composerNotice}
              </span>
            ) : null}

            <div className="max-h-20 overflow-y-auto rounded-[var(--g66-radius-md)] border border-dashed border-[var(--g66-brand-blue)] bg-[var(--g66-brand-blue-soft)] px-2 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openAttachmentPicker}
                  disabled={disabled || isSending || isSyncing}
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-full bg-white px-3 text-xs font-black text-[var(--g66-brand-blue)] shadow-sm hover:bg-[var(--g66-surface-soft)] disabled:cursor-not-allowed disabled:text-[var(--g66-text-muted)]"
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                  Adjuntar
                </button>
                <EmailAttachmentChips files={localFiles} onRemove={removeLocalFile} />
              </div>
            </div>
            {fieldErrors.attachments ? (
              <span className="text-[11px] font-bold text-[var(--g66-danger)]">
                {fieldErrors.attachments}
              </span>
            ) : null}
          </div>

          <div className="sticky bottom-0 z-10 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--g66-border-soft)] bg-white px-3 py-2">
            <span
              className={`text-xs font-semibold ${
                isDirty ? "text-[var(--g66-danger)]" : "text-[var(--g66-success)]"
              }`}
            >
              {isDirty ? "Cambios sin guardar" : `Borrador guardado a las ${draftSavedLabel}`}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onSyncEmails}
                disabled={isSending || isSyncing}
                className="inline-flex h-9 items-center justify-center rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-black text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-[var(--g66-text-muted)]"
              >
                {isSyncing ? "Sincronizando..." : "Sincronizar correos"}
              </button>
              <button
                type="button"
                onClick={() => onDirtyChange(false)}
                disabled={isSending || isSyncing}
                className="inline-flex h-9 items-center justify-center rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-black text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)] disabled:cursor-not-allowed disabled:text-[var(--g66-text-muted)]"
              >
                Guardar borrador
              </button>
              <button
                type="button"
                onClick={openPreview}
                className="inline-flex h-9 items-center justify-center rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-3 text-xs font-black text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)]"
              >
                Vista previa
              </button>
              <button
                type="submit"
                disabled={disabled || isSending || isSyncing}
                className="inline-flex h-9 items-center justify-center rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-5 text-xs font-black text-white hover:bg-[var(--g66-brand-blue-hover)] disabled:cursor-not-allowed disabled:bg-[var(--g66-border)] disabled:text-[var(--g66-text-muted)]"
              >
                {isSending ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isAiModalOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[rgba(16,33,63,0.32)] p-4">
          <div className="w-[min(620px,100%)] overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-soft)]">
            <div className="flex items-center justify-between border-b border-[var(--g66-border-soft)] px-4 py-3">
              <h3 className="flex items-center gap-2 text-base font-black text-[var(--g66-text-primary)]">
                <Sparkles className="h-5 w-5 text-[var(--g66-brand-blue)]" aria-hidden="true" />
                Sugerencia IA
              </h3>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="rounded-full px-3 py-1 text-xs font-black text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)]"
              >
                Cerrar
              </button>
            </div>
            <div className="flex gap-2 border-b border-[var(--g66-border-soft)] px-4 py-2">
              <button
                type="button"
                onClick={() => setAiModalTab("suggest")}
                className={`rounded-[var(--g66-radius-sm)] px-3 py-2 text-xs font-black ${
                  aiModalTab === "suggest"
                    ? "bg-[var(--g66-brand-blue)] text-white"
                    : "text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)]"
                }`}
              >
                Sugerir respuesta
              </button>
              <button
                type="button"
                onClick={() => setAiModalTab("rewrite")}
                className={`rounded-[var(--g66-radius-sm)] px-3 py-2 text-xs font-black ${
                  aiModalTab === "rewrite"
                    ? "bg-[var(--g66-brand-blue)] text-white"
                    : "text-[var(--g66-text-secondary)] hover:bg-[var(--g66-brand-blue-soft)]"
                }`}
              >
                Mejorar texto
              </button>
            </div>
            {aiModalTab === "suggest" ? (
              <>
                <div className="grid gap-3 p-4">
                  <section className="rounded-[var(--g66-radius-md)] border border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] p-3">
                    <h4 className="text-xs font-black text-[var(--g66-text-primary)]">
                      Resumen del caso
                    </h4>
                    <p className="mt-1 text-sm font-semibold leading-5 text-[var(--g66-text-secondary)]">
                      El cliente consulta sobre {caseItem.subject || "su caso"}. Se sugiere responder con contexto claro, próximos pasos y plazo de revisión.
                    </p>
                  </section>
                  <section className="rounded-[var(--g66-radius-md)] border border-[var(--g66-border-soft)] bg-white p-3">
                    <h4 className="text-xs font-black text-[var(--g66-text-primary)]">
                      Borrador sugerido
                    </h4>
                    <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-[var(--g66-radius-md)] bg-[var(--g66-surface-soft)] p-3 text-sm font-semibold leading-6 text-[var(--g66-text-primary)]">
                      {aiDraft}
                    </pre>
                    <p className="mt-2 text-[11px] font-semibold text-[var(--g66-text-muted)]">
                      La IA puede cometer errores. Revisa siempre antes de enviar.
                    </p>
                  </section>
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--g66-border-soft)] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      applyAiDraftToComposer(aiDraft);
                    }}
                    className="rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-4 py-2 text-xs font-black text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)]"
                  >
                    Usar borrador
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      applyAiDraftToComposer(aiDraft);
                    }}
                    className="rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-4 py-2 text-xs font-black text-white hover:bg-[var(--g66-brand-blue-hover)]"
                  >
                    Insertar en correo
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAiModalOpen(false)}
                    className="rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-4 py-2 text-xs font-black text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)]"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-3 p-4">
                  <section className="rounded-[var(--g66-radius-md)] border border-[var(--g66-border-soft)] bg-[var(--g66-surface-soft)] p-3">
                    <h4 className="text-xs font-black text-[var(--g66-text-primary)]">
                      Mejorar mi mensaje
                    </h4>
                    <textarea
                      value={rawRewriteMessage}
                      onChange={(event) => setRawRewriteMessage(event.target.value)}
                      placeholder="Ej: hola estamos revisando tu caso te aviso cuando tenga novedades"
                      className="mt-2 min-h-24 w-full rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white p-3 text-sm font-semibold leading-5 text-[var(--g66-text-primary)] outline-none focus:border-[var(--g66-brand-blue)]"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[
                        ["formalize", "Formalizar"],
                        ["clarify", "Hacer más claro"],
                        ["shorten", "Hacer más corto"],
                        ["empathetic", "Hacer más empático"],
                      ].map(([action, label]) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => rewriteMessage(action as RewriteAction)}
                          disabled={rewriteAction !== null}
                          className="rounded-[var(--g66-radius-sm)] border border-[var(--g66-border)] bg-white px-3 py-2 text-xs font-black text-[var(--g66-brand-blue)] hover:bg-[var(--g66-brand-blue-soft)] disabled:cursor-not-allowed disabled:text-[var(--g66-text-muted)]"
                        >
                          {rewriteAction === action ? "Procesando..." : label}
                        </button>
                      ))}
                    </div>
                    {rewriteError ? (
                      <p className="mt-2 text-xs font-bold text-[var(--g66-danger)]">
                        {rewriteError}
                      </p>
                    ) : null}
                  </section>
                  <section className="rounded-[var(--g66-radius-md)] border border-[var(--g66-border-soft)] bg-white p-3">
                    <h4 className="text-xs font-black text-[var(--g66-text-primary)]">
                      Resultado generado
                    </h4>
                    <pre className="mt-2 max-h-64 min-h-28 overflow-y-auto whitespace-pre-wrap rounded-[var(--g66-radius-md)] bg-[var(--g66-surface-soft)] p-3 text-sm font-semibold leading-6 text-[var(--g66-text-primary)]">
                      {rewrittenText || "La versión mejorada aparecerá aquí."}
                    </pre>
                    {rewriteWarnings.length > 0 ? (
                      <p className="mt-2 text-[11px] font-semibold text-[var(--g66-warning)]">
                        {rewriteWarnings.join(" ")}
                      </p>
                    ) : null}
                  </section>
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--g66-border-soft)] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      applyAiDraftToComposer(rewrittenText);
                    }}
                    disabled={!rewrittenText.trim()}
                    className="rounded-[var(--g66-radius-md)] bg-[var(--g66-brand-blue)] px-4 py-2 text-xs font-black text-white hover:bg-[var(--g66-brand-blue-hover)] disabled:cursor-not-allowed disabled:bg-[var(--g66-border)] disabled:text-[var(--g66-text-muted)]"
                  >
                    Insertar versión mejorada
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAiModalOpen(false)}
                    className="rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white px-4 py-2 text-xs font-black text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)]"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
      {isPreviewOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[rgba(16,33,63,0.32)] p-4">
          <div className="flex max-h-[90vh] w-[min(860px,100%)] flex-col overflow-hidden rounded-[var(--g66-radius-lg)] border border-[var(--g66-border)] bg-white shadow-[var(--g66-shadow-soft)]">
            <div className="flex items-center justify-between border-b border-[var(--g66-border-soft)] px-4 py-3">
              <div>
                <h3 className="text-base font-black text-[var(--g66-text-primary)]">
                  Vista previa
                </h3>
                <p className="mt-0.5 text-xs font-semibold text-[var(--g66-text-secondary)]">
                  {previewSnapshot?.subject || composer.subject || "Sin asunto"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-full px-3 py-1 text-xs font-black text-[var(--g66-text-secondary)] hover:bg-[var(--g66-background)]"
              >
                Cerrar
              </button>
            </div>
            <div className="min-h-0 flex-1 bg-[var(--g66-background)] p-3">
              <iframe
                title="Vista previa de correo"
                srcDoc={previewSnapshot?.finalHtml || previewHtml}
                sandbox=""
                className="h-[min(720px,72vh)] w-full rounded-[var(--g66-radius-md)] border border-[var(--g66-border)] bg-white"
              />
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
