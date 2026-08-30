import { describe, expect, it } from "vitest";

import { describeCredential } from "./smtp-diagnose";

/**
 * A 535 looks the same whether the password is wrong or the env file
 * mangled it. These distinguish the second case without the value ever
 * leaving the server.
 */
describe("describeCredential", () => {
  it("reports length without the secret", () => {
    const out = describeCredential("private@132");
    expect(out.length).toBe(11);
    expect(JSON.stringify(out)).not.toContain("private");
  });

  it("flags whitespace an env file kept by accident", () => {
    expect(describeCredential("secret ").hasSurroundingWhitespace).toBe(true);
    expect(describeCredential(" secret").hasSurroundingWhitespace).toBe(true);
    expect(describeCredential("secret").hasSurroundingWhitespace).toBe(false);
  });

  it("flags a value cut short at a quote", () => {
    // PLATFORM_SMTP_PASS="abc def  ->  parsers that stop at the quote
    expect(describeCredential('"abc').looksTruncatedAtQuote).toBe(true);
    expect(describeCredential("abc'").looksTruncatedAtQuote).toBe(true);
    expect(describeCredential("abc").looksTruncatedAtQuote).toBe(false);
  });

  it("handles a missing password rather than throwing", () => {
    const out = describeCredential(undefined);
    expect(out.length).toBe(0);
    expect(out.hasSurroundingWhitespace).toBe(false);
  });

  it("does not mistake an @ in a password for a problem", () => {
    const out = describeCredential("private@132");
    expect(out.hasSurroundingWhitespace).toBe(false);
    expect(out.looksTruncatedAtQuote).toBe(false);
  });
});
