import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "font",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];

const allowedAttributes = {
  a: ["href", "name", "target", "rel"],
  div: ["style"],
  p: ["style"],
  span: ["style"],
  table: ["style", "border", "cellpadding", "cellspacing"],
  td: ["style", "colspan", "rowspan"],
  th: ["style", "colspan", "rowspan"],
  tr: ["style"],
  font: ["color", "face", "size"],
};

const allowedStyles = {
  "*": {
    color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/, /^[a-z]+$/i],
    "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/, /^[a-z]+$/i],
    "font-size": [/^\d+(px|pt|em|rem|%)$/],
    "font-family": [/^[\w\s"',.-]+$/],
    "font-weight": [/^\d+$/, /^bold$/, /^normal$/],
    "font-style": [/^italic$/, /^normal$/],
    "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
    "text-decoration": [/^[\w\s-]+$/],
    margin: [/^[\d\s.pxemrem%-]+$/],
    padding: [/^[\d\s.pxemrem%-]+$/],
    border: [/^[\w\s#.,()-]+$/],
    "border-collapse": [/^collapse$/, /^separate$/],
    width: [/^\d+(px|em|rem|%)$/],
    height: [/^\d+(px|em|rem|%)$/],
  },
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildEmailHtmlFromText(text: string) {
  return sanitizeEmailHtml(
    text
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join(""),
  );
}

export function sanitizeEmailHtml(html: string | null | undefined) {
  if (!html) return null;

  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedStyles,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  });
}
