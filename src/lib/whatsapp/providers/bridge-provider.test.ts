import { describe, expect, it } from "vitest";

import { renderTemplateBody } from "./bridge-provider";

describe("renderTemplateBody — templates as plain text for the bridge", () => {
  it("replaces positional variables like Meta renders them", () => {
    expect(
      renderTemplateBody("Hi {{1}}, your order {{2}} is ready.", ["Swaraj", "PJ-000002"]),
    ).toBe("Hi Swaraj, your order PJ-000002 is ready.");
  });

  it("leaves unmatched placeholders visible rather than deleting them", () => {
    // A silently-dropped variable reads as a finished sentence with a
    // hole in the meaning; the literal {{2}} at least shows the gap.
    expect(renderTemplateBody("Hi {{1}}, code {{2}}", ["Swaraj"])).toBe(
      "Hi Swaraj, code {{2}}",
    );
  });

  it("tolerates whitespace inside braces and repeated variables", () => {
    expect(renderTemplateBody("{{ 1 }} and {{1}} again", ["A"])).toBe("A and A again");
  });
});
