"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import {
  renderEmailTemplateWithBodyHtml,
  sanitizeEmailHtml,
  textToEmailHtml,
} from "@/lib/email-template-renderer";
import type { EmailTemplateVariableContext } from "@/lib/email-template-variables";

const editableBodyId = "g66-email-editable-body";

function buildEditableBodyHtml(body: string, bodyHtml: string | undefined, disabled: boolean) {
  return `
    <div
      id="${editableBodyId}"
      contenteditable="${disabled ? "false" : "true"}"
      role="textbox"
      aria-label="Cuerpo editable del correo"
      style="min-height:96px;border:1px dashed #205EF1;border-radius:12px;padding:12px;background:#ffffff;outline:none;"
    >${sanitizeEmailHtml(bodyHtml || textToEmailHtml(body)) || "<p><br /></p>"}</div>
  `;
}

function injectEditorStyles(html: string, hasEditableSlot: boolean) {
  const styles = `
    <style>
      html, body { min-height: 100%; }
      body { outline: none; overflow-y: auto; }
      #${editableBodyId}:focus {
        border-color: #174EE0 !important;
        box-shadow: 0 0 0 3px rgba(32, 94, 241, 0.14) !important;
      }
      #${editableBodyId}:empty:before {
        content: "Escribe tu mensaje aquí...";
        color: #7A8AA0;
      }
      ${hasEditableSlot ? "" : "body:focus { outline: 2px solid rgba(32, 94, 241, 0.18); outline-offset: -2px; }"}
    </style>
  `;

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${styles}</head>`);
  }

  return `${styles}${html}`;
}

function getEditableText(element: HTMLElement) {
  return element.innerText.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n");
}

function getDocumentHtml(document: Document) {
  return `<!DOCTYPE html>${document.documentElement.outerHTML}`;
}

function readFullHtmlDocumentSnapshot(document: Document, lastSyncAt: string) {
  const nextBodyHtml = sanitizeEmailHtml(document.body.innerHTML);
  const nextFinalHtml = sanitizeEmailHtml(getDocumentHtml(document));
  const nextBody = document.body.innerText
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    body: nextBody,
    bodyText: nextBody,
    bodyHtml: nextBodyHtml,
    finalHtml: nextFinalHtml,
    lastSyncAt,
    syncStatus: "OK" as const,
    editorMode: "iframe-full-html" as const,
    editorNodeFound: true,
  };
}

function templateHasEditableBodySlot(htmlTemplate: string) {
  return /\{\{\s*email\.body\s*\}\}/.test(htmlTemplate);
}

function focusEditableTarget(document: Document, hasEditableSlot: boolean) {
  const window = document.defaultView;
  window?.focus();

  if (hasEditableSlot) {
    const editable = document.getElementById(editableBodyId);
    if (editable instanceof HTMLElement) editable.focus();
    return editable instanceof HTMLElement ? editable : null;
  }

  document.body?.focus();
  return document.body;
}

export type HtmlEmailTemplateEditorHandle = {
  execCommand: (command: string, value?: string) => void;
  insertHtml: (html: string) => void;
  replaceMainContent: (body: string, bodyHtml: string, finalHtml?: string) => void;
  syncNow: () => HtmlEmailTemplateEditorSnapshot;
};

export type HtmlEmailTemplateEditorSnapshot = {
  body: string;
  bodyText: string;
  bodyHtml: string;
  finalHtml: string;
  lastSyncAt: string;
  syncStatus: "OK" | "ERROR";
  editorMode: "iframe" | "contentEditable" | "iframe-full-html" | "fallback";
  editorNodeFound: boolean;
  error?: string;
};

type HtmlEmailTemplateEditorProps = {
  htmlTemplate: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  finalHtml?: string;
  context: EmailTemplateVariableContext;
  disabled?: boolean;
  hasError?: boolean;
  onBodyChange: (
    body: string,
    bodyHtml: string,
    finalHtml: string,
    snapshot: HtmlEmailTemplateEditorSnapshot,
  ) => void;
};

export const HtmlEmailTemplateEditor = forwardRef<
  HtmlEmailTemplateEditorHandle,
  HtmlEmailTemplateEditorProps
>(function HtmlEmailTemplateEditor({
  htmlTemplate,
  subject,
  body,
  bodyHtml,
  finalHtml,
  context,
  disabled = false,
  hasError = false,
  onBodyChange,
}: HtmlEmailTemplateEditorProps, ref) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const lastBodyFromEditorRef = useRef(body);
  const lastBodyHtmlFromEditorRef = useRef(bodyHtml);
  const templateKey = useMemo(
    () => JSON.stringify({ htmlTemplate, subject, context, disabled }),
    [context, disabled, htmlTemplate, subject],
  );
  const hasEditableSlot = templateHasEditableBodySlot(htmlTemplate);
  const srcDoc = useMemo(() => {
    const rendered = hasEditableSlot
      ? renderEmailTemplateWithBodyHtml({
          htmlTemplate,
          subject,
          body,
          bodyHtml: buildEditableBodyHtml(body, bodyHtml, disabled),
          context,
        }).html
      : finalHtml ||
        bodyHtml ||
        renderEmailTemplateWithBodyHtml({
          htmlTemplate,
          subject,
          body,
          bodyHtml: textToEmailHtml(body),
          context,
        }).html;

    return injectEditorStyles(sanitizeEmailHtml(rendered), hasEditableSlot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;
    if (!hasEditableSlot) return;

    const editable = iframe.contentDocument.getElementById(editableBodyId);
    if (!editable || iframe.contentDocument.activeElement === editable) return;
    if (
      lastBodyFromEditorRef.current === body &&
      lastBodyHtmlFromEditorRef.current === bodyHtml
    ) {
      return;
    }

    editable.innerHTML = sanitizeEmailHtml(bodyHtml || textToEmailHtml(body)) || "<p><br /></p>";
    lastBodyFromEditorRef.current = body;
    lastBodyHtmlFromEditorRef.current = bodyHtml;
  }, [body, bodyHtml, hasEditableSlot]);

  useEffect(
    () => () => {
      cleanupListenersRef.current?.();
      cleanupListenersRef.current = null;
    },
    [],
  );

  function readFromDocument() {
    const iframe = iframeRef.current;
    const document = iframe?.contentDocument;
    const lastSyncAt = new Date().toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    if (!iframe) {
      return {
        body: "",
        bodyText: "",
        bodyHtml: "",
        finalHtml: "",
        lastSyncAt,
        syncStatus: "ERROR" as const,
        editorMode: "fallback" as const,
        editorNodeFound: false,
        error: "iframe no disponible",
      };
    }

    if (!document) {
      return {
        body: "",
        bodyText: "",
        bodyHtml: "",
        finalHtml: "",
        lastSyncAt,
        syncStatus: "ERROR" as const,
        editorMode: "iframe" as const,
        editorNodeFound: false,
        error: "documento del iframe no disponible",
      };
    }

    if (hasEditableSlot) {
      const editable = document.getElementById(editableBodyId);
      if (!(editable instanceof HTMLElement)) {
        return readFullHtmlDocumentSnapshot(document, lastSyncAt);
      }

      const nextBody = getEditableText(editable);
      const nextBodyText = nextBody.trim();
      const nextBodyHtml = sanitizeEmailHtml(editable.innerHTML);
      const nextFinalHtml = renderEmailTemplateWithBodyHtml({
        htmlTemplate,
        subject,
        body: nextBody,
        bodyHtml: nextBodyHtml,
        context,
      }).html;
      return {
        body: nextBody,
        bodyText: nextBodyText,
        bodyHtml: nextBodyHtml,
        finalHtml: nextFinalHtml,
        lastSyncAt,
        syncStatus: "OK" as const,
        editorMode: "contentEditable" as const,
        editorNodeFound: true,
      };
    }

    return readFullHtmlDocumentSnapshot(document, lastSyncAt);
  }

  function syncFromDocument() {
    const snapshot = readFromDocument();
    if (snapshot.syncStatus === "ERROR") return snapshot;

    if (hasEditableSlot) {
      const { body: nextBody, bodyHtml: nextBodyHtml, finalHtml: nextFinalHtml } = snapshot;
      lastBodyFromEditorRef.current = nextBody;
      lastBodyHtmlFromEditorRef.current = nextBodyHtml;
      onBodyChange(nextBody, nextBodyHtml, nextFinalHtml, snapshot);
      return snapshot;
    }

    const { body: nextBody, bodyHtml: nextBodyHtml, finalHtml: nextFinalHtml } = snapshot;
    lastBodyFromEditorRef.current = nextBody;
    lastBodyHtmlFromEditorRef.current = nextBodyHtml;
    onBodyChange(nextBody, nextBodyHtml, nextFinalHtml, snapshot);
    return snapshot;
  }

  useImperativeHandle(ref, () => ({
    execCommand(command: string, value?: string) {
      const document = iframeRef.current?.contentDocument;
      const window = iframeRef.current?.contentWindow;
      if (!document || !window || disabled) return;

      focusEditableTarget(document, hasEditableSlot);
      document.execCommand(command, false, value);
      syncFromDocument();
    },
    insertHtml(html: string) {
      const document = iframeRef.current?.contentDocument;
      const window = iframeRef.current?.contentWindow;
      if (!document || !window || disabled) return;

      const editable = focusEditableTarget(document, hasEditableSlot);
      const sanitizedHtml = sanitizeEmailHtml(html);
      const inserted = document.execCommand("insertHTML", false, sanitizedHtml);

      if (!inserted && editable instanceof HTMLElement) {
        editable.insertAdjacentHTML(hasEditableSlot ? "beforeend" : "afterbegin", sanitizedHtml);
      }

      syncFromDocument();
    },
    replaceMainContent(nextBody: string, nextBodyHtml: string, nextFinalHtml?: string) {
      const document = iframeRef.current?.contentDocument;
      if (!document || disabled) return;

      if (hasEditableSlot) {
        const editable = document.getElementById(editableBodyId);
        if (editable instanceof HTMLElement) {
          editable.innerHTML = sanitizeEmailHtml(nextBodyHtml);
        }
      } else if (nextFinalHtml) {
        document.open();
        document.write(injectEditorStyles(sanitizeEmailHtml(nextFinalHtml), false));
        document.close();
        if (!disabled) {
          document.designMode = "on";
          document.body.contentEditable = "true";
        }
        cleanupListenersRef.current?.();
        cleanupListenersRef.current = bindEditable() ?? null;
      } else {
        const editable = focusEditableTarget(document, hasEditableSlot);
        const sanitizedHtml = sanitizeEmailHtml(nextBodyHtml);
        const inserted = document.execCommand("insertHTML", false, sanitizedHtml);

        if (!inserted && editable instanceof HTMLElement) {
          editable.insertAdjacentHTML("afterbegin", sanitizedHtml);
        }
      }
      syncFromDocument();
    },
    syncNow() {
      return syncFromDocument();
    },
  }));

  function bindEditable() {
    const iframe = iframeRef.current;
    const document = iframe?.contentDocument;
    if (!iframe || !document) return;

    if (!hasEditableSlot) {
      document.designMode = disabled ? "off" : "on";
      document.body.contentEditable = disabled ? "false" : "true";
    } else {
      document.designMode = "off";
    }

    const editable = hasEditableSlot ? document.getElementById(editableBodyId) : document.body;
    if (!(editable instanceof HTMLElement)) return;

    const handleInput = () => {
      syncFromDocument();
    };
    const handlePaste = () => window.setTimeout(handleInput, 0);

    editable.addEventListener("input", handleInput);
    editable.addEventListener("keyup", handleInput);
    editable.addEventListener("paste", handlePaste);
    editable.addEventListener("blur", handleInput);
    syncFromDocument();

    return () => {
      editable.removeEventListener("input", handleInput);
      editable.removeEventListener("keyup", handleInput);
      editable.removeEventListener("paste", handlePaste);
      editable.removeEventListener("blur", handleInput);
    };
  }

  return (
    <div
      className={`min-h-0 resize-y overflow-auto rounded-b-[var(--g66-radius-md)] bg-white ${
        hasError ? "ring-2 ring-[var(--g66-danger-soft)]" : ""
      }`}
      style={{ height: "clamp(360px, 46vh, 500px)", minHeight: 360, maxHeight: "65vh" }}
    >
      <iframe
        ref={iframeRef}
        key={templateKey}
        title="Editor visual de template de correo"
        srcDoc={srcDoc}
        sandbox="allow-same-origin"
        onLoad={() => {
          cleanupListenersRef.current?.();
          cleanupListenersRef.current = bindEditable() ?? null;
        }}
        className="h-full w-full border-0 bg-white"
      />
    </div>
  );
});
