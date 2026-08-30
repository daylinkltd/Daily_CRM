import { describe, expect, it } from "vitest";

import {
  MAX_PASSWORD_LENGTH,
  generatePassword,
  requestOrigin,
  validateNewPassword,
} from "./passwords";

describe("generatePassword", () => {
  it("meets length and contains all four classes", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword();
      expect(pw).toHaveLength(14);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[!@#$%&*+\-=?]/);
    }
  });

  it("never emits look-alike characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword()).not.toMatch(/[0O1lI]/);
    }
  });
});

describe("validateNewPassword", () => {
  it("rejects short, long and non-string values", () => {
    expect(validateNewPassword("short1!").ok).toBe(false);
    expect(validateNewPassword("x".repeat(MAX_PASSWORD_LENGTH + 1)).ok).toBe(false);
    expect(validateNewPassword(12345678).ok).toBe(false);
    expect(validateNewPassword(undefined).ok).toBe(false);
  });

  it("accepts a reasonable password verbatim", () => {
    const res = validateNewPassword("correct horse battery");
    expect(res).toEqual({ ok: true, password: "correct horse battery" });
  });
});

describe("requestOrigin", () => {
  it("prefers forwarded headers over the request URL", () => {
    const req = new Request("http://10.0.0.5:3000/api/x", {
      headers: { "x-forwarded-host": "dailybuz.com", "x-forwarded-proto": "https" },
    });
    expect(requestOrigin(req)).toBe("https://dailybuz.com");
  });

  it("falls back to the request origin without a proxy", () => {
    expect(requestOrigin(new Request("http://localhost:3000/api/x"))).toBe(
      "http://localhost:3000",
    );
  });
});
