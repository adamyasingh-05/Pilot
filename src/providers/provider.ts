export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface CompletionResult {
  text: string;
  toolCalls: ToolCallRequest[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "error";
}

export interface CompletionRequest {
  messages: ChatMessage[];
  tools: ToolSpec[];
  model: string;
  maxTokens?: number;
}

/**
 * Every provider implements this interface. Implementations receive an
 * already-resolved API key at call time — they never read credentials
 * from disk themselves, and they never log or echo the key.
 */
export interface ModelProvider {
  readonly id: string;
  complete(request: CompletionRequest, apiKey: string | undefined): Promise<CompletionResult>;
}
