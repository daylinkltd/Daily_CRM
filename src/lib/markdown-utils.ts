/**
 * Markdown & Rich Text Utilities.
 * Converts raw Markdown (#, ##, **, -, etc.) into formatted HTML and vice-versa.
 *
 * SECURITY: the output of `markdownToHtml` is rendered through
 * `dangerouslySetInnerHTML` (policy Read & Sign, printable handbook)
 * and assigned to `innerHTML` (the rich-text editor). Content comes
 * from users — the WYSIWYG editor accepts pasted HTML — so every
 * return path runs through `sanitizeHtml` below. Never return raw
 * user HTML from this module.
 *
 * NOTE ON `class` vs `className`: these strings are raw HTML, not
 * JSX. React does not translate attributes inside
 * `dangerouslySetInnerHTML`, and browsers only honour `class`, so the
 * styling here must use `class=`.
 */

/** Tags allowed to survive sanitisation. */
const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "strike", "del",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "a", "table", "thead", "tbody", "tr", "th", "td",
  "font", "img",
]);

/** Attributes allowed to survive sanitisation, per tag. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  "*": new Set(["class"]),
  a: new Set(["class", "href", "target", "rel"]),
  font: new Set(["class", "size"]),
  img: new Set(["class", "src", "alt", "width", "height", "style"]),
};

const SAFE_URL = /^(https?:|mailto:|tel:|#|\/|data:image\/)/i;

/**
 * Strip anything executable from an HTML string using an allowlist.
 *
 * In the browser this parses with the platform parser (no
 * half-correct regex parsing) and walks the tree. On the server —
 * where DOMParser doesn't exist — it falls back to removing the
 * executable constructs, which is enough because every current
 * consumer is a client component.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return html
      .replace(/<\s*(script|style|iframe|object|embed|link|meta|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'>\s]*/gi, "$1=#");
  }

  const doc = new window.DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";

  const walk = (node: Element) => {
    // Snapshot children: the list mutates as nodes are removed/unwrapped.
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) {
        // Executable/embedding tags are dropped whole; unknown
        // formatting tags are unwrapped so their text survives.
        if (["script", "style", "iframe", "object", "embed", "link", "meta", "svg", "math"].includes(tag)) {
          child.remove();
        } else {
          child.replaceWith(...Array.from(child.childNodes));
        }
        continue;
      }

      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        const allowed = ALLOWED_ATTRS[tag] ?? ALLOWED_ATTRS["*"];
        // Every on* handler is dropped, plus anything not allowlisted.
        if (name.startsWith("on") || !allowed.has(name)) {
          child.removeAttribute(attr.name);
          continue;
        }
        if ((name === "href" || name === "src") && !SAFE_URL.test(attr.value.trim())) {
          child.removeAttribute(attr.name);
        }
      }

      // Links opened in a new tab must not leak window.opener.
      if (tag === "a" && child.getAttribute("target") === "_blank") {
        child.setAttribute("rel", "noopener noreferrer");
      }

      walk(child);
    }
  };

  walk(root);
  return root.innerHTML;
}

/**
 * True only for a markdown heading anchored to the start of a line, so an
 * inline "#" in ordinary prose is never mistaken for one.
 */
function hasLeadingMarkdownHeading(str: string): boolean {
  return /(^|\n)\s{0,3}#{1,6}\s/.test(str);
}

export function isHtmlContent(str: string): boolean {
  if (!str) return false;
  return /<[a-z][\s\S]*>/i.test(str);
}

/**
 * Converts Markdown text into clean HTML.
 * Handles headings, bold, italic, lists, blockquotes, code blocks, links, and paragraphs.
 */
export function markdownToHtml(md: string): string {
  if (!md) return "";
  // Already structured HTML (from the WYSIWYG editor) — sanitise and
  // return; it needs no markdown pass.
  // Only re-parse HTML as markdown when it genuinely carries a markdown
  // heading at the START of a line. The old test was `md.includes("# ")`,
  // which fired on any hash followed by a space ANYWHERE — "Invoice # 12",
  // "Ticket # 5" — and then the heading rules below turned that text into
  // mangled nested markup like `<p>Invoice<h1>12 is due</p></h1>`. That is
  // why pasted content "all came as h1".
  if (isHtmlContent(md) && !hasLeadingMarkdownHeading(md)) {
    return sanitizeHtml(md);
  }

  let html = md;

  // Code blocks ```...```
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-muted p-3 rounded font-mono text-xs my-2">$1</pre>');

  // Headers (must be parsed at line starts or after breaks)
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-foreground mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-foreground mt-5 mb-2 border-b border-border/40 pb-1">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold text-foreground mt-6 mb-3 border-b border-border pb-1">$1</h1>');

  // The inline "joined lines" rules that used to live here matched a hash
  // ANYWHERE in a line, so "Invoice # 12" became a heading. A heading is a
  // line-level construct; the anchored rules above cover the real cases.

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-primary/60 pl-3 italic text-muted-foreground my-2">$1</blockquote>');

  // Unordered Lists
  html = html.replace(/^\s*[-*+]\s+(.*$)/gim, '<li class="ml-4 list-disc">$1</li>');

  // Ordered Lists
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="ml-4 list-decimal">$1</li>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:opacity-80">$1</a>');

  // Horizontal Rule
  html = html.replace(/^---$/gim, '<hr class="my-4 border-border" />');

  // Tables: | a | b |  with a |---|---| separator row
  html = html.replace(
    /^\|(.+)\|[ \t]*\n\|[ \t]*:?-{2,}[-| \t:]*\|[ \t]*\n((?:\|.*\|[ \t]*\n?)+)/gim,
    (_m, headerRow: string, bodyRows: string) => {
      const cells = (row: string) =>
        row.split("|").slice(1, -1).map((c) => c.trim());
      const head = cells(`|${headerRow}|`)
        .map((c) => `<th class="border border-border px-2 py-1 text-left font-semibold">${c}</th>`)
        .join("");
      const body = bodyRows
        .trim()
        .split("\n")
        .filter((r) => r.trim())
        .map(
          (r) =>
            `<tr>${cells(r)
              .map((c) => `<td class="border border-border px-2 py-1">${c}</td>`)
              .join("")}</tr>`
        )
        .join("");
      return `<table class="w-full border-collapse my-3 text-xs"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }
  );

  // Paragraph splits
  const lines = html.split('\n\n');
  const processed = lines.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    if (
      trimmed.startsWith('<h1') ||
      trimmed.startsWith('<h2') ||
      trimmed.startsWith('<h3') ||
      trimmed.startsWith('<pre') ||
      trimmed.startsWith('<blockquote') ||
      trimmed.startsWith('<li') ||
      trimmed.startsWith('<table') ||
      trimmed.startsWith('<hr')
    ) {
      return trimmed;
    }
    return `<p class="mb-2 leading-relaxed">${trimmed.replace(/\n/g, '<br />')}</p>`;
  });

  // Sanitise the assembled document, not just the passthrough branch:
  // markdown can embed raw HTML too.
  return sanitizeHtml(processed.join('\n'));
}
