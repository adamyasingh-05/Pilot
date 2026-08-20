import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "../../src/tools/filesystem/index.js";
import { toolRegistry } from "../../src/tools/registry.js";

describe("filesystem tools", () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-fs-test-"));
  const ctx = { workspaceRoot };

  beforeEach(() => {
    fs.writeFileSync(path.join(workspaceRoot, "a.txt"), "hello world");
    fs.mkdirSync(path.join(workspaceRoot, "sub"), { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it("fs_list lists workspace contents", async () => {
    const tool = toolRegistry.get("fs_list")!;
    const result = await tool.run({ path: "." }, ctx);
    expect(result.ok).toBe(true);
    expect(result.output).toContain("a.txt");
  });

  it("fs_read returns file contents", async () => {
    const tool = toolRegistry.get("fs_read")!;
    const result = await tool.run({ path: "a.txt" }, ctx);
    expect(result.output).toBe("hello world");
  });

  it("fs_write creates a new file within the workspace", async () => {
    const tool = toolRegistry.get("fs_write")!;
    await tool.run({ path: "new.txt", content: "written" }, ctx);
    expect(fs.readFileSync(path.join(workspaceRoot, "new.txt"), "utf-8")).toBe("written");
  });

  it("fs_write refuses to escape the workspace", async () => {
    const tool = toolRegistry.get("fs_write")!;
    await expect(tool.run({ path: "../outside.txt", content: "x" }, ctx)).rejects.toThrow();
  });

  it("fs_move relocates a file", async () => {
    const tool = toolRegistry.get("fs_move")!;
    await tool.run({ from: "a.txt", to: "sub/a.txt" }, ctx);
    expect(fs.existsSync(path.join(workspaceRoot, "sub", "a.txt"))).toBe(true);
    expect(fs.existsSync(path.join(workspaceRoot, "a.txt"))).toBe(false);
  });

  it("fs_delete removes a single file but refuses directories", async () => {
    const tool = toolRegistry.get("fs_delete")!;
    await tool.run({ path: "a.txt" }, ctx);
    expect(fs.existsSync(path.join(workspaceRoot, "a.txt"))).toBe(false);
    await expect(tool.run({ path: "sub" }, ctx)).rejects.toThrow();
  });

  it("every filesystem tool classifies its risk", () => {
    for (const name of ["fs_list", "fs_read", "fs_write", "fs_move", "fs_delete"]) {
      const tool = toolRegistry.get(name)!;
      expect(["safe", "review", "dangerous"]).toContain(tool.classifyRisk({}));
    }
  });
});
