export interface AgentStepEvent {
  type: "thinking" | "tool_call" | "tool_result" | "approval_needed" | "final";
  detail: string;
  toolName?: string;
}

export type AgentEventHandler = (event: AgentStepEvent) => void;

export interface AgentRunResult {
  success: boolean;
  summary: string;
  steps: number;
}
