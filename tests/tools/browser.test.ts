import { describe, it, expect } from "vitest";
import "../../src/tools/browser/index.js";
import { toolRegistry } from "../../src/tools/registry.js";
import { BROWSER_TOOLS_IMPLEMENTED } from "../../src/tools/browser/index.js";

// These tests only exercise registration, spec shape, and risk
// classification — never an actual Chromium launch — so they run in any
// CI environment regardless of whether browser binaries are installed.
describe("browser tools", () => {
  it("is no longer a stub", () => {
    expect(BROWSER_TOOLS_IMPLEMENTED).toBe(true);
  });

  it("registers every browser tool", () => {
    const names = toolRegistry.list().map((t) => t.spec.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "browser_open",
        "browser_click",
        "browser_type",
        "browser_extract_text",
        "browser_screenshot",
        "browser_close",
      ])
    );
  });

  it("classifies read-only actions as safe and mutating actions as review", () => {
    expect(toolRegistry.get("browser_open")!.classifyRisk({})).toBe("safe");
    expect(toolRegistry.get("browser_extract_text")!.classifyRisk({})).toBe("safe");
    expect(toolRegistry.get("browser_close")!.classifyRisk({})).toBe("safe");

    expect(toolRegistry.get("browser_click")!.classifyRisk({})).toBe("review");
    expect(toolRegistry.get("browser_type")!.classifyRisk({})).toBe("review");
    expect(toolRegistry.get("browser_screenshot")!.classifyRisk({})).toBe("review");
  });

  it("refuses to navigate to non-http(s) URLs", async () => {
    const tool = toolRegistry.get("browser_open")!;
    await expect(tool.run({ url: "file:///etc/passwd" }, { workspaceRoot: "/tmp" })).rejects.toThrow(
      /only http:\/\/ and https:\/\/ URLs/
    );
  });

  it("describes actions in human-readable form for the approval prompt", () => {
    expect(toolRegistry.get("browser_open")!.describe({ url: "https://example.com" })).toContain(
      "https://example.com"
    );
    expect(toolRegistry.get("browser_click")!.describe({ selector: "#submit" })).toContain("#submit");
  });
});
