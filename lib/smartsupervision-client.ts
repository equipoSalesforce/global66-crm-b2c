import "server-only";

import { createHash } from "node:crypto";
import type {
  SmartSupervisionComplaintPayload,
  SmartSupervisionHttpResult,
  SmartSupervisionJson,
} from "@/lib/smartsupervision-types";

export class SmartSupervisionClientError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly response: unknown = null,
  ) {
    super(message);
  }
}

export function isSmartSupervisionEnabled() {
  return process.env.SMARTSUPERVISION_ENABLED?.trim().toLowerCase() === "true";
}

function getApiKeyMetadata(apiKey: string | undefined) {
  return {
    hasApiKey: Boolean(apiKey),
    apiKeyLength: apiKey?.length ?? 0,
    apiKeySha256Prefix: apiKey
      ? createHash("sha256").update(apiKey).digest("hex").slice(0, 8)
      : null,
  };
}

function getConfig() {
  const enabled = isSmartSupervisionEnabled();
  const baseUrl = process.env.SMARTSUPERVISION_MS_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.SMARTSUPERVISION_MS_API_KEY?.trim();
  const apiKeyMetadata = getApiKeyMetadata(apiKey);

  if (process.env.NODE_ENV === "development") {
    console.info({
      tag: "[SmartSupervision Config]",
      baseUrl: baseUrl ?? null,
      enabled,
      ...apiKeyMetadata,
    });
  }

  if (!enabled) {
    throw new SmartSupervisionClientError("SmartSupervisión está deshabilitado.");
  }

  if (!baseUrl) {
    throw new SmartSupervisionClientError(
      "Falta SMARTSUPERVISION_MS_BASE_URL.",
    );
  }

  return {
    baseUrl,
    headers: getSmartSupervisionHeaders(),
    apiKeyMetadata,
  };
}

export function getSmartSupervisionHeaders() {
  const apiKey = process.env.SMARTSUPERVISION_MS_API_KEY?.trim();
  if (!apiKey) {
    throw new SmartSupervisionClientError(
      "Falta SMARTSUPERVISION_MS_API_KEY.",
    );
  }

  return {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };
}

async function parseResponse(response: Response) {
  const responseText = await response.text();
  if (!responseText) return { data: null, responseText };
  try {
    return { data: JSON.parse(responseText) as unknown, responseText };
  } catch {
    return { data: { raw: responseText }, responseText };
  }
}

async function smartSupervisionRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { absoluteUrl?: string } = {},
): Promise<SmartSupervisionHttpResult<T>> {
  const { baseUrl, headers, apiKeyMetadata } = getConfig();
  const finalUrl = options.absoluteUrl ?? `${baseUrl}${path}`;
  const method = init.method?.toUpperCase() ?? "GET";

  if (process.env.NODE_ENV === "development") {
    console.info({
      tag: "[SmartSupervision MS Request]",
      method,
      path,
      baseUrl,
      finalUrl,
      ...apiKeyMetadata,
    });
  }

  const response = await fetch(finalUrl, {
    ...init,
    cache: "no-store",
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  const { data, responseText } = await parseResponse(response);

  if (!response.ok) {
    if (process.env.NODE_ENV === "development") {
      console.error({
        tag: "[SmartSupervision MS Error]",
        method,
        finalUrl,
        status: response.status,
        statusText: response.statusText,
        responseText,
        ...apiKeyMetadata,
      });
    }

    throw new SmartSupervisionClientError(
      `SmartSupervisión respondió HTTP ${response.status}.`,
      response.status,
      data,
    );
  }

  return { ok: true, status: response.status, data: data as T };
}

export async function fetchMomento1Complaints() {
  const result = await smartSupervisionRequest<unknown>("/sync/momento-1", {
    method: "POST",
  });
  const complaints = Array.isArray(result.data)
    ? result.data
    : Array.isArray((result.data as SmartSupervisionJson | null)?.data)
      ? (result.data as { data: unknown[] }).data
      : null;

  if (!complaints) {
    throw new SmartSupervisionClientError(
      "Momento 1 no devolvió una lista de quejas.",
      result.status,
      result.data,
    );
  }

  return {
    ...result,
    data: complaints as SmartSupervisionComplaintPayload[],
  };
}

export function sendMomento1Ack(ids: string[]) {
  if (ids.length === 0) {
    throw new SmartSupervisionClientError("El ACK requiere al menos un Smart_Code__c.");
  }
  return smartSupervisionRequest<unknown>("/sync/momento-1/ack", {
    method: "POST",
    body: JSON.stringify({ ids_quejas: ids }),
  });
}

export function sendSmartSupervisionDispatch(payload: SmartSupervisionJson) {
  return smartSupervisionRequest<unknown>("/sync/despacho", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getSmartSupervisionQueueStatus() {
  return smartSupervisionRequest<unknown>("/queue", { method: "GET" });
}

export function getSmartSupervisionHealth() {
  const { baseUrl } = getConfig();
  const origin = new URL(baseUrl).origin;
  return smartSupervisionRequest<unknown>("", { method: "GET" }, {
    absoluteUrl: `${origin}/health`,
  });
}
