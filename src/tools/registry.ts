import type { ToolSpec } from "../providers/provider.js";
import type { RiskLevel } from "../security/permissions.js";

export interface ToolContext {
  workspaceRoot: string;
}

export interface ToolResult {
  ok: boolean;
  output: string;
  data?: unknown;
}

export interface ToolDefinition {
  spec: ToolSpec;
  /** Computes the risk level for a specific invocation before it runs. */
  classifyRisk: (args: Record<string, unknown>) => RiskLevel;
  /** Human-readable one-liner shown in the approval prompt. */
  describe: (args: Record<string, unknown>) => string;
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.spec.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  specs(): ToolSpec[] {
    return this.list().map((t) => t.spec);
  }
}

export const toolRegistry = new ToolRegistry();
