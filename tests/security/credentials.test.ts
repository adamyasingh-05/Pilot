import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Point PILOT_HOME-derived paths at an isolated temp dir for this test file
// by overriding HOME before any module under test reads os.homedir().
const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-home-"));
process.env.HOME = tempHome;
process.env.USERPROFILE = tempHome;

const {
  setCredential,
  getCredential,
  hasCredential,
  deleteCredential,
  listCredentialPreviews,
} = await import("../../src/security/credentials.js");

describe("credential store", () => {
  beforeEach(() => {
    for (const provider of ["openai", "anthropic"] as const) {
      if (hasCredential(provider)) deleteCredential(provider);
    }
  });

  afterAll(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("round-trips an encrypted key", () => {
    setCredential("anthropic", "sk-ant-abcdefgh12345678ijklmnop");
    expect(getCredential("anthropic")).toBe("sk-ant-abcdefgh12345678ijklmnop");
  });

  it("never stores or previews the raw key", () => {
    setCredential("openai", "sk-abcdefghijklmnopqrstuvwx");
    const raw = fs.readFileSync(path.join(tempHome, ".pilot", "keys", "credentials.enc.json"), "utf-8");
    expect(raw).not.toContain("sk-abcdefghijklmnopqrstuvwx");

    const previews = listCredentialPreviews();
    const openaiPreview = previews.find((p) => p.provider === "openai");
    expect(openaiPreview?.preview).not.toContain("abcdefghijklmnopqrstuvwx");
  });

  it("reports hasCredential correctly and supports deletion", () => {
    expect(hasCredential("anthropic")).toBe(false);
    setCredential("anthropic", "sk-ant-abcdefgh12345678ijklmnop");
    expect(hasCredential("anthropic")).toBe(true);
    deleteCredential("anthropic");
    expect(hasCredential("anthropic")).toBe(false);
  });

  it("rejects implausibly short keys", () => {
    expect(() => setCredential("openai", "short")).toThrow();
  });
});
