import type {
  KnowledgeVisibility,
  ParsedKnowledgeArticle,
} from "@/lib/ai-knowledge-types";

const maxChunkLength = 1200;
const internalOnlyPattern = /\b(no para el cliente|uso interno|informaci[oó]n interna)\b/i;
const agentGuidancePattern = /\b(importante para la ia|instrucci[oó]n para (?:la )?ia|gu[ií]a (?:del )?agente)\b/i;

function inferVisibility(value: string): KnowledgeVisibility {
  if (internalOnlyPattern.test(value)) return "INTERNAL_ONLY";
  if (agentGuidancePattern.test(value)) return "AGENT_GUIDANCE";
  return "CUSTOMER_ALLOWED";
}

function looksLikeHeading(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return false;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (/^\d+(?:\.\d+)*[.)]?\s+[A-ZÁÉÍÓÚÑ]/.test(trimmed)) return true;
  if (/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 /&(),.-]{3,}$/.test(trimmed)) return true;
  return trimmed.length <= 70 && !/[.!?]$/.test(trimmed);
}

export function parseKnowledgeText(rawText: string): ParsedKnowledgeArticle[] {
  const normalized = rawText.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const sections: Array<{ title: string; body: string[] }> = [];
  let current = { title: "Contenido general", body: [] as string[] };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (looksLikeHeading(line) && current.title === "Contenido general" && current.body.length === 0) {
      current.title = line.replace(/^#{1,6}\s+/, "").trim();
      continue;
    }
    if (looksLikeHeading(line) && current.body.join(" ").trim().length >= 80) {
      sections.push(current);
      current = { title: line.replace(/^#{1,6}\s+/, "").trim(), body: [] };
      continue;
    }
    if (line) current.body.push(line);
  }
  if (current.body.length) sections.push(current);

  return sections
    .map((section, index) => {
      const content = section.body.join("\n").trim();
      return {
        title: section.title || `Sección ${index + 1}`,
        content,
        section: section.title || null,
        visibility: inferVisibility(`${section.title}\n${content}`),
      } satisfies ParsedKnowledgeArticle;
    })
    .filter((section) => section.content.length >= 20);
}

export function chunkKnowledgeContent(content: string) {
  const paragraphs = content
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/)
    .map((item) => item.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }
    if (`${current}\n${paragraph}`.length <= maxChunkLength) {
      current = `${current}\n${paragraph}`;
      continue;
    }
    chunks.push(current);
    current = paragraph;
  }
  if (current) chunks.push(current);

  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxChunkLength) return [chunk];
    const parts: string[] = [];
    for (let index = 0; index < chunk.length; index += maxChunkLength) {
      parts.push(chunk.slice(index, index + maxChunkLength));
    }
    return parts;
  });
}
