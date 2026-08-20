import { execa } from "execa";
import { classifyCommandRisk } from "../../security/permissions.js";
import { toolRegistry, type ToolContext, type ToolResult } from "../registry.js";
import { redact } from "../../security/redaction.js";

toolRegistry.register({
  spec: {
    name: "terminal_exec",
    description:
      "Run a shell command in the workspace directory and return its stdout/stderr. " +
      "Use for things like running tests, git status, builds, etc. Long-running or " +
      "interactive commands are not supported.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The full shell command to run." },
        timeoutMs: { type: "number", description: "Max time to wait. Default 60000." },
      },
      required: ["command"],
    },
  },
  classifyRisk: (args) => classifyCommandRisk(String(args.command ?? "")),
  describe: (args) => `Run: ${redact(String(args.command))}`,
  run: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const command = String(args.command);
    const timeout = typeof args.timeoutMs === "number" ? args.timeoutMs : 60_000;

    try {
      const result = await execa(command, {
        shell: true,
        cwd: ctx.workspaceRoot,
        timeout,
        reject: false,
        env: sanitizedEnv(),
      });

      const combined = [result.stdout, result.stderr].filter(Boolean).join("\n");
      return {
        ok: result.exitCode === 0,
        output: redact(combined).slice(0, 8000) || `(exit code ${result.exitCode})`,
        data: { exitCode: result.exitCode },
      };
    } catch (err) {
      return { ok: false, output: redact(err instanceof Error ? err.message : String(err)) };
    }
  },
});

/**
 * The child process inherits a copy of process.env with anything that
 * looks like a Pilot-managed provider credential stripped out, so tool
 * commands can never accidentally read a key out of the environment.
 */
function sanitizedEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/API_KEY|_TOKEN|_SECRET/i.test(key)) {
      delete env[key];
    }
  }
  return env;
}
