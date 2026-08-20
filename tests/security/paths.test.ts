import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import { resolveSafePath, isProtectedPath } from "../../src/security/paths.js";
import { PathSecurityError } from "../../src/core/errors.js";

describe("resolveSafePath", () => {
  const workspace = path.join(os.tmpdir(), "pilot-test-workspace");

  it("allows paths inside the workspace", () => {
    const result = resolveSafePath("subdir/file.txt", workspace);
    expect(result.withinWorkspace).toBe(true);
    expect(result.resolved.startsWith(workspace)).toBe(true);
  });

  it("rejects traversal outside the workspace", () => {
    expect(() => resolveSafePath("../../../etc/passwd", workspace)).toThrow(PathSecurityError);
  });

  it("rejects absolute paths outside the workspace", () => {
    expect(() => resolveSafePath("/etc/passwd", workspace)).toThrow(PathSecurityError);
  });

  it("always blocks protected system directories, even as the workspace root itself", () => {
    const sshDir = path.join(os.homedir(), ".ssh");
    expect(() => resolveSafePath(".", sshDir)).toThrow(PathSecurityError);
  });

  it("allows outside-workspace access only when explicitly permitted", () => {
    const outside = path.join(os.tmpdir(), "pilot-test-other");
    expect(() => resolveSafePath(outside, workspace)).toThrow(PathSecurityError);
    const result = resolveSafePath(outside, workspace, { allowOutsideWorkspace: true });
    expect(result.withinWorkspace).toBe(false);
  });
});

describe("isProtectedPath", () => {
  it("flags known-sensitive directories", () => {
    expect(isProtectedPath(path.join(os.homedir(), ".ssh"))).toBe(true);
    expect(isProtectedPath("/etc")).toBe(true);
  });

  it("does not flag ordinary paths", () => {
    expect(isProtectedPath(path.join(os.tmpdir(), "some-project"))).toBe(false);
  });
});
