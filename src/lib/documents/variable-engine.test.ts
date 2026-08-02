import { describe, it, expect } from "vitest";
import { interpolateVariables } from "./variable-engine";

describe("interpolateVariables", () => {
  it("substitutes nested values", () => {
    const out = interpolateVariables("<p>Hello {{employee.name}}</p>", {
      employee: { name: "Alex Morgan" },
    });
    expect(out).toBe("<p>Hello Alex Morgan</p>");
  });

  it("renders a placeholder for missing values", () => {
    const out = interpolateVariables("<p>{{employee.name}}</p>", {});
    expect(out).toContain("[employee.name]");
  });

  // The result is persisted to official_documents.body_html and rendered
  // through dangerouslySetInnerHTML, so an unescaped value is stored XSS
  // for every later viewer of the document.
  it("escapes markup in substituted values", () => {
    const out = interpolateVariables("<p>{{employee.name}}</p>", {
      employee: { name: '<img src=x onerror="alert(1)">' },
    });
    // The angle brackets are escaped, so the payload can never become a
    // tag — the literal text "onerror=" surviving as inert content is fine.
    expect(out).not.toContain("<img");
    expect(out).toBe('<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>');
  });

  it("escapes ampersands and quotes without double-encoding the rest", () => {
    const out = interpolateVariables("{{company.name}}", {
      company: { name: `Ben & Jerry's "Co"` },
    });
    expect(out).toBe("Ben &amp; Jerry&#39;s &quot;Co&quot;");
  });

  it("escapes values that close an attribute context", () => {
    const out = interpolateVariables('<a title="{{document.title}}">x</a>', {
      document: { title: '" onmouseover="alert(1)' },
    });
    expect(out).not.toContain('onmouseover="alert(1)"');
  });

  it("leaves non-matching braces untouched", () => {
    expect(interpolateVariables("{ not a token }", {})).toBe("{ not a token }");
  });

  it("returns an empty string for empty input", () => {
    expect(interpolateVariables("", { a: 1 })).toBe("");
  });
});
