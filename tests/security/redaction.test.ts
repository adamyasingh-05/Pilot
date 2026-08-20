import { describe, it, expect } from "vitest";
import { redact, redactDeep } from "../../src/security/redaction.js";

describe("redact", () => {
  it("masks Anthropic-style keys", () => {
    const out = redact("key: sk-ant-abcdefgh12345678ijklmnop");
    expect(out).not.toContain("abcdefgh12345678ijklmnop");
    expect(out).toContain("REDACTED");
  });

  it("masks OpenAI-style keys", () => {
    const out = redact("sk-abcdefghijklmnopqrstuvwx");
    expect(out).not.toContain("abcdefghijklmnopqrstuvwx");
  });

  it("masks env-style assignments while preserving the variable name", () => {
    const out = redact("OPENAI_API_KEY=sk-test1234567890abcdef");
    expect(out).toContain("OPENAI_API_KEY=");
    expect(out).not.toContain("sk-test1234567890abcdef");
  });

  it("leaves ordinary text untouched", () => {
    const out = redact("Organized 71 files into Documents/PDFs");
    expect(out).toBe("Organized 71 files into Documents/PDFs");
  });

  it("redacts nested object values recursively", () => {
    const out = redactDeep({ nested: { token: "Bearer abcdefghijklmnopqrstuvwxyz123456" } });
    expect(JSON.stringify(out)).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
  });
});
