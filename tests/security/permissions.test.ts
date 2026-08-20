import { describe, it, expect } from "vitest";
import { classifyCommandRisk, classifyFileWriteRisk, PermissionManager } from "../../src/security/permissions.js";

describe("classifyCommandRisk", () => {
  it("flags obviously destructive commands as dangerous", () => {
    expect(classifyCommandRisk("rm -rf /")).toBe("dangerous");
    expect(classifyCommandRisk("sudo rm -rf /var")).toBe("dangerous");
  });

  it("flags moderately risky commands for review", () => {
    expect(classifyCommandRisk("rm old-file.txt")).toBe("review");
    expect(classifyCommandRisk("git push --force")).toBe("review");
  });

  it("treats read-only commands as safe", () => {
    expect(classifyCommandRisk("ls -la")).toBe("safe");
    expect(classifyCommandRisk("git status")).toBe("safe");
    expect(classifyCommandRisk("npm test")).toBe("safe");
  });
});

describe("classifyFileWriteRisk", () => {
  it("treats deletes as review, writes as safe", () => {
    expect(classifyFileWriteRisk("foo.txt", true)).toBe("review");
    expect(classifyFileWriteRisk("foo.txt", false)).toBe("safe");
  });
});

describe("PermissionManager", () => {
  it("never prompts for safe actions", async () => {
    let prompted = false;
    const manager = new PermissionManager(async () => {
      prompted = true;
      return "approve";
    });
    const result = await manager.requestApproval({ action: "fs_list", summary: "list", risk: "safe" });
    expect(result).toBe(true);
    expect(prompted).toBe(false);
  });

  it("honors a denial", async () => {
    const manager = new PermissionManager(async () => "deny");
    const result = await manager.requestApproval({ action: "fs_delete", summary: "delete x", risk: "review" });
    expect(result).toBe(false);
  });

  it("approve_all skips future prompts for the same action this session", async () => {
    let promptCount = 0;
    const manager = new PermissionManager(async () => {
      promptCount += 1;
      return "approve_all";
    });
    await manager.requestApproval({ action: "fs_write", summary: "write a", risk: "review" });
    const second = await manager.requestApproval({ action: "fs_write", summary: "write b", risk: "review" });
    expect(second).toBe(true);
    expect(promptCount).toBe(1);
  });

  it("dangerous actions always require a fresh prompt even with auto-approve", async () => {
    let promptCount = 0;
    const manager = new PermissionManager(async () => {
      promptCount += 1;
      return "approve";
    });
    manager.enableAutoApproveForSession();
    await manager.requestApproval({ action: "terminal_exec", summary: "rm -rf /", risk: "dangerous" });
    expect(promptCount).toBe(1);
  });
});
