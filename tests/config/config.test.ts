import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-config-home-"));
process.env.HOME = tempHome;
process.env.USERPROFILE = tempHome;

const { loadConfig, saveConfig, updateConfig } = await import("../../src/config/config.js");
const { defaultConfig } = await import("../../src/config/defaults.js");

describe("config", () => {
  afterAll(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("creates a default config on first load", () => {
    const config = loadConfig();
    expect(config.provider).toBe("ollama");
    expect(fs.existsSync(path.join(tempHome, ".pilot", "config.json"))).toBe(true);
  });

  it("persists updates", () => {
    updateConfig({ provider: "anthropic", model: "claude-sonnet-4-6" });
    const raw = JSON.parse(
      fs.readFileSync(path.join(tempHome, ".pilot", "config.json"), "utf-8")
    );
    expect(raw.provider).toBe("anthropic");
    expect(raw.model).toBe("claude-sonnet-4-6");
  });

  it("rejects an invalid provider value on save", () => {
    const bad = { ...defaultConfig(), provider: "not-a-real-provider" } as never;
    expect(() => saveConfig(bad)).toThrow();
  });
});
