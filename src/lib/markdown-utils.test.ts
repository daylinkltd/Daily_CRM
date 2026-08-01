import { describe, expect, it } from "vitest";
import { isHtmlContent, markdownToHtml, sanitizeHtml } from "./markdown-utils";

// These tests run under vitest's `node` environment, so `window` is
// undefined and `sanitizeHtml` takes its server fallback branch. That
// is the branch that protects any future server-side render; the
// browser branch uses DOMParser with the same allowlist and is
// exercised in the app itself (jsdom is not installed).

describe("sanitizeHtml (server fallback)", () => {
  it("removes script elements and their contents", () => {
    const out = sanitizeHtml('<p>hi</p><script>fetch("//evil")</script>');
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain("evil");
    expect(out).toContain("<p>hi</p>");
  });

  it("strips inline event handlers", () => {
    for (const html of [
      '<img src=x onerror="alert(1)">',
      "<div onclick='steal()'>x</div>",
      '<p ONMOUSEOVER="bad()">x</p>',
    ]) {
      const out = sanitizeHtml(html);
      expect(out.toLowerCase()).not.toContain("onerror");
      expect(out.toLowerCase()).not.toContain("onclick");
      expect(out.toLowerCase()).not.toContain("onmouseover");
    }
  });

  it("neutralises javascript: URLs", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain("javascript:");
  });

  it("removes embedding and style tags", () => {
    for (const tag of ["iframe", "object", "embed", "style", "link", "meta"]) {
      const out = sanitizeHtml(`<${tag} src="//evil"></${tag}>`);
      expect(out.toLowerCase()).not.toContain(`<${tag}`);
    }
  });

  it("keeps ordinary formatting intact", () => {
    const html = '<p class="mb-2">Hello <strong>world</strong></p><ul><li>a</li></ul>';
    const out = sanitizeHtml(html);
    expect(out).toContain("<strong>world</strong>");
    expect(out).toContain("<li>a</li>");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });
});

describe("markdownToHtml", () => {
  it("emits `class`, never `className` — raw HTML is not JSX", () => {
    // React does not translate attributes inside
    // dangerouslySetInnerHTML, and browsers ignore `className`, so
    // emitting it silently dropped every style in the handbook.
    const out = markdownToHtml("# Heading\n\n- item\n\n**bold**");
    expect(out).not.toContain("className=");
    expect(out).toMatch(/\sclass="/);
  });

  it("converts headings, lists and emphasis", () => {
    const out = markdownToHtml("# Title\n\n## Sub\n\n- one\n- two\n\n**strong** and *em*");
    expect(out).toContain("<h1");
    expect(out).toContain("<h2");
    expect(out).toContain("<li");
    expect(out).toContain("<strong>strong</strong>");
    expect(out).toContain("<em>em</em>");
  });

  it("renders markdown tables (the leave-entitlement table in the handbook)", () => {
    const out = markdownToHtml(
      "| Leave type | Days |\n|---|---|\n| Casual Leave | 12 |\n| Sick Leave | 6 |\n"
    );
    expect(out).toContain("<table");
    expect(out).toContain("<th");
    expect(out).toContain("Casual Leave");
    expect(out).toContain("12");
  });

  it("sanitises hostile markdown-embedded HTML", () => {
    const out = markdownToHtml("# Policy\n\n<script>steal()</script>");
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toContain("steal()");
  });

  it("sanitises the WYSIWYG passthrough branch", () => {
    // Editor content is already HTML and skips the markdown pass —
    // it must still be sanitised on the way out.
    const out = markdownToHtml('<p>ok</p><img src=x onerror="alert(1)">');
    expect(out).toContain("<p>ok</p>");
    expect(out.toLowerCase()).not.toContain("onerror");
  });

  it("returns empty string for empty input", () => {
    expect(markdownToHtml("")).toBe("");
  });
});

describe("isHtmlContent", () => {
  it("distinguishes HTML from plain markdown", () => {
    expect(isHtmlContent("<p>hi</p>")).toBe(true);
    expect(isHtmlContent("# heading")).toBe(false);
    expect(isHtmlContent("")).toBe(false);
  });
});
