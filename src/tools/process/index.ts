import { execa } from "execa";
import { toolRegistry, type ToolResult } from "../registry.js";

toolRegistry.register({
  spec: {
    name: "process_list",
    description: "List currently running processes (name, pid, cpu, memory).",
    parameters: { type: "object", properties: {} },
  },
  classifyRisk: () => "safe",
  describe: () => "List running processes",
  run: async (): Promise<ToolResult> => {
    const isWin = process.platform === "win32";
    const result = isWin
      ? await execa("tasklist", [], { reject: false })
      : await execa("ps", ["-eo", "pid,pcpu,pmem,comm"], { reject: false });
    return { ok: result.exitCode === 0, output: result.stdout.slice(0, 6000) };
  },
});

toolRegistry.register({
  spec: {
    name: "process_kill",
    description: "Terminate a process by PID. Requires explicit user approval.",
    parameters: {
      type: "object",
      properties: { pid: { type: "number" } },
      required: ["pid"],
    },
  },
  classifyRisk: () => "review",
  describe: (args) => `Kill process ${args.pid}`,
  run: async (args): Promise<ToolResult> => {
    const pid = Number(args.pid);
    try {
      process.kill(pid);
      return { ok: true, output: `Sent termination signal to pid ${pid}` };
    } catch (err) {
      return { ok: false, output: err instanceof Error ? err.message : String(err) };
    }
  },
});
