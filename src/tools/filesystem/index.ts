import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { resolveSafePath } from "../../security/paths.js";
import { classifyFileWriteRisk } from "../../security/permissions.js";
import { ToolExecutionError } from "../../core/errors.js";
import { toolRegistry, type ToolContext, type ToolResult } from "../registry.js";

function summarizeEntry(fullPath: string, name: string): string {
  const stat = fs.statSync(fullPath);
  const kind = stat.isDirectory() ? "dir" : "file";
  const size = stat.isFile() ? `${stat.size}b` : "";
  return `${kind}\t${name}\t${size}`;
}

toolRegistry.register({
  spec: {
    name: "fs_list",
    description:
      "List files and directories inside a given path within the workspace. Returns name, type, and size.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path within the workspace, '.' for root." },
      },
      required: ["path"],
    },
  },
  classifyRisk: () => "safe",
  describe: (args) => `List contents of ${args.path}`,
  run: async (args, ctx: ToolContext): Promise<ToolResult> => {
    const { resolved } = resolveSafePath(String(args.path ?? "."), ctx.workspaceRoot);
    const entries = await fsp.readdir(resolved);
    const lines = entries.map((name) => summarizeEntry(path.join(resolved, name), name));
    return { ok: true, output: lines.join("\n") || "(empty directory)" };
  },
});

toolRegistry.register({
  spec: {
    name: "fs_read",
    description: "Read the text contents of a file within the workspace.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        maxBytes: { type: "number", description: "Truncate to this many bytes. Default 20000." },
      },
      required: ["path"],
    },
  },
  classifyRisk: () => "safe",
  describe: (args) => `Read ${args.path}`,
  run: async (args, ctx): Promise<ToolResult> => {
    const { resolved } = resolveSafePath(String(args.path), ctx.workspaceRoot);
    const maxBytes = typeof args.maxBytes === "number" ? args.maxBytes : 20000;
    const buf = await fsp.readFile(resolved);
    const truncated = buf.length > maxBytes;
    const content = buf.subarray(0, maxBytes).toString("utf-8");
    return {
      ok: true,
      output: truncated ? content + "\n…[truncated]" : content,
    };
  },
});

toolRegistry.register({
  spec: {
    name: "fs_write",
    description: "Write (create or overwrite) a text file within the workspace.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  classifyRisk: () => "review",
  describe: (args) => `Write file ${args.path} (${String(args.content ?? "").length} chars)`,
  run: async (args, ctx): Promise<ToolResult> => {
    const { resolved } = resolveSafePath(String(args.path), ctx.workspaceRoot);
    await fsp.mkdir(path.dirname(resolved), { recursive: true });
    await fsp.writeFile(resolved, String(args.content ?? ""), "utf-8");
    return { ok: true, output: `Wrote ${resolved}` };
  },
});

toolRegistry.register({
  spec: {
    name: "fs_move",
    description: "Move or rename a file/directory within the workspace.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["from", "to"],
    },
  },
  classifyRisk: () => "review",
  describe: (args) => `Move ${args.from} → ${args.to}`,
  run: async (args, ctx): Promise<ToolResult> => {
    const { resolved: fromResolved } = resolveSafePath(String(args.from), ctx.workspaceRoot);
    const { resolved: toResolved } = resolveSafePath(String(args.to), ctx.workspaceRoot);
    await fsp.mkdir(path.dirname(toResolved), { recursive: true });
    await fsp.rename(fromResolved, toResolved);
    return { ok: true, output: `Moved to ${toResolved}` };
  },
});

toolRegistry.register({
  spec: {
    name: "fs_delete",
    description: "Delete a file within the workspace. Never used on directories or protected paths.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  classifyRisk: () => classifyFileWriteRisk("", true),
  describe: (args) => `Delete ${args.path}`,
  run: async (args, ctx): Promise<ToolResult> => {
    const { resolved } = resolveSafePath(String(args.path), ctx.workspaceRoot);
    const stat = await fsp.stat(resolved);
    if (stat.isDirectory()) {
      throw new ToolExecutionError(
        "fs_delete refuses to remove directories. Delete files individually."
      );
    }
    await fsp.unlink(resolved);
    return { ok: true, output: `Deleted ${resolved}` };
  },
});
