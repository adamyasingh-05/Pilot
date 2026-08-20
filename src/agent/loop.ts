import { MAX_AGENT_STEPS } from "../core/constants.js";
import { toSafeErrorMessage } from "../core/errors.js";
import { logger } from "../core/logger.js";
import { toolRegistry, type ToolContext } from "../tools/registry.js";
import { PermissionManager, type ApprovalPrompter } from "../security/permissions.js";
import { recordAudit } from "../security/audit.js";
import { createTask, completeTask, failTask, recordStep } from "../memory/memory.js";
import { buildInitialMessages } from "./planner.js";
import { buildAgentContext } from "./context.js";
import { closeBrowser } from "../tools/browser/index.js";
import type { ChatMessage } from "../providers/provider.js";
import type { AgentEventHandler, AgentRunResult } from "./types.js";

export interface RunTaskOptions {
  prompt: string;
  onEvent?: AgentEventHandler;
  approvalPrompter: ApprovalPrompter;
  autoApproveSafe?: boolean;
}

export async function runTask(options: RunTaskOptions): Promise<AgentRunResult> {
  const { prompt, onEvent, approvalPrompter } = options;
  const emit = onEvent ?? (() => {});

  const ctx = buildAgentContext();
  const toolCtx: ToolContext = { workspaceRoot: ctx.workspaceRoot };
  const permissions = new PermissionManager(approvalPrompter);
  if (options.autoApproveSafe) permissions.enableAutoApproveForSession();

  const messages: ChatMessage[] = buildInitialMessages(prompt, ctx.workspaceRoot);
  const taskId = createTask(prompt);

  let step = 0;
  try {
    while (step < MAX_AGENT_STEPS) {
      step += 1;
      emit({ type: "thinking", detail: `Step ${step}: consulting model` });

      const result = await ctx.provider.complete(
        { messages, tools: toolRegistry.specs(), model: ctx.model },
        ctx.apiKey
      );

      if (result.text) {
        messages.push({ role: "assistant", content: result.text });
      }

      if (result.stopReason !== "tool_use" || result.toolCalls.length === 0) {
        completeTask(taskId, result.text || "Task completed.");
        emit({ type: "final", detail: result.text || "Done." });
        return { success: true, summary: result.text || "Done.", steps: step };
      }

      for (const call of result.toolCalls) {
        const tool = toolRegistry.get(call.name);
        if (!tool) {
          messages.push({
            role: "tool",
            toolCallId: call.id,
            toolName: call.name,
            content: `Error: unknown tool "${call.name}"`,
          });
          continue;
        }

        const risk = tool.classifyRisk(call.arguments);
        const description = tool.describe(call.arguments);
        emit({ type: "tool_call", detail: description, toolName: call.name });

        const approved = await permissions.requestApproval({
          action: call.name,
          summary: description,
          risk,
        });

        if (!approved) {
          recordAudit({ action: call.name, detail: description, approved: false, risk });
          messages.push({
            role: "tool",
            toolCallId: call.id,
            toolName: call.name,
            content: "User denied permission for this action.",
          });
          recordStep(taskId, step, call.name, description, "denied by user", false);
          continue;
        }

        try {
          const toolResult = await tool.run(call.arguments, toolCtx);
          recordAudit({ action: call.name, detail: description, approved: true, risk });
          recordStep(taskId, step, call.name, description, toolResult.output.slice(0, 500), true);
          emit({ type: "tool_result", detail: toolResult.output, toolName: call.name });
          messages.push({
            role: "tool",
            toolCallId: call.id,
            toolName: call.name,
            content: toolResult.output,
          });
        } catch (err) {
          const safeMessage = toSafeErrorMessage(err);
          logger.error(`Tool "${call.name}" failed`, { message: safeMessage });
          recordStep(taskId, step, call.name, description, `error: ${safeMessage}`, true);
          messages.push({
            role: "tool",
            toolCallId: call.id,
            toolName: call.name,
            content: `Error: ${safeMessage}`,
          });
        }
      }
    }

    failTask(taskId, "Stopped: exceeded maximum step count.");
    return { success: false, summary: "Stopped: exceeded maximum step count.", steps: step };
  } catch (err) {
    const safeMessage = toSafeErrorMessage(err);
    logger.error("Agent run failed", { message: safeMessage });
    failTask(taskId, safeMessage);
    emit({ type: "final", detail: `Failed: ${safeMessage}` });
    return { success: false, summary: safeMessage, steps: step };
  } finally {
    // Never leave a headless Chromium process running after a task ends,
    // whether it used the browser tools or not.
    await closeBrowser().catch(() => {});
  }
}
