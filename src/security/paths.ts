import os from "node:os";
import path from "node:path";
import { PathSecurityError } from "../core/errors.js";

/**
 * Directories Pilot will never touch, even with explicit user approval,
 * because a mistake there is catastrophic rather than merely annoying.
 */
const HARD_DENY_PATHS = [
  "/",
  "/etc",
  "/bin",
  "/sbin",
  "/usr",
  "/System",
  "/Windows",
  "/boot",
  path.join(os.homedir(), ".ssh"),
  path.join(os.homedir(), ".pilot", "keys"),
  path.join(os.homedir(), ".aws"),
  path.join(os.homedir(), ".gnupg"),
];

export interface PathCheckResult {
  resolved: string;
  withinWorkspace: boolean;
}

/**
 * Resolves a user/model-supplied path against a workspace root and
 * rejects anything that escapes the workspace via `..`, symlink tricks,
 * or an absolute path pointing outside it — unless the caller explicitly
 * allows out-of-workspace access (still subject to HARD_DENY_PATHS).
 */
export function resolveSafePath(
  inputPath: string,
  workspaceRoot: string,
  opts: { allowOutsideWorkspace?: boolean } = {}
): PathCheckResult {
  const resolved = path.resolve(workspaceRoot, inputPath);
  const normalizedRoot = path.resolve(workspaceRoot);

  for (const denied of HARD_DENY_PATHS) {
    const normalizedDenied = path.resolve(denied);
    if (resolved === normalizedDenied || resolved.startsWith(normalizedDenied + path.sep)) {
      throw new PathSecurityError(
        `Refusing to access protected path: ${denied}`
      );
    }
  }

  const withinWorkspace =
    resolved === normalizedRoot || resolved.startsWith(normalizedRoot + path.sep);

  if (!withinWorkspace && !opts.allowOutsideWorkspace) {
    throw new PathSecurityError(
      `Path "${inputPath}" resolves outside the current workspace (${workspaceRoot}). ` +
        `Re-run with an explicit out-of-workspace approval if this is intended.`
    );
  }

  return { resolved, withinWorkspace };
}

export function isProtectedPath(inputPath: string): boolean {
  const resolved = path.resolve(inputPath);
  return HARD_DENY_PATHS.some(
    (denied) => resolved === path.resolve(denied) || resolved.startsWith(path.resolve(denied) + path.sep)
  );
}
