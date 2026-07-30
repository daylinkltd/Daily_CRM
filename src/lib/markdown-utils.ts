/**
 * Markdown & Rich Text Utilities.
 * Converts raw Markdown (#, ##, **, -, etc.) into formatted HTML and vice-versa.
 */

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
  // If it's already structured HTML (e.g. contains <p>, <h1>, <div>), return as is
  if (isHtmlContent(md) && !md.includes("# ") && !md.includes("## ")) {
    return md;
  }

  let html = md;

  // Code blocks ```...```
  html = html.replace(/```([\s\S]*?)```/g, '<pre className="bg-muted p-3 rounded font-mono text-xs my-2">$1</pre>');

  // Headers (must be parsed at line starts or after breaks)
  html = html.replace(/^### (.*$)/gim, '<h3 className="text-base font-bold text-foreground mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 className="text-lg font-bold text-foreground mt-5 mb-2 border-b border-border/40 pb-1">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 className="text-xl font-extrabold text-foreground mt-6 mb-3 border-b border-border pb-1">$1</h1>');

  // Also replace inline ## and # if lines were joined with spaces or line breaks
  html = html.replace(/\s## (.*?)(?=\s##|\s#|\n|$)/g, '<h2 className="text-lg font-bold text-foreground mt-4 mb-2">$1</h2>');
  html = html.replace(/\s# (.*?)(?=\s##|\s#|\n|$)/g, '<h1 className="text-xl font-extrabold text-foreground mt-5 mb-3">$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote className="border-l-4 border-primary/60 pl-3 italic text-muted-foreground my-2">$1</blockquote>');

  // Unordered Lists
  html = html.replace(/^\s*[-*+]\s+(.*$)/gim, '<li className="ml-4 list-disc">$1</li>');

  // Ordered Lists
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li className="ml-4 list-decimal">$1</li>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80">$1</a>');

  // Horizontal Rule
  html = html.replace(/^---$/gim, '<hr className="my-4 border-border" />');

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
      trimmed.startsWith('<hr')
    ) {
      return trimmed;
    }
    return `<p className="mb-2 leading-relaxed">${trimmed.replace(/\n/g, '<br />')}</p>`;
  });

  return processed.join('\n');
}
